export type RegionalContentKind = "news" | "policy";

export interface RegionalContentItem {
  id: string;
  kind: RegionalContentKind;
  title: string;
  date: string;
  source: string;
  url: string;
  scope: string;
  summary: string;
  content: string[];
  tags: string[];
  isLive?: boolean;
}

interface GdeltArticle {
  url?: string;
  title?: string;
  seendate?: string;
  domain?: string;
  sourcecountry?: string;
  language?: string;
  socialimage?: string;
}

const NEWS_KEYWORDS = ["房價", "房市", "不動產", "建案", "住宅", "房貸", "都更", "社宅"];

const normalizeDate = (value?: string) => {
  if (!value) return new Date().toISOString().slice(0, 10);
  const digits = value.replace(/\D/g, "");
  if (digits.length >= 8) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  return value.slice(0, 10);
};

const uniqueByUrl = (items: RegionalContentItem[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.url || item.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const cityAlias = (city: string) => city.replace("臺", "台");

export const buildRegionalScope = (city?: string, district?: string) => {
  const cityLabel = city || "全國";
  return district ? `${cityLabel}${district}` : cityLabel;
};

const buildNewsQuery = (city?: string, district?: string) => {
  const place = [cityAlias(city || ""), district || ""].filter(Boolean).join(" ");
  const areaQuery = place ? `(${place})` : "(台灣 OR 臺灣)";
  return `${areaQuery} (${NEWS_KEYWORDS.join(" OR ")})`;
};

export const fetchLiveRegionalNews = async (city?: string, district?: string): Promise<RegionalContentItem[]> => {
  const query = buildNewsQuery(city, district);
  const params = new URLSearchParams({
    query,
    mode: "ArtList",
    format: "json",
    timespan: "3months",
    maxrecords: "10",
    sort: "hybridrel",
  });
  const response = await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`GDELT failed: ${response.status}`);
  const data = (await response.json()) as { articles?: GdeltArticle[] };
  const scope = buildRegionalScope(city, district);
  return uniqueByUrl(
    (data.articles ?? [])
      .filter((article) => article.url && article.title)
      .map((article, index) => ({
        id: `gdelt-${index}-${article.url}`,
        kind: "news",
        title: article.title ?? "區域房產新聞",
        date: normalizeDate(article.seendate),
        source: article.domain ?? "GDELT / 原始新聞站",
        url: article.url ?? "",
        scope,
        summary:
          "此為公開新聞索引即時搜尋結果。系統只保留標題、來源與摘要，方便與目前標的的區域行情一起判讀。",
        content: [
          "本筆資料來自公開新聞索引與原始新聞站的標題資訊，系統不改寫為成交保證，也不把新聞題材直接換算成房價。",
          `判讀時建議先確認新聞是否真的指向 ${scope}，再比對實價登錄成交、區域供給、貸款條件與政策變化。若新聞涉及重大建設、都更或商圈題材，仍需查證完工時程、距離與實際受益範圍。`,
          "若原始新聞站限制嵌入，本平台不會複製受著作權保護的全文；正式上線時可在後端建立合法摘要、來源標示與使用者導向原站閱讀的機制。",
        ],
        tags: ["即時新聞", scope, "房產"],
        isLive: true,
      })),
  );
};

export const fallbackRegionalNews = (city?: string, district?: string): RegionalContentItem[] => {
  const scope = buildRegionalScope(city, district);
  const cityLabel = city || "全國";
  return [
    {
      id: "fallback-news-local-market",
      kind: "news",
      title: `${scope}近期房市觀察：成交量、屋齡與生活圈差異會拉開價格帶`,
      date: "2026-04-30",
      source: "區域房市觀察",
      url: "https://pip.moi.gov.tw/V3/E/SCRE0101.aspx",
      scope,
      summary:
        `${scope}的新聞面應回到實價登錄成交、區域供給、建案交屋與生活圈機能一起判讀。`,
      content: [
        `${scope}近期房價判讀不能只看單一新聞標題，應把實價登錄成交量、同路段案例、屋齡分布與生活圈成熟度一起放進模型。若成交案例集中在新屋或特定社區，價格帶會明顯高於老公寓或條件較弱的物件。`,
        "買方觀點會更在意可比案例是否足夠、貸款條件是否穩定、屋況與未來轉手性；賣方觀點則會用同社區、同路段、交通機能與近期成交支撐守價。這類新聞應作為輔助脈絡，而不是直接當作估價結果。",
        "建議操作：先回到地址估價結果確認同社區與同路段樣本，再到決策雷達檢查 300 公尺內交通、生活機能、文教與醫療節點，最後用新聞與政策作為議價說明的補充材料。",
      ],
      tags: [cityLabel, "房市觀察", "實價登錄"],
    },
    {
      id: "fallback-news-credit",
      kind: "news",
      title: `${cityLabel}購屋族應同步追蹤房貸條件、利率與信用管制消息`,
      date: "2026-04-30",
      source: "金融政策觀察",
      url: "https://www.cbc.gov.tw/",
      scope: cityLabel,
      summary:
        "房貸條件會影響買方出價能力與賣方成交時間。區域估價若只看單坪價格，容易忽略貸款成數、還款壓力與政策控管造成的議價力變化。",
      content: [
        "房貸利率、貸款成數、寬限期與信用管制會直接改變買方可承擔的總價。即使同一個社區的成交單價看起來穩定，當買方月付能力下降，實際成交通常會往保守區間靠攏。",
        `對 ${cityLabel} 的標的而言，若區域供給量增加或貸款條件轉緊，買方可把現金流壓力、銀行鑑價與核貸不確定性列為議價理由；賣方若要守價，則應提供近期成交、屋況文件與可貸性證據。`,
        "本平台會把這類政策訊號放進決策雷達的買家/賣家評估，但不會用單一政策消息直接調高或調低估價。",
      ],
      tags: [cityLabel, "房貸條件", "信用管制"],
    },
    {
      id: "fallback-news-redevelopment",
      kind: "news",
      title: `${scope}都更、重劃與重大建設題材需用時程與距離驗證`,
      date: "2026-04-30",
      source: "都市發展觀察",
      url: "https://www.nlma.gov.tw/",
      scope,
      summary:
        "重大建設與都更題材可以支撐價格敘事，但不應直接等同溢價。系統會要求搭配完工期程、步行距離、生活圈成熟度與周邊成交案例共同判讀。",
      content: [
        "都更、重劃區、捷運與重大建設常被拿來支撐開價，但合理溢價必須同時滿足三個條件：距離夠近、時程明確、生活圈已經能被使用者感受到。只有題材而沒有可用性，通常只能作為賣方敘事，不能直接等於成交價。",
        `${scope}若有建設題材，買方應要求賣方說明實際距離、完工時間、交通改善程度與周邊供給量；賣方則應把題材連結到可驗證的成交案例，而不是只用未來想像提高開價。`,
        "決策雷達會將重大建設列為中性偏利多因素，並要求與成交樣本、土地用途、屋況與 300 公尺機能交叉檢核。",
      ],
      tags: [cityLabel, "都更重劃", "重大建設"],
    },
  ];
};

export const getPolicyItems = (city?: string, district?: string): RegionalContentItem[] => {
  const scope = buildRegionalScope(city, district);
  const cityLabel = city || "全國";
  const national: RegionalContentItem[] = [
    {
      id: "policy-moi-real-price",
      kind: "policy",
      title: "內政部實價登錄公開資料：估價與行情判讀的主要基礎",
      date: "持續更新",
      source: "內政部不動產交易實價查詢服務網",
      url: "https://lvr.land.moi.gov.tw/",
      scope: "全國",
      summary:
        "實價登錄提供買賣、租賃與預售交易資料，是本平台估價、區域行情與案例比較的核心資料來源；使用時仍需排除特殊交易與條件差異。",
      content: [
        "內政部實價登錄是本平台房屋估價、租屋行情、區域行情與成交案例比較的主要資料基礎。資料可用來觀察實際成交總價、單價、建物型態、屋齡、交易時間與區域行情。",
        "使用限制在於：特殊交易、親友交易、車位拆分、預售換約、極端坪數或屋況差異，都可能造成單筆價格不適合直接拿來估價。因此本平台採用多筆可比案例加權，並輸出價格區間與信心分數。",
        "正式上線時應定期匯入公開資料、保留資料版本、更新日期與來源欄位，避免把過期行情誤當即時市場價。",
      ],
      tags: ["全國", "實價登錄", "公開資料"],
    },
    {
      id: "policy-land-tax-law",
      kind: "policy",
      title: "土地稅法：土地增值稅、自用住宅優惠與重購退稅依據",
      date: "法規持續更新",
      source: "全國法規資料庫",
      url: "https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=G0340096",
      scope: "全國",
      summary:
        "土地增值稅、一般累進稅率、自用住宅優惠稅率與長期持有減徵等計算原則，應以土地稅法與地方稅務機關核定為準。",
      content: [
        "土地稅法是土地增值稅試算的核心依據。本平台的稅費試算會先計算土地漲價總數額，再依一般稅率、自用住宅優惠、長期持有減徵與重購退稅條件進行概算。",
        "因為前次移轉現值、土地面積、持分、物價指數、戶籍與出租營業狀態都會影響稅額，系統不能只用房屋估價結果直接推定土地增值稅。",
        "試算結果只作為出售成本參考，實際應納稅額仍以地方稅稽徵機關核定為準。",
      ],
      tags: ["全國", "土地增值稅", "稅務"],
    },
    {
      id: "policy-housing-service",
      kind: "policy",
      title: "住宅政策與租金補貼、社會住宅、包租代管資訊",
      date: "持續更新",
      source: "內政部國土管理署",
      url: "https://www.nlma.gov.tw/",
      scope: "全國",
      summary:
        "住宅政策會影響租屋需求、首購負擔、社宅供給與區域租售結構；估價時可作為大環境與需求面的輔助判讀。",
      content: [
        "住宅政策包含社會住宅、租金補貼、包租代管、居住支持與都市更新相關措施。這些政策會改變租屋需求、首購壓力、區域供給與房東持有策略。",
        "在租屋模式下，政策面會影響租客負擔能力與區域租金支撐；在買賣模式下，政策面則會影響貸款能力、持有成本與未來轉手性。",
        "本平台把政策資料作為決策雷達的外部訊號，不會把單一政策直接換算成價格，而是與成交資料、生活機能與屋況一起判斷。",
      ],
      tags: ["全國", "住宅政策", "租金補貼"],
    },
  ];

  const taoyuan: RegionalContentItem[] = [
    {
      id: "policy-taoyuan-housing",
      kind: "policy",
      title: "桃園市住宅服務資訊網：社會住宅、包租代管與租金補貼資訊",
      date: "持續更新",
      source: "桃園市政府住宅發展處",
      url: "https://housing.tycg.gov.tw/portal/",
      scope: "桃園市",
      summary:
        "桃園市住宅服務資訊網彙整社會住宅申租、包租代管與租金補貼服務。若標的位於桃園，租屋行情與自住需求判讀應同步參考。",
      content: [
        "桃園市住宅服務資訊網彙整社會住宅、包租代管與租金補貼相關資訊。對桃園市標的而言，這些政策會影響租屋需求、租金可負擔性與區域居住供給。",
        "若目前標的是自住買方，社宅與租金補貼可作為區域居住需求的觀察訊號；若是出租或投資標的，則要觀察政策供給是否會改變同區租屋競爭。",
        "判讀方式：不要把政策直接換算成加價或降價，而是與租屋行情、生活機能、交通可達性與社區條件一起比較。",
      ],
      tags: ["桃園市", "社會住宅", "租金補貼"],
    },
    {
      id: "policy-taoyuan-urban-renewal",
      kind: "policy",
      title: "桃園市市有不動產參加都市更新處理原則",
      date: "官方資料",
      source: "桃園市政府 / 都市更新法規資料",
      url: "https://uract.nlma.gov.tw/rule/detail/481",
      scope: "桃園市",
      summary:
        "此原則涉及市有不動產參與都市更新的處理方式。對桃園市內具都更、整合或公共土地議題的標的，屬於政策面觀察項目。",
      content: [
        "桃園市市有不動產參與都市更新的處理原則，主要用於觀察公共土地、都更整合與公私協力開發議題。若標的周邊有公有土地、老舊聚落或都更計畫，這類政策可能改變長期供給與生活圈樣貌。",
        "買方應確認政策是否已進入具體計畫、公告程序或施工階段；賣方若要主張都更溢價，也需要提出明確文件與時間表。",
        "未落地的都更題材只能視為敘事，不應直接取代實際成交比較。",
      ],
      tags: ["桃園市", "都市更新", "公共土地"],
    },
    {
      id: "policy-taoyuan-public-property",
      kind: "policy",
      title: "桃園市住宅及都市更新中心公有不動產管理使用收益辦法",
      date: "官方資料",
      source: "桃園市政府 / 都市更新法規資料",
      url: "https://uract.nlma.gov.tw/rule/detail/1351",
      scope: "桃園市",
      summary:
        "與桃園市住宅及都市更新中心公有不動產管理使用收益相關。若標的周邊有公有土地、社宅或都更中心資產，應納入政策面判讀。",
      content: [
        "公有不動產管理與使用收益政策，會影響公共資產如何出租、使用、更新或參與區域發展。若標的周邊有公有土地、社宅或都市更新中心資產，應納入長期生活圈與供給面的觀察。",
        "對買方而言，這類政策可能帶來公共設施、社宅供給或區域更新，也可能增加施工或交通變動不確定性；對賣方而言，若政策已具體落地，可作為區域發展敘事的一部分。",
        "仍需以地方政府公告、實際位置與可比成交驗證，不宜只因政策名稱就提高估價。",
      ],
      tags: ["桃園市", "公有不動產", "都市更新"],
    },
  ];

  return cityLabel.includes("桃園") || scope.includes("桃園") ? [...taoyuan, ...national] : national;
};

export const getFallbackRegionalContent = (city?: string, district?: string) => ({
  news: fallbackRegionalNews(city, district),
  policies: getPolicyItems(city, district),
});
