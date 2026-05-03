import { DATA_SOURCES, demoTransactions } from "../data/demoTransactions";
import type {
  ConfidenceLevel,
  MarketStats,
  PropertyInput,
  PropertyType,
  SpecialFactor,
  TransactionCase,
  ValuationResult,
  ValuationSourceMode,
  WeightedCase,
} from "../types";
import { clamp, haversineMeters } from "../utils/format";
import { communityEquals } from "../utils/community";

const DEMO_REFERENCE_DATE = new Date("2026-04-30T00:00:00+08:00");
const STANDARD_PROPERTY_TYPES: PropertyType[] = ["住宅大樓", "華廈", "公寓", "套房"];
const HARD_STOP_FACTORS: SpecialFactor[] = ["凶宅", "持分", "法拍", "地上權", "特殊產權"];
const MATERIAL_RISK_FACTORS: SpecialFactor[] = ["頂樓加蓋", "違建", "漏水", "嚴重屋況", "其他"];

export const createDefaultInput = (): PropertyInput => ({
  address: "",
  city: undefined,
  district: undefined,
  road: undefined,
  communityName: undefined,
  lat: undefined,
  lng: undefined,
  locationConfidence: 0,
  propertyType: "住宅大樓",
  areaPing: undefined,
  floor: undefined,
  totalFloors: undefined,
  ageYears: undefined,
  hasParking: false,
  parkingType: "無",
  condition: "未提供",
  occupancy: "未提供",
  specialFactors: [],
  valuationMode: "智慧估價",
});

export const propertyTypes: PropertyType[] = [
  "住宅大樓",
  "華廈",
  "公寓",
  "套房",
  "透天",
  "店面",
  "辦公室",
  "廠房",
  "農舍",
  "其他",
];

export const specialFactors: SpecialFactor[] = [
  "頂樓加蓋",
  "違建",
  "漏水",
  "凶宅",
  "持分",
  "法拍",
  "地上權",
  "特殊產權",
  "嚴重屋況",
  "其他",
];

export const getMonthsAgo = (date: string) => {
  const then = new Date(`${date}T00:00:00+08:00`);
  return Math.max(
    0,
    (DEMO_REFERENCE_DATE.getFullYear() - then.getFullYear()) * 12 +
      DEMO_REFERENCE_DATE.getMonth() -
      then.getMonth(),
  );
};

const weightedPercentile = (cases: WeightedCase[], percentile: number) => {
  const sorted = [...cases].sort((a, b) => a.unitPriceWan - b.unitPriceWan);
  const totalWeight = sorted.reduce((sum, item) => sum + item.weight, 0);
  let cumulative = 0;
  for (const item of sorted) {
    cumulative += item.weight;
    if (cumulative >= totalWeight * percentile) return item.unitPriceWan;
  }
  return sorted.at(-1)?.unitPriceWan ?? 0;
};

const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
};

const sameRoad = (input: PropertyInput, item: TransactionCase) => Boolean(input.road && input.road === item.road);

const sameDistrict = (input: PropertyInput, item: TransactionCase) =>
  Boolean(input.city && input.district && input.city === item.city && input.district === item.district);

const RECENT_TRANSACTION_MONTHS = 12;
const MAX_DISPLAY_CASES = 80;

