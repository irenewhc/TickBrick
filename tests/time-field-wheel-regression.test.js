import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source=fs.readFileSync("script.js","utf8");
const css=fs.readFileSync("style.css","utf8");
const between=(from,to)=>source.slice(source.indexOf(from),source.indexOf(to,source.indexOf(from)));
const makeRowSource=between("function makeRow", "/* 載入目前或舊版瀏覽器資料");
const timeLogic=between("function getList", "/* 行程操作");
const addRowSource=between("function addRow", "/* 依行程列動作分派");
const conflictCopy=between("function directConflictDescription", "/* 以統一鎖定衝突");
const openDialogSource=between("function openDialog", "function askConfirm");

assert.equal((source.match(/text:"保留衝突",cls:"danger"/g)||[]).length,3,"三個時間欄位選項燈箱的保留衝突都必須使用 danger 樣式");
assert.match(source,/addEventListener\("wheel",event=>\{if\(event\.deltaMode===1\)\{event\.preventDefault\(\)[\s\S]*?addEventListener\("scroll",\(\)=>\{wheel\._syncVisual\(\);wheel\._settle\(\);\}\)[\s\S]*?addEventListener\("scrollend",\(\)=>wheel\._commit\(\)\)/,"時間欄位觸控板必須使用原生滾動，並在 scroll 與 scrollend 分別處理預覽與對齊");
assert.match(source,/nameChars\.length>20[\s\S]*?nameChars\.slice\(5,20\)/,"時間欄位預覽名稱必須最多 20 字，固定前五字並保留可收合後綴");
assert.match(source,/wheel\._syncVisual=\(\)=>\{[\s\S]*?is-centered/,"滑動途中必須標示通過中央選取槽的文字，但不得藉此更新預覽");
assert.match(source,/previews\.forEach\(preview=>\{if\(!preview\.conflict&&timelineAtomicConflicts/,"時間候選燈箱必須排除副本試算後仍有行程自身或相鄰時間衝突的方案");
assert.match(css,/\.time-option-wheel:focus-visible\s*\{\s*outline:\s*0\s*\}/,"句中滾輪不得顯示焦點外框");
assert.match(css,/\.time-option-wheel-value:focus-visible\s*\{\s*outline:\s*0\s*\}/,"句中候選不得顯示焦點外框");
assert.doesNotMatch(css,/\.time-option-wheel-value:hover/,"句中候選不得保留 Hover 樣式");
assert.match(css,/\.time-option-wheel\[data-position="0"\]\s*\{[^}]*width:\s*150px/,"第一段句中滾輪必須固定為 150px");
assert.match(css,/\.time-option-wheel\[data-position="1"\],\s*\.time-option-wheel\[data-position="2"\]\s*\{[^}]*width:\s*350px/,"第二、第三段句中滾輪必須固定為 350px");
assert.match(css,/\.time-option-wheel\s*\{[^}]*background:\s*linear-gradient\(var\(--color-purple-50\),\s*var\(--color-purple-50\)\)\s*center\s*\/\s*100%\s*34px/,"句中滾輪的淡紫選取槽必須固定在中央");
assert.doesNotMatch(css,/\.time-option-wheel-value\.selected\s*\{[^}]*background:/,"句中候選列不得帶有會隨內容捲動的底色");
assert.match(css,/\.time-option-wheel\.is-scrolling \.time-option-wheel-value\.selected:not\(\.is-centered\)[\s\S]*?\.time-option-wheel-value\.is-centered/,"滑動時中央文字必須深紫，已確認但離開中央的文字回復淡化");
assert.match(css,/\.app-dialog\.time-option-dialog\s*\{\s*width:\s*min\(900px,\s*calc\(100%\s*-\s*30px\)\)/,"時間欄位連動燈箱必須使用專用 900px 寬度並保留窄螢幕上限");
assert.match(css,/\.time-option-preview\s*\{[^}]*--time-option-preview-scrollbar-reserve:\s*17px[^}]*box-sizing:\s*border-box[^}]*height:\s*calc\(8em\s*-\s*3\.2px\s*\+\s*var\(--time-option-preview-scrollbar-reserve\)\)[^}]*overflow-x:\s*auto[^}]*overflow-y:\s*hidden[^}]*scrollbar-gutter:\s*stable/,"結果預覽必須固定保留三行行程、空行與摘要及傳統橫向捲軸的高度，並在極窄寬度提供橫向捲動");
assert.match(css,/\.time-option-preview-entry\s*\{[^}]*flex:\s*0\s+0\s+1\.6em[^}]*gap:\s*0[^}]*white-space:\s*nowrap/,"每筆結果預覽必須固定單行，名稱與時間明細間不得由 gap 插入空白");
assert.match(css,/\.time-option-preview-tag\s*\{[^}]*flex:\s*0\s+0\s+auto[^}]*margin-right:\s*8px/,"tag 與名稱間必須保留 8px，名稱與時間明細間則不保留額外間距");
assert.match(css,/\.time-option-preview-name\.is-long\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*max-content\s+minmax\(0,\s*max-content\)\s+max-content[^}]*flex:\s*0\s+1\s+auto[^}]*min-width:\s*min-content/,"長行程名稱必須以內容 grid 保留前五字與省略號的固有最小寬度，僅中段可收合且不預留固定字寬");
assert.doesNotMatch(css,/\.time-option-preview-name\.is-long\s*\{[^}]*(?:10em|5em|3ch)/,"長行程名稱容器不得配置固定十字或五字寬度，避免數字或英文名稱後出現人工空白");
assert.match(css,/\.time-option-preview-name-prefix,\s*\.time-option-preview-name-ellipsis\s*\{[^}]*flex:\s*0\s+0\s+auto/,"前五字與省略號必須各自不可收縮");
assert.match(css,/\.time-option-preview-name-suffix\s*\{[^}]*flex:\s*0\s+1\s+auto[^}]*min-width:\s*0[^}]*overflow:\s*hidden/,"只有第六至第二十字的後綴可收合，前五字與省略號不得被裁掉");
assert.match(css,/\.time-option-preview-summary\s*\{[^}]*margin-top:\s*auto[^}]*font-size:\s*calc\(1em\s*-\s*2px\)/,"其餘行程摘要必須固定在預覽底部且字級小 2px");
assert.match(css,/\.conflict-reasons\s*\{[^}]*display:\s*grid[^}]*gap:\s*8px/,"直接衝突原因必須使用逐行容器");
assert.match(css,/\.conflict-reason-icon\s*\{[^}]*color:\s*var\(--color-pink-heavy\)/,"直接衝突原因圖示必須使用深粉紅 token");

class TextNode { constructor(text){this.textContent=String(text);this.parentNode=null;} }
class FakeElement {
 constructor(tag="div",ownerDocument=null){this.tagName=tag;this.ownerDocument=ownerDocument;this.children=[];this.parentNode=null;this.listeners={};this.style={};this.dataset=new Proxy({}, {set:(target,key,value)=>(target[key]=String(value),true)});this.attributes={};this.className="";this.tabIndex=0;this.hidden=false;this.disabled=false;this.scrollTop=0;this.classList={add:(...names)=>{this.className+=" "+names.join(" ");},contains:name=>this.className.split(/\s+/).includes(name),toggle:(name,on)=>{const set=new Set(this.className.split(/\s+/).filter(Boolean));on?set.add(name):set.delete(name);this.className=[...set].join(" ");}};}
 append(...items){items.forEach(item=>this.appendChild(typeof item==="string"?new TextNode(item):item));}
 appendChild(item){item.parentNode=this;this.children.push(item);return item;}
 replaceChildren(...items){this.children.forEach(child=>child.parentNode=null);this.children=[];delete this._textContent;this.append(...items);}
 addEventListener(name,handler){(this.listeners[name]??=[]).push(handler);}
 fire(name,event={}){const payload={target:this,...event},path=[];for(let current=this;current;current=current.parentNode)path.push(current);for(const current of path){payload.currentTarget=current;for(const handler of current.listeners[name]||[])handler(payload);}if(name==="wheel"&&payload.deltaMode!==1&&payload.deltaY){this.scrollTop+=payload.deltaY;this.fire("scroll");if(payload.nativeScrollEnd!==false)this.fire("scrollend");}}
 setAttribute(name,value){this.attributes[name]=String(value);}
 toggleAttribute(name,on){if(on)this.attributes[name]="";else delete this.attributes[name];}
 hasPointerCapture(id){return this.capture===id;}
 setPointerCapture(id){this.capture=id;}
 focus(){this.focused=true;if(this.ownerDocument)this.ownerDocument.activeElement=this;}
 showModal(){this.open=true;this._flushFrames?.();}
 close(){this.open=false;}
 get firstChild(){return this.children[0]||null;}
 get textContent(){return this._textContent??this.children.map(item=>item.textContent).join("");}
 set textContent(value){this.children.forEach(child=>child.parentNode=null);this._textContent=String(value);this.children=[];}
 getBoundingClientRect(){return{left:10,right:90,top:10,bottom:90};}
 querySelector(selector){return walk(this,node=>matches(node,selector));}
}

