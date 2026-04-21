import { ChevronDown, Plus } from 'lucide-react';
import CadFieldSection from './CadFieldSection';
import ComponentFiles from './ComponentFiles';
import SubCategoryInputs from './SubCategoryInputs';

/**
 * ComponentEditForm - The edit/add mode form for component data.
 *
 * Contains: Part Number, Part Type, Value, Package, Manufacturer,
 * MFG Part Number, SubCategory 1-4, Description, CAD files,
 * Datasheet URL, and Distributor Info editing rows.
 *
 * All state management remains in Library.jsx; this is a pure
 * presentational component receiving data and callbacks as props.
 */
const ComponentEditForm = ({
  editData,
  isAddMode,
  isEditMode,
  isECOMode,
  categories,
  manufacturers,
  // Field change
  onFieldChange,
  onCategoryChange,
  onEditModeCategoryChange,
  // Manufacturer dropdown
  manufacturerInput,
  setManufacturerInput,
  manufacturerOpen,
  setManufacturerOpen,
  manufacturerRef,
  // Package dropdown
  packageSuggestions,
  packageOpen,
  setPackageOpen,
  packageRef,
  // Sub-category state
  subCat1Ref, subCat2Ref, subCat3Ref, subCat4Ref,
  subCat1Open, setSubCat1Open,
  subCat2Open, setSubCat2Open,
  subCat3Open, setSubCat3Open,
  subCat4Open, setSubCat4Open,
  subCat1Suggestions, subCat2Suggestions, subCat3Suggestions, subCat4Suggestions,
  setSubCat2Suggestions, setSubCat3Suggestions,
  onSubCat1Change, onSubCat2Change, onSubCat3Change,
  // File management
  selectedComponent,
  onTempFileStaged,
  onTempFileRemoved,
  onFileSoftDeleted,
  onFileUploaded: _onFileUploaded,
  onFileRenamed: _onFileRenamed,
  onFileDeleted: _onFileDeleted,
  onCadFileAdded,
  onCadFileRemoved,
  onCadFileRenamed,
  setEditData,
}) => (
  <>
    {/* ROW 1: Part Number, Part Type (Category) */}
    <div>
      <label className="block text-gray-600 dark:text-gray-400 mb-1">
        Part Number <span className="text-red-500">*</span>
      </label>
      <input
        type="text"
        value={editData.part_number || ''}
        onChange={(e) => onFieldChange('part_number', e.target.value)}
        disabled={isAddMode || isEditMode}
        className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm disabled:bg-gray-100 dark:disabled:bg-[#2a2a2a] disabled:cursor-not-allowed"
        placeholder="Select category to generate"
      />
    </div>
    <div>
      <label className="block text-gray-600 dark:text-gray-400 mb-1">
        Part Type <span className="text-red-500">*</span>
        {isEditMode && <span className="text-xs text-gray-500 ml-1">(changes part number)</span>}
      </label>
      <select
        value={editData.category_id || ''}
        onChange={(e) => isAddMode ? onCategoryChange(e.target.value) : onEditModeCategoryChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
      >
        <option value="">Select type</option>
        {categories?.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.name}
          </option>
        ))}
      </select>
    </div>


    {/* ROW 2: Value, Package */}
    <div>
      <label className="block text-gray-600 dark:text-gray-400 mb-1">
        Value <span className="text-red-500">*</span>
      </label>
      <input
        type="text"
        value={editData.value || ''}
        onChange={(e) => onFieldChange('value', e.target.value)}
        placeholder="e.g., 10uF, 10kΩ, STM32F103"
        className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
      />
    </div>
    <div>
      <label className="block text-gray-600 dark:text-gray-400 mb-1">Package</label>
      <div ref={packageRef} className="relative">
        <input
          type="text"
          value={editData.package_size || ''}
          onChange={(e) => onFieldChange('package_size', e.target.value)}
          onFocus={() => setPackageOpen(true)}
          placeholder="e.g., 0805"
          className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
        />
        <button
          type="button"
          onClick={() => setPackageOpen(!packageOpen)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
        {packageOpen && editData.category_id && packageSuggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#2a2a2a] border border-gray-300 dark:border-[#444444] rounded-md shadow-lg max-h-60 overflow-y-auto custom-scrollbar">
            {packageSuggestions
              .filter(pkg => pkg.toLowerCase().includes((editData.package_size || '').toLowerCase()))
              .map((pkg, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    onFieldChange('package_size', pkg);
                    setPackageOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-[#333333] text-gray-700 dark:text-gray-300"
                >
                  {pkg}
                </button>
              ))}
          </div>
        )}
      </div>
    </div>

    {/* ROW 3: Manufacturer, MFG Part Number */}
    <div ref={manufacturerRef} className="relative">
      <label className="block text-gray-600 dark:text-gray-400 mb-1">
        Manufacturer <span className="text-red-500">*</span>
      </label>
      <div className="relative">
        <input
          type="text"
          value={manufacturerInput}
          onChange={(e) => {
            setManufacturerInput(e.target.value);
            setManufacturerOpen(true);
          }}
          onFocus={() => setManufacturerOpen(true)}
          placeholder="Type or select"
          className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
        />
        <button
          type="button"
          onClick={() => setManufacturerOpen(!manufacturerOpen)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
        {manufacturerOpen && (() => {
          const filtered = manufacturers?.filter(mfr =>
            mfr.name.toLowerCase().includes(manufacturerInput.toLowerCase())
          ) || [];
          const exactMatch = filtered.find(mfr =>
            mfr.name.toLowerCase() === manufacturerInput.toLowerCase()
          );
          const showCreateOption = manufacturerInput.trim() && !exactMatch;

          return (
            <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#2a2a2a] border border-gray-300 dark:border-[#444444] rounded-md shadow-lg max-h-60 overflow-y-auto custom-scrollbar">
              {showCreateOption && (
                <button
                  type="button"
                  onClick={() => {
                    // Store new manufacturer name with special marker for later creation
                    onFieldChange('manufacturer_id', `NEW:${manufacturerInput.trim()}`);
                    setManufacturerOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-medium text-sm flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  "{manufacturerInput.trim()}"
                </button>
              )}
              {filtered.length > 0 ? (
                filtered.map(mfr => (
                  <button
                    key={mfr.id}
                    type="button"
                    onClick={() => {
                      setManufacturerInput(mfr.name);
                      onFieldChange('manufacturer_id', mfr.id);
                      setManufacturerOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm ${
                      editData.manufacturer_id === mfr.id
                        ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                        : 'hover:bg-gray-100 dark:hover:bg-[#333333] text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {mfr.name}
                  </button>
                ))
              ) : !showCreateOption && (
                <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                  No manufacturers found
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
    <div>
      <label className="block text-gray-600 dark:text-gray-400 mb-1">
        MFG Part Number <span className="text-red-500">*</span>
      </label>
      <input
        type="text"
        value={editData.manufacturer_pn || editData.manufacturer_part_number || ''}
        onChange={(e) => {
          // Update both fields to ensure consistency (Issue #3)
          onFieldChange('manufacturer_pn', e.target.value);
          onFieldChange('manufacturer_part_number', e.target.value);
        }}
        className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
      />
    </div>

    {/* ROW 4-5: Sub-Category 1-4 */}
    <SubCategoryInputs
      editData={editData}
      onFieldChange={onFieldChange}
      subCat1Ref={subCat1Ref}
      subCat2Ref={subCat2Ref}
      subCat3Ref={subCat3Ref}
      subCat4Ref={subCat4Ref}
      subCat1Open={subCat1Open} setSubCat1Open={setSubCat1Open}
      subCat2Open={subCat2Open} setSubCat2Open={setSubCat2Open}
      subCat3Open={subCat3Open} setSubCat3Open={setSubCat3Open}
      subCat4Open={subCat4Open} setSubCat4Open={setSubCat4Open}
      subCat1Suggestions={subCat1Suggestions}
      subCat2Suggestions={subCat2Suggestions}
      subCat3Suggestions={subCat3Suggestions}
      subCat4Suggestions={subCat4Suggestions}
      setSubCat2Suggestions={setSubCat2Suggestions}
      setSubCat3Suggestions={setSubCat3Suggestions}
      onSubCat1Change={onSubCat1Change}
      onSubCat2Change={onSubCat2Change}
      onSubCat3Change={onSubCat3Change}
    />

    {/* ROW 6: Description */}
    <div className="col-span-2">
      <label className="block text-gray-600 dark:text-gray-400 mb-1">Description</label>
      <textarea
        value={editData.description || ''}
        onChange={(e) => onFieldChange('description', e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
        rows="2"
        placeholder="Brief description of the component"
      />
    </div>

    {/* CAD Files - Unified section with file names and file management */}
    <div className="col-span-2 border-t border-gray-200 dark:border-[#444444] pt-4 mt-2">
      <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">CIS Filename List</h4>
      <div className="grid grid-cols-1 gap-3">
        <CadFieldSection
          field="schematic"
          values={editData.schematic || []}
        />
        <CadFieldSection
          field="pcb_footprint"
          values={editData.pcb_footprint || []}
        />
        <CadFieldSection
          field="pad_file"
          values={editData.pad_file || []}
        />
        <CadFieldSection
          field="step_model"
          values={editData.step_model || []}
        />
        <CadFieldSection
          field="pspice"
          values={editData.pspice || []}
        />
      </div>
      {/* File upload and management */}
      {(editData.manufacturer_pn || isAddMode || isEditMode) && (
        <ComponentFiles
          mfgPartNumber={editData.manufacturer_pn}
          componentId={selectedComponent?.id}
          packageSize={editData.package_size}
          canEdit={true}
          ecoMode={isECOMode}
          showRename={true}
          onTempFileStaged={onTempFileStaged}
          onTempFileRemoved={onTempFileRemoved}
          onFileSoftDeleted={onFileSoftDeleted}
          onCadFileAdded={onCadFileAdded}
          onCadFileRemoved={onCadFileRemoved}
          onCadFileRenamed={onCadFileRenamed}
          onFileUploaded={(category, filename) => {
            // Map upload category to editData field name
            const fieldMap = { footprint: 'pcb_footprint', symbol: 'schematic', model: 'step_model', pspice: 'pspice', pad: 'pad_file' };
            const field = fieldMap[category];
            if (field) {
              // Strip extension - CIS TEXT columns store base names only
              const baseName = filename.replace(/\.[^.]+$/, '');
              // Use functional updater to avoid stale closure when multiple
              // files are extracted from a ZIP and onFileUploaded is called in a loop
              setEditData(prev => {
                const current = Array.isArray(prev[field]) ? prev[field] : [];
                if (!current.includes(baseName)) {
                  return { ...prev, [field]: [...current, baseName] };
                }
                return prev;
              });
            }
          }}
          onFileRenamed={(category, oldFilename, newFilename) => {
            const fieldMap = { footprint: 'pcb_footprint', symbol: 'schematic', model: 'step_model', pspice: 'pspice', pad: 'pad_file' };
            const field = fieldMap[category];
            if (field) {
              // Strip extensions - CIS TEXT columns store base names only
              const oldBase = oldFilename.replace(/\.[^.]+$/, '');
              const newBase = newFilename.replace(/\.[^.]+$/, '');
              setEditData(prev => {
                const current = Array.isArray(prev[field]) ? prev[field] : [];
                return { ...prev, [field]: current.map(f => f === oldBase ? newBase : f) };
              });
            }
          }}
          onFileDeleted={(category, filename) => {
            const fieldMap = { footprint: 'pcb_footprint', symbol: 'schematic', model: 'step_model', pspice: 'pspice', pad: 'pad_file' };
            const field = fieldMap[category];
            if (field) {
              // Strip extension - CIS TEXT columns store base names only
              const baseName = filename.replace(/\.[^.]+$/, '');
              setEditData(prev => {
                const current = Array.isArray(prev[field]) ? prev[field] : [];
                return { ...prev, [field]: current.filter(f => f !== baseName) };
              });
            }
          }}
        />
      )}
    </div>

    {/* Datasheet URL */}
    <div className="col-span-2">
      <label className="block text-gray-600 dark:text-gray-400 mb-1">Datasheet URL</label>
      <input
        type="url"
        value={editData.datasheet_url || ''}
        onChange={(e) => onFieldChange('datasheet_url', e.target.value)}
        placeholder="https://..."
        className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
      />
    </div>

    {/* Distributor Info Section */}
    <div className="col-span-2 border-t border-gray-200 dark:border-[#444444] pt-4 mt-2">
      <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Distributor Info</h4>
      {(editData.distributors || []).map((dist, index) => (
        <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 mb-2">
          <input
            type="text"
            value={dist.distributor_name || ''}
            onChange={(e) => {
              const newDists = [...(editData.distributors || [])];
              newDists[index] = { ...newDists[index], distributor_name: e.target.value };
              onFieldChange('distributors', newDists);
            }}
            placeholder="Distributor (e.g., Digikey)"
            disabled={true}
            className="px-2 py-1 border border-gray-300 dark:border-[#444444] rounded text-xs bg-gray-100 dark:bg-[#2a2a2a] dark:text-gray-100 cursor-not-allowed"
          />
          <input
            type="text"
            value={dist.sku || ''}
            onChange={(e) => {
              const newDists = [...(editData.distributors || [])];
              newDists[index] = { ...newDists[index], sku: e.target.value };
              onFieldChange('distributors', newDists);
            }}
            placeholder="SKU"
            className="px-2 py-1 border border-gray-300 dark:border-[#444444] rounded text-xs bg-white dark:bg-[#333333] dark:text-gray-100"
          />
          <input
            type="text"
            value={dist.url || ''}
            onChange={(e) => {
              const newDists = [...(editData.distributors || [])];
              newDists[index] = { ...newDists[index], url: e.target.value };
              onFieldChange('distributors', newDists);
            }}
            placeholder="URL"
            className="px-2 py-1 border border-gray-300 dark:border-[#444444] rounded text-xs bg-white dark:bg-[#333333] dark:text-gray-100"
          />
          {/* Spacer to maintain grid alignment */}
          <div></div>
        </div>
      ))}
    </div>
  </>
);

export default ComponentEditForm;
