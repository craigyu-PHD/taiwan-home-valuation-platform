import { Home, KeyRound } from "lucide-react";
import type { RentalValuationResult } from "../types";
import { formatDate, formatDistance, formatRentPerPing, formatTwd } from "../utils/format";
import { ConfidenceBadge } from "./ConfidenceBadge";

export const RentalSummary = ({ result, compact = false }: { result: RentalValuationResult; compact?: boolean }) => (
  <section className={`result-summary rental-summary ${compact ? "compact" : ""}`}>
    <div className="result-heading">
      <div>
        <span className="eyebrow">租屋行情</span>
        <h2>{result.status === "not-suitable" ? "不適合自動推估租金" : "合理月租參考區間"}</h2>
      </div>
      <ConfidenceBadge score={result.confidenceScore} level={result.confidenceLevel} />
    </div>
    <div className="price-grid">
      <div className="price-card emphasis">
        <span>月租區間</span>
        <strong>{formatTwd(result.monthlyLowTwd)} - {formatTwd(result.monthlyHighTwd)}</strong>
      </div>
      <div className="price-card">
        <span>參考月租</span>
        <strong>{formatTwd(result.monthlyMedianTwd)}</strong>
      </div>
      <div className="price-card">
        <span>坪租區間</span>
        <strong>{formatRentPerPing(result.rentPerPingLowTwd)} - {formatRentPerPing(result.rentPerPingHighTwd)}</strong>
      </div>
    </div>
    <div className="metric-row">
      <div>
        <span>租金參考</span>
        <strong>{result.comparableCount} 筆</strong>
      </div>
      <div>
        <span>最近資料</span>
        <strong>{formatDate(result.latestReferenceDate)}</strong>
      </div>
      <div>
        <span>最近距離</span>
        <strong>{formatDistance(result.nearestDistanceMeters)}</strong>
      </div>
      <div>
        <span>推估投報</span>
        <strong>{result.grossYieldPct?.toFixed(2) ?? "0.00"}%</strong>
      </div>
    </div>
    {!compact && (
      <div className="rental-note">
        <KeyRound size={18} />
        <p>租屋模式會另外檢核家具、管理費、寵物、開伙、租期與押金。正式版接入租賃實價登錄後，可替換目前的投報換算模型。</p>
      </div>
    )}
    {compact && (
      <div className="rental-note compact">
        <Home size={16} />
        <span>原型租金由成交樣本換算，請搭配實際租屋刊登與租約條件判斷。</span>
      </div>
    )}
  </section>
);
