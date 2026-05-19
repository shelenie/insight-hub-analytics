import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ScrollToTop } from "@/components/layout/ScrollToTop";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/i18n/I18nProvider";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { AuthProvider } from "@/auth/AuthProvider";
import { ProtectedRoute } from "@/auth/ProtectedRoute";
import { DateFilterProvider } from "@/filters/DateContext";
import { PreferencesProvider } from "@/preferences/PreferencesProvider";
import { SavedViewsProvider } from "@/preferences/SavedViewsProvider";
import Overview from "./pages/Overview";
import Funnel from "./pages/Funnel";
import Campaigns from "./pages/Campaigns";
import Sales from "./pages/Sales";
import Imports from "./pages/Imports";
import Assistant from "./pages/Assistant";
import Onboarding from "./pages/Onboarding";
import Bindings from "./pages/Bindings";
import Alerts from "./pages/Alerts";
import AdsConnectors from "./pages/AdsConnectors";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <I18nProvider>
        <PreferencesProvider>
          <AuthProvider>
            <SavedViewsProvider>
              <DateFilterProvider>
                <TooltipProvider>
                  <Toaster />
                  <Sonner />
                  <BrowserRouter>
                    <ScrollToTop />
                    <Routes>
                      <Route path="/login" element={<Login />} />
                      <Route path="/" element={<ProtectedRoute><Overview /></ProtectedRoute>} />
                      <Route path="/funnel" element={<ProtectedRoute><Funnel /></ProtectedRoute>} />
                      <Route path="/campaigns" element={<ProtectedRoute><Campaigns /></ProtectedRoute>} />
                      <Route path="/sales" element={<ProtectedRoute><Sales /></ProtectedRoute>} />
                      <Route path="/imports" element={<ProtectedRoute><Imports /></ProtectedRoute>} />
                      <Route path="/assistant" element={<ProtectedRoute><Assistant /></ProtectedRoute>} />
                      <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
                      <Route path="/bindings" element={<ProtectedRoute><Bindings /></ProtectedRoute>} />
                      <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
                      <Route path="/ads-connectors" element={<ProtectedRoute><AdsConnectors /></ProtectedRoute>} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </BrowserRouter>
                </TooltipProvider>
              </DateFilterProvider>
            </SavedViewsProvider>
          </AuthProvider>
        </PreferencesProvider>
      </I18nProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
