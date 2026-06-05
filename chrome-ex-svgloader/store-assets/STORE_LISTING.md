# Chrome Web Store — Listing Copy

複製貼上到開發者控制台對應欄位即可。英文為主要送審語言，中文可作為繁中地區化版本。

---

## 1. Basic info

| 欄位 | 內容 |
|---|---|
| **Name** | SVG Downloader |
| **Summary**（最多 132 字元） | Click any SVG on a web page and download it as a high-resolution PNG image. |
| **Category** | Developer Tools |
| **Language** | English (United States) |

---

## 2. Description（詳細說明）

### English

```
SVG Downloader is the fastest way to grab an SVG icon or illustration from any
web page and save it as a crisp PNG image — no DevTools, no copy-pasting markup,
no design software needed.

HOW IT WORKS
1. Click the SVG Downloader toolbar icon and choose "Start SVG Selection Mode".
2. Hover over any SVG on the page — it lights up with a blue outline.
3. Click it. The SVG is rendered to PNG at 2x resolution and downloaded instantly.
Press Esc anytime to exit selection mode.

FEATURES
• One-click capture — point, click, done.
• 2x high-resolution PNG output for retina-quality images.
• Works with inline <svg>, <img src="*.svg">, <object>, and <embed>.
• Smart file naming based on the element's id or aria-label.
• Lightweight — no external libraries, no background process.

PRIVACY
SVG Downloader collects no data whatsoever. Everything happens locally in your
browser; nothing is ever sent to any server. See our privacy policy for details.

Perfect for designers, developers, and anyone who needs a quick PNG of a vector
icon they see on the web.
```

### 中文（繁體）

```
SVG 下載器是從任何網頁擷取 SVG 圖示或插圖、並存成清晰 PNG 圖片的最快方式 ——
不用開 DevTools、不用複製貼上原始碼、也不需要任何設計軟體。

使用方式
1. 點擊工具列上的 SVG 下載器圖示，選擇「Start SVG Selection Mode」。
2. 將游標移到頁面上任一 SVG，它會以藍色外框高亮。
3. 點一下，SVG 即以 2 倍解析度轉成 PNG 並立即下載。
隨時按 Esc 即可退出選取模式。

特色
• 一鍵擷取 —— 指、點、完成。
• 2 倍高解析度 PNG，視網膜級清晰。
• 支援 inline <svg>、<img src="*.svg">、<object>、<embed>。
• 依元素 id 或 aria-label 智慧命名檔案。
• 輕量 —— 無外部函式庫、無背景程序。

隱私
SVG 下載器不收集任何資料。所有處理都在你的瀏覽器本機完成，不會傳送到任何
伺服器。詳見隱私權政策。

適合設計師、開發者，以及任何想把網頁上看到的向量圖示快速存成 PNG 的人。
```

---

## 3. Privacy practices（隱私審查必填）

### Single purpose（單一用途說明）

```
SVG Downloader has one single purpose: to let the user select an SVG element on
the current web page and download it as a PNG image. All conversion happens
locally in the browser.
```

### Permission justifications（權限理由）

| Permission | Justification (送審用英文) |
|---|---|
| **activeTab** | The extension only needs access to the page the user is currently looking at, and only at the moment the user clicks the toolbar button to start selection mode. activeTab grants this temporary, user-initiated access without a broad host permission. |
| **Content script on `<all_urls>`** | SVG icons can appear on any website, so the user must be able to select and download an SVG on whatever page they are currently viewing. The content script only activates its selection/hover/click handlers after the user explicitly starts selection mode from the popup; it performs no action on page load and reads only the SVG element the user clicks. |

> 註：本擴充套件未使用 `host_permissions`，SVG 抓取是透過 `activeTab` + content script
> 在使用者主動觸發時於當前分頁進行，送審時依上表說明即可。

### Data usage disclosures（資料用途揭露 — 勾選方式）

在 "Privacy practices" 頁面：

- **Are you collecting user data?** → **No**
- 所有資料類型（Personally identifiable info、Health、Financial、Authentication、
  Personal communications、Location、Web history、User activity、Website content）
  → **皆不勾選**
- 三項聲明（certifications）全部勾選 ✅：
  - I do not sell or transfer user data to third parties, outside of the approved use cases
  - I do not use or transfer user data for purposes that are unrelated to my item's single purpose
  - I do not use or transfer user data to determine creditworthiness or for lending purposes

### Privacy policy URL（隱私權政策網址）

送審需要一個公開可存取的網址，可直接用 repo 內 PRIVACY.md 的 raw 連結：

```
https://raw.githubusercontent.com/dimanyen/dm-skills/master/chrome-ex-svgloader/PRIVACY.md
```

> 若想要更易讀的網頁版，可改用 GitHub Pages（見下方備註）。

---

## 4. Graphic assets checklist

| 素材 | 規格 | 狀態 |
|---|---|---|
| Store icon | 128×128 PNG | ✅ icons/icon128.png |
| Screenshot ×1（必填，建議 3–5 張） | 1280×800 PNG | ✅ store-assets/screenshot-1-1280x800.png |
| Small promo tile（選填） | 440×280 PNG | ⬜ 尚未製作 |
| Marquee promo tile（選填） | 1400×560 PNG | ⬜ 尚未製作 |

---

## 5. 上傳前最終檢查

- [ ] 已重新打包 `dist/svg-downloader.zip`（manifest 改過要重打包）
- [ ] zip 內 manifest version 為 `1.0.0`
- [ ] 已註冊 Chrome Web Store 開發者帳號（US$5 一次性）
- [ ] 商店文案、單一用途、權限理由、隱私政策網址皆已填入
- [ ] 至少 1 張 1280×800 截圖已上傳

### 備註：GitHub Pages 網頁版隱私政策（選用）

若想要 `https://dimanyen.github.io/...` 形式的網頁版隱私政策，可在 repo 設定
啟用 GitHub Pages（Settings → Pages → 由 master 分支），再把 PRIVACY.md 對應
的網址填入。否則直接用上方的 raw URL 即可通過審查。
