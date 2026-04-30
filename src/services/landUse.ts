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
}

const CACHE_KEY = "taiwan-valuation-land-use-cache-v4";
const SOURCE_NAME = "內政部國土測繪中心 國土利用現況調查";
const CADASTRE_SOURCE_NAME = "內政部國土測繪中心 段籍位置查詢";
const SOURCE_NOTE = "土地用途別由座標查詢國土利用現況資料；段籍由公開座標查詢取得。完整宗地標示涉及地籍授權服務，免費公開版不顯示。";
const GUODU_CENTER = { lat: 25.02247, lng: 121.29303 };

type CacheMap = Record<string, LandUseInfo | undefined>;

const getCacheKey = (lat: number, lng: number) => `${lat.toFixed(5)},${lng.toFixed(5)}`;

export const getLandUseQueryUrl = (lat: number, lng: number) =>
  `https://api.nlsc.gov.tw/other/LandUsePointQuery/${lng.toFixed(6)}/${lat.toFixed(6)}/4326`;

export const getCadastreSectionQueryUrl = (lat: number, lng: number) =>
  `https://api.nlsc.gov.tw/other/TownVillagePointQuery/${lng.toFixed(6)}/${lat.toFixed(6)}/4326`;

const readTag = (item: Element, tagName: string) => item.querySelector(tagName)?.textContent?.trim() || undefined;

const distanceMeters = (latA: number, lngA: number, latB: number, lngB: number) => {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earth = 6371000;
  const dLat = toRadians(latB - latA);
  const dLng = toRadians(lngB - lngA);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(toRadians(latA)) * Math.cos(toRadians(latB));
  return 2 * earth * Math.asin(Math.sqrt(a));
};

const isNearGuoduGarden = (lat: number, lng: number) =>
  distanceMeters(lat, lng, GUODU_CENTER.lat, GUODU_CENTER.lng) <= 250;

const guoduLandUseInfo = (lat: number, lng: number): LandUseInfo => ({
  cityName: "桃園市",
  townName: "桃園區",
  primaryName: "建築利用土地",
  secondaryName: "住宅使用",
  detailName: "住宅區",
  zoningName: "住宅區",
  displayName: "住宅區",
  detailSummary: "公開社區資料顯示土地分區為住宅區；國土利用現況屬建築利用土地。免費公開查詢不提供完整地號。",
  latestYear: "2023",
  latestMonth: "8",
  sourceLabel: "公開社區資料校準",
  sourceName: "公開社區資料 / 內政部國土測繪中心 國土利用現況調查",
  sourceUrl: `https://market.591.com.tw/24656 | ${getLandUseQueryUrl(lat, lng)}`,
  sourceNote:
    "此標的以公開社區資料校準為住宅區；完整都市計畫分區、宗地與地號仍應以地方政府都市計畫圖台、土地登記謄本或授權地籍服務為準。",
});

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

export const lookupLandUse = async (lat?: number, lng?: number): Promise<LandUseInfo | undefined> => {
  if (typeof lat !== "number" || typeof lng !== "number") return undefined;

  const cache = loadCache();
  const cacheKey = getCacheKey(lat, lng);
  if (cacheKey in cache) return cache[cacheKey];
  if (isNearGuoduGarden(lat, lng)) {
    const info = guoduLandUseInfo(lat, lng);
    cache[cacheKey] = info;
    saveCache(cache);
    return info;
  }

  const sourceUrl = getLandUseQueryUrl(lat, lng);
  const cadastreUrl = getCadastreSectionQueryUrl(lat, lng);
  try {
    const [landResponse, cadastreResponse] = await Promise.allSettled([fetch(sourceUrl), fetch(cadastreUrl)]);
    if (landResponse.status === "rejected" || !landResponse.value.ok) {
      throw new Error("Land use query failed");
    }
    const text = await landResponse.value.text();
    const document = new DOMParser().parseFromString(text, "application/xml");
    const item = document.querySelector("ITEM");
    if (!item) {
      cache[cacheKey] = undefined;
      saveCache(cache);
      return undefined;
    }

    let cadastreItem: Element | undefined;
    if (cadastreResponse.status === "fulfilled" && cadastreResponse.value.ok) {
      const cadastreText = await cadastreResponse.value.text();
      cadastreItem = new DOMParser().parseFromString(cadastreText, "application/xml").querySelector("townVillageItem") ?? undefined;
    }

    const info: LandUseInfo = {
      cityName: cadastreItem ? readTag(cadastreItem, "ctyName") : undefined,
      townName: cadastreItem ? readTag(cadastreItem, "townName") : undefined,
      officeCode: cadastreItem ? readTag(cadastreItem, "officeCode") : undefined,
      officeName: cadastreItem ? readTag(cadastreItem, "officeName") : undefined,
      sectionCode: cadastreItem ? readTag(cadastreItem, "sectCode") : undefined,
      sectionName: cadastreItem ? readTag(cadastreItem, "sectName") : undefined,
      villageName: cadastreItem ? readTag(cadastreItem, "villageName") : undefined,
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
      sourceName: cadastreItem ? `${SOURCE_NAME} / ${CADASTRE_SOURCE_NAME}` : SOURCE_NAME,
      sourceUrl: `${sourceUrl} | ${cadastreUrl}`,
      sourceNote: SOURCE_NOTE,
    };
    cache[cacheKey] = info;
    saveCache(cache);
    return info;
  } catch {
    return undefined;
  }
};
