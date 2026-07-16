# 留白放映室

一個不帶推薦流與留言區的 YouTube 私人播放頁。

## 部署到 GitHub Pages

1. 建立 Public repository，將本資料夾的 `index.html`、`styles.css`、`app.js` 與 `.nojekyll` 放在儲存庫根目錄。
2. 前往儲存庫的 **Settings → Pages**。
3. 在 **Build and deployment** 選擇 **Deploy from a branch**。
4. 選擇 `main` 與 `/(root)`，儲存後等待 GitHub 提供網站網址。

此網站不需要建置工具、後端、資料庫或 API 金鑰。待看片單使用瀏覽器 `localStorage` 保存。

完整看完一支影片會獲得 25 XP；等級、經驗值與完成次數同樣保存在該瀏覽器中。

網站包含 Web App Manifest 與 Service Worker，可從支援的瀏覽器安裝成 PWA。介面可離線開啟，但 YouTube 影片播放仍需要網路。

> 影片仍由 YouTube 嵌入播放器提供。被禁止外嵌、私人或受到年齡限制的影片可能無法播放。
