import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source=fs.readFileSync("script.js","utf8");
const logic=source.slice(source.indexOf("function getList"),source.indexOf("/* 行程操作"));
const context={};
vm.createContext(context);
vm.runInContext(`${logic}\nglobalThis.api={normalizeNumericInput,formatTime,durationValue,durationWithinLimit};`,context);
const api=context.api;

assert.equal(api.normalizeNumericInput("０9：3０"),"09:30","全形與半形混合的時間字元必須統一為半形");
assert.equal(api.formatTime("０9：3０"),"09:30","混合格式開始／結束時間必須保存為 HH:MM");
assert.equal(api.formatTime("１2:０5"),"12:05","半形冒號與全形數字混用也必須可辨識");
assert.equal(api.formatTime("24:00"),"","小時超過 23 必須判定為無效，不得壓成 23");
assert.equal(api.formatTime("12:60"),"","分鐘超過 59 必須判定為無效，不得壓成 59");
assert.equal(api.formatTime("２４：００"),"","全形超限時間同樣必須判定為無效");
assert.equal(api.formatTime("23:59"),"23:59","合法上限時間必須維持有效");
assert.equal(api.durationValue("１2３",0),123,"混合格式總時長必須轉為數字分鐘");
assert.equal(api.durationWithinLimit("１４4０"),true,"全形上限值必須通過既有時長驗證");
assert.equal(api.durationWithinLimit("１４4１"),false,"全形超過上限值仍必須被拒絕");
assert.match(source,/<input type="text" inputmode="numeric" pattern="\[0-9０-９\]\*" class="duration-input/,"總時長必須使用可接收全形字元並提示數字鍵盤的文字欄位");
assert.match(source,/aria-label="總時長（分鐘）" '\+\(row\.lock==="duration"\?"disabled":""\)\+' data-field="duration"/,"待放置行程的總時長不得因 pending 狀態停用");
assert.match(source,/placeholder="HH:MM" '\+\(editDisabled\|\|row\.lock==="start"\?"disabled":""\)\+' data-field="start"/,"待放置行程的開始時間必須維持停用");
assert.match(source,/placeholder="HH:MM" '\+\(editDisabled\|\|row\.lock==="end"\?"disabled":""\)\+' data-field="end"/,"待放置行程的結束時間必須維持停用");
assert.match(source,/timeRetry=area==="day"&&!row\.pending&&\["start","end","duration"\]\.includes\(field\),submit=\(\)=>\{if\(timeRetry\)handleTimeEdit\(row\.id,field,input\.value,input\);else updateRow\(area,row\.id,field,input\.value,input\);}/,"待放置行程的總時長必須走一般更新流程，不得提前啟動時間連動");

console.log("fullwidth input regression test passed");
