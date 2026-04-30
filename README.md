# 全台房屋即時估價平台

可發布的 React + Node 原型。前端提供手機友善的分段地址搜尋、地圖選點、估價條件、結果頁、區域行情、方法與免責聲明；後台提供內政部資料同步腳本與 production 靜態服務。

## 本機測試

```bash
npm --cache .npm-cache install
npm --cache .npm-cache run sync:data
npm --cache .npm-cache run dev -- --port 5173
npm --cache .npm-cache run api:dev
```

前端開發網址：`http://localhost:5173/`
後台健康檢查：`http://localhost:8787/health`

## 發布模式

```bash
npm run build
npm run start
```

發布服務網址：`http://localhost:8787/`

`server/api.mjs` 會同時提供：

- 靜態前端：`dist/`
- 健康檢查：`GET /health`
銀行估價資料源以公開網站清單呈現在結果頁，僅供外部參考。

永久部署方式見 `DEPLOYMENT.md`。
