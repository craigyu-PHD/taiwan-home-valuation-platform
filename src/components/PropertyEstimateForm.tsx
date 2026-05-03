import {
  ArrowRight,
  Building2,
  Car,
  Layers,
  MapPin,
  RotateCcw,
  Ruler,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEstimate } from "../context/EstimateContext";
import { demoTransactions } from "../data/demoTransactions";
import { taiwanAdmin, taiwanCities } from "../data/taiwanAdmin";
import { getBoundaryCenter, getTownBoundary } from "../services/boundaries";
import { searchAddress } from "../services/geocode";
import { propertyTypes, specialFactors } from "../services/valuation";
import type { LocationCandidate, ParkingType, PropertyInput, SpecialFactor, ValuationResult, ValuationSourceMode } from "../types";
import { normalizeAddressText } from "../utils/addressNormalize";
import { inferCommunityFromCandidate, inferCommunityFromNearbyTransactions, inferCommunityFromText } from "../utils/community";

interface PropertyEstimateFormProps {
  compact?: boolean;
  submitLabel?: string;
  stayOnPage?: boolean;
  onEstimated?: (result: ValuationResult) => void;
}

const updateNumber = (value: string) => (value === "" ? undefined : Number(value));
const FALLBACK_CITY = "臺北市";
const ClearableInput = ({
  value,
  onChange,
  onClear,
  placeholder,
  ariaLabel,
  type = "text",
  inputMode,
  min,
}: {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  ariaLabel: string;
  type?: string;
  inputMode?: "text" | "decimal" | "numeric";
  min?: string;
}) => (
  <div className="clearable-field">
    <input
      type={type}
      inputMode={inputMode}
      min={min}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
    />
    {value && (
      <button
        type="button"
        className="field-clear-button"
        onClick={() => (onClear ? onClear() : onChange(""))}
        aria-label={`清除${ariaLabel}`}
      >
        <X size={14} />
      </button>
    )}
  </div>
);

const ClearableSelect = ({
  value,
  onChange,
  onClear,
  options,
  ariaLabel,
  placeholder = "請選擇",
}: {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  options: readonly string[];
  ariaLabel: string;
  placeholder?: string;
}) => (
  <div className="clearable-field clearable-select-field">
    <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={ariaLabel}>
      <option value="">{placeholder}</option>
      {options.map((item) => (
        <option key={item} value={item}>
          {item}
        </option>
      ))}
    </select>
    {value && (
      <button type="button" className="field-clear-button" onClick={onClear} aria-label={`清除${ariaLabel}`}>
        <X size={14} />
      </button>
    )}
  </div>
);
const splitRoadAndSection = (value?: string) => {
  const normalized = value?.normalize("NFKC").trim() ?? "";
  const match = normalized.match(/^(.*?)([一二三四五六七八九十0-9]+)段$/);
  return {
    roadName: match?.[1] || normalized,
    sectionText: match?.[2] ?? "",
  };
};
const extractHouseNumber = (value?: string) =>
  value?.normalize("NFKC").match(/([0-9]+(?:-[0-9]+)?|[一二三四五六七八九十百]+)\s*號/)?.[1] ?? "";

