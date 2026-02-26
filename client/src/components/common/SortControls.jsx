const SortControls = ({ sortBy, onSortByChange, sortOptions, sortOrder, onSortOrderChange }) => (
  <div className="mt-3 space-y-2">
    <div className="flex items-center gap-3">
      <label className="text-sm text-gray-600 dark:text-gray-400 w-13">Sort:</label>
      <select
        value={sortBy}
        onChange={(e) => onSortByChange(e.target.value)}
        className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-[#444444] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
      >
        {sortOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>

    <div className="flex items-center gap-3">
      <label className="text-sm text-gray-600 dark:text-gray-400 w-13">Order:</label>
      <div className="flex-1 flex items-center gap-2 border border-gray-300 dark:border-[#444444] rounded-md p-1">
        <button
          onClick={() => onSortOrderChange('asc')}
          className={`flex-1 py-1 text-xs rounded transition-colors ${
            sortOrder === 'asc'
              ? 'bg-primary-600 text-white'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#3a3a3a]'
          }`}
          title="Ascending"
        >
          ↑ Asc
        </button>
        <button
          onClick={() => onSortOrderChange('desc')}
          className={`flex-1 py-1 text-xs rounded transition-colors ${
            sortOrder === 'desc'
              ? 'bg-primary-600 text-white'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#3a3a3a]'
          }`}
          title="Descending"
        >
          ↓ Desc
        </button>
      </div>
    </div>
  </div>
);

export default SortControls;
