import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { Search, Edit, Trash2, Plus, X, Check } from 'lucide-react';

// Component Library - Fixed 3-Column Layout
const Library = () => {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAddMode, setIsAddMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [bulkDeleteMode, setBulkDeleteMode] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState(new Set());

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
    mutationFn: (data) => api.createComponent(data),
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

  const handleEdit = () => {
    setIsEditMode(true);
    setIsAddMode(false);
    // Map all fields properly for editing
    // Specifications already have category_spec_id from the backend
    setEditData({
      ...componentDetails,
      manufacturer_id: componentDetails?.manufacturer_id || '',
      manufacturer_part_number: componentDetails?.manufacturer_pn || componentDetails?.manufacturer_part_number || '',
      specifications: componentDetails?.specifications || [],
      distributors: componentDetails?.distributors || [],
    });
  };

  const handleSave = async () => {
    if (selectedComponent) {
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
        
        // Update distributors if present
        if (distributors && distributors.length > 0) {
          await api.updateComponentDistributors(selectedComponent.id, { distributors });
        }
        
        // Refresh the component details
        queryClient.invalidateQueries(['components']);
        queryClient.invalidateQueries(['componentDetails']);
        setIsEditMode(false);
      } catch (error) {
        console.error('Error saving component:', error);
        alert('Failed to save component. Please try again.');
      }
    }
  };

  const handleDelete = () => {
    if (selectedComponent && window.confirm('Are you sure you want to delete this component?')) {
      deleteMutation.mutate(selectedComponent.id);
    }
  };

  const handleBulkDelete = () => {
    if (selectedForDelete.size > 0 && window.confirm(`Are you sure you want to delete ${selectedForDelete.size} component(s)?`)) {
      deleteMutation.mutate(Array.from(selectedForDelete));
    }
  };

  const handleAddNew = () => {
    setIsAddMode(true);
    setIsEditMode(false);
    setSelectedComponent(null);
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
      distributors: [ // Default four distributors
        { distributor_name: 'Digikey', sku: '', url: '' },
        { distributor_name: 'Mouser', sku: '', url: '' },
        { distributor_name: 'Arrow', sku: '', url: '' },
        { distributor_name: 'Newark', sku: '', url: '' },
      ],
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
        
        // Add distributors if present
        if (newComponentId && distributors && distributors.length > 0) {
          await api.updateComponentDistributors(newComponentId, { distributors });
        }
        
        // Cleanup will be handled by mutation's onSuccess
      } catch (error) {
        console.error('Error adding component:', error);
        alert('Failed to add component. Please try again.');
      }
    } else {
      alert('Please fill in required fields: Category and Part Number');
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
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">MFR Part #</th>
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
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{component.manufacturer_part_number || 'N/A'}</td>
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
                      Part Number * {isAddMode && <span className="text-xs text-gray-500">(Auto-generated)</span>}
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
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">Part Type (Category) *</label>
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
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">Manufacturer</label>
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
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">MFG Part Number</label>
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
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">Value</label>
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

                  {/* Sub-categories (optional, kept for data completeness) */}
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
                        {/* Remove button hidden in add mode */}
                        {!isAddMode && (
                          <button
                            type="button"
                            onClick={() => {
                              const newDists = (editData.distributors || []).filter((_, i) => i !== index);
                              handleFieldChange('distributors', newDists);
                            }}
                            className="px-2 py-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        {/* Spacer for add mode to maintain grid alignment */}
                        {isAddMode && <div></div>}
                      </div>
                    ))}
                    {/* Add Distributor button hidden in add mode */}
                    {!isAddMode && (
                      <button
                        type="button"
                        onClick={() => {
                          const newDists = [...(editData.distributors || []), { distributor_name: '', sku: '', url: '' }];
                          handleFieldChange('distributors', newDists);
                        }}
                        className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Add Distributor
                      </button>
                    )}
                  </div>
                </>
              ) : selectedComponent && componentDetails ? (
                <>
                  {/* Row 1: Part Number, Part Type */}
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Part Number:</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{componentDetails.part_number}</p>
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

          {/* Distributor Info - Always shown */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Distributor Info</h3>
            {selectedComponent && componentDetails && !isAddMode && componentDetails.distributors?.length > 0 ? (
              <div className="space-y-3">
                {componentDetails.distributors
                  .filter(dist => ['Digikey', 'Mouser', 'Newark', 'Arrow'].includes(dist.distributor_name))
                  .map((dist, index) => (
                  <div key={index} className="border-b border-gray-100 dark:border-[#3a3a3a] pb-3 last:border-0">
                    <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{dist.distributor_name}</p>
                    {dist.sku && (
                      <p className="text-xs text-gray-600 dark:text-gray-400">SKU: {dist.sku}</p>
                    )}
                    {dist.price ? (
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Price: ${Number(dist.price).toFixed(2)} {dist.currency || 'USD'}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-600 dark:text-gray-400">Price: </p>
                    )}
                    <p className="text-xs text-gray-600 dark:text-gray-400">Stock: {dist.stock_quantity || 'N/A'}</p>
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
    </div>
  );
};

export default Library;
