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
  getTree: (personId, collapsedState = {}) => {
      const params = new URLSearchParams();
      if (collapsedState.descendants && collapsedState.descendants.size > 0) {
          params.append('collapsedDescendants', Array.from(collapsedState.descendants).join(','));
      }
      if (collapsedState.ancestors && collapsedState.ancestors.size > 0) {
          params.append('collapsedAncestors', Array.from(collapsedState.ancestors).join(','));
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
