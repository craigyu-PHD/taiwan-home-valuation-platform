import { Crosshair, Filter, Navigation, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AddressSearch } from "../components/AddressSearch";
import { CaseMap } from "../components/CaseMap";
import { PropertyEstimateForm } from "../components/PropertyEstimateForm";
import { ResultSummary } from "../components/ResultSummary";
import { TransactionList } from "../components/TransactionList";
import { useEstimate } from "../context/EstimateContext";
import { demoTransactions } from "../data/demoTransactions";
import { getTownBoundary, type BoundaryFeature } from "../services/boundaries";
import { estimateProperty, getNearbyTransactions } from "../services/valuation";
import type { LocationCandidate, PropertyType } from "../types";

export const MapEstimatePage = () => {
  const navigate = useNavigate();
  const { propertyInput, setSelectedLocation, runValuation } = useEstimate();
  const [months, setMonths] = useState(24);
  const [type, setType] = useState<PropertyType | "全部">("全部");
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [boundary, setBoundary] = useState<BoundaryFeature | undefined>();

  const center: [number, number] = [propertyInput.lat ?? 23.8, propertyInput.lng ?? 121.0];
  useEffect(() => {
    getTownBoundary(propertyInput.city, propertyInput.district).then(setBoundary).catch(() => setBoundary(undefined));
  }, [propertyInput.city, propertyInput.district]);
  const nearby = useMemo(() => {
    const base = getNearbyTransactions(center[0], center[1], 3500);
    return base.filter((item) => {
      if (type !== "全部" && item.propertyType !== type) return false;
      const monthsAgo = Math.max(
        0,
        (new Date("2026-04-30").getFullYear() - new Date(item.transactionDate).getFullYear()) * 12 +
          new Date("2026-04-30").getMonth() -
          new Date(item.transactionDate).getMonth(),
      );
      return monthsAgo <= months;
    });
  }, [center, months, type]);

  const preview = useMemo(() => estimateProperty(propertyInput, demoTransactions), [propertyInput]);

  const pickMapPoint = (lat: number, lng: number) => {
    const candidate: LocationCandidate = {
      id: `manual-${lat}-${lng}`,
      label: `地圖選點 ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      city: propertyInput.city,
      district: propertyInput.district,
      road: propertyInput.road,
      lat,
      lng,
      confidence: 0.62,
      source: "manual",
    };
    setSelectedLocation(candidate);
  };

  const useCurrentLocation = () => {
    navigator.geolocation?.getCurrentPosition((position) => {
      pickMapPoint(position.coords.latitude, position.coords.longitude);
    });
  };

  const estimate = () => {
    runValuation();
    navigate("/estimate/result");
  };

  return (
    <div className="map-page">
      <section className="map-search-bar">
        <AddressSearch compact buttonLabel="搜尋位置" onSelect={(candidate) => setSelectedLocation(candidate)} />
        <button className="secondary-button" type="button" onClick={useCurrentLocation}>
          <Crosshair size={18} />
          目前位置
        </button>
      </section>

      <section className="map-workspace">
        <CaseMap
          center={center}
          cases={nearby}
          onPick={pickMapPoint}
          highlightGeometry={boundary?.geometry}
          highlightLabel={boundary ? `${boundary.properties.city}${boundary.properties.district}` : undefined}
        />
        <aside className={`map-side-panel ${drawerOpen ? "is-open" : ""}`}>
          <button className="drawer-handle" type="button" onClick={() => setDrawerOpen((value) => !value)}>
            <SlidersHorizontal size={18} />
            周邊成交與估價
          </button>
          <div className="filter-row">
            <label>
              <Filter size={15} />
              成交時間
              <select value={months} onChange={(event) => setMonths(Number(event.target.value))}>
                <option value={6}>近 6 個月</option>
                <option value={12}>近 12 個月</option>
                <option value={24}>近 24 個月</option>
                <option value={36}>近 36 個月</option>
              </select>
            </label>
            <label>
              類型
              <select value={type} onChange={(event) => setType(event.target.value as PropertyType | "全部")}>
                {["全部", "住宅大樓", "華廈", "公寓", "套房"].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>
          <PropertyEstimateForm compact stayOnPage submitLabel="更新條件並估價" />
          <ResultSummary result={preview} compact />
          <button className="primary-button full-width" type="button" onClick={estimate}>
            <Navigation size={18} />
            使用此位置估價
          </button>
          <TransactionList cases={preview.casesUsed.slice(0, 5)} />
        </aside>
      </section>
    </div>
  );
};
