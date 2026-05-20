# SVG Downloader Chrome Extension

[中文](#中文) | [English](#english)

---

## English

### Overview

**SVG Downloader** is a Chrome extension that lets you easily download SVG elements from any webpage as PNG images with a single click.

### Features

- 🎯 **Click to Select Mode**: Activate selection mode and hover over SVG elements
- 🎨 **Visual Highlighting**: SVG elements are highlighted with a blue outline when hovered
- 📥 **One-Click Download**: Click any SVG to convert it to PNG and download
- 🖼️ **High Quality**: PNG export at 2x scale for retina-quality images
- 🔄 **Multiple Formats**: Supports inline `<svg>`, `<img src="*.svg">`, `<object>`, `<embed>`
- ⌨️ **Keyboard Control**: Press `Esc` to exit selection mode
- 🎯 **Smart Naming**: Automatic filename generation based on element ID

### Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **"Load unpacked"**
5. Select the `chrome-ex-svgloader` folder
6. The extension icon will appear in your toolbar

### How to Use

1. Click the **SVG Downloader** extension icon in your toolbar
2. Click **"Start SVG Selection Mode"** in the popup
3. A blue banner appears: "SVG Selection Mode"
4. **Hover** over any SVG element on the page — it will be highlighted with a blue outline
5. **Click** the SVG to download it as a `.png` file
6. Press **Esc** or click the button again to exit selection mode

### File Structure

```
chrome-ex-svgloader/
├── manifest.json       # Extension configuration (Manifest V3)
├── popup.html          # Popup UI interface
├── popup.js            # Popup event handler
├── content.js          # SVG selection and PNG conversion logic
├── content.css         # Highlight and banner styles
├── icons/
│   ├── icon48.png      # Small toolbar icon
│   └── icon128.png     # Large icon for Chrome Web Store
└── README.md           # This file
```

### Technical Details

- **Manifest Version**: 3 (Chrome's latest extension standard)
- **SVG to PNG Conversion**: Uses Canvas API to render SVG at 2x scale
- **Fallback**: If PNG conversion fails due to CORS issues, downloads original SVG
- **Performance**: Lightweight content script with no external dependencies

### Supported SVG Types

- ✅ Inline `<svg>` elements in HTML
- ✅ External `<img src="file.svg">`
- ✅ Embedded `<object data="file.svg">`
- ✅ Embedded `<embed src="file.svg">`

### Limitations

- CORS-restricted SVGs may fail to convert to PNG (falls back to SVG download)
- Very large SVGs may take longer to process
- Animated SVGs will be rendered as a static frame

### License

MIT License - Feel free to use and modify

---

## 中文

### 概述

**SVG 下載器**是一個 Chrome 擴展程式，讓你輕鬆地將網頁上的 SVG 元素一鍵下載為 PNG 圖片。

### 功能特性

- 🎯 **點擊選擇模式**：啟用選擇模式並懸停在 SVG 元素上
- 🎨 **視覺高亮**：懸停時 SVG 元素會以藍色框線突出顯示
- 📥 **一鍵下載**：點擊任何 SVG 即可轉換為 PNG 並下載
- 🖼️ **高品質輸出**：PNG 導出時採用 2 倍縮放以獲得視網膜級品質
- 🔄 **多種格式支援**：支援內聯 `<svg>`、`<img src="*.svg">`、`<object>`、`<embed>`
- ⌨️ **鍵盤控制**：按 `Esc` 鍵退出選擇模式
- 🎯 **智能命名**：根據元素 ID 自動生成文件名

### 安裝方法

1. 下載或複製此倉庫
2. 打開 Chrome 並導航到 `chrome://extensions/`
3. 啟用**開發者模式**（右上角切換開關）
4. 點擊**"載入未封裝項目"**
5. 選擇 `chrome-ex-svgloader` 資料夾
6. 擴展程式圖標將出現在你的工具列中

### 使用方法

1. 點擊工具列中的 **SVG 下載器**擴展程式圖標
2. 在彈出窗口中點擊**"開始 SVG 選擇模式"**
3. 藍色橫幅出現："SVG 選擇模式"
4. **懸停**在頁面上的任何 SVG 元素上 — 它會以藍色框線突出顯示
5. **點擊** SVG 即可將其下載為 `.png` 文件
6. 按 **Esc** 鍵或再次點擊按鈕退出選擇模式

### 文件結構

```
chrome-ex-svgloader/
├── manifest.json       # 擴展程式配置 (Manifest V3)
├── popup.html          # 彈出窗口 UI 界面
├── popup.js            # 彈出窗口事件處理
├── content.js          # SVG 選擇和 PNG 轉換邏輯
├── content.css         # 高亮和橫幅樣式
├── icons/
│   ├── icon48.png      # 小工具列圖標
│   └── icon128.png     # Chrome Web Store 大圖標
└── README.md           # 本文件
```

### 技術細節

- **Manifest 版本**：3（Chrome 最新擴展程式標準）
- **SVG 轉 PNG**：使用 Canvas API 以 2 倍縮放渲染 SVG
- **後備方案**：如果由於 CORS 問題 PNG 轉換失敗，將下載原始 SVG
- **性能**：輕量級內容腳本，無外部依賴

### 支援的 SVG 類型

- ✅ HTML 中的內聯 `<svg>` 元素
- ✅ 外部 `<img src="file.svg">`
- ✅ 嵌入 `<object data="file.svg">`
- ✅ 嵌入 `<embed src="file.svg">`

### 限制條件

- 受 CORS 限制的 SVG 可能無法轉換為 PNG（會回退到 SVG 下載）
- 非常大的 SVG 可能需要更長的處理時間
- 動畫 SVG 將被渲染為靜態幀

### 許可證

MIT 許可證 - 隨時可用和修改

---

**Made with ❤️ for web designers and developers**
