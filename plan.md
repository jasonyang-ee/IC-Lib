The file management for multiple file types (footprint, symbol, pad, model, pspice, libraries) with multiple counts of files per component while multiple components can share the same file is a complex feature that requires careful planning and implementation. Below is a detailed user experience (UX) and technical plan for this feature.

## New Parts Workflow:
1. Create new part
2. Upload files or .zip file with multiple files
3. Place uploaded files in temp folder before saving (if canceled, delete temp files)
4. If file of the same name already exists, prompt user to either replace existing file or abort upload
5. Using file extension, determine file type (footprint, symbol, pad, model, pspice, pad files)
6. Allow user to rename files before finalizing upload to ensure they are descriptive and unique (only for add mode, not for edit mode). The rename should have three ways:
   a. using manufacturer part number.
   b. using Package Name.
   c. using a custom name input by user.
7. Automatic append those file names to the parts details (if file is renamed, dynamically update the file names in the part details)
8. When user saves the part, move files from temp folder to structured library folder organized by CAD type. (e.g. library/footprint/file_name)
9. End of the CAD file list for each type should have a text button for "add existing file" which will open a pop up window showing all the available files in the library with search and filter function. User can then select the file to link to the part. Pop up windows should have consistent UI and be reusable for both add and edit parts workflow.

## CAD type association:
1. Footprint files: .psm, .dra
2. Symbol files: .olb
3. Pad files: .pad
4. Model files: .step, .stp, .iges, .igs .stl
5. Pspice files: .lib

## Edit Parts Workflow:
1. Edit existing part
2. Be able to remove link to existing CAD files (but not delete the files themselves since they may be shared with other parts)
3. Be able to upload new files or .zip file with multiple files and link them to the part (same file type detection and renaming process as new parts workflow)
4. When user saves the part, move any newly uploaded files from temp folder to structured library folder and update the part details with new file names. For removed links, just remove the association in the database but keep the files in the library since they may be used by other parts.
5. Be able to link existing files in the library to the part without needing to re-upload. This should have additional feature to search for file name with package name or custom user input or dropdown showing all available files in the library.
6. The CAD file if already stored, should not be presented as drop down box since it hints that it can be modifed. But in the workflow we are going to present a text button "remove link" next to the file name. When user clicks "relink", it will open a pop up window showing all the available files in the library with search and filter function. User can then select the file to link to the part. When user clicks "remove link", it will just remove the association between the part and the file but keep the file in the library since it may be shared with other parts.
7. The CAD file name should be shown as like static style in the part details page since it is not editable directly. User can only edit the file name through the rename function in the file library page or by re-uploading a new file with the desired name and linking it to the part.
8. End of the CAD file list for each type should have a text button for "add existing file" which will open a pop up window showing all the available files in the library with search and filter function. User can then select the file to link to the part.
9. The bottom should still have file upload feature (currently implemented). This will allow user to upload new files and link them to the part directly from the edit page. The same file type detection and renaming process as new parts workflow should be applied here as well.

## View Parts Mode:
1. Be albe to click CAD file name to hyper link it to file library path. Please prepend with {FILE_STORAGE_PATH} for the file path. This will allow user to easily access the CAD files in the library when viewing part details.
2. Next to CAD file name have a file library link (align to right) Be able to click and jump page to file library page with filter applied to show all the parts linked to the same file. This will allow user to easily see which other parts are sharing the same CAD file and access those part details as well. And user will rename file here.

