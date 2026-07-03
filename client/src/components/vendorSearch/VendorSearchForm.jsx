import { Search, X } from 'lucide-react';
import { VendorBarcodeScanPanel } from '../common';

const VendorSearchForm = ({
  searchTerm,
  onSearchTermChange,
  onSearch,
  isSearchPending,
  onClearSearch,
  onBarcodeDecode,
}) => {
  return (
    <>
      {/* Search Form */}
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a] shrink-0 mb-6">
        <form onSubmit={onSearch} className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Enter part number or manufacturer part number..."
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              className="w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-[#444444] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={onClearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                title="Clear search"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={isSearchPending}
            className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
          >
            {isSearchPending ? 'Searching...' : 'Search'}
          </button>
        </form>
      </div>

      {/* Vendor Barcode Scanner */}
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a] shrink-0 mb-6">
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Scan Vendor Barcode
        </label>
        <VendorBarcodeScanPanel
          variant="inline"
          onDecode={onBarcodeDecode}
          renderResultExtra={(result) => (
            result.searchTerm
              ? <p className="text-xs mt-2 opacity-75">Search term updated — searching vendors...</p>
              : null
          )}
        />
      </div>
    </>
  );
};

export default VendorSearchForm;
