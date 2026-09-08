import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/lib/api";

export const useClinic = () => useQuery({ queryKey: ["public", "clinic"], queryFn: () => fetcher("/public/clinic"), staleTime: 5 * 60_000 });
export const useServices = () => useQuery({ queryKey: ["public", "services"], queryFn: () => fetcher("/public/services"), staleTime: 5 * 60_000 });
export const useService = (slug) => useQuery({ queryKey: ["public", "service", slug], queryFn: () => fetcher(`/public/services/${slug}`), enabled: !!slug });
export const useDoctors = () => useQuery({ queryKey: ["public", "doctors"], queryFn: () => fetcher("/public/doctors"), staleTime: 5 * 60_000 });
export const useDoctor = (slug) => useQuery({ queryKey: ["public", "doctor", slug], queryFn: () => fetcher(`/public/doctors/${slug}`), enabled: !!slug });
export const useTestimonials = (featured) => useQuery({ queryKey: ["public", "testimonials", featured], queryFn: () => fetcher("/public/testimonials", featured ? { featured: true } : undefined) });
export const useAvailabilityCalendar = (serviceId, from, to) => useQuery({ queryKey: ["public", "calendar", serviceId, from, to], queryFn: () => fetcher("/public/availability/calendar", { service_id: serviceId, date_from: from, date_to: to }), staleTime: 30_000 });
export const useAvailability = (date, serviceId) => useQuery({ queryKey: ["public", "availability", date, serviceId], queryFn: () => fetcher("/public/availability", { date, service_id: serviceId }), enabled: !!date, staleTime: 15_000 });

export function useNextAvailable(serviceId) {
  const query = useAvailabilityCalendar(serviceId);
  const next = query.data?.days?.find((d) => d.status === "AVAILABLE" || d.status === "LIMITED");
  return { ...query, next };
}
