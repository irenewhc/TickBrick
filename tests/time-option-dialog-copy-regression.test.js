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
const durationValue = functionSource("durationValue");
const context = { structuredClone };
vm.createContext(context);
vm.runInContext(`
 let currentRow, dialogCall, executedCall, notices=[];
 function getRow(){return currentRow;}
 function formatTime(value){return value;}
 function activeRows(){return [currentRow];}
 function formalIndexBefore(){return currentRow&&currentRow.single?-1:0;}
 function formalIndexAfter(){return currentRow&&currentRow.single?-1:0;}
 function fieldLabel(field){return({start:"開始時間",end:"結束時間",duration:"總時長"}[field]);}
 function openDialog(title,content,actions,options){dialogCall={title,content,actions,options};}
 function executeTimeOption(...args){executedCall=args;}
 function renderDay(){}
 function showToast(message){notices.push(message);}
 function clearConflictsAfterSuccess(){}
 function render(){}
 ${durationValue}
 ${timeOptions}
 ${handleTimeEdit}
 globalThis.openFor=(row,field)=>{currentRow={start:"09:00",end:"10:00",duration:60,lock:"none",...row};dialogCall=null;executedCall=null;notices=[];handleTimeEdit("row",field,field==="duration"?90:"10:00");return {dialog:dialogCall,executed:executedCall,notices};};
 globalThis.optionsFor=field=>{currentRow={start:"09:00",end:"10:00",duration:60,lock:"none"};return timeOptions(currentRow,0,field);};
`, context);

const cases = [
 [{content:"早餐"}, "start", "「早餐」的「開始時間」已修改，您希望如何調整？"],
 [{content:"機場接駁"}, "end", "「機場接駁」的「結束時間」已修改，您希望如何調整？"],
 [{content:"午餐"}, "duration", "「午餐」的「總時長」已修改，您希望如何調整？"],
 [{content:"   "}, "start", "此行程的「開始時間」已修改，您希望如何調整？"]
];

for (const [row, field, expectedTitle] of cases) {
 const result = context.openFor(row, field),dialog=result.dialog;
 assert.equal(dialog.title, expectedTitle, field + " 欄位必須使用已核定的標題文案");
 assert.equal(dialog.content, "", "問題不得同時重複顯示在燈箱內文");
 assert.equal(dialog.options.dialogClass, "time-option-dialog", "多選項燈箱必須保留專用 class");
 assert.equal(dialog.options.focusDialog, true, "多選項燈箱必須保留 dialog 初始焦點");
 assert.equal(dialog.actions.at(-1).text, "取消", "多選項燈箱必須保留取消按鈕");
}

assert.deepEqual([...context.optionsFor("start")].map(option=>[option.key,option.text]), [["start-all","時長不變，更新前後行程時間"],["start-fixed-previous","時長不變，更新結束時間及上一項行程的時長"],["start-fixed-next","時長不變，更新結束時間及下一項行程的時長"],["start-previous","結束時間不變，更新時長及上一項行程的時長"],["start-up","結束時間不變，更新時長及之前行程的時間"]], "開始時間選項必須包含既有與新增的核定文案");
assert.deepEqual([...context.optionsFor("end")].map(option=>[option.key,option.text]), [["end-all","時長不變，更新前後行程時間"],["end-fixed-previous","時長不變，更新開始時間及上一項行程的時長"],["end-fixed-next","時長不變，更新開始時間及下一項行程的時長"],["end-next","開始時間不變，更新時長及下一項行程的時長"],["end-down","開始時間不變，更新時長及之後行程的時間"]], "結束時間選項必須包含既有與新增的核定文案");
assert.deepEqual([...context.optionsFor("duration")].map(option=>[option.key,option.text]), [["duration-previous","結束時間不變，更新開始時間及上一項行程的時長"],["duration-up","結束時間不變，更新開始時間及之前行程的時間"],["duration-next","開始時間不變，更新結束時間及下一項行程的時長"],["duration-down","開始時間不變，更新結束時間及之後行程的時間"]], "總時長選項必須使用核定文案並依上一項、之前、下一項、之後排序");

const singleOption = context.openFor({content:"早餐",lock:"end",single:true}, "start");
assert.equal(singleOption.dialog, null, "篩選後只剩一個選項時不得開啟選項燈箱");
assert.equal(singleOption.executed[4].key, "start-up", "開始時間且結束時間鎖定時必須保留唯一可用的向上連動選項");
assert.equal(singleOption.executed[5], "因為此行程的「結束時間」已鎖定，幫您結束時間不變，更新時長及之前行程的時間", "單一選項必須產生正確鎖定提示且不得發生 ReferenceError");

console.log("time option dialog copy regression test passed");
