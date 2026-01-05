import axios from 'axios';

// Detect the base path to properly construct API URLs for reverse proxy deployments
const getBasePath = () => {
  // 1. Check if BASE_URL environment variable is set (highest priority)
  const envBaseUrl = import.meta.env.BASE_URL;
  if (envBaseUrl && envBaseUrl !== '/' && envBaseUrl.startsWith('/') && !envBaseUrl.startsWith('./')) {
    // Remove trailing slash if present
    return envBaseUrl.replace(/\/$/, '');
  }
  
  // 2. Try to detect from current pathname (fallback for runtime detection)
  const pathname = window.location.pathname;
  
  // Extract first path segment (e.g., /test from /test/dashboard)
  const match = pathname.match(/^\/([^/]+)/);
  if (match && match[1] !== '') {
    // Check if it looks like a base path (not a route like 'login', 'dashboard', etc.)
    const segment = match[1];
    const knownRoutes = ['login', 'dashboard', 'library', 'inventory', 'projects', 
                         'vendor-search', 'reports', 'audit', 'user-settings', 'admin-settings', 'settings'];
    
    // If the segment is not a known route, assume it's a base path
    if (!knownRoutes.includes(segment)) {
      return '/' + segment;
    }
  }
  
  // 3. Default to empty string (root deployment)
  return '';
};

// Use relative path for API in production (proxied by nginx)
// In development, use localhost:3500 directly
// For reverse proxy deployments, prepend the base path
const basePath = getBasePath();
const API_BASE_URL = import.meta.env.VITE_API_URL || (basePath + '/api');

console.log('API Base URL:', API_BASE_URL);

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add JWT token to requests
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle auth errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 Unauthorized - token expired or invalid
    if (error.response?.status === 401) {
      // Get the basename from the current path to properly construct login URL
      const pathname = window.location.pathname;
      const isLoginPage = pathname.endsWith('/login');
      
      if (!isLoginPage) {
        localStorage.removeItem('token');
        
        // Use the same base path detection logic
        const basePath = getBasePath();
        
        // Redirect to login with proper base path
        window.location.href = basePath + (basePath === '' ? '' : '/') + 'login';
      }
    }
    
    // Don't log 404 errors for barcode search - it's expected when no match is found
    const isBarcodeSearch = error.config?.url?.includes('/inventory/search/barcode');
    const is404 = error.response?.status === 404;
    
    if (!(isBarcodeSearch && is404)) {
      console.error('API Error:', error.response?.data || error.message);
    }
    
    return Promise.reject(error);
  }
);

