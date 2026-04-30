import { AlertTriangle, Gauge, Handshake, Lightbulb, Scale, ShieldCheck, TrendingUp, UserRound } from "lucide-react";
import type { CSSProperties } from "react";
import { ResultSummary } from "../components/ResultSummary";
import { useEstimate } from "../context/EstimateContext";
import { estimateProperty } from "../services/valuation";
import { clamp, formatDistance, formatUnitWan, formatWan } from "../utils/format";

const pct = (value: number) => `${Math.round(value)}%`;

export const DecisionRadarPage = () => {
  const { propertyInput, valuation } = useEstimate();
  const result = valuation ?? estimateProperty(propertyInput);
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
  const conservativeOffer = unitMedian * area * (confidence >= 75 ? 0.955 : confidence >= 55 ? 0.93 : 0.88);
  const fairOffer = unitMedian * area;
  const ceilingOffer = unitMedian * area * (confidence >= 75 ? 1.035 : confidence >= 55 ? 1.02 : 0.98);
  const buyerMindPrice = fairOffer * (riskScore >= 65 ? 0.9 : riskScore >= 38 ? 0.94 : 0.98);
  const sellerMindPrice = fairOffer * (confidence >= 75 ? 1.08 : confidence >= 55 ? 1.06 : 1.03);
  const overlapLow = Math.min(Math.max(buyerMindPrice, conservativeOffer), ceilingOffer);
  const overlapHigh = Math.max(Math.min(sellerMindPrice, ceilingOffer), overlapLow);
  const buyerReasons = [
    confidence < 55 ? "買方會把資料信心不足轉成安全折扣。" : "買方可接受以市場中位價附近作為談判起點。",
    spread > 18 ? "價格區間偏寬，買方通常會壓低出價以吸收不確定性。" : "價格區間集中，買方較難用資料離散作為大幅議價理由。",
    propertyInput.condition === "未提供" ? "屋況未明會讓買方預留裝修與檢修預算。" : `屋況標示為「${propertyInput.condition}」，買方會依此調整心理價。`,
  ];
  const sellerReasons = [
    result.recentComparableCount >= 6 ? "賣方會引用近期成交密集度支撐開價。" : "賣方可用區域稀缺性主張開價，但說服力有限。",
    result.nearestDistanceMeters && result.nearestDistanceMeters <= 800 ? "附近案例距離近，賣方較容易主張物件具備市場支撐。" : "附近案例距離較遠，賣方開價需要更多同社區或同路段佐證。",
    propertyInput.hasParking ? "含車位會提高賣方心理價格，尤其在車位供給有限區域。" : "未含車位時，賣方開價上緣較容易被買方挑戰。",
  ];
  const negotiationLevers = [
    result.recentComparableCount < 3 ? "近 12 個月成交不足，可要求更多屋況或成交佐證。" : "近期成交樣本足夠，議價應聚焦在物件條件差異。",
    result.nearestDistanceMeters && result.nearestDistanceMeters > 1000
      ? `最近案例距離 ${formatDistance(result.nearestDistanceMeters)}，可主張區位差異。`
      : "最近成交案例距離接近，價格說服力較高。",
    propertyInput.condition === "未提供" ? "屋況尚未提供，建議把漏水、裝修、管線列為議價檢核。" : `屋況為「${propertyInput.condition}」，可納入價格調整。`,
    propertyInput.specialFactors.length
      ? `已標記特殊狀況：${propertyInput.specialFactors.join("、")}，應保守出價或人工確認。`
      : "目前未標記特殊狀況，仍建議查證產權、漏水與管委會紀錄。",
  ];
  const sensitivity = [
    { label: "坪數增加 1 坪", value: formatWan(unitMedian), tone: "blue" },
    { label: "少一個平面車位", value: formatWan(Math.max(0, fairOffer * 0.06)), tone: "amber" },
    { label: "屋況待整理", value: `-${formatWan(fairOffer * 0.07)}`, tone: "red" },
    { label: "低信心安全折扣", value: `-${formatWan(fairOffer * (confidence >= 55 ? 0.04 : 0.1))}`, tone: "green" },
  ];

  return (
    <div className="page decision-page">
      <section className="section-heading">
        <span className="eyebrow">第四分頁 / 決策雷達</span>
        <h1>把估價變成出價策略與風險檢核</h1>
        <p>
          一般估價網站只給價格。本頁把價格區間、資料信心、周邊案例與屋況風險轉成可操作的出價策略，
          協助你判斷該保守、接近市場，或暫停交易確認。
        </p>
      </section>

      <section className="decision-hero-grid">
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
            <h2>{riskScore >= 65 ? "先查證再出價" : riskScore >= 38 ? "可議價但需保留安全邊際" : "可作為市場參考"}</h2>
            <p>
              風險分數由信心分數、價格區間寬度、特殊狀況與成交樣本密度共同推估；
              不是正式投資建議，而是協助你避免只看單一估價。
            </p>
          </div>
        </article>
        <ResultSummary result={result} compact />
      </section>

      <section className="offer-ladder">
        <article>
          <ShieldCheck size={22} />
          <span>保守出價</span>
          <strong>{formatWan(conservativeOffer)}</strong>
          <p>適合低信心、屋況未知或想保留整修預算時使用。</p>
        </article>
        <article className="featured">
          <Scale size={22} />
          <span>市場接近價</span>
          <strong>{formatWan(fairOffer)}</strong>
          <p>接近目前模型中位價，適合用來和屋主開價比對。</p>
        </article>
        <article>
          <AlertTriangle size={22} />
          <span>風險上限</span>
          <strong>{formatWan(ceilingOffer)}</strong>
          <p>超過此區間時，應要求更強成交依據或重新查證。</p>
        </article>
      </section>

      <section className="mind-price-grid">
        <article className="mind-card buyer">
          <div className="decision-card-title">
            <UserRound size={21} />
            <h2>買家評估</h2>
          </div>
          <strong>{formatWan(buyerMindPrice)}</strong>
          <span>買方心中合理出價</span>
          <ul>
            {buyerReasons.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <article className="mind-card seller">
          <div className="decision-card-title">
            <Handshake size={21} />
            <h2>賣家評估</h2>
          </div>
          <strong>{formatWan(sellerMindPrice)}</strong>
          <span>賣方心中可守價格</span>
          <ul>
            {sellerReasons.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <article className="mind-card overlap">
          <div className="decision-card-title">
            <Scale size={21} />
            <h2>成交交會帶</h2>
          </div>
          <strong>
            {formatWan(overlapLow)} - {formatWan(overlapHigh)}
          </strong>
          <span>雙方較可能進入談判的價格帶</span>
          <p>如果屋主開價高於交會帶，建議用周邊案例、屋況折扣與資料信心作為談判依據。</p>
        </article>
      </section>

      <section className="decision-grid">
        <article className="decision-card">
          <div className="decision-card-title">
            <Lightbulb size={20} />
            <h2>議價籌碼</h2>
          </div>
          <ul>
            {negotiationLevers.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <article className="decision-card">
          <div className="decision-card-title">
            <Gauge size={20} />
            <h2>價格敏感度</h2>
          </div>
          <div className="sensitivity-grid">
            {sensitivity.map((item) => (
              <div key={item.label} className={`sensitivity-card ${item.tone}`}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </article>
        <article className="decision-card">
          <div className="decision-card-title">
            <TrendingUp size={20} />
            <h2>判讀摘要</h2>
          </div>
          <p>
            目前參考單價為 {formatUnitWan(result.unitMedianWan)}，價格區間寬度約 {pct(spread)}。
            若開價高於風險上限，建議用周邊成交、屋況與資料信心作為議價依據。
          </p>
        </article>
      </section>
    </div>
  );
};
