import { Plus, Edit, Trash2, Check, X, FileEdit } from 'lucide-react';

/**
 * ActionButtons - Action button panel for Library page
 */
const ActionButtons = ({
  isAddMode,
  isEditMode,
  isECOMode,
  isECOEnabled,
  bulkDeleteMode,
  selectedComponent,
  selectedForDelete,
  canWrite,
  onConfirmAdd,
  onCancelAdd,
  onSave,
  onSubmitECO,
  onMarkForDeletion,
  onCancelEdit,
  onCancelECO,
  onAddNew,
  onEdit,
  onInitiateECO,
  onBulkDelete,
  onToggleBulkDelete,
  editData,
}) => {
  return (
    <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a] flex-shrink-0">
      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Actions</h3>
      <div className="space-y-2">
        {isAddMode ? (
          // Add Mode Buttons
          <>
            <button 
              onClick={onConfirmAdd}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              Confirm Add
            </button>
            <button 
              onClick={onCancelAdd}
              className="w-full bg-gray-300 hover:bg-gray-400 dark:bg-[#333333] dark:hover:bg-[#3a3a3a] text-gray-700 dark:text-gray-300 font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </>
        ) : isEditMode ? (
          // Edit Mode Buttons
          <>
            <button
              onClick={isECOMode ? onSubmitECO : onSave}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              {isECOMode ? 'Submit ECO' : 'Save Changes'}
            </button>
            
            {/* Delete Component option in ECO mode */}
            {isECOMode && (
              <button
                onClick={onMarkForDeletion}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {editData?.delete_component ? 'Unmark Deletion' : 'Mark for Deletion'}
              </button>
            )}
            
            <button
              onClick={isECOMode ? onCancelECO : onCancelEdit}
              className="w-full bg-gray-300 hover:bg-gray-400 dark:bg-[#333333] dark:hover:bg-[#3a3a3a] text-gray-700 dark:text-gray-300 font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </>
        ) : bulkDeleteMode ? (
          // Bulk Delete Mode Buttons
          <>
            <button
              onClick={onBulkDelete}
              disabled={selectedForDelete.size === 0}
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete Selected ({selectedForDelete.size})
            </button>
            <button
              onClick={onToggleBulkDelete}
              className="w-full bg-gray-300 hover:bg-gray-400 dark:bg-[#333333] dark:hover:bg-[#3a3a3a] text-gray-700 dark:text-gray-300 font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </>
        ) : (
          // Normal Mode Buttons
          <>
            {canWrite?.() && (
              <button 
                onClick={onAddNew}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Component
              </button>
            )}
            
            {/* Show different buttons based on ECO configuration */}
            {isECOEnabled ? (
              // ECO Mode: Show only "Initiate ECO" button
              selectedComponent && canWrite?.() && (
                <button
                  onClick={() => onInitiateECO(selectedComponent)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <FileEdit className="w-4 h-4" />
                  Initiate ECO
                </button>
              )
            ) : (
              // Normal Mode: Show Edit and Delete buttons
              <>
                {selectedComponent && canWrite?.() && (
                  <button
                    onClick={onEdit}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    Edit Component
                  </button>
                )}
                {canWrite?.() && (
                  <button
                    onClick={onToggleBulkDelete}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Components
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ActionButtons;
