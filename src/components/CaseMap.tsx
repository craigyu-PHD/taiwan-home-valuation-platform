import L from "leaflet";
import type { GeoJsonObject } from "geojson";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Marker,
  Polygon,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { LatLngTuple } from "../data/districtPolygons";
import type { GeoJsonGeometry } from "../services/boundaries";
import type { RentalReferenceCase, TransactionCase } from "../types";
import { formatDistance, formatRentPerPing, formatTwd, formatUnitWan, formatWan } from "../utils/format";

const createCapybaraIcon = (isDragging: boolean, isLanding: boolean) => L.divIcon({
  className: `capybara-marker-icon ${isDragging ? "is-dragging" : ""} ${isLanding ? "is-landing" : ""}`,
  html: `
    <div class="capybara-marker" aria-hidden="true">
      <svg class="capybara-svg" viewBox="0 0 112 128" role="img" aria-label="可拖曳水豚定位圖標">
        <defs>
          <radialGradient id="capyBody" cx="36%" cy="28%" r="78%">
            <stop stop-color="#F7D49B"/>
            <stop offset="0.46" stop-color="#C78952"/>
            <stop offset="0.78" stop-color="#8D5934"/>
            <stop offset="1" stop-color="#54301F"/>
          </radialGradient>
          <radialGradient id="capyMuzzle" cx="42%" cy="36%" r="78%">
            <stop stop-color="#FFE8BE"/>
            <stop offset="0.64" stop-color="#D99B61"/>
            <stop offset="1" stop-color="#9A623A"/>
          </radialGradient>
          <linearGradient id="capyPin" x1="56" y1="78" x2="56" y2="124" gradientUnits="userSpaceOnUse">
            <stop stop-color="#0EA5E9"/>
            <stop offset="0.5" stop-color="#0D9488"/>
            <stop offset="1" stop-color="#F97316"/>
          </linearGradient>
          <linearGradient id="capyWater" x1="20" y1="102" x2="92" y2="112" gradientUnits="userSpaceOnUse">
            <stop stop-color="#38BDF8" stop-opacity="0.1"/>
            <stop offset="0.45" stop-color="#14B8A6" stop-opacity="0.46"/>
            <stop offset="1" stop-color="#2563EB" stop-opacity="0.16"/>
          </linearGradient>
          <filter id="capyShadow" x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="10" stdDeviation="7" flood-color="#182739" flood-opacity="0.24"/>
          </filter>
          <filter id="capyWaterBlur" x="-20%" y="-60%" width="140%" height="220%">
            <feGaussianBlur stdDeviation="1.4"/>
          </filter>
        </defs>
        <g class="capy-water-ripples">
          <ellipse class="capy-water-ripple ripple-wide" cx="56" cy="109" rx="42" ry="11" filter="url(#capyWaterBlur)"/>
          <ellipse class="capy-water-ripple ripple-mid" cx="56" cy="106" rx="30" ry="8"/>
          <ellipse class="capy-water-ripple ripple-core" cx="56" cy="103" rx="18" ry="5"/>
          <path class="capy-water-shine" d="M25 105 C36 99 77 98 89 105"/>
        </g>
        <path class="capy-pin-glow" d="M56 124 C48 109 41 99 41 88 C41 77 48 71 56 71 C64 71 71 77 71 88 C71 99 64 109 56 124Z"/>
        <path class="capy-pin" d="M56 123 C48 108 42 98 42 88 C42 78 49 72 56 72 C63 72 70 78 70 88 C70 98 64 108 56 123Z"/>
        <g class="capy-animal capy-cute" filter="url(#capyShadow)">
          <circle class="capy-ear-svg ear-left" cx="34" cy="29" r="10.5"/>
          <circle class="capy-ear-svg ear-right" cx="78" cy="30" r="10.5"/>
          <ellipse class="capy-body-svg" cx="56" cy="58" rx="38" ry="36"/>
          <path class="capy-head-highlight" d="M29 43 C38 24 73 23 83 45 C74 38 43 36 29 43Z"/>
          <path class="capy-cheek-svg" d="M27 59 C31 78 43 91 56 91 C70 91 82 78 85 59 C79 71 68 78 56 78 C43 78 33 71 27 59Z"/>
          <ellipse class="capy-muzzle-svg" cx="56" cy="64" rx="24" ry="16"/>
          <ellipse class="capy-snout-highlight" cx="48" cy="60" rx="12" ry="7"/>
          <ellipse class="capy-nose-svg" cx="56" cy="57" rx="12" ry="8"/>
          <circle class="capy-nostril" cx="51" cy="56" r="2.1"/>
          <circle class="capy-nostril" cx="61" cy="56" r="2.1"/>
          <circle class="capy-eye-svg eye-left" cx="41" cy="47" r="6.1"/>
          <circle class="capy-eye-svg eye-right" cx="71" cy="47" r="6.1"/>
          <circle class="capy-eye-glint" cx="39" cy="44.8" r="1.8"/>
          <circle class="capy-eye-glint" cx="69" cy="44.8" r="1.8"/>
          <path class="capy-brow-svg" d="M34 40 C38 37 43 37 47 40 M65 40 C70 37 75 38 78 42"/>
          <path class="capy-mouth-svg" d="M46 69 C50 73 62 73 66 69"/>
          <path class="capy-fur-svg" d="M38 31 C47 27 65 27 75 33 M31 45 C38 40 47 38 54 39 M58 39 C68 38 76 42 82 48 M35 57 C40 54 46 53 51 54 M62 54 C69 53 75 55 80 59"/>
          <path class="capy-paw-svg paw-left" d="M35 81 C39 85 46 85 50 81"/>
          <path class="capy-paw-svg paw-right" d="M62 81 C67 85 74 84 78 80"/>
        </g>
        <path class="capy-motion motion-a" d="M15 38 C7 46 7 58 14 66"/>
        <path class="capy-motion motion-b" d="M98 38 C105 47 105 58 98 67"/>
        <circle class="capy-water-spark spark-a" cx="24" cy="97" r="2"/>
        <circle class="capy-water-spark spark-b" cx="91" cy="98" r="1.8"/>
      </svg>
    </div>
  `,
  iconSize: [96, 112],
  iconAnchor: [48, 108],
});

