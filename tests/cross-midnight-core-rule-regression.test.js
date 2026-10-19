import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("script.js", "utf8");
assert.match(source, /timeRetry=area==="day"&&!row\.pending&&\["start","end","duration"\]\.includes\(field\)/, "同值重新提交只能套用於正式行程的三個時間欄位");
assert.match(source, /if\(timeRetry\)input\.addEventListener\("keydown",event=>\{if\(event\.key!=="Enter"\|\|event\.isComposing\)return;event\.preventDefault\(\);input\.dataset\.submittedValue=input\.value;submit\(\);\}\)/, "同值重新提交必須可用 Enter 明確送出，而非只依賴 change 事件");
assert.match(source, /input\.addEventListener\("change",\(\)=>\{if\(input\.dataset\.submittedValue===input\.value\)\{delete input\.dataset\.submittedValue;return;\}submit\(\);\}\)/, "Enter 後隨附的 change 事件不得重複送出舊值");
const logic = source.slice(source.indexOf("function getList"), source.indexOf("/* 行程操作"));
const directConflictDescriptionSource = source.slice(source.indexOf("function directConflictDescription"), source.indexOf("/* 顯示鎖定或真實不一致衝突"));
const context = { structuredClone };

vm.createContext(context);
vm.runInContext(`
 let state={activeDate:"2026-10-12",dates:["2026-10-12"],days:{"2026-10-12":[]},staging:[],conflicts:[]};
 function makeId(){return "test-"+Math.random();}
 function activeRows(){return state.days[state.activeDate]||[];}
 function persist(){}
 function render(){}
 function renderDay(){}
 function showToast(){}
 function openConflictModal(){}
 ${logic}
 ${directConflictDescriptionSource}
 globalThis.api={state:()=>state,refreshConflicts,middleEndBeforeStartConflict,backupHasMiddleEndBeforeStart,timeOptions,previewTimeOption,directConflictDescription,hasConflictForRow,hasConflictForInput};
`, context);

const api = context.api;
const setRows = rows => { api.state().days["2026-10-12"] = rows; api.state().conflicts = []; };
let rows, option;

setRows([
 {id:"A",content:"首筆",start:"23:30",end:"00:00",duration:30,lock:"none",pending:false},
 {id:"B",content:"中間",start:"00:00",end:"00:30",duration:30,lock:"none",pending:false},
 {id:"C",content:"末筆",start:"23:30",end:"00:30",duration:60,lock:"none",pending:false}
]);
api.refreshConflicts();
assert.equal(api.state().conflicts.some(conflict=>conflict.endBeforeStart), false, "只有第一筆與最後一筆正式行程可跨午夜");
assert.equal(api.state().conflicts.some(conflict=>conflict.kind==="adjacency"), true, "跨午夜例外不代表可忽略最後一筆與前一筆的實際時間斷點");

setRows([
 {id:"A",content:"前",start:"06:00",end:"07:00",duration:60,lock:"none",pending:false},
 {id:"B",content:"中間",start:"07:25",end:"07:20",duration:1435,lock:"none",pending:false},
 {id:"C",content:"後",start:"07:20",end:"08:00",duration:40,lock:"none",pending:false}
]);
api.refreshConflicts();
assert.equal(api.state().conflicts.some(conflict=>conflict.endBeforeStart), true, "既有中間跨午夜資料必須保留衝突並阻擋匯出");
assert.match(api.directConflictDescription({date:"2026-10-12",directContext:{chainRowIds:["A","B","C"]}}).join("\n"), /「中間」結束時間不可早於開始時間/, "保留衝突的第二個燈箱必須說明實際中間行程的時間先後錯誤");
rows = api.state().days["2026-10-12"]; option = api.timeOptions(rows[1],1,"duration").find(item=>item.key==="duration-down");
assert.equal(api.previewTimeOption(rows[1],1,"duration",1430,option).conflict.endBeforeStart, true, "既有中間跨午夜資料不得以仍不合法的時長試算繼續存在");
assert.equal(api.previewTimeOption(rows[1],1,"duration",20,option).conflict, null, "既有中間跨午夜資料修正為合法時間後必須可試算");

setRows([
 {id:"A",content:"前",start:"06:00",end:"07:00",duration:60,lock:"none",pending:false},
 {id:"B",content:"本列",start:"07:00",end:"07:20",duration:20,lock:"none",pending:false},
 {id:"C",content:"後",start:"07:20",end:"08:00",duration:40,lock:"none",pending:false}
]);
rows = api.state().days["2026-10-12"]; option = api.timeOptions(rows[1], 1, "start").find(item=>item.key==="start-absorb-end"&&item.targetId==="A");
assert.equal(api.previewTimeOption(rows[1],1,"start","07:25",option).conflict.endBeforeStart, true, "手動輸入造成的中間跨午夜試算必須被排除");