// 2d. 開始時間鎖定時，結束時間只保留不改開始時間的候選；清空時間僅提示、不寫入也不重繪。
{
 const initial=[{id:"B",content:"HOSTEL 早餐",start:"08:30",end:"09:30",duration:60,lock:"start",pending:false},{id:"C",content:"旅館 Check-out",start:"09:55",end:"10:50",duration:55,lock:"none",pending:false},{id:"T",content:"旅館 → 機場",start:"10:50",end:"12:20",duration:90,lock:"duration",pending:false},{id:"I",content:"辦理登機通關、退稅",start:"12:20",end:"14:20",duration:120,lock:"none",pending:false}],runtime=makeRuntime(initial),row=runtime.api.state().days["2026-10-09"][0],options=runtime.api.timeOptions(row,0,"end");
 assert.deepEqual(JSON.parse(JSON.stringify(options.map(option=>[option.key,option.targetId]))),[["end-self-start",null],["end-down",null],["end-absorb-start","C"],["end-absorb-start","I"]],"開始時間鎖定時仍須建立本列與後方時間重排候選，再由副本排除未串接結果");runtime.api.handleTimeEdit("B","end","09:20");assert.equal(runtime.nodes.appDialog.open,true,"只有完整串接的單一方案時也必須開啟確認燈箱");assert.equal(runtime.api.state().days["2026-10-09"][0].end,"09:30","確認前不得寫入唯一候選");runtime.nodes.dialogActions.children[0].fire("click");assert.equal(runtime.api.state().days["2026-10-09"][0].end,"09:20","按我知道了後不得保留會造成空檔的舊結束時間");
 const before=structuredClone(runtime.api.state().days["2026-10-09"]),renders=runtime.calls.render+runtime.calls.renderDay;runtime.nodes.appDialog.close();runtime.api.handleTimeEdit("B","end","");assert.deepEqual(JSON.parse(JSON.stringify(runtime.api.state().days["2026-10-09"])),JSON.parse(JSON.stringify(before)),"清空結束時間不得寫入保存資料");assert.equal(runtime.nodes.appDialog.open,false,"清空結束時間不得開啟燈箱");assert.equal(runtime.calls.render+runtime.calls.renderDay,renders,"清空結束時間不得重繪，讓欄位維持畫面空白");assert.equal(runtime.calls.toasts.at(-1),"請輸入有效時間","清空結束時間必須提示有效時間");
 const startBlank=makeRuntime([{id:"A",content:"可編輯開始時間",start:"08:30",end:"09:30",duration:60,lock:"none",pending:false}]),startBefore=structuredClone(startBlank.api.state().days["2026-10-09"]),startRenders=startBlank.calls.render+startBlank.calls.renderDay;startBlank.api.handleTimeEdit("A","start","");assert.deepEqual(JSON.parse(JSON.stringify(startBlank.api.state().days["2026-10-09"])),JSON.parse(JSON.stringify(startBefore)),"清空可編輯開始時間同樣不得寫入保存資料");assert.notEqual(startBlank.nodes.appDialog.open,true,"清空開始時間不得開啟燈箱");assert.equal(startBlank.calls.render+startBlank.calls.renderDay,startRenders,"清空開始時間不得重繪，讓欄位維持畫面空白");assert.equal(startBlank.calls.toasts.at(-1),"請輸入有效時間","清空開始時間必須使用同一提示");
}
function matches(node,selector){const cls=/\.([\w-]+)/.exec(selector)?.[1],position=/\[data-position="(\d+)"\]/.exec(selector)?.[1];return node instanceof FakeElement&&(!cls||node.className.split(/\s+/).includes(cls))&&(position===undefined||node.dataset.position===position);}
function walk(node,predicate){for(const child of node.children||[]){if(predicate(child))return child;const found=walk(child,predicate);if(found)return found;}return null;}
function all(node,predicate,result=[]){for(const child of node.children||[]){if(predicate(child))result.push(child);all(child,predicate,result);}return result;}
function makeDom(){const document={frames:[],activeElement:null,createElement:tag=>new FakeElement(tag,document),createTextNode:text=>new TextNode(text)};const nodes={appDialog:new FakeElement("dialog",document),dialogTitle:new FakeElement("h2",document),dialogContent:new FakeElement("div",document),dialogActions:new FakeElement("div",document)};nodes.appDialog._flushFrames=()=>{for(const frame of document.frames.splice(0))frame();};document.getElementById=id=>nodes[id];return {nodes,document};}
function rows(){return [{id:"P",content:"前",start:"07:00",end:"08:00",duration:60,lock:"none",pending:false},{id:"A",content:"本",start:"08:00",end:"09:00",duration:60,lock:"none",pending:false},{id:"N",content:"後",start:"09:00",end:"10:00",duration:60,lock:"none",pending:false}];}
function makeRuntime(initial=rows(),timers={}){
 const {nodes,document}=makeDom(),calls={persist:0,render:0,renderDay:0,toasts:[]},context={structuredClone,document,requestAnimationFrame:fn=>document.frames.push(fn),clearTimeout:timers.clearTimeout||(()=>{}),setTimeout:timers.setTimeout||(fn=>{fn();return 1;}),__calls:calls};vm.createContext(context);
 vm.runInContext(`let state={activeDate:"2026-10-09",days:{"2026-10-09":${JSON.stringify(initial)}},staging:[],conflicts:[]};function activeRows(){return state.days[state.activeDate]||[];}function persist(){calls.persist++;}function render(){calls.render++;}function renderDay(){calls.renderDay++;}function showToast(message){calls.toasts.push(message);}function makeId(){return "test-id";}${makeRowSource}function hasUnresolvedConflicts(){refreshConflicts();return state.conflicts.length>0;}const calls=globalThis.__calls;${timeLogic}${addRowSource}${conflictCopy}${openDialogSource}globalThis.api={state:()=>state,calls:()=>calls,timeOptions,timeOptionParts,previewTimeOption,previewCompanionTime,applyTimeOption,executeTimeOption,handleTimeEdit,openTimeOptionWheel,keepTimeEditConflict,timeOptionPreviewSummary,noTimeOptionMessage,appendNoTimeOptionMessage,lockedBoundaryTimeEditScope,matchingLockedBoundaryTrial,hasUnresolvedConflicts,openDialog,openConflictModal,directConflictDescription,directConflictRowIds,hasConflictForRow,hasConflictForInput,addRow,recordConflict};`,context);
 return {api:context.api,nodes,document,calls};
}

// 2c. 直接修改來源的紅框只代表本列起訖與時長不一致；相鄰未串接只標紅另一側。
{
 const initial=[{id:"B",content:"HOSTEL 早餐",start:"08:30",end:"09:30",duration:85,lock:"none",pending:false},{id:"C",content:"旅館 Check-out",start:"09:55",end:"10:50",duration:55,lock:"none",pending:false}],runtime=makeRuntime(initial),conflict={id:"direct-end",date:"2026-10-09",lockedRowId:"B",lockedField:"",directRowId:"B",directField:"end",directContext:{kind:"kept-option",chainRowIds:["B","C"]}};
 runtime.api.state().conflicts=[conflict];assert.deepEqual(JSON.parse(JSON.stringify(runtime.api.directConflictRowIds(conflict))).sort(),["B","C"],"本列時長不一致且後方未串接時，兩列都必須標紅");assert.equal(runtime.api.hasConflictForRow("B"),true,"來源本身不一致時必須標紅");assert.equal(runtime.api.hasConflictForRow("C"),true,"後方未串接列必須標紅");
 runtime.api.state().days["2026-10-09"][0].duration=60;assert.equal(runtime.api.hasUnresolvedConflicts(),true,"修正本列時長後，後方未串接仍須保留可追蹤衝突");assert.equal(runtime.api.state().conflicts.length,2,"成功重檢必須保留黃色來源與獨立的後方時間鏈斷點");assert.deepEqual(JSON.parse(JSON.stringify(runtime.api.directConflictRowIds(conflict))),["C"],"修正本列時長後，只能標紅後方未串接行程");assert.equal(runtime.api.hasConflictForRow("B"),false,"本列起訖與時長一致後必須移除紅框");assert.equal(runtime.api.hasConflictForInput("B","end"),true,"相鄰仍未串接時，原始直接修改欄位必須保留黃底");assert.equal(runtime.api.hasConflictForRow("C"),true,"後方未串接行程必須保留紅框");
 const start=makeRuntime([{id:"P",content:"前方",start:"07:00",end:"08:00",duration:60,lock:"none",pending:false},{id:"B",content:"本列",start:"08:30",end:"09:30",duration:60,lock:"none",pending:false}]),startConflict={id:"direct-start",date:"2026-10-09",lockedRowId:"B",lockedField:"",directRowId:"B",directField:"start",directContext:{kind:"kept-option",chainRowIds:["P","B"]}};start.api.state().conflicts=[startConflict];assert.deepEqual(JSON.parse(JSON.stringify(start.api.directConflictRowIds(startConflict))),["P"],"本列自身一致但開始時間未串接時，只標紅前方行程");assert.equal(start.api.hasConflictForRow("B"),false,"開始時間來源不可因相鄰不連續保留紅框");assert.equal(start.api.hasConflictForInput("B","start"),true,"開始時間來源仍須保留黃底");
 const duration=makeRuntime([{id:"P",content:"前方",start:"07:00",end:"08:00",duration:60,lock:"none",pending:false},{id:"B",content:"本列",start:"08:30",end:"09:30",duration:60,lock:"none",pending:false},{id:"N",content:"後方",start:"10:00",end:"11:00",duration:60,lock:"none",pending:false}]),durationConflict={id:"direct-duration",date:"2026-10-09",lockedRowId:"B",lockedField:"",directRowId:"B",directField:"duration",directContext:{kind:"kept-option",chainRowIds:["P","B","N"]}};duration.api.state().conflicts=[durationConflict];assert.deepEqual(JSON.parse(JSON.stringify(duration.api.directConflictRowIds(durationConflict))).sort(),["N","P"],"本列時長已一致但前後未串接時，只標紅兩側行程");assert.equal(duration.api.hasConflictForRow("B"),false,"時長來源不可因相鄰不連續保留紅框");assert.equal(duration.api.hasConflictForInput("B","duration"),true,"時長來源仍須保留黃底");
}

