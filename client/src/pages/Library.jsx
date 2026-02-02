import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { Search, Edit, Trash2, Plus, X, Check, AlertTriangle, AlertCircle, Copy, ChevronDown, Package, FolderKanban, ChevronLeft, ChevronRight, FileEdit } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';

// Component Library - Fixed 3-Column Layout
const Library = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canWrite, canApprove, user } = useAuth();
  const { showSuccess, showError } = useNotification();
  
  // Check if ECO feature is enabled from environment variable
  const isECOEnabled = import.meta.env.VITE_CONFIG_ECO === 'true';
  
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
  const [ecoDeleteConfirmation, setEcoDeleteConfirmation] = useState({ show: false });
  const [warningModal, setWarningModal] = useState({ show: false, message: '' });
  const [promoteConfirmation, setPromoteConfirmation] = useState({ show: false, altIndex: null, altData: null, currentData: null });
  const [sortBy, setSortBy] = useState('part_number');
  const [sortOrder, setSortOrder] = useState('asc');
  const [copiedText, setCopiedText] = useState('');
  const [autoFillToast, setAutoFillToast] = useState({ show: false, message: '', count: 0 });
  
  // ECO state
  const [_ecoChanges, setEcoChanges] = useState([]);
  const [ecoNotes, setEcoNotes] = useState('');
  
  // Sub-category suggestions and dropdown states
  const [subCat1Suggestions, setSubCat1Suggestions] = useState([]);
  const [subCat2Suggestions, setSubCat2Suggestions] = useState([]);
  const [subCat3Suggestions, setSubCat3Suggestions] = useState([]);
  const [subCat1Open, setSubCat1Open] = useState(false);
  const [subCat2Open, setSubCat2Open] = useState(false);
  const [subCat3Open, setSubCat3Open] = useState(false);
  const subCat1Ref = useRef(null);
  const subCat2Ref = useRef(null);
  const subCat3Ref = useRef(null);
  
  // Package, Footprint, Symbol suggestions and dropdown states
  const [packageSuggestions, setPackageSuggestions] = useState([]);
  const [footprintSuggestions, setFootprintSuggestions] = useState([]);
  const [symbolSuggestions, setSymbolSuggestions] = useState([]);
  const [packageOpen, setPackageOpen] = useState(false);
  const [footprintOpen, setFootprintOpen] = useState(false);
  const [symbolOpen, setSymbolOpen] = useState(false);
  const packageRef = useRef(null);
  const footprintRef = useRef(null);
  const symbolRef = useRef(null);
  
  // STEP and PSPICE suggestions and dropdown states
  const [stepModelSuggestions, setStepModelSuggestions] = useState([]);
  const [pspiceSuggestions, setPspiceSuggestions] = useState([]);
  const [stepModelOpen, setStepModelOpen] = useState(false);
  const [pspiceOpen, setPspiceOpen] = useState(false);
  const stepModelRef = useRef(null);
  const pspiceRef = useRef(null);
  
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
      if (packageRef.current && !packageRef.current.contains(event.target)) {
        setPackageOpen(false);
      }
      if (footprintRef.current && !footprintRef.current.contains(event.target)) {
        setFootprintOpen(false);
      }
      if (symbolRef.current && !symbolRef.current.contains(event.target)) {
        setSymbolOpen(false);
      }
      if (stepModelRef.current && !stepModelRef.current.contains(event.target)) {
        setStepModelOpen(false);
      }
      if (pspiceRef.current && !pspiceRef.current.contains(event.target)) {
        setPspiceOpen(false);
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

  // Copy to clipboard handler
  const handleCopyToClipboard = (text, label) => {
    // Check if clipboard API is available
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedText(label);
        setTimeout(() => setCopiedText(''), 2000);
      }).catch((err) => {
        console.error('Failed to copy text:', err);
        fallbackCopyToClipboard(text, label);
      });
    } else {
      fallbackCopyToClipboard(text, label);
    }
  };

  // Sanitize specification value by removing unit characters if they match
  const sanitizeSpecValue = (specValue, unit) => {
    if (!specValue || !unit) return specValue;
    
    // Convert to strings and trim
    const value = String(specValue).trim();
    const unitStr = String(unit).trim();
    
    if (!unitStr) return value;
    
    // Check if the value ends with the unit
    if (value.endsWith(unitStr)) {
      // Remove the unit from the end
      return value.substring(0, value.length - unitStr.length).trim();
    }
    
    return value;
  };

  // Map vendor specifications to component specifications using mapping_spec_names
  const mapVendorSpecifications = (vendorSpecs, categorySpecs) => {
    if (!vendorSpecs || !categorySpecs || categorySpecs.length === 0) {
      return categorySpecs;
    }
    
    // Create a map of vendor spec name to value (case-insensitive)
    const vendorSpecMap = {};
    Object.entries(vendorSpecs).forEach(([key, value]) => {
      // Handle both object format {value: "x"} and direct string values
      const specValue = typeof value === 'object' && value !== null ? value.value : value;
      if (specValue) {
        vendorSpecMap[key.toLowerCase().trim()] = String(specValue);
      }
    });
    
    // Map category specs with vendor values ONLY where mapping_spec_names exists
    return categorySpecs.map(spec => {
      // Keep the original spec_value if no mapping exists
      let mappedValue = spec.spec_value || '';
      
      // Support both old mapping_spec_name and new mapping_spec_names array
      const mappings = Array.isArray(spec.mapping_spec_names) 
        ? spec.mapping_spec_names 
        : (spec.mapping_spec_name ? [spec.mapping_spec_name] : []);
      
      // Try each mapping until we find a match
      if (mappings.length > 0) {
        for (const mapping of mappings) {
          if (mapping && mapping.trim() !== '') {
            const mappingKey = mapping.toLowerCase().trim();
            
            if (vendorSpecMap[mappingKey]) {
              const rawValue = vendorSpecMap[mappingKey];
              // Sanitize the value by removing unit if present
              mappedValue = sanitizeSpecValue(rawValue, spec.unit);
              break; // Stop after first match
            }
          }
        }
      }
      
      return {
        ...spec,
        spec_value: mappedValue
      };
    });
  };


  // Fallback clipboard method for when Clipboard API is not available
  const fallbackCopyToClipboard = (text, label) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        setCopiedText(label);
        setTimeout(() => setCopiedText(''), 2000);
      } else {
        alert('Failed to copy to clipboard. Please copy manually.');
      }
    } catch (err) {
      console.error('Fallback copy failed:', err);
      alert('Failed to copy to clipboard. Please copy manually.');
    }
  };

  // Navigate to Inventory with component UUID pre-filled in search
  const jumpToInventory = (componentId) => {
    navigate('/inventory', { state: { searchUuid: componentId } });
  };

  // Parse part number to extract prefix and number
  const parsePartNumber = (partNumber) => {
    if (!partNumber || typeof partNumber !== 'string') return null;
    const match = partNumber.match(/^([A-Z]+)-(\d+)$/);
    if (!match) return null;
    return {
      prefix: match[1],
      number: parseInt(match[2], 10),
      leadingZeros: match[2].length
    };
  };

  // Format part number with leading zeros
  const formatPartNumber = (prefix, number, leadingZeros) => {
    return `${prefix}-${String(number).padStart(leadingZeros, '0')}`;
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

  // Handle approval action (approve, deny, send_to_review, send_to_prototype)
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
  });

  // Fetch components
  const { data: components, isLoading } = useQuery({
    queryKey: ['components', selectedCategory, searchTerm, selectedApprovalStatus],
    queryFn: async () => {
      const response = await api.getComponents({
        category: selectedCategory,
        search: searchTerm,
        approvalStatus: selectedApprovalStatus,
      });
      return response.data;
    },
  });

  // Fetch manufacturers for dropdown
  const { data: manufacturers } = useQuery({
    queryKey: ['manufacturers'],
    queryFn: async () => {
      const response = await api.getManufacturers();
      return response.data;
    },
  });

  // Fetch projects for "Add to Project" modal
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await api.getProjects();
      return response.data;
    },
  });

  // Fetch distributors for dropdown and ID mapping
  const { data: distributors } = useQuery({
    queryKey: ['distributors'],
    queryFn: async () => {
      const response = await api.getDistributors();
      return response.data;
    },
  });

  // Auto-focus search field on page load
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.select();
    }
  }, []);

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
    if ((location.state?.searchUuid || location.state?.searchTerm) && components && components.length > 0) {
      // Select the first matching component
      setSelectedComponent(components[0]);
      setIsEditMode(false);
      setIsAddMode(false);
    }
  }, [components, location.state]);

  // Auto-select component when using Previous/Next navigation
  useEffect(() => {
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
    if (location.state?.vendorData && distributors && manufacturers) {
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

  // Fetch component details with specifications
  const { data: componentDetails } = useQuery({
    queryKey: ['componentDetails', selectedComponent?.id],
    enabled: !!selectedComponent && !isAddMode,
    queryFn: async () => {
      const [details, specifications, distributors] = await Promise.all([
        api.getComponentById(selectedComponent.id),
        api.getComponentSpecifications(selectedComponent.id),
        api.getComponentDistributors(selectedComponent.id),
      ]);
      return {
        ...details.data,
        specifications: specifications.data,
        distributors: distributors.data,
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
    // Define the standard distributor order: Digikey, Mouser, Arrow, Newark
    const distributorOrder = ['Digikey', 'Mouser', 'Arrow', 'Newark'];
    
    // Helper function to normalize distributors to always have 4 in correct order
    const normalizeDistributors = (existingDistributors = []) => {
      return distributorOrder.map(distName => {
        const dist = distributors?.find(d => d.name === distName);
        const existing = existingDistributors?.find(d => {
          if (!d || !d.distributor_id) return false;
          const existingDistName = distributors?.find(distObj => distObj.id === d.distributor_id)?.name;
          return existingDistName === distName;
        });
        
        return {
          distributor_id: dist?.id || null,
          distributor_name: distName,
          sku: existing?.sku || '',
          url: existing?.url || ''
        };
      });
    };
    
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
            distributors: normalizeDistributors(alt.distributors)
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
    onSuccess: () => {
      queryClient.invalidateQueries(['components']);
      setIsAddMode(false);
      setEditData({});
      setSelectedComponent(null);
      setManufacturerInput('');
      setAltManufacturerInputs({});
    },
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
    onSuccess: () => {
      queryClient.invalidateQueries(['components']);
      queryClient.invalidateQueries(['componentDetails']);
      setIsEditMode(false);
      setManufacturerInput('');
      setAltManufacturerInputs({});
    },
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
    
    // Store vendor data reference for later use
    let vendorDataReference = null;
    
    // Auto-search Digikey SKU if available (for reference only, not auto-populate)
    const digikeyDist = componentDetails?.distributors?.find(d => 
      d.distributor_name?.toLowerCase() === 'digikey'
    );
    if (digikeyDist?.sku) {
      try {
        console.log('Auto-searching Digikey SKU for reference:', digikeyDist.sku);
        const searchResponse = await api.searchAllVendors(digikeyDist.sku);
        
        // Process and store vendor data for DISPLAY ONLY (reference)
        if (searchResponse.data) {
          const searchResults = searchResponse.data;
          
          // Find the Digikey result
          const digikeyResult = searchResults.digikey?.results?.[0];
          
          if (digikeyResult) {
            // Prepare vendor data similar to VendorSearch
            vendorDataReference = {
              source: 'digikey', // Explicitly set source
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
      } catch {
        // Silent fail - this is just a convenience feature
      }
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
        
        // Load package, footprint, symbol, step, and pspice suggestions
        const [packageResp, footprintResp, symbolResp, stepResp, pspiceResp] = await Promise.all([
          api.getFieldSuggestions(componentDetails.category_id, 'package_size'),
          api.getFieldSuggestions(componentDetails.category_id, 'pcb_footprint'),
          api.getFieldSuggestions(componentDetails.category_id, 'schematic'),
          api.getFieldSuggestions(componentDetails.category_id, 'step_model'),
          api.getFieldSuggestions(componentDetails.category_id, 'pspice')
        ]);
        setPackageSuggestions(packageResp.data || []);
        setFootprintSuggestions(footprintResp.data || []);
        setSymbolSuggestions(symbolResp.data || []);
        setStepModelSuggestions(stepResp.data || []);
        setPspiceSuggestions(pspiceResp.data || []);
      } catch (error) {
        console.error('Error loading sub-category suggestions:', error);
      }
    }
    
    // Always show all 4 supported distributors in edit mode
    const defaultDistributorNames = ['Digikey', 'Mouser', 'Arrow', 'Newark'];
    const existingDistributors = componentDetails?.distributors || [];
    
    // Create a map of existing distributors by name
    const existingDistMap = new Map();
    existingDistributors.forEach(dist => {
      if (dist.distributor_name) {
        existingDistMap.set(dist.distributor_name, dist);
      }
    });
    
    // Merge: always show all 4 distributors with existing values or empty
    const editDistributors = defaultDistributorNames.map(name => {
      const existing = existingDistMap.get(name);
      const dist = distributors?.find(d => d.name === name);
      return {
        id: existing?.id || undefined, // Keep existing ID if updating
        distributor_id: dist?.id || '',
        distributor_name: name,
        sku: existing?.sku || '',
        url: existing?.url || '',
        in_stock: existing?.in_stock || false,
        stock_quantity: existing?.stock_quantity || 0,
        price_breaks: existing?.price_breaks || []
      };
    });
    
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
    
    // Define the standard distributor order: Digikey, Mouser, Arrow, Newark
    const distributorOrder = ['Digikey', 'Mouser', 'Arrow', 'Newark'];
    
    // Helper function to normalize alternative distributors to always have 4 in correct order
    const normalizeDistributors = (existingDistributors = []) => {
      return distributorOrder.map(distName => {
        const dist = distributors?.find(d => d.name === distName);
        const existing = existingDistributors?.find(d => {
          if (!d || !d.distributor_id) return false;
          const existingDistName = distributors?.find(distObj => distObj.id === d.distributor_id)?.name;
          return existingDistName === distName;
        });
        
        return {
          distributor_id: dist?.id || null,
          distributor_name: distName,
          sku: existing?.sku || '',
          url: existing?.url || ''
        };
      });
    };
    
    // Map all fields properly for editing, including alternatives
    setEditData({
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
            distributors: normalizeDistributors(alt.distributors)
          }))
        : [],
      // Preserve vendor data reference if it was fetched
      _vendorSearchData: vendorDataReference
    });
    
    // NOW set edit mode - after editData is fully populated
    // This prevents the form from rendering with empty data
    setIsEditMode(true);
    setIsAddMode(false);
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
        
        // Extract specifications and distributors from editData
        const { specifications, distributors, ...componentData } = editData;
        
        // Update component data with actual manufacturer ID
        componentData.manufacturer_id = manufacturerId;
        
        // Update component basic data
        await updateMutation.mutateAsync({ id: selectedComponent.id, data: componentData });
        
        // Handle specifications - create custom specs first, then save all values
        const allSpecs = [];
        
        for (const spec of (specifications || [])) {
          // Skip specs without values
          if (!spec.spec_value || spec.spec_value.trim() === '') continue;
          
          let categorySpecId = spec.category_spec_id;
          
          // For custom specs without category_spec_id, create the category spec first
          if (!categorySpecId && spec.is_custom && spec.spec_name?.trim()) {
            try {
              // Get the component's category ID
              const categoryId = componentData.category_id || selectedComponent?.category_id;
              if (categoryId) {
                const createResponse = await api.createCategorySpecification(categoryId, {
                  spec_name: spec.spec_name.trim(),
                  unit: spec.unit || '',
                  mapping_spec_names: spec.mapping_spec_names || [],
                  is_required: false
                });
                categorySpecId = createResponse.data.id;
              }
            } catch (error) {
              // If creation fails (e.g., duplicate), try to find existing spec
              console.error('Error creating custom spec, attempting to find existing:', error);
              try {
                const categoryId = componentData.category_id || selectedComponent?.category_id;
                const existingSpecs = await api.getCategorySpecifications(categoryId);
                const existing = existingSpecs.data?.find(s => s.spec_name === spec.spec_name.trim());
                if (existing) {
                  categorySpecId = existing.id;
                }
              } catch (findError) {
                console.error('Could not find existing spec:', findError);
              }
            }
          }
          
          if (categorySpecId) {
            allSpecs.push({
              category_spec_id: categorySpecId,
              spec_value: spec.spec_value
            });
          }
        }
        
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
    const defaultDistributorNames = ['Digikey', 'Mouser', 'Arrow', 'Newark'];
    const existingDistributors = componentDetails?.distributors || [];
    
    const existingDistMap = new Map();
    existingDistributors.forEach(dist => {
      if (dist.distributor_name) {
        existingDistMap.set(dist.distributor_name, dist);
      }
    });
    
    const editDistributors = defaultDistributorNames.map(name => {
      const existing = existingDistMap.get(name);
      const dist = distributors?.find(d => d.name === name);
      return {
        id: existing?.id || undefined,
        distributor_id: dist?.id || '',
        distributor_name: name,
        sku: existing?.sku || '',
        url: existing?.url || '',
        in_stock: existing?.in_stock || false,
        stock_quantity: existing?.stock_quantity || 0,
        price_breaks: existing?.price_breaks || []
      };
    });
    
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
    
    // Define the standard distributor order for alternatives
    const distributorOrder = ['Digikey', 'Mouser', 'Arrow', 'Newark'];
    
    const normalizeDistributors = (existingDistributors = []) => {
      return distributorOrder.map(distName => {
        const dist = distributors?.find(d => d.name === distName);
        const existing = existingDistributors?.find(d => {
          if (!d || !d.distributor_id) return false;
          const existingDistName = distributors?.find(distObj => distObj.id === d.distributor_id)?.name;
          return existingDistName === distName;
        });
        
        return {
          distributor_id: dist?.id || null,
          distributor_name: distName,
          sku: existing?.sku || '',
          url: existing?.url || ''
        };
      });
    };
    
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
            distributors: normalizeDistributors(alt.distributors)
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

  const handleSubmitECO = async () => {
    if (!selectedComponent) return;

    try {
      // Collect all changes
      const changes = [];
      const specifications = [];
      const distributors = [];
      const alternativesParts = [];

      // Track component field changes
      const fieldsToTrack = [
        'description', 'value', 'pcb_footprint', 'package_size',
        'sub_category1', 'sub_category2', 'sub_category3',
        'schematic', 'step_model', 'pspice', 'datasheet_url', 'notes',
        'manufacturer_id', 'manufacturer_pn'
      ];

      for (const field of fieldsToTrack) {
        const oldValue = componentDetails?.[field];
        const newValue = editData[field];
        
        if (oldValue !== newValue && newValue !== undefined) {
          changes.push({
            field_name: field,
            old_value: String(oldValue || ''),
            new_value: String(newValue || '')
          });
        }
      }

      // Track specification changes
      if (editData.specifications) {
        for (const spec of editData.specifications) {
          const oldSpec = componentDetails?.specifications?.find(s => s.id === spec.id);
          if (oldSpec && oldSpec.spec_value !== spec.spec_value) {
            specifications.push({
              category_spec_id: spec.id,
              old_value: oldSpec.spec_value || '',
              new_value: spec.spec_value || ''
            });
          }
        }
      }

      // Track distributor changes (simplified - tracks adds/updates)
      if (editData.distributors) {
        for (const dist of editData.distributors) {
          const oldDist = componentDetails?.distributors?.find(d => 
            d.distributor_id === dist.distributor_id && 
            d.alternative_id === dist.alternative_id
          );
          
          distributors.push({
            alternative_id: dist.alternative_id || null,
            distributor_id: dist.distributor_id,
            action: oldDist ? 'update' : 'add',
            sku: dist.sku,
            url: dist.url,
            currency: dist.currency || 'USD',
            in_stock: dist.in_stock || false,
            stock_quantity: dist.stock_quantity || 0,
            minimum_order_quantity: dist.minimum_order_quantity || 1,
            packaging: dist.packaging,
            price_breaks: dist.price_breaks || []
          });
        }
      }

      // Track alternative parts changes (simplified)
      if (editData.alternatives) {
        for (const alt of editData.alternatives) {
          const oldAlt = alternatives?.find(a => a.id === alt.id);
          
          alternativesParts.push({
            alternative_id: alt.id || null,
            action: oldAlt ? 'update' : 'add',
            manufacturer_id: alt.manufacturer_id,
            manufacturer_pn: alt.manufacturer_pn
          });
        }
      }

      // Check if there's a delete action
      if (editData.delete_component) {
        changes.push({
          field_name: '_delete_component',
          old_value: 'active',
          new_value: 'marked_for_deletion'
        });
      }

      // Create ECO order
      await api.createECO({
        component_id: selectedComponent.id,
        part_number: selectedComponent.part_number,
        changes,
        specifications,
        distributors,
        alternatives: alternativesParts,
        notes: ecoNotes
      });

      // Reset states
      setIsECOMode(false);
      setIsEditMode(false);
      setEcoChanges([]);
      setEcoNotes('');
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

  const handleCancelECO = () => {
    setIsECOMode(false);
    setIsEditMode(false);
    setEcoChanges([]);
    setEcoNotes('');
  };
  
  const handleMarkForDeletion = () => {
    setEcoDeleteConfirmation({ show: true });
  };
  
  const handleConfirmECODeletion = async () => {
    // First set the delete flag
    setEditData(prev => ({ ...prev, delete_component: true }));
    setEcoDeleteConfirmation({ show: false });
    
    // Wait a moment for state to update, then auto-submit the ECO
    setTimeout(async () => {
      try {
        // Prepare the ECO data with delete flag
        const ecoData = {
          component_id: selectedComponent.id,
          part_number: selectedComponent.part_number,
          notes: ecoNotes || 'Component marked for deletion',
          changes: [{ field_name: 'delete_component', old_value: 'false', new_value: 'true' }],
          distributors: [],
          alternatives: [],
          specifications: []
        };

        await api.createECO(ecoData);

        // Reset states
        setIsECOMode(false);
        setIsEditMode(false);
        setEcoChanges([]);
        setEcoNotes('');
        queryClient.invalidateQueries(['components']);
        queryClient.invalidateQueries(['ecos']);

        // Show success message
        showSuccess('ECO submitted successfully! Component marked for deletion pending approval.');
      } catch (error) {
        console.error('Error submitting ECO:', error);
        showError('Failed to submit ECO. Please try again.');
      }
    }, 100);
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
    
    // Prepare default distributors with IDs
    const defaultDistributorNames = ['Digikey', 'Mouser', 'Arrow', 'Newark'];
    const defaultDistributors = distributors ? defaultDistributorNames.map(name => {
      const dist = distributors.find(d => d.name === name);
      return {
        distributor_id: dist?.id || '',
        distributor_name: name,
        sku: '',
        url: ''
      };
    }) : [];
    
    setEditData({
      category_id: '',
      part_number: '', // Will be auto-generated based on category
      manufacturer_part_number: '',
      description: '',
      value: '',
      sub_category1: '',
      sub_category2: '',
      sub_category3: '',
      pcb_footprint: '',
      package_size: '',
      schematic: '',
      step_model: '',
      pspice: '',
      datasheet_url: '',
      approval_status: 'new', // Default to new for new parts
      specifications: [], // Array of {spec_name, spec_value, unit}
      distributors: defaultDistributors, // Default four distributors with IDs
      alternatives: [], // Initialize empty alternatives array
    });
  };

  // Function to generate next part number based on category  // Function to generate next part number based on category
  const generateNextPartNumber = (categoryId) => {
    if (!categoryId || !components || !categories) return '';
    
    const category = categories.find(cat => cat.id === parseInt(categoryId));
    if (!category) return '';
    
    // Filter components by category
    const categoryComponents = components.filter(
      comp => comp.category_id === parseInt(categoryId) || comp.category_name === category.name
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
    const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
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
        
        // Load package, footprint, symbol, step, and pspice suggestions
        const [packageResp, footprintResp, symbolResp, stepResp, pspiceResp] = await Promise.all([
          api.getFieldSuggestions(categoryId, 'package_size'),
          api.getFieldSuggestions(categoryId, 'pcb_footprint'),
          api.getFieldSuggestions(categoryId, 'schematic'),
          api.getFieldSuggestions(categoryId, 'step_model'),
          api.getFieldSuggestions(categoryId, 'pspice')
        ]);
        setPackageSuggestions(packageResp.data || []);
        setFootprintSuggestions(footprintResp.data || []);
        setSymbolSuggestions(symbolResp.data || []);
        setStepModelSuggestions(stepResp.data || []);
        setPspiceSuggestions(pspiceResp.data || []);
      } catch (error) {
        console.error('Error loading sub-category suggestions:', error);
      }
    }
    
    if (isAddMode) {
      const nextPartNumber = generateNextPartNumber(categoryId);
      handleFieldChange('part_number', nextPartNumber);
      
      // Auto-fill value field based on category and vendor specifications
      if (editData.vendorSpecifications && Object.keys(editData.vendorSpecifications).length > 0) {
        const category = categories?.find(cat => cat.id === parseInt(categoryId));
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

  // Load sub-category 2 suggestions when sub-category 1 changes
  const handleSubCat1Change = async (value) => {
    handleFieldChange('sub_category1', value);
    
    // Clear sub-category 2 and 3
    handleFieldChange('sub_category2', '');
    handleFieldChange('sub_category3', '');
    setSubCat3Suggestions([]);
    
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
    
    // Clear sub-category 3
    handleFieldChange('sub_category3', '');
    
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
        // Extract specifications and distributors from editData
        const { specifications, distributors, ...componentData } = editData;
        
        // Update component data with actual manufacturer ID
        componentData.manufacturer_id = manufacturerId;
        
        // Create component
        const response = await addMutation.mutateAsync(componentData);
        const newComponentId = response.data?.id;
        
        // Handle specifications - create custom specs first, then save all values
        if (newComponentId) {
          const allSpecs = [];
          
          for (const spec of (specifications || [])) {
            // Skip specs without values
            if (!spec.spec_value || spec.spec_value.trim() === '') continue;
            
            let categorySpecId = spec.category_spec_id;
            
            // For custom specs without category_spec_id, create the category spec first
            if (!categorySpecId && spec.is_custom && spec.spec_name?.trim()) {
              try {
                const createResponse = await api.createCategorySpecification(componentData.category_id, {
                  spec_name: spec.spec_name.trim(),
                  unit: spec.unit || '',
                  mapping_spec_names: spec.mapping_spec_names || [],
                  is_required: false
                });
                categorySpecId = createResponse.data.id;
              } catch (error) {
                // If creation fails (e.g., duplicate), try to find existing spec
                console.error('Error creating custom spec, attempting to find existing:', error);
                try {
                  const existingSpecs = await api.getCategorySpecifications(componentData.category_id);
                  const existing = existingSpecs.data?.find(s => s.spec_name === spec.spec_name.trim());
                  if (existing) {
                    categorySpecId = existing.id;
                  }
                } catch (findError) {
                  console.error('Could not find existing spec:', findError);
                }
              }
            }
            
            if (categorySpecId) {
              allSpecs.push({
                category_spec_id: categorySpecId,
                spec_value: spec.spec_value
              });
            }
          }
          
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
        
        // Explicit cleanup to ensure we exit add mode
        // This is done here to ensure all async operations complete before resetting state
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

  const handleCancelAdd = () => {
    setIsAddMode(false);
    setEditData({});
    setManufacturerInput('');
    setAltManufacturerInputs({});
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
    
    try {
      // Create new specification on server
      const response = await api.createCategorySpecification(editData.category_id, {
        spec_name: mappingModal.newSpecName.trim(),
        unit: mappingModal.newSpecUnit.trim(),
        mapping_spec_names: mappingModal.newMapping.trim() ? [mappingModal.newMapping.trim()] : [],
        display_order: (editData.specifications?.length || 0) + 1,
        is_required: false
      });
      
      // Add to local state
      const newSpec = {
        category_spec_id: response.data.id,
        spec_name: mappingModal.newSpecName.trim(),
        spec_value: '',
        unit: mappingModal.newSpecUnit.trim(),
        mapping_spec_names: mappingModal.newMapping.trim() ? [mappingModal.newMapping.trim()] : [],
        is_required: false,
        display_order: (editData.specifications?.length || 0) + 1
      };
      
      setEditData(prev => ({
        ...prev,
        specifications: [...(prev.specifications || []), newSpec]
      }));
      
      // Show success message
      setAutoFillToast({ 
        show: true, 
        message: `Created new specification "${mappingModal.newSpecName}"`, 
        count: 1 
      });
      setTimeout(() => setAutoFillToast({ show: false, message: '', count: 0 }), 3000);
      
      // Close modal
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
      
      // Only update server if spec already exists (has category_spec_id)
      if (mappingModal.spec.category_spec_id) {
        // Update on server - API signature is (id, data)
        await api.updateCategorySpecification(
          mappingModal.spec.category_spec_id,
          { mapping_spec_names: updatedMappings }
        );
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
        message: `Added mapping "${vendorFieldName}" to ${mappingModal.spec.spec_name || 'specification'}`, 
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
    // Define the standard distributor order: Digikey, Mouser, Arrow, Newark
    const distributorOrder = ['Digikey', 'Mouser', 'Arrow', 'Newark'];
    
    // Initialize with 4 predefined distributor rows in specific order
    const defaultDistributors = distributorOrder.map(distName => {
      const dist = distributors?.find(d => d.name === distName);
      return {
        distributor_id: dist?.id || null,
        distributor_name: distName,
        sku: '',
        url: ''
      };
    });
    
    setEditData((prev) => ({
      ...prev,
      alternatives: [
        ...(prev.alternatives || []),
        {
          manufacturer_id: '',
          manufacturer_pn: '',
          distributors: defaultDistributors
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
      
      console.log('✓ Promoted alternative to primary position (distributors cleaned)');
      
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
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600 dark:text-gray-400 w-12.5">Status:</label>
                <select
                  value={selectedApprovalStatus}
                  onChange={(e) => setSelectedApprovalStatus(e.target.value)}
                  className="flex-1 px-3 py-1 border border-gray-300 dark:border-[#444444] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
                >
                  <option value="">All Status</option>
                  <option value="new">New</option>
                  <option value="pending review">Pending Review</option>
                  <option value="experimental">Experimental</option>
                  <option value="approved">Approved</option>
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
                  <button
                    onClick={isECOMode ? handleSubmitECO : handleSave}
                    className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    {isECOMode ? 'Submit ECO' : 'Save Changes'}
                  </button>
                  
                  {/* Delete Component option in ECO mode */}
                  {isECOMode && (
                    <button
                      onClick={handleMarkForDeletion}
                      className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      {editData.delete_component ? 'Mark for Deletion' : 'Mark for Deletion'}
                    </button>
                  )}
                  
                  <button
                    onClick={isECOMode ? handleCancelECO : () => {
                      setIsEditMode(false);
                      setManufacturerInput('');
                      setAltManufacturerInputs({});
                    }}
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
                  Components ({components?.length || 0})
                  {bulkDeleteMode && <span className="text-sm text-red-600 dark:text-red-400 ml-2">(Select to delete)</span>}
                </h3>
              </div>
            <div className="overflow-y-auto custom-scrollbar flex-1">
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : components?.length > 0 ? (
                <table className="w-full">
                  <colgroup>
                    {bulkDeleteMode && <col style={{width: '48px'}} />}
                    <col style={{width: 'auto'}} />
                    <col style={{width: 'auto'}} />
                    <col style={{width: 'auto'}} />
                    <col style={{width: 'auto'}} />
                  </colgroup>
                  <thead className="bg-gray-50 dark:bg-[#333333] sticky top-0">
                    <tr>
                      {bulkDeleteMode && (
                        <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 w-12">
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
                        </th>
                      )}
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Part Number</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">MFG Part Number</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Value</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Sort components based on selected sort field and order
                      const sortedComponents = [...(components || [])].sort((a, b) => {
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
                          // Convert to lowercase for string comparison
                          aVal = aVal.toLowerCase();
                          bVal = bVal.toLowerCase();
                        }
                        
                        // Compare values
                        if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
                        if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
                        return 0;
                      });
                      
                      return sortedComponents.map((component) => (
                      <tr
                        key={component.id}
                        onClick={() => !bulkDeleteMode && handleComponentClick(component)}
                        className={`cursor-pointer border-b border-gray-100 dark:border-[#3a3a3a] hover:bg-gray-50 dark:hover:bg-[#333333] ${
                          selectedComponent?.id === component.id && !bulkDeleteMode ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                        } ${selectedForDelete.has(component.id) ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                      >
                        {bulkDeleteMode && (
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedForDelete.has(component.id)}
                              onChange={() => toggleSelectForDelete(component.id)}
                              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                          </td>
                        )}
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">{component.part_number}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{component.manufacturer_pn || component.manufacturer_part_number || 'N/A'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{component.value || 'N/A'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{component.description?.substring(0, 80) || 'N/A'}</td>
                      </tr>
                    ));
                    })()}
                  </tbody>
                </table>
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
                  onClick={() => {
                    // Navigate to Vendor Search with manufacturer part number from selected alternative
                    const manufacturerPN = selectedAlternative?.manufacturer_pn || selectedComponent.manufacturer_pn;
                    navigate('/vendor-search', { 
                      state: { searchFromLibrary: manufacturerPN } 
                    });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-s font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                  title="Search Vendor"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Search Vendor</span>
                </button>
                {canWrite() && (
                  <button
                    onClick={() => setShowAddToProjectModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-s font-medium text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                    title="Add to Project"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add to Project</span>
                  </button>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 text-sm">
              {(isEditMode || isAddMode) ? (
                <>
                  {/* ROW 1: Part Number, Part Type (Category) */}
                  <div>
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">
                      Part Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editData.part_number || ''}
                      onChange={(e) => handleFieldChange('part_number', e.target.value)}
                      disabled={isAddMode || isEditMode}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm disabled:bg-gray-100 dark:disabled:bg-[#2a2a2a] disabled:cursor-not-allowed"
                      placeholder="Select category to generate"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">
                      Part Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={editData.category_id || ''}
                      onChange={(e) => isAddMode ? handleCategoryChange(e.target.value) : handleFieldChange('category_id', e.target.value)}
					  disabled={isEditMode}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm disabled:bg-gray-100 dark:disabled:bg-[#2a2a2a] disabled:cursor-not-allowed"
                    >
                      <option value="">Select type</option>
                      {categories?.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  

                  {/* ROW 2: Value, Package */}
                  <div>
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">
                      Value <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editData.value || ''}
                      onChange={(e) => handleFieldChange('value', e.target.value)}
                      placeholder="e.g., 10uF, 10kΩ, STM32F103"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">Package</label>
                    <div ref={packageRef} className="relative">
                      <input
                        type="text"
                        value={editData.package_size || ''}
                        onChange={(e) => handleFieldChange('package_size', e.target.value)}
                        onFocus={() => setPackageOpen(true)}
                        placeholder="e.g., 0805"
                        className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setPackageOpen(!packageOpen)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      {packageOpen && editData.category_id && packageSuggestions.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#2a2a2a] border border-gray-300 dark:border-[#444444] rounded-md shadow-lg max-h-60 overflow-y-auto custom-scrollbar">
                          {packageSuggestions
                            .filter(pkg => pkg.toLowerCase().includes((editData.package_size || '').toLowerCase()))
                            .map((pkg, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  handleFieldChange('package_size', pkg);
                                  setPackageOpen(false);
                                }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-[#333333] text-gray-700 dark:text-gray-300"
                              >
                                {pkg}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ROW 3: Manufacturer, MFG Part Number */}
                  <div ref={manufacturerRef} className="relative">
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">
                      Manufacturer <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={manufacturerInput}
                        onChange={(e) => {
                          setManufacturerInput(e.target.value);
                          setManufacturerOpen(true);
                        }}
                        onFocus={() => setManufacturerOpen(true)}
                        placeholder="Type or select"
                        className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setManufacturerOpen(!manufacturerOpen)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      {manufacturerOpen && (() => {
                        const filtered = manufacturers?.filter(mfr => 
                          mfr.name.toLowerCase().includes(manufacturerInput.toLowerCase())
                        ) || [];
                        const exactMatch = filtered.find(mfr => 
                          mfr.name.toLowerCase() === manufacturerInput.toLowerCase()
                        );
                        const showCreateOption = manufacturerInput.trim() && !exactMatch;
                        
                        return (
                          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#2a2a2a] border border-gray-300 dark:border-[#444444] rounded-md shadow-lg max-h-60 overflow-y-auto custom-scrollbar">
                            {showCreateOption && (
                              <button
                                type="button"
                                onClick={() => {
                                  // Store new manufacturer name with special marker for later creation
                                  handleFieldChange('manufacturer_id', `NEW:${manufacturerInput.trim()}`);
                                  setManufacturerOpen(false);
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-medium text-sm flex items-center gap-2"
                              >
                                <Plus className="w-4 h-4" />
                                "{manufacturerInput.trim()}"
                              </button>
                            )}
                            {filtered.length > 0 ? (
                              filtered.map(mfr => (
                                <button
                                  key={mfr.id}
                                  type="button"
                                  onClick={() => {
                                    setManufacturerInput(mfr.name);
                                    handleFieldChange('manufacturer_id', mfr.id);
                                    setManufacturerOpen(false);
                                  }}
                                  className={`w-full text-left px-3 py-2 text-sm ${
                                    editData.manufacturer_id === mfr.id
                                      ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                                      : 'hover:bg-gray-100 dark:hover:bg-[#333333] text-gray-700 dark:text-gray-300'
                                  }`}
                                >
                                  {mfr.name}
                                </button>
                              ))
                            ) : !showCreateOption && (
                              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                                No manufacturers found
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  <div>
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">
                      MFG Part Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editData.manufacturer_pn || editData.manufacturer_part_number || ''}
                      onChange={(e) => {
                        // Update both fields to ensure consistency (Issue #3)
                        handleFieldChange('manufacturer_pn', e.target.value);
                        handleFieldChange('manufacturer_part_number', e.target.value);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                    />
                  </div>

                  {/* ROW 4: Sub-Category 1, Sub-Category 2 */}
                  <div ref={subCat1Ref} className="relative">
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">
                      Sub-Category 1
                    </label>
                    {!editData.category_id && (
                      <div className="text-xs text-gray-500 mb-1">(Select category first)</div>
                    )}
                    <div className="relative">
                      <input
                        type="text"
                        value={editData.sub_category1 || ''}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          handleFieldChange('sub_category1', newValue);
                          setSubCat1Open(true);
                          // Clear sub-categories 2 and 3 when typing
                          if (newValue !== editData.sub_category1) {
                            handleFieldChange('sub_category2', '');
                            handleFieldChange('sub_category3', '');
                            setSubCat2Suggestions([]);
                            setSubCat3Suggestions([]);
                          }
                        }}
                        onFocus={() => editData.category_id && setSubCat1Open(true)}
                        disabled={!editData.category_id}
                        placeholder={editData.category_id ? "Type or select..." : ""}
                        className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm disabled:bg-gray-100 dark:disabled:bg-[#252525] disabled:cursor-not-allowed"
                      />
                      {editData.category_id && (
                        <button
                          type="button"
                          onClick={() => setSubCat1Open(!subCat1Open)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                          <ChevronDown className={`w-4 h-4 transition-transform ${subCat1Open ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                    </div>
                    {subCat1Open && editData.category_id && subCat1Suggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#333333] border border-gray-300 dark:border-[#444444] rounded-md shadow-lg max-h-60 overflow-auto">
                        {subCat1Suggestions
                          .filter(s => !editData.sub_category1 || s.toLowerCase().includes(editData.sub_category1.toLowerCase()))
                          .map((suggestion, idx) => (
                            <div
                              key={idx}
                              onClick={() => {
                                handleSubCat1Change(suggestion);
                                setSubCat1Open(false);
                              }}
                              className="px-3 py-2 cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/20 text-gray-900 dark:text-gray-100 text-sm border-b border-gray-100 dark:border-[#3a3a3a] last:border-b-0"
                            >
                              {suggestion}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  <div ref={subCat2Ref} className="relative">
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">
                      Sub-Category 2
                    </label>
                    {!editData.sub_category1 && (
                      <div className="text-xs text-gray-500 mb-1">(Select sub-category 1 first)</div>
                    )}
                    <div className="relative">
                      <input
                        type="text"
                        value={editData.sub_category2 || ''}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          handleFieldChange('sub_category2', newValue);
                          setSubCat2Open(true);
                          // Clear sub-category 3 when typing
                          if (newValue !== editData.sub_category2) {
                            handleFieldChange('sub_category3', '');
                            setSubCat3Suggestions([]);
                          }
                        }}
                        onFocus={() => editData.sub_category1 && setSubCat2Open(true)}
                        disabled={!editData.sub_category1}
                        placeholder={editData.sub_category1 ? "Type or select..." : ""}
                        className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm disabled:bg-gray-100 dark:disabled:bg-[#252525] disabled:cursor-not-allowed"
                      />
                      {editData.sub_category1 && (
                        <button
                          type="button"
                          onClick={() => setSubCat2Open(!subCat2Open)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                          <ChevronDown className={`w-4 h-4 transition-transform ${subCat2Open ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                    </div>
                    {subCat2Open && editData.sub_category1 && subCat2Suggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#333333] border border-gray-300 dark:border-[#444444] rounded-md shadow-lg max-h-60 overflow-auto">
                        {subCat2Suggestions
                          .filter(s => !editData.sub_category2 || s.toLowerCase().includes(editData.sub_category2.toLowerCase()))
                          .map((suggestion, idx) => (
                            <div
                              key={idx}
                              onClick={() => {
                                handleSubCat2Change(suggestion);
                                setSubCat2Open(false);
                              }}
                              className="px-3 py-2 cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/20 text-gray-900 dark:text-gray-100 text-sm border-b border-gray-100 dark:border-[#3a3a3a] last:border-b-0"
                            >
                              {suggestion}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  <div ref={subCat3Ref} className="relative">
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">
                      Sub-Category 3
                    </label>
                    {!editData.sub_category2 && (
                      <div className="text-xs text-gray-500 mb-1">(Select sub-category 2 first)</div>
                    )}
                    <div className="relative">
                      <input
                        type="text"
                        value={editData.sub_category3 || ''}
                        onChange={(e) => {
                          handleFieldChange('sub_category3', e.target.value);
                          setSubCat3Open(true);
                        }}
                        onFocus={() => editData.sub_category2 && setSubCat3Open(true)}
                        disabled={!editData.sub_category2}
                        placeholder={editData.sub_category2 ? "Type or select..." : ""}
                        className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm disabled:bg-gray-100 dark:disabled:bg-[#252525] disabled:cursor-not-allowed"
                      />
                      {editData.sub_category2 && (
                        <button
                          type="button"
                          onClick={() => setSubCat3Open(!subCat3Open)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                          <ChevronDown className={`w-4 h-4 transition-transform ${subCat3Open ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                    </div>
                    {subCat3Open && editData.sub_category2 && subCat3Suggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#333333] border border-gray-300 dark:border-[#444444] rounded-md shadow-lg max-h-60 overflow-auto">
                        {subCat3Suggestions
                          .filter(s => !editData.sub_category3 || s.toLowerCase().includes(editData.sub_category3.toLowerCase()))
                          .map((suggestion, idx) => (
                            <div
                              key={idx}
                              onClick={() => {
                                handleFieldChange('sub_category3', suggestion);
                                setSubCat3Open(false);
                              }}
                              className="px-3 py-2 cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/20 text-gray-900 dark:text-gray-100 text-sm border-b border-gray-100 dark:border-[#3a3a3a] last:border-b-0"
                            >
                              {suggestion}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* ROW 6: Description */}
                  <div className="col-span-2">
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">Description</label>
                    <textarea
                      value={editData.description || ''}
                      onChange={(e) => handleFieldChange('description', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                      rows="2"
                      placeholder="Brief description of the component"
                    />
                  </div>

                  {/* ROW 7: PCB Footprint, Schematic Symbol */}
                  <div className="col-span-2">
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">PCB Footprint</label>
                    <div ref={footprintRef} className="relative">
                      <input
                        type="text"
                        value={editData.pcb_footprint || ''}
                        onChange={(e) => handleFieldChange('pcb_footprint', e.target.value)}
                        onFocus={() => setFootprintOpen(true)}
                        placeholder="e.g., C_0805"
                        className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setFootprintOpen(!footprintOpen)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      {footprintOpen && editData.category_id && footprintSuggestions.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#2a2a2a] border border-gray-300 dark:border-[#444444] rounded-md shadow-lg max-h-60 overflow-y-auto custom-scrollbar">
                          {footprintSuggestions
                            .filter(fp => fp.toLowerCase().includes((editData.pcb_footprint || '').toLowerCase()))
                            .map((fp, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  handleFieldChange('pcb_footprint', fp);
                                  setFootprintOpen(false);
                                }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-[#333333] text-gray-700 dark:text-gray-300"
                              >
                                {fp}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">Schematic Symbol</label>
                    <div ref={symbolRef} className="relative">
                      <input
                        type="text"
                        value={editData.schematic || ''}
                        onChange={(e) => handleFieldChange('schematic', e.target.value)}
                        onFocus={() => setSymbolOpen(true)}
                        placeholder="Symbol name"
                        className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setSymbolOpen(!symbolOpen)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      {symbolOpen && editData.category_id && symbolSuggestions.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#2a2a2a] border border-gray-300 dark:border-[#444444] rounded-md shadow-lg max-h-60 overflow-y-auto custom-scrollbar">
                          {symbolSuggestions
                            .filter(sym => sym.toLowerCase().includes((editData.schematic || '').toLowerCase()))
                            .map((sym, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  handleFieldChange('schematic', sym);
                                  setSymbolOpen(false);
                                }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-[#333333] text-gray-700 dark:text-gray-300"
                              >
                                {sym}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ROW 8: STEP 3D Model, PSPICE Model */}
                  <div className="col-span-2">
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">STEP 3D Model</label>
                    <div className="relative" ref={stepModelRef}>
                      <div className="relative">
                        <input
                          type="text"
                          value={editData.step_model || ''}
                          onChange={(e) => {
                            handleFieldChange('step_model', e.target.value);
                            setStepModelOpen(true);
                          }}
                          onFocus={() => setStepModelOpen(true)}
                          placeholder="STEP model name"
                          className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setStepModelOpen(!stepModelOpen)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                          <ChevronDown className={`h-4 w-4 transition-transform ${stepModelOpen ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                      {stepModelOpen && stepModelSuggestions.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-[#2a2a2a] border border-gray-300 dark:border-[#444444] rounded-md shadow-lg max-h-60 overflow-auto">
                          {stepModelSuggestions
                            .filter(step => 
                              step.toLowerCase().includes((editData.step_model || '').toLowerCase())
                            )
                            .map((step, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  handleFieldChange('step_model', step);
                                  setStepModelOpen(false);
                                }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-[#333333] text-gray-700 dark:text-gray-300"
                              >
                                {step}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">PSPICE Model</label>
                    <div className="relative" ref={pspiceRef}>
                      <div className="relative">
                        <input
                          type="text"
                          value={editData.pspice || ''}
                          onChange={(e) => {
                            handleFieldChange('pspice', e.target.value);
                            setPspiceOpen(true);
                          }}
                          onFocus={() => setPspiceOpen(true)}
                          placeholder="Pspice model name"
                          className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setPspiceOpen(!pspiceOpen)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                          <ChevronDown className={`h-4 w-4 transition-transform ${pspiceOpen ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                      {pspiceOpen && pspiceSuggestions.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-[#2a2a2a] border border-gray-300 dark:border-[#444444] rounded-md shadow-lg max-h-60 overflow-auto">
                          {pspiceSuggestions
                            .filter(psp => 
                              psp.toLowerCase().includes((editData.pspice || '').toLowerCase())
                            )
                            .map((psp, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  handleFieldChange('pspice', psp);
                                  setPspiceOpen(false);
                                }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-[#333333] text-gray-700 dark:text-gray-300"
                              >
                                {psp}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Datasheet URL */}
                  <div className="col-span-2">
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">Datasheet URL</label>
                    <input
                      type="url"
                      value={editData.datasheet_url || ''}
                      onChange={(e) => handleFieldChange('datasheet_url', e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                    />
                  </div>

                  {/* Distributor Info Section - Merged into Component Details in Edit/Add Mode */}
                  <div className="col-span-2 border-t border-gray-200 dark:border-[#444444] pt-4 mt-2">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Distributor Info</h4>
                    {(editData.distributors || []).map((dist, index) => (
                      <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 mb-2">
                        <input
                          type="text"
                          value={dist.distributor_name || ''}
                          onChange={(e) => {
                            const newDists = [...(editData.distributors || [])];
                            newDists[index] = { ...newDists[index], distributor_name: e.target.value };
                            handleFieldChange('distributors', newDists);
                          }}
                          placeholder="Distributor (e.g., Digikey)"
                          disabled={true}
                          className="px-2 py-1 border border-gray-300 dark:border-[#444444] rounded text-xs bg-gray-100 dark:bg-[#2a2a2a] dark:text-gray-100 cursor-not-allowed"
                        />
                        <input
                          type="text"
                          value={dist.sku || ''}
                          onChange={(e) => {
                            const newDists = [...(editData.distributors || [])];
                            newDists[index] = { ...newDists[index], sku: e.target.value };
                            handleFieldChange('distributors', newDists);
                          }}
                          placeholder="SKU"
                          className="px-2 py-1 border border-gray-300 dark:border-[#444444] rounded text-xs bg-white dark:bg-[#333333] dark:text-gray-100"
                        />
                        <input
                          type="text"
                          value={dist.url || ''}
                          onChange={(e) => {
                            const newDists = [...(editData.distributors || [])];
                            newDists[index] = { ...newDists[index], url: e.target.value };
                            handleFieldChange('distributors', newDists);
                          }}
                          placeholder="URL"
                          className="px-2 py-1 border border-gray-300 dark:border-[#444444] rounded text-xs bg-white dark:bg-[#333333] dark:text-gray-100"
                        />
                        {/* Spacer to maintain grid alignment (no add/remove in add or edit mode) */}
                        <div></div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                // View Mode - Show Component Details
                <>
                  {selectedComponent && componentDetails ? (
                    <>
                      {/* Helper component for copyable text with aligned labels */}
                      {(() => {
                        const CopyableField = ({ label, value, isLink }) => (
                          <div className="flex items-baseline gap-2 pb-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400 w-28 shrink-0 text-right">{label}:</span>
                            {isLink ? (
                              <a 
                                href={value} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate flex-1"
                              >
                                {value}
                              </a>
                            ) : (
                              <span 
                                className="text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer hover:bg-gray-100 dark:hover:bg-[#333333] px-1 rounded transition-colors truncate flex-1"
                                onClick={() => handleCopyToClipboard(value, label)}
                                title="Click to copy"
                              >
                                {value || 'N/A'}
                              </span>
                            )}
                          </div>
                        );

                        return (
                          <div className="col-span-2 space-y-1">
                            {/* Each field in its own row with aligned labels */}
                            <CopyableField label="Part Number" value={componentDetails.part_number} />
                            <CopyableField label="Part Type" value={componentDetails.part_type || componentDetails.category_name} />
                            <CopyableField label="Value" value={componentDetails.value} />
                            <CopyableField label="Package" value={componentDetails.package_size} />

                            {/* Alternative Parts Selection */}
                            {alternatives && alternatives.length > 0 && (
                              <div className="flex flex-wrap items-start gap-2">
                                <span className="text-xs text-gray-500 dark:text-gray-400 w-28 shrink-0 text-right pt-1">
                                  Alt Parts{alternatives.length > 1 ? ` (${alternatives.length})` : ''}:
                                </span>
                                <div className="flex-1 min-w-0 flex flex-wrap items-center gap-2">
                                  <select
                                    value={selectedAlternative?.id || ''}
                                    onChange={(e) => {
                                      const alt = alternatives.find(a => a.id === e.target.value);
                                      setSelectedAlternative(alt);
                                    }}
                                    className="flex-1 min-w-0 px-2 py-1 border border-gray-300 dark:border-[#444444] rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm truncate"
                                  >
                                    {alternatives.map((alt) => (
                                      <option key={alt.id} value={alt.id}>
                                        {alt.manufacturer_name || 'Unknown Mfg'} - {alt.manufacturer_pn}
                                        {alt.is_primary ? ' (Primary)' : ''}
                                      </option>
                                    ))}
                                  </select>
                                  {canWrite() && (
                                    <button
                                      onClick={() => {
                                        sessionStorage.setItem('libraryPartNumberForAlternative', selectedComponent.part_number);
                                        navigate('/vendor-search');
                                      }}
                                      className="flex items-center gap-1 px-1.5 py-0.5 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors shrink-0"
                                      title="Search for alternative parts"
                                    >
                                      <Search className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Manufacturer and MFG Part Number - each in own row */}
                            <CopyableField 
                              label="Manufacturer" 
                              value={selectedAlternative?.manufacturer_name || componentDetails.manufacturer_name} 
                            />
                            <CopyableField 
                              label="MFG Part Number" 
                              value={selectedAlternative?.manufacturer_pn || componentDetails.manufacturer_pn} 
                            />

                            {/* Description */}
                            {componentDetails.description && (
                              <div className="flex items-start gap-2">
                                <span className="text-xs text-gray-500 dark:text-gray-400 w-28 shrink-0 text-right pt-0.5">Description:</span>
                                <p 
                                  className="text-sm text-gray-900 dark:text-gray-100 cursor-pointer hover:bg-gray-100 dark:hover:bg-[#333333] px-1 rounded transition-colors flex-1"
                                  onClick={() => handleCopyToClipboard(componentDetails.description, 'Description')}
                                  title="Click to copy"
                                >
                                  {componentDetails.description}
                                </p>
                              </div>
                            )}

                            {/* CAD Files - each in own row */}
                            <CopyableField label="PCB Footprint" value={componentDetails.pcb_footprint} />
                            {componentDetails.schematic && (
                              <CopyableField label="Schematic" value={componentDetails.schematic} />
                            )}
                            {componentDetails.step_model && (
                              <CopyableField label="STEP 3D Model" value={componentDetails.step_model} />
                            )}
                            {componentDetails.pspice && (
                              <CopyableField label="PSPICE Model" value={componentDetails.pspice} />
                            )}

                            {/* Datasheet URL */}
                            {componentDetails.datasheet_url && (
                              <CopyableField label="Datasheet URL" value={componentDetails.datasheet_url} isLink />
                            )}

                            {/* Approval Status Section */}
                            <div className="border-t border-gray-200 dark:border-[#444444] pt-3 mt-3 space-y-1">
                              {/* Approval Status - single row */}
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500 dark:text-gray-400 w-28 shrink-0 text-right">Approval Status:</span>
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                                  componentDetails.approval_status === 'approved' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                                  componentDetails.approval_status === 'archived' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                                  componentDetails.approval_status === 'pending review' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                                  componentDetails.approval_status === 'experimental' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' :
                                  'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                }`}>
                                  {componentDetails.approval_status === 'approved' && 'Approved'}
                                  {componentDetails.approval_status === 'archived' && 'Archived'}
                                  {componentDetails.approval_status === 'pending review' && 'Pending Review'}
                                  {componentDetails.approval_status === 'experimental' && 'Experimental'}
                                  {componentDetails.approval_status === 'new' && 'New'}
                                </span>
                              </div>

                              {/* By / Date - single row */}
                              {(componentDetails.approval_user_name || componentDetails.approval_date) && (
                                <div className="flex items-baseline gap-2">
                                  <span className="text-xs text-gray-500 dark:text-gray-400 w-28 shrink-0 text-right">Approved:</span>
                                  <span className="text-sm text-gray-700 dark:text-gray-300">
                                    {componentDetails.approval_user_name && `By: ${componentDetails.approval_user_name}`}
                                    {componentDetails.approval_user_name && componentDetails.approval_date && ' • '}
                                    {componentDetails.approval_date && `Date: ${new Date(componentDetails.approval_date).toLocaleDateString()}`}
                                  </span>
                                </div>
                              )}

                              {/* Approval Action Buttons - with label */}
                              <div className="flex items-start gap-2 pt-2">
                                <span className="text-xs text-gray-500 dark:text-gray-400 w-28 shrink-0 text-right pt-2">Approval Action:</span>
                                <div className="flex flex-wrap gap-2">
                                  {canApprove() && (
                                    <>
                                      <button
                                        onClick={() => handleApprovalAction('approve')}
                                        disabled={updatingApproval || componentDetails.approval_status === 'approved'}
                                        className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-xs font-medium rounded-md transition-colors"
                                      >
                                        Approve
                                      </button>
                                      <button
                                        onClick={() => handleApprovalAction('deny')}
                                        disabled={updatingApproval || componentDetails.approval_status === 'archived'}
                                        className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-xs font-medium rounded-md transition-colors"
                                      >
                                        Deny
                                      </button>
                                    </>
                                  )}
                                  {canWrite() && (
                                    <>
                                      <button
                                        onClick={() => handleApprovalAction('send_to_review')}
                                        disabled={updatingApproval || componentDetails.approval_status === 'pending review'}
                                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-xs font-medium rounded-md transition-colors"
                                      >
                                        Review
                                      </button>
                                      <button
                                        onClick={() => handleApprovalAction('send_to_prototype')}
                                        disabled={updatingApproval || componentDetails.approval_status === 'experimental'}
                                        className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-xs font-medium rounded-md transition-colors"
                                      >
                                        Prototype
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>

                              {updatingApproval && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">Processing...</p>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  ) : (
                    <div className="col-span-2 text-center py-8 text-gray-500 dark:text-gray-400">
                      <p>Select a component to view details</p>
                      <p className="text-sm mt-2">or click "Add Component" to create a new one</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Distributor Info - Shows distributors for selected alternative or primary component - View Mode Only */}
          {!isEditMode && !isAddMode && (
            <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Distributor Information</h3>
              {selectedComponent && selectedAlternative?.distributors && selectedAlternative.distributors.length > 0 ? (
              <div className="space-y-4">
                {(() => {
                  // Sort distributors in the standard order: Digikey, Mouser, Arrow, Newark
                  const distributorOrder = ['Digikey', 'Mouser', 'Arrow', 'Newark'];
                  const sortedDistributors = [...selectedAlternative.distributors].sort((a, b) => {
                    const indexA = distributorOrder.indexOf(a.distributor_name);
                    const indexB = distributorOrder.indexOf(b.distributor_name);
                    // If not in the list, put at the end
                    const orderA = indexA === -1 ? 999 : indexA;
                    const orderB = indexB === -1 ? 999 : indexB;
                    return orderA - orderB;
                  });
                  
                  return sortedDistributors.map((dist, index) => (
                  <div key={index} className="border-b border-gray-100 dark:border-[#3a3a3a] pb-4 last:border-0">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{dist.distributor_name}</p>
                      {dist.url && (
                        <a 
                          href={dist.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-blue-600 dark:text-blue-400 hover:underline text-xs"
                        >
                          Link
                        </a>
                      )}
                    </div>
                    {dist.sku && (
                      <div className="flex items-center gap-2 mb-1">
                        <button
                          onClick={() => handleCopyToClipboard(dist.sku, `sku_${index}`)}
                          className="text-xs text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors cursor-pointer underline decoration-dotted"
                          title="Click to copy SKU"
                        >
                          SKU: {dist.sku}
                        </button>
                        {copiedText === `sku_${index}` && (
                          <span className="text-xs text-green-600 dark:text-green-400">Copied!</span>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Stock: {dist.stock_quantity || 'N/A'}</p>
                    {dist.price_breaks && dist.price_breaks.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Price Breaks:</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                          {dist.price_breaks.map((priceBreak, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-gray-50 dark:bg-[#333333] px-2 py-1 rounded">
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{priceBreak.quantity}+:</span>
                              <span className="text-xs font-semibold text-green-600 dark:text-green-400">${Number(priceBreak.price).toFixed(4)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  ));
                })()}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">No distributor information available</p>
            )}
            </div>
          )}
        </div>

        {/* Fourth Column - Specifications & Alternative Parts (Edit/Add Mode Only) */}
        {(isEditMode || isAddMode) && (
          <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar" data-panel>
            {/* Specifications Panel - For inputting values */}
            <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Specifications</h3>
                <button
                  type="button"
                  onClick={() => {
                    const newSpec = {
                      category_spec_id: null,
                      spec_name: '',
                      spec_value: '',
                      unit: '',
                      mapping_spec_names: [],
                      is_required: false,
                      is_custom: true // Mark as custom spec
                    };
                    handleFieldChange('specifications', [...(editData.specifications || []), newSpec]);
                  }}
                  className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 text-xs font-medium flex items-center gap-1 px-2 py-1 border border-primary-600 dark:border-primary-400 rounded hover:bg-primary-50 dark:hover:bg-primary-900/20"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Spec</span>
                </button>
              </div>
              <div className="text-sm">
                {(editData.specifications || []).length > 0 ? (
                  <div className="space-y-2">
                    {/* Header row */}
                    <div className="grid grid-cols-[minmax(100px,1fr)_minmax(100px,1.5fr)_minmax(50px,0.5fr)_minmax(150px,2fr)_auto] gap-2 text-xs text-gray-500 dark:text-gray-400 font-medium px-1">
                      <span>Spec Name</span>
                      <span>Value</span>
                      <span>Unit</span>
                      <span>Keywords (Vendor Mapping)</span>
                      <span></span>
                    </div>
                    {(editData.specifications || []).map((spec, index) => (
                      <div key={index} className="grid grid-cols-[minmax(100px,1fr)_minmax(100px,1.5fr)_minmax(50px,0.5fr)_minmax(150px,2fr)_auto] gap-2 items-start">
                        {/* Spec Name - Editable for custom specs, read-only for template specs */}
                        {spec.is_custom ? (
                          <input
                            type="text"
                            value={spec.spec_name || ''}
                            onChange={(e) => {
                              const newSpecs = [...(editData.specifications || [])];
                              newSpecs[index] = { ...newSpecs[index], spec_name: e.target.value };
                              handleFieldChange('specifications', newSpecs);
                            }}
                            placeholder="Spec Name"
                            className="px-2 py-1 border border-gray-300 dark:border-[#444444] rounded text-xs bg-white dark:bg-[#333333] dark:text-gray-100"
                          />
                        ) : (
                          <div className="flex items-center py-1">
                            <span className="text-xs text-gray-700 dark:text-gray-300">
                              {spec.spec_name}
                              {spec.is_required && <span className="text-red-500 ml-1">*</span>}
                            </span>
                          </div>
                        )}
                        <input
                          type="text"
                          value={spec.spec_value || ''}
                          onChange={(e) => {
                            const newSpecs = [...(editData.specifications || [])];
                            newSpecs[index] = { ...newSpecs[index], spec_value: e.target.value };
                            handleFieldChange('specifications', newSpecs);
                          }}
                          placeholder="Value"
                          className="px-2 py-1 border border-gray-300 dark:border-[#444444] rounded text-xs bg-white dark:bg-[#333333] dark:text-gray-100"
                        />
                        {/* Unit field - Editable for custom specs */}
                        {spec.is_custom ? (
                          <input
                            type="text"
                            value={spec.unit || ''}
                            onChange={(e) => {
                              const newSpecs = [...(editData.specifications || [])];
                              newSpecs[index] = { ...newSpecs[index], unit: e.target.value };
                              handleFieldChange('specifications', newSpecs);
                            }}
                            placeholder="Unit"
                            className="px-2 py-1 border border-gray-300 dark:border-[#444444] rounded text-xs bg-white dark:bg-[#333333] dark:text-gray-100"
                          />
                        ) : (
                          <div className="flex items-center py-1 text-xs text-gray-500 dark:text-gray-400">
                            {spec.unit || '-'}
                          </div>
                        )}
                        {/* Keywords column - Shows current mappings and allows adding more */}
                        <div className="flex flex-wrap gap-1 items-center min-h-[26px]">
                          {(spec.mapping_spec_names || []).map((keyword, keywordIndex) => (
                            <span
                              key={keywordIndex}
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded text-xs"
                            >
                              {keyword}
                              <button
                                type="button"
                                onClick={() => {
                                  const newSpecs = [...(editData.specifications || [])];
                                  const newMappings = (spec.mapping_spec_names || []).filter((_, ki) => ki !== keywordIndex);
                                  newSpecs[index] = { ...newSpecs[index], mapping_spec_names: newMappings };
                                  handleFieldChange('specifications', newSpecs);
                                }}
                                className="ml-0.5 text-blue-500 dark:text-blue-400 hover:text-red-500 dark:hover:text-red-400"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                          <button
                            type="button"
                            onClick={() => handleOpenMappingModal(index, spec)}
                            className="text-xs px-1.5 py-0.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded border border-dashed border-blue-300 dark:border-blue-700 transition-colors flex items-center gap-0.5"
                            title="Add keyword mapping"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add</span>
                          </button>
                        </div>
                        {/* Action buttons container */}
                        <div className="flex items-center">
                          {/* Remove button - only for custom specs or non-required specs */}
                          {(spec.is_custom || !spec.is_required) && (
                            <button
                              type="button"
                              onClick={() => {
                                const newSpecs = (editData.specifications || []).filter((_, i) => i !== index);
                                handleFieldChange('specifications', newSpecs);
                              }}
                              className="text-xs p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                              title="Remove specification"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {isAddMode ? 'Select a category to see available specifications, or add custom specs' : 'No specifications defined. Click "Add Spec" to add custom specifications.'}
                  </p>
                )}
              </div>
            </div>

            {/* Alternative Parts Tile - Shown in Edit Mode and Add Mode */}
            <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Alternative Parts
                </h3>
                <button
                  type="button"
                  onClick={handleAddAlternative}
                  className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 text-sm font-medium flex items-center gap-1 px-3 py-1.5 border border-primary-600 dark:border-primary-400 rounded-md hover:bg-primary-50 dark:hover:bg-primary-900/20"
                >
                  <span>+ Add Alternative</span>
                </button>
              </div>
              
              {(!editData.alternatives || editData.alternatives.length === 0) ? (
                <div className="px-4 py-8 border-2 border-dashed border-gray-300 dark:border-[#444444] rounded-md bg-gray-50 dark:bg-[#252525] text-gray-500 dark:text-gray-400 text-sm text-center">
                  No alternative parts added yet. Click "+ Add Alternative" to add one.
                </div>
              ) : (
                <div className="space-y-3 max-h-150 overflow-y-auto pr-2 custom-scrollbar">
                  {editData.alternatives.map((alt, altIndex) => (
                    <div key={altIndex} className="border border-gray-300 dark:border-[#444444] rounded-md p-4 bg-white dark:bg-[#2a2a2a]">
                      {/* Alternative header with promote and delete buttons */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Alternative #{altIndex + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handlePromoteToPrimary(altIndex)}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 px-2 py-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded border border-blue-600 dark:border-blue-400"
                            title="Promote this alternative to become the primary part"
                          >
                            ↑ Promote to Primary
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAlternative(altIndex)}
                            className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 px-2 py-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                            title="Delete alternative"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {/* Manufacturer and MFG Part Number */}
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div 
                          ref={el => altManufacturerRefs.current[altIndex] = el}
                          className="relative"
                        >
                          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                            Manufacturer <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              value={altManufacturerInputs[altIndex] || ''}
                              onChange={(e) => {
                                setAltManufacturerInputs(prev => ({ ...prev, [altIndex]: e.target.value }));
                                setAltManufacturerOpen(prev => ({ ...prev, [altIndex]: true }));
                              }}
                              onFocus={() => setAltManufacturerOpen(prev => ({ ...prev, [altIndex]: true }))}
                              placeholder="Type or select"
                              className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-[#444444] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
                            />
                            <button
                              type="button"
                              onClick={() => setAltManufacturerOpen(prev => ({ ...prev, [altIndex]: !prev[altIndex] }))}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>
                            {altManufacturerOpen[altIndex] && (() => {
                              const filtered = manufacturers?.filter(mfr => 
                                mfr.name.toLowerCase().includes((altManufacturerInputs[altIndex] || '').toLowerCase())
                              ) || [];
                              const exactMatch = filtered.find(mfr => 
                                mfr.name.toLowerCase() === (altManufacturerInputs[altIndex] || '').toLowerCase()
                              );
                              const showCreateOption = (altManufacturerInputs[altIndex] || '').trim() && !exactMatch;
                              
                              return (
                                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#2a2a2a] border border-gray-300 dark:border-[#444444] rounded-md shadow-lg max-h-60 overflow-y-auto custom-scrollbar">
                                  {showCreateOption && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        // Store new manufacturer name with special marker for later creation
                                        handleUpdateAlternative(altIndex, 'manufacturer_id', `NEW:${altManufacturerInputs[altIndex].trim()}`);
                                        setAltManufacturerOpen(prev => ({ ...prev, [altIndex]: false }));
                                      }}
                                      className="w-full text-left px-3 py-2 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-medium text-sm flex items-center gap-2"
                                    >
                                      <Plus className="w-4 h-4" />
                                      Use new: "{altManufacturerInputs[altIndex].trim()}" (will be added on save)
                                    </button>
                                  )}
                                  {filtered.length > 0 ? (
                                    filtered.map(mfr => (
                                      <button
                                        key={mfr.id}
                                        type="button"
                                        onClick={() => {
                                          setAltManufacturerInputs(prev => ({ ...prev, [altIndex]: mfr.name }));
                                          handleUpdateAlternative(altIndex, 'manufacturer_id', mfr.id);
                                          setAltManufacturerOpen(prev => ({ ...prev, [altIndex]: false }));
                                        }}
                                        className={`w-full text-left px-3 py-2 text-sm ${
                                          alt.manufacturer_id === mfr.id
                                            ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                                            : 'hover:bg-gray-100 dark:hover:bg-[#333333] text-gray-700 dark:text-gray-300'
                                        }`}
                                      >
                                        {mfr.name}
                                      </button>
                                    ))
                                  ) : !showCreateOption && (
                                    <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                                      No manufacturers found
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                            MFG Part Number <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={alt.manufacturer_pn || ''}
                            onChange={(e) => handleUpdateAlternative(altIndex, 'manufacturer_pn', e.target.value)}
                            placeholder="e.g., RC0805FR"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
                          />
                        </div>
                      </div>

                      {/* Distributors section - Always show all 4 distributors */}
                      <div className="border-t border-gray-200 dark:border-[#444444] pt-3 mt-3">
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                          Distributors
                        </label>
                        <div className="space-y-1">
                          {(() => {
                            // Ensure all 4 distributors are always shown in correct order
                            const distributorOrder = ['Digikey', 'Mouser', 'Arrow', 'Newark'];
                            const altDistributors = alt.distributors || [];
                            
                            // Normalize to always have 4 distributors in order
                            const normalizedDistributors = distributorOrder.map(distName => {
                              const dist = distributors?.find(d => d.name === distName);
                              const existing = altDistributors.find(d => {
                                const existingDistName = distributors?.find(distObj => distObj.id === d.distributor_id)?.name;
                                return existingDistName === distName;
                              });
                              
                              return {
                                distributor_id: dist?.id || null,
                                distributor_name: distName,
                                sku: existing?.sku || '',
                                url: existing?.url || ''
                              };
                            });
                            
                            // Update the alternative's distributors to ensure they're normalized
                            if (JSON.stringify(altDistributors) !== JSON.stringify(normalizedDistributors)) {
                              handleUpdateAlternative(altIndex, 'distributors', normalizedDistributors);
                            }
                            
                            return normalizedDistributors.map((dist, distIndex) => {
                              return (
                                <div key={distIndex} className="grid grid-cols-[80px_1fr_1fr] gap-2 items-center">
                                  <div className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                                    {dist.distributor_name}
                                  </div>
                                  <input
                                    type="text"
                                    value={dist.sku || ''}
                                    onChange={(e) => handleUpdateAlternativeDistributor(altIndex, distIndex, 'sku', e.target.value)}
                                    placeholder="SKU"
                                    className="w-full px-2 py-1 border border-gray-300 dark:border-[#444444] rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
                                  />
                                  <input
                                    type="text"
                                    value={dist.url || ''}
                                    onChange={(e) => handleUpdateAlternativeDistributor(altIndex, distIndex, 'url', e.target.value)}
                                    placeholder="Product URL"
                                    className="w-full px-2 py-1 border border-gray-300 dark:border-[#444444] rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
                                  />
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
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
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg shadow-md p-4 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                  <span className="text-lg">📦</span>
                  Vendor API Data ({editData._vendorSearchData.source === 'digikey' ? 'Digikey' : 'Mouser'})
                </h3>
                {isEditMode && (
                  <button
                    onClick={handleAutoFillFromVendorData}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded transition-colors"
                    title="Auto-fill Manufacturer, MFG P/N, Package, Value, Specifications, and Datasheet"
                  >
                    Auto Fill
                  </button>
                )}
              </div>
              <p className="text-xs text-blue-700 dark:text-blue-300 mb-3">
                {isEditMode 
                  ? '📋 Click any value to copy to clipboard • Use "Auto Fill" to populate basic fields • Specifications must be filled manually'
                  : 'Click any value to copy to clipboard • All data from vendor API'
                }
              </p>
              <div className="space-y-3 text-sm">
                {/* Basic Info */}
                <div className="border-b border-blue-200 dark:border-blue-800 pb-2">
                  <p className="text-blue-800 dark:text-blue-200 font-semibold text-xs mb-2 uppercase tracking-wide">Basic Information</p>
                  <div 
                    onClick={() => handleCopyToClipboard(editData._vendorSearchData.manufacturerPartNumber, 'MFG P/N')}
                    className="flex justify-between items-center py-1 px-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded cursor-pointer group"
                  >
                    <span className="text-blue-700 dark:text-blue-300 font-medium text-xs">MFG Part Number:</span>
                    <span className="text-blue-900 dark:text-blue-100 font-mono text-xs flex items-center gap-2">
                      {editData._vendorSearchData.manufacturerPartNumber}
                      <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </span>
                  </div>
                  <div 
                    onClick={() => handleCopyToClipboard(editData._vendorSearchData.manufacturer, 'Manufacturer')}
                    className="flex justify-between items-center py-1 px-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded cursor-pointer group"
                  >
                    <span className="text-blue-700 dark:text-blue-300 font-medium text-xs">Manufacturer:</span>
                    <span className="text-blue-900 dark:text-blue-100 font-mono text-xs flex items-center gap-2">
                      {editData._vendorSearchData.manufacturer}
                      <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </span>
                  </div>
                  <div 
                    onClick={() => handleCopyToClipboard(editData._vendorSearchData.description, 'Description')}
                    className="flex flex-col py-1 px-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded cursor-pointer group"
                  >
                    <span className="text-blue-700 dark:text-blue-300 font-medium mb-1 text-xs">Description:</span>
                    <span className="text-blue-900 dark:text-blue-100 text-xs flex items-start gap-2">
                      <span className="flex-1 whitespace-pre-wrap">{editData._vendorSearchData.description}</span>
                      <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
                    </span>
                  </div>
                  {editData._vendorSearchData.category && editData._vendorSearchData.category !== 'N/A' && (
                    <div 
                      onClick={() => handleCopyToClipboard(editData._vendorSearchData.category, 'Category')}
                      className="flex justify-between items-center py-1 px-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded cursor-pointer group"
                    >
                      <span className="text-blue-700 dark:text-blue-300 font-medium text-xs">Category:</span>
                      <span className="text-blue-900 dark:text-blue-100 font-mono text-xs flex items-center gap-2">
                        {editData._vendorSearchData.category}
                        <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </span>
                    </div>
                  )}
                </div>

                {/* Package & Series */}
                {(editData._vendorSearchData.packageType || editData._vendorSearchData.series) && (
                  <div className="border-b border-blue-200 dark:border-blue-800 pb-2">
                    <p className="text-blue-800 dark:text-blue-200 font-semibold text-xs mb-2 uppercase tracking-wide">Package Details</p>
                    {editData._vendorSearchData.packageType && editData._vendorSearchData.packageType !== 'N/A' && (
                      <div 
                        onClick={() => handleCopyToClipboard(editData._vendorSearchData.packageType, 'Package')}
                        className="flex justify-between items-center py-1 px-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded cursor-pointer group"
                      >
                        <span className="text-blue-700 dark:text-blue-300 font-medium text-xs">Package/Case:</span>
                        <span className="text-blue-900 dark:text-blue-100 font-mono text-xs flex items-center gap-2">
                          {editData._vendorSearchData.packageType}
                          <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </span>
                      </div>
                    )}
                    {editData._vendorSearchData.series && editData._vendorSearchData.series !== '-' && (
                      <div 
                        onClick={() => handleCopyToClipboard(editData._vendorSearchData.series, 'Series')}
                        className="flex justify-between items-center py-1 px-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded cursor-pointer group"
                      >
                        <span className="text-blue-700 dark:text-blue-300 font-medium text-xs">Series:</span>
                        <span className="text-blue-900 dark:text-blue-100 font-mono text-xs flex items-center gap-2">
                          {editData._vendorSearchData.series}
                          <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Distributor Info */}
                {editData._vendorSearchData.distributor && (
                  <div className="border-b border-blue-200 dark:border-blue-800 pb-2">
                    <p className="text-blue-800 dark:text-blue-200 font-semibold text-xs mb-2 uppercase tracking-wide">Distributor Information</p>
                    <div 
                      onClick={() => handleCopyToClipboard(editData._vendorSearchData.distributor.sku, 'Vendor SKU')}
                      className="flex justify-between items-center py-1 px-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded cursor-pointer group"
                    >
                      <span className="text-blue-700 dark:text-blue-300 font-medium text-xs">Vendor SKU:</span>
                      <span className="text-blue-900 dark:text-blue-100 font-mono text-xs flex items-center gap-2">
                        {editData._vendorSearchData.distributor.sku}
                        <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 px-2">
                      <span className="text-blue-700 dark:text-blue-300 font-medium text-xs">Stock Available:</span>
                      <span className="text-blue-900 dark:text-blue-100 font-mono text-xs font-semibold">
                        {editData._vendorSearchData.distributor.stock?.toLocaleString() || '0'} units
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 px-2">
                      <span className="text-blue-700 dark:text-blue-300 font-medium text-xs">Min Order Qty:</span>
                      <span className="text-blue-900 dark:text-blue-100 font-mono text-xs">
                        {editData._vendorSearchData.distributor.minimumOrderQuantity || '1'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Specifications */}
                {editData._vendorSearchData.specifications && Object.keys(editData._vendorSearchData.specifications).length > 0 ? (
                  <div className="border-b border-blue-200 dark:border-blue-800 pb-2">
                    <p className="text-blue-800 dark:text-blue-200 font-semibold text-xs mb-2 uppercase tracking-wide flex items-center justify-between">
                      <span>Technical Specifications</span>
                      <span className="text-blue-600 dark:text-blue-400 font-normal normal-case">
                        ({Object.keys(editData._vendorSearchData.specifications).length} specs)
                      </span>
                    </p>
                    <div className="space-y-0.5">
                      {Object.entries(editData._vendorSearchData.specifications).map(([key, val], idx) => {
                        const displayValue = typeof val === 'object' ? val.value : val;
                        const displayUnit = typeof val === 'object' ? val.unit : '';
                        // Filter out data type labels (String, UnitOfMeasure, etc.)
                        const dataTypeLabels = ['String', 'UnitOfMeasure', 'CoupledUnitOfMeasure', 'Integer', 'Boolean', 'Decimal', 'Number', 'Double'];
                        const shouldShowUnit = displayUnit && !dataTypeLabels.includes(displayUnit);
                        return (
                          <div 
                            key={idx}
                            onClick={() => handleCopyToClipboard(`${displayValue}${shouldShowUnit ? ' ' + displayUnit : ''}`, key)}
                            className="flex justify-between items-start py-1 px-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded cursor-pointer group transition-colors"
                          >
                            <span className="text-blue-700 dark:text-blue-300 text-xs font-medium shrink-0 mr-2" style={{maxWidth: '45%'}}>
                              {key}:
                            </span>
                            <span className="text-blue-900 dark:text-blue-100 text-xs text-right flex items-start gap-1 flex-1">
                              <span className="flex-1 wrap-break-word">{displayValue}{shouldShowUnit ? ` ${displayUnit}` : ''}</span>
                              <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="border-b border-blue-200 dark:border-blue-800 pb-2">
                    <p className="text-blue-800 dark:text-blue-200 font-semibold text-xs mb-2 uppercase tracking-wide">Technical Specifications</p>
                    <p className="text-blue-600 dark:text-blue-400 text-xs italic">No specifications available from vendor API</p>
                  </div>
                )}

                {/* Datasheet */}
                {editData._vendorSearchData.datasheet && (
                  <div className="border-b border-blue-200 dark:border-blue-800 pb-2">
                    <p className="text-blue-800 dark:text-blue-200 font-semibold text-xs mb-2 uppercase tracking-wide">Documentation</p>
                    <div className="flex flex-col gap-1">
                      <span className="text-blue-700 dark:text-blue-300 font-medium text-xs">Datasheet URL:</span>
                      <a 
                        href={editData._vendorSearchData.datasheet}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline text-xs break-all font-mono bg-blue-100 dark:bg-blue-900/30 p-2 rounded"
                      >
                        {editData._vendorSearchData.datasheet}
                      </a>
                    </div>
                  </div>
                )}

                {/* Price Breaks - Positioned at bottom */}
                {editData._vendorSearchData.distributor?.pricing && editData._vendorSearchData.distributor.pricing.length > 0 && (
                  <div className="pt-2">
                    <p className="text-blue-800 dark:text-blue-200 font-semibold text-xs mb-2 uppercase tracking-wide">Price Breaks</p>
                    <div className="space-y-1">
                      {editData._vendorSearchData.distributor.pricing.map((price, idx) => (
                        <div 
                          key={idx}
                          onClick={() => handleCopyToClipboard(`${price.quantity}+ @ $${price.price}`, 'Price Break')}
                          className="flex justify-between items-center py-0.5 px-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded cursor-pointer group"
                        >
                          <span className="text-blue-800 dark:text-blue-200 text-xs font-medium">{price.quantity}+ units:</span>
                          <span className="text-green-700 dark:text-green-400 font-mono text-xs font-semibold flex items-center gap-2">
                            ${typeof price.price === 'number' ? price.price.toFixed(4) : price.price}
                            <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Copy feedback */}
              {copiedText && (
                <div className="mt-3 text-xs text-center text-green-700 dark:text-green-400 font-medium animate-fade-in bg-green-100 dark:bg-green-900/30 py-2 rounded">
                  ✓ Copied "{copiedText}"!
                </div>
              )}
            </div>
          )}

          {/* Component Specifications - Only shown in View Mode */}
          {!isEditMode && !isAddMode && (
            <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Specifications</h3>
              {selectedComponent && componentDetails && componentDetails.specifications?.length > 0 ? (
                <div className="space-y-2">
                  {componentDetails.specifications.map((spec, index) => (
                    <div key={index} className="flex justify-between items-center border-b border-gray-100 dark:border-[#3a3a3a] pb-2 last:border-0">
                      <span className="text-sm text-gray-600 dark:text-gray-400">{spec.spec_name}:</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {spec.spec_value}{spec.unit ? ` ${spec.unit}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No specifications available</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modern Delete Confirmation Modal */}
      {deleteConfirmation.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-[#3a3a3a] animate-fadeIn">
            {/* Icon */}
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/20">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            
            {/* Title */}
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 text-center mb-2">
              Confirm Deletion
            </h3>
            
            {/* Message */}
            <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
              {deleteConfirmation.type === 'single' 
                ? `Are you sure you want to delete "${deleteConfirmation.componentName}"? This action cannot be undone.`
                : `Are you sure you want to delete ${deleteConfirmation.count} component(s)? This action cannot be undone.`
              }
            </p>
            
            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={cancelDelete}
                className="flex-1 px-4 py-2.5 bg-gray-200 dark:bg-[#333333] text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-[#3a3a3a] transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern ECO Delete Confirmation Modal */}
      {ecoDeleteConfirmation.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-[#3a3a3a] animate-fadeIn">
            {/* Icon */}
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-yellow-100 dark:bg-yellow-900/20">
              <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            
            {/* Title */}
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 text-center mb-2">
              Mark Component for Deletion
            </h3>
            
            {/* Message */}
            <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
              This will create an ECO to delete <span className="font-semibold text-gray-900 dark:text-gray-100">"{selectedComponent?.part_number}"</span>. 
              The deletion will be pending until an approver reviews and approves this ECO.
            </p>
            
            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setEcoDeleteConfirmation({ show: false })}
                className="flex-1 px-4 py-2.5 bg-gray-200 dark:bg-[#333333] text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-[#3a3a3a] transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmECODeletion}
                className="flex-1 px-4 py-2.5 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Mark for Deletion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Promote to Primary Confirmation Modal */}
      {promoteConfirmation.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-2xl max-w-lg w-full p-6 border border-gray-200 dark:border-[#3a3a3a] animate-fadeIn">
            {/* Icon */}
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-blue-100 dark:bg-blue-900/20">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
              </svg>
            </div>
            
            {/* Title */}
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 text-center mb-4">
              Promote to Primary Part
            </h3>
            
            {/* Swap Preview */}
            <div className="space-y-4 mb-6">
              {/* Current Primary → Alternative */}
              <div className="bg-red-50 dark:bg-red-900/10 rounded-lg p-4 border border-red-200 dark:border-red-800">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  <p className="font-semibold text-red-900 dark:text-red-100 text-sm">Current Primary → Alternative</p>
                </div>
                <p className="text-gray-700 dark:text-gray-300 font-mono text-sm pl-7">
                  {promoteConfirmation.currentData?.manufacturer} {promoteConfirmation.currentData?.partNumber}
                </p>
              </div>
              
              {/* Alternative → New Primary */}
              <div className="bg-green-50 dark:bg-green-900/10 rounded-lg p-4 border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                  <p className="font-semibold text-green-900 dark:text-green-100 text-sm">Alternative → New Primary</p>
                </div>
                <p className="text-gray-700 dark:text-gray-300 font-mono text-sm pl-7">
                  {promoteConfirmation.altData?.manufacturer} {promoteConfirmation.altData?.partNumber}
                </p>
              </div>
            </div>
            
            {/* Info Message */}
            <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-3 mb-6 border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>What will happen:</strong>
              </p>
              <ul className="text-sm text-blue-800 dark:text-blue-200 mt-2 space-y-1 list-disc list-inside">
                <li>Manufacturer and part number will be swapped</li>
                <li>Distributor information will be swapped</li>
                <li>Both parts will retain their data (no data loss)</li>
              </ul>
            </div>
            
            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setPromoteConfirmation({ show: false, altIndex: null, altData: null, currentData: null })}
                className="flex-1 px-4 py-2.5 bg-gray-200 dark:bg-[#333333] text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-[#3a3a3a] transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmPromoteToPrimary}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                </svg>
                Promote
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Warning Modal */}
      {warningModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60 p-4">
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-[#3a3a3a] animate-fadeIn">
            {/* Icon */}
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-yellow-100 dark:bg-yellow-900/20">
              <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            
            {/* Title */}
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 text-center mb-2">
              Warning
            </h3>
            
            {/* Message */}
            <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
              {warningModal.message}
            </p>
            
            {/* Button */}
            <button
              onClick={() => setWarningModal({ show: false, message: '' })}
              className="w-full px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Add to Project Modal */}
      {showAddToProjectModal && selectedComponent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <FolderKanban className="w-5 h-5" />
                Add to Project
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowAddToProjectModal(false);
                  setSelectedProjectId('');
                  setProjectQuantity(1);
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Component Info */}
              <div className="p-3 bg-gray-50 dark:bg-[#333333] rounded-lg">
                <p className="font-semibold text-gray-900 dark:text-gray-100">
                  {selectedComponent.part_number}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {selectedComponent.manufacturer_name} - {selectedComponent.manufacturer_pn}
                </p>
              </div>

              {/* Project Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Project *
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => {
                    e.stopPropagation();
                    setSelectedProjectId(e.target.value);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100"
                >
                  <option value="">-- Select a Project --</option>
                  {projects?.filter(p => p.status === 'active').map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Quantity *
                </label>
                <input
                  type="number"
                  min="1"
                  value={projectQuantity}
                  onChange={(e) => {
                    e.stopPropagation();
                    setProjectQuantity(e.target.value);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowAddToProjectModal(false);
                  setSelectedProjectId('');
                  setProjectQuantity(1);
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddToProject}
                disabled={!selectedProjectId || projectQuantity <= 0}
                className="btn-primary disabled:bg-gray-400"
              >
                Add to Project
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto Fill Toast Notification */}
      {autoFillToast.show && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-slide-in">
          <div className="bg-green-500 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 min-w-75">
            <div className="shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">{autoFillToast.message}</p>
              <p className="text-xs text-green-100 mt-1">
                {autoFillToast.count} field{autoFillToast.count > 1 ? 's' : ''} updated from vendor data
              </p>
            </div>
            <button
              onClick={() => setAutoFillToast({ show: false, message: '', count: 0 })}
              className="shrink-0 text-white hover:text-green-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Quick-Add Vendor Mapping Modal */}
      {mappingModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg p-6 max-w-lg w-full border border-gray-200 dark:border-[#3a3a3a] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {mappingModal.spec ? 'Add Vendor Field Mapping' : 'New Specification'}
              </h3>
              <button
                onClick={handleCloseMappingModal}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {mappingModal.spec ? (
              // Mode: Add mapping to existing specification
              <>
                {/* Specification Info */}
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Specification:</p>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">
                    {mappingModal.spec.spec_name}
                    {mappingModal.spec.unit && <span className="text-gray-500 ml-2">({mappingModal.spec.unit})</span>}
                  </p>
                  
                  {/* Show current mappings */}
                  {mappingModal.spec.mapping_spec_names && mappingModal.spec.mapping_spec_names.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Current mappings:</p>
                      <div className="flex flex-wrap gap-1">
                        {mappingModal.spec.mapping_spec_names.map((mapping, idx) => (
                          <span
                            key={idx}
                            className="inline-flex px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full text-xs"
                          >
                            {mapping}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Available vendor fields from current vendor data */}
                {editData._vendorSearchData?.specifications && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Select from vendor fields:
                    </p>
                    <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-[#444444] rounded-lg">
                      {Object.keys(editData._vendorSearchData.specifications).map((fieldName, idx) => {
                        const isAlreadyMapped = mappingModal.spec.mapping_spec_names?.includes(fieldName);
                        return (
                          <button
                            type="button"
                            key={idx}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (!isAlreadyMapped) {
                                handleAddMapping(fieldName);
                              }
                            }}
                            disabled={isAlreadyMapped}
                            className={`w-full text-left px-3 py-2 text-sm border-b border-gray-200 dark:border-[#444444] last:border-b-0 transition-colors ${
                              isAlreadyMapped
                                ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                                : 'hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-900 dark:text-gray-100'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span>{fieldName}</span>
                              {isAlreadyMapped && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">(already mapped)</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Or enter new mapping */}
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Or enter a new vendor field name:
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={mappingModal.newMapping}
                      onChange={(e) => setMappingModal(prev => ({ ...prev, newMapping: e.target.value }))}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && mappingModal.newMapping.trim()) {
                          e.preventDefault();
                          handleAddNewMapping();
                        }
                      }}
                      placeholder="e.g., Capacitance, Cap, C"
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleAddNewMapping();
                      }}
                      disabled={!mappingModal.newMapping.trim()}
                      className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white rounded-md transition-colors text-sm font-medium"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleCloseMappingModal}
                    className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md transition-colors text-sm font-medium"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              // Mode: Create new specification
              <>
                <div className="space-y-4 mb-4">
                  {/* Specification Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Specification Name *
                    </label>
                    <input
                      type="text"
                      value={mappingModal.newSpecName}
                      onChange={(e) => setMappingModal(prev => ({ ...prev, newSpecName: e.target.value }))}
                      placeholder="e.g., Capacitance, Voltage Rating"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                    />
                  </div>

                  {/* Unit */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Unit (optional)
                    </label>
                    <input
                      type="text"
                      value={mappingModal.newSpecUnit}
                      onChange={(e) => setMappingModal(prev => ({ ...prev, newSpecUnit: e.target.value }))}
                      placeholder="e.g., F, V, Ω"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                    />
                  </div>

                  {/* Available vendor fields */}
                  {editData._vendorSearchData?.specifications && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Select vendor field to map (optional):
                      </p>
                      <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-[#444444] rounded-lg">
                        {Object.keys(editData._vendorSearchData.specifications).map((fieldName, idx) => (
                          <button
                            key={idx}
                            onClick={() => setMappingModal(prev => ({ ...prev, newMapping: fieldName }))}
                            className={`w-full text-left px-3 py-2 text-sm border-b border-gray-200 dark:border-[#444444] last:border-b-0 transition-colors ${
                              mappingModal.newMapping === fieldName
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-900 dark:text-gray-100'
                            }`}
                          >
                            {fieldName}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Or enter custom mapping */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Or enter custom vendor field name:
                    </label>
                    <input
                      type="text"
                      value={mappingModal.newMapping}
                      onChange={(e) => setMappingModal(prev => ({ ...prev, newMapping: e.target.value }))}
                      placeholder="e.g., Capacitance, Cap, C"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={handleCloseMappingModal}
                    className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md transition-colors text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateNewSpecification}
                    disabled={!mappingModal.newSpecName.trim()}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-md transition-colors text-sm font-medium"
                  >
                    Create Specification
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Library;
