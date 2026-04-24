import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, AlertTriangle, CheckCircle, Database, Loader2, Package, RefreshCw } from 'lucide-react';
import { ConfirmationModal } from '../../common';
import { api } from '../../../utils/api';

const UPDATE_CONFIRMATIONS = {
  stock: {
    title: 'Update Stock Info',
    message: 'This updates stock quantities, pricing, and availability from distributor APIs for all parts with SKUs. This may take several minutes depending on part count.',
  },
  specs: {
    title: 'Update Parts Specifications',
    message: 'This auto-fills mapped specifications from distributor data for all parts with SKUs. Existing values stay when vendor data is missing. This may take several minutes.',
  },
  distributors: {
    title: 'Update Distributors',
    message: 'This searches and updates distributor SKUs and URLs by matching manufacturer part numbers. Lowest MOQ match wins when multiple results exist. This may take several minutes.',
  },
};

const DEFAULT_TOAST = {
  show: false,
  message: '',
  type: 'success',
};

const UpdateStatusToast = ({ toast }) => {
  if (!toast.show) {
    return null;
  }

  const containerStyles = {
    success: 'bg-green-100 dark:bg-green-800 border-green-400 dark:border-green-600',
    error: 'bg-red-100 dark:bg-red-800 border-red-400 dark:border-red-600',
    warning: 'bg-yellow-100 dark:bg-yellow-800 border-yellow-400 dark:border-yellow-600',
    info: 'bg-blue-100 dark:bg-blue-800 border-blue-400 dark:border-blue-600',
  };

  const textStyles = {
    success: 'text-green-900 dark:text-green-100',
    error: 'text-red-900 dark:text-red-100',
    warning: 'text-yellow-900 dark:text-yellow-100',
    info: 'text-blue-900 dark:text-blue-100',
  };

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-slide-down px-4">
      <div className={`rounded-lg shadow-2xl p-5 max-w-lg border-2 ${containerStyles[toast.type]}`}>
        <div className="flex items-center gap-3">
          {toast.type === 'success' && <CheckCircle className="w-6 h-6 text-green-700 dark:text-green-300" />}
          {toast.type === 'error' && <AlertCircle className="w-6 h-6 text-red-700 dark:text-red-300" />}
          {toast.type === 'warning' && <AlertTriangle className="w-6 h-6 text-yellow-700 dark:text-yellow-300" />}
          {toast.type === 'info' && <Loader2 className="w-6 h-6 text-blue-700 dark:text-blue-300 animate-spin" />}
          <p className={`text-base font-semibold ${textStyles[toast.type]}`}>{toast.message}</p>
        </div>
      </div>
    </div>
  );
};

