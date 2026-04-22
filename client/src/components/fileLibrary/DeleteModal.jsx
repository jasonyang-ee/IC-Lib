import { AlertTriangle, Trash2 } from 'lucide-react';

const DeleteModal = ({ target, onClose, onConfirm, isPending }) => (
  <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
    <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-xl max-w-md w-full mx-4">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
            <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Delete File</h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          Are you sure you want to delete <strong className="text-gray-900 dark:text-gray-100">{target.displayName || target.fileName}</strong>?
        </p>
        {target.fileNames?.length > 1 && (
          <div className="mb-4 rounded-lg border border-gray-200 dark:border-[#3a3a3a] bg-gray-50 dark:bg-[#333333] p-3">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Files</p>
            <div className="space-y-1">
              {target.fileNames.map((fileName) => (
                <p key={fileName} className="text-sm text-gray-700 dark:text-gray-300">{fileName}</p>
              ))}
            </div>
          </div>
        )}
        {target.componentCount > 0 && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            This will permanently delete the physical file{target.fileNames?.length > 1 ? 's' : ''} from disk and remove it from{' '}
            <strong>{target.componentCount}</strong> component reference{target.componentCount !== 1 ? 's' : ''}.
          </p>
        )}
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-sm text-red-800 dark:text-red-200">
            <strong>This action cannot be undone.</strong>
          </p>
        </div>
      </div>
      <div className="p-6 border-t border-gray-200 dark:border-[#3a3a3a] flex justify-end gap-3">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button
          onClick={onConfirm}
          disabled={isPending}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
        >
          {isPending ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Deleting...
            </>
          ) : (
            <>
              <Trash2 className="w-4 h-4" />
              Delete {target.fileNames?.length > 1 ? 'Files' : 'File'}
            </>
          )}
        </button>
      </div>
    </div>
  </div>
);

export default DeleteModal;
