import { useEffect, useState } from "react";

export type DeviceType = "mobile" | "desktop";

const detectDeviceType = (): DeviceType => {
  if (typeof window === "undefined") return "desktop";
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const narrowViewport = window.matchMedia("(max-width: 760px)").matches;
  const mobileAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(window.navigator.userAgent);
  return narrowViewport || (coarsePointer && mobileAgent) ? "mobile" : "desktop";
};

export const useDeviceType = () => {
  const [deviceType, setDeviceType] = useState<DeviceType>(() => detectDeviceType());

  useEffect(() => {
    const queries = [
      window.matchMedia("(max-width: 760px)"),
      window.matchMedia("(pointer: coarse)"),
    ];
    const update = () => setDeviceType(detectDeviceType());
    queries.forEach((query) => query.addEventListener("change", update));
    window.addEventListener("orientationchange", update);
    window.addEventListener("resize", update);
    return () => {
      queries.forEach((query) => query.removeEventListener("change", update));
      window.removeEventListener("orientationchange", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return deviceType;
};