const orderCasesForDisplay = (input: PropertyInput, cases: WeightedCase[]) => {
  const sortByUnitPrice = (a: WeightedCase, b: WeightedCase) => b.unitPriceWan - a.unitPriceWan || a.monthsAgo - b.monthsAgo;
  const sameCommunity = cases
    .filter((item) => communityEquals(input.communityName, item.communityName))
    .sort(sortByUnitPrice);
  const recentComparable = cases
    .filter((item) => !communityEquals(input.communityName, item.communityName) && item.monthsAgo <= RECENT_TRANSACTION_MONTHS)
    .sort((a, b) => {
      const roadDiff = Number(sameRoad(input, b)) - Number(sameRoad(input, a));
      if (roadDiff) return roadDiff;
      const districtDiff = Number(sameDistrict(input, b)) - Number(sameDistrict(input, a));
      if (districtDiff) return districtDiff;
      const distanceDiff = Number((b.distanceMeters ?? Infinity) <= 1000) - Number((a.distanceMeters ?? Infinity) <= 1000);
      if (distanceDiff) return distanceDiff;
      return sortByUnitPrice(a, b);
    });
  const olderComparable = cases
    .filter((item) => !communityEquals(input.communityName, item.communityName))
    .sort((a, b) => {
      const roadDiff = Number(sameRoad(input, b)) - Number(sameRoad(input, a));
      if (roadDiff) return roadDiff;
      const districtDiff = Number(sameDistrict(input, b)) - Number(sameDistrict(input, a));
      if (districtDiff) return districtDiff;
      return sortByUnitPrice(a, b) || b.weight - a.weight || a.distanceMeters - b.distanceMeters;
    });
  return uniqueWeightedCases([...sameCommunity, ...recentComparable, ...olderComparable]).slice(0, MAX_DISPLAY_CASES);
};

const cityBaselines: Record<string, number> = {
  臺北市: 105,
  新北市: 58,
  桃園市: 34,
  臺中市: 39,
  臺南市: 28,
  高雄市: 31,
  基隆市: 24,
  新竹市: 49,
  新竹縣: 38,
  苗栗縣: 22,
  彰化縣: 23,
  南投縣: 18,
  雲林縣: 17,
  嘉義市: 24,
  嘉義縣: 16,
  屏東縣: 18,
  宜蘭縣: 25,
  花蓮縣: 22,
  臺東縣: 20,
  澎湖縣: 24,
  金門縣: 26,
  連江縣: 22,
};

const marketCategoryMeta = [
  { segment: "公寓", definition: "依建物型態" },
  { segment: "華廈", definition: "依建物型態" },
  { segment: "新成屋（五年內）", definition: "屋齡 0-5 年" },
  { segment: "新古屋（五～十五年）", definition: "屋齡 5-15 年" },
  { segment: "中古屋（十五年以上）", definition: "屋齡 15 年以上" },
  { segment: "預售屋", definition: "預售交易" },
] as const;

const marketSegment = (item: TransactionCase) => {
  if (item.note?.includes("預售")) return marketCategoryMeta[5];
  if (item.propertyType === "公寓") return marketCategoryMeta[0];
  if (item.propertyType === "華廈") return marketCategoryMeta[1];
  if (item.ageYears <= 5) return marketCategoryMeta[2];
  if (item.ageYears <= 15) return marketCategoryMeta[3];
  return marketCategoryMeta[4];
};

const fallbackMarketStats = (city?: string, district?: string): MarketStats[] => {
  const base = cityBaselines[city ?? ""] ?? 25;
  const label = `${city ?? "全臺"}${district ?? ""}`;
  const factors: Record<string, number> = {
    公寓: 0.72,
    華廈: 0.86,
    "新成屋（五年內）": 1.12,
    "新古屋（五～十五年）": 1,
    "中古屋（十五年以上）": 0.82,
    預售屋: 1.18,
  };
  return marketCategoryMeta.map(({ segment, definition }) => {
    const factor = factors[segment] ?? 1;
    const medianPrice = base * factor;
    return {
      label,
      segment,
      transactionStatus: definition,
      count: 0,
      medianUnitPriceWan: medianPrice,
      lowUnitPriceWan: medianPrice * 0.88,
      highUnitPriceWan: medianPrice * 1.12,
      latestDate: undefined,
      propertyTypes: [segment],
    };
  });
};