## File library page:
1. Show all files in the library organized by file type (footprint, symbol, pad, model, pspice). (This is the current setup)
2. For each CAD file name selected, show which parts are linked to it (with links to those parts) (This is the current setup)
3. Additionally to "File Types" selection. Add "Category" selection which is similar to the category selection in the parts library page. When user selects a category and a particular part, the windows will show all the files linked to that part in the second column section and show all the parts that sharing the same file in the third column section. This will allow users to easily see which files are linked to which parts and identify any shared files across parts.
5. Allow searching and filtering files by part name, CAD type, and linked parts. The UI for filtering should be on top bar. Make it slim.
6. In this page, allow user to mass rename the file name when operting "file types" selection. 
7. In this page, allow user to rename the file name when operting "category" selection. When user clicks the rename button, a pop up will show up to ask user to input new file name. After user inputs new file name and clicks confirm, the file name will be updated in the library and all the linked parts details will be updated with the new file name as well.
8. Support deleting of file from library. When user deletes a file, it will check if there are any parts linked to the file. If there are linked parts, it will show a warning message to inform user that deleting the file will remove the association from all linked parts but will not delete the files from the library since they may be shared with other parts. User can then choose to confirm or cancel the deletion.
9. Create a new db table to track all CAD files with UUID so that we can easily index and find orphan files that are not linked to any parts and clean them up periodically. This table will also store the file path, file type, and linked parts for each CAD file.
10. Be able to filter orphan files that are not linked to any parts and have an option to delete those files from the library. This will help keep the library organized and free up storage space by removing unused files.

## Change to the multiple files support for CAD files:
1. Only footprint and pad files will support multiple files per part. Symbol, model, and pspice files will only allow one file per part since they never have multiple files for the same part.

## Bug Fix:
1. Please see server error below and fix all the issues.

## Server Error
Failed to load profile settings
GET /api/auth/profile 404 1.698 ms - 26

[ERROR] [FileLibrary] Error fetching components by file: could not determine data type of parameter $1
GET /api/file-library/type/footprint/components?fileName=adjh21005 500 5.175 ms - 38
[ERROR] [FileLibrary] Error fetching components by file: could not determine data type of parameter $1
GET /api/file-library/type/footprint/components?fileName=adjh21005 500 2.029 ms - 38
[ERROR] [FileLibrary] Error fetching components by file: could not determine data type of parameter $1
GET /api/file-library/type/footprint/components?fileName=CAPC1608X90N 500 2.113 ms - 38
[ERROR] [FileLibrary] Error fetching components by file: could not determine data type of parameter $1
GET /api/file-library/type/footprint/components?fileName=CAPC1608X90N 500 1.490 ms - 38
[ERROR] [FileLibrary] Error fetching components by file: could not determine data type of parameter $1
GET /api/file-library/type/footprint/components?fileName=CAPC2012X90N 500 1.561 ms - 38
[ERROR] [FileLibrary] Error fetching components by file: could not determine data type of parameter $1
GET /api/file-library/type/footprint/components?fileName=CAPC2012X90N 500 7.949 ms - 38
[ERROR] [FileLibrary] Error fetching components by file: could not determine data type of parameter $1
GET /api/file-library/type/footprint/components?fileName=qfn50p500x500x80-29n.psm 500 8.619 ms - 38
[ERROR] [FileLibrary] Error fetching components by file: could not determine data type of parameter $1
GET /api/file-library/type/footprint/components?fileName=qfn50p500x500x80-29n.psm 500 7.447 ms - 38


[FileUpload] Detected ZIP source: unknown
[FileUpload] Failed to auto-link FT260Q-T.OLB to FT260Q-T: could not determine data type of parameter $1
[FileUpload] Failed to auto-link ps_29_irreg.dra to FT260Q-T: could not determine data type of parameter $1
[FileUpload] Failed to auto-link QFN50P500X500X80-29N.dra to FT260Q-T: could not determine data type of parameter $1
[FileUpload] Failed to auto-link qfn50p500x500x80-29n.psm to FT260Q-T: could not determine data type of parameter $1
[FileUpload] Failed to auto-link s_29_t_irreg.pad to FT260Q-T: could not determine data type of parameter $1
[FileUpload] Failed to auto-link s_r26t96m26_96p26_96.pad to FT260Q-T: could not determine data type of parameter $1
[FileUpload] Failed to auto-link s_r96t26m96_26p96_26.pad to FT260Q-T: could not determine data type of parameter $1
[FileUpload] Failed to auto-link FT260Q-T--3DModel-STEP-510211.STEP to FT260Q-T: could not determine data type of parameter $1
POST /api/files/upload/FT260Q-T 200 65.402 ms - -