export const PropertyEstimateForm = ({
  compact = false,
  submitLabel = "立刻估價",
  stayOnPage = false,
  onEstimated,
}: PropertyEstimateFormProps) => {
  const navigate = useNavigate();
  const { propertyInput, setSelectedLocation, updatePropertyInput, resetEstimate, runValuation } = useEstimate();
  const initialRoad = splitRoadAndSection(propertyInput.road);
  const [city, setCity] = useState(propertyInput.city ?? FALLBACK_CITY);
  const districts = useMemo(() => taiwanAdmin[city as keyof typeof taiwanAdmin] ?? [], [city]);
  const [district, setDistrict] = useState(propertyInput.district ?? districts[0] ?? "");
  const [road, setRoad] = useState(initialRoad.roadName);
  const [section, setSection] = useState(initialRoad.sectionText);
  const [lane, setLane] = useState("");
  const [alley, setAlley] = useState("");
  const [number, setNumber] = useState(extractHouseNumber(propertyInput.address));
  const [floorText, setFloorText] = useState(String(propertyInput.floor ?? 10));
  const [mode, setMode] = useState<ValuationSourceMode>(propertyInput.valuationMode ?? "智慧估價");
  const [searchMode, setSearchMode] = useState<"地址搜尋" | "社區搜尋">("地址搜尋");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    if (!districts.includes(district as never)) {
      setDistrict(districts[0] ?? "");
    }
  }, [district, districts]);

  useEffect(() => {
    if (propertyInput.city) {
      setCity(propertyInput.city);
    } else if (!propertyInput.address) {
      setCity(FALLBACK_CITY);
    }
    if (propertyInput.district) {
      setDistrict(propertyInput.district);
    } else if (!propertyInput.address) {
      const fallbackDistricts = taiwanAdmin[FALLBACK_CITY as keyof typeof taiwanAdmin] ?? [];
      setDistrict(fallbackDistricts[0] ?? "");
    }
    if (propertyInput.road) {
      const nextRoad = splitRoadAndSection(propertyInput.road);
      setRoad(nextRoad.roadName);
      setSection(nextRoad.sectionText);
    } else if (!propertyInput.address) {
      setRoad("");
      setSection("");
    }
    if (propertyInput.communityName) {
      setKeyword(propertyInput.communityName);
    } else if (!propertyInput.address) {
      setKeyword("");
    }
    const nextNumber = extractHouseNumber(propertyInput.address);
    if (nextNumber) {
      setNumber(nextNumber);
    } else if (!propertyInput.address) {
      setNumber("");
    }
    if (propertyInput.floor !== undefined) setFloorText(String(propertyInput.floor));
    if (propertyInput.valuationMode) setMode(propertyInput.valuationMode);
  }, [
    propertyInput.address,
    propertyInput.city,
    propertyInput.district,
    propertyInput.road,
    propertyInput.communityName,
    propertyInput.floor,
    propertyInput.valuationMode,
  ]);

  const buildAddress = () => {
    if (searchMode === "社區搜尋") {
      return [city, district, keyword].filter(Boolean).join("");
    }
    const roadPart = road ? `${road}${section ? `${section}段` : ""}` : "";
    const parts = [
      city,
      district,
      roadPart,
      road && lane ? `${lane}巷` : "",
      road && alley ? `${alley}弄` : "",
      road && number ? `${number}號` : "",
    ];
    return parts.filter(Boolean).join("");
  };

  const clearRoadParts = () => {
    setRoad("");
    setSection("");
    setLane("");
    setAlley("");
    setNumber("");
  };
  const clearCity = () => {
    setCity("");
    setDistrict("");
  };

  const addressPreview = buildAddress();
  const clearableAddressParts = [
    { label: "縣市", value: city, clear: clearCity },
    { label: "區域", value: district, clear: () => setDistrict("") },
    { label: "社區", value: searchMode === "社區搜尋" ? keyword : "", clear: () => setKeyword("") },
    { label: "路名", value: road, clear: clearRoadParts },
    { label: "段", value: road ? section : "", clear: () => setSection("") },
    { label: "巷", value: road ? lane : "", clear: () => setLane("") },
    { label: "弄", value: road ? alley : "", clear: () => setAlley("") },
    { label: "號", value: road ? number : "", clear: () => setNumber("") },
  ].filter((item) => item.value);

  const syncAddress = async () => {
    const address = buildAddress();
    const geocoded = await searchAddress(address);
    const bestMatch = geocoded[0];
    const boundary = await getTownBoundary(city, district);
    const center = getBoundaryCenter(boundary?.geometry);
    const communityName =
      (searchMode === "社區搜尋" ? inferCommunityFromText(keyword) : undefined) ??
      (bestMatch ? inferCommunityFromCandidate(bestMatch) : undefined) ??
      inferCommunityFromText(address);
    const bestMatchIsPrecise = bestMatch && bestMatch.source !== "manual";
    const fallbackConfidence = center
      ? searchMode === "地址搜尋"
        ? road && number
          ? 0.58
          : road
            ? 0.56
            : 0.52
        : keyword
          ? 0.6
          : 0.52
      : 0.58;
    const candidate: LocationCandidate = {
      id: `structured-${normalizeAddressText(address)}`,
      label: address,
      city: bestMatch?.city ?? city,
      district: bestMatch?.district ?? district,
      road: bestMatch?.road ?? (searchMode === "地址搜尋" && road ? `${road}${section ? `${section}段` : ""}` : undefined),
      lat: bestMatch?.lat ?? center?.[0] ?? propertyInput.lat ?? 25.033964,
      lng: bestMatch?.lng ?? center?.[1] ?? propertyInput.lng ?? 121.564468,
      confidence: bestMatchIsPrecise ? Math.max(bestMatch.confidence, 0.74) : fallbackConfidence,
      source: bestMatch?.source ?? "manual",
    };
    const resolvedCommunityName = communityName ?? inferCommunityFromNearbyTransactions(candidate, demoTransactions);
    setSelectedLocation(candidate);
    updatePropertyInput({
      floor: updateNumber(floorText),
      city,
      district,
      road: candidate.road,
      communityName: resolvedCommunityName,
      address,
      lat: candidate.lat,
      lng: candidate.lng,
      locationConfidence: candidate.confidence,
      valuationMode: mode,
    });
    return candidate;
  };

  const submit = async () => {
    const candidate = await syncAddress();
    const communityName =
      (searchMode === "社區搜尋" ? inferCommunityFromText(keyword) : undefined) ??
      inferCommunityFromCandidate(candidate) ??
      inferCommunityFromNearbyTransactions(candidate, demoTransactions);
    const result = runValuation({
      address: candidate.label,
      city: candidate.city,
      district: candidate.district,
      road: candidate.road,
      communityName,
      lat: candidate.lat,
      lng: candidate.lng,
      locationConfidence: candidate.confidence,
      floor: updateNumber(floorText),
      valuationMode: mode,
    });
    onEstimated?.(result);
    if (!stayOnPage) navigate("/estimate/result");
  };

  const reset = () => {
    const fallbackDistricts = taiwanAdmin[FALLBACK_CITY as keyof typeof taiwanAdmin] ?? [];
    setCity(FALLBACK_CITY);
    setDistrict(fallbackDistricts[0] ?? "");
    setRoad("");
    setSection("");
    setLane("");
    setAlley("");
    setNumber("");
    setFloorText("");
    setKeyword("");
    resetEstimate();
  };

  const toggleSpecialFactor = (factor: SpecialFactor) => {
    const nextFactors = propertyInput.specialFactors.includes(factor)
      ? propertyInput.specialFactors.filter((item) => item !== factor)
      : [...propertyInput.specialFactors, factor];
    updatePropertyInput({ specialFactors: nextFactors });
  };

  return (
    <section className={`structured-form ${compact ? "compact" : ""}`}>
      <div className="valuation-mode-tabs">
        {(["實價登錄", "開價搜尋", "智慧估價"] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={mode === item ? "active" : ""}
            onClick={() => {
              setMode(item);
              updatePropertyInput({ valuationMode: item });
            }}
          >
            {item}
          </button>
        ))}
      </div>
      <p className={`valuation-mode-note ${mode === "開價搜尋" ? "ask-mode" : mode === "實價登錄" ? "transaction-mode" : "ai-mode"}`}>
        <strong>{mode}</strong>
        {mode === "實價登錄"
          ? "以公開成交與可比案例為主，檢查實際成交價格區間。"
          : mode === "開價搜尋"
            ? "以成交資料反推合理開價帶，不把開價當成交價。"
            : "整合成交、條件、區域與風險，輸出中立估價區間。"}
      </p>
      <div className="search-mode-tabs">
        <button
          type="button"
          className={searchMode === "地址搜尋" ? "active" : ""}
          onClick={() => setSearchMode("地址搜尋")}
        >
          <Search size={17} />
          地址搜尋
        </button>
        <button
          type="button"
          className={searchMode === "社區搜尋" ? "active" : ""}
          onClick={() => setSearchMode("社區搜尋")}
        >
          <MapPin size={17} />
          社區搜尋
        </button>
      </div>

      <div className="structured-section-title">
        <MapPin size={18} />
        <strong>{searchMode === "地址搜尋" ? "地址搜尋" : "社區搜尋"}</strong>
      </div>
      {searchMode === "地址搜尋" ? (
        <div className="structured-grid address-parts">
          <label>
            縣市 *
            <ClearableSelect value={city} onChange={setCity} onClear={clearCity} options={taiwanCities} ariaLabel="縣市" />
          </label>
          <label>
            區域 *
            <ClearableSelect value={district} onChange={setDistrict} onClear={() => setDistrict("")} options={districts} ariaLabel="區域" />
          </label>
          <label>
            路名
            <ClearableInput value={road} onChange={setRoad} onClear={clearRoadParts} placeholder="例：信義路" ariaLabel="路名" />
          </label>
          <label>
            段
            <ClearableInput value={section} onChange={setSection} placeholder="例：五 / 5" ariaLabel="段" />
          </label>
          <label>
            巷
            <ClearableInput value={lane} onChange={setLane} placeholder="可空白" ariaLabel="巷" />
          </label>
          <label>
            弄
            <ClearableInput value={alley} onChange={setAlley} placeholder="可空白" ariaLabel="弄" />
          </label>
          <label>
            號
            <ClearableInput value={number} onChange={setNumber} placeholder="例：7" ariaLabel="號" />
          </label>
        </div>
      ) : (
        <div className="structured-grid address-parts">
          <label>
            縣市 *
            <ClearableSelect value={city} onChange={setCity} onClear={clearCity} options={taiwanCities} ariaLabel="縣市" />
          </label>
          <label>
            區域 *
            <ClearableSelect value={district} onChange={setDistrict} onClear={() => setDistrict("")} options={districts} ariaLabel="區域" />
          </label>
          <label className="wide-field">
            社區名稱 / 建案名稱 / 地標
            <ClearableInput
              value={keyword}
              onChange={setKeyword}
              placeholder="例：國都花園社區、台北101、青埔特區"
              ariaLabel="社區名稱、建案名稱或地標"
            />
          </label>
          <label>
            比對範圍
            <select>
              <option>同社區優先</option>
              <option>同社區 + 同路段</option>
              <option>同生活圈輔助</option>
            </select>
          </label>
          <label>
            資料期間
            <select>
              <option>近 12 個月優先</option>
              <option>近 24 個月</option>
              <option>近 36 個月</option>
            </select>
          </label>
        </div>
      )}

      <div className="address-compose-preview">
        <div>
          <span>目前組合</span>
          <strong>{addressPreview || "尚未輸入地址"}</strong>
        </div>
        <div className="address-chip-row" aria-label="可清除的地址欄位">
          {clearableAddressParts.length ? (
            clearableAddressParts.map((item) => (
              <button key={item.label} type="button" onClick={item.clear}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <X size={13} />
              </button>
            ))
          ) : (
            <small>可直接貼上完整地址，也可分欄輸入後逐欄清除。</small>
          )}
        </div>
      </div>

      {advancedOpen && (
        <div className="advanced-filter-panel">
          <div className="advanced-panel-heading">
            <Building2 size={18} />
            <strong>估價條件與進階篩選</strong>
            <span>條件越完整，系統越能縮小價格區間並提高信心分數。</span>
          </div>
          <label>
            房屋類型
            <select
              value={propertyInput.propertyType}
              onChange={(event) =>
                updatePropertyInput({ propertyType: event.target.value as PropertyInput["propertyType"] })
              }
            >
              {propertyTypes.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <label>
            <span>
              <Ruler size={15} />
              權狀坪數
            </span>
            <input
              type="number"
              inputMode="decimal"
              min="1"
              value={propertyInput.areaPing ?? ""}
              onChange={(event) => updatePropertyInput({ areaPing: updateNumber(event.target.value) })}
            />
          </label>
          <label>
            樓層
            <ClearableInput
              type="number"
              inputMode="numeric"
              value={floorText}
              onChange={setFloorText}
              placeholder="例：10"
              ariaLabel="樓層"
            />
          </label>
          <label>
            <span>
              <Layers size={15} />
              總樓層
            </span>
            <input
              type="number"
              inputMode="numeric"
              value={propertyInput.totalFloors ?? ""}
              onChange={(event) => updatePropertyInput({ totalFloors: updateNumber(event.target.value) })}
            />
          </label>
          <label>
            屋齡
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={propertyInput.ageYears ?? ""}
              onChange={(event) => updatePropertyInput({ ageYears: updateNumber(event.target.value) })}
            />
          </label>
          <label>
            <span>
              <Car size={15} />
              車位
            </span>
            <select
              value={propertyInput.parkingType}
              onChange={(event) =>
                updatePropertyInput({
                  parkingType: event.target.value as ParkingType,
                  hasParking: event.target.value !== "無",
                })
              }
            >
              {["無", "坡道平面", "坡道機械", "機械", "平面", "其他"].map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <label>
            屋況
            <select
              value={propertyInput.condition}
              onChange={(event) => updatePropertyInput({ condition: event.target.value as PropertyInput["condition"] })}
            >
              {["未提供", "待整理", "一般", "良好", "新裝修"].map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <label>
            使用狀態
            <select
              value={propertyInput.occupancy}
              onChange={(event) => updatePropertyInput({ occupancy: event.target.value as PropertyInput["occupancy"] })}
            >
              {["未提供", "自住", "出租中", "空屋", "自用營業"].map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <div className="special-factor-field">
            <span>特殊狀況</span>
            <div className="special-factor-grid">
              {specialFactors.map((factor) => (
                <label className="checkbox-pill" key={factor}>
                  <input
                    type="checkbox"
                    checked={propertyInput.specialFactors.includes(factor)}
                    onChange={() => toggleSpecialFactor(factor)}
                  />
                  <span>{factor}</span>
                </label>
              ))}
            </div>
          </div>
          <label>
            交易狀態
            <select>
              <option>全部</option>
              <option>新成屋</option>
              <option>預售屋</option>
              <option>中古屋</option>
            </select>
          </label>
          <label>
            單價範圍
            <select>
              <option>不限</option>
              <option>30 萬/坪以下</option>
              <option>30-60 萬/坪</option>
              <option>60-100 萬/坪</option>
              <option>100 萬/坪以上</option>
            </select>
          </label>
        </div>
      )}
      <div className="form-action-row">
        <button className="text-reset-button" type="button" onClick={reset}>
          <RotateCcw size={17} />
          清除全部
        </button>
        <button className="filter-button" type="button" onClick={() => setAdvancedOpen((value) => !value)}>
          <SlidersHorizontal size={17} />
          進階篩選與估價條件
        </button>
        <button className="primary-button" type="button" onClick={submit}>
          <Search size={18} />
          {submitLabel}
          <ArrowRight size={18} />
        </button>
      </div>
    </section>
  );
};
