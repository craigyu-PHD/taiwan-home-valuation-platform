export interface LandUseInfo {
  year?: string;
  latestYear?: string;
  latestMonth?: string;
  primaryCode?: string;
  primaryName?: string;
  secondaryCode?: string;
  secondaryName?: string;
  detailCode?: string;
  detailName?: string;
  sourceName: string;
  sourceUrl: string;
  sourceNote: string;
}

const CACHE_KEY = "taiwan-valuation-land-use-cache-v1";
const SOURCE_NAME = "內政部國土測繪中心 國土利用現況調查";
const SOURCE_NOTE = "土地用途別由座標查詢國土利用現況資料；都市計畫使用分區、建蔽容積與法定管制仍應以主管機關核發文件為準。";

type CacheMap = Record<string, LandUseInfo | undefined>;

const getCacheKey = (lat: number, lng: number) => `${lat.toFixed(5)},${lng.toFixed(5)}`;

export const getLandUseQueryUrl = (lat: number, lng: number) =>
  `https://api.nlsc.gov.tw/other/LandUsePointQuery/${lng.toFixed(6)}/${lat.toFixed(6)}/4326`;

const readTag = (item: Element, tagName: string) => item.querySelector(tagName)?.textContent?.trim() || undefined;

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

  const sourceUrl = getLandUseQueryUrl(lat, lng);
  try {
    const response = await fetch(sourceUrl);
    if (!response.ok) throw new Error(`Land use query failed: ${response.status}`);
    const text = await response.text();
    const document = new DOMParser().parseFromString(text, "application/xml");
    const item = document.querySelector("ITEM");
    if (!item) {
      cache[cacheKey] = undefined;
      saveCache(cache);
      return undefined;
    }

    const info: LandUseInfo = {
      year: readTag(item, "YEAR"),
      latestYear: readTag(item, "LYEAR"),
      latestMonth: readTag(item, "LMONTH"),
      primaryCode: readTag(item, "Lcode_C1"),
      primaryName: readTag(item, "Lname_C1"),
      secondaryCode: readTag(item, "Lcode_C2"),
      secondaryName: readTag(item, "Lname_C2"),
      detailCode: readTag(item, "LCODE") ?? readTag(item, "Lcode_C3"),
      detailName: readTag(item, "NAME"),
      sourceName: SOURCE_NAME,
      sourceUrl,
      sourceNote: SOURCE_NOTE,
    };
    cache[cacheKey] = info;
    saveCache(cache);
    return info;
  } catch {
    return undefined;
  }
};
