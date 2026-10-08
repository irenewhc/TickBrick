import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("script.js", "utf8");
const styles = fs.readFileSync("style.css", "utf8");
const logic = source.slice(source.indexOf("function getList"), source.indexOf("function openCalendar"));
const context = { structuredClone, setTimeout: () => 0, clearTimeout: () => {}, requestAnimationFrame: callback => callback(), document:{createElement(tag){const listeners={},states={};return{tagName:tag,className:"",textContent:"",children:[],listeners,states,append(...items){this.children.push(...items);},addEventListener(type,callback){listeners[type]=callback;},appendChild(item){this.children.push(item);},setAttribute(){},classList:{toggle(name,enabled){states[name]=enabled;}},setPointerCapture(){this.captured=true;}};}} };

assert.match(source, /pending-duration-wheel[\s\S]*?role","listbox/, "待放置時長候選必須使用自訂單欄 listbox 滾輪，而非原生 select");
assert.match(source, /wheel\.addEventListener\("wheel"/, "候選滾輪必須支援滑鼠滾輪切換");
assert.match(source, /pointermove[\s\S]*?keydown/, "候選滾輪必須支援拖曳與鍵盤切換");
assert.match(source, /openDialog\("時間衝突",content/, "候選燈箱標題必須為「時間衝突」");
assert.match(source, /text:"套用調整"[\s\S]*?text:cancelText/, "共用候選燈箱按鈕必須同列保留「套用調整」及可依操作切換的取消動作");
assert.match(source, /cause=locked\.length\?"由於"/, "候選燈箱必須依實際時間鎖定組成衝突原因");
assert.match(source, /displayName=value=>value\.length>20\?value\.slice\(0,20\)\+"\.\.\.":value/, "候選與結果名稱必須統一截斷為最多 20 字加省略號");
assert.match(source, /wheel\.scrollTop=selected\*34/, "切換候選時必須以列高捲動，讓首尾候選都可置於固定中央位置");
assert.match(source, /content\.append\(reason,adjustment,preview\);requestAnimationFrame\(\(\)=>select\(0\)\)/, "初始選取必須在滾輪掛入燈箱後執行，才能正確置中");
assert.match(source, /pointerdown",event=>\{dragStart=event\.clientY;dragging=false;\}/, "一般點選開始時不得立即取得指標捕捉");
assert.match(source, /if\(!dragging\)\{wheel\.setPointerCapture\?\.\(event\.pointerId\);dragging=true;\}/, "只有實際拖曳跨過門檻後才可取得指標捕捉");
assert.match(source, /option\.title=fullName;option\.textContent=name/, "滾輪候選必須保留完整 title，畫面只顯示截斷名稱");
assert.match(source, /part\.className="pending-duration-lock"/, "每段相關鎖定行程及欄位必須能單獨套用醒目樣式");
assert.doesNotMatch(source, /preview\.textContent="顯示結果：/, "結果文字不得再顯示「顯示結果：」前綴");
assert.match(styles, /\.pending-duration-wheel\s*\{[^}]*width:\s*220px;[^}]*height:\s*102px;[^}]*display:\s*inline-block;[^}]*\}/, "滾輪本身必須固定完整顯示上／中／下三列");
assert.doesNotMatch(styles, /\.pending-duration-wheel\s*\{[^}]*padding-block/, "滾輪本身不得以可捲動 padding 製造留白");
assert.match(styles, /\.pending-duration-wheel::before,[\s\S]*?\.pending-duration-wheel::after\s*\{[\s\S]*?height:\s*34px/, "滾輪內容首尾必須各有一列高 spacer，讓首尾候選仍可置中");
assert.match(styles, /\*\s*\{\s*box-sizing:\s*border-box;/, "全域邊界盒規則必須持續套用，讓調整行高度包含上下留白");
assert.match(styles, /:root\s*\{[\s\S]*?--color-purple-50:\s*#f0f4fd;/, "應提供待放置滾輪選取列使用的淡紫色 token");
assert.match(styles, /\.pending-duration-option\.selected\s*\{[^}]*background:\s*var\(--color-purple-50\)/, "選取候選列應使用 purple-50 背景");
assert.match(styles, /\.pending-duration-adjustment\s*\{[\s\S]*?height:\s*150px;[\s\S]*?padding-block:\s*24px/, "調整行必須以 150px 高度包含外層固定 24px 上下留白，切換候選不改變視覺留白");
assert.match(styles, /\.pending-duration-wheel\s*\{[\s\S]*?border:\s*0;/, "滾輪容器不得有外框");
assert.doesNotMatch(styles, /\.pending-duration-option\.selected\s*\{[^}]*border-(?:top|bottom)/, "選取候選只能以淡紫底色標示，不得保留上下框");
assert.match(styles, /\.pending-duration-result\s*\{[\s\S]*?color:\s*var\(--color-red\)/, "結果文字必須使用紅色 token");
assert.match(styles, /\.pending-duration-result\s*\{[\s\S]*?align-items:\s*flex-start;[\s\S]*?height:\s*68px/, "固定高度的結果區應從頂端排列文字，避免一、兩行文字置中跳動");
assert.match(styles, /\.pending-duration-lock\s*\{[\s\S]*?color:\s*var\(--color-purple-800\);[\s\S]*?font-weight:\s*500/, "鎖定行程與欄位必須使用深紫色與 500 字重，不加下底線");
assert.doesNotMatch(styles, /\.pending-duration-lock\s*\{[^}]*text-decoration/, "鎖定行程與欄位不得保留下底線");
assert.match(styles, /\.pending-duration-reason\s*\{\s*margin:\s*0\s*\}/, "衝突原因必須自然完整呈現，不得限制高度或隱藏溢位");
assert.match(styles, /\.app-dialog\s*\{[\s\S]*?padding:\s*40px;/, "燈箱內距必須調整為 40px");
assert.match(styles, /\.dialog-actions\.pending-duration-actions\s*\{[\s\S]*?flex-wrap:\s*nowrap;[\s\S]*?justify-content:\s*flex-end/, "候選燈箱按鈕必須固定同列靠右");

vm.createContext(context);
vm.runInContext(`
 let state={activeDate:"2026-10-04",dates:["2026-10-04"],days:{"2026-10-04":[]},staging:[],conflicts:[]};
 let draggedRow=null,effects={persist:0,render:0,toast:0};
 function makeId(){return "conflict-"+Math.random();}
 function activeRows(){return state.days[state.activeDate];}
 function validDate(){return true;}
 function calendarMonthFor(){return {};}
 function dateLabel(value){return value;}
 function persist(){effects.persist++;}
 function render(){effects.render++;}
 function showToast(){effects.toast++;}
 function presentOperationConflict(){}
 let dialogs=[];
 function openDialog(title,content,actions){dialogs.push({title,content,actions});}
 ${logic}
 globalThis.api={
  setRows(rows){state.days[state.activeDate]=structuredClone(rows);state.conflicts=[];},
  rows(){return structuredClone(state.days[state.activeDate]);},
  conflicts(){return structuredClone(state.conflicts);},
  refresh(){refreshConflicts();},
  exportBlocked(){refreshConflicts();return state.conflicts.length>0;},
  update(id,patch){Object.assign(state.days[state.activeDate].find(row=>row.id===id),patch);},
  reorder:reorderRow,
  request:requestReorder,
  stage(id){moveRowToStaging(state.days[state.activeDate].find(item=>item.id===id));},
  delete(id){deleteRowWithAdjustment("day",id);},
  move(id,target){moveToDate("day",state.days[state.activeDate].find(item=>item.id===id),target);},
  effects(){return {...effects};},
  resetEffects(){effects={persist:0,render:0,toast:0};},
  place(id){placePending(state.days[state.activeDate].find(item=>item.id===id));},
  pendingTarget:pendingDurationTarget,
  reorderCandidates(rows,conflict){return reorderCandidateIds(rows,conflict);},
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

const boundaryRows = (firstLock,lastLock) => [row("F","09:00","10:00",60,firstLock),row("M","10:00","11:00"),row("L","11:00","12:00",60,lastLock)];
assert.deepEqual(api.reorderCandidates(boundaryRows("start","start"),{anchorRowId:"F",lockedRowId:"L"}), ["F","M"], "開始→開始的排序候選必須包含前端開始鎖定列與中間列，排除尾端開始鎖定列");
assert.deepEqual(api.reorderCandidates(boundaryRows("start","end"),{anchorRowId:"F",lockedRowId:"L"}), ["F","M","L"], "開始→結束的排序候選必須包含前端開始鎖定列、中間列與尾端結束鎖定列");
assert.deepEqual(api.reorderCandidates(boundaryRows("end","start"),{anchorRowId:"F",lockedRowId:"L"}), ["M"], "結束→開始的排序候選只能包含中間列");
assert.deepEqual(api.reorderCandidates(boundaryRows("end","end"),{anchorRowId:"F",lockedRowId:"L"}), ["M","L"], "結束→結束的排序候選必須包含中間列與尾端結束鎖定列");

api.setRows([row("A","07:30","08:30"),row("B","08:30","09:30")]);
api.reorder("day","B","A",false);
let rows = api.rows();
assert.deepEqual(rows.map(item => item.id), ["B","A"], "拖到最上方必須置於原首列前方");
assert.deepEqual(rows.map(item => [item.start,item.end]), [["06:30","07:30"],["07:30","08:30"]], "最上方排序必須保留後方原首列時間並向上反推拖曳列");

api.setRows([row("A","07:30","08:30"),row("B","08:30","09:30"),row("C","09:30","10:30"),row("D","10:30","11:30")]);
api.reorder("day","C","A",false);
rows = api.rows();
assert.deepEqual(rows.map(item => item.id), ["C","A","B","D"], "四列情境拖到最上方必須維持正確順序");
assert.deepEqual(rows.map(item => [item.start,item.end]), [["06:30","07:30"],["07:30","08:30"],["08:30","09:30"],["09:30","10:30"]], "最上方反推後必須繼續向下重算完整正式時間鏈");

api.setRows([row("A","07:30","08:30"),row("B","08:30","09:30"),row("C","09:30","10:30")]);
api.reorder("day","C","B",false);
rows = api.rows();
assert.deepEqual(rows.map(item => item.id), ["A","C","B"], "中間插入必須保留指定順序");
assert.deepEqual(rows.map(item => [item.start,item.end]), [["07:30","08:30"],["08:30","09:30"],["09:30","10:30"]], "中間插入必須保留前方錨點並向下串接");

api.setRows([row("A","07:30","08:30"),row("B","08:30","09:30"),row("C","09:30","10:30")]);
api.reorder("day","A","B",true);
rows = api.rows();
assert.deepEqual(rows.map(item => item.id), ["B","A","C"], "向下拖曳必須置於目標列後方");
assert.deepEqual(rows.map(item => [item.start,item.end]), [["08:30","09:30"],["09:30","10:30"],["10:30","11:30"]], "向下拖曳必須保留前方錨點並重算拖曳列及其後行程");

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
assert.deepEqual(rows.map(item => [item.id,item.start,item.end]), [["A","22:30","23:30"],["D","23:30","00:30"],["L","00:30","02:30"]], "鎖定時間錨點跨午夜時必須使用 24 小時循環");

api.setRows([row("A","13:20","14:20"),row("B","14:20","15:20",60,"end"),row("C","15:20","18:50",210,"start"),row("D","18:50","19:50")]);
api.reorder("day","D","C",false);
let dialog = api.dialog();
assert.equal(dialog.title, "時間衝突", "排序遇到可由單列吸收的鎖定衝突時，應顯示共用調整燈箱");
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
assert.equal(dialog.title, "時間衝突", "錨點後方鎖定時間要求較早時必須顯示排序時長候選");
dialog.actions.find(action=>action.text==="套用調整").run();
rows = api.rows();
assert.equal(rows.filter(item=>["A","B","D"].includes(item.id)).some(item=>item.duration===0), true, "錨點後方的鎖定區間超額必須縮短候選，不得以增加 1,440 分鐘掩蓋衝突");
assertTimeChain(rows, "開始→開始候選套用後");

api.setRows([row("A","09:00","10:00",60,"start"),row("B","10:00","11:00"),row("C","11:00","12:00",60,"end"),row("D","12:00","13:00")]);
api.clearDialogs();
api.reorder("day","D","A",true);
dialog = api.dialog();
assert.equal(dialog.title, "時間衝突", "開始→結束鎖定區間的排序衝突必須提供涵蓋兩端的候選");
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
assert.equal(dialog.title, "時間衝突", "刪除造成來源時間鏈不足時應顯示共同候選燈箱");
dialog.actions.find(action=>action.text==="套用調整").run();
rows = api.rows();
assert.deepEqual(rows.map(item=>item.id), ["A","B"], "確認候選後應完成原刪除操作");
assert.equal(rows.find(item=>item.id==="A").duration, 120, "刪除來源鏈不足時只能增加單一候選時長以保留鎖定");

api.setRows([row("A","09:00","10:00",60,"end"),row("X","10:00","11:00"),row("B","11:00","12:00",60,"end")]);
api.clearDialogs();
api.resetEffects();
api.delete("X");
dialog = api.dialog();
assert.equal(dialog.title, "時間衝突", "尾端結束時間鎖定列可吸收來源移出後的不足時，必須出現候選燈箱");
assert.equal(Object.values(api.effects()).reduce((sum,value)=>sum+value,0), 0, "silent 候選試算成功不得保存、重繪或顯示提示");
dialog.actions.find(action=>action.text==="套用調整").run();
rows = api.rows();
assert.equal(rows.find(item=>item.id==="B").duration, 120, "尾端結束時間鎖定列本身未鎖定時長時必須可增加以完成刪除");

api.setRows([row("A","09:00","10:00",60,"end"),row("X","10:00","11:00"),row("B","11:00","12:00",60,"end")]);
api.clearDialogs();
api.stage("X");
dialog = api.dialog();
assert.equal(dialog.title, "時間衝突", "移至暫存的來源鏈也必須將尾端結束時間鎖定列列為候選");
dialog.actions.find(action=>action.text==="套用調整").run();
assert.equal(api.rows().find(item=>item.id==="B").duration, 120, "確認後必須由尾端結束時間鎖定列吸收移至暫存的來源鏈不足");

api.setRows([row("A","09:00","10:00",60,"end"),row("X","10:00","11:00",60,"duration"),row("B","11:00","12:00",60,"end"),row("D","12:00","13:00",60,"duration")]);
api.clearDialogs();
api.reorder("day","D","B",false);
dialog = api.dialog();
assert.equal(dialog.title, "時間衝突", "排序鎖定區間的尾端結束時間列未鎖定時長時必須列為候選");
dialog.actions.find(action=>action.text==="套用調整").run();
assert.equal(api.rows().find(item=>item.id==="B").duration, 0, "排序區間超額時尾端結束時間鎖定列必須可縮短至可行時長");
assertTimeChain(api.rows(), "結束→結束候選套用後");

api.setRows([row("A","09:00","10:00",60,"start"),row("X","10:00","11:00"),row("B","11:00","12:00",60,"start")]);
api.clearDialogs();
api.stage("X");
dialog = api.dialog();
assert.equal(dialog.title, "時間衝突", "移至暫存造成來源時間鏈不足時應顯示共同候選燈箱");
dialog.actions.find(action=>action.text==="套用調整").run();
rows = api.rows();
assert.deepEqual(rows.map(item=>item.id), ["A","B"], "確認候選後應完成移至暫存操作");
assert.equal(rows.find(item=>item.id==="A").duration, 120, "移至暫存來源鏈不足時只能增加單一候選時長");

api.setRows([row("A","09:00","10:00",60,"start"),row("X","10:00","11:00"),row("B","11:00","12:00",60,"start")]);
api.clearDialogs();
api.move("X","2026-10-05");
dialog = api.dialog();
assert.equal(dialog.title, "時間衝突", "移至其他日期造成來源時間鏈不足時應顯示共同候選燈箱");
dialog.actions.find(action=>action.text==="套用調整").run();
assert.equal(api.rows().find(item=>item.id==="X").pending, true, "確認候選後應將行程移為目標日期的待放置項目");

api.setRows([row("A","13:20","14:20"),row("B","14:20","15:20",60,"end"),row("C","15:20","18:50",210,"start"),row("D","18:50","19:50",60,"duration")]);
api.clearDialogs();
api.reorder("day","D","C",false);
dialog = api.dialog();
assert.equal(dialog.title, "時間衝突", "沒有未鎖定時長候選時仍應說明衝突原因");
dialog.actions.find(action=>action.text==="取消").run();
assert.deepEqual(api.rows().map(item=>item.id), ["A","B","C","D"], "無候選取消必須回復排序前資料");
assert.equal(api.conflicts().length, 0, "無候選取消不得保存此次衝突或阻擋匯出");

api.setRows([row("A","09:00","10:00",60,"end"),row("P","","",90,"duration",true),row("B","11:00","12:00",60,"start")]);
api.clearDialogs();
api.place("P");
dialog = api.dialog();
assert.equal(dialog.title, "時間衝突", "待放置行程沒有可單列調整候選時仍應只顯示原因與取消");
dialog.actions.find(action=>action.text==="取消放置").run();
assert.equal(api.rows().find(item=>item.id==="P").pending, true, "待放置無候選取消必須維持原待放置資料");
assert.equal(api.conflicts().length, 0, "待放置無候選取消不得保存此次衝突或阻擋匯出");

api.setRows([row("A","09:00","10:00"),row("B","10:00","11:00",60,"start",false,"早餐"),row("C","11:00","12:00")]);
api.clearDialogs();
api.request("day","B","A",false);
dialog = api.dialog();
assert.equal(dialog.content, "由於「早餐」的「開始時間」已鎖定，因此時間連動會以該行程的「開始時間」為基礎更新其他行程。", "拖曳鎖定列前必須顯示正確確認文案");
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
assert.deepEqual(rows.map(item => [item.start,item.end]), [["23:10","07:30"],["07:30","08:30"]], "向上反推跨午夜必須以 24 小時循環保留後方錨點");
api.refresh();
assert.equal(api.conflicts().length, 0, "跨午夜排序不得建立無效時間衝突");
assert.equal(api.exportBlocked(), false, "只有鎖定衝突才能阻擋匯出");

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
assert.equal(api.pendingTarget(api.rows(),"P","P"), 1500, "循環時間下原本可行的超過 1,440 分鐘時長必須保留，不得隱性縮為較小值");

api.setRows([row("A","09:00","10:00",60,"end",false,"超過二十個字的前方鎖定行程名稱"),row("P","","",90,"none",true,"這是一個超過二十個中文字元的待放置行程候選名稱"),row("B","11:00","12:00",60,"start",false,"超過二十個字的後方鎖定行程名稱")]);
api.openPending("P",api.rows());
dialog = api.dialog();
assert.equal(dialog.title, "時間衝突", "待放置時長燈箱標題必須為時間衝突");
assert.equal(dialog.content.children[0].textContent, "由於", "衝突原因開頭必須保留連接詞而不加下底線");
assert.equal(dialog.content.children[0].children[0].textContent, "「超過二十個字的前方鎖定行程名稱」的「結束時間」", "衝突原因必須列出實際相關鎖定行程與欄位");
assert.equal(dialog.content.children[0].children[1].textContent, "及", "連接詞不得套入鎖定行程下底線區段");
assert.equal(dialog.content.children[0].children[2].textContent, "「超過二十個字的後方鎖定行程名稱」的「開始時間」", "第二個實際鎖定條件必須另列可標示區段");
assert.equal(dialog.content.children[0].children[3].textContent, "已鎖定，造成時間衝突。", "標點及結語不得套入鎖定行程下底線區段");
assert.equal(dialog.content.children[1].textContent, "請調整 ", "滾輪必須內嵌於調整時長句型中");
assert.equal(dialog.content.children[1].children[1].textContent, " 時長，以便放置行程。", "調整時長與放置說明必須在滾輪右側同一行完成");
assert.deepEqual(Array.from(dialog.actions, action=>action.text), ["套用調整","取消放置"], "候選燈箱按鈕順序必須是套用後取消");
const wheel = dialog.content.children[1].children[0], clickedOption = wheel.children[0];
assert.equal(clickedOption.textContent, "這是一個超過二十個中文字元的待放置行程候...", "候選名稱超過 20 字時必須截斷顯示");
assert.equal(clickedOption.title, "這是一個超過二十個中文字元的待放置行程候選名稱", "候選名稱完整內容必須保留於 title");
wheel.listeners.pointerdown({clientY:100,pointerId:7});
assert.equal(wheel.captured, undefined, "按下候選但尚未拖曳時不得捕捉指標，以保留子按鈕 click");
clickedOption.states.selected = false;
clickedOption.listeners.click();
assert.equal(clickedOption.states.selected, true, "未拖曳的候選點選必須直接更新選取列");
assert.match(dialog.content.children[2].textContent, /^「這是一個超過二十個中文字元的待放置行程候\.\.\.」總時長：/, "結果名稱必須與候選統一截斷，且不再顯示前綴");
assert.equal(dialog.content.children[2].title, "這是一個超過二十個中文字元的待放置行程候選名稱", "顯示結果完整名稱必須保留於 title");
wheel.listeners.pointerdown({clientY:100,pointerId:8});
wheel.listeners.pointermove({clientY:65,pointerId:8});
assert.equal(wheel.captured, true, "跨過拖曳門檻後才應捕捉指標，維持拖曳切換");
wheel.listeners.pointerup({});

console.log("reorder time anchor and circular-time regression test passed");
