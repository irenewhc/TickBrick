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
assert.equal(api.hasUnresolvedConflicts(), true, "重新整理衝突時必須檢查實際 A→B→C 時間鏈，不能因 C 與 D 的舊資料相接而清除");
api.exportJSON();
api.openExportDialog("image");
api.openExportDialog("pdf");
assert.equal(api.notices().filter(message=>message==="請先解決本次衝突再執行匯出").length, 3, "JSON、圖片與 PDF 匯出都必須持續被未解下游鎖定衝突阻擋");
lockedRows.find(row=>row.id==="C").lock="none";
api.refreshConflicts();
assert.equal(api.hasUnresolvedConflicts(), true, "解除原本 C 的鎖定後，實際時間鏈仍未串接，不能提前清除衝突");
api.exportJSON();
api.openExportDialog("image");
api.openExportDialog("pdf");
assert.equal(api.notices().filter(message=>message==="請先解決本次衝突再執行匯出").length, 6, "C 已解除但 D 仍阻擋時，JSON、圖片與 PDF 匯出仍須全部被阻擋");
lockedRows.find(row=>row.id==="D").lock="none";
api.refreshConflicts();
assert.equal(api.hasUnresolvedConflicts(), true, "解除所有鎖定但尚未把實際時間鏈串接回來時，衝突不得清除");
api.executeTimeOption(lockedRows.find(row=>row.id==="A"), 0, "end", "23:30", { key: "end-down" });
assert.equal(api.hasUnresolvedConflicts(), false, "使用相關時間欄位重新串接實際下游時間鏈後，才可清除衝突");

api.state().days["2026-10-04"] = [
 {id:"A",start:"06:00",end:"07:00",duration:60,lock:"start",pending:false},
 {id:"B",start:"07:00",end:"08:00",duration:60,lock:"none",pending:false}
];
api.state().conflicts=[];
api.executeTimeOption(api.state().days["2026-10-04"][1], 1, "start", "07:10", { key: "start-all" });
lockedRows = api.state().days["2026-10-04"];
assert.deepEqual(lockedRows.map(row=>[row.start,row.end,row.duration]), [["06:00","07:00",60],["07:10","08:00",60]], "B 直接輸入遇到 A 的開始時間鎖定時，只保留 B 的輸入值");
assert.equal(api.hasUnresolvedConflicts(), true, "A 與 B 尚未實際串接時必須保留衝突");
lockedRows.find(row=>row.id==="A").lock="none";
api.refreshConflicts();
assert.equal(api.hasUnresolvedConflicts(), true, "只解除 A 的鎖定而未修正實際時間鏈時，衝突與匯出阻擋必須保留");
api.exportJSON();
api.openExportDialog("image");
api.openExportDialog("pdf");
assert.equal(api.notices().filter(message=>message==="請先解決本次衝突再執行匯出").length, 9, "單純解鎖後，JSON、圖片與 PDF 匯出仍須全部被阻擋");
api.executeTimeOption(lockedRows.find(row=>row.id==="A"), 0, "start", "06:10", { key: "start-all" });
lockedRows = api.state().days["2026-10-04"];
assert.deepEqual(lockedRows.map(row=>[row.start,row.end,row.duration]), [["06:10","07:10",60],["07:10","08:10",60]], "修改同一時間鏈中 A 的開始時間後，必須實際串接 A 與 B 並維持各自行程時長");
assert.equal(api.hasUnresolvedConflicts(), false, "使用者透過任何相關時間欄位修正實際時間鏈後，才可清除衝突與匯出阻擋");

api.state().days["2026-10-04"] = [
 {id:"A",start:"06:00",end:"07:00",duration:60,lock:"start",pending:false},
 {id:"B",start:"07:00",end:"08:00",duration:1500,lock:"none",pending:false}
];
api.state().conflicts=[];
api.executeTimeOption(api.state().days["2026-10-04"][1], 1, "start", "07:10", { key: "start-all" });
lockedRows = api.state().days["2026-10-04"];
assert.equal(api.hasUnresolvedConflicts(), true, "超過 24 小時的時長遇到鎖定衝突時仍須保留衝突");
lockedRows.find(row=>row.id==="A").lock="none";
api.executeTimeOption(lockedRows.find(row=>row.id==="A"), 0, "start", "06:10", { key: "start-all" });
lockedRows = api.state().days["2026-10-04"];
assert.deepEqual(lockedRows.map(row=>[row.start,row.end,row.duration]), [["06:10","07:10",60],["07:10","08:10",1500]], "1,500 分鐘時長必須依 24 小時循環推算為 07:10–08:10");
assert.equal(api.hasUnresolvedConflicts(), false, "超過 1,440 分鐘的相關行程串接完成後也必須清除衝突");

console.log("downstream circular-time regression test passed");
