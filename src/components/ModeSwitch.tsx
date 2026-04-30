import { Home, KeyRound } from "lucide-react";
import { useEstimate } from "../context/EstimateContext";
import type { TransactionMode } from "../types";

const modeMeta: Record<TransactionMode, { label: string; description: string; icon: typeof Home }> = {
  sale: {
    label: "買賣房屋",
    description: "房屋估價系統",
    icon: Home,
  },
  rent: {
    label: "租屋",
    description: "租屋行情系統",
    icon: KeyRound,
  },
};

export const ModeSwitch = ({ compact = false }: { compact?: boolean }) => {
  const { transactionMode, setTransactionMode } = useEstimate();
  return (
    <div className={`mode-switch ${compact ? "compact" : ""}`} role="group" aria-label="選擇估價模式">
      {(Object.keys(modeMeta) as TransactionMode[]).map((mode) => {
        const meta = modeMeta[mode];
        const Icon = meta.icon;
        return (
          <button
            key={mode}
            type="button"
            className={transactionMode === mode ? "active" : ""}
            onClick={() => setTransactionMode(mode)}
          >
            <Icon size={18} />
            <span>{meta.label}</span>
            {!compact && <small>{meta.description}</small>}
          </button>
        );
      })}
    </div>
  );
};
