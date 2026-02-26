import { Fragment } from 'react';
import { Edit, Save, X, ChevronDown, ChevronRight, ExternalLink, RefreshCw } from 'lucide-react';

const InventoryTable = ({
  sortedInventory,
  editMode,
  editedItems,
  expandedRows,
  alternativesData,
  editingAlternative,
  copiedLabel,
  copiedQRField,
  canWrite,
  onToggleEditMode,
  onSaveAll,
  onCancelEdit,
  onEditChange,
  onAlternativeEdit,
  onToggleExpandAll,
  onToggleRowExpansion,
  onJumpToLibrary,
  onShowQRCode,
  onCopyQRCodeMfgOnly,
  onCopyLabelToClipboard,
  onShowAlternativeQRCode,
  onCopyAlternativeQRCodeMfgOnly,
  onCopyAlternativeLabelToClipboard,
  onRefetchInventory,
}) => (
  <div className="flex-1 bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] flex flex-col overflow-hidden">
    <div className="p-4 border-b border-gray-200 dark:border-[#3a3a3a] flex items-center justify-between shrink-0">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        Inventory Items ({sortedInventory?.length || 0})
      </h3>
      {/* Edit Mode Controls */}
      <div className="flex items-center gap-2">
        {editMode ? (
          <>
            <button
              onClick={onSaveAll}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              <Save className="w-4 h-4" />
              Save All
            </button>
            <button
              onClick={onCancelEdit}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onRefetchInventory}
              className="btn-secondary flex items-center gap-2 text-sm"
              title="Refresh inventory data"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={onToggleExpandAll}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              {expandedRows.size === sortedInventory?.length ? (
                <>
                  <ChevronRight className="w-4 h-4" />
                  Collapse All
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Expand All
                </>
              )}
            </button>
            {canWrite && (
              <button
                onClick={onToggleEditMode}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                <Edit className="w-4 h-4" />
                Edit All
              </button>
            )}
          </>
        )}
      </div>
    </div>
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-[#333333] sticky top-0">
          <tr>
            <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300" style={{width: '40px'}}></th>
            <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Part Number</th>
            <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">MFG Part Number</th>
            <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Manufacturer</th>
            <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Description</th>
            <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 min-w-40 ">Location</th>
            <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Quantity</th>
            <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Min Qty</th>
            <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Library</th>
            <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Label</th>
          </tr>
        </thead>
        <tbody>
          {sortedInventory?.map((item) => {
            const editedItem = editedItems[item.id] || { location: item.location || '', quantity: item.quantity, consumeQty: 0 };
            const isLowStock = item.quantity <= item.minimum_quantity && item.minimum_quantity > 0;
            const isExpanded = expandedRows.has(item.id);
            const alternatives = alternativesData[item.component_id] || [];

            return (
              <Fragment key={item.id}>
                <tr
                  id={`inv-row-${item.id}`}
                  className="border-b border-gray-100 dark:border-[#3a3a3a] hover:bg-gray-50 dark:hover:bg-[#333333] transition-colors cursor-pointer"
                  onClick={() => onToggleRowExpansion(item)}
                >
                  {/* Expand Button */}
                  <td className="px-4 py-3 text-sm">
                    <button
                      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors pointer-events-none"
                      title="Show/hide alternative parts"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                  </td>

                  {/* Part Number */}
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {item.part_number}
                  </td>

                  {/* MFG Part Number */}
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                    {item.manufacturer_pn || 'N/A'}
                  </td>

                  {/* Manufacturer */}
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                    {item.manufacturer_name || 'N/A'}
                  </td>

                  {/* Description */}
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                    {item.description?.substring(0, 40) || 'N/A'}
                  </td>

                {/* Location */}
                <td className="px-4 py-3 text-sm" onClick={(e) => e.stopPropagation()}>
                  {editMode ? (
                    <input
                      type="text"
                      value={editedItem.location}
                      onChange={(e) => onEditChange(item.id, 'location', e.target.value)}
                      placeholder="Enter location..."
                      className="w-full px-2 py-1 border border-gray-300 dark:border-[#444444] rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                    />
                  ) : (
                    <span className="text-gray-900 dark:text-gray-100">{item.location || 'Not set'}</span>
                  )}
                </td>

                {/* Quantity */}
                <td className="px-4 py-3 text-sm" onClick={(e) => e.stopPropagation()}>
                  {editMode ? (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600 dark:text-gray-400 w-12 shrink-0">Set to:</span>
                        <input
                          type="number"
                          value={editedItem.quantity}
                          onChange={(e) => onEditChange(item.id, 'quantity', parseInt(e.target.value) || 0)}
                          className="w-20 px-2 py-1 border border-gray-300 dark:border-[#444444] rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600 dark:text-gray-400 w-12 shrink-0">Consume:</span>
                        <input
                          type="number"
                          value={editedItem.consumeQty || ''}
                          onChange={(e) => onEditChange(item.id, 'consumeQty', parseInt(e.target.value) || 0)}
                          placeholder="0"
                          className="w-20 px-2 py-1 border border-gray-300 dark:border-[#444444] rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600 dark:text-gray-400 w-12 shrink-0">Receive:</span>
                        <input
                          type="number"
                          value={editedItem.receiveQty || ''}
                          onChange={(e) => onEditChange(item.id, 'receiveQty', parseInt(e.target.value) || 0)}
                          placeholder="0"
                          className="w-20 px-2 py-1 border border-gray-300 dark:border-[#444444] rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${isLowStock ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
                        {item.quantity}
                      </span>
                      {isLowStock && (
                        <span className="text-xs text-red-600 dark:text-red-400">(Low)</span>
                      )}
                    </div>
                  )}
                </td>

                {/* Min Qty */}
                <td className="px-4 py-3 text-sm" onClick={(e) => e.stopPropagation()}>
                  {editMode ? (
                    <input
                      type="number"
                      value={editedItem.minimum_quantity}
                      onChange={(e) => onEditChange(item.id, 'minimum_quantity', parseInt(e.target.value) || 0)}
                      className="w-20 px-2 py-1 border border-gray-300 dark:border-[#444444] rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                    />
                  ) : (
                    <span className="text-gray-900 dark:text-gray-100">{item.minimum_quantity || 0}</span>
                  )}
                </td>

                {/* Library Jump Link */}
                <td className="px-4 py-3 text-sm" style={{width: '70px'}} onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onJumpToLibrary(item.component_id)}
                    className="p-2 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition-colors"
                    title="View in Parts Library"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </button>
                </td>

                {/* Label Actions */}
                <td className="px-4 py-3 text-sm" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    {/* All button - shows full QR modal */}
                    <button
                      onClick={() => onShowQRCode(item)}
                      className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-md transition-colors text-xs font-medium shadow-sm"
                      title="Show all QR options"
                    >
                      All
                    </button>
                    {/* QR button - directly copies QR image with MFG P/N */}
                    <button
                      onClick={() => onCopyQRCodeMfgOnly(item)}
                      className={`px-3 py-1.5 rounded-md transition-colors text-xs font-medium shadow-sm ${
                        copiedQRField === `mfg-quick-${item.id}`
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-gray-600 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white'
                      }`}
                      title="Copy QR code with manufacturer part number"
                    >
                      {copiedQRField === `mfg-quick-${item.id}` ? 'OK' : 'QR'}
                    </button>
                    {/* Copy button - copies label text */}
                    <button
                      onClick={() => onCopyLabelToClipboard(item)}
                      className={`px-3 py-1.5 rounded-md transition-colors text-xs font-medium shadow-sm ${
                        copiedLabel === item.id
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-gray-600 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white'
                      }`}
                      title="Copy label text"
                    >
                      {copiedLabel === item.id ? 'OK' : 'Text'}
                    </button>
                  </div>
                </td>
              </tr>

              {/* Alternative Parts Rows */}
              {isExpanded && alternatives.length > 0 && alternatives.map((alt, altIndex) => {
                const editingAlt = editingAlternative?.[alt.id] || {
                  location: alt.location || '',
                  quantity: alt.quantity || 0,
                  minimum_quantity: alt.minimum_quantity || 0,
                  consumeQty: 0
                };

                return (
                  <tr
                    key={`alt-${alt.id}`}
                    className="border-b border-gray-100 dark:border-[#3a3a3a] hover:bg-gray-50 dark:hover:bg-[#2a2a2a]"
                  >
                    {/* Empty cell for alignment */}
                    <td className="px-4 py-2"></td>

                    {/* Part Number - show as "Alt 1", "Alt 2", etc */}
                    <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 italic">
                      Alternative {altIndex + 1}
                    </td>

                    {/* MFG Part Number */}
                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                      {alt.manufacturer_pn}
                    </td>

                    {/* Manufacturer */}
                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                      {alt.manufacturer_name || 'N/A'}
                    </td>

                    {/* Description - empty for alternatives */}
                    <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 italic">
                      (alternative part)
                    </td>

                    {/* Location */}
                    <td className="px-4 py-2 text-sm">
                      {editMode ? (
                        <input
                          type="text"
                          value={editingAlt.location}
                          onChange={(e) => onAlternativeEdit(alt.id, 'location', e.target.value)}
                          placeholder="Enter location..."
                          className="w-full px-2 py-1 border border-gray-300 dark:border-[#444444] rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                        />
                      ) : (
                        <span className="text-gray-900 dark:text-gray-100">{alt.location || 'Not set'}</span>
                      )}
                    </td>

                    {/* Quantity */}
                    <td className="px-4 py-2 text-sm">
                      {editMode ? (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 dark:text-gray-400 w-12 shrink-0">Set to:</span>
                            <input
                              type="number"
                              value={editingAlt.quantity}
                              onChange={(e) => onAlternativeEdit(alt.id, 'quantity', parseInt(e.target.value) || 0)}
                              className="w-20 px-2 py-1 border border-gray-300 dark:border-[#444444] rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 dark:text-gray-400 w-12 shrink-0">Consume:</span>
                            <input
                              type="number"
                              value={editingAlt.consumeQty || ''}
                              onChange={(e) => onAlternativeEdit(alt.id, 'consumeQty', parseInt(e.target.value) || 0)}
                              placeholder="0"
                              className="w-20 px-2 py-1 border border-gray-300 dark:border-[#444444] rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600 dark:text-gray-400 w-12 shrink-0">Receive:</span>
                            <input
                              type="number"
                              value={editingAlt.receiveQty || ''}
                              onChange={(e) => onAlternativeEdit(alt.id, 'receiveQty', parseInt(e.target.value) || 0)}
                              placeholder="0"
                              className="w-20 px-2 py-1 border border-gray-300 dark:border-[#444444] rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-900 dark:text-gray-100">{alt.quantity || 0}</span>
                      )}
                    </td>

                    {/* Min Qty - editable for alternatives */}
                    <td className="px-4 py-2 text-sm">
                      {editMode ? (
                        <input
                          type="number"
                          value={editingAlt.minimum_quantity}
                          onChange={(e) => onAlternativeEdit(alt.id, 'minimum_quantity', parseInt(e.target.value) || 0)}
                          className="w-20 px-2 py-1 border border-gray-300 dark:border-[#444444] rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                        />
                      ) : (
                        <span className="text-gray-900 dark:text-gray-100">{alt.minimum_quantity || 0}</span>
                      )}
                    </td>

                    {/* Library Jump Link for Alternative */}
                    <td className="px-4 py-2 text-sm">
                      <button
                        onClick={() => onJumpToLibrary(alt.manufacturer_pn, false)}
                        className="p-2 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition-colors"
                        title="View in Parts Library"
                      >
                        <ExternalLink className="w-5 h-5" />
                      </button>
                    </td>

                    {/* Label Actions */}
                    <td className="px-4 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        {/* All button - shows full QR modal */}
                        <button
                          onClick={() => onShowAlternativeQRCode(alt, item)}
                          className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-md transition-colors text-xs font-medium shadow-sm"
                          title="Show all QR options"
                        >
                          All
                        </button>
                        {/* QR button - directly copies QR image with MFG P/N */}
                        <button
                          onClick={() => onCopyAlternativeQRCodeMfgOnly(alt, item)}
                          className={`px-3 py-1.5 rounded-md transition-colors text-xs font-medium shadow-sm ${
                            copiedQRField === `alt-mfg-quick-${alt.id}`
                              ? 'bg-green-600 hover:bg-green-700 text-white'
                              : 'bg-gray-600 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white'
                          }`}
                          title="Copy QR code with manufacturer part number"
                        >
                          {copiedQRField === `alt-mfg-quick-${alt.id}` ? 'Ok' : 'QR'}
                        </button>
                        {/* Copy button - copies label text */}
                        <button
                          onClick={() => onCopyAlternativeLabelToClipboard(alt, item)}
                          className={`px-3 py-1.5 rounded-md transition-colors text-xs font-medium shadow-sm ${
                            copiedLabel === `alt-${alt.id}`
                              ? 'bg-green-600 hover:bg-green-700 text-white'
                              : 'bg-gray-600 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white'
                          }`}
                          title="Copy label text"
                        >
                          {copiedLabel === `alt-${alt.id}` ? 'Ok' : 'Copy'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

export default InventoryTable;
