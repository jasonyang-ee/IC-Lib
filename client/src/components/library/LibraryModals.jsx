import { AlertTriangle, AlertCircle, Trash2, X, Check } from 'lucide-react';

// Reusable modal backdrop
const ModalBackdrop = ({ children, zClass = 'z-50', onClick }) => (
  <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center ${zClass} p-4`} onClick={onClick}>
    {children}
  </div>
);

// Delete Confirmation Modal
export const DeleteConfirmationModal = ({ deleteConfirmation, onConfirm, onCancel }) => {
  if (!deleteConfirmation.show) return null;
  return (
    <ModalBackdrop>
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-[#3a3a3a] animate-fadeIn">
        <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/20">
          <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 text-center mb-2">
          Confirm Deletion
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
          {deleteConfirmation.type === 'single'
            ? `Are you sure you want to delete "${deleteConfirmation.componentName}"? This action cannot be undone.`
            : `Are you sure you want to delete ${deleteConfirmation.count} component(s)? This action cannot be undone.`
          }
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 bg-gray-200 dark:bg-[#333333] text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-[#3a3a3a] transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center justify-center gap-2"
          >
            Delete
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
};

// ECO Delete Confirmation Modal
export const ECODeleteConfirmationModal = ({ show, partNumber, onConfirm, onCancel }) => {
  if (!show) return null;
  return (
    <ModalBackdrop>
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-[#3a3a3a] animate-fadeIn">
        <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-yellow-100 dark:bg-yellow-900/20">
          <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 text-center mb-2">
          Mark Component for Deletion
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
          This will create an ECO to delete <span className="font-semibold text-gray-900 dark:text-gray-100">&quot;{partNumber}&quot;</span>.
          The deletion will be pending until an approver reviews and approves this ECO.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 bg-gray-200 dark:bg-[#333333] text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-[#3a3a3a] transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium flex items-center justify-center gap-2"
          >
            Mark for Deletion
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
};

// Promote to Primary Confirmation Modal
export const PromoteConfirmationModal = ({ promoteConfirmation, onConfirm, onCancel }) => {
  if (!promoteConfirmation.show) return null;
  return (
    <ModalBackdrop>
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-2xl max-w-lg w-full p-6 border border-gray-200 dark:border-[#3a3a3a] animate-fadeIn">
        <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-blue-100 dark:bg-blue-900/20">
          <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 text-center mb-4">
          Promote to Primary Part
        </h3>
        <div className="space-y-4 mb-6">
          <div className="bg-red-50 dark:bg-red-900/10 rounded-lg p-4 border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              <p className="font-semibold text-red-900 dark:text-red-100 text-sm">Current Primary &rarr; Alternative</p>
            </div>
            <p className="text-gray-700 dark:text-gray-300 font-mono text-sm pl-7">
              {promoteConfirmation.currentData?.manufacturer} {promoteConfirmation.currentData?.partNumber}
            </p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/10 rounded-lg p-4 border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
              <p className="font-semibold text-green-900 dark:text-green-100 text-sm">Alternative &rarr; New Primary</p>
            </div>
            <p className="text-gray-700 dark:text-gray-300 font-mono text-sm pl-7">
              {promoteConfirmation.altData?.manufacturer} {promoteConfirmation.altData?.partNumber}
            </p>
          </div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-3 mb-6 border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-900 dark:text-blue-100"><strong>What will happen:</strong></p>
          <ul className="text-sm text-blue-800 dark:text-blue-200 mt-2 space-y-1 list-disc list-inside">
            <li>Manufacturer and part number will be swapped</li>
            <li>Distributor information will be swapped</li>
            <li>Both parts will retain their data (no data loss)</li>
          </ul>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 bg-gray-200 dark:bg-[#333333] text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-[#3a3a3a] transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
            </svg>
            Promote
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
};

// Category Change Confirmation Modal
export const CategoryChangeModal = ({ categoryChangeConfirmation, editData, isECOMode, onConfirm, onCancel }) => {
  if (!categoryChangeConfirmation.show) return null;
  return (
    <ModalBackdrop>
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-2xl max-w-lg w-full p-6 border border-gray-200 dark:border-[#3a3a3a] animate-fadeIn">
        <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-yellow-100 dark:bg-yellow-900/20">
          <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 text-center mb-4">
          {isECOMode ? 'Stage Category Change' : 'Change Category'}
        </h3>
        {isECOMode ? (
          <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-4 mb-6 border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-900 dark:text-blue-100 mb-2"><strong>ECO Mode - Change will be staged:</strong></p>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
              <li>Category change to <strong>{categoryChangeConfirmation.newCategoryName}</strong> will be staged</li>
              <li>New part number will be assigned upon ECO approval</li>
              <li>Sub-categories and specifications will be reset upon approval</li>
              <li>Change takes effect only after ECO is approved</li>
            </ul>
          </div>
        ) : (
          <div className="bg-yellow-50 dark:bg-yellow-900/10 rounded-lg p-4 mb-6 border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-900 dark:text-yellow-100 mb-2"><strong>This action will:</strong></p>
            <ul className="text-sm text-yellow-800 dark:text-yellow-200 space-y-1 list-disc list-inside">
              <li>Change category to <strong>{categoryChangeConfirmation.newCategoryName}</strong></li>
              <li>Generate a new part number with the new category prefix</li>
              <li>Clear all sub-categories (they are category-specific)</li>
              <li>Reset specifications to the new category&apos;s template</li>
            </ul>
          </div>
        )}
        <div className="bg-gray-50 dark:bg-[#333333] rounded-lg p-3 mb-6 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">Current Part Number</p>
          <p className="text-lg font-mono font-semibold text-gray-900 dark:text-gray-100">{editData.part_number}</p>
          {isECOMode && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">New part number will be assigned upon approval</p>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 bg-gray-200 dark:bg-[#333333] text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-[#3a3a3a] transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2 ${
              isECOMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-yellow-600 hover:bg-yellow-700'
            }`}
          >
            <Check className="w-4 h-4" />
            {isECOMode ? 'Stage Change' : 'Change Category'}
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
};

