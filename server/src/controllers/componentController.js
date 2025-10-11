import pool from '../config/database.js';

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
        const searchConditions = keywords.map((_, index) => {
          const paramIndex = paramCount + index;
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
          )`;
        }).join(' AND ');
        
        query += ` AND (${searchConditions})`;
        keywords.forEach(keyword => params.push(`%${keyword}%`));
        paramCount += keywords.length;
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

    // Handle both INSERT (new records) and UPDATE (existing records)
    const updates = distributors.map(async (dist) => {
      if (dist.id) {
        // Update existing distributor_info record
        await pool.query(`
          UPDATE distributor_info 
          SET sku = $1,
              url = $2,
              price = $3,
              in_stock = $4,
              stock_quantity = $5,
              minimum_order_quantity = $6,
              price_breaks = $7,
              last_updated = CURRENT_TIMESTAMP
          WHERE component_id = $8 AND id = $9
        `, [
          dist.sku || dist.distributor_part_number || null, 
          dist.url || null,
          dist.price || null,
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
            price,
            in_stock,
            stock_quantity,
            minimum_order_quantity,
            price_breaks
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (component_id, distributor_id, sku) DO UPDATE
          SET url = EXCLUDED.url,
              price = EXCLUDED.price,
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
          dist.price || null,
          dist.in_stock || false,
          dist.stock_quantity || 0,
          dist.minimum_order_quantity || 1,
          dist.price_breaks ? JSON.stringify(dist.price_breaks) : null
        ]);
      }
    });

    await Promise.all(updates);

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
