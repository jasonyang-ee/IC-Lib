import { useMemo, useRef } from 'react';
import {
  FolderOpen,
  ChevronRight,
  ExternalLink,
  Copy,
  Edit,
  Trash2,
  FileBox,
  Link2,
} from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { fileTypeLabels, routeTypeToFileType } from './constants';

const CategoryView = ({
  categories,
  selectedCategoryId,
  selectedComponentId,
  categoryComponents,
  isLoadingCategoryComponents,
  componentFiles,
  isLoadingComponentFiles,
  sharingData,
  searchQuery,
  onCategoryChange,
  onComponentSelect,
  onOpenRename,
  onOpenDelete,
  onCopyPath,
  canWrite,
  navigate,
}) => {
  const isAllCategories = selectedCategoryId === 'all';
  const componentListRef = useRef(null);

  // Memoize filtered components
  const filteredComponents = useMemo(() => {
    if (!categoryComponents?.components) return [];
    if (!searchQuery || searchQuery.length < 2) return categoryComponents.components;
    const q = searchQuery.toLowerCase();
    return categoryComponents.components.filter((comp) =>
      comp.part_number?.toLowerCase().includes(q) ||
      comp.manufacturer_pn?.toLowerCase().includes(q) ||
      comp.description?.toLowerCase().includes(q) ||
      comp.category_name?.toLowerCase().includes(q)
    );
  }, [categoryComponents?.components, searchQuery]);

  // Memoize file entries
  const fileEntries = useMemo(() => {
    if (!componentFiles?.files) return [];
    return Object.entries(componentFiles.files).flatMap(([fileType, files]) =>
      files.map(f => ({ ...f, file_type: fileType }))
    );
  }, [componentFiles?.files]);

  // Memoize sharing-by-file grouping
  const sharingByFile = useMemo(() => {
    const result = {};
    if (sharingData?.components) {
      for (const comp of sharingData.components) {
        const key = `${comp.file_type}:${comp.file_name}`;
        if (!result[key]) result[key] = { file_name: comp.file_name, file_type: comp.file_type, components: [] };
        result[key].components.push(comp);
      }
    }
    return result;
  }, [sharingData?.components]);

  const selectedComp = categoryComponents?.components?.find(c => c.id === selectedComponentId);

  // Virtualizer for component list
  const rowVirtualizer = useVirtualizer({
    count: filteredComponents.length,
    getScrollElement: () => componentListRef.current,
    estimateSize: () => 56,
    overscan: 15,
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 flex-1 overflow-hidden">
      {/* Col 1: Category select */}
      <div className="lg:col-span-1 bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] p-3 flex flex-col overflow-hidden">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 shrink-0">Categories</h2>
        <div className="space-y-1 overflow-y-auto custom-scrollbar flex-1">
          <button
            onClick={() => onCategoryChange('all')}
            className={`w-full p-2.5 rounded-lg border text-left transition-colors text-sm ${
              isAllCategories
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 font-medium'
                : 'border-gray-200 dark:border-[#3a3a3a] hover:border-primary-300 dark:hover:border-primary-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-gray-900 dark:text-gray-100 truncate">All Categories</span>
              {isAllCategories && <ChevronRight className="w-3.5 h-3.5 text-primary-500 shrink-0" />}
            </div>
          </button>
          {categories?.map((cat) => {
            const isSelected = selectedCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => onCategoryChange(cat.id)}
                className={`w-full p-2.5 rounded-lg border text-left transition-colors text-sm ${
                  isSelected
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 font-medium'
                    : 'border-gray-200 dark:border-[#3a3a3a] hover:border-primary-300 dark:hover:border-primary-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-gray-900 dark:text-gray-100 truncate">{cat.name}</span>
                  {isSelected && <ChevronRight className="w-3.5 h-3.5 text-primary-500 shrink-0" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Col 2: Components in category */}
      <div className="lg:col-span-2 bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] p-4 flex flex-col overflow-hidden">
        <div className="flex justify-between items-center mb-3 shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Components
            {selectedCategoryId && (
              <span className="text-sm font-normal text-gray-500 ml-2">({filteredComponents.length})</span>
            )}
          </h2>
        </div>

        {!selectedCategoryId ? (
          <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <FolderOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Select a category</p>
            </div>
          </div>
        ) : isLoadingCategoryComponents ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredComponents.length > 0 ? (
          <div ref={componentListRef} className="overflow-y-auto custom-scrollbar flex-1">
            <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const comp = filteredComponents[virtualRow.index];
                const isSelected = selectedComponentId === comp.id;
                return (
                  <button
                    key={comp.id}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    onClick={() => onComponentSelect(comp.id)}
                    className={`absolute left-0 w-full p-2.5 rounded-lg border text-left transition-colors ${
                      isSelected
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-[#3a3a3a] hover:border-primary-300 dark:hover:border-primary-700 hover:bg-gray-50 dark:hover:bg-[#333]'
                    }`}
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">{comp.part_number}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {comp.manufacturer_pn || comp.description}
                          {isAllCategories && comp.category_name && (
                            <span className="ml-1.5 text-gray-400 dark:text-gray-500">| {comp.category_name}</span>
                          )}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 text-xs rounded-full shrink-0 ml-2 ${
                        isSelected
                          ? 'bg-primary-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                      }`}>
                        {comp.cad_file_count ?? 0}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <p>No components found</p>
          </div>
        )}
      </div>

      {/* Col 3: Files for component + sharing components */}
      <div className="lg:col-span-3 bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] p-4 flex flex-col overflow-hidden">
        {selectedComponentId ? (
          <div className="flex flex-col flex-1 min-h-0 gap-4">
            {/* Top: CAD files for component */}
            <div className="flex flex-col min-h-0 flex-1">
              <div className="flex items-center justify-between mb-3 shrink-0">
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    CAD Files
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {selectedComp?.part_number} — {selectedComp?.manufacturer_pn}
                  </p>
                </div>
                <button
                  onClick={() => navigate('/library', { state: { searchTerm: selectedComp?.part_number } })}
                  className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  View Part
                </button>
              </div>

              {isLoadingComponentFiles ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                </div>
              ) : fileEntries.length > 0 ? (
                <div className="overflow-y-auto custom-scrollbar flex-1">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-[#333] sticky top-0">
                      <tr>
                        <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                        <th className="px-3 py-1.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">File Name</th>
                        <th className="px-3 py-1.5 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-[#3a3a3a]">
                      {fileEntries.map((file) => {
                        // Map file_type to route type for rename/delete operations
                        const routeType = Object.entries(routeTypeToFileType).find(([, ft]) => ft === file.file_type)?.[0] || file.file_type;
                        return (
                          <tr key={file.id} className="hover:bg-gray-50 dark:hover:bg-[#333]">
                            <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
                              {fileTypeLabels[file.file_type] || file.file_type}
                            </td>
                            <td className="px-3 py-2 text-sm font-mono text-gray-900 dark:text-gray-100 truncate max-w-xs" title={file.file_name}>
                              {file.file_name}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => onCopyPath(file.file_name, routeType)}
                                  className="text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 p-1"
                                  title="Copy file path"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                {canWrite() && (
                                  <>
                                    <button
                                      onClick={() => onOpenRename(file.file_name, routeType)}
                                      className="text-gray-500 hover:text-primary-600 p-1"
                                      title="Rename file"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => onOpenDelete(file.file_name, routeType)}
                                      className="text-gray-500 hover:text-red-600 p-1"
                                      title="Delete file"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex items-center justify-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                  No CAD files linked to this component
                </div>
              )}
            </div>

            {/* Bottom: Components sharing files */}
            {Object.keys(sharingByFile).length > 0 && (
              <div className="border-t border-gray-200 dark:border-[#3a3a3a] pt-3 shrink-0 max-h-[40%] flex flex-col min-h-0">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-1.5 shrink-0">
                  <Link2 className="w-3.5 h-3.5" />
                  Shared With
                </h3>
                <div className="overflow-y-auto custom-scrollbar flex-1">
                  {Object.values(sharingByFile).map((group) => (
                    <div key={`${group.file_type}:${group.file_name}`} className="mb-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        <span className="font-medium">{fileTypeLabels[group.file_type] || group.file_type}:</span>{' '}
                        <span className="font-mono">{group.file_name}</span>
                      </p>
                      <div className="flex flex-wrap gap-1.5 ml-2">
                        {group.components.map((comp) => (
                          <button
                            key={comp.id}
                            onClick={() => navigate('/library', { state: { searchTerm: comp.part_number } })}
                            className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-primary-600 dark:text-primary-400 rounded hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                          >
                            {comp.part_number}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <FileBox className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium mb-2">Select a component</p>
              <p className="text-sm">Choose a component to see its CAD files and sharing info</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryView;
