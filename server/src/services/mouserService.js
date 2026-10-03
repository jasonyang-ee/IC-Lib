import axios from 'axios';
import { VENDOR_HTTP_TIMEOUT_MS } from '../constants/vendorHttp.js';

const MOUSER_API_BASE = 'https://api.mouser.com/api/v1';

// Search for a part
export async function searchPart(partNumber, retryCount = 0) {
  const MAX_RETRIES = 3;
  const apiKey = process.env.MOUSER_API_KEY;
  if (!apiKey || apiKey === 'your_mouser_api_key') return { source: 'mouser', error: 'API not configured. Please set MOUSER_API_KEY', results: [] };
  
  try {
    const response = await axios.post(
      `${MOUSER_API_BASE}/search/keyword`,
      {
        SearchByKeywordRequest: {
          keyword: partNumber,
          records: 10,
          startingRecord: 0,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        params: {
          apiKey,
        },
        timeout: VENDOR_HTTP_TIMEOUT_MS, // §V34
      },
    );

    const data = response.data.SearchResults;
    if (!data) return { source: 'mouser', results: [], error: response.data.Errors?.[0]?.Message || 'Mouser returned no search results' };

    return {
      source: 'mouser',
      results: data.Parts?.map(part => {
        // Extract specifications from Mouser ProductAttributes
        const specifications = part.ProductAttributes?.reduce((acc, attr) => {
          if (attr.AttributeName && attr.AttributeValue) {
            acc[attr.AttributeName] = {
              value: attr.AttributeValue,
              unit: '',
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
            currency: price.Currency,
          })),
          stock: Number.parseInt(String(part.AvailabilityInStock || part.Availability || '0').replace(/,/g, ''), 10) || 0,
          productUrl: part.ProductDetailUrl,
          leadTime: part.LeadTime,
          lifecycle: part.LifecycleStatus,
          rohs: part.ROHSStatus,
          packageType: part.PackageType || 'N/A',
          series: part.Series || '-',
          category: part.Category || 'N/A',
          minimumOrderQuantity: part.Min || 1,
          specifications: specifications,
        };
      }) || [],
    };
  } catch (error) {
    // Handle rate limiting with exponential backoff
    if (error.response) {
      const isRateLimitError = error.response.status === 403 && 
        error.response.data?.Errors?.some(e => e.Code === 'TooManyRequests');
      
      if (isRateLimitError) {
        if (retryCount < MAX_RETRIES) {
          const waitTime = Math.pow(2, retryCount) * 5000; // 5s, 10s, 20s
          await new Promise(resolve => setTimeout(resolve, waitTime));
          return searchPart(partNumber, retryCount + 1);
        }

        const rateLimitError = new Error('RATE_LIMIT_EXCEEDED');
        rateLimitError.vendorMessage = error.response.data?.Errors?.find(e => e.Code === 'TooManyRequests')?.Message || 'Daily rate limit exceeded';
        throw rateLimitError;
      }
    }
    
    throw error;
  }
}
