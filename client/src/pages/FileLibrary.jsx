import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  FileText,
  Layers,
  Trash2,
  AlertTriangle,
  FolderOpen,
  Link2,
  Unlink,
  ExternalLink,
} from 'lucide-react';

// View modes
const VIEW_FILE_TYPES = 'fileTypes';
const VIEW_CATEGORY = 'category';

// File type configuration (used for File Types view)
const fileTypes = [
  { id: 'footprint', label: 'PCB Footprint', icon: Cpu, color: 'text-blue-500', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  { id: 'schematic', label: 'Schematic', icon: Zap, color: 'text-green-500', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  { id: 'step', label: 'STEP 3D Model', icon: Box, color: 'text-purple-500', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
  { id: 'pspice', label: 'PSpice Model', icon: FileCode, color: 'text-orange-500', bgColor: 'bg-orange-100 dark:bg-orange-900/30' },
  { id: 'pad', label: 'Pad File', icon: Layers, color: 'text-teal-500', bgColor: 'bg-teal-100 dark:bg-teal-900/30' },
];

// Map file type IDs from cad_files.file_type to display labels
const fileTypeLabels = {
  footprint: 'PCB Footprint',
  symbol: 'Schematic',
  model: 'STEP 3D Model',
  pspice: 'PSpice Model',
  pad: 'Pad File',
};

// Map route type IDs to cad_files.file_type values
const routeTypeToFileType = {
  footprint: 'footprint',
  schematic: 'symbol',
  step: 'model',
  pspice: 'pspice',
  pad: 'pad',
};

const StatusBadge = ({ status }) => {
  const colorMap = {
    Active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    Obsolete: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    Draft: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    Approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  };
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full ${colorMap[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}`}>
      {status || '—'}
    </span>
  );
};

const FileLibrary = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showSuccess, showError } = useNotification();
  const { canWrite } = useAuth();

  // --- State ---
  const [viewMode, setViewMode] = useState(VIEW_FILE_TYPES);

  // File Types view state
  const [selectedType, setSelectedType] = useState('footprint');
  const [selectedFile, setSelectedFile] = useState(null);
  const [showOrphans, setShowOrphans] = useState(false);

  // Category view state
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [selectedComponentId, setSelectedComponentId] = useState(null);

  // Shared state
  const [searchQuery, setSearchQuery] = useState('');
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameData, setRenameData] = useState({ oldName: '', newName: '', selectedIds: [] });
  const [selectAllComponents, setSelectAllComponents] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isPhysicalRename, setIsPhysicalRename] = useState(true);

  // --- URL parameter handling ---
  useEffect(() => {
    const typeParam = searchParams.get('type');
    const fileParam = searchParams.get('file');
    if (typeParam) {
      setSelectedType(typeParam);
      setViewMode(VIEW_FILE_TYPES);
      if (fileParam) {
        setSelectedFile(decodeURIComponent(fileParam));
      }
      // Clear params after applying
      setSearchParams({}, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ==============================
  // QUERIES
  // ==============================

  // File type statistics
  const { data: stats } = useQuery({
    queryKey: ['fileLibraryStats'],
    queryFn: async () => {
      const response = await api.getFileTypeStats();
      return response.data;
    },
  });

  // Files by type (File Types view)
  const { data: filesData, isLoading: isLoadingFiles } = useQuery({
    queryKey: ['filesByType', selectedType],
    queryFn: async () => {
      const response = await api.getFilesByType(selectedType);
      return response.data;
    },
    enabled: viewMode === VIEW_FILE_TYPES && !!selectedType && !showOrphans,
  });

  // Orphan files
  const { data: orphanData, isLoading: isLoadingOrphans } = useQuery({
    queryKey: ['orphanFiles', selectedType],
    queryFn: async () => {
      const response = await api.getOrphanFiles(selectedType);
      return response.data;
    },
    enabled: viewMode === VIEW_FILE_TYPES && showOrphans,
  });

  // Components using selected file (File Types view)
  const { data: componentsData, isLoading: isLoadingComponents } = useQuery({
    queryKey: ['componentsByFile', selectedType, selectedFile],
    queryFn: async () => {
      const response = await api.getComponentsByFile(selectedType, selectedFile);
      return response.data;
    },
    enabled: viewMode === VIEW_FILE_TYPES && !!selectedFile && !!selectedType && !showOrphans,
  });

  // Search files
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['fileSearch', searchQuery],
    queryFn: async () => {
      const response = await api.searchFiles(searchQuery);
      return response.data;
    },
    enabled: searchQuery.length > 2,
  });

  // Categories (for Category view)
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await api.getCategories();
      return response.data;
    },
  });

  // Components in selected category (Category view)
  const { data: categoryComponents, isLoading: isLoadingCategoryComponents } = useQuery({
    queryKey: ['categoryComponentsForFiles', selectedCategoryId],
    queryFn: async () => {
      const response = await api.getComponentsByCategoryForFiles(selectedCategoryId);
      return response.data;
    },
    enabled: viewMode === VIEW_CATEGORY && !!selectedCategoryId,
  });

  // CAD files for selected component (Category view)
  const { data: componentFiles, isLoading: isLoadingComponentFiles } = useQuery({
    queryKey: ['cadFilesForComponent', selectedComponentId],
    queryFn: async () => {
      const response = await api.getCadFilesForComponent(selectedComponentId);
      return response.data;
    },
    enabled: viewMode === VIEW_CATEGORY && !!selectedComponentId,
  });

  // Components sharing files with selected component (Category view)
  const { data: sharingData, isLoading: isLoadingSharingData } = useQuery({
    queryKey: ['sharingComponents', selectedComponentId],
    queryFn: async () => {
      const response = await api.getSharingComponents(selectedComponentId);
      return response.data;
    },
    enabled: viewMode === VIEW_CATEGORY && !!selectedComponentId,
  });

  // ==============================
  // MUTATIONS
  // ==============================

  // Mass rename (DB-only)
  const renameMutation = useMutation({
    mutationFn: async ({ type, oldFileName, newFileName, componentIds }) => {
      await api.massRenameFile(type, { oldFileName, newFileName, componentIds });
    },
    onSuccess: (_, variables) => {
      invalidateAll();
      showSuccess(`Renamed "${variables.oldFileName}" to "${variables.newFileName}" in database`);
      setShowRenameModal(false);
      setSelectedFile(variables.newFileName);
    },
    onError: (error) => {
      showError('Failed to rename file: ' + (error.response?.data?.error || error.message));
    },
  });

  // Physical file rename
  const physicalRenameMutation = useMutation({
    mutationFn: async ({ type, oldFileName, newFileName }) => {
      const response = await api.renamePhysicalFile(type, { oldFileName, newFileName });
      return response.data;
    },
    onSuccess: (data, variables) => {
      invalidateAll();
      showSuccess(`Renamed "${variables.oldFileName}" to "${variables.newFileName}" (${data.updatedComponents} component${data.updatedComponents !== 1 ? 's' : ''} updated)`);
      setShowRenameModal(false);
      setSelectedFile(variables.newFileName);
    },
    onError: (error) => {
      showError('Failed to rename file: ' + (error.response?.data?.error || error.message));
    },
  });

  // Physical file delete
  const deleteMutation = useMutation({
    mutationFn: async ({ type, fileName }) => {
      const response = await api.deletePhysicalFile(type, { fileName });
      return response.data;
    },
    onSuccess: (data, variables) => {
      invalidateAll();
      showSuccess(`Deleted "${variables.fileName}" (removed from ${data.updatedComponents} component${data.updatedComponents !== 1 ? 's' : ''})`);
      setShowDeleteModal(false);
      setSelectedFile(null);
      setDeleteTarget(null);
    },
    onError: (error) => {
      showError('Failed to delete file: ' + (error.response?.data?.error || error.message));
    },
  });

  // ==============================
  // HELPERS
  // ==============================

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['filesByType'] });
    queryClient.invalidateQueries({ queryKey: ['componentsByFile'] });
    queryClient.invalidateQueries({ queryKey: ['fileLibraryStats'] });
    queryClient.invalidateQueries({ queryKey: ['orphanFiles'] });
    queryClient.invalidateQueries({ queryKey: ['cadFilesForComponent'] });
    queryClient.invalidateQueries({ queryKey: ['sharingComponents'] });
    queryClient.invalidateQueries({ queryKey: ['categoryComponentsForFiles'] });
    queryClient.invalidateQueries({ queryKey: ['fileSearch'] });
  };

  const getTypeCount = (typeId) => {
    if (!stats) return 0;
    return stats[typeId] || 0;
  };

  // Filter files for the file types view based on search
  const displayedFiles = showOrphans
    ? (orphanData?.orphans || [])
    : searchQuery.length > 2 && searchResults?.results
      ? searchResults.results.filter(r => r.file_type === routeTypeToFileType[selectedType])
      : filesData?.files || [];

  // ==============================
  // HANDLERS
  // ==============================

  const handleTypeChange = (typeId) => {
    setSelectedType(typeId);
    setSelectedFile(null);
    setSearchQuery('');
    setShowOrphans(false);
  };

  const handleSelectFile = (fileName) => {
    setSelectedFile(fileName);
  };

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    setSelectedFile(null);
    setSelectedComponentId(null);
    setSearchQuery('');
    setShowOrphans(false);
  };

  const handleCategoryChange = (catId) => {
    setSelectedCategoryId(catId);
    setSelectedComponentId(null);
  };

  const handleComponentSelect = (compId) => {
    setSelectedComponentId(compId);
  };

  // --- Rename handlers ---
  const handleOpenRename = (fileName, type) => {
    const ft = type || selectedType;
    setRenameData({
      oldName: fileName || selectedFile,
      newName: fileName || selectedFile,
      selectedIds: componentsData?.components?.map(c => c.id) || [],
      type: ft,
    });
    setSelectAllComponents(true);
    setIsPhysicalRename(true);
    setShowRenameModal(true);
  };

  const handleRenameSubmit = () => {
    if (!renameData.newName.trim() || renameData.newName === renameData.oldName) {
      showError('Please enter a new file name');
      return;
    }
    const type = renameData.type || selectedType;
    if (isPhysicalRename) {
      physicalRenameMutation.mutate({
        type,
        oldFileName: renameData.oldName,
        newFileName: renameData.newName.trim(),
      });
    } else {
      renameMutation.mutate({
        type,
        oldFileName: renameData.oldName,
        newFileName: renameData.newName.trim(),
        componentIds: selectAllComponents ? null : renameData.selectedIds,
      });
    }
  };

  const handleUseMPN = () => {
    const components = componentsData?.components;
    if (components && components.length > 0) {
      const mpn = components[0].manufacturer_pn;
      if (mpn) {
        const ext = renameData.oldName.includes('.')
          ? renameData.oldName.substring(renameData.oldName.lastIndexOf('.'))
          : '';
        setRenameData(prev => ({ ...prev, newName: mpn + ext }));
      }
    }
  };

  const handleUsePackage = () => {
    const components = componentsData?.components;
    if (components && components.length > 0) {
      const pkg = components[0].package_size;
      if (pkg) {
        const ext = renameData.oldName.includes('.')
          ? renameData.oldName.substring(renameData.oldName.lastIndexOf('.'))
          : '';
        setRenameData(prev => ({ ...prev, newName: pkg + ext }));
      }
    }
  };

  const toggleComponentSelection = (componentId) => {
    setRenameData(prev => ({
      ...prev,
      selectedIds: prev.selectedIds.includes(componentId)
        ? prev.selectedIds.filter(id => id !== componentId)
        : [...prev.selectedIds, componentId],
    }));
  };

  // --- Delete handlers ---
  const handleOpenDelete = (fileName, type, componentCount) => {
    setDeleteTarget({
      fileName: fileName || selectedFile,
      type: type || selectedType,
      componentCount: componentCount ?? componentsData?.components?.length ?? 0,
    });
    setShowDeleteModal(true);
  };

  const handleDeleteSubmit = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate({
      type: deleteTarget.type,
      fileName: deleteTarget.fileName,
    });
  };

  // ==============================
  // RENDER
  // ==============================

  return (
    <div className="h-full flex flex-col">
      {/* Top bar: View mode toggle + Search + Orphan filter */}
      <div className="mb-4 shrink-0 flex items-center gap-3">
        {/* View mode toggle */}
        <div className="flex rounded-lg border border-gray-300 dark:border-[#3a3a3a] overflow-hidden shrink-0">
          <button
            onClick={() => handleViewModeChange(VIEW_FILE_TYPES)}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              viewMode === VIEW_FILE_TYPES
                ? 'bg-primary-600 text-white'
                : 'bg-white dark:bg-[#333] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#3a3a3a]'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <FileBox className="w-4 h-4" />
              File Types
            </div>
          </button>
          <button
            onClick={() => handleViewModeChange(VIEW_CATEGORY)}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              viewMode === VIEW_CATEGORY
                ? 'bg-primary-600 text-white'
                : 'bg-white dark:bg-[#333] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#3a3a3a]'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <FolderOpen className="w-4 h-4" />
              Category
            </div>
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={viewMode === VIEW_FILE_TYPES ? 'Search files across all types...' : 'Filter components by name...'}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-[#3a3a3a] rounded-lg bg-white dark:bg-[#2a2a2a] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
            </div>
          )}
        </div>

        {/* Orphan filter (File Types view only) */}
        {viewMode === VIEW_FILE_TYPES && (
          <button
            onClick={() => {
              setShowOrphans(!showOrphans);
              setSelectedFile(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors shrink-0 ${
              showOrphans
                ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                : 'border-gray-300 dark:border-[#3a3a3a] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#3a3a3a]'
            }`}
            title="Show orphan files (not linked to any component)"
          >
            <Unlink className="w-4 h-4" />
            Orphans
          </button>
        )}
      </div>

      {/* Main content depends on view mode */}
      {viewMode === VIEW_FILE_TYPES ? (
        <FileTypesView
          fileTypes={fileTypes}
          selectedType={selectedType}
          selectedFile={selectedFile}
          showOrphans={showOrphans}
          displayedFiles={displayedFiles}
          isLoadingFiles={isLoadingFiles || isLoadingOrphans}
          componentsData={componentsData}
          isLoadingComponents={isLoadingComponents}
          getTypeCount={getTypeCount}
          onTypeChange={handleTypeChange}
          onSelectFile={handleSelectFile}
          onOpenRename={handleOpenRename}
          onOpenDelete={handleOpenDelete}
          canWrite={canWrite}
          navigate={navigate}
        />
      ) : (
        <CategoryView
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          selectedComponentId={selectedComponentId}
          categoryComponents={categoryComponents}
          isLoadingCategoryComponents={isLoadingCategoryComponents}
          componentFiles={componentFiles}
          isLoadingComponentFiles={isLoadingComponentFiles}
          sharingData={sharingData}
          isLoadingSharingData={isLoadingSharingData}
          searchQuery={searchQuery}
          onCategoryChange={handleCategoryChange}
          onComponentSelect={handleComponentSelect}
          onOpenRename={handleOpenRename}
          onOpenDelete={handleOpenDelete}
          canWrite={canWrite}
          navigate={navigate}
        />
      )}

      {/* ===== RENAME MODAL ===== */}
      {showRenameModal && (
        <RenameModal
          renameData={renameData}
          setRenameData={setRenameData}
          isPhysicalRename={isPhysicalRename}
          setIsPhysicalRename={setIsPhysicalRename}
          selectAllComponents={selectAllComponents}
          setSelectAllComponents={setSelectAllComponents}
          componentsData={componentsData}
          selectedType={renameData.type || selectedType}
          fileTypes={fileTypes}
          onClose={() => setShowRenameModal(false)}
          onSubmit={handleRenameSubmit}
          onUseMPN={handleUseMPN}
          onUsePackage={handleUsePackage}
          onToggleComponent={toggleComponentSelection}
          isPending={renameMutation.isPending || physicalRenameMutation.isPending}
        />
      )}

      {/* ===== DELETE MODAL ===== */}
      {showDeleteModal && deleteTarget && (
        <DeleteModal
          target={deleteTarget}
          onClose={() => { setShowDeleteModal(false); setDeleteTarget(null); }}
          onConfirm={handleDeleteSubmit}
          isPending={deleteMutation.isPending}
        />
      )}
    </div>
  );
};


