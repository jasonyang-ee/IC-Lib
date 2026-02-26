import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';
import pool from '../config/database.js';
import cadFileService from '../services/cadFileService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base library directory for CAD files (relative to server root)
const LIBRARY_BASE = path.resolve(__dirname, '../../../library');

// File type categories and their subdirectories
// IMPORTANT: Extensions must be unique across categories (except for ambiguous ones handled by path-based logic)
const FILE_CATEGORIES = {
  footprint: {
    extensions: ['.brd', '.psm', '.dra'],
    subdir: 'footprint',
  },
  pad: {
    extensions: ['.pad'],
    subdir: 'pad',
  },
  symbol: {
    extensions: ['.olb'],
    subdir: 'symbol',
  },
  model: {
    extensions: ['.step', '.stp', '.iges', '.igs', '.3ds'],
    subdir: 'model',
  },
  pspice: {
    extensions: ['.lib'],
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
    // Lowercase file extension for consistency
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    const baseName = path.basename(file.originalname, path.extname(file.originalname));
    cb(null, uniqueSuffix + '-' + baseName + ext);
  },
});

export const upload = multer({
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
 * Find file in flat directory first, then fall back to legacy nested directory,
 * then check temp directory for files uploaded during new part creation.
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

  // Try temp directory — files during new part creation are here with unique prefix
  const tempDir = path.join(LIBRARY_BASE, 'temp');
  if (fs.existsSync(tempDir)) {
    const tempFiles = fs.readdirSync(tempDir);
    const match = tempFiles.find(f => f.endsWith('-' + filename));
    if (match) return path.join(tempDir, match);
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
  const rawFilename = path.basename(sourcePath).replace(/^\d+-\d+-/, ''); // Remove temp prefix
  // Lowercase extension for consistency
  const rawExt = path.extname(rawFilename);
  const filename = rawFilename.substring(0, rawFilename.length - rawExt.length) + rawExt.toLowerCase();
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
 * Auto-link an uploaded filename to the component via cad_files junction table.
 * Registers the file in cad_files table and creates junction record,
 * which regenerates the TEXT column automatically.
 */
async function autoLinkFileToComponent(category, filename, mfgPartNumber) {
  const dbColumn = CATEGORY_TO_COLUMN[category];
  if (!dbColumn) return;

  // Map upload category to cad_files file_type
  const fileTypeMap = { footprint: 'footprint', symbol: 'symbol', model: 'model', pspice: 'pspice', pad: 'pad' };
  const fileType = fileTypeMap[category];

  try {
    if (fileType) {
      const cadFile = await cadFileService.registerCadFile(filename, fileType);
      await cadFileService.linkCadFileToComponentByMPN(cadFile.id, mfgPartNumber, fileType, filename);
    }
  } catch (error) {
    console.error(`[FileUpload] Failed to auto-link ${filename} to ${mfgPartNumber}: ${error.message}`);
  }
}

/**
 * Extract ZIP file to temp directory (for temp-buffered uploads).
 * Same detection logic as extractSmartZip but files go to library/temp/ with unique prefixes
 * instead of directly to category directories.
 */
function extractSmartZipToTemp(zipPath) {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  const extractedFiles = [];
  const collisions = [];
  const zipFilename = path.basename(zipPath).toLowerCase();

  // Detect source
  const filenames = entries.map(e => e.entryName.toLowerCase());
  let source = 'unknown';
  if (filenames.some(f => f.includes('ultralibrarian') || f.includes('ul_')) || zipFilename.includes('ul_')) {
    source = 'ultralibrarian';
  } else if (filenames.some(f => f.includes('snapeda')) || zipFilename.includes('snapeda')) {
    source = 'snapeda';
  } else if (filenames.some(f => f.includes('samacsys') || f.includes('component_search_engine')) || zipFilename.includes('samacsys') || zipFilename.startsWith('lib_')) {
    source = 'samacsys';
  }

  const validEDAExtensions = new Set([
    '.brd', '.kicad_mod', '.lbr', '.psm', '.fsm', '.bxl', '.dra',
    '.pad', '.plb',
    '.olb', '.lib', '.kicad_sym', '.bsm', '.schlib', '.edf',
    '.step', '.stp', '.iges', '.igs', '.wrl', '.3ds', '.x_t',
    '.cir', '.sub', '.inc', '.mod',
    '.dcm', '.asc', '.hkp',
  ]);

  const tempDir = ensureDir(path.join(LIBRARY_BASE, 'temp'));

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    const entryName = entry.entryName;
    let filename = path.basename(entryName);
    const ext = path.extname(filename).toLowerCase();

    // Lowercase file extension for consistency
    const rawExt = path.extname(filename);
    if (rawExt !== rawExt.toLowerCase()) {
      filename = filename.substring(0, filename.length - rawExt.length) + rawExt.toLowerCase();
    }

    if (filename.startsWith('.') || entryName.includes('__MACOSX')) continue;
    if (['.txt', '.pdf', '.html', '.htm', '.css', '.bat', '.sh', '.scr', '.cfg', '.bin', '.xml'].includes(ext)) continue;

    let category = getFileCategory(filename);

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
      // Check collision in actual category directory
      const categoryDir = path.join(LIBRARY_BASE, config.subdir);
      if (fs.existsSync(path.join(categoryDir, filename))) {
        collisions.push({ category, filename, source });
        continue;
      }

      // Extract to temp with unique prefix
      const uniquePrefix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const tempFilename = uniquePrefix + '-' + filename;
      zip.extractEntryTo(entry, tempDir, false, true);
      // AdmZip extracts with original name — find it and rename to temp name (with lowercase extension)
      const originalExtractedName = path.basename(entryName);
      const extractedPath = path.join(tempDir, originalExtractedName);
      const tempPath = path.join(tempDir, tempFilename);
      if (fs.existsSync(extractedPath)) {
        fs.renameSync(extractedPath, tempPath);
      }

      extractedFiles.push({
        tempFilename,
        filename,
        category,
        source,
      });
    }
  }

  // Clean up the zip file
  fs.unlinkSync(zipPath);

  return { extractedFiles, collisions };
}

/**
 * Detect and extract ZIP file from popular EDA tool providers
 * Files are stored in flat structure (no MPN subdirectory)
 */
function extractSmartZip(zipPath, _mfgPartNumber) {
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
    let filename = path.basename(entryName);
    const ext = path.extname(filename).toLowerCase();

    // Lowercase file extension for consistency
    const rawExt = path.extname(filename);
    if (rawExt !== rawExt.toLowerCase()) {
      filename = filename.substring(0, filename.length - rawExt.length) + rawExt.toLowerCase();
    }

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
      // Rename from original to lowercase extension if needed
      const originalExtractedName = path.basename(entryName);
      if (originalExtractedName !== filename) {
        const originalPath = path.join(targetDir, originalExtractedName);
        if (fs.existsSync(originalPath)) {
          fs.renameSync(originalPath, targetPath);
        }
      }
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
 * Upload files to temp directory (no MPN required).
 * Files stay in library/temp/ until finalized or cleaned up.
 */
export async function uploadTempFile(req, res) {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const results = [];

    for (const file of req.files) {
      const ext = path.extname(file.originalname).toLowerCase();

      // Handle ZIP files
      if (ext === '.zip') {
        try {
          const { extractedFiles, collisions } = extractSmartZipToTemp(file.path);
          results.push({
            originalName: file.originalname,
            type: 'archive',
            extracted: extractedFiles,
            filesExtracted: extractedFiles.length,
            collisions: collisions.length > 0 ? collisions : undefined,
          });
        } catch (error) {
          console.error('Error extracting ZIP to temp:', error);
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
          results.push({
            originalName: file.originalname,
            error: 'Failed to extract archive',
          });
        }
      } else {
        // Regular file - determine category
        // Normalize filename with lowercase extension
        const origExt = path.extname(file.originalname);
        const normalizedFilename = path.basename(file.originalname, origExt) + origExt.toLowerCase();
        const category = getFileCategory(normalizedFilename);

        if (!category) {
          fs.unlinkSync(file.path);
          results.push({
            originalName: file.originalname,
            error: 'Unknown file type',
            supported: Object.values(FILE_CATEGORIES).flatMap(c => c.extensions),
          });
          continue;
        }

        // Check collision in actual category directory
        const config = FILE_CATEGORIES[category];
        const categoryPath = path.join(LIBRARY_BASE, config.subdir, normalizedFilename);
        if (fs.existsSync(categoryPath)) {
          // File already exists in library — delete temp, report collision
          fs.unlinkSync(file.path);
          results.push({
            originalName: file.originalname,
            type: category,
            filename: normalizedFilename,
            collision: true,
          });
        } else {
          // File stays in temp with its multer-generated name
          const tempFilename = path.basename(file.path);
          results.push({
            originalName: file.originalname,
            type: category,
            filename: normalizedFilename,
            tempFilename,
          });
        }
      }
    }

    res.json({ message: 'Files staged in temp', results });
  } catch (error) {
    console.error('Error uploading temp files:', error);
    res.status(500).json({ error: 'Failed to process uploaded files' });
  }
}

/**
 * Finalize temp files — move from temp to category directories and register in DB.
 * Called on save (add or edit).
 */
export async function finalizeTempFile(req, res) {
  try {
    const { files, mfgPartNumber, collisions } = req.body;

    const hasFiles = files && Array.isArray(files) && files.length > 0;
    const hasCollisions = collisions && Array.isArray(collisions) && collisions.length > 0;

    if (!hasFiles && !hasCollisions) {
      return res.status(400).json({ error: 'No files to finalize' });
    }

    const results = [];
    const fileTypeMap = { footprint: 'footprint', symbol: 'symbol', model: 'model', pspice: 'pspice', pad: 'pad' };

    // Process temp files (move from temp to category directory)
    if (hasFiles) {
      for (const { tempFilename, category } of files) {
        const safeName = path.basename(tempFilename); // prevent traversal
        const tempPath = path.join(LIBRARY_BASE, 'temp', safeName);

        if (!fs.existsSync(tempPath)) {
          // File might have been cleaned up or already moved — skip
          results.push({ filename: safeName, error: 'Temp file not found' });
          continue;
        }

        // Move from temp to category directory
        const moveResult = moveToCategory(tempPath, category);

        if (!moveResult) {
          results.push({ filename: safeName, error: 'Invalid category' });
          continue;
        }

        const filename = moveResult.filename;

        // Register in DB and optionally link to component
        const fileType = fileTypeMap[category];

        if (mfgPartNumber && fileType) {
          await autoLinkFileToComponent(category, filename, mfgPartNumber);
        } else if (fileType) {
          try {
            await cadFileService.registerCadFile(filename, fileType);
          } catch (err) {
            console.error(`[FileUpload] Failed to register ${filename}: ${err.message}`);
          }
        }

        results.push({
          filename,
          type: category,
          collision: moveResult.collision || false,
        });
      }
    }

    // Process collision files (already exist on disk — register in DB and link to component)
    if (hasCollisions && mfgPartNumber) {
      for (const { filename, category } of collisions) {
        const fileType = fileTypeMap[category];
        if (!fileType) continue;

        try {
          await autoLinkFileToComponent(category, filename, mfgPartNumber);
          results.push({ filename, type: category, collision: true, linked: true });
        } catch (err) {
          console.error(`[FileUpload] Failed to link collision file ${filename}: ${err.message}`);
          results.push({ filename, type: category, collision: true, error: err.message });
        }
      }
    }

    res.json({ message: 'Files finalized', results });
  } catch (error) {
    console.error('Error finalizing temp files:', error);
    res.status(500).json({ error: 'Failed to finalize files' });
  }
}

/**
 * Cleanup temp files — delete staged files that were not finalized (cancel flow).
 */
export async function cleanupTempFiles(req, res) {
  try {
    const { tempFilenames } = req.body;

    if (!tempFilenames || !Array.isArray(tempFilenames) || tempFilenames.length === 0) {
      return res.json({ deleted: 0 });
    }

    let deleted = 0;
    for (const name of tempFilenames) {
      const safeName = path.basename(name); // prevent traversal
      const tempPath = path.join(LIBRARY_BASE, 'temp', safeName);
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
        deleted++;
      }
    }

    res.json({ deleted });
  } catch (error) {
    console.error('Error cleaning up temp files:', error);
    res.status(500).json({ error: 'Failed to cleanup temp files' });
  }
}

