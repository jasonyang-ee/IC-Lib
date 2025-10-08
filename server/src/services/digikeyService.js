import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const DIGIKEY_API_BASE = 'https://api.digikey.com/v1';
let accessToken = null;
let tokenExpiry = null;

// Get OAuth2 access token
async function getAccessToken() {
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return accessToken;
  }

  try {
    const response = await axios.post(
      'https://api.digikey.com/v1/oauth2/token',
      new URLSearchParams({
        client_id: process.env.DIGIKEY_CLIENT_ID,
        client_secret: process.env.DIGIKEY_CLIENT_SECRET,
        grant_type: 'client_credentials'
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    accessToken = response.data.access_token;
    tokenExpiry = Date.now() + (response.data.expires_in * 1000);
    return accessToken;
  } catch (error) {
    console.error('Error getting Digikey access token:', error.message);
    throw new Error('Failed to authenticate with Digikey API');
  }
}

// Search for a part
export async function searchPart(partNumber) {
  try {
    const token = await getAccessToken();

    const response = await axios.post(
      `${DIGIKEY_API_BASE}/Search/v3/Products/Keyword`,
      {
        Keywords: partNumber,
        RecordCount: 10
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-DIGIKEY-Client-Id': process.env.DIGIKEY_CLIENT_ID,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      source: 'digikey',
      results: response.data.Products?.map(product => ({
        partNumber: product.DigiKeyPartNumber,
        manufacturerPartNumber: product.ManufacturerPartNumber,
        manufacturer: product.Manufacturer?.Name,
        description: product.ProductDescription,
        datasheet: product.PrimaryDatasheet,
        pricing: product.StandardPricing?.map(price => ({
          quantity: price.BreakQuantity,
          price: price.UnitPrice,
          currency: 'USD'
        })),
        stock: product.QuantityAvailable,
        specifications: product.Parameters?.reduce((acc, param) => {
          acc[param.Parameter] = {
            value: param.Value,
            unit: param.ValueType
          };
          return acc;
        }, {}),
        productUrl: product.ProductUrl
      })) || []
    };
  } catch (error) {
    console.error('Digikey search error:', error.message);
    
    // Return mock data for development if API is not configured
    if (error.message.includes('authenticate')) {
      return {
        source: 'digikey',
        error: 'API not configured. Please set DIGIKEY_CLIENT_ID and DIGIKEY_CLIENT_SECRET',
        results: []
      };
    }
    
    throw error;
  }
}

// Get detailed part information
export async function getPartDetails(digikeyPartNumber) {
  try {
    const token = await getAccessToken();

    const response = await axios.get(
      `${DIGIKEY_API_BASE}/Search/v3/Products/${digikeyPartNumber}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-DIGIKEY-Client-Id': process.env.DIGIKEY_CLIENT_ID
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Digikey part details error:', error.message);
    throw error;
  }
}
