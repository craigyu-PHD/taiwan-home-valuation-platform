import { Landmark, MapPinned } from "lucide-react";
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
  const classificationText = info
    ? [info.primaryName, info.secondaryName, info.detailName].filter(Boolean).join(" / ")
    : undefined;

  return (
    <article className={`land-use-badge ${compact ? "compact" : ""} ${className ?? ""}`}>
      <div className="land-use-icon">
        {info ? <Landmark size={19} /> : <MapPinned size={19} />}
      </div>
      <div>
        <span>土地用途別</span>
        <strong>{landUseLabel}</strong>
        {info ? (
          <small>{classificationText || "完成定位後依公開圖資判讀；正式用途仍以主管機關核定為準。"}</small>
        ) : (
          <small>{hasCoordinates ? "請微調定位點或稍後再試。" : "完成地址或地圖定位後會自動查詢。"}</small>
        )}
      </div>
    </article>
  );
};
