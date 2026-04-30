import { Loader2, LocateFixed, MapPin, Search } from "lucide-react";
import { FormEvent, useState } from "react";
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
      setMessage("找不到明確位置。請補充縣市、行政區或改用地圖手動選點。");
      return;
    }

    if (results.length === 1) {
      selectCandidate(results[0]);
      return;
    }

    setCandidates(results);
    setMessage("請確認最接近的候選位置。");
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
              <small>{candidate.source === "nominatim" ? "OSM Nominatim" : "本地範例"}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
