import {
  AlertTriangle,
  Building2,
  FileText,
  Gauge,
  Handshake,
  KeyRound,
  Landmark,
  MapPinned,
  Scale,
  School,
  ShieldCheck,
  Store,
  Target,
  TrainFront,
  UserRound,
} from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";
import { AddressSearch } from "../components/AddressSearch";
import { LandUseBadge } from "../components/LandUseBadge";
import { ModeSwitch } from "../components/ModeSwitch";
import { RentalSummary } from "../components/RentalSummary";
import { useEstimate } from "../context/EstimateContext";
import { useLandUseInfo } from "../hooks/useLandUseInfo";
import { useLocationIntel } from "../hooks/useLocationIntel";
import type { LandUseInfo } from "../services/landUse";
import { getMajorDevelopmentSignal, type LocationIntel, type NearbyFeature } from "../services/locationIntel";
import { estimateRental } from "../services/rental";
import { estimateProperty } from "../services/valuation";
import type { PropertyInput, ValuationResult } from "../types";
import { clamp, formatDistance, formatRentPerPing, formatTwd, formatUnitWan, formatWan } from "../utils/format";

type Effect = "利多" | "利少" | "中性";
type SignalIcon = "land" | "school" | "transit" | "retail" | "green" | "market" | "risk" | "build";

interface DecisionSignal {
  title: string;
  group: string;
  icon: SignalIcon;
  buyerEffect: Effect;
  sellerEffect: Effect;
  premiumPct: number;
  buyerReason: string;
  sellerReason: string;
}

const pct = (value: number) => `${Math.round(value)}%`;

const iconMap = {
  land: Landmark,
  school: School,
  transit: TrainFront,
  retail: Store,
  green: ShieldCheck,
  market: Gauge,
  risk: AlertTriangle,
  build: Building2,
};

const featureMeta: Record<
  NearbyFeature["category"],
  { label: string; shortLabel: string; icon: SignalIcon }
> = {
  school: { label: "文教節點", shortLabel: "文教", icon: "school" },
  transit: { label: "交通節點", shortLabel: "交通", icon: "transit" },
  retail: { label: "生活機能節點", shortLabel: "機能", icon: "retail" },
  green: { label: "公園綠地", shortLabel: "綠地", icon: "green" },
  medical: { label: "醫療節點", shortLabel: "醫療", icon: "retail" },
};

const featureCategories: NearbyFeature["category"][] = ["transit", "retail", "school", "green", "medical"];

const effectValue = (effect: Effect, premiumPct: number) => {
  if (effect === "利多") return Math.abs(premiumPct);
  if (effect === "利少") return -Math.abs(premiumPct);
  return 0;
};

