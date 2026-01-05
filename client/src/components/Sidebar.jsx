import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, BookOpen, Package, Search, FileText, Box, Settings, ClipboardList, Sun, Moon, FolderKanban, LogOut, User, UserCog, Shield, FileEdit } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const Sidebar = () => {
  const [darkMode, setDarkMode] = useState(false);
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  
  // Check if ECO feature is enabled from environment variable
  const ecoEnabled = import.meta.env.VITE_CONFIG_ECO === 'true';

  // Construct the logo path - Vite serves public folder assets from root
  const logoPath = './logo_bg.png';

  useEffect(() => {
    // Initialize dark mode from localStorage
    const savedMode = localStorage.getItem('darkMode') === 'true';
    setDarkMode(savedMode);
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

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const menuItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/library', icon: BookOpen, label: 'Parts Library' },
    { path: '/inventory', icon: Package, label: 'Inventory' },
    { path: '/vendor-search', icon: Search, label: 'Vendor Search' },
    { path: '/projects', icon: FolderKanban, label: 'Projects' },
    { path: '/reports', icon: FileText, label: 'Reports' },
    { path: '/audit', icon: ClipboardList, label: 'Audit Log' },
  ];

  // Add ECO menu item if feature is enabled
  if (ecoEnabled) {
    menuItems.push({ path: '/eco', icon: FileEdit, label: 'ECO' });
  }

  // User Settings available to all users
  menuItems.push({ path: '/user-settings', icon: UserCog, label: 'User Settings' });

  // Only show Admin Settings for admin users
  if (isAdmin()) {
    menuItems.push({ path: '/admin-settings', icon: Shield, label: 'Admin Settings' });
  }

  return (
    <div className="w-[210px] bg-gray-900 text-white h-screen flex flex-col overflow-hidden">
      {/* Logo/Title */}
      <div className="p-5 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <img src={logoPath} alt="IC Lib Logo" className="w-12 h-12"/>
          <div>
            <h1 className="text-xl font-bold">IC Lib</h1>
            <p className="text-sm text-gray-400">PCB Parts Library</p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4 overflow-y-auto custom-scrollbar">
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Dark Mode Toggle */}
      <div className="px-4 pb-4 flex-shrink-0">
        <button
          onClick={toggleDarkMode}
          className="w-full flex items-center justify-between px-1 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-gray-300 hover:text-white"
        >
          <div className="flex items-center gap-3">
            {darkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            <span className="font-medium">{darkMode ? 'Dark Mode' : 'Light Mode'}</span>
          </div>
          <div
            className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
              darkMode ? 'bg-primary-600' : 'bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                darkMode ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </div>
        </button>
      </div>

      {/* User Info and Logout */}
      <div className="p-4 border-t border-gray-700 space-y-2 flex-shrink-0">
        {/* User Info */}
        <div className="flex items-center gap-3 px-3 py-2 bg-gray-800 rounded-lg">
          <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
            <User className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.username}</p>
            <p className="text-xs text-gray-400 capitalize">{user?.role?.replace('-', ' ')}</p>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors text-gray-300 hover:text-white"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm">Logout</span>
        </button>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-700 flex-shrink-0">
        <p className="text-xs text-gray-500 text-center">
          IC Lib © 2025 • AGPL-3.0 License
        </p>
      </div>
    </div>
  );
};

export default Sidebar;
