import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { Package, Database, AlertTriangle, TrendingUp, Box, Layers, Settings, Edit, Trash2, Minus, MapPin, Users, Building2, Briefcase, FileText, Link2 } from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();

  const { data: stats, isLoading, error: statsError } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: async () => {
      const response = await api.getDashboardStats();
      return response.data;
    },
    retry: false,
  });

  const { data: categoryBreakdown, error: categoryError } = useQuery({
    queryKey: ['categoryBreakdown'],
    queryFn: async () => {
      const response = await api.getCategoryBreakdown();
      return response.data;
    },
    retry: false,
  });

  const { data: recentActivities, error: activitiesError } = useQuery({
    queryKey: ['recentActivities'],
    queryFn: async () => {
      const response = await api.getRecentActivities();
      return response.data;
    },
    retry: false,
  });

  const { data: extendedStats } = useQuery({
    queryKey: ['extendedStats'],
    queryFn: async () => {
      const response = await api.getExtendedDashboardStats();
      return response.data;
    },
    retry: false,
  });

  // Check if database is not initialized (500 errors related to missing tables)
  const isDatabaseNotInitialized = 
    statsError?.response?.status === 500 || 
    categoryError?.response?.status === 500 || 
    activitiesError?.response?.status === 500;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Show database initialization message
  if (isDatabaseNotInitialized) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Overview of your component library</p>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 dark:border-yellow-600 p-6 rounded-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-8 w-8 text-yellow-400 dark:text-yellow-500" />
            </div>
            <div className="ml-4 flex-1">
              <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                Database Not Initialized
              </h3>
              <p className="text-yellow-700 dark:text-yellow-300 mb-4">
                The database has not been initialized yet. Please go to the Settings page to initialize the database before using the application.
              </p>
              <button
                onClick={() => navigate('/settings')}
                className="inline-flex items-center px-4 py-2 bg-yellow-600 hover:bg-yellow-700 dark:bg-yellow-700 dark:hover:bg-yellow-800 text-white font-medium rounded-lg transition-colors duration-200 shadow-sm"
              >
                <Settings className="w-5 h-5 mr-2" />
                Go to Settings
              </button>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-[#2a2a2a] border border-gray-200 dark:border-[#3a3a3a] rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Quick Start Guide
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
            <li>Navigate to Settings using the button above or the sidebar</li>
            <li>Click on "Database Management" section</li>
            <li>Click "Initialize Database" to create the database schema</li>
            <li>Optionally, load sample data to get started quickly</li>
            <li>Return to the Dashboard to see your component library</li>
          </ol>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Components',
      value: stats?.totalComponents || 0,
      icon: Package,
      color: 'bg-blue-500',
    },
    {
      title: 'Categories',
      value: stats?.totalCategories || 0,
      icon: Layers,
      color: 'bg-green-500',
    },
    {
      title: 'Inventory Items',
      value: stats?.totalInventoryItems || 0,
      icon: Box,
      color: 'bg-purple-500',
    },
    {
      title: 'Total Users',
      value: extendedStats?.totalUsers || 0,
      icon: Users,
      color: 'bg-cyan-500',
    },
    {
      title: 'Manufacturers',
      value: extendedStats?.totalManufacturers || 0,
      icon: Building2,
      color: 'bg-teal-500',
    },
    {
      title: 'Projects',
      value: extendedStats?.totalProjects || 0,
      icon: Briefcase,
      color: 'bg-indigo-500',
    },
    {
      title: 'Missing Footprints',
      value: stats?.missingFootprints || 0,
      icon: AlertTriangle,
      color: 'bg-orange-500',
    },
    {
      title: 'Low Stock Alerts',
      value: stats?.lowStockAlerts || 0,
      icon: TrendingUp,
      color: 'bg-red-500',
    },
    {
      title: 'Total Inventory Qty',
      value: stats?.totalInventoryQuantity || 0,
      icon: Database,
      color: 'bg-violet-500',
    },
    {
      title: 'With Specifications',
      value: extendedStats?.componentsWithSpecs || 0,
      icon: FileText,
      color: 'bg-emerald-500',
    },
    {
      title: 'With Alternatives',
      value: extendedStats?.componentsWithAlternatives || 0,
      icon: Link2,
      color: 'bg-pink-500',
    },
    {
      title: 'Distributors',
      value: extendedStats?.totalDistributors || 0,
      icon: Building2,
      color: 'bg-amber-500',
    },
  ];

  return (
    <div className="space-y-6 overflow-y-auto custom-scrollbar">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Overview of your component library system</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <div key={index} className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.title}</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">{stat.value.toLocaleString()}</p>
                {stat.change && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{stat.change}</p>
                )}
              </div>
              <div className={`${stat.color} p-3 rounded-lg`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Approval Status */}
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a]">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Approval Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">New</span>
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {stats?.approvalStatus?.new || 0}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Pending Review</span>
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {stats?.approvalStatus?.pending_review || 0}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Approved</span>
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {stats?.approvalStatus?.approved || 0}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Experimental</span>
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {stats?.approvalStatus?.experimental || 0}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Archived</span>
            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {stats?.approvalStatus?.archived || 0}
            </span>
          </div>
        </div>
      </div>

      {/* System Health Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Project Activity */}
        <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a]">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Project Overview</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Active Projects</span>
              <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {extendedStats?.activeProjects || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Components in Projects</span>
              <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {extendedStats?.totalProjectComponents || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Avg Components/Project</span>
              <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {extendedStats?.avgComponentsPerProject || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Top Storage Locations */}
        <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a]">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Top Storage Locations</h2>
          <div className="space-y-2">
            {extendedStats?.topLocations?.slice(0, 5).map((location, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {location.location || 'Unknown'}
                  </span>
                </div>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {location.count} items
                </span>
              </div>
            )) || <p className="text-sm text-gray-500 dark:text-gray-400">No locations recorded</p>}
          </div>
        </div>

        {/* Recent User Logins */}
        <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a]">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Recent User Activity</h2>
          <div className="space-y-2">
            {extendedStats?.recentLogins?.slice(0, 5).map((user, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{user.username}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{user.role}</p>
                  </div>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                </span>
              </div>
            )) || <p className="text-sm text-gray-500 dark:text-gray-400">No user activity</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a]">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Category Distribution</h2>
          <div className="space-y-3">
            {categoryBreakdown?.slice(0, 8).map((category, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{category.category}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 bg-gray-200 dark:bg-[#333333] rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full"
                      style={{
                        width: `${Math.min((category.count / (stats?.totalComponents || 1)) * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 w-12 text-right">
                    {category.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activities */}
        <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a]">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Recent Activities</h2>
          <div className="space-y-4">
            {recentActivities?.slice(0, 6).map((activity, index) => {
              const activityConfig = {
                added: {
                  icon: Package,
                  bgColor: 'bg-primary-100 dark:bg-primary-900',
                  iconColor: 'text-primary-600 dark:text-primary-400',
                  badgeColor: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
                  label: 'Added'
                },
                updated: {
                  icon: Edit,
                  bgColor: 'bg-blue-100 dark:bg-blue-900',
                  iconColor: 'text-blue-600 dark:text-blue-400',
                  badgeColor: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
                  label: 'Updated'
                },
                deleted: {
                  icon: Trash2,
                  bgColor: 'bg-red-100 dark:bg-red-900',
                  iconColor: 'text-red-600 dark:text-red-400',
                  badgeColor: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
                  label: 'Deleted'
                },
                inventory_updated: {
                  icon: TrendingUp,
                  bgColor: 'bg-green-100 dark:bg-green-900',
                  iconColor: 'text-green-600 dark:text-green-400',
                  badgeColor: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
                  label: 'Qty Updated'
                },
                inventory_consumed: {
                  icon: Minus,
                  bgColor: 'bg-orange-100 dark:bg-orange-900',
                  iconColor: 'text-orange-600 dark:text-orange-400',
                  badgeColor: 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200',
                  label: 'Consumed'
                },
                location_updated: {
                  icon: MapPin,
                  bgColor: 'bg-purple-100 dark:bg-purple-900',
                  iconColor: 'text-purple-600 dark:text-purple-400',
                  badgeColor: 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200',
                  label: 'Location'
                }
              };

              const config = activityConfig[activity.activity_type] || activityConfig.added;
              const IconComponent = config.icon;

              // Parse change details if available
              let changeText = '';
              if (activity.change_details) {
                const details = activity.change_details;
                if (activity.activity_type === 'inventory_updated' || activity.activity_type === 'inventory_consumed') {
                  changeText = ` (${details.old_quantity} → ${details.new_quantity})`;
                } else if (activity.activity_type === 'location_updated') {
                  changeText = ` (${details.old_location || 'None'} → ${details.new_location})`;
                }
              }

              return (
                <div key={index} className="flex items-start gap-3 pb-3 border-b border-gray-100 dark:border-[#3a3a3a] last:border-0">
                  <div className={`${config.bgColor} p-2 rounded-lg`}>
                    <IconComponent className={`w-4 h-4 ${config.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {activity.part_number}
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">{changeText}</span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {activity.description || 'No description'}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {new Date(activity.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`text-xs ${config.badgeColor} px-2 py-1 rounded`}>
                    {config.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
