import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { formatPackageFilenameBase } from '../utils/cadFileNaming';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import {
  FileBox,
  Search,
  Zap,
  Cpu,
  Box,
  FileCode,
  Layers,
  Unlink,
  FolderOpen,
} from 'lucide-react';
import { FileTypesView, CategoryView, RenameModal, DeleteModal } from '../components/fileLibrary';
import { routeTypeToFileType } from '../components/fileLibrary/constants';

// View modes
const VIEW_FILE_TYPES = 'fileTypes';
const VIEW_CATEGORY = 'category';

// File type configuration (used for File Types view)
const fileTypes = [
  { id: 'schematic', label: 'Schematic Symbol', icon: Zap, color: 'text-green-500', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  { id: 'footprint', label: 'PCB Footprint', icon: Cpu, color: 'text-blue-500', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  { id: 'pad', label: 'Pad File', icon: Layers, color: 'text-teal-500', bgColor: 'bg-teal-100 dark:bg-teal-900/30' },
  { id: 'step', label: 'STEP 3D Model', icon: Box, color: 'text-purple-500', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
  { id: 'pspice', label: 'PSpice Model', icon: FileCode, color: 'text-orange-500', bgColor: 'bg-orange-100 dark:bg-orange-900/30' },
];

// Map route type IDs to library subdirectory names
const subdirMap = {
  footprint: 'footprint',
  schematic: 'symbol',
  step: 'model',
  pspice: 'pspice',
  pad: 'pad',
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
  const [selectedCISFile, setSelectedCISFile] = useState('');

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
    const viewParam = searchParams.get('view');
    const searchParam = searchParams.get('search');

    if (viewParam === 'category' && searchParam) {
      // Navigate to Category view with a search filter (e.g., from "Files" button in Library)
      setViewMode(VIEW_CATEGORY);
      setSelectedCategoryId(searchParams.get('category') || 'all');
      setSearchQuery(decodeURIComponent(searchParam));
      setSearchParams({}, { replace: true });
    } else if (typeParam) {
      setSelectedType(typeParam);
      setViewMode(VIEW_FILE_TYPES);
      if (fileParam) {
        // Use as search query — file names from Library are base names (no extension)
        // while cad_files store full names with extension, so search provides fuzzy match
        setSearchQuery(decodeURIComponent(fileParam));
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
    staleTime: 5 * 60 * 1000,
  });

  // CIS configuration files
  const { data: cisFilesData } = useQuery({
    queryKey: ['cisFiles'],
    queryFn: async () => {
      const response = await api.getCISFiles();
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // File storage path for copy-path feature
  const { data: storagePathData } = useQuery({
    queryKey: ['fileStoragePath'],
    queryFn: async () => {
      const response = await api.getFileStoragePath();
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Files by type (File Types view)
  const { data: filesData, isLoading: isLoadingFiles } = useQuery({
    queryKey: ['filesByType', selectedType],
    queryFn: async () => {
      const response = await api.getFilesByType(selectedType);
      return response.data;
    },
    enabled: viewMode === VIEW_FILE_TYPES && !!selectedType && !showOrphans,
    staleTime: 5 * 60 * 1000,
  });

  // Orphan files
  const { data: orphanData, isLoading: isLoadingOrphans } = useQuery({
    queryKey: ['orphanFiles', selectedType],
    queryFn: async () => {
      const response = await api.getOrphanFiles(selectedType);
      return response.data;
    },
    enabled: viewMode === VIEW_FILE_TYPES && showOrphans,
    staleTime: 5 * 60 * 1000,
  });

  // Components using selected file (File Types view)
  const { data: componentsData, isLoading: isLoadingComponents } = useQuery({
    queryKey: ['componentsByFile', selectedType, selectedFile],
    queryFn: async () => {
      const response = await api.getComponentsByFile(selectedType, selectedFile);
      return response.data;
    },
    enabled: viewMode === VIEW_FILE_TYPES && !!selectedFile && !!selectedType && !showOrphans,
    staleTime: 5 * 60 * 1000,
  });

  // Search files
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['fileSearch', searchQuery],
    queryFn: async () => {
      const response = await api.searchFiles(searchQuery);
      return response.data;
    },
    enabled: searchQuery.length > 2,
    staleTime: 5 * 60 * 1000,
  });

  // Categories (for Category view)
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await api.getCategories();
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Components in selected category (Category view)
  const { data: categoryComponents, isLoading: isLoadingCategoryComponents } = useQuery({
    queryKey: ['categoryComponentsForFiles', selectedCategoryId],
    queryFn: async () => {
      const response = await api.getComponentsByCategoryForFiles(selectedCategoryId);
      return response.data;
    },
    enabled: viewMode === VIEW_CATEGORY && !!selectedCategoryId,
    staleTime: 5 * 60 * 1000,
  });

  // CAD files for selected component (Category view)
  const { data: componentFiles, isLoading: isLoadingComponentFiles } = useQuery({
    queryKey: ['cadFilesForComponent', selectedComponentId],
    queryFn: async () => {
      const response = await api.getCadFilesForComponent(selectedComponentId);
      return response.data;
    },
    enabled: viewMode === VIEW_CATEGORY && !!selectedComponentId,
    staleTime: 5 * 60 * 1000,
  });

  // Components sharing files with selected component (Category view)
  const { data: sharingData } = useQuery({
    queryKey: ['sharingComponents', selectedComponentId],
    queryFn: async () => {
      const response = await api.getSharingComponents(selectedComponentId);
      return response.data;
    },
    enabled: viewMode === VIEW_CATEGORY && !!selectedComponentId,
    staleTime: 5 * 60 * 1000,
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

  const handleCopyPath = (fileName, typeId) => {
    const basePath = storagePathData?.path || '';
    if (!basePath) {
      showError('Set your file storage path in User Settings first');
      return;
    }
    const subdir = subdirMap[typeId || selectedType] || selectedType;
    const sep = basePath.includes('\\') ? '\\' : '/';
    const fullPath = `${basePath}${sep}${subdir}${sep}${fileName}`;
    navigator.clipboard.writeText(fullPath);
    showSuccess('Path copied');
  };

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
        const formattedPkg = formatPackageFilenameBase(pkg);
        if (!formattedPkg) {
          showError('Package name is empty after formatting');
          return;
        }
        const ext = renameData.oldName.includes('.')
          ? renameData.oldName.substring(renameData.oldName.lastIndexOf('.'))
          : '';
        setRenameData(prev => ({ ...prev, newName: formattedPkg + ext }));
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
          onCopyPath={handleCopyPath}
          canWrite={canWrite}
          navigate={navigate}
          cisFiles={cisFilesData || []}
          selectedCISFile={selectedCISFile}
          onCISFileChange={setSelectedCISFile}
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
          searchQuery={searchQuery}
          onCategoryChange={handleCategoryChange}
          onComponentSelect={handleComponentSelect}
          onOpenRename={handleOpenRename}
          onOpenDelete={handleOpenDelete}
          onCopyPath={handleCopyPath}
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

export default FileLibrary;
