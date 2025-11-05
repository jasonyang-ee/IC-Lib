import axios from 'axios';

const MOUSER_API_BASE = 'https://api.mouser.com/api/v1';
const API_KEY = process.env.MOUSER_API_KEY;

// Search for a part
export async function searchPart(partNumber, retryCount = 0) {
  const MAX_RETRIES = 3;
  
  console.log('🔍 [MOUSER] Searching for part:', partNumber, retryCount > 0 ? `(Retry ${retryCount}/${MAX_RETRIES})` : '');
  console.log('🔑 [MOUSER] API Key configured:', API_KEY ? `Yes (${API_KEY.substring(0, 8)}...)` : 'No');
  
  try {
    const requestData = {
      SearchByKeywordRequest: {
        keyword: partNumber,
        records: 10,
        startingRecord: 0
      }
    };
    
    console.log('📤 [MOUSER] Request URL:', `${MOUSER_API_BASE}/search/keyword?apiKey=${API_KEY ? API_KEY.substring(0, 8) + '...' : 'MISSING'}`);
    console.log('📤 [MOUSER] Request body:', JSON.stringify(requestData, null, 2));
    
    const response = await axios.post(
      `${MOUSER_API_BASE}/search/keyword`,
      requestData,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        params: {
          apiKey: API_KEY
        }
      }
    );

    console.log('✅ [MOUSER] Response status:', response.status);
    console.log('📥 [MOUSER] Response data:', JSON.stringify(response.data, null, 2));

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
    console.error('❌ [MOUSER] Search error:', error.message);
    
    // Log more details about the error
    if (error.response) {
      console.error('❌ [MOUSER] Error status:', error.response.status);
      console.error('❌ [MOUSER] Error data:', JSON.stringify(error.response.data, null, 2));
      console.error('❌ [MOUSER] Error headers:', JSON.stringify(error.response.headers, null, 2));
      
      // Handle rate limiting with exponential backoff
      const isRateLimitError = error.response.status === 403 && 
        error.response.data?.Errors?.some(e => e.Code === 'TooManyRequests');
      
      if (isRateLimitError && retryCount < MAX_RETRIES) {
        const waitTime = Math.pow(2, retryCount) * 5000; // 5s, 10s, 20s
        console.log(`⏱️ [MOUSER] Rate limited. Waiting ${waitTime/1000}s before retry ${retryCount + 1}/${MAX_RETRIES}...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return searchPart(partNumber, retryCount + 1);
      }
    } else if (error.request) {
      console.error('❌ [MOUSER] No response received');
      console.error('❌ [MOUSER] Request:', error.request);
    } else {
      console.error('❌ [MOUSER] Error setting up request:', error.message);
    }
    
    // Return mock data for development if API is not configured
    if (!API_KEY || API_KEY === 'your_mouser_api_key') {
      console.log('⚠️ [MOUSER] API not configured, returning empty results');
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
