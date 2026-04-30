import { useRef } from 'react';
import {
  Check,
  ChevronRight,
  Copy,
  Download,
  FileBox,
  FileText,
  Link2,
  Trash2,
} from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { getCadFileBaseName, groupFootprintFiles } from '../../utils/footprintFiles';
import StatusBadge from './StatusBadge';
import { FilterSelect, SidebarCard } from '../common';
import { getCadFileTypeLabel } from './constants';

const buildRelatedFileEntries = (fileType, relatedFiles) => {
  if (!Array.isArray(relatedFiles) || relatedFiles.length === 0) {
    return [];
  }

  if (fileType === 'footprint') {
    return groupFootprintFiles(relatedFiles, (file) => file.file_name).map((group) => {
      if (group.type !== 'pair') {
        return {
          key: group.file.id || group.file.file_name,
          label: group.file.file_name,
          tooltip: group.file.file_name,
          files: [group.file],
        };
      }

      return {
        key: `pair:${group.primary.id || group.primary.file_name}`,
        label: getCadFileBaseName(group.primary.file_name),
        tooltip: group.files.map((file) => file.file_name).join('\n'),
        files: group.files,
      };
    });
  }

  return relatedFiles.map((file) => ({
    key: file.id || file.file_name,
    label: file.file_name,
    tooltip: file.file_name,
    files: [file],
  }));
};

const buildRelatedSections = (selectedType, relatedFileGroups) => {
  const groups = relatedFileGroups || {};

  if (selectedType === 'footprint') {
    return [
      {
        key: 'pad',
        label: 'Linked Pad Files',
        emptyLabel: 'No linked pad files',
        entries: buildRelatedFileEntries('pad', groups.pad || []),
      },
      {
        key: 'model',
        label: 'Linked 3D Model Files',
        emptyLabel: 'No linked 3D model files',
        entries: buildRelatedFileEntries('model', groups.model || []),
      },
    ];
  }

  if (selectedType === 'pad' || selectedType === 'step') {
    return [{
      key: 'footprint',
      label: 'Linked Footprints',
      emptyLabel: 'No linked footprints',
      entries: buildRelatedFileEntries('footprint', groups.footprint || []),
    }];
  }

  return [];
};

