import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';
import { Package, Database, AlertTriangle, TrendingUp, Box, Layers } from 'lucide-react';

const Dashboard = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: async () => {
      const response = await api.getDashboardStats();
      return response.data;
    },
  });

  const { data: categoryBreakdown } = useQuery({
    queryKey: ['categoryBreakdown'],
    queryFn: async () => {
      const response = await api.getCategoryBreakdown();
      return response.data;
    },
  });

  const { data: recentActivities } = useQuery({
    queryKey: ['recentActivities'],
    queryFn: async () => {
      const response = await api.getRecentActivities();
      return response.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Components',
      value: stats?.totalComponents || 0,
      icon: Package,
      color: 'bg-blue-500',
      change: '+12%',
    },
    {
      title: 'Categories',
      value: stats?.totalCategories || 0,
      icon: Layers,
      color: 'bg-green-500',
      change: null,
    },
    {
      title: 'Inventory Items',
      value: stats?.totalInventoryItems || 0,
      icon: Box,
      color: 'bg-purple-500',
      change: '+8%',
    },
    {
      title: 'Missing Footprints',
      value: stats?.missingFootprints || 0,
      icon: AlertTriangle,
      color: 'bg-orange-500',
      change: '-5%',
    },
    {
      title: 'Low Stock Alerts',
      value: stats?.lowStockAlerts || 0,
      icon: TrendingUp,
      color: 'bg-red-500',
      change: stats?.lowStockAlerts > 0 ? 'Action needed' : 'All good',
    },
    {
      title: 'Total Inventory Qty',
      value: stats?.totalInventoryQuantity || 0,
      icon: Database,
      color: 'bg-indigo-500',
      change: null,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Overview of your component library</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
            {recentActivities?.slice(0, 6).map((activity, index) => (
              <div key={index} className="flex items-start gap-3 pb-3 border-b border-gray-100 dark:border-[#3a3a3a] last:border-0">
                <div className="bg-primary-100 dark:bg-primary-900 p-2 rounded-lg">
                  <Package className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {activity.part_number}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {activity.description || 'No description'}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {new Date(activity.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                  Added
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
