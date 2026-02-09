import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';
import { authenticate, canWrite } from '../middleware/auth.js';
import pool from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Base library directory for CAD files (relative to server root)
const LIBRARY_BASE = path.resolve(__dirname, '../../../library');

// File type categories and their subdirectories
// IMPORTANT: Extensions must be unique across categories (except for ambiguous ones handled by path-based logic)
const FILE_CATEGORIES = {
  footprint: {
    extensions: ['.brd', '.kicad_mod', '.lbr', '.psm', '.fsm', '.bxl', '.dra'],
    subdir: 'footprint',
  },
  pad: {
    extensions: ['.pad', '.plb'],
    subdir: 'pad',
  },
  symbol: {
    extensions: ['.olb', '.lib', '.kicad_sym', '.bsm', '.schlib'],
    subdir: 'symbol',
  },
  model: {
    extensions: ['.step', '.stp', '.iges', '.igs', '.wrl', '.3ds', '.x_t'],
    subdir: 'model',
  },
  pspice: {
    extensions: ['.cir', '.sub', '.inc'],
    subdir: 'pspice',
  },
  libraries: {
    extensions: ['.zip', '.7z'],
    subdir: 'libraries',
  },
};

// Map file category to database column name
const CATEGORY_TO_COLUMN = {
  footprint: 'pcb_footprint',
  symbol: 'schematic',
  model: 'step_model',
  pspice: 'pspice',
  pad: 'pad_file',
};

// Passive component categories that can share files
const PASSIVE_CATEGORIES = ['Capacitors', 'Resistors', 'Inductors'];

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Temporary upload directory
    const tempDir = path.join(LIBRARY_BASE, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    // Keep original filename with timestamp to avoid conflicts
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
});

/**
 * Get file category based on extension
 */
function getFileCategory(filename) {
  const ext = path.extname(filename).toLowerCase();
  for (const [category, config] of Object.entries(FILE_CATEGORIES)) {
    if (config.extensions.includes(ext)) {
      return category;
    }
  }
  return null;
}

/**
 * Sanitize part number for use as directory name
 */
