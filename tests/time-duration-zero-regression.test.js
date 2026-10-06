import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source=fs.readFileSync("script.js","utf8");
const logic=source.slice(source.indexOf("function getList"),source.indexOf("/* 行程操作"));
const context={structuredClone};
vm.createContext(context);
vm.runInContext(`
 let state={activeDate:"2026-10-06",days:{"2026-10-06":[]},staging:[],conflicts:[]};
 function makeId(){return "test-"+Math.random();} function activeRows(){return state.days[state.activeDate];}
 function persist(){} function render(){} function showToast(){} function openConflictModal(){}
 ${logic}
 globalThis.api={set(rows){state.days[state.activeDate]=rows;state.conflicts=[];},rows(){return state.days[state.activeDate];},apply(row,index,field,value,key){return applyTimeOption(row,index,field,value,key,{rowId:row.id,field});},execute(row,index,field,value,key){executeTimeOption(row,index,field,value,{key});},conflicts(){return state.conflicts;},blocks(){return conflictStillBlocks(state.conflicts[0]);},options(row,index,field){return timeOptions(row,index,field);},durationValue,formatDuration,signedTimeDelta};
`,context);
const api=context.api;
const row=(id,start,end,duration,lock="none")=>({id,start,end,duration,lock,pending:false});

api.set([row("P","09:00","10:00",60),row("A","10:00","11:00",60),row("N","11:00","12:00",60)]);
api.apply(api.rows()[1],1,"start","10:30","start-fixed-previous");
assert.deepEqual(api.rows().map(r=>[r.start,r.end,r.duration]),[["09:00","10:30",90],["10:30","11:30",60],["11:30","12:30",60]],"開始時間的上一項吸收選項必須保留本列時長並向後串接");

api.set([row("P","09:00","10:00",60),row("A","10:00","11:00",60),row("N","11:00","12:00",60)]);
api.apply(api.rows()[1],1,"end","11:30","end-fixed-next");
assert.deepEqual(api.rows().map(r=>[r.start,r.end,r.duration]),[["09:30","10:30",60],["10:30","11:30",60],["11:30","12:00",30]],"結束時間的下一項吸收選項必須保留本列時長並向前串接");

api.set([row("P","09:00","10:00",60),row("A","10:00","11:00",60),row("N","11:00","12:00",60)]);
api.apply(api.rows()[1],1,"start","10:30","start-fixed-next");
assert.deepEqual(api.rows().map(r=>[r.start,r.end,r.duration]),[["09:30","10:30",60],["10:30","11:30",60],["11:30","12:00",30]],"開始時間的下一項吸收選項必須保留本列時長並向前串接");

api.set([row("P","09:00","10:00",60),row("A","10:00","11:00",60),row("N","11:00","12:00",60)]);
api.apply(api.rows()[1],1,"end","11:30","end-fixed-previous");
assert.deepEqual(api.rows().map(r=>[r.start,r.end,r.duration]),[["09:00","10:30",90],["10:30","11:30",60],["11:30","12:30",60]],"結束時間的上一項吸收選項必須保留本列時長並向後串接");

const locked=row("A","10:00","11:00",60,"start");
assert.equal(api.options(locked,1,"start").some(option=>option.key.startsWith("start-fixed")),false,"開始時間鎖定時必須篩除新吸收選項");
locked.lock="duration";
assert.equal(api.options(locked,1,"start").filter(option=>option.key.startsWith("start-fixed")).length,2,"總時長鎖定時新吸收選項仍可用");

assert.equal(api.durationValue(0),0,"零分鐘必須保留為有效時長");
assert.equal(api.durationValue(-1,0),0,"負時長必須被限制為零");
assert.equal(api.formatDuration(0),"0分","零分鐘必須正確顯示");
assert.equal(api.signedTimeDelta("23:00","00:00"),60,"跨午夜 23:00 到 00:00 必須是正 60 分鐘");
assert.equal(api.signedTimeDelta("00:00","23:00"),-60,"跨午夜反向差值必須是負 60 分鐘");

api.set([row("P","09:50","10:00",10),row("A","10:00","11:00",60)]);
api.execute(api.rows()[1],1,"start","09:30","start-fixed-previous");
assert.equal(api.rows()[1].start,"09:30","相鄰吸收不足時仍須保留使用者直接輸入");
assert.equal(api.conflicts()[0].lockedRowId,"P","相鄰吸收不足衝突必須指出時長不足的行程");
assert.equal(api.conflicts()[0].insufficientDuration,true,"負吸收必須保存時長不足衝突而非偽裝鎖定");
assert.equal(api.blocks(),true,"負吸收保存後必須維持未解衝突與匯出阻擋");

api.set([row("P","23:00","00:00",60),row("A","00:00","01:00",60)]);
assert.equal(api.apply(api.rows()[1],1,"start","00:30","start-fixed-previous"),null,"有效跨午夜吸收不得誤判為負時長");
assert.equal(api.rows()[0].duration,90,"跨午夜吸收必須保留循環時長");

api.set([row("P","09:00","10:00",60),row("A","10:00","10:00",0),row("N","10:00","11:00",60)]);
api.apply(api.rows()[1],1,"start","10:30","start-fixed-next");
assert.deepEqual(api.rows().map(r=>[r.start,r.end,r.duration]),[["09:30","10:30",60],["10:30","10:30",0],["10:30","11:00",30]],"零分鐘行程必須能完成相鄰吸收與時間串接");

api.set([row("P","11:20","12:20",60),row("A","12:20","13:50",90,"duration"),row("N","13:50","15:20",90),row("L","15:20","16:20",60,"start")]);
api.apply(api.rows()[1],1,"end","12:50","end-fixed-next");
assert.deepEqual(api.rows().map(r=>[r.start,r.end,r.duration]),[["10:20","11:20",60],["11:20","12:50",90],["12:50","15:20",150],["15:20","16:20",60]],"截圖路徑必須讓下一項吸收為 150 分鐘且後方鎖定開始時間不衝突");

console.log("time duration zero regression test passed");
