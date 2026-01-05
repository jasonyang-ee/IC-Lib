import axios from 'axios';
import pool from '../config/database.js';
import * as digikeyService from '../services/digikeyService.js';
import * as mouserService from '../services/mouserService.js';
import * as footprintService from '../services/footprintService.js';

export const searchDigikey = async (req, res, next) => {
  try {
    const { partNumber } = req.body;

    if (!partNumber) {
      return res.status(400).json({ error: 'Part number is required' });
    }

    const result = await digikeyService.searchPart(partNumber);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const searchMouser = async (req, res, next) => {
  try {
    const { partNumber } = req.body;

    if (!partNumber) {
      return res.status(400).json({ error: 'Part number is required' });
    }

    const result = await mouserService.searchPart(partNumber);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const searchAllVendors = async (req, res, next) => {
  try {
    const { partNumber } = req.body;

    if (!partNumber) {
      return res.status(400).json({ error: 'Part number is required' });
    }

    const [digikeyResult, mouserResult] = await Promise.allSettled([
      digikeyService.searchPart(partNumber),
      mouserService.searchPart(partNumber),
    ]);

    res.json({
      digikey: digikeyResult.status === 'fulfilled' ? digikeyResult.value : null,
      mouser: mouserResult.status === 'fulfilled' ? mouserResult.value : null,
    });
  } catch (error) {
    next(error);
  }
};

export const downloadUltraLibrarianFootprint = async (req, res, next) => {
  try {
    const { partNumber, componentId } = req.body;

    if (!partNumber) {
      return res.status(400).json({ error: 'Part number is required' });
    }

    const result = await footprintService.downloadFromUltraLibrarian(partNumber, componentId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const downloadSnapEDAFootprint = async (req, res, next) => {
  try {
    const { partNumber, componentId } = req.body;

    if (!partNumber) {
      return res.status(400).json({ error: 'Part number is required' });
    }

    const result = await footprintService.downloadFromSnapEDA(partNumber, componentId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const addVendorPartToLibrary = async (req, res, next) => {
  try {
    const {
      partNumber,
      manufacturerPartNumber,
      manufacturer,
      description,
      datasheet,
      packageType,
      series,
      category,
      specifications,
      source, // 'digikey' or 'mouser'
      pricing,
      stock,
      productUrl,
      minimumOrderQuantity,
      allDistributors, // Array of all selected distributors
    } = req.body;

    if (!manufacturerPartNumber) {
      return res.status(400).json({ error: 'Manufacturer part number is required' });
    }

    // Check if part already exists in library
    const existingPart = await pool.query(
      'SELECT id, part_number FROM components WHERE manufacturer_pn = $1',
      [manufacturerPartNumber],
    );

    if (existingPart.rows.length > 0) {
      return res.status(409).json({ 
        error: 'Part already exists in library',
        componentId: existingPart.rows[0].id,
        partNumber: existingPart.rows[0].part_number,
      });
    }

    // Get or create manufacturer
    let manufacturerId = null;
    if (manufacturer && manufacturer !== 'N/A') {
      const manufacturerCheck = await pool.query(
        'SELECT id FROM manufacturers WHERE LOWER(name) = LOWER($1)',
        [manufacturer],
      );

      if (manufacturerCheck.rows.length > 0) {
        manufacturerId = manufacturerCheck.rows[0].id;
      } else {
        // Create new manufacturer
        const newManufacturer = await pool.query(
          'INSERT INTO manufacturers (name) VALUES ($1) RETURNING id',
          [manufacturer],
        );
        manufacturerId = newManufacturer.rows[0].id;
      }
    }

    // Process multiple distributors if provided
    const distributorData = [];
    
    if (allDistributors && Array.isArray(allDistributors) && allDistributors.length > 0) {
      // Process each distributor from the selection
      for (const dist of allDistributors) {
        const distributorResult = await pool.query(
          'SELECT id FROM distributors WHERE LOWER(name) = LOWER($1)',
          [dist.source === 'digikey' ? 'Digikey' : 'Mouser'],
        );
        
        if (distributorResult.rows.length > 0) {
          distributorData.push({
            id: distributorResult.rows[0].id,
            source: dist.source,
            sku: dist.sku,
            url: dist.productUrl,
            pricing: dist.pricing,
            stock: dist.stock,
            minimumOrderQuantity: dist.minimumOrderQuantity,
          });
        }
      }
    } else {
      // Fallback to single distributor (backward compatibility)
      const distributorResult = await pool.query(
        'SELECT id FROM distributors WHERE LOWER(name) = LOWER($1)',
        [source === 'digikey' ? 'Digikey' : 'Mouser'],
      );
      const distributorId = distributorResult.rows.length > 0 ? distributorResult.rows[0].id : null;
      
      if (distributorId) {
        distributorData.push({
          id: distributorId,
          source,
          sku: partNumber,
          url: productUrl,
          pricing,
          stock,
          minimumOrderQuantity,
        });
      }
    }

    // Return prepared data for frontend to use
    res.json({
      vendorData: {
        manufacturerId,
        manufacturerName: manufacturer,
        manufacturerPartNumber,
        description,
        datasheet,
        packageType,
        series,
        category,
        specifications: specifications || {},
        distributors: distributorData, // Now returns array of all distributors
      },
    });
  } catch (error) {
    console.error('Error preparing vendor part data:', error);
    next(error);
  }
};
