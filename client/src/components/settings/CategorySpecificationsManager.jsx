import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Loader2, Check, GripVertical, Download, Upload, AlertTriangle } from 'lucide-react';
import { api } from '../../utils/api';
import { useNotification } from '../../contexts/NotificationContext';

// Category Specifications Manager Component
const CategorySpecificationsManager = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useNotification();
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isAddingSpec, setIsAddingSpec] = useState(false);
  const [editingSpec, setEditingSpec] = useState(null);
  const [newSpec, setNewSpec] = useState({ spec_name: '', unit: '', mapping_spec_names: [], is_required: false });
  const [tempSpec, setTempSpec] = useState({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [newMappingInput, setNewMappingInput] = useState('');
  const [editMappingInput, setEditMappingInput] = useState('');
  const [draggedSpec, setDraggedSpec] = useState(null);
  const categoryFileInputRef = useRef(null);

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
      setNewSpec({ spec_name: '', unit: '', mapping_spec_names: [], is_required: false });
      setNewMappingInput('');
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

  // Reorder specifications mutation
  const reorderSpecsMutation = useMutation({
    mutationFn: async (specs) => {
      await api.reorderCategorySpecifications(selectedCategory, { specifications: specs });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['categorySpecifications', selectedCategory]);
      showSuccess('Specification order updated successfully!');
    },
    onError: (error) => {
      const errorMsg = error.response?.data?.message || error.message;
      showError(`Error updating specification order: ${errorMsg}`);
    },
  });

  // Export categories with specifications handler
  const handleExportCategories = async () => {
    if (!categories || categories.length === 0) {
      showError('No categories to export');
      return;
    }

    try {
      const response = await api.exportCategories();
      const result = response.data;

      if (!result.success) {
        showError('Export failed');
        return;
      }

      // Download the JSON file to user
      const dataStr = JSON.stringify(result.data.categories, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `categories-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showSuccess('Categories exported successfully!');
    } catch (error) {
      console.error('Export error:', error);
      showError('Failed to export categories');
    }
  };

  // Import categories with specifications handler
  const handleImportCategories = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importedCategories = JSON.parse(e.target.result);

        if (!Array.isArray(importedCategories)) {
          showError('Invalid file format. Expected an array of categories.');
          return;
        }

        // Validate required fields
        for (const cat of importedCategories) {
          if (!cat.name || !cat.prefix) {
            showError(`Invalid category data: each category must have name and prefix`);
            return;
          }
        }

        const response = await api.importCategories(importedCategories);
        const result = response.data;

        if (result.success) {
          queryClient.invalidateQueries(['categories']);
          queryClient.invalidateQueries(['categorySpecifications']);
          const catStats = result.results.categories;
          const specStats = result.results.specifications;
          showSuccess(`Import complete: ${catStats.created} categories created, ${catStats.updated} updated; ${specStats.created} specs created, ${specStats.updated} updated, ${specStats.deleted} deleted`);
        } else {
          showError('Import failed');
        }
      } catch (error) {
        console.error('Import error:', error);
        showError('Failed to import categories: ' + (error.response?.data?.error || error.message));
      }
    };
    reader.readAsText(file);
    // Reset file input
    event.target.value = '';
  };

  // Drag and drop handlers for specification reordering
  const handleDragStartSpec = (spec) => {
    setDraggedSpec(spec);
  };

  const handleDragOverSpec = (e) => {
    e.preventDefault();
  };

  const handleDropSpec = (targetSpec) => {
    if (!draggedSpec || draggedSpec.id === targetSpec.id) {
      setDraggedSpec(null);
      return;
    }

    const specs = [...(specifications || [])];
    const draggedIndex = specs.findIndex(s => s.id === draggedSpec.id);
    const targetIndex = specs.findIndex(s => s.id === targetSpec.id);

    const [removed] = specs.splice(draggedIndex, 1);
    specs.splice(targetIndex, 0, removed);

    const updatedSpecs = specs.map((spec, index) => ({
      id: spec.id,
      display_order: index + 1
    }));

    reorderSpecsMutation.mutate(updatedSpecs);
    setDraggedSpec(null);
  };

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
    setTempSpec({
      ...spec,
      mapping_spec_names: Array.isArray(spec.mapping_spec_names) ? spec.mapping_spec_names : []
    });
    setEditMappingInput('');
  };

  const handleSaveSpec = () => {
    if (editingSpec) {
      updateSpecMutation.mutate({
        id: editingSpec,
        data: tempSpec,
      });
    }
  };

  const handleDeleteSpec = (spec) => {
    setShowDeleteConfirm(spec);
  };

  const confirmDeleteSpec = () => {
    if (showDeleteConfirm) {
      deleteSpecMutation.mutate(showDeleteConfirm.id);
      setShowDeleteConfirm(null);
    }
  };

  return (
    <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Category Specifications
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage specification fields for each category. All components in a category will use these specifications.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCategories}
            disabled={!categories || categories.length === 0}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Export
          </button>

          <label className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-2 cursor-pointer">
            <Upload className="w-4 h-4" />
            Import
            <input
              type="file"
              ref={categoryFileInputRef}
              accept=".json"
              onChange={handleImportCategories}
              className="hidden"
            />
          </label>
        </div>
      </div>

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

              {/* Vendor Mapping List */}
              <div className="mt-4">
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Vendor Mappings
                </label>
                <div className="space-y-2">
                  {newSpec.mapping_spec_names && newSpec.mapping_spec_names.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {newSpec.mapping_spec_names.map((mapping, index) => (
                        <div
                          key={index}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm"
                        >
                          <span>{mapping}</span>
                          <button
                            onClick={() => {
                              const updated = [...newSpec.mapping_spec_names];
                              updated.splice(index, 1);
                              setNewSpec({ ...newSpec, mapping_spec_names: updated });
                            }}
                            className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newMappingInput}
                      onChange={(e) => setNewMappingInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && newMappingInput.trim()) {
                          e.preventDefault();
                          if (!newSpec.mapping_spec_names.includes(newMappingInput.trim())) {
                            setNewSpec({
                              ...newSpec,
                              mapping_spec_names: [...newSpec.mapping_spec_names, newMappingInput.trim()]
                            });
                          }
                          setNewMappingInput('');
                        }
                      }}
                      placeholder="Enter vendor field name and press Enter"
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-sm"
                    />
                    <button
                      onClick={() => {
                        if (newMappingInput.trim() && !newSpec.mapping_spec_names.includes(newMappingInput.trim())) {
                          setNewSpec({
                            ...newSpec,
                            mapping_spec_names: [...newSpec.mapping_spec_names, newMappingInput.trim()]
                          });
                          setNewMappingInput('');
                        }
                      }}
                      disabled={!newMappingInput.trim()}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md transition-colors text-sm"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
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
                    <th className="text-center py-3 px-2 font-semibold text-gray-700 dark:text-gray-300 w-32">
                      Display Order
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                      Specification Name
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                      Unit
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                      Vendor Mapping
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">
                      Required
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
                      draggable="true"
                      onDragStart={() => handleDragStartSpec(spec)}
                      onDragOver={handleDragOverSpec}
                      onDrop={() => handleDropSpec(spec)}
                      className={`border-b border-gray-100 dark:border-[#333333] hover:bg-gray-50 dark:hover:bg-[#333333] transition-colors ${
                        draggedSpec?.id === spec.id ? 'opacity-50' : ''
                      }`}
                    >
                      <td className="py-3 px-2 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <GripVertical className="w-5 h-5 text-gray-400 dark:text-gray-500 cursor-move" />
                          <span className="text-sm font-mono text-gray-600 dark:text-gray-400">{spec.display_order}</span>
                        </div>
                      </td>
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
                          <div className="space-y-2">
                            {tempSpec.mapping_spec_names && tempSpec.mapping_spec_names.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-1">
                                {tempSpec.mapping_spec_names.map((mapping, index) => (
                                  <div
                                    key={index}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs"
                                  >
                                    <span>{mapping}</span>
                                    <button
                                      onClick={() => {
                                        const updated = [...tempSpec.mapping_spec_names];
                                        updated.splice(index, 1);
                                        setTempSpec({ ...tempSpec, mapping_spec_names: updated });
                                      }}
                                      className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5"
                                    >
                                      <X className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="flex gap-1">
                              <input
                                type="text"
                                value={editMappingInput}
                                onChange={(e) => setEditMappingInput(e.target.value)}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter' && editMappingInput.trim()) {
                                    e.preventDefault();
                                    if (!tempSpec.mapping_spec_names.includes(editMappingInput.trim())) {
                                      setTempSpec({
                                        ...tempSpec,
                                        mapping_spec_names: [...tempSpec.mapping_spec_names, editMappingInput.trim()]
                                      });
                                    }
                                    setEditMappingInput('');
                                  }
                                }}
                                placeholder="Add mapping"
                                className="w-32 px-2 py-1 border border-gray-300 dark:border-[#444444] rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 text-xs"
                              />
                              <button
                                onClick={() => {
                                  if (editMappingInput.trim() && !tempSpec.mapping_spec_names.includes(editMappingInput.trim())) {
                                    setTempSpec({
                                      ...tempSpec,
                                      mapping_spec_names: [...tempSpec.mapping_spec_names, editMappingInput.trim()]
                                    });
                                    setEditMappingInput('');
                                  }
                                }}
                                disabled={!editMappingInput.trim()}
                                className="px-1 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {spec.mapping_spec_names && spec.mapping_spec_names.length > 0 ? (
                              spec.mapping_spec_names.map((mapping, index) => (
                                <span
                                  key={index}
                                  className="inline-flex px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs"
                                >
                                  {mapping}
                                </span>
                              ))
                            ) : (
                              <span className="text-gray-600 dark:text-gray-400 text-sm">-</span>
                            )}
                          </div>
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
                            <button
                              onClick={() => handleDeleteSpec(spec)}
                              disabled={deleteSpecMutation.isPending}
                              className="bg-red-600 hover:bg-red-700 text-white font-semibold py-1 px-3 rounded transition-colors disabled:opacity-50 text-sm"
                            >
                              Delete
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEditSpec(spec)}
                            className="bg-primary-600 hover:bg-primary-700 text-white font-semibold py-1 px-3 rounded transition-colors text-sm"
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
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>No specifications defined for this category yet.</p>
              <p className="text-sm mt-2">Click "Add Specification" to create one.</p>
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg p-6 max-w-md w-full border border-gray-200 dark:border-[#3a3a3a]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Delete Specification
              </h3>
            </div>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Delete specification "<strong>{showDeleteConfirm.spec_name}</strong>"?
              This will also remove all component values for this specification.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteSpec}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategorySpecificationsManager;
