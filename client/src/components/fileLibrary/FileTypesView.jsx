import {
  ChevronRight,
  FileText,
  FileBox,
  Copy,
  Trash2,
  Edit,
  Download,
} from 'lucide-react';
import StatusBadge from './StatusBadge';
import { fileTypeLabels } from './constants';

const FileTypesView = ({
  fileTypes,
  selectedType,
  selectedFile,
  showOrphans,
  displayedFiles,
  isLoadingFiles,
  componentsData,
  isLoadingComponents,
  getTypeCount,
  onTypeChange,
  onSelectFile,
  onOpenRename,
  onOpenDelete,
  onCopyPath,
  canWrite,
  navigate,
}) => (
  <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 flex-1 overflow-hidden">
    {/* Col 1: File type selection sidebar */}
    <div className="lg:col-span-1 flex flex-col gap-4 overflow-hidden">
      {/* File Types */}
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

      <div className="flex-1" />

      {/* CIS Configuration File */}
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">CIS Configuration File</h2>
        <a
          href={`${import.meta.env.VITE_API_URL || '/api'}/settings/cis-config`}
          download
          className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
        >
          <Download className="w-4 h-4" />
          Download Config
        </a>
      </div>
    </div>

    {/* Col 2: File list */}
    <div className="lg:col-span-2 bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] p-4 flex flex-col overflow-hidden">
      <div className="flex justify-between items-center mb-3 shrink-0">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          {showOrphans ? 'Orphan Files' : `${fileTypes.find(t => t.id === selectedType)?.label} Files`}
          <span className="text-sm font-normal text-gray-500 ml-2">({displayedFiles.length})</span>
        </h2>
      </div>

      {isLoadingFiles ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : displayedFiles.length > 0 ? (
        <div className="space-y-1 overflow-y-auto custom-scrollbar flex-1">
          {displayedFiles.map((file, index) => {
            const fileName = file.file_name;
            const count = file.component_count ?? 0;
            const isSelected = selectedFile === fileName;
            return (
              <button
                key={`${fileName}-${index}`}
                onClick={() => onSelectFile(fileName)}
                className={`w-full p-2.5 rounded-lg border text-left transition-colors ${
                  isSelected
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-[#3a3a3a] hover:border-primary-300 dark:hover:border-primary-700 hover:bg-gray-50 dark:hover:bg-[#333]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-gray-100 truncate text-sm" title={fileName}>
                      {fileName}
                    </p>
                    {showOrphans && file.file_type && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{fileTypeLabels[file.file_type] || file.file_type}</p>
                    )}
                  </div>
                  {!showOrphans && (
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onCopyPath(fileName);
                        }}
                        className="text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 p-0.5"
                        title="Copy file path"
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
                  {showOrphans && canWrite() && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDelete(fileName, selectedType, 0);
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
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>{showOrphans ? 'No orphan files found' : 'No files found'}</p>
          </div>
        </div>
      )}
    </div>

    {/* Col 3: Component details */}
    <div className="lg:col-span-3 bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] p-4 flex flex-col overflow-hidden">
      {selectedFile && !showOrphans ? (
        <>
          <div className="flex justify-between items-start mb-3 shrink-0">
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate" title={selectedFile}>
                {selectedFile}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {componentsData?.components?.length || 0} component{(componentsData?.components?.length || 0) !== 1 ? 's' : ''} using this file
              </p>
            </div>
            {canWrite() && (
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => onOpenRename()} className="btn-secondary flex items-center gap-1.5 text-sm">
                  <Edit className="w-3.5 h-3.5" /> Rename
                </button>
                <button
                  onClick={() => onOpenDelete(selectedFile, selectedType, componentsData?.components?.length || 0)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 dark:text-red-400 dark:hover:text-red-300 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
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

export default FileTypesView;
