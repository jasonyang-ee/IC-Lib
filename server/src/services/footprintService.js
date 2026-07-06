import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizeCadUploadFilename, sanitizeCadBaseName } from '../utils/footprintFiles.js';
import { logError } from '../utils/logger.js';
import { VENDOR_HTTP_TIMEOUT_MS } from '../constants/vendorHttp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Vendor footprint downloads stage into the shared temp-upload data path
// (library/temp + finalize), the same pipeline as every other CAD upload.
const LIBRARY_BASE = path.resolve(__dirname, '../../../library');
const TEMP_DIR = path.join(LIBRARY_BASE, 'temp');

async function stageFootprintInTemp(fileName, data) {
  await fs.mkdir(TEMP_DIR, { recursive: true });
  const filename = normalizeCadUploadFilename(fileName);
  const tempFilename = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${filename}`;
  await fs.writeFile(path.join(TEMP_DIR, tempFilename), data);
  return { filename, tempFilename, category: 'footprint' };
}

// Download footprint from Ultra Librarian
export async function downloadFromUltraLibrarian(partNumber) {
  try {
    const token = process.env.ULTRA_LIBRARIAN_TOKEN;

    if (!token || token === 'your_ultra_librarian_token') {
      return {
        success: false,
        error: 'Ultra Librarian API not configured',
        message: 'Please set ULTRA_LIBRARIAN_TOKEN in environment variables',
      };
    }

    // Ultra Librarian API endpoint (this is a placeholder - check actual API docs)
    const response = await axios.get(
      `https://www.ultralibrarian.com/api/v1/part/${encodeURIComponent(partNumber)}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        timeout: VENDOR_HTTP_TIMEOUT_MS, // §V34
      },
    );

    if (response.data && response.data.downloadUrl) {
      // Download the actual file and stage it through the temp-upload pipeline
      const fileResponse = await axios.get(response.data.downloadUrl, {
        responseType: 'arraybuffer',
        timeout: VENDOR_HTTP_TIMEOUT_MS, // §V34
      });

      const staged = await stageFootprintInTemp(`${sanitizeCadBaseName(partNumber)}_UL.brd`, fileResponse.data);

      return {
        success: true,
        ...staged,
        source: 'Ultra Librarian',
      };
    }

    return {
      success: false,
      error: 'Footprint not found',
      message: 'No footprint available for this part number',
    };
  } catch (error) {
    logError('Footprint', 'Ultra Librarian download error:', error.message);
    return {
      success: false,
      error: error.message,
      message: 'Failed to download from Ultra Librarian',
    };
  }
}

// Download footprint from SnapEDA
export async function downloadFromSnapEDA(partNumber) {
  try {
    const apiKey = process.env.SNAPEDA_API_KEY;

    if (!apiKey || apiKey === 'your_snapeda_api_key') {
      return {
        success: false,
        error: 'SnapEDA API not configured',
        message: 'Please set SNAPEDA_API_KEY in environment variables',
      };
    }

    // SnapEDA API endpoint (this is a placeholder - check actual API docs)
    const searchResponse = await axios.get(
      'https://www.snapeda.com/api/v1/parts/search',
      {
        params: {
          q: partNumber,
          api_key: apiKey,
        },
        timeout: VENDOR_HTTP_TIMEOUT_MS, // §V34
      },
    );

    if (searchResponse.data && searchResponse.data.results && searchResponse.data.results.length > 0) {
      const part = searchResponse.data.results[0];

      if (part.cad_models && part.cad_models.allegro) {
        const downloadUrl = part.cad_models.allegro.download_url;

        // Download the actual file and stage it through the temp-upload pipeline
        const fileResponse = await axios.get(downloadUrl, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
          responseType: 'arraybuffer',
          timeout: VENDOR_HTTP_TIMEOUT_MS, // §V34
        });

        const staged = await stageFootprintInTemp(`${sanitizeCadBaseName(partNumber)}_SnapEDA.brd`, fileResponse.data);

        return {
          success: true,
          ...staged,
          source: 'SnapEDA',
        };
      }
    }

    return {
      success: false,
      error: 'Footprint not found',
      message: 'No Allegro footprint available for this part number',
    };
  } catch (error) {
    logError('Footprint', 'SnapEDA download error:', error.message);
    return {
      success: false,
      error: error.message,
      message: 'Failed to download from SnapEDA',
    };
  }
}

// Try to download from both sources
export async function downloadFootprint(partNumber) {
  // Try Ultra Librarian first
  let result = await downloadFromUltraLibrarian(partNumber);

  if (result.success) {
    return result;
  }

  // If failed, try SnapEDA
  result = await downloadFromSnapEDA(partNumber);

  return result;
}
