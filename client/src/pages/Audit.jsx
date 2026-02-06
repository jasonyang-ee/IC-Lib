import { useState, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';
import { Search, Download, Filter, Calendar, ChevronDown, ChevronRight } from 'lucide-react';

const Audit = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activityFilter, setActivityFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [expandedRows, setExpandedRows] = useState(new Set());

  const { data: auditData, isLoading } = useQuery({
    queryKey: ['auditLog'],
    queryFn: async () => {
      const response = await api.getAuditLog();
      return response.data;
    },
  });

  // Toggle row expansion
  const toggleRowExpansion = (id) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Filter data based on search, activity type, and date
  const filteredData = auditData?.filter((item) => {
    // Search filter - search in part_number, user_name, and details JSON
    const detailsStr = item.details ? JSON.stringify(item.details).toLowerCase() : '';
    const matchesSearch = searchTerm === '' ||
      item.part_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      detailsStr.includes(searchTerm.toLowerCase());

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
      } else if (dateFilter === 'sixmonths') {
        const sixMonthsAgo = new Date(today);
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        matchesDate = itemDate >= sixMonthsAgo;
      } else if (dateFilter === 'year') {
        const yearAgo = new Date(today);
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        matchesDate = itemDate >= yearAgo;
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

    const headers = ['Timestamp', 'User', 'Part Number', 'Activity Type', 'Details'];

    const rows = filteredData.map(item => {
      const detailsStr = item.details ? JSON.stringify(item.details) : '';

      return [
        new Date(item.created_at).toLocaleString(),
        item.user_name || '',
        item.part_number || '',
        item.activity_type || '',
        detailsStr.replace(/"/g, '""')
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

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
    // Component operations
    added: {
      bgColor: 'bg-green-100 dark:bg-green-900',
      textColor: 'text-green-800 dark:text-green-200',
      label: 'Component Added'
    },
    updated: {
      bgColor: 'bg-blue-100 dark:bg-blue-900',
      textColor: 'text-blue-800 dark:text-blue-200',
      label: 'Component Updated'
    },
    deleted: {
      bgColor: 'bg-red-100 dark:bg-red-900',
      textColor: 'text-red-800 dark:text-red-200',
      label: 'Component Deleted'
    },
    category_changed: {
      bgColor: 'bg-violet-100 dark:bg-violet-900',
      textColor: 'text-violet-800 dark:text-violet-200',
      label: 'Category Changed'
    },

    // Inventory operations
    inventory_updated: {
      bgColor: 'bg-green-100 dark:bg-green-900',
      textColor: 'text-green-800 dark:text-green-200',
      label: 'Quantity Updated'
    },
    inventory_consumed: {
      bgColor: 'bg-orange-100 dark:bg-orange-900',
      textColor: 'text-orange-800 dark:text-orange-200',
      label: 'Parts Consumed'
    },
    location_updated: {
      bgColor: 'bg-purple-100 dark:bg-purple-900',
      textColor: 'text-purple-800 dark:text-purple-200',
      label: 'Location Updated'
    },

    // Alternative operations
    alternative_added: {
      bgColor: 'bg-cyan-100 dark:bg-cyan-900',
      textColor: 'text-cyan-800 dark:text-cyan-200',
      label: 'Alternative Added'
    },
    alternative_updated: {
      bgColor: 'bg-cyan-100 dark:bg-cyan-900',
      textColor: 'text-cyan-800 dark:text-cyan-200',
      label: 'Alternative Updated'
    },
    alternative_deleted: {
      bgColor: 'bg-red-100 dark:bg-red-900',
      textColor: 'text-red-800 dark:text-red-200',
      label: 'Alternative Deleted'
    },
    alternative_promoted: {
      bgColor: 'bg-cyan-100 dark:bg-cyan-900',
      textColor: 'text-cyan-800 dark:text-cyan-200',
      label: 'Alternative Promoted'
    },

    // Distributor operations
    distributor_updated: {
      bgColor: 'bg-indigo-100 dark:bg-indigo-900',
      textColor: 'text-indigo-800 dark:text-indigo-200',
      label: 'Distributor Updated'
    },

    // Approval operations
    approval_approved: {
      bgColor: 'bg-green-100 dark:bg-green-900',
      textColor: 'text-green-800 dark:text-green-200',
      label: 'Approval: Approved'
    },
    approval_denied: {
      bgColor: 'bg-red-100 dark:bg-red-900',
      textColor: 'text-red-800 dark:text-red-200',
      label: 'Approval: Denied'
    },
    approval_sent_to_review: {
      bgColor: 'bg-yellow-100 dark:bg-yellow-900',
      textColor: 'text-yellow-800 dark:text-yellow-200',
      label: 'Sent to Review'
    },
    approval_sent_to_prototype: {
      bgColor: 'bg-yellow-100 dark:bg-yellow-900',
      textColor: 'text-yellow-800 dark:text-yellow-200',
      label: 'Sent to Prototype'
    },
    // Legacy key (kept for backward compat with old data)
    approval_changed: {
      bgColor: 'bg-yellow-100 dark:bg-yellow-900',
      textColor: 'text-yellow-800 dark:text-yellow-200',
      label: 'Approval Changed'
    },

    // Project operations
    project_created: {
      bgColor: 'bg-teal-100 dark:bg-teal-900',
      textColor: 'text-teal-800 dark:text-teal-200',
      label: 'Project Created'
    },
    project_updated: {
      bgColor: 'bg-teal-100 dark:bg-teal-900',
      textColor: 'text-teal-800 dark:text-teal-200',
      label: 'Project Updated'
    },
    project_deleted: {
      bgColor: 'bg-red-100 dark:bg-red-900',
      textColor: 'text-red-800 dark:text-red-200',
      label: 'Project Deleted'
    },
    component_added_to_project: {
      bgColor: 'bg-lime-100 dark:bg-lime-900',
      textColor: 'text-lime-800 dark:text-lime-200',
      label: 'Added to Project'
    },
    project_component_updated: {
      bgColor: 'bg-lime-100 dark:bg-lime-900',
      textColor: 'text-lime-800 dark:text-lime-200',
      label: 'Project Component Updated'
    },
    component_removed_from_project: {
      bgColor: 'bg-red-100 dark:bg-red-900',
      textColor: 'text-red-800 dark:text-red-200',
      label: 'Removed from Project'
    },

    // ECO operations
    eco_initiated: {
      bgColor: 'bg-amber-100 dark:bg-amber-900',
      textColor: 'text-amber-800 dark:text-amber-200',
      label: 'ECO Initiated'
    },
    eco_approved: {
      bgColor: 'bg-green-100 dark:bg-green-900',
      textColor: 'text-green-800 dark:text-green-200',
      label: 'ECO Approved'
    },
    eco_rejected: {
      bgColor: 'bg-red-100 dark:bg-red-900',
      textColor: 'text-red-800 dark:text-red-200',
      label: 'ECO Rejected'
    },
    eco_stage_advanced: {
      bgColor: 'bg-blue-100 dark:bg-blue-900',
      textColor: 'text-blue-800 dark:text-blue-200',
      label: 'ECO Stage Advanced'
    },

    // User operations
    user_login: {
      bgColor: 'bg-slate-100 dark:bg-slate-800',
      textColor: 'text-slate-700 dark:text-slate-300',
      label: 'User Login'
    },
    user_logout: {
      bgColor: 'bg-slate-100 dark:bg-slate-800',
      textColor: 'text-slate-700 dark:text-slate-300',
      label: 'User Logout'
    },
  };

  // Default config for unknown activity types
  const defaultConfig = {
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    textColor: 'text-gray-700 dark:text-gray-300',
    label: 'Unknown'
  };

  // Render details summary (compact view)
  const renderDetailsSummary = (item) => {
    if (!item.details) return '-';

    const details = item.details;

    if (item.activity_type === 'inventory_updated' || item.activity_type === 'inventory_consumed') {
      return `Qty: ${details.old_quantity} → ${details.new_quantity} (${details.change >= 0 ? '+' : ''}${details.change})`;
    }

    if (item.activity_type === 'location_updated') {
      return `${details.old_location || 'None'} → ${details.new_location}`;
    }

    if (item.activity_type === 'category_changed') {
      return `${details.old_part_number} → ${details.new_part_number}`;
    }

    if (item.activity_type?.startsWith('approval_')) {
      return `${details.old_status || 'None'} → ${details.new_status}`;
    }

    if (item.activity_type === 'updated' && details.updated_fields) {
      const fieldCount = details.updated_fields.length;
      return `${fieldCount} field${fieldCount !== 1 ? 's' : ''} changed`;
    }

    if (item.activity_type === 'added') {
      return details.description ? (details.description.length > 40 ? details.description.substring(0, 40) + '...' : details.description) : 'New component';
    }

    if (item.activity_type === 'alternative_promoted') {
      return `${details.old_primary_manufacturer_pn} → ${details.new_primary_manufacturer_pn}`;
    }

    if (item.activity_type?.startsWith('eco_')) {
      return details.eco_number ? `ECO: ${details.eco_number}` : 'ECO activity';
    }

    if (item.activity_type === 'user_login' || item.activity_type === 'user_logout') {
      return details.username || '';
    }

    if (item.activity_type?.includes('project')) {
      return details.project_name || '';
    }

    const keyCount = Object.keys(details).length;
    return `${keyCount} detail${keyCount !== 1 ? 's' : ''}`;
  };

  // Render expanded details panel
  const renderExpandedDetails = (details) => {
    if (!details || Object.keys(details).length === 0) {
      return <span className="text-gray-500">No details available</span>;
    }

    const formatKey = (key) => {
      return key
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .trim()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    };

    const renderValue = (value) => {
      if (value === null || value === undefined) return <span className="text-gray-400">null</span>;
      if (typeof value === 'boolean') return value ? 'Yes' : 'No';
      if (typeof value === 'object') {
        if (Array.isArray(value)) {
          return (
            <ul className="list-disc list-inside ml-2">
              {value.map((item, idx) => (
                <li key={idx} className="text-gray-700 dark:text-gray-300">
                  {typeof item === 'object' ? JSON.stringify(item) : String(item)}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <div className="ml-4 border-l-2 border-gray-200 dark:border-gray-600 pl-3">
            {Object.entries(value).map(([k, v]) => (
              <div key={k} className="py-1">
                <span className="font-medium text-gray-600 dark:text-gray-400">{formatKey(k)}:</span>{' '}
                {typeof v === 'object' && v !== null ? (
                  <div className="ml-2">
                    {v.old !== undefined && v.new !== undefined ? (
                      <span className="text-gray-700 dark:text-gray-300">
                        <span className="text-red-600 dark:text-red-400 line-through">{String(v.old || 'empty')}</span>
                        {' → '}
                        <span className="text-green-600 dark:text-green-400">{String(v.new || 'empty')}</span>
                      </span>
                    ) : (
                      JSON.stringify(v)
                    )}
                  </div>
                ) : (
                  <span className="text-gray-700 dark:text-gray-300">{String(v)}</span>
                )}
              </div>
            ))}
          </div>
        );
      }
      return String(value);
    };

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
        {Object.entries(details).map(([key, value]) => (
          <div key={key} className="py-1">
            <span className="font-medium text-gray-600 dark:text-gray-400">{formatKey(key)}:</span>{' '}
            <span className="text-gray-800 dark:text-gray-200">{renderValue(value, key)}</span>
          </div>
        ))}
      </div>
    );
  };

  // Group activity types for the filter dropdown
  const filterGroups = [
    { label: 'Components', types: ['added', 'updated', 'deleted', 'category_changed'] },
    { label: 'Inventory', types: ['inventory_updated', 'inventory_consumed', 'location_updated'] },
    { label: 'Alternatives', types: ['alternative_added', 'alternative_updated', 'alternative_deleted', 'alternative_promoted'] },
    { label: 'Distributors', types: ['distributor_updated'] },
    { label: 'Approval', types: ['approval_approved', 'approval_denied', 'approval_sent_to_review', 'approval_sent_to_prototype'] },
    { label: 'Projects', types: ['project_created', 'project_updated', 'project_deleted', 'component_added_to_project', 'project_component_updated', 'component_removed_from_project'] },
    { label: 'ECO', types: ['eco_initiated', 'eco_approved', 'eco_rejected', 'eco_stage_advanced'] },
    { label: 'Users', types: ['user_login', 'user_logout'] },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {auditData?.length || 0} total records
        </div>
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
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
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
              onChange={(e) => {
                setActivityFilter(e.target.value);
                setCurrentPage(1);
              }}
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
              onChange={(e) => {
                setDateFilter(e.target.value);
                setCurrentPage(1);
              }}
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
                  setItemsPerPage(value);
                  setCurrentPage(1);
                }
              }}
              min="1"
              max="1000"
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Audit Table */}
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] flex flex-col flex-1 overflow-hidden">
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
            <div className="overflow-x-auto overflow-y-auto custom-scrollbar flex-1">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-[#333333] sticky top-0">
                  <tr>
                    <th className="w-10 px-2 py-3"></th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Timestamp</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">User</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Part Number</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Activity</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((item) => {
                    const config = activityTypeConfig[item.activity_type] || defaultConfig;
                    const isExpanded = expandedRows.has(item.id);
                    const hasDetails = item.details && Object.keys(item.details).length > 0;

                    return (
                      <Fragment key={item.id}>
                        <tr
                          className={`border-b border-gray-100 dark:border-[#3a3a3a] hover:bg-gray-50 dark:hover:bg-[#333333] ${hasDetails ? 'cursor-pointer' : ''}`}
                          onClick={() => hasDetails && toggleRowExpansion(item.id)}
                        >
                          <td className="px-2 py-3 text-center">
                            {hasDetails && (
                              <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                            {new Date(item.created_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                            {item.user_name || <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                            {item.part_number || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`inline-flex items-center px-2 py-1 rounded ${config.bgColor} ${config.textColor} text-xs font-medium`}>
                              {config.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                            {renderDetailsSummary(item)}
                          </td>
                        </tr>
                        {isExpanded && hasDetails && (
                          <tr className="bg-gray-50 dark:bg-[#252525]">
                            <td colSpan={6} className="px-6 py-4">
                              <div className="text-sm">
                                <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Change Details</h4>
                                {renderExpandedDetails(item.details)}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-[#3a3a3a] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Showing {paginatedData.length} of {filteredData.length} records
                    {filteredData.length !== auditData?.length && ` (filtered from ${auditData?.length} total)`}
                  </div>
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
