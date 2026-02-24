import pool from '../config/database.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import cadFileService from '../services/cadFileService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LIBRARY_BASE = path.resolve(__dirname, '../../..', 'library');

// Map route type param to database column and file subdirectory
const TYPE_MAP = {
  'footprint': { column: 'pcb_footprint', subdir: 'footprint', fileType: 'footprint' },
  'schematic': { column: 'schematic', subdir: 'symbol', fileType: 'symbol' },
  'step':      { column: 'step_model', subdir: 'model', fileType: 'model' },
  'pspice':    { column: 'pspice', subdir: 'pspice', fileType: 'pspice' },
  'pad':       { column: 'pad_file', subdir: 'pad', fileType: 'pad' },
};

function getTypeInfo(type) {
  return TYPE_MAP[type] || null;
}

/**
 * Get all unique file names by file type with component count.
 * Uses cad_files + component_cad_files junction tables.
 */
export const getFilesByType = async (req, res) => {
  try {
    const { type } = req.params;
    const info = getTypeInfo(type);
    if (!info) {
      return res.status(400).json({ error: 'Invalid file type. Must be one of: footprint, schematic, step, pspice, pad' });
    }

    const files = await cadFileService.getCadFilesByType(info.fileType);

    res.json({
      type,
      column: info.column,
      files: files.map(f => ({ file_name: f.file_name, component_count: f.component_count })),
    });
  } catch (error) {
    console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Error fetching files by type:', error.message);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
};

/**
 * Get all file type statistics (distinct filename counts per category).
 * Uses cad_files table for counts.
 */
export const getFileTypeStats = async (req, res) => {
  try {
    const stats = await cadFileService.getCadFileStats();

    res.json({
      footprint: stats.footprint || 0,
      schematic: stats.symbol || 0,
      step: stats.model || 0,
      pspice: stats.pspice || 0,
      pad: stats.pad || 0,
    });
  } catch (error) {
    console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Error fetching file type stats:', error.message);
    res.status(500).json({ error: 'Failed to fetch file type statistics' });
  }
};

/**
 * Get components using a specific file.
 * Uses cad_files + junction table via cadFileService.
 */
export const getComponentsByFile = async (req, res) => {
  try {
    const { type } = req.params;
    const { fileName } = req.query;

    if (!fileName) {
      return res.status(400).json({ error: 'fileName query parameter is required' });
    }

    const info = getTypeInfo(type);
    if (!info) {
      return res.status(400).json({ error: 'Invalid file type. Must be one of: footprint, schematic, step, pspice, pad' });
    }

    const components = await cadFileService.getComponentsByFileName(fileName, info.fileType);

    res.json({
      fileName,
      type,
      column: info.column,
      components,
    });
  } catch (error) {
    console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Error fetching components by file:', error.message);
    res.status(500).json({ error: 'Failed to fetch components' });
  }
};

/**
 * Mass update file name via cad_files table and regenerate TEXT columns.
 * Uses cadFileService.renameCadFile for the rename operation.
 */
export const massUpdateFileName = async (req, res) => {
  try {
    const { type } = req.params;
    const { oldFileName, newFileName } = req.body;

    if (!oldFileName || !newFileName) {
      return res.status(400).json({ error: 'oldFileName and newFileName are required' });
    }

    const info = getTypeInfo(type);
    if (!info) {
      return res.status(400).json({ error: 'Invalid file type. Must be one of: footprint, schematic, step, pspice, pad' });
    }

    // Find the cad_file record
    const cadFile = await cadFileService.findCadFile(oldFileName, info.fileType);
    if (!cadFile) {
      return res.status(404).json({ error: `File "${oldFileName}" not found in database` });
    }

    // Get affected components before rename
    const affectedBefore = await cadFileService.getComponentsByCadFile(cadFile.id);

    // Rename via cadFileService (handles cad_files update + TEXT regen)
    await cadFileService.renameCadFile(cadFile.id, newFileName);

    console.log(`\x1b[32m[INFO]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Updated ${affectedBefore.length} components: ${info.column} "${oldFileName}" -> "${newFileName}"`);

    res.json({
      success: true,
      updatedCount: affectedBefore.length,
      updatedComponents: affectedBefore.map(c => ({ id: c.id, part_number: c.part_number })),
    });
  } catch (error) {
    console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Error mass updating file name:', error.message);
    res.status(500).json({ error: 'Failed to update file name' });
  }
};

/**
 * Search files by name pattern.
 * Uses cad_files table via cadFileService.
 */
export const searchFiles = async (req, res) => {
  try {
    const { query: searchQuery, type } = req.query;

    if (!searchQuery) {
      return res.status(400).json({ error: 'query parameter is required' });
    }

    const info = type ? getTypeInfo(type) : null;
    const fileType = info ? info.fileType : null;

    const results = await cadFileService.searchCadFiles(searchQuery, fileType);

    res.json({
      searchQuery,
      results: results.map(f => ({
        file_name: f.file_name,
        file_type: f.file_type,
        component_count: f.component_count,
      })),
    });
  } catch (error) {
    console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Error searching files:', error.message);
    res.status(500).json({ error: 'Failed to search files' });
  }
};

/**
 * Rename a physical file on disk and update cad_files + TEXT columns.
 * Uses cadFileService.renameCadFile which handles junction + TEXT regen.
 */
export const renamePhysicalFile = async (req, res) => {
  try {
    const { type } = req.params;
    const { oldFileName, newFileName } = req.body;

    if (!oldFileName || !newFileName) {
      return res.status(400).json({ error: 'oldFileName and newFileName are required' });
    }

    const info = getTypeInfo(type);
    if (!info) {
      return res.status(400).json({ error: 'Invalid file type. Must be one of: footprint, schematic, step, pspice, pad' });
    }

    // Find the cad_file record
    const cadFile = await cadFileService.findCadFile(oldFileName, info.fileType);
    if (!cadFile) {
      // Check if the physical file exists even without a DB record
      const oldPath = path.join(LIBRARY_BASE, info.subdir, oldFileName);
      if (!fs.existsSync(oldPath)) {
        return res.status(404).json({ error: `File "${oldFileName}" not found` });
      }
      // Physical-only rename (no DB record yet)
      const newPath = path.join(LIBRARY_BASE, info.subdir, newFileName);
      if (fs.existsSync(newPath)) {
        return res.status(409).json({ error: `File "${newFileName}" already exists in the ${type} directory` });
      }
      fs.renameSync(oldPath, newPath);
      console.log(`\x1b[32m[INFO]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Physical rename (no DB record): "${oldFileName}" -> "${newFileName}"`);
      return res.json({ success: true, oldFileName, newFileName, updatedCount: 0, updatedComponents: [] });
    }

    // Get affected components before rename
    const affectedBefore = await cadFileService.getComponentsByCadFile(cadFile.id);

    // Rename via cadFileService (handles physical rename + cad_files update + TEXT regen)
    await cadFileService.renameCadFile(cadFile.id, newFileName);

    console.log(`\x1b[32m[INFO]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Physical rename: "${oldFileName}" -> "${newFileName}", updated ${affectedBefore.length} components`);

    res.json({
      success: true,
      oldFileName,
      newFileName,
      updatedCount: affectedBefore.length,
      updatedComponents: affectedBefore.map(c => ({ id: c.id, part_number: c.part_number })),
    });
  } catch (error) {
    console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Error renaming physical file:', error.message);
    res.status(500).json({ error: 'Failed to rename file' });
  }
};

/**
 * Delete a physical file from disk and remove from cad_files + TEXT columns.
 * Uses cadFileService.deleteCadFile which handles junction + TEXT regen.
 */
export const deletePhysicalFile = async (req, res) => {
  try {
    const { type } = req.params;
    const { fileName } = req.body;

    if (!fileName) {
      return res.status(400).json({ error: 'fileName is required' });
    }

    const info = getTypeInfo(type);
    if (!info) {
      return res.status(400).json({ error: 'Invalid file type. Must be one of: footprint, schematic, step, pspice, pad' });
    }

    // Find the cad_file record
    const cadFile = await cadFileService.findCadFile(fileName, info.fileType);
    if (!cadFile) {
      // No DB record — just delete the physical file if it exists
      const filePath = path.join(LIBRARY_BASE, info.subdir, fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      console.log(`\x1b[32m[INFO]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Physical delete (no DB record): "${fileName}"`);
      return res.json({ success: true, fileName, updatedCount: 0, updatedComponents: [] });
    }

    // Delete via cadFileService (handles physical file + DB + TEXT regen)
    const { linkedComponents } = await cadFileService.deleteCadFile(cadFile.id);

    console.log(`\x1b[32m[INFO]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Physical delete: "${fileName}", updated ${linkedComponents.length} components`);

    res.json({
      success: true,
      fileName,
      updatedCount: linkedComponents.length,
      updatedComponents: linkedComponents.map(c => ({ id: c.id, part_number: c.part_number })),
    });
  } catch (error) {
    console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Error deleting physical file:', error.message);
    res.status(500).json({ error: 'Failed to delete file' });
  }
};

/**
 * Get orphan CAD files (not linked to any component).
 */
export const getOrphanFiles = async (req, res) => {
  try {
    const { type } = req.query;
    const info = type ? getTypeInfo(type) : null;
    const fileType = info ? info.fileType : null;

    const orphans = await cadFileService.getOrphanCadFiles(fileType);

    res.json({ orphans });
  } catch (error) {
    console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Error fetching orphan files:', error.message);
    res.status(500).json({ error: 'Failed to fetch orphan files' });
  }
};

/**
 * Get CAD files for a specific component.
 */
export const getCadFilesForComponent = async (req, res) => {
  try {
    const { componentId } = req.params;
    const files = await cadFileService.getCadFilesForComponentGrouped(componentId);
    res.json({ files });
  } catch (error) {
    console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Error fetching component CAD files:', error.message);
    res.status(500).json({ error: 'Failed to fetch component CAD files' });
  }
};

/**
 * Link an existing CAD file to a component.
 */
export const linkFileToComponent = async (req, res) => {
  try {
    const { cadFileId, componentId } = req.body;

    if (!cadFileId || !componentId) {
      return res.status(400).json({ error: 'cadFileId and componentId are required' });
    }

    const cfResult = await pool.query('SELECT * FROM cad_files WHERE id = $1', [cadFileId]);
    if (cfResult.rows.length === 0) {
      return res.status(404).json({ error: 'CAD file not found' });
    }

    const cadFile = cfResult.rows[0];
    await cadFileService.linkCadFileToComponent(cadFileId, componentId, cadFile.file_type, cadFile.file_name);

    console.log(`\x1b[32m[INFO]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Linked "${cadFile.file_name}" to component ${componentId}`);

    res.json({ success: true, cadFile });
  } catch (error) {
    console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Error linking file to component:', error.message);
    res.status(500).json({ error: 'Failed to link file to component' });
  }
};

/**
 * Unlink a CAD file from a component.
 */
export const unlinkFileFromComponent = async (req, res) => {
  try {
    const { cadFileId, componentId } = req.body;

    if (!cadFileId || !componentId) {
      return res.status(400).json({ error: 'cadFileId and componentId are required' });
    }

    const cfResult = await pool.query('SELECT * FROM cad_files WHERE id = $1', [cadFileId]);
    if (cfResult.rows.length === 0) {
      return res.status(404).json({ error: 'CAD file not found' });
    }

    const cadFile = cfResult.rows[0];
    await cadFileService.unlinkCadFileFromComponent(cadFileId, componentId, cadFile.file_type, cadFile.file_name);

    console.log(`\x1b[32m[INFO]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Unlinked "${cadFile.file_name}" from component ${componentId}`);

    res.json({ success: true });
  } catch (error) {
    console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Error unlinking file from component:', error.message);
    res.status(500).json({ error: 'Failed to unlink file from component' });
  }
};

/**
 * Get components in a category with their CAD file counts.
 */
export const getComponentsByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const components = await cadFileService.getComponentsWithCadFiles(categoryId);
    res.json({ components });
  } catch (error) {
    console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Error fetching components by category:', error.message);
    res.status(500).json({ error: 'Failed to fetch components' });
  }
};

