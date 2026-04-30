import {
  BarChart3,
  Gauge,
  Home,
  Info,
  KeyRound,
  Map,
} from "lucide-react";
import { type PropsWithChildren } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { DEMO_DATA_NOTICE } from "../data/demoTransactions";
import { useEstimate } from "../context/EstimateContext";
import { ModeSwitch } from "./ModeSwitch";
import type { TransactionMode } from "../types";

const navItems = [
  { to: "/", label: "地址估價", icon: Home, modeAware: true },
  { to: "/estimate/map", label: "地圖估價", icon: Map, modeAware: true },
  { to: "/market", label: "區域行情", icon: BarChart3, modeAware: true },
  { to: "/decision-radar", label: "決策雷達", icon: Gauge, modeAware: true },
  { to: "/method", label: "方法與聲明", icon: Info },
];

export const AppShell = ({ children }: PropsWithChildren) => {
  const navigate = useNavigate();
  const { transactionMode, setTransactionMode } = useEstimate();
  const chooseMode = (mode: TransactionMode, to: string) => {
    setTransactionMode(mode);
    navigate(to);
  };

  return (
    <div className={`app-shell mode-${transactionMode}`}>
      <header className="site-header">
        <NavLink to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            <b>AI</b>
            <i />
          </span>
          <span className="brand-copy">
            <strong><em>找知道</em><span>AI估價平臺</span></strong>
            <small>房屋估價・租屋行情・決策雷達</small>
          </span>
        </NavLink>
        <nav className="site-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <div className="nav-mode-wrap" key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
                >
                  <Icon size={17} />
                  {item.label}
                </NavLink>
                {item.modeAware && (
                  <div className="nav-mode-panel" aria-label={`${item.label}模式選擇`}>
                    <button type="button" className="sale-choice" onClick={() => chooseMode("sale", item.to)}>
                      <Home size={16} />
                      <span>房屋估價系統</span>
                    </button>
                    <button type="button" className="rent-choice" onClick={() => chooseMode("rent", item.to)}>
                      <KeyRound size={16} />
                      <span>租屋行情系統</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </header>
      <div className="mobile-mode-bar">
        <ModeSwitch compact />
      </div>
      <main>{children}</main>
      <footer className="site-footer">
        <span className="footer-data-note">{DEMO_DATA_NOTICE}</span>
        <span>資料來源規劃：內政部實價登錄 Open Data、國土測繪中心土地利用、OpenStreetMap / Leaflet / Overpass / Nominatim。</span>
        <span>本平台僅供市場行情參考，不構成正式不動產估價報告、租賃鑑價或成交/出租保證。</span>
      </footer>
    </div>
  );
};
