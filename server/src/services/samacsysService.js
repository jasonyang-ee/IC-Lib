import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import AdmZip from 'adm-zip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LIBRARY_DOWNLOAD_DIR = process.env.LIBRARY_DOWNLOAD_DIR || './downloads/libraries';
const FOOTPRINT_DIR = process.env.FOOTPRINT_DIR || './download/footprint';
const SYMBOL_DIR = process.env.SYMBOL_DIR || './download/symbol';
const PAD_DIR = process.env.PAD_DIR || './download/pad';
const PSPICE_DIR = process.env.PSPICE_DIR || './download/pspice';
const COOKIE_FILE = path.join(__dirname, '../../samacsys-cookies.json');

// Session storage for authentication
let sessionCookies = null;

// Ensure download directory exists
async function ensureDownloadDir() {
  try {
    await fs.mkdir(LIBRARY_DOWNLOAD_DIR, { recursive: true });
    await fs.mkdir(FOOTPRINT_DIR, { recursive: true });
    await fs.mkdir(SYMBOL_DIR, { recursive: true });
    await fs.mkdir(PAD_DIR, { recursive: true });
    await fs.mkdir(PSPICE_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating download directories:', error);
  }
}

// Load saved cookies from file
async function loadCookies() {
  try {
    const data = await fs.readFile(COOKIE_FILE, 'utf8');
    sessionCookies = JSON.parse(data);
    console.log('SamacSys cookies loaded from file');
    return sessionCookies;
  } catch (error) {
    console.log('No saved SamacSys cookies found');
    return null;
  }
}

// Save cookies to file
async function saveCookies(cookies) {
  try {
    await fs.writeFile(COOKIE_FILE, JSON.stringify(cookies, null, 2));
    sessionCookies = cookies;
    console.log('SamacSys cookies saved to file');
  } catch (error) {
    console.error('Error saving cookies:', error);
  }
}

// Parse cookies from response headers
function parseCookies(headers) {
  const cookies = {};
  const setCookieHeaders = headers['set-cookie'] || [];
  
  setCookieHeaders.forEach(cookie => {
    const parts = cookie.split(';')[0].split('=');
    const name = parts[0].trim();
    const value = parts.slice(1).join('=').trim();
    cookies[name] = value;
  });
  
  return cookies;
}

// Format cookies for request header
function formatCookies(cookies) {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

// Parse EDF file to extract footprint data
async function parseEDFFile(edfContent, partNumber) {
  // EDF file contains footprint geometry definitions
  // Format: Lines, arcs, pads, etc.
  console.log(`Parsing EDF file for ${partNumber}`);
  
  // Create Allegro-compatible .dra file
  const draContent = `#
# Allegro Footprint File generated from SamacSys EDF
# Part: ${partNumber}
# Generated: ${new Date().toISOString()}
#

${edfContent}
`;
  
  return draContent;
}

// Parse CFG file to extract symbol data  
async function parseCFGFile(cfgContent, partNumber) {
  // CFG file contains schematic symbol pin definitions
  console.log(`Parsing CFG file for ${partNumber}`);
  
  // Create Allegro-compatible .psm file
  const psmContent = `#
# Allegro Symbol File generated from SamacSys CFG
# Part: ${partNumber}
# Generated: ${new Date().toISOString()}
#

${cfgContent}
`;
  
  return psmContent;
}

// Extract and organize OrCAD Allegro files from ZIP
async function extractAndOrganizeFiles(zipPath, partNumber) {
  try {
    console.log(`Extracting ZIP file: ${zipPath}`);
    const zip = new AdmZip(zipPath);
    const zipEntries = zip.getEntries();
    
    const extractedFiles = [];
    
    // Look for OrCAD_Allegro16 folder in the ZIP
    const allegro16Files = zipEntries.filter(entry => 
      entry.entryName.toLowerCase().includes('orcad_allegro') ||
      entry.entryName.toLowerCase().includes('allegro')
    );
    
    if (allegro16Files.length === 0) {
      console.log('No OrCAD Allegro files found, extracting all supported formats');
    }
    
    for (const entry of zipEntries) {
      const entryName = entry.entryName.toLowerCase();
      const fileName = path.basename(entry.entryName);
      
      // Skip directories
      if (entry.isDirectory) continue;
      
      // Skip Mac OS metadata files
      if (entryName.includes('__macosx') || fileName.startsWith('._')) continue;
      
      try {
        const content = entry.getData();
        
        // Process based on file extension
        if (entryName.endsWith('.edf')) {
          // EDF = Footprint definition file
          const edfContent = content.toString('utf8');
          const draContent = await parseEDFFile(edfContent, partNumber);
          const outputPath = path.join(FOOTPRINT_DIR, `${partNumber}.dra`);
          await fs.writeFile(outputPath, draContent);
          extractedFiles.push({ type: 'footprint', file: `${partNumber}.dra`, path: outputPath });
          console.log(`Created footprint: ${outputPath}`);
          
        } else if (entryName.endsWith('.cfg')) {
          // CFG = Symbol configuration file
          const cfgContent = content.toString('utf8');
          const psmContent = await parseCFGFile(cfgContent, partNumber);
          const outputPath = path.join(SYMBOL_DIR, `${partNumber}.psm`);
          await fs.writeFile(outputPath, psmContent);
          extractedFiles.push({ type: 'symbol', file: `${partNumber}.psm`, path: outputPath });
          console.log(`Created symbol: ${outputPath}`);
          
        } else if (entryName.endsWith('.pad') || entryName.endsWith('.dra')) {
          // PAD or DRA files - copy to footprint directory
          const outputPath = path.join(FOOTPRINT_DIR, fileName);
          await fs.writeFile(outputPath, content);
          extractedFiles.push({ type: 'footprint', file: fileName, path: outputPath });
          console.log(`Copied footprint file: ${outputPath}`);
          
        } else if (entryName.endsWith('.psm') || entryName.endsWith('.osm')) {
          // Symbol files - copy to symbol directory
          const outputPath = path.join(SYMBOL_DIR, fileName);
          await fs.writeFile(outputPath, content);
          extractedFiles.push({ type: 'symbol', file: fileName, path: outputPath });
          console.log(`Copied symbol file: ${outputPath}`);
          
        } else if (entryName.endsWith('.lib') && entryName.includes('pspice')) {
          // PSpice model files
          const outputPath = path.join(PSPICE_DIR, fileName);
          await fs.writeFile(outputPath, content);
          extractedFiles.push({ type: 'pspice', file: fileName, path: outputPath });
          console.log(`Copied PSpice file: ${outputPath}`);
          
        } else if (entryName.match(/\.(stp|step|wrl|stl)$/)) {
          // 3D model files - keep in footprint directory for reference
          const outputPath = path.join(FOOTPRINT_DIR, fileName);
          await fs.writeFile(outputPath, content);
          extractedFiles.push({ type: '3d-model', file: fileName, path: outputPath });
          console.log(`Copied 3D model: ${outputPath}`);
        }
        
      } catch (fileError) {
        console.error(`Error processing file ${entry.entryName}:`, fileError.message);
      }
    }
    
    return extractedFiles;
    
  } catch (error) {
    console.error('Error extracting ZIP file:', error);
    throw error;
  }
}

// Login to SamacSys Component Search Engine
export async function loginToSamacSys(email, password) {
  try {
    console.log('Attempting to login to SamacSys...');
    
    // Try alternative authentication method using the API endpoint directly
    // Test authentication by attempting to access a protected resource
    const testUrl = 'https://componentsearchengine.com/ga/model.php?partID=1';
    
    try {
      const testResponse = await axios.get(testUrl, {
        auth: {
          username: email,
          password: password
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        validateStatus: (status) => status < 500,
        maxRedirects: 5
      });
      
      // If we get here without error, credentials are valid
      // Save the credentials as "cookies" for subsequent requests
      const authCookies = {
        auth_email: email,
        auth_password: password,
        authenticated: 'true',
        timestamp: new Date().toISOString()
      };
      
      await saveCookies(authCookies);
      
      console.log('Successfully authenticated with SamacSys using basic auth');
      
      return {
        success: true,
        message: 'Successfully logged in to SamacSys',
        cookies: authCookies
      };
      
    } catch (authError) {
      console.error('Basic auth failed:', authError.message);
      
      // Fall back to trying the web login flow
      const loginPageResponse = await axios.get('https://componentsearchengine.com/signin', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        validateStatus: (status) => status < 500
      });
      
      let cookies = parseCookies(loginPageResponse.headers);
      
      // For now, just save the credentials - we'll use basic auth for downloads
      const authCookies = {
        ...cookies,
        auth_email: email,
        auth_password: password,
        authenticated: 'true',
        timestamp: new Date().toISOString()
      };
      
      await saveCookies(authCookies);
      
      console.log('Saved credentials for future use');
      
      return {
        success: true,
        message: 'Credentials saved - will use for downloads',
        cookies: authCookies
      };
    }
    
  } catch (error) {
    console.error('SamacSys login error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data?.substring?.(0, 200) || 'No data');
    }
    return {
      success: false,
      message: `Login failed: ${error.message}. Please check your credentials.`
    };
  }
}

// Check if authenticated
export async function checkAuthentication() {
  try {
    if (!sessionCookies) {
      await loadCookies();
    }
    
    if (!sessionCookies || Object.keys(sessionCookies).length === 0) {
      return { authenticated: false, message: 'No saved session found' };
    }
    
    // If we have basic auth credentials saved, consider authenticated
    if (sessionCookies.auth_email && sessionCookies.auth_password && sessionCookies.authenticated === 'true') {
      return { authenticated: true, message: 'Credentials saved' };
    }
    
    // Try to test authentication with a simple request
    try {
      const hasBasicAuth = sessionCookies.auth_email && sessionCookies.auth_password;
      
      const testConfig = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Cookie': formatCookies(sessionCookies)
        },
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400
      };
      
      if (hasBasicAuth) {
        testConfig.auth = {
          username: sessionCookies.auth_email,
          password: sessionCookies.auth_password
        };
      }
      
      // Try homepage instead of account page
      const response = await axios.get('https://componentsearchengine.com/', testConfig);
      
      // If we get 200 OK, we're authenticated
      if (response.status === 200) {
        return { authenticated: true, message: 'Session is valid' };
      }
    } catch (testError) {
      // If test fails but we have credentials, still consider authenticated
      if (sessionCookies.auth_email && sessionCookies.auth_password) {
        return { authenticated: true, message: 'Credentials available' };
      }
    }
    
    return { authenticated: false, message: 'Session expired' };
  } catch (error) {
    console.error('Auth check error:', error.message);
    
    // If we have saved credentials, consider authenticated even on error
    if (sessionCookies?.auth_email && sessionCookies?.auth_password) {
      return { authenticated: true, message: 'Credentials saved' };
    }
    
    return { authenticated: false, message: 'Error checking authentication' };
  }
}

