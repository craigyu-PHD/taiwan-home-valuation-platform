import { Database, Landmark, Layers3, ShieldCheck } from "lucide-react";
import { BankWebsitePanel } from "../components/BankWebsitePanel";
import { DATA_SOURCES } from "../data/demoTransactions";

export const MethodPage = () => (
  <div className="page method-page">
    <section className="section-heading">
      <span className="eyebrow">方法與免責聲明</span>
      <h1>估價邏輯、資料來源與系統限制</h1>
      <p>本系統的核心不是預測唯一正確價格，而是透明呈現合理區間、案例依據與信心限制。</p>
    </section>

    <section className="method-grid">
      <article>
        <Database size={23} />
        <h2>資料來源</h2>
        <p>
          正式版以內政部不動產成交案件實際資訊 Open Data 為主，下載本期與歷史批次資料後，
          轉成標準交易資料表並保留來源、版本與更新時間。
        </p>
        <a href={DATA_SOURCES.moiOpenData} className="text-link" target="_blank" rel="noreferrer">
          內政部不動產成交案件實際資訊資料供應系統
        </a>
      </article>
      <article>
        <Layers3 size={23} />
        <h2>權重排序</h2>
        <p>
          同社區最高，同路段次之，同行政區與生活圈作為輔助；同時加權距離、交易時間、
          建物型態、坪數、屋齡、樓層與車位。
        </p>
      </article>
      <article>
        <ShieldCheck size={23} />
        <h2>信心分數</h2>
        <p>
          案例數、近 12 個月成交、1 公里內案例、資料完整度與相似度會提高信心；特殊物件、
          地址不明、樣本離散或資料不足會降低信心。
        </p>
      </article>
      <article>
        <Landmark size={23} />
        <h2>銀行網站參考</h2>
        <p>
          銀行估價可作外部參考。前台只整理公開網站來源，不把銀行網站結果包裝成平台估價。
        </p>
      </article>
    </section>

    <section className="logic-section">
      <h2>第一版 MVP 範圍</h2>
      <p>
        優先支援住宅大樓、華廈、公寓與套房。透天、豪宅、店面、辦公室、廠房、農舍、
        法拍、持分、地上權、凶宅、嚴重違建與特殊產權，會降低信心或停止自動估價。
      </p>
      <h2>免費 API 限制</h2>
      <p>
        地圖以 Leaflet 與 OpenStreetMap 圖磚為原型方案，必須顯示 OSM attribution、
        遵守快取與禁止大量下載規則。地址解析若使用 Nominatim，需限制每秒最多一請求、
        快取查詢結果、顯示來源，不做自動完成式高頻查詢。
      </p>
      <h2>免責聲明</h2>
      <p>
        本估價結果由公開資料與模型計算產生，僅供市場行情參考，不構成正式不動產估價報告、
        銀行核貸依據或成交價格保證。實際價格可能因屋況、產權、交易條件、市場變化、裝修、
        車位、特殊使用狀況與買賣雙方議價而有所不同。
      </p>
    </section>

    <BankWebsitePanel compact />
  </div>
);
