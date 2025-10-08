import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sun, Moon, Save } from 'lucide-react';
import { api } from '../utils/api';

const Settings = () => {
  const queryClient = useQueryClient();
  const [darkMode, setDarkMode] = useState(false);
  const [partNumberConfigs, setPartNumberConfigs] = useState({});
  const [editingCategory, setEditingCategory] = useState(null);
  const [tempConfig, setTempConfig] = useState({ prefix: '', leadingZeros: 5 });

  // Load dark mode preference from localStorage on mount
  useEffect(() => {
    const savedMode = localStorage.getItem('darkMode');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = savedMode === 'true' || (!savedMode && prefersDark);

    setDarkMode(shouldBeDark);
    if (shouldBeDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Load part number configs from localStorage
  useEffect(() => {
    const savedConfigs = localStorage.getItem('partNumberConfigs');
    if (savedConfigs) {
      setPartNumberConfigs(JSON.parse(savedConfigs));
    }
  }, []);

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await api.getCategories();
      return response.data;
    },
  });

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('darkMode', newMode.toString());

    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
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
    localStorage.setItem('partNumberConfigs', JSON.stringify(newConfigs));
    setEditingCategory(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your application preferences</p>
      </div>

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

      </div>

      {/* Part Number Configuration Section */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Part Number Configuration</h2>
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
                const exampleNumber = (tempConfig.prefix || config.prefix || 'XXX') + '-' + '1'.padStart(isEditing ? tempConfig.leadingZeros : config.leadingZeros, '0');

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
        {/* Placeholder tiles for future features */}
        <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md border border-gray-200 dark:border-[#3a3a3a] p-6 opacity-50">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            User Preferences
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Coming soon...
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
            Notifications
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Configure alert preferences
          </p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
