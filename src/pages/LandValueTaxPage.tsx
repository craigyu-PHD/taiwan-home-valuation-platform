import { Calculator, MapPin, ReceiptText, RotateCcw, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { useEstimate } from "../context/EstimateContext";
import { calculateLandValueTax, defaultLandValueTaxInput, type LandValueTaxInput } from "../services/landValueTax";
import { formatTwd } from "../utils/format";

const toNumber = (value: string) => (value === "" ? 0 : Number(value));
const answerOptions = [
  ["unknown", "不確定"],
  ["yes", "是"],
  ["no", "否"],
] as const;

export const LandValueTaxPage = () => {
  const { propertyInput, valuation } = useEstimate();
  const [mode, setMode] = useState<"simple" | "advanced">("simple");
  const [input, setInput] = useState<LandValueTaxInput>(() =>
    defaultLandValueTaxInput(valuation?.totalMedianWan, propertyInput.ageYears ? new Date().getFullYear() - propertyInput.ageYears : undefined),
  );
  const result = useMemo(() => calculateLandValueTax(input), [input]);
  const update = (updates: Partial<LandValueTaxInput>) => setInput((current) => ({ ...current, ...updates }));
  const resetInput = () =>
    setInput(
      defaultLandValueTaxInput(
        valuation?.totalMedianWan,
        propertyInput.ageYears ? new Date().getFullYear() - propertyInput.ageYears : undefined,
      ),
    );

  return (
    <div className="page land-tax-page">
      <section className="section-heading tax-heading">
        <span className="eyebrow">出售成本 / 賣方稅費</span>
        <h1>土地增值稅試算</h1>
        <p>地址由估價標的帶入並鎖定；只調整稅務欄位，右側即時更新出售成本。</p>
      </section>

      <section className="tax-top-grid">
        <article className="tax-subject-card">
          <MapPin size={20} />
          <div>
            <span>估價標的</span>
            <strong>{propertyInput.address}</strong>
            <small>{[propertyInput.city, propertyInput.district, propertyInput.road].filter(Boolean).join(" / ")} · 地址鎖定，避免稅費試算與估價標的脫鉤。</small>
          </div>
        </article>
        <article className="tax-result-card emphasis tax-top-result">
          <ReceiptText size={24} />
          <span>土地增值稅試算結果</span>
          <strong>{formatTwd(result.bestTax)}</strong>
          <small>信心：{result.confidenceLabel}（{result.confidenceScore}/100）</small>
        </article>
      </section>

      <section className="tax-mode-tabs">
        <button className={mode === "simple" ? "active" : ""} type="button" onClick={() => setMode("simple")}>簡易試算</button>
        <button className={mode === "advanced" ? "active" : ""} type="button" onClick={() => setMode("advanced")}>進階試算</button>
      </section>

      <section className="land-tax-layout">
        <div className="land-tax-form">
          <article className="tax-form-card tax-simple-card">
            <h2>快速試算欄位</h2>
            <p>必要欄位只保留現值、前次現值、取得年份、面積、持分與自用條件；不知道前次現值時會標示低信心概算。</p>
            <div className="form-grid tax-simple-grid">
              <label>本次申報移轉現值<input type="number" value={input.currentLandValue || ""} onChange={(event) => update({ currentLandValue: toNumber(event.target.value) })} /></label>
              <label>前次移轉現值 / 原規定地價<input type="number" value={input.previousLandValue || ""} onChange={(event) => update({ previousLandValue: toNumber(event.target.value) })} /></label>
              <label>取得年份<input type="number" value={input.acquisitionYear ?? ""} onChange={(event) => update({ acquisitionYear: toNumber(event.target.value) || undefined })} /></label>
              <label>土地面積（平方公尺）<input type="number" value={input.landAreaSqm || ""} onChange={(event) => update({ landAreaSqm: toNumber(event.target.value) })} /></label>
              <label>持分分子<input type="number" value={input.shareNumerator || ""} onChange={(event) => update({ shareNumerator: toNumber(event.target.value) })} /></label>
              <label>持分分母<input type="number" value={input.shareDenominator || ""} onChange={(event) => update({ shareDenominator: toNumber(event.target.value) })} /></label>
              <label>土地類型<select value={input.isUrban ? "urban" : "rural"} onChange={(event) => update({ isUrban: event.target.value === "urban" })}><option value="urban">都市土地</option><option value="rural">非都市土地</option></select></label>
              <label>是否自用住宅<select value={input.selfUse} onChange={(event) => update({ selfUse: event.target.value as LandValueTaxInput["selfUse"] })}>{answerOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label>本人或親屬已設戶籍<select value={input.householdRegistered} onChange={(event) => update({ householdRegistered: event.target.value as LandValueTaxInput["householdRegistered"] })}>{answerOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label>出售前一年出租或營業<select value={input.rentedOrBusinessLastYear} onChange={(event) => update({ rentedOrBusinessLastYear: event.target.value as LandValueTaxInput["rentedOrBusinessLastYear"] })}>{answerOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label>曾用一生一次<select value={input.usedOnce} onChange={(event) => update({ usedOnce: event.target.value as LandValueTaxInput["usedOnce"] })}>{answerOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            </div>
          </article>

          {mode === "advanced" && (
            <article className="tax-form-card">
              <h2>進階扣除與重購退稅</h2>
              <p>懂稅務資料的人再填；一般使用者可先保留預設值。</p>
              <div className="form-grid">
                <label>物價指數調整值<input type="number" step="0.01" value={input.cpiFactor || ""} onChange={(event) => update({ cpiFactor: toNumber(event.target.value) })} /></label>
                <label>土地改良費用<input type="number" value={input.improvementCost || ""} onChange={(event) => update({ improvementCost: toNumber(event.target.value) })} /></label>
                <label>工程受益費<input type="number" value={input.benefitFee || ""} onChange={(event) => update({ benefitFee: toNumber(event.target.value) })} /></label>
                <label>土地重劃費用<input type="number" value={input.landReadjustmentCost || ""} onChange={(event) => update({ landReadjustmentCost: toNumber(event.target.value) })} /></label>
                <label>抵繳金額<input type="number" value={input.extraLandTaxCredit || ""} onChange={(event) => update({ extraLandTaxCredit: toNumber(event.target.value) })} /></label>
                <label>另有房屋<select value={input.ownsOtherHouse} onChange={(event) => update({ ownsOtherHouse: event.target.value as LandValueTaxInput["ownsOtherHouse"] })}>{answerOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label>檢查重購退稅<select value={input.checkRepurchase} onChange={(event) => update({ checkRepurchase: event.target.value as LandValueTaxInput["checkRepurchase"] })}>{answerOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label>新購土地地價<input type="number" value={input.newPurchaseLandValue || ""} onChange={(event) => update({ newPurchaseLandValue: toNumber(event.target.value) })} /></label>
              </div>
            </article>
          )}
        </div>

        <aside className="land-tax-result">
          <article className="tax-result-card">
            <h2>計算明細</h2>
            <dl>
              <div><dt>一般稅率</dt><dd>{formatTwd(result.generalTax)}</dd></div>
              <div><dt>自用住宅優惠</dt><dd>{formatTwd(result.selfUseTax)}</dd></div>
              <div><dt>可能節省</dt><dd>{formatTwd(result.saving)}</dd></div>
              <div><dt>土地漲價總數額</dt><dd>{formatTwd(result.gain)}</dd></div>
              <div><dt>漲價倍數</dt><dd>{result.gainRatio.toFixed(2)} 倍</dd></div>
              <div><dt>長期持有減徵</dt><dd>{Math.round(result.longTermReductionRate * 100)}%</dd></div>
            </dl>
          </article>
          <article className="tax-result-card warning">
            <ShieldAlert size={22} />
            <h2>資格與限制</h2>
            <p>{result.selfUseEligibility}</p>
            <p>{result.repurchaseNote}</p>
            <ul>{(result.warnings.length ? result.warnings : ["目前必要欄位大致完整，但仍須以地方稅務機關核定為準。"]).map((item) => <li key={item}>{item}</li>)}</ul>
          </article>
          <div className="tax-sticky-actions">
            <button type="button" className="secondary-button" onClick={resetInput}><RotateCcw size={17} />重新填寫</button>
            <button type="button" className="primary-button"><Calculator size={17} />已即時試算</button>
          </div>
        </aside>
      </section>

      <section className="legal-card tax-legal-card">
        <h2>公式與限制</h2>
        <p>
          公式採「本次移轉現值 - 物價指數調整後前次現值 - 可扣除費用」計算土地漲價總數額；
          一般稅率以 20% / 30% / 40% 累進試算，自用住宅合格面積以 10% 試算，超額面積回到一般稅率。
        </p>
        <a className="text-link" href="https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=G0340096" target="_blank" rel="noreferrer">
          查看土地稅法
        </a>
      </section>
    </div>
  );
};