/**
 * Get components sharing CAD files with a given component.
 */
export const getSharingComponents = async (req, res) => {
  try {
    const { componentId } = req.params;
    const components = await cadFileService.getComponentsSharingFiles(componentId);
    res.json({ components });
  } catch (error) {
    console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Error fetching sharing components:', error.message);
    res.status(500).json({ error: 'Failed to fetch sharing components' });
  }
};

/**
 * Get all available CAD files for linking (file picker).
 * Queries the cad_files table first, then augments with filesystem scan
 * to discover files that exist on disk but aren't registered in DB.
 */
export const getAvailableFiles = async (req, res) => {
  try {
    const { type, search } = req.query;
    const info = type ? getTypeInfo(type) : null;
    const fileType = info ? info.fileType : null;

    let dbFiles = [];
    try {
      if (search) {
        dbFiles = await cadFileService.searchCadFiles(search, fileType);
      } else if (fileType) {
        dbFiles = await cadFileService.getCadFilesByType(fileType);
      } else {
        for (const ft of ['footprint', 'symbol', 'model', 'pspice', 'pad']) {
          const typeFiles = await cadFileService.getCadFilesByType(ft);
          dbFiles.push(...typeFiles);
        }
      }
    } catch (dbError) {
      // cad_files table may not exist yet - continue with disk scan
      console.error('[FileLibrary] DB query failed, falling back to disk scan:', dbError.message);
    }

    // Filter DB files to only those that physically exist on disk
    const FILE_TYPE_SUBDIR = { footprint: 'footprint', symbol: 'symbol', model: 'model', pspice: 'pspice', pad: 'pad' };
    dbFiles = dbFiles.filter(f => {
      const subdir = FILE_TYPE_SUBDIR[f.file_type];
      if (!subdir) return false;
      return fs.existsSync(path.join(LIBRARY_BASE, subdir, f.file_name));
    });

    // Augment with filesystem scan for files not in DB
    const dbFileNames = new Set(dbFiles.map(f => `${f.file_type}:${f.file_name}`));
    const diskFiles = [];

    const typesToScan = fileType
      ? [{ ft: fileType, subdir: info.subdir }]
      : Object.entries(TYPE_MAP).map(([, v]) => ({ ft: v.fileType, subdir: v.subdir }));

    for (const { ft, subdir } of typesToScan) {
      const dirPath = path.join(LIBRARY_BASE, subdir);
      if (!fs.existsSync(dirPath)) continue;

      try {
        const entries = fs.readdirSync(dirPath).filter(f => {
          if (f.startsWith('.')) return false;
          const fullPath = path.join(dirPath, f);
          try { return !fs.statSync(fullPath).isDirectory(); } catch { return false; }
        });

        for (const fileName of entries) {
          const key = `${ft}:${fileName}`;
          if (dbFileNames.has(key)) continue;
          if (search && !fileName.toLowerCase().includes(search.toLowerCase())) continue;

          try {
            const stats = fs.statSync(path.join(dirPath, fileName));
            diskFiles.push({
              id: null,
              file_name: fileName,
              file_type: ft,
              file_size: stats.size,
              component_count: '0',
            });
          } catch { /* skip unreadable files */ }
        }
      } catch { /* ignore directory read errors */ }
    }

    const files = [...dbFiles, ...diskFiles];
    files.sort((a, b) => a.file_name.localeCompare(b.file_name));

    res.json({ files });
  } catch (error) {
    console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Error fetching available files:', error.message);
    res.status(500).json({ error: 'Failed to fetch available files' });
  }
};
