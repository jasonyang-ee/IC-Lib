import { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { buildEcoCadFileChanges } from '../utils/ecoCadUtils';
import { parsePartNumber, formatPartNumber, mapVendorSpecifications, copyToClipboard } from '../utils/libraryUtils';
import { DeleteConfirmationModal, PromoteConfirmationModal, CategoryChangeModal, WarningModal, AddToProjectModal, AutoFillToast, VendorMappingModal } from '../components/library/LibraryModals';
import VendorDataPanel from '../components/library/VendorDataPanel';
import SpecificationsEditor from '../components/library/SpecificationsEditor';
import AlternativePartsEditor from '../components/library/AlternativePartsEditor';
import SpecificationsView from '../components/library/SpecificationsView';
import FileConflictModal from '../components/library/FileConflictModal';
import { ComponentEditForm, ComponentDetailView, DistributorInfoSection } from '../components/library';
import { Search, Edit, Trash2, Plus, X, Check, Package, ChevronLeft, ChevronRight, FileEdit, ExternalLink, FolderOpen, Layers } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFeatureFlags } from '../contexts/FeatureFlagsContext';
import { useNotification } from '../contexts/NotificationContext';
import { useVirtualizer } from '@tanstack/react-virtual';

const DISTRIBUTOR_ORDER = ['Digikey', 'Mouser', 'Arrow', 'Newark'];

/**
 * Normalize distributor rows to always have 4 entries in standard order,
 * merging any existing data from the component's saved distributors.
 */
function normalizeDistributors(existingDistributors = [], allDistributors) {
  return DISTRIBUTOR_ORDER.map(distName => {
    const dist = allDistributors?.find(d => d.name === distName);
    const existing = existingDistributors?.find(d => {
      if (!d || !d.distributor_id) return false;
      const existingDistName = allDistributors?.find(distObj => distObj.id === d.distributor_id)?.name;
      return existingDistName === distName;
    });
    return {
      distributor_id: dist?.id || null,
      distributor_name: distName,
      sku: existing?.sku || '',
      url: existing?.url || '',
    };
  });
}

/**
 * Build the 4-slot distributor edit rows by merging a component's saved distributors
 * with the standard defaults.
 */
function buildEditDistributors(componentDistributors = [], allDistributors) {
  const existingDistMap = new Map();
  componentDistributors.forEach(dist => {
    if (dist.distributor_name) existingDistMap.set(dist.distributor_name, dist);
  });
  return DISTRIBUTOR_ORDER.map(name => {
    const existing = existingDistMap.get(name);
    const dist = allDistributors?.find(d => d.name === name);
    return {
      id: existing?.id || undefined,
      distributor_id: dist?.id || '',
      distributor_name: name,
      sku: existing?.sku || '',
      url: existing?.url || '',
      in_stock: existing?.in_stock || false,
      stock_quantity: existing?.stock_quantity || 0,
      price_breaks: existing?.price_breaks || [],
    };
  });
}

const normalizeEcoFieldValue = (value) => {
  if (Array.isArray(value)) {
    return value.join(',');
  }

  return String(value ?? '');
};

