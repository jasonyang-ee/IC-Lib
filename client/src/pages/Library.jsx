import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { Search, Edit, Trash2, Plus, X, Check } from 'lucide-react';

const Library = () => {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [subcategoryFilter, setSubcategoryFilter] = useState('');
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editData, setEditData] = useState({});

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
    queryKey: ['components', selectedCategory, searchTerm, subcategoryFilter],
    queryFn: async () => {
      const response = await api.getComponents({
        category: selectedCategory,
        search: searchTerm,
        subcategory: subcategoryFilter,
      });
      return response.data;
    },
  });

  // Fetch component details with specifications
  const { data: componentDetails } = useQuery({
    queryKey: ['componentDetails', selectedComponent?.id],
    enabled: !!selectedComponent,
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

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => api.deleteComponent(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['components']);
      setSelectedComponent(null);
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
    setEditData(componentDetails || {});
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

  const handleFieldChange = (field, value) => {
    setEditData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Component Library</h1>
        <p className="text-gray-600 mt-1">Browse and manage your component library</p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left Sidebar - Filters */}
        <div className="col-span-3 space-y-4">
          {/* Category Selector */}
          <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3">Category</h3>
            <div className="space-y-2">
              <button
                onClick={() => setSelectedCategory('')}
                className={`w-full text-left px-3 py-2 rounded ${
                  selectedCategory === ''
                    ? 'bg-primary-100 text-primary-700 font-medium'
                    : 'hover:bg-gray-100 text-gray-700'
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
                      ? 'bg-primary-100 text-primary-700 font-medium'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3">Search</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Part number, description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Subcategory Filter */}
          <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3">Subcategory</h3>
            <input
              type="text"
              placeholder="Filter by subcategory..."
              value={subcategoryFilter}
              onChange={(e) => setSubcategoryFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Center - Component List */}
        <div className="col-span-6 space-y-4">
          {/* Selected Component Details (Upper) */}
          {selectedComponent && componentDetails && (
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Component Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {isEditMode ? (
                  <>
                    <div>
                      <label className="block text-gray-600 mb-1">Part Number</label>
                      <input
                        type="text"
                        value={editData.part_number || ''}
                        onChange={(e) => handleFieldChange('part_number', e.target.value)}
                        className="input-field text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-1">MFR Part Number</label>
                      <input
                        type="text"
                        value={editData.manufacturer_part_number || ''}
                        onChange={(e) => handleFieldChange('manufacturer_part_number', e.target.value)}
                        className="input-field text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-gray-600 mb-1">Description</label>
                      <textarea
                        value={editData.description || ''}
                        onChange={(e) => handleFieldChange('description', e.target.value)}
                        className="input-field text-sm"
                        rows="3"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-1">Subcategory</label>
                      <input
                        type="text"
                        value={editData.subcategory || ''}
                        onChange={(e) => handleFieldChange('subcategory', e.target.value)}
                        className="input-field text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-1">Manufacturer</label>
                      <input
                        type="text"
                        value={editData.manufacturer_name || ''}
                        className="input-field text-sm"
                        disabled
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <span className="text-gray-600">Part Number:</span>
                      <p className="font-medium">{componentDetails.part_number}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">MFR Part Number:</span>
                      <p className="font-medium">{componentDetails.manufacturer_part_number || 'N/A'}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-600">Description:</span>
                      <p className="font-medium">{componentDetails.description || 'No description'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Category:</span>
                      <p className="font-medium">{componentDetails.category_name}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Subcategory:</span>
                      <p className="font-medium">{componentDetails.subcategory || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Manufacturer:</span>
                      <p className="font-medium">{componentDetails.manufacturer_name || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Footprint:</span>
                      <p className="font-medium text-xs">{componentDetails.footprint_path || 'Not set'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Symbol:</span>
                      <p className="font-medium text-xs">{componentDetails.symbol_path || 'Not set'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Pad:</span>
                      <p className="font-medium text-xs">{componentDetails.pad_path || 'Not set'}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Component List (Lower) */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                Components ({components?.length || 0})
              </h3>
              <button className="btn-primary flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Component
              </button>
            </div>
            <div className="overflow-auto max-h-[500px]">
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : components?.length > 0 ? (
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Part Number</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">MFR Part #</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Description</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700">Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {components.map((component) => (
                      <tr
                        key={component.id}
                        onClick={() => setSelectedComponent(component)}
                        className={`cursor-pointer border-b border-gray-100 hover:bg-gray-50 ${
                          selectedComponent?.id === component.id ? 'bg-primary-50' : ''
                        }`}
                      >
                        <td className="px-4 py-3 text-sm font-medium">{component.part_number}</td>
                        <td className="px-4 py-3 text-sm">{component.manufacturer_part_number || 'N/A'}</td>
                        <td className="px-4 py-3 text-sm">{component.description?.substring(0, 50) || 'N/A'}</td>
                        <td className="px-4 py-3 text-sm">{component.category_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  No components found
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar - Additional Info */}
        <div className="col-span-3 space-y-4">
          {/* Distributor Info */}
          {selectedComponent && componentDetails && (
            <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-3">Distributor Info</h3>
              {componentDetails.distributors?.length > 0 ? (
                <div className="space-y-3">
                  {componentDetails.distributors.map((dist, index) => (
                    <div key={index} className="border-b border-gray-100 pb-3 last:border-0">
                      <p className="font-medium text-sm text-gray-900">{dist.distributor_name}</p>
                      <p className="text-xs text-gray-600">Stock: {dist.stock_quantity}</p>
                      {dist.price_breaks && dist.price_breaks.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {dist.price_breaks.slice(0, 3).map((price, idx) => (
                            <p key={idx} className="text-xs text-gray-600">
                              {price.quantity}+: ${price.price}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No distributor information</p>
              )}
            </div>
          )}

          {/* Actions */}
          {selectedComponent && (
            <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-3">Actions</h3>
              <div className="space-y-2">
                {isEditMode ? (
                  <>
                    <button
                      onClick={handleSave}
                      className="w-full btn-primary flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Save Changes
                    </button>
                    <button
                      onClick={() => setIsEditMode(false)}
                      className="w-full btn-secondary flex items-center justify-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleEdit}
                      className="w-full btn-primary flex items-center justify-center gap-2"
                    >
                      <Edit className="w-4 h-4" />
                      Edit Component
                    </button>
                    <button
                      onClick={handleDelete}
                      className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Component
                    </button>
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
