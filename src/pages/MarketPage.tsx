import { BarChart3, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CaseMap } from "../components/CaseMap";
import { ModeSwitch } from "../components/ModeSwitch";
import { useEstimate } from "../context/EstimateContext";
import { demoTransactions } from "../data/demoTransactions";
import { taiwanAdmin, taiwanCities } from "../data/taiwanAdmin";
import { findTownByPoint, getBoundaryCenter, getTownBoundary, type BoundaryFeature } from "../services/boundaries";
import { reverseGeocodePoint } from "../services/geocode";
import { getRentalMarketStats } from "../services/rental";
import { getMarketStats } from "../services/valuation";
import { formatDate, formatRentPerPing, formatTwd, formatUnitWan } from "../utils/format";

export const MarketPage = () => {
  const { propertyInput, setSelectedLocation, transactionMode } = useEstimate();
  const [city, setCity] = useState("臺北市");
  const districts = useMemo(
    () => taiwanAdmin[city as keyof typeof taiwanAdmin] ?? [],
    [city],
  );
  const [district, setDistrict] = useState("信義區");
  const [boundary, setBoundary] = useState<BoundaryFeature | undefined>();
  const [pickedPoint, setPickedPoint] = useState<[number, number] | undefined>();
  const [locatorStatus, setLocatorStatus] = useState("選擇行政區，或拖曳小人到地圖上任一位置切換區域行情。");
  const stats = getMarketStats(city, district);
  const rentStats = getRentalMarketStats(city, district);
  const mapCases = demoTransactions.filter((item) => item.city === city && item.district === district);
  useEffect(() => {
    if (propertyInput.city) setCity(propertyInput.city);
    if (propertyInput.district) setDistrict(propertyInput.district);
  }, [propertyInput.city, propertyInput.district]);
  useEffect(() => {
    if (!districts.includes(district as never)) setDistrict(districts[0] ?? "");
  }, [district, districts]);
  useEffect(() => {
    getTownBoundary(city, district).then(setBoundary).catch(() => setBoundary(undefined));
  }, [city, district]);
  const mapCenter: [number, number] =
    pickedPoint ?? getBoundaryCenter(boundary?.geometry) ?? [mapCases[0]?.lat ?? 23.8, mapCases[0]?.lng ?? 121.0];

  const pickMarketPoint = async (lat: number, lng: number) => {
    setPickedPoint([lat, lng]);
    const town = await findTownByPoint(lat, lng).catch(() => undefined);
    const reverse = await reverseGeocodePoint(lat, lng).catch(() => undefined);
    if (!town) {
      setLocatorStatus("此位置無法命中行政區邊界，請靠近臺灣本島或離島行政區內再試一次。");
      return;
    }
    setCity(town.properties.city);
    setDistrict(town.properties.district);
    setBoundary(town);
    setSelectedLocation({
      id: `market-${lat}-${lng}`,
      label: reverse?.label ?? `${town.properties.city}${town.properties.district} 行情選點`,
      city: town.properties.city,
      district: town.properties.district,
      road: reverse?.road,
      lat,
      lng,
      confidence: reverse ? 0.86 : 0.78,
      source: "manual",
    });
    setLocatorStatus(
      reverse?.label
        ? `已依小人位置切換到 ${town.properties.city}${town.properties.district}，參考地址：${reverse.label}`
        : `已依小人位置切換到 ${town.properties.city}${town.properties.district}。`,
    );
  };

  return (
    <div className="page market-page">
      <section className="section-heading">
        <span className="eyebrow">區域行情 / {transactionMode === "sale" ? "買賣房屋" : "租屋"}</span>
        <h1>{transactionMode === "sale" ? "查詢行政區、路段或社區近期行情" : "查詢行政區租屋月租與坪租行情"}</h1>
        <p>{transactionMode === "sale" ? "區域行情只能作為輔助參考；個別物件仍需回到周邊成交、建物條件與特殊狀況判斷。" : "租屋行情會以區域成交與投報模型換算月租區間，正式版可再接入租賃實價登錄與刊登資料驗證。"}</p>
      </section>

      <section className="market-toolbar">
        <ModeSwitch compact />
        <label>
          縣市
          <select
            value={city}
            onChange={(event) => {
              const nextCity = event.target.value;
              setCity(nextCity);
              const nextDistrict =
                taiwanAdmin[nextCity as keyof typeof taiwanAdmin]?.[0] ?? "";
              setDistrict(nextDistrict);
              setPickedPoint(undefined);
            }}
          >
            {taiwanCities.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          行政區
          <select
            value={district}
            onChange={(event) => {
              setDistrict(event.target.value);
              setPickedPoint(undefined);
            }}
          >
            {districts.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <button className="secondary-button" type="button">
          <Search size={18} />
          查詢行情
        </button>
        <p className="market-locator-status">{locatorStatus}</p>
      </section>

      <section className="market-map-section">
        <CaseMap
          center={mapCenter}
          cases={mapCases}
          onPick={pickMarketPoint}
          highlightGeometry={boundary?.geometry}
          highlightLabel={boundary ? `${boundary.properties.city}${boundary.properties.district}` : undefined}
          className="market-map"
        />
      </section>

      <section className="market-table">
        <div className="table-header">
          <BarChart3 size={20} />
          <strong>{city}{district} {transactionMode === "sale" ? "買賣行情摘要" : "租屋行情摘要"}</strong>
        </div>
        {transactionMode === "sale" && stats.length === 0 ? (
          <div className="empty-state">示範資料中沒有此區域行情；正式版應提示資料不足並建議擴大範圍。</div>
        ) : transactionMode === "sale" ? (
          <table>
            <thead>
              <tr>
                <th>範圍</th>
                <th>建築類型</th>
                <th>交易狀態</th>
                <th>案例數</th>
                <th>單價中位數</th>
                <th>合理單價區間</th>
                <th>最近成交</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((item) => (
                <tr key={`${item.label}-${item.segment}-${item.transactionStatus}`}>
                  <td>{item.label}</td>
                  <td>{item.segment}</td>
                  <td>{item.transactionStatus}</td>
                  <td>{item.count}</td>
                  <td>{formatUnitWan(item.medianUnitPriceWan)}</td>
                  <td>
                    {formatUnitWan(item.lowUnitPriceWan)} - {formatUnitWan(item.highUnitPriceWan)}
                  </td>
                  <td>{formatDate(item.latestDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : rentStats.length === 0 ? (
          <div className="empty-state">示範資料中沒有此區域租屋行情；請改查鄰近行政區或補充租賃資料源。</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>範圍</th>
                <th>建築類型</th>
                <th>參考數</th>
                <th>月租中位數</th>
                <th>合理月租區間</th>
                <th>坪租中位數</th>
                <th>最近資料</th>
              </tr>
            </thead>
            <tbody>
              {rentStats.map((item) => (
                <tr key={`${item.label}-${item.segment}-rent`}>
                  <td>{item.label}</td>
                  <td>{item.segment}</td>
                  <td>{item.count}</td>
                  <td>{formatTwd(item.medianMonthlyRentTwd)}</td>
                  <td>{formatTwd(item.lowMonthlyRentTwd)} - {formatTwd(item.highMonthlyRentTwd)}</td>
                  <td>{formatRentPerPing(item.medianRentPerPingTwd)}</td>
                  <td>{formatDate(item.latestDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};
