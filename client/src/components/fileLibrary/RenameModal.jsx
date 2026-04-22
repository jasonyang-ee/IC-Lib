import { Save, X } from 'lucide-react';

const RenameModal = ({
  renameData,
  setRenameData,
  componentsData,
  selectedType,
  fileTypes,
  onClose,
  onSubmit,
  onUseMPN,
  onUsePackage,
  isPending,
  isUnchanged,
}) => {
  const isGroupedFootprint = renameData.mode === 'pair';

  return (
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
          <div className="mb-4 rounded-lg border border-gray-200 dark:border-[#3a3a3a] bg-gray-50 dark:bg-[#333333] px-4 py-3">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">File + Database Rename</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Renames the physical file on disk, updates `cad_files`, and regenerates linked component CAD text fields.
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {isGroupedFootprint ? 'New Base Name' : 'New File Name'}
            </label>
            <input
              type="text"
              value={renameData.newName}
              onChange={(e) => setRenameData((previous) => ({ ...previous, newName: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#3a3a3a] rounded-lg bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder={isGroupedFootprint ? 'Enter the new shared footprint base name' : 'Enter new file name'}
            />
            {isGroupedFootprint && renameData.fileNames?.length > 0 && (
              <div className="mt-2 rounded-lg border border-gray-200 dark:border-[#3a3a3a] bg-gray-50 dark:bg-[#333333] p-3">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Paired Footprint Files</p>
                <div className="space-y-1">
                  {renameData.fileNames.map((fileName) => (
                    <p key={fileName} className="text-sm text-gray-700 dark:text-gray-300">{fileName}</p>
                  ))}
                </div>
              </div>
            )}
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

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Warning:</strong> This will rename the physical file{isGroupedFootprint ? ' pair' : ''} on disk and update the{' '}
              {fileTypes.find((type) => type.id === selectedType)?.label.toLowerCase() || selectedType} links for{' '}
              {componentsData?.components?.length || 0} component(s) referencing {isGroupedFootprint ? 'these files' : 'this file'}.
            </p>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-[#3a3a3a] shrink-0 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={onSubmit}
            disabled={isPending || !renameData.newName.trim() || isUnchanged}
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
};

export default RenameModal;
