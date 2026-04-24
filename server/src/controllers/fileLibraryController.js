import pool from '../config/database.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import cadFileService from '../services/cadFileService.js';
import { buildFootprintRenameTargets } from '../utils/footprintFiles.js';
import { assertSafeLeafName, resolvePathWithinBase } from '../utils/safeFsPaths.js';

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

function isSamePhysicalFile(firstPath, secondPath) {
  try {
    const firstStat = fs.statSync(firstPath);
    const secondStat = fs.statSync(secondPath);
    return firstStat.dev === secondStat.dev && firstStat.ino === secondStat.ino;
  } catch {
    return false;
  }
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

    // Only return files that physically exist on disk
    const existingFiles = files.filter(f =>
      fs.existsSync(path.join(LIBRARY_BASE, info.subdir, f.file_name)),
    );

    res.json({
      type,
      column: info.column,
      files: existingFiles.map(f => ({ file_name: f.file_name, component_count: f.component_count })),
    });
  } catch (error) {
    console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Error fetching files by type:', error.message);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
};

/**
 * Get all file type statistics (distinct filename counts per category).
 * Filters by physical file existence to match the center column counts.
 */
export const getFileTypeStats = async (req, res) => {
  try {
    const result = {};
    for (const [routeType, info] of Object.entries(TYPE_MAP)) {
      const files = await cadFileService.getCadFilesByType(info.fileType);
      const existing = files.filter(f =>
        fs.existsSync(path.join(LIBRARY_BASE, info.subdir, f.file_name)),
      );
      result[routeType] = existing.length;
    }

    res.json(result);
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
    const { fileName, fileNames } = req.query;

    const requestedFileNames = [...new Set(
      (Array.isArray(fileNames) ? fileNames : (fileNames ? [fileNames] : [fileName]))
        .map((name) => String(name || '').trim())
        .filter(Boolean),
    )];

    if (requestedFileNames.length === 0) {
      return res.status(400).json({ error: 'fileName or fileNames query parameter is required' });
    }

    const info = getTypeInfo(type);
    if (!info) {
      return res.status(400).json({ error: 'Invalid file type. Must be one of: footprint, schematic, step, pspice, pad' });
    }

    const componentMap = new Map();
    for (const requestedFileName of requestedFileNames) {
      const components = await cadFileService.getComponentsByFileName(requestedFileName, info.fileType);
      components.forEach((component) => {
        componentMap.set(component.id, component);
      });
    }

    res.json({
      fileName: requestedFileNames[0],
      fileNames: requestedFileNames,
      type,
      column: info.column,
      components: [...componentMap.values()],
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
  res.status(400).json({ error: 'Database-only rename is no longer supported. Rename updates must apply to both the physical file and CAD links.' });
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

    // Only return files that physically exist on disk
    const FILE_TYPE_SUBDIR = { footprint: 'footprint', symbol: 'symbol', model: 'model', pspice: 'pspice', pad: 'pad' };
    const existingResults = results.filter(f => {
      const subdir = FILE_TYPE_SUBDIR[f.file_type];
      if (!subdir) return false;
      return fs.existsSync(path.join(LIBRARY_BASE, subdir, f.file_name));
    });

    res.json({
      searchQuery,
      results: existingResults.map(f => ({
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

    const safeOldFileName = assertSafeLeafName(oldFileName, 'oldFileName');
    const safeNewFileName = assertSafeLeafName(newFileName, 'newFileName');

    // Find the cad_file record
    const cadFile = await cadFileService.findCadFile(safeOldFileName, info.fileType);
    if (!cadFile) {
      // Check if the physical file exists even without a DB record
      const oldPath = resolvePathWithinBase(LIBRARY_BASE, info.subdir, safeOldFileName);
      if (!fs.existsSync(oldPath)) {
        return res.status(404).json({ error: `File "${safeOldFileName}" not found` });
      }
      // Physical-only rename (no DB record yet)
      const newPath = resolvePathWithinBase(LIBRARY_BASE, info.subdir, safeNewFileName);
      if (fs.existsSync(newPath)) {
        return res.status(409).json({ error: `File "${safeNewFileName}" already exists in the ${type} directory` });
      }
      fs.renameSync(oldPath, newPath);
      console.log(`\x1b[32m[INFO]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Physical rename (no DB record): "${safeOldFileName}" -> "${safeNewFileName}"`);
      return res.json({ success: true, oldFileName: safeOldFileName, newFileName: safeNewFileName, updatedCount: 0, updatedComponents: [] });
    }

    // Get affected components before rename
    const affectedBefore = await cadFileService.getComponentsByCadFile(cadFile.id);

    // Rename via cadFileService (handles physical rename + cad_files update + TEXT regen)
    await cadFileService.renameCadFile(cadFile.id, safeNewFileName);

    console.log(`\x1b[32m[INFO]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Physical rename: "${safeOldFileName}" -> "${safeNewFileName}", updated ${affectedBefore.length} components`);

    res.json({
      success: true,
      oldFileName: safeOldFileName,
      newFileName: safeNewFileName,
      updatedCount: affectedBefore.length,
      updatedComponents: affectedBefore.map(c => ({ id: c.id, part_number: c.part_number })),
    });
  } catch (error) {
    console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Error renaming physical file:', error.message);
    const status = /Invalid .*Name|Resolved path escapes base directory/.test(error.message || '') ? 400 : 500;
    res.status(status).json({ error: status === 500 ? 'Failed to rename file' : error.message });
  }
};

/**
 * Rename a grouped footprint pair (.psm/.bsm + .dra) together.
 */
export const renameFootprintGroup = async (req, res) => {
  const client = await pool.connect();
  const renamedPaths = [];
  let transactionStarted = false;

  try {
    const { fileNames, newBaseName } = req.body;
    const info = getTypeInfo('footprint');
    const renameTargets = buildFootprintRenameTargets(fileNames, newBaseName).map((target) => ({
      ...target,
      oldFileName: assertSafeLeafName(target.oldFileName, 'oldFileName'),
      newFileName: assertSafeLeafName(target.newFileName, 'newFileName'),
    }));
    const affectedComponentIds = new Set();
    const cadFiles = [];

    for (const target of renameTargets) {
      const cadFile = await cadFileService.findCadFile(target.oldFileName, info.fileType);
      if (!cadFile) {
        return res.status(404).json({ error: `File "${target.oldFileName}" not found in database` });
      }

      const oldPath = resolvePathWithinBase(LIBRARY_BASE, info.subdir, assertSafeLeafName(cadFile.file_name, 'fileName'));
      if (!fs.existsSync(oldPath)) {
        return res.status(404).json({ error: `File "${target.oldFileName}" not found on disk` });
      }

      const newPath = resolvePathWithinBase(LIBRARY_BASE, info.subdir, target.newFileName);
      if (
        target.newFileName !== cadFile.file_name
        && fs.existsSync(newPath)
        && !isSamePhysicalFile(oldPath, newPath)
      ) {
        return res.status(409).json({ error: `File "${target.newFileName}" already exists in the footprint directory` });
      }

      const linkedComponents = await cadFileService.getComponentsByCadFile(cadFile.id);
      linkedComponents.forEach((component) => affectedComponentIds.add(component.id));

      cadFiles.push({
        cadFile,
        oldPath,
        newPath,
        newFileName: target.newFileName,
      });
    }

    await client.query('BEGIN');
    transactionStarted = true;

    for (const file of cadFiles) {
      if (file.cadFile.file_name === file.newFileName) {
        continue;
      }

      fs.renameSync(file.oldPath, file.newPath);
      renamedPaths.push({ oldPath: file.oldPath, newPath: file.newPath });

      await client.query(`
        UPDATE cad_files
        SET file_name = $1, file_path = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [file.newFileName, `${info.subdir}/${file.newFileName}`, file.cadFile.id]);
    }

    for (const componentId of affectedComponentIds) {
      await cadFileService.regenerateCadText(componentId, info.fileType, client);
    }

    await client.query('COMMIT');
    transactionStarted = false;

    res.json({
      success: true,
      renamedFiles: cadFiles.map((file) => ({
        oldFileName: file.cadFile.file_name,
        newFileName: file.newFileName,
      })),
      updatedCount: affectedComponentIds.size,
    });
  } catch (error) {
    if (transactionStarted) {
      await client.query('ROLLBACK');
    }

    for (let index = renamedPaths.length - 1; index >= 0; index -= 1) {
      const renamedPath = renamedPaths[index];
      try {
        if (fs.existsSync(renamedPath.newPath)) {
          fs.renameSync(renamedPath.newPath, renamedPath.oldPath);
        }
      } catch {
        // Best-effort rollback of physical file names.
      }
    }

    console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Error renaming footprint group:', error.message);

    const status = error.message?.includes('not found')
      ? 404
      : error.message?.includes('already exists')
        ? 409
        : /requires|Invalid filename/.test(error.message || '')
          ? 400
          : 500;

    res.status(status).json({ error: status === 500 ? 'Failed to rename footprint files' : error.message });
  } finally {
    client.release();
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

    const safeFileName = assertSafeLeafName(fileName, 'fileName');

    // Find the cad_file record
    const cadFile = await cadFileService.findCadFile(safeFileName, info.fileType);
    if (!cadFile) {
      // No DB record — just delete the physical file if it exists
      const filePath = resolvePathWithinBase(LIBRARY_BASE, info.subdir, safeFileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      console.log(`\x1b[32m[INFO]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Physical delete (no DB record): "${safeFileName}"`);
      return res.json({ success: true, fileName: safeFileName, updatedCount: 0, updatedComponents: [] });
    }

    const linkedComponents = await cadFileService.getComponentsByCadFile(cadFile.id);
    if (linkedComponents.length > 0) {
      return res.status(409).json({ error: 'Files linked to components cannot be deleted from File Library' });
    }

    // Delete via cadFileService (handles physical file + DB + TEXT regen)
    await cadFileService.deleteCadFile(cadFile.id);

    console.log(`\x1b[32m[INFO]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Physical delete: "${fileName}", updated ${linkedComponents.length} components`);

    res.json({
      success: true,
      fileName: safeFileName,
      updatedCount: linkedComponents.length,
      updatedComponents: linkedComponents.map(c => ({ id: c.id, part_number: c.part_number })),
    });
  } catch (error) {
    console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Error deleting physical file:', error.message);
    const status = /Invalid .*Name|Resolved path escapes base directory/.test(error.message || '') ? 400 : 500;
    res.status(status).json({ error: status === 500 ? 'Failed to delete file' : error.message });
  }
};

/**
 * Delete multiple files together after confirming none are linked to components.
 */
export const deleteFileGroup = async (req, res) => {
  try {
    const { type } = req.params;
    const { fileNames } = req.body;

    const info = getTypeInfo(type);
    if (!info) {
      return res.status(400).json({ error: 'Invalid file type. Must be one of: footprint, schematic, step, pspice, pad' });
    }

    const normalizedFileNames = [...new Set(
      (Array.isArray(fileNames) ? fileNames : [])
        .map((fileName) => assertSafeLeafName(fileName, 'fileName')),
    )];

    if (normalizedFileNames.length === 0) {
      return res.status(400).json({ error: 'fileNames array is required' });
    }

    const cadFiles = [];
    for (const fileName of normalizedFileNames) {
      const cadFile = await cadFileService.findCadFile(fileName, info.fileType);
      if (!cadFile) {
        return res.status(404).json({ error: `File "${fileName}" not found in database` });
      }

      const linkedComponents = await cadFileService.getComponentsByCadFile(cadFile.id);
      if (linkedComponents.length > 0) {
        return res.status(409).json({ error: 'Files linked to components cannot be deleted from File Library' });
      }

      cadFiles.push(cadFile);
    }

    for (const cadFile of cadFiles) {
      await cadFileService.deleteCadFile(cadFile.id);
    }

    res.json({
      success: true,
      deletedCount: cadFiles.length,
      deletedFiles: cadFiles.map((cadFile) => cadFile.file_name),
      updatedCount: 0,
      updatedComponents: [],
    });
  } catch (error) {
    console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Error deleting file group:', error.message);
    res.status(500).json({ error: 'Failed to delete file group' });
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

    // Only return orphans that physically exist on disk
    const FILE_TYPE_SUBDIR_MAP = { footprint: 'footprint', symbol: 'symbol', model: 'model', pspice: 'pspice', pad: 'pad' };
    const existingOrphans = orphans.filter(f => {
      const subdir = FILE_TYPE_SUBDIR_MAP[f.file_type];
      if (!subdir) return false;
      return fs.existsSync(path.join(LIBRARY_BASE, subdir, f.file_name));
    });

    res.json({ orphans: existingOrphans });
  } catch (error) {
    console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Error fetching orphan files:', error.message);
    res.status(500).json({ error: 'Failed to fetch orphan files' });
  }
};

/**
 * Bulk delete orphan CAD files for a single file type.
 * Rejects any file that is no longer orphaned at delete time.
 */
export const bulkDeleteOrphanFiles = async (req, res) => {
  try {
    const { type } = req.params;
    const { fileNames } = req.body;

    if (!Array.isArray(fileNames) || fileNames.length === 0) {
      return res.status(400).json({ error: 'fileNames array is required' });
    }

    const info = getTypeInfo(type);
    if (!info) {
      return res.status(400).json({ error: 'Invalid file type. Must be one of: footprint, schematic, step, pspice, pad' });
    }

    const requestedFileNames = [...new Set(
      fileNames.map((fileName) => assertSafeLeafName(fileName, 'fileName')),
    )];

    if (requestedFileNames.length === 0) {
      return res.status(400).json({ error: 'At least one valid file name is required' });
    }

    const orphanFiles = await cadFileService.getOrphanCadFiles(info.fileType);
    const orphanFileMap = new Map(orphanFiles.map((file) => [file.file_name, file]));
    const invalidSelections = requestedFileNames.filter((fileName) => !orphanFileMap.has(fileName));

    if (invalidSelections.length > 0) {
      return res.status(400).json({
        error: `Only files with no linked parts can be bulk deleted. Invalid selections: ${invalidSelections.join(', ')}`,
      });
    }

    const deletedFiles = [];

    for (const fileName of requestedFileNames) {
      const cadFile = orphanFileMap.get(fileName);
      if (!cadFile) {
        continue;
      }

      await cadFileService.deleteCadFile(cadFile.id);
      deletedFiles.push(fileName);
    }

    res.json({
      success: true,
      deletedCount: deletedFiles.length,
      deletedFiles,
    });
  } catch (error) {
    console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Error bulk deleting orphan files:', error.message);
    res.status(500).json({ error: 'Failed to bulk delete orphan files' });
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

    // Clear missing flag when user manually links a file (indicates server-side file management)
    if (cadFile.missing) {
      await pool.query('UPDATE cad_files SET missing = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [cadFileId]);
    }

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
    const components = categoryId === 'all'
      ? await cadFileService.getAllComponentsWithCadFiles()
      : await cadFileService.getComponentsWithCadFiles(categoryId);
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
 * Scan the library folder for untracked CAD files and register them in the database.
 * Also detects files that no longer exist on disk and tags them as missing.
 */
export const scanLibraryFiles = async (req, res) => {
  try {
    const registered = await cadFileService.scanAndRegisterFiles();
    const tagged = await cadFileService.detectMissingFiles();

    res.json({
      message: `Scan complete. ${registered} new file(s) registered, ${tagged} missing file(s) tagged.`,
      registered,
      tagged,
    });
  } catch (error) {
    console.error('Error scanning library files:', error);
    res.status(500).json({ error: 'Failed to scan library files' });
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
