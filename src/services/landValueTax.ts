import { clamp } from "../utils/format";

export interface LandValueTaxInput {
  currentLandValue: number;
  previousLandValue: number;
  cpiFactor: number;
  landAreaSqm: number;
  shareNumerator: number;
  shareDenominator: number;
  acquisitionYear?: number;
  isUrban: boolean;
  selfUse: "yes" | "no" | "unknown";
  usedOnce: "yes" | "no" | "unknown";
  rentedOrBusinessLastYear: "yes" | "no" | "unknown";
  householdRegistered: "yes" | "no" | "unknown";
  ownsOtherHouse: "yes" | "no" | "unknown";
  improvementCost: number;
  benefitFee: number;
  rezoningDonationValue: number;
  landReadjustmentCost: number;
  extraLandTaxCredit: number;
  checkRepurchase: "yes" | "no" | "unknown";
  newPurchaseLandValue: number;
}

export interface LandValueTaxResult {
  transferAreaSqm: number;
  adjustedPreviousValue: number;
  deductions: number;
  gain: number;
  gainRatio: number;
  generalTax: number;
  selfUseTax?: number;
  saving?: number;
  longTermReductionRate: number;
  bestTax: number;
  confidenceScore: number;
  confidenceLabel: "高" | "中" | "低";
  selfUseEligibility: string;
  repurchaseNote: string;
  warnings: string[];
}

export const defaultLandValueTaxInput = (estimatedTotalWan?: number, acquisitionYear?: number): LandValueTaxInput => ({
  currentLandValue: Math.round((estimatedTotalWan ?? 3600) * 10000 * 0.42),
  previousLandValue: Math.round((estimatedTotalWan ?? 3600) * 10000 * 0.22),
  cpiFactor: 1.12,
  landAreaSqm: 90,
  shareNumerator: 1,
  shareDenominator: 1,
  acquisitionYear: acquisitionYear ?? 2014,
  isUrban: true,
  selfUse: "unknown",
  usedOnce: "unknown",
  rentedOrBusinessLastYear: "unknown",
  householdRegistered: "unknown",
  ownsOtherHouse: "unknown",
  improvementCost: 0,
  benefitFee: 0,
  rezoningDonationValue: 0,
  landReadjustmentCost: 0,
  extraLandTaxCredit: 0,
  checkRepurchase: "unknown",
  newPurchaseLandValue: 0,
});

const progressiveGeneralTax = (gain: number, adjustedPreviousValue: number) => {
  if (gain <= 0) return 0;
  const base = Math.max(1, adjustedPreviousValue);
  const firstBand = base;
  const secondBand = base;
  const first = Math.min(gain, firstBand) * 0.2;
  const second = Math.min(Math.max(0, gain - firstBand), secondBand) * 0.3;
  const third = Math.max(0, gain - firstBand - secondBand) * 0.4;
  return first + second + third;
};

const getHoldingYears = (year?: number) => (year ? new Date().getFullYear() - year : 0);

export const calculateLandValueTax = (input: LandValueTaxInput): LandValueTaxResult => {
  const share = input.shareDenominator ? input.shareNumerator / input.shareDenominator : 1;
  const transferAreaSqm = Math.max(0, input.landAreaSqm * share);
  const adjustedPreviousValue = Math.max(0, input.previousLandValue * input.cpiFactor);
  const deductions =
    adjustedPreviousValue +
    input.improvementCost +
    input.benefitFee +
    input.rezoningDonationValue +
    input.landReadjustmentCost;
  const gain = Math.max(0, input.currentLandValue - deductions);
  const rawGeneralTax = progressiveGeneralTax(gain, adjustedPreviousValue);
  const holdingYears = getHoldingYears(input.acquisitionYear);
  const reductionRate = holdingYears >= 40 ? 0.4 : holdingYears >= 30 ? 0.3 : holdingYears >= 20 ? 0.2 : 0;
  const minimumTax = gain * 0.2;
  const generalTax = Math.max(0, minimumTax + Math.max(0, rawGeneralTax - minimumTax) * (1 - reductionRate) - input.extraLandTaxCredit);
  const selfUseAreaLimit = input.usedOnce === "yes" ? (input.isUrban ? 150 : 350) : input.isUrban ? 300 : 700;
  const selfUseAnswers = [input.selfUse, input.rentedOrBusinessLastYear, input.householdRegistered, input.ownsOtherHouse];
  const hasUnknown = selfUseAnswers.includes("unknown");
  const eligibleSelfUse =
    input.selfUse === "yes" &&
    input.rentedOrBusinessLastYear === "no" &&
    input.householdRegistered === "yes" &&
    (input.usedOnce === "no" || input.ownsOtherHouse === "no") &&
    transferAreaSqm <= selfUseAreaLimit;
  const selfUseTax = input.selfUse === "yes" || hasUnknown ? Math.max(0, gain * 0.1 - input.extraLandTaxCredit) : undefined;
  const bestTax = eligibleSelfUse && selfUseTax !== undefined ? Math.min(generalTax, selfUseTax) : generalTax;
  const warnings = [
    !input.previousLandValue ? "缺少前次移轉現值或原規定地價，不能精準試算。" : "",
    !input.landAreaSqm ? "缺少土地面積，優惠面積限制無法判斷。" : "",
    hasUnknown ? "自用住宅資格仍有不確定項目，優惠稅額僅為概算。" : "",
  ].filter(Boolean);
  const confidenceScore = clamp(
    88 -
      (!input.previousLandValue ? 28 : 0) -
      (!input.landAreaSqm ? 18 : 0) -
      (hasUnknown ? 18 : 0) -
      (!input.acquisitionYear ? 10 : 0),
    18,
    92,
  );

  return {
    transferAreaSqm,
    adjustedPreviousValue,
    deductions,
    gain,
    gainRatio: adjustedPreviousValue ? gain / adjustedPreviousValue : 0,
    generalTax: Math.round(generalTax),
    selfUseTax: selfUseTax === undefined ? undefined : Math.round(selfUseTax),
    saving: selfUseTax === undefined ? undefined : Math.max(0, Math.round(generalTax - selfUseTax)),
    longTermReductionRate: reductionRate,
    bestTax: Math.round(bestTax),
    confidenceScore,
    confidenceLabel: confidenceScore >= 72 ? "高" : confidenceScore >= 48 ? "中" : "低",
    selfUseEligibility: eligibleSelfUse
      ? "可能符合自用住宅優惠，仍需確認戶籍、出租營業與地方稅務機關核定。"
      : hasUnknown
        ? "資料不足，需確認戶籍、出租營業、是否另有房屋與曾用優惠狀態。"
        : "目前條件看起來不符合自用住宅優惠或超過優惠面積。",
    repurchaseNote:
      input.checkRepurchase === "yes"
        ? "已勾選重購退稅檢查，需確認兩年內重購、自用住宅狀態與新購土地地價。"
        : "未啟用重購退稅檢查。",
    warnings,
  };
};
