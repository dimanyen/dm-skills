# dm-skills

個人使用的 Claude Code skills 與瀏覽器擴充工具集合。

## 內容

### [content-site-generator/](content-site-generator)

將內容整理成結構化文件專案的 Claude skill，同時產出 Markdown 檔案與可在瀏覽器直接開啟的靜態網站（具備側邊欄導覽、全螢幕簡報模式）。

- 打包檔：[content-site-generator.skill](content-site-generator/content-site-generator.skill)
- 說明文件：[content-site-generator/README.md](content-site-generator/README.md)

### [build-slide.skill](build-slide.skill)

投影片頁面建置 skill 打包檔，提供 token 系統、元件函式庫與安全規則，用於在 `teach.html` / `working*.html` 等檔案中新增風格一致的投影片。

### [learning-hard/elearn-helper/](learning-hard/elearn-helper)

Chrome 擴充套件（Manifest V3），針對企業 eLearning 平台設計：

- 攔截彈出視窗改為一般新分頁，使其可被 Claude in Chrome 控制
- 自動連續播放課程影片
- 繞過 Chrome autoplay policy，以靜音啟動後恢復音量

下載安裝包：[elearn-helper.zip](https://github.com/dimanyen/dm-skills/raw/master/dist/elearn-helper.zip)

### [cb-overlay/](cb-overlay)

Chrome 擴充套件（Manifest V3），會議室查詢 Overlay 工具：

- 點擊工具列圖示後，直接在目前分頁覆蓋全屏介面，無需另開新分頁；再點一次即隱藏
- 支援日期快捷、上午／下午／全天時段、大樓選擇，搜尋條件自動記憶
- 篩選功能（起始時間、時間長度、容納人數、樓層多選）即時套用，不重新查詢
- 提供牌卡（Card）與時間表（Table）雙檢視模式
- 最愛會議室、會議室詳情（設備 + 圖片輪播）、點擊空檔直達預訂頁面
- 月曆整合國定假日標示，支援內建假日或匯入 CSV

下載安裝包：[cb-overlay.zip](https://github.com/dimanyen/dm-skills/raw/master/dist/cb-overlay.zip)

詳細說明見 [cb-overlay/README.md](cb-overlay/README.md)。

### [chrome-ex-svgloader/](chrome-ex-svgloader)

Chrome 擴充套件（Manifest V3），SVG 下載器：

- 點擊工具列圖示啟用選擇模式，懸停網頁上的 SVG 元素會以藍色框線高亮
- 點擊即可將 SVG 透過 Canvas API 以 2 倍縮放轉成 PNG 下載（CORS 受限時回退為原始 SVG）
- 支援內聯 `<svg>`、`<img src="*.svg">`、`<object>`、`<embed>` 等格式
- 按 `Esc` 退出選擇模式，並依元素 ID 自動命名檔案

下載安裝包：[svg-downloader.zip](https://github.com/dimanyen/dm-skills/raw/master/dist/svg-downloader.zip)

詳細說明見 [chrome-ex-svgloader/README.md](chrome-ex-svgloader/README.md)。

## 安裝 skill

將 `.skill` 檔拖入 Claude Code，或使用 `skill-installer` skill 從此 repo 安裝。

## 安裝 Chrome 擴充套件

預先打包好的安裝包放在 [`dist/`](dist)，可直接下載安裝（不需 clone 整個 repo）：

| 擴充套件 | 下載連結 |
| --- | --- |
| eLearning 輔助工具 | [elearn-helper.zip](https://github.com/dimanyen/dm-skills/raw/master/dist/elearn-helper.zip) |
| 會議室查詢 Overlay | [cb-overlay.zip](https://github.com/dimanyen/dm-skills/raw/master/dist/cb-overlay.zip) |
| SVG 下載器 | [svg-downloader.zip](https://github.com/dimanyen/dm-skills/raw/master/dist/svg-downloader.zip) |

安裝步驟：

1. 點上方連結下載對應的 `.zip`，解壓縮後會得到一個含 `manifest.json` 的資料夾。
2. 打開 `chrome://extensions`。
3. 啟用右上角「開發人員模式」。
4. 點「載入未封裝項目」，選擇剛剛解壓出的資料夾即可。

> 若要從原始碼安裝，可直接以「載入未封裝項目」選取 repo 內對應資料夾（[learning-hard/elearn-helper](learning-hard/elearn-helper)、[cb-overlay](cb-overlay)、[chrome-ex-svgloader](chrome-ex-svgloader)）。

## 重新打包擴充套件

修改擴充套件原始碼後，執行下列指令即可重新產生 `dist/` 內的 zip：

```bash
bash scripts/build-extensions.sh
```

## 授權

個人使用，未另行授權。
