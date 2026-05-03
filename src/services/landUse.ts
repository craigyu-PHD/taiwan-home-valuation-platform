export interface LandUseInfo {
  cityName?: string;
  townName?: string;
  officeCode?: string;
  officeName?: string;
  sectionCode?: string;
  sectionName?: string;
  villageName?: string;
  year?: string;
  latestYear?: string;
  latestMonth?: string;
  primaryCode?: string;
  primaryName?: string;
  secondaryCode?: string;
  secondaryName?: string;
  detailCode?: string;
  detailName?: string;
  zoningName?: string;
  displayName?: string;
  detailSummary?: string;
  sourceLabel?: string;
  sourceName: string;
  sourceUrl: string;
  sourceNote: string;
  queryLat?: number;
  queryLng?: number;
  sampledFromNearby?: boolean;
  sampledDistanceMeters?: number;
  originalDisplayName?: string;
}

const CACHE_KEY = "taiwan-valuation-land-use-cache-v11";
const SOURCE_NAME = "內政部國土測繪中心 國土利用現況調查";
const CADASTRE_SOURCE_NAME = "內政部國土測繪中心 段籍位置查詢";
const SOURCE_NOTE = "土地用途別由座標查詢國土利用現況資料；段籍由公開座標查詢取得。完整宗地標示涉及地籍授權服務，免費公開版不顯示。";

type CacheMap = Record<string, LandUseInfo | undefined>;

const getCacheKey = (lat: number, lng: number) => `${lat.toFixed(5)},${lng.toFixed(5)}`;

export const getLandUseQueryUrl = (lat: number, lng: number) =>
  `https://api.nlsc.gov.tw/other/LandUsePointQuery/${lng.toFixed(6)}/${lat.toFixed(6)}/4326`;

export const getCadastreSectionQueryUrl = (lat: number, lng: number) =>
  `https://api.nlsc.gov.tw/other/TownVillagePointQuery/${lng.toFixed(6)}/${lat.toFixed(6)}/4326`;

const readTag = (item: Element, tagName: string) => item.querySelector(tagName)?.textContent?.trim() || undefined;

const isRoadLike = (info?: LandUseInfo) => {
  const text = [info?.primaryName, info?.secondaryName, info?.detailName, info?.displayName].filter(Boolean).join(" ");
  return /交通利用土地|道路|道路及相關設施|一般道路/.test(text);
};

const landUseScore = (info?: LandUseInfo) => {
  const text = [info?.primaryName, info?.secondaryName, info?.detailName, info?.displayName].filter(Boolean).join(" ");
  if (!info) return -10;
  if (/住宅|住商|混合使用住宅|純住宅|商業|零售|批發|建築利用土地/.test(text)) return 100;
  if (/公共設施|學校|機關|公園|綠地/.test(text)) return 62;
  if (/工業|倉儲|農業|水利用/.test(text)) return 42;
  if (isRoadLike(info)) return 8;
  return 50;
};

const offsetPoint = (lat: number, lng: number, metersNorth: number, metersEast: number) => {
  const latOffset = metersNorth / 111_320;
  const lngOffset = metersEast / (111_320 * Math.cos((lat * Math.PI) / 180));
  return { lat: lat + latOffset, lng: lng + lngOffset };
};

const nearbySamplePoints = (lat: number, lng: number) => {
  const fullDirections = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const;
  const cardinalDirections = fullDirections.slice(0, 4);
  return [16, 34].flatMap((meters) =>
    fullDirections.map(([north, east]) => ({
      ...offsetPoint(lat, lng, north * meters, east * meters),
      distanceMeters: Math.round(meters * Math.hypot(north, east)),
    })),
  ).concat([58].flatMap((meters) =>
    cardinalDirections.map(([north, east]) => ({
      ...offsetPoint(lat, lng, north * meters, east * meters),
      distanceMeters: Math.round(meters * Math.hypot(north, east)),
    })),
  ));
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
    // Local cache is best-effort only.
  }
};

