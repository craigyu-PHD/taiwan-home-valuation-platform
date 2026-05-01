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
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEstimate } from "../context/EstimateContext";
import { taiwanAdmin, taiwanCities } from "../data/taiwanAdmin";
import { getBoundaryCenter, getTownBoundary } from "../services/boundaries";
import { searchAddress } from "../services/geocode";
import { createDefaultInput, propertyTypes, specialFactors } from "../services/valuation";
import type { LocationCandidate, ParkingType, PropertyInput, SpecialFactor, ValuationResult } from "../types";
import { normalizeAddressText } from "../utils/addressNormalize";

interface PropertyEstimateFormProps {
  compact?: boolean;
  submitLabel?: string;
  stayOnPage?: boolean;
  onEstimated?: (result: ValuationResult) => void;
}

const updateNumber = (value: string) => (value === "" ? undefined : Number(value));
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
  const { propertyInput, setSelectedLocation, updatePropertyInput, runValuation } = useEstimate();
  const initialRoad = splitRoadAndSection(propertyInput.road);
  const [city, setCity] = useState(propertyInput.city ?? "臺北市");
  const districts = useMemo(() => taiwanAdmin[city as keyof typeof taiwanAdmin] ?? [], [city]);
  const [district, setDistrict] = useState(propertyInput.district ?? districts[0] ?? "");
  const [road, setRoad] = useState(initialRoad.roadName || "莊敬路");
  const [section, setSection] = useState(initialRoad.sectionText);
  const [lane, setLane] = useState("");
  const [alley, setAlley] = useState("");
  const [number, setNumber] = useState(extractHouseNumber(propertyInput.address));
  const [floorText, setFloorText] = useState(String(propertyInput.floor ?? 10));
  const [mode, setMode] = useState<"實價登錄" | "開價搜尋" | "智慧估價">("智慧估價");
  const [searchMode, setSearchMode] = useState<"地址搜尋" | "區域搜尋">("地址搜尋");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    if (!districts.includes(district as never)) {
      setDistrict(districts[0] ?? "");
    }
  }, [district, districts]);

  useEffect(() => {
    if (propertyInput.city) setCity(propertyInput.city);
    if (propertyInput.district) setDistrict(propertyInput.district);
    if (propertyInput.road) {
      const nextRoad = splitRoadAndSection(propertyInput.road);
      setRoad(nextRoad.roadName);
      setSection(nextRoad.sectionText);
    }
    if (propertyInput.communityName) setKeyword(propertyInput.communityName);
    const nextNumber = extractHouseNumber(propertyInput.address);
    if (nextNumber) setNumber(nextNumber);
    if (propertyInput.floor !== undefined) setFloorText(String(propertyInput.floor));
  }, [
    propertyInput.city,
    propertyInput.district,
    propertyInput.road,
    propertyInput.communityName,
    propertyInput.floor,
  ]);

  const buildAddress = () => {
    if (searchMode === "區域搜尋") {
      return [city, district, keyword].filter(Boolean).join("");
    }
    const parts = [
      city,
      district,
      keyword,
      road ? `${road}${section ? `${section}段` : ""}` : "",
      lane ? `${lane}巷` : "",
      alley ? `${alley}弄` : "",
      number ? `${number}號` : "",
    ];
    return parts.filter(Boolean).join("");
  };

  const syncAddress = async () => {
    const address = buildAddress();
    const geocoded = searchMode === "地址搜尋" ? await searchAddress(address) : [];
    const bestMatch = geocoded[0];
    const boundary = await getTownBoundary(city, district);
    const center = getBoundaryCenter(boundary?.geometry);
    const candidate: LocationCandidate = {
      id: `structured-${normalizeAddressText(address)}`,
      label: address,
      city: bestMatch?.city ?? city,
      district: bestMatch?.district ?? district,
      road: bestMatch?.road ?? (searchMode === "地址搜尋" && road ? `${road}${section ? `${section}段` : ""}` : undefined),
      lat: bestMatch?.lat ?? center?.[0] ?? propertyInput.lat ?? 25.033964,
      lng: bestMatch?.lng ?? center?.[1] ?? propertyInput.lng ?? 121.564468,
      confidence: bestMatch?.confidence ?? (center ? (searchMode === "地址搜尋" ? 0.78 : 0.72) : 0.58),
      source: bestMatch?.source ?? "manual",
    };
    setSelectedLocation(candidate);
    updatePropertyInput({
      floor: updateNumber(floorText),
      city,
      district,
      road: candidate.road,
      communityName: keyword || undefined,
      address,
      lat: candidate.lat,
      lng: candidate.lng,
      locationConfidence: candidate.confidence,
    });
    return candidate;
  };

  const submit = async () => {
    const candidate = await syncAddress();
    const result = runValuation({
      address: candidate.label,
      city: candidate.city,
      district: candidate.district,
      road: candidate.road,
      lat: candidate.lat,
      lng: candidate.lng,
      locationConfidence: candidate.confidence,
      floor: updateNumber(floorText),
    });
    onEstimated?.(result);
    if (!stayOnPage) navigate("/estimate/result");
  };

  const reset = () => {
    const defaults = createDefaultInput();
    const defaultRoad = splitRoadAndSection(defaults.road);
    setCity(defaults.city ?? "桃園市");
    setDistrict(defaults.district ?? "桃園區");
    setRoad(defaultRoad.roadName);
    setSection(defaultRoad.sectionText);
    setLane("");
    setAlley("");
    setNumber(extractHouseNumber(defaults.address));
    setFloorText(String(defaults.floor ?? ""));
    setKeyword(defaults.communityName ?? "");
    setSelectedLocation({
      id: "default-reset",
      label: defaults.address,
      city: defaults.city,
      district: defaults.district,
      road: defaults.road,
      lat: defaults.lat ?? 25.02247,
      lng: defaults.lng ?? 121.29303,
      confidence: defaults.locationConfidence ?? 0.9,
      source: "local",
    });
    updatePropertyInput(defaults);
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
            onClick={() => setMode(item)}
          >
            {item}
          </button>
        ))}
      </div>
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
          className={searchMode === "區域搜尋" ? "active" : ""}
          onClick={() => setSearchMode("區域搜尋")}
        >
          <MapPin size={17} />
          區域搜尋
        </button>
      </div>

      <div className="structured-section-title">
        <MapPin size={18} />
        <strong>{searchMode === "地址搜尋" ? "地址搜尋" : "行政區行情搜尋"}</strong>
      </div>
      {searchMode === "地址搜尋" ? (
        <div className="structured-grid address-parts">
          <label>
            縣市 *
            <select value={city} onChange={(event) => setCity(event.target.value)}>
              {taiwanCities.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            區域 *
            <select value={district} onChange={(event) => setDistrict(event.target.value)}>
              {districts.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="wide-field">
            社區 / 地標（可選）
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="例：台北101、青埔特區、某某社區"
            />
          </label>
          <label>
            路名
            <input value={road} onChange={(event) => setRoad(event.target.value)} placeholder="例：信義路" />
          </label>
          <label>
            段
            <input value={section} onChange={(event) => setSection(event.target.value)} placeholder="例：五 / 5" />
          </label>
          <label>
            巷
            <input value={lane} onChange={(event) => setLane(event.target.value)} placeholder="可空白" />
          </label>
          <label>
            弄
            <input value={alley} onChange={(event) => setAlley(event.target.value)} placeholder="可空白" />
          </label>
          <label>
            號
            <input value={number} onChange={(event) => setNumber(event.target.value)} placeholder="例：7" />
          </label>
        </div>
      ) : (
        <div className="structured-grid address-parts">
          <label>
            縣市 *
            <select value={city} onChange={(event) => setCity(event.target.value)}>
              {taiwanCities.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            區域 *
            <select value={district} onChange={(event) => setDistrict(event.target.value)}>
              {districts.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="wide-field">
            路段 / 社區 / 生活圈（可選）
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="例：藝文特區、中正路、某某社區"
            />
          </label>
          <label>
            成交範圍
            <select>
              <option>指定行政區</option>
              <option>行政區 + 相鄰生活圈</option>
              <option>僅同路段</option>
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
            <input
              type="number"
              inputMode="numeric"
              value={floorText}
              onChange={(event) => setFloorText(event.target.value)}
              placeholder="例：10"
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
