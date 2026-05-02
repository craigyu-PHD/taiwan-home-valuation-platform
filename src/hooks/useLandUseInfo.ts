import { useEffect, useState } from "react";
import { lookupLandUse, type LandUseInfo } from "../services/landUse";

type LandUseStatus = "idle" | "loading" | "ready" | "missing";

export const useLandUseInfo = (lat?: number, lng?: number) => {
  const [info, setInfo] = useState<LandUseInfo | undefined>();
  const [status, setStatus] = useState<LandUseStatus>("idle");

  useEffect(() => {
    let cancelled = false;
    if (typeof lat !== "number" || typeof lng !== "number") {
      setInfo(undefined);
      setStatus("idle");
      return;
    }

    setInfo(undefined);
    setStatus("loading");
    lookupLandUse(lat, lng)
      .then((nextInfo) => {
        if (cancelled) return;
        setInfo(nextInfo);
        setStatus(nextInfo ? "ready" : "missing");
      })
      .catch(() => {
        if (cancelled) return;
        setInfo(undefined);
        setStatus("missing");
      });

    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  return { info, status };
};
