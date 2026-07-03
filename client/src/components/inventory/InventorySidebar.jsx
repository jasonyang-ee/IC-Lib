import { Search, AlertCircle, Download } from 'lucide-react';
import { SidebarCard, FilterSelect, SearchInput, SortControls, VendorBarcodeScanPanel } from '../common';

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
  selectedApprovalStatus,
  onApprovalStatusChange,
  selectedLocation,
  onLocationChange,
  locationOptions,
  searchTerm,
  onSearchChange,
  onSearchClear,
  searchInputRef,
  onSearchKeyDown,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
  onBarcodeDecode,
  barcodeLibraryHit,
  onShowBarcodeLibraryHit,
  isBarcodeLookupPending,
  searchResultCount,
  onNavigateVendorSearch,
  labelTemplates,
  selectedTemplate,
  onTemplateChange,
  lowStock,
}) => (
  <div className="w-64 shrink-0 flex flex-col gap-4 overflow-y-auto custom-scrollbar">

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

    {/* Approval Status Filter */}
    <FilterSelect
      label="Filter by Approval Status"
      value={selectedApprovalStatus}
      onChange={onApprovalStatusChange}
      options={[
        { value: 'new', label: 'New' },
        { value: 'production', label: 'Production' },
        { value: 'reviewing', label: 'Reviewing' },
        { value: 'prototype', label: 'Prototype' },
        { value: 'archived', label: 'Archived' },
      ]}
      placeholder="All Statuses"
    />

    {/* Location Filter */}
    <FilterSelect
      label="Filter by Location"
      value={selectedLocation}
      onChange={onLocationChange}
      options={locationOptions || []}
      placeholder="All Locations"
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
    <SidebarCard title="Scan Vendor Barcode">
      <VendorBarcodeScanPanel
        variant="sidebar"
        autoFocus
        onDecode={onBarcodeDecode}
        renderResultExtra={(result) => {
          if (!result.searchTerm) return null;

          if (barcodeLibraryHit) {
            return (
              <div className="mt-3 pt-3 border-t border-green-300 dark:border-green-800">
                <p className="text-xs mb-2 opacity-75">
                  Found in library as {barcodeLibraryHit.part_number || barcodeLibraryHit.manufacturer_pn}, hidden by current filters.
                </p>
                <button
                  onClick={onShowBarcodeLibraryHit}
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2 px-3 rounded text-xs font-medium transition-colors"
                >
                  Clear Filters &amp; Show Part
                </button>
              </div>
            );
          }

          if (searchResultCount === 0) {
            if (isBarcodeLookupPending) {
              return <p className="text-xs mt-2 opacity-75">Checking library...</p>;
            }
            return (
              <div className="mt-3 pt-3 border-t border-green-300 dark:border-green-800">
                <p className="text-xs mb-2 opacity-75">Part not found in inventory.</p>
                <button
                  onClick={() => onNavigateVendorSearch(result.searchTerm)}
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2 px-3 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1"
                >
                  <Search className="w-3 h-3" />
                  Search Vendor for &quot;{result.searchTerm}&quot;
                </button>
              </div>
            );
          }

          return <p className="text-xs mt-2 opacity-75">Searching for this part...</p>;
        }}
      />
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

    <div className="flex-1" />

    {/* Download Label Template */}
    <SidebarCard title="Download Label Template">
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
  </div>
);

export default InventorySidebar;
