import { taiwanPlaceCandidates } from "../data/taiwanPlaces";
import type { LocationCandidate } from "../types";
import { getAddressSearchVariants, normalizeAddressText } from "../utils/addressNormalize";

const CACHE_KEY = "taiwan-valuation-geocode-cache-v1";
const LAST_REQUEST_KEY = "taiwan-valuation-geocode-last-request";
const MIN_REQUEST_GAP_MS = 1100;

type CacheMap = Record<string, LocationCandidate[]>;

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

const localCandidates = (query: string) => {
  const queryVariants = getAddressSearchVariants(query);
  if (!queryVariants.length) return [];
  return taiwanPlaceCandidates.filter((candidate) => {
    const haystack = normalizeAddressText(
      `${candidate.label}${candidate.city ?? ""}${candidate.district ?? ""}${candidate.road ?? ""}`,
    );
    const road = normalizeAddressText(candidate.road ?? "");
    return queryVariants.some((normalizedQuery) => {
      return haystack.includes(normalizedQuery) || normalizedQuery.includes(road);
    });
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
  if (local.length > 0 || trimmed.length < 5) {
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

    const results = [...local, ...remote].slice(0, 6);
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
