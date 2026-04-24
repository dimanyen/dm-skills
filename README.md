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

## 安裝 skill

將 `.skill` 檔拖入 Claude Code，或使用 `skill-installer` skill 從此 repo 安裝。

## 安裝 Chrome 擴充套件

1. 打開 `chrome://extensions`
2. 啟用右上角「開發人員模式」
3. 點「載入未封裝項目」，選擇 [learning-hard/elearn-helper](learning-hard/elearn-helper) 資料夾

## 授權

個人使用，未另行授權。
