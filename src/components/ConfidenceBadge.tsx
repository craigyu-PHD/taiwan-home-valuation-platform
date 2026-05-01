import type { ConfidenceLevel } from "../types";
import type { CSSProperties } from "react";

const levelClass: Record<ConfidenceLevel, string> = {
  高信心: "high",
  中信心: "medium",
  低信心: "low",
  不適合自動估價: "blocked",
};

export const ConfidenceBadge = ({
  score,
  level,
}: {
  score: number;
  level: ConfidenceLevel;
}) => (
  <div
    className={`confidence-badge ${levelClass[level]}`}
    style={{ "--score": `${Math.max(0, Math.min(100, score)) * 3.6}deg` } as CSSProperties & Record<"--score", string>}
  >
    <div className="confidence-ring">
      <strong>{score}</strong>
      <span>/100</span>
    </div>
    <small>{level}</small>
  </div>
);
