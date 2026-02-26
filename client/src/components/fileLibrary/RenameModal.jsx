import { X, Save } from 'lucide-react';

const RenameModal = ({
  renameData,
  setRenameData,
  isPhysicalRename,
  setIsPhysicalRename,
  selectAllComponents,
  setSelectAllComponents,
  componentsData,
  selectedType,
  fileTypes,
  onClose,
  onSubmit,
  onUseMPN,
  onUsePackage,
  onToggleComponent,
  isPending,
}) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
      <div className="p-6 border-b border-gray-200 dark:border-[#3a3a3a] shrink-0">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Rename File</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Rename &quot;{renameData.oldName}&quot;
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
        {/* Rename mode toggle */}
        <div className="mb-4">
          <div className="flex rounded-lg border border-gray-300 dark:border-[#3a3a3a] overflow-hidden">
            <button
              onClick={() => setIsPhysicalRename(true)}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                isPhysicalRename
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-[#333] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#3a3a3a]'
              }`}
            >
              File + Database
            </button>
            <button
              onClick={() => setIsPhysicalRename(false)}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                !isPhysicalRename
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-[#333] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#3a3a3a]'
              }`}
            >
              Database Only
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {isPhysicalRename
              ? 'Renames the physical file on disk and updates all component references.'
              : 'Only updates database references. The physical file is not renamed.'}
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            New File Name
          </label>
          <input
            type="text"
            value={renameData.newName}
            onChange={(e) => setRenameData(prev => ({ ...prev, newName: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-[#3a3a3a] rounded-lg bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Enter new file name"
          />
          {/* Quick-fill shortcuts */}
          {componentsData?.components?.length > 0 && (
            <div className="flex gap-2 mt-2">
              {componentsData.components[0].manufacturer_pn && (
                <button
                  onClick={onUseMPN}
                  className="px-2 py-1 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                >
                  Use MPN: {componentsData.components[0].manufacturer_pn}
                </button>
              )}
              {componentsData.components[0].package_size && (
                <button
                  onClick={onUsePackage}
                  className="px-2 py-1 text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                >
                  Use Package: {componentsData.components[0].package_size}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Component selection - only in DB-only mode */}
        {!isPhysicalRename && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Apply to Components
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectAllComponents}
                  onChange={(e) => {
                    setSelectAllComponents(e.target.checked);
                    if (e.target.checked) {
                      setRenameData(prev => ({
                        ...prev,
                        selectedIds: componentsData?.components?.map(c => c.id) || [],
                      }));
                    }
                  }}
                  className="rounded border-gray-300 dark:border-[#3a3a3a] text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">Select All</span>
              </label>
            </div>

            <div className="max-h-60 overflow-y-auto custom-scrollbar border border-gray-200 dark:border-[#3a3a3a] rounded-lg">
              {componentsData?.components?.map((component) => (
                <label
                  key={component.id}
                  className="flex items-center gap-3 p-3 border-b border-gray-100 dark:border-[#3a3a3a] last:border-b-0 hover:bg-gray-50 dark:hover:bg-[#333] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectAllComponents || renameData.selectedIds.includes(component.id)}
                    disabled={selectAllComponents}
                    onChange={() => onToggleComponent(component.id)}
                    className="rounded border-gray-300 dark:border-[#3a3a3a] text-primary-600 focus:ring-primary-500 disabled:opacity-50"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">{component.part_number}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{component.manufacturer_pn}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            {isPhysicalRename ? (
              <>
                <strong>Warning:</strong> This will rename the physical file on disk and update the{' '}
                {fileTypes.find(t => t.id === selectedType)?.label.toLowerCase() || selectedType} field for{' '}
                all {componentsData?.components?.length || 0} component(s) referencing this file.
              </>
            ) : (
              <>
                <strong>Warning:</strong> This will update the {fileTypes.find(t => t.id === selectedType)?.label.toLowerCase() || selectedType} field for{' '}
                {selectAllComponents
                  ? `all ${componentsData?.components?.length || 0} components`
                  : `${renameData.selectedIds.length} selected component(s)`
                } using this file. The physical file will not be renamed.
              </>
            )}
          </p>
        </div>
      </div>

      <div className="p-6 border-t border-gray-200 dark:border-[#3a3a3a] shrink-0 flex justify-end gap-3">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button
          onClick={onSubmit}
          disabled={isPending || !renameData.newName.trim() || renameData.newName === renameData.oldName}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          {isPending ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Renaming...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Rename
            </>
          )}
        </button>
      </div>
    </div>
  </div>
);

export default RenameModal;
