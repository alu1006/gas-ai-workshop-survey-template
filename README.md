# GAS AI 研習問卷範本

這是一套可直接放入 Google Apps Script 的網頁問卷範本，資料寫入 Google 試算表。儲存庫將前端與後端程式放在根目錄，方便 Gemini、ChatGPT 或其他程式代理直接讀取與修改。

## 教師快速開始

### [點此建立 Google 試算表副本](https://docs.google.com/spreadsheets/d/1yPlyS8bggJzcFWCJLlAv3tmpxlgKa1_8zhdC-WsJwxs/copy)

開啟連結後，按下「建立副本」，即可在自己的 Google 雲端硬碟取得可編輯的完整範本。

## 檔案

- [`Code.gs`](./Code.gs)：後端、課程設定、資料驗證與寫入試算表。
- [`Index.html`](./Index.html)：問卷畫面、題目、前端驗證與送出流程。
- [`appsscript.json`](./appsscript.json)：Apps Script 專案設定。

## 交給 AI 修改

請 AI 先讀取 `Code.gs` 與 `Index.html`，再使用以下提示詞：

```text
請依照此 GitHub 儲存庫中的 Code.gs 與 Index.html 修改問卷。

問卷主題：【填入主題】
填答對象：【填入對象】
題目、題型、選項與是否必填：【逐題列出】

保留原有 Google 試算表串接、課程設定、登入信箱、聯絡信箱與填答修正功能。
同步調整網頁欄位、必填驗證、後端接收資料、試算表欄位與資料遷移。
請分別輸出完整的 Code.gs 與 Index.html，不要省略程式或只提供修改片段。
若需要調整試算表，請列出操作步驟，並保留既有回覆資料。
```

## 使用方式

1. 建立或複製一份 Google 試算表。
2. 從「擴充功能」開啟 Apps Script。
3. 將 `Code.gs` 與 `Index.html` 貼入對應檔案。
4. 儲存後部署為網頁應用程式。
5. 現場填答時，「誰可以存取」請選擇允許參與者使用的選項，並依校內帳號政策設定範圍。

## 注意事項

- 不要把 Google 密碼、API 金鑰或私人憑證提交到儲存庫。
- 修改題目時，前端欄位名稱、後端欄位名稱與試算表欄位必須一致。
- 正式使用前，請用測試帳號填答並確認資料寫入正確欄位。

## 本機測試

```powershell
node --test tests\code.test.cjs tests\index.test.cjs
```
