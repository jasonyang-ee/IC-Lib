import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { Search, Edit, Trash2, Plus, X, Check } from 'lucide-react';

const ManufacturerLibrary = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedManufacturer, setSelectedManufacturer] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAddMode, setIsAddMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState(new Set());

  // Fetch manufacturers
  const { data: manufacturers, isLoading } = useQuery({
    queryKey: ['manufacturers', searchTerm],
    queryFn: async () => {
      const response = await api.getManufacturers({ search: searchTerm });
      return response.data;
    },
  });

  // Add mutation
  const addMutation = useMutation({
    mutationFn: (data) => api.createManufacturer(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['manufacturers']);
      setIsAddMode(false);
      setEditData({});
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.updateManufacturer(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['manufacturers']);
      setIsEditMode(false);
      setSelectedManufacturer(null);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => api.deleteManufacturer(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['manufacturers']);
      setSelectedManufacturer(null);
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids) => {
      await Promise.all(ids.map(id => api.deleteManufacturer(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['manufacturers']);
      setDeleteMode(false);
      setSelectedForDelete(new Set());
    },
  });

  const handleEdit = () => {
    setIsEditMode(true);
    setEditData(selectedManufacturer || {});
  };

  const handleSave = () => {
    if (isAddMode) {
      addMutation.mutate(editData);
    } else if (selectedManufacturer) {
      updateMutation.mutate({ id: selectedManufacturer.id, data: editData });
    }
  };

  const handleDelete = () => {
    if (selectedManufacturer && window.confirm('Are you sure you want to delete this manufacturer?')) {
      deleteMutation.mutate(selectedManufacturer.id);
    }
  };

  const handleBulkDelete = () => {
    if (selectedForDelete.size === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedForDelete.size} manufacturer(s)?`)) {
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

  const handleAddNew = () => {
    setIsAddMode(true);
    setIsEditMode(true);
    setSelectedManufacturer(null);
    setEditData({ name: '', website: '' });
  };

  const handleCancelAdd = () => {
    setIsAddMode(false);
    setIsEditMode(false);
    setEditData({});
  };

  const handleFieldChange = (field, value) => {
    setEditData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleDeleteMode = () => {
    setDeleteMode(!deleteMode);
    setSelectedForDelete(new Set());
  };

  const filteredManufacturers = manufacturers?.filter(m =>
    m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.website?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Manufacturer Library</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Manage component manufacturers</p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left Sidebar - Search */}
        <div className="col-span-3 space-y-4">
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Search</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search manufacturers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100"
              />
            </div>
          </div>
        </div>

        {/* Center - Manufacturer List and Details */}
        <div className="col-span-6 space-y-4">
          {/* Manufacturer Details (Upper) - Shown when editing or adding */}
          {(isAddMode || (selectedManufacturer && isEditMode)) && (
            <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a]">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {isAddMode ? 'Add New Manufacturer' : 'Edit Manufacturer'}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-600 dark:text-gray-400 mb-1 text-sm">Manufacturer Name *</label>
                  <input
                    type="text"
                    value={editData.name || ''}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    placeholder="e.g., Vishay Dale"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 dark:text-gray-400 mb-1 text-sm">Website</label>
                  <input
                    type="url"
                    value={editData.website || ''}
                    onChange={(e) => handleFieldChange('website', e.target.value)}
                    placeholder="https://www.manufacturer.com"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Selected Manufacturer Details (View Mode) */}
          {selectedManufacturer && !isEditMode && !isAddMode && (
            <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a]">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Manufacturer Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Name:</span>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{selectedManufacturer.name}</p>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Website:</span>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {selectedManufacturer.website ? (
                      <a href={selectedManufacturer.website} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                        {selectedManufacturer.website}
                      </a>
                    ) : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Manufacturer List (Lower) */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a]">
            <div className="p-4 border-b border-gray-200 dark:border-[#3a3a3a] flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Manufacturers ({filteredManufacturers?.length || 0})
              </h3>
              <div className="flex gap-2">
                {deleteMode ? (
                  <button
                    onClick={handleBulkDelete}
                    disabled={selectedForDelete.size === 0}
                    className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Confirm Delete ({selectedForDelete.size})
                  </button>
                ) : (
                  <button
                    onClick={handleAddNew}
                    className="bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Manufacturer
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-auto max-h-[500px]">
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : filteredManufacturers?.length > 0 ? (
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-[#333333] sticky top-0">
                    <tr>
                      {deleteMode && (
                        <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 w-12">
                          <input
                            type="checkbox"
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedForDelete(new Set(filteredManufacturers.map(m => m.id)));
                              } else {
                                setSelectedForDelete(new Set());
                              }
                            }}
                            checked={selectedForDelete.size === filteredManufacturers.length && filteredManufacturers.length > 0}
                            className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                          />
                        </th>
                      )}
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Name</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Website</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredManufacturers.map((manufacturer) => (
                      <tr
                        key={manufacturer.id}
                        onClick={() => !deleteMode && setSelectedManufacturer(manufacturer)}
                        className={`cursor-pointer border-b border-gray-100 dark:border-[#3a3a3a] hover:bg-gray-50 dark:hover:bg-[#333333] ${
                          selectedManufacturer?.id === manufacturer.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                        }`}
                      >
                        {deleteMode && (
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedForDelete.has(manufacturer.id)}
                              onChange={() => toggleDeleteSelection(manufacturer.id)}
                              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                            />
                          </td>
                        )}
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{manufacturer.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {manufacturer.website ? (
                            <a href={manufacturer.website} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                              {manufacturer.website.length > 40 ? manufacturer.website.substring(0, 40) + '...' : manufacturer.website}
                            </a>
                          ) : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  No manufacturers found
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar - Actions */}
        <div className="col-span-3 space-y-4">
          {/* Actions for Add/Edit Mode */}
          {(isAddMode || isEditMode) && (
            <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={handleSave}
                  disabled={!editData.name}
                  className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {isAddMode ? 'Add Manufacturer' : 'Save Changes'}
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

          {/* Actions for View Mode */}
          {selectedManufacturer && !isEditMode && !isAddMode && (
            <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={handleEdit}
                  className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Edit Manufacturer
                </button>
                <button
                  onClick={handleDelete}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Manufacturer
                </button>
              </div>
            </div>
          )}

          {/* Delete Mode Toggle */}
          {!isAddMode && !isEditMode && (
            <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 border border-gray-200 dark:border-[#3a3a3a]">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Bulk Actions</h3>
              <button
                onClick={toggleDeleteMode}
                className={`w-full font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                  deleteMode
                    ? 'bg-gray-300 hover:bg-gray-400 dark:bg-[#333333] dark:hover:bg-[#3a3a3a] text-gray-700 dark:text-gray-300'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {deleteMode ? (
                  <>
                    <X className="w-4 h-4" />
                    Cancel Selection
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Multiple
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManufacturerLibrary;
