## UI fix
- part library edit/add mode, CAD file upload has error
- delete of uploaded file is using default popup windows for confirmation, which is not consistent with the rest of the app, please use the same confirmation modal as used in other places in the app, such as component deletion
- the current database operation is not working as good work flow, init database is never used since full database reset will do it already, and server start will check and init database if not exist, so we can remove init database API and just keep full reset, and make it also do init if tables not exist, so it can be used for both first time setup and full reset. The load sample data has issue, please fix the issue and make it work with the new database schema, and also make it work only after database is initialized, since it relies on the tables to insert data. double check the logic of verify schema.
- part library page, view mode, the CAD files section has a unwanted line above the section title. please remove.
- Dashboard page, the component approval status section, please remove background color for each box, and just keep the colored circle, it will look cleaner.
- See if you can make the style of Library Status section and Components Approval status section on dashboard more consistent, currently they look quite different, maybe we can make them use the same card style, just with different colors and icons.
- Please make database info not using soo wide of space, can you fit both category distribution and database info tile in one row? I don't want those two section to be too wide.
- Please make the default theme to be dark mode for new installation.
- In the settings page, the ECO approval stages info note, please add info about approvers assignment and how it works, currently it only mentions the sequential approval but not the approver assignment which is also an important part of the ECO workflow.

## File handling
- I want to support renaming of uploaded files, since sometimes the original file name is not good for us, and we want to have a consistent naming convention for our library files, so please add the support for renaming the uploaded files, and also make sure the file name is sanitized to remove any special characters and spaces, and replace them with underscores, to avoid any issues with file handling in different operating systems. Please have the frontend updated to handle overwritting file name when user want to rename the file, and also make sure the backend is updated to handle the file renaming and also update the file path in the database accordingly.
- I now realized that there maybe multiple PCB footprint associated to a component, since some components have different footprint for density design (from ultra-librarian), so we need to support multiple footprint files for a component, and also make sure the file name is sanitized and also support renaming of the footprint files, and also make sure the backend is updated to handle the multiple footprint files and also update the file path in the database accordingly. (pasted image for example)
- The renaming should also work on the schematic symbol files.
- The pad file does not need renaming since it is very specific defined in the internal of footprint file, so we can just keep the original file name for pad files, and also make sure the backend is updated to not allow renaming of pad files.
- The pspice model file should also support renaming, since the original file name is usually not good for us, and we want to have a consistent naming convention for our library files, so please add the support for renaming the uploaded pspice model files, and also make sure the file name is sanitized to remove any special characters and spaces, and replace them with underscores, to avoid any issues with file handling in different operating systems. Please have the frontend updated to handle overwritting file name when user want to rename the pspice model file, and also make sure the backend is updated to handle the file renaming and also update the file path in the database accordingly.
- The renaming should have a quick button to apply manufacture part number as file name, since that is the most common case for us, so please add a quick button to apply manufacture part number as file name when user want to rename the file, and also make sure the backend is updated to handle the quick renaming and also update the file path in the database accordingly. This will retain the `-M` `-L` `-m` `-l` suffix in the original file name for different density of footprint, since that is important for us to identify the footprint for different density design.
- SamacSys has a messy file in .zip file, the structure is provided, as pasted image 2. There are multiple CAD file type, please use only the allegro folder for footprint and pad. And only use the Capture folder for schematic symbol. However, the schematic is a .xml file where it requires some addtional process, see next section for details.

## SamacSys schematic symbol processing
- https://www.samacsys.com/epw-file/
- https://github.com/olback/library-loader
- It is a epw file where it requires additional process to convert the file
- Please help me to do some major research to see if you can intergreate this feature into our system? I want to auto process the epw file and extract the OrCAD schematic symbol and footprint and pads from the epw file, and also make sure the file name is sanitized and also support renaming of the files, and also make sure the backend is updated to handle the file processing and also update the file path in the database accordingly. This will be a great feature for us to support more CAD file format and also make it easier for us to use the files from SamacSys which is a very popular source for PCB components CAD files.


## Error Log
> ic-lib-client@1.6.0 dev
> vite


  VITE v7.3.0  ready in 291 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
OK Frontend started (PID: 30430)

Servers running:
  Frontend: http://localhost:5173
  Backend:  http://localhost:3500

