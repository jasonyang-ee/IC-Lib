import { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../utils/api';
import { formatPackageFilenameBase } from '../../utils/cadFileNaming';
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
const RENAMEABLE_CATEGORIES = ['footprint', 'symbol', 'model', 'pspice'];

// Categories restricted to a single file per component
const SINGLE_FILE_CATEGORIES = ['symbol', 'model'];
const SINGLE_FILE_LABELS = { symbol: 'Schematic Symbol', model: '3D STEP Model' };
const MAX_UPLOAD_SIZE_BYTES = 250 * 1024 * 1024;

// Normalize file extension to lowercase (e.g., "file.OLB" → "file.olb")
const normalizeExt = (filename) => filename.replace(/\.[^.]+$/, m => m.toLowerCase());

/**
 * Iterate over all individual upload results (regular + extracted from archives).
 * Calls `fn({ category, filename, tempFilename, type })` for each file.
 */
function forEachUploadResult(results, fn) {
  for (const r of results) {
    if (r.type === 'archive' && r.extracted) {
      for (const ef of r.extracted) {
        if (ef.category && ef.filename) {
          fn({ category: ef.category, filename: ef.filename, tempFilename: ef.tempFilename, type: ef.category });
        }
      }
    } else if (r.type && r.type !== 'archive' && !r.error && r.filename) {
      fn({ category: r.type, filename: r.filename, tempFilename: r.tempFilename, type: r.type });
    }
  }
}

/**
 * Reusable rename confirmation modal (used for MPN rename and Package rename).
 */
const RenameConfirmationModal = ({ show, title, oldFilename, newFilename, onConfirm, onDismiss, isPending }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onDismiss}>
      <div
        className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-[#3a3a3a] animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-blue-100 dark:bg-blue-900/20">
          <AlertCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 text-center mb-2">
          {title}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-4">
          This will physically rename the file on disk.
        </p>
        <div className="bg-gray-50 dark:bg-[#333333] rounded-lg p-3 mb-6 font-mono text-sm">
          <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">Current</div>
          <div className="text-gray-700 dark:text-gray-300 break-all">{oldFilename}</div>
          <div className="text-gray-400 text-center my-2">&darr;</div>
          <div className="text-gray-500 dark:text-gray-400 text-xs mb-1">New</div>
          <div className="text-primary-600 dark:text-primary-400 break-all font-semibold">{newFilename}</div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onDismiss}
            disabled={isPending}
            className="flex-1 px-4 py-2.5 bg-gray-200 dark:bg-[#333333] text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-[#3a3a3a] transition-colors font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50"
          >
            {isPending ? 'Renaming...' : 'Rename'}
          </button>
        </div>
      </div>
    </div>
  );
};

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

/** Enforce lowercase base name for .psm files (PSM files are always fully lowercase) */
function enforcePsmCase(filename) {
  if (filename.toLowerCase().endsWith('.psm')) {
    const ext = filename.substring(filename.lastIndexOf('.'));
    const base = filename.substring(0, filename.lastIndexOf('.'));
    return base.toLowerCase() + ext.toLowerCase();
  }
  return filename;
}

/**
 * Component file upload and listing section
 * Shows below distributor info in component detail view
 */
