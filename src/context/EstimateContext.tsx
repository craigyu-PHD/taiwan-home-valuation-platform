import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { LocationCandidate, PropertyInput, RentalValuationResult, TransactionMode, ValuationResult } from "../types";
import { demoTransactions } from "../data/demoTransactions";
import { estimateRental } from "../services/rental";
import { createDefaultInput, estimateProperty } from "../services/valuation";
import { cleanAdministrativeAddress, isAdministrativeOnlyAddress } from "../utils/addressNormalize";
import {
  cleanCommunityDisplayName,
  inferCommunityFromCandidate,
  inferCommunityFromNearbyTransactions,
} from "../utils/community";

interface EstimateContextValue {
  propertyInput: PropertyInput;
  selectedLocation?: LocationCandidate;
  valuation?: ValuationResult;
  rentalValuation?: RentalValuationResult;
  transactionMode: TransactionMode;
  setTransactionMode: (mode: TransactionMode) => void;
  setSelectedLocation: (candidate: LocationCandidate) => void;
  updatePropertyInput: (updates: Partial<PropertyInput>) => void;
  resetEstimate: () => void;
  runValuation: (updates?: Partial<PropertyInput>) => ValuationResult;
}

const EstimateContext = createContext<EstimateContextValue | undefined>(undefined);
const MODE_STORAGE_KEY = "taiwan-valuation-transaction-mode";
const ESTIMATE_STORAGE_KEY = "taiwan-valuation-current-estimate-v4";

type PersistedEstimateState = {
  propertyInput: PropertyInput;
  selectedLocation?: LocationCandidate;
};

const sanitizeLocationCandidate = (candidate?: LocationCandidate) => {
  if (!candidate) return undefined;
  const approximateFallback =
    candidate.source === "manual" && /^(admin-fuzzy|structured-)/.test(candidate.id);
  return {
    ...candidate,
    label: cleanAdministrativeAddress(candidate.label, candidate.city, candidate.district) || candidate.label,
    confidence: approximateFallback ? Math.min(candidate.confidence, 0.68) : candidate.confidence,
  };
};

const sanitizePropertyInput = (input: PropertyInput): PropertyInput => {
  const address = input.address ? cleanAdministrativeAddress(input.address, input.city, input.district) : input.address;
  const approximateAddress = isAdministrativeOnlyAddress(address, input.city, input.district);
  return {
    ...input,
    address,
    communityName: cleanCommunityDisplayName(input.communityName, input.city, input.district),
    locationConfidence: approximateAddress ? Math.min(input.locationConfidence, 0.68) : input.locationConfidence,
  };
};

const readInitialMode = (): TransactionMode => {
  try {
    const stored = localStorage.getItem(MODE_STORAGE_KEY);
    return stored === "rent" ? "rent" : "sale";
  } catch {
    return "sale";
  }
};

const readInitialEstimate = (): PersistedEstimateState => {
  const fallback = { propertyInput: createDefaultInput() };
  try {
    const raw = localStorage.getItem(ESTIMATE_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PersistedEstimateState>;
    if (!parsed.propertyInput || typeof parsed.propertyInput !== "object") return fallback;
    return {
      propertyInput: sanitizePropertyInput({
        ...createDefaultInput(),
        ...parsed.propertyInput,
      }),
      selectedLocation: sanitizeLocationCandidate(parsed.selectedLocation),
    };
  } catch {
    return fallback;
  }
};

export const EstimateProvider = ({ children }: PropsWithChildren) => {
  const [propertyInput, setPropertyInput] = useState<PropertyInput>(() => readInitialEstimate().propertyInput);
  const [selectedLocation, setSelectedLocationState] = useState<LocationCandidate | undefined>(() => readInitialEstimate().selectedLocation);
  const [valuation, setValuation] = useState<ValuationResult | undefined>(() => {
    const initial = readInitialEstimate().propertyInput;
    return initial.address && initial.lat && initial.lng ? estimateProperty(initial) : undefined;
  });
  const [rentalValuation, setRentalValuation] = useState<RentalValuationResult | undefined>(() => {
    const initial = readInitialEstimate().propertyInput;
    return initial.address && initial.lat && initial.lng ? estimateRental(initial) : undefined;
  });
  const [transactionModeState, setTransactionModeState] = useState<TransactionMode>(() => readInitialMode());
  const setTransactionMode = (mode: TransactionMode) => {
    setTransactionModeState(mode);
    try {
      localStorage.setItem(MODE_STORAGE_KEY, mode);
    } catch {
      // Persistence is best-effort only.
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem(ESTIMATE_STORAGE_KEY, JSON.stringify({ propertyInput, selectedLocation }));
    } catch {
      // Persistence is best-effort only.
    }
  }, [propertyInput, selectedLocation]);

  const value = useMemo<EstimateContextValue>(
    () => ({
      propertyInput,
      selectedLocation,
      valuation,
      rentalValuation,
      transactionMode: transactionModeState,
      setTransactionMode,
      setSelectedLocation: (candidate) => {
        const normalizedCandidate = sanitizeLocationCandidate(candidate) ?? candidate;
        setSelectedLocationState(normalizedCandidate);
        setPropertyInput((current) => {
          const communityName =
            inferCommunityFromCandidate(normalizedCandidate) ??
            inferCommunityFromNearbyTransactions(normalizedCandidate, demoTransactions);
          const next = sanitizePropertyInput({
            ...current,
            communityName,
            address: normalizedCandidate.label,
            city: normalizedCandidate.city,
            district: normalizedCandidate.district,
            road: normalizedCandidate.road,
            lat: normalizedCandidate.lat,
            lng: normalizedCandidate.lng,
            locationConfidence: normalizedCandidate.confidence,
          });
          setValuation(estimateProperty(next));
          setRentalValuation(estimateRental(next));
          return next;
        });
      },
      updatePropertyInput: (updates) => {
        setPropertyInput((current) => sanitizePropertyInput({ ...current, ...updates }));
      },
      resetEstimate: () => {
        const next = createDefaultInput();
        setPropertyInput(next);
        setSelectedLocationState(undefined);
        setValuation(undefined);
        setRentalValuation(undefined);
      },
      runValuation: (updates) => {
        const next = sanitizePropertyInput({ ...propertyInput, ...updates });
        setPropertyInput(next);
        const result = estimateProperty(next);
        setRentalValuation(estimateRental(next));
        setValuation(result);
        return result;
      },
    }),
    [propertyInput, selectedLocation, valuation, rentalValuation, transactionModeState],
  );

  return <EstimateContext.Provider value={value}>{children}</EstimateContext.Provider>;
};

export const useEstimate = () => {
  const context = useContext(EstimateContext);
  if (!context) throw new Error("useEstimate must be used within EstimateProvider");
  return context;
};
