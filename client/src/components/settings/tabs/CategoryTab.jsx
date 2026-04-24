import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, GripVertical, Loader2, Plus, X } from 'lucide-react';
import { ConfirmationModal, LoadingSpinner } from '../../common';
import TypeaheadInput from '../../common/TypeaheadInput';
import { api } from '../../../utils/api';
import { useNotification } from '../../../contexts/NotificationContext';
import CategorySpecificationsManager from '../CategorySpecificationsManager';

const EMPTY_CATEGORY = {
  name: '',
  description: '',
  prefix: '',
  leading_zeros: 5,
};

const EMPTY_EDIT_CONFIG = {
  name: '',
  prefix: '',
  leading_zeros: 5,
};

const CategoryTab = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useNotification();
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [tempConfig, setTempConfig] = useState(EMPTY_EDIT_CONFIG);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState(EMPTY_CATEGORY);
  const [draggedCategoryId, setDraggedCategoryId] = useState(null);
  const [globalPrefixLocal, setGlobalPrefixLocal] = useState(null);
  const [sourceManufacturerName, setSourceManufacturerName] = useState('');
  const [targetManufacturerName, setTargetManufacturerName] = useState('');
  const [mergeConfirmation, setMergeConfirmation] = useState({
    isOpen: false,
    oldId: '',
    newName: '',
    message: '',
  });

  const { data: categoryConfigs = [], isLoading: isLoadingCategoryConfigs } = useQuery({
    queryKey: ['categoryConfigs'],
    queryFn: async () => {
      const response = await api.get('/settings/categories');
      return response.data;
    },
  });

  const { data: globalPrefixData } = useQuery({
    queryKey: ['globalPrefix'],
    queryFn: async () => {
      const response = await api.get('/settings/global-prefix');
      return response.data;
    },
  });

  const { data: manufacturers = [] } = useQuery({
    queryKey: ['manufacturers'],
    queryFn: async () => {
      const response = await api.getManufacturers();
      return response.data;
    },
  });

  useEffect(() => {
    if (globalPrefixData && !globalPrefixLocal) {
      setGlobalPrefixLocal(globalPrefixData);
    }
  }, [globalPrefixData, globalPrefixLocal]);

  const updateGlobalPrefixMutation = useMutation({
    mutationFn: async (config) => {
      const response = await api.put('/settings/global-prefix', config);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['globalPrefix'] });
      queryClient.invalidateQueries({ queryKey: ['categoryConfigs'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      if (data.updatedCategories > 0) {
        showSuccess(`Global prefix applied to ${data.updatedCategories} categories.`);
        return;
      }

      showSuccess('Global prefix settings saved.');
    },
    onError: (error) => {
      const errorMsg = error.response?.data?.error || error.message;
      showError(`Error updating global prefix: ${errorMsg}`);
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, config }) => {
      const response = await api.put(`/settings/categories/${id}`, config);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['categoryConfigs'] });
      queryClient.invalidateQueries({ queryKey: ['components'] });
      setEditingCategoryId(null);
      setTempConfig(EMPTY_EDIT_CONFIG);
      if (data.updated_part_count > 0) {
        showSuccess(`Category updated! ${data.updated_part_count} part numbers updated.`);
        return;
      }

      showSuccess('Category updated successfully!');
    },
    onError: (error) => {
      const errorMsg = error.response?.data?.message || error.message;
      showError(`Error updating category: ${errorMsg}`);
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (categoryData) => {
      const response = await api.post('/settings/categories', categoryData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categoryConfigs'] });
      setIsAddingCategory(false);
      setNewCategory(EMPTY_CATEGORY);
      showSuccess('Category created successfully!');
    },
    onError: (error) => {
      const errorMsg = error.response?.data?.message || error.message;
      showError(`Error creating category: ${errorMsg}`);
    },
  });

  const reorderCategoriesMutation = useMutation({
    mutationFn: async (categories) => {
      const response = await api.updateCategoryOrder(categories);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categoryConfigs'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      showSuccess('Category order updated successfully!');
    },
    onError: (error) => {
      const errorMsg = error.response?.data?.message || error.message;
      showError(`Error updating category order: ${errorMsg}`);
    },
  });

  const renameManufacturerMutation = useMutation({
    mutationFn: async ({ oldId, newName }) => {
      const response = await api.renameManufacturer(oldId, newName);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturers'] });
      queryClient.invalidateQueries({ queryKey: ['components'] });
      setSourceManufacturerName('');
      setTargetManufacturerName('');
      setMergeConfirmation({ isOpen: false, oldId: '', newName: '', message: '' });
      showSuccess('Manufacturer renamed successfully!');
    },
    onError: (error) => {
      const errorMsg = error.response?.data?.message || error.message;
      showError(`Error renaming manufacturer: ${errorMsg}`);
      setMergeConfirmation({ isOpen: false, oldId: '', newName: '', message: '' });
    },
  });

  const manufacturerNames = manufacturers.map((manufacturer) => manufacturer.name);

  const handleEditCategory = (category) => {
    setEditingCategoryId(category.id);
    setTempConfig({
      name: category.name,
      prefix: category.prefix,
      leading_zeros: category.leading_zeros,
    });
  };

  const handleCancelEdit = () => {
    setEditingCategoryId(null);
    setTempConfig(EMPTY_EDIT_CONFIG);
  };

  const handleSaveCategory = (categoryId) => {
    updateCategoryMutation.mutate({ id: categoryId, config: tempConfig });
  };

  const handleCreateCategory = () => {
    if (!newCategory.name || (!globalPrefixLocal?.enabled && !newCategory.prefix)) {
      showError('Category name is required!');
      return;
    }

    const payload = globalPrefixLocal?.enabled
      ? {
        ...newCategory,
        prefix: globalPrefixLocal.prefix,
        leading_zeros: globalPrefixLocal.leading_zeros,
      }
      : newCategory;

    createCategoryMutation.mutate(payload);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const handleDrop = (targetCategory) => {
    if (!draggedCategoryId || draggedCategoryId === targetCategory.id) {
      setDraggedCategoryId(null);
      return;
    }

    const categories = [...categoryConfigs];
    const draggedIndex = categories.findIndex((category) => category.id === draggedCategoryId);
    const targetIndex = categories.findIndex((category) => category.id === targetCategory.id);

    const [removedCategory] = categories.splice(draggedIndex, 1);
    categories.splice(targetIndex, 0, removedCategory);

    reorderCategoriesMutation.mutate(
      categories.map((category, index) => ({
        id: category.id,
        display_order: index + 1,
      })),
    );
    setDraggedCategoryId(null);
  };

  const handleRenameManufacturer = () => {
    const trimmedSourceName = sourceManufacturerName.trim();
    const trimmedTargetName = targetManufacturerName.trim();

    if (!trimmedSourceName || !trimmedTargetName) {
      showError('Please select a manufacturer and enter a new name');
      return;
    }

    const oldManufacturer = manufacturers.find((manufacturer) => manufacturer.name === trimmedSourceName);

    if (!oldManufacturer) {
      showError('Select an existing manufacturer to rename');
      return;
    }

    if (oldManufacturer.name === trimmedTargetName) {
      showError('Choose a different manufacturer name');
      return;
    }

    const existingTarget = manufacturers.find((manufacturer) => manufacturer.name === trimmedTargetName);

    if (existingTarget && existingTarget.id !== oldManufacturer.id) {
      setMergeConfirmation({
        isOpen: true,
        oldId: oldManufacturer.id,
        newName: existingTarget.name,
        message: `This will merge "${oldManufacturer.name}" into existing manufacturer "${existingTarget.name}". All components will be updated. Continue?`,
      });
      return;
    }

    renameManufacturerMutation.mutate({
      oldId: oldManufacturer.id,
      newName: trimmedTargetName,
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Category Configuration</h2>
          <button
            onClick={() => setIsAddingCategory((current) => !current)}
            className="bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
          >
            {isAddingCategory ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {isAddingCategory ? 'Cancel' : 'Add Category'}
          </button>
        </div>

        {globalPrefixLocal && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-[#333333] rounded-lg border border-gray-200 dark:border-[#444444]">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:gap-6">
              <label className="flex items-center gap-2 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={globalPrefixLocal.enabled}
                  onChange={(event) => setGlobalPrefixLocal({ ...globalPrefixLocal, enabled: event.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Enable Global Prefix</span>
              </label>
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600 dark:text-gray-400">Prefix</label>
                <input
                  type="text"
                  value={globalPrefixLocal.prefix}
                  onChange={(event) => setGlobalPrefixLocal({ ...globalPrefixLocal, prefix: event.target.value.toUpperCase() })}
                  disabled={!globalPrefixLocal.enabled}
                  maxLength={10}
                  placeholder="e.g., PN"
                  className="w-28 px-2 py-1 border border-gray-300 dark:border-[#444444] rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm disabled:opacity-50"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600 dark:text-gray-400">Leading Zeros</label>
                <input
                  type="number"
                  value={globalPrefixLocal.leading_zeros}
                  onChange={(event) => setGlobalPrefixLocal({
                    ...globalPrefixLocal,
                    leading_zeros: Number.parseInt(event.target.value, 10) || 5,
                  })}
                  disabled={!globalPrefixLocal.enabled}
                  min="1"
                  max="10"
                  className="w-20 px-2 py-1 border border-gray-300 dark:border-[#444444] rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm disabled:opacity-50"
                />
              </div>
              {globalPrefixLocal.enabled && globalPrefixLocal.prefix && (
                <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                  Example: {globalPrefixLocal.prefix}-{String(1).padStart(globalPrefixLocal.leading_zeros, '0')}
                </span>
              )}
              <button
                onClick={() => updateGlobalPrefixMutation.mutate(globalPrefixLocal)}
                disabled={updateGlobalPrefixMutation.isPending}
                className="xl:ml-auto px-4 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded transition-colors disabled:opacity-50 shrink-0"
              >
                {updateGlobalPrefixMutation.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
            {globalPrefixLocal.enabled && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                All categories use this prefix and leading zeros. New categories inherit these values automatically.
              </p>
            )}
          </div>
        )}

        {isAddingCategory && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-[#333333] rounded-lg border border-gray-200 dark:border-[#444444]">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">New Category</h4>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Name *</label>
                <input
                  type="text"
                  value={newCategory.name}
                  onChange={(event) => setNewCategory({ ...newCategory, name: event.target.value })}
                  placeholder="e.g., Capacitors"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Prefix *{globalPrefixLocal?.enabled ? ' (global)' : ''}</label>
                <input
                  type="text"
                  value={globalPrefixLocal?.enabled ? globalPrefixLocal.prefix : newCategory.prefix}
                  onChange={(event) => setNewCategory({ ...newCategory, prefix: event.target.value.toUpperCase() })}
                  disabled={globalPrefixLocal?.enabled}
                  placeholder="e.g., CAP"
                  maxLength={10}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Leading Zeros{globalPrefixLocal?.enabled ? ' (global)' : ''}</label>
                <input
                  type="number"
                  value={globalPrefixLocal?.enabled ? globalPrefixLocal.leading_zeros : newCategory.leading_zeros}
                  onChange={(event) => setNewCategory({
                    ...newCategory,
                    leading_zeros: Number.parseInt(event.target.value, 10) || 5,
                  })}
                  disabled={globalPrefixLocal?.enabled}
                  min="1"
                  max="10"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm disabled:opacity-50"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Description</label>
                <input
                  type="text"
                  value={newCategory.description}
                  onChange={(event) => setNewCategory({ ...newCategory, description: event.target.value })}
                  placeholder="Optional description"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setIsAddingCategory(false);
                  setNewCategory(EMPTY_CATEGORY);
                }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCategory}
                disabled={createCategoryMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
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

        {isLoadingCategoryConfigs ? (
          <LoadingSpinner className="py-12" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-[#3a3a3a]">
                  <th className="text-center py-3 px-2 font-semibold text-gray-700 dark:text-gray-300">Display Order</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Category</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Prefix</th>
                  <th className="text-center py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Leading Zeros</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Example</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {categoryConfigs.map((category) => {
                  const isEditing = editingCategoryId === category.id;
                  const currentLeadingZeros = isEditing ? tempConfig.leading_zeros : category.leading_zeros;

                  return (
                    <tr
                      key={category.id}
                      draggable
                      onDragStart={() => setDraggedCategoryId(category.id)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(category)}
                      className={`border-b border-gray-100 dark:border-[#333333] hover:bg-gray-50 dark:hover:bg-[#333333] transition-colors ${
                        draggedCategoryId === category.id ? 'opacity-50' : ''
                      }`}
                    >
                      <td className="py-3 px-2 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <GripVertical className="w-5 h-5 text-gray-400 dark:text-gray-500 cursor-move" />
                          <span className="text-sm font-mono text-gray-600 dark:text-gray-400">{category.display_order}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <input
                            type="text"
                            value={tempConfig.name}
                            onChange={(event) => setTempConfig({ ...tempConfig, name: event.target.value })}
                            maxLength={100}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-[#444444] rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                          />
                        ) : (
                          <span className="text-gray-900 dark:text-gray-100">{category.name}</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <input
                            type="text"
                            value={tempConfig.prefix}
                            onChange={(event) => setTempConfig({ ...tempConfig, prefix: event.target.value.toUpperCase() })}
                            maxLength={10}
                            className="w-24 px-2 py-1 border border-gray-300 dark:border-[#444444] rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                          />
                        ) : (
                          <span className="text-gray-900 dark:text-gray-100 font-mono">{category.prefix}</span>
                        )}
                      </td>
                      <td className="text-center py-3 px-4">
                        {isEditing ? (
                          <input
                            type="number"
                            value={tempConfig.leading_zeros}
                            onChange={(event) => setTempConfig({
                              ...tempConfig,
                              leading_zeros: Number.parseInt(event.target.value, 10) || 5,
                            })}
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
                          {category.prefix}-{String(1).padStart(currentLeadingZeros, '0')}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {isEditing ? (
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CategorySpecificationsManager />

      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a]">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Rename/Merge Manufacturers</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Select manufacturer to rename or merge with another manufacturer. All linked components update automatically.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <TypeaheadInput
              label="Manufacturer to Rename"
              value={sourceManufacturerName}
              onChange={setSourceManufacturerName}
              onSelect={setSourceManufacturerName}
              suggestions={manufacturerNames}
              placeholder="Search manufacturers..."
              inputClassName="pr-10"
            />
          </div>

          <div>
            <TypeaheadInput
              label="New Manufacturer Name"
              value={targetManufacturerName}
              onChange={setTargetManufacturerName}
              onSelect={setTargetManufacturerName}
              suggestions={manufacturerNames.filter((name) => name !== sourceManufacturerName)}
              placeholder="Type new name or select existing..."
              inputClassName="pr-10"
            />
          </div>
        </div>

        <button
          onClick={handleRenameManufacturer}
          disabled={!sourceManufacturerName || !targetManufacturerName || renameManufacturerMutation.isPending}
          className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white font-semibold py-2 px-6 rounded-lg transition-colors flex items-center gap-2"
        >
          {renameManufacturerMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
              Rename/Merge Manufacturer
            </>
          )}
        </button>
      </div>

      <ConfirmationModal
        isOpen={mergeConfirmation.isOpen}
        onClose={() => setMergeConfirmation({ isOpen: false, oldId: '', newName: '', message: '' })}
        onConfirm={() => renameManufacturerMutation.mutate({ oldId: mergeConfirmation.oldId, newName: mergeConfirmation.newName })}
        title="Merge Manufacturers"
        message={mergeConfirmation.message}
        confirmText="Merge"
        confirmStyle="primary"
        isLoading={renameManufacturerMutation.isPending}
      />
    </div>
  );
};

export default CategoryTab;