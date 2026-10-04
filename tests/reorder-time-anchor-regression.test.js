import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("script.js", "utf8");
const logic = source.slice(source.indexOf("function getList"), source.indexOf("function timeOptions"));
const context = { structuredClone, setTimeout: () => 0, clearTimeout: () => {} };

vm.createContext(context);
vm.runInContext(`
 let state={activeDate:"2026-10-04",days:{"2026-10-04":[]},staging:[],conflicts:[]};
 let draggedRow=null;
 function makeId(){return "conflict-"+Math.random();}
 function activeRows(){return state.days[state.activeDate];}
 function persist(){}
 function render(){}
 function showToast(){}
 function presentOperationConflict(){}
 ${logic}
 globalThis.api={
  setRows(rows){state.days[state.activeDate]=structuredClone(rows);state.conflicts=[];},
  rows(){return structuredClone(state.days[state.activeDate]);},
  conflicts(){return structuredClone(state.conflicts);},
  refresh(){refreshConflicts();},
  exportBlocked(){refreshConflicts();return state.conflicts.length>0;},
  update(id,patch){Object.assign(state.days[state.activeDate].find(row=>row.id===id),patch);},
  reorder:reorderRow
 };
`, context);

const api = context.api;
const row = (id,start,end,duration=60,lock="none",pending=false) => ({ id,start,end,duration,lock,pending });

api.setRows([row("A","07:30","08:30"),row("B","08:30","09:30")]);
api.reorder("day","B","A",false);
let rows = api.rows();
assert.deepEqual(rows.map(item => item.id), ["B","A"], "拖到最上方必須置於原首列前方");
assert.deepEqual(rows.map(item => [item.start,item.end]), [["06:30","07:30"],["07:30","08:30"]], "最上方排序必須保留後方原首列時間並向上反推拖曳列");

api.setRows([row("A","07:30","08:30"),row("B","08:30","09:30"),row("C","09:30","10:30"),row("D","10:30","11:30")]);
api.reorder("day","C","A",false);
rows = api.rows();
assert.deepEqual(rows.map(item => item.id), ["C","A","B","D"], "四列情境拖到最上方必須維持正確順序");
assert.deepEqual(rows.map(item => [item.start,item.end]), [["06:30","07:30"],["07:30","08:30"],["08:30","09:30"],["09:30","10:30"]], "最上方反推後必須繼續向下重算完整正式時間鏈");

api.setRows([row("A","07:30","08:30"),row("B","08:30","09:30"),row("C","09:30","10:30")]);
api.reorder("day","C","B",false);
rows = api.rows();
assert.deepEqual(rows.map(item => item.id), ["A","C","B"], "中間插入必須保留指定順序");
assert.deepEqual(rows.map(item => [item.start,item.end]), [["07:30","08:30"],["08:30","09:30"],["09:30","10:30"]], "中間插入必須保留前方錨點並向下串接");

api.setRows([row("A","07:30","08:30"),row("B","08:30","09:30"),row("C","09:30","10:30")]);
api.reorder("day","A","B",true);
rows = api.rows();
assert.deepEqual(rows.map(item => item.id), ["B","A","C"], "向下拖曳必須置於目標列後方");
assert.deepEqual(rows.map(item => [item.start,item.end]), [["08:30","09:30"],["09:30","10:30"],["10:30","11:30"]], "向下拖曳必須保留前方錨點並重算拖曳列及其後行程");

api.setRows([row("A","07:30","08:30"),row("P","","",60,"none",true),row("B","08:30","09:30"),row("C","09:30","10:30")]);
api.reorder("day","C","B",false);
rows = api.rows();
assert.deepEqual(rows.map(item => [item.id,item.start,item.end]), [["A","07:30","08:30"],["P","",""],["C","08:30","09:30"],["B","09:30","10:30"]], "待放置行程必須跳過，不得中斷正式行程時間鏈");

api.setRows([row("A","07:30","08:30"),row("B","08:30","09:30",60,"end")]);
api.reorder("day","B","A",false);
rows = api.rows();
assert.deepEqual(rows.map(item => item.id), ["A","B"], "若拖曳列的鎖定時間無法調整，排序必須完整回復");
assert.equal(api.conflicts()[0].lockedRowId, "B", "鎖定衝突必須指向實際被要求調整的拖曳列");
api.refresh();
assert.equal(api.conflicts().length, 1, "排序回復後鎖定衝突不得因原資料恢復而消失");
assert.equal(api.exportBlocked(), true, "未解決的排序鎖定衝突必須阻擋匯出");
api.update("B", { lock:"none" });
api.refresh();
assert.equal(api.conflicts().length, 0, "解除相關鎖定且模擬排序可成立後才可清除衝突");

api.setRows([row("A","07:30","08:30"),row("B","08:30","16:50",500)]);
api.reorder("day","B","A",false);
rows = api.rows();
assert.deepEqual(rows.map(item => item.id), ["B","A"], "向上反推跨午夜時必須保留新排序");
assert.deepEqual(rows.map(item => [item.start,item.end]), [["23:10","07:30"],["07:30","08:30"]], "向上反推跨午夜必須以 24 小時循環保留後方錨點");
api.refresh();
assert.equal(api.conflicts().length, 0, "跨午夜排序不得建立無效時間衝突");
assert.equal(api.exportBlocked(), false, "只有鎖定衝突才能阻擋匯出");

console.log("reorder time anchor and circular-time regression test passed");
