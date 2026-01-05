/**
 * ComponentList - List of components with sorting and bulk selection
 */
const ComponentList = ({
  components = [],
  isLoading,
  selectedComponent,
  bulkDeleteMode,
  selectedForDelete,
  sortBy,
  sortOrder,
  onComponentClick,
  onToggleSelectForDelete,
  onSelectAllForDelete,
}) => {
  // Sort components based on selected sort field and order
  const sortedComponents = [...components].sort((a, b) => {
    let aVal = a[sortBy] || '';
    let bVal = b[sortBy] || '';
    
    // Handle null/undefined values
    if (!aVal && !bVal) return 0;
    if (!aVal) return sortOrder === 'asc' ? 1 : -1;
    if (!bVal) return sortOrder === 'asc' ? -1 : 1;
    
    // Handle date fields
    if (sortBy === 'created_at' || sortBy === 'updated_at') {
      aVal = new Date(aVal).getTime();
      bVal = new Date(bVal).getTime();
    } else if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }
    
    // Compare values
    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="flex flex-col xl:min-w-62.5 overflow-hidden" data-panel>
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] flex flex-col flex-1 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-[#3a3a3a] shrink-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Components ({components.length || 0})
            {bulkDeleteMode && (
              <span className="text-sm text-red-600 dark:text-red-400 ml-2">(Select to delete)</span>
            )}
          </h3>
        </div>
        
        <div className="overflow-y-auto custom-scrollbar flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : sortedComponents.length > 0 ? (
            <table className="w-full">
              <colgroup>
                {bulkDeleteMode && <col style={{ width: '48px' }} />}
                <col style={{ width: 'auto' }} />
                <col style={{ width: 'auto' }} />
                <col style={{ width: 'auto' }} />
                <col style={{ width: 'auto' }} />
              </colgroup>
              <thead className="bg-gray-50 dark:bg-[#333333] sticky top-0">
                <tr>
                  {bulkDeleteMode && (
                    <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 w-12">
                      <input
                        type="checkbox"
                        checked={selectedForDelete.size === components.length && components.length > 0}
                        onChange={(e) => onSelectAllForDelete(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                    </th>
                  )}
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Part Number</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">MFG Part Number</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Value</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Description</th>
                </tr>
              </thead>
              <tbody>
                {sortedComponents.map((component) => (
                  <tr
                    key={component.id}
                    onClick={() => !bulkDeleteMode && onComponentClick(component)}
                    className={`cursor-pointer border-b border-gray-100 dark:border-[#3a3a3a] hover:bg-gray-50 dark:hover:bg-[#333333] ${
                      selectedComponent?.id === component.id && !bulkDeleteMode
                        ? 'bg-primary-50 dark:bg-primary-900/20'
                        : ''
                    } ${selectedForDelete.has(component.id) ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                  >
                    {bulkDeleteMode && (
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedForDelete.has(component.id)}
                          onChange={() => onToggleSelectForDelete(component.id)}
                          className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                      {component.part_number}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {component.manufacturer_pn || component.manufacturer_part_number || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {component.value || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {component.description?.substring(0, 80) || 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              No components found
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComponentList;