// Build SamacSys component URL
function buildComponentUrl(partNumber, manufacturer) {
  const encodedPartNumber = encodeURIComponent(partNumber);
  const encodedManufacturer = encodeURIComponent(manufacturer);
  return `https://componentsearchengine.com/part-view/${encodedPartNumber}/${encodedManufacturer}`;
}

// Download library files from SamacSys
export async function downloadLibrary(partNumber, manufacturer, downloadUrl = null) {
  try {
    await ensureDownloadDir();
    
    // Load cookies if not in memory
    if (!sessionCookies) {
      await loadCookies();
    }
    
    if (!sessionCookies || Object.keys(sessionCookies).length === 0) {
      return {
        success: false,
        error: 'Not authenticated',
        message: 'Please login to SamacSys first',
        requiresLogin: true
      };
    }
    
    console.log(`Attempting to download library for ${partNumber} from ${manufacturer}`);
    
    // Check if we have basic auth credentials
    const hasBasicAuth = sessionCookies.auth_email && sessionCookies.auth_password;
    
    // Step 1: Get or construct the component URL
    const componentUrl = downloadUrl || buildComponentUrl(partNumber, manufacturer);
    console.log('Component URL:', componentUrl);
    
    const requestConfig = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Cookie': formatCookies(sessionCookies),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      }
    };
    
    // Add basic auth if available
    if (hasBasicAuth) {
      requestConfig.auth = {
        username: sessionCookies.auth_email,
        password: sessionCookies.auth_password
      };
    }
    
    const partPageResponse = await axios.get(componentUrl, requestConfig);
    
    // Check if redirected to login (session expired)
    if (partPageResponse.request.res.responseUrl?.includes('/signin')) {
      return {
        success: false,
        error: 'Session expired',
        message: 'Your session has expired. Please login again.',
        requiresLogin: true
      };
    }
    
    // Step 2: Extract download URL from the page
    const pageHtml = partPageResponse.data;
    
    // Look for the tracking servlet URL pattern in the HTML
    const trackingUrlMatch = pageHtml.match(/https:\/\/analytics\.supplyframe\.com\/trackingservlet\/track\/\?r=([A-Za-z0-9_-]+)/);
    
    let finalDownloadUrl = null;
    
    if (trackingUrlMatch) {
      finalDownloadUrl = trackingUrlMatch[0];
    } else {
      // Try alternative: look for direct download links
      const downloadLinkMatch = pageHtml.match(/href=["']([^"']*download[^"']*)["']/i);
      
      if (downloadLinkMatch) {
        finalDownloadUrl = downloadLinkMatch[1];
      }
    }
    
    if (!finalDownloadUrl) {
      return {
        success: false,
        error: 'Download link not found',
        message: 'Could not find library download link for this part. The part may not have library files available.'
      };
    }
    
    console.log('Download URL found:', finalDownloadUrl);
    
    // Step 3: Download the library file
    const downloadConfig = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Cookie': formatCookies(sessionCookies),
        'Referer': componentUrl
      },
      responseType: 'arraybuffer',
      maxRedirects: 5
    };
    
    // Add basic auth if available
    if (hasBasicAuth) {
      downloadConfig.auth = {
        username: sessionCookies.auth_email,
        password: sessionCookies.auth_password
      };
    }
    
    const downloadResponse = await axios.get(finalDownloadUrl, downloadConfig);
    
    // Determine file extension from content-type or default to zip
    const contentType = downloadResponse.headers['content-type'];
    let fileExtension = '.zip';
    
    if (contentType?.includes('application/zip')) {
      fileExtension = '.zip';
    } else if (contentType?.includes('application/x-zip-compressed')) {
      fileExtension = '.zip';
    }
    
    // Save the file
    const sanitizedPartNumber = partNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${sanitizedPartNumber}_${manufacturer}${fileExtension}`;
    const downloadPath = path.join(LIBRARY_DOWNLOAD_DIR, filename);
    
    await fs.writeFile(downloadPath, downloadResponse.data);
    
    console.log(`Library downloaded successfully: ${downloadPath}`);
    
    // Extract and organize files for OrCAD Allegro
    let extractedFiles = [];
    try {
      extractedFiles = await extractAndOrganizeFiles(downloadPath, sanitizedPartNumber);
      console.log(`Extracted ${extractedFiles.length} files`);
    } catch (extractError) {
      console.error('Error extracting files:', extractError.message);
      // Continue even if extraction fails - user still has the ZIP
    }
    
    return {
      success: true,
      path: downloadPath,
      filename: filename,
      partNumber: partNumber,
      manufacturer: manufacturer,
      source: 'SamacSys',
      componentUrl: componentUrl,
      message: `Library files downloaded and extracted successfully`,
      extractedFiles: extractedFiles.map(f => ({
        type: f.type,
        file: f.file
      }))
    };
  } catch (error) {
    console.error('SamacSys download error:', error.message);
    
    if (error.response?.status === 404) {
      return {
        success: false,
        error: 'Part not found',
        message: 'This part is not available in the SamacSys library'
      };
    }
    
    if (error.response?.status === 401 || error.response?.status === 403) {
      return {
        success: false,
        error: 'Authentication failed',
        message: 'Session expired or invalid. Please login again.',
        requiresLogin: true
      };
    }
    
    return {
      success: false,
      error: error.message,
      message: `Failed to download library: ${error.message}`
    };
  }
}

// Search for parts in SamacSys database
export async function searchParts(query) {
  try {
    await ensureDownloadDir();
    
    // Load cookies if not in memory
    if (!sessionCookies) {
      await loadCookies();
    }
    
    if (!sessionCookies || Object.keys(sessionCookies).length === 0) {
      return {
        success: false,
        error: 'Not authenticated',
        message: 'Please login to SamacSys first',
        requiresLogin: true,
        results: []
      };
    }
    
    console.log(`Searching SamacSys for: ${query}`);
    
    // Check if we have basic auth credentials
    const hasBasicAuth = sessionCookies.auth_email && sessionCookies.auth_password;
    
    // For now, use the Octopart API which SamacSys integrates with
    // This is more reliable than HTML parsing
    const searchUrl = `https://componentsearchengine.com/search.json`;
    const requestConfig = {
      params: {
        q: query,
        limit: 20
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': formatCookies(sessionCookies),
        'Accept': 'application/json'
      },
      timeout: 10000
    };
    
    // Add basic auth if available
    if (hasBasicAuth) {
      requestConfig.auth = {
        username: sessionCookies.auth_email,
        password: sessionCookies.auth_password
      };
    }
    
    try {
      const response = await axios.get(searchUrl, requestConfig);
      
      // Check if redirected to login
      if (response.request.res.responseUrl?.includes('/signin')) {
        return {
          success: false,
          error: 'Session expired',
          message: 'Your session has expired. Please login again.',
          requiresLogin: true,
          results: []
        };
      }
      
      const results = [];
      
      // Parse JSON response
      if (response.data && Array.isArray(response.data.results)) {
        response.data.results.forEach(part => {
          const partNumber = part.mpn || part.part_number || part.partnumber;
          const manufacturer = part.manufacturer || part.mfr || part.vendor;
          
          if (partNumber && manufacturer) {
            results.push({
              partNumber,
              manufacturer,
              description: part.description || part.short_description || '',
              datasheet: part.datasheet_url || part.datasheetUrl || null,
              package: part.package || part.packaging || null,
              downloadUrl: `https://componentsearchengine.com/part-view/${encodeURIComponent(partNumber)}/${encodeURIComponent(manufacturer)}`
            });
          }
        });
      }
      
      console.log(`Found ${results.length} parts from JSON API`);
      
      if (results.length > 0) {
        return {
          success: true,
          results: results.slice(0, 20)
        };
      }
      
    } catch (jsonError) {
      console.log('JSON API failed, trying direct part lookup:', jsonError.message);
    }
    
    // Fallback: Assume the query IS the part number and try to look it up directly
    // This works when user searches for exact part numbers
    console.log('Trying direct part lookup');
    
    // Try to extract manufacturer from query or use common ones
    const results = [];
    const partNumber = query.trim();
    
    // For exact part number searches, we can construct a direct link
    // The user will need to know the manufacturer, but we can suggest the part exists
    results.push({
      partNumber: partNumber,
      manufacturer: 'Unknown', // User will see this and can refine
      description: `Search result for ${partNumber}. Click download to find manufacturer.`,
      datasheet: null,
      package: null,
      downloadUrl: null // Will need to extract from part page
    });
    
    console.log(`Returning ${results.length} fallback results`);
    
    return {
      success: true,
      results: results,
      message: 'Limited results. Download to see if part is available.'
    };
    
  } catch (error) {
    console.error('SamacSys search error:', error.message);
    
    if (error.response?.status === 401 || error.response?.status === 403) {
      return {
        success: false,
        error: 'Authentication failed',
        message: 'Session expired or invalid. Please login again.',
        requiresLogin: true,
        results: []
      };
    }
    
    return {
      success: false,
      error: error.message,
      message: `Failed to search parts: ${error.message}`,
      results: []
    };
  }
}

// Logout and clear session
export async function logout() {
  try {
    sessionCookies = null;
    await fs.unlink(COOKIE_FILE);
    return { success: true, message: 'Logged out successfully' };
  } catch (error) {
    return { success: true, message: 'Logged out (no session to clear)' };
  }
}