const buildDecisionSignals = (
  input: PropertyInput,
  result: ValuationResult,
  landUse?: LandUseInfo,
  intel?: LocationIntel,
): DecisionSignal[] => {
  const signals: DecisionSignal[] = [];
  const landUseText = [landUse?.primaryName, landUse?.secondaryName, landUse?.detailName].filter(Boolean).join(" / ");
  if (landUseText) {
    const isCommercial = /商業|零售|批發|服務|辦公/.test(landUseText);
    const isResidentialLike = /建築|住宅|住商|居住/.test(landUseText);
    const isSensitive = /工業|農業|礦|水利用|交通利用|公共設施/.test(landUseText);
    signals.push({
      title: `土地用途：${landUseText}`,
      group: "土地用途",
      icon: "land",
      buyerEffect: isSensitive ? "利少" : "利多",
      sellerEffect: isCommercial || isResidentialLike ? "利多" : isSensitive ? "利少" : "中性",
      premiumPct: isCommercial ? 3.4 : isResidentialLike ? 1.8 : isSensitive ? 3.0 : 0.8,
      buyerReason: isCommercial
        ? "機能便利但容易反映在開價上，買方應避免為便利性重複溢價。"
        : isSensitive
          ? "用途屬性可能帶來使用限制或環境疑慮，買方會提高查證與折價要求。"
          : "用途與居住需求相容度較高，買方的不確定折扣較低。",
      sellerReason: isCommercial
        ? "商業與生活機能可形成開價故事，賣方較容易主張便利性溢價。"
        : isSensitive
          ? "若用途與住宅期待不完全一致，賣方需要補強法規與使用證明。"
          : "用途穩定時可降低買方疑慮，支撐價格下緣。",
    });
  }

  if (intel && intel.schoolCount + intel.transitCount + intel.greenCount + intel.retailCount + intel.medicalCount > 0) {
    if (intel.schoolCount >= 2) {
      signals.push({
        title: `${intel.schoolCount} 個文教節點`,
        group: "學校文教",
        icon: "school",
        buyerEffect: "利多",
        sellerEffect: "利多",
        premiumPct: 2.1,
        buyerReason: "文教設施密度高，對自住與家庭型買方有實用價值。"
          + " 但仍需檢核學區、通學距離與噪音。",
        sellerReason: "賣方可把學校、圖書館與教育機能納入價值敘事，提高議價防守力。",
      });
    }
    if (intel.transitCount >= 2) {
      signals.push({
        title: `${intel.transitCount} 個交通節點`,
        group: "交通可達",
        icon: "transit",
        buyerEffect: "利多",
        sellerEffect: "利多",
        premiumPct: 2.8,
        buyerReason: "通勤便利提高持有價值，但買方應用步行距離與班距確認是否值得加價。",
        sellerReason: "交通節點可支撐較高 MPP，尤其是捷運、火車站或主要公車走廊周邊。",
      });
    }
    if (intel.retailCount >= 8) {
      signals.push({
        title: `${intel.retailCount} 個生活機能點`,
        group: "生活機能",
        icon: "retail",
        buyerEffect: "利多",
        sellerEffect: "利多",
        premiumPct: 1.9,
        buyerReason: "日常採買、餐飲與金融服務密集，降低生活摩擦成本。",
        sellerReason: "生活機能完整時，賣方較容易把價格守在市場中位價上緣。",
      });
    }
    if (intel.greenCount >= 1) {
      signals.push({
        title: `${intel.greenCount} 個公園綠地`,
        group: "環境舒適",
        icon: "green",
        buyerEffect: "利多",
        sellerEffect: "利多",
        premiumPct: 1.3,
        buyerReason: "綠地可提高居住舒適度，但需確認距離、噪音與維護狀況。",
        sellerReason: "公園與開放空間有助於強化產品差異化。",
      });
    }
  } else {
    signals.push({
      title: "周邊機能資料尚不足",
      group: "外部條件",
      icon: "risk",
      buyerEffect: "利多",
      sellerEffect: "利少",
      premiumPct: 2.4,
      buyerReason: "缺少即時機能佐證時，買方會要求安全折扣或實地查證。",
      sellerReason: "賣方若要主張溢價，必須補上學校、交通與生活機能證據。",
    });
  }

  signals.push({
    title: "重大建設題材",
    group: "建設外溢",
    icon: "build",
    buyerEffect: "中性",
    sellerEffect: "利多",
    premiumPct: 1.6,
    buyerReason: getMajorDevelopmentSignal(input.city, input.district, input.road),
    sellerReason: "建設題材可以作為溢價故事，但必須以完工時程、距離與生活圈成熟度佐證。",
  });

  signals.push({
    title: `可比成交 ${result.comparableCount} 筆`,
    group: "市場證據",
    icon: "market",
    buyerEffect: result.confidenceScore >= 65 ? "中性" : "利多",
    sellerEffect: result.confidenceScore >= 65 ? "利多" : "利少",
    premiumPct: result.confidenceScore >= 65 ? 1.4 : 4.2,
    buyerReason:
      result.confidenceScore >= 65
        ? `最近案例距離 ${formatDistance(result.nearestDistanceMeters)}，買方應聚焦物件條件差異。`
        : "信心不足或樣本離散時，買方有理由把出價壓回保守區間。",
    sellerReason:
      result.confidenceScore >= 65
        ? "成交樣本可支撐賣方價格防線，但仍不能取代實際屋況。"
        : "樣本不足時，賣方較難只靠模型結果主張高溢價。",
  });

  if (input.specialFactors.length || input.condition === "未提供" || input.condition === "待整理") {
    signals.push({
      title: input.specialFactors.length ? `特殊狀況：${input.specialFactors.join("、")}` : "屋況資訊不足",
      group: "屋況風險",
      icon: "risk",
      buyerEffect: "利多",
      sellerEffect: "利少",
      premiumPct: input.specialFactors.length ? 7.5 : 4.0,
      buyerReason: "屋況、產權或特殊因素未確認時，買方會把未知成本折回價格。",
      sellerReason: "賣方需要揭露並提供文件，否則 MPP 很容易被買方以風險折扣打下來。",
    });
  }

  return signals;
};