// Component Library - Fixed 3-Column Layout
const Library = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canWrite, canApprove, user } = useAuth();
  const { ecoEnabled: isECOEnabled } = useFeatureFlags();
  const { showSuccess, showError, showInfo } = useNotification();
  
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedApprovalStatus, setSelectedApprovalStatus] = useState('');
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAddMode, setIsAddMode] = useState(false);
  const [isECOMode, setIsECOMode] = useState(false); // New state for ECO edit mode
  const [editData, setEditData] = useState({});
  const [bulkDeleteMode, setBulkDeleteMode] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState(new Set());
  const [deleteConfirmation, setDeleteConfirmation] = useState({ show: false, type: '', count: 0, componentName: '' });
  const [warningModal, setWarningModal] = useState({ show: false, message: '' });
  const [promoteConfirmation, setPromoteConfirmation] = useState({ show: false, altIndex: null, altData: null, currentData: null });
  const [categoryChangeConfirmation, setCategoryChangeConfirmation] = useState({ show: false, newCategoryId: null, newCategoryName: '' });
  const [sortBy, setSortBy] = useState('part_number');
  const [sortOrder, setSortOrder] = useState('asc');
  const [copiedText, setCopiedText] = useState('');
  const [autoFillToast, setAutoFillToast] = useState({ show: false, message: '', count: 0 });
  
  // ECO state
  const [_ecoChanges, setEcoChanges] = useState([]);
  const [ecoNotes, setEcoNotes] = useState('');
  const [ecoStatusProposal, setEcoStatusProposal] = useState(null); // { old_value, new_value }
  const [lastRejectedECO, setLastRejectedECO] = useState(null);
  const [parentEcoId, setParentEcoId] = useState(null);
  const [retryEcoNumber, setRetryEcoNumber] = useState(null);

  // Temp file tracking for buffered uploads (finalize on save, cleanup on cancel)
  const [tempFiles, setTempFiles] = useState([]);

  // File conflict modal state (save-time collision resolution)
  const [fileConflictModal, setFileConflictModal] = useState({ show: false, conflicts: [] });
  const pendingSaveCallback = useRef(null);
  const resolvedConflicts = useRef(null); // Pre-resolved conflict resolutions from modal

  // Soft-deleted file tracking (confirm-delete on save, restore on cancel)
  const [deletedFiles, setDeletedFiles] = useState([]);
  const [ecoCadStagedFiles, setEcoCadStagedFiles] = useState([]);
  
  // Sub-category suggestions and dropdown states
  const [subCat1Suggestions, setSubCat1Suggestions] = useState([]);
  const [subCat2Suggestions, setSubCat2Suggestions] = useState([]);
  const [subCat3Suggestions, setSubCat3Suggestions] = useState([]);
  const [subCat4Suggestions, setSubCat4Suggestions] = useState([]);
  const [subCat1Open, setSubCat1Open] = useState(false);
  const [subCat2Open, setSubCat2Open] = useState(false);
  const [subCat3Open, setSubCat3Open] = useState(false);
  const [subCat4Open, setSubCat4Open] = useState(false);
  const subCat1Ref = useRef(null);
  const subCat2Ref = useRef(null);
  const subCat3Ref = useRef(null);
  const subCat4Ref = useRef(null);
  
  // Package suggestions and dropdown states
  const [packageSuggestions, setPackageSuggestions] = useState([]);
  const [packageOpen, setPackageOpen] = useState(false);

  const trackEcoCadAddedFile = ({ category, filename }) => {
    setEcoCadStagedFiles(prev => {
      if (prev.some(file => file.category === category && file.filename === filename)) {
        return prev;
      }

      return [...prev, { category, filename }];
    });
  };

  const trackEcoCadRemovedFile = ({ category, filename }) => {
    setEcoCadStagedFiles(prev => prev.filter(file => !(file.category === category && file.filename === filename)));
  };

  const trackEcoCadRenamedFile = ({ category, oldFilename, newFilename }) => {
    setEcoCadStagedFiles(prev => {
      const withoutOld = prev.filter(file => !(file.category === category && file.filename === oldFilename));
      if (withoutOld.some(file => file.category === category && file.filename === newFilename)) {
        return withoutOld;
      }
      return [...withoutOld, { category, filename: newFilename }];
    });
  };

  const restoreSoftDeletedFiles = async (mfgPartNumber) => {
    if (deletedFiles.length === 0) return;

    await api.restoreDeletedFiles(deletedFiles.map(file => ({
      tempFilename: file.tempFilename,
      category: file.category,
      filename: file.filename,
      mfgPartNumber,
    })));
    setDeletedFiles([]);
  };

  const finalizeEcoCadUploads = async () => {
    if (tempFiles.length === 0) return true;

    const preResolved = resolvedConflicts.current;
    resolvedConflicts.current = null;

    if (!preResolved) {
      const collisionResponse = await api.checkCollisionsBatch(tempFiles);
      const collisions = collisionResponse.data?.collisions || [];
      if (collisions.length > 0) {
        pendingSaveCallback.current = 'handleSubmitECO';
        setFileConflictModal({ show: true, conflicts: collisions });
        return false;
      }
    }

    const collisionSet = preResolved
      ? new Map(preResolved.map(resolution => [resolution.tempFilename, resolution.resolution]))
      : null;

    if (collisionSet && [...collisionSet.values()].includes('overwrite')) {
      showError('Overwriting existing library files is not supported in ECO mode. Rename the upload or use the existing library file instead.');
      return false;
    }

    const response = await api.finalizeTempFiles({
      files: tempFiles.map(file => ({
        tempFilename: file.tempFilename,
        category: file.category,
        resolution: collisionSet?.get(file.tempFilename),
      })),
    });

    const failedFiles = (response.data?.results || []).filter(result => result.error);
    if (failedFiles.length > 0) {
      throw new Error(failedFiles.map(file => `${file.filename}: ${file.error}`).join(', '));
    }

    setTempFiles([]);
    return true;
  };
  const packageRef = useRef(null);

  // Manufacturer state
  const [manufacturerInput, setManufacturerInput] = useState('');
  const [manufacturerOpen, setManufacturerOpen] = useState(false);
  const manufacturerRef = useRef(null);
  
  // Alternative manufacturer state (for each alternative part)
  const [altManufacturerInputs, setAltManufacturerInputs] = useState({});
  const [altManufacturerOpen, setAltManufacturerOpen] = useState({});
  const altManufacturerRefs = useRef({});
  
  // Alternative parts state
  const [selectedAlternative, setSelectedAlternative] = useState(null);
  const [alternatives, setAlternatives] = useState([]);
  
  // Add to Project modal state
  const [showAddToProjectModal, setShowAddToProjectModal] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [projectQuantity, setProjectQuantity] = useState(1);
  
  // Approval status state
  const [updatingApproval, setUpdatingApproval] = useState(false);
  
  // Quick-add mapping state
  const [mappingModal, setMappingModal] = useState({ 
    show: false, 
    specIndex: null, 
    spec: null, 
    newMapping: '',
    newSpecName: '',
    newSpecUnit: ''
  });

  // Search input ref for auto-focus
  const searchInputRef = useRef(null);

  // Debounced search for query optimization (avoids API call per keystroke)
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Ref for virtualizing the component list
  const componentListRef = useRef(null);

  // Ref to track editing mode — immune to stale closures in useEffect
  // This prevents window-focus-triggered query refetches from resetting add/edit state
  const isEditingRef = useRef(false);
  isEditingRef.current = isAddMode || isEditMode;

  // Ref to track whether vendorData from location.state has been processed
  // Prevents re-processing when distributors/manufacturers queries refetch
  const vendorDataProcessedRef = useRef(false);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (subCat1Ref.current && !subCat1Ref.current.contains(event.target)) {
        setSubCat1Open(false);
      }
      if (subCat2Ref.current && !subCat2Ref.current.contains(event.target)) {
        setSubCat2Open(false);
      }
      if (subCat3Ref.current && !subCat3Ref.current.contains(event.target)) {
        setSubCat3Open(false);
      }
      if (subCat4Ref.current && !subCat4Ref.current.contains(event.target)) {
        setSubCat4Open(false);
      }
      if (packageRef.current && !packageRef.current.contains(event.target)) {
        setPackageOpen(false);
      }
      if (manufacturerRef.current && !manufacturerRef.current.contains(event.target)) {
        setManufacturerOpen(false);
      }
      // Close alternative manufacturer dropdowns
      Object.keys(altManufacturerRefs.current).forEach(key => {
        if (altManufacturerRefs.current[key] && !altManufacturerRefs.current[key].contains(event.target)) {
          setAltManufacturerOpen(prev => ({ ...prev, [key]: false }));
        }
      });
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Copy to clipboard handler using imported utility
  const handleCopyToClipboard = (text, label) => {
    copyToClipboard(
      text,
      () => { setCopiedText(label); setTimeout(() => setCopiedText(''), 2000); },
      (msg) => alert(msg)
    );
  };

  // Navigate to Inventory with component UUID pre-filled in search
  const jumpToInventory = (componentId) => {
    navigate('/inventory', { state: { searchUuid: componentId } });
  };

  // Navigate to previous part number
  const handlePreviousPart = () => {
    const parsed = parsePartNumber(searchTerm);
    if (!parsed || parsed.number <= 1) return;
    const newPartNumber = formatPartNumber(parsed.prefix, parsed.number - 1, parsed.leadingZeros);
    setSearchTerm(newPartNumber);
    // Keep focus on search input and select text
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
        searchInputRef.current.select();
      }
    }, 100);
  };

  // Navigate to next part number
  const handleNextPart = () => {
    const parsed = parsePartNumber(searchTerm);
    if (!parsed) return;
    const newPartNumber = formatPartNumber(parsed.prefix, parsed.number + 1, parsed.leadingZeros);
    setSearchTerm(newPartNumber);
    // Keep focus on search input and select text
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
        searchInputRef.current.select();
      }
    }, 100);
  };

  // Handle adding component to project
  const handleAddToProject = async () => {
    if (!selectedProjectId || !selectedComponent) {
      setWarningModal({ show: true, message: 'Please select a project' });
      return;
    }
    
    if (!projectQuantity || projectQuantity <= 0) {
      setWarningModal({ show: true, message: 'Please enter a valid quantity' });
      return;
    }
    
    try {
      await api.addComponentToProject(selectedProjectId, {
        component_id: selectedComponent.id,
        quantity: parseInt(projectQuantity)
      });
      
      // Close modal and reset state
      setShowAddToProjectModal(false);
      setSelectedProjectId('');
      setProjectQuantity(1);
      
      // Navigate back to component view (close detail view)
      setSelectedComponent(null);
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message;
      
      // Check if it's a duplicate error
      if (error.response?.status === 409 || errorMessage.toLowerCase().includes('duplicate') || errorMessage.toLowerCase().includes('already exists')) {
        setWarningModal({ 
          show: true, 
          message: `This component is already in the selected project. Please update the quantity from the Projects page instead.` 
        });
      } else if (errorMessage.toLowerCase().includes('unique constraint') || errorMessage.toLowerCase().includes('violates')) {
        setWarningModal({ 
          show: true, 
          message: `This component is already in the selected project. Please update the quantity from the Projects page instead.` 
        });
      } else {
        setWarningModal({ 
          show: true, 
          message: `Error adding to project: ${errorMessage}` 
        });
      }
    }
  };

  // Handle approval action (approve, archive, send_to_review, send_to_prototype)
  const handleApprovalAction = async (action) => {
    if (!selectedComponent || !user) return;
    
    setUpdatingApproval(true);
    try {
      const response = await api.updateComponentApproval(selectedComponent.id, action, user.id);
      
      // Update local state with response data
      setSelectedComponent(prev => ({
        ...prev,
        approval_status: response.data.approval_status,
        approval_user_id: response.data.approval_user_id,
        approval_username: response.data.approval_username,
        approval_date: response.data.approval_date,
        part_status: response.data.part_status // This will be auto-updated by backend
      }));
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries(['components']);
      queryClient.invalidateQueries(['componentDetails', selectedComponent.id]);
    } catch (error) {
      console.error('Error updating approval status:', error);
      setWarningModal({ 
        show: true, 
        message: `Error updating approval status: ${error.response?.data?.error || error.message}` 
      });
    } finally {
      setUpdatingApproval(false);
    }
  };

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await api.getCategories();
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch components
  const { data: components, isLoading } = useQuery({
    queryKey: ['components', selectedCategory, debouncedSearch, selectedApprovalStatus],
    queryFn: async () => {
      const response = await api.getComponents({
        category: selectedCategory,
        search: debouncedSearch,
        approvalStatus: selectedApprovalStatus,
      });
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch manufacturers for dropdown
  const { data: manufacturers } = useQuery({
    queryKey: ['manufacturers'],
    queryFn: async () => {
      const response = await api.getManufacturers();
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch projects for "Add to Project" modal
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await api.getProjects();
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch distributors for dropdown and ID mapping
  const { data: distributors } = useQuery({
    queryKey: ['distributors'],
    queryFn: async () => {
      const response = await api.getDistributors();
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Auto-focus search field on page load
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.select();
    }
  }, []);

  // Handle URL query parameters (e.g., ?part=IC-00001)
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const partParam = searchParams.get('part');
    
    if (partParam) {
      setSearchTerm(partParam);
      // Clear the query parameter from URL without reload
      navigate(location.pathname, { replace: true });
      // Select text after setting search term
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.select();
        }
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, navigate]);

  // Handle incoming search term from Inventory page
  useEffect(() => {
    if (location.state?.searchUuid) {
      const uuidToSearch = location.state.searchUuid;
      setSearchTerm(uuidToSearch);
      // Clear the state to prevent re-searching on subsequent renders
      window.history.replaceState({}, document.title);
      // Select text after setting search term
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.select();
        }
      }, 0);
    } else if (location.state?.searchTerm) {
      const termToSearch = location.state.searchTerm;
      setSearchTerm(termToSearch);
      // Clear the state to prevent re-searching on subsequent renders
      window.history.replaceState({}, document.title);
      // Select text after setting search term
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.select();
        }
      }, 0);
    }
  }, [location.state]);

  // Auto-select component when searching from Inventory
  useEffect(() => {
    if (isEditingRef.current) return; // Use ref — immune to stale closures
    if ((location.state?.searchUuid || location.state?.searchTerm) && components && components.length > 0) {
      // Select the first matching component
      setSelectedComponent(components[0]);
      setIsEditMode(false);
      setIsAddMode(false);
    }
  }, [components, location.state, isAddMode, isEditMode]);

  // Auto-select component when using Previous/Next navigation
  useEffect(() => {
    if (isEditingRef.current) return; // Use ref — immune to stale closures
    // Only trigger if we have components and a valid part number format in search
    if (components && components.length > 0 && searchTerm && parsePartNumber(searchTerm)) {
      // Check if the search term exactly matches a component's part number
      const matchingComponent = components.find(c => c.part_number === searchTerm);
      if (matchingComponent && matchingComponent.id !== selectedComponent?.id) {
        setSelectedComponent(matchingComponent);
        setIsEditMode(false);
        setIsAddMode(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, components]);

  // Handle refresh requests from vendor search (after appending distributors or alternatives)
  useEffect(() => {
    if (selectedComponent && (location.state?.refreshDistributors || location.state?.refreshAlternatives)) {
      // Invalidate queries to force refetch
      if (location.state.refreshDistributors) {
        queryClient.invalidateQueries(['componentDetails', selectedComponent.id]);
      }
      if (location.state.refreshAlternatives) {
        queryClient.invalidateQueries(['componentAlternatives', selectedComponent.id]);
      }
      // Clear the state to prevent re-fetching on subsequent renders
      window.history.replaceState({}, document.title);
    }
  }, [selectedComponent, location.state, queryClient]);

  // Handle incoming vendor data from vendor search
  useEffect(() => {
    // Guard: only process vendor data once per navigation
    if (vendorDataProcessedRef.current) return;
    if (location.state?.vendorData && distributors && manufacturers) {
      vendorDataProcessedRef.current = true; // Mark as processed BEFORE async work
      const vendorData = location.state.vendorData;
      
      // Extract Package/Case from specifications
      let packageFromSpecs = vendorData.packageType || '';
      if (vendorData.specifications) {
        // Look for "Package / Case" parameter
        const packageSpec = Object.entries(vendorData.specifications).find(
          ([key]) => key === 'Package / Case' || key === 'Package'
        );
        if (packageSpec && packageSpec[1]?.value) {
          packageFromSpecs = packageSpec[1].value;
        } else if (typeof vendorData.specifications['Package / Case'] === 'string') {
          packageFromSpecs = vendorData.specifications['Package / Case'];
        }
      }
      
      // Activate add mode
      setIsAddMode(true);
      setIsEditMode(false);
      setSelectedComponent(null);
      
      // Process distributors - handle both new array format and legacy single distributor
      let distributorsList = [];
      
      if (vendorData.distributors && Array.isArray(vendorData.distributors) && vendorData.distributors.length > 0) {
        // New format: multiple distributors
        distributorsList = vendorData.distributors.map(dist => ({
          distributor_id: dist.id || '',
          distributor_name: dist.source === 'digikey' ? 'Digikey' : 'Mouser',
          sku: dist.sku || '',
          url: dist.url || '',
          in_stock: (dist.stock || 0) > 0,
          stock_quantity: dist.stock || 0,
          minimum_order_quantity: dist.minimumOrderQuantity || 1,
          price_breaks: dist.pricing || []
        }));
      } else if (vendorData.distributor) {
        // Legacy format: single distributor (backward compatibility)
        distributorsList = [{
          distributor_id: vendorData.distributor.id || '',
          distributor_name: vendorData.distributor.source === 'digikey' ? 'Digikey' : 'Mouser',
          sku: vendorData.distributor.sku || '',
          url: vendorData.distributor.url || '',
          in_stock: (vendorData.distributor.stock || 0) > 0,
          stock_quantity: vendorData.distributor.stock || 0,
          minimum_order_quantity: vendorData.distributor.minimumOrderQuantity || 1,
          price_breaks: vendorData.distributor.pricing || []
        }];
      }
      
      // Pre-fill edit data with vendor information
      const preparedData = {
        category_id: '',
        manufacturer_id: vendorData.manufacturerId || '',
        manufacturer_pn: vendorData.manufacturerPartNumber || '',
        description: vendorData.description || '',
        package_size: packageFromSpecs || vendorData.packageType || '',
        datasheet_url: vendorData.datasheet || '',
        notes: vendorData.series ? `Series: ${vendorData.series}` : '',
        // Value field - will be set based on category after category selection
        value: vendorData.manufacturerPartNumber || '', // Default to manufacturer part number
        // Distributor info - now supports multiple distributors
        distributors: distributorsList,
        // Specifications from vendor
        vendorSpecifications: vendorData.specifications || {},
        // Store complete vendor data for display in details panel
        _vendorSearchData: {
          source: vendorData.distributors?.[0]?.source || vendorData.distributor?.source || 'vendor',
          manufacturerPartNumber: vendorData.manufacturerPartNumber,
          manufacturer: vendorData.manufacturerName,
          description: vendorData.description,
          datasheet: vendorData.datasheet,
          packageType: packageFromSpecs || vendorData.packageType,
          series: vendorData.series,
          category: vendorData.category,
          specifications: vendorData.specifications || {},
          distributor: vendorData.distributor, // Legacy
          distributors: vendorData.distributors // New format
        }
      };
      
      setEditData(preparedData);
      
      // Update manufacturer input field to show the manufacturer name (Issue #2)
      if (vendorData.manufacturerName) {
        setManufacturerInput(vendorData.manufacturerName);
      }
      
      // Clear location state to prevent re-triggering
      window.history.replaceState({}, document.title);
    }
  }, [location.state, distributors, manufacturers]);

  // Reset vendorDataProcessedRef when location.state no longer has vendorData
  // This allows the next vendor search navigation to properly process new data
  useEffect(() => {
    if (!location.state?.vendorData) {
      vendorDataProcessedRef.current = false;
    }
  }, [location.state]);

  // Fetch component details with specifications
  const { data: componentDetails } = useQuery({
    queryKey: ['componentDetails', selectedComponent?.id],
    enabled: !!selectedComponent && !isAddMode,
    queryFn: async () => {
      const [details, specifications, distributors, cadFiles] = await Promise.all([
        api.getComponentById(selectedComponent.id),
        api.getComponentSpecifications(selectedComponent.id),
        api.getComponentDistributors(selectedComponent.id),
        api.getCadFilesForComponent(selectedComponent.id),
      ]);
      return {
        ...details.data,
        specifications: specifications.data,
        distributors: distributors.data,
        cadFilesLinked: cadFiles.data?.files || {},
      };
    },
  });

  // Fetch alternatives for the selected component
  const { data: alternativesData } = useQuery({
    queryKey: ['componentAlternatives', selectedComponent?.id],
    enabled: !!selectedComponent && !isAddMode, // Enable in view mode and edit mode
    queryFn: async () => {
      const response = await api.getComponentAlternatives(selectedComponent.id);
      return response.data;
    },
  });

  // Update alternatives and selected alternative when data changes
  // Include the primary component from components table as the first alternative
  useEffect(() => {
    if (selectedComponent && !isAddMode) {
      // Create primary alternative from component data
      const primaryAlternative = {
        id: 'primary',
        is_primary: true,
        part_number: selectedComponent.part_number,
        manufacturer_id: selectedComponent.manufacturer_id,
        manufacturer_name: selectedComponent.manufacturer_name,
        manufacturer_pn: selectedComponent.manufacturer_pn || selectedComponent.manufacturer_part_number,
        distributors: componentDetails?.distributors || [] // Fixed: use distributors not distributor_info
      };
      
      // Combine primary with alternatives from components_alternative table
      const allAlternatives = [primaryAlternative, ...(alternativesData || [])];
      setAlternatives(allAlternatives);
      setSelectedAlternative(primaryAlternative); // Always default to primary
      
      // If in edit mode, populate editData.alternatives (excluding primary) with normalized distributors
      if (isEditMode && alternativesData && alternativesData.length > 0) {
        setEditData(prev => ({
          ...prev,
          alternatives: alternativesData.map(alt => ({
            id: alt.id,
            manufacturer_id: alt.manufacturer_id,
            manufacturer_pn: alt.manufacturer_pn,
            distributors: normalizeDistributors(alt.distributors, distributors)
          }))
        }));
      }
    } else if (isEditMode && !alternativesData) {
      setAlternatives([]);
      setSelectedAlternative(null);
      
      // If in edit mode and no alternatives, initialize empty array
      setEditData(prev => ({
        ...prev,
        alternatives: []
      }));
    }
  }, [alternativesData, selectedComponent, componentDetails, isAddMode, isEditMode, distributors]);

  // Add mutation
  const addMutation = useMutation({
    mutationFn: async (data) => {
      // Simply create the component
      // Distributor info and specifications will be added separately by handleSaveAdd
      return await api.createComponent(data);
    },
    // Note: cleanup (invalidation, state reset) happens at the end of handleSaveAdd,
    // not here — onSuccess fires before the rest of the save handler completes.
  });

  // Delete mutation - now supports bulk delete
  const deleteMutation = useMutation({
    mutationFn: async (ids) => {
      if (Array.isArray(ids)) {
        // Bulk delete
        await Promise.all(ids.map(id => api.deleteComponent(id)));
      } else {
        // Single delete
        await api.deleteComponent(ids);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['components']);
      setSelectedComponent(null);
      setBulkDeleteMode(false);
      setSelectedForDelete(new Set());
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.updateComponent(id, data),
    // Note: cleanup (invalidation, state reset) happens at the end of handleSave,
    // not here — onSuccess fires before the rest of the save handler completes
    // (specs, distributors, alternatives still pending).
  });

  // Create manufacturer mutation
  const createManufacturerMutation = useMutation({
    mutationFn: (data) => api.createManufacturer(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['manufacturers']);
    },
  });

  const handleEdit = async () => {
    // IMPORTANT: Set editData FIRST before setting edit mode to avoid race condition
    // where the form renders before editData is populated
    
    // Set manufacturer input for type-ahead
    const manufacturerName = manufacturers?.find(m => m.id === componentDetails?.manufacturer_id)?.name || '';
    setManufacturerInput(manufacturerName);
    
    // Initialize altManufacturerInputs for alternatives BEFORE entering edit mode
    if (alternativesData && alternativesData.length > 0) {
      const altMfrInputs = {};
      alternativesData.forEach((alt, index) => {
        const mfrName = manufacturers?.find(m => m.id === alt.manufacturer_id)?.name || '';
        altMfrInputs[index] = mfrName;
      });
      setAltManufacturerInputs(altMfrInputs);
    } else {
      setAltManufacturerInputs({});
    }
    

    // Auto-search Digikey SKU if available (non-blocking — loads in background)
    const digikeyDist = componentDetails?.distributors?.find(d =>
      d.distributor_name?.toLowerCase() === 'digikey'
    );
    if (digikeyDist?.sku) {
      // Fire async vendor search without awaiting — updates editData when ready
      api.searchAllVendors(digikeyDist.sku).then(searchResponse => {
        if (searchResponse.data) {
          const digikeyResult = searchResponse.data.digikey?.results?.[0];
          if (digikeyResult) {
            const vendorData = {
              source: 'digikey',
              manufacturerPartNumber: digikeyResult.manufacturerPartNumber,
              manufacturer: digikeyResult.manufacturer,
              description: digikeyResult.description,
              datasheet: digikeyResult.datasheet,
              packageType: digikeyResult.packageType,
              series: digikeyResult.series,
              category: digikeyResult.category,
              specifications: digikeyResult.specifications || {},
              distributor: {
                source: 'digikey',
                sku: digikeyResult.partNumber,
                pricing: digikeyResult.pricing,
                stock: digikeyResult.stock,
                productUrl: digikeyResult.productUrl,
                minimumOrderQuantity: digikeyResult.minimumOrderQuantity
              }
            };
            setEditData(prev => ({ ...prev, _vendorSearchData: vendorData }));
          }
        }
      }).catch(() => {
        // Silent fail - this is just a convenience feature
      });
    }
    
    // Load sub-category suggestions based on existing values
    if (componentDetails?.category_id) {
      try {
        // Load sub-category 1 suggestions
        const sub1 = await api.getSubCategorySuggestions(componentDetails.category_id, 1);
        setSubCat1Suggestions(sub1.data || []);
        
        // Load sub-category 2 suggestions if sub-category 1 exists
        if (componentDetails.sub_category1) {
          const sub2 = await api.getSubCategorySuggestions(componentDetails.category_id, 2, { 
            subCat1: componentDetails.sub_category1 
          });
          setSubCat2Suggestions(sub2.data || []);
        }
        
        // Load sub-category 3 suggestions if sub-category 2 exists
        if (componentDetails.sub_category1 && componentDetails.sub_category2) {
          const sub3 = await api.getSubCategorySuggestions(componentDetails.category_id, 3, { 
            subCat1: componentDetails.sub_category1,
            subCat2: componentDetails.sub_category2
          });
          setSubCat3Suggestions(sub3.data || []);
        }
        
        // Load sub-category 4 suggestions if sub-category 3 exists
        if (componentDetails.sub_category1 && componentDetails.sub_category2 && componentDetails.sub_category3) {
          const sub4 = await api.getSubCategorySuggestions(componentDetails.category_id, 4, { 
            subCat1: componentDetails.sub_category1,
            subCat2: componentDetails.sub_category2,
            subCat3: componentDetails.sub_category3
          });
          setSubCat4Suggestions(sub4.data || []);
        }
        
        // Load package suggestions
        const packageResp = await api.getFieldSuggestions(componentDetails.category_id, 'package_size');
        setPackageSuggestions(packageResp.data || []);
      } catch (error) {
        console.error('Error loading sub-category suggestions:', error);
      }
    }
    
    // Always show all 4 supported distributors in edit mode
    const editDistributors = buildEditDistributors(componentDetails?.distributors || [], distributors);

    // Fetch all category specifications and merge with existing component specifications
    let editSpecifications = componentDetails?.specifications || [];
    if (componentDetails?.category_id) {
      try {
        const categorySpecsResponse = await api.getCategorySpecifications(componentDetails.category_id);
        const categorySpecs = categorySpecsResponse.data || [];
        
        // Create a map of existing specs by category_spec_id
        const existingSpecsMap = new Map();
        editSpecifications.forEach(spec => {
          if (spec.category_spec_id) {
            existingSpecsMap.set(spec.category_spec_id, spec);
          }
        });
        
        // Merge: use existing values if available, otherwise create empty spec entries
        editSpecifications = categorySpecs.map(catSpec => {
          const existing = existingSpecsMap.get(catSpec.id);
          return {
            category_spec_id: catSpec.id,
            spec_name: catSpec.spec_name,
            spec_value: existing?.spec_value || '',
            unit: catSpec.unit || '',
            mapping_spec_names: catSpec.mapping_spec_names || [],
            is_required: catSpec.is_required || false,
            display_order: catSpec.display_order || 0
          };
        });
        
        // Sort by display_order
        editSpecifications.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      } catch (error) {
        console.error('Error fetching category specifications:', error);
        // Fall back to existing specifications if fetch fails
      }
    }
    
    // Map all fields properly for editing, including alternatives
    setEditData({
      ...componentDetails,
      manufacturer_id: componentDetails?.manufacturer_id || '',
      manufacturer_pn: componentDetails?.manufacturer_pn || componentDetails?.manufacturer_part_number || '',
      manufacturer_part_number: componentDetails?.manufacturer_pn || componentDetails?.manufacturer_part_number || '',
      // Ensure CAD fields are arrays (JSONB from server)
      pcb_footprint: Array.isArray(componentDetails?.pcb_footprint) ? componentDetails.pcb_footprint : [],
      schematic: Array.isArray(componentDetails?.schematic) ? componentDetails.schematic : [],
      step_model: Array.isArray(componentDetails?.step_model) ? componentDetails.step_model : [],
      pspice: Array.isArray(componentDetails?.pspice) ? componentDetails.pspice : [],
      pad_file: Array.isArray(componentDetails?.pad_file) ? componentDetails.pad_file : [],
      specifications: editSpecifications,
      distributors: editDistributors,
      alternatives: alternativesData && alternativesData.length > 0
        ? alternativesData.map(alt => ({
            id: alt.id,
            manufacturer_id: alt.manufacturer_id,
            manufacturer_pn: alt.manufacturer_pn,
            distributors: normalizeDistributors(alt.distributors, distributors)
          }))
        : [],
      // Vendor data loads asynchronously via setEditData update
      _vendorSearchData: null
    });
    
    // NOW set edit mode - after editData is fully populated
    // This prevents the form from rendering with empty data
    setIsEditMode(true);
    setIsAddMode(false);
  };

  /**
   * Finalize temp files and confirm soft-deletes.
   * Returns false if interrupted by conflict resolution modal (caller should return early).
   */
  const finalizeFiles = async (callerName) => {
    if (tempFiles.length > 0) {
      const preResolved = resolvedConflicts.current;
      resolvedConflicts.current = null;

      if (!preResolved) {
        const collisionResponse = await api.checkCollisionsBatch(tempFiles);
        const collisions = collisionResponse.data?.collisions || [];
        if (collisions.length > 0) {
          pendingSaveCallback.current = callerName;
          setFileConflictModal({ show: true, conflicts: collisions });
          return false;
        }
      }

      const collisionSet = preResolved
        ? new Map(preResolved.map(r => [r.tempFilename, r.resolution]))
        : null;

      await api.finalizeTempFiles({
        files: tempFiles.map(f => ({
          tempFilename: f.tempFilename,
          category: f.category,
          resolution: collisionSet?.get(f.tempFilename),
        })),
        mfgPartNumber: editData.manufacturer_pn,
      });
      setTempFiles([]);
    }

    if (deletedFiles.length > 0) {
      await api.confirmDeleteFiles(deletedFiles.map(f => f.tempFilename));
      setDeletedFiles([]);
    }
    return true;
  };

  const handleSave = async () => {
    if (selectedComponent) {
      // Validate required fields
      if (!editData.manufacturer_id || !editData.manufacturer_part_number || !editData.value) {
        setWarningModal({ show: true, message: 'Please fill in all required fields marked with * symbol' });
        return;
      }

      // Validate required specifications
      const requiredSpecs = editData.specifications?.filter(spec => spec.is_required) || [];
      const missingRequiredSpecs = requiredSpecs.filter(spec => !spec.spec_value || spec.spec_value.trim() === '');
      
      if (missingRequiredSpecs.length > 0) {
        setWarningModal({ show: true, message: 'Please fill in all required fields marked with * symbol' });
        return;
      }

      try {
        let manufacturerId = editData.manufacturer_id;

        // Check if manufacturer needs to be created (starts with "NEW:")
        if (typeof manufacturerId === 'string' && manufacturerId.startsWith('NEW:')) {
          const newManufacturerName = manufacturerId.substring(4); // Remove "NEW:" prefix
          try {
            const response = await createManufacturerMutation.mutateAsync({
              name: newManufacturerName
            });
            manufacturerId = response.data.id;
          } catch (error) {
            console.error('Error creating manufacturer:', error);
            setWarningModal({
              show: true,
              message: `Failed to create manufacturer "${newManufacturerName}". Please try again.`
            });
            return;
          }
        }

        // Finalize temp files and confirm soft-deletes
        const canContinue = await finalizeFiles('handleSave');
        if (!canContinue) return;

        // Extract specifications and distributors from editData
        const { specifications, distributors, ...componentData } = editData;
        
        // Update component data with actual manufacturer ID
        componentData.manufacturer_id = manufacturerId;
        
        // Update component basic data
        await updateMutation.mutateAsync({ id: selectedComponent.id, data: componentData });
        
        const allSpecs = (specifications || [])
          .filter(spec => String(spec?.spec_value ?? '').trim() !== '')
          .map(spec => ({
            category_spec_id: spec.category_spec_id || null,
            spec_name: spec.spec_name || '',
            spec_value: String(spec.spec_value).trim(),
            unit: spec.unit || '',
            mapping_spec_names: spec.mapping_spec_names || [],
            display_order: spec.display_order,
            is_required: Boolean(spec.is_required),
            is_custom: Boolean(spec.is_custom),
          }));
        
        // Update all specifications (or clear if none)
        await api.updateComponentSpecifications(selectedComponent.id, { specifications: allSpecs });
        
        // Filter and update distributors (only with valid distributor_id and sku/url)
        // IMPORTANT: We send all valid distributors to the backend
        // The backend will delete entries not in this list
        const validDistributors = distributors?.filter(dist => 
          dist.distributor_id && (dist.sku?.trim() || dist.url?.trim())
        ).map(dist => ({
          id: dist.id, // Keep existing ID if updating
          distributor_id: dist.distributor_id,
          sku: dist.sku || '',
          url: dist.url || '',
          in_stock: dist.in_stock || false,
          stock_quantity: dist.stock_quantity || 0,
          price_breaks: Array.isArray(dist.price_breaks) ? dist.price_breaks : []
        })) || [];
        
        // Always update distributors (even if empty) to handle deletions
        await api.updateComponentDistributors(selectedComponent.id, { distributors: validDistributors });
        
        // Update stock and pricing info from vendor APIs for all distributors with SKUs
        // NOTE: This is a separate API call from handleEdit's searchAllVendors because:
        // 1. handleEdit fetches specs/details for ONE distributor (reference display)
        // 2. updateComponentStock fetches stock/pricing for ALL distributors
        // 3. Stock data should be fresh at save time, not stale from edit time
        let _stockUpdateMessage = '';
        try {
          const distributorsWithSku = validDistributors.filter(d => d.sku?.trim());
          if (distributorsWithSku.length > 0) {
            const stockUpdateResult = await api.updateComponentStock(selectedComponent.id);
            if (stockUpdateResult.data.updatedCount > 0) {
              _stockUpdateMessage = ` Stock/price updated for ${stockUpdateResult.data.updatedCount} distributor(s).`;
              // Show toast notification
              setAutoFillToast({ 
                show: true, 
                message: `✓ Auto-updated stock and pricing from vendor APIs`, 
                count: stockUpdateResult.data.updatedCount 
              });
              setTimeout(() => setAutoFillToast({ show: false, message: '', count: 0 }), 3000);
            }
          }
        } catch (error) {
          console.error('Error updating stock info:', error);
          // Don't fail the save if stock update fails, but inform the user
          if (validDistributors.filter(d => d.sku?.trim()).length > 0) {
            // stockUpdateMessage = ' Note: Stock/price update from vendor APIs failed.';
          }
        }
        
        // Handle alternatives - create new, update existing, delete removed
        if (editData.alternatives && editData.alternatives.length > 0) {
          // Get existing alternatives to compare
          const existingAlternatives = alternativesData || [];
          const existingIds = new Set(existingAlternatives.map(alt => alt.id));
          const currentIds = new Set(editData.alternatives.filter(alt => alt.id).map(alt => alt.id));
          
          // Delete alternatives that were removed
          const toDelete = existingAlternatives.filter(alt => !currentIds.has(alt.id));
          for (const alt of toDelete) {
            await api.deleteComponentAlternative(selectedComponent.id, alt.id);
          }
          
          // Create or update alternatives
          for (const alt of editData.alternatives) {
            // Validate required fields
            if (!alt.manufacturer_id || !alt.manufacturer_pn?.trim()) {
              continue; // Skip invalid alternatives
            }
            
            let altManufacturerId = alt.manufacturer_id;
            
            // Check if alternative manufacturer needs to be created
            if (typeof altManufacturerId === 'string' && altManufacturerId.startsWith('NEW:')) {
              const newManufacturerName = altManufacturerId.substring(4);
              try {
                const response = await createManufacturerMutation.mutateAsync({ 
                  name: newManufacturerName 
                });
                altManufacturerId = response.data.id;
              } catch (error) {
                console.error('Error creating alternative manufacturer:', error);
                continue; // Skip this alternative if manufacturer creation fails
              }
            }
            
            if (alt.id && existingIds.has(alt.id)) {
              // Update existing alternative
              await api.updateComponentAlternative(selectedComponent.id, alt.id, {
                manufacturer_id: altManufacturerId,
                manufacturer_pn: alt.manufacturer_pn,
                distributors: alt.distributors?.filter(d => d.distributor_id && (d.sku?.trim() || d.url?.trim())).map(d => ({
                  distributor_id: d.distributor_id,
                  sku: d.sku || '',
                  url: d.url || '',
                  in_stock: d.in_stock || false,
                  stock_quantity: d.stock_quantity || 0,
                  price_breaks: Array.isArray(d.price_breaks) ? d.price_breaks : []
                })) || []
              });
            } else {
              // Create new alternative
              await api.createComponentAlternative(selectedComponent.id, {
                manufacturer_id: altManufacturerId,
                manufacturer_pn: alt.manufacturer_pn,
                distributors: alt.distributors?.filter(d => d.distributor_id && (d.sku?.trim() || d.url?.trim())).map(d => ({
                  distributor_id: d.distributor_id,
                  sku: d.sku || '',
                  url: d.url || '',
                  in_stock: d.in_stock || false,
                  stock_quantity: d.stock_quantity || 0,
                  price_breaks: Array.isArray(d.price_breaks) ? d.price_breaks : []
                })) || []
              });
            }
          }
          
          // Refresh alternatives data
          queryClient.invalidateQueries(['componentAlternatives']);
        }
        
        // Refresh the component details
        queryClient.invalidateQueries(['components']);
        queryClient.invalidateQueries(['componentDetails']);
        setIsEditMode(false);
        setManufacturerInput('');
        setAltManufacturerInputs({});
      } catch (error) {
        console.error('Error saving component:', error);
        setWarningModal({ show: true, message: 'Failed to save component. Please try again.' });
      }
    }
  };

  // ECO-related functions
  const handleInitiateECO = async (component) => {
    // Initialize states that don't depend on async data
    setEcoChanges([]);
    setEcoNotes('');
    setEcoStatusProposal(null);
    setLastRejectedECO(null);
    setParentEcoId(null);
    setRetryEcoNumber(null);
    setEcoCadStagedFiles([]);

    // Fetch last rejected ECO for this component (non-blocking)
    api.getLastRejectedECO(component.id)
      .then(res => { if (res.data) setLastRejectedECO(res.data); })
      .catch(() => {}); // Silently ignore if no rejected ECO
    
    // Load the component for editing (reuse handleEdit logic)
    setSelectedComponent(component);
    
    // Set manufacturer input for type-ahead
    const manufacturerName = manufacturers?.find(m => m.id === component?.manufacturer_id)?.name || '';
    setManufacturerInput(manufacturerName);
    
    // Initialize alternative manufacturer inputs BEFORE entering edit mode
    if (alternativesData && alternativesData.length > 0) {
      const altMfrInputs = {};
      alternativesData.forEach((alt, index) => {
        const mfrName = manufacturers?.find(m => m.id === alt.manufacturer_id)?.name || '';
        altMfrInputs[index] = mfrName;
      });
      setAltManufacturerInputs(altMfrInputs);
    } else {
      setAltManufacturerInputs({});
    }
    
    // Store vendor data reference for ECO mode (auto-search DigiKey for suggested specs)
    let vendorDataReference = null;
    const digikeyDist = componentDetails?.distributors?.find(d => 
      d.distributor_name?.toLowerCase() === 'digikey'
    );
    if (digikeyDist?.sku) {
      try {
        console.log('[ECO] Auto-searching Digikey SKU for specifications:', digikeyDist.sku);
        const searchResponse = await api.searchAllVendors(digikeyDist.sku);
        
        if (searchResponse.data) {
          const searchResults = searchResponse.data;
          const digikeyResult = searchResults.digikey?.results?.[0];
          
          if (digikeyResult) {
            vendorDataReference = {
              source: 'digikey',
              manufacturerPartNumber: digikeyResult.manufacturerPartNumber,
              manufacturer: digikeyResult.manufacturer,
              description: digikeyResult.description,
              datasheet: digikeyResult.datasheet,
              packageType: digikeyResult.packageType,
              series: digikeyResult.series,
              category: digikeyResult.category,
              specifications: digikeyResult.specifications || {},
              distributor: {
                source: 'digikey',
                sku: digikeyResult.partNumber,
                pricing: digikeyResult.pricing,
                stock: digikeyResult.stock,
                productUrl: digikeyResult.productUrl,
                minimumOrderQuantity: digikeyResult.minimumOrderQuantity
              }
            };
          }
        }
      } catch (error) {
        console.log('[ECO] Digikey search failed:', error.message);
      }
    }
    
    // Always show all 4 supported distributors in ECO mode
    const editDistributors = buildEditDistributors(componentDetails?.distributors || [], distributors);

    // Fetch category specifications and merge with existing
    let editSpecifications = componentDetails?.specifications || [];
    if (componentDetails?.category_id) {
      try {
        const categorySpecsResponse = await api.getCategorySpecifications(componentDetails.category_id);
        const categorySpecs = categorySpecsResponse.data || [];
        
        const existingSpecsMap = new Map();
        editSpecifications.forEach(spec => {
          if (spec.category_spec_id) {
            existingSpecsMap.set(spec.category_spec_id, spec);
          }
        });
        
        editSpecifications = categorySpecs.map(catSpec => {
          const existing = existingSpecsMap.get(catSpec.id);
          return {
            category_spec_id: catSpec.id,
            spec_name: catSpec.spec_name,
            spec_value: existing?.spec_value || '',
            unit: catSpec.unit || '',
            mapping_spec_names: catSpec.mapping_spec_names || [],
            is_required: catSpec.is_required || false,
            display_order: catSpec.display_order || 0
          };
        });
        
        editSpecifications.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      } catch (error) {
        console.error('[ECO] Error fetching category specifications:', error);
      }
    }

    // Populate editData with all component details including alternatives
    const preparedData = {
      ...componentDetails,
      manufacturer_id: componentDetails?.manufacturer_id || '',
      manufacturer_pn: componentDetails?.manufacturer_pn || componentDetails?.manufacturer_part_number || '',
      manufacturer_part_number: componentDetails?.manufacturer_pn || componentDetails?.manufacturer_part_number || '',
      specifications: editSpecifications,
      distributors: editDistributors,
      alternatives: alternativesData && alternativesData.length > 0 
        ? alternativesData.map(alt => ({
            id: alt.id,
            manufacturer_id: alt.manufacturer_id,
            manufacturer_pn: alt.manufacturer_pn,
            distributors: normalizeDistributors(alt.distributors, distributors)
          }))
        : [],
      _vendorSearchData: vendorDataReference
    };
    setEditData(preparedData);
    
    // NOW set ECO mode and edit mode - after editData is fully populated
    // This prevents the form from rendering with empty data
    setIsECOMode(true);
    setIsEditMode(true);
    setIsAddMode(false);
  };

  // Retry a rejected ECO — pre-populate edit form with the rejected ECO's proposed new values
  const handleRetryECO = (rejectedEco) => {
    setParentEcoId(rejectedEco.id);
    setRetryEcoNumber(rejectedEco.eco_number);
    setEcoCadStagedFiles([]);

    const newEditData = { ...editData };

    // Apply field changes from the rejected ECO
    if (rejectedEco.changes) {
      for (const change of rejectedEco.changes) {
        if (change.field_name === '_status_proposal') {
          setEcoStatusProposal({
            old_value: change.old_value,
            new_value: change.new_value,
          });
        } else {
          newEditData[change.field_name] = change.new_value;
          if (change.field_name === 'manufacturer_pn') {
            newEditData.manufacturer_part_number = change.new_value;
          }
          // Update primary manufacturer input for type-ahead
          if (change.field_name === 'manufacturer_id') {
            const mfr = manufacturers?.find(m => m.id === change.new_value);
            if (mfr) setManufacturerInput(mfr.name);
          }
        }
      }
    }

    // Apply specification changes from the rejected ECO
    if (rejectedEco.specifications?.length > 0 && newEditData.specifications) {
      const specMap = new Map();
      rejectedEco.specifications.forEach(spec => {
        specMap.set(spec.category_spec_id, spec.new_value);
      });
      newEditData.specifications = newEditData.specifications.map(spec => ({
        ...spec,
        spec_value: specMap.has(spec.category_spec_id)
          ? specMap.get(spec.category_spec_id)
          : spec.spec_value,
      }));
    }

    // Apply alternative parts changes from the rejected ECO
    if (rejectedEco.alternatives?.length > 0) {
      const newAltMfrInputs = { ...altManufacturerInputs };
      let alts = [...(newEditData.alternatives || [])];

      for (const ecoAlt of rejectedEco.alternatives) {
        if (ecoAlt.action === 'add') {
          // Add new alternative entry
          const newAlt = {
            id: `retry-new-${Date.now()}-${Math.random()}`,
            manufacturer_id: ecoAlt.manufacturer_id || (ecoAlt.manufacturer_name ? `NEW:${ecoAlt.manufacturer_name}` : ''),
            manufacturer_pn: ecoAlt.manufacturer_pn || '',
            distributors: normalizeDistributors(
              Array.isArray(ecoAlt.distributors)
                ? ecoAlt.distributors.map(d => ({
                    distributor_id: d.distributor_id,
                    sku: d.sku || '',
                    url: d.url || '',
                  }))
                : [],
              distributors,
            ),
          };
          alts.push(newAlt);
          newAltMfrInputs[alts.length - 1] = ecoAlt.manufacturer_name || '';
        } else if (ecoAlt.action === 'update' && ecoAlt.alternative_id) {
          // Update existing alternative
          const idx = alts.findIndex(a => a.id === ecoAlt.alternative_id);
          if (idx >= 0) {
            alts[idx] = {
              ...alts[idx],
              manufacturer_id: ecoAlt.manufacturer_id || alts[idx].manufacturer_id,
              manufacturer_pn: ecoAlt.manufacturer_pn || alts[idx].manufacturer_pn,
            };
            // Apply distributor changes for this alternative
            if (Array.isArray(ecoAlt.distributors) && ecoAlt.distributors.length > 0) {
              const altDists = [...alts[idx].distributors];
              for (const distChange of ecoAlt.distributors) {
                const dIdx = altDists.findIndex(d => d.distributor_id === distChange.distributor_id);
                if (dIdx >= 0 && distChange.action !== 'delete') {
                  altDists[dIdx] = { ...altDists[dIdx], sku: distChange.sku || '', url: distChange.url || '' };
                } else if (dIdx >= 0 && distChange.action === 'delete') {
                  altDists[dIdx] = { ...altDists[dIdx], sku: '', url: '' };
                }
              }
              alts[idx] = { ...alts[idx], distributors: altDists };
            }
            newAltMfrInputs[idx] = ecoAlt.manufacturer_name || newAltMfrInputs[idx] || '';
          }
        } else if (ecoAlt.action === 'delete' && ecoAlt.alternative_id) {
          // Remove deleted alternative
          alts = alts.filter(a => a.id !== ecoAlt.alternative_id);
        }
      }

      newEditData.alternatives = alts;
      setAltManufacturerInputs(newAltMfrInputs);
    }

    // Apply primary distributor changes from the rejected ECO
    if (rejectedEco.distributors?.length > 0 && newEditData.distributors) {
      const primaryDists = rejectedEco.distributors.filter(d => !d.alternative_id);
      if (primaryDists.length > 0) {
        const updatedDists = [...newEditData.distributors];
        for (const distChange of primaryDists) {
          const dIdx = updatedDists.findIndex(d => d.distributor_id === distChange.distributor_id);
          if (dIdx >= 0 && distChange.action !== 'delete') {
            updatedDists[dIdx] = { ...updatedDists[dIdx], sku: distChange.sku || '', url: distChange.url || '' };
          } else if (dIdx >= 0 && distChange.action === 'delete') {
            updatedDists[dIdx] = { ...updatedDists[dIdx], sku: '', url: '' };
          }
        }
        newEditData.distributors = updatedDists;
      }
    }

    // Pre-populate notes
    setEcoNotes(`Retry of ${rejectedEco.eco_number}`);

    setEditData(newEditData);
    setLastRejectedECO(null);
  };

  const handleSubmitECO = async () => {
    if (!selectedComponent) return;

    try {
      const canContinue = await finalizeEcoCadUploads();
      if (!canContinue) return;

      await restoreSoftDeletedFiles(componentDetails?.manufacturer_pn || selectedComponent?.manufacturer_pn || editData.manufacturer_pn);

      // Collect all changes
      const changes = [];
      const specifications = [];
      const distributors = [];
      const alternativesParts = [];

      // Track component field changes (including category_id for category changes via ECO)
      const fieldsToTrack = [
        'description', 'value', 'pcb_footprint', 'package_size',
        'sub_category1', 'sub_category2', 'sub_category3', 'sub_category4',
        'schematic', 'step_model', 'pspice', 'pad_file', 'datasheet_url',
        'manufacturer_id', 'manufacturer_pn', 'category_id'
      ];

      for (const field of fieldsToTrack) {
        const nextValue = editData[field];
        if (nextValue === undefined) continue;

        const oldValue = normalizeEcoFieldValue(componentDetails?.[field]);
        const newValue = normalizeEcoFieldValue(nextValue);

        if (oldValue !== newValue) {
          changes.push({
            field_name: field,
            old_value: oldValue,
            new_value: newValue,
          });
        }
      }

      // Track specification changes - compare by category_spec_id
      if (editData.specifications) {
        for (const spec of editData.specifications) {
          // Find old spec by category_spec_id (spec has category_spec_id from category specs)
          const oldSpec = componentDetails?.specifications?.find(s => s.category_spec_id === spec.category_spec_id);
          const oldValue = oldSpec?.spec_value || '';
          const newValue = spec.spec_value || '';
          
          // Track if value changed (including new specs with no old value)
          if (oldValue !== newValue) {
            specifications.push({
              category_spec_id: spec.category_spec_id || null,
              spec_name: spec.spec_name || '',
              unit: spec.unit || '',
              mapping_spec_names: spec.mapping_spec_names || [],
              display_order: spec.display_order,
              is_required: Boolean(spec.is_required),
              old_value: oldValue,
              new_value: newValue
            });
          }
        }
      }

      // Track distributor changes for PRIMARY component only (not alternatives)
      if (editData.distributors) {
        for (const dist of editData.distributors) {
          if (dist.alternative_id) continue; // Skip alternative distributors - handled below
          if (!dist.sku && !dist.url) continue;

          const oldDist = componentDetails?.distributors?.find(d =>
            d.distributor_id === dist.distributor_id &&
            !d.alternative_id
          );

          const skuChanged = (oldDist?.sku || '') !== (dist.sku || '');
          const urlChanged = (oldDist?.url || '') !== (dist.url || '');

          if (skuChanged || urlChanged || !oldDist) {
            distributors.push({
              alternative_id: null,
              distributor_id: dist.distributor_id,
              action: oldDist ? 'update' : 'add',
              sku: dist.sku || '',
              url: dist.url || ''
            });
          }
        }

        // Check for deleted primary distributors
        if (componentDetails?.distributors) {
          for (const oldDist of componentDetails.distributors) {
            if (oldDist.alternative_id) continue; // Skip alternative distributors
            if (!oldDist.sku) continue;

            const newDist = editData.distributors?.find(d =>
              d.distributor_id === oldDist.distributor_id &&
              !d.alternative_id
            );

            if (!newDist || !newDist.sku) {
              distributors.push({
                alternative_id: null,
                distributor_id: oldDist.distributor_id,
                action: 'delete',
                sku: oldDist.sku || '',
                url: oldDist.url || ''
              });
            }
          }
        }
      }

      // Helper: collect distributor changes for a specific alternative
      const collectAltDistributors = (alt, oldAlt) => {
        const altDists = [];
        const editDists = alt.distributors || [];
        const oldDists = oldAlt?.distributors || [];

        for (const dist of editDists) {
          if (!dist.sku && !dist.url) continue;
          const old = oldDists.find(d => d.distributor_id === dist.distributor_id);
          const skuChanged = (old?.sku || '') !== (dist.sku || '');
          const urlChanged = (old?.url || '') !== (dist.url || '');
          if (skuChanged || urlChanged || !old) {
            altDists.push({
              distributor_id: dist.distributor_id,
              action: old ? 'update' : 'add',
              sku: dist.sku || '',
              url: dist.url || '',
            });
          }
        }
        // Check for deleted
        for (const old of oldDists) {
          if (!old.sku) continue;
          const still = editDists.find(d => d.distributor_id === old.distributor_id);
          if (!still || !still.sku) {
            altDists.push({
              distributor_id: old.distributor_id,
              action: 'delete',
              sku: old.sku || '',
              url: old.url || '',
            });
          }
        }
        return altDists;
      };

      // Track alternative parts changes (with embedded distributors)
      if (editData.alternatives) {
        for (let altIdx = 0; altIdx < editData.alternatives.length; altIdx++) {
          const alt = editData.alternatives[altIdx];
          const oldAlt = alternatives?.find(a => a.id === alt.id);

          // Resolve manufacturer_id: extract name if NEW: prefix
          let mfgId = alt.manufacturer_id;
          let mfgName = null;
          if (typeof mfgId === 'string' && mfgId.startsWith('NEW:')) {
            mfgName = mfgId.substring(4);
            mfgId = null; // no UUID yet — will be created on approval
          } else if (mfgId) {
            // Resolve name from manufacturers list for display in ECO details
            const mfr = manufacturers?.find(m => m.id === mfgId);
            mfgName = mfr?.name || null;
          }
          // Fallback: use the typed input text if name still not resolved
          if (!mfgName && altManufacturerInputs[altIdx]) {
            mfgName = altManufacturerInputs[altIdx];
            // If no manufacturer_id yet, treat the typed name as a new manufacturer
            if (!mfgId) {
              mfgId = null; // will be created on approval via manufacturer_name
            }
          }

          if (oldAlt) {
            const mfgChanged = oldAlt.manufacturer_id !== alt.manufacturer_id;
            const pnChanged = oldAlt.manufacturer_pn !== alt.manufacturer_pn;
            const altDistChanges = collectAltDistributors(alt, oldAlt);
            // Record if mfg/pn changed OR if distributors changed
            if (mfgChanged || pnChanged || altDistChanges.length > 0) {
              alternativesParts.push({
                alternative_id: alt.id,
                action: 'update',
                manufacturer_id: mfgId,
                manufacturer_pn: alt.manufacturer_pn,
                manufacturer_name: mfgName,
                distributors: altDistChanges,
              });
            }
          } else {
            // New alternative - include all its distributors
            const newDists = (alt.distributors || [])
              .filter(d => d.sku || d.url)
              .map(d => ({
                distributor_id: d.distributor_id,
                action: 'add',
                sku: d.sku || '',
                url: d.url || '',
              }));
            alternativesParts.push({
              alternative_id: null,
              action: 'add',
              manufacturer_id: mfgId,
              manufacturer_pn: alt.manufacturer_pn,
              manufacturer_name: mfgName,
              distributors: newDists,
            });
          }
        }
      }

      // Track deleted alternative parts
      if (alternatives) {
        for (const oldAlt of alternatives) {
          if (oldAlt.id === 'primary' || oldAlt.is_primary) continue;

          const stillExists = editData.alternatives?.find(a => a.id === oldAlt.id);
          if (!stillExists) {
            alternativesParts.push({
              alternative_id: oldAlt.id,
              action: 'delete',
              manufacturer_id: oldAlt.manufacturer_id,
              manufacturer_pn: oldAlt.manufacturer_pn,
              distributors: [],
            });
          }
        }
      }

      // Include status proposal change if set
      if (ecoStatusProposal) {
        changes.push({
          field_name: '_status_proposal',
          old_value: ecoStatusProposal.old_value,
          new_value: ecoStatusProposal.new_value,
        });
      }

      // Collect CAD file changes by comparing current links vs edit state
      const cadFileChanges = buildEcoCadFileChanges({
        currentCadFiles: componentDetails?.cadFilesLinked || {},
        desiredCadFields: editData,
        stagedCadFiles: ecoCadStagedFiles,
      });

      // Create ECO order
      await api.createECO({
        component_id: selectedComponent.id,
        part_number: selectedComponent.part_number,
        changes,
        specifications,
        distributors,
        alternatives: alternativesParts,
        cad_files: cadFileChanges,
        notes: ecoNotes,
        parent_eco_id: parentEcoId,
      });

      // Reset states
      setIsECOMode(false);
      setIsEditMode(false);
      setEcoChanges([]);
      setEcoNotes('');
      setEcoStatusProposal(null);
      setParentEcoId(null);
      setLastRejectedECO(null);
      setRetryEcoNumber(null);
      setEcoCadStagedFiles([]);
      setDeletedFiles([]);
      setTempFiles([]);
      queryClient.invalidateQueries(['components']);
      queryClient.invalidateQueries(['ecos']);
      queryClient.invalidateQueries(['componentDetails', selectedComponent.id]);
      queryClient.invalidateQueries(['componentAlternatives', selectedComponent.id]);

      // Show success message
      showSuccess('ECO submitted successfully! It will be reviewed by an approver.');
    } catch (error) {
      console.error('Error submitting ECO:', error);
      showError('Failed to submit ECO. Please try again.');
    }
  };

  const handleCancelECO = async () => {
    if (tempFiles.length > 0) {
      try { await api.cleanupTempFiles({ tempFilenames: tempFiles.map(file => file.tempFilename) }); }
      catch (error) { console.error('Cleanup failed:', error); }
      setTempFiles([]);
    }
    if (deletedFiles.length > 0) {
      try {
        await restoreSoftDeletedFiles(componentDetails?.manufacturer_pn || selectedComponent?.manufacturer_pn || editData.manufacturer_pn);
      } catch (error) {
        console.error('Restore failed:', error);
      }
    }
    setIsECOMode(false);
    setIsEditMode(false);
    setEcoChanges([]);
    setEcoNotes('');
    setEcoStatusProposal(null);
    setParentEcoId(null);
    setLastRejectedECO(null);
    setRetryEcoNumber(null);
    setEcoCadStagedFiles([]);
  };

  const _handleDelete = () => {
    if (selectedComponent) {
      setDeleteConfirmation({ 
        show: true, 
        type: 'single', 
        count: 1, 
        componentName: selectedComponent.part_number || 'this component' 
      });
    }
  };

  const handleBulkDelete = () => {
    if (selectedForDelete.size > 0) {
      setDeleteConfirmation({ 
        show: true, 
        type: 'bulk', 
        count: selectedForDelete.size, 
        componentName: '' 
      });
    }
  };

  const confirmDelete = () => {
    if (deleteConfirmation.type === 'single') {
      deleteMutation.mutate(selectedComponent.id);
    } else if (deleteConfirmation.type === 'bulk') {
      deleteMutation.mutate(Array.from(selectedForDelete));
    }
    setDeleteConfirmation({ show: false, type: '', count: 0, componentName: '' });
  };

  const cancelDelete = () => {
    setDeleteConfirmation({ show: false, type: '', count: 0, componentName: '' });
  };

  const handleAddNew = () => {
    setIsAddMode(true);
    setIsEditMode(false);
    setSelectedComponent(null);
    
    // Reset manufacturer input for type-ahead
    setManufacturerInput('');
    setAltManufacturerInputs({});

    setEditData({
      category_id: '',
      part_number: '', // Will be auto-generated based on category
      manufacturer_pn: '',
      manufacturer_part_number: '',
      description: '',
      value: '',
      sub_category1: '',
      sub_category2: '',
      sub_category3: '',
      sub_category4: '',
      pcb_footprint: [],
      package_size: '',
      schematic: [],
      step_model: [],
      pspice: [],
      pad_file: [],
      datasheet_url: '',
      approval_status: 'new', // Default to new for new parts
      specifications: [], // Array of {spec_name, spec_value, unit}
      distributors: normalizeDistributors([], distributors), // Default four distributors with IDs
      alternatives: [], // Initialize empty alternatives array
    });
  };

  // Function to generate next part number based on category  // Function to generate next part number based on category
  const generateNextPartNumber = (categoryId) => {
    if (!categoryId || !components || !categories) return '';

    const normalizedCategoryId = String(categoryId);
    
    const category = categories.find(cat => String(cat.id) === normalizedCategoryId);
    if (!category) return '';
    
    // Filter components by category
    const categoryComponents = components.filter(
      comp => String(comp.category_id) === normalizedCategoryId || comp.category_name === category.name
    );

    const defaultDigits = 5;
	  let digits = defaultDigits;
	  // Try to find leading_zeros value from component_category and set digits accordingly
	  if (category.leading_zeros && Number.isInteger(category.leading_zeros) && category.leading_zeros > 0) {
        digits = category.leading_zeros;
	  }

	if (categoryComponents.length === 0) {
	  // Find the number of leading zeros in existing part numbers for this category
	  // If none exist, default to 4 digits

	  const paddedNumber = String(1).padStart(digits, '0');
	  return `${category.prefix}-${paddedNumber}`;
	}
    
    // Extract numbers from part numbers with this prefix
    const numbers = categoryComponents
      .map(comp => {
        const match = comp.part_number?.match(new RegExp(`^${category.prefix}-(\\d+)`));
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(num => !isNaN(num) && num > 0);
    
    // Find the highest number
    const maxNumber = numbers.length > 0 ? numbers.reduce((max, n) => n > max ? n : max, 0) : 0;
    const nextNumber = maxNumber + 1;
    
    // Format with leading zeros (digits)
    const paddedNumber = String(nextNumber).padStart(digits, '0');
    
    return `${category.prefix}-${paddedNumber}`;
  };

  // Update part number when category changes in add mode
  const handleCategoryChange = async (categoryId) => {
    handleFieldChange('category_id', categoryId);
    
    // Load sub-category 1 suggestions for this category
    if (categoryId) {
      try {
        const sub1 = await api.getSubCategorySuggestions(categoryId, 1);
        setSubCat1Suggestions(sub1.data || []);
        // Clear sub2 and sub3 when category changes
        setSubCat2Suggestions([]);
        setSubCat3Suggestions([]);
        // Clear sub-category values
        handleFieldChange('sub_category1', '');
        handleFieldChange('sub_category2', '');
        handleFieldChange('sub_category3', '');
        
        // Load package suggestions
        const packageResp = await api.getFieldSuggestions(categoryId, 'package_size');
        setPackageSuggestions(packageResp.data || []);
      } catch (error) {
        console.error('Error loading sub-category suggestions:', error);
      }
    }

    if (isAddMode && categoryId) {
      // Use API to get next part number (checks across ALL categories with same prefix)
      try {
        const partNumberResp = await api.getNextPartNumber(categoryId);
        handleFieldChange('part_number', partNumberResp.data.next_part_number);
      } catch (error) {
        console.error('Error getting next part number:', error);
        // Fallback to client-side generation if API fails
        const nextPartNumber = generateNextPartNumber(categoryId);
        handleFieldChange('part_number', nextPartNumber);
      }
      
      // Auto-fill value field based on category and vendor specifications
      if (editData.vendorSpecifications && Object.keys(editData.vendorSpecifications).length > 0) {
        const category = categories?.find(cat => String(cat.id) === String(categoryId));
        let valueToSet = editData.manufacturer_pn || ''; // Default to manufacturer part number
        
        if (category) {
          // Special handling for Resistor, Capacitor, and Inductor
          if (category.name.toLowerCase().includes('resistor')) {
            // Look for Resistance in vendor specs
            const resistance = editData.vendorSpecifications['Resistance'] || editData.vendorSpecifications['resistance'];
            if (resistance) {
              valueToSet = typeof resistance === 'object' ? resistance.value : resistance;
            }
          } else if (category.name.toLowerCase().includes('capacitor')) {
            // Look for Capacitance in vendor specs
            const capacitance = editData.vendorSpecifications['Capacitance'] || editData.vendorSpecifications['capacitance'];
            if (capacitance) {
              valueToSet = typeof capacitance === 'object' ? capacitance.value : capacitance;
            }
          } else if (category.name.toLowerCase().includes('inductor')) {
            // Look for Inductance in vendor specs
            const inductance = editData.vendorSpecifications['Inductance'] || editData.vendorSpecifications['inductance'];
            if (inductance) {
              valueToSet = typeof inductance === 'object' ? inductance.value : inductance;
            }
          }
          
          // For R/C/L components: strip spaces and convert µ to u (Issue #4)
          if (category.name.toLowerCase().includes('resistor') || 
              category.name.toLowerCase().includes('capacitor') || 
              category.name.toLowerCase().includes('inductor')) {
            valueToSet = valueToSet.toString().replace(/\s+/g, '').replace(/µ/g, 'u');
          }
        }
        
        handleFieldChange('value', valueToSet);
      }
      
      // Load category specifications (from new schema)
      try {
        const response = await api.getCategorySpecifications(categoryId);
        const categorySpecs = response.data || [];
        
        // Convert category specs to editable format with empty values
        // Store category_spec_id to link back to the master spec definition
        let autoSpecs = categorySpecs.map(spec => ({
          category_spec_id: spec.id,
          spec_name: spec.spec_name,
          spec_value: '',
          unit: spec.unit || '',
          mapping_spec_names: spec.mapping_spec_names || [],
          is_required: spec.is_required,
          display_order: spec.display_order
        }));
        
        // If we have vendor specifications, map them to category specs
        if (editData.vendorSpecifications && Object.keys(editData.vendorSpecifications).length > 0) {
          autoSpecs = mapVendorSpecifications(editData.vendorSpecifications, autoSpecs);
        }
        
        handleFieldChange('specifications', autoSpecs);
      } catch (error) {
        console.error('Error loading category specifications:', error);
        // Continue without templates if error occurs
        handleFieldChange('specifications', []);
      }
    }
  };

  // Handle category change in edit mode (with confirmation and part number regeneration)
  const handleEditModeCategoryChange = async (newCategoryId) => {
    // Compare as strings to avoid type mismatch
    if (!newCategoryId || String(newCategoryId) === String(editData.category_id)) return;
    
    const newCategory = categories?.find(cat => String(cat.id) === String(newCategoryId));
    if (!newCategory) return;
    
    // Show confirmation modal
    setCategoryChangeConfirmation({
      show: true,
      newCategoryId: newCategoryId,
      newCategoryName: newCategory.name
    });
  };

  // Execute category change after user confirms
  const confirmCategoryChange = async () => {
    const { newCategoryId, newCategoryName } = categoryChangeConfirmation;
    setCategoryChangeConfirmation({ show: false, newCategoryId: null, newCategoryName: '' });
    
    try {
      // In ECO mode, DON'T apply category change immediately - just stage it
      if (isECOMode) {
        // Update editData with new category (will be tracked as a change when ECO is submitted)
        handleFieldChange('category_id', newCategoryId);
        
        // Clear sub-categories since they are category-specific
        handleFieldChange('sub_category1', '');
        handleFieldChange('sub_category2', '');
        handleFieldChange('sub_category3', '');
        handleFieldChange('sub_category4', '');
        
        // Load new category's sub-category suggestions
        const sub1 = await api.getSubCategorySuggestions(newCategoryId, 1);
        setSubCat1Suggestions(sub1.data || []);
        setSubCat2Suggestions([]);
        setSubCat3Suggestions([]);
        setSubCat4Suggestions([]);
        
        // Load package suggestions for new category
        const packageResp = await api.getFieldSuggestions(newCategoryId, 'package_size');
        setPackageSuggestions(packageResp.data || []);

        // Load new category's specifications (user will fill these in for ECO)
        const specsResponse = await api.getCategorySpecifications(newCategoryId);
        const categorySpecs = specsResponse.data || [];
        const newSpecs = categorySpecs.map(spec => ({
          category_spec_id: spec.id,
          spec_name: spec.spec_name,
          spec_value: '',
          unit: spec.unit || '',
          mapping_spec_names: spec.mapping_spec_names || [],
          is_required: spec.is_required,
          display_order: spec.display_order
        }));
        handleFieldChange('specifications', newSpecs);
        
        showInfo(`Category change to "${newCategoryName}" staged for ECO approval. The new part number will be assigned when the ECO is approved.`);
        return;
      }
      
      // Non-ECO mode: Call API to change category immediately and get new part number
      const response = await api.changeComponentCategory(selectedComponent.id, newCategoryId);
      
      if (response.data.success) {
        // Update editData with new category and part number
        handleFieldChange('category_id', newCategoryId);
        handleFieldChange('part_number', response.data.new_part_number);
        
        // Clear sub-categories since they are category-specific
        handleFieldChange('sub_category1', '');
        handleFieldChange('sub_category2', '');
        handleFieldChange('sub_category3', '');
        handleFieldChange('sub_category4', '');
        
        // Load new category's sub-category suggestions
        const sub1 = await api.getSubCategorySuggestions(newCategoryId, 1);
        setSubCat1Suggestions(sub1.data || []);
        setSubCat2Suggestions([]);
        setSubCat3Suggestions([]);
        setSubCat4Suggestions([]);
        
        // Load package suggestions for new category
        const packageResp = await api.getFieldSuggestions(newCategoryId, 'package_size');
        setPackageSuggestions(packageResp.data || []);

        // Load new category's specifications
        const specsResponse = await api.getCategorySpecifications(newCategoryId);
        const categorySpecs = specsResponse.data || [];
        const newSpecs = categorySpecs.map(spec => ({
          category_spec_id: spec.id,
          spec_name: spec.spec_name,
          spec_value: '',
          unit: spec.unit || '',
          mapping_spec_names: spec.mapping_spec_names || [],
          is_required: spec.is_required,
          display_order: spec.display_order
        }));
        handleFieldChange('specifications', newSpecs);
        
        showSuccess(`Category changed to ${newCategoryName}. New part number: ${response.data.new_part_number}`);
        
        // Invalidate queries to refresh data
        queryClient.invalidateQueries(['components']);
        queryClient.invalidateQueries(['componentDetails', selectedComponent.id]);
      }
    } catch (error) {
      console.error('Error changing category:', error);
      showError(error.response?.data?.error || 'Failed to change category');
    }
  };

  // Load sub-category 2 suggestions when sub-category 1 changes
  const handleSubCat1Change = async (value) => {
    handleFieldChange('sub_category1', value);
    
    // Clear sub-category 2, 3, and 4
    handleFieldChange('sub_category2', '');
    handleFieldChange('sub_category3', '');
    handleFieldChange('sub_category4', '');
    setSubCat3Suggestions([]);
    setSubCat4Suggestions([]);
    
    // Load sub-category 2 suggestions filtered by sub-category 1
    if (editData.category_id && value) {
      try {
        const sub2 = await api.getSubCategorySuggestions(editData.category_id, 2, { subCat1: value });
        setSubCat2Suggestions(sub2.data || []);
      } catch (error) {
        console.error('Error loading sub-category 2 suggestions:', error);
        setSubCat2Suggestions([]);
      }
    } else {
      setSubCat2Suggestions([]);
    }
  };

  // Load sub-category 3 suggestions when sub-category 2 changes
  const handleSubCat2Change = async (value) => {
    handleFieldChange('sub_category2', value);
    
    // Clear sub-category 3 and 4
    handleFieldChange('sub_category3', '');
    handleFieldChange('sub_category4', '');
    setSubCat4Suggestions([]);
    
    // Load sub-category 3 suggestions filtered by sub-category 1 and 2
    if (editData.category_id && editData.sub_category1 && value) {
      try {
        const sub3 = await api.getSubCategorySuggestions(editData.category_id, 3, { 
          subCat1: editData.sub_category1, 
          subCat2: value 
        });
        setSubCat3Suggestions(sub3.data || []);
      } catch (error) {
        console.error('Error loading sub-category 3 suggestions:', error);
        setSubCat3Suggestions([]);
      }
    } else {
      setSubCat3Suggestions([]);
    }
  };

  // Load sub-category 4 suggestions when sub-category 3 changes
  const handleSubCat3Change = async (value) => {
    handleFieldChange('sub_category3', value);
    
    // Clear sub-category 4
    handleFieldChange('sub_category4', '');
    
    // Load sub-category 4 suggestions filtered by sub-category 1, 2, and 3
    if (editData.category_id && editData.sub_category1 && editData.sub_category2 && value) {
      try {
        const sub4 = await api.getSubCategorySuggestions(editData.category_id, 4, { 
          subCat1: editData.sub_category1, 
          subCat2: editData.sub_category2,
          subCat3: value 
        });
        setSubCat4Suggestions(sub4.data || []);
      } catch (error) {
        console.error('Error loading sub-category 4 suggestions:', error);
        setSubCat4Suggestions([]);
      }
    } else {
      setSubCat4Suggestions([]);
    }
  };

  const handleConfirmAdd = async () => {
    try {
      // First, handle manufacturer creation if needed (before validation)
      let manufacturerId = editData.manufacturer_id;
      
      // Check if user typed a new manufacturer name
      if (manufacturerInput && !manufacturerId) {
        // User typed a new manufacturer name - create it first
        try {
          const response = await createManufacturerMutation.mutateAsync({ 
            name: manufacturerInput.trim() 
          });
          manufacturerId = response.data.id;
          // Update editData with the new manufacturer ID
          setEditData(prev => ({ ...prev, manufacturer_id: manufacturerId }));
        } catch (error) {
          console.error('Error creating manufacturer:', error);
          setWarningModal({ 
            show: true, 
            message: `Failed to create manufacturer "${manufacturerInput}". Please try again.` 
          });
          return;
        }
      } else if (typeof manufacturerId === 'string' && manufacturerId.startsWith('NEW:')) {
        // Handle "NEW:" prefix if it exists
        const newManufacturerName = manufacturerId.substring(4);
        try {
          const response = await createManufacturerMutation.mutateAsync({ 
            name: newManufacturerName 
          });
          manufacturerId = response.data.id;
        } catch (error) {
          console.error('Error creating manufacturer:', error);
          setWarningModal({ 
            show: true, 
            message: `Failed to create manufacturer "${newManufacturerName}". Please try again.` 
          });
          return;
        }
      }

      // Validate required fields
      if (!editData.category_id || !editData.part_number) {
        setWarningModal({ show: true, message: 'Please fill in all required fields marked with * symbol' });
        return;
      }
      
      if (!manufacturerId || !editData.manufacturer_pn || !editData.value) {
        setWarningModal({ show: true, message: 'Please fill in all required fields marked with * symbol' });
        return;
      }

      // Validate required specifications
      const requiredSpecs = editData.specifications?.filter(spec => spec.is_required) || [];
      const missingRequiredSpecs = requiredSpecs.filter(spec => !spec.spec_value);
      
      if (missingRequiredSpecs.length > 0) {
        setWarningModal({ show: true, message: 'Please fill in all required fields marked with * symbol' });
        return;
      }

      if (editData.category_id && editData.part_number) {
        // Finalize temp files and confirm soft-deletes
        const canContinue = await finalizeFiles('handleConfirmAdd');
        if (!canContinue) return;

        // Extract specifications and distributors from editData
        const { specifications, distributors, ...componentData } = editData;
        
        // Update component data with actual manufacturer ID
        componentData.manufacturer_id = manufacturerId;
        
        // Create component
        const response = await addMutation.mutateAsync(componentData);
        const newComponentId = response.data?.id;
        
        // Handle specifications
        if (newComponentId) {
          const allSpecs = (specifications || [])
            .filter(spec => String(spec?.spec_value ?? '').trim() !== '')
            .map(spec => ({
              category_spec_id: spec.category_spec_id || null,
              spec_name: spec.spec_name || '',
              spec_value: String(spec.spec_value).trim(),
              unit: spec.unit || '',
              mapping_spec_names: spec.mapping_spec_names || [],
              display_order: spec.display_order,
              is_required: Boolean(spec.is_required),
              is_custom: Boolean(spec.is_custom),
            }));
          
          if (allSpecs.length > 0) {
            await api.updateComponentSpecifications(newComponentId, { specifications: allSpecs });
          }
        }
        
        // Filter and add distributors (only with valid distributor_id and sku)
        const validDistributors = distributors?.filter(dist => 
          dist.distributor_id && (dist.sku?.trim() || dist.url?.trim())
        ).map(dist => ({
          distributor_id: dist.distributor_id,
          sku: dist.sku || '',
          url: dist.url || '',
          in_stock: dist.in_stock || false,
          stock_quantity: dist.stock_quantity || 0,
          minimum_order_quantity: dist.minimum_order_quantity || 1,
          price_breaks: dist.price_breaks || []
        })) || [];
        
        if (newComponentId && validDistributors.length > 0) {
          await api.updateComponentDistributors(newComponentId, { distributors: validDistributors });
        }
        
        // Create alternatives if any
        if (newComponentId && editData.alternatives && editData.alternatives.length > 0) {
          for (const alt of editData.alternatives) {
            // Validate required fields
            if (!alt.manufacturer_id || !alt.manufacturer_pn?.trim()) {
              continue; // Skip invalid alternatives
            }
            
            let altManufacturerId = alt.manufacturer_id;
            
            // Check if alternative manufacturer needs to be created
            if (typeof altManufacturerId === 'string' && altManufacturerId.startsWith('NEW:')) {
              const newManufacturerName = altManufacturerId.substring(4);
              try {
                const response = await createManufacturerMutation.mutateAsync({ 
                  name: newManufacturerName 
                });
                altManufacturerId = response.data.id;
              } catch (error) {
                console.error('Error creating alternative manufacturer:', error);
                continue; // Skip this alternative if manufacturer creation fails
              }
            }
            
            await api.createComponentAlternative(newComponentId, {
              manufacturer_id: altManufacturerId,
              manufacturer_pn: alt.manufacturer_pn,
              distributors: alt.distributors?.filter(d => d.distributor_id && (d.sku?.trim() || d.url?.trim())).map(d => ({
                distributor_id: d.distributor_id,
                sku: d.sku || '',
                url: d.url || ''
              })) || []
            });
          }
        }
        
        // All operations completed successfully - show success notification
        showSuccess('Component added successfully!');

        // Refresh and cleanup — done here so all async operations complete before resetting state
        queryClient.invalidateQueries(['components']);
        setIsAddMode(false);
        setEditData({});
        setSelectedComponent(null);
        setManufacturerInput('');
        setAltManufacturerInputs({});
      }
    } catch (error) {
      console.error('Error adding component:', error);
      showError('Failed to add component. Please try again.');
    }
  };

  const handleCancelAdd = async () => {
    if (tempFiles.length > 0) {
      try { await api.cleanupTempFiles({ tempFilenames: tempFiles.map(f => f.tempFilename) }); }
      catch (e) { console.error('Cleanup failed:', e); }
      setTempFiles([]);
    }
    if (deletedFiles.length > 0) {
      try { await api.restoreDeletedFiles(deletedFiles.map(f => ({
        tempFilename: f.tempFilename, category: f.category, filename: f.filename,
        mfgPartNumber: editData.manufacturer_pn,
      }))); } catch (e) { console.error('Restore failed:', e); }
      setDeletedFiles([]);
    }
    setIsAddMode(false);
    setEditData({});
    setManufacturerInput('');
    setAltManufacturerInputs({});
    setEcoCadStagedFiles([]);
  };

  const handleCancelEdit = async () => {
    if (tempFiles.length > 0) {
      try { await api.cleanupTempFiles({ tempFilenames: tempFiles.map(f => f.tempFilename) }); }
      catch (e) { console.error('Cleanup failed:', e); }
      setTempFiles([]);
    }
    if (deletedFiles.length > 0) {
      try { await api.restoreDeletedFiles(deletedFiles.map(f => ({
        tempFilename: f.tempFilename, category: f.category, filename: f.filename,
        mfgPartNumber: editData.manufacturer_pn,
      }))); } catch (e) { console.error('Restore failed:', e); }
      setDeletedFiles([]);
    }
    setIsEditMode(false);
    setManufacturerInput('');
    setAltManufacturerInputs({});
    setEcoCadStagedFiles([]);
  };

  // File conflict resolution handlers
  const resolveFileConflicts = async (resolutions) => {
    const saveType = pendingSaveCallback.current;
    pendingSaveCallback.current = null;
    setFileConflictModal({ show: false, conflicts: [] });

    // Store resolutions so the save function can pick them up
    resolvedConflicts.current = resolutions;

    // Re-invoke the save function — it will see resolvedConflicts and skip collision check
    if (saveType === 'handleConfirmAdd') {
      handleConfirmAdd();
    } else if (saveType === 'handleSave') {
      handleSave();
    } else if (saveType === 'handleSubmitECO') {
      handleSubmitECO();
    }
  };

  const abortFileConflicts = () => {
    setFileConflictModal({ show: false, conflicts: [] });
    pendingSaveCallback.current = null;
    resolvedConflicts.current = null;
  };

  const toggleBulkDeleteMode = () => {
    setBulkDeleteMode(!bulkDeleteMode);
    setSelectedForDelete(new Set());
  };

  const toggleSelectForDelete = (id) => {
    const newSet = new Set(selectedForDelete);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedForDelete(newSet);
  };

  const handleFieldChange = (field, value) => {
    setEditData((prev) => ({ ...prev, [field]: value }));
  };

  // Auto Fill from Vendor API Data
  const handleAutoFillFromVendorData = () => {
    if (!editData._vendorSearchData) {
      return;
    }

    const vendorData = editData._vendorSearchData;
    const updates = {};
    let updateCount = 0;

    // Find manufacturer ID by name
    if (vendorData.manufacturer) {
      const manufacturer = manufacturers?.find(m => 
        m.name.toLowerCase() === vendorData.manufacturer.toLowerCase()
      );
      if (manufacturer) {
        updates.manufacturer_id = manufacturer.id;
        updateCount++;
      }
    }

    // Fill MFG Part Number - use BOTH fields to ensure compatibility
    if (vendorData.manufacturerPartNumber) {
      updates.manufacturer_pn = vendorData.manufacturerPartNumber;
      updates.manufacturer_part_number = vendorData.manufacturerPartNumber;
      updateCount++;
    }

    // Fill Package - use "Package / Case" from specifications (same logic as vendor search)
    let packageValue = '';
    if (vendorData.specifications) {
      // Look for "Package / Case" parameter in specifications
      const packageSpec = Object.entries(vendorData.specifications).find(
        ([key]) => key === 'Package / Case' || key === 'Package'
      );
      if (packageSpec && packageSpec[1]?.value) {
        packageValue = packageSpec[1].value;
      } else if (typeof vendorData.specifications['Package / Case'] === 'string') {
        packageValue = vendorData.specifications['Package / Case'];
      }
    }
    // Fallback to packageType if no specification found
    if (!packageValue && vendorData.packageType && vendorData.packageType !== 'N/A') {
      packageValue = vendorData.packageType;
    }
    if (packageValue) {
      updates.package = packageValue;
      updates.package_size = packageValue; // Some forms use package_size
      updateCount++;
    }

    // Fill Value (if exists in specifications)
    if (vendorData.specifications) {
      // Common value field names in specifications
      const valueKeys = ['Value', 'Capacitance', 'Resistance', 'Inductance', 'Voltage', 'Current'];
      for (const key of valueKeys) {
        if (vendorData.specifications[key]) {
          const specValue = vendorData.specifications[key];
          const displayValue = typeof specValue === 'object' ? specValue.value : specValue;
          const displayUnit = typeof specValue === 'object' ? specValue.unit : '';
          const dataTypeLabels = ['String', 'UnitOfMeasure', 'CoupledUnitOfMeasure', 'Integer', 'Boolean', 'Decimal', 'Number', 'Double'];
          const shouldShowUnit = displayUnit && !dataTypeLabels.includes(displayUnit);
          updates.value = `${displayValue}${shouldShowUnit ? ' ' + displayUnit : ''}`;
          updateCount++;
          break; // Use first matching value field
        }
      }
    }

    // Fill Datasheet URL
    if (vendorData.datasheet) {
      updates.datasheet_url = vendorData.datasheet;
      updateCount++;
    }

    // Map vendor specifications to component specifications
    // Use the same logic as "Add to Library" feature
    if (vendorData.specifications && editData.specifications && editData.specifications.length > 0) {
      const mappedSpecs = mapVendorSpecifications(vendorData.specifications, editData.specifications);
      updates.specifications = mappedSpecs;
      updateCount++; // Count specifications as one update
    }

    // Apply all updates
    setEditData((prev) => ({
      ...prev,
      ...updates
    }));

    // Show modern toast notification
    if (updateCount > 0) {
      setAutoFillToast({ show: true, message: 'Auto-filled successfully!', count: updateCount });
      setTimeout(() => {
        setAutoFillToast({ show: false, message: '', count: 0 });
      }, 3000);
    }
  };

  // Quick-add mapping handlers
  const handleOpenMappingModal = (specIndex, spec) => {
    setMappingModal({ 
      show: true, 
      specIndex, 
      spec: spec ? { ...spec } : null,
      newMapping: '',
      newSpecName: '',
      newSpecUnit: ''
    });
  };

  const handleCloseMappingModal = () => {
    setMappingModal({ 
      show: false, 
      specIndex: null, 
      spec: null, 
      newMapping: '',
      newSpecName: '',
      newSpecUnit: ''
    });
  };

  const handleCreateNewSpecification = async () => {
    if (!mappingModal.newSpecName.trim()) {
      setWarningModal({ show: true, message: 'Specification name is required!' });
      return;
    }
    
    if (!editData.category_id) {
      setWarningModal({ show: true, message: 'Category ID not found!' });
      return;
    }

    const newSpecName = mappingModal.newSpecName.trim();
    const newMappings = mappingModal.newMapping.trim() ? [mappingModal.newMapping.trim()] : [];

    const duplicateSpec = (editData.specifications || []).find(spec =>
      spec.spec_name?.trim().toLowerCase() === newSpecName.toLowerCase(),
    );
    if (duplicateSpec) {
      setWarningModal({ show: true, message: 'A specification with this name already exists in the current form.' });
      return;
    }
    
    try {
      let categorySpecId = null;
      let deferredSave = false;

      try {
        const response = await api.createCategorySpecification(editData.category_id, {
          spec_name: newSpecName,
          unit: mappingModal.newSpecUnit.trim(),
          mapping_spec_names: newMappings,
          display_order: (editData.specifications?.length || 0) + 1,
          is_required: false
        });
        categorySpecId = response.data.id;
      } catch (error) {
        console.warn('Staging new specification locally until save:', error.response?.data || error.message);
        deferredSave = true;
      }
      
      const newSpec = {
        category_spec_id: categorySpecId,
        spec_name: newSpecName,
        spec_value: '',
        unit: mappingModal.newSpecUnit.trim(),
        mapping_spec_names: newMappings,
        is_required: false,
        display_order: (editData.specifications?.length || 0) + 1,
        is_custom: !categorySpecId
      };
      
      setEditData(prev => ({
        ...prev,
        specifications: [...(prev.specifications || []), newSpec]
      }));
      
      setAutoFillToast({ 
        show: true, 
        message: deferredSave
          ? `Staged new specification "${newSpecName}" for save`
          : `Created new specification "${newSpecName}"`, 
        count: 1 
      });
      setTimeout(() => setAutoFillToast({ show: false, message: '', count: 0 }), 3000);
      
      handleCloseMappingModal();
    } catch (error) {
      console.error('Error creating specification:', error);
      setWarningModal({ 
        show: true, 
        message: 'Failed to create specification: ' + (error.response?.data?.error || error.message) 
      });
    }
  };

  const handleAddMapping = async (vendorFieldName) => {
    if (!mappingModal.spec) return;
    
    try {
      // Get current mappings
      const currentMappings = Array.isArray(mappingModal.spec.mapping_spec_names) 
        ? mappingModal.spec.mapping_spec_names 
        : [];
      
      // Check for duplicates
      if (currentMappings.includes(vendorFieldName.trim())) {
        setWarningModal({ show: true, message: 'This mapping already exists!' });
        return;
      }
      
      // Add new mapping to array
      const updatedMappings = [...currentMappings, vendorFieldName.trim()];
      let stagedForSave = false;
      
      // Only update server if spec already exists (has category_spec_id)
      if (mappingModal.spec.category_spec_id) {
        try {
          await api.updateCategorySpecification(
            mappingModal.spec.category_spec_id,
            { mapping_spec_names: updatedMappings }
          );
        } catch (error) {
          console.warn('Staging mapping locally until save:', error.response?.data || error.message);
          stagedForSave = true;
        }
      }
      
      // Update local state
      const updatedSpecs = [...editData.specifications];
      updatedSpecs[mappingModal.specIndex] = {
        ...updatedSpecs[mappingModal.specIndex],
        mapping_spec_names: updatedMappings
      };
      setEditData(prev => ({ ...prev, specifications: updatedSpecs }));
      
      // Show success message
      setAutoFillToast({ 
        show: true, 
        message: stagedForSave
          ? `Staged mapping "${vendorFieldName}" for ${mappingModal.spec.spec_name || 'specification'}`
          : `Added mapping "${vendorFieldName}" to ${mappingModal.spec.spec_name || 'specification'}`, 
        count: 1 
      });
      setTimeout(() => setAutoFillToast({ show: false, message: '', count: 0 }), 3000);
      
      // Close modal
      handleCloseMappingModal();
    } catch (error) {
      console.error('Error adding mapping:', error);
      setWarningModal({ 
        show: true, 
        message: 'Failed to add mapping: ' + (error.response?.data?.error || error.message) 
      });
    }
  };

  const handleAddNewMapping = () => {
    if (mappingModal.newMapping.trim()) {
      handleAddMapping(mappingModal.newMapping.trim());
    }
  };

  // Alternative Parts Management Handlers
  const handleAddAlternative = () => {
    setEditData((prev) => ({
      ...prev,
      alternatives: [
        ...(prev.alternatives || []),
        {
          manufacturer_id: '',
          manufacturer_pn: '',
          distributors: normalizeDistributors([], distributors)
        }
      ]
    }));
  };

  const handleUpdateAlternative = (index, field, value) => {
    setEditData((prev) => {
      const updatedAlternatives = [...(prev.alternatives || [])];
      updatedAlternatives[index] = {
        ...updatedAlternatives[index],
        [field]: value
      };
      return { ...prev, alternatives: updatedAlternatives };
    });
  };

  const handleDeleteAlternative = (index) => {
    setEditData((prev) => {
      const updatedAlternatives = [...(prev.alternatives || [])];
      updatedAlternatives.splice(index, 1);
      return { ...prev, alternatives: updatedAlternatives };
    });
  };

  const handlePromoteToPrimary = async (altIndex) => {
    const alternative = editData.alternatives[altIndex];
    
    if (!alternative) {
      console.error('Alternative not found at index:', altIndex);
      return;
    }
    
    // Get manufacturer names for confirmation dialog
    const altManufacturerName = manufacturers?.find(m => m.id === alternative.manufacturer_id)?.name || 'Unknown';
    const currentManufacturerName = manufacturers?.find(m => m.id === editData.manufacturer_id)?.name || 'Unknown';
    
    // Show confirmation dialog
    setPromoteConfirmation({
      show: true,
      altIndex,
      altData: {
        manufacturer: altManufacturerName,
        partNumber: alternative.manufacturer_pn
      },
      currentData: {
        manufacturer: currentManufacturerName,
        partNumber: editData.manufacturer_pn || 'N/A'
      }
    });
  };
  
  const confirmPromoteToPrimary = () => {
    const { altIndex } = promoteConfirmation;
    const alternative = editData.alternatives[altIndex];
    
    try {
      // Get current primary part data
      // CRITICAL: Remove 'id' field from distributors to prevent database corruption
      // The 'id' field is the distributor_info table primary key and should NOT be swapped
      const currentPrimary = {
        manufacturer_id: editData.manufacturer_id,
        manufacturer_pn: editData.manufacturer_pn || editData.manufacturer_part_number,
        distributors: (editData.distributors || []).map(dist => ({
          distributor_id: dist.distributor_id,
          distributor_name: dist.distributor_name,
          sku: dist.sku || '',
          url: dist.url || '',
          in_stock: dist.in_stock || false,
          stock_quantity: dist.stock_quantity || 0,
          price_breaks: Array.isArray(dist.price_breaks) ? dist.price_breaks : []
          // NOTE: Explicitly NOT including 'id' field
        }))
      };
      
      // Get alternative distributor data (also without 'id' to prevent conflicts)
      // IMPORTANT: Only include distributors that have actual data (sku or url)
      const alternativeDistributors = (alternative.distributors || [])
        .filter(dist => dist.sku?.trim() || dist.url?.trim())
        .map(dist => ({
          distributor_id: dist.distributor_id,
          distributor_name: dist.distributor_name,
          sku: dist.sku || '',
          url: dist.url || '',
          in_stock: dist.in_stock || false,
          stock_quantity: dist.stock_quantity || 0,
          price_breaks: Array.isArray(dist.price_breaks) ? dist.price_breaks : []
          // NOTE: Explicitly NOT including 'id' field
        }));
      
      // Update editData with alternative as primary
      setEditData(prev => {
        const newAlternatives = [...(prev.alternatives || [])];
        
        // Replace the alternative with current primary data
        // Preserve the alternative's ID so it updates correctly in database
        newAlternatives[altIndex] = {
          id: alternative.id, // Keep the alternative record ID for database update
          manufacturer_id: currentPrimary.manufacturer_id,
          manufacturer_pn: currentPrimary.manufacturer_pn,
          distributors: currentPrimary.distributors // Already cleaned above
        };
        
        return {
          ...prev,
          manufacturer_id: alternative.manufacturer_id,
          manufacturer_pn: alternative.manufacturer_pn,
          manufacturer_part_number: alternative.manufacturer_pn, // Update both fields
          distributors: alternativeDistributors, // Use cleaned distributors
          alternatives: newAlternatives
        };
      });
      
      // Update manufacturer inputs
      const promotedManufacturerName = manufacturers?.find(m => m.id === alternative.manufacturer_id)?.name || '';
      setManufacturerInput(promotedManufacturerName);
      
      // Update alternative manufacturer input (for the demoted primary)
      const demotedManufacturerName = manufacturers?.find(m => m.id === currentPrimary.manufacturer_id)?.name || '';
      setAltManufacturerInputs(prevInputs => ({
        ...prevInputs,
        [altIndex]: demotedManufacturerName
      }));

      // Close confirmation dialog
      setPromoteConfirmation({ show: false, altIndex: null, altData: null, currentData: null });
      
    } catch (error) {
      console.error('Error promoting alternative:', error);
      alert('Error promoting alternative: ' + error.message);
      setPromoteConfirmation({ show: false, altIndex: null, altData: null, currentData: null });
    }
  };

  const handleUpdateAlternativeDistributor = (altIndex, distIndex, field, value) => {
    setEditData((prev) => {
      const updatedAlternatives = [...(prev.alternatives || [])];
      const updatedDistributors = [...(updatedAlternatives[altIndex].distributors || [])];
      updatedDistributors[distIndex] = {
        ...updatedDistributors[distIndex],
        [field]: value
      };
      updatedAlternatives[altIndex].distributors = updatedDistributors;
      return { ...prev, alternatives: updatedAlternatives };
    });
  };

  const handleComponentClick = (component) => {
    if (!bulkDeleteMode) {
      setSelectedComponent(component);
      setIsEditMode(false);
      setIsAddMode(false);
    }
  };

  // Handle clicking on the page background to deselect component
  const handlePageClick = (e) => {
    // Only deselect if not in edit/add mode and a component is selected
    if (!isEditMode && !isAddMode && selectedComponent) {
      // Check if the click is within any component panel
      const isOnPanel = e.target.closest('[data-panel]');
      
      // If click is NOT on a panel (i.e., on the gap/background), deselect
      if (!isOnPanel) {
        setSelectedComponent(null);
      }
    }
  };

  // Memoize sorted components to avoid re-sorting on every render
  const sortedComponents = useMemo(() => {
    if (!components) return [];
    return [...components].sort((a, b) => {
      let aVal = a[sortBy] || '';
      let bVal = b[sortBy] || '';

      // Handle null/undefined values
      if (!aVal && !bVal) return 0;
      if (!aVal) return sortOrder === 'asc' ? 1 : -1;
      if (!bVal) return sortOrder === 'asc' ? -1 : 1;

      // Handle date fields
      if (sortBy === 'created_at' || sortBy === 'updated_at') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      } else if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [components, sortBy, sortOrder]);

  // Virtualizer for component table rows
  const rowVirtualizer = useVirtualizer({
    count: sortedComponents.length,
    getScrollElement: () => componentListRef.current,
    estimateSize: () => 45,
    overscan: 20,
  });

  return (
    <div className="h-full flex flex-col library-background" onClick={handlePageClick}>
      {/* 5-Column Layout: Left Sidebar | Center List (wider) | Components Details & Distributor Info & Specs | Alternative Parts (edit/add) | Vendor API Data & Specifications */}
      {/* Full screen width layout with wider component list */}
      <div 
        className={`page-click-handler grid grid-cols-1 gap-4 flex-1 overflow-hidden ${
        (isEditMode || isAddMode) 
          ? 'xl:grid-cols-[minmax(250px,250px)_minmax(500px,2fr)_minmax(550px,2.5fr)_minmax(350px,1.2fr)]'
          : 'xl:grid-cols-[minmax(250px,250px)_minmax(550px,2.5fr)_minmax(400px,2fr)_minmax(350px,1.2fr)]'
      }`}>
        {/* Left Sidebar - Filters */}
        <div className="flex flex-col space-y-4 xl:w-62.5 overflow-hidden" data-panel>
          {/* Category Selector - Scrollable */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] flex flex-col flex-1 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-[#3a3a3a] shrink-0">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Category</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 pt-3 custom-scrollbar">
              <button
                onClick={() => setSelectedCategory('')}
                className={`w-full text-left px-3 py-2 rounded ${
                  selectedCategory === ''
                    ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 font-medium'
                    : 'hover:bg-gray-100 dark:hover:bg-[#333333] text-gray-700 dark:text-gray-300'
                }`}
              >
                All Categories
              </button>
              {categories?.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`w-full text-left px-3 py-2 rounded ${
                    selectedCategory === category.id
                      ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 font-medium'
                      : 'hover:bg-gray-100 dark:hover:bg-[#333333] text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          {/* Search - Always Visible */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a] shrink-0">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Search</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Full data search ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.target.select();
                  }
                }}
                className="w-full pl-10 pr-10 py-1 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
              />
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    // Auto-focus the search input after clearing
                    if (searchInputRef.current) {
                      searchInputRef.current.focus();
                    }
                  }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Part Number Navigation */}
            {searchTerm && parsePartNumber(searchTerm) && (
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={handlePreviousPart}
                  disabled={parsePartNumber(searchTerm)?.number <= 1}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-1 bg-gray-100 dark:bg-[#333333] hover:bg-gray-200 dark:hover:bg-[#3a3a3a] text-gray-700 dark:text-gray-300 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                  title="Previous part number"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <button
                  onClick={handleNextPart}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-1 bg-gray-100 dark:bg-[#333333] hover:bg-gray-200 dark:hover:bg-[#3a3a3a] text-gray-700 dark:text-gray-300 rounded-md transition-colors text-sm font-medium"
                  title="Next part number"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Sorting Controls */}
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600 dark:text-gray-400 w-12.5">Sort:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="flex-1 px-3 py-1 border border-gray-300 dark:border-[#444444] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
                >
                  <option value="part_number">Part Number</option>
                  <option value="manufacturer_pn">MFG Part Number</option>
                  <option value="value">Value</option>
                  <option value="description">Description</option>
                  <option value="created_at">Date Added</option>
                  <option value="updated_at">Last Edited</option>
                </select>
              </div>
              
              {/* Sort Order Toggle */}
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600 dark:text-gray-400 w-11.25">Order:</label>
                <div className="flex-1 flex items-center gap-2 border border-gray-300 dark:border-[#444444] rounded-md p-1">
                  <button
                    onClick={() => setSortOrder('asc')}
                    className={`flex-1 py-1 text-xs rounded transition-colors ${
                      sortOrder === 'asc'
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#3a3a3a]'
                    }`}
                    title="Ascending"
                  >
                    ↑ Asc
                  </button>
                  <button
                    onClick={() => setSortOrder('desc')}
                    className={`flex-1 py-1 text-xs rounded transition-colors ${
                      sortOrder === 'desc'
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#3a3a3a]'
                    }`}
                    title="Descending"
                  >
                    ↓ Desc
                  </button>
                </div>
              </div>

              {/* Approval Status Filter */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 dark:text-gray-400 w-12.5">Status:</label>
                <select
                  value={selectedApprovalStatus}
                  onChange={(e) => setSelectedApprovalStatus(e.target.value)}
                  className="flex-1 px-3 py-1 border border-gray-300 dark:border-[#444444] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
                >
                  <option value="">All Status</option>
                  <option value="new">New</option>
                  <option value="reviewing">Reviewing</option>
                  <option value="prototype">Prototype</option>
                  <option value="production">Production</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
          </div>

          {/* Actions - Always Visible */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a] shrink-0">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Actions</h3>
            <div className="space-y-2">
              {isAddMode ? (
                <>
                  <button 
                    onClick={handleConfirmAdd}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Confirm Add
                  </button>
                  <button 
                    onClick={handleCancelAdd}
                    className="w-full bg-gray-300 hover:bg-gray-400 dark:bg-[#333333] dark:hover:bg-[#3a3a3a] text-gray-700 dark:text-gray-300 font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </>
              ) : isEditMode ? (
                <>
                  {isECOMode && retryEcoNumber && (
                    <div className="w-full bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2 text-center">
                      <span className="text-xs text-amber-600 dark:text-amber-400">Retrying as</span>
                      <p className="font-bold text-amber-800 dark:text-amber-200">{retryEcoNumber}</p>
                    </div>
                  )}
                  <button
                    onClick={isECOMode ? handleSubmitECO : handleSave}
                    className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    {isECOMode ? 'Submit ECO' : 'Save Changes'}
                  </button>

                  <button
                    onClick={isECOMode ? handleCancelECO : handleCancelEdit}
                    className="w-full bg-gray-300 hover:bg-gray-400 dark:bg-[#333333] dark:hover:bg-[#3a3a3a] text-gray-700 dark:text-gray-300 font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </>
              ) : bulkDeleteMode ? (
                <>
                  <button
                    onClick={handleBulkDelete}
                    disabled={selectedForDelete.size === 0}
                    className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Selected ({selectedForDelete.size})
                  </button>
                  <button
                    onClick={toggleBulkDeleteMode}
                    className="w-full bg-gray-300 hover:bg-gray-400 dark:bg-[#333333] dark:hover:bg-[#3a3a3a] text-gray-700 dark:text-gray-300 font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  {canWrite() && (
                    <button 
                      onClick={handleAddNew}
                      className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Component
                    </button>
                  )}
                  
                  {/* Show different buttons based on ECO configuration */}
                  {isECOEnabled ? (
                    // ECO Mode: Show only "Initiate ECO" button
                    selectedComponent && canWrite() && (
                      <button
                        onClick={() => handleInitiateECO(selectedComponent)}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <FileEdit className="w-4 h-4" />
                        Initiate ECO
                      </button>
                    )
                  ) : (
                    // Normal Mode: Show Edit and Delete buttons
                    <>
                      {selectedComponent && canWrite() && (
                        <button
                          onClick={handleEdit}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          <Edit className="w-4 h-4" />
                          Edit Component
                        </button>
                      )}
                      {canWrite() && (
                        <button
                          onClick={toggleBulkDeleteMode}
                          className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete Components
                        </button>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Center - Component List (Hidden in Edit Mode and Add Mode) */}
        {!isEditMode && !isAddMode && (
          <div className="flex flex-col xl:min-w-62.5 overflow-hidden" data-panel>
            {/* Component List */}
            <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] flex flex-col flex-1 overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-[#3a3a3a] shrink-0">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Components ({sortedComponents.length})
                  {bulkDeleteMode && <span className="text-sm text-red-600 dark:text-red-400 ml-2">(Select to delete)</span>}
                </h3>
              </div>
            <div ref={componentListRef} className="overflow-y-auto custom-scrollbar flex-1">
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : sortedComponents.length > 0 ? (
                <div>
                  {/* Header */}
                  <div className="flex items-center bg-gray-50 dark:bg-[#333333] sticky top-0 z-10 border-b border-gray-200 dark:border-[#3a3a3a]">
                    {bulkDeleteMode && (
                      <div className="w-12 shrink-0 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedForDelete.size === components.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedForDelete(new Set(components.map(c => c.id)));
                            } else {
                              setSelectedForDelete(new Set());
                            }
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">P/N</div>
                    <div className="flex-1 min-w-0 px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">MFG P/N</div>
                    <div className="flex-1 min-w-0 px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Value</div>
                    <div className="flex-1 min-w-0 px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Description</div>
                  </div>
                  {/* Virtual rows */}
                  <div style={{ position: 'relative', height: `${rowVirtualizer.getTotalSize()}px` }}>
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                      const component = sortedComponents[virtualRow.index];
                      return (
                        <div
                          key={component.id}
                          data-index={virtualRow.index}
                          ref={rowVirtualizer.measureElement}
                          onClick={() => !bulkDeleteMode && handleComponentClick(component)}
                          className={`absolute top-0 left-0 w-full flex items-center cursor-pointer border-b border-gray-100 dark:border-[#3a3a3a] hover:bg-gray-50 dark:hover:bg-[#333333] ${
                            selectedComponent?.id === component.id && !bulkDeleteMode ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                          } ${selectedForDelete.has(component.id) ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                          style={{ transform: `translateY(${virtualRow.start}px)` }}
                        >
                          {bulkDeleteMode && (
                            <div className="w-12 shrink-0 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedForDelete.has(component.id)}
                                onChange={() => toggleSelectForDelete(component.id)}
                                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                              />
                            </div>
                          )}
                          <div className="flex-1 min-w-0 px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{component.part_number}</div>
                          <div className="flex-1 min-w-0 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 truncate">{component.manufacturer_pn || component.manufacturer_part_number || 'N/A'}</div>
                          <div className="flex-1 min-w-0 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 truncate">{component.value || 'N/A'}</div>
                          <div className="flex-1 min-w-0 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 truncate">{component.description?.substring(0, 80) || 'N/A'}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  No components found
                </div>
              )}
            </div>
          </div>
        </div>
        )}

        {/* Right Sidebar - Component Details, Distributor Info & Specifications */}
        <div className="space-y-4 xl:min-w-100 overflow-y-auto custom-scrollbar" data-panel>
          {/* Component Details - Always Shown */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-3 border border-gray-200 dark:border-[#3a3a3a]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {isAddMode ? 'Add New Component' : 'Component Details'}
              </h3>
			  {selectedComponent && !isAddMode && !isEditMode && (
				<button
				  onClick={() => {
					const partUrl = `${window.location.origin}${window.location.pathname}?part=${selectedComponent.part_number}`;
					navigator.clipboard.writeText(partUrl);
					setAutoFillToast({ show: true, message: 'Component link copied to clipboard!', count: 1 });
					setTimeout(() => setAutoFillToast({ show: false, message: '', count: 0 }), 3000);
				  }}
				  className="flex items-center gap-1.5 px-3 py-1.5 text-s font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#333333] rounded transition-colors"
				  title="Copy Component Link"
				>
				  <ExternalLink className="w-3.5 h-3.5" />
				  <span>Copy Link</span>
				</button>
			  )}
            </div>
            {!isEditMode && !isAddMode && selectedComponent && (
              <div className="flex mb-4">
                <button
                  onClick={() => jumpToInventory(selectedComponent.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-s font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition-colors"
                  title="View in Inventory"
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Inventory</span>
                </button>
                <button
                  onClick={() => navigate(`/file-library?view=category&category=all&search=${encodeURIComponent(selectedComponent.part_number)}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-s font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
                  title="View associated files in File Library"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Files</span>
                </button>
                {canWrite() && (
                  <button
                    onClick={() => setShowAddToProjectModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-s font-medium text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                    title="Add to Project"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Add to Project</span>
                  </button>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 text-sm">
              {(isEditMode || isAddMode) ? (
                <ComponentEditForm
                  editData={editData}
                  isAddMode={isAddMode}
                  isEditMode={isEditMode}
                  isECOMode={isECOMode}
                  categories={categories}
                  manufacturers={manufacturers}
                  onFieldChange={handleFieldChange}
                  onCategoryChange={handleCategoryChange}
                  onEditModeCategoryChange={handleEditModeCategoryChange}
                  manufacturerInput={manufacturerInput}
                  setManufacturerInput={setManufacturerInput}
                  manufacturerOpen={manufacturerOpen}
                  setManufacturerOpen={setManufacturerOpen}
                  manufacturerRef={manufacturerRef}
                  packageSuggestions={packageSuggestions}
                  packageOpen={packageOpen}
                  setPackageOpen={setPackageOpen}
                  packageRef={packageRef}
                  subCat1Ref={subCat1Ref}
                  subCat2Ref={subCat2Ref}
                  subCat3Ref={subCat3Ref}
                  subCat4Ref={subCat4Ref}
                  subCat1Open={subCat1Open} setSubCat1Open={setSubCat1Open}
                  subCat2Open={subCat2Open} setSubCat2Open={setSubCat2Open}
                  subCat3Open={subCat3Open} setSubCat3Open={setSubCat3Open}
                  subCat4Open={subCat4Open} setSubCat4Open={setSubCat4Open}
                  subCat1Suggestions={subCat1Suggestions}
                  subCat2Suggestions={subCat2Suggestions}
                  subCat3Suggestions={subCat3Suggestions}
                  subCat4Suggestions={subCat4Suggestions}
                  setSubCat2Suggestions={setSubCat2Suggestions}
                  setSubCat3Suggestions={setSubCat3Suggestions}
                  onSubCat1Change={handleSubCat1Change}
                  onSubCat2Change={handleSubCat2Change}
                  onSubCat3Change={handleSubCat3Change}
                  selectedComponent={selectedComponent}
                  onTempFileStaged={(info) => setTempFiles(prev => {
                    // Deduplicate: skip if same filename+category already tracked (e.g., from ZIP with duplicate subdirs)
                    if (prev.some(f => f.filename === info.filename && f.category === info.category)) return prev;
                    return [...prev, info];
                  })}
                  onTempFileRemoved={(tempFilename) => setTempFiles(prev => prev.filter(f => f.tempFilename !== tempFilename))}
                  onFileSoftDeleted={(info) => setDeletedFiles(prev => [...prev, info])}
                  onCadFileAdded={(info) => {
                    if (!isECOMode) return;
                    trackEcoCadAddedFile(info);
                  }}
                  onCadFileRemoved={(info) => {
                    if (!isECOMode) return;
                    trackEcoCadRemovedFile(info);
                  }}
                  onCadFileRenamed={(info) => {
                    if (!isECOMode) return;
                    trackEcoCadRenamedFile(info);
                  }}
                  setEditData={setEditData}
                />
              ) : (
                // View Mode - Show Component Details
                <ComponentDetailView
                  componentDetails={componentDetails}
                  selectedComponent={selectedComponent}
                  alternatives={alternatives}
                  selectedAlternative={selectedAlternative}
                  setSelectedAlternative={setSelectedAlternative}
                  onCopy={handleCopyToClipboard}
                  canApprove={canApprove}
                  canWrite={canWrite}
                  updatingApproval={updatingApproval}
                  onApprovalAction={isECOEnabled ? null : handleApprovalAction}
                />
              )}
            </div>
          </div>

          {/* Distributor Info - Shows distributors for selected alternative or primary component - View Mode Only */}
          {!isEditMode && !isAddMode && (
            <DistributorInfoSection
              selectedComponent={selectedComponent}
              selectedAlternative={selectedAlternative}
              onCopy={handleCopyToClipboard}
              copiedText={copiedText}
              onSearchVendor={() => {
                const manufacturerPN = selectedAlternative?.manufacturer_pn || selectedComponent.manufacturer_pn;
                navigate('/vendor-search', { state: { searchFromLibrary: manufacturerPN } });
              }}
            />
          )}

        </div>

        {/* Fourth Column - Specifications & Alternative Parts (Edit/Add Mode Only) */}
        {(isEditMode || isAddMode) && (
          <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar" data-panel>
            <SpecificationsEditor
              editData={editData}
              isAddMode={isAddMode}
              onFieldChange={handleFieldChange}
              onOpenMappingModal={handleOpenMappingModal}
            />

            <AlternativePartsEditor
              editData={editData}
              manufacturers={manufacturers}
              distributors={distributors}
              altManufacturerInputs={altManufacturerInputs}
              setAltManufacturerInputs={setAltManufacturerInputs}
              altManufacturerOpen={altManufacturerOpen}
              setAltManufacturerOpen={setAltManufacturerOpen}
              altManufacturerRefs={altManufacturerRefs}
              onAddAlternative={handleAddAlternative}
              onDeleteAlternative={handleDeleteAlternative}
              onPromoteToPrimary={handlePromoteToPrimary}
              onUpdateAlternative={handleUpdateAlternative}
              onUpdateAlternativeDistributor={handleUpdateAlternativeDistributor}
            />

            {/* ECO Status Proposal - Only shown in ECO mode, above ECO Notes */}
            {isECOMode && componentDetails && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg shadow-md p-4 border border-blue-200 dark:border-blue-800">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
                  Status Change Proposal
                </h3>
                <div className="space-y-2">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Current status: <span className="font-semibold">{componentDetails.approval_status}</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {componentDetails.approval_status === 'new' && (
                      <button
                        onClick={() => setEcoStatusProposal({ old_value: 'new', new_value: 'prototype' })}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          ecoStatusProposal?.new_value === 'prototype'
                            ? 'bg-purple-600 text-white'
                            : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50'
                        }`}
                      >
                        Propose Prototype
                      </button>
                    )}
                    {componentDetails.approval_status === 'prototype' && (
                      <button
                        onClick={() => setEcoStatusProposal({ old_value: 'prototype', new_value: 'production' })}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          ecoStatusProposal?.new_value === 'production'
                            ? 'bg-green-600 text-white'
                            : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                        }`}
                      >
                        Propose Production
                      </button>
                    )}
                    {componentDetails.approval_status !== 'archived' && (
                      <button
                        onClick={() => setEcoStatusProposal({ old_value: componentDetails.approval_status, new_value: 'archived' })}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          ecoStatusProposal?.new_value === 'archived'
                            ? 'bg-red-600 text-white'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
                        }`}
                      >
                        Propose Archive
                      </button>
                    )}
                    {componentDetails.approval_status === 'archived' && (
                      <button
                        onClick={() => setEcoStatusProposal({ old_value: 'archived', new_value: 'production' })}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          ecoStatusProposal?.new_value === 'production'
                            ? 'bg-green-600 text-white'
                            : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                        }`}
                      >
                        Propose Re-Production
                      </button>
                    )}
                    {ecoStatusProposal && (
                      <button
                        onClick={() => setEcoStatusProposal(null)}
                        className="px-3 py-1.5 rounded-md text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  {ecoStatusProposal && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      Proposed: {ecoStatusProposal.old_value} → {ecoStatusProposal.new_value}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ECO Notes Section - Only shown in ECO mode, after Alternative Parts */}
            {isECOMode && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg shadow-md p-4 border border-yellow-200 dark:border-yellow-800">
                <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-3">
                  ECO Notes
                </h3>
                <textarea
                  value={ecoNotes}
                  onChange={(e) => setEcoNotes(e.target.value)}
                  placeholder="Describe the reason for these changes..."
                  className="w-full px-3 py-2 border border-yellow-300 dark:border-yellow-700 rounded-md bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
                  rows={4}
                />
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-2">
                  Provide a clear explanation for the proposed changes to help approvers understand the ECO.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Fifth Column - Vendor API Data & Component Specifications */}
        <div className="space-y-4 xl:min-w-87.5 overflow-y-auto custom-scrollbar" data-panel>
          {/* Vendor API Data - Shown in both Add Mode and Edit Mode when vendor data is available */}
          {(isAddMode || isEditMode) && editData._vendorSearchData && (
            <VendorDataPanel
              editData={editData}
              isEditMode={isEditMode}
              onAutoFill={handleAutoFillFromVendorData}
              onCopy={handleCopyToClipboard}
              copiedText={copiedText}
            />
          )}

          {/* Retry Panel - Show last rejected ECO when initiating new ECO */}
          {isECOMode && lastRejectedECO && (
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg shadow-md p-4 border border-red-200 dark:border-red-800">
              <h3 className="font-semibold text-red-900 dark:text-red-100 mb-3 text-sm">
                Previous Rejected ECO
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-red-700 dark:text-red-300">
                    {lastRejectedECO.eco_number}
                  </span>
                  <span className="text-red-500 dark:text-red-400 text-xs">
                    {lastRejectedECO.created_at ? new Date(lastRejectedECO.created_at).toLocaleDateString() : ''}
                  </span>
                </div>
                {lastRejectedECO.approved_by_name && (
                  <p className="text-red-600 dark:text-red-400 text-xs">
                    Rejected by: {lastRejectedECO.approved_by_name}
                  </p>
                )}
                {lastRejectedECO.rejection_reason && (
                  <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded text-xs text-red-700 dark:text-red-300">
                    <strong>Reason:</strong> {lastRejectedECO.rejection_reason}
                  </div>
                )}
                {lastRejectedECO.changes?.length > 0 && (
                  <div className="text-xs text-red-500 dark:text-red-400 space-y-0.5">
                    {lastRejectedECO.changes.map((change, idx) => (
                      <div key={idx}>
                        <span className="font-medium">
                          {change.field_name === '_status_proposal' ? 'Status' :
                            change.field_name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}:
                        </span>{' '}
                        {change.old_value || '(empty)'} → {change.new_value || '(empty)'}
                      </div>
                    ))}
                  </div>
                )}
                {lastRejectedECO.specifications?.length > 0 && (
                  <p className="text-xs text-red-500 dark:text-red-400">
                    + {lastRejectedECO.specifications.length} spec change(s)
                  </p>
                )}
                <button
                  onClick={() => handleRetryECO(lastRejectedECO)}
                  className="w-full mt-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md transition-colors"
                >
                  Retry — Load Previous Changes
                </button>
              </div>
            </div>
          )}

          {/* Component Specifications - Only shown in View Mode */}
          {!isEditMode && !isAddMode && (
            <SpecificationsView componentDetails={componentDetails} />
          )}
        </div>
      </div>

      {/* Modals */}
      <DeleteConfirmationModal
        deleteConfirmation={deleteConfirmation}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />

      <PromoteConfirmationModal
        promoteConfirmation={promoteConfirmation}
        onConfirm={confirmPromoteToPrimary}
        onCancel={() => setPromoteConfirmation({ show: false, altIndex: null, altData: null, currentData: null })}
      />

      <CategoryChangeModal
        categoryChangeConfirmation={categoryChangeConfirmation}
        editData={editData}
        isECOMode={isECOMode}
        onConfirm={confirmCategoryChange}
        onCancel={() => setCategoryChangeConfirmation({ show: false, newCategoryId: null, newCategoryName: '' })}
      />

      <WarningModal
        warningModal={warningModal}
        onClose={() => setWarningModal({ show: false, message: '' })}
      />

      {fileConflictModal.show && (
        <FileConflictModal
          conflicts={fileConflictModal.conflicts}
          onResolve={resolveFileConflicts}
          onAbort={abortFileConflicts}
          isProcessing={false}
        />
      )}

      <AddToProjectModal
        show={showAddToProjectModal}
        selectedComponent={selectedComponent}
        projects={projects}
        selectedProjectId={selectedProjectId}
        projectQuantity={projectQuantity}
        onProjectChange={setSelectedProjectId}
        onQuantityChange={setProjectQuantity}
        onConfirm={handleAddToProject}
        onCancel={() => { setShowAddToProjectModal(false); setSelectedProjectId(''); setProjectQuantity(1); }}
      />

      <AutoFillToast
        autoFillToast={autoFillToast}
        onClose={() => setAutoFillToast({ show: false, message: '', count: 0 })}
      />

      <VendorMappingModal
        mappingModal={mappingModal}
        editData={editData}
        onClose={handleCloseMappingModal}
        onAddMapping={handleAddMapping}
        onAddNewMapping={handleAddNewMapping}
        onCreateNewSpecification={handleCreateNewSpecification}
        onUpdateModal={(updates) => setMappingModal(prev => ({ ...prev, ...updates }))}
      />
    </div>
  );
};

export default Library;
