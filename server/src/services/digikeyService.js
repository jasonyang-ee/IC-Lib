import axios from 'axios';
import { logError, logInfo } from '../utils/logger.js';
import { VENDOR_HTTP_TIMEOUT_MS } from '../constants/vendorHttp.js';

const DIGIKEY_API_BASE = 'https://api.digikey.com';
let accessToken = null;
let tokenExpiry = null;

// Search result cache with TTL
const searchCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

// In-flight request tracking for deduplication
const pendingRequests = new Map();

// Cache helper functions
const getCacheKey = (partNumber) => partNumber?.toLowerCase().trim();

const getCachedResult = (partNumber) => {
  const key = getCacheKey(partNumber);
  if (!key) return null;
  
  const cached = searchCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    logInfo('Digikey', `Cache hit for: ${partNumber}`);
    return cached.data;
  }
  
  if (cached) {
    searchCache.delete(key); // Clean up expired entry
  }
  return null;
};

const setCachedResult = (partNumber, data) => {
  const key = getCacheKey(partNumber);
  if (!key) return;
  
  searchCache.set(key, {
    data,
    timestamp: Date.now(),
  });
  
  // Clean up old entries if cache gets too large (max 100 entries)
  if (searchCache.size > 100) {
    const now = Date.now();
    for (const [k, v] of searchCache.entries()) {
      if (now - v.timestamp > CACHE_TTL_MS) {
        searchCache.delete(k);
      }
    }
    while (searchCache.size > 100) {
      searchCache.delete(searchCache.keys().next().value);
    }
  }
};

// Export cache clear function for testing or manual refresh
export const clearSearchCache = () => {
  searchCache.clear();
  logInfo('Digikey', 'Search cache cleared');
};

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
        grant_type: 'client_credentials',
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: VENDOR_HTTP_TIMEOUT_MS, // §V34
      },
    );

    accessToken = response.data.access_token;
    tokenExpiry = Date.now() + (response.data.expires_in * 1000);
    return accessToken;
  } catch (error) {
    logError('Digikey', 'Error getting Digikey access token:', error.message);
    throw new Error('Failed to authenticate with Digikey API');
  }
}

// Search for a part (with caching and request deduplication)
export async function searchPart(partNumber, skipCache = false) {
  const cacheKey = getCacheKey(partNumber);
  
  // Check cache first (unless skipCache is true)
  if (!skipCache) {
    const cachedResult = getCachedResult(partNumber);
    if (cachedResult) {
      return cachedResult;
    }
  }
  
  // Check for in-flight request for same part number (deduplication)
  if (pendingRequests.has(cacheKey)) {
    logInfo('Digikey', `Waiting for in-flight request: ${partNumber}`);
    return pendingRequests.get(cacheKey);
  }
  
  // Create the request promise
  const requestPromise = (async () => {
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
          PackagingFilter: [],
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-DIGIKEY-Client-Id': process.env.DIGIKEY_CLIENT_ID,
          'Content-Type': 'application/json',
          'X-DIGIKEY-Locale-Site': 'US',
          'X-DIGIKEY-Locale-Language': 'en',
          'X-DIGIKEY-Locale-Currency': 'USD',
        },
        timeout: VENDOR_HTTP_TIMEOUT_MS, // §V34
      },
    );

    const result = {
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
            currency: 'USD',
          })) || (product.UnitPrice ? [{
            quantity: 1,
            price: product.UnitPrice,
            currency: 'USD',
          }] : []),
          stock: product.QuantityAvailable || 0,
          specifications: product.Parameters?.reduce((acc, param) => {
            acc[param.ParameterText] = {
              value: param.ValueText,
              unit: param.ParameterType,
            };
            return acc;
          }, {}) || {},
          productUrl: product.ProductUrl || '',
          series: product.Series?.Name || '-',
          category: product.Category?.Name || 'N/A',
          packageType: primaryVariation?.PackageType?.Name || 'N/A',
          minimumOrderQuantity: primaryVariation?.MinimumOrderQuantity || 1,
        };
      }) || [],
    };
    
    // Cache the successful result
    setCachedResult(partNumber, result);
    
    return result;
  } catch (error) {
    logError('Digikey', 'Digikey search error:', error.response?.data || error.message);
    logError('Digikey', 'Status:', error.response?.status);
    logError('Digikey', 'Request URL:', error.config?.url);
    
    // Check for rate limit errors
    if (error.response?.status === 429 || 
        (error.response?.data?.detail && error.response.data.detail.includes('Ratelimit exceeded'))) {
      const rateLimitError = new Error('RATE_LIMIT_EXCEEDED');
      rateLimitError.vendorMessage = error.response?.data?.detail || 'Daily rate limit exceeded';
      throw rateLimitError;
    }
    
    // Return error information for other errors
    if (error.message.includes('authenticate')) {
      return {
        source: 'digikey',
        error: 'API not configured. Please set DIGIKEY_CLIENT_ID and DIGIKEY_CLIENT_SECRET',
        results: [],
      };
    }
    
    if (error.response?.status === 404) {
      return {
        source: 'digikey',
        error: 'Digikey API endpoint not found. The API may have changed.',
        results: [],
      };
    }
    
    return {
      source: 'digikey',
      error: error.message || 'Unknown error occurred',
      results: [],
    };
  }
})();

  // Store the pending request
  pendingRequests.set(cacheKey, requestPromise);
  
  try {
    const result = await requestPromise;
    return result;
  } finally {
    // Clean up pending request
    pendingRequests.delete(cacheKey);
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
          'X-DIGIKEY-Locale-Currency': 'USD',
        },
        timeout: VENDOR_HTTP_TIMEOUT_MS, // §V34
      },
    );

    return response.data;
  } catch (error) {
    logError('Digikey', 'Digikey part details error:', error.message);
    throw error;
  }
}
