# Privacy Policy — SVG Downloader

_Last updated: 2026-06-05_

## English

**SVG Downloader** is a Chrome extension that lets you select an SVG element on a
web page and download it as a PNG image. Your privacy is fully respected.

### What data we collect

**None.** SVG Downloader does **not** collect, store, transmit, sell, or share any
personal or usage data of any kind. Specifically, the extension does **not**:

- Collect personally identifiable information (name, email, address, etc.)
- Collect health, financial, authentication, or location data
- Track your browsing activity or history
- Use cookies, analytics, or any third-party tracking
- Send any data to the developer or to any external/remote server

### How the extension works

All processing happens **locally in your browser**:

- When you activate selection mode and click an SVG, the extension reads that
  element from the current page, renders it onto an in-page `<canvas>`, converts
  it to a PNG, and triggers a normal browser download.
- For SVGs referenced by URL (`<img>`, `<object>`, `<embed>`), the extension may
  fetch the SVG file from the page's own origin solely to render it. The fetched
  content is used only for the on-the-fly PNG conversion and is never stored or
  transmitted anywhere.

The extension uses the `activeTab` permission, which grants temporary access to
the current tab **only when you invoke the extension**. It does not run in the
background and has no remote code.

### Changes to this policy

If this policy changes, the updated version will be published at this same URL
with a new "Last updated" date.

### Contact

Questions about this policy can be raised via the project's GitHub issues:
https://github.com/dimanyen/dm-skills/issues

---

## 中文

**SVG Downloader（SVG 下載器）** 是一個讓你在網頁上選取 SVG 元素並下載成 PNG
圖片的 Chrome 擴充套件。我們完全尊重你的隱私。

### 我們收集哪些資料

**完全沒有。** 本擴充套件**不會**收集、儲存、傳輸、販售或分享任何個人或使用
資料。具體而言，本擴充套件**不會**：

- 收集個人可識別資訊（姓名、電子郵件、地址等）
- 收集健康、財務、驗證或定位資料
- 追蹤你的瀏覽行為或歷史紀錄
- 使用 cookie、分析工具或任何第三方追蹤
- 將任何資料傳送給開發者或任何外部／遠端伺服器

### 運作方式

所有處理皆在**你的瀏覽器本機端**完成：

- 當你啟用選取模式並點擊 SVG 時，擴充套件會讀取目前頁面上的該元素，繪製到
  頁內的 `<canvas>`，轉換成 PNG，並觸發瀏覽器的一般下載。
- 對於以網址引用的 SVG（`<img>`、`<object>`、`<embed>`），擴充套件可能會從
  頁面自身來源抓取該 SVG 檔案，僅用於即時渲染。抓取的內容只用於當下的 PNG
  轉換，不會被儲存或傳送到任何地方。

本擴充套件使用 `activeTab` 權限，**僅在你主動啟用擴充套件時**才暫時取得目前
分頁的存取權。它不會在背景執行，也沒有任何遠端程式碼。

### 政策變更

若本政策有變更，更新後的版本會發佈於同一網址，並附上新的「最後更新」日期。

### 聯絡方式

如對本政策有疑問，可透過專案的 GitHub issues 提出：
https://github.com/dimanyen/dm-skills/issues
