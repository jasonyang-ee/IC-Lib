import axios from 'axios';

const MOUSER_API_BASE = 'https://api.mouser.com/api/v1';
const API_KEY = process.env.MOUSER_API_KEY;

// Search for a part
export async function searchPart(partNumber) {
  try {
    const response = await axios.post(
      `${MOUSER_API_BASE}/search/keyword`,
      {
        SearchByKeywordRequest: {
          keyword: partNumber,
          records: 10,
          startingRecord: 0
        }
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        params: {
          apiKey: API_KEY
        }
      }
    );

    const data = response.data.SearchResults;

    return {
      source: 'mouser',
      results: data.Parts?.map(part => ({
        partNumber: part.MouserPartNumber,
        manufacturerPartNumber: part.ManufacturerPartNumber,
        manufacturer: part.Manufacturer,
        description: part.Description,
        datasheet: part.DataSheetUrl,
        pricing: part.PriceBreaks?.map(price => ({
          quantity: price.Quantity,
          price: parseFloat(price.Price.replace(/[^0-9.]/g, '')),
          currency: price.Currency
        })),
        stock: part.Availability ? parseInt(part.Availability.split(' ')[0]) : 0,
        productUrl: part.ProductDetailUrl,
        leadTime: part.LeadTime,
        lifecycle: part.LifecycleStatus,
        rohs: part.ROHSStatus,
        packageType: part.PackageType || 'N/A',
        series: part.Series || '-',
        category: part.Category || 'N/A',
        minimumOrderQuantity: part.Min || 1
      })) || []
    };
  } catch (error) {
    console.error('Mouser search error:', error.message);
    
    // Return mock data for development if API is not configured
    if (!API_KEY || API_KEY === 'your_mouser_api_key') {
      return {
        source: 'mouser',
        error: 'API not configured. Please set MOUSER_API_KEY',
        results: []
      };
    }
    
    throw error;
  }
}

// Get part by Mouser part number
export async function getPartByMouserPartNumber(mouserPartNumber) {
  try {
    const response = await axios.get(
      `${MOUSER_API_BASE}/search/partnumber`,
      {
        params: {
          apiKey: API_KEY,
          partNumber: mouserPartNumber
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Mouser part details error:', error.message);
    throw error;
  }
}
