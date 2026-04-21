import { forwardRef } from 'react';
import { Search, X, Filter } from 'lucide-react';
import { PIPELINE_TYPE_FILTER_OPTIONS } from '../../utils/ecoPipelineTypes';

const ECOSidebar = forwardRef(({
  selectedStatus,
  onStatusChange,
  searchTerm,
  onSearchTermChange,
  ecoNumberFilter,
  onEcoNumberFilterChange,
  initiatedByFilter,
  onInitiatedByFilterChange,
  uniqueInitiators,
  pipelineTypeFilter,
  onPipelineTypeFilterChange
}, ref) => {
  return (
    <div className="w-80 shrink-0 space-y-4 overflow-y-auto custom-scrollbar">

      {/* Status Filter */}
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
        <label className="block text- font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Status Filter
        </label>
        <div className="flex flex-col gap-1">
          {['pending', 'approved', 'rejected'].map((status) => (
            <button
              key={status}
              onClick={() => onStatusChange(status)}
              className={`px-3 py-2 text-sm capitalize rounded-md transition-colors text-left ${
                selectedStatus === status
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#3a3a3a]'
              }`}
            >
              <span className="flex items-center gap-2 text-lg">
                {status === 'pending' ? 'pending / in review' : status}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Part Number Search */}
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Search Part Number
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={ref}
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            onFocus={(e) => e.target.select()}
            placeholder="Search part number or description..."
            className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
          />
          {searchTerm && (
            <button
              onClick={() => {
                onSearchTermChange('');
                if (ref?.current) {
                  ref.current.focus();
                }
              }}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ECO Number Filter */}
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          ECO Number
        </label>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={ecoNumberFilter}
            onChange={(e) => onEcoNumberFilterChange(e.target.value)}
            onFocus={(e) => e.target.select()}
            placeholder="Filter by ECO number..."
            className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
          />
          {ecoNumberFilter && (
            <button
              onClick={() => onEcoNumberFilterChange('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title="Clear"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Initiated By Filter */}
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Initiated By
        </label>
        <select
          value={initiatedByFilter}
          onChange={(e) => onInitiatedByFilterChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
        >
          <option value="">All Users</option>
          {uniqueInitiators.map((user) => (
            <option key={user} value={user}>
              {user}
            </option>
          ))}
        </select>
      </div>

      {/* ECO Tag Filter */}
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          ECO Tag
        </label>
        <select
          value={pipelineTypeFilter || ''}
          onChange={(e) => onPipelineTypeFilterChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
        >
          {PIPELINE_TYPE_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
});

ECOSidebar.displayName = 'ECOSidebar';

export default ECOSidebar;
