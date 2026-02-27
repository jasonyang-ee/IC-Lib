import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';
import { Download } from 'lucide-react';
import { AuditTable, AuditFilters } from '../components/audit';

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
    const detailsStr = item.details ? JSON.stringify(item.details).toLowerCase() : '';
    const matchesSearch = searchTerm === '' ||
      item.part_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      detailsStr.includes(searchTerm.toLowerCase());

    const matchesActivity = activityFilter === 'all' || item.activity_type === activityFilter;

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
      <AuditFilters
        searchTerm={searchTerm}
        onSearchTermChange={(val) => { setSearchTerm(val); setCurrentPage(1); }}
        activityFilter={activityFilter}
        onActivityFilterChange={(val) => { setActivityFilter(val); setCurrentPage(1); }}
        dateFilter={dateFilter}
        onDateFilterChange={(val) => { setDateFilter(val); setCurrentPage(1); }}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={(val) => { setItemsPerPage(val); setCurrentPage(1); }}
      />

      {/* Audit Table */}
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] flex flex-col flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <>
            <AuditTable
              data={paginatedData}
              expandedRows={expandedRows}
              onToggleRow={toggleRowExpansion}
            />

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
