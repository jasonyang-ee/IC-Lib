import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { 
  Package, Database, AlertTriangle, TrendingUp, Box, Layers, Settings, 
  Edit, Trash2, Minus, MapPin, Users, Building2, Briefcase, FileText, Link2 
} from 'lucide-react';

// Compact stat card component
const StatCard = ({ title, value, icon, color, small = false }) => {
  const IconComponent = icon;
  return (
    <div className={`bg-white dark:bg-[#2a2a2a] rounded-lg border border-gray-200 dark:border-[#3a3a3a] ${small ? 'p-3' : 'p-4'}`}>
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className={`${small ? 'text-xs' : 'text-sm'} font-medium text-gray-500 dark:text-gray-400 truncate`}>{title}</p>
          <p className={`${small ? 'text-xl' : 'text-2xl'} font-bold text-gray-900 dark:text-gray-100`}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
        </div>
        <div className={`${color} ${small ? 'p-2' : 'p-2.5'} rounded-lg shrink-0`}>
          <IconComponent className={`${small ? 'w-4 h-4' : 'w-5 h-5'} text-white`} />
        </div>
      </div>
    </div>
  );
};

// Status badge component
const StatusBadge = ({ label, value, bgColor }) => (
  <div className={`flex items-center justify-between p-2 ${bgColor} rounded-lg`}>
    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</span>
    <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{value}</span>
  </div>
);

