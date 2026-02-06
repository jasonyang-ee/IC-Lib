import pool from '../config/database.js';
import * as digikeyService from '../services/digikeyService.js';
import * as mouserService from '../services/mouserService.js';

export const getAllComponents = async (req, res, next) => {
  try {
    const { category, search, approvalStatus } = req.query;
    
    let query = `
      SELECT 
        c.*,
        cat.name as category_name,
        cat.prefix as category_prefix,
        m.name as manufacturer_name,
        u.username as approval_user_name,
        get_part_type(c.category_id, c.sub_category1, c.sub_category2, c.sub_category3, c.sub_category4) as part_type,
        created_at(c.id) as created_at
      FROM components c
      LEFT JOIN component_categories cat ON c.category_id = cat.id
      LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
      LEFT JOIN users u ON c.approval_user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (category) {
      query += ` AND cat.id = $${paramCount}`;
      params.push(category);
      paramCount++;
    }

    if (approvalStatus) {
      query += ` AND c.approval_status = $${paramCount}`;
      params.push(approvalStatus);
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
            OR c.sub_category4 ILIKE $${paramIndex}
            OR get_part_type(c.category_id, c.sub_category1, c.sub_category2, c.sub_category3, c.sub_category4) ILIKE $${paramIndex}
            OR cat.name ILIKE $${paramIndex}
            OR m.name ILIKE $${paramIndex}
            OR c.id::text = $${exactParamIndex}
            OR EXISTS (
              SELECT 1 FROM components_alternative ca
              WHERE ca.component_id = c.id
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
              WHERE ca.component_id = c.id
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

    query += ' ORDER BY c.id DESC';

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
        u.username as approval_user_name,
        get_part_type(c.category_id, c.sub_category1, c.sub_category2, c.sub_category3, c.sub_category4) as part_type,
        created_at(c.id) as created_at
      FROM components c
      LEFT JOIN component_categories cat ON c.category_id = cat.id
      LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
      LEFT JOIN users u ON c.approval_user_id = u.id
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
      sub_category4,
      pcb_footprint,
      package_size,
      schematic,
      step_model,
      pspice,
      pad_file,
      datasheet_url,
      approval_status,
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
        description, value, sub_category1, sub_category2, sub_category3, sub_category4,
        pcb_footprint, package_size, schematic, step_model, pspice, pad_file,
        datasheet_url, approval_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `;

    const componentResult = await pool.query(insertQuery, [
      validCategoryId, part_number, validManufacturerId, mfrPartNumber,
      description, value, sub_category1, sub_category2, sub_category3, sub_category4,
      pcb_footprint, package_size, schematic, step_model, pspice, pad_file,
      datasheet_url, approval_status || 'new',
    ]);

    const component = componentResult.rows[0];
    
    // Log activity
    try {
      const categoryResult = await pool.query('SELECT name FROM component_categories WHERE id = $1', [validCategoryId]);
      await pool.query(`
        INSERT INTO activity_log (component_id, user_id, part_number, activity_type, details)
        VALUES ($1, $2, $3, 'added', $4)
      `, [
        component.id,
        req.user.id,
        component.part_number,
        JSON.stringify({
          description: component.description,
          category_name: categoryResult.rows[0]?.name,
          manufacturer_pn: mfrPartNumber,
          value: value,
        }),
      ]);
    } catch (logError) {
      console.error('Failed to log component creation activity:', logError.message);
    }
    
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
        get_part_type(c.category_id, c.sub_category1, c.sub_category2, c.sub_category3, c.sub_category4) as part_type,
        created_at(c.id) as created_at
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

/**
 * Change component category and update part number
 * Generates a new part number based on the new category's prefix
 * Handles collision detection automatically
 */
export const changeComponentCategory = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { new_category_id } = req.body;

    if (!new_category_id) {
      return res.status(400).json({ error: 'new_category_id is required' });
    }

    await client.query('BEGIN');

    // Get current component info
    const componentResult = await client.query(
      'SELECT id, part_number, category_id FROM components WHERE id = $1',
      [id],
    );

    if (componentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Component not found' });
    }

    const currentComponent = componentResult.rows[0];
    const oldPartNumber = currentComponent.part_number;
    const oldCategoryId = currentComponent.category_id;

    // Check if category is actually changing
    if (oldCategoryId === new_category_id) {
      await client.query('ROLLBACK');
      return res.json({ 
        success: true, 
        message: 'Category unchanged',
        part_number: oldPartNumber, 
      });
    }

    // Get new category prefix and leading_zeros
    const categoryResult = await client.query(
      'SELECT id, name, prefix, leading_zeros FROM component_categories WHERE id = $1',
      [new_category_id],
    );

    if (categoryResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'New category not found' });
    }

    const { prefix, leading_zeros = 5, name: categoryName } = categoryResult.rows[0];

    // Find the next available part number for this prefix
    const maxResult = await client.query(`
      SELECT MAX(
        CAST(
          SUBSTRING(part_number FROM '^${prefix}-(\\d+)$')
          AS INTEGER
        )
      ) as max_number
      FROM components
      WHERE part_number ~ '^${prefix}-\\d+$'
    `);

    const maxNumber = maxResult.rows[0].max_number || 0;
    const nextNumber = maxNumber + 1;
    const newPartNumber = `${prefix}-${String(nextNumber).padStart(leading_zeros, '0')}`;

    console.log(`\x1b[33m[INFO]\x1b[0m \x1b[36m[ComponentController]\x1b[0m Changing category for ${oldPartNumber}: ${oldCategoryId} -> ${new_category_id}`);
    console.log(`\x1b[33m[INFO]\x1b[0m \x1b[36m[ComponentController]\x1b[0m New part number: ${newPartNumber}`);

    // Delete old specification values that belong to the old category
    // These specs are not valid for the new category and would become orphan data
    const deleteSpecsResult = await client.query(`
      DELETE FROM component_specification_values
      WHERE component_id = $1
        AND category_spec_id IN (
          SELECT id FROM category_specifications 
          WHERE category_id = $2
        )
    `, [id, oldCategoryId]);

    if (deleteSpecsResult.rowCount > 0) {
      console.log(`\x1b[33m[INFO]\x1b[0m \x1b[36m[ComponentController]\x1b[0m Removed ${deleteSpecsResult.rowCount} old specification values`);
    }

    // Note: No need to update components_alternative - they reference component_id (UUID)
    // which doesn't change when part_number changes due to category change.

    // Update component with new category and part number
    // Also clear sub-categories since they may not be valid for new category
    await client.query(`
      UPDATE components SET
        category_id = $1,
        part_number = $2,
        sub_category1 = NULL,
        sub_category2 = NULL,
        sub_category3 = NULL,
        sub_category4 = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [new_category_id, newPartNumber, id]);

    // Log activity
    try {
      await client.query(`
        INSERT INTO activity_log (component_id, user_id, part_number, activity_type, details)
        VALUES ($1, $2, $3, 'category_changed', $4)
      `, [
        id,
        req.user.id,
        newPartNumber,
        JSON.stringify({
          old_part_number: oldPartNumber,
          new_part_number: newPartNumber,
          old_category_id: oldCategoryId,
          new_category_id: new_category_id,
          new_category_name: categoryName,
        }),
      ]);
    } catch (logError) {
      console.error('Failed to log category change activity:', logError.message);
    }

    await client.query('COMMIT');

    // Fetch updated component
    const fullComponent = await pool.query(`
      SELECT 
        c.*,
        cat.name as category_name,
        cat.prefix as category_prefix,
        m.name as manufacturer_name,
        get_part_type(c.category_id, c.sub_category1, c.sub_category2, c.sub_category3, c.sub_category4) as part_type,
        created_at(c.id) as created_at
      FROM components c
      LEFT JOIN component_categories cat ON c.category_id = cat.id
      LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
      WHERE c.id = $1
    `, [id]);

    console.log(`\x1b[32m[SUCCESS]\x1b[0m \x1b[36m[ComponentController]\x1b[0m Category changed: ${oldPartNumber} -> ${newPartNumber}`);

    res.json({
      success: true,
      old_part_number: oldPartNumber,
      new_part_number: newPartNumber,
      component: fullComponent.rows[0],
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`\x1b[31m[ERROR]\x1b[0m \x1b[36m[ComponentController]\x1b[0m Error changing category: ${error.message}`);
    next(error);
  } finally {
    client.release();
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
      sub_category4,
      pcb_footprint,
      package_size,
      schematic,
      step_model,
      pspice,
      pad_file,
      datasheet_url,
      approval_status,
      approval_user_id,
      approval_date,
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
        sub_category4 = $10,
        pcb_footprint = COALESCE($11, pcb_footprint),
        package_size = COALESCE($12, package_size),
        schematic = $13,
        step_model = $14,
        pspice = $15,
        pad_file = $16,
        datasheet_url = COALESCE($17, datasheet_url),
        approval_status = COALESCE($18, approval_status),
        approval_user_id = $19,
        approval_date = $20,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $21
      RETURNING *
    `, [
      validCategoryId, part_number, validManufacturerId, mfrPartNumber,
      description, value, sub_category1, sub_category2, sub_category3, sub_category4,
      pcb_footprint, package_size, schematic, step_model, pspice, pad_file,
      datasheet_url, approval_status, approval_user_id, approval_date,
      id,
    ]);

    // Log activity with details
    try {
      const categoryResult = await pool.query('SELECT name FROM component_categories WHERE id = $1', [result.rows[0].category_id]);
      await pool.query(`
        INSERT INTO activity_log (component_id, user_id, part_number, activity_type, details)
        VALUES ($1, $2, $3, 'updated', $4)
      `, [
        id,
        req.user.id,
        result.rows[0].part_number,
        JSON.stringify({
          category_name: categoryResult.rows[0]?.name,
          updated_fields: Object.keys(req.body).filter(k => req.body[k] !== undefined),
        }),
      ]);
    } catch (logError) {
      console.error('Failed to log component update activity:', logError.message);
    }

    // Fetch the complete component with joined data
    const fullComponent = await pool.query(`
      SELECT 
        c.*,
        cat.name as category_name,
        cat.prefix as category_prefix,
        m.name as manufacturer_name,
        get_part_type(c.category_id, c.sub_category1, c.sub_category2, c.sub_category3, c.sub_category4) as part_type,
        created_at(c.id) as created_at
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
      [id],
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
      try {
        await client.query(`
          INSERT INTO activity_log (component_id, user_id, part_number, activity_type, details)
          VALUES ($1, $2, $3, 'deleted', $4)
        `, [
          component.id,
          req.user.id,
          component.part_number,
          JSON.stringify({
            description: component.description,
            category_name: component.category_name,
          }),
        ]);
      } catch (logError) {
        console.error('Failed to log component deletion activity:', logError.message);
      }
      
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
            url: vendorData.productUrl || dist.url,
          };
        }
      } catch (error) {
        console.error(`Error fetching pricing for SKU ${dist.sku}:`, error.message);
        // Continue with original data if fetch fails
      }

      return dist;
    }));

    // Get list of distributor IDs that should be kept
    const validDistributorIds = distributorsWithPricing
      .filter(dist => dist.distributor_id && (dist.sku || dist.url))
      .map(dist => dist.distributor_id);

    // Delete distributor entries that are not in the provided list
    // This handles the case where a distributor entry needs to be removed
    if (validDistributorIds.length > 0) {
      await pool.query(`
        DELETE FROM distributor_info 
        WHERE component_id = $1 
        AND distributor_id NOT IN (${validDistributorIds.map((_, i) => `$${i + 2}`).join(',')})
      `, [id, ...validDistributorIds]);
    } else {
      // If no valid distributors, delete all for this component
      await pool.query('DELETE FROM distributor_info WHERE component_id = $1', [id]);
    }

    // Handle both INSERT (new records) and UPDATE (existing records)
    // IMPORTANT: Each component can have only ONE entry per distributor
    // Using UPSERT with ON CONFLICT (component_id, distributor_id)
    const updates = distributorsWithPricing.map(async (dist) => {
      // Skip if no distributor_id or no data to save
      if (!dist.distributor_id || (!dist.sku && !dist.url)) {
        return;
      }

      // UPSERT: Insert or update based on (component_id, distributor_id) unique constraint
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
        ON CONFLICT (component_id, distributor_id) 
        DO UPDATE SET
          sku = EXCLUDED.sku,
          url = EXCLUDED.url,
          in_stock = EXCLUDED.in_stock,
          stock_quantity = EXCLUDED.stock_quantity,
          minimum_order_quantity = EXCLUDED.minimum_order_quantity,
          price_breaks = EXCLUDED.price_breaks,
          updated_at = CURRENT_TIMESTAMP
      `, [
        id,
        dist.distributor_id,
        dist.sku || null,
        dist.url || null,
        dist.in_stock || false,
        dist.stock_quantity || 0,
        dist.minimum_order_quantity || 1,
        dist.price_breaks ? JSON.stringify(dist.price_breaks) : null,
      ]);
    });

    await Promise.all(updates);

    // Get component info for audit log
    const componentResult = await pool.query(
      'SELECT part_number, description FROM components WHERE id = $1',
      [id],
    );
    
    const component = componentResult.rows[0];
    
    // Log activity
    try {
      await pool.query(`
        INSERT INTO activity_log (component_id, user_id, part_number, activity_type, details)
        VALUES ($1, $2, $3, 'distributor_updated', $4)
      `, [
        id,
        req.user.id,
        component?.part_number || '',
        JSON.stringify({
          description: component?.description,
          distributor_count: distributorsWithPricing.length,
          distributors: distributorsWithPricing.map(d => ({
            distributor_id: d.distributor_id,
            sku: d.sku,
            in_stock: d.in_stock,
          })),
        }),
      ]);
    } catch (logError) {
      console.error('Failed to log distributor update activity:', logError.message);
    }

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
    const { categoryId, level, subCat1, subCat2, subCat3 } = req.query;
    
    if (!categoryId || !level || !['1', '2', '3', '4'].includes(level)) {
      return res.status(400).json({ error: 'categoryId and level (1, 2, 3, or 4) are required' });
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
    
    // For level 4, filter by all previous subcategories
    if (level === '4') {
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
      if (subCat3) {
        query += ` AND sub_category3 = $${paramCount}`;
        params.push(subCat3);
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
    const allowedFields = ['package_size', 'pcb_footprint', 'schematic', 'step_model', 'pspice', 'pad_file'];
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

    // Get all alternatives for this component
    const result = await pool.query(`
      SELECT
        ca.*,
        m.name as manufacturer_name,
        m.website as manufacturer_website,
        created_at(ca.id) as created_at,
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
              'last_updated', di.updated_at
            )
          )
          FROM distributor_info di
          LEFT JOIN distributors d ON di.distributor_id = d.id
          WHERE di.alternative_id = ca.id
        ) as distributors
      FROM components_alternative ca
      LEFT JOIN manufacturers m ON ca.manufacturer_id = m.id
      WHERE ca.component_id = $1
      ORDER BY ca.id ASC
    `, [id]);

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
      distributors = [],
    } = req.body;

    // Verify the component exists and get its part_number for logging
    const componentResult = await pool.query(
      'SELECT part_number FROM components WHERE id = $1',
      [id],
    );

    if (componentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Component not found' });
    }

    const partNumber = componentResult.rows[0].part_number;

    // Create the alternative linked by component_id
    const result = await pool.query(`
      INSERT INTO components_alternative (
        component_id, manufacturer_id, manufacturer_pn
      )
      VALUES ($1, $2, $3)
      RETURNING *
    `, [id, manufacturer_id, manufacturer_pn]);
    
    const alternativeId = result.rows[0].id;
    
    // Add distributor info if provided
    // IMPORTANT: Each alternative can have only ONE entry per distributor
    if (distributors && distributors.length > 0) {
      for (const dist of distributors) {
        await pool.query(`
          INSERT INTO distributor_info (
            alternative_id, distributor_id, sku, url, currency,
            in_stock, stock_quantity, minimum_order_quantity, packaging, price_breaks
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (alternative_id, distributor_id) DO UPDATE
          SET sku = EXCLUDED.sku,
              url = EXCLUDED.url,
              in_stock = EXCLUDED.in_stock,
              stock_quantity = EXCLUDED.stock_quantity,
              minimum_order_quantity = EXCLUDED.minimum_order_quantity,
              packaging = EXCLUDED.packaging,
              price_breaks = EXCLUDED.price_breaks,
              updated_at = CURRENT_TIMESTAMP
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
          dist.price_breaks ? JSON.stringify(dist.price_breaks) : null,
        ]);
      }
    }
    
    // Log activity
    try {
      await pool.query(`
        INSERT INTO activity_log (component_id, user_id, part_number, activity_type, details)
        VALUES ($1, $2, $3, 'alternative_added', $4)
      `, [
        id,
        req.user.id,
        partNumber,
        JSON.stringify({
          alternative_id: alternativeId,
          manufacturer_pn: manufacturer_pn,
          distributor_count: distributors?.length || 0,
        }),
      ]);
    } catch (logError) {
      console.error('Failed to log alternative added activity:', logError.message);
    }
    
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
      distributors = [],
    } = req.body;

    // Verify the component exists and get part_number for logging
    const componentResult = await pool.query(
      'SELECT part_number FROM components WHERE id = $1',
      [id],
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
      WHERE id = $3 AND component_id = $4
      RETURNING *
    `, [manufacturer_id, manufacturer_pn, altId, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alternative not found' });
    }
    
    // Update distributors if provided
    if (distributors) {
      // Get list of distributor IDs that should be kept
      const validDistributorIds = distributors
        .filter(dist => dist.distributor_id && (dist.sku || dist.url))
        .map(dist => dist.distributor_id);

      // Delete distributor entries that are not in the provided list
      if (validDistributorIds.length > 0) {
        await pool.query(`
          DELETE FROM distributor_info 
          WHERE alternative_id = $1 
          AND distributor_id NOT IN (${validDistributorIds.map((_, i) => `$${i + 2}`).join(',')})
        `, [altId, ...validDistributorIds]);
      } else {
        // If no valid distributors, delete all for this alternative
        await pool.query('DELETE FROM distributor_info WHERE alternative_id = $1', [altId]);
      }

      // UPSERT distributor info
      // Each alternative can have only ONE entry per distributor
      for (const dist of distributors) {
        if (dist.distributor_id && (dist.sku || dist.url)) {
          await pool.query(`
            INSERT INTO distributor_info (
              alternative_id, distributor_id, sku, url, currency,
              in_stock, stock_quantity, minimum_order_quantity, packaging, price_breaks
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (alternative_id, distributor_id) DO UPDATE
            SET sku = EXCLUDED.sku,
                url = EXCLUDED.url,
                in_stock = EXCLUDED.in_stock,
                stock_quantity = EXCLUDED.stock_quantity,
                minimum_order_quantity = EXCLUDED.minimum_order_quantity,
                packaging = EXCLUDED.packaging,
                price_breaks = EXCLUDED.price_breaks,
                updated_at = CURRENT_TIMESTAMP
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
            dist.price_breaks ? JSON.stringify(dist.price_breaks) : null,
          ]);
        }
      }
    }
    
    // Log activity
    try {
      await pool.query(`
        INSERT INTO activity_log (component_id, user_id, part_number, activity_type, details)
        VALUES ($1, $2, $3, 'alternative_updated', $4)
      `, [
        id,
        req.user.id,
        partNumber,
        JSON.stringify({
          alternative_id: altId,
          manufacturer_pn: manufacturer_pn || result.rows[0].manufacturer_pn,
          distributor_count: distributors?.length || 0,
        }),
      ]);
    } catch (logError) {
      console.error('Failed to log alternative update activity:', logError.message);
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
};

export const deleteAlternative = async (req, res, next) => {
  try {
    const { id, altId } = req.params;

    // Verify the component exists and get part_number for logging
    const componentResult = await pool.query(
      'SELECT part_number FROM components WHERE id = $1',
      [id],
    );

    if (componentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Component not found' });
    }

    const partNumber = componentResult.rows[0].part_number;

    // Get alternative info before deleting
    const altResult = await pool.query(
      'SELECT manufacturer_pn FROM components_alternative WHERE id = $1',
      [altId],
    );

    const alternativePn = altResult.rows[0]?.manufacturer_pn;

    // Delete the alternative (distributor_info will be cascade deleted)
    const result = await pool.query(
      'DELETE FROM components_alternative WHERE id = $1 AND component_id = $2 RETURNING *',
      [altId, id],
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alternative not found' });
    }
    
    // Log activity
    try {
      await pool.query(`
        INSERT INTO activity_log (component_id, user_id, part_number, activity_type, details)
        VALUES ($1, $2, $3, 'alternative_deleted', $4)
      `, [
        id,
        req.user.id,
        partNumber,
        JSON.stringify({
          alternative_id: altId,
          manufacturer_pn: alternativePn,
        }),
      ]);
    } catch (logError) {
      console.error('Failed to log alternative deletion activity:', logError.message);
    }
    
    res.json({ message: 'Alternative deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Promote an alternative part to become the primary part
 * Atomically swaps the alternative's manufacturer info and distributor info
 * with the primary component's, demoting the current primary to an alternative
 */
export const promoteAlternative = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id, altId } = req.params;

    await client.query('BEGIN');

    // Fetch primary component and alternative data
    const comp = (await client.query(
      'SELECT id, part_number, manufacturer_id, manufacturer_pn FROM components WHERE id = $1', [id],
    )).rows[0];

    const altPart = (await client.query(
      'SELECT id, manufacturer_id, manufacturer_pn FROM components_alternative WHERE id = $1 AND component_id = $2', [altId, id],
    )).rows[0];

    if (!comp || !altPart) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Component or alternative not found' });
    }

    // 1. Swap manufacturer info on component and alternative
    await client.query(`
      UPDATE components SET
        manufacturer_id = $1,
        manufacturer_pn = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [altPart.manufacturer_id, altPart.manufacturer_pn, id]);

    await client.query(`
      UPDATE components_alternative SET
        manufacturer_id = $1,
        manufacturer_pn = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [comp.manufacturer_id, comp.manufacturer_pn, altId]);

    // 2. Swap distributor info using a staging approach:
    //    Delete-and-reinsert to avoid unique constraint conflicts
    const primaryDists = (await client.query(
      'SELECT * FROM distributor_info WHERE component_id = $1', [id],
    )).rows;

    const altDists = (await client.query(
      'SELECT * FROM distributor_info WHERE alternative_id = $1', [altId],
    )).rows;

    await client.query('DELETE FROM distributor_info WHERE component_id = $1', [id]);
    await client.query('DELETE FROM distributor_info WHERE alternative_id = $1', [altId]);

    // Re-insert alternative's distributors as primary
    for (const dist of altDists) {
      await client.query(`
        INSERT INTO distributor_info (
          component_id, alternative_id, distributor_id, sku, url, currency,
          in_stock, stock_quantity, minimum_order_quantity, packaging, price_breaks
        ) VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        id, dist.distributor_id, dist.sku, dist.url, dist.currency,
        dist.in_stock, dist.stock_quantity, dist.minimum_order_quantity,
        dist.packaging, dist.price_breaks ? JSON.stringify(dist.price_breaks) : null,
      ]);
    }

    // Re-insert primary's distributors as alternative
    for (const dist of primaryDists) {
      await client.query(`
        INSERT INTO distributor_info (
          component_id, alternative_id, distributor_id, sku, url, currency,
          in_stock, stock_quantity, minimum_order_quantity, packaging, price_breaks
        ) VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        altId, dist.distributor_id, dist.sku, dist.url, dist.currency,
        dist.in_stock, dist.stock_quantity, dist.minimum_order_quantity,
        dist.packaging, dist.price_breaks ? JSON.stringify(dist.price_breaks) : null,
      ]);
    }

    // 3. Log activity
    try {
      await client.query(`
        INSERT INTO activity_log (component_id, user_id, part_number, activity_type, details)
        VALUES ($1, $2, $3, 'alternative_promoted', $4)
      `, [
        id,
        req.user.id,
        comp.part_number,
        JSON.stringify({
          alternative_id: altId,
          old_primary_manufacturer_pn: comp.manufacturer_pn,
          new_primary_manufacturer_pn: altPart.manufacturer_pn,
        }),
      ]);
    } catch (logError) {
      console.error('Failed to log alternative promotion activity:', logError.message);
    }

    await client.query('COMMIT');

    // Fetch and return updated component
    const fullComponent = await pool.query(`
      SELECT
        c.*,
        cat.name as category_name,
        cat.prefix as category_prefix,
        m.name as manufacturer_name,
        get_part_type(c.category_id, c.sub_category1, c.sub_category2, c.sub_category3, c.sub_category4) as part_type,
        created_at(c.id) as created_at
      FROM components c
      LEFT JOIN component_categories cat ON c.category_id = cat.id
      LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
      WHERE c.id = $1
    `, [id]);

    res.json({
      success: true,
      component: fullComponent.rows[0],
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`\x1b[31m[ERROR]\x1b[0m \x1b[36m[ComponentController]\x1b[0m Error promoting alternative: ${error.message}`);
    next(error);
  } finally {
    client.release();
  }
};

/**
 * Update stock and pricing info for a single component
 * Fetches data from vendor APIs and updates database
 */
export const updateComponentStock = async (req, res, next) => {
  try {
    const { id } = req.params;

    let updatedCount = 0;
    const errors = [];

    // Get all distributor info for this component (primary + alternatives)
    const distributorsResult = await pool.query(`
      SELECT 
        di.id,
        di.component_id,
        di.alternative_id,
        di.distributor_id,
        di.sku,
        d.name as distributor_name
      FROM distributor_info di
      JOIN distributors d ON di.distributor_id = d.id
      WHERE (di.component_id = $1 OR di.alternative_id IN (
        SELECT id FROM components_alternative WHERE component_id = $1
      ))
      AND di.sku IS NOT NULL
      AND di.sku != ''
    `, [id]);

    // Update each distributor entry
    for (const dist of distributorsResult.rows) {
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

        // Update if data found
        if (vendorData && vendorData.pricing) {
          await pool.query(`
            UPDATE distributor_info
            SET 
              price_breaks = $1,
              stock_quantity = $2,
              in_stock = $3,
              url = COALESCE($4, url),
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $5
          `, [
            JSON.stringify(vendorData.pricing),
            vendorData.stock || 0,
            (vendorData.stock || 0) > 0,
            vendorData.productUrl || null,
            dist.id,
          ]);
          updatedCount++;
        }

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`Error updating stock for SKU ${dist.sku}:`, error.message);
        errors.push({
          sku: dist.sku,
          distributor: dist.distributor_name,
          error: error.message,
        });
      }
    }

    res.json({
      success: true,
      message: `Updated ${updatedCount} distributor entries`,
      updatedCount,
      totalChecked: distributorsResult.rows.length,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error('Error updating component stock:', error);
    next(error);
  }
};

/**
 * Bulk update stock and pricing info for ALL components
 * Fetches data from vendor APIs and updates database
 */
export const bulkUpdateStock = async (req, res, next) => {
  try {
    const { limit } = req.query;
    const maxLimit = limit ? parseInt(limit) : null;

    // Get all distributor entries with SKUs
    let query = `
      SELECT 
        di.id,
        di.sku,
        d.name as distributor_name,
        c.part_number,
        c.id as component_id
      FROM distributor_info di
      JOIN distributors d ON di.distributor_id = d.id
      LEFT JOIN components c ON di.component_id = c.id
      LEFT JOIN components_alternative ca ON di.alternative_id = ca.id
      WHERE di.sku IS NOT NULL
      AND di.sku != ''
      ORDER BY di.updated_at ASC NULLS FIRST
    `;

    if (maxLimit) {
      query += ` LIMIT ${maxLimit}`;
    }

    const distributorsResult = await pool.query(query);

    let updatedCount = 0;
    let skippedCount = 0;
    const errors = [];

    // Update each distributor entry
    for (const dist of distributorsResult.rows) {
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

        // Update if data found
        if (vendorData && vendorData.pricing) {
          await pool.query(`
            UPDATE distributor_info
            SET 
              price_breaks = $1,
              stock_quantity = $2,
              in_stock = $3,
              url = COALESCE($4, url),
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $5
          `, [
            JSON.stringify(vendorData.pricing),
            vendorData.stock || 0,
            (vendorData.stock || 0) > 0,
            vendorData.productUrl || null,
            dist.id,
          ]);
          updatedCount++;
        } else {
          skippedCount++;
        }

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        // Check for rate limit error
        if (error.message === 'RATE_LIMIT_EXCEEDED') {
          return res.status(429).json({
            success: false,
            error: 'RATE_LIMIT_EXCEEDED',
            message: error.vendorMessage || 'API rate limit exceeded. Please try again later.',
            updatedCount,
            skippedCount,
            totalChecked: updatedCount + skippedCount + 1,
          });
        }
        
        errors.push({
          sku: dist.sku,
          distributor: dist.distributor_name,
          partNumber: dist.part_number,
          error: error.message,
        });
      }
    }

    res.json({
      success: true,
      message: `Bulk update complete: ${updatedCount} updated, ${skippedCount} skipped, ${errors.length} errors`,
      updatedCount,
      skippedCount,
      totalChecked: distributorsResult.rows.length,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error('Error in bulk stock update:', error);
    next(error);
  }
};

// Bulk update specifications for all parts with distributor info
export const bulkUpdateSpecifications = async (req, res, next) => {
  try {
    const { limit } = req.query;
    const maxLimit = limit ? parseInt(limit) : null;

    console.log(`\x1b[36m[INFO]\x1b[0m \x1b[33m[SpecsUpdate]\x1b[0m Starting bulk specification update${maxLimit ? ` (limit: ${maxLimit})` : ''}`);

    // Get all components that have distributor SKUs but NO specifications yet
    // Skip components that already have at least one specification value
    let query = `
      SELECT DISTINCT
        c.id as component_id,
        c.part_number,
        c.category_id,
        di.sku,
        d.name as distributor_name
      FROM components c
      JOIN distributor_info di ON c.id = di.component_id
      JOIN distributors d ON di.distributor_id = d.id
      WHERE di.sku IS NOT NULL
      AND di.sku != ''
      AND c.category_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM component_specification_values csv 
        WHERE csv.component_id = c.id
      )
      ORDER BY c.part_number
    `;

    if (maxLimit) {
      query += ` LIMIT ${maxLimit}`;
    }

    const componentsResult = await pool.query(query);
    const totalComponents = componentsResult.rows.length;
    console.log(`\x1b[36m[INFO]\x1b[0m \x1b[33m[SpecsUpdate]\x1b[0m Found ${totalComponents} components without specifications to process`);

    let updatedCount = 0;
    let skippedCount = 0;
    const errors = [];

    // Update each component
    for (let i = 0; i < componentsResult.rows.length; i++) {
      const comp = componentsResult.rows[i];
      const progress = Math.round(((i + 1) / totalComponents) * 100);
      
      try {
        console.log(`\x1b[36m[INFO]\x1b[0m \x1b[33m[SpecsUpdate]\x1b[0m [${progress}%] Processing ${i + 1}/${totalComponents}: ${comp.part_number}`);
        
        let vendorData = null;

        // Fetch from appropriate vendor
        if (comp.distributor_name.toLowerCase() === 'digikey') {
          console.log(`\x1b[90m[DEBUG]\x1b[0m \x1b[33m[SpecsUpdate]\x1b[0m   Searching Digikey for: ${comp.sku}`);
          const result = await digikeyService.searchPart(comp.sku);
          vendorData = result.results?.[0];
        } else if (comp.distributor_name.toLowerCase() === 'mouser') {
          console.log(`\x1b[90m[DEBUG]\x1b[0m \x1b[33m[SpecsUpdate]\x1b[0m   Searching Mouser for: ${comp.sku}`);
          const result = await mouserService.searchPart(comp.sku);
          vendorData = result.results?.[0];
        }

        // Update specifications if vendor data found
        if (vendorData && vendorData.specifications) {
          // Get category specifications with mapping_spec_names
          const categorySpecsResult = await pool.query(`
            SELECT 
              id,
              spec_name,
              unit,
              mapping_spec_names
            FROM category_specifications
            WHERE category_id = $1
            ORDER BY display_order ASC
          `, [comp.category_id]);

          const categorySpecs = categorySpecsResult.rows;

          // Create a map of vendor specs (case-insensitive)
          const vendorSpecMap = {};
          Object.entries(vendorData.specifications).forEach(([key, value]) => {
            const specValue = typeof value === 'object' && value !== null ? value.value : value;
            if (specValue) {
              vendorSpecMap[key.toLowerCase().trim()] = String(specValue);
            }
          });

          // Map and update specifications
          let specsUpdated = false;
          for (const catSpec of categorySpecs) {
            // Support both mapping_spec_names array and legacy mapping_spec_name
            const mappings = Array.isArray(catSpec.mapping_spec_names) 
              ? catSpec.mapping_spec_names 
              : (catSpec.mapping_spec_name ? [catSpec.mapping_spec_name] : []);
            
            // Try each mapping until we find a match
            let matchedValue = null;
            for (const mapping of mappings) {
              if (mapping && mapping.trim() !== '') {
                const mappingKey = mapping.toLowerCase().trim();
                
                if (vendorSpecMap[mappingKey]) {
                  matchedValue = vendorSpecMap[mappingKey];
                  break; // Stop after first match
                }
              }
            }
            
            if (matchedValue) {
              const rawValue = matchedValue;
                
              // Sanitize value by removing unit if present in the value
              let sanitizedValue = rawValue;
              if (catSpec.unit) {
                const unitPattern = new RegExp(`\\s*${catSpec.unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
                sanitizedValue = rawValue.replace(unitPattern, '').trim();
              }

              // Upsert specification value
              await pool.query(`
                INSERT INTO component_specification_values (component_id, category_spec_id, spec_value)
                VALUES ($1, $2, $3)
                ON CONFLICT (component_id, category_spec_id)
                DO UPDATE SET 
                  spec_value = EXCLUDED.spec_value,
                  updated_at = CURRENT_TIMESTAMP
              `, [comp.component_id, catSpec.id, sanitizedValue]);

              specsUpdated = true;
            }
          }

          if (specsUpdated) {
            updatedCount++;
            console.log(`\x1b[32m[SUCCESS]\x1b[0m \x1b[33m[SpecsUpdate]\x1b[0m   Updated specifications for ${comp.part_number}`);
          } else {
            skippedCount++;
            console.log(`\x1b[90m[DEBUG]\x1b[0m \x1b[33m[SpecsUpdate]\x1b[0m   No spec mappings matched for ${comp.part_number}`);
          }
        } else {
          skippedCount++;
          console.log(`\x1b[90m[DEBUG]\x1b[0m \x1b[33m[SpecsUpdate]\x1b[0m   No vendor data found for ${comp.part_number}`);
        }

        // Add delay to avoid rate limiting (Digikey: 1000 calls/day = ~40/hour = 1.5s per call safe)
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        // Check for rate limit error
        if (error.message === 'RATE_LIMIT_EXCEEDED') {
          console.log(`\x1b[31m[ERROR]\x1b[0m \x1b[33m[SpecsUpdate]\x1b[0m ABORTED: Rate limit exceeded after ${updatedCount + skippedCount} components`);
          return res.status(429).json({
            success: false,
            error: 'RATE_LIMIT_EXCEEDED',
            message: error.vendorMessage || 'API rate limit exceeded. Please try again later.',
            updatedCount,
            skippedCount,
            totalChecked: updatedCount + skippedCount + 1,
          });
        }
        
        console.log(`\x1b[31m[ERROR]\x1b[0m \x1b[33m[SpecsUpdate]\x1b[0m   Error processing ${comp.part_number}: ${error.message}`);
        errors.push({
          partNumber: comp.part_number,
          sku: comp.sku,
          distributor: comp.distributor_name,
          error: error.message,
        });
        skippedCount++;
      }
    }

    console.log(`\x1b[32m[SUCCESS]\x1b[0m \x1b[33m[SpecsUpdate]\x1b[0m Bulk update complete: ${updatedCount} updated, ${skippedCount} skipped, ${errors.length} errors`);

    res.json({
      success: true,
      message: `Bulk specification update complete: ${updatedCount} updated, ${skippedCount} skipped, ${errors.length} errors`,
      updatedCount,
      skippedCount,
      totalChecked: componentsResult.rows.length,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error('Error in bulk specification update:', error);
    next(error);
  }
};

// Bulk update distributor information by searching with manufacturer part numbers
export const bulkUpdateDistributors = async (req, res, next) => {
  try {
    const { limit } = req.query;
    const maxLimit = limit ? parseInt(limit) : null;

    console.log(`\x1b[36m[INFO]\x1b[0m \x1b[33m[DistributorUpdate]\x1b[0m Starting bulk distributor update${maxLimit ? ` (limit: ${maxLimit})` : ''}`);

    // Get all components with manufacturer part numbers that DON'T already have distributor info
    // Skip components that already have at least one distributor entry
    let query = `
      SELECT 
        c.id as component_id,
        c.part_number,
        c.manufacturer_pn,
        m.name as manufacturer_name
      FROM components c
      LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
      WHERE c.manufacturer_pn IS NOT NULL
      AND c.manufacturer_pn != ''
      AND NOT EXISTS (
        SELECT 1 FROM distributor_info di 
        WHERE di.component_id = c.id 
        AND di.sku IS NOT NULL 
        AND di.sku != ''
      )
      ORDER BY c.part_number
    `;

    if (maxLimit) {
      query += ` LIMIT ${maxLimit}`;
    }

    const componentsResult = await pool.query(query);
    const totalComponents = componentsResult.rows.length;
    console.log(`\x1b[36m[INFO]\x1b[0m \x1b[33m[DistributorUpdate]\x1b[0m Found ${totalComponents} components to process`);

    let updatedCount = 0;
    let skippedCount = 0;
    const errors = [];

    // Get distributor IDs for supported distributors
    const distributorsResult = await pool.query(`
      SELECT id, name FROM distributors WHERE name IN ('Digikey', 'Mouser', 'Arrow', 'Newark')
    `);
    const distributorMap = {};
    distributorsResult.rows.forEach(d => {
      distributorMap[d.name.toLowerCase()] = d.id;
    });

    // Update each component
    for (let i = 0; i < componentsResult.rows.length; i++) {
      const comp = componentsResult.rows[i];
      const progress = Math.round(((i + 1) / totalComponents) * 100);
      
      try {
        console.log(`\x1b[36m[INFO]\x1b[0m \x1b[33m[DistributorUpdate]\x1b[0m [${progress}%] Processing ${i + 1}/${totalComponents}: ${comp.part_number} (${comp.manufacturer_pn})`);
        
        // Search all vendors for this manufacturer part number
        const allResults = [];

        // Search Digikey
        try {
          console.log(`\x1b[90m[DEBUG]\x1b[0m \x1b[33m[DistributorUpdate]\x1b[0m   Searching Digikey for: ${comp.manufacturer_pn}`);
          const digikeyResult = await digikeyService.searchPart(comp.manufacturer_pn);
          if (digikeyResult.results && digikeyResult.results.length > 0) {
            // Filter for exact manufacturer part number match
            const exactMatches = digikeyResult.results.filter(r => 
              r.manufacturerPartNumber && 
              r.manufacturerPartNumber.toLowerCase() === comp.manufacturer_pn.toLowerCase(),
            );
            console.log(`\x1b[90m[DEBUG]\x1b[0m \x1b[33m[DistributorUpdate]\x1b[0m   Digikey: ${digikeyResult.results.length} results, ${exactMatches.length} exact matches`);
            exactMatches.forEach(result => {
              allResults.push({
                source: 'digikey',
                sku: result.partNumber,
                url: result.productUrl,
                moq: result.minimumOrderQuantity || 1,
                stock: result.stock || 0,
              });
            });
          } else if (digikeyResult.error) {
            console.log(`\x1b[33m[WARN]\x1b[0m \x1b[33m[DistributorUpdate]\x1b[0m   Digikey API error: ${digikeyResult.error}`);
          } else {
            console.log('\x1b[90m[DEBUG]\x1b[0m \x1b[33m[DistributorUpdate]\x1b[0m   Digikey: No results found');
          }
        } catch (error) {
          // Re-throw rate limit errors to abort the entire operation
          if (error.message === 'RATE_LIMIT_EXCEEDED') {
            console.log(`\x1b[31m[ERROR]\x1b[0m \x1b[33m[DistributorUpdate]\x1b[0m   Digikey RATE LIMIT EXCEEDED: ${error.vendorMessage || error.message}`);
            throw error;
          }
          console.log(`\x1b[33m[WARN]\x1b[0m \x1b[33m[DistributorUpdate]\x1b[0m   Digikey search failed: ${error.message}`);
        }

        // Search Mouser
        try {
          console.log(`\x1b[90m[DEBUG]\x1b[0m \x1b[33m[DistributorUpdate]\x1b[0m   Searching Mouser for: ${comp.manufacturer_pn}`);
          const mouserResult = await mouserService.searchPart(comp.manufacturer_pn);
          if (mouserResult.results && mouserResult.results.length > 0) {
            // Filter for exact manufacturer part number match
            const exactMatches = mouserResult.results.filter(r => 
              r.manufacturerPartNumber && 
              r.manufacturerPartNumber.toLowerCase() === comp.manufacturer_pn.toLowerCase(),
            );
            console.log(`\x1b[90m[DEBUG]\x1b[0m \x1b[33m[DistributorUpdate]\x1b[0m   Mouser: ${mouserResult.results.length} results, ${exactMatches.length} exact matches`);
            exactMatches.forEach(result => {
              allResults.push({
                source: 'mouser',
                sku: result.partNumber,
                url: result.productUrl,
                moq: result.minimumOrderQuantity || 1,
                stock: result.stock || 0,
              });
            });
          } else if (mouserResult.error) {
            console.log(`\x1b[33m[WARN]\x1b[0m \x1b[33m[DistributorUpdate]\x1b[0m   Mouser API error: ${mouserResult.error}`);
          } else {
            console.log('\x1b[90m[DEBUG]\x1b[0m \x1b[33m[DistributorUpdate]\x1b[0m   Mouser: No results found');
          }
        } catch (error) {
          // Re-throw rate limit errors to abort the entire operation
          if (error.message === 'RATE_LIMIT_EXCEEDED') {
            console.log(`\x1b[31m[ERROR]\x1b[0m \x1b[33m[DistributorUpdate]\x1b[0m   Mouser RATE LIMIT EXCEEDED: ${error.vendorMessage || error.message}`);
            throw error;
          }
          console.log(`\x1b[33m[WARN]\x1b[0m \x1b[33m[DistributorUpdate]\x1b[0m   Mouser search failed: ${error.message}`);
        }

        // If we have results, pick the best one per distributor (lowest MOQ)
        if (allResults.length > 0) {
          console.log(`\x1b[32m[SUCCESS]\x1b[0m \x1b[33m[DistributorUpdate]\x1b[0m   Found ${allResults.length} distributor entries for ${comp.part_number}`);
          // Group by source
          const bySource = {};
          allResults.forEach(result => {
            if (!bySource[result.source]) {
              bySource[result.source] = [];
            }
            bySource[result.source].push(result);
          });

          // For each source, pick the one with lowest MOQ
          let distributorsUpdated = false;
          for (const [source, results] of Object.entries(bySource)) {
            // Sort by MOQ ascending
            results.sort((a, b) => a.moq - b.moq);
            const bestResult = results[0];

            const distributorId = distributorMap[source.toLowerCase()];
            if (distributorId) {
              // Upsert distributor info
              await pool.query(`
                INSERT INTO distributor_info (component_id, distributor_id, sku, url, in_stock, stock_quantity)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (component_id, distributor_id)
                DO UPDATE SET 
                  sku = EXCLUDED.sku,
                  url = EXCLUDED.url,
                  in_stock = EXCLUDED.in_stock,
                  stock_quantity = EXCLUDED.stock_quantity,
                  updated_at = CURRENT_TIMESTAMP
              `, [
                comp.component_id,
                distributorId,
                bestResult.sku,
                bestResult.url,
                bestResult.stock > 0,
                bestResult.stock,
              ]);

              distributorsUpdated = true;
            }
          }

          if (distributorsUpdated) {
            updatedCount++;
            console.log(`\x1b[32m[SUCCESS]\x1b[0m \x1b[33m[DistributorUpdate]\x1b[0m   Updated distributors for ${comp.part_number}`);
          } else {
            skippedCount++;
            console.log(`\x1b[90m[DEBUG]\x1b[0m \x1b[33m[DistributorUpdate]\x1b[0m   No distributor updates for ${comp.part_number}`);
          }
        } else {
          skippedCount++;
          console.log(`\x1b[90m[DEBUG]\x1b[0m \x1b[33m[DistributorUpdate]\x1b[0m   No vendor matches found for ${comp.part_number}`);
        }

        // Add delay to avoid rate limiting (Mouser: ~30 calls/min)
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        // Check for rate limit error
        if (error.message === 'RATE_LIMIT_EXCEEDED') {
          console.log(`\x1b[31m[ERROR]\x1b[0m \x1b[33m[DistributorUpdate]\x1b[0m ABORTED: Rate limit exceeded after ${updatedCount + skippedCount} components`);
          return res.status(429).json({
            success: false,
            error: 'RATE_LIMIT_EXCEEDED',
            message: error.vendorMessage || 'API rate limit exceeded. Please try again later.',
            updatedCount,
            skippedCount,
            totalChecked: updatedCount + skippedCount + 1,
          });
        }
        
        console.log(`\x1b[31m[ERROR]\x1b[0m \x1b[33m[DistributorUpdate]\x1b[0m   Error processing ${comp.part_number}: ${error.message}`);
        errors.push({
          partNumber: comp.part_number,
          manufacturerPn: comp.manufacturer_pn,
          error: error.message,
        });
        skippedCount++;
      }
    }

    console.log(`\x1b[32m[SUCCESS]\x1b[0m \x1b[33m[DistributorUpdate]\x1b[0m Bulk update complete: ${updatedCount} updated, ${skippedCount} skipped, ${errors.length} errors`);

    res.json({
      success: true,
      message: `Bulk distributor update complete: ${updatedCount} updated, ${skippedCount} skipped, ${errors.length} errors`,
      updatedCount,
      skippedCount,
      totalChecked: componentsResult.rows.length,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error('Error in bulk distributor update:', error);
    next(error);
  }
};

// Update component approval status
export const updateComponentApproval = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, user_id } = req.body; // action: 'approve', 'deny', 'send_to_review', 'send_to_prototype'
    
    if (!action || !user_id) {
      return res.status(400).json({ error: 'Action and user_id are required' });
    }

    // Check permissions based on action
    const userRole = req.user?.role;
    if (action === 'approve' || action === 'deny') {
      // Only approvers and admins can approve/deny
      if (userRole !== 'approver' && userRole !== 'admin') {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'Approver or admin access required to approve or deny parts',
        });
      }
    } else if (action === 'send_to_review' || action === 'send_to_prototype') {
      // Anyone with write access can send to review or prototype
      if (userRole === 'read-only') {
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'Write access required to send parts to review or prototype',
        });
      }
    }

    // Check if component exists
    const componentCheck = await pool.query(
      'SELECT id, approval_status FROM components WHERE id = $1',
      [id],
    );
    
    if (componentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Component not found' });
    }

    const component = componentCheck.rows[0];
    let newApprovalStatus;

    // Determine new approval status based on action
    switch (action) {
      case 'approve':
        newApprovalStatus = 'approved';
        break;
      case 'deny':
        newApprovalStatus = 'archived';
        break;
      case 'send_to_review':
        newApprovalStatus = 'pending review';
        break;
      case 'send_to_prototype':
        newApprovalStatus = 'experimental';
        break;
      default:
        return res.status(400).json({ error: 'Invalid action. Must be approve, deny, send_to_review, or send_to_prototype' });
    }

    // Update the component's approval status in the database
    await pool.query(`
      UPDATE components
      SET approval_status = $1,
          approval_user_id = $2,
          approval_date = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [newApprovalStatus, user_id, id]);

    // Log approval action to activity_log
    const activityTypeMap = {
      'approve': 'approval_approved',
      'deny': 'approval_denied',
      'send_to_review': 'approval_sent_to_review',
      'send_to_prototype': 'approval_sent_to_prototype',
    };

    // Get component info for activity log
    try {
      const componentInfo = await pool.query(`
        SELECT c.part_number, c.description, cat.name as category_name
        FROM components c
        LEFT JOIN component_categories cat ON c.category_id = cat.id
        WHERE c.id = $1
      `, [id]);

      await pool.query(`
        INSERT INTO activity_log (component_id, user_id, part_number, activity_type, details)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        id,
        req.user?.id || null,
        componentInfo.rows[0]?.part_number,
        activityTypeMap[action],
        JSON.stringify({
          description: componentInfo.rows[0]?.description,
          category_name: componentInfo.rows[0]?.category_name,
          action: action,
          old_status: component.approval_status,
          new_status: newApprovalStatus,
          user_id: user_id,
        }),
      ]);
    } catch (logError) {
      console.error('Failed to log approval activity:', logError.message);
    }

    // Fetch complete component with joined data
    const fullComponent = await pool.query(`
      SELECT 
        c.*,
        cat.name as category_name,
        cat.prefix as category_prefix,
        m.name as manufacturer_name,
        u.username as approval_user_name,
        get_part_type(c.category_id, c.sub_category1, c.sub_category2, c.sub_category3, c.sub_category4) as part_type,
        created_at(c.id) as created_at
      FROM components c
      LEFT JOIN component_categories cat ON c.category_id = cat.id
      LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
      LEFT JOIN users u ON c.approval_user_id = u.id
      WHERE c.id = $1
    `, [id]);

    res.json(fullComponent.rows[0]);
  } catch (error) {
    console.error(`\x1b[31m[ERROR]\x1b[0m \x1b[36m[ComponentController]\x1b[0m Error in updateComponentApproval: ${error.message}`);
    next(error);
  }
};
