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
  // 1. Check environment variable (if set during build)
  // Note: Vite's BASE_URL might be './' for relative paths, which is invalid for React Router
  const envBase = import.meta.env.BASE_URL;
  if (envBase && envBase !== '/' && envBase.startsWith('/') && !envBase.startsWith('./')) {
    console.log('Using BASE_URL from environment:', envBase);
    return envBase;
  }
  
  // 2. Check if there's a base tag in the HTML
  const baseTag = document.querySelector('base');
  if (baseTag && baseTag.getAttribute('href')) {
    const href = baseTag.getAttribute('href');
    // Only use if it's an absolute path (not relative like './')
    if (href.startsWith('/') && !href.startsWith('./')) {
      console.log('Using base tag:', href);
      return href;
    }
  }
  
  // 3. Auto-detect from pathname (for directory-style deployments)
  // If the app is deployed to example.com/iclib/, pathname will be /iclib/
  const pathname = window.location.pathname;
  
  // Common base paths to check (customize as needed)
  const commonBases = ['/test', '/iclib', '/ic-lib', '/components'];
  
  for (const base of commonBases) {
    if (pathname.startsWith(base + '/') || pathname === base) {
      console.log('Auto-detected basename from pathname:', base);
      return base;
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