const Recenter = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  map.setView(center, map.getZoom(), { animate: true });
  return null;
};

const FitHighlight = ({
  polygon,
  geometry,
}: {
  polygon?: LatLngTuple[];
  geometry?: GeoJsonGeometry;
}) => {
  const map = useMap();
  useEffect(() => {
    const bounds = geometry
      ? L.geoJSON(geometry as GeoJsonObject).getBounds()
      : polygon?.length
        ? L.latLngBounds(polygon)
        : undefined;
    if (!bounds?.isValid()) return;
    map.fitBounds(bounds, {
      animate: true,
      padding: [34, 34],
      maxZoom: 15,
    });
  }, [map, polygon, geometry]);
  return null;
};

const ClickHandler = ({ onPick }: { onPick?: (lat: number, lng: number) => void }) => {
  useMapEvents({
    click: (event) => onPick?.(event.latlng.lat, event.latlng.lng),
  });
  return null;
};

interface CaseMapProps {
  center: [number, number];
  cases: Array<(TransactionCase & { distanceMeters?: number }) | RentalReferenceCase>;
  onPick?: (lat: number, lng: number) => void;
  highlightPolygon?: LatLngTuple[];
  highlightGeometry?: GeoJsonGeometry;
  highlightLabel?: string;
  className?: string;
}

export const CaseMap = ({
  center,
  cases,
  onPick,
  highlightPolygon,
  highlightGeometry,
  highlightLabel,
  className,
}: CaseMapProps) => {
  const caseMarkers = useMemo(() => cases.slice(0, 80), [cases]);
  const [capybaraDragging, setCapybaraDragging] = useState(false);
  const [capybaraLanding, setCapybaraLanding] = useState(false);
  const landingTimer = useRef<number | undefined>(undefined);
  const selectedIcon = useMemo(
    () => createCapybaraIcon(capybaraDragging, capybaraLanding),
    [capybaraDragging, capybaraLanding],
  );

  useEffect(() => {
    return () => {
      if (landingTimer.current) window.clearTimeout(landingTimer.current);
    };
  }, []);

  return (
    <div className={`map-frame ${className ?? ""}`}>
      {onPick && <div className="map-interaction-hint">拖曳小水豚到目標位置，或點選地圖即時校正估價區塊</div>}
      <MapContainer center={center} zoom={15} scrollWheelZoom className="leaflet-map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Recenter center={center} />
        <FitHighlight polygon={highlightPolygon} geometry={highlightGeometry} />
        <ClickHandler onPick={onPick} />
        {highlightGeometry && (
          <GeoJSON
            key={`${highlightLabel ?? "boundary"}-${JSON.stringify(center)}`}
            data={highlightGeometry as GeoJsonObject}
            style={{
              color: "#db2777",
              fillColor: "#f97316",
              fillOpacity: 0.16,
              weight: 2,
              dashArray: "4 3",
              className: "district-flow",
            }}
          >
            {highlightLabel && (
              <Tooltip permanent direction="center" className="district-tooltip">
                {highlightLabel}
              </Tooltip>
            )}
          </GeoJSON>
        )}
        {!highlightGeometry && highlightPolygon && (
          <Polygon
            positions={highlightPolygon}
            pathOptions={{
              color: "#db2777",
              fillColor: "#f97316",
              fillOpacity: 0.16,
              weight: 2,
              dashArray: "4 3",
              className: "district-flow",
            }}
          >
            {highlightLabel && (
              <Tooltip permanent direction="center" className="district-tooltip">
                {highlightLabel}
              </Tooltip>
            )}
          </Polygon>
        )}
        <Marker
          position={center}
          icon={selectedIcon}
          draggable={Boolean(onPick)}
          eventHandlers={{
            dragstart: () => {
              if (landingTimer.current) window.clearTimeout(landingTimer.current);
              setCapybaraLanding(false);
              setCapybaraDragging(true);
            },
            dragend: (event) => {
              setCapybaraDragging(false);
              setCapybaraLanding(true);
              landingTimer.current = window.setTimeout(() => setCapybaraLanding(false), 720);
              const marker = event.target as L.Marker;
              const latLng = marker.getLatLng();
              onPick?.(latLng.lat, latLng.lng);
            },
          }}
        >
          <Popup>估價位置</Popup>
        </Marker>
        {caseMarkers.map((item) => (
          <CircleMarker
            key={item.id}
            center={[item.lat, item.lng]}
            radius={8}
            pathOptions={{
              color: "#0f766e",
              fillColor: "#14b8a6",
              fillOpacity: 0.72,
              weight: 2,
            }}
          >
            <Popup>
              <div className="map-popup">
                <strong>{item.communityName ?? item.road}</strong>
                <span>{item.propertyType}</span>
                {"rentPerPingTwd" in item ? (
                  <>
                    <span>{formatRentPerPing(item.rentPerPingTwd)}</span>
                    <span>{formatTwd(item.estimatedMonthlyRentTwd)}</span>
                  </>
                ) : (
                  <>
                    <span>{formatUnitWan(item.unitPriceWan)}</span>
                    <span>{formatWan(item.totalPriceWan)}</span>
                  </>
                )}
                {item.distanceMeters !== undefined && <small>{formatDistance(item.distanceMeters)}</small>}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
};
