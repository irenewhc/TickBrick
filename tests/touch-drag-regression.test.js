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

const touchStart = source.indexOf("function beginTouchDrag(");
const touchEnd = source.indexOf("function createTouchPreview(", touchStart);
const touchLogic = source.slice(touchStart, touchEnd);
const updateStart = source.indexOf("function updateTouchDrag(");
const updateEnd = source.indexOf("function clearTouchDropTarget(", updateStart);
const updateLogic = source.slice(updateStart, updateEnd);

assert.match(styles, /\.date-tab\[draggable=true\][\s\S]*?touch-action: none/, "日期頁籤必須以 touch-action:none 保留長按後的 Pointer Events");
assert.match(styles, /\.order-cell\s*\{\s*touch-action: none/, "行程排序欄必須以 touch-action:none 保留長按後的 Pointer Events");
assert.match(touchLogic, /candidate\.scrolling=true/, "移動超過門檻後必須改為捲動狀態，不得啟動拖曳");
assert.match(touchLogic, /window\.scrollBy\(0,scrollBy\)/, "候選取消後必須手動維持垂直頁面捲動");
assert.match(touchLogic, /if\(candidate\.activated\)\{moveEvent\.preventDefault\(\);updateTouchDrag/, "長按啟動後必須抑制捲動並繼續更新拖曳目標");
assert.match(touchLogic, /upEvent\.preventDefault\(\);updateTouchDrag\(upEvent\.clientX,upEvent\.clientY\);finishTouchDrag\(\)/, "放開前必須以最後位置重新命中，避免無效放下沿用前一個有效目標");
assert.doesNotMatch(touchLogic, /pointercancel[\s\S]*?moveEvent/, "垂直拖動流程不得以 pointercancel 作為一般移動的取消路徑");

const clearIndex = updateLogic.indexOf("touchDrag.target=null");
const hitTestIndex = updateLogic.indexOf("document.elementFromPoint");
assert.ok(clearIndex >= 0 && clearIndex < hitTestIndex, "每次命中測試前都必須清空前一個觸控放置目標");

const targetRow = {
 dataset: { area: "day", id: "B" },
 classList: { add() {} },
 getBoundingClientRect() { return { top: 0, height: 100 }; }
};
let hitElement = { closest(selector) { return selector === "tr[data-id]" ? targetRow : null; } };
const targetContext = {
 document: {
  elementFromPoint() { return hitElement; },
  querySelector() { return null; },
  querySelectorAll() { return []; }
 },
 positionTouchPreview() {},
 clearTouchDropTarget() {}
};
vm.createContext(targetContext);
vm.runInContext(`
 let touchDrag={type:"row",area:"day",target:null};
 ${functionSource("updateTouchDrag")}
 globalThis.update=(x,y)=>updateTouchDrag(x,y);
 globalThis.target=()=>touchDrag.target;
`, targetContext);
targetContext.update(10, 75);
assert.equal(targetContext.target().id, "B", "先命中有效列時必須記錄目標");
hitElement = null;
targetContext.update(300, 300);
assert.equal(targetContext.target(), null, "有效目標後移到無效位置時，目標必須清空而非沿用");

const reorder = functionSource("reorderRow");
const recalculateReorderedDayRow = functionSource("recalculateReorderedDayRow");
const context = { structuredClone };
vm.createContext(context);
vm.runInContext(`
 let state={activeDate:"2026-10-04",days:{"2026-10-04":[{id:"A"},{id:"B"},{id:"C"}]},staging:[]};
 function getList(area){return area==="staging"?state.staging:state.days[state.activeDate];}
 function activeRows(){return state.days[state.activeDate];}
 function findFormalBefore(rows,index){for(let i=index-1;i>=0;i--)if(!rows[i].pending)return i;return-1;}
 function findFormalAfter(rows,index){for(let i=index+1;i<rows.length;i++)if(!rows[i].pending)return i;return-1;}
 function cascadeForward(){return null;}
 function setTimeValue(){return null;}
 function timeBefore(){return "00:00";}
 function cascadeFrom(){return null;}
 function clearConflictsAfterSuccess(){}
 function render(){}
 function showToast(){}
 function recordConflict(){}
 function presentOperationConflict(){}
 let draggedRow=null;
 ${recalculateReorderedDayRow}
 ${reorder}
 globalThis.rows=()=>state.days["2026-10-04"].map(row=>row.id);
 globalThis.reorderRow=reorderRow;
`, context);

context.reorderRow("day", "A", "B");
assert.deepEqual([...context.rows()], ["B", "A", "C"], "桌面三參數拖曳 A 放到 B 時必須維持 B,A,C");

console.log("touch drag regression test passed");
