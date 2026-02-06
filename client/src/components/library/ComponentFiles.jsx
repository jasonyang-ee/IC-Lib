import { useState, useCallback, useEffect } from 'react';
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

// Categories that support renaming (pad files are excluded)
const RENAMEABLE_CATEGORIES = ['footprint', 'symbol', 'pspice'];

// Density suffixes that should be preserved when applying MPN as filename
const DENSITY_SUFFIXES = ['-M', '-L', '-m', '-l'];

/**
 * Extract density suffix from filename if present
 */
function extractDensitySuffix(filename) {
  const ext = filename.substring(filename.lastIndexOf('.'));
  const baseName = filename.substring(0, filename.lastIndexOf('.'));
  for (const suffix of DENSITY_SUFFIXES) {
    if (baseName.endsWith(suffix)) {
      return { base: baseName.substring(0, baseName.length - suffix.length), suffix, ext };
    }
  }
  return { base: baseName, suffix: '', ext };
}

// Map file categories to component detail fields
const CATEGORY_TO_FIELD = {
  footprint: 'pcb_footprint',
  symbol: 'schematic',
  model: 'step_model',
  pspice: 'pspice',
  pad: 'pad_file',
};

/**
 * Component file upload and listing section
 * Shows below distributor info in component detail view
 */
const ComponentFiles = ({ mfgPartNumber, canEdit = false, onFilesChanged }) => {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useNotification();
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, category: '', filename: '' });
  const [renaming, setRenaming] = useState({ category: '', filename: '', newName: '' });

  // Fetch existing files
  const { data: filesData, isLoading } = useQuery({
    queryKey: ['componentFiles', mfgPartNumber],
    queryFn: async () => {
      const response = await api.listComponentFiles(mfgPartNumber);
      return response.data;
    },
    enabled: !!mfgPartNumber,
  });

  // Notify parent when files change (for auto-filling CAD fields)
  useEffect(() => {
    if (!onFilesChanged || !filesData?.files) return;
    const fileMap = {};
    for (const [category, categoryFiles] of Object.entries(filesData.files)) {
      const field = CATEGORY_TO_FIELD[category];
      if (field && categoryFiles.length > 0) {
        fileMap[field] = categoryFiles[0].path;
      }
    }
    onFilesChanged(fileMap);
  }, [filesData, onFilesChanged]);

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

  // Rename mutation
  const renameMutation = useMutation({
    mutationFn: async ({ category, oldFilename, newFilename }) => {
      return api.renameComponentFile(category, mfgPartNumber, oldFilename, newFilename);
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries(['componentFiles', mfgPartNumber]);
      showSuccess(`Renamed to ${response.data.newFilename}`);
      setRenaming({ category: '', filename: '', newName: '' });
    },
    onError: (error) => {
      showError('Rename failed: ' + (error.response?.data?.error || error.message));
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

  const startRename = (category, filename) => {
    const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
    setRenaming({ category, filename, newName: nameWithoutExt });
  };

  const submitRename = () => {
    if (!renaming.newName.trim()) return;
    const ext = renaming.filename.substring(renaming.filename.lastIndexOf('.'));
    renameMutation.mutate({
      category: renaming.category,
      oldFilename: renaming.filename,
      newFilename: renaming.newName + ext,
    });
  };

  const applyMpnAsFilename = (category, filename) => {
    const { suffix, ext } = extractDensitySuffix(filename);
    const sanitizedMpn = mfgPartNumber
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_');
    const newFilename = sanitizedMpn + suffix + ext;

    if (newFilename === filename) {
      showSuccess('Filename already matches MPN');
      return;
    }

    renameMutation.mutate({
      category,
      oldFilename: filename,
      newFilename,
    });
  };

  const cancelRename = () => {
    setRenaming({ category: '', filename: '', newName: '' });
  };

  const isRenaming = (category, filename) => {
    return renaming.category === category && renaming.filename === filename;
  };

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
                <div key={file.name} className="mb-1">
                  {isRenaming(category, file.name) ? (
                    /* Inline rename form */
                    <div className="flex items-center gap-1 py-1 px-2 rounded text-xs bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                      <input
                        type="text"
                        value={renaming.newName}
                        onChange={(e) => setRenaming(prev => ({ ...prev, newName: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') submitRename();
                          if (e.key === 'Escape') cancelRename();
                        }}
                        className="flex-1 px-1.5 py-0.5 border border-gray-300 dark:border-[#444] rounded text-xs bg-white dark:bg-[#2a2a2a] dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        autoFocus
                      />
                      <span className="text-gray-400 dark:text-gray-500 text-xs">
                        {file.name.substring(file.name.lastIndexOf('.'))}
                      </span>
                      <button
                        type="button"
                        onClick={submitRename}
                        disabled={renameMutation.isPending}
                        className="px-1.5 py-0.5 bg-primary-600 hover:bg-primary-700 text-white rounded text-xs disabled:opacity-50"
                      >
                        {renameMutation.isPending ? '...' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={cancelRename}
                        className="px-1.5 py-0.5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    /* Normal file row */
                    <div className="flex items-center justify-between gap-2 py-1 px-2 rounded text-xs bg-gray-50 dark:bg-[#333333]">
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
                        <div className="flex items-center gap-1 shrink-0">
                          {RENAMEABLE_CATEGORIES.includes(category) && (
                            <>
                              <button
                                type="button"
                                onClick={() => applyMpnAsFilename(category, file.name)}
                                className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 text-xs px-1"
                                title="Apply MPN as filename"
                              >
                                MPN
                              </button>
                              <button
                                type="button"
                                onClick={() => startRename(category, file.name)}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 text-xs px-1"
                                title="Rename file"
                              >
                                Rename
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm({ show: true, category, filename: file.name })}
                            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-xs px-1"
                            title="Delete file"
                          >
                            x
                          </button>
                        </div>
                      )}
                    </div>
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
