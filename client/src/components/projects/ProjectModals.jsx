import { Search, FileText, X, AlertTriangle } from 'lucide-react';

const ProjectModals = ({
  // Create modal
  showCreateModal,
  newProject,
  setNewProject,
  onCreateProject,
  onCloseCreateModal,
  // Edit modal
  showEditModal,
  selectedProject,
  setSelectedProject,
  onUpdateProject,
  onOpenDeleteProject,
  onCloseEditModal,
  // Add component modal
  showAddComponentModal,
  componentSearchTerm,
  setComponentSearchTerm,
  searchResults,
  bulkImportMode,
  setBulkImportMode,
  bulkImportText,
  setBulkImportText,
  bulkImportResults,
  onBulkImportSearch,
  onBulkImportAdd,
  onAddComponent,
  updateBulkImportQuantity,
  onCloseAddComponentModal,
  // Delete confirmation modal
  showDeleteConfirm,
  onConfirmDelete,
  onCancelDelete,
  // Quantity input modal
  showQuantityInput,
  quantityValue,
  setQuantityValue,
  onConfirmQuantityInput,
  onCancelQuantityInput,
  // BOM modal
  showBomModal,
  bomColumnOptions,
  selectedBomColumnIds,
  onToggleBomColumn,
  onSelectAllBomColumns,
  onResetBomColumns,
  onConfirmGenerateBom,
  onCloseBomModal,
  isGeneratingBom,
}) => {
  const modalBackdropClass = 'fixed inset-0 bg-slate-900/20 backdrop-blur-[1px] flex items-center justify-center z-50 p-4';
  const modalPanelClass = 'bg-white dark:bg-[#2a2a2a] rounded-lg p-6 border border-gray-200 dark:border-[#3a3a3a] shadow-xl';
  const isUpdateQuantityMode = showQuantityInput?.mode === 'update';

  return (
    <>
      {/* Create Project Modal */}
      {showCreateModal && (
        <div className={modalBackdropClass}>
          <div className={`${modalPanelClass} max-w-md w-full`}>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Create New Project
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100"
                  placeholder="Enter project name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100"
                  placeholder="Enter project description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={newProject.status}
                  onChange={(e) => setNewProject({ ...newProject, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100"
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={onCloseCreateModal}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={onCreateProject}
                className="btn-primary"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {showEditModal && selectedProject && (
        <div className={modalBackdropClass}>
          <div className={`${modalPanelClass} max-w-md w-full`}>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Edit Project
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={selectedProject.name}
                  onChange={(e) => setSelectedProject({ ...selectedProject, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={selectedProject.description || ''}
                  onChange={(e) => setSelectedProject({ ...selectedProject, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={selectedProject.status}
                  onChange={(e) => setSelectedProject({ ...selectedProject, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100"
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => onOpenDeleteProject(selectedProject)}
                className="mr-auto text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              >
                Delete Project
              </button>
              <button
                onClick={onCloseEditModal}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={onUpdateProject}
                className="btn-primary"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Component Modal */}
      {showAddComponentModal && (
        <div
          className={modalBackdropClass}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              onCloseAddComponentModal();
            }
          }}
        >
          <div className={`${modalPanelClass} max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Add Component to Project
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setBulkImportMode(!bulkImportMode);
                    setBulkImportText('');
                    setComponentSearchTerm('');
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                    bulkImportMode
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 dark:bg-[#333333] text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-[#444444]'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Bulk Import
                </button>
              </div>
            </div>

            {!bulkImportMode ? (
              <>
                {/* Single Component Search */}
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={componentSearchTerm}
                      onChange={(e) => setComponentSearchTerm(e.target.value)}
                      placeholder="Search components by part number, MFG P/N, or description..."
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                  {searchResults?.map((component) => (
                    <div
                      key={component.id}
                      onClick={() => onAddComponent(component)}
                      className="p-3 border border-gray-200 dark:border-[#3a3a3a] rounded-lg cursor-pointer hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {component.part_number}
                          </span>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {component.manufacturer_name} - {component.manufacturer_pn}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                            {component.description}
                          </p>
                        </div>
                        <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-[#333333] rounded">
                          {component.category_name}
                        </span>
                      </div>
                    </div>
                  ))}
                  {componentSearchTerm.length > 2 && searchResults?.length === 0 && (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                      No components found matching "{componentSearchTerm}"
                    </p>
                  )}
                  {componentSearchTerm.length <= 2 && (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                      Type at least 3 characters to search
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Bulk Import Mode */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Paste MFG Part Numbers (one per line)
                  </label>
                  <textarea
                    value={bulkImportText}
                    onChange={(e) => setBulkImportText(e.target.value)}
                    placeholder="Example:&#10;TPS54360BDDAR&#10;LM358DR&#10;SN74HC595DR"
                    rows={8}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 font-mono text-sm"
                  />
                  <button
                    onClick={onBulkImportSearch}
                    disabled={!bulkImportText.trim()}
                    className="mt-2 btn-primary disabled:bg-gray-400"
                  >
                    Search All
                  </button>
                </div>

                {bulkImportResults.length > 0 && (
                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      Results ({bulkImportResults.filter(r => r.found).length} of {bulkImportResults.length} found)
                    </h4>
                    {bulkImportResults.map((result, index) => (
                      <div
                        key={index}
                        className={`p-3 border rounded-lg ${
                          result.found
                            ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
                            : 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
                        }`}
                      >
                        {result.found ? (
                          <div className="flex justify-between items-start gap-3">
                            <div className="flex-1">
                              <span className="font-mono text-sm text-gray-600 dark:text-gray-400">
                                {result.searchTerm}
                              </span>
                              <p className="font-semibold text-gray-900 dark:text-gray-100 mt-1">
                                {result.component.part_number}
                              </p>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                {result.component.manufacturer_name} - {result.component.manufacturer_pn}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="text-sm text-gray-600 dark:text-gray-400">Qty:</label>
                              <input
                                type="number"
                                min="1"
                                value={result.quantity}
                                onChange={(e) => updateBulkImportQuantity(index, e.target.value)}
                                className="w-20 px-2 py-1 border border-gray-300 dark:border-[#444444] rounded text-center focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <X className="w-4 h-4 text-red-600" />
                            <span className="font-mono text-sm text-gray-700 dark:text-gray-300">
                              {result.searchTerm}
                            </span>
                            <span className="text-sm text-red-600 dark:text-red-400">- Not found</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {bulkImportMode && bulkImportResults.length > 0 && (
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={onBulkImportAdd}
                  disabled={!bulkImportResults.some(r => r.found && r.quantity > 0)}
                  className="btn-primary disabled:bg-gray-400"
                >
                  Add {bulkImportResults.filter(r => r.found && r.quantity > 0).length} Components
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className={modalBackdropClass}>
          <div className={`${modalPanelClass} max-w-md w-full`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Delete Project
              </h3>
            </div>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Are you sure you want to delete project "<strong>{showDeleteConfirm.name}</strong>"?
              This will remove all component associations.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={onCancelDelete}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={onConfirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quantity Input Modal */}
      {showQuantityInput && (
        <div
          className={modalBackdropClass}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              onCancelQuantityInput();
            }
          }}
        >
          <div className={`${modalPanelClass} max-w-md w-full`}>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {isUpdateQuantityMode ? 'Update Quantity' : 'Add Component to Project'}
            </h3>
            <div className="mb-4">
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                <strong>{showQuantityInput.part_number}</strong>
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {showQuantityInput.manufacturer_name} - {showQuantityInput.manufacturer_pn}
              </p>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Quantity
              </label>
              <input
                type="number"
                min="1"
                value={quantityValue}
                onChange={(e) => setQuantityValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onConfirmQuantityInput();
                  } else if (e.key === 'Escape') {
                    onCancelQuantityInput();
                  }
                }}
                autoFocus
                className="w-full px-4 py-2 border border-gray-300 dark:border-[#444444] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={onCancelQuantityInput}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={onConfirmQuantityInput}
                className="btn-primary"
              >
                {isUpdateQuantityMode ? 'Save Quantity' : 'Add to Project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOM Column Selection Modal */}
      {showBomModal && (
        <div
          className={modalBackdropClass}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              onCloseBomModal();
            }
          }}
        >
          <div className={`${modalPanelClass} max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col`}>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Generate BOM
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Choose which tracked metadata columns to export. Alternative columns are always appended automatically.
                </p>
              </div>
              <button
                onClick={onCloseBomModal}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {selectedBomColumnIds.length} column{selectedBomColumnIds.length !== 1 ? 's' : ''} selected before distributor expansion
              </div>
              <div className="flex items-center gap-3 text-sm">
                <button
                  onClick={onSelectAllBomColumns}
                  className="font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                >
                  Select All
                </button>
                <button
                  onClick={onResetBomColumns}
                  className="font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
                >
                  Reset to Default
                </button>
              </div>
            </div>

            <div className="overflow-y-auto custom-scrollbar flex-1 pr-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {bomColumnOptions.map((column) => {
                  const isSelected = selectedBomColumnIds.includes(column.id);

                  return (
                    <label
                      key={column.id}
                      className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-gray-200 dark:border-[#3a3a3a] hover:border-primary-300 dark:hover:border-primary-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleBomColumn(column.id)}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {column.label}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {column.description || column.group}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={onCloseBomModal}
                disabled={isGeneratingBom}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={onConfirmGenerateBom}
                disabled={isGeneratingBom || selectedBomColumnIds.length === 0}
                className="btn-primary disabled:bg-gray-400"
              >
                {isGeneratingBom ? 'Generating...' : 'Generate BOM'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProjectModals;
