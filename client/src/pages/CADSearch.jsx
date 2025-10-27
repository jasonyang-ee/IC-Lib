import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../utils/api';
import { useNotification } from '../contexts/NotificationContext';
import { Search, Download, LogIn, CheckCircle, XCircle, Folder, ExternalLink } from 'lucide-react';

const CADSearch = () => {
  const { showSuccess, showError, showInfo } = useNotification();
  const [partNumber, setPartNumber] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [authStatus, setAuthStatus] = useState(() => {
    // Load auth status from localStorage
    const saved = localStorage.getItem('samacsysAuth');
    return saved ? JSON.parse(saved) : { authenticated: false, loading: true };
  });
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [searchHistory, setSearchHistory] = useState([]);

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
    loadSearchHistory();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await api.checkSamacSysAuth();
      const newAuthStatus = { ...response.data, loading: false };
      setAuthStatus(newAuthStatus);
      // Persist to localStorage
      localStorage.setItem('samacsysAuth', JSON.stringify(newAuthStatus));
    } catch (error) {
      console.error('Error checking auth:', error);
      const newAuthStatus = { authenticated: false, loading: false };
      setAuthStatus(newAuthStatus);
      localStorage.setItem('samacsysAuth', JSON.stringify(newAuthStatus));
    }
  };

  const loadSearchHistory = () => {
    const history = JSON.parse(localStorage.getItem('cadSearchHistory') || '[]');
    setSearchHistory(history.slice(0, 10)); // Keep last 10
  };

  const addToHistory = (partNumber, mfg) => {
    const newEntry = {
      partNumber,
      manufacturer: mfg,
      timestamp: new Date().toISOString()
    };
    const history = [newEntry, ...searchHistory.filter(h => 
      h.partNumber !== partNumber || h.manufacturer !== mfg
    )].slice(0, 10);
    setSearchHistory(history);
    localStorage.setItem('cadSearchHistory', JSON.stringify(history));
  };

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: (credentials) => api.loginSamacSys(credentials),
    onSuccess: (response) => {
      if (response.data.success) {
        showSuccess('Successfully logged in to SamacSys!');
        const newAuthStatus = { authenticated: true, message: 'Logged in' };
        setAuthStatus(newAuthStatus);
        // Persist to localStorage
        localStorage.setItem('samacsysAuth', JSON.stringify(newAuthStatus));
        setShowLoginModal(false);
        setPassword('');
      } else {
        showError(response.data.message || 'Login failed');
      }
    },
    onError: (error) => {
      const errorMsg = error.response?.data?.message || error.message || 'Login failed';
      showError(errorMsg);
    }
  });

  // Download mutation
  const downloadMutation = useMutation({
    mutationFn: ({ partNumber, manufacturer }) => 
      api.downloadSamacSysLibrary({ partNumber, manufacturer }),
    onSuccess: (data) => {
      if (data.data?.success) {
        const msg = data.data.extractedFiles 
          ? `Library downloaded and extracted! Files placed in organized folders.`
          : `Library downloaded to ${data.data.filename}`;
        showSuccess(msg);
        if (data.data.extractedFiles) {
          showInfo(`Extracted ${data.data.extractedFiles.length} files`);
        }
        addToHistory(partNumber, manufacturer);
      } else if (data.data?.requiresLogin) {
        showError('Please login to SamacSys first');
        setShowLoginModal(true);
      }
    },
    onError: (error) => {
      if (error.response?.status === 401 || error.response?.data?.requiresLogin) {
        showError('Please login to SamacSys to download library files');
        setShowLoginModal(true);
      } else {
        const errorMsg = error.response?.data?.message || error.message || 'Failed to download library files';
        showError(errorMsg);
      }
    }
  });

  const handleLogin = (e) => {
    e.preventDefault();
    loginMutation.mutate({ email, password });
  };

  const handleDownload = (e) => {
    e.preventDefault();
    if (!partNumber.trim()) {
      showError('Please enter a part number');
      return;
    }
    if (!manufacturer.trim()) {
      showError('Please enter a manufacturer name');
      return;
    }
    
    if (!authStatus.authenticated) {
      showError('Please login to download libraries');
      setShowLoginModal(true);
      return;
    }
    
    downloadMutation.mutate({
      partNumber: partNumber.trim(),
      manufacturer: manufacturer.trim()
    });
  };

  const handleHistoryClick = (item) => {
    setPartNumber(item.partNumber);
    setManufacturer(item.manufacturer);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          CAD Library Search
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Download PCB footprints, schematic symbols, and 3D models from SamacSys
        </p>
      </div>

      {/* Authentication Status Card */}
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a] mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {authStatus.loading ? (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
            ) : authStatus.authenticated ? (
              <CheckCircle className="w-6 h-6 text-green-600" />
            ) : (
              <XCircle className="w-6 h-6 text-yellow-600" />
            )}
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                SamacSys Connection
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {authStatus.loading ? 'Checking...' : authStatus.authenticated ? 'Connected and ready' : 'Not connected'}
              </p>
            </div>
          </div>
          {!authStatus.loading && (
            <button
              onClick={() => authStatus.authenticated ? null : setShowLoginModal(true)}
              className={`btn-${authStatus.authenticated ? 'secondary' : 'primary'} flex items-center gap-2`}
            >
              {authStatus.authenticated ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Connected
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Login
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Search Form */}
      <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a] mb-6">
        <form onSubmit={handleDownload} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Part Number
            </label>
            <input
              type="text"
              value={partNumber}
              onChange={(e) => setPartNumber(e.target.value)}
              placeholder="e.g., STM32F407VGT6 or CAP1126-1-AP-TR"
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Manufacturer
            </label>
            <input
              type="text"
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
              placeholder="e.g., STMicroelectronics or Microchip"
              className="input-field"
              required
            />
          </div>

          <button
            type="submit"
            disabled={downloadMutation.isPending || !authStatus.authenticated}
            className="w-full btn-primary flex items-center justify-center gap-2"
          >
            {downloadMutation.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Downloading...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download CAD Library
              </>
            )}
          </button>

          {!authStatus.authenticated && (
            <p className="text-sm text-yellow-600 dark:text-yellow-400 text-center">
              Please login to SamacSys to download libraries
            </p>
          )}

          <div className="text-xs text-gray-500 dark:text-gray-400 mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="font-semibold mb-1">💡 Tip:</p>
            <p>Enter the exact manufacturer part number and manufacturer name from your component datasheet or distributor website (like Digikey or Mouser).</p>
          </div>
        </form>
      </div>

      {/* Search History */}
      {searchHistory.length > 0 && (
        <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-6 border border-gray-200 dark:border-[#3a3a3a]">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Folder className="w-5 h-5" />
            Recent Searches
          </h3>
          <div className="space-y-2">
            {searchHistory.map((item, index) => (
              <button
                key={index}
                onClick={() => handleHistoryClick(item)}
                className="w-full text-left px-4 py-3 rounded-lg bg-gray-50 dark:bg-[#1a1a1a] hover:bg-gray-100 dark:hover:bg-[#333333] transition-colors border border-gray-200 dark:border-[#3a3a3a]"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {item.partNumber}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {item.manufacturer}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    {new Date(item.timestamp).toLocaleDateString()}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-xl max-w-md w-full border border-gray-200 dark:border-[#3a3a3a]">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-[#3a3a3a]">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Login to SamacSys
              </h3>
              <button
                onClick={() => {
                  setShowLoginModal(false);
                  setPassword('');
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleLogin} className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Please login to your SamacSys Component Search Engine account.
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mb-4">
                  Don't have an account? <a 
                    href="https://componentsearchengine.com/signup" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Sign up here
                  </a>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  required
                  autoFocus
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                  required
                  placeholder="••••••••"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowLoginModal(false);
                    setPassword('');
                  }}
                  className="btn-secondary flex-1"
                  disabled={loginMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? 'Logging in...' : 'Login'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
          What will be downloaded?
        </h4>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
          <li>PCB Footprints for OrCAD Allegro (automatically extracted)</li>
          <li>Schematic Symbols (automatically extracted)</li>
          <li>Pad stacks and configurations</li>
          <li>3D models (STEP files)</li>
          <li>Multiple CAD format support (KiCad, Altium, Eagle, etc.)</li>
        </ul>
        <p className="text-xs text-blue-700 dark:text-blue-300 mt-3">
          Files are automatically organized into: <code className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded">download/footprint/</code>, 
          <code className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded ml-1">download/symbol/</code>, and 
          <code className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded ml-1">download/pad/</code>
        </p>
      </div>
    </div>
  );
};

export default CADSearch;