// API methods
export const api = {
  // Generic HTTP methods
  get: (url, config) => apiClient.get(url, config),
  post: (url, data, config) => apiClient.post(url, data, config),
  put: (url, data, config) => apiClient.put(url, data, config),
  delete: (url, config) => apiClient.delete(url, config),

  // Authentication
  login: (credentials) => apiClient.post('/auth/login', credentials),
  logout: () => apiClient.post('/auth/logout'),
  verifyAuth: () => apiClient.get('/auth/verify'),
  changePassword: (data) => apiClient.post('/auth/change-password', data),
  
  // User Management (Admin only)
  getAllUsers: () => apiClient.get('/auth/users'),
  createUser: (userData) => apiClient.post('/auth/users', userData),
  updateUser: (id, userData) => apiClient.put(`/auth/users/${id}`, userData),
  deleteUser: (id) => apiClient.delete(`/auth/users/${id}`),

  // User Profile
  getProfile: () => apiClient.get('/auth/profile'),
  updateProfile: (data) => apiClient.put('/auth/profile', data),
  getNotificationPreferences: () => apiClient.get('/auth/notification-preferences'),
  updateNotificationPreferences: (data) => apiClient.put('/auth/notification-preferences', data),

  patch: (url, data, config) => apiClient.patch(url, data, config),

  // Dashboard
  getDashboardStats: () => apiClient.get('/dashboard/stats'),
  getRecentActivities: () => apiClient.get('/dashboard/recent-activities'),
  getCategoryBreakdown: () => apiClient.get('/dashboard/category-breakdown'),
  getExtendedDashboardStats: () => apiClient.get('/dashboard/extended-stats'),

  // Components
  getComponents: (params) => apiClient.get('/components', { params }),
  getComponentById: (id) => apiClient.get(`/components/${id}`),
  createComponent: (data) => apiClient.post('/components', data),
  updateComponent: (id, data) => apiClient.put(`/components/${id}`, data),
  deleteComponent: (id) => apiClient.delete(`/components/${id}`),
  getComponentSpecifications: (id) => apiClient.get(`/components/${id}/specifications`),
  updateComponentSpecifications: (id, data) => apiClient.put(`/components/${id}/specifications`, data),
  getComponentDistributors: (id) => apiClient.get(`/components/${id}/distributors`),
  updateComponentDistributors: (id, data) => apiClient.put(`/components/${id}/distributors`, data),
  
  // Component Alternatives
  getComponentAlternatives: (id) => apiClient.get(`/components/${id}/alternatives`),
  createComponentAlternative: (id, data) => apiClient.post(`/components/${id}/alternatives`, data),
  updateComponentAlternative: (id, altId, data) => apiClient.put(`/components/${id}/alternatives/${altId}`, data),
  deleteComponentAlternative: (id, altId) => apiClient.delete(`/components/${id}/alternatives/${altId}`),
  
  // Component Approval
  updateComponentApproval: (id, action, user_id) => apiClient.post(`/components/${id}/approval`, { action, user_id }),
  
  getSubCategorySuggestions: (categoryId, level, filters = {}) => {
    const params = { categoryId, level };
    if (filters.subCat1) params.subCat1 = filters.subCat1;
    if (filters.subCat2) params.subCat2 = filters.subCat2;
    return apiClient.get('/components/subcategories/suggestions', { params });
  },
  
  getFieldSuggestions: (categoryId, field) => {
    return apiClient.get('/components/field-suggestions', { params: { categoryId, field } });
  },

  // Categories
  getCategories: () => apiClient.get('/categories'),
  getCategoryById: (id) => apiClient.get(`/categories/${id}`),
  createCategory: (data) => apiClient.post('/categories', data),
  updateCategory: (id, data) => apiClient.put(`/categories/${id}`, data),
  deleteCategory: (id) => apiClient.delete(`/categories/${id}`),
  getComponentsByCategory: (id, params) => apiClient.get(`/categories/${id}/components`, { params }),
  updateCategoryOrder: (categories) => apiClient.put('/settings/categories/reorder', { categories }),

  // Inventory
  getInventory: () => apiClient.get('/inventory'),
  getInventoryById: (id) => apiClient.get(`/inventory/${id}`),
  getInventoryByComponent: (componentId) => apiClient.get(`/inventory/component/${componentId}`),
  createInventory: (data) => apiClient.post('/inventory', data),
  updateInventory: (id, data) => apiClient.put(`/inventory/${id}`, data),
  deleteInventory: (id) => apiClient.delete(`/inventory/${id}`),
  getLowStockItems: () => apiClient.get('/inventory/alerts/low-stock'),
  searchByBarcode: (barcode) => apiClient.post('/inventory/search/barcode', { barcode }),
  getInventoryAlternatives: (componentId) => apiClient.get(`/inventory/${componentId}/alternatives`),
  updateAlternativeInventory: (altId, data) => apiClient.put(`/inventory/alternatives/${altId}`, data),

  // Search
  searchDigikey: (partNumber) => apiClient.post('/search/digikey', { partNumber }),
  searchMouser: (partNumber) => apiClient.post('/search/mouser', { partNumber }),
  searchAllVendors: (partNumber) => apiClient.post('/search/all', { partNumber }),
  addVendorPartToLibrary: (data) => apiClient.post('/search/add-to-library', data),
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

  // Audit Log
  getAuditLog: () => apiClient.get('/dashboard/activities/all'),
  clearAuditLogs: () => apiClient.delete('/dashboard/activities/all'),

  // Distributors
  getDistributors: () => apiClient.get('/distributors'),

  // Manufacturers
  getManufacturers: (params) => apiClient.get('/manufacturers', { params }),
  getManufacturerById: (id) => apiClient.get(`/manufacturers/${id}`),
  createManufacturer: (data) => apiClient.post('/manufacturers', data),
  updateManufacturer: (id, data) => apiClient.put(`/manufacturers/${id}`, data),
  renameManufacturer: (id, newName) => apiClient.put(`/manufacturers/${id}/rename`, { newName }),
  deleteManufacturer: (id) => apiClient.delete(`/manufacturers/${id}`),

  // Settings
  getSettings: () => apiClient.get('/settings'),
  updateSettings: (data) => apiClient.put('/settings', data),
  
  // Category Specifications (New Schema)
  getCategorySpecifications: (categoryId) => apiClient.get(`/settings/categories/${categoryId}/specifications`),
  createCategorySpecification: (categoryId, data) => apiClient.post(`/settings/categories/${categoryId}/specifications`, data),
  updateCategorySpecification: (id, data) => apiClient.put(`/settings/specifications/${id}`, data),
  deleteCategorySpecification: (id) => apiClient.delete(`/settings/specifications/${id}`),
  reorderCategorySpecifications: (categoryId, data) => apiClient.put(`/settings/categories/${categoryId}/specifications/reorder`, data),
  
  // Specification Templates (Legacy - kept for backward compatibility)
  getSpecificationTemplates: (categoryId) => apiClient.get(`/settings/categories/${categoryId}/specifications`),
  createSpecificationTemplate: (data) => apiClient.post('/specification-templates', data),
  updateSpecificationTemplate: (id, data) => apiClient.put(`/specification-templates/${id}`, data),
  deleteSpecificationTemplate: (id) => apiClient.delete(`/specification-templates/${id}`),
  
  // Database Management (Silent Mode API - No User Prompts)
  getDatabaseStatus: () => apiClient.get('/settings/database/status'),
  clearDatabase: () => apiClient.post('/settings/database/clear'),
  resetDatabase: (confirm = false) => apiClient.post('/settings/database/reset', { confirm: confirm === true }),
  initDatabase: () => apiClient.post('/settings/database/init'),
  loadSampleData: () => apiClient.post('/settings/database/sample-data'),
  verifyDatabase: () => apiClient.get('/settings/database/verify'),
  syncInventory: () => apiClient.post('/settings/database/sync-inventory'),
  
  // Legacy Admin endpoints (if still needed)
  getDatabaseStats: () => apiClient.get('/admin/stats'),
  verifyCISCompliance: () => apiClient.get('/admin/verify-cis'),
  
  // Projects
  getProjects: () => apiClient.get('/projects'),
  getProjectById: (id) => apiClient.get(`/projects/${id}`),
  createProject: (data) => apiClient.post('/projects', data),
  updateProject: (id, data) => apiClient.put(`/projects/${id}`, data),
  deleteProject: (id) => apiClient.delete(`/projects/${id}`),
  addComponentToProject: (projectId, data) => apiClient.post(`/projects/${projectId}/components`, data),
  updateProjectComponent: (projectId, componentId, data) => apiClient.put(`/projects/${projectId}/components/${componentId}`, data),
  removeComponentFromProject: (projectId, componentId) => apiClient.delete(`/projects/${projectId}/components/${componentId}`),
  consumeProjectComponents: (projectId) => apiClient.post(`/projects/${projectId}/consume`),
  
  // Stock and Pricing Updates
  updateComponentStock: (id) => apiClient.post(`/components/${id}/update-stock`, {}),
  bulkUpdateStock: (limit) => apiClient.post('/components/bulk/update-stock', {}, { params: { limit } }),
  bulkUpdateSpecifications: (limit) => apiClient.post('/components/bulk/update-specifications', {}, { params: { limit } }),
  bulkUpdateDistributors: (limit) => apiClient.post('/components/bulk/update-distributors', {}, { params: { limit } }),
  
  // ECO (Engineer Change Order)
  getECOs: (params) => apiClient.get('/eco', { params }),
  getECOById: (id) => apiClient.get(`/eco/${id}`),
  createECO: (data) => apiClient.post('/eco', data),
  approveECO: (id) => apiClient.post(`/eco/${id}/approve`),
  rejectECO: (id, data) => apiClient.post(`/eco/${id}/reject`, data),
  deleteECO: (id) => apiClient.delete(`/eco/${id}`),
  
  // SMTP Settings
  smtp: {
    get: () => apiClient.get('/smtp'),
    post: (data) => apiClient.post('/smtp', data),
    test: (data) => apiClient.post('/smtp/test', data),
    testEmail: () => apiClient.post('/smtp/test-email'),
  },
  
  // File Upload
  uploadComponentFiles: (mfgPartNumber, formData) => 
    apiClient.post(`/files/upload/${encodeURIComponent(mfgPartNumber)}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  uploadPassiveFiles: (formData) => 
    apiClient.post('/files/upload-passive', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  listComponentFiles: (mfgPartNumber) => 
    apiClient.get(`/files/list/${encodeURIComponent(mfgPartNumber)}`),
  deleteComponentFile: (category, mfgPartNumber, filename) => 
    apiClient.delete('/files/delete', { data: { category, mfgPartNumber, filename } }),
  getFileDownloadUrl: (category, mfgPartNumber, filename) => 
    `${API_BASE_URL}/files/download/${category}/${encodeURIComponent(mfgPartNumber)}/${encodeURIComponent(filename)}`,
};

export default apiClient;
