export type PropertyType =
  | "住宅大樓"
  | "華廈"
  | "公寓"
  | "套房"
  | "透天"
  | "店面"
  | "辦公室"
  | "廠房"
  | "農舍"
  | "其他";

export type ParkingType = "無" | "坡道平面" | "坡道機械" | "機械" | "平面" | "其他";

export type PropertyCondition = "未提供" | "待整理" | "一般" | "良好" | "新裝修";

export type Occupancy = "未提供" | "自住" | "出租中" | "空屋" | "自用營業";

export type SpecialFactor =
  | "頂樓加蓋"
  | "違建"
  | "漏水"
  | "凶宅"
  | "持分"
  | "法拍"
  | "地上權"
  | "特殊產權"
  | "嚴重屋況"
  | "其他";

export interface LocationCandidate {
  id: string;
  label: string;
  city?: string;
  district?: string;
  road?: string;
  lat: number;
  lng: number;
  confidence: number;
  source: "local" | "nominatim" | "manual";
}

export interface PropertyInput {
  address: string;
  city?: string;
  district?: string;
  road?: string;
  communityName?: string;
  lat?: number;
  lng?: number;
  locationConfidence: number;
  propertyType: PropertyType;
  areaPing?: number;
  floor?: number;
  totalFloors?: number;
  ageYears?: number;
  hasParking: boolean;
  parkingType: ParkingType;
  condition: PropertyCondition;
  occupancy: Occupancy;
  specialFactors: SpecialFactor[];
}

export interface TransactionCase {
  id: string;
  source: "DEMO_MOI_COMPATIBLE" | "MOI_OPEN_DATA";
  sourceLabel: string;
  sourceUrl?: string;
  dataVersion: string;
  city: string;
  district: string;
  road: string;
  addressLabel: string;
  communityName?: string;
  lat: number;
  lng: number;
  propertyType: PropertyType;
  areaPing: number;
  floor: number;
  totalFloors: number;
  ageYears: number;
  hasParking: boolean;
  parkingType: ParkingType;
  transactionDate: string;
  totalPriceWan: number;
  unitPriceWan: number;
  note?: string;
}

export interface WeightedCase extends TransactionCase {
  distanceMeters: number;
  monthsAgo: number;
  matchScore: number;
  weight: number;
  tags: string[];
}

export type ConfidenceLevel = "高信心" | "中信心" | "低信心" | "不適合自動估價";

export interface ValuationResult {
  status: "estimated" | "low-confidence" | "not-suitable";
  totalLowWan?: number;
  totalMedianWan?: number;
  totalHighWan?: number;
  unitLowWan?: number;
  unitMedianWan?: number;
  unitHighWan?: number;
  confidenceScore: number;
  confidenceLevel: ConfidenceLevel;
  casesUsed: WeightedCase[];
  comparableCount: number;
  recentComparableCount: number;
  communityComparableCount: number;
  nearestDistanceMeters?: number;
  latestTransactionDate?: string;
  reasons: string[];
  warnings: string[];
  factors: string[];
  methodologySummary: string;
  generatedAt: string;
}

export interface MarketStats {
  label: string;
  segment: string;
  transactionStatus: string;
  count: number;
  medianUnitPriceWan: number;
  lowUnitPriceWan: number;
  highUnitPriceWan: number;
  latestDate?: string;
  propertyTypes: string[];
}
