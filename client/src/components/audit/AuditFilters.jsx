import { Search, Filter, Calendar } from 'lucide-react';
import { activityTypeConfig, filterGroups } from './constants';

const AuditFilters = ({
  searchTerm,
  onSearchTermChange,
  activityFilter,
  onActivityFilterChange,
  dateFilter,
  onDateFilterChange,
  itemsPerPage,
  onItemsPerPageChange,
}) => (
  <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a] mb-6 shrink-0">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Search */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          <Search className="w-4 h-4 inline mr-1" />
          Search
        </label>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
          placeholder="Part number, user, details..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
        />
      </div>

      {/* Activity Type Filter */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          <Filter className="w-4 h-4 inline mr-1" />
          Activity Type
        </label>
        <select
          value={activityFilter}
          onChange={(e) => onActivityFilterChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm custom-scrollbar"
        >
          <option value="all">All Activities</option>
          {filterGroups.map(group => (
            <optgroup key={group.label} label={group.label}>
              {group.types.map(type => (
                <option key={type} value={type}>
                  {activityTypeConfig[type]?.label || type}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Date Filter */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          <Calendar className="w-4 h-4 inline mr-1" />
          Date Range
        </label>
        <select
          value={dateFilter}
          onChange={(e) => onDateFilterChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm custom-scrollbar"
        >
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="week">Last 7 Days</option>
          <option value="month">Last 30 Days</option>
          <option value="sixmonths">Last 6 Months</option>
          <option value="year">Last 1 Year</option>
        </select>
      </div>

      {/* Items per page */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Items per page
        </label>
        <input
          type="number"
          value={itemsPerPage}
          onChange={(e) => {
            const value = parseInt(e.target.value, 10);
            if (value > 0 && value <= 1000) {
              onItemsPerPageChange(value);
            }
          }}
          min="1"
          max="1000"
          className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
        />
      </div>
    </div>
  </div>
);

export default AuditFilters;