const FileTypesView = ({
  fileTypes,
  selectedType,
  selectedEntry,
  showOrphans,
  displayedEntries,
  isLoadingFiles,
  componentsData,
  isLoadingComponents,
  linkedPartsFilter,
  onLinkedPartsFilterChange,
  bulkSelectMode,
  selectedOrphanEntryKeys,
  allDisplayedOrphansSelected,
  onToggleBulkSelectMode,
  onToggleOrphanEntrySelection,
  onToggleSelectAllDisplayedOrphans,
  onOpenBulkDelete,
  isBulkDeletePending,
  getTypeCount,
  onTypeChange,
  onSelectFile,
  onOpenRename,
  onOpenDelete,
  onCopyPath,
  canWrite,
  canDeleteFiles,
  navigate,
  cisFiles,
  selectedCISFile,
  onCISFileChange,
  relatedFileGroups,
  canManageFootprintRelatedLinks,
  onOpenFootprintLinkEditor,
  isManagingFootprintRelatedLinks,
}) => {
  const fileListRef = useRef(null);
  const isOrphanSelectionEnabled = showOrphans && bulkSelectMode;
  const relatedSections = buildRelatedSections(selectedType, relatedFileGroups);

  const fileVirtualizer = useVirtualizer({
    count: displayedEntries.length,
    getScrollElement: () => fileListRef.current,
    estimateSize: () => 48,
    overscan: 15,
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 flex-1 overflow-hidden">
      <div className="lg:col-span-1 flex flex-col gap-4 overflow-hidden">
        <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">File Types</h2>
          <div className="space-y-1.5">
            {fileTypes.map((type) => {
              const Icon = type.icon;
              const isSelected = selectedType === type.id;

              return (
                <button
                  key={type.id}
                  onClick={() => onTypeChange(type.id)}
                  className={`w-full p-2.5 rounded-lg border text-left transition-colors ${
                    isSelected
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-200 dark:border-[#3a3a3a] hover:border-primary-300 dark:hover:border-primary-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-lg ${type.bgColor}`}>
                      <Icon className={`w-4 h-4 ${type.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-gray-100 truncate text-sm">{type.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{getTypeCount(type.id)} files</p>
                    </div>
                    {isSelected && <ChevronRight className="w-3.5 h-3.5 text-primary-500 shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <FilterSelect
          label="Filter Files"
          value={linkedPartsFilter}
          onChange={onLinkedPartsFilterChange}
          options={[
            { value: 'all', label: 'All Files' },
            { value: 'orphans', label: 'No Linked Parts' },
          ]}
        />

        <SidebarCard title="Actions">
          <div className="space-y-3">
            <button
              onClick={onToggleBulkSelectMode}
              disabled={!showOrphans || displayedEntries.length === 0 || !canDeleteFiles()}
              className={`w-full px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isOrphanSelectionEnabled
                  ? 'bg-primary-600 hover:bg-primary-700 text-white'
                  : 'bg-gray-100 dark:bg-[#333333] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              {isOrphanSelectionEnabled ? 'Exit Multi-Select' : 'Enable Multi-Select'}
            </button>

            {showOrphans ? (
              <>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Multi-select is only available for files with no linked parts.
                </p>
                {isOrphanSelectionEnabled && (
                  <>
                    <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                      <span>{selectedOrphanEntryKeys.length} selected</span>
                      <button
                        onClick={onToggleSelectAllDisplayedOrphans}
                        className="text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        {allDisplayedOrphansSelected ? 'Clear Visible' : 'Select Visible'}
                      </button>
                    </div>
                    <button
                      onClick={onOpenBulkDelete}
                      disabled={selectedOrphanEntryKeys.length === 0 || isBulkDeletePending}
                      className="w-full px-3 py-2 rounded-md text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isBulkDeletePending ? 'Deleting...' : 'Delete Selected'}
                    </button>
                  </>
                )}
              </>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Switch the filter to `No Linked Parts` to enable bulk delete.
              </p>
            )}
          </div>
        </SidebarCard>

        <div className="flex-1" />

        <SidebarCard title="Download CIS File">
          <div className="flex gap-2">
            <select
              value={selectedCISFile}
              onChange={(e) => onCISFileChange(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
            >
              <option value="">Select file...</option>
              {cisFiles?.map((file) => (
                <option key={file.name} value={file.name}>
                  {file.name}
                </option>
              ))}
            </select>
            <a
              href={selectedCISFile
                ? `${import.meta.env.VITE_API_URL || '/api'}/settings/cis-files/${encodeURIComponent(selectedCISFile)}`
                : undefined}
              download
              className={`flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedCISFile
                  ? 'bg-primary-600 hover:bg-primary-700 text-white'
                  : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 pointer-events-none'
              }`}
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
        </SidebarCard>
      </div>

      <div className="lg:col-span-2 bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] p-4 flex flex-col overflow-hidden">
        <div className="flex justify-between items-center mb-3 shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {showOrphans ? 'Orphan Files' : `${fileTypes.find((type) => type.id === selectedType)?.label} Files`}
            <span className="text-sm font-normal text-gray-500 ml-2">({displayedEntries.length})</span>
          </h2>
        </div>

        {isLoadingFiles ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : displayedEntries.length > 0 ? (
          <div ref={fileListRef} className="overflow-y-auto custom-scrollbar flex-1">
            <div style={{ height: `${fileVirtualizer.getTotalSize()}px`, position: 'relative' }}>
              {fileVirtualizer.getVirtualItems().map((virtualRow) => {
                const entry = displayedEntries[virtualRow.index];
                const count = entry.componentCount ?? 0;
                const isSelected = selectedEntry?.key === entry.key;
                const isChecked = selectedOrphanEntryKeys.includes(entry.key);

                return (
                  <button
                    key={`${entry.key}-${virtualRow.index}`}
                    data-index={virtualRow.index}
                    ref={fileVirtualizer.measureElement}
                    onClick={() => {
                      if (isOrphanSelectionEnabled) {
                        onToggleOrphanEntrySelection(entry.key);
                        return;
                      }

                      onSelectFile(entry.key);
                    }}
                    className={`absolute left-0 w-full p-2.5 rounded-lg border text-left transition-colors ${
                      isOrphanSelectionEnabled
                        ? (isChecked
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-gray-200 dark:border-[#3a3a3a] hover:border-primary-300 dark:hover:border-primary-700 hover:bg-gray-50 dark:hover:bg-[#333]')
                        : isSelected
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-gray-200 dark:border-[#3a3a3a] hover:border-primary-300 dark:hover:border-primary-700 hover:bg-gray-50 dark:hover:bg-[#333]'
                    }`}
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {isOrphanSelectionEnabled && (
                          <div
                            aria-hidden="true"
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                              isChecked
                                ? 'border-primary-600 bg-primary-600 text-white'
                                : 'border-gray-300 dark:border-[#555555] bg-white dark:bg-[#1f1f1f]'
                            }`}
                          >
                            {isChecked && <Check className="h-3 w-3" />}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-gray-100 truncate text-sm" title={entry.displayName}>
                            {entry.displayName}
                          </p>
                          {entry.kind === 'pair' ? (
                            <div className="mt-0.5 space-y-0.5">
                              {entry.files.map((file) => (
                                <p key={file.file_name} className="text-xs text-gray-500 dark:text-gray-400 truncate" title={file.file_name}>
                                  {file.file_name}
                                </p>
                              ))}
                            </div>
                          ) : (
                            showOrphans && entry.file_type && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{getCadFileTypeLabel(entry.file_type, entry.displayName)}</p>
                            )
                          )}
                        </div>
                      </div>
                      {!showOrphans && (
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              onCopyPath(entry.fileNames);
                            }}
                            className="text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 p-0.5"
                            title={entry.kind === 'pair' ? 'Copy file paths' : 'Copy file path'}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            isSelected
                              ? 'bg-primary-500 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                          }`}>
                            {count} part{count !== 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                      {showOrphans && canDeleteFiles() && !isOrphanSelectionEnabled && (
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenDelete(entry);
                          }}
                          className="text-red-500 hover:text-red-700 dark:hover:text-red-300 p-1 shrink-0 ml-2"
                          title="Delete orphan file"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>{showOrphans ? 'No orphan files found' : 'No files found'}</p>
            </div>
          </div>
        )}
      </div>

      <div className="lg:col-span-3 bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] p-4 flex flex-col overflow-hidden">
        {selectedEntry && !showOrphans ? (
          <>
            <div className="flex justify-between items-start mb-3 shrink-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100" title={selectedEntry.displayName}>
                    {selectedEntry.displayName}
                  </h2>
                  <button
                    onClick={() => onCopyPath(selectedEntry.fileNames, selectedType)}
                    className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                  >
                    Copy File Path
                  </button>
                </div>
                {selectedEntry.kind === 'pair' && (
                  <div className="mt-1 space-y-0.5">
                    {selectedEntry.files.map((file) => (
                      <p key={file.file_name} className="text-xs text-gray-500 dark:text-gray-400">{file.file_name}</p>
                    ))}
                  </div>
                )}
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {componentsData?.components?.length || 0} component{(componentsData?.components?.length || 0) !== 1 ? 's' : ''} using this file
                </p>
                {relatedSections.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {relatedSections.map((section) => (
                      <div key={section.key}>
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                          <Link2 className="w-3 h-3" />
                          {section.label}
                        </p>
                        {section.entries.length > 0 ? (
                          <div className="mt-1 flex flex-wrap gap-2">
                            {section.entries.map((entry) => (
                              <div
                                key={entry.key}
                                className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-700 px-2.5 py-1 text-xs text-gray-700 dark:text-gray-200"
                                title={entry.tooltip}
                              >
                                <span>{entry.label}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {section.emptyLabel}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {canWrite() && (
                <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
                  <button
                    onClick={() => onOpenRename(selectedEntry)}
                    className="btn-action-secondary text-sm"
                  >
                    Rename
                  </button>
                  {canManageFootprintRelatedLinks && (
                    <>
                      <button
                        onClick={() => onOpenFootprintLinkEditor('pad')}
                        disabled={isManagingFootprintRelatedLinks}
                        className="btn-action-secondary text-sm disabled:opacity-50"
                      >
                        Edit Pad Link
                      </button>
                      <button
                        onClick={() => onOpenFootprintLinkEditor('model')}
                        disabled={isManagingFootprintRelatedLinks}
                        className="btn-action-secondary text-sm disabled:opacity-50"
                      >
                        Edit 3D Model Link
                      </button>
                    </>
                  )}
                  {canDeleteFiles() && selectedEntry.canDelete && selectedEntry.componentCount === 0 && (
                    <button
                      onClick={() => onOpenDelete(selectedEntry)}
                      className="btn-action-danger text-sm"
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>

            {isLoadingComponents ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : (
              <div className="overflow-y-auto custom-scrollbar flex-1">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-[#333] sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Part Number</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Mfg P/N</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-[#3a3a3a]">
                    {componentsData?.components?.map((component) => (
                      <tr key={component.id} className="hover:bg-gray-50 dark:hover:bg-[#333]">
                        <td className="px-3 py-2 text-sm font-medium text-primary-600 dark:text-primary-400">
                          <button
                            onClick={() => navigate('/library', { state: { searchTerm: component.part_number } })}
                            className="hover:underline text-left"
                          >
                            {component.part_number}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">{component.manufacturer_pn}</td>
                        <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate" title={component.description}>
                          {component.description}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">{component.category_name}</td>
                        <td className="px-3 py-2">
                          <StatusBadge status={component.approval_status || component.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <FileBox className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium mb-2">
                {showOrphans ? 'Orphan files are not linked to any component' : 'Select a file to view details'}
              </p>
              <p className="text-sm">
                {showOrphans ? 'You can safely delete these files to free up storage.' : 'Choose a file from the list to see which components use it'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileTypesView;