export const DecisionRadarPage = () => {
  const { propertyInput, selectedLocation, valuation, rentalValuation, transactionMode } = useEstimate();
  const [openIntelGroup, setOpenIntelGroup] = useState<NearbyFeature["category"] | undefined>("transit");
  const [openSideIntelKey, setOpenSideIntelKey] = useState<string | undefined>("buyer-transit");
  const hasTarget = Boolean(propertyInput.address && propertyInput.lat && propertyInput.lng);
  const hasPreciseTarget = hasTarget && (propertyInput.locationConfidence ?? 0) >= 0.82;
  const result = valuation ?? estimateProperty(propertyInput);
  const rentResult = rentalValuation ?? estimateRental(propertyInput);
  const { info: landUse, status: landUseStatus } = useLandUseInfo(
    hasPreciseTarget ? propertyInput.lat : undefined,
    hasPreciseTarget ? propertyInput.lng : undefined,
  );
  const { intel, status: intelStatus } = useLocationIntel(
    hasPreciseTarget ? propertyInput.lat : undefined,
    hasPreciseTarget ? propertyInput.lng : undefined,
    300,
  );
  const unitMedian = result.unitMedianWan ?? 0;
  const area = propertyInput.areaPing ?? 30;
  const confidence = result.confidenceScore;
  const spread =
    result.unitLowWan && result.unitHighWan && result.unitMedianWan
      ? ((result.unitHighWan - result.unitLowWan) / result.unitMedianWan) * 100
      : 0;
  const riskScore = clamp(
    100 - confidence + (spread > 18 ? 12 : 0) + propertyInput.specialFactors.length * 12,
    0,
    100,
  );
  const signals = useMemo(
    () => buildDecisionSignals(propertyInput, result, landUse, intel),
    [propertyInput, result, landUse, intel],
  );
  const buyerAdjustPct = clamp(
    signals.reduce((sum, item) => sum + effectValue(item.buyerEffect, item.premiumPct) * 0.45, 0),
    -10,
    7,
  );
  const sellerAdjustPct = clamp(
    signals.reduce((sum, item) => sum + effectValue(item.sellerEffect, item.premiumPct) * 0.72, 0),
    -8,
    12,
  );
  const conservativeOffer = unitMedian * area * (confidence >= 75 ? 0.955 : confidence >= 55 ? 0.93 : 0.88);
  const fairOffer = unitMedian * area;
  const ceilingOffer = unitMedian * area * (confidence >= 75 ? 1.035 : confidence >= 55 ? 1.02 : 0.98);
  const buyerMindPrice = fairOffer * (riskScore >= 65 ? 0.9 : riskScore >= 38 ? 0.94 : 0.98) * (1 + buyerAdjustPct / 100);
  const sellerMindPrice = fairOffer * (confidence >= 75 ? 1.06 : confidence >= 55 ? 1.04 : 1.01) * (1 + sellerAdjustPct / 100);
  const sellerMpp = sellerMindPrice * (confidence >= 65 ? 1.045 : 1.025);
  const buyerOpening = Math.min(buyerMindPrice * 0.955, conservativeOffer);
  const buyerCeiling = Math.min(ceilingOffer, buyerMindPrice * 1.055);
  const overlapLow = Math.min(Math.max(buyerMindPrice, conservativeOffer), ceilingOffer);
  const overlapHigh = Math.max(Math.min(sellerMindPrice, ceilingOffer), overlapLow);
  const negotiationGapPct = fairOffer ? ((sellerMindPrice - buyerMindPrice) / fairOffer) * 100 : 0;
  const targetLabel = propertyInput.communityName || propertyInput.address || selectedLocation?.label || "尚未指定標的";
  const buyerUps = signals.filter((item) => item.buyerEffect === "利多").length;
  const buyerDowns = signals.filter((item) => item.buyerEffect === "利少").length;
  const sellerUps = signals.filter((item) => item.sellerEffect === "利多").length;
  const sellerDowns = signals.filter((item) => item.sellerEffect === "利少").length;
  const topFeatures = intel?.features.slice(0, 8) ?? [];
  const featureGroups = useMemo(
    () =>
      featureCategories.map((category) => ({
        category,
        ...featureMeta[category],
        count: intel?.features.filter((item) => item.category === category).length ?? 0,
        items: intel?.features.filter((item) => item.category === category).slice(0, 18) ?? [],
      })),
    [intel],
  );
  const openFeatureGroup = featureGroups.find((group) => group.category === openIntelGroup);
  const totalFeatureCount = featureGroups.reduce((sum, group) => sum + group.count, 0);
  const landUseSummary = landUse?.displayName || landUse?.detailName || landUse?.secondaryName || "土地用途待查";
  const neighborhoodSummary = totalFeatureCount
    ? `300 公尺內目前辨識 ${totalFeatureCount} 個公開節點，其中交通 ${intel?.transitCount ?? 0}、生活機能 ${intel?.retailCount ?? 0}、文教 ${intel?.schoolCount ?? 0}、公園 ${intel?.greenCount ?? 0}、醫療 ${intel?.medicalCount ?? 0}。`
    : "300 公尺內公開節點資料不足，需用現場查證補強。";
  const conditionSummary = propertyInput.specialFactors.length
    ? `標的帶有 ${propertyInput.specialFactors.join("、")} 等特殊狀況，必須折入風險價差。`
    : `目前屋況為「${propertyInput.condition || "未提供"}」，仍需用漏水、管線、管理費與修繕紀錄查證。`;

  const renderSignalList = (side: "buyer" | "seller") =>
    signals.map((item) => {
      const Icon = iconMap[item.icon];
      const effect = side === "buyer" ? item.buyerEffect : item.sellerEffect;
      const reason = side === "buyer" ? item.buyerReason : item.sellerReason;
      return (
        <li key={`${side}-${item.group}-${item.title}`} className="decision-factor-item">
          <div>
            <Icon size={17} />
            <span className={`effect-badge ${effect === "利多" ? "up" : effect === "利少" ? "down" : "neutral"}`}>
              {effect}
            </span>
            <strong>{item.title}</strong>
          </div>
          <p>{reason}</p>
        </li>
      );
    });

  const renderIntelPanel = () => (
    <>
      {!hasPreciseTarget && (
        <div className="intel-radius-note warning">
          <strong>需要精準定位</strong>
          <span>目前地址解析精度不足，先不抓 300 公尺節點；請在地址搜尋選擇候選位置，或到地圖估價拖曳定位點。</span>
        </div>
      )}
      {hasPreciseTarget && (
        <>
      <div className="intel-radius-note">
        <strong>300 公尺即時統計</strong>
        <span>點擊項目可展開明細；資料來自公開地圖節點，正式判斷仍需現場確認。</span>
      </div>
      <div className="intel-pill-grid">
        {featureGroups.map((group) => {
          const Icon = iconMap[group.icon];
          return (
            <button
              key={group.category}
              type="button"
              className={openIntelGroup === group.category ? "active" : ""}
              onClick={() => setOpenIntelGroup((current) => (current === group.category ? undefined : group.category))}
            >
              <Icon size={16} />
              <span>{group.shortLabel}</span>
              <strong>{intelStatus === "loading" ? "..." : group.count}</strong>
            </button>
          );
        })}
      </div>
      {openFeatureGroup && (
        <div className="intel-detail-drawer">
          <div>
            <strong>{openFeatureGroup.label}</strong>
            <span>{openFeatureGroup.count} 個節點</span>
          </div>
          {openFeatureGroup.items.length ? (
            <ul>
              {openFeatureGroup.items.map((item, index) => (
                <li key={`${item.category}-${item.name}-${index}`}>
                  <span>{item.name}</span>
                  <small>{item.distanceMeters !== undefined ? formatDistance(item.distanceMeters) : "距離待查"}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p>300 公尺內暫無此類公開節點，建議擴大範圍或實地確認。</p>
          )}
        </div>
      )}
        </>
      )}
    </>
  );

  const renderSideIntelAccordion = (side: "buyer" | "seller", title: string) => (
    <div className="side-intel-accordion">
      <div className="side-intel-heading">
        <strong>{title}</strong>
        <span>{hasPreciseTarget ? "方圓 300 公尺公開節點，單次只展開一類。" : "精準定位後才會列出 300 公尺公開節點。"}</span>
      </div>
      {!hasPreciseTarget && (
        <article className="side-intel-group open">
          <ul>
            <li>
              <span>目前定位精度不足，暫不列入周邊節點</span>
              <small>請用地圖校正</small>
            </li>
          </ul>
        </article>
      )}
      {hasPreciseTarget &&
        featureGroups.map((group) => {
        const Icon = iconMap[group.icon];
        const key = `${side}-${group.category}`;
        const isOpen = openSideIntelKey === key;
        return (
          <article key={key} className={`side-intel-group ${isOpen ? "open" : ""}`}>
            <button
              type="button"
              onClick={() => setOpenSideIntelKey((current) => (current === key ? undefined : key))}
            >
              <span>
                <Icon size={16} />
                {group.label}
              </span>
              <strong>{intelStatus === "loading" ? "..." : `${group.count} 個`}</strong>
            </button>
            {isOpen && (
              <ul>
                {group.items.length ? (
                  group.items.map((item, index) => (
                    <li key={`${key}-${item.name}-${index}`}>
                      <span>{item.name}</span>
                      <small>{item.distanceMeters !== undefined ? formatDistance(item.distanceMeters) : "距離待查"}</small>
                    </li>
                  ))
                ) : (
                  <li>
                    <span>300 公尺內暫無此類公開節點</span>
                    <small>建議實地確認</small>
                  </li>
                )}
              </ul>
            )}
          </article>
        );
        })}
    </div>
  );

  if (!hasTarget) {
    return (
      <div className="page decision-page">
        <section className="section-heading">
          <span className="eyebrow">第四分頁 / 決策雷達</span>
          <h1>先鎖定標的，再分析買賣或租屋決策</h1>
          <p>請輸入地址或到地圖估價選點。未選定標的前，系統不會套用任何範例社區，也不會輸出價格或周邊判讀。</p>
          <div className="decision-control-row">
            <ModeSwitch />
            <AddressSearch compact buttonLabel="更新標的" onSelect={() => undefined} />
          </div>
        </section>
        <section className="empty-state decision-empty-state">
          <MapPinned size={28} />
          <h2>尚未選定估價標的</h2>
          <p>輸入臺灣任一地址或社區名稱後，決策雷達會同步建立買方、賣方或租屋雙方的心理價位與談判策略。</p>
        </section>
      </div>
    );
  }

  if (transactionMode === "rent") {
    const tenantTarget = rentResult.monthlyMedianTwd ? rentResult.monthlyMedianTwd * (riskScore >= 55 ? 0.92 : 0.97) : undefined;
    const landlordTarget = rentResult.monthlyMedianTwd ? rentResult.monthlyMedianTwd * (confidence >= 65 ? 1.08 : 1.03) : undefined;
    return (
      <div className="page decision-page">
        <section className="section-heading">
          <span className="eyebrow">第四分頁 / 決策雷達 / 租屋</span>
          <h1>同一標的，拆解租客與房東心中的租金</h1>
          <p>租屋模式會把土地用途、周邊機能、交通文教、租金投報與屋況風險轉成租客議租點與房東守價點。</p>
          <div className="decision-control-row">
            <ModeSwitch />
            <AddressSearch compact buttonLabel="更新標的" onSelect={() => undefined} />
          </div>
        </section>
        <section className="decision-target-grid">
          <article className="decision-radar-card">
            <div
              className="radar-score"
              style={{ "--score": `${riskScore * 3.6}deg` } as CSSProperties & Record<"--score", string>}
            >
              <div>
                <span>租屋風險</span>
                <strong>{pct(riskScore)}</strong>
              </div>
            </div>
            <div>
              <h2>{riskScore >= 65 ? "先查證租約條件" : riskScore >= 38 ? "可議租但需比對條件" : "可作為租金參考"}</h2>
              <div className="target-address-pill">
                <span>目前標的</span>
                <strong>{targetLabel}</strong>
              </div>
              <p>租屋風險會納入月租區間、地段、300 公尺生活機能、屋況與資料信心。</p>
              <div className="risk-metric-grid">
                <span>
                  信心
                  <strong>{confidence}</strong>
                </span>
                <span>
                  區間寬度
                  <strong>{pct(spread)}</strong>
                </span>
                <span>
                  300m 節點
                  <strong>{totalFeatureCount}</strong>
                </span>
                <span>
                  租金樣本
                  <strong>{rentResult.comparableCount}</strong>
                </span>
              </div>
            </div>
          </article>
          <article className="target-intel-card">
            <div className="decision-card-title">
              <MapPinned size={20} />
              <h2>標的與租屋條件</h2>
            </div>
            <LandUseBadge
              lat={propertyInput.lat}
              lng={propertyInput.lng}
              locationConfidence={propertyInput.locationConfidence}
              compact
            />
            {renderIntelPanel()}
          </article>
        </section>
        <section className="buyer-seller-board">
          <article className="side-evaluation-card buyer">
            <div className="side-card-head">
              <KeyRound size={22} />
              <div>
                <span>Tenant View</span>
                <h2>租客評估</h2>
              </div>
            </div>
            <div className="mind-price">
              <span>租客心中合理月租</span>
              <strong>{formatTwd(tenantTarget)}</strong>
              <small>坪租參考：{formatRentPerPing(rentResult.rentPerPingMedianTwd)}</small>
            </div>
            <ul className="decision-factor-list">
              <li className="decision-factor-item"><div><span className="effect-badge up">議租點</span><strong>屋況與家具家電</strong></div><p>租客會把管理費、家具、家電、可開伙、寵物與修繕責任折回租金。</p></li>
              <li className="decision-factor-item"><div><span className="effect-badge neutral">比價</span><strong>交通與生活機能</strong></div><p>機能越好越容易接受中位租金，但仍需比對實際刊登物件。</p></li>
            </ul>
            <div className="side-logic-list">
              <p><strong>租客心理：</strong>先看總月租是否壓住現金流，再用屋況、家具、管理費與交通距離要求折扣。</p>
              <p><strong>合理策略：</strong>把可接受租金上限與押金、租期、修繕責任一起談，不只談月租。</p>
            </div>
            {renderSideIntelAccordion("buyer", "租客周邊查證清單")}
          </article>
          <article className="side-evaluation-card seller">
            <div className="side-card-head">
              <Handshake size={22} />
              <div>
                <span>Landlord View</span>
                <h2>房東評估</h2>
              </div>
            </div>
            <div className="mind-price">
              <span>房東心中可守月租</span>
              <strong>{formatTwd(landlordTarget)}</strong>
              <small>推估年投報：{rentResult.grossYieldPct?.toFixed(2) ?? "0.00"}%</small>
            </div>
            <ul className="decision-factor-list">
              <li className="decision-factor-item"><div><span className="effect-badge up">守價點</span><strong>地段與稀缺性</strong></div><p>交通、文教、商圈與屋況完整時，房東可主張較高租金。</p></li>
              <li className="decision-factor-item"><div><span className="effect-badge down">折價點</span><strong>空置與租期風險</strong></div><p>若空置期拉長或條件限制太多，房東應降低租金或調整押金條件。</p></li>
            </ul>
            <div className="side-logic-list">
              <p><strong>房東心理：</strong>會把空置成本、管理麻煩與租客品質納入租金底線，條件越乾淨越能守價。</p>
              <p><strong>合理策略：</strong>用交通、機能、家具與修繕紀錄支撐租金，必要時用長租折扣換穩定性。</p>
            </div>
            {renderSideIntelAccordion("seller", "房東周邊支撐清單")}
          </article>
        </section>
        <RentalSummary result={rentResult} compact />
        <section className="strategy-synthesis-card">
          <div className="decision-card-title">
            <FileText size={20} />
            <h2>租屋談判摘要</h2>
          </div>
          <p>
            租客的核心是現金流與居住風險，房東的核心是空置成本與租期穩定。
            系統會把 300 公尺交通、生活機能、屋況與租金信心轉成雙方的合理租金帶；
            若外部條件強但屋況不完整，應用押金、修繕與租期條件交換，而不是只調整月租。
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="page decision-page">
      <section className="section-heading">
        <span className="eyebrow">第四分頁 / 決策雷達</span>
        <h1>同一標的，拆解買方與賣方心中的價格</h1>
        <p>
          本頁會先鎖定目前輸入或地圖選定的標的，再把土地用途、周邊機能、建設題材、成交樣本與屋況風險，
          轉成買方與賣方各自的心理價格、溢價理由與議價策略。
        </p>
        <div className="decision-control-row">
          <ModeSwitch />
          <AddressSearch compact buttonLabel="更新標的" onSelect={() => undefined} />
        </div>
      </section>

      <section className="decision-target-grid">
        <article className="decision-radar-card">
          <div
            className="radar-score"
            style={{ "--score": `${riskScore * 3.6}deg` } as CSSProperties & Record<"--score", string>}
          >
            <div>
              <span>風險雷達</span>
              <strong>{pct(riskScore)}</strong>
            </div>
          </div>
          <div>
            <h2>{riskScore >= 65 ? "先查證再談價" : riskScore >= 38 ? "可議價但需保留安全邊際" : "可作為市場參考"}</h2>
            <div className="target-address-pill">
              <span>目前標的</span>
              <strong>{targetLabel}</strong>
            </div>
            <p>
              風險分數由信心分數、價格區間寬度、特殊狀況、300 公尺機能密度與周邊樣本密度共同推估。
            </p>
            <div className="risk-metric-grid">
              <span>
                信心
                <strong>{confidence}</strong>
              </span>
              <span>
                區間寬度
                <strong>{pct(spread)}</strong>
              </span>
              <span>
                300m 節點
                <strong>{totalFeatureCount}</strong>
              </span>
              <span>
                成交樣本
                <strong>{result.comparableCount}</strong>
              </span>
            </div>
          </div>
        </article>

        <article className="target-intel-card">
          <div className="decision-card-title">
            <MapPinned size={20} />
            <h2>目前標的與外部條件</h2>
          </div>
          <LandUseBadge
            lat={propertyInput.lat}
            lng={propertyInput.lng}
            locationConfidence={propertyInput.locationConfidence}
            compact
          />
          {renderIntelPanel()}
          <p>
            {landUseStatus === "loading" || intelStatus === "loading"
              ? "正在匯入公開圖資與周邊機能。"
              : topFeatures.length
                ? `周邊節點：${topFeatures.map((item) => item.name).join("、")}`
                : "周邊機能資料不足，議價時應以實地查證與正式公開資料補強。"}
          </p>
        </article>
      </section>

      <section className="buyer-seller-board">
        <article className="side-evaluation-card buyer">
          <div className="side-card-head">
            <UserRound size={22} />
            <div>
              <span>Buyer View</span>
              <h2>買家評估</h2>
            </div>
          </div>
          <div className="mind-price">
            <span>買方心中合理價</span>
            <strong>{formatWan(buyerMindPrice)}</strong>
            <small>買方上限：{formatWan(buyerCeiling)} · 條件調整 {buyerAdjustPct >= 0 ? "+" : ""}{buyerAdjustPct.toFixed(1)}%</small>
          </div>
          <div className="psychology-strip">
            <span>利多 {buyerUps}</span>
            <span>利少 {buyerDowns}</span>
            <span>心理狀態：{riskScore >= 65 ? "防守、要求折扣" : riskScore >= 38 ? "理性比價" : "願意接近市場"}</span>
          </div>
          <div className="side-logic-list">
            <p><strong>買方邏輯：</strong>先用成交資料確認不買貴，再把屋況、貸款、特殊產權與未來轉手風險折回價格。</p>
            <p><strong>出價策略：</strong>低點從 {formatWan(buyerOpening)} 附近測試，目標落在 {formatWan(buyerMindPrice)}，上限不超過 {formatWan(buyerCeiling)}。</p>
          </div>
          {renderSideIntelAccordion("buyer", "買方 300 公尺查證清單")}
          <ul className="decision-factor-list">{renderSignalList("buyer")}</ul>
        </article>

        <article className="side-evaluation-card seller">
          <div className="side-card-head">
            <Handshake size={22} />
            <div>
              <span>Seller View</span>
              <h2>賣家評估</h2>
            </div>
          </div>
          <div className="mind-price">
            <span>賣方心中可守價</span>
            <strong>{formatWan(sellerMindPrice)}</strong>
            <small>MPP：{formatWan(sellerMpp)} · 溢價支撐 {sellerAdjustPct >= 0 ? "+" : ""}{sellerAdjustPct.toFixed(1)}%</small>
          </div>
          <div className="psychology-strip">
            <span>利多 {sellerUps}</span>
            <span>利少 {sellerDowns}</span>
            <span>心理狀態：{sellerAdjustPct >= 5 ? "有溢價期待" : confidence >= 65 ? "守中位價" : "需補強證據"}</span>
          </div>
          <div className="side-logic-list">
            <p><strong>賣方邏輯：</strong>先用最佳報價價位錨定理想價格，再用交通、生活機能與近期成交證據防守價格。</p>
            <p><strong>守價策略：</strong>MPP 可抓 {formatWan(sellerMpp)}，但若缺少同社區或近距離成交，應回到交會談判帶。</p>
          </div>
          {renderSideIntelAccordion("seller", "賣方 300 公尺溢價支撐清單")}
          <ul className="decision-factor-list">{renderSignalList("seller")}</ul>
        </article>
      </section>

      <section className="psychology-price-card decision-brief-card">
        <div className="decision-card-title">
          <Scale size={20} />
          <h2>合理價格參考區間與議價技巧</h2>
        </div>
        <p>
          綜合模型中位價、買方風險折扣與賣方溢價期待後，雙方較可能進入實質談判的交會帶為
          <strong> {formatWan(overlapLow)} - {formatWan(overlapHigh)} </strong>。
          買方心中合理價約 {formatWan(buyerMindPrice)}；賣方可守價約 {formatWan(sellerMindPrice)}。
          若開價高於 {formatWan(ceilingOffer)} 且缺少近期成交或機能證據，系統會視為高風險溢價。
        </p>
        <div className="decision-price-band embedded">
          <article>
            <ShieldCheck size={22} />
            <span>買方開價起點</span>
            <strong>{formatWan(buyerOpening)}</strong>
            <p>包圍法低點：保留屋況、貸款與不確定性折扣。</p>
          </article>
          <article className="featured">
            <Scale size={22} />
            <span>交會談判帶</span>
            <strong>{formatWan(overlapLow)} - {formatWan(overlapHigh)}</strong>
            <p>不是保證成交價，而是買賣雙方心理價重疊後的談判帶。</p>
          </article>
          <article>
            <Target size={22} />
            <span>賣方 MPP</span>
            <strong>{formatWan(sellerMpp)}</strong>
            <p>理想開價錨點，需由成交、機能與稀缺性支撐。</p>
          </article>
        </div>
        <div className="strategy-stat-row">
          <span>模型中位價：{formatWan(fairOffer)}</span>
          <span>心理價差：{negotiationGapPct.toFixed(1)}%</span>
          <span>參考單價：{formatUnitWan(result.unitMedianWan)}</span>
          <span>可比案例：{result.comparableCount} 筆</span>
        </div>
        <div className="negotiation-strategy-board">
          <article className="negotiation-strategy-card buyer">
            <h3>買家談判策略</h3>
            <ul>
              <li>
                <strong>開價邏輯：</strong>
                以 {formatWan(buyerOpening)} 作為包圍法低點，先把貸款、屋況與政策不確定性折入價格；
                目標落在 {formatWan(buyerMindPrice)}，除非賣方提出更強證據，買方上限不應超過 {formatWan(buyerCeiling)}。
              </li>
              <li>
                <strong>大環境檢核：</strong>
                買方應把利率、房貸成數、信用管制、稅費與持有成本列入現金流壓力測試；若每月負擔或核貸條件不穩，
                即使區域行情支撐，也要把出價壓在交會帶下緣。
              </li>
              <li>
                <strong>區域與機能：</strong>
                {neighborhoodSummary} 機能是加分，但買方談判時應要求賣方證明這些機能真的能轉成居住價值，
                例如步行距離、班距、學區、噪音與生活動線。
              </li>
              <li>
                <strong>標的風險：</strong>
                土地用途目前判讀為「{landUseSummary}」；{conditionSummary} 若屋況文件不足，
                買方應要求修繕估價、管理費紀錄與產權文件，並用 {pct(spread)} 的區間寬度作為折價依據。
              </li>
              <li>
                <strong>成交證據攻防：</strong>
                目前最近案例距離為 {formatDistance(result.nearestDistanceMeters)}、近 12 個月案例 {result.recentComparableCount} 筆。
                買方應要求排除樓層、車位、屋況或特殊交易差異過大的案例，避免賣方只挑高價樣本支撐開價。
              </li>
              <li>
                <strong>交易條件交換：</strong>
                若賣方不願降到 {formatWan(buyerMindPrice)} 附近，買方可改談交屋期限、家具設備、修繕保固、漏水責任、
                稅費分攤與付款條件，把價格讓步換成可量化保障。
              </li>
              <li>
                <strong>政策與新聞檢核：</strong>
                若新聞政策分頁出現貸款收緊、供給增加或區域政策不確定，買方應把它放進現金流壓力與轉手風險；
                若政策是社宅、補貼或都更題材，仍要確認是否真的影響本標的生活圈。
              </li>
            </ul>
          </article>
          <article className="negotiation-strategy-card seller">
            <h3>賣家談判策略</h3>
            <ul>
              <li>
                <strong>守價邏輯：</strong>
                賣方可以 {formatWan(sellerMpp)} 作為最佳報價價位 MPP，但必須預留讓步空間；
                若買方用 {formatWan(buyerOpening)} 試探，賣方應把談判拉回 {formatWan(overlapLow)} - {formatWan(overlapHigh)} 的成交交會帶。
              </li>
              <li>
                <strong>數據佐證：</strong>
                目前模型中位價 {formatWan(fairOffer)}、參考單價 {formatUnitWan(result.unitMedianWan)}、可比案例 {result.comparableCount} 筆。
                賣方若要守高於交會帶的價格，應提出同社區、同屋齡、近 12 個月成交與車位/樓層差異說明。
              </li>
              <li>
                <strong>區域敘事：</strong>
                {neighborhoodSummary} 賣方可把交通、生活機能、文教、公園與重大建設整理成價值敘事；
                但每一項都要附距離、時間、使用便利性與實際受益族群，避免只用空泛題材開價。
              </li>
              <li>
                <strong>降低買方疑慮：</strong>
                土地用途「{landUseSummary}」與屋況文件若完整，能降低買方風險折扣。
                賣方應主動提供修繕紀錄、管理費、社區規約、產權狀態與稅費試算，讓買方沒有理由把價格壓回保守區間。
              </li>
              <li>
                <strong>開價梯度：</strong>
                第一輪開價可高於交會帶，但每次讓步都要換取條件，例如較短議價期、明確付款時程或較少附帶要求；
                若買方出價低於 {formatWan(buyerOpening)}，賣方應要求其提出同社區、同屋齡與同坪數的低價成交證據。
              </li>
              <li>
                <strong>溢價證據包：</strong>
                賣方應整理 300 公尺內交通、生活機能、文教、公園與醫療節點，搭配同社區成交、管理品質、戶數、車位、
                樓層採光與屋況照片，讓溢價不是口號，而是可被買方驗證的價值清單。
              </li>
              <li>
                <strong>拒絕與提升價值：</strong>
                若買方第一次報價過低，賣方不必立即讓價，可先補資料、要求第二輪書面出價，並把談判焦點從單價拉回
                「總價、交屋、設備、修繕、稅費與付款安全」的整體交易價值。
              </li>
            </ul>
          </article>
        </div>
      </section>
    </div>
  );
};
