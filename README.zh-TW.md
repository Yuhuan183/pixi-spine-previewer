# Spine Previewer

[English](README.md) | **繁體中文**

[![PixiJS](https://img.shields.io/badge/PixiJS-8.18.1-e72264)](https://pixijs.com)
[![spine-pixi-v8](https://img.shields.io/badge/spine--pixi--v8-4.3.11-7c4dff)](https://esotericsoftware.com/spine-runtimes)
[![Tauri](https://img.shields.io/badge/Tauri-v2-24c8db)](https://v2.tauri.app)
[![Platforms](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20browser-555)](#打包)
[![License](https://img.shields.io/badge/license-UNLICENSED-lightgrey)](#授權)
[![Release](https://img.shields.io/github/v/release/Yuhuan183/pixi-spine-previewer?display_name=tag)](https://github.com/Yuhuan183/pixi-spine-previewer/releases/latest)

**下載:** [最新版本](https://github.com/Yuhuan183/pixi-spine-previewer/releases/latest), macOS (Apple Silicon) 用 `.dmg`, Windows (x64) 用 `-setup.exe`. 兩者都還沒簽章, 第一次開啟的步驟見 [其他注意事項](#其他注意事項).

桌面版 Spine 4.3 預覽器, 用的執行期和遊戲專案完全一樣: **PixiJS 8 + `@esotericsoftware/spine-pixi-v8`**. 指定一個來源目錄, 它會把裡面成對的骨架與 atlas 列出來, 依資料夾分組, 讓你逐一切換皮膚、動畫與載入參數. 沒有任何編輯功能, 不會寫回任何來源檔案.

殼是 Tauri v2, 用系統 webview, 安裝檔約 15 MB, 不是自帶 Chromium 的 150 MB.

## 功能

- **掃描與配對.** 走訪整棵目錄樹, 以檔名把 `.skel`/`.json` 和 `.atlas` 配成一組, 依資料夾分組, 可用名稱或路徑篩選.
- **皮膚.** 可疊加多套, 也可只留一套.
- **三條動畫軌道.** 在 T0–T2 播放, 調整 default mix、速度、循環; 時間軸可逐格拖曳.
- **載入參數.** 骨架縮放、預乘 Alpha、貼圖濾波、dark tint, 改動後自動重新解析.
- **顯示輔助.** 背景色、透明格、格線、原點十字、邊界框, 以及 `SpineDebugRenderer` 的七種除錯繪製.
- **資訊面板.** 匯出版本、hash、atlas 分頁、各項統計、骨骼、插槽、事件定義, 與即時事件紀錄.
- **版本探測.** 解析前先從檔頭讀出匯出版本, 3.8 的檔案會得到一句清楚的訊息, 不是解析器的內部錯誤.
- **截圖.** 輸出目前影格的透明背景 PNG, 不含格線與輔助線.
- **自動更新.** 桌面版啟動時檢查 GitHub release, 有新版就在頂列顯示徽章; 瀏覽器模式不顯示.
- **瀏覽器模式.** 同一套介面可以在瀏覽器分頁裡跑, 走 File System Access API.

## 環境需求

| 工具 | 版本 |
| --- | --- |
| Node.js | `>= 20.19` (`.nvmrc` 寫 22) |
| Rust 工具鏈 | stable (`rust-version = 1.77.2`), 只有桌面殼需要 |
| macOS | 13.0 以上才能執行打包後的 app |
| Windows | WebView2 Runtime (Windows 10 1803+ / 11 已內建) |

## 開始開發

```bash
npm install
rustup default stable                                  # 首次
export PATH="$(brew --prefix)/opt/rustup/bin:$PATH"    # Homebrew 裝的 rustup 要這行才找得到 cargo

npm run dev            # 純瀏覽器模式, http://localhost:5178
npm run dev:desktop    # Tauri 視窗 + Vite 熱更新
```

### 瀏覽器模式不用挑目錄的捷徑

原生目錄挑選器沒辦法自動化, 所以 dev 模式接受一個查詢參數, 直接指到真實目錄:

```
http://localhost:5178/?devfs=/絕對/路徑/到/spine
```

檔案由 Vite dev server 的 `/__dev-fs` 端點提供. 兩個端點只存在於開發模式, 不會進正式輸出.

### 指令

| 指令 | 做什麼 |
| --- | --- |
| `npm run dev` | Vite dev server, 瀏覽器模式 |
| `npm run dev:desktop` | `tauri dev` |
| `npm run build` | 先 `typecheck` 再 `build:web` |
| `npm run typecheck` | 對 app 與 node 端設定各跑一次 `tsc` |
| `npm run lint` | ESLint, 不允許任何 warning |
| `npm run package:mac` | `.app` + `.dmg` |
| `npm run package:win` | NSIS 安裝檔, 在 Windows 上打 |
| `npm run package:win:cross` | 在 macOS 上交叉編譯 NSIS 安裝檔 (見下) |
| `npm version patch\|minor` | 四個檔案一起升版並 commit; push 之後就會出版本 (見 [發版](#發版)) |

## 使用

| 操作 | 說明 |
| --- | --- |
| 開啟目錄 | 工具列、`⌘O`, 或命令列 `Spine Previewer /path/to/assets` |
| 選資源 | 左欄依目錄分組, 上方可篩選名稱或路徑 |
| 皮膚 | 勾選可疊加多套, 「單選」只留一套 |
| 動畫 | 點一下就播到目前的目標軌道 (T0–T2), 可同時疊三軌 |
| 時間軸 | 拖曳即定格檢視; 拖動時自動暫停 |
| 顯示 | 背景色 / 格線 / 原點 / 邊界框 / 除錯繪製 |
| 載入參數 | 骨架縮放 · 預乘 Alpha · 貼圖濾波 · dark tint, 調整後自動重載 |
| 截圖 | 輸出透明背景 PNG, 不含格線與輔助線 |
| 更新 | 有新版時頂列出現徽章; 應用選單的「檢查更新…」(macOS 以外在「檔案」選單) 可隨時手動檢查 |

在 app 裡按 `?` 可查看快捷鍵.

| 按鍵 | 動作 |
| --- | --- |
| `⌘/Ctrl + O` | 選擇來源目錄 |
| `⌘/Ctrl + R` | 重新掃描目錄 |
| `Space` | 播放 / 暫停 |
| `R` | 目前軌道從頭播放 |
| `L` | 切換循環 |
| `← / →` | 上一個 / 下一個動畫 |
| `F` | 置中並填滿 |
| `1` | 回到 100% 縮放 |
| `G` | 切換格線 |
| `B` | 切換骨骼繪製 |
| `/` | 跳到篩選框 |
| 滾輪 / 拖曳 / 雙擊 | 縮放 / 平移 / 置中 |

### 支援的檔案組合

- **骨架:** `.skel` 或 `.bin` (二進位)、`.json`. 也接受 `Foo.skel.txt`、`Foo.atlas.bytes` 這類包一層的命名.
- **Atlas:** `.atlas`
- **貼圖:** `png`、`webp`、`jpg`、`jpeg`、`avif`

同目錄同名的檔案會自動配對. `.json` 只有在同名 atlas 存在, 或該目錄剛好只有一個 atlas 和一個 JSON 時才算骨架, 否則資料夾裡的一般設定檔會被當成壞掉的骨架列出來. 沒有 atlas 的 `.skel` 仍會列出並標警告, 因為漏掉 atlas 正是這個工具要抓的打包失誤.

Atlas 分頁的貼圖依這個順序找: 完全相同的相對路徑、同資料夾同檔名、同資料夾同主檔名、整次掃描裡同主檔名. atlas 寫 `.png` 但實際是 `.webp` 也載得起來, 替代來源會在畫面右上角提示.

掃描會略過隱藏項目、`node_modules`、`.git`、`.svn`、`.hg`、`__MACOSX`, 不追 symlink, 到 20 000 個檔案或 12 層深度就停.

### 版本不符會怎樣

載入前會先從檔頭讀出匯出版本 (4.x 與 3.x 的檔頭佈局不同, 兩種都讀得到). 不是 4.3 線的資料會標成警告; 之後若解析失敗, 錯誤訊息會直接說「資料是 Spine 3.8.99, 本預覽器內建 4.3 執行期」, 而不是丟一個格式解析的內部錯誤.

## 打包

```bash
npm run package:mac        # .app + .dmg
npm run package:win        # 在 Windows 機器上打
npm run package:win:cross  # 在 macOS 上交叉編譯 Windows 安裝檔 (前置作業見下)
```

產物一律在 `src-tauri/target/` 底下. 沒帶 `--target` 就是 `release/bundle/`, 帶了就多一層 target triple:

| 指令 | 產物 |
| --- | --- |
| `package:mac` | `release/bundle/macos/Spine Previewer.app` · `release/bundle/dmg/*.dmg` |
| `package:win` / `package:win:cross` | `x86_64-pc-windows-msvc/release/bundle/nsis/*-setup.exe` |

### 發版

`main` 上的版號前進就是發版觸發點:

```bash
npm version patch          # 或 minor / major: 改 package.json, 同步到 src-tauri/, commit, 打 tag
git push --follow-tags
```

`release.yml` 看到 `package.json` 版號變了, 就在 `macos-latest` (Apple Silicon) 打 macOS bundle、在 `windows-latest` (x64) 打 NSIS 安裝檔, 對 updater 產物簽章, 然後開一個 **draft** GitHub Release `vX.Y.Z`, 裡面有 `.dmg`、`-setup.exe`、各自的 `.sig` 與 `latest.json`. 檢查過再按 Publish; app 內的更新只看已發布的 release. `workflow_dispatch` 可以隨時對目前版號重打一次.

Publish 不是可有可無的收尾. Draft 還沒有 git tag, 它的檔案掛在 `untagged-…` 網址下, 而 `latest.json` 已經指向 `releases/download/vX.Y.Z/`. 那些連結要等 draft 發布、tag 建立之後才會有效.

Workflow 需要兩個 repository secrets, 都由 `npx tauri signer generate -w ~/.tauri/spine-previewer.key` 產生:

| Secret | 內容 |
| --- | --- |
| `TAURI_SIGNING_PRIVATE_KEY` | 私鑰檔案本身 |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 私鑰密碼 |

對應的公鑰放在 `tauri.conf.json` 的 `plugins.updater.pubkey`. **私鑰要另外離線備份**: 弄丟就再也簽不出新版本, 已安裝的 app 永遠不會接受更新. Updater 產物只在 `src-tauri/tauri.release.conf.json` 被合併進來時啟用, 本機跑 `package:*` 不需要金鑰.

要在本機重現 release 的建置:

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/spine-previewer.key)"          # 放的是金鑰內容, 不是路徑
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$(cat ~/.tauri/spine-previewer.key.password)"
npx tauri build --config "$PWD/src-tauri/tauri.release.conf.json" --bundles app,dmg
```

`--config` 一定要給絕對路徑: CLI 會拿相對路徑去對它自己的工作目錄, 那不是 repo 根目錄.

`ci.yml` 在每次 push 到 `main` 與每個 pull request 跑 `typecheck` · `lint` · `build:web`, 不需要 secrets.

### App 怎麼自己更新

打包後的 app 在啟動三秒後去讀 `releases/latest/download/latest.json`, 用編進程式裡的公鑰驗證下載內容, 換好新版後重新啟動. 啟動時的檢查失敗不會有任何提示, 因為網路不穩不值得打斷工作; 從選單發起的檢查則會回報每一種結果, 包含「目前是最新版本」.

更新只提示不強制: 徽章要按了才動作, 按「稍後」就安靜到下次啟動. Windows 走 NSIS 安裝檔的 passive 模式, 會有進度視窗但不用一路按下一步.

### Windows

CI 是正規路徑: NSIS 安裝檔由 `release.yml` 在真的 Windows runner 上產出.

也可以在 macOS 上交叉編譯. Tauri 官方不支援這條路, 但實測 (2026-09-16) 能產出正確的 PE32+ x64 執行檔與 NSIS 安裝檔. 一次性前置作業:

```bash
brew install llvm makensis
rustup target add x86_64-pc-windows-msvc
cargo install cargo-xwin
export PATH="$HOME/.cargo/bin:$(brew --prefix)/opt/rustup/bin:$(brew --prefix)/opt/llvm/bin:$PATH"
npm run package:win:cross   # 首次會下載約 1 GB 的 MSVC CRT 與 Windows SDK 標頭
```

`$HOME/.cargo/bin` 那段不能省: `cargo install` 的執行檔放在那裡, 而 Homebrew 版 rustup 的 shim 在另一個目錄, 少了它 Tauri 會回報 `cargo-xwin` command not found.

**交叉編譯的產物一定要在真的 Windows 上開過再發.** 這條路沒有官方保證, 而且 macOS 主機端無法簽章, 使用者會看到 SmartScreen 警告.

### 其他注意事項

- **預設只出當機器的架構.** 要同時涵蓋 Intel Mac: `rustup target add x86_64-apple-darwin` 之後 `npx tauri build --target universal-apple-darwin`.
- **沒有簽章.** macOS 第一次開會被 Gatekeeper 擋, 用 `xattr -dr com.apple.quarantine "/Applications/Spine Previewer.app"` 解除隔離; Windows 則會跳 SmartScreen 的「仍要執行」.

## 架構

```
.
├── .github/workflows/        ci.yml (品質檢查) · release.yml (版號前進 → draft release)
├── index.html                Vite 進入點
├── vite.config.ts            Vite 設定; 從 package.json 注入 __APP_VERSIONS__
├── scripts/                  給 Vite dev server 用的 node 端工具
│   ├── devFsPlugin.ts        /__dev-fs 端點, 只在 `serve` 生效
│   ├── fsScan.ts             目錄走訪, 規則與 Rust 掃描器相同
│   └── sync-version.mjs      npm `version` hook: 把 package.json 的版號同步到 src-tauri/
├── src/
│   ├── main.tsx              啟動: 先裝 dev 宿主, 再掛 <App />
│   ├── App.tsx               版面、抽屜、全域快捷鍵
│   ├── bridge/               宿主抽象; 上層程式碼不知道現在是哪個宿主
│   │   ├── types.ts          PreviewerBridge 介面與掃描上限
│   │   ├── tauriBridge.ts    Rust IPC (桌面)
│   │   ├── injectedHostBridge.ts  window.previewerHost (dev 檔案宿主)
│   │   └── browserBridge.ts  File System Access API, 退回 webkitdirectory
│   ├── core/                 與畫面無關
│   │   ├── scanner.ts        骨架與 atlas 配對
│   │   ├── probe.ts          從檔頭讀出匯出版本
│   │   ├── loadSpine.ts      bytes → texture → SkeletonData → Spine
│   │   ├── stage.ts          PreviewStage: 唯一的 Pixi Application、相機、輔助線
│   │   └── inspect.ts        給資訊面板的 SkeletonData 唯讀投影
│   ├── store/                zustand
│   │   ├── useAppStore.ts    應用狀態與動作; 持久化介面偏好
│   │   ├── useRuntimeStore.ts  每秒 20 次的舞台快照 (fps、zoom、軌道、邊界)
│   │   └── stage.ts          PreviewStage 單例與資源掛載 / 釋放
│   ├── components/           React 介面: 頂列、資源列表、視口、時間軸、設定分頁、更新對話框
│   ├── hooks/                版面斷點、側欄拖曳
│   ├── lib/                  格式化工具
│   └── dev/devHost.ts        只在 ?devfs= 時啟用的 dev 宿主
└── src-tauri/
    ├── src/lib.rs            指令 (authorize_root · scan_directory · read_file · recent_roots · initial_root) 與選單
    ├── tauri.conf.json       視窗、CSP、打包目標、updater 公鑰與端點
    ├── tauri.release.conf.json  只有 release.yml 會合併進來: 啟用簽章過的 updater 產物
    ├── capabilities/         授予 webview 的權限
    ├── app-icon.png          1024×1024 圖示原稿
    └── icons/                用 `npx tauri icon src-tauri/app-icon.png` 產生
```

四條界線值得記住:

1. **React 不碰 Pixi 物件.** 面板呼叫 `PreviewStage` 的方法, 舞台每 50 ms 回拋一份純資料快照. 播放時的每秒 60 幀不會變成 60 次 re-render.
2. **載入不走 `Assets`.** 來源檔在任何 web root 之外, 官方 loader 以 URL 解析 atlas 分頁的路徑, 在這裡行不通. 自己讀 bytes 再建 texture source, 順便讓 PMA 與濾波變成可以當場改的選項.
3. **Rust 端只讀授權過的目錄.** `scan_directory` 與 `read_file` 會先把路徑正規化 (`..` 與 symlink 都逃不出去), 再檢查是否落在本次工作階段挑過的目錄底下. 檔案以二進位 IPC 回傳, 不走 JSON 數字陣列. 兩個指令都是 async, 掃 20 000 個檔案也不會卡住視窗的事件迴圈.
4. **不使用 eval.** 正式版 CSP 沒有 `unsafe-eval`, 所以 Pixi 走 `pixi.js/unsafe-eval` 的直譯版 shader 系統. `src/core/stage.ts` 開頭那行 import 不能刪.

### 一個必須知道的渲染差異

macOS 上 Tauri 用的是 WKWebView, 不是 Chromium. 實測 (2026-09-16) 兩者只有一處不同: `createImageBitmap(blob, { premultiplyAlpha: 'none' })` 在 WebKit 會走一次「預乘再還原」, 低 alpha 的像素因此有量化誤差 (alpha 3 時 RGB 最大差 35/255), alpha 為 0 的像素 RGB 直接歸零; Chromium 則是位元精確.

這條路徑**只有帶 `pma: true` 那一行的 atlas 會走到**. 沒開預乘 Alpha 打包的 atlas 走的是瀏覽器原生預乘, 兩邊都精確. 在你的 atlas 檔裡 grep `pma: true` 就知道有沒有影響.

如果有, 要判斷軟光暈與低 alpha 的細節請用 Chromium 端 (Android / 桌面瀏覽器) 對照, 別只信 mac 上的預覽.

## 瀏覽器模式

`npm run dev` 與 `npm run preview` 把同一套介面送到一般瀏覽器分頁. Chromium 系瀏覽器走 File System Access API, 可以重新掃描; 其他瀏覽器退回 `webkitdirectory` 輸入框, 只能一次性快照, 不能重掃. 檔案大小在資源開啟前會顯示 `—`, 因為 handle 不會預先讀取.

## 寫在磁碟上的資料

- **最近開啟的目錄:** app 設定目錄下的 `recent-roots.json`, 保留最近 8 筆.
- **介面偏好** (顯示、擺放、載入參數、速度、循環、混合時間、側欄寬度): `localStorage` 的 `spine-previewer` 鍵.

## 授權

UNLICENSED. © 2026 Yuhuan, 保留所有權利.
