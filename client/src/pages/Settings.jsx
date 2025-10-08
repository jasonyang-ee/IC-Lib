import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

const Settings = () => {
  const [darkMode, setDarkMode] = useState(false);

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
