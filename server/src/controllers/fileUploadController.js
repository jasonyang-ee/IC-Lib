import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';
import pool from '../config/database.js';
import {
  CAD_FILE_TYPE_TO_COLUMN as CATEGORY_TO_COLUMN,
  MODEL_FILE_EXTENSIONS,
  PSPICE_MODEL_FILE_EXTENSIONS,
  PSPICE_SYMBOL_FILE_EXTENSIONS,
} from '../constants/cadFiles.js';
import cadFileService from '../services/cadFileService.js';
import { finalizeCadUpload } from '../services/cadUploadService.js';
import { CadArchiveError, getBoundedArchiveEntries, readBoundedArchiveEntry } from '../services/cadArchiveService.js';
import { listPackages } from '../services/packageService.js';
import {
  FootprintNameError,
  assertNoPlusInFootprintName,
  canonicalizeCadUploadFilename,
  getCadFileBaseName,
  isFootprintFileExtension,
  sanitizeCadBaseName,
} from '../utils/footprintFiles.js';
import { assertSafeLeafName } from '../utils/safeFsPaths.js';
import { logError } from '../utils/logger.js';
import { isEcoEnabled } from '../utils/featureFlags.js';
import { canDirectEditComponentInEcoMode } from '../services/componentLifecycleService.js';
import { lockCadFileNames } from '../utils/cadFileLocks.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base library directory for CAD files (relative to server root)
const LIBRARY_BASE = path.resolve(__dirname, '../../../library');

// File type categories and their subdirectories
// IMPORTANT: Extensions must be unique across categories (except for ambiguous ones handled by path-based logic)
const FILE_CATEGORIES = {
  footprint: {
    extensions: ['.brd', '.psm', '.bsm', '.dra'],
    subdir: 'footprint',
  },
  pad: {
    extensions: ['.pad'],
    subdir: 'pad',
  },
  symbol: {
    extensions: PSPICE_SYMBOL_FILE_EXTENSIONS,
    subdir: 'symbol',
  },
  model: {
    extensions: MODEL_FILE_EXTENSIONS,
    subdir: 'model',
  },
  pspice: {
    extensions: [...PSPICE_MODEL_FILE_EXTENSIONS, ...PSPICE_SYMBOL_FILE_EXTENSIONS],
    subdir: 'pspice',
  },
  libraries: {
    extensions: ['.zip', '.7z'],
    subdir: 'libraries',
  },
};

// Valid CAD file categories (excludes 'libraries' which is for ZIPs)
const VALID_CAD_CATEGORIES = new Set(['footprint', 'symbol', 'model', 'pspice', 'pad']);

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
    fileSize: 250 * 1024 * 1024, // 250MB max file size
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

function normalizeArchivePath(entryName) {
  return String(entryName || '').replace(/\\/g, '/');
}

function getArchiveBaseName(entryName) {
  const normalizedEntryName = normalizeArchivePath(entryName);
  const pathParts = normalizedEntryName.split('/').filter(Boolean);
  return pathParts[pathParts.length - 1] || '';
}

/**
 * Find file in flat directory first, then fall back to legacy nested directory,
 * then check temp directory for files uploaded during new part creation.
 * Returns the full path if found, null otherwise
 */
function findFile(category, filename, mfgPartNumber) {
  if (!FILE_CATEGORIES[category]) return null;

  // Try temp directory first — files during new part creation/editing are here with unique prefix
  // Temp takes priority so renames during creation don't affect existing library files
  const tempDir = path.join(LIBRARY_BASE, 'temp');
  if (fs.existsSync(tempDir)) {
    const tempFiles = fs.readdirSync(tempDir);
    const match = tempFiles.find(f => f.endsWith('-' + filename));
    if (match) return path.join(tempDir, match);
  }

  return findLibraryFile(category, filename, mfgPartNumber);
}

function findLibraryFile(category, filename, mfgPartNumber) {
  const config = FILE_CATEGORIES[category];
  if (!config) return null;

  const flatPath = path.join(LIBRARY_BASE, config.subdir, filename);
  if (fs.existsSync(flatPath)) return flatPath;

  if (mfgPartNumber) {
    const sanitizedPN = sanitizePartNumber(mfgPartNumber);
    const nestedPath = path.join(LIBRARY_BASE, config.subdir, sanitizedPN, filename);
    if (fs.existsSync(nestedPath)) return nestedPath;
  }

  return null;
}

