import L from "leaflet";
import type { GeoJsonObject } from "geojson";
import { useEffect, useMemo } from "react";
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
import type { TransactionCase } from "../types";
import { formatDistance, formatUnitWan, formatWan } from "../utils/format";

const selectedIcon = L.divIcon({
  className: "selected-location-marker",
  html: "<span><i></i></span>",
  iconSize: [34, 42],
  iconAnchor: [17, 40],
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
  cases: Array<TransactionCase & { distanceMeters?: number }>;
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

  return (
    <div className={`map-frame ${className ?? ""}`}>
      {onPick && <div className="map-interaction-hint">拖曳紅色定位點，或點選地圖校正位置</div>}
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
              color: "#f97316",
              fillColor: "#2563eb",
              fillOpacity: 0.18,
              weight: 4,
              className: "district-glow",
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
              color: "#f59e0b",
              fillColor: "#fde68a",
              fillOpacity: 0.22,
              weight: 3,
              className: "district-glow",
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
            dragend: (event) => {
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
                <span>{formatUnitWan(item.unitPriceWan)}</span>
                <span>{formatWan(item.totalPriceWan)}</span>
                {item.distanceMeters !== undefined && <small>{formatDistance(item.distanceMeters)}</small>}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
};
