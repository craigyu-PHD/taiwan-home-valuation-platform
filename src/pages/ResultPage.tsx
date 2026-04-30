import { AlertCircle, CheckCircle2, Database, MapPinned, TrendingUp } from "lucide-react";
import { BankWebsitePanel } from "../components/BankWebsitePanel";
import { CaseMap } from "../components/CaseMap";
import { DisclaimerBox } from "../components/DisclaimerBox";
import { ResultSummary } from "../components/ResultSummary";
import { TransactionList } from "../components/TransactionList";
import { useEstimate } from "../context/EstimateContext";
import { DATA_SOURCES } from "../data/demoTransactions";
import { formatDistance } from "../utils/format";

export const ResultPage = () => {
  const { propertyInput, valuation } = useEstimate();
  const result = valuation;

  if (!result) {
    return (
      <div className="page narrow-page">
        <section className="empty-state">尚未產生估價結果，請先輸入地址與估價條件。</section>
      </div>
    );
  }

  const center: [number, number] = [propertyInput.lat ?? 23.8, propertyInput.lng ?? 121.0];

  return (
    <div className="page result-page">
      <section className="section-heading">
        <span className="eyebrow">估價結果</span>
        <h1>{propertyInput.address}</h1>
        <p>
          物件條件：{propertyInput.propertyType}、{propertyInput.areaPing ?? "未填"} 坪、
          {propertyInput.ageYears ?? "未填"} 年、{propertyInput.parkingType}車位。
        </p>
      </section>

      <ResultSummary result={result} />

      <section className="explain-grid">
        <article>
          <CheckCircle2 size={22} />
          <h2>主要估價依據</h2>
          <ul>
            {result.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </article>
        <article>
          <TrendingUp size={22} />
          <h2>影響價格因素</h2>
          <ul>
            {(result.factors.length ? result.factors : ["未輸入特殊屋況，主要依成交案例相似度估算。"]).map(
              (factor) => (
                <li key={factor}>{factor}</li>
              ),
            )}
          </ul>
        </article>
        <article className={result.warnings.length ? "warning-card" : ""}>
          <AlertCircle size={22} />
          <h2>資料不足或異常提醒</h2>
          <ul>
            {(result.warnings.length ? result.warnings : ["目前未偵測到重大資料不足，但結果仍僅供參考。"]).map(
              (warning) => (
                <li key={warning}>{warning}</li>
              ),
            )}
          </ul>
        </article>
      </section>

      <section className="result-layout">
        <div>
          <div className="section-heading inline">
            <span className="eyebrow">周邊成交案例</span>
            <h2>採用案例與相似度</h2>
            <p>
              最近案例距離 {formatDistance(result.nearestDistanceMeters)}。實際上線時需使用已完成地理定位的
              內政部實價登錄資料，不得編造案例。
            </p>
          </div>
          <TransactionList cases={result.casesUsed} />
        </div>
        <aside>
          <CaseMap center={center} cases={result.casesUsed} className="result-map" />
          <div className="source-card">
            <Database size={20} />
            <div>
              <strong>資料來源與限制</strong>
              <p>
                原型資料欄位對齊內政部實價登錄。正式版以內政部不動產成交案件實際資訊 Open Data 為主，
                本期資料為靜態資料，實際資料仍以官方查詢服務為準。
              </p>
              <a href={DATA_SOURCES.moiOpenData} target="_blank" rel="noreferrer" className="text-link">
                內政部 Open Data
                <MapPinned size={15} />
              </a>
            </div>
          </div>
        </aside>
      </section>

      <BankWebsitePanel />
      <DisclaimerBox />
    </div>
  );
};
