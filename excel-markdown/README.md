# 表格轉 Markdown（Chrome 套件）

把從 **Excel** 或 **Google Sheets** 複製的表格，一鍵轉成 Markdown 表格。支援預覽、下載 `.md`、複製內容。

## 功能

- 📋 **貼上即轉換**：複製表格後在套件視窗按 `⌘/Ctrl + V`，自動轉成 Markdown。
- 🧠 **結構精準**：優先解析剪貼簿的 HTML 表格（保留欄列、合併欄以空白補齊），找不到才退回 TSV / CSV 解析。
- 👁 **預覽頁**：開新分頁渲染成漂亮表格，可切換「渲染結果 / 原始碼」。
- 💾 **下載 / 複製**：一鍵下載 `table.md` 或複製 Markdown。
- ⚙️ **第一列為標題**：可切換是否把第一列當成表頭。

## 安裝（開發者模式載入）

1. 開啟 Chrome，進入 `chrome://extensions`。
2. 右上角開啟「**開發人員模式 / Developer mode**」。
3. 點「**載入未封裝項目 / Load unpacked**」。
4. 選擇本資料夾 `chrome-ext-excel-markdown`。
5. 工具列會出現套件圖示，點它即可開始使用。

## 使用方式

1. 在 Excel 或 Google Sheets 選取並複製（`⌘/Ctrl + C`）整個表格。
2. 點工具列的套件圖示打開視窗。
3. 在視窗任意處按 `⌘/Ctrl + V` 貼上。
4. 右側即顯示 Markdown，可：
   - **複製 Markdown**
   - **下載 .md**
   - **開啟預覽**（新分頁）

## 檔案結構

| 檔案 | 說明 |
| --- | --- |
| `manifest.json` | 套件設定（Manifest V3） |
| `popup.html/css/js` | 主視窗：貼上、轉換、操作按鈕 |
| `preview.html/css/js` | 預覽分頁：渲染 / 原始碼切換 |
| `converter.js` | 表格 → Markdown 核心邏輯（HTML / TSV / CSV） |
| `markdown.js` | 極簡 Markdown 渲染器（供預覽頁） |
| `icons/` | 套件圖示 |

## 權限說明

- `storage`：把要預覽的 Markdown 暫存，傳給預覽分頁。
- `clipboardWrite`：複製 Markdown 到剪貼簿。

（讀取剪貼簿是透過貼上事件取得，不需要額外權限。）
