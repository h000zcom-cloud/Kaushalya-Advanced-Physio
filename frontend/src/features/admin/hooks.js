import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, fetcher, getErrorMessage } from "@/lib/api";

export const useAdminQuery = (key, url, params, options = {}) => useQuery({ queryKey: ["admin", key, params ?? null], queryFn: () => fetcher(url, params), ...options });

export function useInvalidateAdmin() {
  const qc = useQueryClient();
  return (keys) => {
    if (!keys) return qc.invalidateQueries({ queryKey: ["admin"] });
    return Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: ["admin", k] })));
  };
}

export function useAdminMutation(fn, { success, onSuccess, invalidate } = {}) {
  const invalidateAdmin = useInvalidateAdmin();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (data, vars) => {
      await invalidateAdmin(invalidate);
      if (success) toast.success(typeof success === "function" ? success(data) : success);
      onSuccess?.(data, vars);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export const adminApi = {
  appointments: (params) => fetcher("/admin/appointments", params),
  appointment: (id) => fetcher(`/admin/appointments/${id}`),
  act: (id, action, body = {}) => api.post(`/admin/appointments/${id}/${action}`, body).then((r) => r.data),
  createAppointment: (body) => api.post("/admin/appointments", body).then((r) => r.data),
  doctors: () => fetcher("/admin/doctors"),
  services: () => fetcher("/admin/services"),
  availability: (date, service_id) => fetcher("/admin/schedule/availability", { date, service_id }),
};