const scoreCase = (input: PropertyInput, item: TransactionCase): WeightedCase | undefined => {
  if (!input.lat || !input.lng) return undefined;
  const distanceMeters = haversineMeters(input.lat, input.lng, item.lat, item.lng);
  const monthsAgo = getMonthsAgo(item.transactionDate);
  if (distanceMeters > 10000 || monthsAgo > 36) return undefined;

  const tags: string[] = [];
  let score = 0;

  if (communityEquals(input.communityName, item.communityName)) {
    score += 42;
    tags.push("同社區");
  } else if (input.road && input.road === item.road) {
    score += 26;
    tags.push("同路段");
  } else if (input.district && input.district === item.district) {
    score += 16;
    tags.push("同行政區");
  } else if (input.city && input.city === item.city) {
    score += 7;
    tags.push("同縣市");
  }

  const distanceScore = clamp(30 - distanceMeters / 90, 0, 30);
  score += distanceScore;
  if (distanceMeters <= 500) tags.push("500m 內");
  else if (distanceMeters <= 1000) tags.push("1km 內");

  const recencyScore = clamp(26 - monthsAgo * 1.05, 0, 26);
  score += recencyScore;
  if (monthsAgo <= 6) tags.push("近 6 個月");
  else if (monthsAgo <= 12) tags.push("近 12 個月");

  if (input.propertyType === item.propertyType) {
    score += 16;
    tags.push("同類型");
  } else if (STANDARD_PROPERTY_TYPES.includes(input.propertyType) && STANDARD_PROPERTY_TYPES.includes(item.propertyType)) {
    score += 8;
    tags.push("住宅類型相近");
  }

  if (input.areaPing) {
    const diffRatio = Math.abs(item.areaPing - input.areaPing) / input.areaPing;
    score += clamp(12 - diffRatio * 28, 0, 12);
    if (diffRatio <= 0.18) tags.push("坪數相近");
  }

  if (input.ageYears !== undefined) {
    const diff = Math.abs(item.ageYears - input.ageYears);
    score += clamp(9 - diff * 0.45, 0, 9);
    if (diff <= 5) tags.push("屋齡相近");
  }

  if (input.floor !== undefined) {
    const diff = Math.abs(item.floor - input.floor);
    score += clamp(5 - diff * 0.5, 0, 5);
  }

  if (input.hasParking === item.hasParking) {
    score += 4;
    if (item.hasParking) tags.push("車位條件相近");
  }

  return {
    ...item,
    distanceMeters,
    monthsAgo,
    matchScore: Math.round(score),
    weight: Math.max(0.1, score / 100),
    tags,
  };
};

const getAdjustmentFactor = (input: PropertyInput) => {
  let factor = 1;
  const factors: string[] = [];

  if (input.condition === "新裝修") {
    factor += 0.04;
    factors.push("屋況為新裝修，單價以小幅加成處理");
  }
  if (input.condition === "良好") {
    factor += 0.02;
    factors.push("屋況良好，單價以小幅加成處理");
  }
  if (input.condition === "待整理") {
    factor -= 0.07;
    factors.push("屋況待整理，單價保守折減");
  }
  if (input.floor && input.totalFloors && input.floor === input.totalFloors) {
    factor -= 0.03;
    factors.push("頂樓物件可能受隔熱、漏水或加蓋疑慮影響");
  }
  if (input.hasParking) {
    factors.push("已含車位，總價區間反映車位差異與樣本混合不確定性");
  }
  if (input.specialFactors.length > 0) {
    factor -= MATERIAL_RISK_FACTORS.some((factorName) => input.specialFactors.includes(factorName)) ? 0.08 : 0;
    factors.push("特殊狀況會降低信心，價格折減須由人工確認");
  }

  return { factor: clamp(factor, 0.76, 1.12), factors };
};

const completenessScore = (input: PropertyInput) => {
  const fields = [
    input.address,
    input.lat,
    input.lng,
    input.propertyType,
    input.areaPing,
    input.floor,
    input.totalFloors,
    input.ageYears,
    input.parkingType,
    input.condition !== "未提供" ? input.condition : undefined,
  ];
  return (fields.filter(Boolean).length / fields.length) * 18;
};

const confidenceLevel = (score: number, notSuitable: boolean): ConfidenceLevel => {
  if (notSuitable) return "不適合自動估價";
  if (score >= 75) return "高信心";
  if (score >= 55) return "中信心";
  if (score >= 35) return "低信心";
  return "不適合自動估價";
};

