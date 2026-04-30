export interface BankWebsiteSource {
  id: string;
  name: string;
  url: string;
  description: string;
}

export const bankWebsiteSources: BankWebsiteSource[] = [
  {
    id: "ctbc",
    name: "中國信託",
    url: "https://www.ctbcbank.com/content/dam/minisite/long/loan/ctbc-mortgage/",
    description: "房價地圖、實價登錄、社區行情與智慧估價入口。",
  },
  {
    id: "esun",
    name: "玉山銀行",
    url: "https://www.esunbank.com/zh-tw/personal/loan/tools/info/e-houseprice",
    description: "智能房屋價值試算與周邊生活機能查詢入口。",
  },
  {
    id: "fubon",
    name: "台北富邦",
    url: "https://www.fubon.com/banking/personal/mortgage/evaluate/evaluate.htm",
    description: "房價行情查詢與房貸試算入口。",
  },
  {
    id: "mega",
    name: "兆豐銀行",
    url: "https://estimation.megabank.com.tw/",
    description: "房貸 e 把兆，房價及可貸金額試算入口。",
  },
  {
    id: "sinopac",
    name: "永豐銀行",
    url: "https://apply.sinopac.com/HouseLoanEvaluation/Calculation",
    description: "秒估房貸與房貸試算入口。",
  },
  {
    id: "entie",
    name: "安泰銀行",
    url: "https://www.entiebank.com.tw/EntieCustFinance/appraiseCollateral/view",
    description: "不動產估價查詢入口。",
  },
];
