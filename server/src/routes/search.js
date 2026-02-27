import express from 'express';
import * as searchController from '../controllers/searchController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All search routes require authentication to prevent API quota abuse
// Search Digikey
router.post('/digikey', authenticate, searchController.searchDigikey);

// Search Mouser
router.post('/mouser', authenticate, searchController.searchMouser);

// Search both vendors
router.post('/all', authenticate, searchController.searchAllVendors);

// Download footprint from Ultra Librarian
router.post('/footprint/ultra-librarian', authenticate, searchController.downloadUltraLibrarianFootprint);

// Download footprint from SnapEDA
router.post('/footprint/snapeda', authenticate, searchController.downloadSnapEDAFootprint);

// Add vendor part to library
router.post('/add-to-library', authenticate, searchController.addVendorPartToLibrary);

export default router;
