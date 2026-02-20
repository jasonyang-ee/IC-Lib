import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, FileText, Link } from 'lucide-react';
import api from '../../utils/api';

const FILE_TYPE_LABELS = {
  footprint: 'Footprint',
  symbol: 'Symbol',
  model: '3D Model',
  pspice: 'PSpice',
  pad: 'Pad',
};

const ROUTE_TYPE_MAP = {
  footprint: 'footprint',
  symbol: 'schematic',
  model: 'step',
  pspice: 'pspice',
  pad: 'pad',
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
      if (searchQuery.length > 0) {
        const res = await api.getAvailableFiles(routeType, searchQuery);
        return res.data.files;
      }
      if (routeType) {
        const res = await api.getFilesByType(routeType);
        return res.data.files;
      }
      const res = await api.getAvailableFiles();
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
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
          ) : filteredFiles.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
              {searchQuery ? 'No files match your search' : 'No files available'}
            </div>
          ) : (
            filteredFiles.map((file) => (
              <button
                key={file.id || file.file_name}
                onClick={() => {
                  onSelect(file);
                  onClose();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-[#333333] text-left transition-colors"
              >
                <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-900 dark:text-gray-100 truncate">{file.file_name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    {!fileType && file.file_type && (
                      <span>{FILE_TYPE_LABELS[file.file_type] || file.file_type}</span>
                    )}
                    <span className="flex items-center gap-0.5">
                      <Link className="w-3 h-3" />
                      {file.component_count || 0} parts
                    </span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-200 dark:border-[#3a3a3a] text-xs text-gray-500 dark:text-gray-400">
          {filteredFiles.length} file{filteredFiles.length !== 1 ? 's' : ''} available
        </div>
      </div>
    </div>
  );
}
