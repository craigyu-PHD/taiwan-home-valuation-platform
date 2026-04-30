import { Landmark, MapPinned, MapPinnedIcon } from "lucide-react";
import { useLandUseInfo } from "../hooks/useLandUseInfo";

interface LandUseBadgeProps {
  lat?: number;
  lng?: number;
  compact?: boolean;
  className?: string;
}

export const LandUseBadge = ({ lat, lng, compact = false, className }: LandUseBadgeProps) => {
  const { info, status } = useLandUseInfo(lat, lng);
  const hasCoordinates = typeof lat === "number" && typeof lng === "number";
  const landUseLabel = info
    ? info.displayName ?? info.zoningName ?? info.detailName ?? info.secondaryName ?? info.primaryName ?? "公開圖資未標示細項"
    : status === "loading"
      ? "正在查詢最新公開圖資..."
      : hasCoordinates
        ? "此座標暫無可用土地用途別"
        : "尚未取得精準座標";
  const sourceText = info?.sourceLabel ?? info?.sourceName ?? "公開圖資";

  return (
    <article className={`land-use-badge ${compact ? "compact" : ""} ${className ?? ""}`}>
      <div className="land-use-icon">
        {info ? <Landmark size={19} /> : <MapPinned size={19} />}
      </div>
      <div>
        <span>土地用途別</span>
        <strong>{landUseLabel}</strong>
        {info && (
          <div className="land-use-detail-grid" aria-label="土地用途摘要">
            <div>
              <span>用途來源</span>
              <strong>{sourceText}</strong>
            </div>
            <div>
              <span>現況分類</span>
              <strong>{[info.primaryName, info.secondaryName].filter(Boolean).join(" / ") || "未標示"}</strong>
            </div>
          </div>
        )}
        {!info && (
          <div className="land-parcel-grid">
            <small>
              <MapPinnedIcon size={13} />
              完成定位後查詢公開圖資
            </small>
          </div>
        )}
        {info ? (
          <small>
            {info.latestYear ? `${info.latestYear}年${info.latestMonth ?? ""}月資料` : "公開圖資"} · {info.detailSummary ?? info.sourceNote}
          </small>
        ) : (
          <small>{hasCoordinates ? "請微調定位點或稍後再試。" : "完成地址或地圖定位後會自動查詢。"}</small>
        )}
      </div>
    </article>
  );
};
