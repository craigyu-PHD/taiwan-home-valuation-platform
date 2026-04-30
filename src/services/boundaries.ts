import type { LatLngTuple } from "../data/districtPolygons";

export interface BoundaryFeature {
  type: "Feature";
  properties: {
    city: string;
    district: string;
    code: string;
  };
  geometry: GeoJsonGeometry;
}

export type GeoJsonGeometry =
  | {
      type: "Polygon";
      coordinates: number[][][];
    }
  | {
      type: "MultiPolygon";
      coordinates: number[][][][];
    };

interface BoundaryCollection {
  type: "FeatureCollection";
  source: string;
  generatedAt: string;
  features: BoundaryFeature[];
}

let boundaryCache: Promise<BoundaryCollection> | undefined;

export const loadTownBoundaries = () => {
  const boundaryUrl = `${import.meta.env.BASE_URL}data/taiwan-town-boundaries.json`;
  boundaryCache ??= fetch(boundaryUrl).then((response) => {
    if (!response.ok) throw new Error(`Boundary load failed: ${response.status}`);
    return response.json() as Promise<BoundaryCollection>;
  });
  return boundaryCache;
};

export const getTownBoundary = async (city?: string, district?: string) => {
  if (!city || !district) return undefined;
  const boundaries = await loadTownBoundaries();
  return boundaries.features.find(
    (feature) => feature.properties.city === city && feature.properties.district === district,
  );
};

const pointInRing = (lat: number, lng: number, ring: number[][]) => {
  let inside = false;
  for (let index = 0, prev = ring.length - 1; index < ring.length; prev = index++) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[prev];
    const crosses = y1 > lat !== y2 > lat;
    if (!crosses) continue;
    const intersectionLng = ((x2 - x1) * (lat - y1)) / (y2 - y1 || Number.EPSILON) + x1;
    if (lng < intersectionLng) inside = !inside;
  }
  return inside;
};

const pointInPolygon = (lat: number, lng: number, polygon: number[][][]) => {
  const [outerRing, ...holes] = polygon;
  if (!outerRing || !pointInRing(lat, lng, outerRing)) return false;
  return !holes.some((ring) => pointInRing(lat, lng, ring));
};

const geometryContainsPoint = (geometry: GeoJsonGeometry, lat: number, lng: number) => {
  if (geometry.type === "Polygon") return pointInPolygon(lat, lng, geometry.coordinates);
  return geometry.coordinates.some((polygon) => pointInPolygon(lat, lng, polygon));
};

export const findTownByPoint = async (lat: number, lng: number) => {
  const boundaries = await loadTownBoundaries();
  return boundaries.features.find((feature) => geometryContainsPoint(feature.geometry, lat, lng));
};

const eachCoordinate = (geometry: GeoJsonGeometry, visit: (lat: number, lng: number) => void) => {
  if (geometry.type === "Polygon") {
    geometry.coordinates.forEach((ring) => ring.forEach(([lng, lat]) => visit(lat, lng)));
    return;
  }
  geometry.coordinates.forEach((polygon) =>
    polygon.forEach((ring) => ring.forEach(([lng, lat]) => visit(lat, lng))),
  );
};

export const getBoundaryCenter = (geometry?: GeoJsonGeometry): LatLngTuple | undefined => {
  if (!geometry) return undefined;
  let count = 0;
  let latSum = 0;
  let lngSum = 0;
  eachCoordinate(geometry, (lat, lng) => {
    count += 1;
    latSum += lat;
    lngSum += lng;
  });
  return count ? [latSum / count, lngSum / count] : undefined;
};
