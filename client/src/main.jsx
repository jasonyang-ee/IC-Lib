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
  // Check if there's a base tag in the HTML
  const baseTag = document.querySelector('base');
  if (baseTag && baseTag.getAttribute('href')) {
    return baseTag.getAttribute('href');
  }
  
  // Auto-detect from pathname (for directory-style deployments)
  // If the app is deployed to example.com/iclib/, pathname will be /iclib/
  const pathname = window.location.pathname;
  
  // Common base paths to check (customize as needed)
  const commonBases = ['/iclib', '/ic-lib', '/components'];
  
  for (const base of commonBases) {
    if (pathname.startsWith(base + '/') || pathname === base) {
      return base;
    }
  }
  
  // Default to root for subdomain-style deployments
  return '/';
};

const basename = getBasename();

// Log the detected basename for debugging (can be removed in production)
if (basename !== '/') {
  console.log('Detected basename:', basename);
}

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
