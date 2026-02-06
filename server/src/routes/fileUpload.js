import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';
import { authenticate, canWrite } from '../middleware/auth.js';
import { convertCaptureXmlToOlb, isCaptureXML } from '../services/olbService.js';

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
 * Move file to appropriate category directory
 */
function moveToCategory(sourcePath, category, mfgPartNumber) {
  const config = FILE_CATEGORIES[category];
  if (!config) return null;
  
  const sanitizedPN = sanitizePartNumber(mfgPartNumber);
  const targetDir = ensureDir(path.join(LIBRARY_BASE, config.subdir, sanitizedPN));
  const filename = path.basename(sourcePath);
  const targetPath = path.join(targetDir, filename.replace(/^\d+-\d+-/, '')); // Remove temp prefix
  
  // If file already exists, add a suffix
  let finalPath = targetPath;
  let counter = 1;
  while (fs.existsSync(finalPath)) {
    const ext = path.extname(targetPath);
    const base = path.basename(targetPath, ext);
    finalPath = path.join(targetDir, `${base}_${counter}${ext}`);
    counter++;
  }
  
  fs.renameSync(sourcePath, finalPath);
  return finalPath;
}

/**
 * Detect and extract ZIP file from popular EDA tool providers
 */
function extractSmartZip(zipPath, mfgPartNumber) {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  const extractedFiles = [];
  const sanitizedPN = sanitizePartNumber(mfgPartNumber);
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
        // Only match 'padstack' specifically, not the PADS EDA tool directory
        category = 'pad';
      }
    }

    if (category) {
      const config = FILE_CATEGORIES[category];
      const targetDir = ensureDir(path.join(LIBRARY_BASE, config.subdir, sanitizedPN));
      const targetPath = path.join(targetDir, filename);

      // Extract file
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

  return extractedFiles;
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
          const extractedFiles = extractSmartZip(file.path, mfgPartNumber);
          results.push({
            originalName: file.originalname,
            type: 'archive',
            extracted: extractedFiles,
            filesExtracted: extractedFiles.length,
          });
        } catch (error) {
          console.error('Error extracting ZIP:', error);
          // If extraction fails, try to move as library file
          const targetPath = moveToCategory(file.path, 'libraries', mfgPartNumber);
          results.push({
            originalName: file.originalname,
            type: 'library',
            path: targetPath,
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
        
        const targetPath = moveToCategory(file.path, category, mfgPartNumber);
        results.push({
          originalName: file.originalname,
          type: category,
          path: targetPath,
        });
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
 * Files are stored by value and package instead of part number
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
    
    // Create a shared identifier like "10K_0402" or "100nF_0603"
    const sharedId = `${value}_${packageSize}`.replace(/[<>:"/\\|?*\s]/g, '_');
    
    const results = [];
    
    for (const file of req.files) {
      const ext = path.extname(file.originalname).toLowerCase();
      
      // Handle ZIP files
      if (ext === '.zip') {
        try {
          const extractedFiles = extractSmartZip(file.path, sharedId);
          results.push({
            originalName: file.originalname,
            type: 'archive',
            extracted: extractedFiles,
            filesExtracted: extractedFiles.length,
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
        
        const targetPath = moveToCategory(file.path, category, sharedId);
        results.push({
          originalName: file.originalname,
          type: category,
          path: targetPath,
        });
      }
    }
    
    res.json({
      message: 'Passive component files processed successfully',
      sharedId,
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
 * List files for a component
 */
router.get('/list/:mfgPartNumber', authenticate, async (req, res) => {
  try {
    const { mfgPartNumber } = req.params;
    const sanitizedPN = sanitizePartNumber(mfgPartNumber);
    
    const files = {};
    
    for (const [category, config] of Object.entries(FILE_CATEGORIES)) {
      const dirPath = path.join(LIBRARY_BASE, config.subdir, sanitizedPN);
      
      if (fs.existsSync(dirPath)) {
        const dirFiles = fs.readdirSync(dirPath)
          .filter(f => !f.startsWith('.'))
          .map(f => ({
            name: f,
            path: path.join(config.subdir, sanitizedPN, f),
            size: fs.statSync(path.join(dirPath, f)).size,
          }));
        
        if (dirFiles.length > 0) {
          files[category] = dirFiles;
        }
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
    const sanitizedPN = sanitizePartNumber(mfgPartNumber);
    const dirPath = path.join(LIBRARY_BASE, config.subdir, sanitizedPN);
    const oldPath = path.join(dirPath, oldFilename);
    const newPath = path.join(dirPath, sanitizedNewFilename);

    if (!fs.existsSync(oldPath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (oldFilename === sanitizedNewFilename) {
      return res.json({ message: 'No changes needed', filename: sanitizedNewFilename });
    }

    if (fs.existsSync(newPath)) {
      return res.status(409).json({ error: 'A file with that name already exists' });
    }

    fs.renameSync(oldPath, newPath);

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
    
    const sanitizedPN = sanitizePartNumber(mfgPartNumber);
    const filePath = path.join(LIBRARY_BASE, config.subdir, sanitizedPN, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    fs.unlinkSync(filePath);
    
    // Clean up empty directories
    const dirPath = path.dirname(filePath);
    const remainingFiles = fs.readdirSync(dirPath).filter(f => !f.startsWith('.'));
    if (remainingFiles.length === 0) {
      fs.rmdirSync(dirPath);
    }
    
    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

/**
 * Download a file
 */
router.get('/download/:category/:mfgPartNumber/:filename', authenticate, async (req, res) => {
  try {
    const { category, mfgPartNumber, filename } = req.params;
    
    const config = FILE_CATEGORIES[category];
    if (!config) {
      return res.status(400).json({ error: 'Invalid category' });
    }
    
    const sanitizedPN = sanitizePartNumber(mfgPartNumber);
    const filePath = path.join(LIBRARY_BASE, config.subdir, sanitizedPN, filename);
    
    if (!fs.existsSync(filePath)) {
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
 */
router.get('/export/:mfgPartNumber', authenticate, async (req, res) => {
  try {
    const { mfgPartNumber } = req.params;
    const sanitizedPN = sanitizePartNumber(mfgPartNumber);

    // Collect all files across categories
    const allFiles = [];
    for (const [category, config] of Object.entries(FILE_CATEGORIES)) {
      const dirPath = path.join(LIBRARY_BASE, config.subdir, sanitizedPN);
      if (fs.existsSync(dirPath)) {
        const dirFiles = fs.readdirSync(dirPath).filter(f => !f.startsWith('.'));
        for (const filename of dirFiles) {
          allFiles.push({
            category,
            subdir: config.subdir,
            filename,
            fullPath: path.join(dirPath, filename),
          });
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
