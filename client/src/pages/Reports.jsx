import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';
import { FileText, Download, PieChart, BarChart3 } from 'lucide-react';

const Reports = () => {
  const [activeReport, setActiveReport] = useState('component-summary');

  const reports = [
    { id: 'component-summary', name: 'Component Summary', icon: PieChart },
    { id: 'category-distribution', name: 'Category Distribution', icon: BarChart3 },
    { id: 'inventory-value', name: 'Inventory Value', icon: FileText },
    { id: 'missing-footprints', name: 'Missing Footprints', icon: FileText },
    { id: 'manufacturer', name: 'Manufacturer Report', icon: FileText },
    { id: 'low-stock', name: 'Low Stock Report', icon: FileText },
  ];

  const { data: reportData, isLoading } = useQuery({
    queryKey: ['report', activeReport],
    queryFn: async () => {
      switch (activeReport) {
        case 'component-summary':
          return (await api.getComponentSummary()).data;
        case 'category-distribution':
          return (await api.getCategoryDistribution()).data;
        case 'inventory-value':
          return (await api.getInventoryValue()).data;
        case 'missing-footprints':
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
      case 'component-summary':
        return (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-[#333333]">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Category</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Total Components</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">With Footprint</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">With Symbol</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((row, index) => (
                <tr key={index} className="border-b border-gray-100 dark:border-[#3a3a3a]">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{row.category}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">{row.total_components}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">{row.with_footprint}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">{row.with_symbol}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      case 'category-distribution':
        return (
          <div className="space-y-4">
            {reportData.map((row, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className="w-32 text-sm font-medium text-gray-700 dark:text-gray-300">{row.category}</div>
                <div className="flex-1 flex items-center gap-3">
                  <div className="flex-1 bg-gray-200 dark:bg-[#333333] rounded-full h-6">
                    <div
                      className="bg-primary-600 h-6 rounded-full flex items-center justify-end pr-2"
                      style={{ width: `${row.percentage}%` }}
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
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Total Value</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Total Quantity</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Unique Components</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((row, index) => (
                <tr key={index} className="border-b border-gray-100 dark:border-[#3a3a3a]">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{row.category}</td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-green-600 dark:text-green-400">
                    ${parseFloat(row.total_value || 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">{row.total_quantity || 0}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">{row.unique_components || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      case 'missing-footprints':
        return (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-[#333333]">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Part Number</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">MFR Part Number</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Category</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Manufacturer</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((row, index) => (
                <tr key={index} className="border-b border-gray-100 dark:border-[#3a3a3a]">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{row.part_number}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{row.manufacturer_part_number || 'N/A'}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{row.category_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{row.manufacturer_name || 'N/A'}</td>
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
              {reportData.map((row, index) => (
                <tr key={index} className="border-b border-gray-100 dark:border-[#3a3a3a]">
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
              {reportData.map((row, index) => (
                <tr key={index} className="border-b border-gray-100 dark:border-[#3a3a3a]">
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

  return (
    <div className="space-y-6">

      <div className="grid grid-cols-12 gap-6">
        {/* Report Type Selector */}
        <div className="col-span-3">
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Report Types</h3>
            <div className="space-y-2">
              {reports.map((report) => (
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
          </div>
        </div>

        {/* Report Content */}
        <div className="col-span-9">
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a]">
            <div className="p-4 border-b border-gray-200 dark:border-[#3a3a3a] flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {reports.find((r) => r.id === activeReport)?.name}
              </h3>
              <button className="btn-secondary flex items-center gap-2 text-sm">
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
            <div className="p-6">{renderReportContent()}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
