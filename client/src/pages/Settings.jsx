import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sun, Moon, Save, Database, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { api } from '../utils/api';

const Settings = () => {
  const queryClient = useQueryClient();
  const [darkMode, setDarkMode] = useState(false);
  const [partNumberConfigs, setPartNumberConfigs] = useState({});
  const [editingCategory, setEditingCategory] = useState(null);
  const [tempConfig, setTempConfig] = useState({ prefix: '', leadingZeros: 5 });
  const [dbOperationStatus, setDbOperationStatus] = useState({ show: false, type: '', message: '' });
  const [confirmDialog, setConfirmDialog] = useState({ show: false, action: '', title: '', message: '' });

  // Load dark mode from localStorage (client-side only)
  useEffect(() => {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode !== null) {
      const shouldBeDark = savedMode === 'true';
      setDarkMode(shouldBeDark);
      if (shouldBeDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, []);

  // Fetch settings from server (part number configs only)
  const { data: serverSettings, isLoading: loadingSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await api.getSettings();
      return response.data;
    },
  });

  // Update settings mutation (part number configs only)
  const updateSettingsMutation = useMutation({
    mutationFn: (settings) => api.updateSettings(settings),
    onSuccess: () => {
      queryClient.invalidateQueries(['settings']);
    },
  });

  // Load part number configs from server when available
  useEffect(() => {
    if (serverSettings) {
      setPartNumberConfigs(serverSettings.partNumberConfigs || {});
    }
  }, [serverSettings]);

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await api.getCategories();
      return response.data;
    },
  });

  // Database stats query
  const { data: dbStats, refetch: refetchStats } = useQuery({
    queryKey: ['databaseStats'],
    queryFn: async () => {
      const response = await api.getDatabaseStats();
      return response.data;
    },
  });

  // Database operations mutations
  const initDbMutation = useMutation({
    mutationFn: () => api.initDatabase(),
    onSuccess: () => {
      setDbOperationStatus({ show: true, type: 'success', message: 'Database initialized successfully!' });
      refetchStats();
      setTimeout(() => setDbOperationStatus({ show: false, type: '', message: '' }), 5000);
    },
    onError: (error) => {
      setDbOperationStatus({ show: true, type: 'error', message: `Failed to initialize database: ${error.message}` });
      setTimeout(() => setDbOperationStatus({ show: false, type: '', message: '' }), 5000);
    },
  });

  const resetDbMutation = useMutation({
    mutationFn: () => api.resetDatabase(),
    onSuccess: () => {
      setDbOperationStatus({ show: true, type: 'success', message: 'Database reset successfully!' });
      refetchStats();
      setTimeout(() => setDbOperationStatus({ show: false, type: '', message: '' }), 5000);
    },
    onError: (error) => {
      setDbOperationStatus({ show: true, type: 'error', message: `Failed to reset database: ${error.message}` });
      setTimeout(() => setDbOperationStatus({ show: false, type: '', message: '' }), 5000);
    },
  });

  const loadSampleMutation = useMutation({
    mutationFn: () => api.loadSampleData(),
    onSuccess: () => {
      setDbOperationStatus({ show: true, type: 'success', message: 'Sample data loaded successfully!' });
      refetchStats();
      setTimeout(() => setDbOperationStatus({ show: false, type: '', message: '' }), 5000);
    },
    onError: (error) => {
      setDbOperationStatus({ show: true, type: 'error', message: `Failed to load sample data: ${error.message}` });
      setTimeout(() => setDbOperationStatus({ show: false, type: '', message: '' }), 5000);
    },
  });

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);

    // Save to localStorage (client-side only)
    localStorage.setItem('darkMode', newMode.toString());

    // Force immediate DOM update
    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Debug log
    console.log('Dark mode toggled:', newMode);
    console.log('HTML classList:', document.documentElement.className);
  };

  const handleEditCategory = (categoryId) => {
    const config = partNumberConfigs[categoryId] || { prefix: '', leadingZeros: 5 };
    setTempConfig(config);
    setEditingCategory(categoryId);
  };

  const handleSaveConfig = (categoryId) => {
    const newConfigs = {
      ...partNumberConfigs,
      [categoryId]: tempConfig,
    };
    setPartNumberConfigs(newConfigs);
    
    // Update server
    updateSettingsMutation.mutate({ partNumberConfigs: newConfigs });
    
    setEditingCategory(null);
  };

  const handleDatabaseOperation = (action) => {
    let title = '';
    let message = '';

    switch (action) {
      case 'init':
        title = 'Initialize Database';
        message = 'This will create all tables, triggers, and required schema. Continue?';
        break;
      case 'reset':
        title = 'Reset Database';
        message = 'This will DELETE ALL DATA from the database. This action cannot be undone. Are you sure?';
        break;
      case 'load':
        title = 'Load Sample Data';
        message = 'This will load sample components into the database. Continue?';
        break;
      default:
        return;
    }

    setConfirmDialog({ show: true, action, title, message });
  };

  const confirmDatabaseOperation = () => {
    const { action } = confirmDialog;
    setConfirmDialog({ show: false, action: '', title: '', message: '' });

    switch (action) {
      case 'init':
        initDbMutation.mutate();
        break;
      case 'reset':
        resetDbMutation.mutate();
        break;
      case 'load':
        loadSampleMutation.mutate();
        break;
    }
  };

  const cancelDatabaseOperation = () => {
    setConfirmDialog({ show: false, action: '', title: '', message: '' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your application preferences</p>
      </div>

      {/* User Settings Section */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">User Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Theme Toggle Tile */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                {darkMode ? (
                  <Moon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                ) : (
                  <Sun className="w-6 h-6 text-primary-600" />
                )}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Theme
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {darkMode ? 'Dark Mode' : 'Light Mode'}
                  </p>
                </div>
              </div>
            </div>
            
            <button
              onClick={toggleDarkMode}
              className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-[#2a2a2a] ${
                darkMode ? 'bg-primary-600' : 'bg-gray-200'
              }`}
              role="switch"
              aria-checked={darkMode}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  darkMode ? 'translate-x-9' : 'translate-x-1'
                }`}
              />
            </button>
            
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
              Switch between light and dark theme for better viewing experience
            </p>
          </div>

          {/* Placeholder tiles for future user settings */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] p-6 opacity-50">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Notifications
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Coming soon...
            </p>
          </div>

          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] p-6 opacity-50">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Language
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Coming soon...
            </p>
          </div>
        </div>
      </div>

      {/* Server Settings Section */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Server Settings</h2>
        
        {/* Part Number Configuration */}
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Part Number Configuration</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Configure part number prefixes and serial number format for each component category
          </p>

          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-[#333333]">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Category</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Prefix</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Leading Zeros</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Example</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories?.map((category) => {
                const config = partNumberConfigs[category.id] || { prefix: '', leadingZeros: 5 };
                const isEditing = editingCategory === category.id;
                // Fix: Use the correct config for each category (not tempConfig for non-editing rows)
                const displayPrefix = isEditing ? tempConfig.prefix : config.prefix;
                const displayLeadingZeros = isEditing ? tempConfig.leadingZeros : config.leadingZeros;
                const exampleNumber = (displayPrefix || 'XXX') + '-' + '1'.padStart(displayLeadingZeros, '0');

                return (
                  <tr key={category.id} className="border-t border-gray-200 dark:border-[#3a3a3a]">
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">{category.name}</td>
                    <td className="px-6 py-4">
                      {isEditing ? (
                        <input
                          type="text"
                          value={tempConfig.prefix}
                          onChange={(e) => setTempConfig({ ...tempConfig, prefix: e.target.value.toUpperCase() })}
                          placeholder="e.g., RES"
                          className="w-32 px-3 py-1 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                        />
                      ) : (
                        <span className="text-sm text-gray-700 dark:text-gray-300">{config.prefix || 'Not set'}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {isEditing ? (
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={tempConfig.leadingZeros}
                          onChange={(e) => setTempConfig({ ...tempConfig, leadingZeros: parseInt(e.target.value) || 5 })}
                          className="w-20 px-3 py-1 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#333333] dark:text-gray-100 text-sm"
                        />
                      ) : (
                        <span className="text-sm text-gray-700 dark:text-gray-300">{config.leadingZeros}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <code className="text-sm bg-gray-100 dark:bg-[#333333] px-2 py-1 rounded text-gray-900 dark:text-gray-100">
                        {exampleNumber}
                      </code>
                    </td>
                    <td className="px-6 py-4">
                      {isEditing ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveConfig(category.id)}
                            className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold py-1 px-3 rounded transition-colors flex items-center gap-1"
                          >
                            <Save className="w-3 h-3" />
                            Save
                          </button>
                          <button
                            onClick={() => setEditingCategory(null)}
                            className="bg-gray-300 hover:bg-gray-400 dark:bg-[#333333] dark:hover:bg-[#3a3a3a] text-gray-700 dark:text-gray-300 text-sm font-semibold py-1 px-3 rounded transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleEditCategory(category.id)}
                          className="text-primary-600 hover:text-primary-700 dark:text-primary-400 text-sm font-semibold"
                        >
                          Configure
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Additional Server Settings Placeholders */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
        <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] p-6 opacity-50">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            API Keys
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Configure Digikey, Mouser, and other API keys
          </p>
        </div>

        <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] p-6 opacity-50">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Backup & Restore
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Manage database backups
          </p>
        </div>

        <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] p-6 opacity-50">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Server Configuration
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Coming soon...
          </p>
        </div>
      </div>

      {/* Database Management Section */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Database className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          Database Management
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Manage database initialization, reset, and sample data loading
        </p>

        {/* Status Message */}
        {dbOperationStatus.show && (
          <div className={`mb-4 p-4 rounded-lg flex items-center gap-3 ${
            dbOperationStatus.type === 'success' 
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          }`}>
            {dbOperationStatus.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            )}
            <span className={`text-sm font-medium ${
              dbOperationStatus.type === 'success' 
                ? 'text-green-800 dark:text-green-200' 
                : 'text-red-800 dark:text-red-200'
            }`}>
              {dbOperationStatus.message}
            </span>
          </div>
        )}

        {/* Confirmation Dialog */}
        {confirmDialog.show && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <div className="flex items-start gap-3 mb-4">
                <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {confirmDialog.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {confirmDialog.message}
                  </p>
                </div>
              </div>
              <div className="flex gap-3 justify-end mt-6">
                <button
                  onClick={cancelDatabaseOperation}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-[#333333] dark:hover:bg-[#3a3a3a] text-gray-700 dark:text-gray-300 rounded-md font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDatabaseOperation}
                  className={`px-4 py-2 rounded-md font-medium transition-colors ${
                    confirmDialog.action === 'reset'
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-primary-600 hover:bg-primary-700 text-white'
                  }`}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Database Statistics */}
        {dbStats && (
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Current Database Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Components</div>
                <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                  {dbStats.summary?.total_components || 0}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Categories</div>
                <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                  {dbStats.summary?.total_categories || 0}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Manufacturers</div>
                <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                  {dbStats.summary?.total_manufacturers || 0}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Distributors</div>
                <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                  {dbStats.summary?.total_distributors || 0}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Specifications</div>
                <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                  {dbStats.summary?.total_specifications || 0}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Database Operations */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Initialize Database */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] p-6">
            <div className="flex items-center mb-3">
              <Database className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 ml-2">
                Initialize Database
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Create all database tables, triggers, and CIS-compliant schema structure
            </p>
            <button
              onClick={() => handleDatabaseOperation('init')}
              disabled={initDbMutation.isPending}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded transition-colors flex items-center justify-center gap-2"
            >
              {initDbMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Initializing...
                </>
              ) : (
                'Initialize Schema'
              )}
            </button>
          </div>

          {/* Reset Database */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] p-6">
            <div className="flex items-center mb-3">
              <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 ml-2">
                Clear All Data
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Delete all components, manufacturers, and other data (preserves schema)
            </p>
            <button
              onClick={() => handleDatabaseOperation('reset')}
              disabled={resetDbMutation.isPending}
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded transition-colors flex items-center justify-center gap-2"
            >
              {resetDbMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                'Clear Data'
              )}
            </button>
          </div>

          {/* Load Sample Data */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] p-6">
            <div className="flex items-center mb-3">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 ml-2">
                Load Sample Data
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Populate database with 40+ sample components across all categories
            </p>
            <button
              onClick={() => handleDatabaseOperation('load')}
              disabled={loadSampleMutation.isPending}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded transition-colors flex items-center justify-center gap-2"
            >
              {loadSampleMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </>
              ) : (
                'Load Samples'
              )}
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default Settings;