// 2b. Direct-conflict warnings render actual reasons as separate safe DOM lines.
{
 const runtime=makeRuntime([{id:"A",content:"前項",start:"07:00",end:"08:00",duration:60,lock:"none",pending:false},{id:"B",content:"本項",start:"08:10",end:"09:00",duration:60,lock:"none",pending:false}]),conflict={date:"2026-10-09",lockedRowId:"B",lockedField:"",directContext:{chainRowIds:["A","B"]}};
 assert.deepEqual(JSON.parse(JSON.stringify(runtime.api.directConflictDescription(conflict))),["「本項」的開始時間 08:10 加總時長 1時 不等於結束時間 09:00","「前項」結束時間 08:00 不等於「本項」開始時間 08:10"],"直接衝突原因必須保留逐筆資料，不能預先以分號串接");
 runtime.api.openConflictModal(conflict,true);
 const title=runtime.nodes.dialogTitle;
 assert.equal(title.children[0].className,"dialog-warning-title","直接衝突警告標題必須使用安全 DOM 容器");assert.equal(title.children[0].children[0].className,"fa-solid fa-triangle-exclamation dialog-warning-title-icon","直接衝突警告標題必須使用黃色警示三角 icon");assert.equal(title.textContent,"行程時間衝突警告","直接衝突警告標題文字必須維持核定文案");
 const content=runtime.nodes.dialogContent.children[0],reasons=content.children[1],lines=reasons.children;
 assert.equal(reasons.className,"conflict-reasons","直接衝突原因必須使用逐行容器");assert.equal(lines.length,2,"每個直接衝突原因都必須各占一行");assert.equal(lines.every(line=>line.className==="conflict-reason"&&line.children[0].className==="fa-solid fa-thumbtack conflict-reason-icon"),true,"每個直接衝突原因行首必須安全建立 thumbtack icon");assert.deepEqual(lines.map(line=>line.children[1].textContent),["「本項」的開始時間 08:10 加總時長 1時 不等於結束時間 09:00","「前項」結束時間 08:00 不等於「本項」開始時間 08:10"],"原因文字必須維持原本內容");assert.equal(content.children[2].textContent,"＊提示將保留直到衝突解決。","直接衝突提示必須使用核定簡短文案");
 runtime.api.openConflictModal({...conflict,lockedField:"end",lockedValue:"09:00",requiredValue:"09:10",operation:"更新時間"},false);
 assert.equal(runtime.nodes.dialogTitle.children[0].children[0].className,"fa-solid fa-triangle-exclamation dialog-warning-title-icon","一般衝突警告標題也必須使用同一個黃色警示三角 icon");assert.equal(runtime.nodes.dialogTitle.textContent,"行程時間衝突警告","一般衝突警告標題文字必須維持核定文案");
}

// 1. 開始時間動態候選與總時長既有 key 都必須走實際副本試算。
{
 const {api,calls}=makeRuntime(),row=api.state().days["2026-10-09"][1],startOptions=api.timeOptions(row,1,"start"),durationOptions=api.timeOptions(row,1,"duration"),before=structuredClone(api.state());
 assert.deepEqual(JSON.parse(JSON.stringify(startOptions.map(option=>[option.key,option.targetId,option.direction]))),[["start-all",null,null],["start-self-end",null,null],["start-up",null,null],["start-absorb-duration","P","前方"],["start-absorb-end","P","前方"],["start-absorb-duration","N","後方"]],"開始時間必須列出全鏈、本列時長修復、前方時間重排、前方兩種與後方時長不變候選");
 for(const option of [...startOptions,...durationOptions]){const field=option.key.startsWith("start-")?"start":"duration",preview=api.previewTimeOption(row,1,field,field==="duration"?90:"08:10",option);assert.equal(preview.conflict,null,option.key+" 必須可在完整副本中試算");assert.notDeepEqual(preview.trial,before,option.key+" 副本必須實際套用連動");}
 assert.equal(JSON.stringify(api.state()),JSON.stringify(before),"時間候選 preview 不可寫入真實 state");assert.deepEqual(calls,{persist:0,render:0,renderDay:0,toasts:[]},"preview 不可保存、重繪或提示");
 const parts={"start-all":"時長|前後行程時間|","start-up":"結束時間|本時長|前方行程時間","end-all":"時長|前後行程時間|","end-down":"開始時間|本時長|後方行程時間","duration-up":"結束時間|開始時間|之前行程的時間","duration-down":"開始時間|結束時間|之後行程的時間"};for(const [key,expected] of Object.entries(parts))assert.equal([...api.timeOptionParts(key)].join("|"),expected,key+" 三段句中對應必須正確");
 assert.deepEqual(JSON.parse(JSON.stringify(api.timeOptionParts(startOptions.find(option=>option.key==="start-absorb-duration"&&option.direction==="後方")))),["時長","結束時間","後方：「後」"],"開始時間的時長不變候選滾輪只顯示後方指定行程");assert.deepEqual(JSON.parse(JSON.stringify(api.timeOptionParts(startOptions.find(option=>option.key==="start-absorb-end")))),["結束時間","本時長","前方：「前」"],"開始時間的結束時間不變候選只能顯示前方指定行程");
 const durationDynamic=api.timeOptions(row,1,"duration"),frontDuration=durationDynamic.find(option=>option.key==="duration-absorb-end"),backDuration=durationDynamic.find(option=>option.key==="duration-absorb-start"),frontTrial=api.previewTimeOption(row,1,"duration",90,frontDuration),backTrial=api.previewTimeOption(row,1,"duration",90,backDuration);assert.deepEqual(JSON.parse(JSON.stringify(api.timeOptionParts(frontDuration))),["結束時間","開始時間","前方：「前」"],"總時長的結束時間不變候選只列前方指定行程");assert.deepEqual(JSON.parse(JSON.stringify(api.timeOptionParts(backDuration))),["開始時間","結束時間","後方：「後」"],"總時長的開始時間不變候選只列後方指定行程");assert.deepEqual(JSON.parse(JSON.stringify(frontTrial.trial.days["2026-10-09"])).map(item=>[item.id,item.start,item.end,item.duration]),[["P","07:00","07:30",30],["A","07:30","09:00",90],["N","09:00","10:00",60]],"總時長的前方吸收必須保留本列結束時間並由前方完整吸收");assert.deepEqual(JSON.parse(JSON.stringify(backTrial.trial.days["2026-10-09"])).map(item=>[item.id,item.start,item.end,item.duration]),[["P","07:00","08:00",60],["A","08:00","09:30",90],["N","09:30","10:00",30]],"總時長的後方吸收必須保留本列開始時間並由後方完整吸收");
 const firstDuration=makeRuntime([{id:"B",content:"HOSTEL 早餐",start:"08:30",end:"09:30",duration:60,lock:"none",pending:false},{id:"C",content:"後方",start:"09:30",end:"10:30",duration:60,lock:"none",pending:false}]),firstOption=firstDuration.api.timeOptions(firstDuration.api.state().days["2026-10-09"][0],0,"duration").find(option=>option.key==="duration-up");assert.deepEqual(JSON.parse(JSON.stringify(firstDuration.api.timeOptionParts(firstOption))),["結束時間","開始時間",""] ,"第一筆正式行程的向上更新提示不得提及不存在的之前行程");
 const lastDuration=makeRuntime([{id:"B",content:"前方",start:"08:30",end:"09:30",duration:60,lock:"none",pending:false},{id:"C",content:"最後一筆",start:"09:30",end:"10:30",duration:60,lock:"none",pending:false}]),lastOption=lastDuration.api.timeOptions(lastDuration.api.state().days["2026-10-09"][1],1,"duration").find(option=>option.key==="duration-down");assert.deepEqual(JSON.parse(JSON.stringify(lastDuration.api.timeOptionParts(lastOption))),["開始時間","結束時間",""] ,"最後一筆正式行程的向下更新提示不得提及不存在的之後行程");
}

