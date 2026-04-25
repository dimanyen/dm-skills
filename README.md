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

### [cb-overlay/](cb-overlay)

Chrome 擴充套件（Manifest V3），會議室查詢 Overlay 工具：

- 點擊工具列圖示後，直接在目前分頁覆蓋全屏介面，無需另開新分頁；再點一次即隱藏
- 支援日期快捷、上午／下午／全天時段、大樓選擇，搜尋條件自動記憶
- 篩選功能（起始時間、時間長度、容納人數、樓層多選）即時套用，不重新查詢
- 提供牌卡（Card）與時間表（Table）雙檢視模式
- 最愛會議室、會議室詳情（設備 + 圖片輪播）、點擊空檔直達預訂頁面
- 月曆整合國定假日標示，支援內建假日或匯入 CSV

詳細說明見 [cb-overlay/README.md](cb-overlay/README.md)。

## 安裝 skill

將 `.skill` 檔拖入 Claude Code，或使用 `skill-installer` skill 從此 repo 安裝。

## 安裝 Chrome 擴充套件

1. 打開 `chrome://extensions`
2. 啟用右上角「開發人員模式」
3. 點「載入未封裝項目」，依需求選擇對應資料夾：
   - eLearning 輔助工具：選擇 [learning-hard/elearn-helper](learning-hard/elearn-helper)
   - 會議室查詢 Overlay：選擇 [cb-overlay](cb-overlay)

## 授權

個人使用，未另行授權。
