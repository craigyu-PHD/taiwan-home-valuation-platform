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
    ? `政府用途分類：${info.primaryName ?? "未分類"}${info.secondaryName ? `，${info.secondaryName}` : ""}${info.detailName ? ` / ${info.detailName}` : ""}`
    : status === "loading"
      ? "正在查詢最新公開圖資..."
      : hasCoordinates
        ? "此座標暫無可用土地用途別"
        : "尚未取得精準座標";
  const sectionLabel = info?.sectionName
    ? `${info.cityName ?? ""}${info.townName ?? ""} ${info.sectionName}${info.sectionCode ? `（${info.sectionCode}）` : ""}`
    : info
      ? "公開段籍查詢暫無資料"
      : "完成定位後查詢";

  return (
    <article className={`land-use-badge ${compact ? "compact" : ""} ${className ?? ""}`}>
      <div className="land-use-icon">
        {info ? <Landmark size={19} /> : <MapPinned size={19} />}
      </div>
      <div>
        <span>土地用途別</span>
        <strong>{landUseLabel}</strong>
        <div className="land-parcel-grid">
          <small>
            <MapPinnedIcon size={13} />
            公開段籍：{sectionLabel}
          </small>
        </div>
        {info ? (
          <small>
            {info.latestYear ? `${info.latestYear}年${info.latestMonth ?? ""}月資料` : "公開圖資"} · {info.sourceName}
            {info.secondaryName && info.detailName ? ` · 說明：此座標落在「${info.secondaryName}」類別中的「${info.detailName}」使用型態。` : ""}
          </small>
        ) : (
          <small>{hasCoordinates ? "請微調定位點或稍後再試。" : "完成地址或地圖定位後會自動查詢。"}</small>
        )}
      </div>
    </article>
  );
};