// Warning Modal
export const WarningModal = ({ warningModal, onClose }) => {
  if (!warningModal.show) return null;
  return (
    <ModalBackdrop zClass="z-60">
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-[#3a3a3a] animate-fadeIn">
        <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-yellow-100 dark:bg-yellow-900/20">
          <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 text-center mb-2">Warning</h3>
        <p className="text-gray-600 dark:text-gray-400 text-center mb-6">{warningModal.message}</p>
        <button
          onClick={onClose}
          className="w-full px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
        >
          OK
        </button>
      </div>
    </ModalBackdrop>
  );
};

// Add to Project Modal
export const AddToProjectModal = ({ show, selectedComponent, projects, selectedProjectId, projectQuantity, onProjectChange, onQuantityChange, onConfirm, onCancel }) => {
  if (!show || !selectedComponent) return null;
  return (
    <ModalBackdrop onClick={(e) => e.stopPropagation()}>
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Add to Project
          </h3>
          <button type="button" onClick={onCancel} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div className="p-3 bg-gray-50 dark:bg-[#333333] rounded-lg">
            <p className="font-semibold text-gray-900 dark:text-gray-100">{selectedComponent.part_number}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {selectedComponent.manufacturer_name} - {selectedComponent.manufacturer_pn}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Project *</label>
            <select
              value={selectedProjectId}
              onChange={(e) => { e.stopPropagation(); onProjectChange(e.target.value); }}
              onClick={(e) => e.stopPropagation()}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100"
            >
              <option value="">-- Select a Project --</option>
              {projects?.filter(p => p.status === 'active').map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Quantity *</label>
            <input
              type="number"
              min="1"
              value={projectQuantity}
              onChange={(e) => { e.stopPropagation(); onQuantityChange(e.target.value); }}
              onClick={(e) => e.stopPropagation()}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!selectedProjectId || projectQuantity <= 0}
            className="btn-primary disabled:bg-gray-400"
          >
            Add to Project
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
};

// Auto Fill Toast Notification
export const AutoFillToast = ({ autoFillToast, onClose }) => {
  if (!autoFillToast.show) return null;
  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-slide-in">
      <div className="bg-green-500 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 min-w-75">
        <div className="shrink-0">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm">{autoFillToast.message}</p>
          <p className="text-xs text-green-100 mt-1">
            {autoFillToast.count} field{autoFillToast.count > 1 ? 's' : ''} updated from vendor data
          </p>
        </div>
        <button onClick={onClose} className="shrink-0 text-white hover:text-green-100 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

// Vendor Mapping Modal
export const VendorMappingModal = ({
  mappingModal,
  editData,
  onClose,
  onAddMapping,
  onAddNewMapping,
  onCreateNewSpecification,
  onUpdateModal
}) => {
  if (!mappingModal.show) return null;
  return (
    <ModalBackdrop>
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg p-6 max-w-lg w-full border border-gray-200 dark:border-[#3a3a3a] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {mappingModal.spec ? 'Add Vendor Field Mapping' : 'New Specification'}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {mappingModal.spec ? (
          <>
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-gray-600 dark:text-gray-400">Specification:</p>
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {mappingModal.spec.spec_name}
                {mappingModal.spec.unit && <span className="text-gray-500 ml-2">({mappingModal.spec.unit})</span>}
              </p>
              {mappingModal.spec.mapping_spec_names && mappingModal.spec.mapping_spec_names.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Current mappings:</p>
                  <div className="flex flex-wrap gap-1">
                    {mappingModal.spec.mapping_spec_names.map((mapping, idx) => (
                      <span key={idx} className="inline-flex px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full text-xs">
                        {mapping}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {editData._vendorSearchData?.specifications && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select from vendor fields:</p>
                <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-[#444444] rounded-lg">
                  {Object.keys(editData._vendorSearchData.specifications).map((fieldName, idx) => {
                    const isAlreadyMapped = mappingModal.spec.mapping_spec_names?.includes(fieldName);
                    return (
                      <button
                        type="button"
                        key={idx}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!isAlreadyMapped) onAddMapping(fieldName); }}
                        disabled={isAlreadyMapped}
                        className={`w-full text-left px-3 py-2 text-sm border-b border-gray-200 dark:border-[#444444] last:border-b-0 transition-colors ${
                          isAlreadyMapped
                            ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                            : 'hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-900 dark:text-gray-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{fieldName}</span>
                          {isAlreadyMapped && <span className="text-xs text-gray-500 dark:text-gray-400">(already mapped)</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Or enter a new vendor field name:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={mappingModal.newMapping}
                  onChange={(e) => onUpdateModal({ newMapping: e.target.value })}
                  onKeyPress={(e) => { if (e.key === 'Enter' && mappingModal.newMapping.trim()) { e.preventDefault(); onAddNewMapping(); } }}
                  placeholder="e.g., Capacitance, Cap, C"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                />
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAddNewMapping(); }}
                  disabled={!mappingModal.newMapping.trim()}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white rounded-md transition-colors text-sm font-medium"
                >
                  Add
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={onClose} className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md transition-colors text-sm font-medium">
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Specification Name *</label>
                <input
                  type="text"
                  value={mappingModal.newSpecName}
                  onChange={(e) => onUpdateModal({ newSpecName: e.target.value })}
                  placeholder="e.g., Capacitance, Voltage Rating"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Unit (optional)</label>
                <input
                  type="text"
                  value={mappingModal.newSpecUnit}
                  onChange={(e) => onUpdateModal({ newSpecUnit: e.target.value })}
                  placeholder="e.g., F, V, Ω"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                />
              </div>
              {editData._vendorSearchData?.specifications && (
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select vendor field to map (optional):</p>
                  <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-[#444444] rounded-lg">
                    {Object.keys(editData._vendorSearchData.specifications).map((fieldName, idx) => (
                      <button
                        key={idx}
                        onClick={() => onUpdateModal({ newMapping: fieldName })}
                        className={`w-full text-left px-3 py-2 text-sm border-b border-gray-200 dark:border-[#444444] last:border-b-0 transition-colors ${
                          mappingModal.newMapping === fieldName
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100'
                        }`}
                      >
                        {fieldName}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Or enter custom vendor field name:</label>
                <input
                  type="text"
                  value={mappingModal.newMapping}
                  onChange={(e) => onUpdateModal({ newMapping: e.target.value })}
                  placeholder="e.g., Capacitance, Cap, C"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md transition-colors text-sm font-medium">
                Cancel
              </button>
              <button
                onClick={onCreateNewSpecification}
                disabled={!mappingModal.newSpecName.trim()}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-md transition-colors text-sm font-medium"
              >
                Create Specification
              </button>
            </div>
          </>
        )}
      </div>
    </ModalBackdrop>
  );
};
