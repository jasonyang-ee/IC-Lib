import pool from '../config/database.js';
import * as digikeyService from '../services/digikeyService.js';
import * as mouserService from '../services/mouserService.js';

export const getAllComponents = async (req, res, next) => {
  try {
    const { category, search } = req.query;
    
    let query = `
      SELECT 
        c.*,
        cat.name as category_name,
        cat.prefix as category_prefix,
        m.name as manufacturer_name,
        get_part_type(c.category_id, c.sub_category1, c.sub_category2, c.sub_category3) as part_type
      FROM components c
      LEFT JOIN component_categories cat ON c.category_id = cat.id
      LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (category) {
      query += ` AND cat.id = $${paramCount}`;
      params.push(category);
      paramCount++;
    }

    if (search) {
      // Split search term by spaces to support multi-keyword search
      const keywords = search.trim().split(/\s+/).filter(k => k.length > 0);
      
      if (keywords.length > 0) {
        const searchConditions = keywords.map((keyword, index) => {
          const paramIndex = paramCount + index;
          const exactParamIndex = paramCount + keywords.length + index; // For exact UUID matching
          return `(
            c.part_number ILIKE $${paramIndex} 
            OR c.description ILIKE $${paramIndex} 
            OR c.manufacturer_pn ILIKE $${paramIndex}
            OR c.sub_category1 ILIKE $${paramIndex}
            OR c.sub_category2 ILIKE $${paramIndex}
            OR c.sub_category3 ILIKE $${paramIndex}
            OR get_part_type(c.category_id, c.sub_category1, c.sub_category2, c.sub_category3) ILIKE $${paramIndex}
            OR cat.name ILIKE $${paramIndex}
            OR m.name ILIKE $${paramIndex}
            OR c.id::text = $${exactParamIndex}
            OR EXISTS (
              SELECT 1 FROM components_alternative ca
              WHERE ca.part_number = c.part_number
              AND (ca.manufacturer_pn ILIKE $${paramIndex} OR ca.id::text = $${exactParamIndex})
            )
            OR EXISTS (
              SELECT 1 FROM distributor_info di
              WHERE di.component_id = c.id
              AND di.sku ILIKE $${paramIndex}
            )
            OR EXISTS (
              SELECT 1 FROM distributor_info di
              JOIN components_alternative ca ON di.alternative_id = ca.id
              WHERE ca.part_number = c.part_number
              AND di.sku ILIKE $${paramIndex}
            )
          )`;
        }).join(' AND ');
        
        query += ` AND (${searchConditions})`;
        // Add ILIKE pattern parameters
        keywords.forEach(keyword => params.push(`%${keyword}%`));
        // Add exact match parameters for UUID
        keywords.forEach(keyword => params.push(keyword));
        paramCount += keywords.length * 2;
      }
    }

    query += ' ORDER BY c.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const getComponentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT 
        c.*,
        cat.name as category_name,
        cat.prefix as category_prefix,
        m.name as manufacturer_name,
        m.website as manufacturer_website,
        get_part_type(c.category_id, c.sub_category1, c.sub_category2, c.sub_category3) as part_type
      FROM components c
      LEFT JOIN component_categories cat ON c.category_id = cat.id
      LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
      WHERE c.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Component not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

export const createComponent = async (req, res, next) => {
  try {
    const {
      category_id,
      part_number,
      manufacturer_id,
      manufacturer_pn,
      manufacturer_part_number, // Accept both field names
      description,
      value,
      sub_category1,
      sub_category2,
      sub_category3,
      pcb_footprint,
      package_size,
      schematic,
      step_model,
      pspice,
      datasheet_url,
      status,
      notes
    } = req.body;
    
    // Use whichever field name was provided (prioritize manufacturer_part_number from frontend)
    const mfrPartNumber = manufacturer_part_number || manufacturer_pn;

    // Convert empty strings to NULL for UUID fields
    const validManufacturerId = manufacturer_id && manufacturer_id.trim() !== '' ? manufacturer_id : null;
    const validCategoryId = category_id && String(category_id).trim() !== '' ? category_id : null;

    // Validate category_id is required
    if (!validCategoryId) {
      return res.status(400).json({ error: 'category_id is required' });
    }

    // Insert directly into components table (no triggers, no category table sync)
    const insertQuery = `
      INSERT INTO components (
        category_id, part_number, manufacturer_id, manufacturer_pn,
        description, value, sub_category1, sub_category2, sub_category3,
        pcb_footprint, package_size, schematic, step_model, pspice,
        datasheet_url, status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `;

    const componentResult = await pool.query(insertQuery, [
      validCategoryId, part_number, validManufacturerId, mfrPartNumber,
      description, value, sub_category1, sub_category2, sub_category3,
      pcb_footprint, package_size, schematic, step_model, pspice,
      datasheet_url, status || 'Active', notes
    ]);

    const component = componentResult.rows[0];
    
    // Log activity
    await pool.query(`
      INSERT INTO activity_log (component_id, part_number, description, category_name, activity_type)
      SELECT $1, $2, $3, cat.name, 'added'
      FROM component_categories cat WHERE cat.id = $4
    `, [component.id, component.part_number, component.description, validCategoryId]);
    
    // Auto-create inventory entry (backup in case trigger doesn't exist)
    await pool.query(`
      INSERT INTO inventory (component_id, quantity, minimum_quantity, location)
      VALUES ($1, 0, 0, NULL)
      ON CONFLICT (component_id) DO NOTHING
    `, [component.id]);
    
    // Fetch the complete component with joined data
    const fullComponent = await pool.query(`
      SELECT 
        c.*,
        cat.name as category_name,
        cat.prefix as category_prefix,
        m.name as manufacturer_name,
        get_part_type(c.category_id, c.sub_category1, c.sub_category2, c.sub_category3) as part_type
      FROM components c
      LEFT JOIN component_categories cat ON c.category_id = cat.id
      LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
      WHERE c.id = $1
    `, [component.id]);

    res.status(201).json(fullComponent.rows[0]);
  } catch (error) {
    console.error('Error in createComponent:', error);
    next(error);
  }
};

export const updateComponent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      category_id,
      part_number,
      manufacturer_id,
      manufacturer_pn,
      manufacturer_part_number, // Accept both field names
      description,
      value,
      sub_category1,
      sub_category2,
      sub_category3,
      pcb_footprint,
      package_size,
      schematic,
      step_model,
      pspice,
      datasheet_url,
      status,
      notes
    } = req.body;
    
    // Use whichever field name was provided (prioritize manufacturer_part_number from frontend)
    const mfrPartNumber = manufacturer_part_number || manufacturer_pn;

    // Convert empty strings to NULL for UUID fields
    const validManufacturerId = manufacturer_id && manufacturer_id.trim() !== '' ? manufacturer_id : null;
    const validCategoryId = category_id && String(category_id).trim() !== '' ? category_id : null;

    // Check if component exists
    const componentCheck = await pool.query('SELECT id FROM components WHERE id = $1', [id]);
    if (componentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Component not found' });
    }

    // Update components table directly (no triggers, no category table sync)
    const result = await pool.query(`
      UPDATE components SET
        category_id = COALESCE($1, category_id),
        part_number = COALESCE($2, part_number),
        manufacturer_id = $3,
        manufacturer_pn = COALESCE($4, manufacturer_pn),
        description = COALESCE($5, description),
        value = COALESCE($6, value),
        sub_category1 = $7,
        sub_category2 = $8,
        sub_category3 = $9,
        pcb_footprint = COALESCE($10, pcb_footprint),
        package_size = COALESCE($11, package_size),
        schematic = $12,
        step_model = $13,
        pspice = $14,
        datasheet_url = COALESCE($15, datasheet_url),
        status = COALESCE($16, status),
        notes = COALESCE($17, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $18
      RETURNING *
    `, [
      validCategoryId, part_number, validManufacturerId, mfrPartNumber,
      description, value, sub_category1, sub_category2, sub_category3,
      pcb_footprint, package_size, schematic, step_model, pspice,
      datasheet_url, status, notes, id
    ]);

    // Log activity
    await pool.query(`
      INSERT INTO activity_log (component_id, part_number, description, category_name, activity_type)
      SELECT $1, $2, $3, cat.name, 'updated'
      FROM component_categories cat WHERE cat.id = $4
    `, [id, result.rows[0].part_number, result.rows[0].description, result.rows[0].category_id]);

    // Fetch the complete component with joined data
    const fullComponent = await pool.query(`
      SELECT 
        c.*,
        cat.name as category_name,
        cat.prefix as category_prefix,
        m.name as manufacturer_name,
        get_part_type(c.category_id, c.sub_category1, c.sub_category2, c.sub_category3) as part_type
      FROM components c
      LEFT JOIN component_categories cat ON c.category_id = cat.id
      LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
      WHERE c.id = $1
    `, [id]);

    res.json(fullComponent.rows[0]);
  } catch (error) {
    console.error('Error in updateComponent:', error);
    next(error);
  }
};

export const deleteComponent = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if component exists and get its details for logging
    const componentCheck = await pool.query(
      `SELECT c.id, c.part_number, c.description, cat.name as category_name 
       FROM components c 
       LEFT JOIN component_categories cat ON c.category_id = cat.id
       WHERE c.id = $1`,
      [id]
    );

    if (componentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Component not found' });
    }

    const component = componentCheck.rows[0];

    // Use transaction to delete from all related tables
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Log activity before deletion
      await client.query(`
        INSERT INTO activity_log (component_id, part_number, description, category_name, activity_type)
        VALUES ($1, $2, $3, $4, 'deleted')
      `, [component.id, component.part_number, component.description, component.category_name]);
      
      // Delete from related tables first (foreign key constraints)
      await client.query('DELETE FROM component_specification_values WHERE component_id = $1', [id]);
      await client.query('DELETE FROM distributor_info WHERE component_id = $1', [id]);
      await client.query('DELETE FROM inventory WHERE component_id = $1', [id]);
      await client.query('DELETE FROM footprint_sources WHERE component_id = $1', [id]);
      
      // Delete the component (no category table sync needed)
      await client.query('DELETE FROM components WHERE id = $1', [id]);
      
      await client.query('COMMIT');
      
      res.json({ message: 'Component deleted successfully' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error deleting component:', error);
    next(error);
  }
};

export const getComponentSpecifications = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Use the view for convenient access to specifications with names and units
    const result = await pool.query(`
      SELECT 
        csv.id,
        csv.component_id,
        cs.id as category_spec_id,
        cs.spec_name,
        cs.unit,
        csv.spec_value,
        cs.is_required,
        cs.display_order
      FROM component_specification_values csv
      JOIN category_specifications cs ON csv.category_spec_id = cs.id
      WHERE csv.component_id = $1
      ORDER BY cs.display_order, cs.spec_name
    `, [id]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching component specifications:', error);
    next(error);
  }
};

export const updateComponentSpecifications = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { specifications } = req.body;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete existing specification values
      await client.query('DELETE FROM component_specification_values WHERE component_id = $1', [id]);

      // Insert new specification values (filter out empty ones)
      if (specifications && Array.isArray(specifications)) {
        for (const spec of specifications) {
          // Skip specifications with empty value or missing category_spec_id
          if (!spec.category_spec_id || !spec.spec_value || spec.spec_value.trim() === '') continue;
          
          await client.query(`
            INSERT INTO component_specification_values (component_id, category_spec_id, spec_value)
            VALUES ($1, $2, $3)
            ON CONFLICT (component_id, category_spec_id)
            DO UPDATE SET 
              spec_value = EXCLUDED.spec_value,
              updated_at = CURRENT_TIMESTAMP
          `, [id, spec.category_spec_id, spec.spec_value]);
        }
      }

      await client.query('COMMIT');

      // Return updated specifications with full details
      const result = await client.query(`
        SELECT 
          csv.id,
          csv.component_id,
          cs.id as category_spec_id,
          cs.spec_name,
          cs.unit,
          csv.spec_value,
          cs.is_required,
          cs.display_order
        FROM component_specification_values csv
        JOIN category_specifications cs ON csv.category_spec_id = cs.id
        WHERE csv.component_id = $1
        ORDER BY cs.display_order, cs.spec_name
      `, [id]);

      res.json(result.rows);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating component specifications:', error);
    next(error);
  }
};

export const getDistributorInfo = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT di.*, d.name as distributor_name
      FROM distributor_info di
      JOIN distributors d ON di.distributor_id = d.id
      WHERE di.component_id = $1
    `, [id]);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const updateDistributorInfo = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { distributors } = req.body;

    if (!distributors || !Array.isArray(distributors)) {
      return res.status(400).json({ error: 'Invalid distributors data' });
    }

    // Auto-fetch pricing from vendor APIs (Issue #2)
    const distributorsWithPricing = await Promise.all(distributors.map(async (dist) => {
      // Only fetch if SKU is provided
      if (!dist.sku || !dist.distributor_name) {
        return dist;
      }

      try {
        let vendorData = null;
        
        // Fetch from appropriate vendor
        if (dist.distributor_name.toLowerCase() === 'digikey') {
          const result = await digikeyService.searchPart(dist.sku);
          vendorData = result.results?.[0];
        } else if (dist.distributor_name.toLowerCase() === 'mouser') {
          const result = await mouserService.searchPart(dist.sku);
          vendorData = result.results?.[0];
        }

        // Update pricing if found
        if (vendorData && vendorData.pricing) {
          return {
            ...dist,
            price_breaks: vendorData.pricing,
            stock_quantity: vendorData.stock || dist.stock_quantity,
            in_stock: (vendorData.stock || 0) > 0,
            url: vendorData.productUrl || dist.url
          };
        }
      } catch (error) {
        console.error(`Error fetching pricing for SKU ${dist.sku}:`, error.message);
        // Continue with original data if fetch fails
      }

      return dist;
    }));

    // Handle both INSERT (new records) and UPDATE (existing records)
    const updates = distributorsWithPricing.map(async (dist) => {
      if (dist.id) {
        // Update existing distributor_info record
        await pool.query(`
          UPDATE distributor_info 
          SET sku = $1,
              url = $2,
              in_stock = $3,
              stock_quantity = $4,
              minimum_order_quantity = $5,
              price_breaks = $6,
              last_updated = CURRENT_TIMESTAMP
          WHERE component_id = $7 AND id = $8
        `, [
          dist.sku || dist.distributor_part_number || null, 
          dist.url || null,
          dist.in_stock || false,
          dist.stock_quantity || 0,
          dist.minimum_order_quantity || 1,
          dist.price_breaks ? JSON.stringify(dist.price_breaks) : null,
          id, 
          dist.id
        ]);
      } else if (dist.distributor_id && dist.sku) {
        // Insert new distributor_info record
        await pool.query(`
          INSERT INTO distributor_info (
            component_id,
            distributor_id,
            sku,
            url,
            in_stock,
            stock_quantity,
            minimum_order_quantity,
            price_breaks
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (component_id, distributor_id, sku) DO UPDATE
          SET url = EXCLUDED.url,
              in_stock = EXCLUDED.in_stock,
              stock_quantity = EXCLUDED.stock_quantity,
              minimum_order_quantity = EXCLUDED.minimum_order_quantity,
              price_breaks = EXCLUDED.price_breaks,
              last_updated = CURRENT_TIMESTAMP
        `, [
          id,
          dist.distributor_id,
          dist.sku,
          dist.url || null,
          dist.in_stock || false,
          dist.stock_quantity || 0,
          dist.minimum_order_quantity || 1,
          dist.price_breaks ? JSON.stringify(dist.price_breaks) : null
        ]);
      }
    });

    await Promise.all(updates);

    // Get component info for audit log
    const componentResult = await pool.query(
      'SELECT part_number, description FROM components WHERE id = $1',
      [id]
    );
    
    const component = componentResult.rows[0];
    
    // Log activity
    await pool.query(`
      INSERT INTO activity_log (component_id, part_number, description, category_name, activity_type, change_details)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      id,
      component?.part_number || '',
      component?.description || 'Distributor info updated',
      null,
      'distributor_updated',
      JSON.stringify({
        distributor_count: distributorsWithPricing.length,
        distributors: distributorsWithPricing.map(d => ({
          distributor_id: d.distributor_id,
          sku: d.sku,
          in_stock: d.in_stock
        }))
      })
    ]);

    // Return updated distributor info
    const result = await pool.query(`
      SELECT di.*, d.name as distributor_name
      FROM distributor_info di
      JOIN distributors d ON di.distributor_id = d.id
      WHERE di.component_id = $1
    `, [id]);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

// Get unique sub-category values for a specific category
export const getSubCategorySuggestions = async (req, res, next) => {
  try {
    const { categoryId, level, subCat1, subCat2 } = req.query;
    
    if (!categoryId || !level || !['1', '2', '3'].includes(level)) {
      return res.status(400).json({ error: 'categoryId and level (1, 2, or 3) are required' });
    }

    const columnName = `sub_category${level}`;
    
    // Build query with cascading filters
    let query = `
      SELECT DISTINCT ${columnName} as value
      FROM components
      WHERE category_id = $1 
        AND ${columnName} IS NOT NULL 
        AND ${columnName} != ''
    `;
    
    const params = [categoryId];
    let paramCount = 2;
    
    // For level 2, filter by sub_category1 if provided
    if (level === '2' && subCat1) {
      query += ` AND sub_category1 = $${paramCount}`;
      params.push(subCat1);
      paramCount++;
    }
    
    // For level 3, filter by sub_category1 and sub_category2 if provided
    if (level === '3') {
      if (subCat1) {
        query += ` AND sub_category1 = $${paramCount}`;
        params.push(subCat1);
        paramCount++;
      }
      if (subCat2) {
        query += ` AND sub_category2 = $${paramCount}`;
        params.push(subCat2);
        paramCount++;
      }
    }
    
    query += ` ORDER BY ${columnName}`;
    
    const result = await pool.query(query, params);

    res.json(result.rows.map(row => row.value));
  } catch (error) {
    next(error);
  }
};

export const getFieldSuggestions = async (req, res, next) => {
  try {
    const { categoryId, field } = req.query;
    
    // Validate field name to prevent SQL injection
    const allowedFields = ['package_size', 'pcb_footprint', 'schematic', 'step_model', 'pspice'];
    if (!field || !allowedFields.includes(field)) {
      return res.status(400).json({ error: 'Invalid field parameter' });
    }
    
    if (!categoryId) {
      return res.status(400).json({ error: 'categoryId is required' });
    }

    const query = `
      SELECT DISTINCT ${field} as value
      FROM components
      WHERE category_id = $1 
        AND ${field} IS NOT NULL 
        AND ${field} != ''
      ORDER BY ${field}
    `;
    
    const result = await pool.query(query, [categoryId]);

    res.json(result.rows.map(row => row.value));
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// ALTERNATIVE PARTS MANAGEMENT
// ============================================================================

export const getAlternatives = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // First get the component's part number
    const componentResult = await pool.query(
      'SELECT part_number FROM components WHERE id = $1',
      [id]
    );
    
    if (componentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Component not found' });
    }
    
    const partNumber = componentResult.rows[0].part_number;
    
    // Get all alternatives for this part number (NOT including the primary component itself)
    const result = await pool.query(`
      SELECT 
        ca.*,
        m.name as manufacturer_name,
        m.website as manufacturer_website,
        (
          SELECT json_agg(
            json_build_object(
              'id', di.id,
              'distributor_id', di.distributor_id,
              'distributor_name', d.name,
              'sku', di.sku,
              'url', di.url,
              'currency', di.currency,
              'in_stock', di.in_stock,
              'stock_quantity', di.stock_quantity,
              'minimum_order_quantity', di.minimum_order_quantity,
              'packaging', di.packaging,
              'price_breaks', di.price_breaks,
              'last_updated', di.last_updated
            )
          )
          FROM distributor_info di
          LEFT JOIN distributors d ON di.distributor_id = d.id
          WHERE di.alternative_id = ca.id
        ) as distributors
      FROM components_alternative ca
      LEFT JOIN manufacturers m ON ca.manufacturer_id = m.id
      WHERE ca.part_number = $1
      ORDER BY ca.created_at ASC
    `, [partNumber]);
    
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
};

export const createAlternative = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      manufacturer_id,
      manufacturer_pn,
      distributors = [] // Array of distributor info objects
    } = req.body;
    
    // Get component's part number
    const componentResult = await pool.query(
      'SELECT part_number FROM components WHERE id = $1',
      [id]
    );
    
    if (componentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Component not found' });
    }
    
    const partNumber = componentResult.rows[0].part_number;
    
    // Create the alternative (no notes field)
    const result = await pool.query(`
      INSERT INTO components_alternative (
        part_number, manufacturer_id, manufacturer_pn
      )
      VALUES ($1, $2, $3)
      RETURNING *
    `, [partNumber, manufacturer_id, manufacturer_pn]);
    
    const alternativeId = result.rows[0].id;
    
    // Add distributor info if provided
    if (distributors && distributors.length > 0) {
      for (const dist of distributors) {
        await pool.query(`
          INSERT INTO distributor_info (
            alternative_id, distributor_id, sku, url, currency,
            in_stock, stock_quantity, minimum_order_quantity, packaging, price_breaks
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (alternative_id, distributor_id, sku) DO UPDATE
          SET url = EXCLUDED.url,
              in_stock = EXCLUDED.in_stock,
              stock_quantity = EXCLUDED.stock_quantity,
              minimum_order_quantity = EXCLUDED.minimum_order_quantity,
              packaging = EXCLUDED.packaging,
              price_breaks = EXCLUDED.price_breaks,
              last_updated = CURRENT_TIMESTAMP
        `, [
          alternativeId,
          dist.distributor_id,
          dist.sku || '',
          dist.url || '',
          dist.currency || 'USD',
          dist.in_stock || false,
          dist.stock_quantity || 0,
          dist.minimum_order_quantity || 1,
          dist.packaging || '',
          dist.price_breaks ? JSON.stringify(dist.price_breaks) : null
        ]);
      }
    }
    
    // Log activity
    await pool.query(`
      INSERT INTO activity_log (component_id, part_number, description, category_name, activity_type, change_details)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      id,
      partNumber,
      `Alternative part added: ${manufacturer_pn}`,
      null,
      'alternative_added',
      JSON.stringify({
        alternative_id: alternativeId,
        manufacturer_pn: manufacturer_pn,
        distributor_count: distributors?.length || 0
      })
    ]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({ error: 'This alternative already exists for this component' });
    }
    next(error);
  }
};

export const updateAlternative = async (req, res, next) => {
  try {
    const { id, altId } = req.params;
    const {
      manufacturer_id,
      manufacturer_pn,
      distributors = []
    } = req.body;
    
    // Get component's part number
    const componentResult = await pool.query(
      'SELECT part_number FROM components WHERE id = $1',
      [id]
    );
    
    if (componentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Component not found' });
    }
    
    const partNumber = componentResult.rows[0].part_number;
    
    const result = await pool.query(`
      UPDATE components_alternative
      SET 
        manufacturer_id = COALESCE($1, manufacturer_id),
        manufacturer_pn = COALESCE($2, manufacturer_pn),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND part_number = $4
      RETURNING *
    `, [manufacturer_id, manufacturer_pn, altId, partNumber]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alternative not found' });
    }
    
    // Update distributors if provided
    if (distributors && distributors.length > 0) {
      // Delete existing distributors for this alternative
      await pool.query('DELETE FROM distributor_info WHERE alternative_id = $1', [altId]);
      
      // Insert new distributor info
      for (const dist of distributors) {
        if (dist.distributor_id && (dist.sku || dist.url)) {
          await pool.query(`
            INSERT INTO distributor_info (
              alternative_id, distributor_id, sku, url, currency,
              in_stock, stock_quantity, minimum_order_quantity, packaging, price_breaks
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (alternative_id, distributor_id, sku) DO UPDATE
            SET url = EXCLUDED.url,
                in_stock = EXCLUDED.in_stock,
                stock_quantity = EXCLUDED.stock_quantity,
                minimum_order_quantity = EXCLUDED.minimum_order_quantity,
                packaging = EXCLUDED.packaging,
                price_breaks = EXCLUDED.price_breaks,
                last_updated = CURRENT_TIMESTAMP
          `, [
            altId,
            dist.distributor_id,
            dist.sku || '',
            dist.url || '',
            dist.currency || 'USD',
            dist.in_stock || false,
            dist.stock_quantity || 0,
            dist.minimum_order_quantity || 1,
            dist.packaging || '',
            dist.price_breaks ? JSON.stringify(dist.price_breaks) : null
          ]);
        }
      }
    }
    
    // Log activity
    await pool.query(`
      INSERT INTO activity_log (component_id, part_number, description, category_name, activity_type, change_details)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      id,
      partNumber,
      `Alternative part updated: ${manufacturer_pn || result.rows[0].manufacturer_pn}`,
      null,
      'alternative_updated',
      JSON.stringify({
        alternative_id: altId,
        manufacturer_pn: manufacturer_pn || result.rows[0].manufacturer_pn,
        distributor_count: distributors?.length || 0
      })
    ]);
    
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

export const deleteAlternative = async (req, res, next) => {
  try {
    const { id, altId } = req.params;
    
    // Get component's part number
    const componentResult = await pool.query(
      'SELECT part_number FROM components WHERE id = $1',
      [id]
    );
    
    if (componentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Component not found' });
    }
    
    const partNumber = componentResult.rows[0].part_number;
    
    // Get alternative info before deleting
    const altResult = await pool.query(
      'SELECT manufacturer_pn FROM components_alternative WHERE id = $1',
      [altId]
    );
    
    const alternativePn = altResult.rows[0]?.manufacturer_pn;
    
    // Delete the alternative (distributor_info will be cascade deleted)
    const result = await pool.query(
      'DELETE FROM components_alternative WHERE id = $1 AND part_number = $2 RETURNING *',
      [altId, partNumber]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alternative not found' });
    }
    
    // Log activity
    await pool.query(`
      INSERT INTO activity_log (component_id, part_number, description, category_name, activity_type, change_details)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      id,
      partNumber,
      `Alternative part deleted: ${alternativePn}`,
      null,
      'alternative_deleted',
      JSON.stringify({
        alternative_id: altId,
        manufacturer_pn: alternativePn
      })
    ]);
    
    res.json({ message: 'Alternative deleted successfully' });
  } catch (error) {
    next(error);
  }
};
