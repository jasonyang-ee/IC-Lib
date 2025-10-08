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
      mouserService.searchPart(partNumber)
    ]);

    res.json({
      digikey: digikeyResult.status === 'fulfilled' ? digikeyResult.value : null,
      mouser: mouserResult.status === 'fulfilled' ? mouserResult.value : null
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
