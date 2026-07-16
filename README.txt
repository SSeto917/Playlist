留白放映室｜GitHub Pages 版本

這是純 HTML、CSS、JavaScript 網頁，不需要安裝 Python、Node.js、資料庫或伺服器軟體。

上傳 GitHub：
1. 建立一個 Public repository。
2. 把 index.html、styles.css、app.js 與 .nojekyll 上傳到儲存庫最外層。
3. 到 Settings → Pages。
4. Source 選 Deploy from a branch。
5. Branch 選 main，資料夾選 /(root)，按 Save。
6. 等候 GitHub 顯示公開網址後，即可直接使用。

資料說明：
- 片單儲存在訪客自己的瀏覽器 localStorage，不需要資料庫。
- 完整看完一支影片可獲得 25 XP；等級與經驗進度也會保存在瀏覽器中。
- 不同瀏覽器或不同裝置的片單不會自動同步。
- 播放器仍由 YouTube 提供，因此需要網路，也可能顯示廣告或登入限制。
- 私人影片、年齡限制影片，或上傳者禁止外嵌的影片可能無法播放。
