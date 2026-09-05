import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, FileText, Link } from 'lucide-react';
import { api } from '../../utils/api';
import { PSPICE_LABEL, SCHEMATIC_SYMBOL_LABEL, THREE_D_MODEL_LABEL } from '../../utils/cadFileTypes';
import { getCadFileBaseName, groupFootprintFiles } from '../../utils/footprintFiles';
import { formatCadFileDisplayName } from '../../utils/cadFileNaming';

const FILE_TYPE_LABELS = {
  symbol: SCHEMATIC_SYMBOL_LABEL,
  footprint: 'Footprint',
  pad: 'Pad',
  model: THREE_D_MODEL_LABEL,
  pspice: PSPICE_LABEL,
};

const ROUTE_TYPE_MAP = {
  symbol: 'schematic',
  footprint: 'footprint',
  pad: 'pad',
  model: 'step',
  pspice: 'pspice',
};

const RELATED_FILE_TYPES = ['pad', 'model'];

const sortFilesByName = (files) => files.slice().sort((left, right) => (
  left.file_name.localeCompare(right.file_name, undefined, { sensitivity: 'base' })
));

const collectRelatedFiles = (files) => {
  const uniqueFiles = new Map();

  files.forEach((file) => {
    const relatedFiles = Array.isArray(file?.related_files) ? file.related_files : [];
    relatedFiles.forEach((relatedFile) => {
      const key = relatedFile.id || `${relatedFile.file_type}:${relatedFile.file_name}`;
      if (!uniqueFiles.has(key)) {
        uniqueFiles.set(key, relatedFile);
      }
    });
  });

  return [...uniqueFiles.values()];
};

const buildSelectionPayload = (entry, selectedRelatedFiles = []) => (
  entry.kind === 'pair'
    ? {
        kind: 'pair',
        files: entry.files,
        file_type: 'footprint',
        displayName: entry.displayName,
        autoFiles: entry.relatedFiles,
        selectedRelatedFiles,
      }
    : { ...entry.files[0], autoFiles: entry.relatedFiles, selectedRelatedFiles }
);

const buildFootprintRelatedSelection = (entry) => {
  const relatedCandidatesByType = new Map(
    RELATED_FILE_TYPES.map((fileType) => [fileType, new Map()]),
  );

  entry.relatedFiles.forEach((file) => {
    if (!file?.id || file.missing || !RELATED_FILE_TYPES.includes(file.file_type)) {
      return;
    }

    relatedCandidatesByType.get(file.file_type)?.set(file.id, file);
  });

  const autoFiles = [];
  const ambiguousTypes = [];

  RELATED_FILE_TYPES.forEach((fileType) => {
    const files = sortFilesByName([...(relatedCandidatesByType.get(fileType)?.values() || [])]);
    if (files.length === 1) {
      autoFiles.push(files[0]);
      return;
    }

    if (files.length > 1) {
      ambiguousTypes.push({ fileType, files, selectedFileId: '' });
    }
  });

  return {
    entry,
    autoFiles,
    ambiguousTypes,
  };
};

/**
 * Reusable modal for selecting an existing CAD file from the library.
 * Supports search and type filtering.
 *
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - onSelect: (cadFile) => void - called when user selects a file
 * - fileType: string (optional) - filter to show only files of this type (footprint, symbol, model, pspice, pad)
 * - excludeFileIds: string[] (optional) - file IDs to exclude from the list
 */
