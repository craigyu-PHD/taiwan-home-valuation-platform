import { DATA_SOURCES, demoTransactions } from "../data/demoTransactions";
import type {
  ConfidenceLevel,
  MarketStats,
  PropertyInput,
  PropertyType,
  SpecialFactor,
  TransactionCase,
  ValuationResult,
  WeightedCase,
} from "../types";
import { clamp, haversineMeters } from "../utils/format";

const DEMO_REFERENCE_DATE = new Date("2026-04-30T00:00:00+08:00");
const STANDARD_PROPERTY_TYPES: PropertyType[] = ["住宅大樓", "華廈", "公寓", "套房"];
const HARD_STOP_FACTORS: SpecialFactor[] = ["凶宅", "持分", "法拍", "地上權", "特殊產權"];
const MATERIAL_RISK_FACTORS: SpecialFactor[] = ["頂樓加蓋", "違建", "漏水", "嚴重屋況", "其他"];

export const createDefaultInput = (): PropertyInput => ({
  address: "臺北市信義區信義路五段 7 號",
  city: "臺北市",
  district: "信義區",
  road: "信義路五段",
  lat: 25.033964,
  lng: 121.564468,
  locationConfidence: 0.9,
  propertyType: "住宅大樓",
  areaPing: 32,
  floor: 10,
  totalFloors: 18,
  ageYears: 12,
  hasParking: true,
  parkingType: "坡道平面",
  condition: "一般",
  occupancy: "自住",
  specialFactors: [],
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

const transactionStatus = (item: TransactionCase) => {
  if (item.note?.includes("預售")) return "預售屋";
  if (item.ageYears <= 3) return "新成屋";
  return "中古屋";
};

const fallbackMarketStats = (city?: string, district?: string): MarketStats[] => {
  const base = cityBaselines[city ?? ""] ?? 25;
  const label = `${city ?? "全臺"}${district ?? ""}`;
  const segments = [
    ["住宅大樓", "中古屋", 1],
    ["華廈", "中古屋", 0.86],
    ["公寓", "中古屋", 0.72],
    ["住宅大樓", "新成屋", 1.12],
    ["住宅大樓", "預售屋", 1.18],
  ] as const;
  return segments.map(([segment, status, factor]) => {
    const medianPrice = base * factor;
    return {
      label,
      segment,
      transactionStatus: status,
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

  if (input.communityName && input.communityName === item.communityName) {
    score += 34;
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
  const sameCommunity = cases.filter((item) => input.communityName && item.communityName === input.communityName).length;
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

const makeNotSuitable = (input: PropertyInput, cases: WeightedCase[], reasons: string[]): ValuationResult => ({
  status: "not-suitable",
  confidenceScore: 18,
  confidenceLevel: "不適合自動估價",
  casesUsed: cases.slice(0, 8),
  comparableCount: cases.length,
  recentComparableCount: cases.filter((item) => item.monthsAgo <= 12).length,
  communityComparableCount: cases.filter(
    (item) => input.communityName && item.communityName === input.communityName,
  ).length,
  nearestDistanceMeters: cases[0]?.distanceMeters,
  latestTransactionDate: cases
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
});

const fallbackComparableCases = (
  input: PropertyInput,
  transactions: TransactionCase[],
): WeightedCase[] => {
  const nearbyPool = transactions.filter(
    (item) =>
      (input.district && item.district === input.district) ||
      (input.city && item.city === input.city),
  );
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
  return [0.92, 1, 1.08].map((factor, index) => ({
    id: `fallback-${input.city ?? "taiwan"}-${input.district ?? "area"}-${index}`,
    source: "DEMO_MOI_COMPATIBLE",
    sourceLabel: "區域行情 fallback：公開資料不足時的低信心參考",
    sourceUrl: DATA_SOURCES.moiOpenData,
    dataVersion: "2026-04-30 fallback",
    city: input.city ?? "全臺",
    district: input.district ?? "未指定",
    road: input.road ?? "",
    addressLabel: `${input.city ?? "全臺"}${input.district ?? ""}區域行情輔助樣本`,
    lat: input.lat ?? 23.8,
    lng: input.lng ?? 121,
    propertyType: input.propertyType,
    areaPing: input.areaPing ?? 30,
    floor: input.floor ?? 5,
    totalFloors: input.totalFloors ?? 12,
    ageYears: input.ageYears ?? 18,
    hasParking: input.hasParking,
    parkingType: input.parkingType,
    transactionDate: "2026-01-01",
    totalPriceWan: base * factor * (input.areaPing ?? 30),
    unitPriceWan: base * factor,
    distanceMeters: 3500 + index * 900,
    monthsAgo: 3 + index * 2,
    matchScore: 28 - index * 3,
    weight: 0.22,
    tags: ["低信心區域行情"],
  }));
};

export const estimateProperty = (
  input: PropertyInput,
  transactions: TransactionCase[] = demoTransactions,
): ValuationResult => {
  let scoredCases = transactions
    .map((item) => scoreCase(input, item))
    .filter((item): item is WeightedCase => Boolean(item))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 18);

  const usedFallback = scoredCases.length < 3;
  if (usedFallback) {
    scoredCases = [...scoredCases, ...fallbackComparableCases(input, transactions)]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 18);
  }

  const hardStop = input.specialFactors.some((factor) => HARD_STOP_FACTORS.includes(factor));
  const unsupported = !STANDARD_PROPERTY_TYPES.includes(input.propertyType);
  const invalidArea = !input.areaPing || input.areaPing < 5 || input.areaPing > 160;
  const missingLocation = !input.lat || !input.lng;

  const stopReasons: string[] = [];
  if (hardStop) stopReasons.push("包含凶宅、持分、法拍、地上權或特殊產權等高風險條件。");
  if (unsupported) stopReasons.push(`${input.propertyType} 第一版不列為標準住宅自動估價範圍。`);
  if (invalidArea) stopReasons.push("權狀坪數未提供或落在不合理區間。");
  if (missingLocation) stopReasons.push("地址尚未定位，無法取得周邊成交距離。");
  if (usedFallback) stopReasons.push("周邊 36 個月內可比成交案例不足 3 筆，已改用區域行情輔助。");

  if (stopReasons.length && (hardStop || unsupported || invalidArea || missingLocation)) {
    return makeNotSuitable(input, scoredCases, stopReasons);
  }

  const { factor: conditionFactor, factors } = getAdjustmentFactor(input);
  const unitP15 = weightedPercentile(scoredCases, 0.15);
  const unitP50 = weightedPercentile(scoredCases, 0.5);
  const unitP85 = weightedPercentile(scoredCases, 0.85);
  const rawSpread = unitP50 ? (unitP85 - unitP15) / unitP50 : 1;
  const confidence = usedFallback
    ? Math.min(48, calcConfidence(input, scoredCases, rawSpread))
    : calcConfidence(input, scoredCases, rawSpread);
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
  if (usedFallback) warnings.push("此結果使用行政區或縣市行情輔助，不是完整周邊可比估價，信心已降低。");
  if (lowConfidence) warnings.push("可比成交或條件相似度不足，價格區間已加寬，請勿作為交易或授信決策。");
  if (scoredCases.filter((item) => item.monthsAgo <= 12).length < 3) {
    warnings.push("近 12 個月類似成交不足，已納入較舊案例並降低信心。");
  }
  if (rawSpread > 0.34) warnings.push("周邊成交單價離散度偏高，可能代表產品差異或市場波動。");
  if (input.specialFactors.length) warnings.push("特殊狀況需要人工查證，系統僅能做保守參考。");

  const reasons = [
    usedFallback
      ? `周邊案例不足，改採 ${scoredCases.length} 筆區域行情與可比案例輔助估算。`
      : `採用 ${scoredCases.length} 筆 36 個月內、10 公里內的可比成交案例。`,
    `其中 ${scoredCases.filter((item) => item.monthsAgo <= 12).length} 筆為近 12 個月成交，${scoredCases.filter((item) => item.distanceMeters <= 1000).length} 筆距離 1 公里內。`,
    input.road
      ? `優先比對同社區、${input.road} 同路段與同行政區案例。`
      : "地址路段尚未完整解析，因此以距離、行政區與產品條件比對。",
  ];

  return {
    status: lowConfidence ? "low-confidence" : "estimated",
    totalLowWan: totalLow,
    totalMedianWan: totalMedian,
    totalHighWan: totalHigh,
    unitLowWan: unitLow,
    unitMedianWan: unitMedian,
    unitHighWan: unitHigh,
    confidenceScore: confidence,
    confidenceLevel: level,
    casesUsed: scoredCases,
    comparableCount: scoredCases.length,
    recentComparableCount: scoredCases.filter((item) => item.monthsAgo <= 12).length,
    communityComparableCount: scoredCases.filter(
      (item) => input.communityName && item.communityName === input.communityName,
    ).length,
    nearestDistanceMeters: scoredCases[0]?.distanceMeters,
    latestTransactionDate: scoredCases
      .map((item) => item.transactionDate)
      .sort()
      .at(-1),
    reasons,
    warnings,
    factors,
    methodologySummary:
      "以實價登錄成交資料為主，依同社區/同路段/距離、交易時間、建物型態、坪數、屋齡、樓層與車位條件加權，輸出價格區間而非單一價格。",
    generatedAt: new Date().toISOString(),
  };
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
    const key = `${label}|${item.propertyType}|${transactionStatus(item)}`;
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
    .sort((a, b) => b.count - a.count);
  return stats.length ? stats : fallbackMarketStats(city, district);
};
