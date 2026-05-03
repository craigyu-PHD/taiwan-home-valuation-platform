import { useEffect, useState } from "react";
import { getCachedLocationIntel, lookupLocationIntel, type LocationIntel } from "../services/locationIntel";

type IntelStatus = "idle" | "loading" | "ready" | "missing";

export const useLocationIntel = (lat?: number, lng?: number, radiusMeters = 1200) => {
  const [intel, setIntel] = useState<LocationIntel | undefined>();
  const [status, setStatus] = useState<IntelStatus>("idle");

  useEffect(() => {
    let cancelled = false;
    if (typeof lat !== "number" || typeof lng !== "number") {
      setIntel(undefined);
      setStatus("idle");
      return;
    }

    const cachedIntel = getCachedLocationIntel(lat, lng, radiusMeters);
    setIntel(cachedIntel);
    setStatus(cachedIntel ? "ready" : "loading");
    lookupLocationIntel(lat, lng, radiusMeters)
      .then((nextIntel) => {
        if (cancelled) return;
        setIntel(nextIntel);
        setStatus(nextIntel ? "ready" : "missing");
      })
      .catch(() => {
        if (cancelled) return;
        setIntel(undefined);
        setStatus("missing");
      });

    return () => {
      cancelled = true;
    };
  }, [lat, lng, radiusMeters]);

  return { intel, status };
};
