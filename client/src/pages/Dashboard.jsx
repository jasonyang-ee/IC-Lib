import { buildCadHealthRows } from '../utils/cadHealth';
import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';
import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

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
  const { user } = useAuth();
  const { data: stats, isLoading, error: statsError, refetch: refetchStats } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: async () => (await api.getDashboardStats()).data,
    retry: false,
  });

  const { data: categoryBreakdown, error: categoryError, refetch: refetchCategories } = useQuery({
    queryKey: ['categoryBreakdown'],
    queryFn: async () => (await api.getCategoryBreakdown()).data,
    retry: false,
  });

  const { data: extendedStats, isLoading: extendedLoading, error: extendedError, refetch: refetchExtended } = useQuery({
    queryKey: ['extendedStats'],
    queryFn: async () => (await api.getExtendedDashboardStats()).data,
    retry: false,
  });

  const { data: dbInfo, error: databaseError, refetch: refetchDatabase } = useQuery({
    queryKey: ['databaseInfo'],
    queryFn: async () => (await api.getDatabaseInfo()).data,
    retry: false,
  });

  if (isLoading || extendedLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (statsError || categoryError || extendedError || databaseError) {
    const incompleteSchema = statsError?.response?.data?.code === 'DATABASE_SCHEMA_INCOMPLETE';
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-yellow-500 shrink-0" />
            <div>
              <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">{incompleteSchema ? 'Database setup required' : 'Unable to load dashboard'}</h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                {incompleteSchema ? 'The database schema is incomplete. An administrator can verify and initialize it in Settings.' : 'The request failed. Retry to load the current library data.'}
              </p>
              {incompleteSchema && user?.role === 'admin' && <Link to="/admin-settings" className="mt-3 mr-4 inline-block underline">Open Settings</Link>}
              <button
                onClick={() => { void refetchStats(); void refetchCategories(); void refetchExtended(); void refetchDatabase(); }}
                className="mt-3 inline-flex items-center px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium rounded transition-colors"
              >
                Retry
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
        {/* Row 1: Library Status + Database Info */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg border border-gray-200 dark:border-[#3a3a3a] p-5">
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-4">
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
        </div>
        <div>
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg border border-gray-200 dark:border-[#3a3a3a] p-5 h-full">
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-4">
              Database Info
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-400">Database Name</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{dbInfo?.databaseName || '-'}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-400">Host</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{dbInfo?.host || '-'}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Database Size</span>
                <span className="text-sm font-semibold text-primary-600 dark:text-primary-400">{dbInfo?.size || '-'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2-3: Approval Status + Stock Status (left) | Category Distribution (right, row-span-2) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Approval Status */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg border border-gray-200 dark:border-[#3a3a3a] p-5">
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-4">
              Component Approval Status
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-white dark:bg-[#2a2a2a] rounded-lg p-4 border border-gray-200 dark:border-[#3a3a3a]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-400"></span>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">New</p>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats?.approvalStatus?.new || 0}</p>
              </div>
              <div className="bg-white dark:bg-[#2a2a2a] rounded-lg p-4 border border-gray-200 dark:border-[#3a3a3a]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Reviewing</p>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats?.approvalStatus?.reviewing || 0}</p>
              </div>
              <div className="bg-white dark:bg-[#2a2a2a] rounded-lg p-4 border border-gray-200 dark:border-[#3a3a3a]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Production</p>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats?.approvalStatus?.production || 0}</p>
              </div>
              <div className="bg-white dark:bg-[#2a2a2a] rounded-lg p-4 border border-gray-200 dark:border-[#3a3a3a]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Prototype</p>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats?.approvalStatus?.prototype || 0}</p>
              </div>
              <div className="bg-white dark:bg-[#2a2a2a] rounded-lg p-4 border border-gray-200 dark:border-[#3a3a3a]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Archived</p>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats?.approvalStatus?.archived || 0}</p>
              </div>
            </div>
          </div>

          {/* Stock Status */}
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg border border-gray-200 dark:border-[#3a3a3a] p-5">
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-4">
              Stock Status
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <StatCard small title="Low Stock" value={stats?.lowStockAlerts || 0} />
              <StatCard small title="Total Qty" value={stats?.totalInventoryQuantity || 0} />
              <StatCard small title="Inventory" value={stats?.totalInventoryItems || 0} />
            </div>
          </div>
        </div>

        {/* Category Distribution - spans 2 rows on right */}
        <div className="lg:row-span-2">
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg border border-gray-200 dark:border-[#3a3a3a] p-5 h-full">
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

        {/* Row 4: Library Quality - full width */}
        <div className="lg:col-span-3">
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg border border-gray-200 dark:border-[#3a3a3a] p-5">
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-4">
              Library Quality
            </h2>
            <div className="space-y-3">
              <div className="grid grid-cols-[5rem_1fr_1fr_5.5rem] items-center gap-2 pb-1 border-b border-gray-200 dark:border-gray-600">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Type</span>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Undefined</span>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Missing</span>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 text-right">Health</span>
              </div>
              {buildCadHealthRows(stats).map(item => {
                const rate = item.health;
                const colorClass = rate < 50
                  ? 'text-red-600 dark:text-red-400'
                  : rate < 80
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-green-600 dark:text-green-400';
                return (
                  <div key={item.type} className="grid grid-cols-[5rem_1fr_1fr_5.5rem] items-center gap-2 py-2 border-b border-gray-100 dark:border-[#3a3a3a] last:border-0">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{item.type}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Undefined: {item.undefined_count}</span>
                    <span className={`text-sm ${item.missing_count > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'}`}>Missing: {item.missing_count}</span>
                    <span className={`text-sm font-semibold text-right ${colorClass}`} title="Health Ratio">{rate.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