function sanitizePartNumber(partNumber) {
  return partNumber.replace(/[<>:"/\\|?*]/g, '_').trim();
}

/**
 * Ensure directory exists
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
}

/**
 * Find file in flat directory first, then fall back to legacy nested directory
 * Returns the full path if found, null otherwise
 */
function findFile(category, filename, mfgPartNumber) {
  const config = FILE_CATEGORIES[category];
  if (!config) return null;

  // Try flat path first
  const flatPath = path.join(LIBRARY_BASE, config.subdir, filename);
  if (fs.existsSync(flatPath)) return flatPath;

  // Try legacy nested path
  if (mfgPartNumber) {
    const sanitizedPN = sanitizePartNumber(mfgPartNumber);
    const nestedPath = path.join(LIBRARY_BASE, config.subdir, sanitizedPN, filename);
    if (fs.existsSync(nestedPath)) return nestedPath;
  }

  return null;
}

/**
 * Move file to appropriate category directory (flat structure)
 * Returns { collision, path, filename } or null
 */
function moveToCategory(sourcePath, category) {
  const config = FILE_CATEGORIES[category];
  if (!config) return null;

  // Flat storage: no MPN subdirectory
  const targetDir = ensureDir(path.join(LIBRARY_BASE, config.subdir));
  const filename = path.basename(sourcePath).replace(/^\d+-\d+-/, ''); // Remove temp prefix
  const targetPath = path.join(targetDir, filename);

  // Collision check: reject if file already exists
  if (fs.existsSync(targetPath)) {
    // Clean up temp file
    if (fs.existsSync(sourcePath)) fs.unlinkSync(sourcePath);
    return { collision: true, filename };
  }

  fs.renameSync(sourcePath, targetPath);
  return { collision: false, path: targetPath, filename };
}

/**
 * Auto-link an uploaded filename to the component's JSONB array in the database
 */
async function autoLinkFileToComponent(category, filename, mfgPartNumber) {
  const dbColumn = CATEGORY_TO_COLUMN[category];
  if (!dbColumn) return;

  try {
    await pool.query(`
      UPDATE components
      SET ${dbColumn} = (
        CASE
          WHEN ${dbColumn} IS NULL THEN jsonb_build_array($1)
          WHEN NOT (${dbColumn} @> jsonb_build_array($1)) THEN ${dbColumn} || jsonb_build_array($1)
          ELSE ${dbColumn}
        END
      )
      WHERE manufacturer_pn = $2
    `, [filename, mfgPartNumber]);
  } catch (error) {
    console.error(`[FileUpload] Failed to auto-link ${filename} to ${mfgPartNumber}: ${error.message}`);
  }
}

/**
 * Detect and extract ZIP file from popular EDA tool providers
 * Files are stored in flat structure (no MPN subdirectory)
 */
function extractSmartZip(zipPath, mfgPartNumber) {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  const extractedFiles = [];
  const collisions = [];
  const zipFilename = path.basename(zipPath).toLowerCase();

  // Analyze ZIP structure to detect source (check both entry names and ZIP filename)
  const filenames = entries.map(e => e.entryName.toLowerCase());

  let source = 'unknown';
  if (filenames.some(f => f.includes('ultralibrarian') || f.includes('ul_')) || zipFilename.includes('ul_')) {
    source = 'ultralibrarian';
  } else if (filenames.some(f => f.includes('snapeda')) || zipFilename.includes('snapeda')) {
    source = 'snapeda';
  } else if (filenames.some(f => f.includes('samacsys') || f.includes('component_search_engine')) || zipFilename.includes('samacsys') || zipFilename.startsWith('lib_')) {
    source = 'samacsys';
  }

  console.log(`[FileUpload] Detected ZIP source: ${source}`);

  // File extensions that are valid EDA files (used to filter path-based matches)
  const validEDAExtensions = new Set([
    '.brd', '.kicad_mod', '.lbr', '.psm', '.fsm', '.bxl', '.dra',
    '.pad', '.plb',
    '.olb', '.lib', '.kicad_sym', '.bsm', '.schlib', '.edf',
    '.step', '.stp', '.iges', '.igs', '.wrl', '.3ds', '.x_t',
    '.cir', '.sub', '.inc', '.mod',
    '.dcm', '.asc', '.hkp',
  ]);

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    const entryName = entry.entryName;
    const filename = path.basename(entryName);
    const ext = path.extname(filename).toLowerCase();

    // Skip hidden files, macOS metadata, and non-EDA files (scripts, docs, etc.)
    if (filename.startsWith('.') || entryName.includes('__MACOSX')) continue;
    if (['.txt', '.pdf', '.html', '.htm', '.css', '.bat', '.sh', '.scr', '.cfg', '.bin', '.xml'].includes(ext)) continue;

    // Determine category based on extension
    let category = getFileCategory(filename);

    // Additional path-based detection for files not matched by extension
    // Only apply if the file has a valid EDA extension
    const lowerPath = entryName.toLowerCase();
    if (!category && validEDAExtensions.has(ext)) {
      if (lowerPath.includes('footprint') || lowerPath.includes('pcbfootprint') || (lowerPath.includes('pcb') && !lowerPath.includes('pcblib'))) {
        category = 'footprint';
      } else if (lowerPath.includes('symbol') || lowerPath.includes('schematic') || lowerPath.includes('capture')) {
        category = 'symbol';
      } else if (lowerPath.includes('3d') || lowerPath.includes('step') || lowerPath.includes('model')) {
        category = 'model';
      } else if (lowerPath.includes('spice') || lowerPath.includes('simulation')) {
        category = 'pspice';
      } else if (lowerPath.includes('padstack')) {
        category = 'pad';
      }
    }

    if (category) {
      const config = FILE_CATEGORIES[category];
      // Flat storage: no MPN subdirectory
      const targetDir = ensureDir(path.join(LIBRARY_BASE, config.subdir));
      const targetPath = path.join(targetDir, filename);

      // Check for collision in flat directory
      if (fs.existsSync(targetPath)) {
        collisions.push({ category, filename, source });
        continue;
      }

      // Extract file directly to flat directory
      zip.extractEntryTo(entry, targetDir, false, true);
      extractedFiles.push({
        category,
        filename,
        path: targetPath,
        source,
      });
    }
  }

  // Clean up the zip file
  fs.unlinkSync(zipPath);

  return { extractedFiles, collisions };
}

/**
 * Upload files for a component
 */
router.post('/upload/:mfgPartNumber', authenticate, canWrite, upload.array('files', 20), async (req, res) => {
  try {
    const { mfgPartNumber } = req.params;
    const { category: explicitCategory } = req.body;

    if (!mfgPartNumber) {
      return res.status(400).json({ error: 'Manufacturer part number is required' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const results = [];

    for (const file of req.files) {
      const ext = path.extname(file.originalname).toLowerCase();

      // Handle ZIP files
      if (ext === '.zip') {
        try {
          const { extractedFiles, collisions } = extractSmartZip(file.path, mfgPartNumber);

          // Auto-link extracted files to component
          for (const ef of extractedFiles) {
            await autoLinkFileToComponent(ef.category, ef.filename, mfgPartNumber);
          }

          results.push({
            originalName: file.originalname,
            type: 'archive',
            extracted: extractedFiles,
            filesExtracted: extractedFiles.length,
            collisions: collisions.length > 0 ? collisions : undefined,
          });
        } catch (error) {
          console.error('Error extracting ZIP:', error);
          // If extraction fails, try to move as library file
          const moveResult = moveToCategory(file.path, 'libraries');
          results.push({
            originalName: file.originalname,
            type: 'library',
            path: moveResult?.path,
            error: 'Could not extract, saved as library file',
          });
        }
      } else {
        // Regular file - determine category
        const category = explicitCategory || getFileCategory(file.originalname);

        if (!category) {
          // Clean up and report error for this file
          fs.unlinkSync(file.path);
          results.push({
            originalName: file.originalname,
            error: 'Unknown file type',
            supported: Object.values(FILE_CATEGORIES).flatMap(c => c.extensions),
          });
          continue;
        }

        const moveResult = moveToCategory(file.path, category);

        if (moveResult?.collision) {
          results.push({
            originalName: file.originalname,
            type: category,
            error: `File "${moveResult.filename}" already exists. Rename or delete the existing file first.`,
            collision: true,
          });
        } else {
          // Auto-link to component
          await autoLinkFileToComponent(category, moveResult.filename, mfgPartNumber);

          results.push({
            originalName: file.originalname,
            type: category,
            path: moveResult.path,
            filename: moveResult.filename,
          });
        }
      }
    }

    res.json({
      message: 'Files processed successfully',
      mfgPartNumber,
      results,
    });
  } catch (error) {
    console.error('Error uploading files:', error);
    res.status(500).json({ error: 'Failed to process uploaded files' });
  }
});

/**
 * Upload shared passive component files (resistor, capacitor, inductor)
 * Files are stored in flat structure
 */
router.post('/upload-passive', authenticate, canWrite, upload.array('files', 20), async (req, res) => {
  try {
    const { value, packageSize, category: componentCategory } = req.body;

    if (!value || !packageSize) {
      return res.status(400).json({ error: 'Value and package size are required for passive components' });
    }

    // Verify it's a passive component category
    if (!PASSIVE_CATEGORIES.includes(componentCategory)) {
      return res.status(400).json({
        error: 'This endpoint is only for passive components (Capacitors, Resistors, Inductors)',
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const results = [];

    for (const file of req.files) {
      const ext = path.extname(file.originalname).toLowerCase();

      // Handle ZIP files
      if (ext === '.zip') {
        try {
          const { extractedFiles, collisions } = extractSmartZip(file.path, '');
          results.push({
            originalName: file.originalname,
            type: 'archive',
            extracted: extractedFiles,
            filesExtracted: extractedFiles.length,
            collisions: collisions.length > 0 ? collisions : undefined,
          });
        } catch (error) {
          console.error('Error extracting ZIP:', error);
          fs.unlinkSync(file.path);
          results.push({
            originalName: file.originalname,
            error: 'Failed to extract archive',
          });
        }
      } else {
        // Regular file
        const category = getFileCategory(file.originalname);

        if (!category) {
          fs.unlinkSync(file.path);
          results.push({
            originalName: file.originalname,
            error: 'Unknown file type',
          });
          continue;
        }

        const moveResult = moveToCategory(file.path, category);
        if (moveResult?.collision) {
          results.push({
            originalName: file.originalname,
            type: category,
            error: `File "${moveResult.filename}" already exists.`,
            collision: true,
          });
        } else {
          results.push({
            originalName: file.originalname,
            type: category,
            path: moveResult.path,
            filename: moveResult.filename,
          });
        }
      }
    }

    res.json({
      message: 'Passive component files processed successfully',
      value,
      packageSize,
      results,
    });
  } catch (error) {
    console.error('Error uploading passive files:', error);
    res.status(500).json({ error: 'Failed to process uploaded files' });
  }
});

/**
 * Check if a file exists in the flat directory (collision check)
 */
router.get('/check-collision/:category/:filename', authenticate, (req, res) => {
  try {
    const { category, filename } = req.params;
    const config = FILE_CATEGORIES[category];
    if (!config) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const filePath = path.join(LIBRARY_BASE, config.subdir, filename);
    const exists = fs.existsSync(filePath);

    res.json({ exists, filename, category });
  } catch (error) {
    console.error('Error checking collision:', error);
    res.status(500).json({ error: 'Failed to check file collision' });
  }
});

/**
 * List files for a component
 * Checks both flat directory and legacy nested directory
 */
router.get('/list/:mfgPartNumber', authenticate, async (req, res) => {
  try {
    const { mfgPartNumber } = req.params;
    const sanitizedPN = sanitizePartNumber(mfgPartNumber);

    const files = {};
    const seenFiles = new Set(); // Prevent duplicates

    for (const [category, config] of Object.entries(FILE_CATEGORIES)) {
      const categoryFiles = [];

      // Check flat directory for files matching this component's JSONB array
      const flatDir = path.join(LIBRARY_BASE, config.subdir);
      const dbColumn = CATEGORY_TO_COLUMN[category];

      if (dbColumn) {
        try {
          const result = await pool.query(`
            SELECT ${dbColumn} as files FROM components WHERE manufacturer_pn = $1 LIMIT 1
          `, [mfgPartNumber]);

          if (result.rows.length > 0 && result.rows[0].files) {
            const dbFiles = result.rows[0].files;
            if (Array.isArray(dbFiles)) {
              for (const fname of dbFiles) {
                const flatPath = path.join(flatDir, fname);
                if (fs.existsSync(flatPath) && !seenFiles.has(`${category}:${fname}`)) {
                  seenFiles.add(`${category}:${fname}`);
                  categoryFiles.push({
                    name: fname,
                    path: path.join(config.subdir, fname),
                    size: fs.statSync(flatPath).size,
                    storage: 'flat',
                  });
                }
              }
            }
          }
        } catch (dbError) {
          // DB query failed, continue with directory scan
          console.error(`[FileUpload] DB lookup failed for ${mfgPartNumber}: ${dbError.message}`);
        }
      }

      // Also check legacy nested directory
      const nestedDir = path.join(LIBRARY_BASE, config.subdir, sanitizedPN);
      if (fs.existsSync(nestedDir)) {
        const dirFiles = fs.readdirSync(nestedDir).filter(f => !f.startsWith('.'));
        for (const f of dirFiles) {
          if (!seenFiles.has(`${category}:${f}`)) {
            seenFiles.add(`${category}:${f}`);
            categoryFiles.push({
              name: f,
              path: path.join(config.subdir, sanitizedPN, f),
              size: fs.statSync(path.join(nestedDir, f)).size,
              storage: 'nested',
            });
          }
        }
      }

      if (categoryFiles.length > 0) {
        files[category] = categoryFiles;
      }
    }

    res.json({
      mfgPartNumber,
      files,
    });
  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

/**
 * Rename a file
 */
router.put('/rename', authenticate, canWrite, async (req, res) => {
  try {
    const { category, mfgPartNumber, oldFilename, newFilename } = req.body;

    if (!category || !mfgPartNumber || !oldFilename || !newFilename) {
      return res.status(400).json({ error: 'Category, part number, old filename, and new filename are required' });
    }

    // Validate category
    const config = FILE_CATEGORIES[category];
    if (!config) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    // Pad files cannot be renamed per requirements
    if (category === 'pad') {
      return res.status(400).json({ error: 'Pad files cannot be renamed' });
    }

    // Sanitize new filename: replace special chars and spaces with underscores, preserve extension
    const oldExt = path.extname(oldFilename).toLowerCase();
    const newExt = path.extname(newFilename).toLowerCase();

    // Ensure the extension is preserved (use old extension if new one differs or is missing)
    const finalExt = (newExt && config.extensions.includes(newExt)) ? newExt : oldExt;
    const newBaseName = path.basename(newFilename, newExt || oldExt)
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    if (!newBaseName) {
      return res.status(400).json({ error: 'Invalid filename after sanitization' });
    }

    const sanitizedNewFilename = newBaseName + finalExt;

    // Find the file (flat or nested)
    const oldPath = findFile(category, oldFilename, mfgPartNumber);
    if (!oldPath) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (oldFilename === sanitizedNewFilename) {
      return res.json({ message: 'No changes needed', filename: sanitizedNewFilename });
    }

    // Collision check in flat directory
    const flatNewPath = path.join(LIBRARY_BASE, config.subdir, sanitizedNewFilename);
    if (fs.existsSync(flatNewPath)) {
      return res.status(409).json({ error: `A file named "${sanitizedNewFilename}" already exists in the ${category} directory` });
    }

    // Move/rename file to flat directory with new name
    const targetDir = ensureDir(path.join(LIBRARY_BASE, config.subdir));
    const newPath = path.join(targetDir, sanitizedNewFilename);
    fs.renameSync(oldPath, newPath);

    // Clean up empty legacy directory if applicable
    const oldDir = path.dirname(oldPath);
    if (oldDir !== targetDir) {
      try {
        const remaining = fs.readdirSync(oldDir).filter(f => !f.startsWith('.'));
        if (remaining.length === 0) fs.rmdirSync(oldDir);
      } catch { /* ignore cleanup errors */ }
    }

    // Update component JSONB arrays: replace old filename with new
    const dbColumn = CATEGORY_TO_COLUMN[category];
    if (dbColumn) {
      try {
        await pool.query(`
          UPDATE components
          SET ${dbColumn} = (
            SELECT jsonb_agg(
              CASE WHEN elem = $1 THEN to_jsonb($2::text) ELSE elem END
            )
            FROM jsonb_array_elements(${dbColumn}) AS elem
          )
          WHERE ${dbColumn} @> jsonb_build_array($1)
        `, [oldFilename, sanitizedNewFilename]);
      } catch (dbError) {
        console.error(`[FileUpload] Failed to update JSONB refs: ${dbError.message}`);
      }
    }

    res.json({
      message: 'File renamed successfully',
      oldFilename,
      newFilename: sanitizedNewFilename,
    });
  } catch (error) {
    console.error('Error renaming file:', error);
    res.status(500).json({ error: 'Failed to rename file' });
  }
});

/**
 * Delete a file
 */
router.delete('/delete', authenticate, canWrite, async (req, res) => {
  try {
    const { category, mfgPartNumber, filename } = req.body;

    if (!category || !mfgPartNumber || !filename) {
      return res.status(400).json({ error: 'Category, part number, and filename are required' });
    }

    const config = FILE_CATEGORIES[category];
    if (!config) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    // Find file (flat or nested)
    const filePath = findFile(category, filename, mfgPartNumber);
    if (!filePath) {
      return res.status(404).json({ error: 'File not found' });
    }

    fs.unlinkSync(filePath);

    // Clean up empty legacy directories
    const dirPath = path.dirname(filePath);
    const flatDir = path.join(LIBRARY_BASE, config.subdir);
    if (dirPath !== flatDir) {
      try {
        const remainingFiles = fs.readdirSync(dirPath).filter(f => !f.startsWith('.'));
        if (remainingFiles.length === 0) fs.rmdirSync(dirPath);
      } catch { /* ignore cleanup errors */ }
    }

    // Remove filename from component's JSONB array
    const dbColumn = CATEGORY_TO_COLUMN[category];
    if (dbColumn) {
      try {
        await pool.query(`
          UPDATE components
          SET ${dbColumn} = (
            SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
            FROM jsonb_array_elements(${dbColumn}) AS elem
            WHERE elem #>> '{}' != $1
          )
          WHERE ${dbColumn} @> jsonb_build_array($1)
            AND manufacturer_pn = $2
        `, [filename, mfgPartNumber]);
      } catch (dbError) {
        console.error(`[FileUpload] Failed to remove JSONB ref: ${dbError.message}`);
      }
    }

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

/**
 * Download a file
 * Supports both new flat path format and legacy nested format
 */
router.get('/download/:category/:mfgPartNumber/:filename', authenticate, async (req, res) => {
  try {
    const { category, mfgPartNumber, filename } = req.params;

    const config = FILE_CATEGORIES[category];
    if (!config) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    // Find file in flat or nested directory
    const filePath = findFile(category, filename, mfgPartNumber);
    if (!filePath) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.download(filePath, filename);
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

/**
 * Export all files for a component as a ZIP archive
 * Checks both flat and legacy nested directories
 */
router.get('/export/:mfgPartNumber', authenticate, async (req, res) => {
  try {
    const { mfgPartNumber } = req.params;
    const sanitizedPN = sanitizePartNumber(mfgPartNumber);

    // Collect all files across categories
    const allFiles = [];
    const seenFiles = new Set();

    for (const [category, config] of Object.entries(FILE_CATEGORIES)) {
      // Check DB for JSONB-linked files in flat directory
      const dbColumn = CATEGORY_TO_COLUMN[category];
      if (dbColumn) {
        try {
          const result = await pool.query(`
            SELECT ${dbColumn} as files FROM components WHERE manufacturer_pn = $1 LIMIT 1
          `, [mfgPartNumber]);

          if (result.rows.length > 0 && Array.isArray(result.rows[0].files)) {
            for (const fname of result.rows[0].files) {
              const flatPath = path.join(LIBRARY_BASE, config.subdir, fname);
              if (fs.existsSync(flatPath) && !seenFiles.has(`${category}:${fname}`)) {
                seenFiles.add(`${category}:${fname}`);
                allFiles.push({
                  category,
                  subdir: config.subdir,
                  filename: fname,
                  fullPath: flatPath,
                });
              }
            }
          }
        } catch { /* continue with directory scan */ }
      }

      // Check legacy nested directory
      const nestedDir = path.join(LIBRARY_BASE, config.subdir, sanitizedPN);
      if (fs.existsSync(nestedDir)) {
        const dirFiles = fs.readdirSync(nestedDir).filter(f => !f.startsWith('.'));
        for (const filename of dirFiles) {
          if (!seenFiles.has(`${category}:${filename}`)) {
            seenFiles.add(`${category}:${filename}`);
            allFiles.push({
              category,
              subdir: config.subdir,
              filename,
              fullPath: path.join(nestedDir, filename),
            });
          }
        }
      }
    }

    if (allFiles.length === 0) {
      return res.status(404).json({ error: 'No files found for this component' });
    }

    // Create ZIP archive
    const zip = new AdmZip();
    for (const file of allFiles) {
      // Organize files into category subdirectories within the ZIP
      zip.addLocalFile(file.fullPath, file.subdir);
    }

    const zipBuffer = zip.toBuffer();
    const zipFilename = `${sanitizedPN}_files.zip`;

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${zipFilename}"`,
      'Content-Length': zipBuffer.length,
    });
    res.send(zipBuffer);
  } catch (error) {
    console.error('Error exporting files:', error);
    res.status(500).json({ error: 'Failed to export files' });
  }
});

export default router;
