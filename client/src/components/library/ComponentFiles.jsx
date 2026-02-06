import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../utils/api';
import { useNotification } from '../../contexts/NotificationContext';
import { Download } from 'lucide-react';
import ConfirmationModal from '../common/ConfirmationModal';

const CATEGORY_LABELS = {
  footprint: 'PCB Footprint',
  pad: 'Pad',
  symbol: 'Symbol',
  model: '3D Model',
  pspice: 'PSpice',
  libraries: 'Library Archive',
};

/**
 * Component file upload and listing section
 * Shows below distributor info in component detail view
 */
const ComponentFiles = ({ mfgPartNumber, canEdit = false }) => {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useNotification();
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, category: '', filename: '' });

  // Fetch existing files
  const { data: filesData, isLoading } = useQuery({
    queryKey: ['componentFiles', mfgPartNumber],
    queryFn: async () => {
      const response = await api.listComponentFiles(mfgPartNumber);
      return response.data;
    },
    enabled: !!mfgPartNumber,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (files) => {
      const formData = new FormData();
      for (const file of files) {
        formData.append('files', file);
      }
      return api.uploadComponentFiles(mfgPartNumber, formData);
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries(['componentFiles', mfgPartNumber]);
      const results = response.data.results || [];
      const extracted = results.filter(r => r.type === 'archive');
      const regular = results.filter(r => r.type !== 'archive' && !r.error);
      const errors = results.filter(r => r.error);

      let message = '';
      if (regular.length > 0) message += `${regular.length} file(s) uploaded. `;
      if (extracted.length > 0) {
        const totalExtracted = extracted.reduce((sum, e) => sum + (e.filesExtracted || 0), 0);
        message += `${totalExtracted} file(s) extracted from ZIP. `;
      }
      if (errors.length > 0) message += `${errors.length} file(s) failed.`;

      if (message) showSuccess(message.trim());
    },
    onError: (error) => {
      showError('Upload failed: ' + (error.response?.data?.error || error.message));
    },
    onSettled: () => {
      setUploading(false);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async ({ category, filename }) => {
      return api.deleteComponentFile(category, mfgPartNumber, filename);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['componentFiles', mfgPartNumber]);
      showSuccess('File deleted');
      setDeleteConfirm({ show: false, category: '', filename: '' });
    },
    onError: (error) => {
      showError('Delete failed: ' + (error.response?.data?.error || error.message));
      setDeleteConfirm({ show: false, category: '', filename: '' });
    },
  });

  const handleFiles = useCallback((files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    uploadMutation.mutate(Array.from(files));
  }, [uploadMutation]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleFileInput = useCallback((e) => {
    handleFiles(e.target.files);
    e.target.value = ''; // Reset input
  }, [handleFiles]);

  const files = filesData?.files || {};
  const hasFiles = Object.keys(files).length > 0;

  if (!mfgPartNumber) return null;

  return (
    <div className="col-span-2 pt-4 mt-2">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-gray-900 dark:text-gray-100">CAD Files</h4>
        {hasFiles && (
          <a
            href={api.getFileExportUrl(mfgPartNumber)}
            className="btn-secondary text-xs flex items-center gap-1"
            title="Export all files as ZIP"
          >
            <Download className="w-3 h-3" />
            Export ZIP
          </a>
        )}
      </div>

      {/* File listing */}
      {isLoading ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">Loading files...</p>
      ) : hasFiles ? (
        <div className="space-y-2 mb-3">
          {Object.entries(files).map(([category, categoryFiles]) => (
            <div key={category}>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                {CATEGORY_LABELS[category] || category}
              </p>
              {categoryFiles.map((file) => (
                <div
                  key={file.name}
                  className="flex items-center justify-between gap-2 py-1 px-2 rounded text-xs bg-gray-50 dark:bg-[#333333] mb-1"
                >
                  <a
                    href={api.getFileDownloadUrl(category, mfgPartNumber, file.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline truncate flex-1"
                    title={file.name}
                  >
                    {file.name}
                  </a>
                  <span className="text-gray-400 dark:text-gray-500 shrink-0">
                    {file.size < 1024 ? `${file.size} B` : file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm({ show: true, category, filename: file.name })}
                      className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 shrink-0 text-xs"
                      title="Delete file"
                    >
                      x
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">No files uploaded</p>
      )}

      {/* Drag-and-drop upload area (edit mode only) */}
      {canEdit && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-md p-4 text-center transition-colors cursor-pointer ${
            isDragging
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
              : 'border-gray-300 dark:border-[#444444] hover:border-gray-400 dark:hover:border-[#555555]'
          }`}
          onClick={() => document.getElementById('file-upload-input')?.click()}
        >
          <input
            id="file-upload-input"
            type="file"
            multiple
            onChange={handleFileInput}
            className="hidden"
            accept=".brd,.kicad_mod,.lbr,.pad,.olb,.psm,.fsm,.bxl,.plb,.lib,.kicad_sym,.bsm,.SchLib,.step,.stp,.iges,.igs,.wrl,.3ds,.x_t,.mod,.cir,.sub,.inc,.zip"
          />
          {uploading ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">Uploading...</p>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isDragging ? 'Drop files here' : 'Drag and drop files here, or click to browse'}
            </p>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Supports CAD files and ZIP archives (SamacSys, SnapEDA, Ultra Librarian)
          </p>
        </div>
      )}

      {/* Delete confirmation modal */}
      <ConfirmationModal
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, category: '', filename: '' })}
        onConfirm={() => deleteMutation.mutate({ category: deleteConfirm.category, filename: deleteConfirm.filename })}
        title="Delete File"
        message={`Are you sure you want to delete "${deleteConfirm.filename}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmStyle="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};

export default ComponentFiles;
