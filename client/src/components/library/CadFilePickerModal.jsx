import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, FileText, Link } from 'lucide-react';
import { api } from '../../utils/api';
import { PSPICE_LABEL, SCHEMATIC_SYMBOL_LABEL, THREE_D_MODEL_LABEL } from '../../utils/cadFileTypes';
import { getCadFileBaseName, groupFootprintFiles } from '../../utils/footprintFiles';

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
            Add Existing File {fileType ? `(${FILE_TYPE_LABELS[fileType] || fileType})` : ''}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
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

        {/* File List */}
        <div className="flex-1 overflow-y-auto px-2 py-1">
          {isLoading ? (
            <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">Loading files...</div>
          ) : selectionEntries.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
              {searchQuery ? 'No files match your search' : 'No files available'}
            </div>
          ) : (
            selectionEntries.map((entry) => (
              <button
                key={entry.key}
                onClick={() => {
                  onSelect(entry.kind === 'pair'
                    ? {
                        kind: 'pair',
                        files: entry.files,
                        file_type: 'footprint',
                        displayName: entry.displayName,
                        autoFiles: entry.relatedFiles,
                      }
                    : { ...entry.files[0], autoFiles: entry.relatedFiles });
                  onClose();
                }}
                className="w-full flex items-start gap-2 px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-[#333333] text-left transition-colors"
              >
                <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-900 dark:text-gray-100 break-all">{entry.displayName}</div>
                  {entry.kind === 'pair' && (
                    <div className="mt-0.5 space-y-0.5">
                      {entry.files.map((file) => (
                        <div key={file.id || file.file_name} className="text-xs text-gray-500 dark:text-gray-400 break-all">{file.file_name}</div>
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
        <div className="px-4 py-2 border-t border-gray-200 dark:border-[#3a3a3a] text-xs text-gray-500 dark:text-gray-400">
          {selectionEntries.length} selection{selectionEntries.length !== 1 ? 's' : ''} available
        </div>
      </div>
    </div>
  );
}
