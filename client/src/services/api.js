import axios from 'axios';

const API_URL = '/api';

const api = axios.create({
  baseURL: API_URL,
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Token expired or invalid
      authService.logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);


export const authService = {
  register: (userData) => api.post('/auth/register', userData),
  login: (credentials) => api.post('/auth/login', credentials),
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },
  getCurrentUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },
  isAuthenticated: () => {
    return !!localStorage.getItem('token');
  }
};

export const personService = {
  getAll: () => api.get('/persons'),
  getById: (id) => api.get(`/persons/${id}`),
  create: (personData) => {
    const formData = new FormData();
    Object.keys(personData).forEach(key => {
      if (personData[key] !== null && personData[key] !== undefined) {
        formData.append(key, personData[key]);
      }
    });
    return api.post('/persons', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  update: (id, personData) => {
    const formData = new FormData();
    Object.keys(personData).forEach(key => {
      if (personData[key] !== null && personData[key] !== undefined) {
        formData.append(key, personData[key]);
      }
    });
    return api.put(`/persons/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  delete: (id) => api.delete(`/persons/${id}`),
  getTree: (personId, config = {}) => {
      const params = new URLSearchParams();
      // Se config.expandedIds esiste ed è un Set o Array
      const expanded = config.expandedIds 
          ? (config.expandedIds instanceof Set ? Array.from(config.expandedIds) : config.expandedIds) 
          : [];

      if (expanded.length > 0) {
          params.append('expandedIds', expanded.join(','));
      }
      
      const queryString = params.toString();
      return api.get(`/tree/${personId}${queryString ? '?' + queryString : ''}`);
  },
  addRelationship: (id, relationshipData) => 
    api.post(`/persons/${id}/relationship`, relationshipData),
  searchMatches: () => api.get('/persons/search/matches'),
  resetParams: () => api.post('/persons/reset'),
  repairTree: () => api.post('/tree/maintenance/repair-unions')
};

export default api;
