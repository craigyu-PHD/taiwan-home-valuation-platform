import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { HomePage } from "./pages/HomePage";
import { MapEstimatePage } from "./pages/MapEstimatePage";
import { MarketPage } from "./pages/MarketPage";
import { MethodPage } from "./pages/MethodPage";
import { ResultPage } from "./pages/ResultPage";

export const App = () => (
  <AppShell>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/estimate/map" element={<MapEstimatePage />} />
      <Route path="/estimate/result" element={<ResultPage />} />
      <Route path="/market" element={<MarketPage />} />
      <Route path="/method" element={<MethodPage />} />
      <Route path="/disclaimer" element={<MethodPage />} />
      <Route path="/guide" element={<MethodPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </AppShell>
);
