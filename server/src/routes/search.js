import express from 'express';
import * as searchController from '../controllers/searchController.js';

const router = express.Router();

// Search Digikey
router.post('/digikey', searchController.searchDigikey);

// Search Mouser
router.post('/mouser', searchController.searchMouser);

// Search both vendors
router.post('/all', searchController.searchAllVendors);

// SamacSys Library Loader
router.post('/library/samacsys/search', searchController.searchSamacSysParts);
router.post('/library/samacsys', searchController.downloadSamacSysLibrary);
router.get('/library/samacsys/auth-status', searchController.checkSamacSysAuth);
router.post('/library/samacsys/login', searchController.loginSamacSys);
router.post('/library/samacsys/logout', searchController.logoutSamacSys);

// Legacy footprint endpoints (deprecated)
router.post('/footprint/ultra-librarian', searchController.downloadUltraLibrarianFootprint);
router.post('/footprint/snapeda', searchController.downloadSnapEDAFootprint);

// Add vendor part to library
router.post('/add-to-library', searchController.addVendorPartToLibrary);

export default router;
