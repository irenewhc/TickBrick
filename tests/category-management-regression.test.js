import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("script.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");
const styles = fs.readFileSync("style.css", "utf8");

function functionSource(name) {
 const start = source.indexOf("function " + name + "(");
 assert.notEqual(start, -1, name + " 必須存在");
 let parameterDepth = 0;
 let bodyStart = -1;
 for (let index = source.indexOf("(", start); index < source.length; index++) {
  if (source[index] === "(") parameterDepth++;
  if (source[index] === ")") parameterDepth--;
  if (parameterDepth === 0 && source[index] === "{") { bodyStart = index; break; }
 }
 assert.notEqual(bodyStart, -1, name + " 的函式本體必須存在");
 let depth = 0;
 for (let index = bodyStart; index < source.length; index++) {
  if (source[index] === "{") depth++;
  if (source[index] === "}" && --depth === 0) return source.slice(start, index + 1);
 }
 throw new Error(name + " 的函式範圍無法讀取");
}

assert.match(html, /<details id="categorySettings">[\s\S]*?<summary>管理類別<\/summary>/, "類別管理必須保留在既有詳細區塊內");
assert.match(html, /<summary>管理類別<\/summary><p class="category-manager-instruction">＊類別名稱、顏色可直接編輯，點擊儲存後生效。<\/p><div id="categoryColors"/, "類別管理器必須在各列前顯示已確認的儲存說明");
assert.doesNotMatch(html, /category-manager-footer|類別名稱可直接編輯，點擊儲存後生效。<\/p><\/details>/, "舊的下方類別管理說明不得保留");
assert.match(source, /value="__custom_category__">＋ 自訂類別…<\/option>/, "行程類別選單必須提供自訂類別入口");
assert.match(source, /if\(field==="category"&&input\.value==="__custom_category__"\)return/, "自訂入口不得寫入行程資料");
assert.match(source, /categoryNameUnits\(cleaned\)>16/, "名稱必須以 16 單位限制驗證");
assert.match(source, /replace\(\/\\s\/g,""\)/, "輸入空白必須即時移除");
assert.match(source, /category\.protected/, "預設分類必須以保存的保護旗標禁止刪除");
assert.match(source, /replaceCategoryUsage\(previousName,cleaned\)/, "重新命名必須同步行程與暫存使用處");
assert.match(source, /discardCategoryDrafts\(\)/, "分類草稿必須在其他作業入口復原");
assert.match(functionSource("handleTimeEdit"), /discardCategoryDrafts\(\)/, "正式時間輸入開始時必須復原分類草稿");
assert.match(functionSource("openCalendar"), /discardCategoryDrafts\(\)/, "開啟日期操作時必須復原分類草稿");
assert.match(functionSource("openCategoryCreateDialog"), /discardCategoryDrafts\(\)/, "開啟自訂類別燈箱時必須復原管理器草稿");
assert.match(functionSource("bindRows"), /dragstart[\s\S]*?discardCategoryDrafts\(\)[\s\S]*?row\.lock=/, "開始行程拖曳或切換鎖定時必須復原分類草稿");
assert.match(source, /export-menu"\)\.addEventListener\("toggle",event=>\{if\(event\.currentTarget\.open\)discardCategoryDrafts\(\);\}\)/, "展開匯出選單時必須復原分類草稿");
assert.match(functionSource("saveCategory"), /captureCategoryDrafts\(category\.id\)[\s\S]*?render\(drafts\)/, "保存一列時必須帶回其他列的未保存草稿");
assert.match(functionSource("categoryManagerRow"), /if\(isNew\)\{const drafts=captureCategoryDrafts\("__new__"\)[\s\S]*?render\(drafts\)/, "行內新增類別時必須帶回其他列的未保存草稿");
assert.match(functionSource("openCategoryDeleteDialog"), /const drafts=captureCategoryDrafts\(category\.id\)[\s\S]*?render\(drafts\)/, "確認刪除類別時必須帶回未受影響列的草稿");
assert.match(functionSource("categoryManagerRow"), /row\.dataset\.savedName=category\.name[\s\S]*?draft\?\.name\?\?category\.name/, "重繪後每列必須以自己的最後保存值作為還原基準並套用草稿");
const touchActivation = functionSource("beginTouchDrag");
assert.doesNotMatch(touchActivation.slice(0, touchActivation.indexOf("candidate.timer=setTimeout")), /discardCategoryDrafts\(\)/, "觸控候選階段的正常捲動不得復原分類草稿");
assert.match(touchActivation, /candidate\.timer=setTimeout\(\(\)=>\{if\(candidate\.cancelled\)return;discardCategoryDrafts\(\);candidate\.activated=true/, "只有長按真正啟動觸控拖曳時才復原分類草稿");
const categoryRowSource = functionSource("categoryManagerRow");
assert.match(categoryRowSource, /name\.placeholder="請輸入類別名稱"/, "管理器新增名稱欄必須顯示精確預設提示");
assert.doesNotMatch(categoryRowSource, /maxLength/, "管理器名稱欄不得用原生字元數 maxLength 取代共用單位限制");
assert.match(categoryRowSource, /unitNotice\.textContent=count===16\?"類別名稱最多 16 個單位":"";unitNotice\.hidden=count!==16;unitCount\.textContent=count\+"／16"/, "剛好 16 單位時必須顯示紅色上限提示及靠右計數");
assert.match(categoryRowSource, /message\.textContent=cleaned\?error:""/, "空白名稱仍停用保存但不得於欄外重複顯示提示文字");
assert.doesNotMatch(source, /function categoryManagerHeader/, "管理器不得建立類別名稱或顏色表頭");
assert.match(functionSource("renderCategories"), /replaceChildren\(\.\.\.state\.categories\.map[\s\S]*?categoryManagerRow\(newCategory,true/, "所有既有列及底部新增列必須一起重繪，不得插入表頭");
assert.match(categoryRowSource, /nameArea\.append\(name,units,message\);actions\.append\(save,restore,remove\);row\.append\(nameArea,color,actions\)/, "名稱區必須依序放輸入、計數、訊息，色票後緊接動作群組");
const createDialogSource = functionSource("openCategoryCreateDialog");
assert.match(createDialogSource, /name\.placeholder="請輸入類別名稱"/, "自訂類別燈箱名稱欄必須顯示精確預設提示");
assert.doesNotMatch(createDialogSource, /maxLength/, "燈箱名稱欄不得用原生字元數 maxLength 取代共用單位限制");
assert.match(createDialogSource, /unitNotice\.textContent=count===16\?"類別名稱最多 16 個單位":"";unitNotice\.hidden=count!==16;unitCount\.textContent=count\+"／16"/, "燈箱剛好 16 單位時也必須顯示紅色上限提示及靠右計數");
assert.match(createDialogSource, /message\.textContent=cleaned\?error:""/, "燈箱空白名稱仍停用保存但不得於欄外重複顯示提示文字");
assert.match(createDialogSource, /beforeinput[\s\S]*?event\.preventDefault\(\)[\s\S]*?insertCategoryName\(name,text\)/, "燈箱鍵盤輸入與貼上必須在寫入前套用單位限制");
assert.match(categoryRowSource, /beforeinput[\s\S]*?event\.preventDefault\(\)[\s\S]*?insertCategoryName\(name,text\)/, "管理器鍵盤輸入與貼上必須在寫入前套用單位限制");
assert.match(createDialogSource, /addEventListener\("paste",event=>\{const text=event\.clipboardData\?\.getData\("text\/plain"\);if\(text==null\)return;event\.preventDefault\(\);insertCategoryName\(name,text\);refresh\(\);\}\)/, "燈箱必須直接攔截 clipboard 貼上，避免 beforeinput 無資料時遺失游標後內容");
assert.match(categoryRowSource, /addEventListener\("paste",event=>\{const text=event\.clipboardData\?\.getData\("text\/plain"\);if\(text==null\)return;event\.preventDefault\(\);insertCategoryName\(name,text\);refresh\(\);\}\)/, "管理器必須直接攔截 clipboard 貼上，避免 beforeinput 無資料時遺失游標後內容");
assert.match(createDialogSource, /input",event=>\{if\(!event\.isComposing\)refresh\(\);\}\);name\.addEventListener\("compositionend",refresh\)/, "燈箱組字中不可正規化，組字完成後必須立即套用限制");
assert.match(categoryRowSource, /input",event=>\{if\(!event\.isComposing\)refresh\(\);\}\);name\.addEventListener\("compositionend",refresh\)/, "管理器組字中不可正規化，組字完成後必須立即套用限制");
assert.match(categoryRowSource, /save\.className="button category-action category-save primary"[\s\S]*?restore\.className="button category-action category-restore"[\s\S]*?remove\.className="button category-action category-delete danger"/, "類別動作必須使用既有按鈕語意的黃、灰、紅樣式");
assert.doesNotMatch(categoryRowSource, /icon-button/, "類別動作不可借用行程刪除專用的 icon-button");
assert.match(categoryRowSource, /save\.innerHTML=isNew\?'<i class="fa-solid fa-plus"/, "底部新增列必須使用加號而非磁碟圖示");
assert.match(categoryRowSource, /restore\.hidden=!changed/, "還原控制項只可在有未保存變更時顯示");
assert.match(categoryRowSource, /remove\.disabled=category\.protected;remove\.hidden=category\.protected/, "受保護類別不得顯示或啟用刪除控制項");
assert.match(styles, /\.category-manager-row\s*\{[\s\S]*?display: flex;[\s\S]*?flex-wrap: wrap/, "類別列在空間不足時才可自然換行");
assert.match(styles, /\.category-name-area\s*\{[\s\S]*?display: grid;[\s\S]*?gap: 4px/, "名稱輸入、計數與驗證訊息必須垂直排列");
assert.match(styles, /\.category-name-area input\[type="text"\]\s*\{[\s\S]*?height: 34px/, "管理器名稱輸入框必須固定 34px 高度，與色票一致");
assert.match(categoryRowSource, /unitNotice\.className="category-name-limit";unitCount\.className="category-name-count";units\.append\(unitNotice,unitCount\)/, "名稱資訊列必須先放左側提示、再放右側計數兩個 DOM 節點");
assert.match(styles, /\.category-name-units\s*\{[\s\S]*?display: flex;[\s\S]*?justify-self: stretch/, "名稱資訊列必須填滿名稱區以容納左右兩端內容");
assert.match(styles, /\.category-name-count\s*\{[\s\S]*?margin-left: auto/, "未滿 16 單位時，唯一可見的計數必須以自動左側外距固定靠右");
assert.match(styles, /\.category-name-limit\s*\{[\s\S]*?color: var\(--color-red\)/, "上限提示必須使用既有紅色語意");
assert.match(styles, /\.category-manager-actions\s*\{[\s\S]*?display: flex;[\s\S]*?margin-left: 12px;[\s\S]*?gap: 8px/, "色票至動作群組必須以列間距 8px 加 12px 外距形成 20px，群組內仍為 8px");
assert.match(styles, /\.category-action\s*\{[\s\S]*?width: 38px;[\s\S]*?height: 38px;[\s\S]*?border-radius: 20px/, "類別專用 icon 按鈕必須為 38px、20px 圓角");
assert.match(styles, /\.category-action\[hidden\]\s*\{\s*display: none/, "類別動作的原生 hidden 狀態必須壓過 button 的 inline-flex 顯示");
assert.doesNotMatch(styles.match(/\.category-manager-add\s*\{[\s\S]*?\}/)?.[0] || "", /border-top|dashed|padding-top/, "新增列不可再有前置虛線分隔");
assert.match(styles, /\.category-manager-row input\[type="color"\]\s*\{[\s\S]*?width: 32px;[\s\S]*?height: 34px;[\s\S]*?padding: 0;[\s\S]*?border: 0;[\s\S]*?border-radius: 6px/, "管理器色票必須為無外框的緊湊 32px 色塊，並沿用輸入框高度與圓角");
assert.match(styles, /\.category-create-dialog input\[type="color"\]\s*\{[\s\S]*?width: 34px;[\s\S]*?height: 34px;[\s\S]*?padding: 0;[\s\S]*?border: 0;[\s\S]*?border-radius: 6px/, "燈箱色票必須為無外框並沿用輸入框高度與圓角");
assert.match(styles, /\.category-create-dialog input\[type="text"\]\s*\{[\s\S]*?height: 34px/, "燈箱名稱輸入框必須固定 34px 高度，與色票一致");
assert.match(styles, /\.category-manager-row input\[type="color"\]::\-webkit\-color\-swatch\-wrapper,[\s\S]*?\.category-create-dialog input\[type="color"\]::\-webkit\-color\-swatch\-wrapper\s*\{[\s\S]*?padding: 0;[\s\S]*?border: 0;[\s\S]*?border-radius: 6px;[\s\S]*?overflow: hidden/, "兩處色票都必須清除 WebKit 原生內層留白與外框，並裁切 6px 圓角");
assert.match(styles, /\.category-manager-row input\[type="color"\]::\-webkit\-color\-swatch,[\s\S]*?\.category-create-dialog input\[type="color"\]::\-webkit\-color\-swatch\s*\{[\s\S]*?width: 100%;[\s\S]*?height: 100%;[\s\S]*?border: 0;[\s\S]*?border-radius: 6px/, "兩處 WebKit 色塊必須填滿控制項並使用 6px 圓角");

const context = {};
vm.createContext(context);
vm.runInContext(`
 const DEFAULT_CATEGORIES=[
  {id:"default-transport",name:"交通",color:"#e3f8eb",protected:true},
  {id:"default-shopping",name:"逛街",color:"#ffe1e1",protected:true},
  {id:"default-sightseeing",name:"景點",color:"#e4eafb",protected:true},
  {id:"default-dining",name:"用餐",color:"#fcffc2",protected:true},
  {id:"default-other",name:"其他",color:"#e6e6e6",protected:true}
 ];
 ${functionSource("normalizeCategories")}
 ${functionSource("categoryNameUnits")}
 ${functionSource("stripCategoryWhitespace")}
 ${functionSource("limitCategoryName")}
 ${functionSource("insertCategoryName")}
 globalThis.api={normalizeCategories,categoryNameUnits,stripCategoryWhitespace,limitCategoryName,insertCategoryName};
`, context);

assert.equal(context.api.categoryNameUnits("abcdefghijklmnop"), 16, "16 個英文半形字元必須可用");
assert.equal(context.api.categoryNameUnits("台北一日遊行程"), 14, "中文／全形字元必須各計為兩個單位");
assert.equal(context.api.stripCategoryWhitespace("  咖 啡\n店 "), "咖啡店", "所有空白必須被移除");
assert.equal(context.api.limitCategoryName("abcdefghijklmnopQ"), "abcdefghijklmnop", "超過 16 單位的英文必須從尾端截斷");
assert.equal(context.api.limitCategoryName("ABCDEFG中文"), "ABCDEFG中文", "可容納的完整 2 單位字元必須保留");
assert.equal(context.api.limitCategoryName("ABCDEFGHIJKLMNO中"), "ABCDEFGHIJKLMNO", "只剩 1 單位時不可切開或插入 2 單位字元");
const input={value:"ABCDEFGHIJKLMNO",selectionStart:15,selectionEnd:15,setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;}};
context.api.insertCategoryName(input,"中文ABC");
assert.equal(input.value,"ABCDEFGHIJKLMNO", "貼上文字開頭的 2 單位字元放不下時，後續字元不得跳過前項插入");
const replacement={value:"ABCDEFGHIJKLMNOA",selectionStart:14,selectionEnd:16,setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;}};
context.api.insertCategoryName(replacement,"中文");
assert.equal(replacement.value,"ABCDEFGHIJKLMN中", "選取文字替換時必須依釋出的單位容納完整字元");
const pasteWithSuffix={value:"abcdefghijklmnop",selectionStart:7,selectionEnd:9,setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;}};
context.api.insertCategoryName(pasteWithSuffix,"中AB");
assert.equal(pasteWithSuffix.value,"abcdefg中jklmnop", "貼上取代選取範圍時必須保留未選取的後段文字");
const oldData = context.api.normalizeCategories([{name:"交通",color:"#123456"}, {name:"咖啡",color:"#654321"}]);
assert.equal(oldData.find(category => category.name === "交通").protected, true, "舊資料中的既有預設名稱必須升級為受保護分類");
assert.equal(oldData.find(category => category.name === "咖啡").protected, false, "自訂分類不可誤設為受保護");
const renamedDefault = context.api.normalizeCategories([{id:"default-transport",name:"接駁",color:"#123456",protected:true}]);
assert.equal(renamedDefault.find(category => category.id === "default-transport").name, "接駁", "預設分類改名後必須依穩定身分保留名稱與保護狀態");
const renamedWithCustomReuse = context.api.normalizeCategories([{id:"default-transport",name:"接駁",color:"#123456",protected:true}, {id:"custom-coffee",name:"交通",color:"#654321",protected:false}]);
assert.deepEqual(JSON.parse(JSON.stringify(renamedWithCustomReuse.filter(category => ["default-transport","custom-coffee"].includes(category.id)))), [{id:"default-transport",name:"接駁",color:"#123456",protected:true},{id:"custom-coffee",name:"交通",color:"#654321",protected:false}], "已改名預設與同名自訂分類重新載入時必須各自保留");

const saveContext = { document: {}, rendered: null };
vm.createContext(saveContext);
vm.runInContext(`
 let state={categories:[{id:"a",name:"甲",color:"#111111"},{id:"b",name:"乙",color:"#222222"}],days:{},staging:[]};
 function stripCategoryWhitespace(value){return String(value).replace(/\\s/g,"");}
 function categoryDraftError(){return "";}
 function replaceCategoryUsage(){}
 function saveState(){}
 function render(drafts){globalThis.rendered=drafts;}
 function showToast(){}
 ${functionSource("captureCategoryDrafts")}
 ${functionSource("saveCategory")}
 const makeRow=(id,savedName,savedColor,name,color)=>({dataset:{categoryId:id,savedName,savedColor},querySelector(selector){return selector==="[data-category-name]"?{value:name}:{value:color};}});
 const root={querySelectorAll(){return [makeRow("a","甲","#111111","甲","#111111"),makeRow("b","乙","#222222","乙草稿","#333333")];}};
 document.getElementById=()=>root;
 globalThis.runSave=()=>saveCategory(state.categories[0],"甲已保存","#444444");
`, saveContext);
assert.equal(saveContext.runSave(), true, "保存有效分類列必須成功");
assert.deepEqual(JSON.parse(JSON.stringify(saveContext.rendered)), {b:{name:"乙草稿",color:"#333333"}}, "保存甲列後，乙列未保存名稱與色彩草稿必須完整保留；乙列仍以既有保存值作為還原基準");

console.log("category management regression test passed");
