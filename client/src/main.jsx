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
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </NotificationProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
