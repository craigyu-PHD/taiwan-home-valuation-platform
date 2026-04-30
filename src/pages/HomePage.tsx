import { BarChart3, Calculator, Database, MapPinned, ReceiptText } from "lucide-react";
import { useState } from "react";
import { NavLink } from "react-router-dom";
import { DisclaimerBox } from "../components/DisclaimerBox";
import { LandUseBadge } from "../components/LandUseBadge";
import { ModeSwitch } from "../components/ModeSwitch";
import { PropertyEstimateForm } from "../components/PropertyEstimateForm";
import { RentalReferenceList } from "../components/RentalReferenceList";
import { RentalSummary } from "../components/RentalSummary";
import { ResultSummary } from "../components/ResultSummary";
import { TransactionList } from "../components/TransactionList";
import { useEstimate } from "../context/EstimateContext";
import { estimateRental } from "../services/rental";
import { formatUnitWan, formatWan } from "../utils/format";

export const HomePage = () => {
  const { propertyInput, valuation, rentalValuation, transactionMode } = useEstimate();
  const [hasInlineResult, setHasInlineResult] = useState(false);
  const rentResult = rentalValuation ?? estimateRental(propertyInput);

  return (
    <div className="page home-page">
      <section className="home-standard-strip">
        <div className="standard-title">
          <Database size={18} />
          <strong>估價標準</strong>
        </div>
        <p>{transactionMode === "sale" ? "以實價登錄與周邊可比成交為主，輸出價格區間；資料不足或特殊物件會降低信心，不硬給單點價格。" : "租屋模式以周邊成交換算、區域投報假設與物件條件推估月租區間，並清楚標示租金模型限制。"}</p>
        <div className="standard-pills">
          <span>成交資料</span>
          <span>價格區間</span>
          <span>信心分數</span>
        </div>
      </section>

      <section className="home-hero">
        <div className="hero-copy">
          <span className="eyebrow">資料透明 / 估價中立 / 買賣租屋雙模式</span>
          <h1>找知道AI估價平臺</h1>
          <p>
            {transactionMode === "sale"
              ? "輸入臺灣任一地址或在地圖選點，系統會依公開實價登錄與周邊可比成交，產生價格區間、信心分數、估價依據與限制說明。"
              : "切換到租屋模式後，系統會以同一筆地址推估合理月租、坪租、租金信心與租屋條件提醒。"}
          </p>
          <ModeSwitch />
          <PropertyEstimateForm
            stayOnPage
            submitLabel={transactionMode === "sale" ? "產生估價" : "產生租金行情"}
            onEstimated={() => setHasInlineResult(true)}
          />
          <LandUseBadge lat={propertyInput.lat} lng={propertyInput.lng} compact />
          <div className="hero-actions">
            <NavLink className="secondary-button" to="/estimate/map">
              <MapPinned size={18} />
              使用地圖選點
            </NavLink>
          </div>
        </div>
        <aside className="hero-panel hero-panel-balanced">
          <div className="hero-panel-top">
            <span className="eyebrow">AI 即時判讀</span>
            <h2>{transactionMode === "sale" ? "目前標的與估價狀態" : "目前標的與租金狀態"}</h2>
            <div className="target-brief-card">
              <span>目前標的</span>
              <strong>{propertyInput.communityName || propertyInput.address}</strong>
              <small>{[propertyInput.city, propertyInput.district, propertyInput.road].filter(Boolean).join(" / ")}</small>
            </div>
          </div>
          <div className="hero-metrics-grid">
            <div className="panel-stat">
              <span>{transactionMode === "sale" ? "參考中位價" : "參考月租"}</span>
              <strong>{transactionMode === "sale" ? formatWan(valuation?.totalMedianWan) : `${Math.round((rentResult.monthlyMedianTwd ?? 0) / 1000).toLocaleString("zh-TW")}k`}</strong>
            </div>
            <div className="panel-stat muted">
              <span>{transactionMode === "sale" ? "單價區間" : "坪租區間"}</span>
              <strong>
                {transactionMode === "sale"
                  ? `${formatUnitWan(valuation?.unitLowWan)} - ${formatUnitWan(valuation?.unitHighWan)}`
                  : `${rentResult.rentPerPingLowTwd ?? 0} - ${rentResult.rentPerPingHighTwd ?? 0} 元/坪`}
              </strong>
            </div>
            <div className="confidence-strip">
              <span>信心分數</span>
              <strong>{transactionMode === "sale" ? valuation?.confidenceScore ?? 0 : rentResult.confidenceScore}/100</strong>
            </div>
          </div>
          <div className="home-tool-grid">
            <NavLink to="/estimate/result" className="home-tool-card">
              <Calculator size={18} />
              <span>完整結果</span>
            </NavLink>
            <NavLink to="/market" className="home-tool-card">
              <BarChart3 size={18} />
              <span>區域行情</span>
            </NavLink>
            <NavLink to="/land-value-tax" className="home-tool-card">
              <ReceiptText size={18} />
              <span>稅費試算</span>
            </NavLink>
          </div>
        </aside>
      </section>

      {hasInlineResult && (valuation || rentalValuation) && (
        <section className="home-inline-result">
          <div className="section-heading compact-heading">
            <span className="eyebrow">同頁估價結果</span>
            <h2>{transactionMode === "sale" ? "地址估價已完成" : "租金行情已完成"}</h2>
            <p>下方結果依目前地址與進階條件即時計算，不需離開首頁。</p>
          </div>
          {transactionMode === "sale" && valuation ? (
            <>
              <ResultSummary result={valuation} compact />
              <TransactionList cases={valuation.casesUsed.slice(0, 5)} />
            </>
          ) : (
            <>
              <RentalSummary result={rentResult} compact />
              <RentalReferenceList cases={rentResult.referencesUsed.slice(0, 5)} />
            </>
          )}
        </section>
      )}

      <DisclaimerBox />
    </div>
  );
};