// 1b. 正式時間鏈可只改本列時長；中間列僅在輸入能完整接回前後時才保留候選。
{
 const screenshotRows=[
  {id:"traffic",content:"交通",start:"12:30",end:"12:30",duration:0,lock:"none",pending:false},
  {id:"lunch",content:"午餐",start:"12:30",end:"12:50",duration:20,lock:"end",pending:false},
  {id:"museum",content:"美術館",start:"12:50",end:"14:50",duration:120,lock:"none",pending:false},
  {id:"coffee",content:"咖啡廳",start:"14:50",end:"16:00",duration:70,lock:"end",pending:false}
 ],runtime=makeRuntime(screenshotRows),traffic=runtime.api.state().days["2026-10-09"][0],options=runtime.api.timeOptions(traffic,0,"start"),previews=options.map(option=>runtime.api.previewTimeOption(traffic,0,"start","12:20",option)),valid=previews.filter(item=>!item.conflict);
 const self=valid.find(item=>item.option.key==="start-self-end"),lunch=valid.find(item=>item.option.key==="start-absorb-duration"&&item.option.targetId==="lunch");
 assert.deepEqual(JSON.parse(JSON.stringify(runtime.api.timeOptionParts(self.option))),["結束時間","本時長",""],"首筆改開始時間時，本列時長候選必須以結束時間不變呈現");
 assert.ok(self&&lunch,"交通改為 12:20 時必須同時保留更新交通與更新午餐時長兩個可行候選");
 assert.deepEqual(JSON.parse(JSON.stringify(self.trial.days["2026-10-09"])).map(row=>[row.id,row.start,row.end,row.duration]),[["traffic","12:20","12:30",10],["lunch","12:30","12:50",20],["museum","12:50","14:50",120],["coffee","14:50","16:00",70]],"保留交通結束時間時只能更新交通時長，不得改動其他行程");
 assert.deepEqual(JSON.parse(JSON.stringify(lunch.trial.days["2026-10-09"])).map(row=>[row.id,row.start,row.end,row.duration]),[["traffic","12:20","12:20",0],["lunch","12:20","12:50",30],["museum","12:50","14:50",120],["coffee","14:50","16:00",70]],"指定午餐吸收時必須保留交通時長並只更新午餐時長");
 runtime.api.handleTimeEdit("traffic","start","12:20");
 assert.equal(runtime.nodes.appDialog.open,true,"兩個可行結果不同時必須開啟選項燈箱，不得自動改午餐時長");
 assert.deepEqual(JSON.parse(JSON.stringify(runtime.api.state().days["2026-10-09"])),JSON.parse(JSON.stringify(screenshotRows)),"開啟燈箱前不得寫入任何時間或時長");

 const startBoundary=makeRuntime([{id:"pending-before",start:"",end:"",duration:60,lock:"none",pending:true},{id:"first",start:"08:00",end:"09:00",duration:60,lock:"none",pending:false},{id:"last",start:"09:00",end:"10:00",duration:60,lock:"none",pending:false}]);
 const first=startBoundary.api.state().days["2026-10-09"][1],firstOptions=startBoundary.api.timeOptions(first,1,"start");
 assert.ok(firstOptions.some(option=>option.key==="start-self-end"),"前方待放置列不得阻止正式首筆取得本列時長候選");
 const firstSelf=firstOptions.find(option=>option.key==="start-self-end"),firstTrial=startBoundary.api.previewTimeOption(first,1,"start","07:50",firstSelf);
 assert.equal(firstTrial.conflict,null,"正式首筆的本列時長候選必須通過完整副本試算");
 assert.deepEqual(JSON.parse(JSON.stringify(firstTrial.trial.days["2026-10-09"])).map(row=>[row.id,row.start,row.end,row.duration]),[["pending-before","","",60],["first","07:50","09:00",70],["last","09:00","10:00",60]],"首筆本列候選不得改動待放置或後方正式行程");

 const endBoundary=makeRuntime([{id:"first",start:"08:00",end:"09:00",duration:60,lock:"none",pending:false},{id:"last",start:"09:00",end:"10:00",duration:60,lock:"none",pending:false},{id:"pending-after",start:"",end:"",duration:60,lock:"none",pending:true}]);
 const last=endBoundary.api.state().days["2026-10-09"][1],lastOptions=endBoundary.api.timeOptions(last,1,"end"),lastSelf=lastOptions.find(option=>option.key==="end-self-start"),lastTrial=endBoundary.api.previewTimeOption(last,1,"end","10:20",lastSelf);
 assert.ok(lastSelf,"後方待放置列不得阻止正式末筆取得本列時長候選");
 assert.deepEqual(JSON.parse(JSON.stringify(endBoundary.api.timeOptionParts(lastSelf))),["開始時間","本時長",""],"末筆改結束時間時，本列時長候選必須以開始時間不變呈現");
 assert.equal(lastTrial.conflict,null,"正式末筆的本列時長候選必須通過完整副本試算");
 assert.deepEqual(JSON.parse(JSON.stringify(lastTrial.trial.days["2026-10-09"])).map(row=>[row.id,row.start,row.end,row.duration]),[["first","08:00","09:00",60],["last","09:00","10:20",80],["pending-after","","",60]],"末筆本列候選不得改動前方正式或待放置行程");

 const middle=makeRuntime([{id:"before",start:"08:00",end:"09:00",duration:60,lock:"none",pending:false},{id:"middle",start:"09:00",end:"10:00",duration:60,lock:"none",pending:false},{id:"after",start:"10:00",end:"11:00",duration:60,lock:"none",pending:false}]);
 const middleRow=middle.api.state().days["2026-10-09"][1];
 const middleStart=middle.api.timeOptions(middleRow,1,"start").find(option=>option.key==="start-self-end"),middleEnd=middle.api.timeOptions(middleRow,1,"end").find(option=>option.key==="end-self-start");
 assert.ok(middleStart&&middleEnd,"中間列必須建立本列時長修復候選供副本試算");
 assert.equal(middle.api.previewTimeOption(middleRow,1,"start","09:00",middleStart).conflict,null,"中間列開始時間接回前方時，本列時長候選必須可試算");
 assert.equal(middle.api.previewTimeOption(middleRow,1,"end","10:00",middleEnd).conflict,null,"中間列結束時間接回後方時，本列時長候選必須可試算");
 const repair=makeRuntime([{id:"traffic",content:"旅館 → 北海道大學",start:"09:00",end:"10:05",duration:65,lock:"none",pending:false},{id:"university",content:"北海道大學",start:"10:30",end:"12:30",duration:120,lock:"none",pending:false},{id:"next",content:"下一站",start:"12:30",end:"13:30",duration:60,lock:"none",pending:false}]),repairRow=repair.api.state().days["2026-10-09"][1],repairSelf=repair.api.timeOptions(repairRow,1,"start").find(option=>option.key==="start-self-end"),repairTrial=repair.api.previewTimeOption(repairRow,1,"start","10:05",repairSelf);
 assert.deepEqual(JSON.parse(JSON.stringify(repairTrial.trial.days["2026-10-09"])).map(row=>[row.id,row.start,row.end,row.duration]),[["traffic","09:00","10:05",65],["university","10:05","12:30",145],["next","12:30","13:30",60]],"中間列開始時間接回前方時，結束時間不變的本列方案只可更新自身時長");
 const residual=repair.api.timeOptions(repairRow,1,"start").find(option=>option.key==="start-absorb-duration"&&option.targetId==="traffic"),residualTrial=repair.api.previewTimeOption(repairRow,1,"start","10:05",residual);
 assert.equal(residualTrial.conflict,null,"候選本身不碰鎖定時仍可完成副本試算");
 assert.equal(residualTrial.trial.days["2026-10-09"][1].end,residualTrial.trial.days["2026-10-09"][2].start,"前方指定行程吸收後必須順延下游時間鏈，不得留下空檔");
 repair.api.handleTimeEdit("university","start","10:05");
 assert.equal(repair.nodes.appDialog.open,true,"仍有多個完整方案時必須開啟選項燈箱");
 const durationLocked=makeRuntime([{id:"only",start:"08:00",end:"09:00",duration:60,lock:"duration",pending:false}]),only=durationLocked.api.state().days["2026-10-09"][0];
 assert.equal(durationLocked.api.timeOptions(only,0,"start").some(option=>option.key==="start-self-end"),false,"本列總時長鎖定時不得提供開始時間的本列時長候選");
 assert.equal(durationLocked.api.timeOptions(only,0,"end").some(option=>option.key==="end-self-start"),false,"本列總時長鎖定時不得提供結束時間的本列時長候選");
}

// 1a. 修改結束時間時，候選改由能完整吸收差額的正式行程動態產生。
{
 const example=[
  {id:"B",content:"HOSTEL 早餐",start:"08:50",end:"09:50",duration:60,lock:"none",pending:false},
  {id:"C",content:"旅館 Check-out\n時間 11:00",start:"09:50",end:"10:50",duration:60,lock:"none",pending:false},
  {id:"T",content:"旅館 → 新千歲機場",start:"10:50",end:"12:20",duration:90,lock:"duration",pending:false},
  {id:"I",content:"辦理登機通關、退稅",start:"12:20",end:"14:20",duration:120,lock:"none",pending:false},
  {id:"S",content:"機場輕食",start:"14:20",end:"15:20",duration:60,lock:"none",pending:false},
  {id:"F",content:"Flight",start:"15:20",end:"18:55",duration:215,lock:"start",pending:false}
 ],runtime=makeRuntime(example),row=runtime.api.state().days["2026-10-09"][0],options=runtime.api.timeOptions(row,0,"end"),previews=options.map(option=>runtime.api.previewTimeOption(row,0,"end","09:20",option)),valid=previews.filter(item=>!item.conflict);
 assert.deepEqual([...options.filter(option=>option.key==="end-absorb-duration").map(option=>runtime.api.timeOptionParts(option)[2])],["後方：「旅館 Check-out」","後方：「辦理登機通關、退稅」","後方：「機場輕食」","後方：「Flight」"],"總時長已鎖定列不得進入原始候選；其餘正式行程需標示方向");
 assert.deepEqual([...valid.filter(item=>item.option.key==="end-absorb-duration").map(item=>item.option.targetId)],["C","I","S"],"只列出能完整吸收 30 分鐘且不碰開始／結束鎖定的後方候選");
 assert.deepEqual([...valid.filter(item=>item.option.key==="end-absorb-start").map(item=>item.option.targetId)],["C","I","S"],"開始時間不變時同樣列出可完整吸收的後方候選");
 assert.equal(runtime.api.timeOptionParts(options.find(option=>option.targetId==="C"))[2],"後方：「旅館 Check-out」","燈箱候選名稱只能取行程內容第一行");
 const selected=valid.find(item=>item.option.key==="end-absorb-duration"&&item.option.targetId==="I");
 assert.deepEqual(JSON.parse(JSON.stringify(selected.trial.days["2026-10-09"])).map(item=>[item.id,item.start,item.end,item.duration]),[["B","08:20","09:20",60],["C","09:20","10:20",60],["T","10:20","11:50",90],["I","11:50","14:20",150],["S","14:20","15:20",60],["F","15:20","18:55",215]],"選中後方行程時，中間列只平移、指定列完整吸收、其後行程回到原時間");
 const selectedSummary=runtime.api.timeOptionPreviewSummary(runtime.api.state(),selected.trial,row.id,selected.option);assert.deepEqual(JSON.parse(JSON.stringify(selectedSummary.entries)),[{name:"HOSTEL 早餐",details:"：開始時間 08:50→08:20"},{name:"辦理登機通關、退稅",details:"：總時長 2時→2時30分"}],"指定吸收行程時，預覽只能依序顯示滾輪指定的本列時間與吸收列時長");assert.equal(selectedSummary.hasAutoLinked,true,"未列出的中間連動行程仍須顯示自動連動摘要");
 assert.equal(options.some(option=>option.key==="end-all"),true,"開始／結束鎖定存在時仍須建立全鏈候選，再由副本試算淘汰");
 runtime.api.openTimeOptionWheel(row,0,"end","09:20",options,previews);const content=runtime.nodes.dialogContent.children[0],preview=content.children.at(-1);assert.equal(runtime.nodes.dialogTitle.textContent,"「HOSTEL 早餐」的「結束時間」已從09:50修改為09:20","時間修改燈箱標題必須包含修改前後值");assert.equal(content.children[0].textContent,"請選擇一項您希望的調整方式來完成安排。","時間修改燈箱必須在滾輪前顯示說明");assert.equal(preview.hidden,false,"指定行程吸收方式必須顯示結果預覽");

const front=makeRuntime([{id:"P",content:"前方",start:"07:00",end:"08:00",duration:60,lock:"none",pending:false},{id:"B",content:"本列",start:"08:00",end:"09:00",duration:60,lock:"none",pending:false},{id:"N",content:"後方",start:"09:00",end:"10:00",duration:60,lock:"none",pending:false}]),frontRow=front.api.state().days["2026-10-09"][1],frontOption=front.api.timeOptions(frontRow,1,"end").find(option=>option.key==="end-absorb-duration"&&option.targetId==="P"),frontPreview=front.api.previewTimeOption(frontRow,1,"end","08:30",frontOption);assert.equal(front.api.timeOptionParts(frontOption)[2],"前方：「前方」","前方吸收候選滾輪必須只標示方向與行程名稱");assert.equal(frontPreview.conflict,null,"前方列可完整吸收時必須保留候選");assert.deepEqual(JSON.parse(JSON.stringify(frontPreview.trial.days["2026-10-09"])).map(item=>[item.id,item.start,item.end,item.duration]),[["P","07:00","07:30",30],["B","07:30","08:30",60],["N","08:30","09:30",60]],"前方指定列吸收後，前後時間鏈都必須重排且保持串接");

 const unlocked=makeRuntime(example.map(item=>item.id==="F"?{...item,lock:"none"}:item)),unlockedRow=unlocked.api.state().days["2026-10-09"][0],unlockedOptions=unlocked.api.timeOptions(unlockedRow,0,"end"),unlockedPreviews=unlockedOptions.map(option=>unlocked.api.previewTimeOption(unlockedRow,0,"end","09:20",option));unlocked.api.openTimeOptionWheel(unlockedRow,0,"end","09:20",unlockedOptions,unlockedPreviews);const wheelContent=unlocked.nodes.dialogContent.children[0],first=wheelContent.children[1].firstChild;first.children.find(button=>button.tagName==="button"&&button.textContent==="時長").fire("click");const second=wheelContent.children[3].firstChild;second.children.find(button=>button.tagName==="button"&&button.textContent==="前後行程時間").fire("click");assert.equal(wheelContent.children.at(-1).hidden,true,"全鏈平移選項不可顯示結果預覽");
}