// ============================================================
// FILE TYPES VIEW
// ============================================================
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
  canWrite,
  navigate,
}) => (
  <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 flex-1 overflow-hidden">
    {/* Col 1: File type selection sidebar */}
    <div className="lg:col-span-1 bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] p-3 flex flex-col overflow-hidden">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 shrink-0 uppercase tracking-wider">File Types</h2>
      <div className="space-y-1.5 overflow-y-auto custom-scrollbar flex-1">
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
                    <span className={`px-2 py-0.5 text-xs rounded-full shrink-0 ml-2 ${
                      isSelected
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                    }`}>
                      {count} part{count !== 1 ? 's' : ''}
                    </span>
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


// ============================================================
// CATEGORY VIEW
// ============================================================
const CategoryView = ({
  categories,
  selectedCategoryId,
  selectedComponentId,
  categoryComponents,
  isLoadingCategoryComponents,
  componentFiles,
  isLoadingComponentFiles,
  sharingData,
  isLoadingSharingData: _isLoadingSharingData,
  searchQuery,
  onCategoryChange,
  onComponentSelect,
  onOpenRename,
  onOpenDelete,
  canWrite,
  navigate,
}) => {
  // Filter category components by search query
  const filteredComponents = categoryComponents?.components?.filter((comp) => {
    if (!searchQuery || searchQuery.length < 2) return true;
    const q = searchQuery.toLowerCase();
    return (
      comp.part_number?.toLowerCase().includes(q) ||
      comp.manufacturer_pn?.toLowerCase().includes(q) ||
      comp.description?.toLowerCase().includes(q)
    );
  }) || [];

  // Flatten componentFiles grouped data for display
  const fileEntries = componentFiles?.files
    ? Object.entries(componentFiles.files).flatMap(([fileType, files]) =>
        files.map(f => ({ ...f, file_type: fileType }))
      )
    : [];

  // Group sharing components by file
  const sharingByFile = {};
  if (sharingData?.components) {
    for (const comp of sharingData.components) {
      const key = `${comp.file_type}:${comp.file_name}`;
      if (!sharingByFile[key]) sharingByFile[key] = { file_name: comp.file_name, file_type: comp.file_type, components: [] };
      sharingByFile[key].components.push(comp);
    }
  }

  const selectedComp = categoryComponents?.components?.find(c => c.id === selectedComponentId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 flex-1 overflow-hidden">
      {/* Col 1: Category select */}
      <div className="lg:col-span-1 bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] p-3 flex flex-col overflow-hidden">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 shrink-0 uppercase tracking-wider">Categories</h2>
        <div className="space-y-1 overflow-y-auto custom-scrollbar flex-1">
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
          <div className="space-y-1 overflow-y-auto custom-scrollbar flex-1">
            {filteredComponents.map((comp) => {
              const isSelected = selectedComponentId === comp.id;
              return (
                <button
                  key={comp.id}
                  onClick={() => onComponentSelect(comp.id)}
                  className={`w-full p-2.5 rounded-lg border text-left transition-colors ${
                    isSelected
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-200 dark:border-[#3a3a3a] hover:border-primary-300 dark:hover:border-primary-700 hover:bg-gray-50 dark:hover:bg-[#333]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">{comp.part_number}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{comp.manufacturer_pn || comp.description}</p>
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
                              {canWrite() && (
                                <div className="flex items-center justify-end gap-1">
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
                                </div>
                              )}
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


// ============================================================
// RENAME MODAL
// ============================================================
const RenameModal = ({
  renameData,
  setRenameData,
  isPhysicalRename,
  setIsPhysicalRename,
  selectAllComponents,
  setSelectAllComponents,
  componentsData,
  selectedType,
  fileTypes,
  onClose,
  onSubmit,
  onUseMPN,
  onUsePackage,
  onToggleComponent,
  isPending,
}) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
      <div className="p-6 border-b border-gray-200 dark:border-[#3a3a3a] shrink-0">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Rename File</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Rename &quot;{renameData.oldName}&quot;
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
        {/* Rename mode toggle */}
        <div className="mb-4">
          <div className="flex rounded-lg border border-gray-300 dark:border-[#3a3a3a] overflow-hidden">
            <button
              onClick={() => setIsPhysicalRename(true)}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                isPhysicalRename
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-[#333] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#3a3a3a]'
              }`}
            >
              File + Database
            </button>
            <button
              onClick={() => setIsPhysicalRename(false)}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                !isPhysicalRename
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-[#333] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#3a3a3a]'
              }`}
            >
              Database Only
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {isPhysicalRename
              ? 'Renames the physical file on disk and updates all component references.'
              : 'Only updates database references. The physical file is not renamed.'}
          </p>
        </div>

        <div className="mb-4">
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
          {/* Quick-fill shortcuts */}
          {componentsData?.components?.length > 0 && (
            <div className="flex gap-2 mt-2">
              {componentsData.components[0].manufacturer_pn && (
                <button
                  onClick={onUseMPN}
                  className="px-2 py-1 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                >
                  Use MPN: {componentsData.components[0].manufacturer_pn}
                </button>
              )}
              {componentsData.components[0].package_size && (
                <button
                  onClick={onUsePackage}
                  className="px-2 py-1 text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                >
                  Use Package: {componentsData.components[0].package_size}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Component selection - only in DB-only mode */}
        {!isPhysicalRename && (
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
                        selectedIds: componentsData?.components?.map(c => c.id) || [],
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
                    onChange={() => onToggleComponent(component.id)}
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
        )}

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            {isPhysicalRename ? (
              <>
                <strong>Warning:</strong> This will rename the physical file on disk and update the{' '}
                {fileTypes.find(t => t.id === selectedType)?.label.toLowerCase() || selectedType} field for{' '}
                all {componentsData?.components?.length || 0} component(s) referencing this file.
              </>
            ) : (
              <>
                <strong>Warning:</strong> This will update the {fileTypes.find(t => t.id === selectedType)?.label.toLowerCase() || selectedType} field for{' '}
                {selectAllComponents
                  ? `all ${componentsData?.components?.length || 0} components`
                  : `${renameData.selectedIds.length} selected component(s)`
                } using this file. The physical file will not be renamed.
              </>
            )}
          </p>
        </div>
      </div>

      <div className="p-6 border-t border-gray-200 dark:border-[#3a3a3a] shrink-0 flex justify-end gap-3">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button
          onClick={onSubmit}
          disabled={isPending || !renameData.newName.trim() || renameData.newName === renameData.oldName}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          {isPending ? (
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
);


// ============================================================
// DELETE MODAL
// ============================================================
const DeleteModal = ({ target, onClose, onConfirm, isPending }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-xl max-w-md w-full mx-4">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
            <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Delete File</h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          Are you sure you want to delete <strong className="text-gray-900 dark:text-gray-100">{target.fileName}</strong>?
        </p>
        {target.componentCount > 0 && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            This will permanently delete the physical file from disk and remove it from{' '}
            <strong>{target.componentCount}</strong> component reference{target.componentCount !== 1 ? 's' : ''}.
          </p>
        )}
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-sm text-red-800 dark:text-red-200">
            <strong>This action cannot be undone.</strong>
          </p>
        </div>
      </div>
      <div className="p-6 border-t border-gray-200 dark:border-[#3a3a3a] flex justify-end gap-3">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button
          onClick={onConfirm}
          disabled={isPending}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
        >
          {isPending ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Deleting...
            </>
          ) : (
            <>
              <Trash2 className="w-4 h-4" />
              Delete File
            </>
          )}
        </button>
      </div>
    </div>
  </div>
);

export default FileLibrary;
