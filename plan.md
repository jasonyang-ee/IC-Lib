## Frontend:
1. The edit mode still have seperated file name fields and CAD file sections. Please merge those two in the frontend with good and elegant UI. The file name fields should be removed and replaced with the new JSONB structure for CAD files. Ensure that the UI allows users to easily add, edit, and remove CAD files while maintaining a clear distinction between different file types (schematic, step model, pspice, pad file). The file names should not be displayed like tags. But please make each file name stand out and look good in the UI. Consider using a card or list layout to display the CAD files with their respective types and provide options for editing or deleting each file entry.
2. Please update the `scripts/import.js` to reflect the new JSONB structure for CAD files. Ensure that the import process correctly populates the new JSONB fields and that any existing data is migrated appropriately.
3. The add mode and edit mode still did not have the same view. Please make sure add mode is the same as edit mode, but with empty fields. This will provide a consistent user experience and make it easier for users to understand how to add new components while maintaining the same interface for editing existing components.


## Bug Fix:
1. File library page is broken. Please fix.
2. Migration 001_cad_columns_to_jsonb.sql failed due to dependent objects. Please investigate and resolve the issue.
3. All database reset and init has error.
4. Dashboard is also broken due to the same issue with the migration. Please fix.

## Server Error
[ERROR] [Migration] Migration 001_cad_columns_to_jsonb.sql failed: cannot drop column pcb_footprint of table components because other objects depend on it

GET /api/components/subcategories/suggestions?categoryId=019c4013-53f9-72f1-ae7c-463b15bcc9b7&level=3&subCat1=Ceramic+Capacitors&subCat2=0603+(1608+Metric) 304 1.126 ms - -
[ERROR] [Server] function jsonb_array_elements_text(character varying) does not exist
GET /api/components/field-suggestions?categoryId=019c4013-53f9-72f1-ae7c-463b15bcc9b7&field=pcb_footprint 500 1.824 ms - 450
[ERROR] [Server] function jsonb_array_elements_text(character varying) does not exist
GET /api/components/field-suggestions?categoryId=019c4013-53f9-72f1-ae7c-463b15bcc9b7&field=schematic 500 2.457 ms - 450
[ERROR] [Server] function jsonb_array_elements_text(character varying) does not exist
GET /api/components/field-suggestions?categoryId=019c4013-53f9-72f1-ae7c-463b15bcc9b7&field=step_model 500 2.905 ms - 450
GET /api/components/field-suggestions?categoryId=019c4013-53f9-72f1-ae7c-463b15bcc9b7&field=package_size 304 3.833 ms - -
[ERROR] [Server] function jsonb_array_elements_text(character varying) does not exist
GET /api/components/field-suggestions?categoryId=019c4013-53f9-72f1-ae7c-463b15bcc9b7&field=pspice 500 8.185 ms - 450 
[ERROR] [Server] function jsonb_array_elements_text(character varying) does not exist
GET /api/components/field-suggestions?categoryId=019c4013-53f9-72f1-ae7c-463b15bcc9b7&field=pad_file 500 8.635 ms - 450
GET /api/settings/categories/019c4013-53f9-72f1-ae7c-463b15bcc9b7/specifications 304 2.433 ms - -
[ERROR] [FileLibrary] Error fetching file type stats: function jsonb_array_elements_text(character varying) does not exist
GET /api/file-library/stats 500 2.542 ms - 48
[ERROR] [FileLibrary] Error fetching files by type: function jsonb_array_elements_text(character varying) does not exist
GET /api/file-library/type/footprint 500 9.108 ms - 33
[ERROR] [FileLibrary] Error fetching file type stats: function jsonb_array_elements_text(character varying) does not exist
GET /api/file-library/stats 500 7.648 ms - 48
[ERROR] [FileLibrary] Error fetching files by type: function jsonb_array_elements_text(character varying) does not exist
GET /api/file-library/type/footprint 500 6.508 ms - 33
[ERROR] [FileLibrary] Error fetching files by type: function jsonb_array_elements_text(character varying) does not exist
GET /api/file-library/type/schematic 500 9.565 ms - 33
[ERROR] [FileLibrary] Error fetching files by type: function jsonb_array_elements_text(character varying) does not exist
GET /api/file-library/type/schematic 500 7.267 ms - 33
[ERROR] [FileLibrary] Error fetching files by type: function jsonb_array_elements_text(character varying) does not exist
GET /api/file-library/type/footprint 500 11.146 ms - 33
[ERROR] [FileLibrary] Error fetching files by type: function jsonb_array_elements_text(character varying) does not exist
GET /api/file-library/type/footprint 500 10.187 ms - 33

[ERROR] [Server] invalid input syntax for type json
GET /api/inventory 304 2.470 ms - -
[ERROR] [Server] invalid input syntax for type json
GET /api/dashboard/category-breakdown 304 1.952 ms - -
[ERROR] [Server] invalid input syntax for type json