// 2. Candidate dialogs require confirmation; zero-valid keeps primary hidden/unfocusable and keep/restore are real paths.
{
 const single=makeRuntime(rows().map(row=>row.id==="A"?{...row,lock:"end"}:row)),singleBefore=structuredClone(single.api.state().days["2026-10-09"]);single.api.handleTimeEdit("A","start","08:10");assert.equal(single.nodes.appDialog.open,true,"有可行方式時必須開啟確認燈箱");assert.deepEqual(single.nodes.dialogActions.children.map(action=>action.textContent),["套用變更","保留衝突","復原"],"多個完整候選必須提供套用、保留衝突與復原");assert.deepEqual(JSON.parse(JSON.stringify(single.api.state().days["2026-10-09"])),JSON.parse(JSON.stringify(singleBefore)),"確認前不得自動套用候選");single.nodes.dialogActions.children[0].fire("click");assert.equal(single.api.state().days["2026-10-09"][1].start,"08:10","按套用變更才套用候選");assert.equal(single.calls.persist,1,"確認套用必須保存一次");
 const singleRestore=makeRuntime(rows().map(row=>row.id==="A"?{...row,lock:"end"}:row)),restoreBefore=structuredClone(singleRestore.api.state().days["2026-10-09"]);singleRestore.api.handleTimeEdit("A","start","08:10");singleRestore.nodes.dialogActions.children[2].fire("click");assert.deepEqual(JSON.parse(JSON.stringify(singleRestore.api.state().days["2026-10-09"])),JSON.parse(JSON.stringify(restoreBefore)),"唯一候選按復原不得寫入資料");
 const singleKeep=makeRuntime(rows().map(row=>row.id==="A"?{...row,lock:"end"}:row));singleKeep.api.handleTimeEdit("A","start","08:10");singleKeep.nodes.dialogActions.children[1].fire("click");assert.equal(singleKeep.api.state().days["2026-10-09"][1].start,"08:10","唯一候選按保留衝突只保留直接輸入值");assert.equal(singleKeep.api.state().conflicts.length,1,"唯一候選保留衝突必須記錄阻擋資訊");
 const none=makeRuntime(rows().map(row=>row.id==="P"?{...row,lock:"end"}:row.id==="N"?{...row,lock:"start"}:row));none.api.handleTimeEdit("A","start","08:10");const primary=none.nodes.dialogActions.children[0];assert.equal(primary.disabled,true,"無解套用按鈕必須停用");assert.equal(primary.tabIndex,-1,"無解套用按鈕不可聚焦");assert.match(none.nodes.dialogActions.children[1].className,/\bdanger\b/,"無解燈箱的保留衝突必須使用 danger 樣式");const original=structuredClone(none.api.state().days["2026-10-09"]);none.nodes.dialogActions.children[2].fire("click");assert.equal(JSON.stringify(none.api.state().days["2026-10-09"]),JSON.stringify(original),"復原不可寫入原始資料");none.nodes.dialogActions.children[1].fire("click");assert.equal(none.api.state().days["2026-10-09"][1].start,"08:10","保留衝突只保留直接值");assert.equal(none.api.state().conflicts.length,1,"保留衝突必須保存阻擋資訊");
}

// 2a. A duration that already matches a locked-end/locked-start formal chain is a
// direct correction: it updates only duration, refreshes actual conflicts, and skips
// the option dialog. Pending rows are skipped and long cross-midnight durations stay legal.
{
 const initial=[{id:"A",content:"前",start:"06:00",end:"07:00",duration:60,lock:"end",pending:false},{id:"B",content:"本",start:"07:00",end:"09:30",duration:150,lock:"none",pending:false},{id:"C",content:"後",start:"09:30",end:"14:05",duration:275,lock:"start",pending:false},{id:"X",content:"無關",start:"15:00",end:"16:00",duration:60,lock:"start",pending:false}],runtime=makeRuntime(initial);
 runtime.api.state().conflicts=[{date:"2026-10-09",lockedRowId:"X",lockedField:"start",requiredValue:"14:05"}];runtime.api.handleTimeEdit("B","duration",140);runtime.nodes.dialogActions.children[1].fire("click");runtime.nodes.appDialog.close();
 assert.equal(runtime.api.state().conflicts.some(item=>item.directRowId==="B"&&item.directField==="duration"&&item.directContext?.chainRowIds?.join(",")==="A,B,C"),true,"140 分鐘必須經真實 handler 的保留衝突路徑保存本列與兩側正式鏈");assert.equal(runtime.api.hasUnresolvedConflicts(),true,"真實保留衝突存在時，三個匯出入口共用的阻擋判定必須為真");
 runtime.api.handleTimeEdit("B","duration",150);
 const changed=runtime.api.state().days["2026-10-09"];
 assert.deepEqual(JSON.parse(JSON.stringify(changed)).map(row=>[row.id,row.start,row.end,row.duration,row.lock]),[["A","06:00","07:00",60,"end"],["B","07:00","09:30",150,"none"],["C","09:30","14:05",275,"start"],["X","15:00","16:00",60,"start"]],"符合完整鎖定串接時只能更新本列時長，不得改時間或鎖定");
 assert.equal(runtime.api.state().conflicts.some(item=>item.lockedRowId==="X"&&item.lockedField==="start"),true,"成功後必須保留無關的 X 開始時間鎖定衝突");assert.equal(runtime.api.state().conflicts.some(item=>item.kind==="adjacency"),true,"X 尚未串接前，必須另保留獨立的相鄰時間鏈斷點");
 assert.equal(runtime.api.hasUnresolvedConflicts(),true,"無關未解衝突仍存在時，三個匯出入口的共用阻擋判定必須維持");const unrelated=runtime.api.state().days["2026-10-09"].find(row=>row.id==="X");unrelated.lock="none";unrelated.start="14:05";unrelated.end="15:05";assert.equal(runtime.api.hasUnresolvedConflicts(),false,"本次直接衝突修復且無關鎖定與相鄰斷點另行解開後，三個匯出入口的共用阻擋判定必須解除");
 assert.notEqual(runtime.nodes.appDialog.open,true,"符合條件不得開啟選項燈箱");assert.deepEqual(runtime.calls.toasts,[],"直接修正不得改走選項提示");
 const pending=makeRuntime([initial[0],{id:"Q",content:"待放置",start:"",end:"",duration:60,lock:"none",pending:true},initial[1],initial[2]]);pending.api.handleTimeEdit("B","duration",150);assert.equal(pending.api.state().days["2026-10-09"][2].duration,150,"待放置列不可中斷最近正式前後列判斷");assert.notEqual(pending.nodes.appDialog.open,true,"跳過待放置列後符合條件仍不得開燈箱");
 const pendingEntry=makeRuntime([initial[0],{...initial[1],pending:true},initial[2]]);pendingEntry.api.handleTimeEdit("B","duration",150);assert.equal(pendingEntry.nodes.appDialog.open,true,"待放置本列不得進入正式行程的直接時長修正入口");
 const midnight=makeRuntime([{id:"A",start:"22:00",end:"23:00",duration:60,lock:"end",pending:false},{id:"B",start:"23:00",end:"00:00",duration:60,lock:"none",pending:false},{id:"C",start:"00:00",end:"01:00",duration:60,lock:"start",pending:false}]);midnight.api.handleTimeEdit("B","duration",1500);assert.equal(midnight.api.state().days["2026-10-09"][1].duration,60,"直接輸入超過 1,440 分鐘必須保留原有效值");assert.equal(midnight.calls.toasts.at(-1),"單一行程最長為 1440 分鐘","直接輸入超上限時必須提示單一行程上限");assert.notEqual(midnight.nodes.appDialog.open,true,"超上限輸入不得開啟時間連動燈箱");
 const unmatched=makeRuntime(initial.slice(0,3));unmatched.api.handleTimeEdit("B","duration",140);assert.equal(unmatched.nodes.appDialog.open,true,"輸入時長 140 不符合既有起訖時必須維持原本選項流程");const unmatchedHigher=makeRuntime(initial.slice(0,3));unmatchedHigher.api.handleTimeEdit("B","duration",160);assert.equal(unmatchedHigher.nodes.appDialog.open,true,"輸入時長 160 不符合既有起訖時必須維持原本選項流程");
 const unlocked=makeRuntime(initial.slice(0,3).map(row=>row.id==="A"?{...row,lock:"none"}:row));unlocked.api.handleTimeEdit("B","duration",150);assert.equal(unlocked.nodes.appDialog.open,true,"非兩側指定鎖定情境不得套用直接修正例外");
 const durationLocked=makeRuntime(initial.slice(0,3).map(row=>row.id==="B"?{...row,lock:"duration"}:row));durationLocked.api.handleTimeEdit("B","duration",140);assert.equal(durationLocked.api.state().days["2026-10-09"][1].duration,150,"本列總時長已鎖定時不得直接寫入");assert.equal(durationLocked.nodes.appDialog.open,undefined,"本列總時長已鎖定時不得開選項燈箱");
 const previousPending=makeRuntime(initial.slice(0,3).map(row=>row.id==="A"?{...row,pending:true}:row));previousPending.api.handleTimeEdit("B","duration",150);assert.equal(previousPending.nodes.appDialog.open,true,"前側最近列為待放置時不得套用兩側正式鎖定直接修正");const nextPending=makeRuntime(initial.slice(0,3).map(row=>row.id==="C"?{...row,pending:true}:row));nextPending.api.handleTimeEdit("B","duration",150);assert.equal(nextPending.nodes.appDialog.open,true,"後側最近列為待放置時不得套用兩側正式鎖定直接修正");
}

