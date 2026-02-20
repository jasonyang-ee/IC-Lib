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
 * JSONB: unnest arrays with jsonb_array_elements_text().
 */
export const getFilesByType = async (req, res) => {
  try {
    const { type } = req.params;
    const info = getTypeInfo(type);
    if (!info) {
      return res.status(400).json({ error: 'Invalid file type. Must be one of: footprint, schematic, step, pspice, pad' });
    }

    const query = `
      SELECT
        fname as file_name,
        COUNT(*) as component_count
      FROM (
        SELECT jsonb_array_elements_text(${info.column}) AS fname
        FROM components
        WHERE ${info.column} IS NOT NULL
          AND ${info.column} != '[]'::jsonb
      ) sub
      GROUP BY fname
      ORDER BY fname ASC
    `;

    const result = await pool.query(query);

    res.json({
      type,
      column: info.column,
      files: result.rows,
    });
  } catch (error) {
    console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Error fetching files by type:', error.message);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
};

/**
 * Get all file type statistics (distinct filename counts per category).
 */
export const getFileTypeStats = async (req, res) => {
  try {
    const query = `
      SELECT
        (SELECT COUNT(DISTINCT f) FROM components, jsonb_array_elements_text(pcb_footprint) AS f WHERE pcb_footprint != '[]'::jsonb) AS footprint_count,
        (SELECT COUNT(DISTINCT f) FROM components, jsonb_array_elements_text(schematic) AS f WHERE schematic != '[]'::jsonb) AS schematic_count,
        (SELECT COUNT(DISTINCT f) FROM components, jsonb_array_elements_text(step_model) AS f WHERE step_model != '[]'::jsonb) AS step_count,
        (SELECT COUNT(DISTINCT f) FROM components, jsonb_array_elements_text(pspice) AS f WHERE pspice != '[]'::jsonb) AS pspice_count,
        (SELECT COUNT(DISTINCT f) FROM components, jsonb_array_elements_text(pad_file) AS f WHERE pad_file != '[]'::jsonb) AS pad_count
    `;

    const result = await pool.query(query);

    res.json({
      footprint: parseInt(result.rows[0].footprint_count) || 0,
      schematic: parseInt(result.rows[0].schematic_count) || 0,
      step: parseInt(result.rows[0].step_count) || 0,
      pspice: parseInt(result.rows[0].pspice_count) || 0,
      pad: parseInt(result.rows[0].pad_count) || 0,
    });
  } catch (error) {
    console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Error fetching file type stats:', error.message);
    res.status(500).json({ error: 'Failed to fetch file type statistics' });
  }
};

/**
 * Get components using a specific file.
 * JSONB: use @> containment operator.
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

    const query = `
      SELECT
        c.id,
        c.part_number,
        c.manufacturer_pn,
        c.description,
        c.value,
        c.package_size,
        c.approval_status,
        c.pcb_footprint,
        c.schematic,
        c.step_model,
        c.pspice,
        c.pad_file,
        m.name as manufacturer_name,
        cat.name as category_name
      FROM components c
      LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
      LEFT JOIN component_categories cat ON c.category_id = cat.id
      WHERE c.${info.column} @> jsonb_build_array($1::text)
      ORDER BY c.part_number ASC
    `;

    const result = await pool.query(query, [fileName]);

    res.json({
      fileName,
      type,
      column: info.column,
      components: result.rows,
    });
  } catch (error) {
    console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Error fetching components by file:', error.message);
    res.status(500).json({ error: 'Failed to fetch components' });
  }
};

/**
 * Mass update file name in JSONB arrays across components.
 * Replaces oldFileName with newFileName inside the JSONB array.
 */
export const massUpdateFileName = async (req, res) => {
  try {
    const { type } = req.params;
    const { oldFileName, newFileName, componentIds } = req.body;

    if (!oldFileName || !newFileName) {
      return res.status(400).json({ error: 'oldFileName and newFileName are required' });
    }

    const info = getTypeInfo(type);
    if (!info) {
      return res.status(400).json({ error: 'Invalid file type. Must be one of: footprint, schematic, step, pspice, pad' });
    }

    let query;
    let params;

    if (componentIds && componentIds.length > 0) {
      // Update only specific components
      query = `
        UPDATE components
        SET ${info.column} = (
          SELECT jsonb_agg(
            CASE WHEN elem #>> '{}' = $1 THEN to_jsonb($2::text) ELSE elem END
          )
          FROM jsonb_array_elements(${info.column}) AS elem
        ),
        updated_at = CURRENT_TIMESTAMP
        WHERE ${info.column} @> jsonb_build_array($1::text)
          AND id = ANY($3::uuid[])
        RETURNING id, part_number
      `;
      params = [oldFileName, newFileName, componentIds];
    } else {
      // Update all components with the old file name
      query = `
        UPDATE components
        SET ${info.column} = (
          SELECT jsonb_agg(
            CASE WHEN elem #>> '{}' = $1 THEN to_jsonb($2::text) ELSE elem END
          )
          FROM jsonb_array_elements(${info.column}) AS elem
        ),
        updated_at = CURRENT_TIMESTAMP
        WHERE ${info.column} @> jsonb_build_array($1::text)
        RETURNING id, part_number
      `;
      params = [oldFileName, newFileName];
    }

    const result = await pool.query(query, params);

    console.log(`\x1b[32m[INFO]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Updated ${result.rowCount} components: ${info.column} "${oldFileName}" -> "${newFileName}"`);

    res.json({
      success: true,
      updatedCount: result.rowCount,
      updatedComponents: result.rows,
    });
  } catch (error) {
    console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Error mass updating file name:', error.message);
    res.status(500).json({ error: 'Failed to update file name' });
  }
};

/**
 * Search files by name pattern across all JSONB columns.
 */
export const searchFiles = async (req, res) => {
  try {
    const { query: searchQuery, type } = req.query;

    if (!searchQuery) {
      return res.status(400).json({ error: 'query parameter is required' });
    }

    const searchPattern = `%${searchQuery}%`;

    let typeFilter = '';
    if (type) {
      const info = getTypeInfo(type);
      if (info) {
        typeFilter = ` AND source_column = '${info.column}'`;
      }
    }

    const query = `
      WITH all_files AS (
        SELECT DISTINCT f AS file_name, 'pcb_footprint' AS source_column, 'footprint' AS file_type
        FROM components, jsonb_array_elements_text(pcb_footprint) AS f
        WHERE pcb_footprint IS NOT NULL AND pcb_footprint != '[]'::jsonb
        UNION ALL
        SELECT DISTINCT f AS file_name, 'schematic' AS source_column, 'schematic' AS file_type
        FROM components, jsonb_array_elements_text(schematic) AS f
        WHERE schematic IS NOT NULL AND schematic != '[]'::jsonb
        UNION ALL
        SELECT DISTINCT f AS file_name, 'step_model' AS source_column, 'step' AS file_type
        FROM components, jsonb_array_elements_text(step_model) AS f
        WHERE step_model IS NOT NULL AND step_model != '[]'::jsonb
        UNION ALL
        SELECT DISTINCT f AS file_name, 'pspice' AS source_column, 'pspice' AS file_type
        FROM components, jsonb_array_elements_text(pspice) AS f
        WHERE pspice IS NOT NULL AND pspice != '[]'::jsonb
        UNION ALL
        SELECT DISTINCT f AS file_name, 'pad_file' AS source_column, 'pad' AS file_type
        FROM components, jsonb_array_elements_text(pad_file) AS f
        WHERE pad_file IS NOT NULL AND pad_file != '[]'::jsonb
      )
      SELECT DISTINCT file_name, source_column, file_type,
        (SELECT COUNT(*) FROM components c
         WHERE (source_column = 'pcb_footprint' AND c.pcb_footprint @> jsonb_build_array(file_name))
            OR (source_column = 'schematic' AND c.schematic @> jsonb_build_array(file_name))
            OR (source_column = 'step_model' AND c.step_model @> jsonb_build_array(file_name))
            OR (source_column = 'pspice' AND c.pspice @> jsonb_build_array(file_name))
            OR (source_column = 'pad_file' AND c.pad_file @> jsonb_build_array(file_name))
        ) as component_count
      FROM all_files
      WHERE file_name ILIKE $1 ${typeFilter}
      ORDER BY file_type, file_name
      LIMIT 100
    `;

    const result = await pool.query(query, [searchPattern]);

    res.json({
      searchQuery,
      results: result.rows,
    });
  } catch (error) {
    console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Error searching files:', error.message);
    res.status(500).json({ error: 'Failed to search files' });
  }
};

/**
 * Rename a physical file on disk and update all component JSONB references.
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

    const oldPath = path.join(LIBRARY_BASE, info.subdir, oldFileName);
    const newPath = path.join(LIBRARY_BASE, info.subdir, newFileName);

    // Check source file exists
    if (!fs.existsSync(oldPath)) {
      return res.status(404).json({ error: `File "${oldFileName}" not found on disk` });
    }

    // Collision check
    if (fs.existsSync(newPath)) {
      return res.status(409).json({ error: `File "${newFileName}" already exists in the ${type} directory` });
    }

    // Rename physical file
    fs.renameSync(oldPath, newPath);

    // Update all component JSONB arrays
    const dbResult = await pool.query(`
      UPDATE components
      SET ${info.column} = (
        SELECT jsonb_agg(
          CASE WHEN elem #>> '{}' = $1 THEN to_jsonb($2::text) ELSE elem END
        )
        FROM jsonb_array_elements(${info.column}) AS elem
      ),
      updated_at = CURRENT_TIMESTAMP
      WHERE ${info.column} @> jsonb_build_array($1::text)
      RETURNING id, part_number
    `, [oldFileName, newFileName]);

    console.log(`\x1b[32m[INFO]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Physical rename: "${oldFileName}" -> "${newFileName}", updated ${dbResult.rowCount} components`);

    res.json({
      success: true,
      oldFileName,
      newFileName,
      updatedCount: dbResult.rowCount,
      updatedComponents: dbResult.rows,
    });
  } catch (error) {
    console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Error renaming physical file:', error.message);
    res.status(500).json({ error: 'Failed to rename file' });
  }
};

/**
 * Delete a physical file from disk and remove from all component JSONB arrays.
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

    const filePath = path.join(LIBRARY_BASE, info.subdir, fileName);

    // Delete physical file if it exists
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Remove from all component JSONB arrays
    const dbResult = await pool.query(`
      UPDATE components
      SET ${info.column} = (
        SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
        FROM jsonb_array_elements(${info.column}) AS elem
        WHERE elem #>> '{}' != $1
      ),
      updated_at = CURRENT_TIMESTAMP
      WHERE ${info.column} @> jsonb_build_array($1::text)
      RETURNING id, part_number
    `, [fileName]);

    console.log(`\x1b[32m[INFO]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Physical delete: "${fileName}", updated ${dbResult.rowCount} components`);

    res.json({
      success: true,
      fileName,
      updatedCount: dbResult.rowCount,
      updatedComponents: dbResult.rows,
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
 */
export const getAvailableFiles = async (req, res) => {
  try {
    const { type, search } = req.query;
    const info = type ? getTypeInfo(type) : null;
    const fileType = info ? info.fileType : null;

    let files;
    if (search) {
      files = await cadFileService.searchCadFiles(search, fileType);
    } else if (fileType) {
      files = await cadFileService.getCadFilesByType(fileType);
    } else {
      const allFiles = [];
      for (const ft of ['footprint', 'symbol', 'model', 'pspice', 'pad']) {
        const typeFiles = await cadFileService.getCadFilesByType(ft);
        allFiles.push(...typeFiles);
      }
      files = allFiles;
    }

    res.json({ files });
  } catch (error) {
    console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Error fetching available files:', error.message);
    res.status(500).json({ error: 'Failed to fetch available files' });
  }
};
