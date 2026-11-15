/*
 * 统一 API 客户端：集中处理 baseURL、token、JSON、错误与 401。
 * 开发环境默认走 Vite 代理（/api -> http://localhost:8080）；
 * 如需直连，可设置 VITE_API_BASE=http://localhost:8080。
 */
export const API_BASE = import.meta.env.VITE_API_BASE || "";

const TOKEN_KEY = "chirpToken";
const USER_KEY = "chirpUser";

export function loadToken() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

export function loadUser() {
  const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveAuth(user, token, remember = true) {
  const storage = remember ? localStorage : sessionStorage;
  const other = remember ? sessionStorage : localStorage;
  if (token) storage.setItem(TOKEN_KEY, token);
  if (user) storage.setItem(USER_KEY, JSON.stringify(user));
  other.removeItem(TOKEN_KEY);
  other.removeItem(USER_KEY);
}

export function updateStoredUser(user) {
  const storage = localStorage.getItem(TOKEN_KEY) ? localStorage : sessionStorage;
  storage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  [localStorage, sessionStorage].forEach((storage) => {
    storage.removeItem(TOKEN_KEY);
    storage.removeItem(USER_KEY);
  });
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function readBody(response) {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function apiFetch(path, options = {}) {
  const { method = "GET", body, auth = false, headers = {}, signal } = options;
  const finalHeaders = { Accept: "application/json", ...headers };
  const init = { method, headers: finalHeaders, signal };

  if (body !== undefined) {
    finalHeaders["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  if (auth) {
    const token = loadToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, init);

  if (response.status === 401 && auth) {
    clearAuth();
    if (window.location.pathname !== "/login") window.location.replace("/login");
    throw new ApiError("登录已失效，请重新登录", 401);
  }

  const data = await readBody(response);
  if (!response.ok) {
    const message =
      (data && typeof data === "object" && (data.message || data.error)) ||
      `请求失败（${response.status}）`;
    throw new ApiError(message, response.status);
  }
  return data;
}

/* ============ 领域接口 ============ */
export const authApi = {
  register: (payload) => apiFetch("/api/auth/register", { method: "POST", body: payload }),
  login: (payload) => apiFetch("/api/auth/login", { method: "POST", body: payload }),
  logout: () => apiFetch("/api/auth/logout", { method: "POST", auth: true }),
  forgotPassword: (payload) =>
    apiFetch("/api/auth/forgot-password", { method: "POST", body: payload })
};

export const postsApi = {
  list: ({ scope = "latest" } = {}) =>
    apiFetch(scope === "following" ? "/api/posts?scope=following" : "/api/posts", { auth: true }),
  create: (content) => apiFetch("/api/posts", { method: "POST", body: { content }, auth: true }),
  get: (id) => apiFetch(`/api/posts/${id}`, { auth: true }),
  remove: (id) => apiFetch(`/api/posts/${id}`, { method: "DELETE", auth: true }),
  like: (id) => apiFetch(`/api/posts/${id}/like`, { method: "POST", auth: true }),
  unlike: (id) => apiFetch(`/api/posts/${id}/like`, { method: "DELETE", auth: true }),
  bookmark: (id) => apiFetch(`/api/posts/${id}/bookmark`, { method: "POST", auth: true }),
  unbookmark: (id) => apiFetch(`/api/posts/${id}/bookmark`, { method: "DELETE", auth: true }),
  comments: ({ id, offset = 0, limit = 20 }) =>
    apiFetch(`/api/posts/${id}/comments?offset=${offset}&limit=${limit}`, { auth: true }),
  addComment: (id, content) =>
    apiFetch(`/api/posts/${id}/comments`, { method: "POST", body: { content }, auth: true }),
  removeComment: (id) => apiFetch(`/api/comments/${id}`, { method: "DELETE", auth: true })
};

export const usersApi = {
  me: () => apiFetch("/api/users/me", { auth: true }),
  get: (id) => apiFetch(`/api/users/${id}`, { auth: true }),
  updateMe: (payload) => apiFetch("/api/users/me", { method: "PUT", body: payload, auth: true }),
  posts: ({ id, offset = 0, limit = 20 }) =>
    apiFetch(`/api/users/${id}/posts?offset=${offset}&limit=${limit}`, { auth: true }),
  follow: (id) => apiFetch(`/api/users/${id}/follow`, { method: "POST", auth: true }),
  unfollow: (id) => apiFetch(`/api/users/${id}/follow`, { method: "DELETE", auth: true }),
  following: (id, limit = 50) => apiFetch(`/api/users/${id}/following?limit=${limit}`, { auth: true })
};

export const searchApi = {
  query: ({ q, type = "post", offset = 0, limit = 20 }) =>
    apiFetch(`/api/search?q=${encodeURIComponent(q)}&type=${type}&offset=${offset}&limit=${limit}`, {
      auth: true
    }),
  trends: (limit = 10) => apiFetch(`/api/hashtags/trending?limit=${limit}`, { auth: true })
};

export const notificationsApi = {
  list: ({ offset = 0, limit = 20 } = {}) =>
    apiFetch(`/api/notifications?offset=${offset}&limit=${limit}`, { auth: true }),
  markRead: (ids) =>
    apiFetch("/api/notifications/read", {
      method: "POST",
      body: ids ? { ids } : {},
      auth: true
    })
};

export const messagesApi = {
  conversations: () => apiFetch("/api/messages/conversations", { auth: true }),
  unreadCount: () => apiFetch("/api/messages/unread-count", { auth: true }),
  history: (userId, { offset = 0, limit = 50 } = {}) =>
    apiFetch(`/api/messages?with=${userId}&offset=${offset}&limit=${limit}`, { auth: true }),
  send: (userId, content) =>
    apiFetch("/api/messages", { method: "POST", body: { recipientId: userId, content }, auth: true }),
  markRead: (userId) =>
    apiFetch("/api/messages/read", { method: "POST", body: { with: userId }, auth: true })
};

export const bookmarksApi = {
  list: ({ offset = 0, limit = 20 } = {}) =>
    apiFetch(`/api/bookmarks?offset=${offset}&limit=${limit}`, { auth: true })
};