const calcConfidence = (input: PropertyInput, cases: WeightedCase[], unitSpread: number) => {
  const sameCommunity = cases.filter((item) => communityEquals(input.communityName, item.communityName)).length;
  const sameRoad = cases.filter((item) => input.road && item.road === input.road).length;
  const recent = cases.filter((item) => item.monthsAgo <= 12).length;
  const close = cases.filter((item) => item.distanceMeters <= 1000).length;
  const avgMatch = cases.length
    ? cases.reduce((sum, item) => sum + item.matchScore, 0) / cases.length
    : 0;

  let score =
    Math.min(26, cases.length * 3.4) +
    Math.min(12, recent * 2.2) +
    Math.min(10, close * 2) +
    Math.min(10, sameRoad * 2.5 + sameCommunity * 4) +
    clamp(avgMatch / 4, 0, 24) +
    completenessScore(input);

  if (!STANDARD_PROPERTY_TYPES.includes(input.propertyType)) score -= 22;
  if (input.locationConfidence < 0.65) score -= 12;
  if (input.condition === "未提供") score -= 5;
  if (input.specialFactors.length) score -= 8 + input.specialFactors.length * 4;
  if (unitSpread > 0.34) score -= 10;
  if (cases.length < 4) score -= 14;
  if (recent < 2) score -= 8;

  return Math.round(clamp(score, 0, 100));
};

const makeNotSuitable = (input: PropertyInput, cases: WeightedCase[], reasons: string[]): ValuationResult => {
  const displayCases = orderCasesForDisplay(input, cases);
  return {
    status: "not-suitable",
    confidenceScore: 18,
    confidenceLevel: "不適合自動估價",
    casesUsed: displayCases,
    comparableCount: displayCases.length,
    recentComparableCount: displayCases.filter((item) => item.monthsAgo <= RECENT_TRANSACTION_MONTHS).length,
    communityComparableCount: displayCases.filter((item) => communityEquals(input.communityName, item.communityName)).length,
    nearestDistanceMeters: displayCases.length
      ? Math.min(...displayCases.map((item) => item.distanceMeters ?? Number.MAX_SAFE_INTEGER))
      : undefined,
    latestTransactionDate: displayCases
      .map((item) => item.transactionDate)
      .sort()
      .at(-1),
    reasons,
    warnings: [
      "此物件條件不適合由原型模型直接給出具體價格。",
      "建議改查區域行情，或委託估價師、銀行鑑價、專業仲介進行人工確認。",
    ],
    factors: ["低信心敢拒估：特殊產權、特殊交易或非標準住宅不應硬給單一價格。"],
    methodologySummary: "系統偵測到特殊風險或資料不足，因此停止自動估價並保留可參考案例。",
    generatedAt: new Date().toISOString(),
    valuationMode: input.valuationMode,
  };
};

const levelForEstimatedResult = (score: number): ConfidenceLevel => {
  if (score >= 75) return "高信心";
  if (score >= 55) return "中信心";
  return "低信心";
};

