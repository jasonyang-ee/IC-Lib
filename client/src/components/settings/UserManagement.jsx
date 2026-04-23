import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, User, Plus, Loader2, Download, Upload, AlertTriangle } from 'lucide-react';
import { api } from '../../utils/api';
import { useNotification } from '../../contexts/NotificationContext';

// User Management Component (Admin Only)
const UserManagement = () => {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useNotification();
  const modalBackdropClass = 'fixed inset-0 bg-slate-900/20 backdrop-blur-[1px] flex items-center justify-center z-50 p-4';
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'read-only'
  });
  const fileInputRef = useRef(null);

  const resetFormData = () => {
    setFormData({ username: '', password: '', role: 'read-only', display_name: '', email: '' });
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    resetFormData();
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setSelectedUser(null);
    resetFormData();
  };

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
      closeCreateModal();
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
      closeEditModal();
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
      closeEditModal();
      showSuccess('User deleted successfully!');
    },
    onError: (error) => {
      const errorMsg = error.response?.data?.error || error.message;
      showError(`Error deleting user: ${errorMsg}`);
    },
  });

  // Export users handler
  const handleExportUsers = async () => {
    if (!users || users.length === 0) {
      showError('No users to export');
      return;
    }

    try {
      const response = await api.exportUsers();
      const result = response.data;

      if (!result.success) {
        showError('Export failed');
        return;
      }

      // Download the JSON file to user
      const dataStr = JSON.stringify(result.data.users, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `users-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showSuccess('Users exported successfully!');
    } catch (error) {
      console.error('Export error:', error);
      showError('Failed to export users');
    }
  };

  // Import users handler
  const handleImportUsers = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importedUsers = JSON.parse(e.target.result);

        if (!Array.isArray(importedUsers)) {
          showError('Invalid file format. Expected an array of users.');
          return;
        }

        // Validate required fields
        for (const user of importedUsers) {
          if (!user.username || !user.role) {
            showError(`Invalid user data: each user must have username and role`);
            return;
          }
        }

        const response = await api.importUsers(importedUsers);
        const result = response.data;

        if (result.success) {
          queryClient.invalidateQueries(['users']);
          const stats = result.results;
          showSuccess(`Import complete: ${stats.created} created, ${stats.updated} updated, ${stats.deactivated} deactivated`);
        } else {
          showError('Import failed');
        }
      } catch (error) {
        console.error('Import error:', error);
        showError('Failed to import users: ' + (error.response?.data?.error || error.message));
      }
    };
    reader.readAsText(file);
    // Reset file input
    event.target.value = '';
  };

  const handleCreateUser = () => {
    if (!formData.username) {
      showError('Username is required');
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
      case 'reviewer':
        return 'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-200';
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
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportUsers}
            disabled={!users || users.length === 0}
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
              ref={fileInputRef}
              accept=".json"
              onChange={handleImportUsers}
              className="hidden"
            />
          </label>

          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create User
          </button>
        </div>
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
                        className="px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded transition-colors"
                      >
                        Edit
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
          className={modalBackdropClass}
          onClick={(e) => e.target === e.currentTarget && closeCreateModal()}
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
                  Display Name
                </label>
                <input
                  type="text"
                  value={formData.display_name || ''}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100"
                  placeholder="Full name (optional)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100"
                  placeholder="Email (optional - for welcome notification)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100"
                  placeholder="Leave blank to auto-generate"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  If left blank, a random password will be generated and sent via email
                </p>
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
                  <option value="reviewer">Reviewer</option>
                  <option value="read-write">Read Write</option>
                  <option value="approver">Approver</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={closeCreateModal}
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
          className={modalBackdropClass}
          onClick={(e) => e.target === e.currentTarget && closeEditModal()}
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
                  <option value="reviewer">Reviewer</option>
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

            <div className="flex justify-between items-center gap-2 mt-6">
              <button
                onClick={() => setShowDeleteConfirm(selectedUser)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
              >
                Delete User
              </button>
              <div className="flex gap-2">
                <button
                  onClick={closeEditModal}
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
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className={modalBackdropClass}
          onClick={(e) => e.target === e.currentTarget && setShowDeleteConfirm(null)}
        >
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

export default UserManagement;
