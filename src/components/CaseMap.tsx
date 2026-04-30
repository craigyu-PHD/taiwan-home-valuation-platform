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
          <linearGradient id="capyBody" x1="25" y1="18" x2="78" y2="86" gradientUnits="userSpaceOnUse">
            <stop stop-color="#F0C284"/>
            <stop offset="0.52" stop-color="#B97845"/>
            <stop offset="1" stop-color="#744327"/>
          </linearGradient>
          <linearGradient id="capyMuzzle" x1="31" y1="48" x2="73" y2="75" gradientUnits="userSpaceOnUse">
            <stop stop-color="#FFE0B0"/>
            <stop offset="1" stop-color="#D49358"/>
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
        <ellipse class="capy-ground" cx="52" cy="106" rx="29" ry="6"/>
        <path class="capy-pin" d="M52 116 C45 103 38 95 38 85 C38 75 44 70 52 70 C60 70 66 75 66 85 C66 95 59 103 52 116Z"/>
        <g class="capy-animal capy-cute" filter="url(#capyShadow)">
          <circle class="capy-ear-svg ear-left" cx="31" cy="27" r="10"/>
          <circle class="capy-ear-svg ear-right" cx="73" cy="27" r="10"/>
          <ellipse class="capy-body-svg" cx="52" cy="55" rx="35" ry="34"/>
          <path class="capy-cheek-svg" d="M25 55 C27 75 38 88 52 88 C66 88 77 75 79 55 C75 66 66 73 52 73 C38 73 29 66 25 55Z"/>
          <ellipse class="capy-muzzle-svg" cx="52" cy="61" rx="23" ry="16"/>
          <ellipse class="capy-nose-svg" cx="52" cy="55" rx="12" ry="8"/>
          <circle class="capy-nostril" cx="47" cy="54" r="2"/>
          <circle class="capy-nostril" cx="57" cy="54" r="2"/>
          <circle class="capy-eye-svg eye-left" cx="38" cy="45" r="6"/>
          <circle class="capy-eye-svg eye-right" cx="66" cy="45" r="6"/>
          <circle class="capy-eye-glint" cx="36" cy="43" r="1.8"/>
          <circle class="capy-eye-glint" cx="64" cy="43" r="1.8"/>
          <path class="capy-mouth-svg" d="M43 66 C47 70 57 70 61 66"/>
          <path class="capy-fur-svg" d="M35 32 C42 28 60 28 69 33 M30 43 C36 38 43 36 49 36 M55 36 C63 36 70 39 75 44"/>
          <path class="capy-paw-svg paw-left" d="M33 78 C37 82 43 83 47 79"/>
          <path class="capy-paw-svg paw-right" d="M57 79 C62 83 68 82 72 78"/>
        </g>
        <path class="capy-motion motion-a" d="M15 38 C7 45 7 57 14 64"/>
        <path class="capy-motion motion-b" d="M89 38 C97 45 97 57 90 64"/>
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
