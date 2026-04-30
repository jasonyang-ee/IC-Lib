import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { formatPackageFilenameBase } from '../utils/cadFileNaming';
import {
  getCadFileBaseName,
  groupFootprintFiles,
  isFootprintSecondaryFile,
  normalizeFootprintGroupBase,
} from '../utils/footprintFiles';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { useFeatureFlags } from '../contexts/FeatureFlagsContext';
import {
  FileBox,
  Search,
  Zap,
  Cpu,
  Box,
  FileCode,
  Layers,
  FolderOpen,
} from 'lucide-react';
import {
  FileTypesView,
  CategoryView,
  RenameModal,
  DeleteModal,
  FootprintLinkEditorModal,
} from '../components/fileLibrary';
import { ConfirmationModal } from '../components/common';
import { routeTypeToFileType } from '../components/fileLibrary/constants';
import { canDeleteLibraryFiles as canDeleteLibraryFilesForRole } from '../utils/accessControl';
import { THREE_D_MODEL_LABEL } from '../utils/cadFileTypes';

// View modes
const VIEW_FILE_TYPES = 'fileTypes';
const VIEW_CATEGORY = 'category';

// File type configuration (used for File Types view)
const fileTypes = [
  { id: 'schematic', label: 'Schematic Symbol', icon: Zap, color: 'text-green-500', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  { id: 'footprint', label: 'PCB Footprint', icon: Cpu, color: 'text-blue-500', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  { id: 'pad', label: 'Pad File', icon: Layers, color: 'text-teal-500', bgColor: 'bg-teal-100 dark:bg-teal-900/30' },
  { id: 'step', label: THREE_D_MODEL_LABEL, icon: Box, color: 'text-purple-500', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
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

const selectPreferredCopyFiles = (fileNames, typeId) => {
  const normalizedFileNames = Array.isArray(fileNames) ? fileNames : [fileNames];

  if (typeId !== 'footprint') {
    return normalizedFileNames;
  }

  const draFiles = normalizedFileNames.filter((fileName) => isFootprintSecondaryFile(fileName));
  return draFiles.length > 0 ? draFiles : normalizedFileNames;
};

const getComponentCount = (file) => Number(file?.component_count || 0);

const buildFileEntryKey = (type, fileNames) => {
  const normalizedFileNames = Array.isArray(fileNames) ? fileNames : [fileNames];
  if (type === 'footprint' && normalizedFileNames.length > 1) {
    return `pair:${normalizeFootprintGroupBase(normalizedFileNames[0])}`;
  }

  return `file:${String(normalizedFileNames[0] || '').toLowerCase()}`;
};

const buildSingleFileEntry = (file, selectedType) => ({
  key: buildFileEntryKey(selectedType, file.file_name),
  kind: 'single',
  displayName: file.file_name,
  file_type: file.file_type || routeTypeToFileType[selectedType],
  fileNames: [file.file_name],
  files: [file],
  componentCount: getComponentCount(file),
  canDelete: getComponentCount(file) === 0,
  searchText: file.file_name.toLowerCase(),
});

const buildFootprintEntries = (files) => {
  return groupFootprintFiles(files, (file) => file.file_name)
    .map((item) => {
      if (item.type !== 'pair') {
        return buildSingleFileEntry(item.file, 'footprint');
      }

      const pairFiles = item.files.slice().sort((left, right) => left.file_name.localeCompare(right.file_name, undefined, { sensitivity: 'base' }));
      const groupKey = normalizeFootprintGroupBase(item.primary.file_name);

      return {
        key: `pair:${groupKey}`,
        kind: 'pair',
        displayName: getCadFileBaseName(item.primary.file_name),
        file_type: 'footprint',
        fileNames: pairFiles.map((file) => file.file_name),
        files: pairFiles,
        componentCount: Math.max(...pairFiles.map((file) => getComponentCount(file))),
        canDelete: pairFiles.every((file) => getComponentCount(file) === 0),
        searchText: `${groupKey} ${pairFiles.map((file) => file.file_name.toLowerCase()).join(' ')}`,
      };
    })
    .sort((left, right) => left.displayName.localeCompare(right.displayName, undefined, { sensitivity: 'base' }));
};

const buildFileEntries = (files, selectedType) => {
  if (selectedType === 'footprint') {
    return buildFootprintEntries(files);
  }

  return (files || [])
    .map((file) => buildSingleFileEntry(file, selectedType))
    .sort((left, right) => left.displayName.localeCompare(right.displayName, undefined, { sensitivity: 'base' }));
};

const FileLibrary = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showSuccess, showError } = useNotification();
  const { canWrite, user } = useAuth();
  const { ecoEnabled } = useFeatureFlags();
  const canDeleteFiles = () => canDeleteLibraryFilesForRole(user?.role);

  // --- State ---
  const [viewMode, setViewMode] = useState(VIEW_FILE_TYPES);

  // File Types view state
  const [selectedType, setSelectedType] = useState('footprint');
  const [selectedEntryKey, setSelectedEntryKey] = useState(null);
  const [showOrphans, setShowOrphans] = useState(false);
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedOrphanEntryKeys, setSelectedOrphanEntryKeys] = useState([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [selectedCISFile, setSelectedCISFile] = useState('');

  // Category view state
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [selectedComponentId, setSelectedComponentId] = useState(null);

  // Shared state
  const [searchQuery, setSearchQuery] = useState('');
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameData, setRenameData] = useState({
    mode: 'single',
    oldName: '',
    currentValue: '',
    newName: '',
    fileNames: [],
    files: [],
  });
  const [pendingRenameConfirmation, setPendingRenameConfirmation] = useState(null);
  const [isPreparingRenameConfirmation, setIsPreparingRenameConfirmation] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [footprintLinkEditor, setFootprintLinkEditor] = useState({ show: false, relatedFileType: '' });

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
    refetchOnMount: 'always',
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

  const rawSelectedTypeFiles = useMemo(
    () => (showOrphans ? (orphanData?.orphans || []) : (filesData?.files || [])),
    [filesData?.files, orphanData?.orphans, showOrphans],
  );

  const displayedEntries = useMemo(() => {
    if (selectedType === 'footprint') {
      const footprintEntries = buildFileEntries(rawSelectedTypeFiles, selectedType);
      if (!searchQuery.trim()) {
        return footprintEntries;
      }

      const normalizedSearch = searchQuery.trim().toLowerCase();
      return footprintEntries.filter((entry) => entry.searchText.includes(normalizedSearch));
    }

    const visibleFiles = showOrphans
      ? rawSelectedTypeFiles.filter((file) => !searchQuery.trim() || file.file_name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
      : searchQuery.length > 2 && searchResults?.results
        ? searchResults.results.filter((result) => result.file_type === routeTypeToFileType[selectedType])
        : rawSelectedTypeFiles;

    return buildFileEntries(visibleFiles, selectedType);
  }, [rawSelectedTypeFiles, searchQuery, searchResults?.results, selectedType, showOrphans]);

  const displayedEntryMap = useMemo(
    () => new Map(displayedEntries.map((entry) => [entry.key, entry])),
    [displayedEntries],
  );

  const selectedEntry = selectedEntryKey ? displayedEntryMap.get(selectedEntryKey) || null : null;

  // Components using selected file (File Types view)
  const { data: componentsData, isLoading: isLoadingComponents } = useQuery({
    queryKey: ['componentsByFile', selectedType, selectedEntryKey],
    queryFn: async () => {
      const response = await api.getComponentsByFile(
        selectedType,
        selectedEntry?.fileNames?.[0],
        selectedEntry?.fileNames?.length > 1 ? selectedEntry.fileNames : undefined,
      );
      return response.data;
    },
    enabled: viewMode === VIEW_FILE_TYPES && !!selectedEntry && !!selectedType && !showOrphans,
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

  const physicalRenameMutation = useMutation({
    mutationFn: async ({ type, files, newName, mode }) => {
      if (mode === 'pair') {
        const response = await api.renameFootprintGroup(files.map((file) => file.file_name), newName);
        return response.data;
      }

      const response = await api.renamePhysicalFile(type, {
        oldFileName: files[0].file_name,
        newFileName: newName,
      });
      return response.data;
    },
    onSuccess: (data, variables) => {
      invalidateAll();
      const updatedCount = Number.isFinite(data.updatedCount) ? data.updatedCount : 0;
      if (data.stagedEco) {
        showSuccess(
          `${data.ecoNumber || 'ECO'} created. ${updatedCount} part${updatedCount !== 1 ? 's' : ''} moved to reviewing; the rename will apply after approval.`,
        );
      } else {
        showSuccess(
          variables.mode === 'pair'
            ? `Renamed ${data.renamedFiles?.length || 0} footprint files (${updatedCount} component${updatedCount !== 1 ? 's' : ''} updated)`
            : `Renamed "${variables.files[0].file_name}" to "${data.newFileName}" (${updatedCount} component${updatedCount !== 1 ? 's' : ''} updated)`,
        );
      }
      setShowRenameModal(false);
      if (data.stagedEco) {
        return;
      }
      if (variables.mode === 'pair') {
        setSelectedEntryKey(buildFileEntryKey(variables.type, data.renamedFiles?.map((file) => file.newFileName) || []));
      } else {
        setSelectedEntryKey(buildFileEntryKey(variables.type, data.newFileName));
      }
    },
    onError: (error) => {
      setShowRenameModal(true);
      showError('Failed to rename file: ' + (error.response?.data?.error || error.message));
    },
  });

  // Physical file delete
  const deleteMutation = useMutation({
    mutationFn: async ({ type, fileNames }) => {
      const response = fileNames.length > 1
        ? await api.deleteFileGroup(type, fileNames)
        : await api.deletePhysicalFile(type, { fileName: fileNames[0] });
      return response.data;
    },
    onSuccess: (data, variables) => {
      invalidateAll();
      const updatedCount = Number.isFinite(data.updatedCount) ? data.updatedCount : 0;
      showSuccess(
        variables.fileNames.length > 1
          ? `Deleted ${variables.fileNames.length} files`
          : `Deleted "${variables.fileNames[0]}"${updatedCount > 0 ? ` (removed from ${updatedCount} component${updatedCount !== 1 ? 's' : ''})` : ''}`,
      );
      setShowDeleteModal(false);
      setSelectedEntryKey(null);
      setDeleteTarget(null);
    },
    onError: (error) => {
      showError('Failed to delete file: ' + (error.response?.data?.error || error.message));
    },
  });

  const bulkDeleteOrphansMutation = useMutation({
    mutationFn: async ({ type, fileNames }) => {
      const response = await api.bulkDeleteOrphanFiles(type, fileNames);
      return response.data;
    },
    onSuccess: (data) => {
      invalidateAll();
      showSuccess(`Deleted ${data.deletedCount} orphan file${data.deletedCount !== 1 ? 's' : ''}`);
      setShowBulkDeleteConfirm(false);
      setSelectedOrphanEntryKeys([]);
      setSelectedEntryKey(null);
    },
    onError: (error) => {
      showError('Failed to delete orphan files: ' + (error.response?.data?.error || error.message));
    },
  });

  const linkFootprintRelatedMutation = useMutation({
    mutationFn: async ({ sourceCadFileIds, targetCadFileIds }) => {
      const response = await api.linkFootprintRelatedFiles(sourceCadFileIds, targetCadFileIds);
      return response.data;
    },
  });

  const unlinkFootprintRelatedMutation = useMutation({
    mutationFn: async ({ sourceCadFileIds, targetCadFileIds }) => {
      const response = await api.unlinkFootprintRelatedFiles(sourceCadFileIds, targetCadFileIds);
      return response.data;
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
    queryClient.invalidateQueries({ queryKey: ['available-cad-files'] });
    queryClient.invalidateQueries({ queryKey: ['ecos'] });
  };

  const getTypeCount = (typeId) => {
    if (!stats) return 0;
    return stats[typeId] || 0;
  };
  const linkedPartsFilter = showOrphans ? 'orphans' : 'all';
  const allDisplayedOrphansSelected = displayedEntries.length > 0
    && displayedEntries.every((entry) => selectedOrphanEntryKeys.includes(entry.key));

  const selectedOrphanFileNames = [...new Set(
    selectedOrphanEntryKeys.flatMap((entryKey) => displayedEntryMap.get(entryKey)?.fileNames || []),
  )];

  const isRenameUnchanged = renameData.mode === 'pair'
    ? renameData.newName.trim() === renameData.currentValue
    : renameData.newName === renameData.currentValue;

  useEffect(() => {
    if (!showOrphans) {
      setBulkSelectMode(false);
      setSelectedOrphanEntryKeys([]);
    }
  }, [showOrphans]);

  useEffect(() => {
    if (!bulkSelectMode) {
      setSelectedOrphanEntryKeys([]);
    }
  }, [bulkSelectMode]);

  useEffect(() => {
    setSelectedOrphanEntryKeys((previous) => previous.filter((entryKey) => displayedEntryMap.has(entryKey)));
  }, [displayedEntryMap]);

  useEffect(() => {
    if (selectedEntryKey && !displayedEntryMap.has(selectedEntryKey)) {
      setSelectedEntryKey(null);
    }
  }, [displayedEntryMap, selectedEntryKey]);

  // ==============================
  // HANDLERS
  // ==============================

  const handleCopyPath = (fileNameOrNames, typeId) => {
    const basePath = String(storagePathData?.path || '').trim();
    if (!basePath) {
      showError('Set your file storage path in User Settings first');
      return;
    }
    const resolvedType = typeId || selectedType;
    const subdir = subdirMap[resolvedType] || selectedType;
    const sep = basePath.includes('\\') ? '\\' : '/';
    const fileNames = selectPreferredCopyFiles(fileNameOrNames, resolvedType);
    const fullPath = fileNames.map((fileName) => `${basePath}${sep}${subdir}${sep}${fileName}`).join('\n');

    navigator.clipboard.writeText(fullPath)
      .then(() => {
        showSuccess(fileNames.length > 1 ? 'Paths copied' : 'Path copied');
      })
      .catch(() => {
        showError('Failed to copy file path');
      });
  };

  const handleTypeChange = (typeId) => {
    setSelectedType(typeId);
    setSelectedEntryKey(null);
    setSearchQuery('');
    setSelectedOrphanEntryKeys([]);
  };

  const handleSelectFile = (entryKey) => {
    setSelectedEntryKey(entryKey);
  };

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    setSelectedEntryKey(null);
    setSelectedCategoryId(mode === VIEW_CATEGORY ? 'all' : null);
    setSelectedComponentId(null);
    setSearchQuery('');
    setBulkSelectMode(false);
    setSelectedOrphanEntryKeys([]);
  };

  const handleLinkedPartsFilterChange = (value) => {
    const shouldShowOrphans = value === 'orphans';
    setShowOrphans(shouldShowOrphans);
    setSelectedEntryKey(null);
    if (!shouldShowOrphans) {
      setBulkSelectMode(false);
      setSelectedOrphanEntryKeys([]);
    }
  };

  const handleToggleBulkSelectMode = () => {
    if (!showOrphans || !canDeleteFiles()) {
      return;
    }

    setBulkSelectMode((previous) => !previous);
  };

  const handleToggleOrphanEntrySelection = (entryKey) => {
    setSelectedOrphanEntryKeys((previous) => (
      previous.includes(entryKey)
        ? previous.filter((selectedKey) => selectedKey !== entryKey)
        : [...previous, entryKey]
    ));
  };

  const handleToggleSelectAllDisplayedOrphans = () => {
    if (allDisplayedOrphansSelected) {
      setSelectedOrphanEntryKeys([]);
      return;
    }

    setSelectedOrphanEntryKeys(displayedEntries.map((entry) => entry.key));
  };

  const handleConfirmBulkDelete = () => {
    if (selectedOrphanFileNames.length === 0) {
      return;
    }

    bulkDeleteOrphansMutation.mutate({
      type: selectedType,
      fileNames: selectedOrphanFileNames,
    });
  };

  const handleCategoryChange = (catId) => {
    setSelectedCategoryId(catId);
    setSelectedComponentId(null);
  };

  const handleComponentSelect = (compId) => {
    setSelectedComponentId(compId);
  };

  // --- Rename handlers ---
  const handleOpenRename = (entryOrFileName = selectedEntry, type) => {
    const ft = type || selectedType;

    if (typeof entryOrFileName === 'string') {
      setRenameData({
        mode: 'single',
        oldName: entryOrFileName,
        currentValue: entryOrFileName,
        newName: entryOrFileName,
        fileNames: [entryOrFileName],
        files: [{ file_name: entryOrFileName }],
        type: ft,
      });
      setShowRenameModal(true);
      return;
    }

    const entry = entryOrFileName || selectedEntry;
    if (!entry) {
      return;
    }

    if (entry.kind === 'pair') {
      const currentBaseName = getCadFileBaseName(entry.fileNames[0]);
      setRenameData({
        mode: 'pair',
        oldName: entry.displayName,
        currentValue: currentBaseName,
        newName: currentBaseName,
        fileNames: entry.fileNames,
        files: entry.files,
        type: ft,
      });
      setShowRenameModal(true);
      return;
    }

    setRenameData({
      mode: 'single',
      oldName: entry.fileNames[0],
      currentValue: entry.fileNames[0],
      newName: entry.fileNames[0],
      fileNames: entry.fileNames,
      files: entry.files,
      type: ft,
    });
    setShowRenameModal(true);
  };

  const handleRenameSubmit = () => {
    if (!renameData.newName.trim() || isRenameUnchanged) {
      showError('Please enter a new file name');
      return;
    }

    const type = renameData.type || selectedType;
    const renameRequest = {
      type,
      files: renameData.files,
      newName: renameData.newName.trim(),
      mode: renameData.mode,
    };

    const shouldWarnAboutSharedRenameEco = ecoEnabled && user?.role !== 'admin';
    if (!shouldWarnAboutSharedRenameEco) {
      physicalRenameMutation.mutate(renameRequest);
      return;
    }

    setIsPreparingRenameConfirmation(true);

    api.getComponentsByFile(
      renameRequest.type,
      renameRequest.files[0]?.file_name,
      renameRequest.files.length > 1 ? renameRequest.files.map((file) => file.file_name) : undefined,
    )
      .then((response) => {
        const affectedComponents = Array.isArray(response.data?.components)
          ? response.data.components
          : [];
        const controlledComponents = affectedComponents.filter((component) => component?.approval_status !== 'new');
        const skippedNewComponentCount = affectedComponents.length - controlledComponents.length;

        if (affectedComponents.length > 1 && controlledComponents.length > 0) {
          setPendingRenameConfirmation({
            ...renameRequest,
            affectedComponentCount: affectedComponents.length,
            controlledComponentCount: controlledComponents.length,
            skippedNewComponentCount,
          });
          setShowRenameModal(false);
          return;
        }

        physicalRenameMutation.mutate(renameRequest);
      })
      .catch((error) => {
        showError('Failed to check shared rename impact: ' + (error.response?.data?.error || error.message));
      })
      .finally(() => {
        setIsPreparingRenameConfirmation(false);
      });
  };

  const handleCloseRenameConfirmation = () => {
    setPendingRenameConfirmation(null);
    setShowRenameModal(true);
  };

  const handleConfirmRenameConfirmation = () => {
    if (!pendingRenameConfirmation) {
      return;
    }

    const renameRequest = {
      type: pendingRenameConfirmation.type,
      files: pendingRenameConfirmation.files,
      newName: pendingRenameConfirmation.newName,
      mode: pendingRenameConfirmation.mode,
    };

    setPendingRenameConfirmation(null);
    physicalRenameMutation.mutate(renameRequest);
  };

  const handleUseMPN = () => {
    const components = componentsData?.components;
    if (components && components.length > 0) {
      const mpn = components[0].manufacturer_pn;
      if (mpn) {
        if (renameData.mode === 'pair') {
          setRenameData((previous) => ({ ...previous, newName: mpn }));
          return;
        }

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

        if (renameData.mode === 'pair') {
          setRenameData((previous) => ({ ...previous, newName: formattedPkg }));
          return;
        }

        const ext = renameData.oldName.includes('.')
          ? renameData.oldName.substring(renameData.oldName.lastIndexOf('.'))
          : '';
        setRenameData(prev => ({ ...prev, newName: formattedPkg + ext }));
      }
    }
  };

  // --- Delete handlers ---
  const handleOpenDelete = (entryOrFileName = selectedEntry, type, componentCount) => {
    if (!canDeleteFiles()) {
      return;
    }

    if (typeof entryOrFileName === 'string') {
      setDeleteTarget({
        displayName: entryOrFileName,
        fileName: entryOrFileName,
        fileNames: [entryOrFileName],
        type: type || selectedType,
        componentCount: componentCount ?? componentsData?.components?.length ?? 0,
      });
      setShowDeleteModal(true);
      return;
    }

    const entry = entryOrFileName || selectedEntry;
    if (!entry) {
      return;
    }

    setDeleteTarget({
      displayName: entry.displayName,
      fileName: entry.fileNames[0],
      fileNames: entry.fileNames,
      type: type || selectedType,
      componentCount: entry.componentCount,
    });
    setShowDeleteModal(true);
  };

  const handleDeleteSubmit = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate({
      type: deleteTarget.type,
      fileNames: deleteTarget.fileNames,
    });
  };

  const canManageFootprintRelatedLinks = Boolean(
    selectedEntry
    && !showOrphans
    && user?.role === 'admin'
    && selectedType === 'footprint',
  );

  const handleOpenFootprintLinkEditor = (relatedFileType) => {
    if (!canManageFootprintRelatedLinks) {
      return;
    }

    setFootprintLinkEditor({
      show: true,
      relatedFileType,
    });
  };

  const handleSaveFootprintLinkEditor = async ({ relatedFileType, addFileIds, removeFileIds }) => {
    const sourceCadFileIds = selectedEntry?.files?.map((file) => file.id).filter(Boolean) || [];

    if (sourceCadFileIds.length === 0) {
      showError('Missing CAD file ids for linking');
      return;
    }

    if (addFileIds.length === 0 && removeFileIds.length === 0) {
      setFootprintLinkEditor({ show: false, relatedFileType: '' });
      return;
    }

    const relatedFileLabel = relatedFileType === 'model' ? THREE_D_MODEL_LABEL : 'pad';

    try {
      if (removeFileIds.length > 0) {
        await unlinkFootprintRelatedMutation.mutateAsync({
          sourceCadFileIds,
          targetCadFileIds: removeFileIds,
        });
      }

      if (addFileIds.length > 0) {
        await linkFootprintRelatedMutation.mutateAsync({
          sourceCadFileIds,
          targetCadFileIds: addFileIds,
        });
      }

      setFootprintLinkEditor({ show: false, relatedFileType: '' });
      showSuccess(`Updated footprint ${relatedFileLabel} links`);
    } catch (error) {
      showError(`Failed to update footprint ${relatedFileLabel} links: ${error.response?.data?.error || error.message}`);
    } finally {
      invalidateAll();
    }
  };

  // ==============================
  // RENDER
  // ==============================

  return (
    <div className="h-full flex flex-col">
      {/* Top bar: View mode toggle + Search */}
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
      </div>

      {/* Main content depends on view mode */}
      {viewMode === VIEW_FILE_TYPES ? (
        <FileTypesView
          fileTypes={fileTypes}
          selectedType={selectedType}
          selectedEntry={selectedEntry}
          showOrphans={showOrphans}
          linkedPartsFilter={linkedPartsFilter}
          onLinkedPartsFilterChange={handleLinkedPartsFilterChange}
          bulkSelectMode={bulkSelectMode}
          selectedOrphanEntryKeys={selectedOrphanEntryKeys}
          allDisplayedOrphansSelected={allDisplayedOrphansSelected}
          onToggleBulkSelectMode={handleToggleBulkSelectMode}
          onToggleOrphanEntrySelection={handleToggleOrphanEntrySelection}
          onToggleSelectAllDisplayedOrphans={handleToggleSelectAllDisplayedOrphans}
          onOpenBulkDelete={() => setShowBulkDeleteConfirm(true)}
          isBulkDeletePending={bulkDeleteOrphansMutation.isPending}
          displayedEntries={displayedEntries}
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
          canDeleteFiles={canDeleteFiles}
          navigate={navigate}
          cisFiles={cisFilesData || []}
          selectedCISFile={selectedCISFile}
          onCISFileChange={setSelectedCISFile}
          relatedFileGroups={componentsData?.relatedFileGroups || {}}
          canManageFootprintRelatedLinks={canManageFootprintRelatedLinks}
          onOpenFootprintLinkEditor={handleOpenFootprintLinkEditor}
          isManagingFootprintRelatedLinks={linkFootprintRelatedMutation.isPending || unlinkFootprintRelatedMutation.isPending}
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
          componentsData={componentsData}
          selectedType={renameData.type || selectedType}
          fileTypes={fileTypes}
          onClose={() => setShowRenameModal(false)}
          onSubmit={handleRenameSubmit}
          onUseMPN={handleUseMPN}
          onUsePackage={handleUsePackage}
          isPending={physicalRenameMutation.isPending || isPreparingRenameConfirmation}
          isUnchanged={isRenameUnchanged}
        />
      )}

      <ConfirmationModal
        isOpen={Boolean(pendingRenameConfirmation)}
        onClose={handleCloseRenameConfirmation}
        onConfirm={handleConfirmRenameConfirmation}
        title="Create Shared Rename ECO"
        message={`This shared rename affects ${pendingRenameConfirmation?.affectedComponentCount || 0} parts. Continuing will create one ECO, move ${pendingRenameConfirmation?.controlledComponentCount || 0} controlled part${(pendingRenameConfirmation?.controlledComponentCount || 0) !== 1 ? 's' : ''} to reviewing, and wait for approval before any file names change.${(pendingRenameConfirmation?.skippedNewComponentCount || 0) > 0 ? ` ${(pendingRenameConfirmation?.skippedNewComponentCount || 0)} new part${(pendingRenameConfirmation?.skippedNewComponentCount || 0) !== 1 ? 's' : ''} will stay editable and skip the review status change.` : ''}`}
        confirmText="Create ECO"
        confirmStyle="warning"
        isLoading={physicalRenameMutation.isPending}
      />

      {/* ===== DELETE MODAL ===== */}
      {showDeleteModal && deleteTarget && (
        <DeleteModal
          target={deleteTarget}
          onClose={() => { setShowDeleteModal(false); setDeleteTarget(null); }}
          onConfirm={handleDeleteSubmit}
          isPending={deleteMutation.isPending}
        />
      )}

      <ConfirmationModal
        isOpen={showBulkDeleteConfirm}
        onClose={() => setShowBulkDeleteConfirm(false)}
        onConfirm={handleConfirmBulkDelete}
        title="Delete Selected Orphan Files"
        message={`Delete ${selectedOrphanEntryKeys.length} selected orphan file group${selectedOrphanEntryKeys.length !== 1 ? 's' : ''}? This permanently removes the physical file and its orphan database record.`}
        confirmText="Delete Selected"
        isLoading={bulkDeleteOrphansMutation.isPending}
      />

      <FootprintLinkEditorModal
        isOpen={footprintLinkEditor.show}
        onClose={() => setFootprintLinkEditor({ show: false, relatedFileType: '' })}
        onSave={handleSaveFootprintLinkEditor}
        selectedEntry={selectedEntry}
        relatedFileType={footprintLinkEditor.relatedFileType}
        initialFiles={componentsData?.relatedFileGroups?.[footprintLinkEditor.relatedFileType] || []}
        isSaving={linkFootprintRelatedMutation.isPending || unlinkFootprintRelatedMutation.isPending}
      />
    </div>
  );
};

export default FileLibrary;
