export interface LandUseInfo {
  cityName?: string;
  townName?: string;
  officeCode?: string;
  officeName?: string;
  sectionCode?: string;
  sectionName?: string;
  villageName?: string;
  parcelNumber?: string;
  parcelStatus?: string;
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

const CACHE_KEY = "taiwan-valuation-land-use-cache-v2";
const SOURCE_NAME = "內政部國土測繪中心 國土利用現況調查";
const CADASTRE_SOURCE_NAME = "內政部國土測繪中心 段籍位置查詢";
const SOURCE_NOTE = "土地用途別由座標查詢國土利用現況資料；段籍由公開座標查詢取得。完整宗地地號屬地籍 API GetLandNO/CadasMapPointQuery 服務，正式上線需依法申請授權，不得以未授權方式取得。";

type CacheMap = Record<string, LandUseInfo | undefined>;

const getCacheKey = (lat: number, lng: number) => `${lat.toFixed(5)},${lng.toFixed(5)}`;

export const getLandUseQueryUrl = (lat: number, lng: number) =>
  `https://api.nlsc.gov.tw/other/LandUsePointQuery/${lng.toFixed(6)}/${lat.toFixed(6)}/4326`;

export const getCadastreSectionQueryUrl = (lat: number, lng: number) =>
  `https://api.nlsc.gov.tw/other/TownVillagePointQuery/${lng.toFixed(6)}/${lat.toFixed(6)}/4326`;

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
      parcelStatus: cadastreItem
        ? "已取得公開段籍；完整地號需接入經授權地籍 API。"
        : "公開段籍查詢暫時無回應。",
      year: readTag(item, "YEAR"),
      latestYear: readTag(item, "LYEAR"),
      latestMonth: readTag(item, "LMONTH"),
      primaryCode: readTag(item, "Lcode_C1"),
      primaryName: readTag(item, "Lname_C1"),
      secondaryCode: readTag(item, "Lcode_C2"),
      secondaryName: readTag(item, "Lname_C2"),
      detailCode: readTag(item, "LCODE") ?? readTag(item, "Lcode_C3"),
      detailName: readTag(item, "NAME"),
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
