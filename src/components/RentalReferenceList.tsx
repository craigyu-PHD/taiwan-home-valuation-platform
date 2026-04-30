import { CalendarDays, Home, MapPin } from "lucide-react";
import type { RentalReferenceCase } from "../types";
import { formatDate, formatDistance, formatRentPerPing, formatTwd } from "../utils/format";

export const RentalReferenceList = ({ cases }: { cases: RentalReferenceCase[] }) => (
  <div className="transaction-list rental-list">
    {cases.length === 0 ? (
      <div className="empty-state">目前沒有符合條件的租金參考樣本。</div>
    ) : (
      cases.map((item) => (
        <article key={item.id} className="transaction-card">
          <div className="transaction-topline">
            <strong>{item.communityName ?? item.addressLabel}</strong>
            <span>{formatRentPerPing(item.rentPerPingTwd)}</span>
          </div>
          <p>{item.addressLabel}</p>
          <div className="case-meta">
            <span><MapPin size={14} />{formatDistance(item.distanceMeters)}</span>
            <span><CalendarDays size={14} />{formatDate(item.transactionDate)}</span>
            <span><Home size={14} />{item.propertyType} / {item.areaPing} 坪</span>
          </div>
          <div className="case-footer">
            <span>推估月租 {formatTwd(item.estimatedMonthlyRentTwd)}</span>
            <span>投報 {item.grossYieldPct.toFixed(2)}%</span>
          </div>
        </article>
      ))
    )}
  </div>
);
