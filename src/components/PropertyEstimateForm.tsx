import {
  ArrowRight,
  Building2,
  Car,
  Home,
  Layers,
  MapPin,
  RotateCcw,
  Ruler,
  Search,
  SlidersHorizontal,
  TrainFront,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEstimate } from "../context/EstimateContext";
import { taiwanAdmin, taiwanCities } from "../data/taiwanAdmin";
import { getBoundaryCenter, getTownBoundary } from "../services/boundaries";
import { propertyTypes } from "../services/valuation";
import type { LocationCandidate, ParkingType, PropertyInput } from "../types";
import { normalizeAddressText } from "../utils/addressNormalize";

interface PropertyEstimateFormProps {
  compact?: boolean;
  submitLabel?: string;
  stayOnPage?: boolean;
}

const updateNumber = (value: string) => (value === "" ? undefined : Number(value));

export const PropertyEstimateForm = ({
  compact = false,
  submitLabel = "產生估價",
  stayOnPage = false,
}: PropertyEstimateFormProps) => {
  const navigate = useNavigate();
  const { propertyInput, setSelectedLocation, updatePropertyInput, runValuation } = useEstimate();
  const [city, setCity] = useState(propertyInput.city ?? "臺北市");
  const districts = useMemo(() => taiwanAdmin[city as keyof typeof taiwanAdmin] ?? [], [city]);
  const [district, setDistrict] = useState(propertyInput.district ?? districts[0] ?? "");
  const [road, setRoad] = useState(propertyInput.road ?? "信義路");
  const [section, setSection] = useState("五");
  const [lane, setLane] = useState("");
  const [alley, setAlley] = useState("");
  const [number, setNumber] = useState("7");
  const [floorText, setFloorText] = useState(String(propertyInput.floor ?? 10));
  const [mode, setMode] = useState<"實價登錄" | "開價搜尋" | "智慧估價">("智慧估價");
  const [searchMode, setSearchMode] = useState<"區域搜尋" | "捷運搜尋">("區域搜尋");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [mrtLine, setMrtLine] = useState("淡水信義線");
  const [mrtStation, setMrtStation] = useState("台北101/世貿");

  useEffect(() => {
    if (!districts.includes(district as never)) {
      setDistrict(districts[0] ?? "");
    }
  }, [district, districts]);

  const buildAddress = () => {
    const parts = [
      city,
      district,
      road ? `${road}${section ? `${section}段` : ""}` : "",
      lane ? `${lane}巷` : "",
      alley ? `${alley}弄` : "",
      number ? `${number}號` : "",
      floorText ? `${floorText}樓` : "",
    ];
    return parts.join("");
  };

  const syncAddress = async () => {
    const address = buildAddress();
    const boundary = await getTownBoundary(city, district);
    const center = getBoundaryCenter(boundary?.geometry);
    const candidate: LocationCandidate = {
      id: `structured-${normalizeAddressText(address)}`,
      label: address,
      city,
      district,
      road: road ? `${road}${section ? `${section}段` : ""}` : road,
      lat: center?.[0] ?? propertyInput.lat ?? 25.033964,
      lng: center?.[1] ?? propertyInput.lng ?? 121.564468,
      confidence: center ? 0.74 : 0.58,
      source: "manual",
    };
    setSelectedLocation(candidate);
    updatePropertyInput({
      floor: updateNumber(floorText),
      city,
      district,
      road: candidate.road,
      address,
      lat: candidate.lat,
      lng: candidate.lng,
      locationConfidence: candidate.confidence,
    });
    return candidate;
  };

  const submit = async () => {
    const candidate = await syncAddress();
    runValuation({
      address: candidate.label,
      city: candidate.city,
      district: candidate.district,
      road: candidate.road,
      lat: candidate.lat,
      lng: candidate.lng,
      locationConfidence: candidate.confidence,
      floor: updateNumber(floorText),
    });
    if (!stayOnPage) navigate("/estimate/result");
  };

  const reset = () => {
    setCity("臺北市");
    setDistrict("信義區");
    setRoad("信義路");
    setSection("五");
    setLane("");
    setAlley("");
    setNumber("7");
    setFloorText("10");
    setKeyword("");
    setMrtLine("淡水信義線");
    setMrtStation("台北101/世貿");
    updatePropertyInput({
      propertyType: "住宅大樓",
      areaPing: 32,
      floor: 10,
      totalFloors: 18,
      ageYears: 12,
      hasParking: true,
      parkingType: "坡道平面",
      condition: "一般",
      occupancy: "自住",
      specialFactors: [],
    });
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
          className={searchMode === "區域搜尋" ? "active" : ""}
          onClick={() => setSearchMode("區域搜尋")}
        >
          <Search size={17} />
          區域搜尋
        </button>
        <button
          type="button"
          className={searchMode === "捷運搜尋" ? "active" : ""}
          onClick={() => setSearchMode("捷運搜尋")}
        >
          <TrainFront size={17} />
          捷運搜尋
        </button>
      </div>

      <div className="structured-section-title">
        <MapPin size={18} />
        <strong>{searchMode === "區域搜尋" ? "區域與地址" : "捷運站周邊"}</strong>
      </div>
      {searchMode === "區域搜尋" ? (
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
            以地址/社區搜尋
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="請輸入地址或社區名稱"
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
          <label>
            樓層
            <input value={floorText} onChange={(event) => setFloorText(event.target.value)} placeholder="例：10" />
          </label>
        </div>
      ) : (
        <div className="structured-grid address-parts">
          <label>
            捷運路線
            <select value={mrtLine} onChange={(event) => setMrtLine(event.target.value)}>
              {["淡水信義線", "板南線", "松山新店線", "中和新蘆線", "文湖線", "高雄紅線", "高雄橘線"].map(
                (line) => (
                  <option key={line}>{line}</option>
                ),
              )}
            </select>
          </label>
          <label>
            捷運站
            <input value={mrtStation} onChange={(event) => setMrtStation(event.target.value)} />
          </label>
          <label>
            步行距離
            <select>
              <option>500 公尺內</option>
              <option>800 公尺內</option>
              <option>1 公里內</option>
            </select>
          </label>
          <label>
            樓層
            <input value={floorText} onChange={(event) => setFloorText(event.target.value)} placeholder="例：10" />
          </label>
        </div>
      )}

      <div className="structured-section-title">
        <Building2 size={18} />
        <strong>估價條件</strong>
      </div>
      <div className="structured-grid">
        <label>
          房屋類型
          <select
            value={propertyInput.propertyType}
            onChange={(event) => updatePropertyInput({ propertyType: event.target.value as PropertyInput["propertyType"] })}
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
      </div>
      {advancedOpen && (
        <div className="advanced-filter-panel">
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
          進階篩選
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
