import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Overview from "./pages/Overview";
import Funnel from "./pages/Funnel";
import Campaigns from "./pages/Campaigns";
import Sales from "./pages/Sales";
import Imports from "./pages/Imports";
import Assistant from "./pages/Assistant";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/funnel" element={<Funnel />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/sales" element={<Sales />} />
          <Route path="/imports" element={<Imports />} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
