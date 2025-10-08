import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3500/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// API methods
export const api = {
  // Dashboard
  getDashboardStats: () => apiClient.get('/dashboard/stats'),
  getRecentActivities: () => apiClient.get('/dashboard/recent-activities'),
  getCategoryBreakdown: () => apiClient.get('/dashboard/category-breakdown'),

  // Components
  getComponents: (params) => apiClient.get('/components', { params }),
  getComponentById: (id) => apiClient.get(`/components/${id}`),
  createComponent: (data) => apiClient.post('/components', data),
  updateComponent: (id, data) => apiClient.put(`/components/${id}`, data),
  deleteComponent: (id) => apiClient.delete(`/components/${id}`),
  getComponentSpecifications: (id) => apiClient.get(`/components/${id}/specifications`),
  updateComponentSpecifications: (id, data) => apiClient.put(`/components/${id}/specifications`, data),
  getComponentDistributors: (id) => apiClient.get(`/components/${id}/distributors`),

  // Categories
  getCategories: () => apiClient.get('/categories'),
  getCategoryById: (id) => apiClient.get(`/categories/${id}`),
  createCategory: (data) => apiClient.post('/categories', data),
  updateCategory: (id, data) => apiClient.put(`/categories/${id}`, data),
  deleteCategory: (id) => apiClient.delete(`/categories/${id}`),
  getComponentsByCategory: (id, params) => apiClient.get(`/categories/${id}/components`, { params }),

  // Inventory
  getInventory: () => apiClient.get('/inventory'),
  getInventoryById: (id) => apiClient.get(`/inventory/${id}`),
  getInventoryByComponent: (componentId) => apiClient.get(`/inventory/component/${componentId}`),
  createInventory: (data) => apiClient.post('/inventory', data),
  updateInventory: (id, data) => apiClient.put(`/inventory/${id}`, data),
  deleteInventory: (id) => apiClient.delete(`/inventory/${id}`),
  getLowStockItems: () => apiClient.get('/inventory/alerts/low-stock'),

  // Search
  searchDigikey: (partNumber) => apiClient.post('/search/digikey', { partNumber }),
  searchMouser: (partNumber) => apiClient.post('/search/mouser', { partNumber }),
  searchAllVendors: (partNumber) => apiClient.post('/search/all', { partNumber }),
  downloadUltraLibrarianFootprint: (data) => apiClient.post('/search/footprint/ultra-librarian', data),
  downloadSnapEDAFootprint: (data) => apiClient.post('/search/footprint/snapeda', data),

  // Reports
  getComponentSummary: () => apiClient.get('/reports/component-summary'),
  getCategoryDistribution: () => apiClient.get('/reports/category-distribution'),
  getInventoryValue: () => apiClient.get('/reports/inventory-value'),
  getMissingFootprints: () => apiClient.get('/reports/missing-footprints'),
  getManufacturerReport: () => apiClient.get('/reports/manufacturers'),
  getLowStockReport: () => apiClient.get('/reports/low-stock'),
  customReport: (data) => apiClient.post('/reports/custom', data),

  // Distributors
  getDistributors: () => apiClient.get('/distributors'),
};

export default apiClient;