/**
 * Upload files for a component
 */
export async function uploadFile(req, res) {
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

          // Auto-link collision files (already exist on disk) to component
          for (const col of collisions) {
            await autoLinkFileToComponent(col.category, col.filename, mfgPartNumber);
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
          // Auto-link the existing file to the component even on collision
          await autoLinkFileToComponent(category, moveResult.filename, mfgPartNumber);

          results.push({
            originalName: file.originalname,
            type: category,
            filename: moveResult.filename,
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
}

/**
 * Upload shared passive component files (resistor, capacitor, inductor)
 * Files are stored in flat structure
 */
export async function uploadPassiveFile(req, res) {
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
}

/**
 * Check if a file exists in the flat directory (collision check)
 */
export function checkCollision(req, res) {
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
}

/**
 * List files for a component
 * Checks both flat directory and legacy nested directory
 */
export async function listFiles(req, res) {
  try {
    const { mfgPartNumber } = req.params;
    const sanitizedPN = sanitizePartNumber(mfgPartNumber);

    const files = {};
    const seenFiles = new Set(); // Prevent duplicates

    for (const [category, config] of Object.entries(FILE_CATEGORIES)) {
      const categoryFiles = [];

      // Check flat directory for files linked via cad_files junction table
      const flatDir = path.join(LIBRARY_BASE, config.subdir);
      const dbColumn = CATEGORY_TO_COLUMN[category];

      if (dbColumn) {
        try {
          // Query cad_files via junction table for this component (include missing flag)
          const result = await pool.query(`
            SELECT cf.file_name, cf.missing
            FROM component_cad_files ccf
            JOIN cad_files cf ON ccf.cad_file_id = cf.id
            JOIN components c ON ccf.component_id = c.id
            WHERE c.manufacturer_pn = $1 AND cf.file_type = $2
          `, [mfgPartNumber, category]);

          for (const row of result.rows) {
            const fname = row.file_name;
            const flatPath = path.join(flatDir, fname);
            const existsOnDisk = fs.existsSync(flatPath);

            if (!seenFiles.has(`${category}:${fname}`)) {
              seenFiles.add(`${category}:${fname}`);
              if (existsOnDisk) {
                categoryFiles.push({
                  name: fname,
                  path: path.join(config.subdir, fname),
                  size: fs.statSync(flatPath).size,
                  storage: 'flat',
                });
              } else {
                // File is missing from disk — include with missing flag
                categoryFiles.push({
                  name: fname,
                  path: path.join(config.subdir, fname),
                  size: 0,
                  storage: 'flat',
                  missing: true,
                });
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
}

/**
 * Rename a file
 */
export async function renameFile(req, res) {
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
    const newBaseName = newFilename.replace(/\.[^.]+$/, '')
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    if (!newBaseName) {
      return res.status(400).json({ error: 'Invalid filename after sanitization' });
    }

    const sanitizedNewFilename = newBaseName + finalExt;

    // Find the file (flat, nested, or temp)
    const oldPath = findFile(category, oldFilename, mfgPartNumber);
    if (!oldPath) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (oldFilename === sanitizedNewFilename) {
      return res.json({ message: 'No changes needed', filename: sanitizedNewFilename });
    }

    // Check if file is in temp directory (new part creation flow)
    const tempDir = path.join(LIBRARY_BASE, 'temp');
    const isInTemp = oldPath.startsWith(tempDir);

    if (isInTemp) {
      // Rename within temp directory, preserving the unique prefix
      const tempBasename = path.basename(oldPath);
      // Extract prefix: everything before the original filename
      const suffixIndex = tempBasename.lastIndexOf('-' + oldFilename);
      const prefix = suffixIndex >= 0 ? tempBasename.substring(0, suffixIndex + 1) : '';
      const newTempFilename = prefix + sanitizedNewFilename;
      const newTempPath = path.join(tempDir, newTempFilename);

      // Collision check in temp
      if (fs.existsSync(newTempPath)) {
        return res.status(409).json({ error: `A file named "${sanitizedNewFilename}" already exists` });
      }
      // Also check collision in the actual category directory
      const flatNewPath = path.join(LIBRARY_BASE, config.subdir, sanitizedNewFilename);
      if (fs.existsSync(flatNewPath)) {
        return res.status(409).json({ error: `A file named "${sanitizedNewFilename}" already exists in the ${category} directory` });
      }

      fs.renameSync(oldPath, newTempPath);

      return res.json({
        message: 'File renamed in temp',
        oldFilename,
        newFilename: sanitizedNewFilename,
        oldTempFilename: tempBasename,
        newTempFilename,
        isTemp: true,
      });
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

    // Update cad_files table and regenerate TEXT columns
    // (Physical rename already done above; just update DB record)
    const fileTypeMap = { footprint: 'footprint', symbol: 'symbol', model: 'model', pspice: 'pspice', pad: 'pad' };
    const fileType = fileTypeMap[category];
    if (fileType) {
      try {
        const cadFile = await cadFileService.findCadFile(oldFilename, fileType);
        if (cadFile) {
          const subdir = config.subdir;
          await pool.query(`
            UPDATE cad_files SET file_name = $1, file_path = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3
          `, [sanitizedNewFilename, `${subdir}/${sanitizedNewFilename}`, cadFile.id]);

          // Regenerate TEXT columns for affected components
          const affected = await cadFileService.getComponentsByCadFile(cadFile.id);
          for (const comp of affected) {
            await cadFileService.regenerateCadText(comp.id, fileType);
          }
        }
      } catch (dbError) {
        console.error(`[FileUpload] Failed to update cad_files refs: ${dbError.message}`);
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
}

/**
 * Delete a file (soft-delete with shared-file protection)
 * - If file is shared (linked to multiple components): unlink from requesting component only
 * - If file is sole-use or orphan: move to temp folder (soft-delete) for potential restore
 */
export async function deleteFile(req, res) {
  try {
    const { category, mfgPartNumber, filename } = req.body;

    if (!category || !mfgPartNumber || !filename) {
      return res.status(400).json({ error: 'Category, part number, and filename are required' });
    }

    const config = FILE_CATEGORIES[category];
    if (!config) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const fileTypeMap = { footprint: 'footprint', symbol: 'symbol', model: 'model', pspice: 'pspice', pad: 'pad' };
    const fileType = fileTypeMap[category];

    // Check if this file is shared (linked to multiple components)
    if (fileType) {
      try {
        const cadFile = await cadFileService.findCadFile(filename, fileType);
        if (cadFile) {
          const linkedComponents = await cadFileService.getComponentsByCadFile(cadFile.id);
          const linkCount = linkedComponents.length;

          if (linkCount > 1) {
            // Shared file: only unlink from requesting component, don't delete physical file
            const compResult = await pool.query(
              'SELECT id FROM components WHERE manufacturer_pn = $1',
              [mfgPartNumber],
            );
            const componentId = compResult.rows[0]?.id;

            if (componentId) {
              await cadFileService.unlinkCadFileFromComponent(cadFile.id, componentId, fileType, filename);
            }

            return res.json({
              unlinked: true,
              remaining: linkCount - 1,
              filename,
            });
          }
        }
      } catch (dbError) {
        console.error(`[FileUpload] Shared-file check failed: ${dbError.message}`);
      }
    }

    // Sole-use or orphan: soft-delete (move to temp)
    const filePath = findFile(category, filename, mfgPartNumber);
    if (!filePath) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Move to temp directory instead of deleting
    const tempDir = path.join(LIBRARY_BASE, 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const uniquePrefix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const tempFilename = uniquePrefix + '-' + filename;
    fs.renameSync(filePath, path.join(tempDir, tempFilename));

    // Clean up empty legacy directories
    const dirPath = path.dirname(filePath);
    const flatDir = path.join(LIBRARY_BASE, config.subdir);
    if (dirPath !== flatDir) {
      try {
        const remainingFiles = fs.readdirSync(dirPath).filter(f => !f.startsWith('.'));
        if (remainingFiles.length === 0) fs.rmdirSync(dirPath);
      } catch { /* ignore cleanup errors */ }
    }

    // Remove from cad_files table and regenerate TEXT columns
    if (fileType) {
      try {
        const cadFile = await cadFileService.findCadFile(filename, fileType);
        if (cadFile) {
          const affected = await cadFileService.getComponentsByCadFile(cadFile.id);
          await pool.query('DELETE FROM cad_files WHERE id = $1', [cadFile.id]);
          for (const comp of affected) {
            await cadFileService.regenerateCadText(comp.id, fileType);
          }
        }
      } catch (dbError) {
        console.error(`[FileUpload] Failed to remove cad_files ref: ${dbError.message}`);
      }
    }

    res.json({ softDeleted: true, tempFilename, filename, category });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
}

/**
 * Download a file
 * Supports both new flat path format and legacy nested format
 */
export async function downloadFile(req, res) {
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
}

/**
 * Export all files for a component as a ZIP archive
 * Checks both flat and legacy nested directories
 */
export async function exportFiles(req, res) {
  try {
    const { mfgPartNumber } = req.params;
    const sanitizedPN = sanitizePartNumber(mfgPartNumber);

    // Collect all files across categories
    const allFiles = [];
    const seenFiles = new Set();

    for (const [category, config] of Object.entries(FILE_CATEGORIES)) {
      // Check DB for files linked via cad_files junction table
      const dbColumn = CATEGORY_TO_COLUMN[category];
      if (dbColumn) {
        try {
          const result = await pool.query(`
            SELECT cf.file_name
            FROM component_cad_files ccf
            JOIN cad_files cf ON ccf.cad_file_id = cf.id
            JOIN components c ON ccf.component_id = c.id
            WHERE c.manufacturer_pn = $1 AND cf.file_type = $2
          `, [mfgPartNumber, category]);

          for (const row of result.rows) {
            const fname = row.file_name;
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
}

/**
 * Restore soft-deleted files (move back from temp to category directory)
 * Called when user cancels an edit to undo file deletions
 */
export async function restoreDeletedFile(req, res) {
  try {
    const { files } = req.body;
    if (!files || !Array.isArray(files)) {
      return res.status(400).json({ error: 'files array is required' });
    }

    const results = [];
    for (const { tempFilename, category, filename, mfgPartNumber } of files) {
      const config = FILE_CATEGORIES[category];
      if (!config) {
        results.push({ filename, error: 'Invalid category' });
        continue;
      }

      const tempPath = path.join(LIBRARY_BASE, 'temp', path.basename(tempFilename));
      const targetPath = path.join(LIBRARY_BASE, config.subdir, filename);

      if (!fs.existsSync(tempPath)) {
        results.push({ filename, error: 'Temp file not found' });
        continue;
      }

      fs.renameSync(tempPath, targetPath);

      // Re-register in cad_files and re-link to component
      await autoLinkFileToComponent(category, filename, mfgPartNumber);

      results.push({ filename, restored: true });
    }

    res.json({ results });
  } catch (error) {
    console.error('Error restoring deleted files:', error);
    res.status(500).json({ error: 'Failed to restore files' });
  }
}

/**
 * Confirm soft-deleted files (permanently delete from temp)
 * Called when user saves after deleting files
 */
export async function confirmDeleteFile(req, res) {
  try {
    const { tempFilenames } = req.body;
    if (!tempFilenames || !Array.isArray(tempFilenames)) {
      return res.status(400).json({ error: 'tempFilenames array is required' });
    }

    let deleted = 0;
    for (const tf of tempFilenames) {
      const safeName = path.basename(tf);
      const tempPath = path.join(LIBRARY_BASE, 'temp', safeName);
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
        deleted++;
      }
    }

    res.json({ deleted });
  } catch (error) {
    console.error('Error confirming delete:', error);
    res.status(500).json({ error: 'Failed to confirm delete' });
  }
}