GET /api/auth/verify 401 2.598 ms - 70
GET /api/auth/verify 401 0.346 ms - 70
POST /api/auth/login 200 175.845 ms - 336
GET /api/dashboard/category-breakdown 200 8.348 ms - 505
GET /api/dashboard/db-info 200 7.993 ms - 89
GET /api/dashboard/extended-stats 200 14.121 ms - 319
GET /api/manufacturers 200 3.092 ms - 2
GET /api/projects 304 3.746 ms - -
GET /api/components?category=&search=&approvalStatus= 200 4.647 ms - 2
GET /api/categories 200 1.852 ms - -
GET /api/distributors 200 10.285 ms - 425
GET /api/components?category=019c3186-9e53-7745-bbb7-ea05011d3def&search=&approvalStatus= 200 3.673 ms - 2
GET /api/components?category=019c3186-9e53-797c-a6ea-65b7bc9d522c&search=&approvalStatus= 200 2.107 ms - 2
GET /api/file-library/stats 200 2.242 ms - 57
GET /api/file-library/type/footprint 200 1.548 ms - 56
GET /api/inventory 200 1.862 ms - 2
GET /api/inventory/alerts/low-stock 304 2.671 ms - -
GET /api/reports/component-summary 200 2.408 ms - -
GET /api/dashboard/activities/all 200 2.626 ms - 268
[error] [Auth] Get profile error: error: column "created_at" does not exist
    at F:\DevWeb\IC-Lib\server\node_modules\pg-pool\index.js:45:11
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async getProfile (file:///F:/DevWeb/IC-Lib/server/src/controllers/authController.js:509:20) {
  length: 173,
  severity: 'ERROR',
  code: '42703',
  detail: undefined,
  hint: 'Perhaps you meant to reference the column "users.created_by".',
  position: '90',
  internalPosition: undefined,
  internalQuery: undefined,
  where: undefined,
  schema: undefined,
  table: undefined,
  column: undefined,
  dataType: undefined,
  constraint: undefined,
  file: 'parse_relation.c',
  line: '3829',
  routine: 'errorMissingColumn'
}
GET /api/auth/profile 500 1.971 ms - 35
[error] [Auth] Get profile error: error: column "created_at" does not exist
    at F:\DevWeb\IC-Lib\server\node_modules\pg-pool\index.js:45:11
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async getProfile (file:///F:/DevWeb/IC-Lib/server/src/controllers/authController.js:509:20) {
  length: 173,
  severity: 'ERROR',
  code: '42703',
  detail: undefined,
  hint: 'Perhaps you meant to reference the column "users.created_by".',
  position: '90',
  internalPosition: undefined,
  internalQuery: undefined,
  where: undefined,
  schema: undefined,
  table: undefined,
  column: undefined,
  dataType: undefined,
  constraint: undefined,
  file: 'parse_relation.c',
  line: '3829',
  routine: 'errorMissingColumn'
}
GET /api/auth/profile 500 1.841 ms - 35
Get users error: error: column u.created_at does not exist
    at F:\DevWeb\IC-Lib\server\node_modules\pg-pool\index.js:45:11
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async getAllUsers (file:///F:/DevWeb/IC-Lib/server/src/controllers/authController.js:159:20) {
  length: 169,
  severity: 'ERROR',
  code: '42703',
  detail: undefined,
  hint: 'Perhaps you meant to reference the column "u.created_by".',
  position: '77',
  internalPosition: undefined,
  internalQuery: undefined,
  where: undefined,
  schema: undefined,
  table: undefined,
  column: undefined,
  dataType: undefined,
  constraint: undefined,
  file: 'parse_relation.c',
  line: '3829',
  routine: 'errorMissingColumn'
}
GET /api/auth/users 500 2.141 ms - 33
GET /api/settings/categories 200 2.165 ms - -
Get users error: error: column u.created_at does not exist
    at F:\DevWeb\IC-Lib\server\node_modules\pg-pool\index.js:45:11
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async getAllUsers (file:///F:/DevWeb/IC-Lib/server/src/controllers/authController.js:159:20) {
  length: 169,
  severity: 'ERROR',
  code: '42703',
  detail: undefined,
  hint: 'Perhaps you meant to reference the column "u.created_by".',
  position: '77',
  internalPosition: undefined,
  internalQuery: undefined,
  where: undefined,
  schema: undefined,
  table: undefined,
  column: undefined,
  dataType: undefined,
  constraint: undefined,
  file: 'parse_relation.c',
  line: '3829',
  routine: 'errorMissingColumn'
}
GET /api/auth/users 500 2.020 ms - 33
GET /api/settings/eco 200 2.706 ms - 135
Get users error: error: column u.created_at does not exist
    at F:\DevWeb\IC-Lib\server\node_modules\pg-pool\index.js:45:11
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async getAllUsers (file:///F:/DevWeb/IC-Lib/server/src/controllers/authController.js:159:20) {
  length: 169,
  severity: 'ERROR',
  code: '42703',
  detail: undefined,
  hint: 'Perhaps you meant to reference the column "u.created_by".',
  position: '77',
  internalPosition: undefined,
  internalQuery: undefined,
  where: undefined,
  schema: undefined,
  table: undefined,
  column: undefined,
  dataType: undefined,
  constraint: undefined,
  file: 'parse_relation.c',
  line: '3829',
  routine: 'errorMissingColumn'
}
GET /api/auth/users 500 11.694 ms - 33
GET /api/settings/eco/preview 200 11.431 ms - 24
GET /api/eco/stages 200 11.488 ms - 267
Get users error: error: column u.created_at does not exist
    at F:\DevWeb\IC-Lib\server\node_modules\pg-pool\index.js:45:11
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async getAllUsers (file:///F:/DevWeb/IC-Lib/server/src/controllers/authController.js:159:20) {
  length: 169,
  severity: 'ERROR',
  code: '42703',
  detail: undefined,
  hint: 'Perhaps you meant to reference the column "u.created_by".',
  position: '77',
  internalPosition: undefined,
  internalQuery: undefined,
  where: undefined,
  schema: undefined,
  table: undefined,
  column: undefined,
  dataType: undefined,
  constraint: undefined,
  file: 'parse_relation.c',
  line: '3829',
  routine: 'errorMissingColumn'
}
GET /api/auth/users 500 2.531 ms - 33
[ERROR] [SMTPController] Error getting SMTP settings: relation "smtp_settings" does not exist
GET /api/smtp 500 1.413 ms - 39
[ERROR] [SMTPController] Error getting SMTP settings: relation "smtp_settings" does not exist
GET /api/smtp 500 0.831 ms - 39
DELETE /api/dashboard/activities/all 200 9.350 ms - 56
GET /api/manufacturers 304 1.291 ms - -
GET /api/settings/categories 304 7.892 ms - -
Verifying database schema...
GET /api/settings/database/verify 200 3.182 ms - -
Loading sample data...
Statement error: INSERT INTO components (category_id, part_number, manufacturer_id, manufacturer_pn, description, val column "status" of relation "components" does not exist
Statement error: INSERT INTO component_specification_values (component_id, category_spec_id, spec_value) VALUES
    ( operator does not exist: uuid = integer
Statement error: INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, in_stock, stock_quantit column "price" of relation "distributor_info" does not exist
Statement error: INSERT INTO components (category_id, part_number, manufacturer_id, manufacturer_pn, description, val column "status" of relation "components" does not exist
Statement error: INSERT INTO component_specification_values (component_id, category_spec_id, spec_value) VALUES
    ( operator does not exist: uuid = integer
Statement error: INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, in_stock, stock_quantit column "price" of relation "distributor_info" does not exist
Statement error: INSERT INTO components (category_id, part_number, manufacturer_id, manufacturer_pn, description, val column "status" of relation "components" does not exist
Statement error: INSERT INTO component_specification_values (component_id, category_spec_id, spec_value) VALUES
    ( operator does not exist: uuid = integer
Statement error: INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, in_stock, stock_quantit column "price" of relation "distributor_info" does not exist
Statement error: INSERT INTO components (category_id, part_number, manufacturer_id, manufacturer_pn, description, val column "status" of relation "components" does not exist
Statement error: INSERT INTO component_specification_values (component_id, category_spec_id, spec_value) VALUES
    ( operator does not exist: uuid = integer
Statement error: INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, in_stock, stock_quantit column "price" of relation "distributor_info" does not exist
Statement error: INSERT INTO components (category_id, part_number, manufacturer_id, manufacturer_pn, description, val column "status" of relation "components" does not exist
Statement error: INSERT INTO component_specification_values (component_id, category_spec_id, spec_value) VALUES
    ( operator does not exist: uuid = integer
Statement error: INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, in_stock, stock_quantit column "price" of relation "distributor_info" does not exist
Statement error: INSERT INTO components (category_id, part_number, manufacturer_id, manufacturer_pn, description, val column "status" of relation "components" does not exist
Statement error: INSERT INTO component_specification_values (component_id, category_spec_id, spec_value) VALUES
    ( operator does not exist: uuid = integer
Statement error: INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, in_stock, stock_quantit column "price" of relation "distributor_info" does not exist
Statement error: INSERT INTO components (category_id, part_number, manufacturer_id, manufacturer_pn, description, val column "status" of relation "components" does not exist
Statement error: INSERT INTO component_specification_values (component_id, category_spec_id, spec_value) VALUES
    ( operator does not exist: uuid = integer
Statement error: INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, in_stock, stock_quantit column "price" of relation "distributor_info" does not exist
Statement error: INSERT INTO components (category_id, part_number, manufacturer_id, manufacturer_pn, description, val column "status" of relation "components" does not exist
Statement error: INSERT INTO component_specification_values (component_id, category_spec_id, spec_value) VALUES
    ( operator does not exist: uuid = integer
Statement error: INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, in_stock, stock_quantit column "price" of relation "distributor_info" does not exist
Statement error: INSERT INTO components (category_id, part_number, manufacturer_id, manufacturer_pn, description, val column "status" of relation "components" does not exist
Statement error: INSERT INTO component_specification_values (component_id, category_spec_id, spec_value) VALUES
    ( operator does not exist: uuid = integer
Statement error: INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, in_stock, stock_quantit column "price" of relation "distributor_info" does not exist
Statement error: INSERT INTO components (category_id, part_number, manufacturer_id, manufacturer_pn, description, val column "status" of relation "components" does not exist
Statement error: INSERT INTO component_specification_values (component_id, category_spec_id, spec_value) VALUES
    ( operator does not exist: uuid = integer
Statement error: INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, in_stock, stock_quantit column "price" of relation "distributor_info" does not exist
Statement error: INSERT INTO components (category_id, part_number, manufacturer_id, manufacturer_pn, description, val column "status" of relation "components" does not exist
Statement error: INSERT INTO component_specification_values (component_id, category_spec_id, spec_value) VALUES
    ( operator does not exist: uuid = integer
Statement error: INSERT INTO distributor_info (component_id, distributor_id, sku, url, price, in_stock, stock_quantit column "price" of relation "distributor_info" does not exist
Statement error: INSERT INTO components_alternative (component_id, manufacturer_id, manufacturer_pn) VALUES
    ((SEL null value in column "component_id" of relation "components_alternative" violates not-null constraint
Statement error: INSERT INTO distributor_info (alternative_id, distributor_id, sku, url, price, in_stock, stock_quant column "price" of relation "distributor_info" does not exist
Statement error: INSERT INTO components_alternative (component_id, manufacturer_id, manufacturer_pn) VALUES
    ((SEL null value in column "component_id" of relation "components_alternative" violates not-null constraint
Statement error: INSERT INTO distributor_info (alternative_id, distributor_id, sku, url, price, in_stock, stock_quant column "price" of relation "distributor_info" does not exist
POST /api/settings/database/sample-data 500 45.142 ms - -
Initializing database...
[initDatabase] Found 28 existing tables
[initDatabase] Aborting - tables already exist
POST /api/settings/database/init 400 12.255 ms - 153
Starting full database reset...
POST /api/settings/database/reset 200 123.801 ms - 314
GET /api/manufacturers 304 1.472 ms - -
GET /api/settings/categories 200 1.475 ms - -
Initializing database...
[initDatabase] Found 26 existing tables
[initDatabase] Aborting - tables already exist
POST /api/settings/database/init 400 11.645 ms - 153
GET /api/categories 200 1.432 ms - -
GET /api/distributors 200 1.051 ms - 425
GET /api/components?category=&search=&approvalStatus= 200 7.724 ms - -
GET /api/projects 304 13.627 ms - -
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c/specifications 200 1.784 ms - 2
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c/distributors 200 1.802 ms - 2
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c 200 3.527 ms - 1010
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c/alternatives 200 8.902 ms - 2
GET /api/files/list/CL10B104KB8NNWC 200 0.786 ms - 46
GET /api/components/019c3188-4468-7fea-bafb-09d760b7668d/distributors 200 0.891 ms - 2
GET /api/components/019c3188-4468-7fea-bafb-09d760b7668d/specifications 200 1.461 ms - 2
GET /api/components/019c3188-4468-7fea-bafb-09d760b7668d/alternatives 200 1.482 ms - 2
GET /api/components/019c3188-4468-7fea-bafb-09d760b7668d 200 2.839 ms - 1007
GET /api/files/list/CC0603JRNPO9BN101 200 0.524 ms - 48
GET /api/components/019c3188-446b-7178-96cf-b88b3baae693/specifications 200 1.572 ms - 2
GET /api/components/019c3188-446b-7178-96cf-b88b3baae693/distributors 200 1.861 ms - 2
GET /api/components/019c3188-446b-7178-96cf-b88b3baae693 200 2.708 ms - 1014
GET /api/components/019c3188-446b-7178-96cf-b88b3baae693/alternatives 200 2.857 ms - 2
GET /api/files/list/CL10B103KB8WPJC 200 0.605 ms - 46
GET /api/components/subcategories/suggestions?categoryId=019c3187-dc10-72cf-80fe-c6c3430fbe32&level=1 200 1.933 ms - 266
GET /api/components/subcategories/suggestions?categoryId=019c3187-dc10-72cf-80fe-c6c3430fbe32&level=2&subCat1=Ceramic+Capacitors 200 1.290 ms - 85
GET /api/components/subcategories/suggestions?categoryId=019c3187-dc10-72cf-80fe-c6c3430fbe32&level=3&subCat1=Ceramic+Capacitors&subCat2=0603+(1608+Metric) 200 1.417 ms - 2
GET /api/components/field-suggestions?categoryId=019c3187-dc10-72cf-80fe-c6c3430fbe32&field=package_size 200 1.853 ms - 230
GET /api/components/field-suggestions?categoryId=019c3187-dc10-72cf-80fe-c6c3430fbe32&field=step_model 200 1.684 ms - 291
GET /api/components/field-suggestions?categoryId=019c3187-dc10-72cf-80fe-c6c3430fbe32&field=pcb_footprint 200 2.243 ms - 376
GET /api/components/field-suggestions?categoryId=019c3187-dc10-72cf-80fe-c6c3430fbe32&field=schematic 200 2.292 ms - 15
GET /api/components/field-suggestions?categoryId=019c3187-dc10-72cf-80fe-c6c3430fbe32&field=pspice 200 12.072 ms - 2
GET /api/components/field-suggestions?categoryId=019c3187-dc10-72cf-80fe-c6c3430fbe32&field=pad_file 200 12.166 ms - 2
GET /api/settings/categories/019c3187-dc10-72cf-80fe-c6c3430fbe32/specifications 200 1.452 ms - -
GET /api/components/subcategories/suggestions?categoryId=019c3187-dc10-72cf-80fe-c6c3430fbe32&level=1 304 9.486 ms - -
GET /api/components/subcategories/suggestions?categoryId=019c3187-dc10-72cf-80fe-c6c3430fbe32&level=2&subCat1=Ceramic+Capacitors 304 1.070 ms - -
GET /api/components/subcategories/suggestions?categoryId=019c3187-dc10-72cf-80fe-c6c3430fbe32&level=3&subCat1=Ceramic+Capacitors&subCat2=0603+(1608+Metric) 304 1.879 ms - -
GET /api/components/field-suggestions?categoryId=019c3187-dc10-72cf-80fe-c6c3430fbe32&field=package_size 304 1.630 ms - -
GET /api/components/field-suggestions?categoryId=019c3187-dc10-72cf-80fe-c6c3430fbe32&field=pad_file 304 0.775 ms - -
GET /api/components/field-suggestions?categoryId=019c3187-dc10-72cf-80fe-c6c3430fbe32&field=schematic 304 8.046 ms - -
GET /api/components/field-suggestions?categoryId=019c3187-dc10-72cf-80fe-c6c3430fbe32&field=pcb_footprint 304 8.642 ms - -
GET /api/components/field-suggestions?categoryId=019c3187-dc10-72cf-80fe-c6c3430fbe32&field=pspice 304 8.025 ms - -
GET /api/components/field-suggestions?categoryId=019c3187-dc10-72cf-80fe-c6c3430fbe32&field=step_model 304 8.407 ms - -
GET /api/settings/categories/019c3187-dc10-72cf-80fe-c6c3430fbe32/specifications 304 1.670 ms - -
Error in updateComponent: error: insert or update on table "activity_log" violates foreign key constraint "activity_log_user_id_fkey"
    at F:\DevWeb\IC-Lib\server\node_modules\pg-pool\index.js:45:11
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async updateComponent (file:///F:/DevWeb/IC-Lib/server/src/controllers/componentController.js:463:5) {
  length: 305,
  severity: 'ERROR',
  code: '23503',
  detail: 'Key (user_id)=(019c3186-9e48-7c55-9eb7-c63f0704efc4) is not present in table "users".',
  hint: undefined,
  position: undefined,
  internalPosition: undefined,
  internalQuery: undefined,
  where: undefined,
  schema: 'public',
  table: 'activity_log',
  column: undefined,
  dataType: undefined,
  constraint: 'activity_log_user_id_fkey',
  file: 'ri_triggers.c',
  line: '2772',
  routine: 'ri_ReportViolation'
}
[ERROR] [Server] insert or update on table "activity_log" violates foreign key constraint "activity_log_user_id_fkey"
PUT /api/components/019c3188-4463-7283-8008-8b6640c3c85c 500 7.200 ms - 517
[FileUpload] Detected ZIP source: unknown
POST /api/files/upload/CL10B104KB8NNWC 200 38.173 ms - -
GET /api/categories 304 1.780 ms - -
GET /api/projects 304 2.267 ms - -
GET /api/manufacturers 200 1.654 ms - -
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c/distributors 304 3.571 ms - -
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c/specifications 304 4.466 ms - -
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c 200 4.876 ms - 1010
GET /api/files/list/CL10B104KB8NNWC 200 1.247 ms - 839
GET /api/components?category=&search=&approvalStatus= 200 7.121 ms - -
GET /api/distributors 304 15.411 ms - -
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c/alternatives 304 13.804 ms - -
POST /api/files/upload/CL10B104KB8NNWC 200 14.744 ms - 222
GET /api/categories 304 1.685 ms - -
GET /api/manufacturers 304 1.302 ms - -
GET /api/distributors 304 1.063 ms - -
GET /api/projects 304 2.055 ms - -
GET /api/files/list/CL10B104KB8NNWC 200 0.650 ms - 946
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c/specifications 304 1.325 ms - -
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c/distributors 304 1.424 ms - -
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c/alternatives 304 1.909 ms - -
GET /api/components?category=&search=&approvalStatus= 304 6.742 ms - -
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c 304 4.506 ms - -
Error in updateComponent: error: insert or update on table "activity_log" violates foreign key constraint "activity_log_user_id_fkey"
    at F:\DevWeb\IC-Lib\server\node_modules\pg-pool\index.js:45:11
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async updateComponent (file:///F:/DevWeb/IC-Lib/server/src/controllers/componentController.js:463:5) {
  length: 305,
  severity: 'ERROR',
  code: '23503',
  detail: 'Key (user_id)=(019c3186-9e48-7c55-9eb7-c63f0704efc4) is not present in table "users".',
  hint: undefined,
  position: undefined,
  internalPosition: undefined,
  internalQuery: undefined,
  where: undefined,
  schema: 'public',
  table: 'activity_log',
  column: undefined,
  dataType: undefined,
  constraint: 'activity_log_user_id_fkey',
  file: 'ri_triggers.c',
  line: '2772',
  routine: 'ri_ReportViolation'
}
[ERROR] [Server] insert or update on table "activity_log" violates foreign key constraint "activity_log_user_id_fkey"
PUT /api/components/019c3188-4463-7283-8008-8b6640c3c85c 500 13.260 ms - 517
Error in updateComponent: error: insert or update on table "activity_log" violates foreign key constraint "activity_log_user_id_fkey"
    at F:\DevWeb\IC-Lib\server\node_modules\pg-pool\index.js:45:11
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async updateComponent (file:///F:/DevWeb/IC-Lib/server/src/controllers/componentController.js:463:5) {
  length: 305,
  severity: 'ERROR',
  code: '23503',
  detail: 'Key (user_id)=(019c3186-9e48-7c55-9eb7-c63f0704efc4) is not present in table "users".',
  hint: undefined,
  position: undefined,
  internalPosition: undefined,
  internalQuery: undefined,
  where: undefined,
  schema: 'public',
  table: 'activity_log',
  column: undefined,
  dataType: undefined,
  constraint: 'activity_log_user_id_fkey',
  file: 'ri_triggers.c',
  line: '2772',
  routine: 'ri_ReportViolation'
}
[ERROR] [Server] insert or update on table "activity_log" violates foreign key constraint "activity_log_user_id_fkey"
PUT /api/components/019c3188-4463-7283-8008-8b6640c3c85c 500 12.325 ms - 517
DELETE /api/files/delete 200 1.529 ms - 39
GET /api/categories 304 8.432 ms - -
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c/specifications 304 1.640 ms - -
GET /api/manufacturers 304 9.429 ms - -
GET /api/distributors 304 9.122 ms - -
GET /api/files/list/CL10B104KB8NNWC 200 0.573 ms - 844
GET /api/projects 304 11.110 ms - -
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c/distributors 304 2.542 ms - -
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c 200 12.833 ms - 1010
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c/alternatives 304 3.395 ms - -
GET /api/components?category=&search=&approvalStatus= 200 17.657 ms - -
DELETE /api/files/delete 200 0.865 ms - 39
GET /api/categories 304 1.315 ms - -
GET /api/manufacturers 304 1.082 ms - -
GET /api/distributors 304 1.097 ms - -
GET /api/projects 304 1.874 ms - -
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c 304 1.049 ms - -
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c/specifications 304 0.890 ms - -
GET /api/components?category=&search=&approvalStatus= 304 7.168 ms - -
GET /api/files/list/CL10B104KB8NNWC 200 0.554 ms - 726
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c/distributors 304 1.251 ms - -
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c/alternatives 304 1.457 ms - -
DELETE /api/files/delete 200 0.740 ms - 39
GET /api/categories 304 0.988 ms - -
GET /api/manufacturers 304 1.113 ms - -
GET /api/distributors 304 1.101 ms - -
GET /api/projects 304 1.841 ms - -
GET /api/components?category=&search=&approvalStatus= 304 4.731 ms - -
GET /api/files/list/CL10B104KB8NNWC 200 0.486 ms - 624
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c/specifications 304 3.752 ms - -
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c/distributors 304 4.054 ms - -
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c/alternatives 304 3.748 ms - -
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c 304 13.149 ms - -
DELETE /api/files/delete 200 0.802 ms - 39
GET /api/distributors 304 0.741 ms - -
GET /api/categories 304 1.559 ms - -
GET /api/manufacturers 304 1.389 ms - -
GET /api/projects 304 1.527 ms - -
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c 304 1.815 ms - -
GET /api/files/list/CL10B104KB8NNWC 200 0.440 ms - 493
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c/specifications 304 1.393 ms - -
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c/distributors 304 1.328 ms - -
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c/alternatives 304 1.593 ms - -
GET /api/components?category=&search=&approvalStatus= 304 5.697 ms - -
DELETE /api/files/delete 200 0.712 ms - 39
GET /api/categories 304 1.651 ms - -
GET /api/manufacturers 304 1.493 ms - -
GET /api/projects 304 1.671 ms - -
GET /api/distributors 304 0.797 ms - -
GET /api/files/list/CL10B104KB8NNWC 200 0.487 ms - 379
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c 304 2.262 ms - -
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c/specifications 304 2.355 ms - -
GET /api/components?category=&search=&approvalStatus= 304 6.324 ms - -
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c/distributors 304 3.447 ms - -
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c/alternatives 304 3.194 ms - -
DELETE /api/files/delete 200 0.852 ms - 39
GET /api/categories 304 1.581 ms - -
GET /api/manufacturers 304 1.554 ms - -
GET /api/distributors 304 1.658 ms - -
GET /api/projects 304 1.987 ms - -
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c 304 2.117 ms - -
GET /api/files/list/CL10B104KB8NNWC 200 0.850 ms - 257
GET /api/components?category=&search=&approvalStatus= 304 6.583 ms - -
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c/distributors 304 3.746 ms - -
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c/specifications 304 4.325 ms - -
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c/alternatives 304 3.968 ms - -
DELETE /api/files/delete 200 1.093 ms - 39
GET /api/categories 304 1.950 ms - -
GET /api/manufacturers 304 1.471 ms - -
GET /api/distributors 304 1.357 ms - -
GET /api/projects 304 1.840 ms - -
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c 304 1.778 ms - -
GET /api/files/list/CL10B104KB8NNWC 200 0.417 ms - 152
GET /api/components?category=&search=&approvalStatus= 304 5.655 ms - -
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c/distributors 304 3.070 ms - -
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c/alternatives 304 3.145 ms - -
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c/specifications 304 3.810 ms - -
DELETE /api/files/delete 200 1.814 ms - 39
GET /api/categories 304 1.305 ms - -
GET /api/manufacturers 304 0.799 ms - -
GET /api/distributors 304 0.855 ms - -
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c 304 1.299 ms - -
GET /api/projects 304 1.627 ms - -
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c/specifications 304 0.957 ms - -
GET /api/files/list/CL10B104KB8NNWC 200 0.325 ms - 46
GET /api/components?category=&search=&approvalStatus= 304 4.771 ms - -
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c/distributors 304 2.792 ms - -
GET /api/components/019c3188-4463-7283-8008-8b6640c3c85c/alternatives 304 2.484 ms - -
Error in updateComponent: error: insert or update on table "activity_log" violates foreign key constraint "activity_log_user_id_fkey"
    at F:\DevWeb\IC-Lib\server\node_modules\pg-pool\index.js:45:11
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async updateComponent (file:///F:/DevWeb/IC-Lib/server/src/controllers/componentController.js:463:5) {
  length: 305,
  severity: 'ERROR',
  code: '23503',
  detail: 'Key (user_id)=(019c3186-9e48-7c55-9eb7-c63f0704efc4) is not present in table "users".',
  hint: undefined,
  position: undefined,
  internalPosition: undefined,
  internalQuery: undefined,
  where: undefined,
  schema: 'public',
  table: 'activity_log',
  column: undefined,
  dataType: undefined,
  constraint: 'activity_log_user_id_fkey',
  file: 'ri_triggers.c',
  line: '2772',
  routine: 'ri_ReportViolation'
}
[ERROR] [Server] insert or update on table "activity_log" violates foreign key constraint "activity_log_user_id_fkey"
PUT /api/components/019c3188-4463-7283-8008-8b6640c3c85c 500 6.188 ms - 517
Error in updateComponent: error: insert or update on table "activity_log" violates foreign key constraint "activity_log_user_id_fkey"
    at F:\DevWeb\IC-Lib\server\node_modules\pg-pool\index.js:45:11
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async updateComponent (file:///F:/DevWeb/IC-Lib/server/src/controllers/componentController.js:463:5) {
  length: 305,
  severity: 'ERROR',
  code: '23503',
  detail: 'Key (user_id)=(019c3186-9e48-7c55-9eb7-c63f0704efc4) is not present in table "users".',
  hint: undefined,
  position: undefined,
  internalPosition: undefined,
  internalQuery: undefined,
  where: undefined,
  schema: 'public',
  table: 'activity_log',
  column: undefined,
  dataType: undefined,
  constraint: 'activity_log_user_id_fkey',
  file: 'ri_triggers.c',
  line: '2772',
  routine: 'ri_ReportViolation'
}
[ERROR] [Server] insert or update on table "activity_log" violates foreign key constraint "activity_log_user_id_fkey"
PUT /api/components/019c3188-4463-7283-8008-8b6640c3c85c 500 6.718 ms - 517
GET /api/file-library/stats 200 1.706 ms - 60
GET /api/file-library/type/footprint 200 1.145 ms - -
GET /api/file-library/type/footprint/components?fileName=CAPC1608X90N 200 2.421 ms - -
GET /api/file-library/type/footprint/components?fileName=CAPC2012X90N 200 2.141 ms - -
GET /api/components/019c3188-4642-7f65-94e7-f7f6f6276eea/specifications 200 1.110 ms - 2
GET /api/components/019c3188-4642-7f65-94e7-f7f6f6276eea 200 1.667 ms - 996
GET /api/components/019c3188-4642-7f65-94e7-f7f6f6276eea/distributors 200 1.440 ms - 2
GET /api/components?category=&search=CAP-00012&approvalStatus= 200 4.043 ms - 980
GET /api/components/019c3188-4642-7f65-94e7-f7f6f6276eea/alternatives 200 8.868 ms - 2
GET /api/files/list/SQJ457EP-T1_GE3 200 0.543 ms - 46
GET /api/components/019c3188-447e-7f80-a8df-4186fb520100/distributors 200 0.828 ms - 2
GET /api/components/019c3188-447e-7f80-a8df-4186fb520100/specifications 200 1.227 ms - 2
GET /api/components/019c3188-447e-7f80-a8df-4186fb520100/alternatives 200 1.125 ms - 2
GET /api/components/019c3188-447e-7f80-a8df-4186fb520100 200 2.908 ms - 1006
GET /api/files/list/CL21A475KBQNNNE 200 0.406 ms - 46
GET /api/dashboard/category-breakdown 200 1.148 ms - 510
GET /api/dashboard/db-info 200 2.345 ms - 87
GET /api/dashboard/extended-stats 200 4.876 ms - 636
GET /api/inventory/alerts/low-stock 304 1.934 ms - -
POST /api/search/all 200 1532.717 ms - -
POST /api/search/add-to-library 200 2.853 ms - -
GET /api/components/subcategories/suggestions?categoryId=019c3187-dc10-75fe-92ed-1f2f62a3d70c&level=1 200 1.604 ms - 191
GET /api/components/field-suggestions?categoryId=019c3187-dc10-75fe-92ed-1f2f62a3d70c&field=package_size 200 1.302 ms - 484
GET /api/components/field-suggestions?categoryId=019c3187-dc10-75fe-92ed-1f2f62a3d70c&field=pcb_footprint 200 1.457 ms - 375
GET /api/components/field-suggestions?categoryId=019c3187-dc10-75fe-92ed-1f2f62a3d70c&field=step_model 200 1.444 ms - 253
GET /api/components/field-suggestions?categoryId=019c3187-dc10-75fe-92ed-1f2f62a3d70c&field=schematic 200 1.887 ms - 538
GET /api/components/field-suggestions?categoryId=019c3187-dc10-75fe-92ed-1f2f62a3d70c&field=pspice 200 0.597 ms - 2
GET /api/components/field-suggestions?categoryId=019c3187-dc10-75fe-92ed-1f2f62a3d70c&field=pad_file 200 0.646 ms - 2
GET /api/categories/019c3187-dc10-75fe-92ed-1f2f62a3d70c/next-part-number 200 3.471 ms - 80
GET /api/settings/categories/019c3187-dc10-75fe-92ed-1f2f62a3d70c/specifications 200 1.228 ms - 2
Error in createComponent: error: insert or update on table "activity_log" violates foreign key constraint "activity_log_user_id_fkey"
    at F:\DevWeb\IC-Lib\server\node_modules\pg-pool\index.js:45:11
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async createComponent (file:///F:/DevWeb/IC-Lib/server/src/controllers/componentController.js:185:5) {
  length: 305,
  severity: 'ERROR',
  code: '23503',
  detail: 'Key (user_id)=(019c3186-9e48-7c55-9eb7-c63f0704efc4) is not present in table "users".',
  hint: undefined,
  position: undefined,
  internalPosition: undefined,
  internalQuery: undefined,
  where: undefined,
  schema: 'public',
  table: 'activity_log',
  column: undefined,
  dataType: undefined,
  constraint: 'activity_log_user_id_fkey',
  file: 'ri_triggers.c',
  line: '2772',
  routine: 'ri_ReportViolation'
}
[ERROR] [Server] insert or update on table "activity_log" violates foreign key constraint "activity_log_user_id_fkey"
POST /api/components 500 5.283 ms - 517
GET /api/settings/categories 304 0.779 ms - -
Get users error: error: column u.created_at does not exist
    at F:\DevWeb\IC-Lib\server\node_modules\pg-pool\index.js:45:11
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async getAllUsers (file:///F:/DevWeb/IC-Lib/server/src/controllers/authController.js:159:20) {
  length: 169,
  severity: 'ERROR',
  code: '42703',
  detail: undefined,
  hint: 'Perhaps you meant to reference the column "u.created_by".',
  position: '77',
  internalPosition: undefined,
  internalQuery: undefined,
  where: undefined,
  schema: undefined,
  table: undefined,
  column: undefined,
  dataType: undefined,
  constraint: undefined,
  file: 'parse_relation.c',
  line: '3829',
  routine: 'errorMissingColumn'
}
GET /api/auth/users 500 2.503 ms - 33
Get users error: error: column u.created_at does not exist
    at F:\DevWeb\IC-Lib\server\node_modules\pg-pool\index.js:45:11
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async getAllUsers (file:///F:/DevWeb/IC-Lib/server/src/controllers/authController.js:159:20) {
  length: 169,
  severity: 'ERROR',
  code: '42703',
  detail: undefined,
  hint: 'Perhaps you meant to reference the column "u.created_by".',
  position: '77',
  internalPosition: undefined,
  internalQuery: undefined,
  where: undefined,
  schema: undefined,
  table: undefined,
  column: undefined,
  dataType: undefined,
  constraint: undefined,
  file: 'parse_relation.c',
  line: '3829',
  routine: 'errorMissingColumn'
}
GET /api/auth/users 500 1.823 ms - 33
GET /api/dashboard/activities/all 200 8.462 ms - 2
[error] [Auth] Get profile error: error: column "created_at" does not exist
    at F:\DevWeb\IC-Lib\server\node_modules\pg-pool\index.js:45:11
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async getProfile (file:///F:/DevWeb/IC-Lib/server/src/controllers/authController.js:509:20) {
  length: 173,
  severity: 'ERROR',
  code: '42703',
  detail: undefined,
  hint: 'Perhaps you meant to reference the column "users.created_by".',
  position: '90',
  internalPosition: undefined,
  internalQuery: undefined,
  where: undefined,
  schema: undefined,
  table: undefined,
  column: undefined,
  dataType: undefined,
  constraint: undefined,
  file: 'parse_relation.c',
  line: '3829',
  routine: 'errorMissingColumn'
}
GET /api/auth/profile 500 2.304 ms - 35
[error] [Auth] Get profile error: error: column "created_at" does not exist
    at F:\DevWeb\IC-Lib\server\node_modules\pg-pool\index.js:45:11
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async getProfile (file:///F:/DevWeb/IC-Lib/server/src/controllers/authController.js:509:20) {
  length: 173,
  severity: 'ERROR',
  code: '42703',
  detail: undefined,
  hint: 'Perhaps you meant to reference the column "users.created_by".',
  position: '90',
  internalPosition: undefined,
  internalQuery: undefined,
  where: undefined,
  schema: undefined,
  table: undefined,
  column: undefined,
  dataType: undefined,
  constraint: undefined,
  file: 'parse_relation.c',
  line: '3829',
  routine: 'errorMissingColumn'
}
GET /api/auth/profile 500 7.656 ms - 35
Get users error: error: column u.created_at does not exist
    at F:\DevWeb\IC-Lib\server\node_modules\pg-pool\index.js:45:11
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async getAllUsers (file:///F:/DevWeb/IC-Lib/server/src/controllers/authController.js:159:20) {
  length: 169,
  severity: 'ERROR',
  code: '42703',
  detail: undefined,
  hint: 'Perhaps you meant to reference the column "u.created_by".',
  position: '77',
  internalPosition: undefined,
  internalQuery: undefined,
  where: undefined,
  schema: undefined,
  table: undefined,
  column: undefined,
  dataType: undefined,
  constraint: undefined,
  file: 'parse_relation.c',
  line: '3829',
  routine: 'errorMissingColumn'
}
GET /api/auth/users 500 9.978 ms - 33
Get users error: error: column u.created_at does not exist
    at F:\DevWeb\IC-Lib\server\node_modules\pg-pool\index.js:45:11
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async getAllUsers (file:///F:/DevWeb/IC-Lib/server/src/controllers/authController.js:159:20) {
  length: 169,
  severity: 'ERROR',
  code: '42703',
  detail: undefined,
  hint: 'Perhaps you meant to reference the column "u.created_by".',
  position: '77',
  internalPosition: undefined,
  internalQuery: undefined,
  where: undefined,
  schema: undefined,
  table: undefined,
  column: undefined,
  dataType: undefined,
  constraint: undefined,
  file: 'parse_relation.c',
  line: '3829',
  routine: 'errorMissingColumn'
}
GET /api/auth/users 500 8.184 ms - 33
Get users error: error: column u.created_at does not exist
    at F:\DevWeb\IC-Lib\server\node_modules\pg-pool\index.js:45:11
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async getAllUsers (file:///F:/DevWeb/IC-Lib/server/src/controllers/authController.js:159:20) {
  length: 169,
  severity: 'ERROR',
  code: '42703',
  detail: undefined,
  hint: 'Perhaps you meant to reference the column "u.created_by".',
  position: '77',
  internalPosition: undefined,
  internalQuery: undefined,
  where: undefined,
  schema: undefined,
  table: undefined,
  column: undefined,
  dataType: undefined,
  constraint: undefined,
  file: 'parse_relation.c',
  line: '3829',
  routine: 'errorMissingColumn'
}
GET /api/auth/users 500 8.920 ms - 33
GET /api/settings/categories 304 8.543 ms - -
GET /api/manufacturers 304 8.608 ms - -
Get users error: error: column u.created_at does not exist
    at F:\DevWeb\IC-Lib\server\node_modules\pg-pool\index.js:45:11
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async getAllUsers (file:///F:/DevWeb/IC-Lib/server/src/controllers/authController.js:159:20) {
  length: 169,
  severity: 'ERROR',
  code: '42703',
  detail: undefined,
  hint: 'Perhaps you meant to reference the column "u.created_by".',
  position: '77',
  internalPosition: undefined,
  internalQuery: undefined,
  where: undefined,
  schema: undefined,
  table: undefined,
  column: undefined,
  dataType: undefined,
  constraint: undefined,
  file: 'parse_relation.c',
  line: '3829',
  routine: 'errorMissingColumn'
}
GET /api/auth/users 500 1.985 ms - 33
Get users error: error: column u.created_at does not exist
    at F:\DevWeb\IC-Lib\server\node_modules\pg-pool\index.js:45:11
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async getAllUsers (file:///F:/DevWeb/IC-Lib/server/src/controllers/authController.js:159:20) {
  length: 169,
  severity: 'ERROR',
  code: '42703',
  detail: undefined,
  hint: 'Perhaps you meant to reference the column "u.created_by".',
  position: '77',
  internalPosition: undefined,
  internalQuery: undefined,
  where: undefined,
  schema: undefined,
  table: undefined,
  column: undefined,
  dataType: undefined,
  constraint: undefined,
  file: 'parse_relation.c',
  line: '3829',
  routine: 'errorMissingColumn'
}
GET /api/auth/users 500 1.884 ms - 33
Error fetching ECO settings: error: relation "eco_settings" does not exist
    at F:\DevWeb\IC-Lib\server\node_modules\pg-pool\index.js:45:11
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async getECOSettings (file:///F:/DevWeb/IC-Lib/server/src/controllers/settingsController.js:1495:20) {
  length: 111,
  severity: 'ERROR',
  code: '42P01',
  detail: undefined,
  hint: undefined,
  position: '15',
  internalPosition: undefined,
  internalQuery: undefined,
  where: undefined,
  schema: undefined,
  table: undefined,
  column: undefined,
  dataType: undefined,
  constraint: undefined,
  file: 'parse_relation.c',
  line: '1466',
  routine: 'parserOpenTable'
}
GET /api/settings/eco 500 7.159 ms - 93
Error previewing ECO number: error: relation "eco_settings" does not exist
    at F:\DevWeb\IC-Lib\server\node_modules\pg-pool\index.js:45:11
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async previewECONumber (file:///F:/DevWeb/IC-Lib/server/src/controllers/settingsController.js:1594:20) {
  length: 111,
  severity: 'ERROR',
  code: '42P01',
  detail: undefined,
  hint: undefined,
  position: '15',
  internalPosition: undefined,
  internalQuery: undefined,
  where: undefined,
  schema: undefined,
  table: undefined,
  column: undefined,
  dataType: undefined,
  constraint: undefined,
  file: 'parse_relation.c',
  line: '1466',
  routine: 'parserOpenTable'
}
GET /api/settings/eco/preview 500 7.825 ms - 93
GET /api/eco/stages 200 8.769 ms - 267
Get users error: error: column u.created_at does not exist
    at F:\DevWeb\IC-Lib\server\node_modules\pg-pool\index.js:45:11
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async getAllUsers (file:///F:/DevWeb/IC-Lib/server/src/controllers/authController.js:159:20) {
  length: 169,
  severity: 'ERROR',
  code: '42703',
  detail: undefined,
  hint: 'Perhaps you meant to reference the column "u.created_by".',
  position: '77',
  internalPosition: undefined,
  internalQuery: undefined,
  where: undefined,
  schema: undefined,
  table: undefined,
  column: undefined,
  dataType: undefined,
  constraint: undefined,
  file: 'parse_relation.c',
  line: '3829',
  routine: 'errorMissingColumn'
}
GET /api/auth/users 500 1.555 ms - 33
Error fetching ECO settings: error: relation "eco_settings" does not exist
    at F:\DevWeb\IC-Lib\server\node_modules\pg-pool\index.js:45:11
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async getECOSettings (file:///F:/DevWeb/IC-Lib/server/src/controllers/settingsController.js:1495:20) {
  length: 111,
  severity: 'ERROR',
  code: '42P01',
  detail: undefined,
  hint: undefined,
  position: '15',
  internalPosition: undefined,
  internalQuery: undefined,
  where: undefined,
  schema: undefined,
  table: undefined,
  column: undefined,
  dataType: undefined,
  constraint: undefined,
  file: 'parse_relation.c',
  line: '1466',
  routine: 'parserOpenTable'
}
GET /api/settings/eco 500 6.391 ms - 93
Error previewing ECO number: error: relation "eco_settings" does not exist
    at F:\DevWeb\IC-Lib\server\node_modules\pg-pool\index.js:45:11
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async previewECONumber (file:///F:/DevWeb/IC-Lib/server/src/controllers/settingsController.js:1594:20) {
  length: 111,
  severity: 'ERROR',
  code: '42P01',
  detail: undefined,
  hint: undefined,
  position: '15',
  internalPosition: undefined,
  internalQuery: undefined,
  where: undefined,
  schema: undefined,
  table: undefined,
  column: undefined,
  dataType: undefined,
  constraint: undefined,
  file: 'parse_relation.c',
  line: '1466',
  routine: 'parserOpenTable'
}
GET /api/settings/eco/preview 500 6.711 ms - 93
GET /api/dashboard/category-breakdown 200 10.454 ms - 510
GET /api/dashboard/db-info 304 11.365 ms - -
GET /api/dashboard/extended-stats 304 15.529 ms - -
