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
 let dialogs=[];
 function openDialog(title,content,actions){dialogs.push({title,content,actions});}
 ${logic}
 globalThis.api={
  setRows(rows){state.days[state.activeDate]=structuredClone(rows);state.conflicts=[];},
  rows(){return structuredClone(state.days[state.activeDate]);},
  conflicts(){return structuredClone(state.conflicts);},
  refresh(){refreshConflicts();},
  exportBlocked(){refreshConflicts();return state.conflicts.length>0;},
  update(id,patch){Object.assign(state.days[state.activeDate].find(row=>row.id===id),patch);},
  reorder:reorderRow,
  request:requestReorder,
  dialog(){return dialogs.at(-1);},
  clearDialogs(){dialogs=[];}
 };
`, context);

const api = context.api;
const row = (id,start,end,duration=60,lock="none",pending=false,content="") => ({ id,start,end,duration,lock,pending,content });

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

api.setRows([row("A","13:20","14:20"),row("B","14:20","15:20"),row("C","15:20","18:50",210,"start"),row("D","18:50","19:50")]);
api.reorder("day","D","C",false);
rows = api.rows();
assert.deepEqual(rows.map(item => item.id), ["A","B","D","C"], "未鎖定列移到鎖定開始時間列前方時，鎖定列必須成為錨點");
assert.deepEqual(rows.map(item => [item.start,item.end]), [["12:20","13:20"],["13:20","14:20"],["14:20","15:20"],["15:20","18:50"]], "鎖定開始時間錨點必須向上及向下完整重算正式時間鏈");

api.setRows([row("L","10:00","11:00",60,"start"),row("A","11:00","12:00"),row("B","12:00","13:00")]);
api.reorder("day","B","L",true);
rows = api.rows();
assert.deepEqual(rows.map(item => [item.id,item.start,item.end]), [["L","10:00","11:00"],["B","11:00","12:00"],["A","12:00","13:00"]], "未鎖定列移到鎖定開始時間列後方時必須以其開始時間串接");

api.setRows([row("A","08:00","09:00"),row("B","09:00","10:00"),row("L","10:00","11:00",60,"end")]);
api.reorder("day","A","L",false);
rows = api.rows();
assert.deepEqual(rows.map(item => [item.id,item.start,item.end]), [["B","08:00","09:00"],["A","09:00","10:00"],["L","10:00","11:00"]], "未鎖定列移到鎖定結束時間列前方時必須以其結束時間向上串接");

api.setRows([row("L","10:00","11:00",60,"end"),row("A","11:00","12:00"),row("B","12:00","13:00")]);
api.reorder("day","B","L",true);
rows = api.rows();
assert.deepEqual(rows.map(item => [item.id,item.start,item.end]), [["L","10:00","11:00"],["B","11:00","12:00"],["A","12:00","13:00"]], "未鎖定列移到鎖定結束時間列後方時必須以其結束時間向下串接");

api.setRows([row("A","22:30","23:30"),row("L","00:30","02:30",120,"start"),row("D","02:30","03:30")]);
api.reorder("day","D","L",false);
rows = api.rows();
assert.deepEqual(rows.map(item => [item.id,item.start,item.end]), [["A","22:30","23:30"],["D","23:30","00:30"],["L","00:30","02:30"]], "鎖定時間錨點跨午夜時必須使用 24 小時循環");

api.setRows([row("A","13:20","14:20"),row("B","14:20","15:20",60,"end"),row("C","15:20","18:50",210,"start"),row("D","18:50","19:50")]);
api.reorder("day","D","C",false);
rows = api.rows();
assert.deepEqual(rows.map(item => item.id), ["A","B","C","D"], "錨點以外的第二個不相容鎖定必須完整回復排序");
assert.equal(api.conflicts()[0].lockedRowId, "B", "第二個鎖定衝突必須指向實際無法調整的欄位");
api.refresh();
assert.equal(api.conflicts().length, 1, "排序回復後鎖定衝突不得因原資料恢復而消失");
assert.equal(api.exportBlocked(), true, "未解決的排序鎖定衝突必須阻擋匯出");
api.update("B", { lock:"none" });
api.refresh();
assert.equal(api.conflicts().length, 0, "解除相關鎖定且模擬排序可成立後才可清除衝突");

api.setRows([row("A","09:00","10:00"),row("B","10:00","11:00",60,"start",false,"早餐"),row("C","11:00","12:00")]);
api.clearDialogs();
api.request("day","B","A",false);
let dialog = api.dialog();
assert.equal(dialog.content, "由於「早餐」的「開始時間」已鎖定，因此時間連動會以該行程的「開始時間」為基礎更新其他行程。", "拖曳鎖定列前必須顯示正確確認文案");
assert.deepEqual(api.rows().map(item => item.id), ["A","B","C"], "尚未確認時不得套用排序");
dialog.actions.find(action => action.text === "我知道了").run();
assert.deepEqual(api.rows().map(item => item.id), ["B","A","C"], "確認後才套用鎖定拖曳列的排序");

api.setRows([row("A","09:00","10:00"),row("B","10:00","11:00",60,"end"),row("C","11:00","12:00")]);
api.clearDialogs();
api.request("day","B","A",false);
dialog = api.dialog();
assert.equal(dialog.content, "由於「此行程」的「結束時間」已鎖定，因此時間連動會以該行程的「結束時間」為基礎更新其他行程。", "空白內容的確認文案必須使用此行程");
dialog.actions.find(action => action.text === "取消移動").run();
assert.deepEqual(api.rows().map(item => item.id), ["A","B","C"], "取消移動必須保留原排序");
assert.equal(api.conflicts().length, 0, "取消移動不得建立衝突");

api.setRows([row("A","09:00","10:00"),row("B","10:00","11:00",60,"duration"),row("C","11:00","12:00")]);
api.clearDialogs();
api.request("day","B","A",false);
assert.equal(api.dialog(), undefined, "拖曳列只鎖定總時長時不得顯示排序確認燈箱");
assert.deepEqual(api.rows().map(item => item.id), ["B","A","C"], "總時長鎖定列仍應直接套用排序");

api.setRows([row("A","07:30","08:30"),row("B","08:30","16:50",500)]);
api.reorder("day","B","A",false);
rows = api.rows();
assert.deepEqual(rows.map(item => item.id), ["B","A"], "向上反推跨午夜時必須保留新排序");
assert.deepEqual(rows.map(item => [item.start,item.end]), [["23:10","07:30"],["07:30","08:30"]], "向上反推跨午夜必須以 24 小時循環保留後方錨點");
api.refresh();
assert.equal(api.conflicts().length, 0, "跨午夜排序不得建立無效時間衝突");
assert.equal(api.exportBlocked(), false, "只有鎖定衝突才能阻擋匯出");

console.log("reorder time anchor and circular-time regression test passed");
