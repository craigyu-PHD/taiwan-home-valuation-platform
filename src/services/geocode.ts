import { taiwanAdmin, taiwanCities } from "../data/taiwanAdmin";
import { taiwanPlaceCandidates } from "../data/taiwanPlaces";
import { getBoundaryCenter, getTownBoundary } from "./boundaries";
import type { LocationCandidate } from "../types";
import { getAddressSearchVariants, normalizeAddressText } from "../utils/addressNormalize";

const CACHE_KEY = "taiwan-valuation-geocode-cache-v4";
const REVERSE_CACHE_KEY = "taiwan-valuation-reverse-geocode-cache-v1";
const LAST_REQUEST_KEY = "taiwan-valuation-geocode-last-request";
const MIN_REQUEST_GAP_MS = 1100;

type CacheMap = Record<string, LocationCandidate[]>;
type ReverseCacheMap = Record<string, LocationCandidate>;
type ParsedTaiwanQuery = {
  cleaned: string;
  city?: string;
  district?: string;
  road?: string;
  houseNumber?: string;
  community?: string;
};

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

const fullWidthSafeQuery = (value: string) => value.normalize("NFKC").replace(/臺/g, "台").trim();

const normalizeCityForCompare = (value: string) => normalizeAddressText(value).replace(/臺/g, "台");

const findCity = (normalizedQuery: string) =>
  taiwanCities.find((city) => normalizedQuery.includes(normalizeCityForCompare(city)));

const findDistrict = (normalizedQuery: string, city?: string) => {
  const cityList = city ? [city as keyof typeof taiwanAdmin] : taiwanCities;
  for (const cityName of cityList) {
    const district = taiwanAdmin[cityName].find((item) => normalizedQuery.includes(normalizeCityForCompare(item)));
    if (district) return { city: cityName as string, district };
  }
  return {};
};

const extractTaiwanQueryParts = (query: string): ParsedTaiwanQuery => {
  const cleaned = fullWidthSafeQuery(query)
    .replace(/[,，、]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\d{3,5}\b/g, "")
    .replace(/台灣|臺灣|taiwan/gi, "")
    .trim();
  const normalized = normalizeAddressText(cleaned);
  const city = findCity(normalized);
  const districtMatch = findDistrict(normalized, city);
  const road = cleaned.match(/([\u4e00-\u9fa5A-Za-z0-9]+(?:大道|路|街|巷|弄)(?:[一二三四五六七八九十0-9]+段)?)/)?.[1];
  const houseNumber = cleaned.match(/([0-9]+(?:[-之][0-9]+)?|[一二三四五六七八九十百]+)\s*號/)?.[1];
  const community = cleaned.match(/([\u4e00-\u9fa5A-Za-z0-9A-Za-z]{2,}(?:社區|花園|大廈|名邸|新城|山莊|公寓|華廈|苑|園))/)?.[1];
  return {
    cleaned,
    city: city ?? districtMatch.city,
    district: districtMatch.district,
    road,
    houseNumber,
    community,
  };
};

