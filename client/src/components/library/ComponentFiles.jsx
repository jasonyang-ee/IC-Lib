import { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../utils/api';
import { useNotification } from '../../contexts/NotificationContext';
import { Download, AlertCircle, Plus } from 'lucide-react';
import ConfirmationModal from '../common/ConfirmationModal';
import CadFilePickerModal from './CadFilePickerModal';

const CATEGORY_LABELS = {
  symbol: 'Schematic',
  footprint: 'Footprint',
  pad: 'Pad',
  model: '3D Model',
  pspice: 'PSpice',
  libraries: 'Library Archive',
};

// Deterministic display order for file type categories
const CATEGORY_ORDER = ['symbol', 'footprint', 'pad', 'model', 'pspice', 'libraries'];

// Categories that support renaming (pad files are excluded)
const RENAMEABLE_CATEGORIES = ['footprint', 'symbol', 'pspice'];

// Categories restricted to a single file per component
const SINGLE_FILE_CATEGORIES = ['symbol', 'model'];
const SINGLE_FILE_LABELS = { symbol: 'Schematic Symbol', model: '3D STEP Model' };

// Normalize file extension to lowercase (e.g., "file.OLB" → "file.olb")
const normalizeExt = (filename) => filename.replace(/\.[^.]+$/, m => m.toLowerCase());

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

/**
 * Component file upload and listing section
 * Shows below distributor info in component detail view
 */
const ComponentFiles = ({ mfgPartNumber, componentId, packageSize, canEdit = false, showRename = true, showDelete = true, onFileUploaded, onFileRenamed, onFileDeleted, onTempFileStaged, onCollisionFile, onFileSoftDeleted, onTempFileRemoved }) => {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useNotification();
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, category: '', filename: '' });
  const [renaming, setRenaming] = useState({ category: '', filename: '', newName: '' });
  const [mpnRenameConfirm, setMpnRenameConfirm] = useState({ show: false, category: '', oldFilename: '', newFilename: '' });
  const [pkgRenameConfirm, setPkgRenameConfirm] = useState({ show: false, category: '', oldFilename: '', newFilename: '' });
  const [linkPicker, setLinkPicker] = useState({ show: false, category: '' });
  const [localUploads, setLocalUploads] = useState({});
  const [fileConflict, setFileConflict] = useState(null);
  const [conflictPending, setConflictPending] = useState(false);

  // Fetch existing files
  const { data: filesData, isLoading } = useQuery({
    queryKey: ['componentFiles', mfgPartNumber],
    queryFn: async () => {
      const response = await api.listComponentFiles(mfgPartNumber);
      return response.data;
    },
    enabled: !!mfgPartNumber,
    refetchOnMount: 'always',
  });

  // Upload mutation — stages files in temp directory
  const uploadMutation = useMutation({
    mutationFn: async (files) => {
      const formData = new FormData();
      for (const file of files) {
        formData.append('files', file);
      }
      return api.uploadTempFiles(formData);
    },
    onSuccess: (response) => {
      if (mfgPartNumber) {
        queryClient.invalidateQueries(['componentFiles', mfgPartNumber]);
      }
      const results = response.data.results || [];
      // Normalize file extensions to lowercase (e.g., .OLB → .olb)
      for (const r of results) {
        if (r.filename) r.filename = normalizeExt(r.filename);
        if (r.extracted) {
          for (const ef of r.extracted) {
            if (ef.filename) ef.filename = normalizeExt(ef.filename);
          }
        }
        if (r.collisions) {
          for (const col of r.collisions) {
            if (col.filename) col.filename = normalizeExt(col.filename);
          }
        }
      }
      const extracted = results.filter(r => r.type === 'archive');
      const regular = results.filter(r => r.type !== 'archive' && !r.error && !r.collision);
      const collisionFiles = results.filter(r => r.collision && r.filename);
      const errors = results.filter(r => r.error);

      // Identify files that conflict with single-file category limits
      const priorFiles = filesRef.current;
      const conflictingKeys = new Set();
      let firstConflict = null;

      for (const r of regular) {
        if (r.type && SINGLE_FILE_CATEGORIES.includes(r.type) && priorFiles[r.type]?.length > 0) {
          conflictingKeys.add(`${r.type}:${r.filename}`);
          if (!firstConflict) {
            firstConflict = {
              category: r.type,
              categoryLabel: SINGLE_FILE_LABELS[r.type] || CATEGORY_LABELS[r.type] || r.type,
              existingFile: priorFiles[r.type][0].name,
              newFile: r.filename,
              newTempFilename: r.tempFilename,
              isLink: false,
            };
          }
        }
      }
      for (const r of extracted) {
        if (r.extracted) {
          for (const ef of r.extracted) {
            if (ef.category && SINGLE_FILE_CATEGORIES.includes(ef.category) && priorFiles[ef.category]?.length > 0) {
              conflictingKeys.add(`${ef.category}:${ef.filename}`);
              if (!firstConflict) {
                firstConflict = {
                  category: ef.category,
                  categoryLabel: SINGLE_FILE_LABELS[ef.category] || CATEGORY_LABELS[ef.category] || ef.category,
                  existingFile: priorFiles[ef.category][0].name,
                  newFile: ef.filename,
                  newTempFilename: ef.tempFilename,
                  isLink: false,
                };
              }
            }
          }
        }
      }

      // Notify parent of uploaded files — SKIP conflicting ones (deferred to conflict modal)
      if (onFileUploaded) {
        for (const r of regular) {
          if (r.type && r.filename && !conflictingKeys.has(`${r.type}:${r.filename}`)) {
            onFileUploaded(r.type, r.filename);
          }
        }
        for (const r of collisionFiles) {
          if (r.type && r.filename) onFileUploaded(r.type, r.filename);
        }
        for (const r of extracted) {
          if (r.extracted) {
            for (const ef of r.extracted) {
              if (ef.category && ef.filename && !conflictingKeys.has(`${ef.category}:${ef.filename}`)) {
                onFileUploaded(ef.category, ef.filename);
              }
            }
          }
          if (r.collisions) {
            for (const col of r.collisions) {
              if (col.category && col.filename) onFileUploaded(col.category, col.filename);
            }
          }
        }
      }

      // Notify parent of collision files (already on disk, need DB registration on save)
      if (onCollisionFile) {
        for (const r of collisionFiles) {
          if (r.type && r.filename) onCollisionFile({ filename: r.filename, category: r.type });
        }
        for (const r of extracted) {
          if (r.collisions) {
            for (const col of r.collisions) {
              if (col.category && col.filename) onCollisionFile({ filename: col.filename, category: col.category });
            }
          }
        }
      }

      // Notify parent of temp-staged files — SKIP conflicting ones
      if (onTempFileStaged) {
        for (const r of regular) {
          if (r.tempFilename && r.type && r.filename && !conflictingKeys.has(`${r.type}:${r.filename}`)) {
            onTempFileStaged({ tempFilename: r.tempFilename, category: r.type, filename: r.filename });
          }
        }
        for (const r of extracted) {
          if (r.extracted) {
            for (const ef of r.extracted) {
              if (ef.tempFilename && ef.category && ef.filename && !conflictingKeys.has(`${ef.category}:${ef.filename}`)) {
                onTempFileStaged({ tempFilename: ef.tempFilename, category: ef.category, filename: ef.filename });
              }
            }
          }
        }
      }

      let message = '';
      if (regular.length > 0) message += `${regular.length} file(s) uploaded. `;
      if (collisionFiles.length > 0) message += `${collisionFiles.length} file(s) already existed and linked. `;
      if (extracted.length > 0) {
        const totalExtracted = extracted.reduce((sum, e) => sum + (e.filesExtracted || 0), 0);
        message += `${totalExtracted} file(s) extracted from ZIP. `;
      }
      if (errors.length > 0) message += `${errors.length} file(s) failed.`;

      if (message) showSuccess(message.trim());

      // Track uploaded files locally (for display when server junction table may be empty)
      const newLocal = {};
      for (const r of regular) {
        if (r.type && r.filename) {
          if (!newLocal[r.type]) newLocal[r.type] = [];
          newLocal[r.type].push({ name: r.filename, size: 0, storage: 'temp', tempFilename: r.tempFilename });
        }
      }
      for (const r of collisionFiles) {
        if (r.type && r.filename) {
          if (!newLocal[r.type]) newLocal[r.type] = [];
          newLocal[r.type].push({ name: r.filename, size: 0, storage: 'local' });
        }
      }
      for (const r of extracted) {
        if (r.extracted) {
          for (const ef of r.extracted) {
            if (ef.category && ef.filename) {
              if (!newLocal[ef.category]) newLocal[ef.category] = [];
              newLocal[ef.category].push({ name: ef.filename, size: 0, storage: 'temp', tempFilename: ef.tempFilename });
            }
          }
        }
        if (r.collisions) {
          for (const col of r.collisions) {
            if (col.category && col.filename) {
              if (!newLocal[col.category]) newLocal[col.category] = [];
              newLocal[col.category].push({ name: col.filename, size: 0, storage: 'local' });
            }
          }
        }
      }
      if (Object.keys(newLocal).length > 0) {
        setLocalUploads(prev => {
          const merged = { ...prev };
          for (const [cat, catFiles] of Object.entries(newLocal)) {
            if (!merged[cat]) merged[cat] = [];
            for (const f of catFiles) {
              if (!merged[cat].find(e => e.name === f.name)) {
                merged[cat].push(f);
              }
            }
          }
          return merged;
        });
      }

      // Show conflict modal if a single-file category already had files
      if (firstConflict) {
        setFileConflict(firstConflict);
      }
    },
    onError: (error) => {
      showError('Upload failed: ' + (error.response?.data?.error || error.message));
    },
    onSettled: () => {
      setUploading(false);
    },
  });

  // Delete mutation (supports soft-delete and unlink responses)
  const deleteMutation = useMutation({
    mutationFn: async ({ category, filename }) => {
      return api.deleteComponentFile(category, mfgPartNumber, filename);
    },
    onSuccess: (response, variables) => {
      const data = response.data;
      queryClient.invalidateQueries(['componentFiles', mfgPartNumber]);

      if (data.unlinked) {
        showSuccess(`File unlinked (still used by ${data.remaining} other component${data.remaining !== 1 ? 's' : ''})`);
      } else if (data.softDeleted) {
        showSuccess('File moved to trash');
        if (onFileSoftDeleted) {
          onFileSoftDeleted({ tempFilename: data.tempFilename, category: variables.category, filename: variables.filename });
        }
      } else {
        showSuccess('File deleted');
      }

      // Remove from local uploads cache
      setLocalUploads(prev => {
        const updated = { ...prev };
        if (updated[variables.category]) {
          updated[variables.category] = updated[variables.category].filter(f => f.name !== variables.filename);
          if (updated[variables.category].length === 0) delete updated[variables.category];
        }
        return updated;
      });
      // Notify parent to update CIS filename list
      if (onFileDeleted) {
        onFileDeleted(variables.category, variables.filename);
      }
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
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries(['componentFiles', mfgPartNumber]);
      showSuccess(`Renamed to ${response.data.newFilename}`);
      // Notify parent of rename for editData update
      if (onFileRenamed) {
        onFileRenamed(variables.category, variables.oldFilename, response.data.newFilename);
      }
      // Handle temp file rename: update tempFiles tracking in parent
      if (response.data.isTemp && onTempFileRemoved && onTempFileStaged) {
        onTempFileRemoved(response.data.oldTempFilename);
        onTempFileStaged({ tempFilename: response.data.newTempFilename, category: variables.category, filename: response.data.newFilename });
      }
      // Update local uploads cache if applicable
      setLocalUploads(prev => {
        const updated = { ...prev };
        const cat = variables.category;
        if (updated[cat]) {
          updated[cat] = updated[cat].map(f => {
            if (f.name === variables.oldFilename) {
              const newEntry = { ...f, name: response.data.newFilename };
              // Update tempFilename for temp files
              if (response.data.isTemp && response.data.newTempFilename) {
                newEntry.tempFilename = response.data.newTempFilename;
              }
              return newEntry;
            }
            return f;
          });
        }
        return updated;
      });
      setRenaming({ category: '', filename: '', newName: '' });
      setMpnRenameConfirm({ show: false, category: '', oldFilename: '', newFilename: '' });
      setPkgRenameConfirm({ show: false, category: '', oldFilename: '', newFilename: '' });
    },
    onError: (error) => {
      showError('Rename failed: ' + (error.response?.data?.error || error.message));
      setMpnRenameConfirm({ show: false, category: '', oldFilename: '', newFilename: '' });
      setPkgRenameConfirm({ show: false, category: '', oldFilename: '', newFilename: '' });
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

  const requestMpnRename = (category, filename) => {
    const { suffix, ext } = extractDensitySuffix(filename);
    const sanitizedMpn = mfgPartNumber
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_');
    const newFilename = sanitizedMpn + suffix + ext;

    if (newFilename === filename) {
      showSuccess('Filename already matches MPN');
      return;
    }

    setMpnRenameConfirm({ show: true, category, oldFilename: filename, newFilename });
  };

  const confirmMpnRename = () => {
    const { category, oldFilename, newFilename } = mpnRenameConfirm;
    renameMutation.mutate({ category, oldFilename, newFilename });
  };

  const dismissMpnRenameConfirm = () => {
    setMpnRenameConfirm({ show: false, category: '', oldFilename: '', newFilename: '' });
  };

  const requestPkgRename = (category, filename) => {
    if (!packageSize) return;
    const { suffix, ext } = extractDensitySuffix(filename);
    const sanitizedPkg = packageSize
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_');
    const newFilename = sanitizedPkg + suffix + ext;

    if (newFilename === filename) {
      showSuccess('Filename already matches package');
      return;
    }

    setPkgRenameConfirm({ show: true, category, oldFilename: filename, newFilename });
  };

  const confirmPkgRename = () => {
    const { category, oldFilename, newFilename } = pkgRenameConfirm;
    renameMutation.mutate({ category, oldFilename, newFilename });
  };

  const dismissPkgRenameConfirm = () => {
    setPkgRenameConfirm({ show: false, category: '', oldFilename: '', newFilename: '' });
  };

  // Link existing file mutation
  const linkMutation = useMutation({
    mutationFn: async ({ cadFileId }) => {
      return api.linkFileToComponent(cadFileId, componentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['componentFiles', mfgPartNumber]);
      showSuccess('File linked successfully');
    },
    onError: (error) => {
      showError('Link failed: ' + (error.response?.data?.error || error.message));
    },
  });

  const cancelRename = () => {
    setRenaming({ category: '', filename: '', newName: '' });
  };

  // Handle delete — temp files use cleanup endpoint, existing files use regular delete
  const handleConfirmDelete = async () => {
    const { category, filename } = deleteConfirm;
    // Check if this file is a temp upload
    const localFile = localUploads[category]?.find(f => f.name === filename && f.storage === 'temp');
    if (localFile && localFile.tempFilename) {
      try {
        await api.cleanupTempFiles({ tempFilenames: [localFile.tempFilename] });
        showSuccess('File removed');
      } catch (err) {
        showError('Delete failed: ' + (err.response?.data?.error || err.message));
      }
      // Remove from local uploads
      setLocalUploads(prev => {
        const updated = { ...prev };
        if (updated[category]) {
          updated[category] = updated[category].filter(f => f.name !== filename);
          if (updated[category].length === 0) delete updated[category];
        }
        return updated;
      });
      if (onFileDeleted) onFileDeleted(category, filename);
      // Notify parent to remove from tempFiles state
      if (onTempFileRemoved && localFile.tempFilename) {
        onTempFileRemoved(localFile.tempFilename);
      }
      setDeleteConfirm({ show: false, category: '', filename: '' });
    } else {
      // Existing file — use regular delete mutation
      deleteMutation.mutate({ category, filename });
    }
  };

  const isRenaming = (category, filename) => {
    return renaming.category === category && renaming.filename === filename;
  };

  // Single-file conflict resolution: keep the existing file, discard the new upload
  const handleKeepOriginal = async () => {
    if (!fileConflict) return;
    setConflictPending(true);
    try {
      if (!fileConflict.isLink && fileConflict.newTempFilename) {
        // Upload conflict: clean up the new temp file
        await api.cleanupTempFiles({ tempFilenames: [fileConflict.newTempFilename] });
      }
      // Remove new file from localUploads display
      setLocalUploads(prev => {
        const updated = { ...prev };
        if (updated[fileConflict.category]) {
          updated[fileConflict.category] = updated[fileConflict.category].filter(f => f.name !== fileConflict.newFile);
          if (updated[fileConflict.category].length === 0) delete updated[fileConflict.category];
        }
        return updated;
      });
    } catch (e) {
      console.error('Conflict cleanup failed:', e);
    }
    setConflictPending(false);
    setFileConflict(null);
  };

  // Single-file conflict resolution: replace existing file with the new one
  const handleUseNew = async () => {
    if (!fileConflict) return;
    setConflictPending(true);
    try {
      // Delete/unlink the existing file
      const deleteResponse = await api.deleteComponentFile(fileConflict.category, mfgPartNumber, fileConflict.existingFile);
      const deleteData = deleteResponse.data;

      // Track soft-delete for restore-on-cancel
      if (deleteData.softDeleted && onFileSoftDeleted) {
        onFileSoftDeleted({ tempFilename: deleteData.tempFilename, category: fileConflict.category, filename: fileConflict.existingFile });
      }

      // Remove old file from localUploads
      setLocalUploads(prev => {
        const updated = { ...prev };
        if (updated[fileConflict.category]) {
          updated[fileConflict.category] = updated[fileConflict.category].filter(f => f.name !== fileConflict.existingFile);
          if (updated[fileConflict.category].length === 0) delete updated[fileConflict.category];
        }
        return updated;
      });
      // Remove old file from editData
      if (onFileDeleted) onFileDeleted(fileConflict.category, fileConflict.existingFile);

      if (fileConflict.isLink) {
        // Link conflict: now perform the deferred link
        if (fileConflict.cadFileId && componentId) {
          linkMutation.mutate({ cadFileId: fileConflict.cadFileId });
        }
        if (onFileUploaded) onFileUploaded(fileConflict.category, fileConflict.newFile);
        // Add to localUploads
        setLocalUploads(prev => {
          const updated = { ...prev };
          if (!updated[fileConflict.category]) updated[fileConflict.category] = [];
          if (!updated[fileConflict.category].find(f => f.name === fileConflict.newFile)) {
            updated[fileConflict.category].push({ name: fileConflict.newFile, size: 0, storage: 'local' });
          }
          return updated;
        });
      } else {
        // Upload conflict: register the new file (was deferred in onSuccess)
        if (onFileUploaded) onFileUploaded(fileConflict.category, fileConflict.newFile);
        if (onTempFileStaged && fileConflict.newTempFilename) {
          onTempFileStaged({ tempFilename: fileConflict.newTempFilename, category: fileConflict.category, filename: fileConflict.newFile });
        }
      }

      // Refresh files
      if (mfgPartNumber) queryClient.invalidateQueries(['componentFiles', mfgPartNumber]);
    } catch (e) {
      showError('Failed to replace file: ' + (e.response?.data?.error || e.message));
    }
    setConflictPending(false);
    setFileConflict(null);
  };

  // Merge server files with locally tracked uploads (for add mode when junction table is empty)
  const serverFiles = filesData?.files || {};
  const files = { ...serverFiles };
  for (const [cat, catFiles] of Object.entries(localUploads)) {
    if (!files[cat]) files[cat] = [];
    for (const f of catFiles) {
      if (!files[cat].find(e => e.name === f.name)) {
        files[cat].push(f);
      }
    }
  }
  const hasFiles = Object.keys(files).length > 0;

  // Ref to track current files for conflict detection inside mutation callbacks
  const filesRef = useRef({});
  filesRef.current = files;

  return (
    <div className="col-span-2 pt-4 mt-2">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-gray-900 dark:text-gray-100">CAD File Management</h4>
        {mfgPartNumber && hasFiles && (
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
      {isLoading && mfgPartNumber ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">Loading files...</p>
      ) : hasFiles ? (
        <div className="space-y-2 mb-3">
          {CATEGORY_ORDER.filter(cat => files[cat]?.length > 0).map((category) => (
            <div key={category}>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                {CATEGORY_LABELS[category] || category}
              </p>
              {files[category].map((file) => (
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
                    <div className="flex items-start justify-between gap-2 py-1 px-2 rounded text-xs bg-gray-50 dark:bg-[#333333]">
                      {file.missing ? (
                        <span className="text-gray-700 dark:text-gray-300 break-all flex-1" title={file.name}>
                          {file.name}
                          <span className="text-red-600 dark:text-red-400 font-semibold ml-1.5">Missing</span>
                        </span>
                      ) : mfgPartNumber ? (
                        <a
                          href={api.getFileDownloadUrl(category, mfgPartNumber, file.name)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:underline break-all flex-1"
                          title={file.name}
                        >
                          {file.name}
                        </a>
                      ) : (
                        <span className="text-gray-700 dark:text-gray-300 break-all flex-1" title={file.name}>
                          {file.name}
                        </span>
                      )}
                      {!file.missing && (
                        <span className="text-gray-400 dark:text-gray-500 shrink-0">
                          {file.size < 1024 ? `${file.size} B` : file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}
                        </span>
                      )}
                      {canEdit && (
                        <div className="flex items-center gap-1 shrink-0">
                          {showRename && mfgPartNumber && RENAMEABLE_CATEGORIES.includes(category) && (
                            <>
                              <button
                                type="button"
                                onClick={() => requestMpnRename(category, file.name)}
                                className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 text-xs px-1"
                                title="Apply MPN as filename"
                              >
                                MPN
                              </button>
                              {packageSize && (
                                <button
                                  type="button"
                                  onClick={() => requestPkgRename(category, file.name)}
                                  className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 text-xs px-1"
                                  title="Apply package size as filename"
                                >
                                  PKG
                                </button>
                              )}
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
                          {showDelete && (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm({ show: true, category, filename: file.name })}
                            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-xs px-1"
                            title="Delete file"
                          >
                            x
                          </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {canEdit && mfgPartNumber && (componentId || onFileUploaded) && (
                <button
                  type="button"
                  onClick={() => setLinkPicker({ show: true, category })}
                  className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center gap-1 mt-1"
                >
                  <Plus className="w-3 h-3" />
                  Link existing file
                </button>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {/* Empty categories with link buttons (requires MPN) */}
      {mfgPartNumber && canEdit && (componentId || onFileUploaded) && (() => {
        const ALL_CATEGORIES = ['symbol', 'footprint', 'pad', 'model', 'pspice'];
        const emptyCategories = ALL_CATEGORIES.filter(c => !files[c] || files[c].length === 0);
        if (emptyCategories.length === 0) return null;
        return (
          <div className="space-y-2 mb-3">
            {emptyCategories.map(category => (
              <div key={category}>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  {CATEGORY_LABELS[category] || category}
                </p>
                <button
                  type="button"
                  onClick={() => setLinkPicker({ show: true, category })}
                  className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Link existing file
                </button>
              </div>
            ))}
          </div>
        );
      })()}

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
        onConfirm={handleConfirmDelete}
        title="Delete File"
        message={`Are you sure you want to delete "${deleteConfirm.filename}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmStyle="danger"
        isLoading={deleteMutation.isPending}
      />

      {/* MPN Rename confirmation modal */}
      {mpnRenameConfirm.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={dismissMpnRenameConfirm}>
          <div
            className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-[#3a3a3a] animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-blue-100 dark:bg-blue-900/20">
              <AlertCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 text-center mb-2">
              Rename to MPN
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-4">
              This will physically rename the file on disk.
            </p>
            <div className="bg-gray-50 dark:bg-[#333333] rounded-lg p-3 mb-6 font-mono text-sm">
              <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">Current</div>
              <div className="text-gray-700 dark:text-gray-300 break-all">{mpnRenameConfirm.oldFilename}</div>
              <div className="text-gray-400 text-center my-2">&darr;</div>
              <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">New</div>
              <div className="text-primary-600 dark:text-primary-400 break-all font-semibold">{mpnRenameConfirm.newFilename}</div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={dismissMpnRenameConfirm}
                disabled={renameMutation.isPending}
                className="flex-1 px-4 py-2.5 bg-gray-200 dark:bg-[#333333] text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-[#3a3a3a] transition-colors font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmMpnRename}
                disabled={renameMutation.isPending}
                className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50"
              >
                {renameMutation.isPending ? 'Renaming...' : 'Rename'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PKG Rename confirmation modal */}
      {pkgRenameConfirm.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={dismissPkgRenameConfirm}>
          <div
            className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-[#3a3a3a] animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-blue-100 dark:bg-blue-900/20">
              <AlertCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 text-center mb-2">
              Rename to Package
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-4">
              This will physically rename the file on disk.
            </p>
            <div className="bg-gray-50 dark:bg-[#333333] rounded-lg p-3 mb-6 font-mono text-sm">
              <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">Current</div>
              <div className="text-gray-700 dark:text-gray-300 break-all">{pkgRenameConfirm.oldFilename}</div>
              <div className="text-gray-400 text-center my-2">&darr;</div>
              <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">New</div>
              <div className="text-primary-600 dark:text-primary-400 break-all font-semibold">{pkgRenameConfirm.newFilename}</div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={dismissPkgRenameConfirm}
                disabled={renameMutation.isPending}
                className="flex-1 px-4 py-2.5 bg-gray-200 dark:bg-[#333333] text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-[#3a3a3a] transition-colors font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmPkgRename}
                disabled={renameMutation.isPending}
                className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50"
              >
                {renameMutation.isPending ? 'Renaming...' : 'Rename'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link existing file picker modal */}
      <CadFilePickerModal
        isOpen={linkPicker.show}
        onClose={() => setLinkPicker({ show: false, category: '' })}
        onSelect={(file) => {
          const cat = linkPicker.category;

          // Check single-file category conflict
          if (cat && SINGLE_FILE_CATEGORIES.includes(cat) && filesRef.current[cat]?.length > 0) {
            setFileConflict({
              category: cat,
              categoryLabel: SINGLE_FILE_LABELS[cat] || CATEGORY_LABELS[cat] || cat,
              existingFile: filesRef.current[cat][0].name,
              newFile: file.file_name,
              newTempFilename: null,
              isLink: true,
              cadFileId: file.id,
            });
            setLinkPicker({ show: false, category: '' });
            return;
          }

          if (file.id && componentId) {
            linkMutation.mutate({ cadFileId: file.id });
          }
          if (onFileUploaded && cat) {
            onFileUploaded(cat, file.file_name);
          }
          // Add to localUploads so the file appears in the list immediately
          if (cat && file.file_name) {
            setLocalUploads(prev => {
              const updated = { ...prev };
              if (!updated[cat]) updated[cat] = [];
              if (!updated[cat].find(f => f.name === file.file_name)) {
                updated[cat].push({ name: file.file_name, size: 0, storage: 'local' });
              }
              return updated;
            });
          }
        }}
        fileType={linkPicker.category || undefined}
        excludeFileIds={[]}
      />

      {/* Single-file category conflict modal */}
      {fileConflict && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !conflictPending && setFileConflict(null)}>
          <div
            className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-[#3a3a3a] animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-yellow-100 dark:bg-yellow-900/20">
              <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 text-center mb-2">
              Replace {fileConflict.categoryLabel} File?
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-4">
              Only one {fileConflict.categoryLabel.toLowerCase()} file is allowed per component. Choose which to keep:
            </p>
            <div className="bg-gray-50 dark:bg-[#333333] rounded-lg p-3 mb-6 text-sm">
              <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">Current file</div>
              <div className="text-gray-700 dark:text-gray-300 break-all font-medium">{fileConflict.existingFile}</div>
              <div className="text-gray-400 text-center my-2">vs</div>
              <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">New file</div>
              <div className="text-primary-600 dark:text-primary-400 break-all font-semibold">{fileConflict.newFile}</div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleKeepOriginal}
                disabled={conflictPending}
                className="flex-1 px-4 py-2.5 bg-gray-200 dark:bg-[#333333] text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-[#3a3a3a] transition-colors font-medium disabled:opacity-50"
              >
                {conflictPending ? '...' : 'Keep Original'}
              </button>
              <button
                onClick={handleUseNew}
                disabled={conflictPending}
                className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50"
              >
                {conflictPending ? 'Replacing...' : 'Use New File'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComponentFiles;
