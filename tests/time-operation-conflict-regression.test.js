import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("script.js", "utf8");
const logic = source.slice(source.indexOf("function getList"), source.indexOf("/* 行程操作"));
const context = { structuredClone };

vm.createContext(context);
vm.runInContext(`
 let state={activeDate:"2026-10-05",days:{"2026-10-05":[]},staging:[],conflicts:[]};
 function makeId(){return "conflict-"+Math.random();}
 function activeRows(){return state.days[state.activeDate];}
 function persist(){}
 function render(){}
 function showToast(){}
 function openConflictModal(){}
 ${logic}
 globalThis.savedOperationFor=(key,field,value,lockedRowId,lockedField)=>{
  const rows=[
   {id:"P",start:"08:00",end:"09:00",duration:60,lock:"none",pending:false},
   {id:"A",start:"09:00",end:"10:00",duration:60,lock:"none",pending:false},
   {id:"N",start:"10:00",end:"11:00",duration:60,lock:"none",pending:false}
  ];
  rows.find(row=>row.id===lockedRowId).lock=lockedField;
  state.days[state.activeDate]=rows;
  state.conflicts=[];
  executeTimeOption(rows[1],1,field,value,{key});
  return state.conflicts[0]&&state.conflicts[0].operation;
 };
`, context);

const cases = [
 ["start-all", "start", "09:30", "P", "end", "更新前後行程時間"],
 ["start-previous", "start", "09:30", "P", "end", "更新上一項行程的時長"],
 ["start-up", "start", "09:30", "P", "end", "更新之前行程的時間"],
 ["end-all", "end", "10:30", "P", "end", "更新前後行程時間"],
 ["end-next", "end", "10:30", "N", "start", "更新下一項行程的時長"],
 ["end-down", "end", "10:30", "N", "start", "更新之後行程的時間"],
 ["duration-previous", "duration", 90, "P", "end", "更新上一項行程的時長"],
 ["duration-up", "duration", 90, "P", "end", "更新之前行程的時間"],
 ["duration-next", "duration", 90, "N", "start", "更新下一項行程的時長"],
 ["duration-down", "duration", 90, "N", "start", "更新之後行程的時間"]
];

for (const [key, field, value, lockedRowId, lockedField, expectedOperation] of cases) {
 assert.equal(context.savedOperationFor(key, field, value, lockedRowId, lockedField), expectedOperation, key + " 遇到鎖定衝突時必須經完整執行路徑保存正確的操作名稱");
}

console.log("time operation conflict regression test passed");