const getFuzzyQueries = (query: string, parsed = extractTaiwanQueryParts(query)) => {
  const structuredAddress = [
    parsed.city,
    parsed.district,
    parsed.road,
    parsed.houseNumber ? `${parsed.houseNumber}號` : undefined,
  ].filter(Boolean).join("");
  const communityAddress = [parsed.city, parsed.district, parsed.community].filter(Boolean).join("");
  const areaRoad = [parsed.city, parsed.district, parsed.road].filter(Boolean).join("");
  const cleaned = parsed.cleaned;
  const variants = getAddressSearchVariants(query)
    .map((item) => fullWidthSafeQuery(item))
    .concat([structuredAddress, communityAddress, areaRoad, cleaned])
    .filter((item) => item && normalizeAddressText(item).length >= 3);
  return [...new Set(variants)];
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

const makeAdminFallbackCandidate = async (query: string): Promise<LocationCandidate | undefined> => {
  const parsed = extractTaiwanQueryParts(query);
  if (!parsed.city || !parsed.district) return undefined;
  const boundary = await getTownBoundary(parsed.city, parsed.district);
  const center = getBoundaryCenter(boundary?.geometry);
  if (!center) return undefined;
  const label = [
    parsed.city,
    parsed.district,
    parsed.community,
    parsed.road,
    parsed.houseNumber ? `${parsed.houseNumber}號` : undefined,
  ].filter(Boolean).join("");
  const confidence = parsed.road && parsed.houseNumber ? 0.84 : parsed.road || parsed.community ? 0.8 : 0.72;
  return {
    id: `admin-fuzzy-${normalizeAddressText(label || query)}`,
    label: label || `${parsed.city}${parsed.district}`,
    city: parsed.city,
    district: parsed.district,
    road: parsed.road,
    lat: center[0],
    lng: center[1],
    confidence,
    source: "manual",
  };
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

const fetchNominatimSearch = async (query: string) => {
  await waitForRateLimit();
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", query);
  url.searchParams.set("countrycodes", "tw");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "5");
  url.searchParams.set("accept-language", "zh-TW");
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Nominatim responded ${response.status}`);
  return (await response.json()) as Array<{
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
      city_district?: string;
      road?: string;
      neighbourhood?: string;
      house_number?: string;
    };
  }>;
};

const remoteCandidateScore = (query: string, candidate: LocationCandidate) => {
  const parsed = extractTaiwanQueryParts(query);
  const normalizedLabel = normalizeAddressText(`${candidate.label}${candidate.city ?? ""}${candidate.district ?? ""}${candidate.road ?? ""}`);
  let score = candidate.confidence;
  if (parsed.city && normalizeAddressText(candidate.city ?? candidate.label).includes(normalizeAddressText(parsed.city))) score += 0.12;
  if (parsed.district && normalizedLabel.includes(normalizeAddressText(parsed.district))) score += 0.16;
  if (parsed.road && normalizedLabel.includes(normalizeAddressText(parsed.road))) score += 0.14;
  if (parsed.community && normalizedLabel.includes(normalizeAddressText(parsed.community))) score += 0.18;
  if (parsed.houseNumber && normalizedLabel.includes(normalizeAddressText(`${parsed.houseNumber}號`))) score += 0.1;
  return score;
};

const mergeCandidates = (items: LocationCandidate[]) =>
  items.reduce<LocationCandidate[]>((merged, item) => {
    const key = `${normalizeAddressText(item.label)}-${item.lat.toFixed(4)}-${item.lng.toFixed(4)}`;
    if (merged.some((target) => `${normalizeAddressText(target.label)}-${target.lat.toFixed(4)}-${target.lng.toFixed(4)}` === key)) {
      return merged;
    }
    return [...merged, item];
  }, []);

export const searchAddress = async (query: string): Promise<LocationCandidate[]> => {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const cache = loadCache();
  const cacheKey = normalizeAddressText(trimmed);
  if (cache[cacheKey]) return cache[cacheKey];

  const local = localCandidates(trimmed);
  const adminFallback = await makeAdminFallbackCandidate(trimmed);
  if (trimmed.length < 5 && !adminFallback && !local.length) return [];
  if (local.length > 0 && hasStrongLocalMatch(trimmed, local)) {
    const results = mergeCandidates([...local, ...(adminFallback ? [adminFallback] : [])]).slice(0, 6);
    cache[cacheKey] = results;
    saveCache(cache);
    return results;
  }

  try {
    const fuzzyQueries = getFuzzyQueries(trimmed).slice(0, 4);
    const payload: Awaited<ReturnType<typeof fetchNominatimSearch>> = [];
    for (const item of fuzzyQueries) {
      try {
        payload.push(...(await fetchNominatimSearch(item)));
      } catch {
        // Continue with the next fuzzy query and keep any local/admin fallback.
      }
      if (payload.length >= 5) break;
    }

    const remote: LocationCandidate[] = payload.map((item) => ({
      id: `nominatim-${item.place_id}`,
      label: item.display_name,
      city: item.address?.city ?? item.address?.county,
      district: item.address?.town ?? item.address?.city_district ?? item.address?.suburb,
      road: [item.address?.road, item.address?.house_number ? `${item.address.house_number}號` : undefined].filter(Boolean).join("") || item.address?.neighbourhood,
      lat: Number(item.lat),
      lng: Number(item.lon),
      confidence: Math.min(0.95, Math.max(0.5, item.importance ?? 0.6)),
      source: "nominatim",
    }));

    const hasStrongLocal = local.length > 0 && hasStrongLocalMatch(trimmed, local);
    const sortedRemote = remote.sort((a, b) => remoteCandidateScore(trimmed, b) - remoteCandidateScore(trimmed, a));
    const results = mergeCandidates(
      hasStrongLocal
        ? [...local, ...sortedRemote, ...(adminFallback ? [adminFallback] : [])]
        : [...sortedRemote, ...local, ...(adminFallback ? [adminFallback] : [])],
    ).slice(0, 6);
    cache[cacheKey] = results;
    saveCache(cache);
    return results;
  } catch {
    const results = mergeCandidates([...local, ...(adminFallback ? [adminFallback] : [])]).slice(0, 6);
    cache[cacheKey] = results;
    saveCache(cache);
    return results;
  }
};

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
