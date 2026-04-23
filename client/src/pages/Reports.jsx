import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Download, FileText, PieChart } from 'lucide-react';
import { api } from '../utils/api';
import { SidebarCard } from '../components/common';
import { useNotification } from '../contexts/NotificationContext';

const REPORTS = [
  {
    id: 'library-quality',
    name: 'Library Quality',
    description: 'Same undefined and missing CAD-health totals used by the dashboard.',
    icon: FileText,
  },
  {
    id: 'component-summary',
    name: 'CAD Coverage By Category',
    description: 'Assigned CAD coverage counts per category using the live component fields.',
    icon: PieChart,
  },
  {
    id: 'category-distribution',
    name: 'Category Distribution',
    description: 'Component count and share for each category.',
    icon: BarChart3,
  },
  {
    id: 'inventory-value',
    name: 'Estimated Inventory Value',
    description: 'Estimated from the lowest-break distributor pricing attached to each stocked component.',
    icon: FileText,
  },
  {
    id: 'footprint-issues',
    name: 'Footprint Issues',
    description: 'Components with no assigned footprint or with assigned footprint files marked missing.',
    icon: FileText,
  },
  {
    id: 'manufacturer',
    name: 'Manufacturer Coverage',
    description: 'Component counts grouped by assigned manufacturer, including unassigned parts.',
    icon: FileText,
  },
  {
    id: 'low-stock',
    name: 'Low Stock',
    description: 'Inventory items currently at or below their configured minimum quantity.',
    icon: FileText,
  },
];

const buildLibraryQualityRows = (stats = {}) => {
  const totalComponents = Number(stats.totalComponents || 0);
  const rows = [
    {
      type: 'Schematic',
      undefined_count: Number(stats.undefinedSchematic || 0),
      missing_count: Number(stats.missingSchematic || 0),
    },
    {
      type: 'Footprint',
      undefined_count: Number(stats.undefinedFootprints || 0),
      missing_count: Number(stats.missingFootprints || 0),
    },
    {
      type: 'Pad',
      undefined_count: Number(stats.undefinedPad || 0),
      missing_count: Number(stats.missingPad || 0),
    },
    {
      type: '3D Model',
      undefined_count: Number(stats.undefined3DModel || 0),
      missing_count: Number(stats.missing3DModel || 0),
    },
    {
      type: 'PSpice',
      undefined_count: Number(stats.undefinedPspice || 0),
      missing_count: Number(stats.missingPspice || 0),
    },
  ];

  return rows.map((row) => ({
    ...row,
    health: totalComponents > 0
      ? ((totalComponents - row.undefined_count) / totalComponents) * 100
      : 0,
  }));
};

const getHealthTextClass = (health) => {
  if (health < 50) {
    return 'text-red-600 dark:text-red-400';
  }
  if (health < 80) {
    return 'text-yellow-600 dark:text-yellow-400';
  }
  return 'text-green-600 dark:text-green-400';
};

const formatCurrency = (value) => `$${Number(value || 0).toFixed(2)}`;

