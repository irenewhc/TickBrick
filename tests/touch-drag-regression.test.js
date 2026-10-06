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
assert.match(functionSource("finishTouchDrag"), /requestReorder\(current\.area,current\.id,current\.target\.id,current\.target\.after\)/, "觸控同區排序必須使用共用確認入口");
assert.match(functionSource("bindRows"), /requestReorder\(area,draggedRow\.id,row\.id,after\)/, "桌面放下排序必須把上下半部位置交給共用確認入口");
assert.match(functionSource("bindRows"), /moveStagingRowToDay\(stagingRow,row\.id,after\)/, "桌面暫存列移入日期必須把上下半部位置交給放置入口");
assert.match(functionSource("bindRows"), /e\.stopPropagation\(\)/, "列實際處理放下時必須停止冒泡，避免重複放置");

function desktopRowHarness(area, dragged, targets) {
 const calls = [], rows = targets.map((target, index) => {
  const listeners = {}, classes = new Set();
  const orderCell = { addEventListener() {} };
  return {
   dataset: { id: target.id },
   addEventListener(type, handler) { listeners[type] = handler; },
   emit(type, event) { listeners[type](event); },
   classes,
   classList: { add(name) { classes.add(name); }, remove(...names) { names.forEach(name => classes.delete(name)); } },
   getBoundingClientRect() { return { top: index * 100, height: 100, left: 0 }; },
   querySelectorAll() { return []; },
   querySelector(selector) { return selector === ".order-cell" ? orderCell : { addEventListener() {} }; }
  };
 });
 const context = {
  document: { querySelectorAll() { return rows; } },
  getRow(sourceArea, id) { return sourceArea === "staging" ? (dragged.area === "staging" && dragged.id === id ? { id } : null) : { id }; },
  requestReorder(...args) { calls.push(["reorder", ...args]); },
  moveStagingRowToDay(...args) { calls.push(["staging", args[0].id, args[1], args[2]]); },
  beginTouchDrag() {}, handleTimeEdit() {}, updateRow() {}, rowAction() {}, persist() {},
  state: { categories: [] }, draggedRow: dragged
 };
 vm.createContext(context);
 vm.runInContext(`${functionSource("bindRows")}\nconst root={querySelectorAll(){return globalThis.rows;}};bindRows(root,globalThis.area);`, Object.assign(context, { rows, area }));
 return { rows, calls, context };
}

const dayDesktop = desktopRowHarness("day", { type: "row", area: "day", id: "A" }, [{ id: "B" }, { id: "C" }, { id: "D" }]);
for (const [index, y, expectedAfter] of [[0, 0, false], [1, 150, true], [2, 299, true]]) {
 const event = { clientY: y, prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } };
 dayDesktop.rows[index].emit("dragover", event);
 assert.equal(event.prevented, true, "桌面目標列上、下半部必須接受有效日期列拖曳");
 assert.equal(dayDesktop.rows[index].classes.has(expectedAfter ? "touch-drop-after" : "touch-drop-before"), true, "桌面有效目標必須顯示對應方向的插入線");
 dayDesktop.rows[index].emit("drop", event);
 assert.deepEqual(dayDesktop.calls.at(-1), ["reorder", "day", "A", ["B", "C", "D"][index], expectedAfter], "桌面上、下半部必須傳遞正確插入方向");
 assert.equal(event.stopped, true, "日期列自行處理放下後必須停止冒泡");
 assert.equal(dayDesktop.rows[index].classes.size, 0, "桌面放下後必須清除插入線");
}

const stagingDesktop = desktopRowHarness("day", { type: "row", area: "staging", id: "S" }, [{ id: "B" }, { id: "C" }, { id: "D" }]);
for (const [index, y, expectedAfter] of [[0, 0, false], [1, 150, true], [2, 299, true]]) {
 const event = { clientY: y, prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } };
 stagingDesktop.rows[index].emit("dragover", event);stagingDesktop.rows[index].emit("drop", event);
 assert.deepEqual(stagingDesktop.calls.at(-1), ["staging", "S", ["B", "C", "D"][index], expectedAfter], "暫存列拖到日期目標列時也必須傳遞正確插入方向");
}

const upwardDesktop = desktopRowHarness("day", { type: "row", area: "day", id: "D" }, [{ id: "A" }]);
for (const [y, expectedAfter] of [[0, false], [99, true]]) {
 const event = { clientY: y, preventDefault() {}, stopPropagation() {} };
 upwardDesktop.rows[0].emit("drop", event);
 assert.deepEqual(upwardDesktop.calls.at(-1), ["reorder", "day", "D", "A", expectedAfter], "由下往上拖到第一列時，上下半部必須保留插前／插後方向");
}

const leaveDesktop = desktopRowHarness("day", { type: "row", area: "day", id: "A" }, [{ id: "B" }]);
leaveDesktop.rows[0].emit("dragover", { clientY: 0, preventDefault() {} });leaveDesktop.rows[0].emit("dragleave", {});
assert.equal(leaveDesktop.rows[0].classes.size, 0, "桌面離開目標列後必須清除插入線");
leaveDesktop.rows[0].emit("dragover", { clientY: 99, preventDefault() {} });leaveDesktop.rows[0].emit("dragend", {});
assert.equal(leaveDesktop.rows[0].classes.size, 0, "桌面拖曳結束後必須清除插入線");

const selfDesktop = desktopRowHarness("day", { type: "row", area: "day", id: "B" }, [{ id: "B" }]);
const selfEvent = { clientY: 10, prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } };
selfDesktop.rows[0].emit("dragover", selfEvent);selfDesktop.rows[0].emit("drop", selfEvent);
assert.equal(selfEvent.prevented, true, "拖到自身仍交給既有共用排序入口處理");
assert.deepEqual(selfDesktop.calls, [["reorder", "day", "B", "B", false]], "拖到自身必須保留既有 requestReorder 轉送行為");

const dayToStaging = desktopRowHarness("staging", { type: "row", area: "day", id: "A" }, [{ id: "S" }]);
const bubbleEvent = { clientY: 10, prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } };
dayToStaging.rows[0].emit("drop", bubbleEvent);
assert.equal(bubbleEvent.prevented, false, "日期列拖到暫存目標列時必須交由暫存區冒泡處理");
assert.equal(bubbleEvent.stopped, false, "日期列拖到暫存目標列時不得阻擋暫存區冒泡");

const invalidDesktop = desktopRowHarness("day", { type: "tab", index: 0 }, [{ id: "B" }]);
const invalidEvent = { clientY: 10, prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } };
invalidDesktop.rows[0].emit("dragover", invalidEvent);invalidDesktop.rows[0].emit("drop", invalidEvent);
assert.equal(invalidEvent.prevented, false, "非行程拖曳不得被列排序 handler 接受");
assert.deepEqual(invalidDesktop.calls, [], "非行程拖曳不得請求排序或放置");

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
const reorderTimeAnchorIndex = functionSource("reorderTimeAnchorIndex");
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
 ${reorderTimeAnchorIndex}
 ${recalculateReorderedDayRow}
 ${reorder}
 globalThis.rows=()=>state.days["2026-10-04"].map(row=>row.id);
 globalThis.reorderRow=reorderRow;
`, context);

context.reorderRow("day", "A", "B");
assert.deepEqual([...context.rows()], ["B", "A", "C"], "桌面三參數拖曳 A 放到 B 時必須維持 B,A,C");

console.log("touch drag regression test passed");
