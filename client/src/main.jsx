import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NotificationProvider } from './contexts/NotificationContext'
import App from './App.jsx'
import './index.css'

// Initialize dark mode from localStorage before render
const initializeDarkMode = () => {
  const savedMode = localStorage.getItem('darkMode');
  
  // If user has explicitly set a preference, use it
  if (savedMode !== null) {
    const shouldBeDark = savedMode === 'true';
    if (shouldBeDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } else {
    // No saved preference - default to light mode
    document.documentElement.classList.remove('dark');
  }
};

initializeDarkMode();

// Detect base path for React Router
// This allows the app to work with both subdomain and directory-style reverse proxy
const getBasename = () => {
  // 1. Check environment variable BASE_URL (if set during build)
  // Note: Vite's BASE_URL might be './' for relative paths, which is invalid for React Router
  const envBase = import.meta.env.BASE_URL;
  if (envBase && envBase !== '/' && envBase.startsWith('/') && !envBase.startsWith('./')) {
    console.log('Using BASE_URL from environment:', envBase);
    // Remove trailing slash if present (React Router doesn't like trailing slashes)
    return envBase.replace(/\/$/, '');
  }
  
  // 2. Check if there's a base tag in the HTML
  const baseTag = document.querySelector('base');
  if (baseTag && baseTag.getAttribute('href')) {
    const href = baseTag.getAttribute('href');
    // Only use if it's an absolute path (not relative like './')
    if (href.startsWith('/') && !href.startsWith('./')) {
      console.log('Using base tag:', href);
      return href.replace(/\/$/, '');
    }
  }
  
  // 3. Auto-detect from pathname (for directory-style deployments)
  // Extract first path segment (e.g., /test from /test/dashboard)
  const pathname = window.location.pathname;
  const match = pathname.match(/^\/([^\/]+)/);
  
  if (match && match[1] !== '') {
    const segment = match[1];
    // List of known app routes (not base paths)
    const knownRoutes = ['login', 'dashboard', 'library', 'inventory', 'projects', 'eco',
                         'vendor-search', 'reports', 'audit', 'user-settings', 'admin-settings', 'settings'];
    
    // If the segment is not a known route, assume it's a base path
    if (!knownRoutes.includes(segment)) {
      const detectedBase = '/' + segment;
      console.log('Auto-detected basename from pathname:', detectedBase);
      return detectedBase;
    }
  }
  
  // 4. Default to root for subdomain-style deployments
  console.log('Using default basename: /');
  return '/';
};

const basename = getBasename();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <NotificationProvider>
        <BrowserRouter basename={basename}>
          <App />
        </BrowserRouter>
      </NotificationProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
