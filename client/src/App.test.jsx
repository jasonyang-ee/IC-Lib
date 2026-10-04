import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

// Login checks SSO availability on mount; keep smoke tests off the real API.
vi.mock('./utils/api', () => ({
  api: { getOidcStatus: vi.fn().mockResolvedValue({ data: { enabled: false } }) },
}));

// Mock the contexts
vi.mock('./contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('./contexts/NotificationContext', () => ({
  NotificationProvider: ({ children }) => children,
  useNotification: () => ({
    notifications: [],
    addNotification: vi.fn(),
    removeNotification: vi.fn(),
  }),
}));

describe('App', () => {
  it('renders without crashing', async () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    expect(await screen.findByRole('heading', { name: 'IC-Lib' })).toBeInTheDocument();
  });

  it('shows login page when not authenticated', async () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    expect(await screen.findByLabelText('Username')).toBeInTheDocument();
  });
});
