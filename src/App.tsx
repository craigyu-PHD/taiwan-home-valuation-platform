import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";

const HomePage = lazy(() => import("./pages/HomePage").then((module) => ({ default: module.HomePage })));
const DecisionRadarPage = lazy(() => import("./pages/DecisionRadarPage").then((module) => ({ default: module.DecisionRadarPage })));
const MapEstimatePage = lazy(() => import("./pages/MapEstimatePage").then((module) => ({ default: module.MapEstimatePage })));
const MarketPage = lazy(() => import("./pages/MarketPage").then((module) => ({ default: module.MarketPage })));
const MethodPage = lazy(() => import("./pages/MethodPage").then((module) => ({ default: module.MethodPage })));
const ResultPage = lazy(() => import("./pages/ResultPage").then((module) => ({ default: module.ResultPage })));
const LandValueTaxPage = lazy(() => import("./pages/LandValueTaxPage").then((module) => ({ default: module.LandValueTaxPage })));
const NewsPolicyPage = lazy(() => import("./pages/NewsPolicyPage").then((module) => ({ default: module.NewsPolicyPage })));

const PageLoading = () => (
  <div className="page-loading" role="status" aria-live="polite">
    <span />
    <strong>載入中</strong>
  </div>
);

export const App = () => (
  <AppShell>
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/estimate/map" element={<MapEstimatePage />} />
        <Route path="/estimate/result" element={<ResultPage />} />
        <Route path="/land-value-tax" element={<LandValueTaxPage />} />
        <Route path="/news-policy" element={<NewsPolicyPage />} />
        <Route path="/market" element={<MarketPage />} />
        <Route path="/decision-radar" element={<DecisionRadarPage />} />
        <Route path="/method" element={<MethodPage />} />
        <Route path="/disclaimer" element={<MethodPage />} />
        <Route path="/guide" element={<MethodPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  </AppShell>
);
