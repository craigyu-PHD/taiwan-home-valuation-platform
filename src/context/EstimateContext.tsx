import {
  createContext,
  type PropsWithChildren,
  useContext,
  useMemo,
  useState,
} from "react";
import type { LocationCandidate, PropertyInput, RentalValuationResult, TransactionMode, ValuationResult } from "../types";
import { estimateRental } from "../services/rental";
import { createDefaultInput, estimateProperty } from "../services/valuation";

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

const readInitialMode = (): TransactionMode => {
  try {
    const stored = localStorage.getItem(MODE_STORAGE_KEY);
    return stored === "rent" ? "rent" : "sale";
  } catch {
    return "sale";
  }
};

const inferCommunityName = (candidate: LocationCandidate) => {
  const label = candidate.label.normalize("NFKC");
  if (/國[都度]花園/.test(label)) return "國都花園社區";
  const parenthesized = label.match(/[（(]([^）)]+社區)[）)]/);
  return parenthesized?.[1];
};

export const EstimateProvider = ({ children }: PropsWithChildren) => {
  const [propertyInput, setPropertyInput] = useState<PropertyInput>(() => createDefaultInput());
  const [selectedLocation, setSelectedLocationState] = useState<LocationCandidate | undefined>();
  const [valuation, setValuation] = useState<ValuationResult | undefined>();
  const [rentalValuation, setRentalValuation] = useState<RentalValuationResult | undefined>();
  const [transactionModeState, setTransactionModeState] = useState<TransactionMode>(() => readInitialMode());
  const setTransactionMode = (mode: TransactionMode) => {
    setTransactionModeState(mode);
    try {
      localStorage.setItem(MODE_STORAGE_KEY, mode);
    } catch {
      // Persistence is best-effort only.
    }
  };

  const value = useMemo<EstimateContextValue>(
    () => ({
      propertyInput,
      selectedLocation,
      valuation,
      rentalValuation,
      transactionMode: transactionModeState,
      setTransactionMode,
      setSelectedLocation: (candidate) => {
        setSelectedLocationState(candidate);
        setPropertyInput((current) => {
          const next = {
            ...current,
            communityName: inferCommunityName(candidate),
            address: candidate.label,
            city: candidate.city,
            district: candidate.district,
            road: candidate.road,
            lat: candidate.lat,
            lng: candidate.lng,
            locationConfidence: candidate.confidence,
          };
          setValuation(estimateProperty(next));
          setRentalValuation(estimateRental(next));
          return next;
        });
      },
      updatePropertyInput: (updates) => {
        setPropertyInput((current) => ({ ...current, ...updates }));
      },
      resetEstimate: () => {
        const next = createDefaultInput();
        setPropertyInput(next);
        setSelectedLocationState(undefined);
        setValuation(undefined);
        setRentalValuation(undefined);
      },
      runValuation: (updates) => {
        const next = { ...propertyInput, ...updates };
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
