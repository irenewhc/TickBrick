import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("script.js", "utf8");
const logic = source.slice(source.indexOf("function getList"), source.indexOf("/* 行程操作"));
const exports = source.slice(source.indexOf("function hasUnresolvedConflicts"), source.indexOf("function exportImages"));
const context = { console, structuredClone, Blob, setTimeout: () => 0, clearTimeout: () => {} };

vm.createContext(context);
vm.runInContext(`
 let notices=[];
 let state={activeDate:"2026-10-04",days:{"2026-10-04":[
  {id:"A",start:"09:00",end:"10:00",duration:60,lock:"none",pending:false},
  {id:"B",start:"10:00",end:"11:00",duration:60,lock:"none",pending:false}
 ]},conflicts:[]};
 function makeId(){return "test-"+Math.random();}
 function activeRows(){return state.days[state.activeDate]||[];}
 function persist(){}
 function render(){}
 function showToast(message){notices.push(message);}
 function openConflictModal(){}
 ${logic}
 ${exports}
 globalThis.api={state:()=>state,executeTimeOption,hasUnresolvedConflicts,refreshConflicts,notices:()=>notices,exportJSON,openExportDialog};
`, context);

const api = context.api;
const initialRows = api.state().days["2026-10-04"];
api.executeTimeOption(initialRows[0], 0, "end", "23:30", { key: "end-down" });
const rows = api.state().days["2026-10-04"];

assert.equal(rows[0].end, "23:30", "直接輸入的結束時間必須保留");
assert.equal(rows[0].duration, 870, "跨午夜前的本行程時長必須以循環分鐘數更新");
assert.equal(rows[1].start, "23:30", "下游行程必須接續新的結束時間");
assert.equal(rows[1].end, "00:30", "下游行程跨午夜時必須循環回到隔日時間");
assert.equal(api.hasUnresolvedConflicts(), false, "跨午夜本身不得建立衝突或阻擋匯出");
assert.equal(api.notices().join("|"), "時間連動已更新", "跨午夜循環推算只能顯示正常完成提示，不能顯示衝突提示");

api.state().days["2026-10-04"] = [
 {id:"A",start:"09:00",end:"10:00",duration:60,lock:"none",pending:false},
 {id:"B",start:"10:00",end:"11:00",duration:60,lock:"none",pending:false},
 {id:"C",start:"11:00",end:"12:00",duration:60,lock:"end",pending:false},
 {id:"D",start:"12:00",end:"13:00",duration:60,lock:"start",pending:false}
];
api.state().conflicts=[];
api.executeTimeOption(api.state().days["2026-10-04"][0], 0, "end", "23:30", { key: "end-down" });
let lockedRows = api.state().days["2026-10-04"];
assert.deepEqual(lockedRows.map(row=>[row.start,row.end,row.duration]), [["09:00","23:30",60],["10:00","11:00",60],["11:00","12:00",60],["12:00","13:00",60]], "鎖定衝突時只保留 A 的直接結束時間，其餘下游列必須回復");
assert.equal(api.state().conflicts.length, 1, "下游鎖定結束時間必須建立未解衝突");
api.refreshConflicts();
assert.equal(api.hasUnresolvedConflicts(), true, "重新整理衝突時必須重播 A→B→C→D 的連動，不能因 C 與 D 的舊資料相接而清除");
api.exportJSON();
api.openExportDialog("image");
api.openExportDialog("pdf");
assert.equal(api.notices().filter(message=>message==="請先解決本次衝突再執行匯出").length, 3, "JSON、圖片與 PDF 匯出都必須持續被未解下游鎖定衝突阻擋");
lockedRows.find(row=>row.id==="C").lock="none";
api.refreshConflicts();
assert.equal(api.hasUnresolvedConflicts(), true, "解除原本 C 的鎖定後，重播仍須檢查後方 D 的鎖定，不能提前清除衝突");
api.exportJSON();
api.openExportDialog("image");
api.openExportDialog("pdf");
assert.equal(api.notices().filter(message=>message==="請先解決本次衝突再執行匯出").length, 6, "C 已解除但 D 仍阻擋時，JSON、圖片與 PDF 匯出仍須全部被阻擋");
lockedRows.find(row=>row.id==="D").lock="none";
api.refreshConflicts();
assert.equal(api.hasUnresolvedConflicts(), false, "解除所有實際阻擋整段下游連動的鎖定後，完整重播成功才可清除衝突");

console.log("downstream circular-time regression test passed");
