import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("script.js", "utf8");

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

const handleTimeEdit = functionSource("handleTimeEdit");
const timeOptions = functionSource("timeOptions");
const normalizeNumericInput = functionSource("normalizeNumericInput");
const durationValue = functionSource("durationValue");
const durationWithinLimit = functionSource("durationWithinLimit");
const dialogRowName = functionSource("dialogRowName");
const context = { structuredClone };
vm.createContext(context);
vm.runInContext(`
 let currentRow, currentRows=[], dialogCall, executedCall, notices=[];
 function getRow(){return currentRow;}
 function formatTime(value){return value;}
 function activeRows(){return currentRows;}
 function formalIndexBefore(){return currentRow&&currentRow.single?-1:0;}
 function formalIndexAfter(){return currentRow&&currentRow.single?-1:0;}
 function fieldLabel(field){return({start:"開始時間",end:"結束時間",duration:"總時長"}[field]);}
 function openDialog(title,content,actions,options){dialogCall={title,content,actions,options};}
 function previewTimeOption(row,index,field,value,option){return{option,trial:{},conflict:null};}
 function timelineAtomicConflicts(){return [];}
 function lockedBoundaryTimeEditScope(){return null;}
 function openTimeOptionWheel(row,index,field,value,options,previews){dialogCall={title:(String(row.content||"").trim()?"「"+row.content.trim()+"」":"此行程")+"的「"+fieldLabel(field)+"」已修改",content:"wheel",actions:[{text:"套用變更"},{text:"保留衝突"},{text:"復原"}],options:{dialogClass:"time-option-dialog",actionsClass:"time-option-wheel-actions",focusDialog:true},wheel:{options,previews}};}
 function executeTimeOption(...args){executedCall=args;}
 function renderDay(){}
 function showToast(message){notices.push(message);}
 function clearConflictsAfterSuccess(){}
 function render(){}
 ${normalizeNumericInput}
 ${durationValue}
 ${durationWithinLimit}
 ${dialogRowName}
 ${timeOptions}
 ${handleTimeEdit}
 globalThis.openFor=(row,field)=>{currentRow={id:"row",start:"09:00",end:"10:00",duration:60,lock:"none",...row};currentRows=[{id:"before",content:"前方行程",start:"08:00",end:"09:00",duration:60,lock:"none",pending:false},currentRow,{id:"after",content:"後方行程",start:"10:00",end:"11:00",duration:60,lock:"none",pending:false}];dialogCall=null;executedCall=null;notices=[];handleTimeEdit("row",field,field==="duration"?90:"10:00");return {dialog:dialogCall,executed:executedCall,notices};};
 globalThis.optionsFor=field=>{currentRow={id:"row",start:"09:00",end:"10:00",duration:60,lock:"none",pending:false};currentRows=[{id:"before",content:"前方行程",start:"08:00",end:"09:00",duration:60,lock:"none",pending:false},currentRow,{id:"after",content:"後方行程",start:"10:00",end:"11:00",duration:60,lock:"none",pending:false}];return timeOptions(currentRow,1,field);};
`, context);

const cases = [
 [{content:"早餐"}, "start", "「早餐」的「開始時間」已修改"],
 [{content:"午餐"}, "duration", "「午餐」的「總時長」已修改"],
 [{content:"   "}, "start", "此行程的「開始時間」已修改"]
];

for (const [row, field, expectedTitle] of cases) {
 const result = context.openFor(row, field),dialog=result.dialog;
 assert.equal(dialog.title, expectedTitle, field + " 欄位必須使用已核定的標題文案");
 assert.equal(dialog.content, "wheel", "多選項必須改由句中滾輪呈現，不重複問題內文");
 assert.equal(dialog.options.dialogClass, "time-option-dialog", "多選項燈箱必須保留專用 class");
 assert.equal(dialog.options.focusDialog, true, "多選項燈箱必須保留 dialog 初始焦點");
 assert.equal([...dialog.actions].map(action=>action.text).join("|"), "套用變更|保留衝突|復原", "多選項燈箱必須使用核定的三個固定按鈕");
}

assert.deepEqual([...context.optionsFor("start")].map(option=>[option.key,option.text]), [["start-all","時長不變，更新前後行程時間"],["start-self-end","結束時間不變，更新本時長"],["start-up","結束時間不變，更新本時長及前方行程時間"],["start-absorb-duration","時長不變，更新結束時間及前方：「前方行程」的時長"],["start-absorb-end","結束時間不變，更新本時長及前方：「前方行程」的時長"],["start-absorb-duration","時長不變，更新結束時間及後方：「後方行程」的時長"]], "開始時間候選必須包含前方時間重排、本列時長修復與動態前後方候選");
assert.deepEqual([...context.optionsFor("end")].map(option=>[option.key,option.text]), [["end-all","時長不變，更新前後行程時間"],["end-self-start","開始時間不變，更新本時長"],["end-down","開始時間不變，更新本時長及後方行程時間"],["end-absorb-duration","時長不變，更新開始時間及前方：「前方行程」的時長"],["end-absorb-duration","時長不變，更新開始時間及後方：「後方行程」的時長"],["end-absorb-start","開始時間不變，更新本時長及後方：「後方行程」的時長"]], "結束時間候選必須包含後方時間重排、本列時長修復與動態候選");
assert.deepEqual([...context.optionsFor("duration")].map(option=>[option.key,option.text]), [["duration-absorb-end","結束時間不變，更新開始時間及前方：「前方行程」的時長"],["duration-up","結束時間不變，更新開始時間及之前行程的時間"],["duration-absorb-start","開始時間不變，更新結束時間及後方：「後方行程」的時長"],["duration-down","開始時間不變，更新結束時間及之後行程的時間"]], "總時長選項必須使用動態前後方吸收與保留的全鏈文案");

console.log("time option dialog copy regression test passed");
