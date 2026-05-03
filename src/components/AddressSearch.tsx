import { Loader2, LocateFixed, MapPin, Search, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEstimate } from "../context/EstimateContext";
import { searchAddress } from "../services/geocode";
import type { LocationCandidate } from "../types";

interface AddressSearchProps {
  compact?: boolean;
  buttonLabel?: string;
  onSelect?: (candidate: LocationCandidate) => void;
}

export const AddressSearch = ({ compact, buttonLabel = "立即估價", onSelect }: AddressSearchProps) => {
  const navigate = useNavigate();
  const { propertyInput, setSelectedLocation } = useEstimate();
  const [query, setQuery] = useState(propertyInput.address);
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<LocationCandidate[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setQuery(propertyInput.address);
  }, [propertyInput.address]);

  const selectCandidate = (candidate: LocationCandidate) => {
    setSelectedLocation(candidate);
    setQuery(candidate.label);
    setCandidates([]);
    setMessage("");
    onSelect?.(candidate);
    if (!onSelect) navigate("/estimate/result");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setLoading(true);
    const results = await searchAddress(query);
    setLoading(false);

    if (results.length === 0) {
      setCandidates([]);
      setMessage("目前找不到可辨識位置。可輸入縣市、行政區、路名、社區或地標，系統會用模糊搜尋協助定位。");
      return;
    }

    const first = results[0];
    const shouldAutoSelect =
      (results.length === 1 && first?.source !== "manual" && first.confidence >= 0.78) ||
      (results.length === 1 && first?.source === "manual" && first.confidence >= 0.55) ||
      (first?.source === "local" && first.confidence >= 0.88);
    if (shouldAutoSelect) {
      selectCandidate(results[0]);
      return;
    }

    setCandidates(results);
    setMessage("已用模糊搜尋找到候選位置，請選擇最接近的一筆。");
  };

  return (
    <div className={`address-search ${compact ? "compact" : ""}`}>
      <form className="address-form" onSubmit={submit}>
        <div className="input-with-icon">
          <Search size={20} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="輸入地址、路段、社區或地標"
            aria-label="輸入地址、路段、社區或地標"
          />
          {query && (
            <button
              type="button"
              className="input-clear-button"
              aria-label="清除地址搜尋"
              onClick={() => {
                setQuery("");
                setCandidates([]);
                setMessage("");
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>
        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? <Loader2 className="spin" size={18} /> : <LocateFixed size={18} />}
          {buttonLabel}
        </button>
      </form>
      {message && <p className="form-message">{message}</p>}
      {candidates.length > 0 && (
        <div className="candidate-list">
          {candidates.map((candidate) => (
            <button key={candidate.id} type="button" onClick={() => selectCandidate(candidate)}>
              <MapPin size={17} />
              <span>{candidate.label}</span>
              <small>{candidate.source === "nominatim" ? "OSM / 模糊搜尋" : candidate.source === "manual" ? "模糊定位" : "本地地標"}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
