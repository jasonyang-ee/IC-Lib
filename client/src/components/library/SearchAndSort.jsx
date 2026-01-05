import { useRef } from 'react';
import { Search, X, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * SearchAndSort - Search box with part number navigation and sorting controls
 */
const SearchAndSort = ({
  searchTerm,
  onSearchChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
  selectedApprovalStatus,
  onApprovalStatusChange,
  parsePartNumber,
  onPreviousPart,
  onNextPart,
}) => {
  const searchInputRef = useRef(null);
  const parsedPart = parsePartNumber?.(searchTerm);

  return (
    <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a] flex-shrink-0">
      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Search</h3>
      
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Full data search ..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.target.select();
            }
          }}
          className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
        />
        {searchTerm && (
          <button
            onClick={() => {
              onSearchChange('');
              searchInputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            title="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Part Number Navigation */}
      {searchTerm && parsedPart && (
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={onPreviousPart}
            disabled={parsedPart?.number <= 1}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 dark:bg-[#333333] hover:bg-gray-200 dark:hover:bg-[#3a3a3a] text-gray-700 dark:text-gray-300 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            title="Previous part number"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          <button
            onClick={onNextPart}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 dark:bg-[#333333] hover:bg-gray-200 dark:hover:bg-[#3a3a3a] text-gray-700 dark:text-gray-300 rounded-md transition-colors text-sm font-medium"
            title="Next part number"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sorting Controls */}
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600 dark:text-gray-400 w-[50px]">Sort:</label>
          <select
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value)}
            className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-[#444444] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
          >
            <option value="part_number">Part Number</option>
            <option value="manufacturer_pn">MFG Part Number</option>
            <option value="value">Value</option>
            <option value="description">Description</option>
            <option value="created_at">Date Added</option>
            <option value="updated_at">Last Edited</option>
          </select>
        </div>
        
        {/* Sort Order Toggle */}
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600 dark:text-gray-400 w-[45px]">Order:</label>
          <div className="flex-1 flex gap-2">
            <button
              onClick={() => onSortOrderChange('asc')}
              className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                sortOrder === 'asc'
                  ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 border border-primary-300 dark:border-primary-700'
                  : 'bg-gray-100 dark:bg-[#333333] text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-[#444444] hover:bg-gray-200 dark:hover:bg-[#3a3a3a]'
              }`}
              title="Ascending"
            >
              ↑ Asc
            </button>
            <button
              onClick={() => onSortOrderChange('desc')}
              className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                sortOrder === 'desc'
                  ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 border border-primary-300 dark:border-primary-700'
                  : 'bg-gray-100 dark:bg-[#333333] text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-[#444444] hover:bg-gray-200 dark:hover:bg-[#3a3a3a]'
              }`}
              title="Descending"
            >
              ↓ Desc
            </button>
          </div>
        </div>

        {/* Approval Status Filter */}
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600 dark:text-gray-400 w-[45px]">Status:</label>
          <select
            value={selectedApprovalStatus}
            onChange={(e) => onApprovalStatusChange(e.target.value)}
            className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-[#444444] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
          >
            <option value="">All Status</option>
            <option value="new">New</option>
            <option value="pending_review">Pending Review</option>
            <option value="experimental">Experimental</option>
            <option value="approved">Approved</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export default SearchAndSort;
