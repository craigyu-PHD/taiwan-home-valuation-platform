import { BarChart3, CheckCircle2, Database, MapPinned, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { NavLink } from "react-router-dom";
import { DisclaimerBox } from "../components/DisclaimerBox";
import { PropertyEstimateForm } from "../components/PropertyEstimateForm";
import { ResultSummary } from "../components/ResultSummary";
import { TransactionList } from "../components/TransactionList";
import { useEstimate } from "../context/EstimateContext";
import { formatUnitWan, formatWan } from "../utils/format";

export const HomePage = () => {
  const { valuation } = useEstimate();
  const [hasInlineResult, setHasInlineResult] = useState(false);
  const chartCases = valuation?.casesUsed.slice(0, 5) ?? [];
  const maxUnit = Math.max(...chartCases.map((item) => item.unitPriceWan), 1);
  const barColors = ["#14b8a6", "#2563eb", "#f59e0b", "#ef4444", "#8b5cf6"];

  return (
    <div className="page home-page">
      <section className="home-standard-strip">
        <div className="standard-title">
          <Database size={18} />
          <strong>估價標準</strong>
        </div>
        <div>
          <CheckCircle2 size={21} />
          <span>以實價登錄成交為主</span>
        </div>
        <div>
          <BarChart3 size={21} />
          <span>輸出合理價格區間</span>
        </div>
        <div>
          <ShieldAlert size={21} />
          <span>資料不足時降低信心或拒估</span>
        </div>
      </section>

      <section className="home-hero">
        <div className="hero-copy">
          <span className="eyebrow">資料透明 / 估價中立 / 低信心敢拒估</span>
          <h1>全台房屋即時估價平台</h1>
          <p>
            輸入臺灣任一地址或在地圖選點，系統會依公開實價登錄與周邊可比成交，
            產生價格區間、信心分數、估價依據與限制說明。
          </p>
          <PropertyEstimateForm stayOnPage onEstimated={() => setHasInlineResult(true)} />
          <div className="hero-actions">
            <NavLink className="secondary-button" to="/estimate/map">
              <MapPinned size={18} />
              使用地圖選點
            </NavLink>
          </div>
        </div>
        <aside className="hero-panel">
          <div className="mini-chart-card">
            <div className="mini-chart-title">
              <span>周邊成交單價分布</span>
              <strong>{valuation?.comparableCount ?? 0} 筆</strong>
            </div>
            <div className="mini-chart">
              {chartCases.map((item, index) => (
                <div key={item.id} className="mini-bar-wrap">
                  <span
                    style={{
                      height: `${Math.max(18, (item.unitPriceWan / maxUnit) * 100)}%`,
                      background: `linear-gradient(180deg, ${barColors[index % barColors.length]}, #d8f3ef)`,
                    }}
                  />
                  <small>{item.unitPriceWan.toFixed(0)}</small>
                </div>
              ))}
            </div>
            <small className="mini-chart-caption">每坪萬元，依相似度排序。</small>
          </div>
          <div className="panel-stat">
            <span>示範中位價</span>
            <strong>{formatWan(valuation?.totalMedianWan)}</strong>
          </div>
          <div className="panel-stat muted">
            <span>示範單價區間</span>
            <strong>
              {formatUnitWan(valuation?.unitLowWan)} - {formatUnitWan(valuation?.unitHighWan)}
            </strong>
          </div>
          <div className="confidence-strip">
            <span>信心分數</span>
            <strong>{valuation?.confidenceScore ?? 0}/100</strong>
          </div>
        </aside>
      </section>

      {hasInlineResult && valuation && (
        <section className="home-inline-result">
          <div className="section-heading compact-heading">
            <span className="eyebrow">同頁估價結果</span>
            <h2>地址估價已完成</h2>
            <p>下方結果依目前地址與進階條件即時計算，不需離開首頁。</p>
          </div>
          <ResultSummary result={valuation} compact />
          <TransactionList cases={valuation.casesUsed.slice(0, 5)} />
        </section>
      )}

      <DisclaimerBox />

      <section className="home-method-detail" id="method">
        <div className="section-heading">
          <span className="eyebrow">方法與免責聲明</span>
          <h2>公開資料、區間估價與限制說明</h2>
          <p>
            系統以實價登錄成交資料、地理位置、建物類型、屋齡、坪數與樓層條件加權，
            輸出價格區間與信心分數。結果僅供市場行情參考，不構成正式估價報告、
            銀行核貸依據或成交價格保證。
          </p>
        </div>
      </section>
    </div>
  );
};
