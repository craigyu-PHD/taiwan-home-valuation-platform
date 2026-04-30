import { ExternalLink, Landmark } from "lucide-react";
import { bankWebsiteSources } from "../data/bankReferences";

export const BankWebsitePanel = ({ compact = false }: { compact?: boolean }) => (
  <section className={`bank-website-panel ${compact ? "compact" : ""}`}>
    <div className="section-heading">
      <span className="eyebrow">銀行估價資料源</span>
      <h2>銀行估價網站</h2>
      <p>這裡只整理銀行公開估價或房貸試算網站，方便使用者自行比對；本系統估價仍以公開實價登錄與可解釋模型為主。</p>
    </div>
    <div className="bank-website-grid">
      {bankWebsiteSources.map((source) => (
        <article key={source.id} className="bank-website-card">
          <div>
            <Landmark size={20} />
            <strong>{source.name}</strong>
          </div>
          <p>{source.description}</p>
          <a href={source.url} target="_blank" rel="noreferrer" className="text-link">
            前往網站
            <ExternalLink size={15} />
          </a>
        </article>
      ))}
    </div>
  </section>
);