export default function CadFilePickerModal({ isOpen, onClose, onSelect, fileType, excludeFileIds = [] }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingFootprintSelection, setPendingFootprintSelection] = useState(null);

  const routeType = fileType ? ROUTE_TYPE_MAP[fileType] : null;

  const { data: filesData, isLoading } = useQuery({
    queryKey: ['available-cad-files', routeType, searchQuery],
    queryFn: async () => {
      const res = await api.getAvailableFiles(routeType, searchQuery || undefined);
      return res.data.files;
    },
    enabled: isOpen,
    staleTime: 10000,
  });

  const excludeSet = useMemo(() => new Set(excludeFileIds), [excludeFileIds]);

  const filteredFiles = useMemo(() => {
    if (!filesData) return [];
    return filesData.filter(f => !excludeSet.has(f.id));
  }, [filesData, excludeSet]);

  const selectionEntries = useMemo(() => {
    if (!filteredFiles.length) {
      return [];
    }

    if (fileType !== 'footprint') {
      return filteredFiles.map((file) => ({
        key: file.id || file.file_name,
        kind: 'single',
        displayName: file.file_name,
        files: [file],
        relatedFiles: collectRelatedFiles([file]),
        componentCount: Number(file.component_count || 0),
      }));
    }

    return groupFootprintFiles(filteredFiles, (file) => file.file_name).map((group) => {
      if (group.type !== 'pair') {
        return {
          key: group.file.id || group.file.file_name,
          kind: 'single',
          displayName: group.file.file_name,
          files: [group.file],
          relatedFiles: collectRelatedFiles([group.file]),
          componentCount: Number(group.file.component_count || 0),
        };
      }

      return {
        key: `pair:${group.primary.id || group.primary.file_name}`,
        kind: 'pair',
        displayName: getCadFileBaseName(group.primary.file_name),
        files: group.files.slice().sort((left, right) => left.file_name.localeCompare(right.file_name, undefined, { sensitivity: 'base' })),
        relatedFiles: collectRelatedFiles(group.files),
        componentCount: Math.max(...group.files.map((file) => Number(file.component_count || 0))),
        pairLabel: group.pairLabel,
      };
    });
  }, [filteredFiles, fileType]);

  const handleClose = () => {
    setPendingFootprintSelection(null);
    onClose();
  };

  const handleEntrySelect = (entry) => {
    if (fileType !== 'footprint') {
      onSelect(buildSelectionPayload(entry));
      handleClose();
      return;
    }

    const nextPendingSelection = buildFootprintRelatedSelection(entry);
    if (nextPendingSelection.ambiguousTypes.length === 0) {
      onSelect(buildSelectionPayload(entry));
      handleClose();
      return;
    }

    setPendingFootprintSelection(nextPendingSelection);
  };

  const handlePendingSelectionChange = (relatedFileType, selectedFileId) => {
    setPendingFootprintSelection((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        ambiguousTypes: current.ambiguousTypes.map((group) => (
          group.fileType === relatedFileType
            ? { ...group, selectedFileId }
            : group
        )),
      };
    });
  };

  const handleConfirmFootprintSelection = () => {
    if (!pendingFootprintSelection) {
      return;
    }

    const selectedRelatedFiles = pendingFootprintSelection.ambiguousTypes
      .map((group) => group.files.find((file) => file.id === group.selectedFileId))
      .filter(Boolean);

    onSelect(buildSelectionPayload(pendingFootprintSelection.entry, selectedRelatedFiles));
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <div data-testid="cad-file-picker-backdrop" className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-xl w-full max-w-lg max-h-[70vh] flex flex-col border border-gray-200 dark:border-[#3a3a3a]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-[#3a3a3a]">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {pendingFootprintSelection ? 'Choose Related Files' : `Add Existing File ${fileType ? `(${FILE_TYPE_LABELS[fileType] || fileType})` : ''}`}
          </h3>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        {!pendingFootprintSelection && (
        <div className="px-4 py-2 border-b border-gray-200 dark:border-[#3a3a3a]">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 dark:border-[#444444] rounded bg-white dark:bg-[#333333] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
              autoFocus
            />
          </div>
        </div>
        )}

        {/* File List */}
        <div className="flex-1 overflow-y-auto px-2 py-1">
          {pendingFootprintSelection ? (
            <div className="space-y-4 px-2 py-3">
              <div className="rounded-md bg-gray-50 px-3 py-3 dark:bg-[#333333]">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Footprint</p>
                <div className="mt-2 space-y-1">
                  {pendingFootprintSelection.entry.files.map((file) => (
                    <div key={file.id || file.file_name} className="text-sm text-gray-900 dark:text-gray-100 break-all">
                      {formatCadFileDisplayName(file.file_name, file.file_type)}
                    </div>
                  ))}
                </div>
              </div>

              {pendingFootprintSelection.autoFiles.length > 0 && (
                <div className="rounded-md border border-green-200 bg-green-50 px-3 py-3 dark:border-green-900/60 dark:bg-green-950/20">
                  <p className="text-xs font-medium uppercase tracking-wide text-green-700 dark:text-green-300">Auto-linked if available</p>
                  <div className="mt-2 space-y-1">
                    {pendingFootprintSelection.autoFiles.map((file) => (
                      <div key={file.id} className="text-sm text-green-800 dark:text-green-200 break-all">
                        {formatCadFileDisplayName(file.file_name, file.file_type)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {pendingFootprintSelection.ambiguousTypes.map((group) => (
                <fieldset key={group.fileType} className="rounded-md border border-gray-200 px-3 py-3 dark:border-[#3a3a3a]">
                  <legend className="px-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {`Choose ${FILE_TYPE_LABELS[group.fileType] || group.fileType}`}
                  </legend>
                  <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                    More than one matching {FILE_TYPE_LABELS[group.fileType]?.toLowerCase() || group.fileType} was learned for this footprint.
                  </p>
                  <div className="space-y-2">
                    <label className="flex items-start gap-2 rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-[#333333]">
                      <input
                        type="radio"
                        name={`related-${group.fileType}`}
                        value=""
                        checked={group.selectedFileId === ''}
                        onChange={() => handlePendingSelectionChange(group.fileType, '')}
                        className="mt-0.5"
                      />
                      <span>Skip for now</span>
                    </label>
                    {group.files.map((file) => (
                      <label key={file.id} className="flex items-start gap-2 rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-[#333333]">
                        <input
                          type="radio"
                          name={`related-${group.fileType}`}
                          value={file.id}
                          checked={group.selectedFileId === file.id}
                          onChange={() => handlePendingSelectionChange(group.fileType, file.id)}
                          className="mt-0.5"
                        />
                        <span className="break-all">{formatCadFileDisplayName(file.file_name, file.file_type)}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
          ) : isLoading ? (
            <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">Loading files...</div>
          ) : selectionEntries.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
              {searchQuery ? 'No files match your search' : 'No files available'}
            </div>
          ) : (
            selectionEntries.map((entry) => (
              <button
                key={entry.key}
                onClick={() => handleEntrySelect(entry)}
                className="w-full flex items-start gap-2 px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-[#333333] text-left transition-colors"
              >
                <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  {/* Display form only - the onSelect payload above keeps the stored name. */}
                  <div className="text-sm text-gray-900 dark:text-gray-100 break-all">
                    {formatCadFileDisplayName(entry.displayName, entry.files[0]?.file_type || fileType)}
                  </div>
                  {entry.kind === 'pair' && (
                    <div className="mt-0.5 space-y-0.5">
                      {entry.files.map((file) => (
                        <div key={file.id || file.file_name} className="text-xs text-gray-500 dark:text-gray-400 break-all">
                          {formatCadFileDisplayName(file.file_name, file.file_type)}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    {!fileType && entry.files[0]?.file_type && (
                      <span>{FILE_TYPE_LABELS[entry.files[0].file_type] || entry.files[0].file_type}</span>
                    )}
                    {entry.kind === 'pair' && <span>{entry.pairLabel}</span>}
                    <span className="flex items-center gap-0.5">
                      <Link className="w-3 h-3" />
                      {entry.componentCount} parts
                    </span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        {pendingFootprintSelection ? (
          <div className="flex items-center justify-between gap-3 border-t border-gray-200 px-4 py-3 dark:border-[#3a3a3a]">
            <button
              type="button"
              onClick={() => setPendingFootprintSelection(null)}
              className="rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-200 dark:bg-[#333333] dark:text-gray-300 dark:hover:bg-[#404040]"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleConfirmFootprintSelection}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm text-white transition-colors hover:bg-primary-700"
            >
              Add Files
            </button>
          </div>
        ) : (
          <div className="px-4 py-2 border-t border-gray-200 dark:border-[#3a3a3a] text-xs text-gray-500 dark:text-gray-400">
            {selectionEntries.length} selection{selectionEntries.length !== 1 ? 's' : ''} available
          </div>
        )}
      </div>
    </div>
  );
}
