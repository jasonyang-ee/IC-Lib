import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  FileBox, 
  Search, 
  Edit, 
  Save, 
  X, 
  Cpu, 
  Box, 
  Zap, 
  FileCode, 
  ChevronRight,
  FileText
} from 'lucide-react';

const FileLibrary = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();
  const { canWrite } = useAuth();
  
  // State
  const [selectedType, setSelectedType] = useState('footprint');
  const [selectedFile, setSelectedFile] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameData, setRenameData] = useState({ oldName: '', newName: '', selectedIds: [] });
  const [selectAllComponents, setSelectAllComponents] = useState(true);
  
  // File type configuration
  const fileTypes = [
    { id: 'footprint', label: 'PCB Footprint', icon: Cpu, color: 'text-blue-500', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
    { id: 'schematic', label: 'Schematic', icon: Zap, color: 'text-green-500', bgColor: 'bg-green-100 dark:bg-green-900/30' },
    { id: 'step', label: 'STEP 3D Model', icon: Box, color: 'text-purple-500', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
    { id: 'pspice', label: 'PSpice Model', icon: FileCode, color: 'text-orange-500', bgColor: 'bg-orange-100 dark:bg-orange-900/30' },
  ];
  
  // Fetch file type statistics
  const { data: stats } = useQuery({
    queryKey: ['fileLibraryStats'],
    queryFn: async () => {
      const response = await api.getFileTypeStats();
      return response.data;
    }
  });
  
  // Fetch files by type
  const { data: filesData, isLoading: isLoadingFiles } = useQuery({
    queryKey: ['filesByType', selectedType],
    queryFn: async () => {
      const response = await api.getFilesByType(selectedType);
      return response.data;
    },
    enabled: !!selectedType
  });
  
  // Fetch components using selected file
  const { data: componentsData, isLoading: isLoadingComponents } = useQuery({
    queryKey: ['componentsByFile', selectedType, selectedFile],
    queryFn: async () => {
      const response = await api.getComponentsByFile(selectedType, selectedFile);
      return response.data;
    },
    enabled: !!selectedFile && !!selectedType
  });
  
  // Search files
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['fileSearch', searchQuery],
    queryFn: async () => {
      const response = await api.searchFiles(searchQuery);
      return response.data;
    },
    enabled: searchQuery.length > 2
  });
  
  // Mass rename mutation
  const renameMutation = useMutation({
    mutationFn: async ({ type, oldFileName, newFileName, componentIds }) => {
      await api.massRenameFile(type, { oldFileName, newFileName, componentIds });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['filesByType']);
      queryClient.invalidateQueries(['componentsByFile']);
      queryClient.invalidateQueries(['fileLibraryStats']);
      showSuccess(`Renamed "${variables.oldFileName}" to "${variables.newFileName}"`);
      setShowRenameModal(false);
      setSelectedFile(variables.newFileName);
    },
    onError: (error) => {
      showError('Failed to rename file: ' + (error.response?.data?.error || error.message));
    }
  });
  
  // Filter files based on search
  const displayedFiles = searchQuery.length > 2 && searchResults?.results
    ? searchResults.results.filter(r => r.file_type === selectedType)
    : filesData?.files || [];
    
  // Handle file selection
  const handleSelectFile = (fileName) => {
    setSelectedFile(fileName);
  };
  
  // Handle type change
  const handleTypeChange = (typeId) => {
    setSelectedType(typeId);
    setSelectedFile(null);
    setSearchQuery('');
  };
  
  // Handle rename
  const handleOpenRename = () => {
    if (!selectedFile) return;
    setRenameData({ 
      oldName: selectedFile, 
      newName: selectedFile, 
      selectedIds: componentsData?.components?.map(c => c.id) || []
    });
    setSelectAllComponents(true);
    setShowRenameModal(true);
  };
  
  const handleRenameSubmit = () => {
    if (!renameData.newName.trim() || renameData.newName === renameData.oldName) {
      showError('Please enter a new file name');
      return;
    }
    
    renameMutation.mutate({
      type: selectedType,
      oldFileName: renameData.oldName,
      newFileName: renameData.newName.trim(),
      componentIds: selectAllComponents ? null : renameData.selectedIds
    });
  };
  
  const toggleComponentSelection = (componentId) => {
    setRenameData(prev => ({
      ...prev,
      selectedIds: prev.selectedIds.includes(componentId)
        ? prev.selectedIds.filter(id => id !== componentId)
        : [...prev.selectedIds, componentId]
    }));
  };
  
  const getTypeCount = (typeId) => {
    if (!stats) return 0;
    return stats[typeId] || 0;
  };
  
  return (
    <div className="h-full flex flex-col">
      {/* Search Bar */}
      <div className="mb-4 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files across all types..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-[#3a3a3a] rounded-lg bg-white dark:bg-[#2a2a2a] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
            </div>
          )}
        </div>
      </div>
      
      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-6 gap-6 flex-1 overflow-hidden">
        {/* File Types Sidebar */}
        <div className="lg:col-span-1 bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] p-4 flex flex-col overflow-hidden">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 shrink-0">File Types</h2>
          <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1">
            {fileTypes.map((type) => {
              const Icon = type.icon;
              const isSelected = selectedType === type.id;
              return (
                <button
                  key={type.id}
                  onClick={() => handleTypeChange(type.id)}
                  className={`w-full p-3 rounded-lg border text-left transition-colors ${
                    isSelected
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-200 dark:border-[#3a3a3a] hover:border-primary-300 dark:hover:border-primary-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${type.bgColor}`}>
                      <Icon className={`w-5 h-5 ${type.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{type.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{getTypeCount(type.id)} files</p>
                    </div>
                    {isSelected && <ChevronRight className="w-4 h-4 text-primary-500" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Files List */}
        <div className="lg:col-span-2 bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] p-4 flex flex-col overflow-hidden">
          <div className="flex justify-between items-center mb-4 shrink-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {fileTypes.find(t => t.id === selectedType)?.label} Files
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
                const count = file.component_count;
                const isSelected = selectedFile === fileName;
                return (
                  <button
                    key={`${fileName}-${index}`}
                    onClick={() => handleSelectFile(fileName)}
                    className={`w-full p-3 rounded-lg border text-left transition-colors ${
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
                      </div>
                      <span className={`px-2 py-0.5 text-xs rounded-full shrink-0 ml-2 ${
                        isSelected 
                          ? 'bg-primary-500 text-white' 
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                      }`}>
                        {count} part{count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No files found</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Components Using File */}
        <div className="lg:col-span-3 bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] p-4 flex flex-col overflow-hidden">
          {selectedFile ? (
            <>
              <div className="flex justify-between items-start mb-4 shrink-0">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate" title={selectedFile}>
                    {selectedFile}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {componentsData?.components?.length || 0} component{(componentsData?.components?.length || 0) !== 1 ? 's' : ''} using this file
                  </p>
                </div>
                {canWrite() && (
                  <button
                    onClick={handleOpenRename}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    Mass Rename
                  </button>
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
                            <span className={`px-2 py-0.5 text-xs rounded-full ${
                              component.status === 'Active' 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                : component.status === 'Obsolete'
                                ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                              {component.status}
                            </span>
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
                <p className="text-lg font-medium mb-2">Select a file to view details</p>
                <p className="text-sm">Choose a file from the list to see which components use it</p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Rename Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-[#3a3a3a] shrink-0">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Mass Rename File</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Rename &quot;{renameData.oldName}&quot; across selected components
                  </p>
                </div>
                <button
                  onClick={() => setShowRenameModal(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  New File Name
                </label>
                <input
                  type="text"
                  value={renameData.newName}
                  onChange={(e) => setRenameData(prev => ({ ...prev, newName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#3a3a3a] rounded-lg bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Enter new file name"
                />
              </div>
              
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Apply to Components
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectAllComponents}
                      onChange={(e) => {
                        setSelectAllComponents(e.target.checked);
                        if (e.target.checked) {
                          setRenameData(prev => ({
                            ...prev,
                            selectedIds: componentsData?.components?.map(c => c.id) || []
                          }));
                        }
                      }}
                      className="rounded border-gray-300 dark:border-[#3a3a3a] text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Select All</span>
                  </label>
                </div>
                
                <div className="max-h-60 overflow-y-auto custom-scrollbar border border-gray-200 dark:border-[#3a3a3a] rounded-lg">
                  {componentsData?.components?.map((component) => (
                    <label
                      key={component.id}
                      className="flex items-center gap-3 p-3 border-b border-gray-100 dark:border-[#3a3a3a] last:border-b-0 hover:bg-gray-50 dark:hover:bg-[#333] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectAllComponents || renameData.selectedIds.includes(component.id)}
                        disabled={selectAllComponents}
                        onChange={() => toggleComponentSelection(component.id)}
                        className="rounded border-gray-300 dark:border-[#3a3a3a] text-primary-600 focus:ring-primary-500 disabled:opacity-50"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">{component.part_number}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{component.manufacturer_pn}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Warning:</strong> This will update the {fileTypes.find(t => t.id === selectedType)?.label.toLowerCase()} field for{' '}
                  {selectAllComponents 
                    ? `all ${componentsData?.components?.length || 0} components`
                    : `${renameData.selectedIds.length} selected component(s)`
                  } using this file.
                </p>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 dark:border-[#3a3a3a] shrink-0 flex justify-end gap-3">
              <button
                onClick={() => setShowRenameModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleRenameSubmit}
                disabled={renameMutation.isPending || !renameData.newName.trim() || renameData.newName === renameData.oldName}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                {renameMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Renaming...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Rename
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileLibrary;
