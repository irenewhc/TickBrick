# TickBrick 設計規範

本文件是 TickBrick 的視覺設計來源。任何會新增或調整樣式的 Agent，在修改前都必須閱讀本文件與 `style.css` 的既有結構；未經批准，不得任意替換既有色彩語意。

## 色彩 Token

下列 token 以 `style.css` 的 `:root` 為唯一來源。新增樣式應優先使用相對應的 CSS 變數，而不是另行建立近似色。

| Token | 色碼 | 使用語意 |
|---|---|---|
| `--color-mint-light` | `#C2F0D5` | 淺綠輔助色。 |
| `--color-mint-bg` | `#e3f8eb` | 作用中日期頁籤等淺綠背景。 |
| `--color-yellow` | `#FFF200` | 主要操作按鈕與強調色。 |
| `--color-yellow-hover` | `#cab300` | `minor` 按鈕內邊框的 Hover／按下色。 |
| `--color-yellow-light` | `#feffe7` | 待放置行程等低強度黃色背景。 |
| `--color-red` | `#FF5252` | 刪除、危險操作與警示重點。 |
| `--color-pink-light` | `#ffe1e1` | 危險 Hover 與淺紅提示背景。 |
| `--color-gray` | `#e6e6e6` | 一般按鈕與中性控制項背景。 |
| `--color-gray-light` | `#f6f6f6` | 淺灰邊界與次級背景。 |
| `--color-gray-heavy` | `#7F7F7F` | 次要文字。 |
| `--color-purple-300` | `#b0bef1` | 淺紫強調／新列提示。 |
| `--color-purple-200` | `#ced8f7` | 淡紫背景。 |
| `--color-purple-700` | `#4e4ab8` | 紫色互動與拖放提示。 |
| `--color-purple-800` | `#3D3B8E` | 深紫互動色。 |
| `--color-purple-900` | `#383877` | 標題、作用中頁籤與重要文字。 |
| `--color-purple-950` | `#222145` | 全域主要文字與最深紫。 |

## 樣式規則

- **禁止使用 `!important`。** 必須以正確 selector、狀態 class 與 CSS 順序處理優先權。
- 不得為既有語意重複新增相近色；需要新色時，先在 Grill／批准流程中確認。
- 危險、衝突與鎖定狀態維持紅色語意；主要可操作動作維持黃色語意；頁籤與結構性互動維持紫色語意。
- 除非已批准的需求要求，勿調整既有色彩、間距、字型或元件狀態。

## 品牌資產

- 頁首使用 `LOGO_橫_字.png`，保留 `h1` 語意與「行程樂高 TickBrick」替代文字；圖檔透明留白須由容器按既有比例裁切，實際可見 LOGO 高度固定為 `80px`，副標維持左對齊並緊接於其下方。
- 圖片與 PDF 匯出優先使用 `LOGO_橫.png`。畫布裁切其透明留白後，以可見高度 `60px` 繪製；日期左對齊於 LOGO 下方，間距為 `30px`。以 `new URL("LOGO_橫.png", document.baseURI)` 解析同站絕對 URL，僅快取成功載入的圖片；載入失敗時清除失敗快取以供下次重試，並在相同位置繪製「行程樂高 TickBrick」文字備援，PNG 與 PDF 匯出仍須完成。

## 一般按鈕

本節只適用於共用 `.button` 及其修飾 class；日期頁籤、月曆控制、鎖定與刪除 icon 等獨立控制元件維持各自規格。

- `.button` 是灰底、深紫字的基礎按鈕；字級 `14px`、字重 `500`、行高 `1.5`、內距 `12px 24px`、圓角 `20px`。以 `inline-flex` 水平與垂直置中；帶圖示時固定間距 `8px`。不使用實體邊框。
- `.button.primary` 是黃底的主要操作；`.button.minor` 是白底且有黃色 `2px` 內邊框的次要視覺操作；`.button.danger` 是紅底白字的危險操作；`.button.small` 只改為 `12px` 字級與 `8px 12px` 內距，並繼承 `20px` 圓角。不得使用 `secondary` 作為按鈕分類。
- 主要操作用於新增行程、建立並前往、移至所選日期、匯出所選日期；日期選擇與時間連動多選項燈箱的可執行調整選項用 `minor`。取消與匯出／匯入四個入口使用基礎 `.button`；刪除、匯入覆蓋與衝突燈箱的「我知道了」使用 `danger`。
- 行程列的待放置項目使用「放置此處」`.button.small.primary` 與「移至暫存」`.button.small.minor`；正式行程的「移至暫存」及所有「移至其他日期」使用 `.button.small`。
- 可操作按鈕 Hover 一律上移 `3px`；`primary` 保持黃色背景並使用 `brightness(.96)`，`minor` 保持白底並將內邊框改為 `--color-yellow-hover`，其餘按鈕同樣使用 `brightness(.96)`。按下時回到原位，並維持各自的 Hover 視覺。背景、內邊框、亮度與位移的過渡時間皆為 `.15s`。
- 停用按鈕維持原配色，透明度 `.45`、游標 `not-allowed`，且不變色、不位移。僅在鍵盤焦點的 `:focus-visible` 顯示 `2px solid var(--color-purple-700)` 外框，外距 `2px`。
- 窄螢幕沿用相同字級與內距；本規範不定義 RWD 排列方式。
- `.export-menu summary` 是匯出／匯入選單的獨立控制項，採 `14px` 字級、`1.5` 行高、`12px 24px` 內距與 `20px` 圓角；窄螢幕的既有覆寫維持 `12px` 字級與 `9px` 內距。
- `.lock-btn` 維持既有邊框、圓角與鎖定配色，尺寸固定為 `24px × 24px`；以 `inline-flex` 水平、垂直置中 `10px` 的鎖定圖示，內距為 `0`，且不可因所在的 flex 容器縮小。

## 拖曳插入提示

- 桌面與觸控拖曳至行程列時，`touch-drop-before` 以列內上緣 `inset 0 3px var(--color-purple-700)` 表示插前，`touch-drop-after` 以列內下緣 `inset 0 -3px var(--color-purple-700)` 表示插後。兩者不使用行程列偽元素或列外延伸陰影，避免因此引入垂直捲軸。

## 時間連動選項燈箱

- 僅時間連動的多選項燈箱使用專用排列：可執行調整選項皆為 `.button.minor`，以內容寬度垂直靠左排列；取消維持基礎 `.button`，另列且靠右。窄螢幕維持相同排列，選項不可撐滿可用寬度。
- 此燈箱開啟時焦點先落在 dialog 本身；使用者按 Tab 後才依序進入選項，並沿用 `.button:focus-visible` 的紫色外框。

## 時長顯示

- 總時長可為 `0` 分鐘；`0` 分鐘的 `.duration-display` 使用既有 `--color-pink-heavy` 深紅色，其餘時長維持既有灰色。
