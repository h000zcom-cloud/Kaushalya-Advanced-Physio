import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/features/auth/AuthContext";
import { LoadingState } from "@/components/shared/States";
import PublicLayout from "@/layouts/PublicLayout";
import Home from "@/pages/public/Home";
import Book from "@/pages/public/Book";
import ServiceDetail, { ServicesPage } from "@/pages/public/ServiceDetail";
import DoctorDetail, { DoctorsPage } from "@/pages/public/DoctorDetail";
import { AboutPage, ContactPage, FaqPage, LegalPage, NotFoundPage, PatientJourneyPage, TestimonialsPage } from "@/pages/public/InfoPages";
import Login, { ForgotPassword, ResetPassword } from "@/pages/admin/Login";

const AdminLayout = lazy(() => import("@/layouts/AdminLayout"));
const Overview = lazy(() => import("@/pages/admin/Overview"));
const Appointments = lazy(() => import("@/pages/admin/Appointments"));
const Patients = lazy(() => import("@/pages/admin/Patients"));
const PatientDetail = lazy(() => import("@/pages/admin/Patients").then((m) => ({ default: m.PatientDetail })));
const Doctors = lazy(() => import("@/pages/admin/Doctors"));
const DoctorAdminDetail = lazy(() => import("@/pages/admin/Doctors").then((m) => ({ default: m.DoctorDetail })));
const Services = lazy(() => import("@/pages/admin/Services"));
const Schedule = lazy(() => import("@/pages/admin/Schedule"));
const Messages = lazy(() => import("@/pages/admin/Messages"));
const Callbacks = lazy(() => import("@/pages/admin/Messages").then((m) => ({ default: m.Callbacks })));
const Testimonials = lazy(() => import("@/pages/admin/Testimonials"));
const Analytics = lazy(() => import("@/pages/admin/Analytics"));
const Settings = lazy(() => import("@/pages/admin/Settings"));
const Security = lazy(() => import("@/pages/admin/Security"));
const AuditLog = lazy(() => import("@/pages/admin/Security").then((m) => ({ default: m.AuditLog })));

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 } } });

const Fallback = () => <div className="p-8"><LoadingState rows={4} /></div>;

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<Fallback />}>
            <Routes>
              <Route element={<PublicLayout />}>
                <Route path="/" element={<Home />} />
                <Route path="/services" element={<ServicesPage />} />
                <Route path="/services/:slug" element={<ServiceDetail />} />
                <Route path="/doctors" element={<DoctorsPage />} />
                <Route path="/doctors/:slug" element={<DoctorDetail />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/patient-journey" element={<PatientJourneyPage />} />
                <Route path="/testimonials" element={<TestimonialsPage />} />
                <Route path="/faq" element={<FaqPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/book" element={<Book />} />
                <Route path="/privacy" element={<LegalPage kind="privacy" />} />
                <Route path="/terms" element={<LegalPage kind="terms" />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
              <Route path="/admin/login" element={<Login />} />
              <Route path="/admin/forgot-password" element={<ForgotPassword />} />
              <Route path="/admin/reset-password" element={<ResetPassword />} />
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Overview />} />
                <Route path="appointments" element={<Appointments />} />
                <Route path="patients" element={<Patients />} />
                <Route path="patients/:id" element={<PatientDetail />} />
                <Route path="doctors" element={<Doctors />} />
                <Route path="doctors/:id" element={<DoctorAdminDetail />} />
                <Route path="services" element={<Services />} />
                <Route path="schedule" element={<Schedule />} />
                <Route path="messages" element={<Messages />} />
                <Route path="callbacks" element={<Callbacks />} />
                <Route path="testimonials" element={<Testimonials />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="settings" element={<Settings />} />
                <Route path="security" element={<Security />} />
                <Route path="audit" element={<AuditLog />} />
              </Route>
            </Routes>
          </Suspense>
          <Toaster position="top-right" richColors closeButton />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
