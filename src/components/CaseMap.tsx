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
      <span class="capybara-shadow"></span>
      <span class="capybara-body"></span>
      <span class="capybara-head"></span>
      <span class="capybara-ear left"></span>
      <span class="capybara-ear right"></span>
      <span class="capybara-eye"></span>
      <span class="capybara-nose"></span>
      <span class="capybara-mouth"></span>
      <span class="capybara-belly"></span>
      <span class="capybara-leg front"></span>
      <span class="capybara-leg back"></span>
      <span class="capybara-grab-ring"></span>
      <span class="capybara-motion motion-a"></span>
      <span class="capybara-motion motion-b"></span>
      <span class="capybara-pin"></span>
    </div>
  `,
  iconSize: [78, 76],
  iconAnchor: [39, 72],
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
