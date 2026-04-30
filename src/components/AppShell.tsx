import {
  BarChart3,
  Gauge,
  Home,
  Info,
  Map,
  Menu,
  X,
} from "lucide-react";
import { type PropsWithChildren, useState } from "react";
import { NavLink } from "react-router-dom";
import { DEMO_DATA_NOTICE } from "../data/demoTransactions";

const navItems = [
  { to: "/", label: "地址估價", icon: Home },
  { to: "/estimate/map", label: "地圖估價", icon: Map },
  { to: "/market", label: "區域行情", icon: BarChart3 },
  { to: "/decision-radar", label: "決策雷達", icon: Gauge },
  { to: "/method", label: "方法與聲明", icon: Info },
];

export const AppShell = ({ children }: PropsWithChildren) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="app-shell">
      <header className="site-header">
        <NavLink to="/" className="brand" onClick={() => setOpen(false)}>
          <span className="brand-mark" aria-hidden="true">
            <i />
          </span>
          <span>
            <strong>全台房屋即時估價平台</strong>
            <small>透明估價 beta</small>
          </span>
        </NavLink>
        <button
          type="button"
          className="icon-button mobile-menu-button"
          aria-label={open ? "關閉選單" : "開啟選單"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={21} /> : <Menu size={21} />}
        </button>
        <nav className={`site-nav ${open ? "is-open" : ""}`}>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
              >
                <Icon size={17} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </header>
      <main>{children}</main>
      <footer className="site-footer">
        <span className="footer-data-note">{DEMO_DATA_NOTICE}</span>
        <span>資料來源規劃：內政部實價登錄 Open Data、OpenStreetMap / Leaflet、Nominatim。</span>
        <span>本平台僅供市場行情參考，不構成正式不動產估價報告。</span>
      </footer>
    </div>
  );
};