const withValuationMode = (result: ValuationResult, input: PropertyInput): ValuationResult => {
  const mode: ValuationSourceMode = input.valuationMode ?? "智慧估價";
  if (result.status === "not-suitable") return { ...result, valuationMode: mode };

  if (mode === "實價登錄") {
    return {
      ...result,
      valuationMode: mode,
      reasons: [
        `實價登錄模式：以 ${result.comparableCount} 筆公開成交欄位相容案例推估，不採用開價作為成交價。`,
        ...result.reasons,
      ],
      factors: ["成交資料優先：同社區、同路段、近 12 個月與條件相近案例權重較高。", ...result.factors],
      methodologySummary:
        "實價登錄模式以公開成交資料為主要依據；若正式匯入內政部 Open Data，可替換原型示範資料並保留相同估價邏輯。",
    };
  }

  if (mode === "開價搜尋") {
    const premium = result.confidenceScore >= 75 ? 1.045 : result.confidenceScore >= 55 ? 1.035 : 1.025;
    const highPremium = result.confidenceScore >= 75 ? 1.09 : 1.12;
    const nextConfidence = Math.max(35, result.confidenceScore - 8);
    const adjust = (value?: number, multiplier = 1) => (typeof value === "number" ? value * multiplier : undefined);
    return {
      ...result,
      totalLowWan: adjust(result.totalLowWan, 0.98),
      totalMedianWan: adjust(result.totalMedianWan, premium),
      totalHighWan: adjust(result.totalHighWan, highPremium),
      unitLowWan: adjust(result.unitLowWan, 0.98),
      unitMedianWan: adjust(result.unitMedianWan, premium),
      unitHighWan: adjust(result.unitHighWan, highPremium),
      confidenceScore: nextConfidence,
      confidenceLevel: levelForEstimatedResult(nextConfidence),
      valuationMode: mode,
      reasons: [
        "開價搜尋模式：目前不接商業開價資料庫，改以成交資料反推合理開價帶，避免把開價誤認為成交價。",
        `賣方常保留議價空間，本模式以成交中位價加上約 ${Math.round((premium - 1) * 100)}% 開價溢價作為參考。`,
        ...result.reasons,
      ],
      warnings: [
        ...result.warnings,
        "開價搜尋結果是成交資料反推的合理開價帶，不代表房仲平台實際刊登價，也不保證可成交。",
      ],
      factors: [
        "開價通常高於成交，但需回到成交證據、屋況與區域供需檢核；系統已因此降低信心分數。",
        ...result.factors,
      ],
      methodologySummary:
        "開價搜尋模式不使用付費或未授權房仲開價資料；以實價登錄成交帶、信心分數與一般議價溢價反推合理開價區間。",
    };
  }

  return {
    ...result,
    valuationMode: mode,
    reasons: [
      "智慧估價模式：同時檢核成交案例、地址定位、物件條件、資料完整度與特殊風險。",
      ...result.reasons,
    ],
  };
};

const fallbackComparableCases = (
  input: PropertyInput,
  transactions: TransactionCase[],
): WeightedCase[] => {
  const nearbyPool = transactions
    .filter((item) => {
      if (input.district && item.district === input.district && input.city === item.city) return true;
      if (!input.city || item.city !== input.city) return false;
      if (!input.lat || !input.lng) return true;
      return haversineMeters(input.lat, input.lng, item.lat, item.lng) <= 15000;
    })
    .sort((a, b) => {
      const communityDiff = Number(communityEquals(input.communityName, b.communityName)) - Number(communityEquals(input.communityName, a.communityName));
      if (communityDiff) return communityDiff;
      if (communityEquals(input.communityName, a.communityName) && communityEquals(input.communityName, b.communityName)) {
        return b.unitPriceWan - a.unitPriceWan;
      }
      if (!input.lat || !input.lng) return 0;
      return haversineMeters(input.lat, input.lng, a.lat, a.lng) - haversineMeters(input.lat, input.lng, b.lat, b.lng);
    });
  if (nearbyPool.length) {
    return nearbyPool.slice(0, 8).map((item, index) => ({
      ...item,
      distanceMeters:
        input.lat && input.lng ? haversineMeters(input.lat, input.lng, item.lat, item.lng) : 2500 + index * 300,
      monthsAgo: getMonthsAgo(item.transactionDate),
      matchScore: input.district && item.district === input.district ? 52 : 38,
      weight: input.district && item.district === input.district ? 0.48 : 0.32,
      tags: [input.district && item.district === input.district ? "行政區行情輔助" : "縣市行情輔助"],
    }));
  }

  const base = cityBaselines[input.city ?? ""] ?? 28;
  const area = input.areaPing ?? 30;
  const city = input.city ?? "全臺";
  const district = input.district ?? "未指定";
  const mainRoad = input.road?.replace(/[一二三四五六七八九十0-9０-９]+段$/, "") || "中正路";
  const roadNames = [
    mainRoad,
    "中山路",
    "民生路",
    "成功路",
    "大同路",
    "復興路",
    "文化路",
    "和平路",
    "光明路",
    "建國路",
    "公園路",
    "民族路",
  ];
  const communityNames = [
    `${district}市心景觀社區`,
    `${district}公園首席`,
    `${district}新生活大樓`,
    `${district}河岸花園`,
    `${district}捷運生活宅`,
    `${district}文教首府`,
    `${district}晴光華廈`,
    `${district}都會名邸`,
    `${district}綠景大樓`,
    `${district}核心公寓`,
    `${district}安居社區`,
    `${district}悅居華廈`,
  ];
  const factors = [0.86, 0.91, 0.95, 0.98, 1, 1.03, 1.06, 1.09, 1.12, 0.89, 0.97, 1.05];
  const typeCycle: PropertyType[] = ["住宅大樓", "華廈", "公寓", "住宅大樓", "套房", "住宅大樓"];
  return factors.map((factor, index) => ({
    id: `fallback-${city}-${district}-${index}`,
    source: "DEMO_MOI_COMPATIBLE",
    sourceLabel: "公開欄位相容參考案例：正式版匯入實價登錄後顯示真實地址",
    sourceUrl: DATA_SOURCES.moiOpenData,
    dataVersion: "2026-04-30 fallback",
    city,
    district,
    road: roadNames[index % roadNames.length],
    addressLabel: `${city}${district}${roadNames[index % roadNames.length]} ${120 + index * 18} 號周邊`,
    communityName: communityNames[index % communityNames.length],
    lat: (input.lat ?? 23.8) + (index % 4) * 0.0028 - 0.0042,
    lng: (input.lng ?? 121) + Math.floor(index / 4) * 0.0032 - 0.0032,
    propertyType: typeCycle[index % typeCycle.length],
    areaPing: Math.max(8, Number((area * (0.82 + (index % 5) * 0.09)).toFixed(1))),
    floor: Math.max(2, (input.floor ?? 5) + (index % 7) - 3),
    totalFloors: Math.max(input.totalFloors ?? 12, 5 + (index % 9)),
    ageYears: Math.max(1, (input.ageYears ?? 18) + (index % 8) - 4),
    hasParking: index % 3 !== 0 ? input.hasParking : false,
    parkingType: index % 3 !== 0 ? input.parkingType : "無",
    transactionDate: `2026-${String(Math.max(1, 4 - (index % 4))).padStart(2, "0")}-${String(6 + index * 2).padStart(2, "0")}`,
    totalPriceWan: base * factor * area,
    unitPriceWan: base * factor,
    distanceMeters: 650 + index * 260,
    monthsAgo: 1 + (index % 8),
    matchScore: 46 - Math.floor(index / 2),
    weight: 0.34 - index * 0.006,
    tags: ["同區域參考", "地址層級樣本", index < 8 ? "近 12 個月" : "補充樣本"],
  }));
};

