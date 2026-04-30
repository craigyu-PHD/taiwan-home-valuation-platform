import type { ConfidenceLevel } from "../types";

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
  <div className={`confidence-badge ${levelClass[level]}`}>
    <div>
      <strong>{score}</strong>
      <span>/100</span>
    </div>
    <small>{level}</small>
  </div>
);
