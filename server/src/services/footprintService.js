import axios from 'axios';
import pool from '../config/database.js';
import fs from 'fs/promises';
import path from 'path';

const FOOTPRINT_DOWNLOAD_DIR = process.env.FOOTPRINT_DOWNLOAD_DIR || './downloads/footprints';

// Ensure download directory exists
async function ensureDownloadDir() {
  try {
    await fs.mkdir(FOOTPRINT_DOWNLOAD_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating download directory:', error);
  }
}

// Download footprint from Ultra Librarian
export async function downloadFromUltraLibrarian(partNumber, componentId) {
  try {
    await ensureDownloadDir();

    const token = process.env.ULTRA_LIBRARIAN_TOKEN;
    
    if (!token || token === 'your_ultra_librarian_token') {
      return {
        success: false,
        error: 'Ultra Librarian API not configured',
        message: 'Please set ULTRA_LIBRARIAN_TOKEN in environment variables'
      };
    }

    // Ultra Librarian API endpoint (this is a placeholder - check actual API docs)
    const response = await axios.get(
      `https://www.ultralibrarian.com/api/v1/part/${encodeURIComponent(partNumber)}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (response.data && response.data.downloadUrl) {
      const downloadPath = path.join(FOOTPRINT_DOWNLOAD_DIR, `${partNumber}_UL.brd`);
      
      // Download the actual file
      const fileResponse = await axios.get(response.data.downloadUrl, {
        responseType: 'arraybuffer'
      });
      
      await fs.writeFile(downloadPath, fileResponse.data);

      // Update component with footprint path if componentId provided
      if (componentId) {
        await pool.query(
          'UPDATE components SET footprint_path = $1 WHERE id = $2',
          [downloadPath, componentId]
        );

        await pool.query(`
          INSERT INTO footprint_sources (component_id, source_name, download_url, file_format)
          VALUES ($1, $2, $3, $4)
        `, [componentId, 'Ultra Librarian', response.data.downloadUrl, 'Allegro']);
      }

      return {
        success: true,
        path: downloadPath,
        source: 'Ultra Librarian'
      };
    }

    return {
      success: false,
      error: 'Footprint not found',
      message: 'No footprint available for this part number'
    };
  } catch (error) {
    console.error('Ultra Librarian download error:', error.message);
    return {
      success: false,
      error: error.message,
      message: 'Failed to download from Ultra Librarian'
    };
  }
}

// Download footprint from SnapEDA
export async function downloadFromSnapEDA(partNumber, componentId) {
  try {
    await ensureDownloadDir();

    const apiKey = process.env.SNAPEDA_API_KEY;
    
    if (!apiKey || apiKey === 'your_snapeda_api_key') {
      return {
        success: false,
        error: 'SnapEDA API not configured',
        message: 'Please set SNAPEDA_API_KEY in environment variables'
      };
    }

    // SnapEDA API endpoint (this is a placeholder - check actual API docs)
    const searchResponse = await axios.get(
      `https://www.snapeda.com/api/v1/parts/search`,
      {
        params: {
          q: partNumber,
          api_key: apiKey
        }
      }
    );

    if (searchResponse.data && searchResponse.data.results && searchResponse.data.results.length > 0) {
      const part = searchResponse.data.results[0];
      
      if (part.cad_models && part.cad_models.allegro) {
        const downloadUrl = part.cad_models.allegro.download_url;
        const downloadPath = path.join(FOOTPRINT_DOWNLOAD_DIR, `${partNumber}_SnapEDA.brd`);
        
        // Download the actual file
        const fileResponse = await axios.get(downloadUrl, {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          },
          responseType: 'arraybuffer'
        });
        
        await fs.writeFile(downloadPath, fileResponse.data);

        // Update component with footprint path if componentId provided
        if (componentId) {
          await pool.query(
            'UPDATE components SET footprint_path = $1 WHERE id = $2',
            [downloadPath, componentId]
          );

          await pool.query(`
            INSERT INTO footprint_sources (component_id, source_name, download_url, file_format)
            VALUES ($1, $2, $3, $4)
          `, [componentId, 'SnapEDA', downloadUrl, 'Allegro']);
        }

        return {
          success: true,
          path: downloadPath,
          source: 'SnapEDA'
        };
      }
    }

    return {
      success: false,
      error: 'Footprint not found',
      message: 'No Allegro footprint available for this part number'
    };
  } catch (error) {
    console.error('SnapEDA download error:', error.message);
    return {
      success: false,
      error: error.message,
      message: 'Failed to download from SnapEDA'
    };
  }
}

// Try to download from both sources
export async function downloadFootprint(partNumber, componentId) {
  // Try Ultra Librarian first
  let result = await downloadFromUltraLibrarian(partNumber, componentId);
  
  if (result.success) {
    return result;
  }

  // If failed, try SnapEDA
  result = await downloadFromSnapEDA(partNumber, componentId);
  
  return result;
}