// 3. No-valid copy combines only actual blockers, de-duplicates locked row/field pairs, and creates no result preview nodes.
{
 const initial=[{id:"A",content:"A",start:"07:00",end:"08:00",duration:60,lock:"end",pending:false},{id:"C",content:"C",start:"08:00",end:"09:00",duration:60,lock:"start",pending:false}],runtime=makeRuntime(initial),lockedEnd={lockedRowId:"A",lockedField:"end"},lockedStart={lockedRowId:"C",lockedField:"start"},short={lockedRowId:"C",lockedField:"duration",insufficientDuration:true};
 assert.equal(runtime.api.noTimeOptionMessage([{conflict:lockedEnd},{conflict:lockedStart},{conflict:lockedEnd},{conflict:lockedStart}]),"由於「A」行程的「結束時間」及「C」行程的「開始時間」已鎖定，目前沒有可套用的調整方式。","四個 blocked 預覽必須按實際鎖定列欄位去重");
 assert.equal(runtime.api.noTimeOptionMessage([{conflict:lockedEnd}]),"由於「A」行程的「結束時間」已鎖定，目前沒有可套用的調整方式。","單一鎖定必須維持單一原因");
 assert.equal(runtime.api.noTimeOptionMessage([{conflict:short}]),"由於「C」行程的時長不足，目前沒有可套用的調整方式。","負吸收不可誤稱鎖定");
 assert.equal(runtime.api.noTimeOptionMessage([{conflict:lockedEnd},{conflict:short}]),"由於「A」行程的「結束時間」已鎖定，且「C」行程的時長不足，目前沒有可套用的調整方式。","混合阻擋必須分別說明鎖定與時長不足");
 runtime.api.openTimeOptionWheel(initial[0],0,"start","07:10",[],[{option:{key:"one"},conflict:lockedEnd},{option:{key:"two"},conflict:lockedStart},{option:{key:"three"},conflict:lockedEnd},{option:{key:"four"},conflict:lockedStart}]);
 const copy=runtime.nodes.dialogContent.children[0];assert.equal(copy.textContent,"由於「A」行程的「結束時間」及「C」行程的「開始時間」已鎖定，目前沒有可套用的調整方式。","無解燈箱只能顯示合併原因");
 const lockedParts=copy.children.filter(node=>node.className==="time-option-lock");assert.deepEqual(lockedParts.map(node=>node.textContent),["「A」行程的「結束時間」","「C」行程的「開始時間」"],"只有實際鎖定的行程名稱與欄位必須拆成強調節點");assert.equal(copy.children.some(node=>node.className==="time-option-preview"),false,"無解燈箱不可建立結果預覽節點");
}

// 4. 只保留完整時間鏈的候選後，單值句中欄位以靜態文字呈現；多值滾輪行為另由上方候選與觸控板測試覆蓋。

// 4a. 排除本列時長候選後，既有多段滾輪仍須支援卸載與重新掛載。
{
 const runtime=makeRuntime(),options=runtime.api.timeOptions(runtime.api.state().days["2026-10-09"][1],1,"start").filter(option=>option.key!=="start-self-end"),previews=options.map(option=>runtime.api.previewTimeOption(runtime.api.state().days["2026-10-09"][1],1,"start","08:10",option));runtime.api.openTimeOptionWheel(runtime.api.state().days["2026-10-09"][1],1,"start","08:10",options,previews);
 const content=runtime.nodes.dialogContent.children[0],first=content.children[1].firstChild,second=content.children[3].firstChild,selectedText=wheel=>all(wheel,node=>node.className?.split(/\s+/).includes("selected"))[0].textContent;assert.equal(content.children[0].textContent+selectedText(first)+content.children[2].textContent+selectedText(second)+content.children[5].textContent,"請選擇一項您希望的調整方式來完成安排。時長不變，更新前後行程時間。","兩段式句中滾輪必須以獨立說明後接調整句型，且不插入額外空白");assert.ok(first&&second,"前兩段多值時必須有真實輪盤");first.fire("wheel",{deltaY:34,timeStamp:0,preventDefault(){}});assert.equal(content.children[3].children.length,0,"前段切換為唯一後段時，後段輪盤必須卸載");assert.equal(second.parentNode,null,"卸載輪盤不得仍被視為 live node");first.fire("wheel",{deltaY:-34,timeStamp:100,preventDefault(){}});
 const liveSecond=content.children[3].firstChild;assert.equal(liveSecond,second,"唯一→多值後必須重掛同一 cached wheel");assert.equal(liveSecond.parentNode,content.children[3],"重新掛載後 wheel 必須 live");liveSecond.fire("pointerdown",{pointerId:7,clientY:100});liveSecond.fire("pointermove",{pointerId:7,clientY:80});liveSecond.fire("pointermove",{pointerId:7,clientY:60});assert.equal(liveSecond.capture,7,"跨門檻才捕捉，連續 move 必須用 live node");liveSecond.fire("pointercancel",{pointerId:7});assert.equal(liveSecond._pointerId,null,"pointercancel 必須清除拖曳狀態");
 all(liveSecond,node=>node.tagName==="button")[0].fire("click");runtime.nodes.appDialog._flushFrames();const keyboardWheel=content.children[3].firstChild;assert.equal(keyboardWheel.scrollTop,0,"掛載後 RAF 必須可在 live wheel 置中");keyboardWheel.fire("keydown",{key:"ArrowDown",preventDefault(){}});assert.equal(runtime.document.activeElement,content.children[3].firstChild,"鍵盤切換後焦點必須留在 live wheel");keyboardWheel.fire("keydown",{key:"End",preventDefault(){}});assert.equal(keyboardWheel.scrollTop,34,"End 必須跳到最後候選並置中");keyboardWheel.fire("keydown",{key:"Home",preventDefault(){}});assert.equal(keyboardWheel.scrollTop,0,"Home 必須跳到第一候選並置中");
}

// 4aa. 前段選項使後段變成唯一值時，套用只確認仍掛載的輪盤。
{
 const runtime=makeRuntime(),row=runtime.api.state().days["2026-10-09"][1],options=runtime.api.timeOptions(row,1,"start").filter(option=>option.key!=="start-self-end"&&option.key!=="start-up"),previews=options.map(option=>runtime.api.previewTimeOption(row,1,"start","08:10",option));runtime.api.openTimeOptionWheel(row,1,"start","08:10",options,previews);
 const content=runtime.nodes.dialogContent.children[0],first=content.children[1].firstChild,second=content.children[3].firstChild;first.fire("wheel",{deltaY:34,deltaMode:1,preventDefault(){}});assert.equal(second.parentNode,null,"前段切換造成唯一後段時，舊後段輪盤必須卸載");runtime.nodes.dialogActions.children[0].fire("click");const rows=runtime.api.state().days["2026-10-09"];assert.deepEqual(rows.map(item=>[item.id,item.start,item.end,item.duration]),[["P","07:00","08:10",70],["A","08:10","09:00",50],["N","09:00","10:00",60]],"套用時不得讓卸載後段輪盤覆蓋目前的指定時長候選");
}


