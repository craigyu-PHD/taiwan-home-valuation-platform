export interface NearbyFeature {
  name: string;
  category: "school" | "transit" | "green" | "retail" | "medical";
  distanceMeters?: number;
}

export interface LocationIntel {
  schoolCount: number;
  transitCount: number;
  greenCount: number;
  retailCount: number;
  medicalCount: number;
  features: NearbyFeature[];
  sourceUrl: string;
}

const CACHE_KEY = "taiwan-valuation-location-intel-v2";

type CacheMap = Record<string, LocationIntel>;

const getCacheKey = (lat: number, lng: number, radiusMeters: number) =>
  `${lat.toFixed(4)},${lng.toFixed(4)},${radiusMeters}`;

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
    // Best-effort cache only.
  }
};

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const distanceMeters = (latA: number, lngA: number, latB: number, lngB: number) => {
  const earth = 6371000;
  const dLat = toRadians(latB - latA);
  const dLng = toRadians(lngB - lngA);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(toRadians(latA)) * Math.cos(toRadians(latB));
  return 2 * earth * Math.asin(Math.sqrt(a));
};

const getOverpassQuery = (lat: number, lng: number, radiusMeters: number) => `
[out:json][timeout:8];
(
  node(around:${radiusMeters},${lat},${lng})["amenity"~"school|kindergarten|college|university|library"];
  way(around:${radiusMeters},${lat},${lng})["amenity"~"school|kindergarten|college|university|library"];
  node(around:${radiusMeters},${lat},${lng})["public_transport"~"station|platform"];
  node(around:${radiusMeters},${lat},${lng})["railway"~"station|subway_entrance|tram_stop"];
  node(around:${radiusMeters},${lat},${lng})["highway"="bus_stop"];
  node(around:${radiusMeters},${lat},${lng})["leisure"="park"];
  way(around:${radiusMeters},${lat},${lng})["leisure"="park"];
  node(around:${radiusMeters},${lat},${lng})["shop"];
  node(around:${radiusMeters},${lat},${lng})["amenity"~"marketplace|restaurant|cafe|bank|post_office|hospital|clinic"];
);
out center tags 80;
`;

const getCategory = (tags: Record<string, string>): NearbyFeature["category"] | undefined => {
  if (/school|kindergarten|college|university|library/.test(tags.amenity ?? "")) return "school";
  if (tags.public_transport || /station|subway_entrance|tram_stop/.test(tags.railway ?? "") || tags.highway === "bus_stop") {
    return "transit";
  }
  if (tags.leisure === "park") return "green";
  if (/hospital|clinic/.test(tags.amenity ?? "")) return "medical";
  if (tags.shop || /marketplace|restaurant|cafe|bank|post_office/.test(tags.amenity ?? "")) return "retail";
  return undefined;
};

const getDisplayName = (tags: Record<string, string>, fallback: string) => {
  const rawName = (tags["name:zh"] || tags.name || "").trim();
  if (!rawName || /^(various|yes|no|unknown|none)$/i.test(rawName)) return fallback;
  return rawName.length > 24 ? `${rawName.slice(0, 24)}...` : rawName;
};

export const getMajorDevelopmentSignal = (city?: string, district?: string, road?: string) => {
  const scope = `${city ?? ""}${district ?? ""}${road ?? ""}`;
  if (!scope.trim()) return "尚未取得行政區，建設題材需先完成定位。";
  if (/桃園|中壢|青埔|航空城|藝文|經國|南崁/.test(scope)) {
    return "桃園生活圈需追蹤捷運綠線、鐵路地下化、航空城與藝文商圈外溢效應。";
  }
  if (/台北|臺北|信義|大安|松山|中山|南港/.test(scope)) {
    return "台北核心區以捷運成熟度、都更題材、辦公與商圈外溢作為溢價檢核。";
  }
  if (/新北|板橋|新莊|三重|中和|永和|新店|林口/.test(scope)) {
    return "新北生活圈需檢核捷運路網、重劃區成熟度與跨區通勤時間。";
  }
  if (/台中|臺中|西屯|北屯|南屯|烏日/.test(scope)) {
    return "台中主要檢核捷運藍綠線、七期外溢、重劃區供給與商辦聚落。";
  }
  if (/高雄|左營|鼓山|苓雅|前鎮|鳳山/.test(scope)) {
    return "高雄主要檢核捷運與輕軌路網、亞洲新灣區與商圈成熟度。";
  }
  return `${city ?? ""}${district ?? ""}建設題材需以地方政府公告、交通建設進度與生活圈供給量交叉驗證。`;
};

export const lookupLocationIntel = async (lat?: number, lng?: number, radiusMeters = 1200): Promise<LocationIntel | undefined> => {
  if (typeof lat !== "number" || typeof lng !== "number") return undefined;
  const cache = loadCache();
  const cacheKey = getCacheKey(lat, lng, radiusMeters);
  if (cache[cacheKey]) return cache[cacheKey];

  const query = getOverpassQuery(lat, lng, radiusMeters);
  const sourceUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
  try {
    const response = await fetch(sourceUrl);
    if (!response.ok) throw new Error(`Overpass query failed: ${response.status}`);
    const payload = (await response.json()) as {
      elements?: Array<{ lat?: number; lon?: number; center?: { lat?: number; lon?: number }; tags?: Record<string, string> }>;
    };

    const features = (payload.elements ?? []).reduce<NearbyFeature[]>((items, element) => {
      const tags = element.tags ?? {};
      const category = getCategory(tags);
      if (!category) return items;
      const fallback = category === "school" ? "文教設施" : category === "transit" ? "交通節點" : category === "green" ? "公園綠地" : category === "medical" ? "醫療設施" : "生活機能";
      const itemLat = element.lat ?? element.center?.lat;
      const itemLng = element.lon ?? element.center?.lon;
      items.push({
        category,
        name: getDisplayName(tags, fallback),
        distanceMeters: typeof itemLat === "number" && typeof itemLng === "number" ? Math.round(distanceMeters(lat, lng, itemLat, itemLng)) : undefined,
      });
      return items;
    }, []);

    const uniqueFeatures = features.filter(
      (item, index, all) => all.findIndex((target) => target.category === item.category && target.name === item.name) === index,
    );
    const intel: LocationIntel = {
      schoolCount: uniqueFeatures.filter((item) => item.category === "school").length,
      transitCount: uniqueFeatures.filter((item) => item.category === "transit").length,
      greenCount: uniqueFeatures.filter((item) => item.category === "green").length,
      retailCount: uniqueFeatures.filter((item) => item.category === "retail").length,
      medicalCount: uniqueFeatures.filter((item) => item.category === "medical").length,
      features: uniqueFeatures
        .sort((a, b) => (a.distanceMeters ?? Number.MAX_SAFE_INTEGER) - (b.distanceMeters ?? Number.MAX_SAFE_INTEGER))
        .slice(0, 60),
      sourceUrl,
    };
    cache[cacheKey] = intel;
    saveCache(cache);
    return intel;
  } catch {
    return undefined;
  }
};
