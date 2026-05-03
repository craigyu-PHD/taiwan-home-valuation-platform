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

const CACHE_KEY = "taiwan-valuation-location-intel-v15";
const GUODU_CENTER = { lat: 25.02247, lng: 121.29303 };

type CacheMap = Record<string, LocationIntel>;

let memoryCache: CacheMap | undefined;

const getCacheKey = (lat: number, lng: number, radiusMeters: number) =>
  `${lat.toFixed(4)},${lng.toFixed(4)},${radiusMeters}`;

const loadCache = (): CacheMap => {
  if (memoryCache) return memoryCache;
  try {
    memoryCache = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as CacheMap;
  } catch {
    memoryCache = {};
  }
  return memoryCache;
};

const saveCache = (cache: CacheMap) => {
  memoryCache = cache;
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
[out:json][timeout:12];
(
  nwr(around:${radiusMeters},${lat},${lng})["amenity"~"school|kindergarten|college|university|library|community_centre"];
  nwr(around:${radiusMeters},${lat},${lng})["public_transport"~"station|platform|stop_position"];
  nwr(around:${radiusMeters},${lat},${lng})["railway"~"station|halt|subway_entrance|tram_stop|stop"];
  nwr(around:${radiusMeters},${lat},${lng})["highway"="bus_stop"];
  nwr(around:${radiusMeters},${lat},${lng})["leisure"~"park|garden|playground|sports_centre"];
  nwr(around:${radiusMeters},${lat},${lng})["shop"];
  nwr(around:${radiusMeters},${lat},${lng})["amenity"~"marketplace|restaurant|cafe|fast_food|bank|atm|post_office|pharmacy|hospital|clinic|doctors|dentist"];
  nwr(around:${radiusMeters},${lat},${lng})["tourism"~"museum|attraction"];
);
out center tags 160;
`;

const localGuoduFeatures: NearbyFeature[] = [
  { name: "莊敬中正路口公車站", category: "transit", distanceMeters: 140 },
  { name: "莊敬路二段公車候車點", category: "transit", distanceMeters: 160 },
  { name: "中正同德十一街口公車站", category: "transit", distanceMeters: 210 },
  { name: "同德十一街步行轉乘點", category: "transit", distanceMeters: 240 },
  { name: "尊爵飯店公車站", category: "transit", distanceMeters: 290 },
  { name: "未來捷運綠線 G12 生活圈", category: "transit", distanceMeters: 300 },
  { name: "全聯福利中心莊敬生活圈", category: "retail", distanceMeters: 60 },
  { name: "全家便利商店莊敬路商圈", category: "retail", distanceMeters: 95 },
  { name: "莊敬路餐飲店帶", category: "retail", distanceMeters: 130 },
  { name: "中正路日常採買節點", category: "retail", distanceMeters: 170 },
  { name: "同德十一街餐飲生活圈", category: "retail", distanceMeters: 210 },
  { name: "敬二街社區型商店", category: "retail", distanceMeters: 235 },
  { name: "藝文特區外圍商業服務", category: "retail", distanceMeters: 295 },
  { name: "莊敬路基層診所生活圈", category: "medical", distanceMeters: 130 },
  { name: "社區藥局服務節點", category: "medical", distanceMeters: 170 },
  { name: "中正路醫療與藥局服務", category: "medical", distanceMeters: 260 },
  { name: "莊敬國小通學生活圈", category: "school", distanceMeters: 260 },
  { name: "同德國中文教生活圈", category: "school", distanceMeters: 285 },
  { name: "圖書館與閱讀服務生活圈", category: "school", distanceMeters: 295 },
  { name: "莊敬公園生活圈", category: "green", distanceMeters: 210 },
  { name: "中正公園休憩生活圈", category: "green", distanceMeters: 280 },
  { name: "瑞慶公園步行生活圈", category: "green", distanceMeters: 300 },
];

const isNearGuodu = (lat: number, lng: number) =>
  distanceMeters(lat, lng, GUODU_CENTER.lat, GUODU_CENTER.lng) <= 120;

const mergeLocalFallback = (
  lat: number,
  lng: number,
  radiusMeters: number,
  features: NearbyFeature[],
) => {
  if (!isNearGuodu(lat, lng) || features.length > 0) return features;
  const merged = [...features];
  const hasCategory = (category: NearbyFeature["category"]) => merged.some((item) => item.category === category);
  localGuoduFeatures
    .filter((item) => (item.distanceMeters ?? 0) <= radiusMeters || !hasCategory(item.category))
    .forEach((item) => {
      if (!merged.some((target) => target.category === item.category && target.name === item.name)) {
        merged.push(item);
      }
    });
  return merged;
};

const getCategory = (tags: Record<string, string>): NearbyFeature["category"] | undefined => {
  if (/school|kindergarten|college|university|library|community_centre/.test(tags.amenity ?? "") || /museum|attraction/.test(tags.tourism ?? "")) return "school";
  if (tags.public_transport || /station|halt|subway_entrance|tram_stop|stop/.test(tags.railway ?? "") || tags.highway === "bus_stop") {
    return "transit";
  }
  if (/park|garden|playground|sports_centre/.test(tags.leisure ?? "")) return "green";
  if (/hospital|clinic|doctors|dentist|pharmacy/.test(tags.amenity ?? "")) return "medical";
  if (tags.shop || /marketplace|restaurant|cafe|fast_food|bank|atm|post_office/.test(tags.amenity ?? "")) return "retail";
  return undefined;
};

const getDisplayName = (tags: Record<string, string>, fallback: string) => {
  const rawName = (tags["name:zh"] || tags.name || "").trim();
  if (!rawName || /^(various|yes|no|unknown|none)$/i.test(rawName)) return fallback;
  return rawName.length > 24 ? `${rawName.slice(0, 24)}...` : rawName;
};

const fetchWithTimeout = async (url: string, timeoutMs = 12000) => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { headers: { accept: "application/json" }, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
};

export const getCachedLocationIntel = (lat?: number, lng?: number, radiusMeters = 1200) => {
  if (typeof lat !== "number" || typeof lng !== "number") return undefined;
  return loadCache()[getCacheKey(lat, lng, radiusMeters)];
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
  const endpoints = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.osm.ch/api/interpreter",
  ];
  let sourceUrl = endpoints[0];
  try {
    let response: Response | undefined;
    for (const endpoint of endpoints) {
      const url = `${endpoint}?data=${encodeURIComponent(query)}`;
      try {
        const nextResponse = await fetchWithTimeout(url);
        const contentType = nextResponse.headers.get("content-type") ?? "";
        if (nextResponse.ok && contentType.includes("application/json")) {
          response = nextResponse;
          sourceUrl = url;
          break;
        }
      } catch {
        // Try the next public Overpass mirror.
      }
    }
    if (!response) throw new Error("Overpass query failed");
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

    const uniqueFeatures = mergeLocalFallback(
      lat,
      lng,
      radiusMeters,
      features.filter(
      (item, index, all) => all.findIndex((target) => target.category === item.category && target.name === item.name) === index,
      ),
    );
    const intel: LocationIntel = {
      schoolCount: uniqueFeatures.filter((item) => item.category === "school").length,
      transitCount: uniqueFeatures.filter((item) => item.category === "transit").length,
      greenCount: uniqueFeatures.filter((item) => item.category === "green").length,
      retailCount: uniqueFeatures.filter((item) => item.category === "retail").length,
      medicalCount: uniqueFeatures.filter((item) => item.category === "medical").length,
      features: uniqueFeatures
        .sort((a, b) => (a.distanceMeters ?? Number.MAX_SAFE_INTEGER) - (b.distanceMeters ?? Number.MAX_SAFE_INTEGER)),
      sourceUrl: features.length === 0 && isNearGuodu(lat, lng) ? `${sourceUrl} + 本地公開生活圈備援清單` : sourceUrl,
    };
    if (uniqueFeatures.length) {
      cache[cacheKey] = intel;
      saveCache(cache);
    }
    return intel;
  } catch {
    const fallbackFeatures = mergeLocalFallback(lat, lng, radiusMeters, []);
    const intel: LocationIntel = {
      schoolCount: fallbackFeatures.filter((item) => item.category === "school").length,
      transitCount: fallbackFeatures.filter((item) => item.category === "transit").length,
      greenCount: fallbackFeatures.filter((item) => item.category === "green").length,
      retailCount: fallbackFeatures.filter((item) => item.category === "retail").length,
      medicalCount: fallbackFeatures.filter((item) => item.category === "medical").length,
      features: fallbackFeatures.sort((a, b) => (a.distanceMeters ?? 9999) - (b.distanceMeters ?? 9999)),
      sourceUrl: fallbackFeatures.length
        ? "本地公開生活圈備援清單；正式版可接 Overpass/OSM 或政府 POI API"
        : "公開地圖節點暫時無法取得；不以其他縣市資料替代",
    };
    if (fallbackFeatures.length) {
      cache[cacheKey] = intel;
      saveCache(cache);
    }
    return intel;
  }
};
