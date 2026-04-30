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
    ? info.detailName ?? info.secondaryName ?? info.primaryName ?? "公開圖資未標示細項"
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
        {info && (
          <div className="land-use-detail-grid">
            <div>
              <span>政府大類</span>
              <strong>{info.primaryName ?? "未標示"}</strong>
            </div>
            <div>
              <span>用途類別</span>
              <strong>{info.secondaryName ?? "未標示"}</strong>
            </div>
            <div>
              <span>使用細項</span>
              <strong>{info.detailName ?? "未標示"}</strong>
            </div>
            <div>
              <span>公開段籍</span>
              <strong>{sectionLabel}</strong>
            </div>
          </div>
        )}
        {!info && (
          <div className="land-parcel-grid">
            <small>
              <MapPinnedIcon size={13} />
              公開段籍：{sectionLabel}
            </small>
          </div>
        )}
        {info ? (
          <small>
            {info.latestYear ? `${info.latestYear}年${info.latestMonth ?? ""}月資料` : "公開圖資"} · {info.sourceName}
            {info.secondaryName && info.detailName ? ` · 此座標落在「${info.secondaryName}」類別中的「${info.detailName}」使用型態。完整地號需授權地籍服務，本系統不以免費資料硬推。` : ""}
          </small>
        ) : (
          <small>{hasCoordinates ? "請微調定位點或稍後再試。" : "完成地址或地圖定位後會自動查詢。"}</small>
        )}
      </div>
    </article>
  );
};
