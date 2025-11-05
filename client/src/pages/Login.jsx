import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, AlertCircle, Loader2 } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Please enter both username and password');
      return;
    }

    setLoading(true);

    try {
      const result = await login(username, password);
      
      if (result.success) {
        // Redirect to the page they tried to visit, or dashboard
        const from = location.state?.from?.pathname || '/';
        navigate(from, { replace: true });
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#1f1f1f] px-4">
      <div className="max-w-md w-full space-y-8">
        {/* Logo and Title */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <img 
              src="/logo_bg.png" 
              alt="IC Lib Logo" 
              className="w-20 h-20 rounded-lg"
            />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            IC-Lib
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Component Library Management System
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white dark:bg-[#2a2a2a] rounded-lg shadow-md p-8 border border-gray-200 dark:border-[#3a3a3a]">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label 
                htmlFor="username" 
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                autoComplete="username"
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 disabled:opacity-50"
                placeholder="Enter your username"
              />
            </div>

            <div>
              <label 
                htmlFor="password" 
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="current-password"
                className="w-full px-3 py-2 border border-gray-300 dark:border-[#444444] rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-[#2a2a2a] dark:text-gray-100 disabled:opacity-50"
                placeholder="Enter your password"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Sign In
                </>
              )}
            </button>
          </form>
        </div>

        {/* Default credentials note (for development) */}
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-500">
            Default credentials: <strong>admin</strong> / <strong>admin123</strong>
            <br />
            <span className="text-red-600 dark:text-red-400">
              (Change password immediately after first login)
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
