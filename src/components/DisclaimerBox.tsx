import { AlertTriangle } from "lucide-react";

export const DisclaimerBox = ({ compact = false }: { compact?: boolean }) => (
  <section className={`disclaimer-box ${compact ? "compact" : ""}`}>
    <AlertTriangle size={20} />
    <p>
      本估價結果由公開資料與模型計算產生，僅供市場行情參考，不構成正式不動產估價報告、
      銀行核貸依據或成交價格保證。實際價格可能因屋況、產權、交易條件、市場變化、裝修、
      車位、特殊使用狀況與買賣雙方議價而不同。
    </p>
  </section>
);
