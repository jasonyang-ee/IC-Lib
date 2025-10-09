import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { Search, Edit, Trash2, Plus, X, Check } from 'lucide-react';

// Helper function to generate next part number
const generatePartNumber = (categoryId, existingComponents, partNumberConfigs) => {
  const config = partNumberConfigs[categoryId] || { prefix: 'COMP', leadingZeros: 5 };
  
  // Find highest number for this category
  const categoryComponents = existingComponents.filter(c => c.category_id === categoryId);
  const numbers = categoryComponents
    .map(c => {
      const match = c.part_number.match(/\d+$/);
      return match ? parseInt(match[0]) : 0;
    })
    .filter(n => !isNaN(n));
  
  const nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
  const paddedNumber = nextNumber.toString().padStart(config.leadingZeros, '0');
  
  return `${config.prefix}-${paddedNumber}`;
};

const Library = () => {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAddMode, setIsAddMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState(new Set());

  // Fetch settings from server for part number configs
  const { data: serverSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await api.getSettings();
      return response.data;
    },
  });

  const partNumberConfigs = serverSettings?.partNumberConfigs || {};

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await api.getCategories();
      return response.data;
    },
  });

  // Fetch manufacturers
  const { data: manufacturers } = useQuery({
    queryKey: ['manufacturers'],
    queryFn: async () => {
      const response = await api.getManufacturers({});
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

  // Fetch component details with specifications
  const { data: componentDetails } = useQuery({
    queryKey: ['componentDetails', selectedComponent?.id],
    enabled: !!selectedComponent,
    queryFn: async () => {
      try {
        const [details, specifications, distributors] = await Promise.allSettled([
          api.getComponentById(selectedComponent.id),
          api.getComponentSpecifications(selectedComponent.id),
          api.getComponentDistributors(selectedComponent.id),
        ]);
        
        return {
          ...(details.status === 'fulfilled' ? details.value.data : {}),
          specifications: specifications.status === 'fulfilled' ? specifications.value.data : [],
          distributors: distributors.status === 'fulfilled' ? distributors.value.data : [],
        };
      } catch (error) {
        console.error('Error fetching component details:', error);
        throw error;
      }
    },
  });

  // Add mutation
  const addMutation = useMutation({
    mutationFn: (data) => api.createComponent(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['components']);
      setIsAddMode(false);
      setIsEditMode(false);
      setEditData({});
      setSelectedComponent(null);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => api.deleteComponent(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['components']);
      setSelectedComponent(null);
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids) => {
      await Promise.all(ids.map(id => api.deleteComponent(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['components']);
      setDeleteMode(false);
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
    setEditData({
      ...componentDetails,
      distributors: componentDetails?.distributors || []
    });
  };

  const handleSave = async () => {
    if (isAddMode) {
      addMutation.mutate(editData);
    } else if (selectedComponent) {
      // Update component basic info
      await updateMutation.mutateAsync({ id: selectedComponent.id, data: editData });
      
      // Update distributor info if modified
      if (editData.distributors) {
        try {
          await api.updateComponentDistributors(selectedComponent.id, { distributors: editData.distributors });
        } catch (error) {
          console.error('Failed to update distributor info:', error);
        }
      }
    }
  };

  const handleDelete = () => {
    if (selectedComponent && window.confirm('Are you sure you want to delete this component?')) {
      deleteMutation.mutate(selectedComponent.id);
    }
  };

  const handleBulkDelete = () => {
    if (selectedForDelete.size === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedForDelete.size} component(s)?`)) {
      bulkDeleteMutation.mutate(Array.from(selectedForDelete));
    }
  };

  const toggleDeleteSelection = (id) => {
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

  const handleAddComponent = () => {
    setIsAddMode(true);
    setIsEditMode(true);
    setSelectedComponent(null);
    
    // Generate part number automatically
    const partNumber = generatePartNumber(selectedCategory || (categories?.[0]?.id), components || [], partNumberConfigs);
    
    setEditData({
      category_id: selectedCategory || (categories?.[0]?.id),
      part_number: partNumber,
      manufacturer_id: '',
      manufacturer_pn: '',
      description: '',
      value: '',
      pcb_footprint: '',
      package_size: '',
      datasheet_url: '',
      status: 'Active',
      notes: '',
    });
  };

  const handleCancelAdd = () => {
    setIsAddMode(false);
    setIsEditMode(false);
    setEditData({});
  };

  const toggleDeleteMode = () => {
    setDeleteMode(!deleteMode);
    setSelectedForDelete(new Set());
  };

  // Get current category name for display
  const currentCategoryName = selectedCategory 
    ? categories?.find(c => c.id === selectedCategory)?.name 
    : 'All';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Parts Library</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Browse and manage your component library</p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left Sidebar - Filters */}
        <div className="col-span-3 space-y-4">
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
        </div>

        {/* Center - Component List */}
        <div className="col-span-6 space-y-4">
          {/* Component Details (Upper) - Always shown */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a]">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {isAddMode ? 'Add New Component' : 'Component Details'}
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {isEditMode || isAddMode ? (
                <>
                  <div>
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">Part Number *</label>
                    <input
                      type="text"
                      value={editData.part_number || ''}
                      onChange={(e) => handleFieldChange('part_number', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">MFG Part Number</label>
                    <input
                      type="text"
                      value={editData.manufacturer_pn || ''}
                      onChange={(e) => handleFieldChange('manufacturer_pn', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">Description</label>
                    <textarea
                      value={editData.description || ''}
                      onChange={(e) => handleFieldChange('description', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                      rows="3"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">Category *</label>
                    <select
                      value={editData.category_id || ''}
                      onChange={(e) => {
                        const newCategoryId = e.target.value;
                        handleFieldChange('category_id', newCategoryId);
                        // Regenerate part number when category changes
                        if (isAddMode) {
                          const newPartNumber = generatePartNumber(newCategoryId, components || [], partNumberConfigs);
                          handleFieldChange('part_number', newPartNumber);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                    >
                      <option value="">Select category</option>
                      {categories?.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
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
                  <div>
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">Datasheet URL</label>
                    <input
                      type="url"
                      value={editData.datasheet_url || ''}
                      onChange={(e) => handleFieldChange('datasheet_url', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
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
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">PCB Footprint</label>
                    <input
                      type="text"
                      value={editData.pcb_footprint || ''}
                      onChange={(e) => handleFieldChange('pcb_footprint', e.target.value)}
                      placeholder="e.g., C_0805, SOIC-8"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">Package Size</label>
                    <input
                      type="text"
                      value={editData.package_size || ''}
                      onChange={(e) => handleFieldChange('package_size', e.target.value)}
                      placeholder="e.g., 0805, SOIC-8"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-gray-600 dark:text-gray-400 mb-1">Notes</label>
                    <textarea
                      value={editData.notes || ''}
                      onChange={(e) => handleFieldChange('notes', e.target.value)}
                      rows="2"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                    />
                  </div>
                </>
              ) : selectedComponent && componentDetails ? (
                <>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Part Number:</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{componentDetails?.part_number}</p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">MFG Part Number:</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{componentDetails?.manufacturer_pn || 'N/A'}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-600 dark:text-gray-400">Description:</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{componentDetails?.description || 'No description'}</p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Value:</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{componentDetails?.value || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Package:</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{componentDetails?.package_size || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Category:</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{componentDetails?.category_name}</p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Manufacturer:</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{componentDetails?.manufacturer_name || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">PCB Footprint:</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100 text-xs">{componentDetails?.pcb_footprint || 'Not set'}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-600 dark:text-gray-400">Notes:</span>
                    <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">{componentDetails?.notes || 'N/A'}</p>
                  </div>
                </>
              ) : (
                <div className="col-span-2 text-center py-8 text-gray-500 dark:text-gray-400">
                  <p>Select a component from the list to view details</p>
                </div>
              )}
            </div>
          </div>

          {/* Component List (Lower) */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a]">
            <div className="p-4 border-b border-gray-200 dark:border-[#3a3a3a] flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {currentCategoryName} Components ({components?.length || 0})
              </h3>
            </div>
            <div className="overflow-auto max-h-[500px]">
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : components?.length > 0 ? (
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-[#333333] sticky top-0">
                    <tr>
                      {deleteMode && (
                        <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 w-12">
                          <input
                            type="checkbox"
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedForDelete(new Set(components.map(c => c.id)));
                              } else {
                                setSelectedForDelete(new Set());
                              }
                            }}
                            checked={selectedForDelete.size === components.length && components.length > 0}
                            className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                          />
                        </th>
                      )}
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Part Number</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">MFG Part #</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Description</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {components.map((component) => (
                      <tr
                        key={component.id}
                        onClick={() => !deleteMode && setSelectedComponent(component)}
                        className={`cursor-pointer border-b border-gray-100 dark:border-[#3a3a3a] hover:bg-gray-50 dark:hover:bg-[#333333] ${
                          selectedComponent?.id === component.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                        }`}
                      >
                        {deleteMode && (
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedForDelete.has(component.id)}
                              onChange={() => toggleDeleteSelection(component.id)}
                              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                            />
                          </td>
                        )}
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{component.part_number}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{component.manufacturer_pn || 'N/A'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{component.description?.substring(0, 50) || 'N/A'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{component.category_name}</td>
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

        {/* Right Sidebar - Additional Info */}
        <div className="col-span-3 space-y-4">
          {/* Distributor Info */}
          {selectedComponent && componentDetails && !isAddMode && (
            <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Distributor Info</h3>
              {componentDetails.distributors?.length > 0 ? (
                <div className="space-y-3">
                  {componentDetails.distributors.map((dist, index) => (
                    <div key={index} className="border-b border-gray-100 dark:border-[#3a3a3a] pb-3 last:border-0">
                      <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{dist.distributor_name}</p>
                      {isEditMode ? (
                        <div className="mt-2">
                          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">SKU / Part Number</label>
                          <input
                            type="text"
                            value={editData.distributors?.[index]?.sku || dist.sku || ''}
                            onChange={(e) => {
                              const updatedDistributors = [...(editData.distributors || componentDetails.distributors)];
                              updatedDistributors[index] = {
                                ...dist,
                                ...updatedDistributors[index],
                                sku: e.target.value
                              };
                              handleFieldChange('distributors', updatedDistributors);
                            }}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-xs"
                            placeholder="Enter SKU/part number"
                          />
                        </div>
                      ) : (
                        dist.sku && (
                          <p className="text-xs text-gray-600 dark:text-gray-400">SKU: {dist.sku}</p>
                        )
                      )}
                      {dist.stock_quantity !== null && dist.stock_quantity !== undefined && (
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Stock: {dist.in_stock ? `${dist.stock_quantity} available` : 'Out of stock'}
                        </p>
                      )}
                      {dist.price && (
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Price: ${dist.price} {dist.currency || 'USD'}
                        </p>
                      )}
                      {dist.url && (
                        <a 
                          href={dist.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                        >
                          View on {dist.distributor_name}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No distributor information</p>
              )}
            </div>
          )}

          {/* Actions for Add/Edit Mode */}
          {(isAddMode || isEditMode) && (
            <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={handleSave}
                  disabled={!editData.part_number || !editData.category_id}
                  className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {isAddMode ? 'Add Component' : 'Save Changes'}
                </button>
                <button
                  onClick={isAddMode ? handleCancelAdd : () => setIsEditMode(false)}
                  className="w-full bg-gray-300 hover:bg-gray-400 dark:bg-[#333333] dark:hover:bg-[#3a3a3a] text-gray-700 dark:text-gray-300 font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Actions for View/Delete Mode */}
          {!isAddMode && !isEditMode && (
            <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Actions</h3>
              <div className="space-y-2">
                {deleteMode ? (
                  <>
                    <button
                      onClick={handleBulkDelete}
                      disabled={selectedForDelete.size === 0}
                      className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Confirm Delete ({selectedForDelete.size})
                    </button>
                    <button
                      onClick={toggleDeleteMode}
                      className="w-full bg-gray-300 hover:bg-gray-400 dark:bg-[#333333] dark:hover:bg-[#3a3a3a] text-gray-700 dark:text-gray-300 font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      Cancel Selection
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleAddComponent}
                      className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Component
                    </button>
                    {selectedComponent && (
                      <>
                        <button
                          onClick={handleEdit}
                          className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          <Edit className="w-4 h-4" />
                          Edit Component
                        </button>
                        <button
                          onClick={toggleDeleteMode}
                          className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete Component
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Library;
