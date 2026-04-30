import { ReceiptText } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useEstimate } from "../context/EstimateContext";
import { formatWan } from "../utils/format";

export const SellerTaxCard = () => {
  const { valuation } = useEstimate();

  return (
    <section className="seller-tax-card">
      <div>
        <ReceiptText size={23} />
        <span className="eyebrow">估價結果延伸模組</span>
        <h2>出售成本試算 / 土地增值稅估算</h2>
        <p>若你打算出售此房屋，除了成交價格，也需要估算土地增值稅、自用住宅優惠與重購退稅可能性。</p>
      </div>
      <div className="seller-tax-mini">
        <span>預估成交價</span>
        <strong>{formatWan(valuation?.totalMedianWan)}</strong>
        <span>土地增值稅概算</span>
        <strong>尚未試算</strong>
        <span>自用住宅優惠</span>
        <strong>可檢查</strong>
      </div>
      <NavLink className="primary-button" to="/land-value-tax">
        開始試算土地增值稅
      </NavLink>
    </section>
  );
};
