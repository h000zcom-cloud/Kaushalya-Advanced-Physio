import axios from "axios";

export const API_BASE = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API_BASE, withCredentials: true, timeout: 20000 });

let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config || {};
    const status = error.response?.status;
    const isAuthCall = (original.url || "").includes("/auth/");
    if (status === 401 && !original._retried && !isAuthCall && (original.url || "").includes("/admin")) {
      original._retried = true;
      refreshPromise = refreshPromise || api.post("/auth/refresh").finally(() => { refreshPromise = null; });
      try {
        await refreshPromise;
        return api(original);
      } catch (refreshError) {
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  },
);

export const fetcher = (url, params) => api.get(url, { params }).then((r) => r.data);

export function getErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  if (!error) return fallback;
  if (error.code === "ECONNABORTED" || error.message === "Network Error") return "We could not reach the server. Please check your connection and try again.";
  const detail = error.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => e?.msg || JSON.stringify(e)).join(" ");
  if (detail?.msg) return detail.msg;
  return fallback;
}

export function getErrorCode(error) {
  return error?.response?.data?.code || null;
}

export function getFieldErrors(error) {
  const rows = error?.response?.data?.errors;
  if (!Array.isArray(rows)) return {};
  return rows.reduce((acc, row) => ({ ...acc, [row.field]: row.message }), {});
}
