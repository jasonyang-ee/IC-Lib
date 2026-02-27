import { Fragment } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { activityTypeConfig, defaultActivityConfig } from './constants';

// Render details summary (compact single-line view)
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

// Format snake_case/camelCase key to Title Case
const formatKey = (key) => {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

// Render a single value in expanded details
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

// Render expanded details panel
const renderExpandedDetails = (details) => {
  if (!details || Object.keys(details).length === 0) {
    return <span className="text-gray-500">No details available</span>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
      {Object.entries(details).map(([key, value]) => (
        <div key={key} className="py-1">
          <span className="font-medium text-gray-600 dark:text-gray-400">{formatKey(key)}:</span>{' '}
          <span className="text-gray-800 dark:text-gray-200">{renderValue(value)}</span>
        </div>
      ))}
    </div>
  );
};

const AuditTable = ({ data, expandedRows, onToggleRow }) => {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        No audit records found
      </div>
    );
  }

  return (
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
          {data.map((item) => {
            const config = activityTypeConfig[item.activity_type] || defaultActivityConfig;
            const isExpanded = expandedRows.has(item.id);
            const hasDetails = item.details && Object.keys(item.details).length > 0;

            return (
              <Fragment key={item.id}>
                <tr
                  className={`border-b border-gray-100 dark:border-[#3a3a3a] hover:bg-gray-50 dark:hover:bg-[#333333] ${hasDetails ? 'cursor-pointer' : ''}`}
                  onClick={() => hasDetails && onToggleRow(item.id)}
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
  );
};

export default AuditTable;
