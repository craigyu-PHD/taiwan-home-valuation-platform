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

export const EstimateProvider = ({ children }: PropsWithChildren) => {
  const [propertyInput, setPropertyInput] = useState<PropertyInput>(() => createDefaultInput());
  const [selectedLocation, setSelectedLocationState] = useState<LocationCandidate | undefined>({
    id: "default",
    label: "桃園市桃園區莊敬路二段 103 號（國都花園社區）",
    city: "桃園市",
    district: "桃園區",
    road: "莊敬路二段",
    lat: 25.02247,
    lng: 121.29303,
    confidence: 0.9,
    source: "local",
  });
  const [valuation, setValuation] = useState<ValuationResult | undefined>(() =>
    estimateProperty(createDefaultInput()),
  );
  const [rentalValuation, setRentalValuation] = useState<RentalValuationResult | undefined>(() =>
    estimateRental(createDefaultInput()),
  );
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
            communityName: candidate.label.includes("國都花園") || candidate.label.includes("國度花園")
              ? "國都花園社區"
              : undefined,
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
