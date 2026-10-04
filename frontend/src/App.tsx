import { Suspense, lazy } from "react";
import { Navigate, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import Discoveries from "@/pages/Discoveries";
import { Toaster } from "@/components/ui/sonner";
import { AccountProvider } from "@/components/AccountProvider";
import { PendingAdd } from "@/components/AddToPortfolio";
import { LearnHub, LessonPage } from "@/pages/Learn";
import PortfolioPage from "@/pages/Portfolio";
import Today from "@/pages/Today";

// Studio is internal: unlisted path from env, lazily loaded so its code is not in the public bundle.
const Admin = lazy(() => import("@/pages/Admin"));
const STUDIO_PATH = import.meta.env.VITE_STUDIO_PATH as string | undefined;

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <AccountProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/discoveries" element={<Discoveries />} />
        <Route path="/learn" element={<LearnHub />} />
        <Route path="/learn/:slug" element={<LessonPage />} />
        <Route path="/today" element={<Today />} />
        <Route path="/today/:day" element={<Today />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
        {STUDIO_PATH && <Route path={STUDIO_PATH} element={<Suspense fallback={null}><Admin /></Suspense>} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <PendingAdd />
      <Toaster />
    </AccountProvider>
  );
}
