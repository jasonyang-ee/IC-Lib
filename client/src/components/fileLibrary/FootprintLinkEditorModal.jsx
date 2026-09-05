import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { api } from '../../utils/api';
import { MODEL_FILE_EXTENSIONS, THREE_D_MODEL_LABEL } from '../../utils/cadFileTypes';
import { useNotification } from '../../contexts/NotificationContext';

const ROUTE_TYPE_BY_RELATED_FILE_TYPE = {
  pad: 'pad',
  model: 'step',
};

const LABEL_BY_RELATED_FILE_TYPE = {
  pad: 'Pad',
  model: THREE_D_MODEL_LABEL,
};

const ACCEPT_BY_RELATED_FILE_TYPE = {
  pad: '.pad',
  model: MODEL_FILE_EXTENSIONS.join(','),
};

const sortFilesByName = (files) => files.slice().sort((left, right) => (
  left.file_name.localeCompare(right.file_name, undefined, { sensitivity: 'base' })
));

const getComponentCount = (file) => Number(file?.component_count || 0);

export default function FootprintLinkEditorModal({
  isOpen,
  onClose,
  onSave,
  selectedEntry,
  relatedFileType,
  initialFiles = [],
  isSaving = false,
}) {
  const { showError, showSuccess } = useNotification();
  const fileInputRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFileIds, setSelectedFileIds] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setSearchQuery('');
    setSelectedFileIds((Array.isArray(initialFiles) ? initialFiles : []).map((file) => file.id).filter(Boolean));
    setUploadedFiles([]);
  }, [initialFiles, isOpen, relatedFileType]);

  const routeType = ROUTE_TYPE_BY_RELATED_FILE_TYPE[relatedFileType] || null;
  const relatedFileLabel = LABEL_BY_RELATED_FILE_TYPE[relatedFileType] || 'File';

  const { data: files = [], isLoading, refetch } = useQuery({
    queryKey: ['available-cad-files', routeType, searchQuery],
    queryFn: async () => {
      const response = await api.getAvailableFiles(routeType, searchQuery || undefined);
      return Array.isArray(response.data?.files) ? response.data.files : [];
    },
    enabled: isOpen && Boolean(routeType),
    staleTime: 10000,
  });

  const initialIdSet = useMemo(() => new Set(
    (Array.isArray(initialFiles) ? initialFiles : []).map((file) => file.id).filter(Boolean),
  ), [initialFiles]);
  const selectedIdSet = useMemo(() => new Set(selectedFileIds), [selectedFileIds]);

  const fileById = useMemo(() => {
    const allFiles = [...(Array.isArray(initialFiles) ? initialFiles : []), ...files, ...uploadedFiles];
    const nextMap = new Map();

    allFiles.forEach((file) => {
      if (file?.id) {
        nextMap.set(file.id, file);
      }
    });

    return nextMap;
  }, [files, initialFiles, uploadedFiles]);

  const linkedFiles = useMemo(() => sortFilesByName(
    selectedFileIds.map((fileId) => fileById.get(fileId)).filter(Boolean),
  ), [fileById, selectedFileIds]);

  const availableFiles = useMemo(() => sortFilesByName(
    files.filter((file) => file?.id && !selectedIdSet.has(file.id)),
  ), [files, selectedIdSet]);

  const hasChanges = useMemo(() => {
    if (selectedFileIds.length !== initialIdSet.size) {
      return true;
    }

    return selectedFileIds.some((fileId) => !initialIdSet.has(fileId));
  }, [initialIdSet, selectedFileIds]);

  const isBusy = isSaving || isUploading;

  if (!isOpen) {
    return null;
  }

  const handleAddFile = (fileId) => {
    setSelectedFileIds((current) => (current.includes(fileId) ? current : [...current, fileId]));
  };

  const handleRemoveFile = (fileId) => {
    setSelectedFileIds((current) => current.filter((currentFileId) => currentFileId !== fileId));
  };

  const handleUploadFiles = async (event) => {
    const inputFiles = Array.from(event.target.files || []);
    event.target.value = '';

    if (inputFiles.length === 0 || !routeType) {
      return;
    }

    const formData = new FormData();
    inputFiles.forEach((file) => formData.append('files', file));

    setIsUploading(true);
    try {
      const uploadResponse = await api.uploadTempFiles(formData);
      const stagedFiles = (uploadResponse.data?.results || []).filter((result) => (
        result?.tempFilename && result.type === relatedFileType
      ));

      if (stagedFiles.length === 0) {
        const firstError = (uploadResponse.data?.results || []).find((result) => result?.error)?.error;
        throw new Error(firstError || `No ${relatedFileLabel.toLowerCase()} files were staged`);
      }

      const finalizeResponse = await api.finalizeTempFiles({
        files: stagedFiles.map((file) => ({
          tempFilename: file.tempFilename,
          category: relatedFileType,
        })),
      });

      const finalizedFiles = (finalizeResponse.data?.results || [])
        .filter((result) => result?.type === relatedFileType && result?.cadFileId && !result?.error)
        .map((result) => ({
          id: result.cadFileId,
          file_name: result.filename,
          file_type: relatedFileType,
          component_count: 0,
          missing: false,
        }));

      if (finalizedFiles.length === 0) {
        const firstError = (finalizeResponse.data?.results || []).find((result) => result?.error)?.error;
        throw new Error(firstError || `No ${relatedFileLabel.toLowerCase()} files were finalized`);
      }

      setUploadedFiles((current) => {
        const nextFiles = [...current];
        finalizedFiles.forEach((file) => {
          if (!nextFiles.some((existingFile) => existingFile.id === file.id)) {
            nextFiles.push(file);
          }
        });
        return nextFiles;
      });
      setSelectedFileIds((current) => [...new Set([...current, ...finalizedFiles.map((file) => file.id)])]);

      await refetch();

      showSuccess(`Added ${finalizedFiles.length} ${relatedFileLabel.toLowerCase()} file${finalizedFiles.length !== 1 ? 's' : ''}`);
    } catch (error) {
      showError(`Failed to upload ${relatedFileLabel.toLowerCase()} file${inputFiles.length !== 1 ? 's' : ''}: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = () => {
    const addFileIds = selectedFileIds.filter((fileId) => !initialIdSet.has(fileId));
    const removeFileIds = [...initialIdSet].filter((fileId) => !selectedIdSet.has(fileId));
    onSave({ relatedFileType, addFileIds, removeFileIds });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => {
        if (!isBusy) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-4xl rounded-lg border border-gray-200 bg-white shadow-xl dark:border-[#3a3a3a] dark:bg-[#2a2a2a]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 dark:border-[#3a3a3a]">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {`Edit ${relatedFileLabel} Link`}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {selectedEntry?.displayName || 'Selected footprint'}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isBusy}
            className="text-gray-400 transition-colors hover:text-gray-600 disabled:opacity-50 dark:hover:text-gray-200"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 px-5 py-4 md:grid-cols-2">
          <div className="rounded-lg border border-gray-200 dark:border-[#3a3a3a]">
            <div className="border-b border-gray-200 px-4 py-3 dark:border-[#3a3a3a]">
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">Currently Linked</h4>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {linkedFiles.length} linked {relatedFileLabel.toLowerCase()}{linkedFiles.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="max-h-80 space-y-2 overflow-y-auto p-3">
              {linkedFiles.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No linked files yet.</p>
              ) : linkedFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between gap-3 rounded-md bg-gray-50 px-3 py-2 dark:bg-[#333333]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-gray-900 dark:text-gray-100">{file.file_name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {getComponentCount(file)} part{getComponentCount(file) !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemoveFile(file.id)}
                    disabled={isSaving}
                    className="rounded-md px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/20"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-[#3a3a3a]">
            <div className="border-b border-gray-200 px-4 py-3 dark:border-[#3a3a3a]">
              <div className="flex items-start gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={`Search ${relatedFileLabel.toLowerCase()} files...`}
                    className="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-[#444444] dark:bg-[#333333] dark:text-gray-100"
                    autoFocus
                  />
                </div>
                <div className="shrink-0">
                  <input
                    ref={fileInputRef}
                    data-testid="footprint-link-upload-input"
                    type="file"
                    multiple
                    accept={ACCEPT_BY_RELATED_FILE_TYPE[relatedFileType] || undefined}
                    onChange={handleUploadFiles}
                    disabled={isBusy}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isBusy}
                    className="rounded-md bg-primary-600 px-3 py-2 text-sm text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
                  >
                    {isUploading ? 'Uploading...' : `Upload New ${relatedFileLabel}`}
                  </button>
                </div>
              </div>
            </div>
            <div className="max-h-80 space-y-2 overflow-y-auto p-3">
              {isLoading ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading files...</p>
              ) : availableFiles.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {searchQuery ? 'No files match this search.' : `No more ${relatedFileLabel.toLowerCase()} files available.`}
                </p>
              ) : availableFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2 dark:border-[#3a3a3a]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-gray-900 dark:text-gray-100">{file.file_name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {getComponentCount(file)} part{getComponentCount(file) !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => handleAddFile(file.id)}
                    disabled={isSaving}
                    className="rounded-md px-2 py-1 text-xs font-medium text-primary-600 transition-colors hover:bg-primary-50 disabled:opacity-50 dark:hover:bg-primary-950/20"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-gray-200 px-5 py-4 dark:border-[#3a3a3a]">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Save to update the selected footprint's {relatedFileLabel.toLowerCase()} links.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isBusy}
              className="rounded-md bg-gray-100 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-[#333333] dark:text-gray-300 dark:hover:bg-[#404040]"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || isBusy}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Links'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}