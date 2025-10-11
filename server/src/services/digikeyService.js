import axios from 'axios';

const DIGIKEY_API_BASE = 'https://api.digikey.com';
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
    console.error('Error getting Digikey access token:', error.response?.data || error.message);
    throw new Error('Failed to authenticate with Digikey API');
  }
}

// Search for a part
export async function searchPart(partNumber) {
  try {
    const token = await getAccessToken();

    const response = await axios.post(
      `${DIGIKEY_API_BASE}/products/v4/search/keyword`,
      {
        Keywords: partNumber,
        Limit: 10,
        Offset: 0,
        FilterOptionsRequest: {
          ManufacturerFilter: [],
          MinimumQuantityAvailable: 0,
          PackagingFilter: []
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-DIGIKEY-Client-Id': process.env.DIGIKEY_CLIENT_ID,
          'Content-Type': 'application/json',
          'X-DIGIKEY-Locale-Site': 'US',
          'X-DIGIKEY-Locale-Language': 'en',
          'X-DIGIKEY-Locale-Currency': 'USD'
        }
      }
    );

    return {
      source: 'digikey',
      results: response.data.Products?.map(product => {
        // Get the first product variation (usually the primary packaging)
        const primaryVariation = product.ProductVariations?.[0];
        
        return {
          partNumber: primaryVariation?.DigiKeyProductNumber || 'N/A',
          manufacturerPartNumber: product.ManufacturerProductNumber || 'N/A',
          manufacturer: product.Manufacturer?.Name || 'N/A',
          description: product.Description?.DetailedDescription || product.Description?.ProductDescription || 'N/A',
          datasheet: product.DatasheetUrl || '',
          pricing: primaryVariation?.StandardPricing?.map(price => ({
            quantity: price.BreakQuantity,
            price: price.UnitPrice,
            currency: 'USD'
          })) || (product.UnitPrice ? [{
            quantity: 1,
            price: product.UnitPrice,
            currency: 'USD'
          }] : []),
          stock: product.QuantityAvailable || 0,
          specifications: product.Parameters?.reduce((acc, param) => {
            acc[param.ParameterText] = {
              value: param.ValueText,
              unit: param.ParameterType
            };
            return acc;
          }, {}) || {},
          productUrl: product.ProductUrl || '',
          series: product.Series?.Name || '-',
          category: product.Category?.Name || 'N/A',
          packageType: primaryVariation?.PackageType?.Name || 'N/A',
          minimumOrderQuantity: primaryVariation?.MinimumOrderQuantity || 1
        };
      }) || []
    };
  } catch (error) {
    console.error('Digikey search error:', error.response?.data || error.message);
    console.error('Status:', error.response?.status);
    console.error('Request URL:', error.config?.url);
    
    // Return error information
    if (error.message.includes('authenticate')) {
      return {
        source: 'digikey',
        error: 'API not configured. Please set DIGIKEY_CLIENT_ID and DIGIKEY_CLIENT_SECRET',
        results: []
      };
    }
    
    if (error.response?.status === 404) {
      return {
        source: 'digikey',
        error: 'Digikey API endpoint not found. The API may have changed.',
        results: []
      };
    }
    
    return {
      source: 'digikey',
      error: error.message || 'Unknown error occurred',
      results: []
    };
  }
}

// Get detailed part information
export async function getPartDetails(digikeyPartNumber) {
  try {
    const token = await getAccessToken();

    const response = await axios.get(
      `${DIGIKEY_API_BASE}/products/v4/search/${digikeyPartNumber}/productdetails`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-DIGIKEY-Client-Id': process.env.DIGIKEY_CLIENT_ID,
          'X-DIGIKEY-Locale-Site': 'US',
          'X-DIGIKEY-Locale-Language': 'en',
          'X-DIGIKEY-Locale-Currency': 'USD'
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Digikey part details error:', error.message);
    throw error;
  }
}
