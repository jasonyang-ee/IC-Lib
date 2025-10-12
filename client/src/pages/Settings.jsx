import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Database, AlertCircle, CheckCircle, Loader2, Edit, Check, X, Plus, Trash2 } from 'lucide-react';
import { api } from '../utils/api';

// Category Specifications Manager Component
const CategorySpecificationsManager = () => {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isAddingSpec, setIsAddingSpec] = useState(false);
  const [editingSpec, setEditingSpec] = useState(null);
  const [newSpec, setNewSpec] = useState({ spec_name: '', unit: '', is_required: false });
  const [tempSpec, setTempSpec] = useState({});

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await api.getCategories();
      return response.data;
    },
  });

  // Fetch specifications for selected category
  const { data: specifications, isLoading: loadingSpecs } = useQuery({
    queryKey: ['categorySpecifications', selectedCategory],
    enabled: !!selectedCategory,
    queryFn: async () => {
      const response = await api.getCategorySpecifications(selectedCategory);
      return response.data;
    },
  });

  // Create specification mutation
  const createSpecMutation = useMutation({
    mutationFn: async (data) => {
      await api.createCategorySpecification(selectedCategory, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['categorySpecifications', selectedCategory]);
      setIsAddingSpec(false);
      setNewSpec({ spec_name: '', unit: '', is_required: false });
    },
  });

  // Update specification mutation
  const updateSpecMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      await api.updateCategorySpecification(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['categorySpecifications', selectedCategory]);
      setEditingSpec(null);
    },
  });

  // Delete specification mutation
  const deleteSpecMutation = useMutation({
    mutationFn: async (id) => {
      await api.deleteCategorySpecification(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['categorySpecifications', selectedCategory]);
    },
  });

  const handleAddSpec = () => {
    if (newSpec.spec_name.trim()) {
      const maxOrder = specifications?.reduce((max, spec) => Math.max(max, spec.display_order || 0), 0) || 0;
      createSpecMutation.mutate({
        ...newSpec,
        display_order: maxOrder + 1,
      });
    }
  };

  const handleEditSpec = (spec) => {
    setEditingSpec(spec.id);
    setTempSpec({ ...spec });
  };

  const handleSaveSpec = () => {
    if (editingSpec) {
      updateSpecMutation.mutate({
        id: editingSpec,
        data: tempSpec,
      });
    }
  };

  const handleDeleteSpec = (id) => {
    if (window.confirm('Delete this specification? This will also remove all component values for this specification.')) {
      deleteSpecMutation.mutate(id);
    }
  };

  return (
    <div className="mt-6 bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a]">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Category Specifications
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Manage specification fields for each category. All components in a category will use these specifications.
      </p>

      {/* Category Selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Select Category
        </label>
        <select
          value={selectedCategory}
          onChange={(e) => {
            setSelectedCategory(e.target.value);
            setIsAddingSpec(false);
            setEditingSpec(null);
          }}
          className="w-full md:w-64 px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100"
        >
          <option value="">-- Select a category --</option>
          {categories?.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {selectedCategory && (
        <>
          {/* Add Specification Form */}
          <div className="mb-4">
            <button
              onClick={() => setIsAddingSpec(!isAddingSpec)}
              className="bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
            >
              {isAddingSpec ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {isAddingSpec ? 'Cancel' : 'Add Specification'}
            </button>
          </div>

          {isAddingSpec && (
            <div className="mb-4 p-4 bg-gray-50 dark:bg-[#333333] rounded-lg border border-gray-200 dark:border-[#444444]">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Specification Name *
                  </label>
                  <input
                    type="text"
                    value={newSpec.spec_name}
                    onChange={(e) => setNewSpec({ ...newSpec, spec_name: e.target.value })}
                    placeholder="e.g., Capacitance, Voltage Rating"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Unit
                  </label>
                  <input
                    type="text"
                    value={newSpec.unit}
                    onChange={(e) => setNewSpec({ ...newSpec, unit: e.target.value })}
                    placeholder="e.g., F, V, Ω"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={newSpec.is_required}
                      onChange={(e) => setNewSpec({ ...newSpec, is_required: e.target.checked })}
                      className="rounded border-gray-300 dark:border-[#444444]"
                    />
                    Required
                  </label>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  onClick={handleAddSpec}
                  disabled={!newSpec.spec_name.trim() || createSpecMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {createSpecMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Add Specification
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Specifications List */}
          {loadingSpecs ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            </div>
          ) : specifications && specifications.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-[#3a3a3a]">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                      Specification Name
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                      Unit
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                      Required
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                      Display Order
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {specifications.map((spec) => (
                    <tr
                      key={spec.id}
                      className="border-b border-gray-100 dark:border-[#333333] hover:bg-gray-50 dark:hover:bg-[#333333]"
                    >
                      <td className="py-3 px-4">
                        {editingSpec === spec.id ? (
                          <input
                            type="text"
                            value={tempSpec.spec_name}
                            onChange={(e) => setTempSpec({ ...tempSpec, spec_name: e.target.value })}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-[#444444] rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                          />
                        ) : (
                          <span className="text-gray-900 dark:text-gray-100">{spec.spec_name}</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {editingSpec === spec.id ? (
                          <input
                            type="text"
                            value={tempSpec.unit || ''}
                            onChange={(e) => setTempSpec({ ...tempSpec, unit: e.target.value })}
                            className="w-20 px-2 py-1 border border-gray-300 dark:border-[#444444] rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                          />
                        ) : (
                          <span className="text-gray-600 dark:text-gray-400 text-sm">
                            {spec.unit || '-'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {editingSpec === spec.id ? (
                          <input
                            type="checkbox"
                            checked={tempSpec.is_required}
                            onChange={(e) => setTempSpec({ ...tempSpec, is_required: e.target.checked })}
                            className="rounded border-gray-300 dark:border-[#444444]"
                          />
                        ) : (
                          <span
                            className={`inline-flex px-2 py-1 text-xs rounded-full ${
                              spec.is_required
                                ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300'
                            }`}
                          >
                            {spec.is_required ? 'Required' : 'Optional'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {editingSpec === spec.id ? (
                          <input
                            type="number"
                            value={tempSpec.display_order}
                            onChange={(e) =>
                              setTempSpec({ ...tempSpec, display_order: parseInt(e.target.value) || 0 })
                            }
                            className="w-20 px-2 py-1 border border-gray-300 dark:border-[#444444] rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                          />
                        ) : (
                          <span className="text-gray-600 dark:text-gray-400 text-sm">
                            {spec.display_order}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {editingSpec === spec.id ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={handleSaveSpec}
                              disabled={updateSpecMutation.isPending}
                              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-1 px-3 rounded transition-colors disabled:opacity-50 text-sm"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingSpec(null)}
                              className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-1 px-3 rounded transition-colors text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditSpec(spec)}
                              className="bg-primary-600 hover:bg-primary-700 text-white font-semibold py-1 px-3 rounded transition-colors text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteSpec(spec.id)}
                              disabled={deleteSpecMutation.isPending}
                              className="bg-red-600 hover:bg-red-700 text-white font-semibold py-1 px-3 rounded transition-colors disabled:opacity-50 text-sm"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>No specifications defined for this category yet.</p>
              <p className="text-sm mt-2">Click "Add Specification" to create one.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// Settings Page - Updated with Advanced Operations
const Settings = () => {
  const queryClient = useQueryClient();
  const [editingCategory, setEditingCategory] = useState(null);
  const [tempConfig, setTempConfig] = useState({ prefix: '', leading_zeros: 5, enabled: true });
  const [dbOperationStatus, setDbOperationStatus] = useState({ show: false, type: '', message: '' });
  const [confirmDialog, setConfirmDialog] = useState({ show: false, action: '', title: '', message: '' });
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', description: '', prefix: '', leading_zeros: 5, enabled: true });
  const [showAdvancedOps, setShowAdvancedOps] = useState(false);

  const { data: categoryConfigs, isLoading: loadingConfigs } = useQuery({
    queryKey: ['categoryConfigs'],
    queryFn: async () => {
      const response = await api.get('/settings/categories');
      return response.data;
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, config }) => {
      const response = await api.put(`/settings/categories/${id}`, config);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['categoryConfigs']);
      setEditingCategory(null);
      setDbOperationStatus({ show: true, type: 'success', message: 'Category updated successfully!' });
      setTimeout(() => setDbOperationStatus({ show: false, type: '', message: '' }), 3000);
    },
    onError: (error) => {
      const errorMsg = error.response?.data?.message || error.message;
      setDbOperationStatus({ show: true, type: 'error', message: `Error updating category: ${errorMsg}` });
      setTimeout(() => setDbOperationStatus({ show: false, type: '', message: '' }), 5000);
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (categoryData) => {
      const response = await api.post('/settings/categories', categoryData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['categoryConfigs']);
      setIsAddingCategory(false);
      setNewCategory({ name: '', description: '', prefix: '', leading_zeros: 5, enabled: true });
      setDbOperationStatus({ show: true, type: 'success', message: 'Category created successfully!' });
      setTimeout(() => setDbOperationStatus({ show: false, type: '', message: '' }), 3000);
    },
    onError: (error) => {
      const errorMsg = error.response?.data?.message || error.message;
      setDbOperationStatus({ show: true, type: 'error', message: `Error creating category: ${errorMsg}` });
      setTimeout(() => setDbOperationStatus({ show: false, type: '', message: '' }), 5000);
    },
  });

  const initDbMutation = useMutation({
    mutationFn: async () => {
      const response = await api.initDatabase();
      return response;
    },
    onSuccess: () => {
      setDbOperationStatus({ show: true, type: 'success', message: 'Database initialized successfully!' });
      queryClient.invalidateQueries(['categoryConfigs']);
      setTimeout(() => setDbOperationStatus({ show: false, type: '', message: '' }), 5000);
    },
    onError: (error) => {
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      setDbOperationStatus({ show: true, type: 'error', message: errorMsg });
      setTimeout(() => setDbOperationStatus({ show: false, type: '', message: '' }), 5000);
    },
  });

  const loadSampleDataMutation = useMutation({
    mutationFn: async () => {
      const response = await api.loadSampleData();
      return response;
    },
    onSuccess: () => {
      setDbOperationStatus({ show: true, type: 'success', message: 'Sample data loaded successfully!' });
      setTimeout(() => setDbOperationStatus({ show: false, type: '', message: '' }), 5000);
    },
    onError: (error) => {
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      setDbOperationStatus({ show: true, type: 'error', message: errorMsg });
      setTimeout(() => setDbOperationStatus({ show: false, type: '', message: '' }), 5000);
    },
  });

  const verifyDbMutation = useMutation({
    mutationFn: async () => {
      const response = await api.verifyDatabase();
      return response;
    },
    onSuccess: (data) => {
      const message = data.data.valid 
        ? 'Database schema verified successfully!' 
        : `Schema verification failed: ${data.data.issues?.join(', ')}`;
      setDbOperationStatus({ 
        show: true, 
        type: data.data.valid ? 'success' : 'error', 
        message 
      });
      setTimeout(() => setDbOperationStatus({ show: false, type: '', message: '' }), 5000);
    },
    onError: (error) => {
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      setDbOperationStatus({ show: true, type: 'error', message: errorMsg });
      setTimeout(() => setDbOperationStatus({ show: false, type: '', message: '' }), 5000);
    },
  });

  const resetDbMutation = useMutation({
    mutationFn: async () => {
      const response = await api.resetDatabase(true);
      return response;
    },
    onSuccess: () => {
      setDbOperationStatus({ show: true, type: 'success', message: 'Database reset completed! All tables dropped and schema reinitialized.' });
      queryClient.invalidateQueries(['categoryConfigs']);
      setTimeout(() => setDbOperationStatus({ show: false, type: '', message: '' }), 5000);
    },
    onError: (error) => {
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      setDbOperationStatus({ show: true, type: 'error', message: errorMsg });
      setTimeout(() => setDbOperationStatus({ show: false, type: '', message: '' }), 5000);
    },
  });

  const handleEditCategory = (category) => {
    setEditingCategory(category.id);
    setTempConfig({
      prefix: category.prefix,
      leading_zeros: category.leading_zeros,
      enabled: category.enabled ?? true
    });
  };

  const handleSaveCategory = (categoryId) => {
    updateCategoryMutation.mutate({ id: categoryId, config: tempConfig });
  };

  const handleCancelEdit = () => {
    setEditingCategory(null);
    setTempConfig({ prefix: '', leading_zeros: 5, enabled: true });
  };

  const handleCreateCategory = () => {
    if (!newCategory.name || !newCategory.prefix) {
      setDbOperationStatus({ show: true, type: 'error', message: 'Name and prefix are required!' });
      setTimeout(() => setDbOperationStatus({ show: false, type: '', message: '' }), 3000);
      return;
    }
    createCategoryMutation.mutate(newCategory);
  };

  const handleDatabaseOperation = (action) => {
    setConfirmDialog({
      show: true,
      action,
      title: action === 'init' ? 'Initialize Database' : 
             action === 'load' ? 'Load Sample Data' : 
             action === 'reset' ? 'Full Database Reset' : 'Verify Database',
      message: action === 'init' ? 
               'This will create the database schema (only works on empty databases). Continue?' :
               action === 'load' ?
               'This will load sample data into the database. Existing data will not be affected. Continue?' :
               action === 'reset' ?
               '⚠️ DANGER: This will DROP ALL TABLES and recreate the schema. ALL DATA WILL BE PERMANENTLY LOST! This cannot be undone. Are you absolutely sure?' :
               'This will verify the database schema matches the expected structure. Continue?'
    });
  };

  const executeConfirmedAction = () => {
    const action = confirmDialog.action;
    setConfirmDialog({ show: false, action: '', title: '', message: '' });
    
    if (action === 'init') {
      initDbMutation.mutate();
    } else if (action === 'load') {
      loadSampleDataMutation.mutate();
    } else if (action === 'verify') {
      verifyDbMutation.mutate();
    } else if (action === 'reset') {
      resetDbMutation.mutate();
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Configure application preferences and database settings</p>
      </div>

      {dbOperationStatus.show && (
        <div className={`mb-6 p-4 rounded-lg border ${
          dbOperationStatus.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        }`}>
          <div className="flex items-center gap-2">
            {dbOperationStatus.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            )}
            <p className={
              dbOperationStatus.type === 'success'
                ? 'text-green-800 dark:text-green-200'
                : 'text-red-800 dark:text-red-200'
            }>
              {dbOperationStatus.message}
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Category Configuration</h3>
          <button
            onClick={() => setIsAddingCategory(!isAddingCategory)}
            className="bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
          >
            {isAddingCategory ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {isAddingCategory ? 'Cancel' : 'Add Category'}
          </button>
        </div>

        {isAddingCategory && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-[#333333] rounded-lg border border-gray-200 dark:border-[#444444]">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">New Category</h4>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Name *</label>
                <input
                  type="text"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  placeholder="e.g., Capacitors"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Prefix *</label>
                <input
                  type="text"
                  value={newCategory.prefix}
                  onChange={(e) => setNewCategory({ ...newCategory, prefix: e.target.value.toUpperCase() })}
                  placeholder="e.g., CAP"
                  maxLength={10}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Leading Zeros</label>
                <input
                  type="number"
                  value={newCategory.leading_zeros}
                  onChange={(e) => setNewCategory({ ...newCategory, leading_zeros: parseInt(e.target.value) || 5 })}
                  min="1"
                  max="10"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Description</label>
                <input
                  type="text"
                  value={newCategory.description}
                  onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                  placeholder="Optional description"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={newCategory.enabled}
                  onChange={(e) => setNewCategory({ ...newCategory, enabled: e.target.checked })}
                  className="rounded border-gray-300 dark:border-[#444444]"
                />
                Enabled
              </label>
              <button
                onClick={handleCreateCategory}
                disabled={createCategoryMutation.isPending}
                className="ml-auto bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {createCategoryMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Create Category
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {loadingConfigs ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-[#3a3a3a]">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Category</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Prefix</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Leading Zeros</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Example</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {categoryConfigs?.map((category) => (
                  <tr key={category.id} className="border-b border-gray-100 dark:border-[#333333] hover:bg-gray-50 dark:hover:bg-[#333333]">
                    <td className="py-3 px-4 text-gray-900 dark:text-gray-100">{category.name}</td>
                    <td className="py-3 px-4">
                      {editingCategory === category.id ? (
                        <input
                          type="text"
                          value={tempConfig.prefix}
                          onChange={(e) => setTempConfig({ ...tempConfig, prefix: e.target.value.toUpperCase() })}
                          maxLength={10}
                          className="w-24 px-2 py-1 border border-gray-300 dark:border-[#444444] rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                        />
                      ) : (
                        <span className="text-gray-900 dark:text-gray-100 font-mono">{category.prefix}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {editingCategory === category.id ? (
                        <input
                          type="number"
                          value={tempConfig.leading_zeros}
                          onChange={(e) => setTempConfig({ ...tempConfig, leading_zeros: parseInt(e.target.value) || 5 })}
                          min="1"
                          max="10"
                          className="w-20 px-2 py-1 border border-gray-300 dark:border-[#444444] rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                        />
                      ) : (
                        <span className="text-gray-900 dark:text-gray-100">{category.leading_zeros}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-gray-600 dark:text-gray-400 font-mono text-sm">
                        {category.prefix}-{String(1).padStart(editingCategory === category.id ? tempConfig.leading_zeros : category.leading_zeros, '0')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {editingCategory === category.id ? (
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={tempConfig.enabled}
                            onChange={(e) => setTempConfig({ ...tempConfig, enabled: e.target.checked })}
                            className="rounded border-gray-300 dark:border-[#444444]"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">Enabled</span>
                        </label>
                      ) : (
                        <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                          category.enabled
                            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300'
                        }`}>
                          {category.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {editingCategory === category.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSaveCategory(category.id)}
                            disabled={updateCategoryMutation.isPending}
                            className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded disabled:opacity-50 transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white text-sm rounded transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEditCategory(category)}
                          className="px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded transition-colors"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Category Specifications Management */}
      <CategorySpecificationsManager />

      <div className="mt-6 bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a]">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Database Operations</h3>
        
        {/* Standard Operations */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <button
            onClick={() => handleDatabaseOperation('init')}
            disabled={initDbMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {initDbMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Initializing...
              </>
            ) : (
              <>
                <Database className="w-4 h-4" />
                Initialize Database
              </>
            )}
          </button>
          <button
            onClick={() => handleDatabaseOperation('load')}
            disabled={loadSampleDataMutation.isPending}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loadSampleDataMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <Database className="w-4 h-4" />
                Load Sample Data
              </>
            )}
          </button>
          <button
            onClick={() => handleDatabaseOperation('verify')}
            disabled={verifyDbMutation.isPending}
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {verifyDbMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Verify Schema
              </>
            )}
          </button>
        </div>

        {/* Advanced/Dangerous Operations */}
        <div className="border-t border-gray-200 dark:border-[#3a3a3a] pt-4">
          <button
            onClick={() => setShowAdvancedOps(!showAdvancedOps)}
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 flex items-center gap-2 mb-3"
          >
            <AlertCircle className="w-4 h-4" />
            {showAdvancedOps ? 'Hide' : 'Show'} Advanced Operations
          </button>
          
          {showAdvancedOps && (
            <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-start gap-3 mb-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-red-900 dark:text-red-200 mb-1">Danger Zone</h4>
                  <p className="text-sm text-red-800 dark:text-red-300 mb-3">
                    These operations will permanently delete data. Use with extreme caution.
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDatabaseOperation('reset')}
                disabled={resetDbMutation.isPending}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {resetDbMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Resetting Database...
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4" />
                    Full Database Reset (Drop All Tables)
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <strong>Initialize Database:</strong> Creates schema in an empty database. Won't work if tables exist.
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <strong>Load Sample Data:</strong> Populates database with example components. Safe to run multiple times.
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <strong>Verify Schema:</strong> Checks if all required tables exist and match expected schema.
          </p>
          <p className="text-sm text-red-600 dark:text-red-400">
            <strong>Full Database Reset:</strong> ⚠️ Drops ALL tables and recreates schema. ALL DATA IS LOST!
          </p>
        </div>
      </div>

      {confirmDialog.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`bg-white dark:bg-[#2a2a2a] rounded-lg shadow-xl p-6 max-w-md w-full mx-4 ${
            confirmDialog.action === 'reset' ? 'border-4 border-red-600' : ''
          }`}>
            <div className="flex items-center gap-3 mb-3">
              {confirmDialog.action === 'reset' && (
                <AlertCircle className="w-8 h-8 text-red-600 flex-shrink-0" />
              )}
              <h3 className={`text-lg font-semibold ${
                confirmDialog.action === 'reset' 
                  ? 'text-red-900 dark:text-red-200' 
                  : 'text-gray-900 dark:text-gray-100'
              }`}>
                {confirmDialog.title}
              </h3>
            </div>
            <p className={`mb-6 ${
              confirmDialog.action === 'reset'
                ? 'text-red-800 dark:text-red-300 font-medium'
                : 'text-gray-600 dark:text-gray-400'
            }`}>
              {confirmDialog.message}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDialog({ show: false, action: '', title: '', message: '' })}
                className="px-4 py-2 border border-gray-300 dark:border-[#444444] rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#333333] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeConfirmedAction}
                className={`px-4 py-2 rounded-lg transition-colors font-semibold ${
                  confirmDialog.action === 'reset'
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-primary-600 hover:bg-primary-700 text-white'
                }`}
              >
                {confirmDialog.action === 'reset' ? 'Yes, Delete Everything' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
