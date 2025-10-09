import pool from '../config/database.js';

export const getAllComponents = async (req, res, next) => {
  try {
    const { category, search } = req.query;
    
    let query = `
      SELECT c.*, cat.name as category_name, m.name as manufacturer_name
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
      query += ` AND (c.part_number ILIKE $${paramCount} OR c.description ILIKE $${paramCount} OR c.manufacturer_pn ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
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
      SELECT c.*, cat.name as category_name, m.name as manufacturer_name, m.website as manufacturer_website
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
      description,
      value,
      pcb_footprint,
      package_size,
      datasheet_url,
      status,
      notes
    } = req.body;

    // Start transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Convert empty strings to NULL for UUID fields
      const validManufacturerId = manufacturer_id && manufacturer_id.trim() !== '' ? manufacturer_id : null;
      const validCategoryId = category_id && String(category_id).trim() !== '' ? category_id : null;

      // Validate category_id is required
      if (!validCategoryId) {
        throw new Error('category_id is required');
      }

      // Get manufacturer name if manufacturer_id is provided
      let manufacturerName = null;
      if (validManufacturerId) {
        const mfgResult = await client.query(
          'SELECT name FROM manufacturers WHERE id = $1',
          [validManufacturerId]
        );
        if (mfgResult.rows.length > 0) {
          manufacturerName = mfgResult.rows[0].name;
        }
      }

      // Temporarily disable triggers to prevent infinite loop
      await client.query('SET LOCAL session_replication_role = replica');

      // Insert directly into components table
      const insertQuery = `
        INSERT INTO components (
          category_id, part_number, manufacturer_id, manufacturer_pn,
          description, value, pcb_footprint, package_size,
          datasheet_url, status, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;

      const componentResult = await client.query(insertQuery, [
        validCategoryId, part_number, validManufacturerId, manufacturer_pn,
        description, value, pcb_footprint, package_size,
        datasheet_url, status || 'Active', notes
      ]);

      const component = componentResult.rows[0];

      // Manually sync to category table (triggers still disabled)
      const categoryResult = await client.query(
        'SELECT table_name FROM component_categories WHERE id = $1',
        [validCategoryId]
      );

      if (categoryResult.rows.length > 0) {
        const categoryTable = categoryResult.rows[0].table_name;
        
        // Insert into category table with manufacturer name (not UUID)
        const categoryInsertQuery = `
          INSERT INTO ${categoryTable} (
            part_number, manufacturer, manufacturer_pn, description, value,
            pcb_footprint, package_size, datasheet_url, company_part_status, notes, category_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (part_number) DO NOTHING
        `;
        
        await client.query(categoryInsertQuery, [
          part_number, manufacturerName, manufacturer_pn, description, value,
          pcb_footprint, package_size, datasheet_url, status || 'Active', notes, validCategoryId
        ]);
      }

      // Re-enable triggers AFTER all operations
      await client.query('SET LOCAL session_replication_role = DEFAULT');

      await client.query('COMMIT');
      
      // Fetch the complete component with joined data
      const fullComponent = await client.query(`
        SELECT c.*, cat.name as category_name, m.name as manufacturer_name
        FROM components c
        LEFT JOIN component_categories cat ON c.category_id = cat.id
        LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
        WHERE c.id = $1
      `, [component.id]);

      res.status(201).json(fullComponent.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating component:', error);
      throw error;
    } finally {
      client.release();
    }
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
      description,
      value,
      pcb_footprint,
      package_size,
      datasheet_url,
      status,
      notes
    } = req.body;

    // Convert empty strings to NULL for UUID fields
    const validManufacturerId = manufacturer_id && manufacturer_id.trim() !== '' ? manufacturer_id : null;
    const validCategoryId = category_id && String(category_id).trim() !== '' ? category_id : null;

    // Start transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get current component to check category change
      const currentComponent = await client.query(
        'SELECT category_id, part_number FROM components WHERE id = $1',
        [id]
      );

      if (currentComponent.rows.length === 0) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(404).json({ error: 'Component not found' });
      }

      const oldCategoryId = currentComponent.rows[0].category_id;
      const oldPartNumber = currentComponent.rows[0].part_number;
      const newCategoryId = validCategoryId || oldCategoryId;
      const newPartNumber = part_number || oldPartNumber;

      // Get manufacturer name if manufacturer_id is provided
      let manufacturerName = null;
      if (validManufacturerId) {
        const mfgResult = await client.query(
          'SELECT name FROM manufacturers WHERE id = $1',
          [validManufacturerId]
        );
        if (mfgResult.rows.length > 0) {
          manufacturerName = mfgResult.rows[0].name;
        }
      }

      // Disable triggers to prevent infinite loop
      await client.query('SET LOCAL session_replication_role = replica');

      // Update components table
      const result = await client.query(`
        UPDATE components SET
          category_id = COALESCE($1, category_id),
          part_number = COALESCE($2, part_number),
          manufacturer_id = $3,
          manufacturer_pn = COALESCE($4, manufacturer_pn),
          description = COALESCE($5, description),
          value = COALESCE($6, value),
          pcb_footprint = COALESCE($7, pcb_footprint),
          package_size = COALESCE($8, package_size),
          datasheet_url = COALESCE($9, datasheet_url),
          status = COALESCE($10, status),
          notes = COALESCE($11, notes),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $12
        RETURNING *
      `, [
        validCategoryId, part_number, validManufacturerId, manufacturer_pn,
        description, value, pcb_footprint, package_size,
        datasheet_url, status, notes, id
      ]);

      // Manually sync to category tables (triggers still disabled)
      if (oldCategoryId) {
        // If category changed, delete from old category table
        if (validCategoryId && validCategoryId !== oldCategoryId) {
          const oldCategoryResult = await client.query(
            'SELECT table_name FROM component_categories WHERE id = $1',
            [oldCategoryId]
          );
          if (oldCategoryResult.rows.length > 0) {
            const oldCategoryTable = oldCategoryResult.rows[0].table_name;
            await client.query(`DELETE FROM ${oldCategoryTable} WHERE part_number = $1`, [oldPartNumber]);
          }
        }

        // Update or insert into new/same category table
        const categoryResult = await client.query(
          'SELECT table_name FROM component_categories WHERE id = $1',
          [newCategoryId]
        );

        if (categoryResult.rows.length > 0) {
          const categoryTable = categoryResult.rows[0].table_name;
          
          // Try update first, then insert if not exists
          const updateResult = await client.query(`
            UPDATE ${categoryTable} SET
              manufacturer = COALESCE($1, manufacturer),
              manufacturer_pn = COALESCE($2, manufacturer_pn),
              description = COALESCE($3, description),
              value = COALESCE($4, value),
              pcb_footprint = COALESCE($5, pcb_footprint),
              package_size = COALESCE($6, package_size),
              datasheet_url = COALESCE($7, datasheet_url),
              company_part_status = COALESCE($8, company_part_status),
              notes = COALESCE($9, notes),
              updated_at = CURRENT_TIMESTAMP
            WHERE part_number = $10
          `, [
            manufacturerName, manufacturer_pn, description, value,
            pcb_footprint, package_size, datasheet_url, status, notes, newPartNumber
          ]);

          // If no rows updated, insert new record
          if (updateResult.rowCount === 0) {
            await client.query(`
              INSERT INTO ${categoryTable} (
                part_number, manufacturer, manufacturer_pn, description, value,
                pcb_footprint, package_size, datasheet_url, company_part_status, notes, category_id
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
              ON CONFLICT (part_number) DO NOTHING
            `, [
              newPartNumber, manufacturerName, manufacturer_pn, description, value,
              pcb_footprint, package_size, datasheet_url, status || 'Active', notes, newCategoryId
            ]);
          }
        }
      }

      // Re-enable triggers AFTER all operations
      await client.query('SET LOCAL session_replication_role = DEFAULT');

      await client.query('COMMIT');

      // Fetch the complete component with joined data
      const fullComponent = await client.query(`
        SELECT c.*, cat.name as category_name, m.name as manufacturer_name
        FROM components c
        LEFT JOIN component_categories cat ON c.category_id = cat.id
        LEFT JOIN manufacturers m ON c.manufacturer_id = m.id
        WHERE c.id = $1
      `, [id]);

      res.json(fullComponent.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error updating component:', error);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error in updateComponent:', error);
    next(error);
  }
};

export const deleteComponent = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // First, get the component to check if it exists and has a valid category_id
    const componentCheck = await pool.query(
      'SELECT id, part_number, category_id FROM components WHERE id = $1',
      [id]
    );

    if (componentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Component not found' });
    }

    const component = componentCheck.rows[0];

    // Always use transaction with triggers disabled to prevent sync issues
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Disable triggers to prevent sync errors
      await client.query('SET LOCAL session_replication_role = replica');
      
      // Delete from related tables first
      await client.query('DELETE FROM component_specifications WHERE component_id = $1', [id]);
      await client.query('DELETE FROM distributor_info WHERE component_id = $1', [id]);
      await client.query('DELETE FROM inventory WHERE component_id = $1', [id]);
      await client.query('DELETE FROM footprint_sources WHERE component_id = $1', [id]);
      
      // Delete the component
      await client.query('DELETE FROM components WHERE id = $1', [id]);
      
      // Manually delete from category table if category exists
      if (component.category_id && component.part_number) {
        const categoryResult = await client.query(
          'SELECT table_name FROM component_categories WHERE id = $1',
          [component.category_id]
        );
        
        if (categoryResult.rows.length > 0) {
          const categoryTable = categoryResult.rows[0].table_name;
          await client.query(`DELETE FROM ${categoryTable} WHERE part_number = $1`, [component.part_number]);
        }
      }
      
      // Re-enable triggers after all operations
      await client.query('SET LOCAL session_replication_role = DEFAULT');
      
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
    
    const result = await pool.query(
      'SELECT * FROM component_specifications WHERE component_id = $1 ORDER BY spec_name',
      [id]
    );

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

      // Delete existing specifications
      await client.query('DELETE FROM component_specifications WHERE component_id = $1', [id]);

      // Insert new specifications
      if (specifications && Array.isArray(specifications)) {
        for (const spec of specifications) {
          await client.query(`
            INSERT INTO component_specifications (component_id, spec_name, spec_value, unit)
            VALUES ($1, $2, $3, $4)
          `, [id, spec.name || spec.key, spec.value, spec.unit]);
        }
      }

      await client.query('COMMIT');

      const result = await client.query(
        'SELECT * FROM component_specifications WHERE component_id = $1',
        [id]
      );

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
              last_updated = CURRENT_TIMESTAMP
          WHERE component_id = $6 AND id = $7
        `, [
          dist.sku || dist.distributor_part_number || null, 
          dist.url || null,
          dist.price || null,
          dist.in_stock || false,
          dist.stock_quantity || 0,
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
            stock_quantity
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (component_id, distributor_id, sku) DO UPDATE
          SET url = EXCLUDED.url,
              price = EXCLUDED.price,
              in_stock = EXCLUDED.in_stock,
              stock_quantity = EXCLUDED.stock_quantity,
              last_updated = CURRENT_TIMESTAMP
        `, [
          id,
          dist.distributor_id,
          dist.sku,
          dist.url || null,
          dist.price || null,
          dist.in_stock || false,
          dist.stock_quantity || 0
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
