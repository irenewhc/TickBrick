import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("script.js", "utf8");
const styles = fs.readFileSync("style.css", "utf8");
const logic = source.slice(source.indexOf("function getList"), source.indexOf("function openCalendar"));
const context = { structuredClone, setTimeout: () => 0, clearTimeout: () => {}, requestAnimationFrame: callback => callback(), document:{createElement(tag){const listeners={},states={};return{tagName:tag,className:"",textContent:"",children:[],listeners,states,append(...items){this.children.push(...items);},replaceChildren(...items){this.children=[];this.append(...items);},addEventListener(type,callback){listeners[type]=callback;},appendChild(item){this.children.push(item);},setAttribute(){},classList:{toggle(name,enabled){states[name]=enabled;}},setPointerCapture(){this.captured=true;}};},createTextNode(text){return {nodeType:3,textContent:text};}} };

assert.match(source, /pending-duration-wheel[\s\S]*?role","listbox/, "待放置時長候選必須使用自訂單欄 listbox 滾輪，而非原生 select");
assert.match(source, /wheel\.addEventListener\("wheel"/, "候選滾輪必須支援滑鼠滾輪切換");
assert.match(source, /pointermove[\s\S]*?keydown/, "候選滾輪必須支援拖曳與鍵盤切換");
assert.match(source, /titleIcon\.className="fa-solid fa-triangle-exclamation dialog-warning-title-icon"[\s\S]*?document\.createTextNode\("時間衝突"\)[\s\S]*?openDialog\(title,content/, "候選燈箱標題必須有黃色警示圖示與「時間衝突」");
assert.match(source, /if\(!candidates\.length\)\{[\s\S]*?dialog-warning-title[\s\S]*?fa-triangle-exclamation[\s\S]*?if\(locked\.length\)[\s\S]*?下方行程已鎖定，造成時間衝突：[\s\S]*?fa-thumbtack[\s\S]*?目前沒有任一筆行程能單獨調整並符合安排，您的行程修改將復原。/, "無候選時必須以安全 DOM 呈現警告標題、可選鎖定原因與核定的獨立復原說明");
assert.match(source, /titleText=document\.createTextNode\("時間衝突警告"\)/, "無候選警告標題文案必須正確");
assert.match(source, /text:"我知道了",cls:"danger",run:onCancel\|\|\(\(\)=>render\(\)\)/, "無候選警告的我知道了必須以既有取消回復流程關閉");
assert.match(source, /openDialog\("確認時間連動",[\s\S]*?\{text:"我知道了",cls:"danger",run:\(\)=>reorderRow[\s\S]*?\{text:"取消移動",cls:""/, "確認時間連動的我知道了必須為紅底，取消移動維持基礎按鈕");
assert.match(source, /text:"套用調整"[\s\S]*?text:cancelText/, "共用候選燈箱按鈕必須同列保留「套用調整」及可依操作切換的取消動作");
assert.match(source, /cause=locked\.length\?"由於"/, "候選燈箱必須依實際時間鎖定組成衝突原因");
assert.match(source, /displayName=value=>value\.length>20\?value\.slice\(0,20\)\+"\.\.\.":value/, "候選與衝突原因名稱必須截斷為最多 20 字加省略號");
assert.match(source, /wheel\.scrollTop=current\(\)\*34/, "切換候選時必須以列高捲動，讓首尾候選都可置於固定中央位置");
assert.match(source, /content\.append\(reason,adjustment,preview\);render\(\)/, "初始渲染必須在燈箱掛入前建立可選候選與預覽");
assert.match(source, /pointerdown",event=>\{dragStart=event\.clientY;\}/, "一般點選開始時不得立即取得指標捕捉");
assert.match(source, /wheel\.setPointerCapture\?\.\(event\.pointerId\);step\(steps\)/, "拖曳跨過列高後必須取得指標捕捉並切換候選");
assert.match(source, /option\.title=name;option\.textContent=item\?\.row\?displayName\(name\):name/, "滾輪候選必須保留完整 title，畫面只顯示截斷名稱");
assert.match(source, /part\.className="pending-duration-lock"/, "每段相關鎖定行程及欄位必須能單獨套用醒目樣式");
assert.match(source, /icon\.className="fa-solid fa-tag pending-duration-tag"/, "結構性時長燈箱的預覽必須以 Font Awesome tag 圖示開頭");
assert.match(source, /preview\.replaceChildren\(\);[\s\S]*?name\.className="pending-duration-preview-name"[\s\S]*?entry\.append\(icon,name,details\);[\s\S]*?preview\.append\(entry\)/, "結果區必須以安全 DOM 分開建立可收合名稱與完整時間內容");
assert.doesNotMatch(source, /preview\.textContent="顯示結果：/, "結果文字不得再顯示「顯示結果：」前綴");
assert.match(styles, /\.pending-duration-wheel\s*\{[^}]*width:\s*180px;[^}]*height:\s*102px;[^}]*display:\s*inline-block;[^}]*\}/, "滾輪本身必須固定完整顯示上／中／下三列");
assert.doesNotMatch(styles, /\.pending-duration-wheel\s*\{[^}]*padding-block/, "滾輪本身不得以可捲動 padding 製造留白");
assert.match(styles, /\.pending-duration-wheel::before,[\s\S]*?\.pending-duration-wheel::after\s*\{[\s\S]*?height:\s*34px/, "滾輪內容首尾必須各有一列高 spacer，讓首尾候選仍可置中");
assert.match(styles, /\*\s*\{\s*box-sizing:\s*border-box;/, "全域邊界盒規則必須持續套用，讓調整行高度包含上下留白");
assert.match(styles, /:root\s*\{[\s\S]*?--color-purple-50:\s*#f0f4fd;/, "應提供待放置滾輪選取列使用的淡紫色 token");
assert.match(styles, /\.pending-duration-wheel\s*\{[^}]*background:\s*linear-gradient\(var\(--color-purple-50\),\s*var\(--color-purple-50\)\)\s*center\s*\/\s*100%\s*34px/, "淡紫選取槽應固定在滾輪中央，而非附著於會捲動的候選列");
assert.match(styles, /\.pending-duration-mode-wheel\s*\{[^}]*background:\s*linear-gradient\(var\(--color-purple-50\),\s*var\(--color-purple-50\)\)\s*center\s*\/\s*100%\s*34px/, "調整／固定模式滾輪也必須有固定在中央的淡紫選取槽");
assert.doesNotMatch(styles, /\.pending-duration-option\.selected\s*\{[^}]*background:/, "選取候選列不得自行帶有會隨內容捲動的底色");
assert.match(source, /wheel\._wheelTimer=setTimeout\(\(\)=>wheel\._preview\(\),16\)[\s\S]*?addEventListener\("scrollend",\(\)=>wheel\._commit\(\)\)/, "結構性候選滾輪必須在 16ms 維持快速預覽，並在捲動結束後才對齊");
assert.match(styles, /\.pending-duration-wheel\.is-scrolling \.pending-duration-option\.selected[\s\S]*?\.pending-duration-option\.is-centered/, "滑動時只有穿過中央選取槽的候選文字維持深紫");
assert.match(styles, /\.pending-duration-adjustment\s*\{[\s\S]*?height:\s*150px;[\s\S]*?padding-block:\s*24px/, "調整行必須以 150px 高度包含外層固定 24px 上下留白，切換候選不改變視覺留白");
assert.match(styles, /\.pending-duration-wheel\s*\{[\s\S]*?border:\s*0;/, "滾輪容器不得有外框");
assert.doesNotMatch(styles, /\.pending-duration-option\.selected\s*\{[^}]*border-(?:top|bottom)/, "選取候選只能以淡紫底色標示，不得保留上下框");
assert.match(styles, /\.pending-duration-result\s*\{[\s\S]*?color:\s*var\(--color-red\)/, "結果文字必須使用紅色 token");
assert.match(styles, /\.pending-duration-result\s*\{[\s\S]*?align-items:\s*flex-start;[\s\S]*?height:\s*68px/, "固定高度的結果區應從頂端排列文字，避免一、兩行文字置中跳動");
assert.match(styles, /\.pending-duration-tag\s*\{[^}]*color:\s*var\(--color-pink-heavy\)/, "預覽 tag 圖示必須使用 pink-heavy token");
assert.match(styles, /\.app-dialog\.pending-duration-dialog\s*\{[^}]*width:\s*min\(900px, calc\(100% - 30px\)\)/, "結構性時長調整燈箱在桌面採用 900px，窄螢幕仍不得超出視窗");
assert.match(styles, /\.pending-duration-lock\s*\{[\s\S]*?color:\s*var\(--color-purple-800\);[\s\S]*?font-weight:\s*500/, "鎖定行程與欄位必須使用深紫色與 500 字重，不加下底線");
assert.doesNotMatch(styles, /\.pending-duration-lock\s*\{[^}]*text-decoration/, "鎖定行程與欄位不得保留下底線");
assert.match(styles, /\.pending-duration-reason\s*\{\s*margin:\s*0\s*\}/, "衝突原因必須自然完整呈現，不得限制高度或隱藏溢位");
assert.match(styles, /\.dialog-warning-title\s*\{[^}]*display:\s*inline-flex[^}]*gap:\s*8px/, "無候選警告標題必須以圖示與文字的安全版面排列");
assert.match(styles, /\.dialog-warning-title-icon\s*\{[^}]*color:\s*var\(--color-yellow\)/, "無候選警告三角形圖示必須使用黃色 token");
assert.match(styles, /\.pending-duration-no-candidates-icon\s*\{[^}]*color:\s*var\(--color-pink-heavy\)/, "無候選原因的 thumbtack 圖示必須使用深粉紅 token");
assert.match(styles, /\.app-dialog\s*\{[\s\S]*?padding:\s*40px;/, "燈箱內距必須調整為 40px");
assert.match(styles, /\.dialog-actions\.pending-duration-actions\s*\{[\s\S]*?flex-wrap:\s*nowrap;[\s\S]*?justify-content:\s*flex-end/, "候選燈箱按鈕必須固定同列靠右");

vm.createContext(context);
vm.runInContext(`
 let state={activeDate:"2026-10-04",dates:["2026-10-04"],days:{"2026-10-04":[]},staging:[],conflicts:[]};
 let draggedRow=null,effects={persist:0,render:0,toast:0};
 function makeId(){return "conflict-"+Math.random();}
 function activeRows(){return state.days[state.activeDate];}
 function discardCategoryDrafts(){}
 function validDate(){return true;}
 function calendarMonthFor(){return {};}
 function dateLabel(value){return value;}
 function persist(){effects.persist++;}
 function render(){effects.render++;}
 function showToast(){effects.toast++;}
 function presentOperationConflict(){}
 let dialogs=[];
 function openDialog(title,content,actions,options){dialogs.push({title,content,actions,options});}
 ${logic}
 globalThis.api={
  setRows(rows,conflicts=[]){state.days[state.activeDate]=structuredClone(rows);state.conflicts=structuredClone(conflicts);},
  rows(){return structuredClone(state.days[state.activeDate]);},
  rowsOn(date){return structuredClone(state.days[date]||[]);},
  activeDate(){return state.activeDate;},
  conflicts(){return structuredClone(state.conflicts);},
  refresh(){refreshConflicts();},
  exportBlocked(){refreshConflicts();return state.conflicts.length>0;},
  update(id,patch){Object.assign(state.days[state.activeDate].find(row=>row.id===id),patch);},
  reorder:reorderRow,
  request:requestReorder,
  stage(id){moveRowToStaging(state.days[state.activeDate].find(item=>item.id===id));},
  delete(id){deleteRowWithAdjustment("day",id);},
  move(id,target){moveToDate("day",state.days[state.activeDate].find(item=>item.id===id),target);},
  moveStaging(id,target){moveToDate("staging",state.staging.find(item=>item.id===id),target);},
  staging(){return structuredClone(state.staging);},
  effects(){return {...effects};},
  resetEffects(){effects={persist:0,render:0,toast:0};},
  place(id){placePending(state.days[state.activeDate].find(item=>item.id===id));},
  pendingTarget:pendingDurationTarget,
  reorderCandidates(rows,conflict){return reorderCandidateIds(rows,conflict);},
  deleteCandidates(rows,rowId){return deleteStructuralCandidateIds(rows,rowId);},
  durationTarget(item,mode,valid,requiredIncrease){return durationAdjustmentTarget(item,mode,duration=>!valid.includes(duration),requiredIncrease);},
  openPending(id,before){openPendingDurationDialog(state.days[state.activeDate].find(item=>item.id===id),before);},
  structural:recalculateStructuralChain,
  dialog(){return dialogs.at(-1);},
  clearDialogs(){dialogs=[];}
 };
`, context);

const api = context.api;
const row = (id,start,end,duration=60,lock="none",pending=false,content="") => ({ id,start,end,duration,lock,pending,content });
const timeAfter = (start,duration) => { const [hour,minute]=start.split(":").map(Number),value=((hour*60+minute+duration)%1440+1440)%1440;return `${String(Math.floor(value/60)).padStart(2,"0")}:${String(value%60).padStart(2,"0")}`; };
const assertTimeChain = (items,message) => { const scheduled=items.filter(item=>!item.pending);scheduled.forEach((item,index)=>{assert.equal(timeAfter(item.start,item.duration),item.end,`${message}：${item.id} 必須保留本列時長`);if(index)assert.equal(item.start,scheduled[index-1].end,`${message}：${item.id} 必須銜接前一列`);}); };
const dialogLockedReasons = dialog => dialog.content.children[0].children.filter(item=>item.className==="pending-duration-lock").map(item=>item.textContent);

const boundaryRows = (firstLock,lastLock) => [row("F","09:00","10:00",60,firstLock),row("M","10:00","11:00"),row("L","11:00","12:00",60,lastLock)];
assert.deepEqual(api.reorderCandidates(boundaryRows("start","start"),{anchorRowId:"F",lockedRowId:"L"}), ["F","M"], "開始→開始的排序候選必須包含前端開始鎖定列與中間列，排除尾端開始鎖定列");
assert.deepEqual(api.reorderCandidates(boundaryRows("start","end"),{anchorRowId:"F",lockedRowId:"L"}), ["F","M","L"], "開始→結束的排序候選必須包含前端開始鎖定列、中間列與尾端結束鎖定列");
assert.deepEqual(api.reorderCandidates(boundaryRows("end","start"),{anchorRowId:"F",lockedRowId:"L"}), ["M"], "結束→開始的排序候選只能包含中間列");
assert.deepEqual(api.reorderCandidates(boundaryRows("end","end"),{anchorRowId:"F",lockedRowId:"L"}), ["M","L"], "結束→結束的排序候選必須包含中間列與尾端結束鎖定列");

const deleteScopeRows = [row("TEST","04:00","05:00"),row("NEW","05:00","06:00"),row("LOCKED-DURATION","06:00","07:00",60,"duration"),row("AIRPORT","07:00","08:00",60,"end"),row("AFTER","08:00","09:00")];
assert.deepEqual([...api.deleteCandidates(deleteScopeRows,"TEST")], ["NEW","LOCKED-DURATION","AIRPORT"], "刪除候選只能到最近開始／結束時間鎖定列；總時長鎖定列本身排除候選但不得停止搜尋");
assert.equal(api.durationTarget(row("SHORT","07:00","09:30",160),"expand",[150],60), null, "刪除 60 分鐘行程時不得把相差 1,430 分鐘的循環同值偽裝為 1,590 分鐘候選");

api.setRows([row("A","07:30","08:30"),row("B","08:30","09:30")]);
api.reorder("day","B","A",false);
let rows = api.rows();
assert.deepEqual(rows.map(item => item.id), ["B","A"], "拖到最上方必須置於原首列前方");
assert.deepEqual(rows.map(item => [item.start,item.end]), [["07:30","08:30"],["08:30","09:30"]], "沒有鎖定時，最上方排序必須保留原首筆開始時間並重建完整時間鏈");

api.setRows([row("A","07:30","08:30"),row("B","08:30","09:30"),row("C","09:30","10:30"),row("D","10:30","11:30")]);
api.reorder("day","C","A",false);
rows = api.rows();
assert.deepEqual(rows.map(item => item.id), ["C","A","B","D"], "四列情境拖到最上方必須維持正確順序");
assert.deepEqual(rows.map(item => [item.start,item.end]), [["07:30","08:30"],["08:30","09:30"],["09:30","10:30"],["10:30","11:30"]], "沒有鎖定時，最上方排序必須從原首筆開始時間向下重算完整正式時間鏈");

api.setRows([row("A","07:30","08:30"),row("B","08:30","09:30"),row("C","09:30","10:30")]);
api.reorder("day","C","B",false);
rows = api.rows();
assert.deepEqual(rows.map(item => item.id), ["A","C","B"], "中間插入必須保留指定順序");
assert.deepEqual(rows.map(item => [item.start,item.end]), [["07:30","08:30"],["08:30","09:30"],["09:30","10:30"]], "中間插入必須保留前方錨點並向下串接");

api.setRows([row("A","07:30","08:30"),row("B","08:30","09:30"),row("C","09:30","10:30")]);
api.reorder("day","A","B",true);
rows = api.rows();
assert.deepEqual(rows.map(item => item.id), ["B","A","C"], "向下拖曳必須置於目標列後方");
assert.deepEqual(rows.map(item => [item.start,item.end]), [["07:30","08:30"],["08:30","09:30"],["09:30","10:30"]], "沒有鎖定時，向下拖曳必須保留原首筆開始時間並重算完整時間鏈");

api.setRows([row("A","07:30","08:30"),row("P","","",60,"none",true),row("B","08:30","09:30"),row("C","09:30","10:30")]);
api.reorder("day","C","B",false);
rows = api.rows();
assert.deepEqual(rows.map(item => [item.id,item.start,item.end]), [["A","07:30","08:30"],["P","",""],["C","08:30","09:30"],["B","09:30","10:30"]], "待放置行程必須跳過，不得中斷正式行程時間鏈");

api.setRows([row("A","13:20","14:20"),row("B","14:20","15:20"),row("C","15:20","18:50",210,"start"),row("D","18:50","19:50")]);
api.reorder("day","D","C",false);
rows = api.rows();
assert.deepEqual(rows.map(item => item.id), ["A","B","D","C"], "未鎖定列移到鎖定開始時間列前方時，鎖定列必須成為錨點");
assert.deepEqual(rows.map(item => [item.start,item.end]), [["12:20","13:20"],["13:20","14:20"],["14:20","15:20"],["15:20","18:50"]], "鎖定開始時間錨點必須向上及向下完整重算正式時間鏈");

api.setRows([row("L","10:00","11:00",60,"start"),row("A","11:00","12:00"),row("B","12:00","13:00")]);
api.reorder("day","B","L",true);
rows = api.rows();
assert.deepEqual(rows.map(item => [item.id,item.start,item.end]), [["L","10:00","11:00"],["B","11:00","12:00"],["A","12:00","13:00"]], "未鎖定列移到鎖定開始時間列後方時必須以其開始時間串接");

api.setRows([row("A","08:00","09:00"),row("B","09:00","10:00"),row("L","10:00","11:00",60,"end")]);
api.reorder("day","A","L",false);
rows = api.rows();
assert.deepEqual(rows.map(item => [item.id,item.start,item.end]), [["B","08:00","09:00"],["A","09:00","10:00"],["L","10:00","11:00"]], "未鎖定列移到鎖定結束時間列前方時必須以其結束時間向上串接");

api.setRows([row("L","10:00","11:00",60,"end"),row("A","11:00","12:00"),row("B","12:00","13:00")]);
api.reorder("day","B","L",true);
rows = api.rows();
assert.deepEqual(rows.map(item => [item.id,item.start,item.end]), [["L","10:00","11:00"],["B","11:00","12:00"],["A","12:00","13:00"]], "未鎖定列移到鎖定結束時間列後方時必須以其結束時間向下串接");

api.setRows([row("A","22:30","23:30"),row("L","00:30","02:30",120,"start"),row("D","02:30","03:30")]);
api.reorder("day","D","L",false);
rows = api.rows();
assert.deepEqual(rows.map(item => [item.id,item.start,item.end]), [["A","22:30","23:30"],["L","00:30","02:30"],["D","02:30","03:30"]], "排序若會把中間 D 推成跨午夜，必須完整復原操作");
const blockedDialog = api.dialog();
assert.equal(blockedDialog.content.children.at(-1).textContent, "目前沒有任一筆行程能單獨調整並符合安排，您的行程修改將復原。", "結構操作無合法候選時必須顯示核定復原文案");

api.setRows([row("A","13:20","14:20"),row("B","14:20","15:20",60,"end"),row("C","15:20","18:50",210,"start"),row("D","18:50","19:50")]);
api.reorder("day","D","C",false);
let dialog = api.dialog();
assert.equal(dialog.title.className, "dialog-warning-title", "排序遇到可由單列吸收的鎖定衝突時，標題應使用警示版面");
assert.equal(dialog.title.children[0].className, "fa-solid fa-triangle-exclamation dialog-warning-title-icon", "可行候選標題必須有黃色警示圖示");
assert.equal(dialog.title.children[1].textContent, "時間衝突", "可行候選標題文字必須為「時間衝突」");
assert.equal(dialog.options.dialogClass, "pending-duration-dialog", "只有結構性時長調整燈箱應取得專用寬度 class");
const preview = dialog.content.children[2], previewEntry = preview.children[0];
assert.equal(previewEntry.className, "pending-duration-preview-entry", "每筆紅色預覽必須各自使用 entry 節點");
assert.equal(previewEntry.children[0].className, "fa-solid fa-tag pending-duration-tag", "每筆紅色預覽開頭必須有 tag icon");
assert.equal(api.conflicts().length, 0, "尚未確認候選前不得保存排序衝突或阻擋匯出");
dialog.actions.find(action=>action.text==="套用調整").run();
rows = api.rows();
assert.deepEqual(rows.map(item => item.id), ["A","B","D","C"], "確認候選後必須保留使用者的排序操作");
assert.equal(rows.find(item=>item.id==="D").duration, 0, "排序區間超額時，候選必須可縮短單一未鎖定時長至可行值");
assertTimeChain(rows, "結束→開始候選套用後");
api.refresh();
assert.equal(api.conflicts().length, 0, "套用可行候選後不得保留排序衝突或阻擋匯出");

api.setRows([row("A","09:00","10:00",60,"start"),row("B","10:00","11:00"),row("C","11:00","12:00",60,"start"),row("D","12:00","13:00")]);
api.clearDialogs();
api.reorder("day","D","A",true);
dialog = api.dialog();
assert.equal(dialog.title.children[1].textContent, "時間衝突", "錨點後方鎖定時間要求較早時必須顯示排序時長候選");
dialog.actions.find(action=>action.text==="套用調整").run();
rows = api.rows();
assert.equal(rows.filter(item=>["A","B","D"].includes(item.id)).some(item=>item.duration===0), true, "錨點後方的鎖定區間超額必須縮短候選，不得以增加 1,440 分鐘掩蓋衝突");
assertTimeChain(rows, "開始→開始候選套用後");

api.setRows([row("A","09:00","10:00",60,"start"),row("B","10:00","11:00"),row("C","11:00","12:00",60,"end"),row("D","12:00","13:00")]);
api.clearDialogs();
api.reorder("day","D","A",true);
dialog = api.dialog();
assert.equal(dialog.title.children[1].textContent, "時間衝突", "開始→結束鎖定區間的排序衝突必須提供涵蓋兩端的候選");
dialog.actions.find(action=>action.text==="套用調整").run();
rows = api.rows();
assertTimeChain(rows, "開始→結束候選套用後");
assert.equal(api.conflicts().length, 0, "開始→結束候選套用後不得留下衝突");

api.setRows([row("A","09:00","10:00",60,"start"),row("X","10:00","11:00"),row("B","11:00","12:00",60,"start")]);
api.clearDialogs();
api.reorder("day","X","B",true);
dialog = api.dialog();
dialog.actions.find(action=>action.text==="取消").run();
assert.deepEqual(api.rows().map(item=>item.id), ["A","X","B"], "取消可行的排序候選必須完整回復原排序");
assert.equal(api.conflicts().length, 0, "取消可行候選不得記錄衝突或阻擋匯出");

api.setRows([row("A","09:00","10:00",60,"start"),row("X","10:00","11:00"),row("B","11:00","12:00",60,"start")]);
api.clearDialogs();
api.delete("X");
dialog = api.dialog();
assert.equal(dialog.title.children[1].textContent, "時間衝突", "刪除造成來源時間鏈不足時應顯示共同候選燈箱");
dialog.actions.find(action=>action.text==="套用調整").run();
rows = api.rows();
assert.deepEqual(rows.map(item=>item.id), ["A","B"], "確認候選後應完成原刪除操作");
assert.equal(rows.find(item=>item.id==="A").duration, 120, "刪除來源鏈不足時只能增加單一候選時長以保留鎖定");

api.setRows([row("A","09:00","10:00",60,"end"),row("X","10:00","11:00"),row("B","11:00","12:00",60,"end")]);
api.clearDialogs();
api.resetEffects();
api.delete("X");
dialog = api.dialog();
assert.equal(dialog.title.children[1].textContent, "時間衝突", "尾端結束時間鎖定列可吸收來源移出後的不足時，必須出現候選燈箱");
assert.equal(Object.values(api.effects()).reduce((sum,value)=>sum+value,0), 0, "silent 候選試算成功不得保存、重繪或顯示提示");
dialog.actions.find(action=>action.text==="套用調整").run();
rows = api.rows();
assert.equal(rows.find(item=>item.id==="B").duration, 120, "尾端結束時間鎖定列本身未鎖定時長時必須可增加以完成刪除");

api.setRows([row("EDGE","04:00","05:00",60,"none",false,"TEST"),row("NEW","05:00","06:00",60,"none",false,"新增行程"),row("A","06:00","07:00",60,"end",false,"➔ 桃園機場｜二航"),row("B","07:00","09:30",160,"none",false,"辦理登機通關、安裝eSIM"),row("C","09:30","14:05",275,"start",false,"Flight")]);
api.clearDialogs();
api.delete("EDGE");
assert.equal(api.dialog(), undefined, "右側只有一個時間鎖定時，刪除前置行程必須以該鎖定向前推算，不得把原首筆開始時間誤判為衝突");
rows = api.rows();
assert.deepEqual(rows.map(item=>[item.id,item.start,item.end,item.duration]), [["NEW","05:00","06:00",60],["A","06:00","07:00",60],["B","07:00","09:30",160],["C","09:30","14:05",275]], "單一右側鎖定推算後必須直接完成刪除，且邊界外航班不變");

api.setRows([row("A","09:00","10:00",60,"start"),row("X","10:00","11:00"),row("C","11:00","12:00"),row("D","12:00","13:00",60,"start")]);
api.clearDialogs();
api.delete("X");
dialog = api.dialog();
assert.equal(dialog.actions.map(action=>action.text).join("、"), "套用調整、取消", "多個時間鎖定真的不相容時，只能調整時長或取消，不得提供只刪除不連動");
dialog.actions.find(action=>action.text==="套用調整").run();
rows = api.rows();
assert.equal(rows.find(item=>item.id==="A").duration, 120, "多鎖定衝突時必須仍可增加一筆未鎖定總時長以補足被刪除的分鐘數");

api.setRows([row("EDGE","00:00","01:00"),row("ONE","01:00","02:00"),row("TWO","02:00","05:00",180),row("THREE","05:00","06:00"),row("AIRPORT","06:00","09:30",210,"start")]);
api.clearDialogs();
api.delete("EDGE");
assert.equal(api.dialog(), undefined, "右側只有開始時間鎖定時，刪除前置行程必須由該開始時間向前推算，不得誤判衝突");
assert.deepEqual(api.rows().map(item=>[item.id,item.start,item.end]), [["ONE","01:00","02:00"],["TWO","02:00","05:00"],["THREE","05:00","06:00"],["AIRPORT","06:00","09:30"]], "右側開始時間鎖定必須保留，前方剩餘行程可改用新的鏈起點");

api.setRows([row("A","00:00","01:00"),row("X","01:00","02:00"),row("B","02:00","03:00")]);
api.clearDialogs();
api.delete("X");
assert.deepEqual(api.rows().map(item=>[item.id,item.start,item.end]), [["A","00:00","01:00"],["B","01:00","02:00"]], "完全沒有時間鎖定時，刪除後必須繼續以原首筆開始時間串接");
assert.doesNotMatch(source, /只刪除不連動/, "刪除流程不得再保留只刪除不連動功能");

api.setRows([row("FIRST","00:00","02:00",120),row("NEXT","02:00","01:00",1380,"end")]);
api.clearDialogs();
api.delete("FIRST");
assert.equal(api.dialog(), undefined, "只剩單一結束時間鎖定時，應由該鎖定向前推算，不得誤開補時燈箱");
assert.deepEqual(api.rows().map(item=>[item.id,item.start,item.end,item.duration]), [["NEXT","02:00","01:00",1380]], "單一結束時間鎖定的端點刪除不得改寫既有時長");

api.setRows([row("A","09:00","10:00"),row("PENDING","","",60,"none",true),row("B","10:00","11:00")]);
api.clearDialogs();
api.delete("PENDING");
assert.deepEqual(api.rows().map(item=>item.id), ["A","B"], "待放置行程刪除必須直接移除，不進入正式時間鏈調整");
assert.equal(api.dialog(), undefined, "待放置行程刪除不得開啟結構性時長燈箱");

api.setRows([row("A","09:00","10:00",60,"end"),row("X","10:00","11:00"),row("B","11:00","12:00",60,"end")]);
api.clearDialogs();
api.stage("X");
dialog = api.dialog();
assert.equal(dialog.title.children[1].textContent, "時間衝突", "移至暫存的來源鏈也必須將尾端結束時間鎖定列列為候選");
dialog.actions.find(action=>action.text==="套用調整").run();
assert.equal(api.rows().find(item=>item.id==="B").duration, 120, "確認後必須由尾端結束時間鎖定列吸收移至暫存的來源鏈不足");

api.setRows([row("A","09:00","10:00",60,"end"),row("X","10:00","11:00",60,"duration"),row("B","11:00","12:00",60,"end"),row("D","12:00","13:00",60,"duration")]);
api.clearDialogs();
api.reorder("day","D","B",false);
dialog = api.dialog();
assert.equal(dialog.title.children[1].textContent, "時間衝突", "排序鎖定區間的尾端結束時間列未鎖定時長時必須列為候選");
dialog.actions.find(action=>action.text==="套用調整").run();
assert.equal(api.rows().find(item=>item.id==="B").duration, 0, "排序區間超額時尾端結束時間鎖定列必須可縮短至可行時長");
assertTimeChain(api.rows(), "結束→結束候選套用後");

api.setRows([row("A","09:00","10:00",60,"start"),row("X","10:00","11:00"),row("B","11:00","12:00",60,"start")]);
api.clearDialogs();
api.stage("X");
dialog = api.dialog();
assert.equal(dialog.title.children[1].textContent, "時間衝突", "移至暫存造成來源時間鏈不足時應顯示共同候選燈箱");
dialog.actions.find(action=>action.text==="套用調整").run();
rows = api.rows();
assert.deepEqual(rows.map(item=>item.id), ["A","B"], "確認候選後應完成移至暫存操作");
assert.equal(rows.find(item=>item.id==="A").duration, 120, "移至暫存來源鏈不足時只能增加單一候選時長");

api.setRows([row("EDGE","04:00","05:00",60,"none",false,"123"),row("TEST","05:00","06:00",60,"none",false,"TEST"),row("A","06:00","07:00",60,"end",false,"➔ 桃園機場｜二航"),row("B","07:00","09:30",160,"none",false,"B"),row("C","09:30","14:05",275,"start",false,"Flight")]);
api.clearDialogs();
api.stage("EDGE");
assert.equal(api.dialog(),undefined,"移至暫存遇唯一右側結束時間鎖定時，必須以鎖定向前推算，不得誤開衝突燈箱");
rows=api.rows();
assert.deepEqual(rows.map(item=>[item.id,item.start,item.end,item.duration]),[["TEST","05:00","06:00",60],["A","06:00","07:00",60],["B","07:00","09:30",160],["C","09:30","14:05",275]],"移至暫存的單一右側鎖定必須保留，且邊界外行程不變");

api.setRows([row("EDGE","04:00","05:00",60,"none",false,"123"),row("TEST","05:00","06:00",60,"none",false,"TEST"),row("A","06:00","07:00",60,"start",false,"➔ 桃園機場｜二航"),row("B","07:00","09:30",160,"none",false,"B"),row("C","09:30","14:05",275,"start",false,"Flight")]);
api.clearDialogs();
const sourceDate=api.activeDate();
api.move("EDGE","2026-10-06");
assert.equal(api.dialog(),undefined,"移至其他日期遇唯一右側開始時間鎖定時，必須以鎖定向前推算，不得誤開衝突燈箱");
rows=api.rowsOn(sourceDate);
assert.deepEqual(rows.map(item=>[item.id,item.start,item.end,item.duration]),[["TEST","05:00","06:00",60],["A","06:00","07:00",60],["B","07:00","09:30",160],["C","09:30","14:05",275]],"移至其他日期後，來源單一右側鎖定必須保留且邊界外行程不變");
assert.deepEqual(api.rows().map(item=>[item.id,item.pending,item.start,item.end]),[["EDGE",true,"",""]],"移至其他日期後，目標日期必須以時間清空的待放置狀態接收行程");

api.setRows([row("A","08:00","09:00"),row("B","09:00","10:00")]);
api.stage("A");
api.moveStaging("A",api.activeDate());
assert.deepEqual(api.rows().map(item=>[item.id,item.pending,item.start,item.end]),[["A",true,"",""],["B",false,"08:00","09:00"]],"暫存區移至目前日期時，行程必須清空時間並插入最上方待放置，正式鏈仍以原首筆開始時間重算");
assert.match(source,/chooseDate\(target=>moveToDate\(area,row,target\),\{excludeCurrent:area==="day"\}\)/,"正式行程開啟日期選擇時必須排除目前日期");
assert.match(source,/button\.disabled=isCurrent;button\.title=isCurrent\?"目前日期，無法移動"/,"目前日期必須在日期燈箱中停用並提供原因");

api.setRows([row("TEST","04:00","06:00",120,"none",false,"TEST"),row("P","","",60,"none",true,"123"),row("A","06:00","07:00",60,"end",false,"A"),row("B","07:00","09:30",160,"none",false,"B"),row("C","09:30","14:05",275,"start",false,"C")]);
api.clearDialogs();
api.place("P");
dialog=api.dialog();
assert.equal(dialog.title.children[1].textContent,"時間衝突","放置跨越既有首列與結束鎖定時必須先顯示放置候選燈箱");
assert.equal(dialog.content.children[1].children[1],"時長，更新","放置候選必須使用調整／固定的第一段句型");
const modeWheel=dialog.content.children[1].children[0].children[0];
assert.deepEqual(modeWheel.children.map(item=>item.textContent),["調整","固定"],"放置同時有兩類可行候選時，第一段必須可切換調整與固定");
const placementWheel=dialog.content.children[1].children[2].children[0];
assert.deepEqual(placementWheel.children.map(item=>item.title),["TEST","123","A"],"調整方式的第二段只列可調整時長的行程");
modeWheel.children[1].listeners.click();
assert.equal(dialog.content.children[1].children[2].textContent,"所有時程","固定方式第二段必須顯示所有時程");
assert.match(dialog.content.children[2].children[0].children[1],/將保留各行程既有時長，更新放置區段內相關行程時間。/,"固定方式必須顯示相關行程時間連動摘要");
dialog.actions.find(action=>action.text==="套用調整").run();
rows=api.rows();
assert.deepEqual(rows.map(item=>[item.id,item.start,item.end,item.duration,item.pending]),[["TEST","03:00","05:00",120,false],["P","05:00","06:00",60,false],["A","06:00","07:00",60,false],["B","07:00","09:30",160,false],["C","09:30","14:05",275,false]],"保留時長重排只改放置鎖定區段，B／C 與既有衝突不得被改寫");

api.setRows([row("A","09:00","10:00",60,"start"),row("X","10:00","11:00"),row("B","11:00","12:00",60,"start")]);
api.clearDialogs();
api.move("X","2026-10-05");
dialog = api.dialog();
assert.equal(dialog.title.children[1].textContent, "時間衝突", "移至其他日期造成來源時間鏈不足時應顯示共同候選燈箱");
dialog.actions.find(action=>action.text==="套用調整").run();
assert.equal(api.rows().find(item=>item.id==="X").pending, true, "確認候選後應將行程移為目標日期的待放置項目");

api.setRows([row("A","13:20","14:20"),row("B","14:20","15:20",60,"end"),row("C","15:20","18:50",210,"start"),row("D","18:50","19:50",60,"duration")]);
api.clearDialogs();
api.reorder("day","D","C",false);
dialog = api.dialog();
assert.equal(dialog.title.className, "dialog-warning-title", "沒有未鎖定時長候選時必須顯示安全 DOM 的警告標題");
assert.equal(dialog.title.children[0].className, "fa-solid fa-triangle-exclamation dialog-warning-title-icon", "無候選警告標題必須包含黃色警示三角形圖示");
assert.equal(dialog.title.children[1].textContent, "時間衝突警告", "無候選警告標題文案必須正確");
assert.equal(dialog.content.children[0].textContent, "下方行程已鎖定，造成時間衝突：", "有實際時間鎖定時必須顯示鎖定原因標題");
assert.equal(dialog.content.children[1].children[0].children[0].className, "fa-solid fa-thumbtack pending-duration-no-candidates-icon", "每個鎖定原因必須各自以 thumbtack 圖示開頭");
assert.equal(dialog.content.children.at(-1).textContent, "目前沒有任一筆行程能單獨調整並符合安排，您的行程修改將復原。", "無候選時必須顯示核定的獨立復原說明");
assert.equal(dialog.actions.map(action=>action.text+":"+action.cls).join("|"), "我知道了:danger", "無候選警告必須只提供紅底的我知道了按鈕");
dialog.actions.find(action=>action.text==="我知道了").run();
assert.deepEqual(api.rows().map(item=>item.id), ["A","B","C","D"], "無候選確認必須回復排序前資料");
assert.equal(api.conflicts().length, 0, "無候選取消不得保存此次衝突或阻擋匯出");

api.setRows([row("A","09:00","10:00",60,"end"),row("P","","",90,"duration",true),row("B","11:00","12:00",60,"start")]);
api.clearDialogs();
api.place("P");
dialog = api.dialog();
assert.equal(dialog.title.children[1].textContent, "時間衝突警告", "待放置行程沒有候選時也必須顯示警告標題");
assert.equal(dialog.actions.map(action=>action.text+":"+action.cls).join("|"), "我知道了:danger", "待放置無候選也必須只提供紅底的我知道了按鈕");
dialog.actions.find(action=>action.text==="我知道了").run();
assert.equal(api.rows().find(item=>item.id==="P").pending, true, "待放置無候選確認必須維持原待放置資料");
assert.equal(api.conflicts().length, 0, "待放置無候選取消不得保存此次衝突或阻擋匯出");

api.setRows([row("A","09:00","10:00"),row("B","10:00","11:00",60,"start",false,"早餐"),row("C","11:00","12:00")]);
api.clearDialogs();
api.request("day","B","A",false);
dialog = api.dialog();
assert.equal(dialog.content, "由於「早餐」的「開始時間」已鎖定，因此時間連動會以該行程的「開始時間」為基礎更新其他行程。", "拖曳鎖定列前必須顯示正確確認文案");
assert.equal(dialog.actions.map(action=>action.text+":"+action.cls).join("|"), "我知道了:danger|取消移動:", "確認時間連動的我知道了必須為紅底危險按鈕，取消移動維持灰底");
assert.deepEqual(api.rows().map(item => item.id), ["A","B","C"], "尚未確認時不得套用排序");
dialog.actions.find(action => action.text === "我知道了").run();
assert.deepEqual(api.rows().map(item => item.id), ["B","A","C"], "確認後才套用鎖定拖曳列的排序");

api.setRows([row("A","09:00","10:00"),row("B","10:00","11:00",60,"end"),row("C","11:00","12:00")]);
api.clearDialogs();
api.request("day","B","A",false);
dialog = api.dialog();
assert.equal(dialog.content, "由於「此行程」的「結束時間」已鎖定，因此時間連動會以該行程的「結束時間」為基礎更新其他行程。", "空白內容的確認文案必須使用此行程");
dialog.actions.find(action => action.text === "取消移動").run();
assert.deepEqual(api.rows().map(item => item.id), ["A","B","C"], "取消移動必須保留原排序");
assert.equal(api.conflicts().length, 0, "取消移動不得建立衝突");

api.setRows([row("A","09:00","10:00"),row("B","10:00","11:00",60,"duration"),row("C","11:00","12:00")]);
api.clearDialogs();
api.request("day","B","A",false);
assert.equal(api.dialog(), undefined, "拖曳列只鎖定總時長時不得顯示排序確認燈箱");
assert.deepEqual(api.rows().map(item => item.id), ["B","A","C"], "總時長鎖定列仍應直接套用排序");

api.setRows([row("A","07:30","08:30"),row("B","08:30","16:50",500)]);
api.reorder("day","B","A",false);
rows = api.rows();
assert.deepEqual(rows.map(item => item.id), ["B","A"], "向上反推跨午夜時必須保留新排序");
assert.deepEqual(rows.map(item => [item.start,item.end]), [["07:30","15:50"],["15:50","16:50"]], "沒有鎖定時，跨午夜排序必須保留原首筆開始時間並重建完整時間鏈");
api.refresh();
assert.equal(api.conflicts().some(conflict=>conflict.date===api.activeDate()), false, "跨午夜排序不得在目前日期建立無效時間衝突");
assert.equal(api.exportBlocked(), true, "其他日期既有的原子衝突仍必須持續阻擋匯出");

api.setRows([row("A","09:00","10:00",60,"end"),row("P","","",90,"none",true,"待放置"),row("B","11:00","12:00",60,"start")]);
const beforePlacement = api.rows();
assert.equal(api.pendingTarget(beforePlacement,"P","P"), 60, "待放置列應提供唯一的非負時長，使兩端時間鎖定可同時成立");
assert.equal(api.pendingTarget(beforePlacement,"P","A"), null, "不影響兩端鎖定距離的候選列不得顯示為可行調整");
api.update("P", { duration:60 });
api.place("P");
rows = api.rows();
assert.deepEqual(rows.map(item => [item.id,item.start,item.end,item.duration,item.pending]), [["A","09:00","10:00",60,false],["P","10:00","11:00",60,false],["B","11:00","12:00",60,false]], "確認唯一候選後，待放置列應放置成功並保留兩端鎖定");

api.setRows([row("A","09:00","10:00",60,"start"),row("B","11:00","12:00",60,"start")]);
const startConflict = api.structural(0,"開始時間鎖定測試");
assert.equal(startConflict.requiredValue, "10:00", "遠端不相容開始時間鎖定的所需值必須是正確 HH:MM");

api.setRows([row("A","09:00","10:00",60,"end"),row("P","","",1500,"none",true,"超長待放置"),row("B","11:00","12:00",60,"start")]);
assert.equal(api.pendingTarget(api.rows(),"P","P"), null, "待放置行程的自動調整候選不得超過 1,440 分鐘");

api.setRows([row("A","09:00","10:00",60,"end"),row("P","","",90,"none",true,"待放置"),row("B","11:00","12:00",60,"start")]);
api.clearDialogs();
api.place("P");
dialog=api.dialog();
const invalidUnchangedTarget=dialog.content.children[1].children[2];
assert.equal(invalidUnchangedTarget.textContent,"待放置","保留既有時長無法滿足兩端鎖定時，唯一可行縮短候選應以靜態文字顯示");
dialog.actions.find(action=>action.text==="套用調整").run();
assert.deepEqual(api.rows().map(item=>[item.id,item.start,item.end,item.duration,item.pending]),[["A","09:00","10:00",60,false],["P","10:00","11:00",60,false],["B","11:00","12:00",60,false]],"套用唯一可行縮短候選後必須完成放置並維持兩端鎖定");

api.setRows([row("L","09:00","10:00",60,"end"),row("P","","",90,"none",true,"待放置"),row("R","11:00","12:00",60,"end")]);
const endLockedPlacement=api.rows();
assert.equal(api.pendingTarget(endLockedPlacement,"P","P"),60,"右側結束時間鎖定必須先扣除自身時長，以 10:00–11:00 的 60 分鐘計算待放置超額");
api.clearDialogs();
api.place("P");
dialog=api.dialog();
assert.deepEqual(dialog.content.children[1].children[2].children[0].children.map(item=>item.title),["待放置","此行程"],"兩側結束時間鎖定時必須只列出完整吸收 30 分鐘且通過 trial 的區段候選");
dialog.actions.find(action=>action.text==="套用調整").run();
assert.deepEqual(api.rows().map(item=>[item.id,item.start,item.end,item.duration,item.pending]),[["L","09:00","10:00",60,false],["P","10:00","11:00",60,false],["R","11:00","12:00",60,false]],"套用右側結束時間鎖定候選後必須完成放置並維持鎖定列");

api.setRows([row("L","09:00","10:00",60,"end"),row("P","","",60,"none",true,"待放置"),row("R","12:00","13:00",60,"start")]);
const surplusPlacement=api.rows();
assert.equal(api.pendingTarget(surplusPlacement,"P","P"),null,"可用區間大於待放置時長時不得把負差額轉成未批准的增加候選");
api.clearDialogs();
api.place("P");
dialog=api.dialog();
assert.equal(dialog.actions.some(action=>action.text==="套用調整"),false,"沒有縮短差額時不得顯示含增加候選的套用操作");
assert.deepEqual(api.rows().map(item=>[item.id,item.start,item.end,item.duration,item.pending]),[["L","09:00","10:00",60,false],["P","","",60,true],["R","12:00","13:00",60,false]],"未定義多餘分鐘分配時必須保留放置前資料，不改既有正式列");

api.setRows([row("FLIGHT","09:30","14:05",275,"start",false,"Flight"),row("P","","",60,"none",true,"123"),row("NEXT","14:05","15:35",90,"none",false,"後續行程")]);
const leftOnlyPlacement=api.rows();
assert.equal(api.pendingTarget(leftOnlyPlacement,"P","FLIGHT"),215,"左側開始時間鎖定區段的航班候選必須剛好吸收待放置 60 分鐘，不得任意縮短為 274");
assert.equal(api.pendingTarget(leftOnlyPlacement,"P","P"),0,"待放置列自身候選必須剛好吸收自身 60 分鐘為零");
api.clearDialogs();
api.place("P");
dialog=api.dialog();
assert.deepEqual(dialog.content.children[1].children[0].children[0].children.map(item=>item.textContent),["調整","固定"],"左側鎖定放置同時有兩類候選時必須先選調整或固定");
assert.deepEqual(dialog.content.children[1].children[2].children[0].children.map(item=>item.title),["Flight","123","後續行程"],"調整方式第二段必須列出區段內剛好吸收差額的行程");
const continuousDragWheel=dialog.content.children[1].children[2].children[0];
const selectedWheelTitle=()=>continuousDragWheel.children.find(item=>item.className.includes("selected")).title,trackpadEvent=(deltaY,timeStamp)=>({deltaY,timeStamp,preventDefault(){}});
assert.equal(selectedWheelTitle(),"Flight","觸控板滑動前必須維持原選取");
continuousDragWheel.scrollTop=40;
continuousDragWheel.listeners.scroll({});
continuousDragWheel.listeners.scrollend({});
assert.equal(selectedWheelTitle(),"123","觸控板滑過一列後，停止時必須選取最近候選");
continuousDragWheel.scrollTop=-200;
continuousDragWheel.listeners.scroll({});
continuousDragWheel.listeners.scrollend({});
assert.equal(selectedWheelTitle(),"Flight","滑到頂端後必須停在第一個候選，不可循環到末端");
continuousDragWheel.scrollTop=200;
continuousDragWheel.listeners.scroll({});
continuousDragWheel.listeners.scrollend({});
assert.equal(selectedWheelTitle(),"後續行程","滑到底端後必須停在最後候選，不可循環到開頭");
continuousDragWheel.listeners.pointerdown({clientY:100,pointerId:7});
assert.equal(continuousDragWheel.captured,undefined,"按下候選但尚未拖曳時不得捕捉指標，以保留子按鈕 click");
continuousDragWheel.listeners.pointermove({clientY:65,pointerId:7});
assert.equal(continuousDragWheel.captured,true,"跨過拖曳門檻後才應捕捉指標");
assert.equal(dialog.content.children[1].children[2].children[0],continuousDragWheel,"拖曳切換時必須保留同一個滾輪節點");
continuousDragWheel.listeners.pointermove({clientY:30,pointerId:7});
assert.equal(dialog.content.children[1].children[2].children[0],continuousDragWheel,"連續拖曳時不得卸載已捕捉指標的滾輪");
continuousDragWheel.listeners.pointerup({});

api.setRows([row("A","09:00","10:00",60,"end",false,"超過二十個字的前方鎖定行程名稱"),row("P","","",90,"none",true,"這是一個超過二十個中文字元的待放置行程候選名稱"),row("B","11:00","12:00",60,"start",false,"超過二十個字的後方鎖定行程名稱")]);
api.openPending("P",api.rows());
dialog = api.dialog();
assert.equal(dialog.title.children[1].textContent, "時間衝突", "待放置時長燈箱標題必須為時間衝突");
assert.equal(dialog.content.children[0].textContent, "由於", "衝突原因開頭必須保留連接詞而不加下底線");
assert.equal(dialog.content.children[0].children[0].textContent, "「超過二十個字的前方鎖定行程名稱」的「結束時間」", "衝突原因必須列出實際相關鎖定行程與欄位");
assert.equal(dialog.content.children[0].children[1].textContent, "及", "連接詞不得套入鎖定行程下底線區段");
assert.equal(dialog.content.children[0].children[2].textContent, "「超過二十個字的後方鎖定行程名稱」的「開始時間」", "第二個實際鎖定條件必須另列可標示區段");
assert.equal(dialog.content.children[0].children[3].textContent, "已鎖定，造成時間衝突，請選擇一項您希望的調整方式來完成安排。", "標點及結語不得套入鎖定行程下底線區段");
assert.equal(dialog.content.children[1].children[1], "時長，更新", "放置燈箱必須使用調整／固定句型");
assert.equal(dialog.content.children[1].children[3], "的時間。", "放置說明必須在第二段滾輪右側同一行完成");
assert.deepEqual(Array.from(dialog.actions, action=>action.text), ["套用調整","取消放置"], "候選燈箱按鈕順序必須是套用後取消");
const staticCandidate = dialog.content.children[1].children[2];
assert.equal(staticCandidate.textContent, "這是一個超過二十個中文字元的待放置行程候...", "唯一候選名稱超過 20 字時必須截斷顯示");
const resultName=dialog.content.children[2].children[0].children[1];assert.equal(resultName.children[0].textContent,"這是一個超", "結果區長名稱必須固定保留前五字");assert.equal(resultName.children[1].textContent,"過二十個中文字元的待放置行程候", "結果區長名稱最多呈現至第二十字");assert.equal(resultName.children[2].textContent,"...", "結果區長名稱必須以省略號表示可收合部分");
assert.equal(dialog.content.children[2].title, "這是一個超過二十個中文字元的待放置行程候選名稱", "顯示結果完整名稱必須保留於 title");

const directBoundary = () => ({id:"direct-boundary",date:api.activeDate(),lockedRowId:"B",lockedField:"",lockedValue:"",requiredValue:"",operation:"保留衝突",directRowId:"B",directField:"end",directContext:{chainRowIds:["A","B","C","D"]},boundary:{leftRowId:"B",rightRowId:"C",owner:"right"}});
api.setRows([row("A","09:00","10:00"),row("B","10:00","11:00",60,"none",false,"B"),row("C","13:00","14:00",60,"none",false,"C"),row("D","14:00","15:00",60,"none",false,"D")],[directBoundary()]);
api.clearDialogs();
api.reorder("day","B","C",true);
assert.equal(api.rows().map(item=>item.id).join("、"), "A、B、C、D", "未解決衝突邊界不可跨越排序，原排序必須保留");
assert.equal(api.dialog().title, "時間無法連動修改", "跨越衝突邊界時必須顯示指定提示燈箱");

api.setRows([row("A","09:00","10:00"),row("B","10:00","11:00",60,"none",false,"B"),row("C","13:00","14:00",60,"none",false,"C"),row("D","14:00","15:00",60,"none",false,"D")],[directBoundary()]);
api.delete("C");
rows=api.rows();
assert.deepEqual(rows.map(item=>[item.id,item.start,item.end]), [["A","09:00","10:00"],["B","10:00","11:00"],["D","13:00","14:00"]], "移除非衝突來源的右鏈首筆時，只能重算右鏈並保留左側時間");
assert.deepEqual(api.conflicts()[0].boundary, {leftRowId:"B",rightRowId:"D",owner:"right"}, "移除邊界端點後，衝突邊界必須移到同側新的相鄰行程");

api.setRows([row("A","09:00","10:00"),row("B","10:00","11:00",60,"none",false,"B"),row("P","","",60,"none",true,"P"),row("C","13:00","14:00",60,"none",false,"C"),row("D","14:00","15:00",60,"none",false,"D")],[directBoundary()]);
api.place("P");
rows=api.rows();
assert.deepEqual(rows.find(item=>item.id==="P")&&[rows.find(item=>item.id==="P").start,rows.find(item=>item.id==="P").end,rows.find(item=>item.id==="P").pending], ["12:00","13:00",false], "黃色來源在左側時，待放置行程必須歸右鏈並以右側開始時間反推");
assert.deepEqual(api.conflicts()[0].boundary, {leftRowId:"B",rightRowId:"P",owner:"right"}, "待放置行程接入右鏈後，衝突必須移到左側與待放置行程之間");

api.setRows([row("A","09:00","10:00"),row("B","10:00","11:00",60,"none",false,"B"),row("C","13:00","14:00",60,"none",false,"C"),row("D","14:00","15:00",60,"none",false,"D")],[directBoundary()]);
api.clearDialogs();
api.delete("B");
dialog=api.dialog();
assert.equal(dialog.title, "選擇時間基準", "移除衝突來源且沒有時間鎖定時，必須先要求選擇左右時間基準");
dialog.actions.find(action=>action.text==="套用調整").run();
rows=api.rows();
assert.deepEqual(rows.map(item=>[item.id,item.start,item.end]), [["A","09:00","10:00"],["C","10:00","11:00"],["D","11:00","12:00"]], "選擇左側基準後，移除衝突來源必須完成全鏈重算");
assert.equal(api.conflicts().some(conflict=>conflict.date===api.activeDate()), false, "移除衝突來源並成功重連後，目前日期的原衝突必須解除");

api.setRows([row("A","09:00","10:00"),row("B","10:00","11:00",60,"none",false,"B"),row("C","13:00","14:00",60,"start",false,"C"),row("D","14:00","15:00",60,"none",false,"D")],[directBoundary()]);
api.clearDialogs();
api.delete("B");
dialog=api.dialog();
assert.equal(dialog.title, "時間連動", "移除衝突來源且只有單側時間鎖定時，必須先顯示鎖定基準告知");
assert.match(dialog.content, /因為「C」的「開始時間」已鎖定，將以此更新所有行程時間。/, "單側鎖定告知必須指出實際行程與欄位");
dialog.actions.find(action=>action.text==="我知道了").run();
rows=api.rows();
assert.deepEqual(rows.map(item=>[item.id,item.start,item.end]), [["A","12:00","13:00"],["C","13:00","14:00"],["D","14:00","15:00"]], "確認單側鎖定後，必須以該鎖定向前後完成全鏈重算");

console.log("reorder time anchor and circular-time regression test passed");
