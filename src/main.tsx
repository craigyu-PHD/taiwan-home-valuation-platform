import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import "./policy-radar-overrides.css";
import { App } from "./App";
import { EstimateProvider } from "./context/EstimateContext";

const routerBaseName = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter basename={routerBaseName}>
      <EstimateProvider>
        <App />
      </EstimateProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
