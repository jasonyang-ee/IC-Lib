import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { Settings, AlertTriangle } from 'lucide-react';

// Compact stat card component without icon
const StatCard = ({ title, value, small = false }) => {
  return (
    <div className={`bg-white dark:bg-[#2a2a2a] rounded-lg border border-gray-200 dark:border-[#3a3a3a] ${small ? 'p-3' : 'p-4'}`}>
      <div className="flex flex-col">
        <p className={`${small ? 'text-xs' : 'text-sm'} font-medium text-gray-500 dark:text-gray-400 truncate`}>{title}</p>
        <p className={`${small ? 'text-xl' : 'text-2xl'} font-bold text-gray-900 dark:text-gray-100 mt-1`}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
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

  const { data: extendedStats } = useQuery({
    queryKey: ['extendedStats'],
    queryFn: async () => (await api.getExtendedDashboardStats()).data,
    retry: false,
  });

  const isDatabaseNotInitialized = 
    statsError?.response?.status === 500 || 
    categoryError?.response?.status === 500;

  // Calculate library quality percentage
  const totalComponents = stats?.totalComponents || 0;
  const totalMissing = (stats?.missingFootprints || 0) + 
                      (stats?.missingSchematic || 0) + 
                      (stats?.missing3DModel || 0) + 
                      (stats?.missingPspice || 0);
  const qualityPercentage = totalComponents > 0 
    ? (100 - ((totalMissing / (totalComponents * 4)) * 100)).toFixed(1)
    : 0;

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
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column - Library Status, Approval Status, Category Distribution */}
        <div className="lg:col-span-2 space-y-4">
          {/* Library Status Section */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg border border-gray-200 dark:border-[#3a3a3a] p-5">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
              Library Status
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <StatCard title="Components" value={stats?.totalComponents || 0} />
              <StatCard title="Categories" value={stats?.totalCategories || 0} />
              <StatCard title="Manufacturers" value={extendedStats?.totalManufacturers || 0} />
              <StatCard title="Projects" value={extendedStats?.totalProjects || 0} />
              <StatCard title="Distributors" value={extendedStats?.totalDistributors || 0} />
            </div>
          </div>

          {/* Approval Status - Prominent Section */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg border border-gray-200 dark:border-[#3a3a3a] p-5">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
              Component Approval Status
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border-2 border-gray-200 dark:border-gray-700 text-center">
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stats?.approvalStatus?.new || 0}</p>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-1">New</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border-2 border-yellow-300 dark:border-yellow-700 text-center">
                <p className="text-3xl font-bold text-yellow-700 dark:text-yellow-400">{stats?.approvalStatus?.pending_review || 0}</p>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-1">Pending</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border-2 border-green-300 dark:border-green-700 text-center">
                <p className="text-3xl font-bold text-green-700 dark:text-green-400">{stats?.approvalStatus?.approved || 0}</p>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-1">Approved</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border-2 border-purple-300 dark:border-purple-700 text-center">
                <p className="text-3xl font-bold text-purple-700 dark:text-purple-400">{stats?.approvalStatus?.experimental || 0}</p>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-1">Experimental</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border-2 border-red-300 dark:border-red-700 text-center">
                <p className="text-3xl font-bold text-red-700 dark:text-red-400">{stats?.approvalStatus?.archived || 0}</p>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mt-1">Archived</p>
              </div>
            </div>
          </div>

          {/* Category Distribution */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg border border-gray-200 dark:border-[#3a3a3a] p-5">
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-4">
              Category Distribution
            </h2>
            <div className="space-y-2.5">
              {categoryBreakdown?.slice(0, 12).map((cat, i) => (
                <CategoryBar key={i} name={cat.category} count={cat.count} total={stats?.totalComponents || 1} />
              ))}
            </div>
          </div>
        </div>

        {/* Right Side Column - Stock Status and Library Quality */}
        <div className="space-y-4">
          {/* Stock Status Section */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg border border-gray-200 dark:border-[#3a3a3a] p-5">
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-4">
              Stock Status
            </h2>
            <div className="space-y-3">
              <StatCard small title="Low Stock" value={stats?.lowStockAlerts || 0} />
              <StatCard small title="Total Qty" value={stats?.totalInventoryQuantity || 0} />
              <StatCard small title="Inventory" value={stats?.totalInventoryItems || 0} />
            </div>
          </div>

          {/* Library Quality Section */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg border border-gray-200 dark:border-[#3a3a3a] p-5">
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-4">
              Library Quality
            </h2>
            
            {/* Quality Percentage Display */}
            <div className="mb-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Completion Rate</span>
                <span className="text-2xl font-bold text-green-700 dark:text-green-400">{qualityPercentage}%</span>
              </div>
              <div className="mt-2 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full transition-all" 
                  style={{ width: `${qualityPercentage}%` }} 
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {totalMissing.toLocaleString()} of {(totalComponents * 4).toLocaleString()} items have associated CAD files
              </p>
            </div>

            <div className="space-y-3">
              <StatCard small title="Missing Footprints" value={stats?.missingFootprints || 0} />
              <StatCard small title="Missing Schematic" value={stats?.missingSchematic || 0} />
              <StatCard small title="Missing 3D Model" value={stats?.missing3DModel || 0} />
              <StatCard small title="Missing Pspice" value={stats?.missingPspice || 0} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
