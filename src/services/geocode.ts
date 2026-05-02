import { taiwanPlaceCandidates } from "../data/taiwanPlaces";
import type { LocationCandidate } from "../types";
import { getAddressSearchVariants, normalizeAddressText } from "../utils/addressNormalize";

const CACHE_KEY = "taiwan-valuation-geocode-cache-v2";
const REVERSE_CACHE_KEY = "taiwan-valuation-reverse-geocode-cache-v1";
const LAST_REQUEST_KEY = "taiwan-valuation-geocode-last-request";
const MIN_REQUEST_GAP_MS = 1100;

type CacheMap = Record<string, LocationCandidate[]>;
type ReverseCacheMap = Record<string, LocationCandidate>;

const loadCache = (): CacheMap => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as CacheMap;
  } catch {
    return {};
  }
};

const saveCache = (cache: CacheMap) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Caching is best-effort in private browsing or restricted storage modes.
  }
};

const loadReverseCache = (): ReverseCacheMap => {
  try {
    return JSON.parse(localStorage.getItem(REVERSE_CACHE_KEY) ?? "{}") as ReverseCacheMap;
  } catch {
    return {};
  }
};

const saveReverseCache = (cache: ReverseCacheMap) => {
  try {
    localStorage.setItem(REVERSE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Caching is best-effort in private browsing or restricted storage modes.
  }
};

const localCandidates = (query: string) => {
  const queryVariants = getAddressSearchVariants(query);
  if (!queryVariants.length) return [];
  const isGuoduQuery = queryVariants.some(
    (variant) => /國[都度]花園/.test(variant),
  );
  const directMatches = isGuoduQuery
    ? taiwanPlaceCandidates.filter((candidate) => candidate.id === "local-taoyuan-guodu")
    : [];
  return taiwanPlaceCandidates.filter((candidate) => {
    const haystack = normalizeAddressText(
      `${candidate.label}${candidate.city ?? ""}${candidate.district ?? ""}${candidate.road ?? ""}`,
    );
    const city = normalizeAddressText(candidate.city ?? "");
    const district = normalizeAddressText(candidate.district ?? "");
    const road = normalizeAddressText(candidate.road ?? "");
    return queryVariants.some((normalizedQuery) => {
      if (normalizedQuery.length < 4) return false;
      const exactKnownPlace = haystack.includes(normalizedQuery) || normalizedQuery.includes(haystack);
      const sameAdmin =
        city.length > 0 &&
        district.length > 0 &&
        normalizedQuery.includes(city) &&
        normalizedQuery.includes(district);
      const roadMatch = sameAdmin && road.length >= 4 && normalizedQuery.includes(road);
      return exactKnownPlace || roadMatch;
    });
  }).reduce<LocationCandidate[]>((items, candidate) => (
    items.some((item) => item.id === candidate.id) ? items : [...items, candidate]
  ), directMatches);
};

const hasStrongLocalMatch = (query: string, local: LocationCandidate[]) => {
  const normalizedQuery = normalizeAddressText(query);
  return local.some((candidate) => {
    const normalizedLabel = normalizeAddressText(candidate.label);
    const normalizedRoad = normalizeAddressText(candidate.road ?? "");
    return (
      normalizedLabel.includes(normalizedQuery) ||
      normalizedQuery.includes(normalizedLabel) ||
      (/國[都度]花園/.test(normalizedQuery) && /國都花園/.test(normalizedLabel)) ||
      (normalizedRoad.length >= 4 && normalizedQuery.includes(normalizedRoad) && normalizedQuery.length <= normalizedRoad.length + 4)
    );
  });
};

const waitForRateLimit = async () => {
  const now = Date.now();
  const last = Number(localStorage.getItem(LAST_REQUEST_KEY) ?? "0");
  const gap = now - last;
  if (gap < MIN_REQUEST_GAP_MS) {
    await new Promise((resolve) => window.setTimeout(resolve, MIN_REQUEST_GAP_MS - gap));
  }
  localStorage.setItem(LAST_REQUEST_KEY, String(Date.now()));
};

export const searchAddress = async (query: string): Promise<LocationCandidate[]> => {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const cache = loadCache();
  const cacheKey = normalizeAddressText(trimmed);
  if (cache[cacheKey]) return cache[cacheKey];

  const local = localCandidates(trimmed);
  if (trimmed.length < 5 || (local.length > 0 && hasStrongLocalMatch(trimmed, local))) {
    cache[cacheKey] = local;
    saveCache(cache);
    return local;
  }

  await waitForRateLimit();
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", fullWidthSafeQuery(trimmed));
  url.searchParams.set("countrycodes", "tw");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "5");
  url.searchParams.set("accept-language", "zh-TW");

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Nominatim responded ${response.status}`);
    const payload = (await response.json()) as Array<{
      place_id: number;
      display_name: string;
      lat: string;
      lon: string;
      importance?: number;
      address?: {
        city?: string;
        county?: string;
        town?: string;
        suburb?: string;
        road?: string;
      };
    }>;

    const remote: LocationCandidate[] = payload.map((item) => ({
      id: `nominatim-${item.place_id}`,
      label: item.display_name,
      city: item.address?.city ?? item.address?.county,
      district: item.address?.town ?? item.address?.suburb,
      road: item.address?.road,
      lat: Number(item.lat),
      lng: Number(item.lon),
      confidence: Math.min(0.95, Math.max(0.5, item.importance ?? 0.6)),
      source: "nominatim",
    }));

    const hasStrongLocal = local.length > 0 && hasStrongLocalMatch(trimmed, local);
    const results = (hasStrongLocal ? [...local, ...remote] : [...remote, ...local]).slice(0, 6);
    cache[cacheKey] = results;
    saveCache(cache);
    return results;
  } catch {
    cache[cacheKey] = local;
    saveCache(cache);
    return local;
  }
};

const fullWidthSafeQuery = (value: string) => value.normalize("NFKC").replace(/臺/g, "台").trim();

export const reverseGeocodePoint = async (lat: number, lng: number): Promise<LocationCandidate | undefined> => {
  const cache = loadReverseCache();
  const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  if (cache[cacheKey]) return cache[cacheKey];

  await waitForRateLimit();
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("zoom", "18");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "zh-TW");

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Nominatim reverse responded ${response.status}`);
    const payload = (await response.json()) as {
      place_id?: number;
      display_name?: string;
      lat?: string;
      lon?: string;
      address?: {
        city?: string;
        county?: string;
        town?: string;
        suburb?: string;
        city_district?: string;
        road?: string;
        neighbourhood?: string;
        house_number?: string;
      };
    };
    if (!payload.display_name) return undefined;

    const address = payload.address;
    const roadLabel = [address?.road, address?.house_number].filter(Boolean).join("");
    const candidate: LocationCandidate = {
      id: `reverse-${payload.place_id ?? cacheKey}`,
      label: payload.display_name,
      city: address?.city ?? address?.county,
      district: address?.town ?? address?.city_district ?? address?.suburb,
      road: roadLabel || address?.road || address?.neighbourhood,
      lat: Number(payload.lat ?? lat),
      lng: Number(payload.lon ?? lng),
      confidence: roadLabel ? 0.9 : 0.78,
      source: "nominatim",
    };
    cache[cacheKey] = candidate;
    saveReverseCache(cache);
    return candidate;
  } catch {
    return undefined;
  }
};
