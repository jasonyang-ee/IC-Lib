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
    setEditData({
      ...componentDetails,
      manufacturer_id: componentDetails?.manufacturer_id || '',
      manufacturer_part_number: componentDetails?.manufacturer_pn || componentDetails?.manufacturer_part_number || '',
    });
  };

  const handleSave = () => {
    if (selectedComponent) {
      updateMutation.mutate({ id: selectedComponent.id, data: editData });
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
    });
  };

  // Function to generate next part number based on category
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
  const handleCategoryChange = (categoryId) => {
    handleFieldChange('category_id', categoryId);
    if (isAddMode) {
      const nextPartNumber = generateNextPartNumber(categoryId);
      handleFieldChange('part_number', nextPartNumber);
    }
  };

  const handleConfirmAdd = () => {
    if (editData.category_id && editData.part_number) {
      addMutation.mutate(editData);
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

      {/* 4-Column Layout: Left Sidebar | Center List | Right Details | Specifications */}
      {/* Increased width of columns 2 & 3 for better visibility */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(250px,0.8fr)_minmax(500px,2.5fr)_minmax(450px,2fr)_minmax(300px,1fr)] gap-6 min-h-[600px]">
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
        <div className="space-y-4 xl:min-w-[400px]">
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
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Description</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Part Type</th>
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
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{component.part_number}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{component.manufacturer_part_number || 'N/A'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{component.description?.substring(0, 50) || 'N/A'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {component.category_name}{component.part_type ? `/${component.part_type.trim()}` : ''}
                        </td>
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
        <div className="space-y-4 xl:min-w-[350px]">
          {/* Component Details - Always Shown */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a]">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {isAddMode ? 'Add New Component' : 'Component Details'}
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {(isEditMode || isAddMode) ? (
                <>
                  <div className="col-span-2">
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">Category *</label>
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
                  <div>
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">
                      Part Number * {isAddMode && <span className="text-xs text-gray-500">(Auto-generated)</span>}
                    </label>
                    <input
                      type="text"
                      value={editData.part_number || ''}
                      onChange={(e) => handleFieldChange('part_number', e.target.value)}
                      disabled={isAddMode}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm disabled:bg-gray-100 dark:disabled:bg-[#2a2a2a] disabled:cursor-not-allowed"
                      placeholder={isAddMode ? "Select category first" : "e.g., RES-0001"}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">MFR Part Number</label>
                    <input
                      type="text"
                      value={editData.manufacturer_pn || editData.manufacturer_part_number || ''}
                      onChange={(e) => handleFieldChange('manufacturer_part_number', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                      placeholder="e.g., CRCW0603"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">Manufacturer</label>
                    <select
                      value={editData.manufacturer_id || ''}
                      onChange={(e) => handleFieldChange('manufacturer_id', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                    >
                      <option value="">Select manufacturer (optional)</option>
                      {manufacturers?.map((mfr) => (
                        <option key={mfr.id} value={mfr.id}>
                          {mfr.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">Description</label>
                    <textarea
                      value={editData.description || ''}
                      onChange={(e) => handleFieldChange('description', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                      rows="2"
                      placeholder="Brief description"
                    />
                  </div>
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
                  <div>
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">PCB Footprint</label>
                    <input
                      type="text"
                      value={editData.pcb_footprint || ''}
                      onChange={(e) => handleFieldChange('pcb_footprint', e.target.value)}
                      placeholder="e.g., C_0805"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">Schematic Symbol</label>
                    <input
                      type="text"
                      value={editData.schematic || ''}
                      onChange={(e) => handleFieldChange('schematic', e.target.value)}
                      placeholder="Path to symbol"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">STEP Model</label>
                    <input
                      type="text"
                      value={editData.step_model || ''}
                      onChange={(e) => handleFieldChange('step_model', e.target.value)}
                      placeholder="Path to 3D model"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">PSPICE Model</label>
                    <input
                      type="text"
                      value={editData.pspice || ''}
                      onChange={(e) => handleFieldChange('pspice', e.target.value)}
                      placeholder="Path to simulation"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                    />
                  </div>
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
                </>
              ) : selectedComponent && componentDetails ? (
                <>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Part Number:</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{componentDetails.part_number}</p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">MFR Part Number:</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{componentDetails.manufacturer_pn || 'N/A'}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-600 dark:text-gray-400">Description:</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{componentDetails.description || 'No description'}</p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Category:</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{componentDetails.category_name}</p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Part Type:</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {componentDetails.part_type || componentDetails.category_name || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Value:</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{componentDetails.value || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Package:</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{componentDetails.package_size || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">PCB Footprint:</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{componentDetails.pcb_footprint || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Manufacturer:</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{componentDetails.manufacturer_name || 'N/A'}</p>
                  </div>
                  {(componentDetails.schematic || componentDetails.step_model || componentDetails.pspice) && (
                    <>
                      {componentDetails.schematic && (
                        <div className="col-span-2">
                          <span className="text-gray-600 dark:text-gray-400">Schematic Symbol:</span>
                          <p className="font-medium text-gray-900 dark:text-gray-100 text-xs break-all">{componentDetails.schematic}</p>
                        </div>
                      )}
                      {componentDetails.step_model && (
                        <div className="col-span-2">
                          <span className="text-gray-600 dark:text-gray-400">STEP 3D Model:</span>
                          <p className="font-medium text-gray-900 dark:text-gray-100 text-xs break-all">{componentDetails.step_model}</p>
                        </div>
                      )}
                      {componentDetails.pspice && (
                        <div className="col-span-2">
                          <span className="text-gray-600 dark:text-gray-400">PSPICE Model:</span>
                          <p className="font-medium text-gray-900 dark:text-gray-100 text-xs break-all">{componentDetails.pspice}</p>
                        </div>
                      )}
                    </>
                  )}
                </>
              ) : (
                <div className="col-span-2 text-center py-8 text-gray-500 dark:text-gray-400">
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
                    <p className="text-xs text-gray-600 dark:text-gray-400">Stock: {dist.stock_quantity}</p>
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
        <div className="space-y-4 xl:min-w-[300px]">
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
