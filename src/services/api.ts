import axios from "axios";

const API_URL = "https://b-lefx.onrender.com/api";

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data: { username: string; email: string; password: string }) =>
    api.post("/auth/register", data),
  login: (data: { email: string; password: string }) =>
    api.post("/auth/login", data),
  me: () => api.get("/auth/me"),
  logout: () => api.post("/auth/logout"),
  getUsers: () => api.get("/auth/users"),
};

export const conversationAPI = {
  getAll: () => api.get("/conversations"),
  create: (userId: string) => api.post("/conversations", { userId }),
  createGroup: (name: string, memberIds: string[]) =>
    api.post("/conversations/group", { name, memberIds }),
  renameGroup: (id: string, name: string) =>
    api.put(`/conversations/${id}/name`, { name }),
  addMember: (id: string, userId: string) =>
    api.post(`/conversations/${id}/members`, { userId }),
  removeMember: (id: string, userId: string) =>
    api.delete(`/conversations/${id}/members/${userId}`),
  getMessages: (id: string, search?: string) =>
    api.get(`/conversations/${id}/messages`, { params: { search } }),
  sendMessage: (id: string, text: string) =>
    api.post(`/conversations/${id}/messages`, { text }),
  editMessage: (messageId: string, text: string) =>
    api.put(`/conversations/messages/${messageId}`, { text }),
  deleteMessage: (messageId: string) =>
    api.delete(`/conversations/messages/${messageId}`),
  reactToMessage: (messageId: string, emoji: string) =>
    api.post(`/conversations/messages/${messageId}/react`, { emoji }),
  pinMessage: (messageId: string) =>
    api.post(`/conversations/messages/${messageId}/pin`),
  searchMessages: (q: string) =>
    api.get("/conversations/search", { params: { q } }),
  saveDraft: (id: string, text: string) =>
    api.post(`/conversations/${id}/draft`, { text }),
};

export default api;
