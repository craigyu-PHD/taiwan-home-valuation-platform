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
      <svg class="capybara-svg" viewBox="0 0 104 118" role="img" aria-label="可拖曳水豚定位圖標">
        <defs>
          <linearGradient id="capyBody" x1="18" y1="14" x2="84" y2="88" gradientUnits="userSpaceOnUse">
            <stop stop-color="#E7B678"/>
            <stop offset="0.46" stop-color="#B97845"/>
            <stop offset="1" stop-color="#76472B"/>
          </linearGradient>
          <linearGradient id="capyBelly" x1="26" y1="44" x2="70" y2="82" gradientUnits="userSpaceOnUse">
            <stop stop-color="#FFE2B8"/>
            <stop offset="1" stop-color="#C98750"/>
          </linearGradient>
          <linearGradient id="capyPin" x1="52" y1="80" x2="52" y2="116" gradientUnits="userSpaceOnUse">
            <stop stop-color="#1F6FEB"/>
            <stop offset="0.48" stop-color="#12B3A8"/>
            <stop offset="1" stop-color="#F59E0B"/>
          </linearGradient>
          <filter id="capyShadow" x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="10" stdDeviation="7" flood-color="#182739" flood-opacity="0.24"/>
          </filter>
        </defs>
        <ellipse class="capy-ground" cx="52" cy="106" rx="28" ry="6"/>
        <path class="capy-pin" d="M52 116 C45 103 38 95 38 85 C38 75 44 70 52 70 C60 70 66 75 66 85 C66 95 59 103 52 116Z"/>
        <g class="capy-animal" filter="url(#capyShadow)">
          <ellipse class="capy-body-svg" cx="58" cy="58" rx="31" ry="22"/>
          <ellipse class="capy-belly-svg" cx="48" cy="63" rx="18" ry="14"/>
          <path class="capy-fur-svg" d="M42 43 C50 49 66 47 78 57 M37 55 C49 61 63 61 78 68 M43 72 C53 77 65 76 75 73"/>
          <ellipse class="capy-head-svg" cx="32" cy="45" rx="22" ry="27"/>
          <circle class="capy-ear-svg ear-left" cx="22" cy="24" r="8"/>
          <circle class="capy-ear-svg ear-right" cx="43" cy="24" r="8"/>
          <ellipse class="capy-muzzle-svg" cx="23" cy="50" rx="13" ry="15"/>
          <ellipse class="capy-nose-svg" cx="17" cy="47" rx="6" ry="5"/>
          <circle class="capy-eye-svg" cx="40" cy="39" r="5.8"/>
          <circle class="capy-eye-glint" cx="38" cy="37" r="1.8"/>
          <path class="capy-mouth-svg" d="M25 58 C31 63 38 61 42 57"/>
          <path class="capy-leg-svg leg-a" d="M49 76 C48 84 45 89 40 90"/>
          <path class="capy-leg-svg leg-b" d="M70 75 C70 84 67 90 62 91"/>
          <path class="capy-arm-svg" d="M34 60 C28 66 24 71 20 78"/>
          <path class="capy-arm-svg arm-b" d="M45 62 C43 70 41 75 37 82"/>
        </g>
        <path class="capy-motion motion-a" d="M13 33 C4 39 3 51 10 59"/>
        <path class="capy-motion motion-b" d="M90 41 C99 48 99 61 91 69"/>
      </svg>
    </div>
  `,
  iconSize: [92, 104],
  iconAnchor: [46, 100],
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
