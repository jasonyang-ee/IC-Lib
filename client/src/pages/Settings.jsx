import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Database, AlertCircle, CheckCircle, Loader2, Edit, Check, X, Plus, Trash2, ChevronDown, AlertTriangle, FileText, User, Users, Key, RefreshCw, Package } from 'lucide-react';
import { api } from '../utils/api';
import { useNotification } from '../contexts/NotificationContext';

// User Management Component (Admin Only)
const UserManagement = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useNotification();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'read-only'
  });

  // Fetch all users
  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.getAllUsers();
      return response.data;
    },
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData) => {
      await api.createUser(userData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      setShowCreateModal(false);
      setFormData({ username: '', password: '', role: 'read-only' });
      showSuccess('User created successfully!');
    },
    onError: (error) => {
      const errorMsg = error.response?.data?.error || error.message;
      showError(`Error creating user: ${errorMsg}`);
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      await api.updateUser(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      setShowEditModal(false);
      setSelectedUser(null);
      showSuccess('User updated successfully!');
    },
    onError: (error) => {
      const errorMsg = error.response?.data?.error || error.message;
      showError(`Error updating user: ${errorMsg}`);
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (id) => {
      await api.deleteUser(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      setShowDeleteConfirm(null);
      showSuccess('User deleted successfully!');
    },
    onError: (error) => {
      const errorMsg = error.response?.data?.error || error.message;
      showError(`Error deleting user: ${errorMsg}`);
    },
  });

  const handleCreateUser = () => {
    if (!formData.username || !formData.password) {
      showError('Username and password are required');
      return;
    }
    createUserMutation.mutate(formData);
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setFormData({
      username: user.username,
      password: '', // Don't populate password
      role: user.role,
      is_active: user.is_active
    });
    setShowEditModal(true);
  };

  const handleUpdateUser = () => {
    const updateData = { ...formData };
    // Remove password if empty (don't change it)
    if (!updateData.password) {
      delete updateData.password;
    }
    updateUserMutation.mutate({ id: selectedUser.id, data: updateData });
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
      case 'approver':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200';
      case 'read-write':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200';
      case 'read-only':
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300';
    }
  };

  return (
    <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-gray-700 dark:text-gray-300" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">User Management</h2>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create User
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-[#3a3a3a]">
                <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Username</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Role</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Status</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Last Login</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Created</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((user) => (
                <tr key={user.id} className="border-b border-gray-100 dark:border-[#333333] hover:bg-gray-50 dark:hover:bg-[#333333]">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-900 dark:text-gray-100 font-medium">{user.username}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex px-2 py-1 text-xs rounded-full font-medium ${getRoleBadgeColor(user.role)}`}>
                      {user.role.replace('-', ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                      user.is_active
                        ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                        : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                    }`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                    {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleEditUser(user)}
                        className="p-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                        title="Edit user"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(user)}
                        className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                        title="Delete user"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setShowCreateModal(false)}
        >
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg p-6 max-w-md w-full border border-gray-200 dark:border-[#3a3a3a]">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Create New User</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100"
                  placeholder="Enter username"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Password *
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100"
                  placeholder="Minimum 6 characters"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100"
                >
                  <option value="read-only">Read Only</option>
                  <option value="read-write">Read Write</option>
                  <option value="approver">Approver</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateUser}
                disabled={createUserMutation.isPending}
                className="btn-primary disabled:bg-gray-400"
              >
                {createUserMutation.isPending ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setShowEditModal(false)}
        >
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg p-6 max-w-md w-full border border-gray-200 dark:border-[#3a3a3a]">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Edit User</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  New Password (leave blank to keep current)
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100"
                  placeholder="Leave blank to keep current password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100"
                >
                  <option value="read-only">Read Only</option>
                  <option value="read-write">Read Write</option>
                  <option value="approver">Approver</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-gray-300 dark:border-[#444444]"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700 dark:text-gray-300">
                  Account is active
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateUser}
                disabled={updateUserMutation.isPending}
                className="btn-primary disabled:bg-gray-400"
              >
                {updateUserMutation.isPending ? 'Updating...' : 'Update User'}
              </button>
            </div>
          </div>
        </div>
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
                Delete User
              </h3>
            </div>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Are you sure you want to delete user <strong>{showDeleteConfirm.username}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteUserMutation.mutate(showDeleteConfirm.id)}
                disabled={deleteUserMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-400"
              >
                {deleteUserMutation.isPending ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

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
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
        Category Specifications
      </h2>
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
                              onClick={() => handleDeleteSpec(spec)}
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

// Settings Page - Updated with Advanced Operations
const Settings = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useNotification();
  const [editingCategory, setEditingCategory] = useState(null);
  const [tempConfig, setTempConfig] = useState({ prefix: '', leading_zeros: 5, enabled: true });
  const [confirmDialog, setConfirmDialog] = useState({ show: false, action: '', title: '', message: '' });
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', description: '', prefix: '', leading_zeros: 5, enabled: true });
  const [showAdvancedOps, setShowAdvancedOps] = useState(false);
  const [showClearAuditConfirm, setShowClearAuditConfirm] = useState(false);
  
  // Auto Data Update states
  const [isUpdatingStock, setIsUpdatingStock] = useState(false);
  const [isUpdatingSpecs, setIsUpdatingSpecs] = useState(false);
  const [isUpdatingDistributors, setIsUpdatingDistributors] = useState(false);
  const [updateToast, setUpdateToast] = useState({ show: false, message: '', type: 'success' });
  const [bulkUpdateStockConfirm, setBulkUpdateStockConfirm] = useState(false);
  const [bulkUpdateSpecsConfirm, setBulkUpdateSpecsConfirm] = useState(false);
  const [bulkUpdateDistributorsConfirm, setBulkUpdateDistributorsConfirm] = useState(false);
  
  // Manufacturer rename states
  const [selectedManufacturer, setSelectedManufacturer] = useState('');
  const [newManufacturerName, setNewManufacturerName] = useState('');
  const [manufacturerSearchTerm, setManufacturerSearchTerm] = useState('');
  const [newNameSearchTerm, setNewNameSearchTerm] = useState('');
  const [manufacturerDropdownOpen, setManufacturerDropdownOpen] = useState(false);
  const [newNameDropdownOpen, setNewNameDropdownOpen] = useState(false);
  const manufacturerDropdownRef = useRef(null);
  const newNameDropdownRef = useRef(null);

  const { data: categoryConfigs, isLoading: loadingConfigs } = useQuery({
    queryKey: ['categoryConfigs'],
    queryFn: async () => {
      const response = await api.get('/settings/categories');
      return response.data;
    },
  });

  // Fetch manufacturers
  const { data: manufacturers } = useQuery({
    queryKey: ['manufacturers'],
    queryFn: async () => {
      const response = await api.getManufacturers();
      return response.data;
    },
  });

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (manufacturerDropdownRef.current && !manufacturerDropdownRef.current.contains(event.target)) {
        setManufacturerDropdownOpen(false);
      }
      if (newNameDropdownRef.current && !newNameDropdownRef.current.contains(event.target)) {
        setNewNameDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, config }) => {
      const response = await api.put(`/settings/categories/${id}`, config);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['categoryConfigs']);
      setEditingCategory(null);
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
      queryClient.invalidateQueries(['categoryConfigs']);
      setIsAddingCategory(false);
      setNewCategory({ name: '', description: '', prefix: '', leading_zeros: 5, enabled: true });
      showSuccess('Category created successfully!');
    },
    onError: (error) => {
      const errorMsg = error.response?.data?.message || error.message;
      showError(`Error creating category: ${errorMsg}`);
    },
  });

  // Rename manufacturer mutation
  const renameManufacturerMutation = useMutation({
    mutationFn: async ({ oldId, newName }) => {
      const response = await api.renameManufacturer(oldId, newName);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['manufacturers']);
      queryClient.invalidateQueries(['components']);
      setSelectedManufacturer('');
      setNewManufacturerName('');
      setManufacturerSearchTerm('');
      setNewNameSearchTerm('');
      showSuccess('Manufacturer renamed successfully!');
    },
    onError: (error) => {
      const errorMsg = error.response?.data?.message || error.message;
      showError(`Error renaming manufacturer: ${errorMsg}`);
    },
  });

  const initDbMutation = useMutation({
    mutationFn: async () => {
      const response = await api.initDatabase();
      return response;
    },
    onSuccess: () => {
      showSuccess('Database initialized successfully!');
      queryClient.invalidateQueries(['categoryConfigs']);
    },
    onError: (error) => {
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      showError(`Error initializing database: ${errorMsg}`);
    },
  });

  const loadSampleDataMutation = useMutation({
    mutationFn: async () => {
      const response = await api.loadSampleData();
      return response;
    },
    onSuccess: () => {
      showSuccess('Sample data loaded successfully!');
    },
    onError: (error) => {
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      showError(`Error loading sample data: ${errorMsg}`);
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
      if (data.data.valid) {
        showSuccess(message);
      } else {
        showError(message);
      }
    },
    onError: (error) => {
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      showError(errorMsg);
    },
  });

  // Clear audit logs mutation
  const clearAuditLogsMutation = useMutation({
    mutationFn: async () => {
      const response = await api.clearAuditLogs();
      return response;
    },
    onSuccess: (data) => {
      showSuccess(data.data.message || 'Audit logs cleared successfully!');
      queryClient.invalidateQueries(['auditLog']);
      setShowClearAuditConfirm(false);
    },
    onError: (error) => {
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      showError(`Error clearing audit logs: ${errorMsg}`);
    },
  });

  // Bulk update stock handler
  const handleBulkUpdateStock = async () => {
    setBulkUpdateStockConfirm(false);
    setIsUpdatingStock(true);
    setUpdateToast({ show: true, message: 'Starting bulk stock update...', type: 'info' });
    
    try {
      const result = await api.bulkUpdateStock();
      setUpdateToast({ 
        show: true, 
        message: `✓ Stock update complete: ${result.data.updatedCount} updated, ${result.data.skippedCount} skipped, ${result.data.errors?.length || 0} errors`, 
        type: 'success' 
      });
      
      // Refresh component data
      queryClient.invalidateQueries(['components']);
      queryClient.invalidateQueries(['componentDetails']);
      
      // Hide toast after 5 seconds
      setTimeout(() => {
        setUpdateToast({ show: false, message: '', type: 'success' });
      }, 5000);
    } catch (error) {
      console.error('Error updating stock:', error);
      setUpdateToast({ 
        show: true, 
        message: '✗ Error updating stock. Please try again.', 
        type: 'error' 
      });
      setTimeout(() => {
        setUpdateToast({ show: false, message: '', type: 'success' });
      }, 5000);
    } finally {
      setIsUpdatingStock(false);
    }
  };

  // Bulk update specifications handler
  const handleBulkUpdateSpecifications = async () => {
    setBulkUpdateSpecsConfirm(false);
    setIsUpdatingSpecs(true);
    setUpdateToast({ show: true, message: 'Starting bulk specification update...', type: 'info' });
    
    try {
      const result = await api.bulkUpdateSpecifications();
      setUpdateToast({ 
        show: true, 
        message: `✓ Specification update complete: ${result.data.updatedCount} parts updated, ${result.data.skippedCount} skipped, ${result.data.errors?.length || 0} errors`, 
        type: 'success' 
      });
      
      // Refresh component data
      queryClient.invalidateQueries(['components']);
      queryClient.invalidateQueries(['componentDetails']);
      
      // Hide toast after 5 seconds
      setTimeout(() => {
        setUpdateToast({ show: false, message: '', type: 'success' });
      }, 5000);
    } catch (error) {
      console.error('Error updating specifications:', error);
      setUpdateToast({ 
        show: true, 
        message: '✗ Error updating specifications. Please try again.', 
        type: 'error' 
      });
      setTimeout(() => {
        setUpdateToast({ show: false, message: '', type: 'success' });
      }, 5000);
    } finally {
      setIsUpdatingSpecs(false);
    }
  };

  // Bulk update distributors handler
  const handleBulkUpdateDistributors = async () => {
    setBulkUpdateDistributorsConfirm(false);
    setIsUpdatingDistributors(true);
    setUpdateToast({ show: true, message: 'Starting bulk distributor update...', type: 'info' });
    
    try {
      const result = await api.bulkUpdateDistributors();
      setUpdateToast({ 
        show: true, 
        message: `✓ Distributor update complete: ${result.data.updatedCount} distributors updated, ${result.data.skippedCount} skipped, ${result.data.errors?.length || 0} errors`, 
        type: 'success' 
      });
      
      // Refresh component data
      queryClient.invalidateQueries(['components']);
      queryClient.invalidateQueries(['componentDetails']);
      
      // Hide toast after 5 seconds
      setTimeout(() => {
        setUpdateToast({ show: false, message: '', type: 'success' });
      }, 5000);
    } catch (error) {
      console.error('Error updating distributors:', error);
      setUpdateToast({ 
        show: true, 
        message: '✗ Error updating distributors. Please try again.', 
        type: 'error' 
      });
      setTimeout(() => {
        setUpdateToast({ show: false, message: '', type: 'success' });
      }, 5000);
    } finally {
      setIsUpdatingDistributors(false);
    }
  };

  const resetDbMutation = useMutation({
    mutationFn: async () => {
      const response = await api.resetDatabase(true);
      return response;
    },
    onSuccess: () => {
      showSuccess('Database reset completed! All tables dropped and schema reinitialized.');
      queryClient.invalidateQueries(['categoryConfigs']);
    },
    onError: (error) => {
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      showError(`Error resetting database: ${errorMsg}`);
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
      showError('Name and prefix are required!');
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

  const handleRenameManufacturer = () => {
    if (!selectedManufacturer || !newManufacturerName) {
      showError('Please select a manufacturer and enter a new name');
      return;
    }

    const oldManufacturer = manufacturers?.find(m => m.id === selectedManufacturer);
    const newManufacturer = manufacturers?.find(m => m.name === newManufacturerName);

    if (newManufacturer && newManufacturer.id !== selectedManufacturer) {
      // Merging with existing manufacturer
      setConfirmDialog({
        show: true,
        action: 'merge',
        title: 'Merge Manufacturers',
        message: `This will merge "${oldManufacturer?.name}" into existing manufacturer "${newManufacturerName}". All components will be updated. Continue?`,
        oldId: selectedManufacturer,
        newName: newManufacturerName
      });
    } else {
      // Simple rename
      renameManufacturerMutation.mutate({ 
        oldId: selectedManufacturer, 
        newName: newManufacturerName 
      });
    }
  };

  const executeConfirmedAction = () => {
    const action = confirmDialog.action;
    const oldId = confirmDialog.oldId;
    const newName = confirmDialog.newName;
    setConfirmDialog({ show: false, action: '', title: '', message: '', oldId: '', newName: '' });
    
    if (action === 'init') {
      initDbMutation.mutate();
    } else if (action === 'load') {
      loadSampleDataMutation.mutate();
    } else if (action === 'verify') {
      verifyDbMutation.mutate();
    } else if (action === 'reset') {
      resetDbMutation.mutate();
    } else if (action === 'merge') {
      renameManufacturerMutation.mutate({ oldId, newName });
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Admin Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          System configuration and user management (Administrator access only)
        </p>
      </div>

      {/* Navigation Menu */}
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-4 mb-6 border border-gray-200 dark:border-[#3a3a3a] sticky top-0 z-10">
        <nav className="flex flex-wrap gap-2">
          {[
            { id: 'users', label: 'User Management', icon: Users },
            { id: 'categories', label: 'Categories', icon: Database },
            { id: 'auto-update', label: 'Auto Data Update', icon: RefreshCw },
            { id: 'database', label: 'Database Operations', icon: Database },
            { id: 'audit', label: 'Audit Logs', icon: FileText }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                const element = document.getElementById(id);
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-[#333333] hover:bg-primary-100 dark:hover:bg-primary-900/30 text-gray-700 dark:text-gray-300 hover:text-primary-700 dark:hover:text-primary-400 transition-colors font-medium text-sm"
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      <div className="space-y-6">
      {/* User Management Section */}
      <div id="users" className="scroll-mt-24">
        <UserManagement />
      </div>

      {/* Category Configuration Section */}
      <div id="categories" className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a] scroll-mt-24">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Category Configuration</h2>
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

      {/* Manufacturer Rename Section */}
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a]">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Rename/Merge Manufacturers</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Select a manufacturer to rename or merge with another manufacturer. All components will be updated automatically.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Select Manufacturer to Rename */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Manufacturer to Rename
            </label>
            <div className="relative" ref={manufacturerDropdownRef}>
              <input
                type="text"
                value={selectedManufacturer ? manufacturers?.find(m => m.id === selectedManufacturer)?.name || '' : manufacturerSearchTerm}
                onChange={(e) => {
                  setManufacturerSearchTerm(e.target.value);
                  setSelectedManufacturer('');
                  setManufacturerDropdownOpen(true);
                }}
                onFocus={() => setManufacturerDropdownOpen(true)}
                onClick={() => setManufacturerDropdownOpen(true)}
                placeholder="Search manufacturers..."
                className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100"
              />
              <button
                type="button"
                onClick={() => setManufacturerDropdownOpen(!manufacturerDropdownOpen)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${manufacturerDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {manufacturerDropdownOpen && manufacturers && manufacturers.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-[#2a2a2a] border border-gray-300 dark:border-[#444444] rounded-md shadow-lg max-h-60 overflow-y-auto custom-scrollbar">
                  {manufacturers
                    .filter(m => m.name.toLowerCase().includes(manufacturerSearchTerm.toLowerCase()))
                    .map((mfr) => (
                      <button
                        key={mfr.id}
                        type="button"
                        onClick={() => {
                          setSelectedManufacturer(mfr.id);
                          setManufacturerSearchTerm(mfr.name);
                          setManufacturerDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-[#333333] text-gray-700 dark:text-gray-300"
                      >
                        {mfr.name}
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* New Manufacturer Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              New Manufacturer Name
            </label>
            <div className="relative" ref={newNameDropdownRef}>
              <input
                type="text"
                value={newManufacturerName}
                onChange={(e) => {
                  setNewManufacturerName(e.target.value);
                  setNewNameSearchTerm(e.target.value);
                  setNewNameDropdownOpen(true);
                }}
                onFocus={() => setNewNameDropdownOpen(true)}
                onClick={() => setNewNameDropdownOpen(true)}
                placeholder="Type new name or select existing..."
                className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100"
              />
              <button
                type="button"
                onClick={() => setNewNameDropdownOpen(!newNameDropdownOpen)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${newNameDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {newNameDropdownOpen && manufacturers && manufacturers.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-[#2a2a2a] border border-gray-300 dark:border-[#444444] rounded-md shadow-lg max-h-60 overflow-y-auto custom-scrollbar">
                  {manufacturers
                    .filter(m => 
                      m.name.toLowerCase().includes(newManufacturerName.toLowerCase()) &&
                      m.id !== selectedManufacturer
                    )
                    .map((mfr) => (
                      <button
                        key={mfr.id}
                        type="button"
                        onClick={() => {
                          setNewManufacturerName(mfr.name);
                          setNewNameSearchTerm(mfr.name);
                          setNewNameDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-[#333333] text-gray-700 dark:text-gray-300"
                      >
                        {mfr.name} <span className="text-xs text-gray-500">(merge)</span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={handleRenameManufacturer}
          disabled={!selectedManufacturer || !newManufacturerName || renameManufacturerMutation.isPending}
          className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
        >
          {renameManufacturerMutation.isPending ? 'Processing...' : 'Rename/Merge Manufacturer'}
        </button>
      </div>

      {/* Database Operations Section */}
      <div id="database" className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a] scroll-mt-24">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Database Operations</h2>
        
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
            className="w-full bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border-2 border-orange-300 dark:border-orange-700 hover:border-orange-400 dark:hover:border-orange-600 rounded-lg p-4 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-orange-100 dark:bg-orange-900/30 rounded-full p-2">
                  <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="text-left">
                  <h4 className="font-semibold text-orange-900 dark:text-orange-200 text-base">
                    Advanced Operations
                  </h4>
                  <p className="text-xs text-orange-700 dark:text-orange-300 mt-0.5">
                    {showAdvancedOps ? 'Click to hide dangerous operations' : 'Click to show database management & dangerous operations'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                  {showAdvancedOps ? 'Hide' : 'Show'}
                </span>
                <svg 
                  className={`w-5 h-5 text-orange-600 dark:text-orange-400 transition-transform duration-200 ${showAdvancedOps ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </button>
          
          {showAdvancedOps && (
            <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4 mt-4 animate-fadeIn">
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

      {/* Auto Data Update Section */}
      <div id="auto-update" className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a] scroll-mt-24">
        <div className="flex items-center gap-2 mb-4">
          <RefreshCw className="w-6 h-6 text-gray-700 dark:text-gray-300" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Auto Data Update</h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Automatically update component data from distributor APIs. Only parts with valid distributor SKUs will be updated.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Update Stock Info */}
          <div className="border border-gray-200 dark:border-[#3a3a3a] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-5 h-5 text-green-600 dark:text-green-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Update Stock Info</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Update stock quantities, pricing, and availability from distributor APIs for all parts with SKUs.
            </p>
            <button
              onClick={() => setBulkUpdateStockConfirm(true)}
              disabled={isUpdatingStock || isUpdatingSpecs || isUpdatingDistributors}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isUpdatingStock ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Package className="w-4 h-4" />
                  Update Stock Info
                </>
              )}
            </button>
          </div>

          {/* Update Specifications */}
          <div className="border border-gray-200 dark:border-[#3a3a3a] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Update Parts Specifications</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Auto-fill component specifications from distributor data using mapped specification names. Preserves existing values.
            </p>
            <button
              onClick={() => setBulkUpdateSpecsConfirm(true)}
              disabled={isUpdatingStock || isUpdatingSpecs || isUpdatingDistributors}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isUpdatingSpecs ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Database className="w-4 h-4" />
                  Update Specifications
                </>
              )}
            </button>
          </div>

          {/* Update Distributors */}
          <div className="border border-gray-200 dark:border-[#3a3a3a] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Update Distributors</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Search and update distributor SKUs and URLs by matching manufacturer part numbers. Picks lowest MOQ if multiple matches.
            </p>
            <button
              onClick={() => setBulkUpdateDistributorsConfirm(true)}
              disabled={isUpdatingStock || isUpdatingSpecs || isUpdatingDistributors}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isUpdatingDistributors ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Update Distributors
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Audit Logs Management */}
      <div id="audit" className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a] scroll-mt-24">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-6 h-6 text-gray-700 dark:text-gray-300" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Audit Logs Management</h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Clear all audit log entries. This will permanently delete the activity history from the database.
        </p>
        <button
          onClick={() => setShowClearAuditConfirm(true)}
          disabled={clearAuditLogsMutation.isPending}
          className="bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          {clearAuditLogsMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Clearing...
            </>
          ) : (
            <>
              <Trash2 className="w-4 h-4" />
              Clear All Audit Logs
            </>
          )}
        </button>
      </div>

      {showClearAuditConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg p-6 max-w-md w-full border border-gray-200 dark:border-[#3a3a3a]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Clear Audit Logs
              </h3>
            </div>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Are you sure you want to clear all audit logs? This will permanently delete all activity history from the database. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowClearAuditConfirm(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => clearAuditLogsMutation.mutate()}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                Clear Logs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Update Stock Confirmation */}
      {bulkUpdateStockConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg p-6 max-w-md w-full border border-gray-200 dark:border-[#3a3a3a]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <Package className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Update Stock Info
              </h3>
            </div>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              This will update stock quantities, pricing, and availability from distributor APIs for all parts with SKUs. This may take several minutes depending on the number of parts.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setBulkUpdateStockConfirm(false)}
                className="px-4 py-2 border border-gray-300 dark:border-[#444444] rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#333333]"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkUpdateStock}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                Start Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Update Specifications Confirmation */}
      {bulkUpdateSpecsConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg p-6 max-w-md w-full border border-gray-200 dark:border-[#3a3a3a]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <Database className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Update Parts Specifications
              </h3>
            </div>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              This will auto-fill component specifications from distributor data for all parts with SKUs. Only specifications with mapped names will be updated. Existing values will be preserved if no vendor data is found. This may take several minutes.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setBulkUpdateSpecsConfirm(false)}
                className="px-4 py-2 border border-gray-300 dark:border-[#444444] rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#333333]"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkUpdateSpecifications}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Start Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Update Distributors Confirmation */}
      {bulkUpdateDistributorsConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg p-6 max-w-md w-full border border-gray-200 dark:border-[#3a3a3a]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                <RefreshCw className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Update Distributors
              </h3>
            </div>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              This will search for and update distributor SKUs and URLs for all parts by matching manufacturer part numbers. If multiple results are found, the one with the lowest minimum order quantity will be selected. This may take several minutes.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setBulkUpdateDistributorsConfirm(false)}
                className="px-4 py-2 border border-gray-300 dark:border-[#444444] rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#333333]"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkUpdateDistributors}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                Start Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {updateToast.show && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-slide-down">
          <div className={`rounded-lg shadow-lg p-4 max-w-md border ${
            updateToast.type === 'success' 
              ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800' 
              : updateToast.type === 'error'
              ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800'
              : 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800'
          }`}>
            <div className="flex items-center gap-3">
              {updateToast.type === 'success' && <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />}
              {updateToast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />}
              {updateToast.type === 'info' && <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />}
              <p className={`text-sm font-medium ${
                updateToast.type === 'success' 
                  ? 'text-green-800 dark:text-green-200' 
                  : updateToast.type === 'error'
                  ? 'text-red-800 dark:text-red-200'
                  : 'text-blue-800 dark:text-blue-200'
              }`}>
                {updateToast.message}
              </p>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
};

export default Settings;
