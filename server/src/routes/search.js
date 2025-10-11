import express from 'express';
import * as searchController from '../controllers/searchController.js';

const router = express.Router();

// Search Digikey
router.post('/digikey', searchController.searchDigikey);

// Search Mouser
router.post('/mouser', searchController.searchMouser);

// Search both vendors
router.post('/all', searchController.searchAllVendors);

// Download footprint from Ultra Librarian
router.post('/footprint/ultra-librarian', searchController.downloadUltraLibrarianFootprint);

// Download footprint from SnapEDA
router.post('/footprint/snapeda', searchController.downloadSnapEDAFootprint);

// Add vendor part to library
router.post('/add-to-library', searchController.addVendorPartToLibrary);

export default router;
