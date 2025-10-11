import { NavLink } from 'react-router-dom';
import { LayoutDashboard, BookOpen, Package, Search, FileText, Box, Settings, Building2 } from 'lucide-react';

const Sidebar = () => {
  const menuItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/library', icon: BookOpen, label: 'Parts Library' },
    { path: '/manufacturers', icon: Building2, label: 'Manufacturer Library' },
    { path: '/inventory', icon: Package, label: 'Inventory' },
    { path: '/vendor-search', icon: Search, label: 'Vendor Search' },
    { path: '/reports', icon: FileText, label: 'Reports' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="w-[300px] bg-gray-900 text-white min-h-screen flex flex-col">
      {/* Logo/Title */}
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="bg-primary-600 p-2 rounded-lg">
            <Box className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">IC Lib</h1>
            <p className="text-sm text-gray-400">PCB Component Library</p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4">
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

      {/* Footer */}
      <div className="p-4 border-t border-gray-700">
        <p className="text-xs text-gray-500 text-center">
          © 2025 IC Lib. AGPL-3.0 Licensed Application.
        </p>
      </div>
    </div>
  );
};

export default Sidebar;