const fetchLandUseOnly = async (lat: number, lng: number): Promise<LandUseInfo | undefined> => {
  const sourceUrl = getLandUseQueryUrl(lat, lng);
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error("Land use query failed");
  const text = await response.text();
  const document = new DOMParser().parseFromString(text, "application/xml");
  const item = document.querySelector("ITEM");
  if (!item) return undefined;

  return {
    year: readTag(item, "YEAR"),
    latestYear: readTag(item, "LYEAR"),
    latestMonth: readTag(item, "LMONTH"),
    primaryCode: readTag(item, "Lcode_C1"),
    primaryName: readTag(item, "Lname_C1"),
    secondaryCode: readTag(item, "Lcode_C2"),
    secondaryName: readTag(item, "Lname_C2"),
    detailCode: readTag(item, "LCODE") ?? readTag(item, "Lcode_C3"),
    detailName: readTag(item, "NAME"),
    displayName: readTag(item, "NAME") ?? readTag(item, "Lname_C2") ?? readTag(item, "Lname_C1"),
    detailSummary: "此為座標對應的國土利用現況，不等同完整都市計畫使用分區或土地登記地號。",
    sourceName: SOURCE_NAME,
    sourceUrl,
    sourceNote: SOURCE_NOTE,
    queryLat: lat,
    queryLng: lng,
  };
};

const attachCadastre = async (info: LandUseInfo, lat: number, lng: number, sourceUrl: string) => {
  const cadastreUrl = getCadastreSectionQueryUrl(lat, lng);
  try {
    const cadastreResponse = await fetch(cadastreUrl);
    if (!cadastreResponse.ok) {
      return {
        ...info,
        sourceUrl: `${sourceUrl} | ${cadastreUrl}`,
      };
    }
    const cadastreText = await cadastreResponse.text();
    const cadastreItem = new DOMParser().parseFromString(cadastreText, "application/xml").querySelector("townVillageItem") ?? undefined;
    return {
      ...info,
      cityName: cadastreItem ? readTag(cadastreItem, "ctyName") : undefined,
      townName: cadastreItem ? readTag(cadastreItem, "townName") : undefined,
      officeCode: cadastreItem ? readTag(cadastreItem, "officeCode") : undefined,
      officeName: cadastreItem ? readTag(cadastreItem, "officeName") : undefined,
      sectionCode: cadastreItem ? readTag(cadastreItem, "sectCode") : undefined,
      sectionName: cadastreItem ? readTag(cadastreItem, "sectName") : undefined,
      villageName: cadastreItem ? readTag(cadastreItem, "villageName") : undefined,
      sourceName: cadastreItem ? `${SOURCE_NAME} / ${CADASTRE_SOURCE_NAME}` : SOURCE_NAME,
      sourceUrl: `${sourceUrl} | ${cadastreUrl}`,
    };
  } catch {
    return {
      ...info,
      sourceUrl: `${sourceUrl} | ${cadastreUrl}`,
    };
  }
};

export const lookupLandUse = async (lat?: number, lng?: number): Promise<LandUseInfo | undefined> => {
  if (typeof lat !== "number" || typeof lng !== "number") return undefined;

  const cache = loadCache();
  const cacheKey = getCacheKey(lat, lng);
  if (cacheKey in cache) return cache[cacheKey];

  try {
    const centerInfo = await fetchLandUseOnly(lat, lng);
    if (!centerInfo) {
      cache[cacheKey] = undefined;
      saveCache(cache);
      return undefined;
    }

    let selectedInfo = centerInfo;
    if (isRoadLike(centerInfo)) {
      const sampleResults = (await Promise.allSettled(
        nearbySamplePoints(lat, lng).map(async (point) => {
          const sampled = await fetchLandUseOnly(point.lat, point.lng);
          return sampled
            ? {
                ...sampled,
                sampledDistanceMeters: point.distanceMeters,
              }
            : undefined;
        }),
      ))
        .map((item) => (item.status === "fulfilled" ? item.value : undefined))
        .filter(Boolean) as LandUseInfo[];
      const betterNearby = sampleResults
        .filter((item) => landUseScore(item) > landUseScore(centerInfo))
        .sort((a, b) => landUseScore(b) - landUseScore(a) || (a.sampledDistanceMeters ?? 999) - (b.sampledDistanceMeters ?? 999))[0];
      if (betterNearby) {
        selectedInfo = {
          ...betterNearby,
          sampledFromNearby: true,
          originalDisplayName: centerInfo.displayName,
          detailSummary: "原始定位點落在道路或路緣，系統改採周邊建築用地採樣判讀；正式用途仍以主管機關核定資料為準。",
        };
      }
    }

    const info = await attachCadastre(selectedInfo, selectedInfo.queryLat ?? lat, selectedInfo.queryLng ?? lng, selectedInfo.sourceUrl);
    cache[cacheKey] = info;
    saveCache(cache);
    return info;
  } catch {
    return undefined;
  }
};
