import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { Search, Edit, Trash2, Plus, X, Check, AlertTriangle, AlertCircle, Copy, ChevronDown } from 'lucide-react';

// Component Library - Fixed 3-Column Layout
const Library = () => {
  const location = useLocation();
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAddMode, setIsAddMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [bulkDeleteMode, setBulkDeleteMode] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState(new Set());
  const [deleteConfirmation, setDeleteConfirmation] = useState({ show: false, type: '', count: 0, componentName: '' });
  const [warningModal, setWarningModal] = useState({ show: false, message: '' });
  const [sortBy, setSortBy] = useState('part_number');
  const [sortOrder, setSortOrder] = useState('asc');
  const [copiedText, setCopiedText] = useState('');
  
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
    navigator.clipboard.writeText(text).then(() => {
      setCopiedText(label);
      setTimeout(() => setCopiedText(''), 2000);
    });
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
    queryKey: ['components', selectedCategory, searchTerm],
    queryFn: async () => {
      const response = await api.getComponents({
        category: selectedCategory,
        search: searchTerm,
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

  // Fetch distributors for dropdown and ID mapping
  const { data: distributors } = useQuery({
    queryKey: ['distributors'],
    queryFn: async () => {
      const response = await api.getDistributors();
      return response.data;
    },
  });

  // Handle incoming vendor data from vendor search
  useEffect(() => {
    if (location.state?.vendorData && distributors && manufacturers) {
      const vendorData = location.state.vendorData;
      
      // Extract Package/Case from specifications
      let packageFromSpecs = vendorData.packageType || '';
      if (vendorData.specifications) {
        // Look for "Package / Case" parameter
        const packageSpec = Object.entries(vendorData.specifications).find(
          ([key, val]) => key === 'Package / Case' || key === 'Package'
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
          price: dist.pricing?.[0]?.price || '',
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
          price: vendorData.distributor.pricing?.[0]?.price || '',
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
        status: 'Active',
        notes: vendorData.series ? `Series: ${vendorData.series}` : '',
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
        const existing = existingDistributors.find(d => {
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
    setIsEditMode(true);
    setIsAddMode(false);
    
    // Set manufacturer input for type-ahead
    const manufacturerName = manufacturers?.find(m => m.id === componentDetails?.manufacturer_id)?.name || '';
    setManufacturerInput(manufacturerName);
    
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
        price: existing?.price || null,
        in_stock: existing?.in_stock || false,
        stock_quantity: existing?.stock_quantity || 0
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
        const existing = existingDistributors.find(d => {
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
        : []
    });
    
    // Initialize alternative manufacturer inputs
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
        // Extract specifications and distributors from editData
        const { specifications, distributors, ...componentData } = editData;
        
        // Update component basic data
        await updateMutation.mutateAsync({ id: selectedComponent.id, data: componentData });
        
        // Filter and update specifications (only non-empty values)
        // Ensure we're sending category_spec_id and spec_value
        const validSpecs = specifications?.filter(spec => 
          spec.category_spec_id && spec.spec_value && spec.spec_value.trim() !== ''
        ).map(spec => ({
          category_spec_id: spec.category_spec_id,
          spec_value: spec.spec_value
        })) || [];
        
        if (validSpecs.length > 0) {
          await api.updateComponentSpecifications(selectedComponent.id, { specifications: validSpecs });
        } else {
          // If no valid specs, clear all specifications
          await api.updateComponentSpecifications(selectedComponent.id, { specifications: [] });
        }
        
        // Filter and update distributors (only with valid distributor_id and sku)
        const validDistributors = distributors?.filter(dist => 
          dist.distributor_id && (dist.sku?.trim() || dist.url?.trim())
        ).map(dist => ({
          id: dist.id, // Keep existing ID if updating
          distributor_id: dist.distributor_id,
          sku: dist.sku || '',
          url: dist.url || '',
          price: dist.price || null,
          in_stock: dist.in_stock || false,
          stock_quantity: dist.stock_quantity || 0
        })) || [];
        
        if (validDistributors.length > 0) {
          await api.updateComponentDistributors(selectedComponent.id, { distributors: validDistributors });
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
            
            if (alt.id && existingIds.has(alt.id)) {
              // Update existing alternative
              await api.updateComponentAlternative(selectedComponent.id, alt.id, {
                manufacturer_id: alt.manufacturer_id,
                manufacturer_pn: alt.manufacturer_pn,
                distributors: alt.distributors?.filter(d => d.distributor_id && (d.sku?.trim() || d.url?.trim())).map(d => ({
                  distributor_id: d.distributor_id,
                  sku: d.sku || '',
                  url: d.url || ''
                })) || []
              });
            } else {
              // Create new alternative
              await api.createComponentAlternative(selectedComponent.id, {
                manufacturer_id: alt.manufacturer_id,
                manufacturer_pn: alt.manufacturer_pn,
                distributors: alt.distributors?.filter(d => d.distributor_id && (d.sku?.trim() || d.url?.trim())).map(d => ({
                  distributor_id: d.distributor_id,
                  sku: d.sku || '',
                  url: d.url || ''
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

  const handleDelete = () => {
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
    
    // Get category prefix (e.g., "Resistors" -> "RES")
    const prefix = category.name.substring(0, 3).toUpperCase();
    
    // Filter components by category
    const categoryComponents = components.filter(
      comp => comp.category_id === parseInt(categoryId) || comp.category_name === category.name
    );
    
    if (categoryComponents.length === 0) {
      return `${prefix}-0001`;
    }
    
    // Extract numbers from part numbers with this prefix
    const numbers = categoryComponents
      .map(comp => {
        const match = comp.part_number?.match(new RegExp(`^${prefix}-(\\d+)`));
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(num => !isNaN(num) && num > 0);
    
    // Find the highest number
    const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
    const nextNumber = maxNumber + 1;
    
    // Format with leading zeros (4 digits)
    const paddedNumber = String(nextNumber).padStart(4, '0');
    
    return `${prefix}-${paddedNumber}`;
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
      } catch (error) {
        console.error('Error loading sub-category suggestions:', error);
      }
    }
    
    if (isAddMode) {
      const nextPartNumber = generateNextPartNumber(categoryId);
      handleFieldChange('part_number', nextPartNumber);
      
      // Load category specifications (from new schema)
      try {
        const response = await api.getCategorySpecifications(categoryId);
        const categorySpecs = response.data || [];
        
        // Convert category specs to editable format with empty values
        // Store category_spec_id to link back to the master spec definition
        const autoSpecs = categorySpecs.map(spec => ({
          category_spec_id: spec.id,
          spec_name: spec.spec_name,
          spec_value: '',
          unit: spec.unit || '',
          is_required: spec.is_required,
          display_order: spec.display_order
        }));
        
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
    // Validate required fields
    if (!editData.category_id || !editData.part_number) {
      setWarningModal({ show: true, message: 'Please fill in all required fields marked with * symbol' });
      return;
    }
    
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

    if (editData.category_id && editData.part_number) {
      try {
        // Extract specifications and distributors from editData
        const { specifications, distributors, ...componentData } = editData;
        
        // Create component
        const response = await addMutation.mutateAsync(componentData);
        const newComponentId = response.data?.id;
        
        // Filter and add specifications (only non-empty values)
        // Ensure we're sending category_spec_id and spec_value
        const validSpecs = specifications?.filter(spec => 
          spec.category_spec_id && spec.spec_value && spec.spec_value.trim() !== ''
        ).map(spec => ({
          category_spec_id: spec.category_spec_id,
          spec_value: spec.spec_value
        })) || [];
        
        if (newComponentId && validSpecs.length > 0) {
          await api.updateComponentSpecifications(newComponentId, { specifications: validSpecs });
        }
        
        // Filter and add distributors (only with valid distributor_id and sku)
        const validDistributors = distributors?.filter(dist => 
          dist.distributor_id && (dist.sku?.trim() || dist.url?.trim())
        ).map(dist => ({
          distributor_id: dist.distributor_id,
          sku: dist.sku || '',
          url: dist.url || '',
          price: dist.price || null,
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
            
            await api.createComponentAlternative(newComponentId, {
              manufacturer_id: alt.manufacturer_id,
              manufacturer_pn: alt.manufacturer_pn,
              distributors: alt.distributors?.filter(d => d.distributor_id && (d.sku?.trim() || d.url?.trim())).map(d => ({
                distributor_id: d.distributor_id,
                sku: d.sku || '',
                url: d.url || ''
              })) || []
            });
          }
        }
        
        // Cleanup will be handled by mutation's onSuccess
      } catch (error) {
        console.error('Error adding component:', error);
        setWarningModal({ show: true, message: 'Failed to add component. Please try again.' });
      }
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

  const handleAddAlternativeDistributor = (altIndex) => {
    setEditData((prev) => {
      const updatedAlternatives = [...(prev.alternatives || [])];
      updatedAlternatives[altIndex].distributors = [
        ...(updatedAlternatives[altIndex].distributors || []),
        {
          distributor_id: '',
          sku: '',
          url: ''
        }
      ];
      return { ...prev, alternatives: updatedAlternatives };
    });
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

  const handleDeleteAlternativeDistributor = (altIndex, distIndex) => {
    setEditData((prev) => {
      const updatedAlternatives = [...(prev.alternatives || [])];
      updatedAlternatives[altIndex].distributors = updatedAlternatives[altIndex].distributors.filter((_, i) => i !== distIndex);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Component Library</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Browse and manage your component library</p>
      </div>

      {/* 5-Column Layout: Left Sidebar | Center List (wider) | Components Details & Distributor Info & Specs | Alternative Parts (edit/add) | Vendor API Data & Specifications */}
      {/* Full screen width layout with wider component list */}
      <div className={`grid grid-cols-1 gap-4 min-h-[600px] ${
        (isEditMode || isAddMode) 
          ? 'xl:grid-cols-[minmax(250px,250px)_minmax(650px,2.5fr)_minmax(550px,2fr)_minmax(400px,1.5fr)_minmax(350px,1.2fr)]'
          : 'xl:grid-cols-[minmax(250px,250px)_minmax(650px,2.5fr)_minmax(550px,2fr)_minmax(350px,1.2fr)]'
      }`}>
        {/* Left Sidebar - Filters */}
        <div className="space-y-4 xl:w-[250px]">
          {/* Category Selector */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Category</h3>
            <div className="space-y-2">
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

          {/* Search */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Search</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Full data search ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
              />
            </div>

            {/* Sorting Controls */}
            <div className="mt-3 space-y-2">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Sort</h3>
              <div className="flex items-center gap-3">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-[#444444] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
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
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 dark:text-gray-400 w-[52px]">Order:</label>
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
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
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
                    onClick={handleSave}
                    className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Save Changes
                  </button>
                  <button
                    onClick={() => {
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
                  <button 
                    onClick={handleAddNew}
                    className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Component
                  </button>
                  {selectedComponent && (
                    <button
                      onClick={handleEdit}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Edit className="w-4 h-4" />
                      Edit Component
                    </button>
                  )}
                  <button
                    onClick={toggleBulkDeleteMode}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Components
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Center - Component List (Hidden in Edit Mode and Add Mode) */}
        {!isEditMode && !isAddMode && (
          <div className="space-y-4 xl:min-w-[650px]">
            {/* Component List */}
            <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] h-full">
              <div className="p-4 border-b border-gray-200 dark:border-[#3a3a3a]">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Components ({components?.length || 0})
                  {bulkDeleteMode && <span className="text-sm text-red-600 dark:text-red-400 ml-2">(Select to delete)</span>}
                </h3>
              </div>
            <div className="overflow-auto custom-scrollbar" style={{maxHeight: 'calc(100vh - 300px)'}}>
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : components?.length > 0 ? (
                <table className="w-full">
                  <colgroup>
                    {bulkDeleteMode && <col style={{width: '48px'}} />}
                    <col style={{width: '150px'}} /> {/* Part Number*/}
                    <col style={{width: '180px'}} /> {/* MFR Part # */}
                    <col style={{width: '120px'}} /> {/* Value - new position */}
                    <col style={{width: 'auto'}} />   {/* Description - takes remaining space */}
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
        <div className="space-y-4 xl:min-w-[550px]">
          {/* Component Details - Always Shown */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a]">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {isAddMode ? 'Add New Component' : 'Component Details'}
            </h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              {(isEditMode || isAddMode) ? (
                <>
                  {/* ROW 1: Part Number, Part Type (Category), Value */}
                  <div class="col-span-2">
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">
                      Part Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editData.part_number || ''}
                      onChange={(e) => handleFieldChange('part_number', e.target.value)}
                      disabled={isAddMode || isEditMode}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm disabled:bg-gray-100 dark:disabled:bg-[#2a2a2a] disabled:cursor-not-allowed"
                      placeholder={isAddMode ? "Select category first" : "e.g., RES-0001"}
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
                  

                  {/* ROW 2: Value (again), Package */}
                  <div className="col-span-2">
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
                    <input
                      type="text"
                      value={editData.package_size || ''}
                      onChange={(e) => handleFieldChange('package_size', e.target.value)}
                      placeholder="e.g., 0805"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                    />
                  </div>

                  {/* ROW 3: Manufacturer, MFG Part Number (moved up from ROW 4) */}
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
                        placeholder="Type or select manufacturer..."
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
                                onClick={async () => {
                                  try {
                                    const response = await createManufacturerMutation.mutateAsync({ 
                                      name: manufacturerInput.trim() 
                                    });
                                    const newManufacturer = response.data;
                                    handleFieldChange('manufacturer_id', newManufacturer.id);
                                    setManufacturerOpen(false);
                                  } catch (error) {
                                    console.error('Error creating manufacturer:', error);
                                    setWarningModal({ 
                                      show: true, 
                                      message: 'Failed to create manufacturer. Please try again.' 
                                    });
                                  }
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-medium text-sm flex items-center gap-2"
                              >
                                <Plus className="w-4 h-4" />
                                Create: "{manufacturerInput.trim()}"
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
                  <div className="col-span-2">
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">
                      MFG Part Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editData.manufacturer_pn || editData.manufacturer_part_number || ''}
                      onChange={(e) => handleFieldChange('manufacturer_part_number', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                      placeholder="e.g., CRCW0603, STM32F103C8T6"
                    />
                  </div>

                  {/* ROW 5: Sub-Category 1, Sub-Category 2, Sub-Category 3 */}
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
                        placeholder={editData.category_id ? "Type or select..." : "Select category first"}
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
                      <div className="text-xs text-gray-500 mb-1">(Select sub-cat 1 first)</div>
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
                        placeholder={editData.sub_category1 ? "Type or select..." : "Select sub-category 1 first"}
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
                      <div className="text-xs text-gray-500 mb-1">(Select sub-cat 2 first)</div>
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
                        placeholder={editData.sub_category2 ? "Type or select..." : "Select sub-category 2 first"}
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
                  <div className="col-span-3">
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
                  <div className="col-span-3">
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">PCB Footprint</label>
                    <input
                      type="text"
                      value={editData.pcb_footprint || ''}
                      onChange={(e) => handleFieldChange('pcb_footprint', e.target.value)}
                      placeholder="e.g., C_0805"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">Schematic Symbol</label>
                    <input
                      type="text"
                      value={editData.schematic || ''}
                      onChange={(e) => handleFieldChange('schematic', e.target.value)}
                      placeholder="Path to symbol"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                    />
                  </div>

                  {/* ROW 8: STEP 3D Model, PSPICE Model */}
                  <div className="col-span-3">
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">STEP 3D Model</label>
                    <input
                      type="text"
                      value={editData.step_model || ''}
                      onChange={(e) => handleFieldChange('step_model', e.target.value)}
                      placeholder="Path to 3D model"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">PSPICE Model</label>
                    <input
                      type="text"
                      value={editData.pspice || ''}
                      onChange={(e) => handleFieldChange('pspice', e.target.value)}
                      placeholder="Path to simulation model"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                    />
                  </div>

                  {/* Datasheet URL */}
                  <div className="col-span-3">
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
                  <div className="col-span-3 border-t border-gray-200 dark:border-[#444444] pt-4 mt-2">
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
                      {/* Helper component for copyable text */}
                      {(() => {
                        const CopyableField = ({ label, value }) => (
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">{label}:</span>
                            <p 
                              className="font-medium text-gray-900 dark:text-gray-100 cursor-pointer hover:bg-gray-100 dark:hover:bg-[#333333] px-2 py-1 rounded transition-colors inline-block"
                              onClick={() => handleCopyToClipboard(value, label)}
                              title="Click to copy"
                            >
                              {value || 'N/A'}
                            </p>
                          </div>
                        );

                        return (
                          <>
                            {/* Row 1: Part Number, Part Type */}
                            <CopyableField label="Part Number" value={componentDetails.part_number} />
                            <div className="col-span-2">
                              <CopyableField label="Part Type" value={componentDetails.part_type || componentDetails.category_name} />
                            </div>

                            {/* Row 2: Value, Package */}
                            <CopyableField label="Value" value={componentDetails.value} />
                            <div className="col-span-2">
                              <CopyableField label="Package" value={componentDetails.package_size} />
                            </div>

                            {/* Row 3: Alternative Parts Selection */}
                            {alternatives && alternatives.length > 0 && (
                              <div className="col-span-3 border-b border-gray-200 dark:border-[#444444] pb-3 mb-3">
                                <span className="text-gray-600 dark:text-gray-400 block mb-2">Alternative Parts:</span>
                                <select
                                  value={selectedAlternative?.id || ''}
                                  onChange={(e) => {
                                    const alt = alternatives.find(a => a.id === e.target.value);
                                    setSelectedAlternative(alt);
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                                >
                                  {alternatives.map((alt) => (
                                    <option key={alt.id} value={alt.id}>
                                      {alt.manufacturer_name || 'Unknown Mfg'} - {alt.manufacturer_pn}
                                      {alt.is_primary ? ' (Primary)' : ''}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {/* Row 4: Manufacturer, MFG Part Number (from selected alternative) */}
                            <CopyableField 
                              label="Manufacturer" 
                              value={selectedAlternative?.manufacturer_name || componentDetails.manufacturer_name} 
                            />
                            <div className="col-span-2">
                              <CopyableField 
                                label="MFG Part Number" 
                                value={selectedAlternative?.manufacturer_pn || componentDetails.manufacturer_pn} 
                              />
                            </div>

                            {/* Row 5: Description */}
                            {componentDetails.description && (
                              <div className="col-span-3">
                                <span className="text-gray-600 dark:text-gray-400">Description:</span>
                                <p 
                                  className="font-medium text-gray-900 dark:text-gray-100 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-[#333333] px-2 py-1 rounded transition-colors"
                                  onClick={() => handleCopyToClipboard(componentDetails.description, 'Description')}
                                  title="Click to copy"
                                >
                                  {componentDetails.description}
                                </p>
                              </div>
                            )}

                            {/* Row 6: PCB Footprint */}
                            <div className="col-span-3">
                              <CopyableField label="PCB Footprint" value={componentDetails.pcb_footprint} />
                            </div>

                            {/* Row 7: Schematic Symbol */}
                            {componentDetails.schematic && (
                              <div className="col-span-3">
                                <span className="text-gray-600 dark:text-gray-400">Schematic Symbol:</span>
                                <p 
                                  className="font-medium text-gray-900 dark:text-gray-100 text-xs break-all cursor-pointer hover:bg-gray-100 dark:hover:bg-[#333333] px-2 py-1 rounded transition-colors inline-block"
                                  onClick={() => handleCopyToClipboard(componentDetails.schematic, 'Schematic')}
                                  title="Click to copy"
                                >
                                  {componentDetails.schematic}
                                </p>
                              </div>
                            )}

                            {/* Row 8: STEP 3D Model */}
                            {componentDetails.step_model && (
                              <div className="col-span-3">
                                <span className="text-gray-600 dark:text-gray-400">STEP 3D Model:</span>
                                <p 
                                  className="font-medium text-gray-900 dark:text-gray-100 text-xs break-all cursor-pointer hover:bg-gray-100 dark:hover:bg-[#333333] px-2 py-1 rounded transition-colors inline-block"
                                  onClick={() => handleCopyToClipboard(componentDetails.step_model, 'STEP Model')}
                                  title="Click to copy"
                                >
                                  {componentDetails.step_model}
                                </p>
                              </div>
                            )}

                            {/* Row 9: PSPICE Model */}
                            {componentDetails.pspice && (
                              <div className="col-span-3">
                                <span className="text-gray-600 dark:text-gray-400">PSPICE Model:</span>
                                <p 
                                  className="font-medium text-gray-900 dark:text-gray-100 text-xs break-all cursor-pointer hover:bg-gray-100 dark:hover:bg-[#333333] px-2 py-1 rounded transition-colors inline-block"
                                  onClick={() => handleCopyToClipboard(componentDetails.pspice, 'PSPICE Model')}
                                  title="Click to copy"
                                >
                                  {componentDetails.pspice}
                                </p>
                              </div>
                            )}

                            {/* Row 10: Datasheet URL */}
                            {componentDetails.datasheet_url && (
                              <div className="col-span-3">
                                <span className="text-gray-600 dark:text-gray-400">Datasheet URL:</span>
                                <a 
                                  href={componentDetails.datasheet_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="font-medium text-blue-600 dark:text-blue-400 hover:underline text-xs break-all block"
                                >
                                  {componentDetails.datasheet_url}
                                </a>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </>
                  ) : (
                    <div className="col-span-3 text-center py-8 text-gray-500 dark:text-gray-400">
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
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Distributor Info</h3>
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
                        <p className="text-xs text-gray-600 dark:text-gray-400">SKU: {dist.sku}</p>
                        <button
                          onClick={() => handleCopyToClipboard(dist.sku, `sku_${index}`)}
                          className="text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 transition-colors"
                          title="Copy SKU"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        {copiedText === `sku_${index}` && (
                          <span className="text-xs text-green-600 dark:text-green-400">Copied!</span>
                        )}
                      </div>
                    )}
                    {dist.price ? (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Price: ${Number(dist.price).toFixed(2)} {dist.currency || 'USD'}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Price: </p>
                    )}
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Stock: {dist.stock_quantity || 'N/A'}</p>
                    {dist.price_breaks && dist.price_breaks.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {dist.price_breaks.slice(0, 3).map((price, idx) => (
                          <p key={idx} className="text-xs text-gray-600 dark:text-gray-400">
                            {price.quantity}+: ${price.price}
                          </p>
                        ))}
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
          <div className="space-y-4 xl:min-w-[400px]">
            {/* Specifications Panel - For inputting values */}
            <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a]">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Specifications</h3>
              <div className="text-sm">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Technical Specifications</h4>
                {(editData.specifications || []).length > 0 ? (
                  (editData.specifications || []).map((spec, index) => (
                    <div key={index} className="grid grid-cols-[2fr_2fr_1fr] gap-2 mb-2">
                      <div className="flex items-center">
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {spec.spec_name}
                          {spec.is_required && <span className="text-red-500 ml-1">*</span>}
                        </span>
                      </div>
                      <input
                        type="text"
                        value={spec.spec_value || ''}
                        onChange={(e) => {
                          const newSpecs = [...(editData.specifications || [])];
                          newSpecs[index] = { ...newSpecs[index], spec_value: e.target.value };
                          handleFieldChange('specifications', newSpecs);
                        }}
                        placeholder={`Enter ${spec.spec_name.toLowerCase()}`}
                        className="px-2 py-1 border border-gray-300 dark:border-[#444444] rounded text-sm bg-white dark:bg-[#333333] dark:text-gray-100"
                      />
                      <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                        {spec.unit || ''}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {isAddMode ? 'Select a category to see available specifications' : 'No specifications defined for this category'}
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
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {editData.alternatives.map((alt, altIndex) => (
                    <div key={altIndex} className="border border-gray-300 dark:border-[#444444] rounded-md p-4 bg-white dark:bg-[#2a2a2a]">
                      {/* Alternative header with delete button */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Alternative #{altIndex + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteAlternative(altIndex)}
                          className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 px-2 py-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          title="Delete alternative"
                        >
                          Delete
                        </button>
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
                              placeholder="Type or select manufacturer..."
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
                                      onClick={async () => {
                                        try {
                                          const response = await createManufacturerMutation.mutateAsync({ 
                                            name: altManufacturerInputs[altIndex].trim() 
                                          });
                                          const newManufacturer = response.data;
                                          handleUpdateAlternative(altIndex, 'manufacturer_id', newManufacturer.id);
                                          setAltManufacturerOpen(prev => ({ ...prev, [altIndex]: false }));
                                        } catch (error) {
                                          console.error('Error creating manufacturer:', error);
                                          setWarningModal({ 
                                            show: true, 
                                            message: 'Failed to create manufacturer. Please try again.' 
                                          });
                                        }
                                      }}
                                      className="w-full text-left px-3 py-2 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-medium text-sm flex items-center gap-2"
                                    >
                                      <Plus className="w-4 h-4" />
                                      Create: "{altManufacturerInputs[altIndex].trim()}"
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
                            placeholder="e.g., RC0805FR-0710KL"
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
          </div>
        )}

        {/* Fifth Column - Vendor API Data & Component Specifications */}
        <div className="space-y-4 xl:min-w-[350px]">
          {/* Vendor API Data - Shown only in Add Mode when coming from Vendor Search */}
          {isAddMode && editData._vendorSearchData && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg shadow-md p-4 border border-blue-200 dark:border-blue-800">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                <span className="text-lg">📦</span>
                Vendor API Data ({editData._vendorSearchData.source === 'digikey' ? 'Digikey' : 'Mouser'})
              </h3>
              <p className="text-xs text-blue-700 dark:text-blue-300 mb-3">
                Click any value to copy to clipboard • All data from vendor API
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
                      <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
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
                    {editData._vendorSearchData.distributor.pricing && editData._vendorSearchData.distributor.pricing.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-blue-100 dark:border-blue-900">
                        <span className="text-blue-700 dark:text-blue-300 font-medium block mb-1 text-xs">Price Breaks:</span>
                        <div className="space-y-1 pl-2">
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
                        return (
                          <div 
                            key={idx}
                            onClick={() => handleCopyToClipboard(`${displayValue}${displayUnit ? ' ' + displayUnit : ''}`, key)}
                            className="flex justify-between items-start py-1 px-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded cursor-pointer group transition-colors"
                          >
                            <span className="text-blue-700 dark:text-blue-300 text-xs font-medium flex-shrink-0 mr-2" style={{maxWidth: '45%'}}>
                              {key}:
                            </span>
                            <span className="text-blue-900 dark:text-blue-100 text-xs text-right flex items-start gap-1 flex-1">
                              <span className="flex-1 break-words">{displayValue} {displayUnit}</span>
                              <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
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
                  <div className="pt-2">
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

      {/* Modern Warning Modal */}
      {warningModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
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
    </div>
  );
};

export default Library;
