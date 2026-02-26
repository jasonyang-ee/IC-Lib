import { Search, QrCode, Camera, AlertCircle, Download } from 'lucide-react';
import { SidebarCard, FilterSelect, SearchInput, SortControls } from '../common';

const SORT_OPTIONS = [
  { value: 'part_number', label: 'Part Number' },
  { value: 'manufacturer_pn', label: 'MFG Part Number' },
  { value: 'quantity', label: 'Quantity' },
  { value: 'location', label: 'Location' },
  { value: 'minimum_quantity', label: 'Min Quantity' },
  { value: 'updated_at', label: 'Last Edited' },
];

const InventorySidebar = ({
  categories,
  selectedCategory,
  onCategoryChange,
  projects,
  selectedProject,
  onProjectChange,
  searchTerm,
  onSearchChange,
  onSearchClear,
  searchInputRef,
  onSearchKeyDown,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
  vendorBarcode,
  onVendorBarcodeChange,
  vendorBarcodeInputRef,
  onVendorBarcodeScan,
  onClearVendorBarcode,
  barcodeDecodeResult,
  onStartCameraScanner,
  searchResultCount,
  onNavigateVendorSearch,
  labelTemplates,
  selectedTemplate,
  onTemplateChange,
  lowStock,
}) => (
  <div className="w-80 shrink-0 space-y-4 overflow-y-auto custom-scrollbar">

    {/* Category Filter */}
    <FilterSelect
      label="Filter by Category"
      value={selectedCategory}
      onChange={onCategoryChange}
      options={categories?.map((cat) => ({ value: cat.name, label: cat.name })) || []}
      placeholder="All Categories"
    />

    {/* Project Filter */}
    <FilterSelect
      label="Filter by Project"
      value={selectedProject}
      onChange={onProjectChange}
      options={projects?.map((proj) => ({ value: proj.id, label: proj.name })) || []}
      placeholder="All Projects"
    />

    {/* Search Box with Sort Controls */}
    <SidebarCard title="Search Inventory">
      <SearchInput
        value={searchTerm}
        onChange={onSearchChange}
        onClear={onSearchClear}
        placeholder="Full data search ..."
        helperText="Searches all fields including distributor SKUs"
        inputRef={searchInputRef}
        onKeyDown={onSearchKeyDown}
      >
        <SortControls
          sortBy={sortBy}
          onSortByChange={onSortByChange}
          sortOptions={SORT_OPTIONS}
          sortOrder={sortOrder}
          onSortOrderChange={onSortOrderChange}
        />
      </SearchInput>
    </SidebarCard>

    {/* Vendor Barcode Scanner */}
    <SidebarCard title="Scan Vendor Barcode" icon={QrCode}>
      <div className="space-y-2">
        <input
          ref={vendorBarcodeInputRef}
          type="text"
          value={vendorBarcode}
          onChange={(e) => onVendorBarcodeChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onVendorBarcodeScan();
            }
          }}
          placeholder="Scan Digikey or Mouser barcode..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
        />
        <div className="flex gap-2">
          <button
            onClick={onVendorBarcodeScan}
            disabled={!vendorBarcode.trim()}
            className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white py-1.5 px-3 rounded-md text-sm font-medium transition-colors"
          >
            Decode
          </button>
          <button
            onClick={onClearVendorBarcode}
            className="bg-gray-500 hover:bg-gray-600 text-white py-1.5 px-3 rounded-md text-sm font-medium transition-colors"
          >
            Clear
          </button>
          <button
            onClick={onStartCameraScanner}
            className="bg-blue-600 hover:bg-blue-700 text-white py-1.5 px-3 rounded-md text-sm font-medium transition-colors flex items-center gap-1"
            title="Scan with camera"
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>

        {barcodeDecodeResult && (
          <div className={`mt-2 p-3 rounded-md text-sm ${
            barcodeDecodeResult.error
              ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-200'
              : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/50 text-green-800 dark:text-green-200'
          }`}>
            {barcodeDecodeResult.error ? (
              <p>{barcodeDecodeResult.error}</p>
            ) : (
              <div className="space-y-1">
                <p className="font-semibold">{barcodeDecodeResult.vendor} Barcode Decoded:</p>
                {barcodeDecodeResult.manufacturerPN && (
                  <p>MFG P/N: <span className="font-mono">{barcodeDecodeResult.manufacturerPN}</span></p>
                )}
                {barcodeDecodeResult.digikeySKU && (
                  <p>Digikey SKU: <span className="font-mono">{barcodeDecodeResult.digikeySKU}</span></p>
                )}
                {barcodeDecodeResult.mouserSKU && (
                  <p>Mouser SKU: <span className="font-mono">{barcodeDecodeResult.mouserSKU}</span></p>
                )}
                {barcodeDecodeResult.quantity && (
                  <p>Quantity: {barcodeDecodeResult.quantity}</p>
                )}
                {/* Show button to search vendor if no results in inventory */}
                {searchTerm && searchResultCount !== undefined && searchResultCount === 0 && barcodeDecodeResult.manufacturerPN && (
                  <div className="mt-3 pt-3 border-t border-green-300 dark:border-green-800">
                    <p className="text-xs mb-2 opacity-75">Part not found in inventory.</p>
                    <button
                      onClick={() => onNavigateVendorSearch(barcodeDecodeResult.manufacturerPN)}
                      className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2 px-3 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1"
                    >
                      <Search className="w-3 h-3" />
                      Search Vendor for &quot;{barcodeDecodeResult.manufacturerPN}&quot;
                    </button>
                  </div>
                )}
                {(!searchTerm || (searchResultCount !== undefined && searchResultCount > 0)) && (
                  <p className="text-xs mt-2 opacity-75">Searching for this part...</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        Supports Digikey 2D Data Matrix and Mouser Code 128 barcodes
      </p>
    </SidebarCard>

    {/* Label Template */}
    <SidebarCard title="Label Template">
      <div className="flex gap-2">
        <select
          value={selectedTemplate}
          onChange={(e) => onTemplateChange(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
        >
          <option value="">Select template...</option>
          {labelTemplates?.map((t) => (
            <option key={t.name} value={t.name}>
              {t.name}
            </option>
          ))}
        </select>
        <a
          href={selectedTemplate ? `${import.meta.env.VITE_API_URL || '/api'}/settings/label-templates/${encodeURIComponent(selectedTemplate)}` : undefined}
          download
          className={`flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            selectedTemplate
              ? 'bg-primary-600 hover:bg-primary-700 text-white'
              : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 pointer-events-none'
          }`}
        >
          <Download className="w-4 h-4" />
        </a>
      </div>
    </SidebarCard>

    {/* Low Stock Alert */}
    {lowStock && lowStock.length > 0 && (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/50 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-500" />
          <h3 className="font-semibold text-yellow-900 dark:text-yellow-300">Low Stock Alert</h3>
        </div>
        <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
          {lowStock.length} item(s) running low
        </p>
      </div>
    )}
  </div>
);

export default InventorySidebar;
