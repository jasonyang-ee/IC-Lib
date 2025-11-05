import axios from 'axios';

const MOUSER_API_BASE = 'https://api.mouser.com/api/v1';
const API_KEY = process.env.MOUSER_API_KEY;

// Search for a part
export async function searchPart(partNumber, retryCount = 0) {
  const MAX_RETRIES = 3;
  
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
      results: data.Parts?.map(part => {
        // Extract specifications from Mouser ProductAttributes
        const specifications = part.ProductAttributes?.reduce((acc, attr) => {
          if (attr.AttributeName && attr.AttributeValue) {
            acc[attr.AttributeName] = {
              value: attr.AttributeValue,
              unit: ''
            };
          }
          return acc;
        }, {}) || {};

        return {
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
          minimumOrderQuantity: part.Min || 1,
          specifications: specifications
        };
      }) || []
    };
  } catch (error) {
    // Handle rate limiting with exponential backoff
    if (error.response) {
      const isRateLimitError = error.response.status === 403 && 
        error.response.data?.Errors?.some(e => e.Code === 'TooManyRequests');
      
      if (isRateLimitError && retryCount < MAX_RETRIES) {
        const waitTime = Math.pow(2, retryCount) * 5000; // 5s, 10s, 20s
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return searchPart(partNumber, retryCount + 1);
      }
    }
    
    // Return empty results for API errors
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
