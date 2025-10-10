import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { Search, Edit, Trash2, Plus, X, Check } from 'lucide-react';

const AddComponentModal = ({ isOpen, onClose, categories, onAdd }) => {
  const [formData, setFormData] = useState({
    category_id: '',
    part_number: '',
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

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onAdd(formData);
    setFormData({
      category_id: '',
      part_number: '',
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Add New Component</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Category *
            </label>
            <select
              required
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Part Number *
            </label>
            <input
              required
              type="text"
              value={formData.part_number}
              onChange={(e) => setFormData({ ...formData, part_number: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
              placeholder="e.g., RES-0603-1K-1%"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Manufacturer Part Number
            </label>
            <input
              type="text"
              value={formData.manufacturer_part_number}
              onChange={(e) => setFormData({ ...formData, manufacturer_part_number: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
              placeholder="e.g., CRCW06031K00FKEA"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
              rows="3"
              placeholder="Brief description of the component"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Value
            </label>
            <input
              type="text"
              value={formData.value}
              onChange={(e) => setFormData({ ...formData, value: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
              placeholder="e.g., 10uF, 10kΩ, 3.3V"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Sub-Category 1
            </label>
            <input
              type="text"
              value={formData.sub_category1}
              onChange={(e) => setFormData({ ...formData, sub_category1: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
              placeholder="e.g., Ceramic, Thick Film"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Sub-Category 2
            </label>
            <input
              type="text"
              value={formData.sub_category2}
              onChange={(e) => setFormData({ ...formData, sub_category2: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
              placeholder="e.g., X7R, ±1%"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Sub-Category 3
            </label>
            <input
              type="text"
              value={formData.sub_category3}
              onChange={(e) => setFormData({ ...formData, sub_category3: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
              placeholder="e.g., 50V, 0.1W"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              PCB Footprint
            </label>
            <input
              type="text"
              value={formData.pcb_footprint}
              onChange={(e) => setFormData({ ...formData, pcb_footprint: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
              placeholder="e.g., C_0805, SOIC-8"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Package Size
            </label>
            <input
              type="text"
              value={formData.package_size}
              onChange={(e) => setFormData({ ...formData, package_size: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
              placeholder="e.g., 0805, SOIC-8"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Schematic Symbol
            </label>
            <input
              type="text"
              value={formData.schematic}
              onChange={(e) => setFormData({ ...formData, schematic: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
              placeholder="Path to schematic symbol file"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              STEP Model
            </label>
            <input
              type="text"
              value={formData.step_model}
              onChange={(e) => setFormData({ ...formData, step_model: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
              placeholder="Path to 3D STEP model file"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              PSPICE Model
            </label>
            <input
              type="text"
              value={formData.pspice}
              onChange={(e) => setFormData({ ...formData, pspice: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
              placeholder="Path to PSPICE simulation model"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Datasheet URL
            </label>
            <input
              type="url"
              value={formData.datasheet_url}
              onChange={(e) => setFormData({ ...formData, datasheet_url: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
              placeholder="https://..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              Add Component
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-300 hover:bg-gray-400 dark:bg-[#333333] dark:hover:bg-[#3a3a3a] text-gray-700 dark:text-gray-300 font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Library = () => {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [subcategoryFilter, setSubcategoryFilter] = useState('');
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

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

  // Get unique subcategories for the selected category
  const subcategories = components
    ? [...new Set(components.map((c) => c.subcategory).filter(Boolean))]
    : [];

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

  // Add mutation
  const addMutation = useMutation({
    mutationFn: (data) => api.createComponent(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['components']);
      setIsAddModalOpen(false);
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

  const handleAddComponent = (data) => {
    addMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Component Library</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Browse and manage your component library</p>
      </div>

      {/* 3-Column Layout: 25% Left Sidebar | 40% Center | 35% Right Details */}
      <div className="grid grid-cols-library gap-6">
        {/* Left Sidebar - Filters */}
        <div className="space-y-4">
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

          {/* Subcategory Filter */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Subcategory</h3>
            <select
              value={subcategoryFilter}
              onChange={(e) => setSubcategoryFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
            >
              <option value="">All Subcategories</option>
              {subcategories.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Center - Component List */}
        <div className="space-y-4">
          {/* Selected Component Details (Upper) */}
          {selectedComponent && componentDetails && (
            <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a]">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Component Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {isEditMode ? (
                  <>
                    <div>
                      <label className="block text-gray-600 dark:text-gray-400 mb-1">Part Number</label>
                      <input
                        type="text"
                        value={editData.part_number || ''}
                        onChange={(e) => handleFieldChange('part_number', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-600 dark:text-gray-400 mb-1">MFR Part Number</label>
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
                        rows="2"
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
                  </>
                ) : (
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
                        {componentDetails.category_name}
                        {componentDetails.part_type ? ` / ${componentDetails.part_type}` : ''}
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
                      <div className="col-span-2">
                        <span className="text-gray-600 dark:text-gray-400">CAD Files:</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {componentDetails.schematic && (
                            <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                              📐 Schematic
                            </span>
                          )}
                          {componentDetails.step_model && (
                            <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                              📦 3D Model
                            </span>
                          )}
                          {componentDetails.pspice && (
                            <span className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-2 py-1 rounded">
                              ⚡ PSPICE
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Component List (Lower) */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a]">
            <div className="p-4 border-b border-gray-200 dark:border-[#3a3a3a] flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Components ({components?.length || 0})
              </h3>
              <button 
                onClick={() => setIsAddModalOpen(true)}
                className="bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
              >
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
                  <thead className="bg-gray-50 dark:bg-[#333333] sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Part Number</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">MFR Part #</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Description</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {components.map((component) => (
                      <tr
                        key={component.id}
                        onClick={() => setSelectedComponent(component)}
                        className={`cursor-pointer border-b border-gray-100 dark:border-[#3a3a3a] hover:bg-gray-50 dark:hover:bg-[#333333] ${
                          selectedComponent?.id === component.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                        }`}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{component.part_number}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{component.manufacturer_part_number || 'N/A'}</td>
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

        {/* Right Sidebar - Details & Distributor Info */}
        <div className="space-y-4">
          {/* Distributor Info */}
          {selectedComponent && componentDetails && (
            <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Distributor Info</h3>
              {componentDetails.distributors?.length > 0 ? (
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
                <p className="text-sm text-gray-500 dark:text-gray-400">No distributor information</p>
              )}
            </div>
          )}

          {/* Component Specifications */}
          {selectedComponent && componentDetails && componentDetails.specifications?.length > 0 && (
            <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Specifications</h3>
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
            </div>
          )}

          {/* Actions */}
          {selectedComponent && (
            <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Actions</h3>
              <div className="space-y-2">
                {isEditMode ? (
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
                ) : (
                  <>
                    <button
                      onClick={handleEdit}
                      className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
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

      {/* Add Component Modal */}
      <AddComponentModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        categories={categories}
        onAdd={handleAddComponent}
      />
    </div>
  );
};

export default Library;
