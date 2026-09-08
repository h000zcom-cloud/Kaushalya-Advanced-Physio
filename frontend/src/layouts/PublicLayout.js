import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { MobileActionBar } from "@/components/marketing/MobileActionBar";
import { initAnalytics, track } from "@/lib/analytics";

export default function PublicLayout() {
  const { pathname } = useLocation();
  useEffect(() => { initAnalytics(); }, []);
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); track("page_view", { path: pathname }); }, [pathname]);
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand focus:px-3 focus:py-2 focus:text-white">Skip to content</a>
      <Navbar />
      <main id="main" className="flex-1 pb-20 md:pb-0"><Outlet /></main>
      <Footer />
      <MobileActionBar />
    </div>
  );
}
