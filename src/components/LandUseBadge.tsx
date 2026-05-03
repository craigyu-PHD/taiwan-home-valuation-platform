import { Landmark, MapPinned } from "lucide-react";
import { useLandUseInfo } from "../hooks/useLandUseInfo";

interface LandUseBadgeProps {
  lat?: number;
  lng?: number;
  locationConfidence?: number;
  compact?: boolean;
  className?: string;
}

export const LandUseBadge = ({ lat, lng, locationConfidence, compact = false, className }: LandUseBadgeProps) => {
  const hasQueryableCoordinates = typeof lat === "number" && typeof lng === "number";
  const isApproximate = hasQueryableCoordinates && locationConfidence !== undefined && locationConfidence < 0.62;
  const shouldQuery = hasQueryableCoordinates && !isApproximate;
  const { info, status } = useLandUseInfo(shouldQuery ? lat : undefined, shouldQuery ? lng : undefined);
  const hasCoordinates = typeof lat === "number" && typeof lng === "number";
  const landUseLabel = info
    ? info.displayName ?? info.zoningName ?? info.detailName ?? info.secondaryName ?? info.primaryName ?? "公開圖資未標示細項"
    : status === "loading"
      ? "正在查詢最新公開圖資..."
      : isApproximate
        ? "需要精準座標"
        : hasCoordinates
        ? "公開圖資暫無對應用途"
        : "尚未完成定位";
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
          <small>
            {info.sampledFromNearby
              ? `定位點落在${info.originalDisplayName ?? "道路"}，已改採約 ${info.sampledDistanceMeters ?? 20} 公尺內建築用地判讀：${classificationText}`
              : classificationText || "已依目前座標判讀；正式用途仍以主管機關核定為準。"}
          </small>
        ) : (
          <small>
            {isApproximate
              ? "目前只有行政區或模糊座標，請選擇地址候選、社區候選或用地圖校正後再判讀。"
              : hasCoordinates
                ? "可微調定位點重新查詢。"
                : "輸入地址、社區或地圖選點後會自動查詢。"}
          </small>
        )}
      </div>
    </article>
  );
};
