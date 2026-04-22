import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, Search, FileText, Sun, Moon, LogOut, User, UserCog, Shield, FileEdit, FolderOpen, ChevronLeft, ChevronRight, Layers, Cpu, TriangleAlert } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useFeatureFlags } from '../contexts/FeatureFlagsContext';
import { canAccessUserSettings, isLimitedNavigationRole } from '../utils/accessControl';

const Sidebar = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true');
  const { user, logout, isAdmin } = useAuth();
  const { ecoEnabled } = useFeatureFlags();
  const navigate = useNavigate();
  const isLimitedNavigation = isLimitedNavigationRole(user?.role);

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

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebarCollapsed', newState.toString());
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const displayName = user?.displayName?.trim() || 'Unknown User';

  const menuItems = [];

  if (!isLimitedNavigation) {
    menuItems.push({ path: '/', icon: LayoutDashboard, label: 'Dashboard' });
  }

  menuItems.push({ path: '/library', icon: Cpu, label: 'Parts Library' });

  if (!isLimitedNavigation) {
    menuItems.push(
      { path: '/file-library', icon: FolderOpen, label: 'File Library' }
    );
  }

  if (ecoEnabled) {
    menuItems.push({ path: '/eco', icon: FileEdit, label: 'ECO' });
  }

  if (!isLimitedNavigation) {
    menuItems.push(
      { path: '/inventory', icon: Package, label: 'Inventory' },
      { path: '/vendor-search', icon: Search, label: 'Vendor Search' },
      { path: '/projects', icon: Layers, label: 'Projects' },
      { path: '/reports', icon: FileText, label: 'Reports' },
      { path: '/audit', icon: TriangleAlert, label: 'Audit Log' },
    );
  }

  if (canAccessUserSettings(user?.role)) {
    menuItems.push({ path: '/user-settings', icon: UserCog, label: 'User Settings' });
  }

  // Only show Admin Settings for admin users
  if (isAdmin()) {
    menuItems.push({ path: '/admin-settings', icon: Shield, label: 'Admin Settings' });
  }

  return (
    <div className={`${isCollapsed ? 'w-15' : 'w-52.5'} transition-all duration-300 bg-gray-900 text-white h-screen flex flex-col overflow-hidden relative`}>
      {/* Toggle Button */}
      {isCollapsed ? (
        <button
          onClick={toggleSidebar}
          className="w-full flex justify-center py-3 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors shrink-0"
          title="Expand sidebar"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      ) : (
        <button
          onClick={toggleSidebar}
          className="absolute top-3 right-2 z-10 p-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
          title="Collapse sidebar"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      {/* Logo/Title */}
      {!isCollapsed && (
        <div className="p-5 border-b border-gray-700 shrink-0">
          <div className="flex items-center gap-3">
            <img src={logoPath} alt="IC Lib Logo" className="w-12 h-12"/>
            <div>
              <h1 className="text-xl font-bold">IC Lib</h1>
              <p className="text-sm text-gray-400">PCB Parts Library</p>
            </div>
          </div>
        </div>
      )}
      {isCollapsed && (
        <div className="border-b border-gray-700 shrink-0" />
      )}

      {/* Navigation Menu */}
      <nav className={`flex-1 ${isCollapsed ? 'p-2' : 'p-4'} overflow-y-auto custom-scrollbar`}>
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.path === '/'}
                title={isCollapsed ? item.label : ''}
                className={({ isActive }) =>
                  `flex items-center ${isCollapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`
                }
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {!isCollapsed && <span className="font-medium">{item.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Dark Mode Toggle */}
      <div className={`${isCollapsed ? 'px-2' : 'px-4'} pb-4 shrink-0`}>
        <button
          onClick={toggleDarkMode}
          title={isCollapsed ? (darkMode ? 'Dark Mode' : 'Light Mode') : ''}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-between px-1'} py-3 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-gray-300 hover:text-white`}
        >
          <div className={`flex items-center ${isCollapsed ? '' : 'gap-3'}`}>
            {darkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            {!isCollapsed && <span className="font-medium">{darkMode ? 'Dark Mode' : 'Light Mode'}</span>}
          </div>
          {!isCollapsed && (
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
          )}
        </button>
      </div>

      {/* User Info and Logout */}
      <div className={`${isCollapsed ? 'p-2' : 'p-4'} border-t border-gray-700 space-y-2 shrink-0`}>
        {/* User Info - hidden when collapsed */}
        {!isCollapsed && (
          <div className="flex items-center gap-3 px-3 py-2 bg-gray-800 rounded-lg">
            <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white whitespace-normal break-words leading-5">{displayName}</p>
              <p className="text-xs text-gray-400 capitalize">{user?.role?.replace('-', ' ')}</p>
            </div>
          </div>
        )}

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          title={isCollapsed ? 'Logout' : ''}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-3'} py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors text-gray-300 hover:text-white`}
        >
          <LogOut className="w-4 h-4" />
          {!isCollapsed && <span className="text-sm">Logout</span>}
        </button>
      </div>

      {/* Footer */}
      {!isCollapsed && (
        <div className="p-4 border-t border-gray-700 shrink-0">
          <p className="text-xs text-gray-500 text-center">
            Version {__APP_VERSION__}
          </p>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
