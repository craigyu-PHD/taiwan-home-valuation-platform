# 永久公開部署

本專案已整理成可部署的網站。因為目前前台估價、地圖與資料都可由靜態檔提供，最推薦用 Vercel Hobby 或 Render Static Site 做免費永久公開網址。

## 推薦：Vercel Hobby 免費部署

適合目前這個專案，優點是有永久 `*.vercel.app` 網址、GitHub push 後自動部署、靜態網站不需要常駐伺服器。

1. 建立 GitHub repository，將本專案推上去。
2. 到 Vercel 新增專案，選擇該 GitHub repository。
3. Framework Preset 選 `Vite`。
4. Build Command 使用 `npm run build`。
5. Output Directory 使用 `dist`。
6. 部署完成後會得到永久網址，例如 `https://your-project.vercel.app`。

本專案已提供 `vercel.json`，讓 `/market`、`/estimate/map`、`/estimate/result` 這類前端路由可以正常重新整理。

## Render Static Site 免費部署

1. 建立 GitHub repository，將本專案推上去。
2. 在 Render 選 New Static Site。
3. Build command: `npm ci && npm run build`
4. Publish directory: `dist`
5. 部署完成後會得到 `*.onrender.com` 網址。

## Netlify 免費部署

1. 建立 GitHub repository，將本專案推上去。
2. 在 Netlify 選 Add new site。
3. Build command: `npm run build`
4. Publish directory: `dist`
5. 本專案已提供 `netlify.toml` 處理前端路由。

## Render Blueprint

專案根目錄已提供 `render.yaml`。部署步驟：

1. 將此專案推到 GitHub/GitLab。
2. 在 Render 選擇 New Blueprint。
3. 指向此 repository。
4. Render 會使用：
   - Build command: `npm ci && npm run build`
   - Start command: `npm run start`
   - Port: `8787`

## Docker

```bash
docker build -t taiwan-home-valuation-platform .
docker run -p 8787:8787 taiwan-home-valuation-platform
```

## Production Service

```bash
npm ci
npm run build
npm run start
```

正式服務會同時提供前端與 API：

- `GET /`
- `GET /estimate/map`
- `GET /market`
- `GET /health`

## 注意

永久公開網址需要部署到使用者自己的雲端主機或 hosting 帳號。匿名 tunnel 只能作臨時測試，不適合作為正式網址。