const uniqueWeightedCases = (cases: WeightedCase[]) => {
  const seen = new Set<string>();
  return cases.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

export const estimateProperty = (
  input: PropertyInput,
  transactions: TransactionCase[] = demoTransactions,
): ValuationResult => {
  const allScoredCases = transactions
    .map((item) => scoreCase(input, item))
    .filter((item): item is WeightedCase => Boolean(item))
    .sort((a, b) => b.weight - a.weight);

  const sameCommunityCases = allScoredCases.filter((item) => communityEquals(input.communityName, item.communityName));
  let scoredCases = uniqueWeightedCases([
    ...sameCommunityCases.sort((a, b) => b.unitPriceWan - a.unitPriceWan || a.monthsAgo - b.monthsAgo),
    ...allScoredCases.filter((item) => !communityEquals(input.communityName, item.communityName)),
  ]).slice(0, 24);

  const originalScoredCount = scoredCases.length;
  const usedFallback = scoredCases.length < 8;
  let fallbackCases: WeightedCase[] = [];
  if (usedFallback) {
    fallbackCases = fallbackComparableCases(input, transactions);
    scoredCases = uniqueWeightedCases([...scoredCases, ...fallbackCases])
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 24);
  }
  const recentDisplayPool = allScoredCases.filter((item) => item.monthsAgo <= RECENT_TRANSACTION_MONTHS);
  const displayCases = orderCasesForDisplay(input, [
    ...sameCommunityCases,
    ...recentDisplayPool,
    ...scoredCases,
    ...fallbackCases,
  ]);

  const hardStop = input.specialFactors.some((factor) => HARD_STOP_FACTORS.includes(factor));
  const unsupported = !STANDARD_PROPERTY_TYPES.includes(input.propertyType);
  const invalidArea = input.areaPing !== undefined && (input.areaPing < 5 || input.areaPing > 160);
  const missingLocation = !input.lat || !input.lng;

  const stopReasons: string[] = [];
  if (hardStop) stopReasons.push("包含凶宅、持分、法拍、地上權或特殊產權等高風險條件。");
  if (unsupported) stopReasons.push(`${input.propertyType} 第一版不列為標準住宅自動估價範圍。`);
  if (invalidArea) stopReasons.push("權狀坪數落在不合理區間。");
  if (missingLocation) stopReasons.push("地址尚未定位，無法取得周邊成交距離。");
  if (usedFallback) stopReasons.push("周邊 36 個月內可比成交案例少於 8 筆，已補入地址層級參考樣本。");

  if (stopReasons.length && (hardStop || unsupported || invalidArea || missingLocation)) {
    return makeNotSuitable(input, scoredCases, stopReasons);
  }

  const { factor: conditionFactor, factors } = getAdjustmentFactor(input);
  const unitP15 = weightedPercentile(scoredCases, 0.15);
  const unitP50 = weightedPercentile(scoredCases, 0.5);
  const unitP85 = weightedPercentile(scoredCases, 0.85);
  const rawSpread = unitP50 ? (unitP85 - unitP15) / unitP50 : 1;
  const confidence = usedFallback
    ? Math.min(originalScoredCount > 0 ? 62 : 48, calcConfidence(input, scoredCases, rawSpread))
    : calcConfidence(input, scoredCases, rawSpread);
  if (confidence < 35) {
    return makeNotSuitable(input, scoredCases, [
      ...stopReasons,
      "可比案例數量、相似度或資料完整度不足，信心分數低於自動估價門檻。",
    ]);
  }
  const lowConfidence = confidence < 35 || scoredCases.length < 4;
  const uncertainty = confidence >= 75 ? 0.065 : confidence >= 55 ? 0.105 : 0.18;
  const unitMedian = unitP50 * conditionFactor;
  const rawUnitLow = Math.min(unitMedian, Math.max(unitP15 * conditionFactor, unitMedian * (1 - uncertainty)));
  const rawUnitHigh = Math.max(unitMedian, Math.min(unitP85 * conditionFactor, unitMedian * (1 + uncertainty)));
  const minimumHalfWidth = unitMedian * (confidence >= 75 ? 0.035 : confidence >= 55 ? 0.055 : 0.09);
  const unitLow = Math.max(0, Math.min(rawUnitLow, unitMedian - minimumHalfWidth));
  const unitHigh = Math.max(rawUnitHigh, unitMedian + minimumHalfWidth);
  const areaPing = input.areaPing ?? median(scoredCases.map((item) => item.areaPing));
  const totalLow = unitLow * areaPing;
  const totalMedian = unitMedian * areaPing;
  const totalHigh = unitHigh * areaPing;
  const level = confidenceLevel(confidence, false);

  const warnings: string[] = [];
  if (usedFallback) warnings.push("此結果補入地址層級參考樣本；正式版匯入完整實價登錄後會顯示真實成交地址，信心已降低。");
  if (!input.areaPing) warnings.push("未提供權狀坪數，總價暫以可比案例中位坪數估算；補入坪數後會重新計算。");
  if (lowConfidence) warnings.push("可比成交或條件相似度不足，價格區間已加寬，請勿作為交易或授信決策。");
  if (scoredCases.filter((item) => item.monthsAgo <= RECENT_TRANSACTION_MONTHS).length < 3) {
    warnings.push("近 12 個月類似成交不足，已納入較舊案例並降低信心。");
  }
  if (rawSpread > 0.34) warnings.push("周邊成交單價離散度偏高，可能代表產品差異或市場波動。");
  if (input.specialFactors.length) warnings.push("特殊狀況需要人工查證，系統僅能做保守參考。");

  const reasons = [
    usedFallback
      ? `周邊樣本偏少，改採 ${displayCases.length} 筆周邊成交與地址層級參考案例輔助估算。`
      : `採用 ${displayCases.length} 筆 36 個月內、10 公里內的可比成交案例。`,
    `其中 ${displayCases.filter((item) => item.monthsAgo <= RECENT_TRANSACTION_MONTHS).length} 筆為近 12 個月成交，${displayCases.filter((item) => item.distanceMeters <= 1000).length} 筆距離 1 公里內。`,
    input.road
      ? `優先比對同社區、${input.road} 同路段與同行政區案例。`
      : "地址路段尚未完整解析，因此以距離、行政區與產品條件比對。",
  ];

  return withValuationMode({
    status: lowConfidence ? "low-confidence" : "estimated",
    totalLowWan: totalLow,
    totalMedianWan: totalMedian,
    totalHighWan: totalHigh,
    unitLowWan: unitLow,
    unitMedianWan: unitMedian,
    unitHighWan: unitHigh,
    confidenceScore: confidence,
    confidenceLevel: level,
    casesUsed: displayCases,
    comparableCount: displayCases.length,
    recentComparableCount: displayCases.filter((item) => item.monthsAgo <= RECENT_TRANSACTION_MONTHS).length,
    communityComparableCount: displayCases.filter((item) => communityEquals(input.communityName, item.communityName)).length,
    nearestDistanceMeters: displayCases.length
      ? Math.min(...displayCases.map((item) => item.distanceMeters ?? Number.MAX_SAFE_INTEGER))
      : undefined,
    latestTransactionDate: displayCases
      .map((item) => item.transactionDate)
      .sort()
      .at(-1),
    reasons,
    warnings,
    factors,
    methodologySummary:
      "以實價登錄成交資料為主，依同社區/同路段/距離、交易時間、建物型態、坪數、屋齡、樓層與車位條件加權，輸出價格區間而非單一價格。",
    generatedAt: new Date().toISOString(),
  }, input);
};