// Compact list item component
const ListItem = ({ icon, primary, secondary, trailing }) => {
  const IconComponent = icon;
  return (
    <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <IconComponent className="w-4 h-4 text-gray-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{primary}</p>
          {secondary && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{secondary}</p>}
        </div>
      </div>
      {trailing && <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0 ml-2">{trailing}</span>}
    </div>
  );
};

// Activity item component
const ActivityItem = ({ activity }) => {
  const config = {
    added: { icon: Package, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30', label: '+' },
    updated: { icon: Edit, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30', label: '✎' },
    deleted: { icon: Trash2, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30', label: '×' },
    inventory_updated: { icon: TrendingUp, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30', label: '↑' },
    inventory_consumed: { icon: Minus, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/30', label: '↓' },
    location_updated: { icon: MapPin, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/30', label: '📍' }
  }[activity.activity_type] || { icon: Package, color: 'text-gray-600', bg: 'bg-gray-100', label: '•' };

  const date = new Date(activity.created_at);
  const timeAgo = getTimeAgo(date);

  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-gray-100 dark:border-gray-700/50 last:border-0">
      <span className={`${config.bg} ${config.color} w-5 h-5 rounded text-xs flex items-center justify-center font-bold`}>
        {config.label}
      </span>
      <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate flex-1">
        {activity.part_number}
      </span>
      <span className="text-xs text-gray-400">{timeAgo}</span>
    </div>
  );
};

// Helper function for time ago
const getTimeAgo = (date) => {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return date.toLocaleDateString();
};

// Category bar chart component
const CategoryBar = ({ name, count, total }) => {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-gray-600 dark:text-gray-400 w-24 truncate">{name}</span>
      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div className="bg-primary-600 h-2 rounded-full transition-all" style={{ width: `${Math.min(percentage, 100)}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-8 text-right">{count}</span>
    </div>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();

  const { data: stats, isLoading, error: statsError } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: async () => (await api.getDashboardStats()).data,
    retry: false,
  });

  const { data: categoryBreakdown, error: categoryError } = useQuery({
    queryKey: ['categoryBreakdown'],
    queryFn: async () => (await api.getCategoryBreakdown()).data,
    retry: false,
  });

  const { data: recentActivities, error: activitiesError } = useQuery({
    queryKey: ['recentActivities'],
    queryFn: async () => (await api.getRecentActivities()).data,
    retry: false,
  });

  const { data: extendedStats } = useQuery({
    queryKey: ['extendedStats'],
    queryFn: async () => (await api.getExtendedDashboardStats()).data,
    retry: false,
  });

  const isDatabaseNotInitialized = 
    statsError?.response?.status === 500 || 
    categoryError?.response?.status === 500 || 
    activitiesError?.response?.status === 500;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (isDatabaseNotInitialized) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-yellow-500 shrink-0" />
            <div>
              <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">Database Not Initialized</h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                Initialize the database in Settings to get started.
              </p>
              <button
                onClick={() => navigate('/settings')}
                className="mt-3 inline-flex items-center px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium rounded transition-colors"
              >
                <Settings className="w-4 h-4 mr-1.5" />
                Go to Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Component library overview</p>
        </div>
      </div>

      {/* Primary Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard title="Components" value={stats?.totalComponents || 0} icon={Package} color="bg-blue-500" />
        <StatCard title="Categories" value={stats?.totalCategories || 0} icon={Layers} color="bg-green-500" />
        <StatCard title="Inventory" value={stats?.totalInventoryItems || 0} icon={Box} color="bg-purple-500" />
        <StatCard title="Users" value={extendedStats?.totalUsers || 0} icon={Users} color="bg-cyan-500" />
        <StatCard title="Manufacturers" value={extendedStats?.totalManufacturers || 0} icon={Building2} color="bg-teal-500" />
        <StatCard title="Projects" value={extendedStats?.totalProjects || 0} icon={Briefcase} color="bg-indigo-500" />
      </div>

      {/* Secondary Stats + Approval Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Alert Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard small title="Missing Footprints" value={stats?.missingFootprints || 0} icon={AlertTriangle} color="bg-orange-500" />
          <StatCard small title="Low Stock" value={stats?.lowStockAlerts || 0} icon={TrendingUp} color="bg-red-500" />
          <StatCard small title="Total Qty" value={stats?.totalInventoryQuantity || 0} icon={Database} color="bg-violet-500" />
          <StatCard small title="With Specs" value={extendedStats?.componentsWithSpecs || 0} icon={FileText} color="bg-emerald-500" />
          <StatCard small title="With Alts" value={extendedStats?.componentsWithAlternatives || 0} icon={Link2} color="bg-pink-500" />
          <StatCard small title="Distributors" value={extendedStats?.totalDistributors || 0} icon={Building2} color="bg-amber-500" />
        </div>

        {/* Approval Status */}
        <div className="bg-white dark:bg-[#2a2a2a] rounded-lg border border-gray-200 dark:border-[#3a3a3a] p-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Approval Status</h2>
          <div className="grid grid-cols-5 gap-2">
            <StatusBadge label="New" value={stats?.approvalStatus?.new || 0} bgColor="bg-gray-100 dark:bg-gray-800" />
            <StatusBadge label="Pending" value={stats?.approvalStatus?.pending_review || 0} bgColor="bg-yellow-50 dark:bg-yellow-900/20" />
            <StatusBadge label="Approved" value={stats?.approvalStatus?.approved || 0} bgColor="bg-green-50 dark:bg-green-900/20" />
            <StatusBadge label="Experimental" value={stats?.approvalStatus?.experimental || 0} bgColor="bg-purple-50 dark:bg-purple-900/20" />
            <StatusBadge label="Archived" value={stats?.approvalStatus?.archived || 0} bgColor="bg-red-50 dark:bg-red-900/20" />
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Category Distribution */}
        <div className="bg-white dark:bg-[#2a2a2a] rounded-lg border border-gray-200 dark:border-[#3a3a3a] p-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Categories</h2>
          <div className="space-y-2">
            {categoryBreakdown?.slice(0, 10).map((cat, i) => (
              <CategoryBar key={i} name={cat.category} count={cat.count} total={stats?.totalComponents || 1} />
            ))}
          </div>
        </div>

        {/* Recent Activities */}
        <div className="bg-white dark:bg-[#2a2a2a] rounded-lg border border-gray-200 dark:border-[#3a3a3a] p-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Recent Activity</h2>
          <div className="space-y-0">
            {recentActivities?.slice(0, 8).map((activity, i) => (
              <ActivityItem key={i} activity={activity} />
            )) || <p className="text-xs text-gray-500">No recent activity</p>}
          </div>
        </div>

        {/* Quick Info Panels */}
        <div className="space-y-4">
          {/* Project Overview */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg border border-gray-200 dark:border-[#3a3a3a] p-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Projects</h2>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{extendedStats?.activeProjects || 0}</p>
                <p className="text-xs text-gray-500">Active</p>
              </div>
              <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded">
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{extendedStats?.totalProjectComponents || 0}</p>
                <p className="text-xs text-gray-500">Parts</p>
              </div>
              <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded">
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{extendedStats?.avgComponentsPerProject || 0}</p>
                <p className="text-xs text-gray-500">Avg/Proj</p>
              </div>
            </div>
          </div>

          {/* Top Locations */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg border border-gray-200 dark:border-[#3a3a3a] p-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Top Locations</h2>
            <div className="space-y-1">
              {extendedStats?.topLocations?.slice(0, 4).map((loc, i) => (
                <ListItem key={i} icon={MapPin} primary={loc.location || 'Unknown'} trailing={`${loc.count}`} />
              )) || <p className="text-xs text-gray-500">No locations</p>}
            </div>
          </div>

          {/* Recent Users */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg border border-gray-200 dark:border-[#3a3a3a] p-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Recent Users</h2>
            <div className="space-y-1">
              {extendedStats?.recentLogins?.slice(0, 4).map((user, i) => (
                <ListItem 
                  key={i} 
                  icon={Users} 
                  primary={user.username} 
                  secondary={user.role}
                  trailing={user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'} 
                />
              )) || <p className="text-xs text-gray-500">No users</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
