import pool from '../config/database.js';

/**
 * Get all unique file names by file type with component count
 * @param {string} fileType - One of: pcb_footprint, schematic, step_model, pspice
 */
export const getFilesByType = async (req, res) => {
  try {
    const { type } = req.params;
    
    // Map the type parameter to actual column name
    const columnMap = {
      'footprint': 'pcb_footprint',
      'schematic': 'schematic',
      'step': 'step_model',
      'pspice': 'pspice',
    };
    
    const columnName = columnMap[type];
    if (!columnName) {
      return res.status(400).json({ error: 'Invalid file type. Must be one of: footprint, schematic, step, pspice' });
    }
    
    // Query to get unique file names and count of components using each
    const query = `
      SELECT 
        ${columnName} as file_name,
        COUNT(*) as component_count
      FROM components
      WHERE ${columnName} IS NOT NULL 
        AND ${columnName} != ''
        AND ${columnName} != 'N/A'
      GROUP BY ${columnName}
      ORDER BY ${columnName} ASC
    `;
    
    const result = await pool.query(query);
    
    res.json({
      type,
      column: columnName,
      files: result.rows,
    });
  } catch (error) {
    console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Error fetching files by type:', error.message);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
};

/**
 * Get all file type statistics (counts for each category)
 */
export const getFileTypeStats = async (req, res) => {
  try {
    const query = `
      SELECT 
        COUNT(DISTINCT CASE WHEN pcb_footprint IS NOT NULL AND pcb_footprint != '' AND pcb_footprint != 'N/A' THEN pcb_footprint END) as footprint_count,
        COUNT(DISTINCT CASE WHEN schematic IS NOT NULL AND schematic != '' AND schematic != 'N/A' THEN schematic END) as schematic_count,
        COUNT(DISTINCT CASE WHEN step_model IS NOT NULL AND step_model != '' AND step_model != 'N/A' THEN step_model END) as step_count,
        COUNT(DISTINCT CASE WHEN pspice IS NOT NULL AND pspice != '' AND pspice != 'N/A' THEN pspice END) as pspice_count
      FROM components
    `;
    
    const result = await pool.query(query);
    
    res.json({
      footprint: parseInt(result.rows[0].footprint_count) || 0,
      schematic: parseInt(result.rows[0].schematic_count) || 0,
      step: parseInt(result.rows[0].step_count) || 0,
      pspice: parseInt(result.rows[0].pspice_count) || 0,
    });
  } catch (error) {
    console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Error fetching file type stats:', error.message);
    res.status(500).json({ error: 'Failed to fetch file type statistics' });
  }
};

/**
 * Get components using a specific file
 */
export const getComponentsByFile = async (req, res) => {
  try {
    const { type } = req.params;
    const { fileName } = req.query;
    
    if (!fileName) {
      return res.status(400).json({ error: 'fileName query parameter is required' });
    }
    
    // Map the type parameter to actual column name
    const columnMap = {
      'footprint': 'pcb_footprint',
      'schematic': 'schematic',
      'step': 'step_model',
      'pspice': 'pspice',
    };
    
    const columnName = columnMap[type];
    if (!columnName) {
      return res.status(400).json({ error: 'Invalid file type. Must be one of: footprint, schematic, step, pspice' });
    }
    
    const query = `
      SELECT 
        c.id,
        c.part_number,
        c.manufacturer_pn,
        c.description,
        c.value,
        c.approval_status,
        c.pcb_footprint,
        c.schematic,
        c.step_model,
        c.pspice,
        m.name as manufacturer_name,
        cat.name as category_name
      FROM components c
      LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
      LEFT JOIN component_categories cat ON c.category_id = cat.id
      WHERE c.${columnName} = $1
      ORDER BY c.part_number ASC
    `;
    
    const result = await pool.query(query, [fileName]);
    
    res.json({
      fileName,
      type,
      column: columnName,
      components: result.rows,
    });
  } catch (error) {
    console.error('\x1b[31m[ERROR]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Error fetching components by file:', error.message);
    res.status(500).json({ error: 'Failed to fetch components' });
  }
};

/**
 * Mass update file name across all components
 */
export const massUpdateFileName = async (req, res) => {
  try {
    const { type } = req.params;
    const { oldFileName, newFileName, componentIds } = req.body;
    
    if (!oldFileName || !newFileName) {
      return res.status(400).json({ error: 'oldFileName and newFileName are required' });
    }
    
    // Map the type parameter to actual column name
    const columnMap = {
      'footprint': 'pcb_footprint',
      'schematic': 'schematic',
      'step': 'step_model',
      'pspice': 'pspice',
    };
    
    const columnName = columnMap[type];
    if (!columnName) {
      return res.status(400).json({ error: 'Invalid file type. Must be one of: footprint, schematic, step, pspice' });
    }
    
    let query;
    let params;
    
    if (componentIds && componentIds.length > 0) {
      // Update only specific components
      query = `
        UPDATE components 
        SET ${columnName} = $1, updated_at = CURRENT_TIMESTAMP
        WHERE ${columnName} = $2 AND id = ANY($3::uuid[])
        RETURNING id, part_number
      `;
      params = [newFileName, oldFileName, componentIds];
    } else {
      // Update all components with the old file name
      query = `
        UPDATE components 
        SET ${columnName} = $1, updated_at = CURRENT_TIMESTAMP
        WHERE ${columnName} = $2
        RETURNING id, part_number
      `;
      params = [newFileName, oldFileName];
    }
    
    const result = await pool.query(query, params);
    
    console.log(`\x1b[32m[INFO]\x1b[0m \x1b[36m[FileLibrary]\x1b[0m Updated ${result.rowCount} components: ${columnName} "${oldFileName}" -> "${newFileName}"`);
    
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
 * Search files by name pattern
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
      const columnMap = {
        'footprint': 'pcb_footprint',
        'schematic': 'schematic',
        'step': 'step_model',
        'pspice': 'pspice',
      };
      const columnName = columnMap[type];
      if (columnName) {
        typeFilter = ` AND source_column = '${columnName}'`;
      }
    }
    
    // Search across all file columns
    const query = `
      WITH all_files AS (
        SELECT DISTINCT pcb_footprint as file_name, 'pcb_footprint' as source_column, 'footprint' as file_type
        FROM components
        WHERE pcb_footprint IS NOT NULL AND pcb_footprint != '' AND pcb_footprint != 'N/A'
        UNION ALL
        SELECT DISTINCT schematic as file_name, 'schematic' as source_column, 'schematic' as file_type
        FROM components
        WHERE schematic IS NOT NULL AND schematic != '' AND schematic != 'N/A'
        UNION ALL
        SELECT DISTINCT step_model as file_name, 'step_model' as source_column, 'step' as file_type
        FROM components
        WHERE step_model IS NOT NULL AND step_model != '' AND step_model != 'N/A'
        UNION ALL
        SELECT DISTINCT pspice as file_name, 'pspice' as source_column, 'pspice' as file_type
        FROM components
        WHERE pspice IS NOT NULL AND pspice != '' AND pspice != 'N/A'
      )
      SELECT file_name, source_column, file_type, 
        (SELECT COUNT(*) FROM components c 
         WHERE (source_column = 'pcb_footprint' AND c.pcb_footprint = file_name)
            OR (source_column = 'schematic' AND c.schematic = file_name)
            OR (source_column = 'step_model' AND c.step_model = file_name)
            OR (source_column = 'pspice' AND c.pspice = file_name)
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