const UpdateTab = () => {
  const queryClient = useQueryClient();
  const stockProgressIntervalRef = useRef(null);
  const [isUpdatingStock, setIsUpdatingStock] = useState(false);
  const [isUpdatingSpecs, setIsUpdatingSpecs] = useState(false);
  const [isUpdatingDistributors, setIsUpdatingDistributors] = useState(false);
  const [isScanningLibrary, setIsScanningLibrary] = useState(false);
  const [stockProgress, setStockProgress] = useState(0);
  const [scanResult, setScanResult] = useState('');
  const [pendingAction, setPendingAction] = useState(null);
  const [toast, setToast] = useState(DEFAULT_TOAST);

  useEffect(() => () => {
    if (stockProgressIntervalRef.current) {
      window.clearInterval(stockProgressIntervalRef.current);
    }
  }, []);

  useEffect(() => {
    if (!toast.show || toast.type === 'info') {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setToast(DEFAULT_TOAST);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const invalidateUpdatedData = () => {
    queryClient.invalidateQueries({ queryKey: ['components'] });
    queryClient.invalidateQueries({ queryKey: ['componentDetails'] });
  };

  const showToast = (message, type) => {
    setToast({ show: true, message, type });
  };

  const handleBulkUpdateStock = async () => {
    setPendingAction(null);
    setIsUpdatingStock(true);
    setStockProgress(0);
    showToast('Starting bulk stock update...', 'info');

    stockProgressIntervalRef.current = window.setInterval(() => {
      setStockProgress((previous) => (previous >= 90 ? 90 : previous + Math.random() * 3));
    }, 2000);

    try {
      const result = await api.bulkUpdateStock();
      if (stockProgressIntervalRef.current) {
        window.clearInterval(stockProgressIntervalRef.current);
        stockProgressIntervalRef.current = null;
      }
      setStockProgress(100);
      showToast(
        `Stock update complete: ${result.data.updatedCount} updated, ${result.data.skippedCount} skipped, ${result.data.errors?.length || 0} errors`,
        'success',
      );
      invalidateUpdatedData();
      window.setTimeout(() => setStockProgress(0), 5000);
    } catch (error) {
      if (stockProgressIntervalRef.current) {
        window.clearInterval(stockProgressIntervalRef.current);
        stockProgressIntervalRef.current = null;
      }
      setStockProgress(0);
      if (error.response?.status === 429 || error.response?.data?.error === 'RATE_LIMIT_EXCEEDED') {
        showToast(error.response?.data?.message || 'API rate limit exceeded. Try again later.', 'warning');
      } else {
        showToast('Error updating stock. Please try again.', 'error');
      }
    } finally {
      setIsUpdatingStock(false);
    }
  };

  const handleBulkUpdateSpecifications = async () => {
    setPendingAction(null);
    setIsUpdatingSpecs(true);
    showToast('Starting bulk specification update... (only parts without specs)', 'info');

    try {
      const result = await api.bulkUpdateSpecifications();
      showToast(
        `Specification update complete: ${result.data.updatedCount} parts updated, ${result.data.skippedCount} skipped, ${result.data.errors?.length || 0} errors`,
        'success',
      );
      invalidateUpdatedData();
    } catch (error) {
      if (error.response?.status === 429 || error.response?.data?.error === 'RATE_LIMIT_EXCEEDED') {
        showToast(error.response?.data?.message || 'API rate limit exceeded. Try again later.', 'warning');
      } else {
        showToast('Error updating specifications. Please try again.', 'error');
      }
    } finally {
      setIsUpdatingSpecs(false);
    }
  };

  const handleBulkUpdateDistributors = async () => {
    setPendingAction(null);
    setIsUpdatingDistributors(true);
    showToast('Starting bulk distributor update... (only parts without distributors)', 'info');

    try {
      const result = await api.bulkUpdateDistributors();
      showToast(
        `Distributor update complete: ${result.data.updatedCount} distributors updated, ${result.data.skippedCount} skipped, ${result.data.errors?.length || 0} errors`,
        'success',
      );
      invalidateUpdatedData();
    } catch (error) {
      if (error.response?.status === 429 || error.response?.data?.error === 'RATE_LIMIT_EXCEEDED') {
        showToast(error.response?.data?.message || 'API rate limit exceeded. Try again later.', 'warning');
      } else {
        showToast('Error updating distributors. Please try again.', 'error');
      }
    } finally {
      setIsUpdatingDistributors(false);
    }
  };

  const handleScanLibrary = async () => {
    setIsScanningLibrary(true);

    try {
      const response = await api.scanLibraryFiles();
      setScanResult(response.data.message);
      showToast(response.data.message, 'success');
    } catch (error) {
      showToast(`Scan failed: ${error.response?.data?.error || error.message}`, 'error');
    } finally {
      setIsScanningLibrary(false);
    }
  };

  const handleConfirmAction = () => {
    if (pendingAction === 'stock') {
      void handleBulkUpdateStock();
      return;
    }

    if (pendingAction === 'specs') {
      void handleBulkUpdateSpecifications();
      return;
    }

    if (pendingAction === 'distributors') {
      void handleBulkUpdateDistributors();
    }
  };

  const confirmation = pendingAction ? UPDATE_CONFIRMATIONS[pendingAction] : null;
  const updatesAreRunning = isUpdatingStock || isUpdatingSpecs || isUpdatingDistributors;

  return (
    <>
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a]">
        <div className="flex items-center gap-2 mb-4">
          <RefreshCw className="w-6 h-6 text-gray-700 dark:text-gray-300" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Auto Data Update</h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Update component data from distributor APIs. Only parts with valid distributor SKUs are eligible.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="border border-gray-200 dark:border-[#3a3a3a] rounded-lg p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-5 h-5 text-green-600 dark:text-green-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Update Stock Info</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 grow">
              Update stock quantities, pricing, and availability from distributor APIs for all parts with SKUs.
            </p>
            <button
              onClick={() => setPendingAction('stock')}
              disabled={updatesAreRunning}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isUpdatingStock ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating... {Math.round(stockProgress)}%
                </>
              ) : (
                <>
                  <Package className="w-4 h-4" />
                  Update Stock Info
                </>
              )}
            </button>
          </div>

          <div className="border border-gray-200 dark:border-[#3a3a3a] rounded-lg p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Update Specifications</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 grow">
              Auto-fill component specifications using mapped distributor field names. Only parts without any specifications are updated.
            </p>
            <button
              onClick={() => setPendingAction('specs')}
              disabled={updatesAreRunning}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isUpdatingSpecs ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating... check server logs
                </>
              ) : (
                <>
                  <Database className="w-4 h-4" />
                  Update Specifications
                </>
              )}
            </button>
          </div>

          <div className="border border-gray-200 dark:border-[#3a3a3a] rounded-lg p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Update Distributors</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 grow">
              Search and update distributor SKUs and URLs by matching manufacturer part numbers. Lowest MOQ match wins. Only parts without distributor info are updated.
            </p>
            <button
              onClick={() => setPendingAction('distributors')}
              disabled={updatesAreRunning}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isUpdatingDistributors ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating... check server logs
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Update Distributors
                </>
              )}
            </button>
          </div>

          <div className="border border-gray-200 dark:border-[#3a3a3a] rounded-lg p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Scan Library Files</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 grow">
              Scan library folder for untracked CAD files and register them in database so they appear in File Library.
            </p>
            <button
              onClick={() => void handleScanLibrary()}
              disabled={isScanningLibrary}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isScanningLibrary ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Scan Library
                </>
              )}
            </button>
            {scanResult && <p className="text-sm text-green-600 dark:text-green-400 mt-2">{scanResult}</p>}
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={Boolean(confirmation)}
        onClose={() => setPendingAction(null)}
        onConfirm={handleConfirmAction}
        title={confirmation?.title || 'Confirm update'}
        message={confirmation?.message || ''}
        confirmText="Start Update"
        confirmStyle="primary"
        isLoading={updatesAreRunning}
      />

      <UpdateStatusToast toast={toast} />
    </>
  );
};

export default UpdateTab;