import { Crosshair, Filter, MapPinned, Navigation, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AddressSearch } from "../components/AddressSearch";
import { CaseMap } from "../components/CaseMap";
import { PropertyEstimateForm } from "../components/PropertyEstimateForm";
import { ResultSummary } from "../components/ResultSummary";
import { TransactionList } from "../components/TransactionList";
import { useEstimate } from "../context/EstimateContext";
import { demoTransactions } from "../data/demoTransactions";
import { taiwanAdmin, taiwanCities } from "../data/taiwanAdmin";
import {
  findTownByPoint,
  getBoundaryCenter,
  getTownBoundary,
  type BoundaryFeature,
} from "../services/boundaries";
import { estimateProperty, getNearbyTransactions } from "../services/valuation";
import type { LocationCandidate, PropertyType } from "../types";

export const MapEstimatePage = () => {
  const navigate = useNavigate();
  const { propertyInput, setSelectedLocation, runValuation } = useEstimate();
  const [months, setMonths] = useState(24);
  const [type, setType] = useState<PropertyType | "全部">("全部");
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [boundary, setBoundary] = useState<BoundaryFeature | undefined>();
  const [mapSearchMode, setMapSearchMode] = useState<"地址" | "區域">("地址");
  const [searchCity, setSearchCity] = useState(propertyInput.city ?? "臺北市");
  const searchDistricts = useMemo(
    () => taiwanAdmin[searchCity as keyof typeof taiwanAdmin] ?? [],
    [searchCity],
  );
  const [searchDistrict, setSearchDistrict] = useState(propertyInput.district ?? searchDistricts[0] ?? "");
  const [locatorStatus, setLocatorStatus] = useState("拖曳黃色小人或點選地圖，即可更新估價位置。");

  const center: [number, number] = [propertyInput.lat ?? 23.8, propertyInput.lng ?? 121.0];
  useEffect(() => {
    if (!searchDistricts.includes(searchDistrict as never)) {
      setSearchDistrict(searchDistricts[0] ?? "");
    }
  }, [searchDistrict, searchDistricts]);
  useEffect(() => {
    getTownBoundary(propertyInput.city, propertyInput.district).then(setBoundary).catch(() => setBoundary(undefined));
    if (propertyInput.city) setSearchCity(propertyInput.city);
    if (propertyInput.district) setSearchDistrict(propertyInput.district);
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

  const applyCandidate = async (candidate: LocationCandidate) => {
    const town = candidate.city && candidate.district ? undefined : await findTownByPoint(candidate.lat, candidate.lng);
    const enriched: LocationCandidate = {
      ...candidate,
      city: candidate.city ?? town?.properties.city ?? propertyInput.city,
      district: candidate.district ?? town?.properties.district ?? propertyInput.district,
      confidence: town ? Math.max(candidate.confidence, 0.82) : candidate.confidence,
    };
    setSelectedLocation(enriched);
    setLocatorStatus(
      enriched.city && enriched.district
        ? `已定位到 ${enriched.city}${enriched.district}，可直接查看即時估價。`
        : "已更新地圖座標，但行政區無法由邊界判定；系統會以目前條件做低信心估價。",
    );
  };

  const pickMapPoint = async (lat: number, lng: number) => {
    const town = await findTownByPoint(lat, lng).catch(() => undefined);
    const candidate: LocationCandidate = {
      id: `manual-${lat}-${lng}`,
      label: town
        ? `${town.properties.city}${town.properties.district} 地圖選點`
        : `地圖選點 ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      city: town?.properties.city ?? propertyInput.city,
      district: town?.properties.district ?? propertyInput.district,
      road: town ? undefined : propertyInput.road,
      lat,
      lng,
      confidence: town ? 0.82 : 0.6,
      source: "manual",
    };
    setSelectedLocation(candidate);
    if (town) {
      setBoundary(town);
      setSearchCity(town.properties.city);
      setSearchDistrict(town.properties.district);
      setLocatorStatus(`已鎖定 ${town.properties.city}${town.properties.district}，即時行情已更新。`);
    } else {
      setLocatorStatus("已更新座標；此點沒有命中行政區邊界，系統會保留目前區域條件並降低信心。");
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocatorStatus("此瀏覽器不支援目前位置；請拖曳黃色小人或點選地圖。");
      return;
    }
    setLocatorStatus("正在取得目前位置...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void pickMapPoint(position.coords.latitude, position.coords.longitude);
      },
      () => {
        setLocatorStatus("無法取得目前位置，可能是瀏覽器尚未授權；仍可拖曳黃色小人或點選地圖估價。");
      },
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 10000 },
    );
  };

  const applyRegionSearch = async () => {
    const nextBoundary = await getTownBoundary(searchCity, searchDistrict);
    const nextCenter = getBoundaryCenter(nextBoundary?.geometry);
    const candidate: LocationCandidate = {
      id: `region-${searchCity}-${searchDistrict}`,
      label: `${searchCity}${searchDistrict}`,
      city: searchCity,
      district: searchDistrict,
      lat: nextCenter?.[0] ?? center[0],
      lng: nextCenter?.[1] ?? center[1],
      confidence: nextCenter ? 0.78 : 0.58,
      source: "manual",
    };
    if (nextBoundary) setBoundary(nextBoundary);
    setSelectedLocation(candidate);
    setLocatorStatus(`已切換到 ${searchCity}${searchDistrict}，地圖會顯示該行政區輪廓與行情。`);
  };

  const estimate = () => {
    runValuation();
    navigate("/estimate/result");
  };

  return (
    <div className="map-page">
      <section className="map-search-bar">
        <div className="map-search-card">
          <div className="map-search-tabs">
            <button
              type="button"
              className={mapSearchMode === "地址" ? "active" : ""}
              onClick={() => setMapSearchMode("地址")}
            >
              <Search size={17} />
              地址搜尋
            </button>
            <button
              type="button"
              className={mapSearchMode === "區域" ? "active" : ""}
              onClick={() => setMapSearchMode("區域")}
            >
              <MapPinned size={17} />
              區域搜尋
            </button>
          </div>
          {mapSearchMode === "地址" ? (
            <AddressSearch compact buttonLabel="搜尋位置" onSelect={(candidate) => void applyCandidate(candidate)} />
          ) : (
            <div className="map-region-search">
              <label>
                縣市
                <select
                  value={searchCity}
                  onChange={(event) => {
                    const nextCity = event.target.value;
                    setSearchCity(nextCity);
                    setSearchDistrict(taiwanAdmin[nextCity as keyof typeof taiwanAdmin]?.[0] ?? "");
                  }}
                >
                  {taiwanCities.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label>
                行政區
                <select value={searchDistrict} onChange={(event) => setSearchDistrict(event.target.value)}>
                  {searchDistricts.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <button className="primary-button" type="button" onClick={() => void applyRegionSearch()}>
                <MapPinned size={18} />
                標示區域行情
              </button>
            </div>
          )}
          <p className="map-locator-status">{locatorStatus}</p>
        </div>
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