/**
 * Extract ZIP file to temp directory (for temp-buffered uploads).
 * Same detection logic as extractSmartZip but files go to library/temp/ with unique prefixes
 * instead of directly to category directories.
 */
async function extractSmartZipToTemp(zipPath, catalog) {
  const zip = new AdmZip(zipPath);
  const entries = getBoundedArchiveEntries(zip);
  const extractedFiles = [];
  const collisions = [];
  const rejected = [];
  const seenTempFiles = new Set(); // Deduplicate by category:filename (ZIPs often have same file in multiple subdirs)
  const zipFilename = path.basename(zipPath).toLowerCase();

  // Detect source
  const filenames = entries.map(e => normalizeArchivePath(e.entryName).toLowerCase());
  let source = 'unknown';
  if (filenames.some(f => f.includes('ultralibrarian') || f.includes('ul_')) || zipFilename.includes('ul_')) {
    source = 'ultralibrarian';
  } else if (filenames.some(f => f.includes('snapeda')) || zipFilename.includes('snapeda')) {
    source = 'snapeda';
  } else if (filenames.some(f => f.includes('samacsys') || f.includes('component_search_engine')) || zipFilename.includes('samacsys') || zipFilename.startsWith('lib_')) {
    source = 'samacsys';
  }

  const validEDAExtensions = new Set([
    '.brd', '.kicad_mod', '.lbr', '.psm', '.bsm', '.fsm', '.bxl', '.dra',
    '.pad', '.plb',
    '.olb', '.lib', '.kicad_sym', '.schlib', '.edf',
    ...MODEL_FILE_EXTENSIONS,
    '.cir', '.sub', '.inc', '.mod',
    '.dcm', '.asc', '.hkp',
  ]);

  const tempDir = ensureDir(path.join(LIBRARY_BASE, 'temp'));
  const createdPaths = [];

  try {
    for (const entry of entries) {
      if (entry.isDirectory) continue;

      const entryName = normalizeArchivePath(entry.entryName);
      let filename = getArchiveBaseName(entryName);
      if (!filename) continue;
      const ext = path.extname(filename).toLowerCase();

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

      if (category && category !== 'libraries') {
        filename = canonicalizeCadUploadFilename(filename, category, catalog);
        assertSafeLeafName(filename);

        // "+" is OrCAD-illegal in footprint names — reject the entry, don't rename silently
        if (isFootprintFileExtension(filename) && filename.includes('+')) {
          rejected.push({ filename, category, error: '"+" is not allowed in OrCAD footprint names' });
          continue;
        }

        // Skip duplicate files (same filename+category from different subdirs in ZIP)
        const dedupeKey = `${category}:${filename.toLowerCase()}`;
        if (seenTempFiles.has(dedupeKey)) continue;
        seenTempFiles.add(dedupeKey);

        // Extract to temp with unique prefix (collision check deferred to save time)
        const data = await readBoundedArchiveEntry(entry);
        const uniquePrefix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const tempFilename = uniquePrefix + '-' + filename;
        const tempPath = path.join(tempDir, tempFilename);
        const descriptor = fs.openSync(tempPath, 'wx');
        createdPaths.push(tempPath);
        try {
          fs.writeFileSync(descriptor, data);
        } finally {
          fs.closeSync(descriptor);
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

    return { extractedFiles, collisions, rejected };
  } catch (error) {
    let cleanupFailed = false;
    for (const tempPath of createdPaths) {
      try {
        fs.unlinkSync(tempPath);
      } catch (cleanupError) {
        if (cleanupError.code !== 'ENOENT') {
          cleanupFailed = true;
          logError('FileUpload', 'Failed to clean extracted temp file:', cleanupError);
        }
      }
    }
    if (cleanupFailed) throw new CadArchiveError('Failed to extract archive; temporary file cleanup incomplete');
    throw error;
  }
}

async function loadPackageCatalog() {
  try {
    return await listPackages();
  } catch (error) {
    logError('FileUpload', `Failed to load package catalog: ${error.message}`);
    return [];
  }
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
    const catalog = await loadPackageCatalog();

    for (const file of req.files) {
      const ext = path.extname(file.originalname).toLowerCase();

      // Handle ZIP files
      if (ext === '.zip') {
        try {
          const { extractedFiles, collisions, rejected } = await extractSmartZipToTemp(file.path, catalog);
          results.push({
            originalName: file.originalname,
            type: 'archive',
            extracted: extractedFiles,
            filesExtracted: extractedFiles.length,
            collisions: collisions.length > 0 ? collisions : undefined,
            rejected: rejected.length > 0 ? rejected : undefined,
          });
        } catch (error) {
          logError('FileUpload', 'Error extracting ZIP to temp:', error);
          let cleanupFailed = false;
          try {
            fs.unlinkSync(file.path);
          } catch (cleanupError) {
            if (cleanupError.code !== 'ENOENT') {
              cleanupFailed = true;
              logError('FileUpload', 'Failed to clean uploaded archive:', cleanupError);
            }
          }
          results.push({
            originalName: file.originalname,
            error: cleanupFailed ? 'Failed to extract archive; uploaded archive cleanup incomplete'
              : error instanceof CadArchiveError ? error.message : 'Failed to extract archive',
          });
        }
      } else {
        // Regular file - lowercase extension + footprint naming rules
        const originalFilename = path.basename(file.originalname);
        const category = getFileCategory(originalFilename);
        const normalizedFilename = canonicalizeCadUploadFilename(originalFilename, category, catalog);

        if (isFootprintFileExtension(normalizedFilename) && normalizedFilename.includes('+')) {
          fs.unlinkSync(file.path);
          results.push({
            originalName: file.originalname,
            error: '"+" is not allowed in OrCAD footprint names',
          });
          continue;
        }

        if (!category) {
          fs.unlinkSync(file.path);
          results.push({
            originalName: file.originalname,
            error: 'Unknown file type',
            supported: Object.values(FILE_CATEGORIES).flatMap(c => c.extensions),
          });
          continue;
        }

        // File stays in temp with its multer-generated name (collision check deferred to save time)
        const tempFilename = path.basename(file.path);
        results.push({
          originalName: file.originalname,
          type: category,
          filename: normalizedFilename,
          tempFilename,
        });
      }
    }

    res.json({ message: 'Files staged in temp', results });
  } catch (error) {
    logError('FileUpload', 'Error uploading temp files:', error);
    res.status(500).json({ error: 'Failed to process uploaded files' });
  }
}

/**
 * Finalize temp files — move from temp to category directories and register in DB.
 * Called on save (add or edit).
 */
export async function finalizeTempFile(req, res) {
  try {
    const { files = [], collisions = [], mfgPartNumber, componentId } = req.body;
    if (!Array.isArray(files) || !Array.isArray(collisions) || (!files.length && !collisions.length)) {
      return res.status(400).json({ error: 'No files to finalize' });
    }
    const results = [];
    const catalog = await loadPackageCatalog();
    const entries = [...files, ...collisions.map(file => ({ ...file, resolution: 'use_existing' }))];
    for (const entry of entries) {
      let filename = entry?.filename || entry?.tempFilename;
      try {
        if (!entry || typeof entry !== 'object') throw new Error('Invalid file entry');
        const { tempFilename, category, resolution } = entry;
        const rawName = tempFilename
          ? assertSafeLeafName(tempFilename, 'tempFilename').replace(/^\d+-\d+-/, '')
          : assertSafeLeafName(entry.filename, 'filename');
        filename = tempFilename ? canonicalizeCadUploadFilename(rawName, category, catalog) : rawName;
        if (resolution !== 'use_existing' && isFootprintFileExtension(filename)) assertNoPlusInFootprintName(filename);
        const result = await finalizeCadUpload({ tempFilename, filename, category, resolution, componentId, mfgPartNumber, user: req.user });
        results.push({ ...result, ...(tempFilename ? { tempFilename } : {}) });
      } catch (error) {
        logError('FileUpload', `Failed to finalize ${filename}: ${error.message}`);
        results.push({ filename, type: entry?.category, tempFilename: entry?.tempFilename,
          error: error.status || error instanceof FootprintNameError || /^Invalid /.test(error.message)
            ? error.message : 'Failed to finalize file; upload retained for retry' });
      }
    }
    res.json({ message: 'Files processed', results });
  } catch (error) {
    logError('FileUpload', 'Error finalizing temp files:', error);
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
    logError('FileUpload', 'Error cleaning up temp files:', error);
    res.status(500).json({ error: 'Failed to cleanup temp files' });
  }
}

/**
 * Batch collision check — check multiple temp files against their target category directories.
 * Called at save time before finalization.
 */
function getStagedFootprintRenameEntry(file, tempDir, canonicalBaseName) {
  if (!file || typeof file !== 'object') {
    throw new Error('Each staged file must include a temp filename and logical filename');
  }

  const tempFilename = assertSafeLeafName(file.tempFilename, 'temp filename');
  const oldFilename = assertSafeLeafName(file.filename, 'filename');
  const extension = path.extname(oldFilename).toLowerCase();
  if (!['.psm', '.dra'].includes(extension)) {
    throw new Error('Staged footprint rename requires one .psm file and one .dra file');
  }

  // Multer preserves original suffix case while logical names are normalized.
  const suffix = `-${oldFilename}`;
  const suffixIndex = tempFilename.toLowerCase().lastIndexOf(suffix.toLowerCase());
  if (suffixIndex <= 0 || suffixIndex + suffix.length !== tempFilename.length) {
    throw new Error('Selected temp file does not match the requested filename');
  }

  const prefix = tempFilename.substring(0, suffixIndex + 1);
  const newFilename = `${canonicalBaseName}${extension}`;
  const newTempFilename = `${prefix}${newFilename}`;
  return {
    tempFilename,
    oldFilename,
    newFilename,
    newTempFilename,
    oldPath: path.join(tempDir, tempFilename),
    newPath: path.join(tempDir, newTempFilename),
  };
}

/** Rename a staged .psm/.dra pair before either file enters the live library. */
export async function renameStagedFootprintGroup(req, res) {
  try {
    const { files, newBaseName } = req.body;
    if (!Array.isArray(files) || files.length !== 2 || typeof newBaseName !== 'string') {
      return res.status(400).json({ error: 'Exactly two staged footprint files and a new base name are required' });
    }

    const sanitizedBaseName = sanitizeCadBaseName(newBaseName);
    if (!sanitizedBaseName) {
      return res.status(400).json({ error: 'Invalid filename after sanitization' });
    }

    const canonicalPsmFilename = canonicalizeCadUploadFilename(
      `${sanitizedBaseName}.psm`,
      'footprint',
      await loadPackageCatalog(),
    );
    assertNoPlusInFootprintName(canonicalPsmFilename);
    const canonicalBaseName = getCadFileBaseName(canonicalPsmFilename);
    const tempDir = path.join(LIBRARY_BASE, 'temp');
    const entries = files.map((file) => getStagedFootprintRenameEntry(file, tempDir, canonicalBaseName));
    const extensions = new Set(entries.map((entry) => path.extname(entry.oldFilename).toLowerCase()));
    const tempNames = new Set(entries.map((entry) => entry.tempFilename));
    const targets = new Set(entries.map((entry) => entry.newTempFilename));

    if (extensions.size !== 2 || !extensions.has('.psm') || !extensions.has('.dra') || tempNames.size !== 2 || targets.size !== 2) {
      return res.status(400).json({ error: 'Staged footprint rename requires one distinct .psm/.dra pair' });
    }

    // Validate all sources and targets before the first filesystem mutation.
    for (const entry of entries) {
      if (!fs.existsSync(entry.oldPath)) {
        return res.status(404).json({ error: 'Temp file not found' });
      }
      if (entry.oldPath !== entry.newPath && fs.existsSync(entry.newPath)) {
        return res.status(409).json({ error: `A file named "${entry.newFilename}" already exists` });
      }
    }

    const movedEntries = [];
    try {
      for (const entry of entries) {
        if (entry.oldPath === entry.newPath) continue;
        fs.renameSync(entry.oldPath, entry.newPath);
        movedEntries.push(entry);
      }
    } catch (moveError) {
      for (const entry of [...movedEntries].reverse()) {
        try {
          fs.renameSync(entry.newPath, entry.oldPath);
        } catch (rollbackError) {
          logError('FileUpload', `Failed to restore staged footprint ${entry.tempFilename}: ${rollbackError.message}`);
        }
      }
      throw moveError;
    }

    return res.json({
      message: 'Staged footprint pair renamed',
      renamedFiles: entries.map(({ oldFilename, newFilename, tempFilename, newTempFilename }) => ({
        oldFilename,
        newFilename,
        oldTempFilename: tempFilename,
        newTempFilename,
        isTemp: true,
      })),
    });
  } catch (error) {
    if (error instanceof FootprintNameError) {
      return res.status(422).json({ error: error.message });
    }
    if (/^(Invalid |Selected temp file|Each staged file|Staged footprint rename|Exactly two staged footprint)/.test(error.message || '')) {
      return res.status(400).json({ error: error.message });
    }
    logError('FileUpload', 'Error renaming staged footprint pair:', error);
    return res.status(500).json({ error: 'Failed to rename staged footprint pair' });
  }
}

export function checkCollisionsBatch(req, res) {
  try {
    const { files } = req.body;
    if (!files || !Array.isArray(files)) {
      return res.status(400).json({ error: 'files array required' });
    }

    const collisions = [];
    for (const { tempFilename, category, filename } of files) {
      const config = FILE_CATEGORIES[category];
      if (!config) continue;
      const safeFilename = assertSafeLeafName(filename, 'filename');
      const targetPath = path.join(LIBRARY_BASE, config.subdir, safeFilename);
      if (fs.existsSync(targetPath)) {
        collisions.push({ tempFilename, category, filename: safeFilename });
      }
    }

    res.json({ collisions });
  } catch (error) {
    if (/^Invalid /.test(error.message || '')) {
      return res.status(400).json({ error: error.message });
    }
    logError('FileUpload', 'Error checking collisions batch:', error);
    res.status(500).json({ error: 'Failed to check collisions' });
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
          const rows = await cadFileService.getComponentCadFilesByMPN(mfgPartNumber, category);

          for (const row of rows) {
            const fname = row.file_name;
            if (!cadFileService.isTrackableCadFile(fname, category)) {
              continue;
            }

            const flatPath = path.join(flatDir, fname);
            const existsOnDisk = fs.existsSync(flatPath);

            if (!seenFiles.has(`${category}:${fname}`)) {
              seenFiles.add(`${category}:${fname}`);
              if (existsOnDisk) {
                categoryFiles.push({
                  id: row.id,
                  name: fname,
                  file_type: row.file_type,
                  path: path.join(config.subdir, fname),
                  size: fs.statSync(flatPath).size,
                  storage: 'flat',
                });
              } else {
                // File is missing from disk — include with missing flag
                categoryFiles.push({
                  id: row.id,
                  name: fname,
                  file_type: row.file_type,
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
          logError('FileUpload', `DB lookup failed for ${mfgPartNumber}: ${dbError.message}`);
        }
      }

      // Also check legacy nested directory
      const nestedDir = path.join(LIBRARY_BASE, config.subdir, sanitizedPN);
      if (fs.existsSync(nestedDir)) {
        const dirFiles = fs.readdirSync(nestedDir).filter((fileName) => (
          !fileName.startsWith('.') && cadFileService.isTrackableCadFile(fileName, category)
        ));
        for (const f of dirFiles) {
          if (!seenFiles.has(`${category}:${f}`)) {
            seenFiles.add(`${category}:${f}`);
            categoryFiles.push({
              id: null,
              name: f,
              file_type: category,
              path: path.join(config.subdir, sanitizedPN, f),
              size: fs.statSync(path.join(nestedDir, f)).size,
              storage: 'nested',
            });
          }
        }
      }

      if (categoryFiles.length > 0) {
        const relatedFilesByCadFileId = ['footprint', 'pad', 'model'].includes(category)
          ? await cadFileService.getLinkedCadFilesMap(categoryFiles.map((file) => file.id).filter(Boolean))
          : new Map();

        files[category] = categoryFiles.map((file) => ({
          ...file,
          related_files: (relatedFilesByCadFileId.get(file.id) || []).filter((relatedFile) => !relatedFile.missing),
        }));
      }
    }

    res.json({
      mfgPartNumber,
      files,
    });
  } catch (error) {
    logError('FileUpload', 'Error listing files:', error);
    res.status(500).json({ error: 'Failed to list files' });
  }
}

/**
 * Rename a file
 */
export async function renameFile(req, res) {
  try {
    const { category, mfgPartNumber, oldFilename, newFilename, tempFilename } = req.body;

    if (!category || !mfgPartNumber || !oldFilename || !newFilename) {
      return res.status(400).json({ error: 'Category, part number, old filename, and new filename are required' });
    }
    assertSafeLeafName(oldFilename, 'oldFilename');

    // Validate category
    const config = FILE_CATEGORIES[category];
    if (!config) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    // Pad files cannot be renamed per requirements
    if (category === 'pad') {
      return res.status(400).json({ error: 'Pad files cannot be renamed' });
    }

    // Sanitize new filename: replace special chars and spaces with underscores.
    // The extension is always preserved — a rename must not switch a file to a
    // different extension within the category (e.g. .psm -> .dra).
    const finalExt = path.extname(oldFilename).toLowerCase();
    const newBaseName = sanitizeCadBaseName(newFilename.replace(/\.[^.]+$/, ''));

    if (!newBaseName) {
      return res.status(400).json({ error: 'Invalid filename after sanitization' });
    }

    let sanitizedNewFilename = newBaseName + finalExt;
    if (isFootprintFileExtension(sanitizedNewFilename)) {
      assertNoPlusInFootprintName(sanitizedNewFilename); // typed error -> 422 below
    }
    sanitizedNewFilename = canonicalizeCadUploadFilename(
      sanitizedNewFilename,
      category,
      await loadPackageCatalog(),
    );

    const tempDir = path.join(LIBRARY_BASE, 'temp');
    let oldPath = null;

    if (tempFilename) {
      const safeTempFilename = path.basename(tempFilename);
      if (!safeTempFilename.endsWith(`-${oldFilename}`)) {
        return res.status(400).json({ error: 'Selected temp file does not match the requested filename' });
      }

      const tempPath = path.join(tempDir, safeTempFilename);
      if (!fs.existsSync(tempPath)) {
        return res.status(404).json({ error: 'Temp file not found' });
      }

      oldPath = tempPath;
    } else {
      oldPath = findLibraryFile(category, oldFilename, mfgPartNumber);
    }

    if (!oldPath) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (oldFilename === sanitizedNewFilename) {
      return res.json({ message: 'No changes needed', filename: sanitizedNewFilename });
    }

    // Check if file is in temp directory (new part creation flow)
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

    // Collision check in flat directory (same-inode case-only renames pass)
    const flatNewPath = path.join(LIBRARY_BASE, config.subdir, sanitizedNewFilename);
    if (fs.existsSync(flatNewPath) && !cadFileService.isSameExistingFile(oldPath, flatNewPath)) {
      return res.status(409).json({ error: `A file named "${sanitizedNewFilename}" already exists in the ${category} directory` });
    }

    const cadFile = VALID_CAD_CATEGORIES.has(category)
      ? await cadFileService.findCadFile(oldFilename, category)
      : null;

    if (cadFile) {
      // Tracked file: the shared CAD data path renames physical + cad_files +
      // TEXT regen atomically (rollback + best-effort physical revert on failure).
      try {
        await cadFileService.renameCadFile(cadFile.id, sanitizedNewFilename, { user: req.user });
      } catch (renameError) {
        if (renameError.message?.includes('already exists')) {
          return res.status(409).json({ error: renameError.message });
        }
        throw renameError;
      }
    } else {
      if (isEcoEnabled() && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Scan untracked library files before renaming with ECO enabled' });
      }
      // Legacy physical-only moves still share source/destination locks with
      // tracked operations. Recheck the earlier miss before touching bytes.
      const client = await pool.connect();
      const targetDir = path.join(LIBRARY_BASE, config.subdir);
      let moved = false;
      try {
        await client.query('BEGIN');
        await lockCadFileNames(client, [oldFilename, sanitizedNewFilename].map(fileName => ({
          file_type: category, file_name: fileName,
        })));
        if (VALID_CAD_CATEGORIES.has(category) && await cadFileService.findCadFile(oldFilename, category, client)) {
          throw Object.assign(new Error('CAD file was registered before rename; refresh and retry'), { status: 409 });
        }
        if (!fs.existsSync(oldPath)) throw Object.assign(new Error('File not found'), { status: 404 });
        if (fs.existsSync(flatNewPath) && !cadFileService.isSameExistingFile(oldPath, flatNewPath)) {
          throw Object.assign(new Error(`A file named "${sanitizedNewFilename}" already exists`), { status: 409 });
        }
        ensureDir(targetDir);
        fs.renameSync(oldPath, flatNewPath);
        moved = true;
        await client.query('COMMIT');
      } catch (renameError) {
        if (moved) {
          try { fs.renameSync(flatNewPath, oldPath); } catch (restoreError) {
            logError('FileUpload', 'Failed to restore untracked rename:', restoreError);
          }
        }
        try { await client.query('ROLLBACK'); } catch { /* original error wins */ }
        throw renameError;
      } finally {
        client.release();
      }

      // Clean up empty legacy directory after the rename.
      const oldDir = path.dirname(oldPath);
      if (oldDir !== targetDir) {
        try {
          const remaining = fs.readdirSync(oldDir).filter(f => !f.startsWith('.'));
          if (remaining.length === 0) fs.rmdirSync(oldDir);
        } catch { /* ignore cleanup errors */ }
      }
    }

    res.json({
      message: 'File renamed successfully',
      oldFilename,
      newFilename: sanitizedNewFilename,
    });
  } catch (error) {
    if (error instanceof FootprintNameError) {
      return res.status(422).json({ error: error.message });
    }
    if (/^Invalid oldFilename/.test(error.message || '')) {
      return res.status(400).json({ error: error.message });
    }
    if ([403, 404, 409].includes(error.status)) return res.status(error.status).json({ error: error.message });
    logError('FileUpload', 'Error renaming file:', error);
    res.status(500).json({ error: 'Failed to rename file' });
  }
}

/**
 * Unlink a file or footprint group from the requesting component only.
 * Shared library files and reusable relationship history remain intact.
 */
export async function deleteFile(req, res) {
  try {
    const { category, mfgPartNumber } = req.body;

    if (!category || !mfgPartNumber || !req.body.filename) {
      return res.status(400).json({ error: 'Category, part number, and filename are required' });
    }

    const filename = assertSafeLeafName(req.body.filename, 'filename');

    const config = FILE_CATEGORIES[category];
    if (!config) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    if (!VALID_CAD_CATEGORIES.has(category)) {
      return res.status(400).json({ error: 'Only CAD library links can be removed from the part page' });
    }

    const cadFile = await cadFileService.findCadFile(filename, category);
    if (!cadFile) {
      return res.status(404).json({ error: 'CAD file not found' });
    }

    const linkedComponents = await cadFileService.getComponentsByCadFile(cadFile.id);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const compResult = await client.query(
        'SELECT id, approval_status FROM components WHERE manufacturer_pn = $1 FOR UPDATE',
        [mfgPartNumber],
      );
      const component = compResult.rows[0];
      if (!component) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Component not found' });
      }
      if (isEcoEnabled() && !canDirectEditComponentInEcoMode({
        role: req.user?.role,
        currentApprovalStatus: component.approval_status,
      })) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Direct edits require ECO approval unless the part is still in new status' });
      }
      const componentId = component.id;

      const cadFilesToUnlink = new Map([[cadFile.id, cadFile]]);
      if (category === 'footprint') {
        const componentCadFilesResult = await client.query(`
          SELECT cf.id, cf.file_name, cf.file_type
          FROM component_cad_files ccf
          JOIN cad_files cf ON cf.id = ccf.cad_file_id
          WHERE ccf.component_id = $1
            AND cf.file_type IN ('footprint', 'pad', 'model')
        `, [componentId]);

        const componentCadFiles = componentCadFilesResult.rows;
        const footprintBaseName = getCadFileBaseName(filename).toLowerCase();
        const groupedFootprintCadFiles = componentCadFiles.filter(
          (file) => file.file_type === 'footprint' && getCadFileBaseName(file.file_name).toLowerCase() === footprintBaseName,
        );
        const groupedFootprintCadFileIds = groupedFootprintCadFiles.map((file) => file.id);

        groupedFootprintCadFiles.forEach((file) => {
          cadFilesToUnlink.set(file.id, file);
        });

        if (groupedFootprintCadFileIds.length > 0) {
          const relatedFilesByCadFileId = await cadFileService.getLinkedCadFilesMap(
            componentCadFiles.filter((file) => file.file_type === 'footprint').map((file) => file.id), client,
          );
          const componentCadFileById = new Map(componentCadFiles.map((file) => [file.id, file]));
          const retainedRelatedIds = new Set();
          for (const [footprintId, relatedFiles] of relatedFilesByCadFileId) {
            if (!groupedFootprintCadFileIds.includes(footprintId)) {
              relatedFiles.forEach((file) => retainedRelatedIds.add(file.id));
            }
          }

          for (const footprintId of groupedFootprintCadFileIds) {
            const relatedFiles = relatedFilesByCadFileId.get(footprintId) || [];
            for (const relatedFile of relatedFiles) {
              if ((relatedFile.file_type === 'pad' || relatedFile.file_type === 'model')
                && componentCadFileById.has(relatedFile.id) && !retainedRelatedIds.has(relatedFile.id)) {
                cadFilesToUnlink.set(relatedFile.id, componentCadFileById.get(relatedFile.id));
              }
            }
          }
        }
      }

      const affectedFileTypes = new Set();
      for (const file of cadFilesToUnlink.values()) {
        await client.query(`
          DELETE FROM component_cad_files
          WHERE component_id = $1 AND cad_file_id = $2
        `, [componentId, file.id]);
        affectedFileTypes.add(file.file_type);
      }

      for (const fileType of affectedFileTypes) {
        await cadFileService.regenerateCadText(componentId, fileType, client);
      }

      await client.query('COMMIT');

      res.json({
        unlinked: true,
        remaining: Math.max(linkedComponents.length - 1, 0),
        filename,
        removedFiles: [...cadFilesToUnlink.values()].map((file) => ({
          category: file.file_type,
          filename: file.file_name,
        })),
      });
    } catch (dbError) {
      await client.query('ROLLBACK');
      throw dbError;
    } finally {
      client.release();
    }
  } catch (error) {
    if (/^Invalid /.test(error.message || '')) {
      return res.status(400).json({ error: error.message });
    }
    logError('FileUpload', 'Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
}

/**
 * Download a file
 * Supports both new flat path format and legacy nested format
 */
export async function downloadFile(req, res) {
  try {
    const { category, mfgPartNumber } = req.params;
    const filename = assertSafeLeafName(req.params.filename, 'filename');

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
    if (/^Invalid /.test(error.message || '')) {
      return res.status(400).json({ error: error.message });
    }
    logError('FileUpload', 'Error downloading file:', error);
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
          const rows = await cadFileService.getComponentCadFilesByMPN(mfgPartNumber, category);

          for (const row of rows) {
            const fname = row.file_name;
            if (!cadFileService.isTrackableCadFile(fname, category)) {
              continue;
            }

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
        const dirFiles = fs.readdirSync(nestedDir).filter((fileName) => (
          !fileName.startsWith('.') && cadFileService.isTrackableCadFile(fileName, category)
        ));
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
    logError('FileUpload', 'Error exporting files:', error);
    res.status(500).json({ error: 'Failed to export files' });
  }
}

/**
 * Restore soft-deleted files (move back from temp to category directory)
 * Called when user cancels an edit to undo file deletions
 */
export async function restoreDeletedFile(req, res) {
  const { files } = req.body;
  if (!Array.isArray(files)) return res.status(400).json({ error: 'files array is required' });
  const results = [];
  for (const file of files) {
    try {
      // Preserve the exact historical name; never restore over a live target.
      const result = await finalizeCadUpload({ ...file, resolution: undefined, user: req.user });
      results.push({ filename: result.filename, tempFilename: file.tempFilename, restored: true });
    } catch (error) {
      logError('FileUpload', 'Failed to restore file:', error);
      results.push({ filename: file?.filename, tempFilename: file?.tempFilename,
        error: error.status || /^Invalid /.test(error.message)
          ? error.message : 'Failed to restore file; upload retained for retry' });
    }
  }
  res.json({ results });
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
    logError('FileUpload', 'Error confirming delete:', error);
    res.status(500).json({ error: 'Failed to confirm delete' });
  }
}
