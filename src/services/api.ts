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
  createGroup: (name: string, memberIds: string[], description?: string, welcomeMessage?: string) =>
    api.post("/conversations/group", { name, memberIds, description, welcomeMessage }),
  renameGroup: (id: string, name: string) =>
    api.put(`/conversations/${id}/name`, { name }),
  updateDescription: (id: string, description: string) =>
    api.put(`/conversations/${id}/description`, { description }),
  updateWelcomeMessage: (id: string, welcomeMessage: string) =>
    api.put(`/conversations/${id}/welcome-message`, { welcomeMessage }),
  updatePermissions: (id: string, permissions: Record<string, string>) =>
    api.put(`/conversations/${id}/permissions`, { permissions }),
  updateMemberRole: (id: string, userId: string, role: string) =>
    api.put(`/conversations/${id}/members/${userId}/role`, { role }),
  muteMember: (id: string, userId: string, muted: boolean, duration?: number) =>
    api.put(`/conversations/${id}/members/${userId}/mute`, { muted, duration }),
  banMember: (id: string, userId: string, banned: boolean) =>
    api.put(`/conversations/${id}/members/${userId}/ban`, { banned }),
  addMember: (id: string, userId: string) =>
    api.post(`/conversations/${id}/members`, { userId }),
  removeMember: (id: string, userId: string) =>
    api.delete(`/conversations/${id}/members/${userId}`),
  createInviteLink: (id: string, maxUses?: number, expiresIn?: number) =>
    api.post(`/conversations/${id}/invite-link`, { maxUses, expiresIn }),
  joinByInvite: (code: string) =>
    api.get(`/conversations/join/${code}`),
  addTopic: (id: string, name: string, description?: string) =>
    api.post(`/conversations/${id}/topics`, { name, description }),
  deleteTopic: (id: string, topicId: string) =>
    api.delete(`/conversations/${id}/topics/${topicId}`),
  createPoll: (id: string, question: string, options: string[]) =>
    api.post(`/conversations/${id}/polls`, { question, options }),
  votePoll: (id: string, pollId: string, optionId: string) =>
    api.post(`/conversations/${id}/polls/${pollId}/vote`, { optionId }),
  closePoll: (id: string, pollId: string) =>
    api.post(`/conversations/${id}/polls/${pollId}/close`),
  getMessages: (id: string, search?: string, topicId?: string) =>
    api.get(`/conversations/${id}/messages`, { params: { search, topicId } }),
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

export const mediaAPI = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

export default api;
