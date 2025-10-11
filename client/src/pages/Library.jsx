import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { Search, Edit, Trash2, Plus, X, Check, AlertTriangle, AlertCircle, Copy } from 'lucide-react';

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
  const [copiedText, setCopiedText] = useState('');

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
        // Distributor info
        distributors: [{
          distributor_id: vendorData.distributor?.id || '',
          distributor_name: vendorData.distributor?.source === 'digikey' ? 'Digikey' : 'Mouser',
          sku: vendorData.distributor?.sku || '',
          url: vendorData.distributor?.url || '',
          price: vendorData.distributor?.pricing?.[0]?.price || '',
          in_stock: (vendorData.distributor?.stock || 0) > 0,
          stock_quantity: vendorData.distributor?.stock || 0,
          minimum_order_quantity: vendorData.distributor?.minimumOrderQuantity || 1,
          price_breaks: vendorData.distributor?.pricing || []
        }],
        // Specifications from vendor
        vendorSpecifications: vendorData.specifications || {},
        // Store complete vendor data for display in details panel
        _vendorSearchData: {
          source: vendorData.distributor?.source || 'vendor',
          manufacturerPartNumber: vendorData.manufacturerPartNumber,
          manufacturer: vendorData.manufacturerName,
          description: vendorData.description,
          datasheet: vendorData.datasheet,
          packageType: packageFromSpecs || vendorData.packageType,
          series: vendorData.series,
          category: vendorData.category,
          specifications: vendorData.specifications || {},
          distributor: vendorData.distributor
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
    },
  });

  const handleEdit = async () => {
    setIsEditMode(true);
    setIsAddMode(false);
    
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
    
    // Map all fields properly for editing
    setEditData({
      ...componentDetails,
      manufacturer_id: componentDetails?.manufacturer_id || '',
      manufacturer_part_number: componentDetails?.manufacturer_pn || componentDetails?.manufacturer_part_number || '',
      specifications: editSpecifications,
      distributors: editDistributors,
    });
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

      {/* 4-Column Layout: Left Sidebar | Center List (wider) | Right Details | Specifications */}
      {/* Full screen width layout with wider component list */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(250px,1fr)_minmax(650px,2.5fr)_minmax(550px,2fr)_minmax(350px,1.2fr)] gap-4 min-h-[600px]">
        {/* Left Sidebar - Filters */}
        <div className="space-y-4 xl:min-w-[250px]">
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
                placeholder="Part number, description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
              />
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
                    onClick={() => setIsEditMode(false)}
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

        {/* Center - Component List */}
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
                    {components.map((component) => (
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
                    ))}
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
                  {/* Row 1: Part Number, Part Type (Category) */}
                  <div>
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">
                      Part Number <span className="text-red-500">*</span> {isAddMode && <span className="text-xs text-gray-500">(Auto-generated)</span>}
                      {isEditMode && <span className="text-xs text-gray-500">(Locked)</span>}
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
                  <div className="col-span-2">
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">Part Type (Category) <span className="text-red-500">*</span></label>
                    <select
                      value={editData.category_id || ''}
                      onChange={(e) => isAddMode ? handleCategoryChange(e.target.value) : handleFieldChange('category_id', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                    >
                      <option value="">Select a category</option>
                      {categories?.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Row 2: Manufacturer, MFG Part Number */}
                  <div>
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">
                      Manufacturer <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={editData.manufacturer_id || ''}
                      onChange={(e) => handleFieldChange('manufacturer_id', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                    >
                      <option value="">Select manufacturer</option>
                      {manufacturers?.map((mfr) => (
                        <option key={mfr.id} value={mfr.id}>
                          {mfr.name}
                        </option>
                      ))}
                    </select>
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
                      placeholder="e.g., CRCW0603"
                    />
                  </div>

                  {/* Row 3: Value, Package */}
                  <div>
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">
                      Value <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editData.value || ''}
                      onChange={(e) => handleFieldChange('value', e.target.value)}
                      placeholder="e.g., 10uF, 10kΩ"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">Package</label>
                    <input
                      type="text"
                      value={editData.package_size || ''}
                      onChange={(e) => handleFieldChange('package_size', e.target.value)}
                      placeholder="e.g., 0805"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                    />
                  </div>

                  {/* Sub-categories (moved before description) */}
                  <div>
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">Sub-Category 1</label>
                    <input
                      type="text"
                      value={editData.sub_category1 || ''}
                      onChange={(e) => handleFieldChange('sub_category1', e.target.value)}
                      placeholder="e.g., Ceramic"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">Sub-Category 2</label>
                    <input
                      type="text"
                      value={editData.sub_category2 || ''}
                      onChange={(e) => handleFieldChange('sub_category2', e.target.value)}
                      placeholder="e.g., X7R"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">Sub-Category 3</label>
                    <input
                      type="text"
                      value={editData.sub_category3 || ''}
                      onChange={(e) => handleFieldChange('sub_category3', e.target.value)}
                      placeholder="e.g., 50V"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                    />
                  </div>

                  {/* Row 3.5: Description (after Value and Package) */}
                  <div className="col-span-3">
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">Description</label>
                    <textarea
                      value={editData.description || ''}
                      onChange={(e) => handleFieldChange('description', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                      rows="2"
                      placeholder="Brief description"
                    />
                  </div>

                  {/* Row 4: PCB Footprint */}
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

                  {/* Row 5: Schematic Symbol */}
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

                  {/* Row 6: STEP 3D Model */}
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

                  {/* Row 7: PSPICE Model */}
                  <div className="col-span-3">
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">PSPICE Model</label>
                    <input
                      type="text"
                      value={editData.pspice || ''}
                      onChange={(e) => handleFieldChange('pspice', e.target.value)}
                      placeholder="Path to simulation"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                    />
                  </div>

                  {/* Row 8: Datasheet URL */}
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

                  {/* Specifications Section */}
                  <div className="col-span-3 border-t border-gray-200 dark:border-[#444444] pt-4 mt-2">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Specifications</h4>
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

                  {/* Distributors Section */}
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
              ) : selectedComponent && componentDetails ? (
                <>
                  {/* Row 1: Part Number, Part Type */}
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Part Number:</span>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{componentDetails.part_number}</p>
                      <button
                        onClick={() => handleCopyToClipboard(componentDetails.part_number, 'part_number')}
                        className="text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 transition-colors"
                        title="Copy Part Number"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      {copiedText === 'part_number' && (
                        <span className="text-xs text-green-600 dark:text-green-400">Copied!</span>
                      )}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-600 dark:text-gray-400">Part Type:</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {componentDetails.part_type || componentDetails.category_name || 'N/A'}
                    </p>
                  </div>

                  {/* Row 2: Manufacturer, MFG Part Number */}
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Manufacturer:</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{componentDetails.manufacturer_name || 'N/A'}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-600 dark:text-gray-400">MFG Part Number:</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{componentDetails.manufacturer_pn || 'N/A'}</p>
                  </div>

                  {/* Row 3: Value, Package */}
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Value:</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{componentDetails.value || 'N/A'}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-600 dark:text-gray-400">Package:</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{componentDetails.package_size || 'N/A'}</p>
                  </div>

                  {/* Row 4: Description */}
                  {componentDetails.description && (
                    <div className="col-span-3">
                      <span className="text-gray-600 dark:text-gray-400">Description:</span>
                      <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">{componentDetails.description}</p>
                    </div>
                  )}

                  {/* Row 4: PCB Footprint */}
                  <div className="col-span-3">
                    <span className="text-gray-600 dark:text-gray-400">PCB Footprint:</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{componentDetails.pcb_footprint || 'N/A'}</p>
                  </div>

                  {/* Row 5: Schematic Symbol */}
                  {componentDetails.schematic && (
                    <div className="col-span-3">
                      <span className="text-gray-600 dark:text-gray-400">Schematic Symbol:</span>
                      <p className="font-medium text-gray-900 dark:text-gray-100 text-xs break-all">{componentDetails.schematic}</p>
                    </div>
                  )}

                  {/* Row 6: STEP 3D Model */}
                  {componentDetails.step_model && (
                    <div className="col-span-3">
                      <span className="text-gray-600 dark:text-gray-400">STEP 3D Model:</span>
                      <p className="font-medium text-gray-900 dark:text-gray-100 text-xs break-all">{componentDetails.step_model}</p>
                    </div>
                  )}

                  {/* Row 7: PSPICE Model */}
                  {componentDetails.pspice && (
                    <div className="col-span-3">
                      <span className="text-gray-600 dark:text-gray-400">PSPICE Model:</span>
                      <p className="font-medium text-gray-900 dark:text-gray-100 text-xs break-all">{componentDetails.pspice}</p>
                    </div>
                  )}

                  {/* Row 8: Datasheet URL */}
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
              ) : (
                <div className="col-span-3 text-center py-8 text-gray-500 dark:text-gray-400">
                  <p>Select a component to view details</p>
                  <p className="text-sm mt-2">or click "Add Component" to create a new one</p>
                </div>
              )}
            </div>
          </div>

          {/* Vendor API Data - Shown only in Add Mode when coming from Vendor Search */}
          {isAddMode && editData._vendorSearchData && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg shadow-md p-4 border border-blue-200 dark:border-blue-800">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                <span className="text-lg">📦</span>
                Vendor API Data ({editData._vendorSearchData.source === 'digikey' ? 'Digikey' : 'Mouser'})
              </h3>
              <p className="text-xs text-blue-700 dark:text-blue-300 mb-3">
                Click any value to copy to clipboard
              </p>
              <div className="space-y-2 text-sm">
                {/* Basic Info */}
                <div className="border-b border-blue-200 dark:border-blue-800 pb-2">
                  <div 
                    onClick={() => handleCopyToClipboard(editData._vendorSearchData.manufacturerPartNumber, 'MFG P/N')}
                    className="flex justify-between items-center py-1 px-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded cursor-pointer group"
                  >
                    <span className="text-blue-700 dark:text-blue-300 font-medium">MFG Part Number:</span>
                    <span className="text-blue-900 dark:text-blue-100 font-mono text-xs flex items-center gap-2">
                      {editData._vendorSearchData.manufacturerPartNumber}
                      <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </span>
                  </div>
                  <div 
                    onClick={() => handleCopyToClipboard(editData._vendorSearchData.manufacturer, 'Manufacturer')}
                    className="flex justify-between items-center py-1 px-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded cursor-pointer group"
                  >
                    <span className="text-blue-700 dark:text-blue-300 font-medium">Manufacturer:</span>
                    <span className="text-blue-900 dark:text-blue-100 font-mono text-xs flex items-center gap-2">
                      {editData._vendorSearchData.manufacturer}
                      <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </span>
                  </div>
                  <div 
                    onClick={() => handleCopyToClipboard(editData._vendorSearchData.description, 'Description')}
                    className="flex flex-col py-1 px-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded cursor-pointer group"
                  >
                    <span className="text-blue-700 dark:text-blue-300 font-medium mb-1">Description:</span>
                    <span className="text-blue-900 dark:text-blue-100 text-xs flex items-start gap-2">
                      <span className="flex-1">{editData._vendorSearchData.description}</span>
                      <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
                    </span>
                  </div>
                </div>

                {/* Package & Series */}
                {(editData._vendorSearchData.packageType || editData._vendorSearchData.series) && (
                  <div className="border-b border-blue-200 dark:border-blue-800 pb-2">
                    {editData._vendorSearchData.packageType && (
                      <div 
                        onClick={() => handleCopyToClipboard(editData._vendorSearchData.packageType, 'Package')}
                        className="flex justify-between items-center py-1 px-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded cursor-pointer group"
                      >
                        <span className="text-blue-700 dark:text-blue-300 font-medium">Package:</span>
                        <span className="text-blue-900 dark:text-blue-100 font-mono text-xs flex items-center gap-2">
                          {editData._vendorSearchData.packageType}
                          <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </span>
                      </div>
                    )}
                    {editData._vendorSearchData.series && (
                      <div 
                        onClick={() => handleCopyToClipboard(editData._vendorSearchData.series, 'Series')}
                        className="flex justify-between items-center py-1 px-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded cursor-pointer group"
                      >
                        <span className="text-blue-700 dark:text-blue-300 font-medium">Series:</span>
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
                    <div 
                      onClick={() => handleCopyToClipboard(editData._vendorSearchData.distributor.sku, 'Vendor SKU')}
                      className="flex justify-between items-center py-1 px-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded cursor-pointer group"
                    >
                      <span className="text-blue-700 dark:text-blue-300 font-medium">Vendor SKU:</span>
                      <span className="text-blue-900 dark:text-blue-100 font-mono text-xs flex items-center gap-2">
                        {editData._vendorSearchData.distributor.sku}
                        <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 px-2">
                      <span className="text-blue-700 dark:text-blue-300 font-medium">Stock:</span>
                      <span className="text-blue-900 dark:text-blue-100 font-mono text-xs">
                        {editData._vendorSearchData.distributor.stock?.toLocaleString() || '0'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 px-2">
                      <span className="text-blue-700 dark:text-blue-300 font-medium">MOQ:</span>
                      <span className="text-blue-900 dark:text-blue-100 font-mono text-xs">
                        {editData._vendorSearchData.distributor.minimumOrderQuantity || '1'}
                      </span>
                    </div>
                    {editData._vendorSearchData.distributor.pricing && editData._vendorSearchData.distributor.pricing.length > 0 && (
                      <div className="mt-2">
                        <span className="text-blue-700 dark:text-blue-300 font-medium block mb-1">Pricing:</span>
                        <div className="space-y-1 pl-2">
                          {editData._vendorSearchData.distributor.pricing.map((price, idx) => (
                            <div 
                              key={idx}
                              onClick={() => handleCopyToClipboard(`${price.quantity}+ @ $${price.price}`, 'Price Break')}
                              className="flex justify-between items-center py-0.5 px-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded cursor-pointer group"
                            >
                              <span className="text-blue-800 dark:text-blue-200 text-xs">{price.quantity}+:</span>
                              <span className="text-green-700 dark:text-green-400 font-mono text-xs flex items-center gap-2">
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
                {editData._vendorSearchData.specifications && Object.keys(editData._vendorSearchData.specifications).length > 0 && (
                  <div>
                    <span className="text-blue-700 dark:text-blue-300 font-medium block mb-2">Specifications:</span>
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {Object.entries(editData._vendorSearchData.specifications).map(([key, val], idx) => {
                        const displayValue = typeof val === 'object' ? val.value : val;
                        const displayUnit = typeof val === 'object' ? val.unit : '';
                        return (
                          <div 
                            key={idx}
                            onClick={() => handleCopyToClipboard(`${displayValue}${displayUnit ? ' ' + displayUnit : ''}`, key)}
                            className="flex justify-between items-start py-1 px-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded cursor-pointer group"
                          >
                            <span className="text-blue-700 dark:text-blue-300 text-xs flex-shrink-0 mr-2" style={{maxWidth: '40%'}}>
                              {key}:
                            </span>
                            <span className="text-blue-900 dark:text-blue-100 text-xs text-right flex items-start gap-2 flex-1">
                              <span className="flex-1">{displayValue} {displayUnit}</span>
                              <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Datasheet */}
                {editData._vendorSearchData.datasheet && (
                  <div className="pt-2 border-t border-blue-200 dark:border-blue-800">
                    <div className="flex flex-col gap-1">
                      <span className="text-blue-700 dark:text-blue-300 font-medium text-xs">Datasheet:</span>
                      <a 
                        href={editData._vendorSearchData.datasheet}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline text-xs break-all"
                      >
                        {editData._vendorSearchData.datasheet}
                      </a>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Copy feedback */}
              {copiedText && (
                <div className="mt-3 text-xs text-center text-green-700 dark:text-green-400 font-medium animate-fade-in">
                  ✓ Copied {copiedText}!
                </div>
              )}
            </div>
          )}

          {/* Distributor Info - Always shown */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Distributor Info</h3>
            {selectedComponent && componentDetails && !isAddMode && componentDetails.distributors?.length > 0 ? (
              <div className="space-y-4">
                {componentDetails.distributors
                  .filter(dist => ['Digikey', 'Mouser', 'Newark', 'Arrow'].includes(dist.distributor_name))
                  .map((dist, index) => (
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
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">No distributor information available</p>
            )}
          </div>
        </div>

        {/* Fourth Column - Component Specifications */}
        <div className="space-y-4 xl:min-w-[350px]">
          {/* Component Specifications - Always shown */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Specifications</h3>
            {selectedComponent && componentDetails && componentDetails.specifications?.length > 0 && !isAddMode ? (
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