const Reports = () => {
  const [activeReport, setActiveReport] = useState('library-quality');
  const { showSuccess, showError } = useNotification();
  const activeReportMeta = REPORTS.find((report) => report.id === activeReport) || REPORTS[0];

  const { data: reportData = [], isLoading } = useQuery({
    queryKey: ['report', activeReport],
    queryFn: async () => {
      switch (activeReport) {
        case 'library-quality': {
          const response = await api.getDashboardStats();
          return buildLibraryQualityRows(response.data);
        }
        case 'component-summary':
          return (await api.getComponentSummary()).data;
        case 'category-distribution':
          return (await api.getCategoryDistribution()).data;
        case 'inventory-value':
          return (await api.getInventoryValue()).data;
        case 'footprint-issues':
          return (await api.getMissingFootprints()).data;
        case 'manufacturer':
          return (await api.getManufacturerReport()).data;
        case 'low-stock':
          return (await api.getLowStockReport()).data;
        default:
          return [];
      }
    },
  });

  const renderReportContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      );
    }

    if (!reportData || reportData.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          No data available for this report
        </div>
      );
    }

    switch (activeReport) {
      case 'library-quality':
        return (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-[#333333]">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Type</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Undefined</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Missing File</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Health</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((row) => (
                <tr key={row.type} className="border-b border-gray-100 dark:border-[#3a3a3a]">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{row.type}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">{row.undefined_count}</td>
                  <td className={`px-4 py-3 text-sm text-right ${row.missing_count > 0 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-900 dark:text-gray-100'}`}>
                    {row.missing_count}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right font-semibold ${getHealthTextClass(row.health)}`}>
                    {row.health.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      case 'component-summary':
        return (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-[#333333]">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Category</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Components</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Footprint</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Schematic</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">3D Model</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Pad</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">PSpice</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((row) => (
                <tr key={row.category} className="border-b border-gray-100 dark:border-[#3a3a3a]">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{row.category}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">{row.total_components}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">{row.with_footprint}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">{row.with_symbol}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">{row.with_3d_model}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">{row.with_pad}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">{row.with_pspice}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      case 'category-distribution':
        return (
          <div className="space-y-4">
            {reportData.map((row) => (
              <div key={row.category} className="flex items-center gap-4">
                <div className="w-32 text-sm font-medium text-gray-700 dark:text-gray-300">{row.category}</div>
                <div className="flex-1 flex items-center gap-3">
                  <div className="flex-1 bg-gray-200 dark:bg-[#333333] rounded-full h-6">
                    <div
                      className="bg-primary-600 h-6 rounded-full flex items-center justify-end pr-2"
                      style={{ width: `${Math.min(Number(row.percentage) || 0, 100)}%` }}
                    >
                      <span className="text-xs text-white font-medium">{row.percentage}%</span>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 w-16 text-right">
                    {row.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        );

      case 'inventory-value':
        return (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-[#333333]">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Category</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Estimated Value</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Total Quantity</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Stocked Components</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Priced</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((row) => {
                const coverage = Number(row.unique_components) > 0
                  ? (Number(row.priced_components) / Number(row.unique_components)) * 100
                  : 0;

                return (
                  <tr key={row.category} className="border-b border-gray-100 dark:border-[#3a3a3a]">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{row.category}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-green-600 dark:text-green-400">
                      {formatCurrency(row.total_value)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">{row.total_quantity || 0}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">{row.unique_components || 0}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">
                      {row.priced_components || 0}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right font-semibold ${getHealthTextClass(coverage)}`}>
                      {coverage.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        );

      case 'footprint-issues':
        return (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-[#333333]">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Part Number</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">MFR Part Number</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Category</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Manufacturer</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Issue</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Assigned Footprints</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((row) => (
                <tr key={row.id} className="border-b border-gray-100 dark:border-[#3a3a3a]">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{row.part_number}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{row.manufacturer_part_number || 'N/A'}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{row.category_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{row.manufacturer_name}</td>
                  <td className={`px-4 py-3 text-sm font-semibold ${row.issue_type === 'Missing file' ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                    {row.issue_type}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{row.assigned_footprints || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      case 'manufacturer':
        return (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-[#333333]">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Manufacturer</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Component Count</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Category Count</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((row) => (
                <tr key={row.manufacturer} className="border-b border-gray-100 dark:border-[#3a3a3a]">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{row.manufacturer}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">{row.component_count}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">{row.category_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      case 'low-stock':
        return (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-[#333333]">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Part Number</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Category</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Current Stock</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Minimum Stock</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Shortage</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Location</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((row) => (
                <tr key={`${row.part_number}-${row.location || 'unassigned'}`} className="border-b border-gray-100 dark:border-[#3a3a3a]">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{row.part_number}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{row.category}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">{row.current_stock}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">{row.minimum_stock}</td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-red-600 dark:text-red-400">{row.shortage}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{row.location || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      default:
        return <div className="text-gray-900 dark:text-gray-100">Report not implemented</div>;
    }
  };

  const exportToCSV = () => {
    if (!reportData || reportData.length === 0) {
      showError('No data to export');
      return;
    }

    try {
      let headers = [];
      let rows = [];

      switch (activeReport) {
        case 'library-quality':
          headers = ['Type', 'Undefined', 'Missing File', 'Health'];
          rows = reportData.map((row) => [
            row.type,
            row.undefined_count,
            row.missing_count,
            `${row.health.toFixed(1)}%`,
          ]);
          break;

        case 'component-summary':
          headers = ['Category', 'Components', 'Footprint', 'Schematic', '3D Model', 'Pad', 'PSpice'];
          rows = reportData.map((row) => [
            row.category,
            row.total_components,
            row.with_footprint,
            row.with_symbol,
            row.with_3d_model,
            row.with_pad,
            row.with_pspice,
          ]);
          break;

        case 'category-distribution':
          headers = ['Category', 'Count', 'Percentage'];
          rows = reportData.map((row) => [
            row.category,
            row.count,
            `${row.percentage}%`,
          ]);
          break;

        case 'inventory-value':
          headers = ['Category', 'Estimated Value', 'Total Quantity', 'Stocked Components', 'Priced Components', 'Unpriced Components'];
          rows = reportData.map((row) => [
            row.category,
            formatCurrency(row.total_value),
            row.total_quantity || 0,
            row.unique_components || 0,
            row.priced_components || 0,
            row.unpriced_components || 0,
          ]);
          break;

        case 'footprint-issues':
          headers = ['Part Number', 'MFR Part Number', 'Category', 'Manufacturer', 'Issue', 'Assigned Footprints'];
          rows = reportData.map((row) => [
            row.part_number,
            row.manufacturer_part_number || 'N/A',
            row.category_name,
            row.manufacturer_name,
            row.issue_type,
            row.assigned_footprints || '-',
          ]);
          break;

        case 'manufacturer':
          headers = ['Manufacturer', 'Component Count', 'Category Count'];
          rows = reportData.map((row) => [
            row.manufacturer,
            row.component_count,
            row.category_count,
          ]);
          break;

        case 'low-stock':
          headers = ['Part Number', 'Category', 'Current Stock', 'Minimum Stock', 'Shortage', 'Location'];
          rows = reportData.map((row) => [
            row.part_number,
            row.category,
            row.current_stock,
            row.minimum_stock,
            row.shortage,
            row.location || 'N/A',
          ]);
          break;

        default:
          showError('Export not supported for this report type');
          return;
      }

      const escapeCSV = (value) => {
        const str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const csvContent = [
        headers.map(escapeCSV).join(','),
        ...rows.map((row) => row.map(escapeCSV).join(',')),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${activeReportMeta.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showSuccess(`Exported ${rows.length} rows to CSV`);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      showError('Failed to export CSV');
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="grid grid-cols-12 gap-6 flex-1 overflow-hidden">
        <div className="col-span-3 overflow-y-auto custom-scrollbar">
          <SidebarCard title="Report Types">
            <div className="space-y-2">
              {REPORTS.map((report) => (
                <button
                  key={report.id}
                  onClick={() => setActiveReport(report.id)}
                  className={`w-full text-left px-3 py-2 rounded flex items-center gap-2 ${
                    activeReport === report.id
                      ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 font-medium'
                      : 'hover:bg-gray-100 dark:hover:bg-[#333333] text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <report.icon className="w-4 h-4" />
                  {report.name}
                </button>
              ))}
            </div>
          </SidebarCard>
        </div>

        <div className="col-span-9 flex flex-col overflow-hidden">
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] flex flex-col overflow-hidden h-full">
            <div className="p-4 border-b border-gray-200 dark:border-[#3a3a3a] flex justify-between items-start gap-4 shrink-0">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {activeReportMeta.name}
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {activeReportMeta.description}
                </p>
              </div>
              <button
                onClick={exportToCSV}
                disabled={!reportData || reportData.length === 0}
                className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">{renderReportContent()}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;