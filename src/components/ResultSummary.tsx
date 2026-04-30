import { ArrowRight, FileText, ShieldCheck } from "lucide-react";
import { NavLink } from "react-router-dom";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { formatDate, formatDistance, formatUnitWan, formatWan } from "../utils/format";
import type { ValuationResult } from "../types";

export const ResultSummary = ({ result, compact = false }: { result: ValuationResult; compact?: boolean }) => (
  <section className={`result-summary ${compact ? "compact" : ""}`}>
    <div className="result-heading">
      <div>
        <span className="eyebrow">估價結果</span>
        <h2>{result.status === "not-suitable" ? "不適合自動估價" : "合理價格參考區間"}</h2>
      </div>
      <ConfidenceBadge score={result.confidenceScore} level={result.confidenceLevel} />
    </div>

    {result.status === "not-suitable" ? (
      <div className="blocked-panel">
        <ShieldCheck size={28} />
        <div>
          <strong>系統已停止輸出具體價格</strong>
          <p>原因包含特殊物件、資料不足或自動模型不適用。請改查區域行情或進行人工確認。</p>
        </div>
      </div>
    ) : (
      <div className="price-grid">
        <div className="price-card emphasis">
          <span>估計總價區間</span>
          <strong>
            {formatWan(result.totalLowWan)} - {formatWan(result.totalHighWan)}
          </strong>
        </div>
        <div className="price-card">
          <span>參考中位價</span>
          <strong>{formatWan(result.totalMedianWan)}</strong>
        </div>
        <div className="price-card">
          <span>估計單價區間</span>
          <strong>
            {formatUnitWan(result.unitLowWan)} - {formatUnitWan(result.unitHighWan)}
          </strong>
        </div>
      </div>
    )}

    <div className="metric-row">
      <div>
        <span>成交案例</span>
        <strong>{result.comparableCount} 筆</strong>
      </div>
      <div>
        <span>最近成交</span>
        <strong>{formatDate(result.latestTransactionDate)}</strong>
      </div>
      <div>
        <span>最近距離</span>
        <strong>{formatDistance(result.nearestDistanceMeters)}</strong>
      </div>
      <div>
        <span>近 12 個月</span>
        <strong>{result.recentComparableCount} 筆</strong>
      </div>
    </div>

    {!compact && (
      <div className="summary-actions">
        <NavLink className="secondary-button" to="/method">
          <FileText size={18} />
          查看估價方法
        </NavLink>
        <NavLink className="primary-button" to="/estimate/result">
          完整結果
          <ArrowRight size={18} />
        </NavLink>
      </div>
    )}
  </section>
);