// 4b. 觸控板細小位移在 16ms 內累積，停止後才確認最近候選；套用仍不能被卸載輪盤覆蓋。
{
 const timers=new Map();let timerId=0;const runtime=makeRuntime(rows(),{setTimeout:fn=>{const id=++timerId;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id)}),row=runtime.api.state().days["2026-10-09"][1],options=runtime.api.timeOptions(row,1,"start"),previews=options.map(option=>runtime.api.previewTimeOption(row,1,"start","08:10",option));runtime.api.openTimeOptionWheel(row,1,"start","08:10",options,previews);
 const first=runtime.nodes.dialogContent.children[0].children[1].firstChild;[10,10,10,10].forEach(deltaY=>first.fire("wheel",{deltaY,deltaMode:0,nativeScrollEnd:false,preventDefault(){}}));assert.equal(timers.size,1,"連續觸控板位移必須只保留最後一次 16ms 預覽計時");assert.equal(first.scrollTop,40,"原生滾動在停止前必須保留實際累積位移");[...timers.values()][0]();first.fire("scrollend");assert.equal(first.scrollTop,34,"scrollend 必須將最後候選對齊中央");runtime.nodes.dialogActions.children[0].fire("click");const rowsAfterApply=runtime.api.state().days["2026-10-09"];assert.deepEqual(rowsAfterApply.map(item=>[item.id,item.start,item.end,item.duration]),[["P","07:00","08:00",60],["A","08:10","09:00",50],["N","09:00","10:00",60]],"套用本列時長方案時不得由已卸載後段輪盤覆蓋目前選擇");
}

// 4. A third wheel that does not exist initially must receive the same keyboard support
// after a preceding choice creates it. Option events bubble, and click focus must land on
// the rebuilt live wheel rather than the detached option button.
{
 const runtime=makeRuntime(),options=runtime.api.timeOptions(runtime.api.state().days["2026-10-09"][1],1,"start"),previews=options.map(option=>runtime.api.previewTimeOption(runtime.api.state().days["2026-10-09"][1],1,"start","08:10",option));runtime.api.openTimeOptionWheel(runtime.api.state().days["2026-10-09"][1],1,"start","08:10",options,previews);
 const content=runtime.nodes.dialogContent.children[0],first=content.children[1].firstChild,thirdWrap=content.children[4],second=content.children[3].firstChild;assert.equal(thirdWrap.hidden,true,"start-all 初始不得先建立第三段輪盤");const secondChoice=all(second,node=>node.tagName==="button")[1];secondChoice.fire("click");const third=thirdWrap.children[1].firstChild,selectedText=wheel=>all(wheel,node=>node.className?.split(/\s+/).includes("selected"))[0].textContent;assert.ok(third&&third.classList.contains("time-option-wheel"),"切換第二段後必須建立第三段輪盤");assert.equal(content.children[0].textContent+selectedText(first)+content.children[2].textContent+selectedText(second)+thirdWrap.children[0].textContent+selectedText(third)+thirdWrap.children[2].textContent+content.children[5].textContent,"請選擇一項您希望的調整方式來完成安排。時長不變，更新結束時間及前方：「前」的時長。","三段式句中滾輪必須將的時長固定在候選外");
 const thirdOption=all(third,node=>node.tagName==="button")[0];thirdOption.fire("keydown",{key:"End",preventDefault(){}});assert.equal(third.scrollTop,34,"第三段子選項的 End 冒泡後必須置中最後候選");third.fire("keydown",{key:"Home",preventDefault(){}});assert.equal(third.scrollTop,0,"延後建立的第三段 Home 必須置中第一候選");
 const oldOption=all(third,node=>node.tagName==="button")[1];oldOption.focus();assert.equal(runtime.document.activeElement,oldOption,"測試前必須確實由舊子選項持有焦點");oldOption.fire("click");const liveThird=thirdWrap.children[1].firstChild;assert.equal(runtime.document.activeElement,liveThird,"點選子候選後焦點必須回到仍掛載的第三段輪盤");assert.notEqual(runtime.document.activeElement,oldOption,"點選後不可保留 detached option 的焦點");
}

// 4. Summary uses only nearest formal rows, skips pending, merges remote directions, and clears the absent third part.
{
 const list=[{id:"F",content:"遠前",start:"06:00",end:"07:00",duration:60,lock:"none",pending:false},...rows(),{id:"Q",content:"待放置",start:"",end:"",duration:60,lock:"none",pending:true},{id:"Z",content:"遠後",start:"10:00",end:"11:00",duration:60,lock:"none",pending:false}];list.find(row=>row.id==="A").content="這是一個超過八字的行程名稱";const runtime=makeRuntime(list),before=structuredClone(runtime.api.state()),trial=structuredClone(before);trial.days[trial.activeDate][0].end="06:30";trial.days[trial.activeDate][2].start="08:10";trial.days[trial.activeDate][5].start="10:10";const summary=runtime.api.timeOptionPreviewSummary(before,trial,"A",{key:"end-absorb-duration",targetId:"Z"});assert.ok(summary.lines.some(line=>line.includes("這是一個超過八字的行程名稱：開始時間 08:00→08:10")));assert.deepEqual(JSON.parse(JSON.stringify(summary.entries.find(entry=>entry.name==="這是一個超過八字的行程名稱"))),{name:"這是一個超過八字的行程名稱",details:"：開始時間 08:00→08:10"},"預覽必須將名稱與時間變更拆成安全文字節點資料");assert.equal(summary.hasAutoLinked,true,"前後任一遠端行程連動時只須標記一次");assert.doesNotMatch(summary.lines.join("\n"),/待放置/);
 const onlyAll=[{option:{key:"start-all",text:"x"},trial,conflict:null}];runtime.api.openTimeOptionWheel(runtime.api.state().days[runtime.api.state().activeDate][2],2,"start","08:10",onlyAll,onlyAll);const content=runtime.nodes.dialogContent.children[0],preview=content.children[6];assert.equal(content.children[4].hidden,true,"第三段不存在時必須隱藏且不得殘留舊字");assert.equal(content.textContent.includes("「"),false,"句中滾輪文案不得保留位置引號");assert.equal(preview.hidden,true,"前後行程時間的全鏈連動不可顯示結果預覽");assert.equal(preview.children.length,0,"隱藏的全鏈預覽不得殘留上一種候選的內容");
}

// 4a. The double-boundary start/end gate drops time-duration-inconsistent trials, then
// directly corrects an already exact locked-boundary input without altering either neighbour.
{
 const startRows=[{id:"A",content:"前",start:"06:00",end:"07:00",duration:60,lock:"end",pending:false},{id:"B",content:"本",start:"07:10",end:"09:30",duration:150,lock:"none",pending:false},{id:"C",content:"後",start:"09:30",end:"14:05",duration:275,lock:"start",pending:false}],start=makeRuntime(startRows);start.api.handleTimeEdit("B","start","07:00");assert.deepEqual(JSON.parse(JSON.stringify(start.api.state().days["2026-10-09"])).map(row=>[row.id,row.start,row.end,row.duration,row.lock]),[["A","06:00","07:00",60,"end"],["B","07:00","09:30",150,"none"],["C","09:30","14:05",275,"start"]],"開始時間接回前方鎖定結束時，必須排除錯改鄰列時長的 trial 並只套用本列輸入");assert.notEqual(start.nodes.appDialog.open,true,"已完全吻合的直接修正不建立候選燈箱");
 const endRows=[{id:"A",content:"前",start:"06:00",end:"07:00",duration:60,lock:"end",pending:false},{id:"B",content:"本",start:"07:00",end:"09:20",duration:150,lock:"none",pending:false},{id:"C",content:"後",start:"09:30",end:"14:05",duration:275,lock:"start",pending:false}],end=makeRuntime(endRows);end.api.handleTimeEdit("B","end","09:30");assert.deepEqual(JSON.parse(JSON.stringify(end.api.state().days["2026-10-09"])).map(row=>[row.id,row.start,row.end,row.duration,row.lock]),[["A","06:00","07:00",60,"end"],["B","07:00","09:30",150,"none"],["C","09:30","14:05",275,"start"]],"結束時間接回後方鎖定開始時，必須對稱排除錯改鄰列時長的 trial");
 const locked=makeRuntime(startRows.map(row=>row.id==="B"?{...row,lock:"start"}:row));locked.api.handleTimeEdit("B","start","07:00");assert.equal(locked.api.state().days["2026-10-09"][1].start,"07:10","本列輸入欄鎖定仍必須優先阻擋");
 const before=structuredClone(start.api.state()),remoteTrial=structuredClone(before),remoteRow=remoteTrial.days[remoteTrial.activeDate].find(row=>row.id==="A");remoteRow.start="06:10";remoteRow.duration=50;const boundary=start.api.lockedBoundaryTimeEditScope(before.days[before.activeDate][1],1,"start","07:00"),remote=start.api.matchingLockedBoundaryTrial([{option:{key:"remote"},conflict:null,trial:remoteTrial}],before,"B","start",boundary,before.days[before.activeDate][1]);assert.equal(remote.chosen,null,"即使局部結果一致，只要其他完整行程資料被改動就不得自動套用");
 const pending=makeRuntime(startRows.map(row=>row.id==="B"?{...row,pending:true}:row));pending.api.handleTimeEdit("B","start","07:00");assert.equal(pending.nodes.appDialog.open,true,"待放置本列不得進入雙側鎖定例外");
 const long=makeRuntime([{id:"A",start:"22:00",end:"23:00",duration:60,lock:"end",pending:false},{id:"B",start:"23:10",end:"00:00",duration:1500,lock:"none",pending:false},{id:"C",start:"00:00",end:"01:00",duration:60,lock:"start",pending:false}]);long.api.handleTimeEdit("B","start","23:00");assert.equal(long.api.state().days["2026-10-09"][1].duration,1500,"舊資料超上限值不得被自動縮改");assert.equal(long.api.hasUnresolvedConflicts(),true,"舊資料超上限值必須維持衝突並阻擋匯出");
 const repair=makeRuntime([{id:"A",start:"07:00",end:"08:00",duration:60,lock:"none",pending:false},{id:"B",start:"08:00",end:"09:00",duration:1500,lock:"none",pending:false},{id:"C",start:"09:00",end:"10:00",duration:60,lock:"none",pending:false}]);repair.api.handleTimeEdit("B","duration",60);repair.nodes.dialogActions.children[0].fire("click");assert.equal(repair.api.state().days["2026-10-09"][1].duration,60,"舊超上限本列輸入合法時長時，真實 handler 必須允許試算並套用修正");assert.equal(repair.api.hasUnresolvedConflicts(),false,"修正本列回範圍內後必須清除本列上限衝突並恢復正常連動");
}

