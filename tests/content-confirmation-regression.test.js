import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("script.js", "utf8");
const styles = fs.readFileSync("style.css", "utf8");

function functionSource(name) {
 const start = source.indexOf("function " + name + "(");
 assert.notEqual(start, -1, name + " 必須存在");
 const bodyStart = source.indexOf("{", start);
 let depth = 0;
 for (let index = bodyStart; index < source.length; index++) {
  if (source[index] === "{") depth++;
  if (source[index] === "}" && --depth === 0) return source.slice(start, index + 1);
 }
 throw new Error(name + " 的函式範圍無法讀取");
}

assert.match(source, /<textarea class="content-input/, "行程內容必須使用 textarea，才能輸入多行文字");
assert.match(source, /> 待確認<\/label>/, "每筆行程必須顯示「待確認」核取方塊");
assert.match(source, /<div class="category-select-wrapper"><select class="category-select"[\s\S]*?<i class="fa-solid fa-chevron-down category-select-icon" aria-hidden="true"><\/i><\/div>/, "類別選單必須以裝飾性的 Font Awesome chevron 包裝，且不影響 select");
assert.doesNotMatch(styles, /background-image:\s*url\(/, "類別選單不得保留舊的 CSS SVG 箭頭");
assert.match(styles, /\.category-select-icon\s*\{[\s\S]*?right:\s*10px;[\s\S]*?color:\s*var\(--color-purple-900\);[\s\S]*?pointer-events:\s*none;/, "類別 chevron 必須位於右側 10px、使用深紫色且不攔截點擊");
assert.match(styles, /\.category-select\s*\{[\s\S]*?padding-right:\s*28px/, "類別選單右側必須保留足夠內距避免與 chevron 重疊");
assert.match(styles, /overflow-wrap: break-word/, "內容框必須只在超長單字時允許字元間折行");
assert.match(styles, /border-color: var\(--color-pink-heavy\)/, "待確認內容框必須使用深粉紅外框");
assert.match(styles, /\.confirmation-toggle\s*\{[\s\S]*?color:\s*var\(--color-gray-heavy\)/, "待確認標籤必須使用灰色文字 token");

const context = { structuredClone };
vm.createContext(context);
vm.runInContext(`
 const DEFAULT_CATEGORIES=[];
 function durationValue(value,fallback=60){const number=Number(value);return Number.isFinite(number)&&number>=0?number:fallback;}
 function validDate(value){return /^\\d{4}-\\d{2}-\\d{2}$/.test(value);}
 function makeId(){return "generated";}
 ${functionSource("blankState")}
 ${functionSource("makeRow")}
 ${functionSource("normalizeState")}
 globalThis.normalize=normalizeState;
 globalThis.make=makeRow;
`, context);

assert.equal(context.make("2026-10-07", "", "", 60, "", "新行程").confirmed, false, "新行程待確認預設必須為 false");
const oldData = context.normalize({ dates:["2026-10-07"], activeDate:"2026-10-07", days:{"2026-10-07":[{id:"old",content:"舊資料"}]}, staging:[{id:"old-stage",content:"舊暫存"}] });
assert.equal(oldData.days["2026-10-07"][0].confirmed, false, "舊正式資料缺少欄位時必須預設 false");
assert.equal(oldData.staging[0].confirmed, false, "舊暫存資料缺少欄位時必須預設 false");
const confirmedData = context.normalize({ dates:["2026-10-07"], activeDate:"2026-10-07", days:{"2026-10-07":[{id:"yes",content:"已勾選",confirmed:true}]}, staging:[] });
assert.equal(confirmedData.days["2026-10-07"][0].confirmed, true, "JSON 匯入必須保留待確認值");
assert.match(JSON.stringify(confirmedData), /"confirmed":true/, "JSON 備份序列化必須包含待確認值");

const moveContext = { structuredClone };
vm.createContext(moveContext);
vm.runInContext(`
 let state={activeDate:"2026-10-07",dates:["2026-10-07"],days:{"2026-10-07":[]},staging:[]},draggedRow=null;
 function activeRows(){return state.days[state.activeDate];}
 function cascadeFrom(){return null;}
 function clearConflictsAfterSuccess(){}
 function render(){}
 function showToast(){}
 function dateLabel(){return "10/07";}
 function validDate(){return true;}
 function calendarMonthFor(){return {};}
 function recordConflict(){}
 function presentOperationConflict(){}
 function openConflictModal(){}
 function recalculateStructuralChain(){return null;}
 ${functionSource("moveRowToStaging")}
 ${functionSource("moveStagingRowToDay")}
 ${functionSource("moveToDate")}
 const row={id:"move",content:"可移動",confirmed:true,start:"09:00",end:"10:00",pending:false,lock:"none"};
 state.days["2026-10-07"].push(row);moveRowToStaging(row);globalThis.afterStage=state.staging[0].confirmed;
 moveStagingRowToDay(row);globalThis.afterDay=state.days["2026-10-07"][0].confirmed;
 moveToDate("day",row,"2026-10-08");globalThis.afterDate=state.days["2026-10-08"][0].confirmed;
`, moveContext);
assert.equal(moveContext.afterStage, true, "移至暫存後必須保留待確認值");
assert.equal(moveContext.afterDay, true, "從暫存移回日期後必須保留待確認值");
assert.equal(moveContext.afterDate, true, "移至其他日期後必須保留待確認值");

const exportSource = functionSource("renderScheduleCanvas") + "\n" + functionSource("wrapText") + "\n" + functionSource("rowsByPdfPage");
assert.match(exportSource, /待確認/, "圖片與 PDF 共用匯出畫布必須繪製待確認文字");
assert.match(exportSource, /row\.confirmed\?26:0/, "待確認匯出列高度必須預留標記空間，避免與內容重疊");

console.log("content confirmation regression test passed");
