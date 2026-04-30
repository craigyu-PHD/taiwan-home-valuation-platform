export const formatWan = (value?: number) => {
  if (value === undefined || Number.isNaN(value)) return "無法估算";
  return `${Math.round(value).toLocaleString("zh-TW")} 萬`;
};

export const formatUnitWan = (value?: number) => {
  if (value === undefined || Number.isNaN(value)) return "無法估算";
  return `${value.toFixed(1)} 萬/坪`;
};

export const formatTwd = (value?: number) => {
  if (value === undefined || Number.isNaN(value)) return "無法估算";
  return `${Math.round(value).toLocaleString("zh-TW")} 元`;
};

export const formatRentPerPing = (value?: number) => {
  if (value === undefined || Number.isNaN(value)) return "無法估算";
  return `${Math.round(value).toLocaleString("zh-TW")} 元/坪`;
};

export const formatDistance = (meters?: number) => {
  if (meters === undefined) return "無資料";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
};

export const formatDate = (date?: string) => {
  if (!date) return "無資料";
  return date.replaceAll("-", "/");
};

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export const haversineMeters = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const radius = 6371000;
  const dLat = toRadians(bLat - aLat);
  const dLng = toRadians(bLng - aLng);
  const lat1 = toRadians(aLat);
  const lat2 = toRadians(bLat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * radius * Math.asin(Math.sqrt(x));
};
