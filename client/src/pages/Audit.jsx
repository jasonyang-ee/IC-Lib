import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';
import { Search, Download, Filter, Package, Edit, Trash2, TrendingUp, Minus, MapPin, Calendar } from 'lucide-react';

const Audit = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activityFilter, setActivityFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all'); // all, today, week, month
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const { data: auditData, isLoading } = useQuery({
    queryKey: ['auditLog'],
    queryFn: async () => {
      const response = await api.getAuditLog();
      return response.data;
    },
  });

  // Filter data based on search, activity type, and date
  const filteredData = auditData?.filter((item) => {
    // Search filter
    const matchesSearch = searchTerm === '' || 
      item.part_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category_name?.toLowerCase().includes(searchTerm.toLowerCase());

    // Activity type filter
    const matchesActivity = activityFilter === 'all' || item.activity_type === activityFilter;

    // Date filter
    let matchesDate = true;
    if (dateFilter !== 'all') {
      const itemDate = new Date(item.created_at);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      if (dateFilter === 'today') {
        matchesDate = itemDate >= today;
      } else if (dateFilter === 'week') {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        matchesDate = itemDate >= weekAgo;
      } else if (dateFilter === 'month') {
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        matchesDate = itemDate >= monthAgo;
      }
    }

    return matchesSearch && matchesActivity && matchesDate;
  }) || [];

  // Pagination
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Export to CSV
  const exportToCSV = () => {
    if (!filteredData || filteredData.length === 0) {
      alert('No data to export');
      return;
    }

    // Create CSV header
    const headers = ['Timestamp', 'Part Number', 'Description', 'Category', 'Activity Type', 'Change Details'];
    
    // Create CSV rows
    const rows = filteredData.map(item => {
      let changeDetails = '';
      if (item.change_details) {
        const details = item.change_details;
        if (item.activity_type === 'inventory_updated' || item.activity_type === 'inventory_consumed') {
          changeDetails = `Quantity: ${details.old_quantity} → ${details.new_quantity} (${details.change >= 0 ? '+' : ''}${details.change})`;
        } else if (item.activity_type === 'location_updated') {
          changeDetails = `Location: ${details.old_location || 'None'} → ${details.new_location}`;
        }
      }

      return [
        new Date(item.created_at).toLocaleString(),
        item.part_number || '',
        (item.description || '').replace(/"/g, '""'), // Escape quotes
        item.category_name || '',
        item.activity_type || '',
        changeDetails
      ];
    });

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `audit_log_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activityTypeConfig = {
    added: {
      icon: Package,
      bgColor: 'bg-green-100 dark:bg-green-900',
      textColor: 'text-green-800 dark:text-green-200',
      label: 'Component Added'
    },
    updated: {
      icon: Edit,
      bgColor: 'bg-blue-100 dark:bg-blue-900',
      textColor: 'text-blue-800 dark:text-blue-200',
      label: 'Component Updated'
    },
    deleted: {
      icon: Trash2,
      bgColor: 'bg-red-100 dark:bg-red-900',
      textColor: 'text-red-800 dark:text-red-200',
      label: 'Component Deleted'
    },
    inventory_updated: {
      icon: TrendingUp,
      bgColor: 'bg-green-100 dark:bg-green-900',
      textColor: 'text-green-800 dark:text-green-200',
      label: 'Quantity Updated'
    },
    inventory_consumed: {
      icon: Minus,
      bgColor: 'bg-orange-100 dark:bg-orange-900',
      textColor: 'text-orange-800 dark:text-orange-200',
      label: 'Parts Consumed'
    },
    location_updated: {
      icon: MapPin,
      bgColor: 'bg-purple-100 dark:bg-purple-900',
      textColor: 'text-purple-800 dark:text-purple-200',
      label: 'Location Updated'
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        
        <button
          onClick={exportToCSV}
          className="btn-primary flex items-center gap-2"
          disabled={!filteredData || filteredData.length === 0}
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Search className="w-4 h-4 inline mr-1" />
              Search
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Part number, description..."
              className="input w-full"
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
              onChange={(e) => {
                setActivityFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="input w-full"
            >
              <option value="all">All Activities</option>
              <option value="added">Component Added</option>
              <option value="updated">Component Updated</option>
              <option value="deleted">Component Deleted</option>
              <option value="inventory_updated">Quantity Updated</option>
              <option value="inventory_consumed">Parts Consumed</option>
              <option value="location_updated">Location Updated</option>
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
              onChange={(e) => {
                setDateFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="input w-full"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
            </select>
          </div>
        </div>

        {/* Results count */}
        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          Showing {paginatedData.length} of {filteredData.length} records
          {filteredData.length !== auditData?.length && ` (filtered from ${auditData?.length} total)`}
        </div>
      </div>

      {/* Audit Table */}
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : paginatedData.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            No audit records found
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-[#333333]">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Timestamp</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Part Number</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Description</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Category</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Activity</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((item) => {
                    const config = activityTypeConfig[item.activity_type] || activityTypeConfig.updated;
                    const IconComponent = config.icon;

                    let changeDetails = '';
                    if (item.change_details) {
                      const details = item.change_details;
                      if (item.activity_type === 'inventory_updated' || item.activity_type === 'inventory_consumed') {
                        changeDetails = `${details.old_quantity} → ${details.new_quantity} (${details.change >= 0 ? '+' : ''}${details.change})`;
                      } else if (item.activity_type === 'location_updated') {
                        changeDetails = `${details.old_location || 'None'} → ${details.new_location}`;
                      }
                    }

                    return (
                      <tr key={item.id} className="border-b border-gray-100 dark:border-[#3a3a3a] hover:bg-gray-50 dark:hover:bg-[#333333]">
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                          {new Date(item.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                          {item.part_number}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          {item.description?.substring(0, 50) || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          {item.category_name || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded ${config.bgColor} ${config.textColor} text-xs font-medium`}>
                            <IconComponent className="w-3 h-3" />
                            {config.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {changeDetails || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-[#3a3a3a] flex items-center justify-between">
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Audit;