setRows([
 {id:"A",content:"A",start:"21:00",end:"22:00",duration:60,lock:"none",pending:false},
 {id:"B",content:"B",start:"22:00",end:"22:30",duration:30,lock:"none",pending:false},
 {id:"C",content:"C",start:"22:30",end:"23:00",duration:30,lock:"none",pending:false},
 {id:"D",content:"D",start:"23:00",end:"23:50",duration:50,lock:"duration",pending:false},
 {id:"E",content:"E",start:"23:50",end:"00:10",duration:20,lock:"none",pending:false}
]);
rows = api.state().days["2026-10-12"]; option = api.timeOptions(rows[2],2,"end").find(item=>item.key==="end-all");
const systemTrial = api.previewTimeOption(rows[2],2,"end","23:30",option);
assert.equal(systemTrial.conflict.endBeforeStart, true, "系統串聯把中間 D 推成跨午夜時，該候選必須不可行");

setRows([
 {id:"A",content:"A",start:"06:00",end:"07:00",duration:60,lock:"none",pending:false},
 {id:"B",content:"B",start:"07:00",end:"07:30",duration:30,lock:"none",pending:false},
 {id:"C",content:"C",start:"23:30",end:"00:20",duration:50,lock:"none",pending:false},
 {id:"D",content:"D",start:"00:20",end:"01:00",duration:40,lock:"none",pending:false}
]);
rows = api.state().days["2026-10-12"]; option = api.timeOptions(rows[1],1,"start").find(item=>item.key==="start-all");
const fullCascadeTrial = api.previewTimeOption(rows[1],1,"start","07:10",option);
assert.equal(fullCascadeTrial.conflict, null, "向上串接不得在向下修復既有跨午夜前過早失敗");
assert.equal(fullCascadeTrial.trial.days["2026-10-12"][2].start, "07:40", "完整串聯必須繼續修復下游列的開始時間");
assert.equal(fullCascadeTrial.trial.days["2026-10-12"][2].end, "08:30", "完整串聯必須依原時長修復下游列的結束時間");

setRows([
 {id:"B",content:"前列",start:"06:30",end:"07:00",duration:30,lock:"none",pending:false},
 {id:"C",content:"本列",start:"07:25",end:"07:45",duration:20,lock:"none",pending:false},
 {id:"D",content:"後列",start:"07:20",end:"07:50",duration:30,lock:"none",pending:false}
]);
api.state().conflicts = [
 {date:"2026-10-12",directRowId:"C",directField:"start",directContext:{chainRowIds:["B","C","D"]}},
 {date:"2026-10-12",directRowId:"C",directField:"end",directContext:{chainRowIds:["B","C","D"]}}
];
assert.equal(api.hasConflictForRow("B"), true, "保留衝突時，實際斷點前列必須標紅");
assert.equal(api.hasConflictForRow("C"), false, "來源列起訖與時長一致時，不可只因相鄰未串接標紅");
assert.equal(api.hasConflictForRow("D"), true, "保留衝突時，實際斷點後列必須標紅");
assert.equal(api.hasConflictForInput("C","start"), true, "開始欄的直接保留值必須先標黃");
assert.equal(api.hasConflictForInput("C","end"), true, "結束欄的直接保留值必須先標黃");
api.state().days["2026-10-12"][0].end = "07:25";
api.state().days["2026-10-12"][0].duration = 55;
api.refreshConflicts();
assert.equal(api.hasConflictForRow("B"), false, "左側接點修復後，前列紅框必須清除");
assert.equal(api.hasConflictForInput("C","start"), false, "左側接點修復後，開始欄黃底必須清除");
assert.equal(api.hasConflictForInput("C","end"), true, "右側接點尚未修復時，結束欄黃底必須保留");
assert.equal(api.hasConflictForRow("C"), false, "來源列自身一致時，修復單側接點後仍不可出現紅框");
assert.equal(api.hasConflictForRow("D"), true, "右側接點尚未修復時，後列紅框必須保留");

assert.equal(api.backupHasMiddleEndBeforeStart({dates:["2026-10-12"],days:{"2026-10-12":[
 {start:"06:00",end:"07:00",pending:false},
 {start:"07:25",end:"07:20",pending:false},
 {start:"07:20",end:"08:00",pending:false}
]}}), true, "匯入必須拒絕新增的中間跨午夜資料");

console.log("cross-midnight core-rule regression test passed");