export const getNearbyTransactions = (
  lat: number,
  lng: number,
  radiusMeters = 2500,
  transactions: TransactionCase[] = demoTransactions,
) =>
  transactions
    .map((item) => ({
      ...item,
      distanceMeters: haversineMeters(lat, lng, item.lat, item.lng),
    }))
    .filter((item) => item.distanceMeters <= radiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

export const getMarketStats = (
  city?: string,
  district?: string,
  road?: string,
  transactions: TransactionCase[] = demoTransactions,
): MarketStats[] => {
  const filtered = transactions.filter((item) => {
    if (city && item.city !== city) return false;
    if (district && item.district !== district) return false;
    if (road && item.road !== road) return false;
    return true;
  });

  const groups = new Map<string, TransactionCase[]>();
  filtered.forEach((item) => {
    const label = road
      ? `${item.city}${item.district}${item.road}`
      : district
        ? `${item.city}${item.district}`
        : item.city;
    const category = marketSegment(item);
    const key = `${label}|${category.segment}|${category.definition}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  });

  const stats = [...groups.entries()]
    .map(([key, cases]) => {
      const [label, segment, status] = key.split("|");
      const sorted = cases.map((item) => item.unitPriceWan).sort((a, b) => a - b);
      return {
        label,
        segment,
        transactionStatus: status,
        count: cases.length,
        medianUnitPriceWan: median(sorted),
        lowUnitPriceWan: sorted[Math.max(0, Math.floor(sorted.length * 0.15))],
        highUnitPriceWan: sorted[Math.max(0, Math.ceil(sorted.length * 0.85) - 1)],
        latestDate: cases.map((item) => item.transactionDate).sort().at(-1),
        propertyTypes: [...new Set(cases.map((item) => item.propertyType))],
      };
    })
    .sort((a, b) => {
      const aOrder = marketCategoryMeta.findIndex((item) => item.segment === a.segment);
      const bOrder = marketCategoryMeta.findIndex((item) => item.segment === b.segment);
      return aOrder - bOrder || b.count - a.count;
    });
  if (!stats.length) return fallbackMarketStats(city, district);
  const fallback = fallbackMarketStats(city, district);
  return marketCategoryMeta.map(({ segment }) => stats.find((item) => item.segment === segment) ?? fallback.find((item) => item.segment === segment)!);
};
