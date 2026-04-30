import { demoTransactions } from "../data/demoTransactions";
import type { PropertyInput, RentalMarketStats, RentalReferenceCase, RentalValuationResult, TransactionCase, WeightedCase } from "../types";
import { clamp, haversineMeters } from "../utils/format";
import { estimateProperty, getMarketStats } from "./valuation";

const yieldByCity: Record<string, number> = {
  臺北市: 2.05,
  新北市: 2.25,
  桃園市: 2.65,
  臺中市: 2.55,
  臺南市: 2.75,
  高雄市: 2.8,
};

const propertyTypeRentFactor: Record<string, number> = {
  住宅大樓: 1,
  華廈: 0.96,
  公寓: 0.9,
  套房: 1.22,
  透天: 0.82,
  店面: 1.45,
  辦公室: 1.18,
};

const estimateYield = (input: PropertyInput, item?: TransactionCase) => {
  const cityYield = yieldByCity[input.city ?? item?.city ?? ""] ?? 2.75;
  const typeFactor = propertyTypeRentFactor[input.propertyType] ?? propertyTypeRentFactor[item?.propertyType ?? ""] ?? 1;
  const agePenalty = Math.max(0.86, 1 - ((input.ageYears ?? item?.ageYears ?? 15) / 100) * 0.55);
  const parkingLift = input.hasParking ? 1.04 : 1;
  return clamp(cityYield * typeFactor * agePenalty * parkingLift, 1.45, 4.2);
};

const toRentalReference = (item: WeightedCase, input: PropertyInput): RentalReferenceCase => {
  const grossYieldPct = estimateYield(input, item);
  const monthly = (item.totalPriceWan * 10000 * (grossYieldPct / 100)) / 12;
  const area = Math.max(1, item.areaPing);
  return {
    ...item,
    grossYieldPct,
    estimatedMonthlyRentTwd: Math.round(monthly),
    rentPerPingTwd: Math.round(monthly / area),
  };
};

const median = (values: number[]) => {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export const estimateRental = (input: PropertyInput, source: TransactionCase[] = demoTransactions): RentalValuationResult => {
  const saleResult = estimateProperty(input, source);
  const references = saleResult.casesUsed.map((item) => toRentalReference(item, input));
  const area = Math.max(1, input.areaPing ?? 30);
  const baseYield = estimateYield(input);
  const saleMedian = saleResult.totalMedianWan ?? median(references.map((item) => item.totalPriceWan)) ?? 0;
  const referenceRentMedian = median(references.map((item) => item.rentPerPingTwd));
  const rentPerPingMedian = referenceRentMedian ?? Math.round(((saleMedian * 10000 * (baseYield / 100)) / 12) / area);
  const monthlyMedian = Math.round(rentPerPingMedian * area);
  const rangeSpread = saleResult.confidenceScore >= 70 ? 0.14 : saleResult.confidenceScore >= 50 ? 0.2 : 0.3;
  const confidenceScore = clamp(saleResult.confidenceScore - 12, 12, 88);
  const status = saleResult.status === "not-suitable" ? "not-suitable" : confidenceScore < 45 ? "low-confidence" : "estimated";

  return {
    status,
    monthlyLowTwd: Math.round(monthlyMedian * (1 - rangeSpread)),
    monthlyMedianTwd: monthlyMedian,
    monthlyHighTwd: Math.round(monthlyMedian * (1 + rangeSpread)),
    rentPerPingLowTwd: Math.round(rentPerPingMedian * (1 - rangeSpread)),
    rentPerPingMedianTwd: Math.round(rentPerPingMedian),
    rentPerPingHighTwd: Math.round(rentPerPingMedian * (1 + rangeSpread)),
    grossYieldPct: baseYield,
    confidenceScore,
    confidenceLevel: confidenceScore >= 72 ? "高信心" : confidenceScore >= 48 ? "中信心" : "低信心",
    referencesUsed: references,
    comparableCount: references.length,
    nearestDistanceMeters: saleResult.nearestDistanceMeters,
    latestReferenceDate: saleResult.latestTransactionDate,
    reasons: [
      "以周邊可比成交總價換算區域租金投報率，作為租屋行情原型參考。",
      `目前推估年租金投報率約 ${baseYield.toFixed(2)}%。`,
      "租屋行情需再比對實際刊登租金、管理費、家具家電、可入戶時間與租約條件。",
    ],
    warnings: [
      "目前原型尚未接入租賃實價登錄批次資料，租金為公開成交資料換算模型，不是正式租金鑑價。",
      ...saleResult.warnings,
    ],
    factors: saleResult.factors,
    methodologySummary: "租屋模式以公開成交樣本、行政區租金投報假設、建物類型、屋齡、坪數與車位條件換算月租區間。",
    generatedAt: new Date().toISOString(),
  };
};

export const getNearbyRentalReferences = (lat: number, lng: number, radiusMeters = 3500, input?: PropertyInput) =>
  demoTransactions
    .map((item) => ({
      ...item,
      distanceMeters: haversineMeters(lat, lng, item.lat, item.lng),
      monthsAgo: 8,
      matchScore: 72,
      weight: 1,
      tags: ["租金換算", "公開成交樣本"],
    }))
    .filter((item) => item.distanceMeters <= radiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 24)
    .map((item) => toRentalReference(item, input ?? {
      address: "",
      locationConfidence: 0.7,
      propertyType: item.propertyType,
      areaPing: item.areaPing,
      hasParking: item.hasParking,
      parkingType: item.parkingType,
      condition: "一般",
      occupancy: "出租中",
      specialFactors: [],
    }));

export const getRentalMarketStats = (city: string, district: string): RentalMarketStats[] =>
  getMarketStats(city, district).map((item) => {
    const grossYield = yieldByCity[city] ?? 2.75;
    const medianMonthlyRent = (item.medianUnitPriceWan * 10000 * 30 * (grossYield / 100)) / 12;
    return {
      label: item.label,
      segment: item.segment,
      count: item.count,
      medianMonthlyRentTwd: Math.round(medianMonthlyRent),
      lowMonthlyRentTwd: Math.round(medianMonthlyRent * 0.82),
      highMonthlyRentTwd: Math.round(medianMonthlyRent * 1.2),
      medianRentPerPingTwd: Math.round(medianMonthlyRent / 30),
      latestDate: item.latestDate,
    };
  });
