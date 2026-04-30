import { Crosshair, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AddressSearch } from "../components/AddressSearch";
import { CaseMap } from "../components/CaseMap";
import { LandUseBadge } from "../components/LandUseBadge";
import { ModeSwitch } from "../components/ModeSwitch";
import { RentalReferenceList } from "../components/RentalReferenceList";
import { RentalSummary } from "../components/RentalSummary";
import { ResultSummary } from "../components/ResultSummary";
import { TransactionList } from "../components/TransactionList";
import { useEstimate } from "../context/EstimateContext";
import { demoTransactions } from "../data/demoTransactions";
import {
  findTownByPoint,
  getTownBoundary,
  type BoundaryFeature,
} from "../services/boundaries";
import { reverseGeocodePoint } from "../services/geocode";
import { estimateRental, getNearbyRentalReferences } from "../services/rental";
import { estimateProperty, getNearbyTransactions } from "../services/valuation";
import type { LocationCandidate } from "../types";

export const MapEstimatePage = () => {
  const { propertyInput, setSelectedLocation, runValuation, valuation, rentalValuation, transactionMode } = useEstimate();
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [boundary, setBoundary] = useState<BoundaryFeature | undefined>();
  const [locatorStatus, setLocatorStatus] = useState("搜尋地址，或直接拖曳地圖上的小水豚到目標位置。");

  const center: [number, number] = [propertyInput.lat ?? 23.8, propertyInput.lng ?? 121.0];
  useEffect(() => {
    getTownBoundary(propertyInput.city, propertyInput.district).then(setBoundary).catch(() => setBoundary(undefined));
  }, [propertyInput.city, propertyInput.district]);
  const nearby = useMemo(() => {
    return transactionMode === "sale"
      ? getNearbyTransactions(center[0], center[1], 3500)
      : getNearbyRentalReferences(center[0], center[1], 3500, propertyInput);
  }, [center, propertyInput, transactionMode]);

  const preview = valuation ?? estimateProperty(propertyInput, demoTransactions);
  const rentPreview = rentalValuation ?? estimateRental(propertyInput, demoTransactions);

  const applyValuationForCandidate = (candidate: LocationCandidate) => {
    setSelectedLocation(candidate);
    runValuation({
      address: candidate.label,
      city: candidate.city,
      district: candidate.district,
      road: candidate.road,
      lat: candidate.lat,
      lng: candidate.lng,
      locationConfidence: candidate.confidence,
    });
  };

  const applyCandidate = async (candidate: LocationCandidate) => {
    const town = candidate.city && candidate.district ? undefined : await findTownByPoint(candidate.lat, candidate.lng);
    const enriched: LocationCandidate = {
      ...candidate,
      city: candidate.city ?? town?.properties.city ?? propertyInput.city,
      district: candidate.district ?? town?.properties.district ?? propertyInput.district,
      confidence: town ? Math.max(candidate.confidence, 0.82) : candidate.confidence,
    };
    applyValuationForCandidate(enriched);
    setLocatorStatus(
      enriched.city && enriched.district
        ? `已定位到 ${enriched.city}${enriched.district}，可直接查看即時估價。`
        : "已更新地圖座標，但行政區無法由邊界判定；系統會以目前條件做低信心估價。",
    );
  };

  const pickMapPoint = async (lat: number, lng: number) => {
    const town = await findTownByPoint(lat, lng).catch(() => undefined);
    const reverse = await reverseGeocodePoint(lat, lng).catch(() => undefined);
    const city = town?.properties.city ?? reverse?.city ?? propertyInput.city;
    const district = town?.properties.district ?? reverse?.district ?? propertyInput.district;
    const road = reverse?.road ?? propertyInput.road;
    const label = reverse?.label ?? (city && district ? `${city}${district} 地圖選點` : `地圖選點 ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    const candidate: LocationCandidate = {
      id: `manual-${lat}-${lng}`,
      label,
      city,
      district,
      road,
      lat,
      lng,
      confidence: reverse ? 0.88 : town ? 0.82 : 0.6,
      source: "manual",
    };
    applyValuationForCandidate(candidate);
    if (town) {
      setBoundary(town);
      setLocatorStatus(
        reverse?.label
          ? `已辨識地址：${reverse.label}`
          : `已鎖定 ${town.properties.city}${town.properties.district}，即時估價已更新。`,
      );
    } else {
      setLocatorStatus("已更新座標；無法命中行政區邊界，系統會保留目前條件並降低信心。");
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocatorStatus("此瀏覽器不支援目前位置；請拖曳小水豚或點選地圖。");
      return;
    }
    setLocatorStatus("正在取得目前位置...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void pickMapPoint(position.coords.latitude, position.coords.longitude);
      },
      () => {
        setLocatorStatus("無法取得目前位置，可能是瀏覽器尚未授權；仍可拖曳小水豚或點選地圖估價。");
      },
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 10000 },
    );
  };

  return (
    <div className="map-page">
      <section className="map-search-bar">
        <div className="map-search-card">
          <ModeSwitch compact />
          <AddressSearch compact buttonLabel="搜尋位置" onSelect={(candidate) => void applyCandidate(candidate)} />
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
            {transactionMode === "sale" ? "即時估價結果" : "即時租金結果"}
          </button>
          <div className="map-result-context">
            <span>目前定位</span>
            <strong>{propertyInput.address}</strong>
            <small>{locatorStatus}</small>
          </div>
          <LandUseBadge lat={propertyInput.lat} lng={propertyInput.lng} compact />
          {transactionMode === "sale" ? (
            <>
              <ResultSummary result={preview} compact />
              <TransactionList cases={preview.casesUsed.slice(0, 5)} />
            </>
          ) : (
            <>
              <RentalSummary result={rentPreview} compact />
              <RentalReferenceList cases={rentPreview.referencesUsed.slice(0, 5)} />
            </>
          )}
        </aside>
      </section>
    </div>
  );
};
