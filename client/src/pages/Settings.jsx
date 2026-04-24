import { useState } from 'react';
import { Database, FileText, Mail, Package, RefreshCw, Settings as SettingsIcon, Users } from 'lucide-react';
import {
  BomTab,
  CategoryTab,
  EcoTab,
  EmailTab,
  LogsTab,
  OperationTab,
  UpdateTab,
  UserTab,
} from '../components/settings';

const SETTINGS_TABS = [
  { id: 'user', label: 'User', icon: Users },
  { id: 'bom', label: 'BOM', icon: Package },
  { id: 'category', label: 'Category', icon: Database },
  { id: 'eco', label: 'ECO', icon: SettingsIcon },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'update', label: 'Update', icon: RefreshCw },
  { id: 'operation', label: 'Operation', icon: Database },
  { id: 'logs', label: 'Logs', icon: FileText },
];

const TAB_COMPONENTS = {
  user: UserTab,
  bom: BomTab,
  category: CategoryTab,
  eco: EcoTab,
  email: EmailTab,
  update: UpdateTab,
  operation: OperationTab,
  logs: LogsTab,
};

const Settings = () => {
  const [activeTab, setActiveTab] = useState('user');
  const ActiveTab = TAB_COMPONENTS[activeTab] || UserTab;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Admin Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          System configuration and user management.
        </p>
      </div>

      <div className="border-b border-gray-200 dark:border-[#3a3a3a] mb-6 overflow-x-auto">
        <nav className="flex min-w-max gap-6">
          {SETTINGS_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="space-y-6">
        <ActiveTab />
      </div>
    </div>
  );
};

export default Settings;