const ComponentFiles = ({ mfgPartNumber, componentId, packageSize, canEdit = false, showRename = true, showDelete = true, ecoMode = false, onFileUploaded, onFileRenamed, onFileDeleted, onTempFileStaged, onFileSoftDeleted, onTempFileRemoved, onCadFileAdded, onCadFileRemoved, onCadFileRenamed }) => {
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
  const [stagedRemovals, setStagedRemovals] = useState({});

  const removeLocalUpload = (category, filename) => {
    setLocalUploads(prev => {
      const updated = { ...prev };
      if (updated[category]) {
        updated[category] = updated[category].filter(file => file.name !== filename);
        if (updated[category].length === 0) delete updated[category];
      }
      return updated;
    });
  };

  const stageRemoval = (category, filename) => {
    setStagedRemovals(prev => {
      const next = { ...prev };
      const current = new Set(next[category] || []);
      current.add(filename);
      next[category] = [...current];
      return next;
    });
  };

  const clearStagedRemoval = (category, filename) => {
    setStagedRemovals(prev => {
      if (!prev[category]?.includes(filename)) return prev;

      const next = { ...prev };
      next[category] = next[category].filter(name => name !== filename);
      if (next[category].length === 0) delete next[category];
      return next;
    });
  };

  const notifyCadFileAdded = (category, filename) => {
    clearStagedRemoval(category, filename);
    onCadFileAdded?.({ category, filename });
  };

  const notifyCadFileRemoved = (category, filename) => {
    onCadFileRemoved?.({ category, filename });
  };

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
      }
      const extracted = results.filter(r => r.type === 'archive');
      const regular = results.filter(r => r.type !== 'archive' && !r.error);
      const errors = results.filter(r => r.error);

      // Identify files that conflict with single-file category limits
      const priorFiles = filesRef.current;
      const conflictingKeys = new Set();
      let firstConflict = null;

      forEachUploadResult(results, ({ category, filename, tempFilename }) => {
        if (SINGLE_FILE_CATEGORIES.includes(category) && priorFiles[category]?.length > 0) {
          conflictingKeys.add(`${category}:${filename}`);
          if (!firstConflict) {
            firstConflict = {
              category,
              categoryLabel: SINGLE_FILE_LABELS[category] || CATEGORY_LABELS[category] || category,
              existingFile: priorFiles[category][0].name,
              newFile: filename,
              newTempFilename: tempFilename,
              isLink: false,
            };
          }
        }
      });

      // Notify parent of uploaded files — SKIP conflicting ones (deferred to conflict modal)
      forEachUploadResult(results, ({ category, filename, tempFilename }) => {
        const key = `${category}:${filename}`;
        if (conflictingKeys.has(key)) return;
        if (onFileUploaded) onFileUploaded(category, filename);
        notifyCadFileAdded(category, filename);
        if (onTempFileStaged && tempFilename) {
          onTempFileStaged({ tempFilename, category, filename });
        }
      });

      let message = '';
      if (regular.length > 0) message += `${regular.length} file(s) uploaded. `;
      if (extracted.length > 0) {
        const totalExtracted = extracted.reduce((sum, e) => sum + (e.filesExtracted || 0), 0);
        message += `${totalExtracted} file(s) extracted from ZIP. `;
      }
      if (errors.length > 0) message += `${errors.length} file(s) failed.`;

      if (message) showSuccess(message.trim());

      // Track uploaded files locally (for display when server junction table may be empty)
      const newLocal = {};
      forEachUploadResult(results, ({ category, filename, tempFilename }) => {
        if (!newLocal[category]) newLocal[category] = [];
        newLocal[category].push({ name: filename, size: 0, storage: 'temp', tempFilename });
      });
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
    mutationFn: async ({ category, oldFilename, newFilename, pairedFilename, pairedNewFilename }) => {
      const result = await api.renameComponentFile(category, mfgPartNumber, oldFilename, newFilename);
      // If there's a paired file (e.g., .dra paired with .psm), rename it too
      if (pairedFilename && pairedNewFilename) {
        try {
          await api.renameComponentFile(category, mfgPartNumber, pairedFilename, pairedNewFilename);
        } catch (e) {
          console.error('Failed to rename paired file:', e);
        }
      }
      return { ...result, pairedFilename, pairedNewFilename };
    },
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries(['componentFiles', mfgPartNumber]);
      showSuccess(`Renamed to ${response.data.newFilename}`);
      // Notify parent of rename for editData update
      if (onFileRenamed) {
        onFileRenamed(variables.category, variables.oldFilename, response.data.newFilename);
      }
      onCadFileRenamed?.({
        category: variables.category,
        oldFilename: variables.oldFilename,
        newFilename: response.data.newFilename,
      });
      // Also notify parent of paired rename
      if (variables.pairedFilename && variables.pairedNewFilename && onFileRenamed) {
        onFileRenamed(variables.category, variables.pairedFilename, variables.pairedNewFilename);
      }
      if (variables.pairedFilename && variables.pairedNewFilename) {
        onCadFileRenamed?.({
          category: variables.category,
          oldFilename: variables.pairedFilename,
          newFilename: variables.pairedNewFilename,
        });
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
            if (variables.pairedFilename && f.name === variables.pairedFilename) {
              return { ...f, name: variables.pairedNewFilename };
            }
            return f;
          });
        }
        return updated;
      });
      setRenaming({ category: '', filename: '', newName: '', pairedFilename: null });
      setMpnRenameConfirm({ show: false, category: '', oldFilename: '', newFilename: '', pairedFilename: null });
      setPkgRenameConfirm({ show: false, category: '', oldFilename: '', newFilename: '', pairedFilename: null });
    },
    onError: (error) => {
      showError('Rename failed: ' + (error.response?.data?.error || error.message));
      setMpnRenameConfirm({ show: false, category: '', oldFilename: '', newFilename: '', pairedFilename: null });
      setPkgRenameConfirm({ show: false, category: '', oldFilename: '', newFilename: '', pairedFilename: null });
    },
  });

  const handleFiles = useCallback((files) => {
    if (!files || files.length === 0) return;

    const selectedFiles = Array.from(files);
    const oversizedFiles = selectedFiles.filter(file => file.size > MAX_UPLOAD_SIZE_BYTES);
    if (oversizedFiles.length > 0) {
      showError(`Upload failed: ${oversizedFiles.map(file => file.name).join(', ')} exceeds the 250MB per-file limit.`);
      return;
    }

    setUploading(true);
    uploadMutation.mutate(selectedFiles);
  }, [showError, uploadMutation]);

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

  const startRename = (category, filename, pairedFilename = null) => {
    const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
    setRenaming({ category, filename, newName: nameWithoutExt, pairedFilename });
  };

  const submitRename = () => {
    if (!renaming.newName.trim()) return;
    const ext = renaming.filename.substring(renaming.filename.lastIndexOf('.'));
    renameMutation.mutate({
      category: renaming.category,
      oldFilename: renaming.filename,
      newFilename: enforcePsmCase(renaming.newName + ext),
      pairedFilename: renaming.pairedFilename || undefined,
      pairedNewFilename: renaming.pairedFilename ? renaming.newName + renaming.pairedFilename.substring(renaming.pairedFilename.lastIndexOf('.')) : undefined,
    });
  };

  const requestMpnRename = (category, filename, pairedFilename = null) => {
    const { suffix, ext } = extractDensitySuffix(filename);
    const sanitizedMpn = mfgPartNumber
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_');
    const newFilename = enforcePsmCase(sanitizedMpn + suffix + ext);

    if (newFilename === filename) {
      showSuccess('Filename already matches MPN');
      return;
    }

    setMpnRenameConfirm({ show: true, category, oldFilename: filename, newFilename, pairedFilename });
  };

  const confirmMpnRename = () => {
    const { category, oldFilename, newFilename, pairedFilename } = mpnRenameConfirm;
    const newBase = newFilename.substring(0, newFilename.lastIndexOf('.'));
    renameMutation.mutate({
      category,
      oldFilename,
      newFilename,
      pairedFilename: pairedFilename || undefined,
      pairedNewFilename: pairedFilename ? newBase + pairedFilename.substring(pairedFilename.lastIndexOf('.')) : undefined,
    });
  };

  const dismissMpnRenameConfirm = () => {
    setMpnRenameConfirm({ show: false, category: '', oldFilename: '', newFilename: '', pairedFilename: null });
  };

  const requestPkgRename = (category, filename, pairedFilename = null) => {
    if (!packageSize) return;
    const { suffix, ext } = extractDensitySuffix(filename);
    const sanitizedPkg = formatPackageFilenameBase(packageSize);
    if (!sanitizedPkg) {
      showError('Package name is empty after formatting');
      return;
    }
    const newFilename = enforcePsmCase(sanitizedPkg + suffix + ext);

    if (newFilename === filename) {
      showSuccess('Filename already matches package');
      return;
    }

    setPkgRenameConfirm({ show: true, category, oldFilename: filename, newFilename, pairedFilename });
  };

  const confirmPkgRename = () => {
    const { category, oldFilename, newFilename, pairedFilename } = pkgRenameConfirm;
    const newBase = newFilename.substring(0, newFilename.lastIndexOf('.'));
    renameMutation.mutate({
      category,
      oldFilename,
      newFilename,
      pairedFilename: pairedFilename || undefined,
      pairedNewFilename: pairedFilename ? newBase + pairedFilename.substring(pairedFilename.lastIndexOf('.')) : undefined,
    });
  };

  const dismissPkgRenameConfirm = () => {
    setPkgRenameConfirm({ show: false, category: '', oldFilename: '', newFilename: '', pairedFilename: null });
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
    setRenaming({ category: '', filename: '', newName: '', pairedFilename: null });
  };

  // Handle delete — temp files use cleanup endpoint, existing files use regular delete
  const handleConfirmDelete = async () => {
    const { category, filename } = deleteConfirm;
    const localFile = localUploads[category]?.find(f => f.name === filename);
    // Check if this file is a temp upload
    if (localFile && localFile.tempFilename) {
      try {
        await api.cleanupTempFiles({ tempFilenames: [localFile.tempFilename] });
        showSuccess('File removed');
      } catch (err) {
        showError('Delete failed: ' + (err.response?.data?.error || err.message));
      }
      // Remove from local uploads
      removeLocalUpload(category, filename);
      if (onFileDeleted) onFileDeleted(category, filename);
      notifyCadFileRemoved(category, filename);
      // Notify parent to remove from tempFiles state
      if (onTempFileRemoved && localFile.tempFilename) {
        onTempFileRemoved(localFile.tempFilename);
      }
      setDeleteConfirm({ show: false, category: '', filename: '' });
    } else if (ecoMode) {
      if (localFile) {
        removeLocalUpload(category, filename);
      } else {
        stageRemoval(category, filename);
      }

      if (onFileDeleted) onFileDeleted(category, filename);
      notifyCadFileRemoved(category, filename);
      showSuccess('File change staged for ECO');
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
      if (ecoMode) {
        const existingLocalFile = localUploads[fileConflict.category]?.find(file => file.name === fileConflict.existingFile);
        if (existingLocalFile) {
          removeLocalUpload(fileConflict.category, fileConflict.existingFile);
        } else {
          stageRemoval(fileConflict.category, fileConflict.existingFile);
        }
        if (onFileDeleted) onFileDeleted(fileConflict.category, fileConflict.existingFile);
        notifyCadFileRemoved(fileConflict.category, fileConflict.existingFile);
      } else {
        // Delete/unlink the existing file
        const deleteResponse = await api.deleteComponentFile(fileConflict.category, mfgPartNumber, fileConflict.existingFile);
        const deleteData = deleteResponse.data;

        // Track soft-delete for restore-on-cancel
        if (deleteData.softDeleted && onFileSoftDeleted) {
          onFileSoftDeleted({ tempFilename: deleteData.tempFilename, category: fileConflict.category, filename: fileConflict.existingFile });
        }

        // Remove old file from localUploads
        removeLocalUpload(fileConflict.category, fileConflict.existingFile);
        // Remove old file from editData
        if (onFileDeleted) onFileDeleted(fileConflict.category, fileConflict.existingFile);
      }

      if (fileConflict.isLink) {
        // Link conflict: now perform the deferred link
        if (!ecoMode && fileConflict.cadFileId && componentId) {
          linkMutation.mutate({ cadFileId: fileConflict.cadFileId });
        }
        if (onFileUploaded) onFileUploaded(fileConflict.category, fileConflict.newFile);
        notifyCadFileAdded(fileConflict.category, fileConflict.newFile);
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
        notifyCadFileAdded(fileConflict.category, fileConflict.newFile);
        if (onTempFileStaged && fileConflict.newTempFilename) {
          onTempFileStaged({ tempFilename: fileConflict.newTempFilename, category: fileConflict.category, filename: fileConflict.newFile });
        }
      }

      // Refresh files
      if (!ecoMode && mfgPartNumber) queryClient.invalidateQueries(['componentFiles', mfgPartNumber]);
    } catch (e) {
      showError('Failed to replace file: ' + (e.response?.data?.error || e.message));
    }
    setConflictPending(false);
    setFileConflict(null);
  };

  // Merge server files with locally tracked uploads (for add mode when junction table is empty)
  const serverFiles = Object.fromEntries(
    Object.entries(filesData?.files || {}).map(([category, categoryFiles]) => {
      const removedNames = new Set(stagedRemovals[category] || []);
      return [category, categoryFiles.filter(file => !removedNames.has(file.name))];
    }).filter(([, categoryFiles]) => categoryFiles.length > 0),
  );
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
          {CATEGORY_ORDER.filter(cat => files[cat]?.length > 0).map((category) => {
            // For footprint category, group .psm and .dra files by base name (case-insensitive)
            const categoryFiles = files[category];
            let displayItems;
            if (category === 'footprint') {
              const psmFiles = categoryFiles.filter(f => f.name.toLowerCase().endsWith('.psm'));
              const draFiles = categoryFiles.filter(f => f.name.toLowerCase().endsWith('.dra'));
              const otherFiles = categoryFiles.filter(f => !f.name.toLowerCase().endsWith('.psm') && !f.name.toLowerCase().endsWith('.dra'));
              const paired = [];
              const usedDra = new Set();
              for (const psm of psmFiles) {
                const psmBase = psm.name.substring(0, psm.name.lastIndexOf('.')).toLowerCase();
                const matchingDra = draFiles.find(d => {
                  const draBase = d.name.substring(0, d.name.lastIndexOf('.')).toLowerCase();
                  return draBase === psmBase && !usedDra.has(d.name);
                });
                if (matchingDra) {
                  usedDra.add(matchingDra.name);
                  paired.push({ type: 'pair', psm, dra: matchingDra });
                } else {
                  paired.push({ type: 'single', file: psm });
                }
              }
              // Add unpaired .dra files
              for (const dra of draFiles) {
                if (!usedDra.has(dra.name)) {
                  paired.push({ type: 'single', file: dra });
                }
              }
              // Add other footprint files
              for (const f of otherFiles) {
                paired.push({ type: 'single', file: f });
              }
              displayItems = paired;
            } else {
              displayItems = categoryFiles.map(f => ({ type: 'single', file: f }));
            }

            return (
            <div key={category}>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                {CATEGORY_LABELS[category] || category}
              </p>
              {displayItems.map((item) => {
                if (item.type === 'pair') {
                  // Grouped .psm + .dra pair
                  const { psm, dra } = item;
                  const isRenamingPair = isRenaming(category, psm.name);
                  return (
                    <div key={psm.name} className="mb-1">
                      {isRenamingPair ? (
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
                          <span className="text-gray-400 dark:text-gray-500 text-xs">.psm/.dra</span>
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
                        <div className="rounded text-xs bg-gray-50 dark:bg-[#333333] border border-gray-200 dark:border-[#444]">
                          {/* .psm file line */}
                          <div className="flex items-start justify-between gap-2 py-1 px-2">
                            {psm.missing ? (
                              <span className="text-gray-700 dark:text-gray-300 break-all flex-1" title={psm.name}>
                                {psm.name}
                                <span className="text-red-600 dark:text-red-400 font-semibold ml-1.5">Missing</span>
                              </span>
                            ) : mfgPartNumber ? (
                              <a
                                href={api.getFileDownloadUrl(category, mfgPartNumber, psm.name)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:underline break-all flex-1"
                                title={psm.name}
                              >
                                {psm.name}
                              </a>
                            ) : (
                              <span className="text-gray-700 dark:text-gray-300 break-all flex-1" title={psm.name}>{psm.name}</span>
                            )}
                            {!psm.missing && (
                              <span className="text-gray-400 dark:text-gray-500 shrink-0">
                                {psm.size < 1024 ? `${psm.size} B` : psm.size < 1024 * 1024 ? `${(psm.size / 1024).toFixed(1)} KB` : `${(psm.size / (1024 * 1024)).toFixed(1)} MB`}
                              </span>
                            )}
                            {canEdit && (
                              <div className="flex items-center gap-1 shrink-0">
                                {showRename && !ecoMode && mfgPartNumber && (
                                  <>
                                    <button type="button" onClick={() => requestMpnRename(category, psm.name, dra.name)} className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 text-xs px-1" title="Apply MPN as filename">MPN</button>
                                    {packageSize && (
                                      <button type="button" onClick={() => requestPkgRename(category, psm.name, dra.name)} className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 text-xs px-1" title="Apply package size as filename">PKG</button>
                                    )}
                                    <button type="button" onClick={() => startRename(category, psm.name, dra.name)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 text-xs px-1" title="Rename file pair">Rename</button>
                                  </>
                                )}
                                {showDelete && (
                                  <button type="button" onClick={() => setDeleteConfirm({ show: true, category, filename: psm.name })} className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-xs px-1" title="Delete file">x</button>
                                )}
                              </div>
                            )}
                          </div>
                          {/* .dra file line */}
                          <div className="flex items-start justify-between gap-2 py-1 px-2 border-t border-gray-200 dark:border-[#444]">
                            {dra.missing ? (
                              <span className="text-gray-700 dark:text-gray-300 break-all flex-1" title={dra.name}>
                                {dra.name}
                                <span className="text-red-600 dark:text-red-400 font-semibold ml-1.5">Missing</span>
                              </span>
                            ) : mfgPartNumber ? (
                              <a
                                href={api.getFileDownloadUrl(category, mfgPartNumber, dra.name)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 dark:text-blue-400 hover:underline break-all flex-1"
                                title={dra.name}
                              >
                                {dra.name}
                              </a>
                            ) : (
                              <span className="text-gray-700 dark:text-gray-300 break-all flex-1" title={dra.name}>{dra.name}</span>
                            )}
                            {!dra.missing && (
                              <span className="text-gray-400 dark:text-gray-500 shrink-0">
                                {dra.size < 1024 ? `${dra.size} B` : dra.size < 1024 * 1024 ? `${(dra.size / 1024).toFixed(1)} KB` : `${(dra.size / (1024 * 1024)).toFixed(1)} MB`}
                              </span>
                            )}
                            {canEdit && showDelete && (
                              <button type="button" onClick={() => setDeleteConfirm({ show: true, category, filename: dra.name })} className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-xs px-1 shrink-0" title="Delete file">x</button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                // Single file (non-paired)
                const file = item.file;
                return (
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
                          {showRename && !ecoMode && mfgPartNumber && RENAMEABLE_CATEGORIES.includes(category) && (
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
              );
              })}
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
            );
          })}
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
            Supports CAD files and ZIP archives (SamacSys, SnapEDA, Ultra Librarian), up to 250MB per file
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
      <RenameConfirmationModal
        show={mpnRenameConfirm.show}
        title="Rename to MPN"
        oldFilename={mpnRenameConfirm.oldFilename}
        newFilename={mpnRenameConfirm.newFilename}
        onConfirm={confirmMpnRename}
        onDismiss={dismissMpnRenameConfirm}
        isPending={renameMutation.isPending}
      />

      {/* PKG Rename confirmation modal */}
      <RenameConfirmationModal
        show={pkgRenameConfirm.show}
        title="Rename to Package"
        oldFilename={pkgRenameConfirm.oldFilename}
        newFilename={pkgRenameConfirm.newFilename}
        onConfirm={confirmPkgRename}
        onDismiss={dismissPkgRenameConfirm}
        isPending={renameMutation.isPending}
      />

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

          if (!ecoMode && file.id && componentId) {
            linkMutation.mutate({ cadFileId: file.id });
          }
          if (onFileUploaded && cat) {
            onFileUploaded(cat, file.file_name);
          }
          if (cat && file.file_name) {
            notifyCadFileAdded(cat, file.file_name);
          }
          // Add to localUploads so the file appears in the list immediately
          if (cat && file.file_name) {
            clearStagedRemoval(cat, file.file_name);
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
