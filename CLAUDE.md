# CLAUDE.md

個人使用的 Claude Code skills 與 Chrome 擴充套件集合。

## Chrome 擴充套件打包（重要）

本 repo 內的 Chrome 擴充套件會預先打包成 zip 放在 [`dist/`](dist)，供他人從 GitHub 直接下載安裝。

**只要異動到任一擴充套件的原始碼，就必須重新打包並 commit 更新後的 zip，否則 `dist/` 內的安裝包會過期。**

涉及的擴充套件原始碼目錄：

- `cb-overlay/`
- `chrome-ex-svgloader/`
- `learning-hard/elearn-helper/`

重新打包指令：

```bash
bash scripts/build-extensions.sh
```

打包後請一併 commit `dist/` 內變動的 `.zip`。打包規則（同名最上層資料夾、排除 README 與開發腳本）定義在 [scripts/build-extensions.sh](scripts/build-extensions.sh)。

README 的下載連結指向 `master` 分支的 raw URL，因此 zip 必須 commit 進 repo 才有效。