// 5. Keep checks actual neighbouring inconsistency, later end-all repairs it, preserves unrelated conflicts, and cross-midnight stays legal.
{
 const chain=makeRuntime(rows().slice(1));chain.api.keepTimeEditConflict(structuredClone(chain.api.state().days["2026-10-09"]),"N",1,"start","08:10",null,null);assert.equal(chain.api.state().conflicts.at(-1).lockedField,"","未鎖定不一致不可假稱欄位已鎖定");let list=chain.api.state().days["2026-10-09"];chain.api.executeTimeOption(list[1],1,"end","09:10",{key:"end-all"});list=chain.api.state().days["2026-10-09"];assert.deepEqual(JSON.parse(JSON.stringify(list)).map(row=>[row.start,row.end]),[["07:10","08:10"],["08:10","09:10"]],"B 保留 08:10 後 end-all 必須重建 A→B 時間鏈");assert.equal(chain.api.state().conflicts.length,0,"實際鏈修復後必須解除匯出阻擋");chain.api.executeTimeOption(list[0],0,"end","08:20",{key:"end-all"});list=chain.api.state().days["2026-10-09"];assert.deepEqual(JSON.parse(JSON.stringify(list)).map(row=>[row.start,row.end]),[["07:20","08:20"],["08:20","09:20"]],"A end-all 必須覆蓋 B 08:10 並維持完整鏈");
 const runtime=makeRuntime();runtime.api.state().conflicts=[{date:"2026-10-10",lockedRowId:"other",lockedField:"start"}];runtime.api.keepTimeEditConflict(structuredClone(runtime.api.state().days["2026-10-09"]),"A",1,"start","08:10",null,null);assert.equal(runtime.api.state().conflicts.length,2,"跨日期既有衝突不可被清掉");const midnight=makeRuntime(),option=midnight.api.timeOptions(midnight.api.state().days["2026-10-09"][1],1,"end").find(item=>item.key==="end-all");assert.equal(midnight.api.previewTimeOption(midnight.api.state().days["2026-10-09"][1],1,"end","23:30",option).conflict,null,"跨午夜 trial 必須合法且不增加限制");
}

// 6. Esc/backdrop preserve, outside-to-inside drag does not, and later ordinary dialogs inherit no old handler.
{
 const runtime=makeRuntime(),dialog=runtime.nodes.appDialog;let kept=0,ordinary=0;runtime.api.openDialog("time","x",[{text:"套用",cls:"primary"},{text:"保留",run:()=>kept++}],{onCancel:()=>kept++,focusDialog:true});dialog.oncancel({preventDefault(){}});assert.equal(kept,1,"Esc 必須等同保留");runtime.api.openDialog("time","x",[{text:"套用",cls:"primary"}],{onCancel:()=>kept++});dialog.onpointerdown({target:dialog,clientX:0,clientY:0});dialog.onclick({target:dialog,clientX:50,clientY:50,preventDefault(){}});assert.equal(kept,1,"從 padding 外拖回內容不得取消");runtime.api.openDialog("normal","x",[{text:"ok",run:()=>ordinary++}]);assert.equal(dialog.oncancel,null,"一般燈箱不得承接舊 handler");runtime.nodes.dialogActions.children[0].fire("click");assert.equal(ordinary,1);
}

// 7. The actual conflict information must explain the retained direct value. Closing that
// information (button, Esc, or true backdrop click) is presentation-only.
for(const close of ["button","esc","backdrop"]){
 const initial=[{id:"A",content:"A",start:"07:00",end:"08:00",duration:60,lock:"none",pending:false},{id:"B",content:"B",start:"08:00",end:"09:00",duration:60,lock:"none",pending:false}],runtime=makeRuntime(initial);
 runtime.api.keepTimeEditConflict(structuredClone(runtime.api.state().days["2026-10-09"]),"B",1,"start","08:10",null,null);
 const explanation=runtime.nodes.dialogContent.children[0].textContent;
 assert.match(explanation,/「A」結束時間 08:00 不等於「B」開始時間 08:10/,"保留衝突必須列出 A 08:00 與 B 08:10 的實際斷鏈");assert.match(explanation,/「B」的開始時間 08:10 加總時長 1時 不等於結束時間 09:00/,"保留衝突必須列出 B 自身 60 分鐘與 09:00 不一致");
 const snapshot=JSON.stringify(runtime.api.state()),counts=JSON.stringify(runtime.calls),dialog=runtime.nodes.appDialog;
 if(close==="button")runtime.nodes.dialogActions.children[0].fire("click");else if(close==="esc")dialog.oncancel({preventDefault(){}});else {dialog.onpointerdown({target:dialog,clientX:0,clientY:0});dialog.onclick({target:dialog,clientX:0,clientY:0,preventDefault(){}});}
 assert.equal(JSON.stringify(runtime.api.state()),snapshot,"關閉衝突資訊不可改變 state");assert.equal(JSON.stringify(runtime.calls),counts,"關閉衝突資訊不可額外保存、重繪或提示");assert.equal(dialog.open,false,"關閉衝突資訊只能關閉目前資訊燈箱");
}

// 8. A blocked first/companion-time trial must give a concrete nonempty explanation,
// rather than silently consuming the entered value.
{
 const runtime=makeRuntime([{id:"A",content:"A",start:"",end:"",duration:60,lock:"none",pending:false},{id:"B",content:"B",start:"08:00",end:"09:00",duration:60,lock:"start",pending:false}]);runtime.api.handleTimeEdit("A","start","07:10");assert.ok(runtime.nodes.dialogContent.children[0].textContent.trim(),"首次輸入缺 companion 且受鎖定阻擋時必須有非空說明");
}

// 9. Adding a row derives only the new top row from the first formal start time. It
// must neither recalculate existing rows nor refresh, remove, or create conflicts.
{
 const original=[{id:"A",start:"06:00",end:"07:00",duration:60,lock:"end",pending:false},{id:"B",start:"07:00",end:"09:30",duration:160,lock:"none",pending:false},{id:"C",start:"09:30",end:"10:30",duration:60,lock:"start",pending:false}],runtime=makeRuntime(original),existingConflict={id:"existing-conflict",date:"2026-10-09",lockedRowId:"B",lockedField:"end",lockedValue:"09:30",requiredValue:"09:40",directRowId:"B",directField:"duration",directContext:{chainRowIds:["A","B","C"]}};
 runtime.api.recordConflict(structuredClone(existingConflict));runtime.calls.persist=0;const before=structuredClone(runtime.api.state());runtime.api.addRow();const added=runtime.api.state().days["2026-10-09"];
 assert.deepEqual(JSON.parse(JSON.stringify(added.slice(1))),JSON.parse(JSON.stringify(before.days["2026-10-09"])),"新增行程不得重算或更改任何既有正式行程、鎖定或資料");assert.deepEqual(JSON.parse(JSON.stringify(runtime.api.state().conflicts)),[existingConflict],"新增成功不得清除既有未解衝突或建立假衝突");assert.deepEqual(JSON.parse(JSON.stringify(added[0])),{id:"test-id",date:"2026-10-09",start:"05:00",end:"06:00",duration:60,lock:"none",category:"",content:"",confirmed:false,pending:false,isNew:true},"新增列必須置頂、預設 60 分鐘並由首筆正式開始時間往前推算");assert.deepEqual(runtime.calls,{persist:1,render:1,renderDay:0,toasts:["已新增行程"]},"新增成功必須維持既有保存、重繪與提示，且不經衝突重檢");
 for(const lock of ["start","end","duration"]){const locked=makeRuntime([{id:"L",start:"07:00",end:"08:00",duration:60,lock,pending:false}]);locked.api.addRow();assert.deepEqual(JSON.parse(JSON.stringify(locked.api.state().days["2026-10-09"])).map(row=>[row.start,row.end,row.duration,row.lock]),[["06:00","07:00",60,"none"],["07:00","08:00",60,lock]],"首筆正式行程的 "+lock+" 鎖定不得撤回新增或建立衝突");assert.equal(locked.api.state().conflicts.length,0,"無既有衝突時新增不得建立衝突");}
 const noTime=makeRuntime([{id:"A",start:"",end:"",duration:60,lock:"end",pending:false}]);noTime.api.addRow();assert.deepEqual(JSON.parse(JSON.stringify(noTime.api.state().days["2026-10-09"])).map(row=>[row.start,row.end,row.duration]),[["","",60],["","",60]],"首筆正式行程沒有開始時間時必須維持既有空白新增行為");
 const empty=makeRuntime([]);empty.api.addRow();assert.deepEqual(JSON.parse(JSON.stringify(empty.api.state().days["2026-10-09"])).map(row=>[row.start,row.end,row.duration]),[["","",60]],"空日期必須新增空白的 60 分鐘行程");
 const pending=makeRuntime([{id:"P",start:"",end:"",duration:60,lock:"none",pending:true},{id:"A",start:"07:00",end:"08:00",duration:60,lock:"end",pending:false}]);pending.api.addRow();assert.deepEqual(JSON.parse(JSON.stringify(pending.api.state().days["2026-10-09"])).map(row=>[row.id,row.start,row.end,row.pending]),[["test-id","06:00","07:00",false],["P","","",true],["A","07:00","08:00",false]],"待放置列必須跳過作為時間錨點、保留原位置，新增列仍置頂");
 const midnight=makeRuntime([{id:"A",start:"00:00",end:"01:00",duration:60,lock:"none",pending:false}]);midnight.api.addRow();assert.deepEqual(JSON.parse(JSON.stringify(midnight.api.state().days["2026-10-09"])).map(row=>[row.start,row.end,row.duration]),[["23:00","00:00",60],["00:00","01:00",60]],"00:00 字串必須依 24 小時循環新增跨午夜行程");
}

console.log("time field wheel regression test passed");
