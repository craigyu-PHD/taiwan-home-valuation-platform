# AGENTS.md instructions

## 專案定位

- 專案名稱：全台房屋即時估價平台。
- 工作資料夾：`/Users/craig/Library/CloudStorage/GoogleDrive-craigpop.tw@gmail.com/我的雲端硬碟/010-Codex GPT/07-房價鑑價系統`
- 技術棧：React + Vite + TypeScript + Leaflet，Node.js production static/API server。
- 主要用途：提供手機友善的房屋估價原型，包含地址搜尋、地圖選點、估價條件、結果頁、區域行情、方法與免責聲明。

## 常用指令

```bash
npm --cache .npm-cache install
npm --cache .npm-cache run dev -- --port 5173
npm --cache .npm-cache run api:dev
npm --cache .npm-cache run build
npm --cache .npm-cache run sync:data
```

- 前端開發網址：`http://localhost:5173/`
- 後台健康檢查：`http://localhost:8787/health`

## 重要檔案

- `src/App.tsx`：主要路由。
- `src/pages/`：頁面流程。
- `src/components/`：估價、地圖、結果與共用 UI。
- `src/services/valuation.ts`：估價邏輯。
- `src/services/geocode.ts`：地址與地理編碼。
- `scripts/sync-moi-data.mjs`：內政部實價登錄資料同步。
- `docs/system-design.md`：資料來源、估價邏輯與上線限制。
- `server/api.mjs`：production 靜態服務與健康檢查。

## 工作規則

- 不覆蓋既有 README、部署設定、資料同步腳本或 Git 歷史，除非使用者明確要求。
- 估價結果需維持資料來源、案例數、信心分數與限制說明的透明性。
- 銀行估價網站只能作外部參考；不可繞過 CAPTCHA、登入、簡訊驗證或反自動化限制。
- 地圖使用 OpenStreetMap/Leaflet 時保留 attribution；大量地理編碼需節流、快取或改用合法批次資料。
- 學生、客戶或測試資料若出現個資風險，使用代碼或假資料，不放真實姓名與敏感資訊。
- 不提交 `.env`、金鑰、憑證、本機 AI 設定、`node_modules/`、`dist/` 或同步下載的大型來源檔。

## Obsidian 第二大腦

主要 Obsidian Vault：

`/Users/craig/Library/Mobile Documents/com~apple~CloudDocs/CRAIG圖書館`

當使用者說「Obsidian」、「Secondbrain」、「我的筆記本」、「第二大腦」時，預設指這個資料夾。

若任務涉及筆記、剪藏、知識庫、創作庫、每日筆記、專案工作流程或 Codex 使用紀錄，請優先參考：

- `/Users/craig/Library/Mobile Documents/com~apple~CloudDocs/CRAIG圖書館/AGENTS.md`
- `/Users/craig/Library/Mobile Documents/com~apple~CloudDocs/CRAIG圖書館/Codex 使用記錄/`

實際讀寫仍以 Codex 工作區授權或 `mcp_servers.obsidian` MCP 設定為準。

## 開工同步

當使用者說「開工」、「開始工作」、「接續專案」或要求恢復本專案脈絡時，請啟用全域 `startup-sync` 流程，並依序執行：

1. 先讀取本 `AGENTS.md`，確認專案定位、工作邊界、常用指令與安全規則。
2. 若本檔或 Obsidian 規則指定專案駕駛艙、Codex 使用記錄或進度筆記，優先讀取對應 Obsidian 筆記，掌握上次進度、下一步與踩坑。
3. 檢查 `git status --short` 與目前 branch，回報未提交變更，但不要自動 pull、commit 或 push。
4. 回報「目前狀態 / 建議下一步 / 需要使用者確認的事項」，再等待使用者指示。

除非使用者明確要求，開工同步不得建立新 Obsidian vault、改動既有 Obsidian 資料夾結構、覆蓋既有筆記、改寫專案規則或執行具有外部副作用的部署/推送。

