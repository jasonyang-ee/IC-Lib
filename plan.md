## Feature
1. The camera implementation for digikey and mouser barcode scanning is very slow. It would see the barcode but need like 1 full minute to aim and get a narrawly zoomed in view of the barcode to work. Can you check online to see if there is a better webcam barcode scanning library for datamatrix and code128 barcodes? Preferably one that works well with react and vite.
2. For the database migration tracking (version), currently it is using a seperated versioning system. Can you make migration versioning to be in sync with the application versioning? So when we release v1.6.0, the database migration version should also be v1.6.0. This way we can easier track which database version is used for which application version. Currently the database is recording as 3.0.0 while the application is at 1.6.0 which is confusing.
3. At some point, we may have tried to process .xml file for CAD schematic files, but this is a mistake, please stop processing .xml files as CAD schematic files. We only want to process .olb file for schematic symbol file. Please update the file processing logic to only accept .olb files for schematic symbols and ignore .xml files.
4. In parts library page, add mode for new component, it didn't show the CAD file section like edit mode. Please make sure the CAD file section is also shown in new component mode so user can upload CAD files when creating a new component.

## File Management (the core of this project)
1. Since now we support multiple CAD files for each CAD type (footprint, schematic symbol, 3d model). Please change the database schema to allow a list of file names to be stored in each component details. This should be a data list. Please reference to https://github.com/jasonyang-ee/EMD/blob/main/client/src/pages/AdminSettings.jsx. This EMD repo admin setting for the metadata fields setting has those `+` symbol for user to add multiple entries. Please implement similar logic for the CAD files section in parts library page so user can add multiple CAD files for each CAD type.
2. We also need to link the uploaded CAD files to the component in the database record, that is to automaticlly insert the uploaded CAD file names into the component details when user upload CAD files in parts library page. Please implement this logic.
3. We have the feature of renaming CAD file name to MPN (manufaturer part number) by one clicking. Please expend this to add a button for renaming into `Package` name as well. So user can rename the CAD file name to either MPN or Package name by one clicking.
4. For the file management, we currenlty has nested folders for CAD files using manufacturer parts number (MPN) as folder name. This will cause issue with OrCAD to read the folder as psmpath setting is a flat folder structure. ALL CAD files should be stored in a flat folder structure without nested folders. This is very challanging to manage and is the core reason why we started to make this project. Please make sure we never have colliding file names for the CAD files since they are all stored in a flat folder structure.
5.  When we click rename using (MPN or Package), please double check if we would end up with colliding file names in the flat folder structure. If there is a potential file name collision, we should alert the user and prevent the renaming action to avoid overwriting existing files.
6. Multiple parts can sepcify the same CAD file, for example, multiple components can share the same footprint file. In this case, the logic should flow from the component details to the CAD file, that is, when we have footprint details stored in the component details, we should automatically link those details to the corresponding CAD file record in the database.
7. Rename short cut of MPN and Package name should only be shown when clicked `Rename` button, it should not be always shown. Please update the UI logic to only show the rename shortcut buttons when user clicks the `Rename` button for a specific CAD file.
8. In fact, we should unify the CAD files section and the component details section that tracks the CAD file details. Since they are closely related, it would be better to have them in the same section. Please update the UI to combine the CAD files section and the component details section into a single unified section for better user experience and easier management of CAD file details.
9. Multiple components can share the same CAD file, and when we update the CAD file details in one component, it should automatically update the linked CAD file details for all other components that share the same CAD file. Please implement this logic to ensure that any updates to CAD file details are reflected across all components that share the same CAD file. But, logically, this is not a featured for a single component, so this is a feature to be implemented in the File Library page. Please remove the renaming or file editing capability from the parts library page and move all those logic to the file library page. This is to avoid accidentally changing the CAD file details when user is just trying to edit the component details in parts library page. The file management and editing should be done in the file library page, and the parts library page should only link to the CAD files without allowing direct editing of the CAD file details in the parts library page.
10. Please add a new logic to allow user to link to other CAD file (no rename process, just re-link to a different CAD file) for a specific CAD type. For example, user can link to a different footprint file for the same component without going through the renaming process. This will provide more flexibility for users to manage their CAD files and easily switch between different CAD files for the same component when needed. This is specifically a component details managemnet feature, so it should be only in the parts library page when using the `add` or `edit` mode.
11. When user upload a CAD file, we should check if there is already an existing CAD file with the same name in the flat folder structure. If there is a file name collision, we should alert the user and prevent the upload to avoid overwriting existing files. Please implement this logic to ensure that all CAD files have unique names in the flat folder structure and to prevent accidental overwriting of existing files.

## Bug Fix
1. User table schema is incorrect, please make sure the server start self check is updated since we have migrated to use UUID v7 where we don't need created_at anymore. Those are parsed from the UUID itself.

## Server Log
[WARN] [AuthService] Users table exists but schema is incomplete
[WARN] [AuthService] Missing columns: created_at
[ERROR] [AuthService] Users table schema is invalid
[ERROR] [AuthService] Please run database/init-users.sql manually or drop the table to auto-recreate
[INFO] [Server] Running on port 3500
[INFO] [Server] Environment: development

OK Backend started (PID: 695)

> ic-lib-client@1.6.0 build
> vite build

vite v7.3.0 building client environment for production...
✓ 1839 modules transformed.
dist/index.html                           0.86 kB │ gzip:   0.45 kB
dist/assets/index-B2WBLjv6.css           72.04 kB │ gzip:  11.47 kB
dist/assets/ui-vendor-CNN-oZpJ.js        14.33 kB │ gzip:   5.24 kB
dist/assets/query-vendor-DVzeiQMA.js     42.34 kB │ gzip:  13.23 kB
dist/assets/react-vendor-CFD1F5_M.js     65.40 kB │ gzip:  21.93 kB
dist/assets/index-CeXnYVCK.js         1,455.76 kB │ gzip: 330.29 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 2.98s

> ic-lib-client@1.6.0 dev
> vite


  VITE v7.3.0  ready in 139 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
GET /api/auth/verify 401 4.262 ms - 46
GET /api/auth/verify 401 1.875 ms - 46
OK Frontend started (PID: 715)

Servers running:
  Frontend: http://localhost:5173
  Backend:  http://localhost:3500

POST /api/auth/login 200 61.943 ms - 336
GET /api/dashboard/category-breakdown 200 8.573 ms - 505
GET /api/dashboard/db-info 304 9.117 ms - -
GET /api/dashboard/extended-stats 200 13.696 ms - 319
GET /api/manufacturers 304 1.129 ms - -
GET /api/settings/categories 304 2.021 ms - -
GET /api/auth/users 200 3.367 ms - 391
Verifying database schema...
GET /api/settings/database/verify 304 3.474 ms - -