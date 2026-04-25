import { useState, useMemo } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { groupFootprintFiles } from '../../utils/footprintFiles';

const CATEGORY_LABELS = {
  symbol: 'Schematic',
  footprint: 'Footprint',
  pad: 'Pad',
  model: '3D Model',
  pspice: 'PSpice',
};

/**
 * Modal for resolving file conflicts at save time.
 * Shows all conflicting files (grouped by footprint pairs) with per-file resolution options.
 */
const FileConflictModal = ({ conflicts, onResolve, onAbort, isProcessing }) => {
  // Map: conflict key -> 'use_existing' | 'overwrite'
  const [resolutions, setResolutions] = useState({});

  const grouped = useMemo(() => {
    const footprintConflicts = conflicts.filter(c => c.category === 'footprint');
    const otherConflicts = conflicts.filter(c => c.category !== 'footprint');

    const pairs = groupFootprintFiles(footprintConflicts, (conflict) => conflict.filename).map((group) => {
      if (group.type === 'pair') {
        return {
          type: 'pair',
          primary: group.primary,
          dra: group.dra,
          key: `pair:${group.primary.tempFilename}`,
        };
      }

      return { type: 'single', conflict: group.file, key: group.file.tempFilename };
    });

    for (const c of otherConflicts) {
      pairs.push({ type: 'single', conflict: c, key: c.tempFilename });
    }
    return pairs;
  }, [conflicts]);

  const allResolved = grouped.every(g => resolutions[g.key]);

  const handleSelect = (key, resolution) => {
    setResolutions(prev => ({ ...prev, [key]: resolution }));
  };

  const handleApplyToAll = (resolution) => {
    const bulk = {};
    for (const group of grouped) {
      bulk[group.key] = resolution;
    }
    setResolutions(bulk);
  };

  const handleApply = () => {
    const result = [];
    for (const group of grouped) {
      const resolution = resolutions[group.key];
      if (group.type === 'pair') {
        result.push({ tempFilename: group.primary.tempFilename, category: group.primary.category, filename: group.primary.filename, resolution });
        result.push({ tempFilename: group.dra.tempFilename, category: group.dra.category, filename: group.dra.filename, resolution });
      } else {
        result.push({ tempFilename: group.conflict.tempFilename, category: group.conflict.category, filename: group.conflict.filename, resolution });
      }
    }
    onResolve(result);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-2xl max-w-lg w-full p-6 border border-gray-200 dark:border-[#3a3a3a] animate-fadeIn max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-end mb-2 shrink-0">
          <button
            type="button"
            onClick={onAbort}
            disabled={isProcessing}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-50"
            aria-label="Close file conflict dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Header */}
        <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-yellow-100 dark:bg-yellow-900/20 shrink-0">
          <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 text-center mb-1 shrink-0">
          File Conflicts Detected
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-4 shrink-0">
          {conflicts.length} file{conflicts.length !== 1 ? 's' : ''} already exist in the library. Choose how to handle each conflict:
        </p>

        {/* Apply to All */}
        <div className="flex items-center gap-2 mb-3 shrink-0">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">Apply to All:</span>
          <button
            onClick={() => handleApplyToAll('use_existing')}
            className="flex-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-[#444] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333] transition-colors"
          >
            Use existing library file
          </button>
          <button
            onClick={() => handleApplyToAll('overwrite')}
            className="flex-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-[#444] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333] transition-colors"
          >
            Overwrite with new upload
          </button>
        </div>

        {/* Conflict list */}
        <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1 mb-4">
          {grouped.map((group) => {
            const selected = resolutions[group.key];
            const categoryLabel = group.type === 'pair'
              ? CATEGORY_LABELS[group.primary.category] || group.primary.category
              : CATEGORY_LABELS[group.conflict.category] || group.conflict.category;

            return (
              <div key={group.key} className="border border-gray-200 dark:border-[#3a3a3a] rounded-lg p-3">
                {/* File name(s) and category */}
                <div className="mb-2">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {categoryLabel}
                  </span>
                  {group.type === 'pair' ? (
                    <div className="mt-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 break-all">{group.primary.filename}</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 break-all">{group.dra.filename}</p>
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 break-all mt-1">{group.conflict.filename}</p>
                  )}
                </div>

                {/* Radio options */}
                <div className="space-y-1.5">
                  <label className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                    selected === 'use_existing'
                      ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-300 dark:border-primary-700'
                      : 'hover:bg-gray-50 dark:hover:bg-[#333] border border-transparent'
                  }`}>
                    <input
                      type="radio"
                      name={group.key}
                      checked={selected === 'use_existing'}
                      onChange={() => handleSelect(group.key, 'use_existing')}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Use existing library file</span>
                  </label>
                  <label className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                    selected === 'overwrite'
                      ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-300 dark:border-primary-700'
                      : 'hover:bg-gray-50 dark:hover:bg-[#333] border border-transparent'
                  }`}>
                    <input
                      type="radio"
                      name={group.key}
                      checked={selected === 'overwrite'}
                      onChange={() => handleSelect(group.key, 'overwrite')}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Overwrite with new upload</span>
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        {/* Buttons */}
        <div className="flex gap-3 shrink-0">
          <button
            onClick={onAbort}
            disabled={isProcessing}
            className="flex-1 px-4 py-2.5 bg-gray-200 dark:bg-[#333333] text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-[#3a3a3a] transition-colors font-medium disabled:opacity-50"
          >
            Abort
          </button>
          <button
            onClick={handleApply}
            disabled={!allResolved || isProcessing}
            className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50"
          >
            {isProcessing ? 'Saving...' : 'Apply & Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FileConflictModal;
