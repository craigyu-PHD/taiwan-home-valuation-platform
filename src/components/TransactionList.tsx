import { CalendarDays, Home, MapPin } from "lucide-react";
import type { WeightedCase } from "../types";
import { formatDate, formatDistance, formatUnitWan, formatWan } from "../utils/format";

export const TransactionList = ({ cases }: { cases: WeightedCase[] }) => (
  <div className="transaction-list">
    {cases.length === 0 ? (
      <div className="empty-state">目前沒有符合條件的周邊成交案例。</div>
    ) : (
      cases.map((item) => (
        <article key={item.id} className="transaction-card">
          <div className="transaction-topline">
            <strong>{item.communityName ?? item.addressLabel}</strong>
            <span>{formatUnitWan(item.unitPriceWan)}</span>
          </div>
          <p>{item.addressLabel}</p>
          <div className="case-meta">
            <span>
              <MapPin size={14} />
              {formatDistance(item.distanceMeters)}
            </span>
            <span>
              <CalendarDays size={14} />
              {formatDate(item.transactionDate)}
            </span>
            <span>
              <Home size={14} />
              {item.propertyType} / {item.areaPing} 坪
            </span>
          </div>
          <div className="case-footer">
            <span>{formatWan(item.totalPriceWan)}</span>
            <span>相似度 {item.matchScore}</span>
          </div>
          <div className="tag-row">
            {item.tags.slice(0, 4).map((tag) => (
              <small key={tag}>{tag}</small>
            ))}
          </div>
        </article>
      ))
    )}
  </div>
);
