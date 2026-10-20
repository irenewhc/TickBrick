/* 行程資料以日期分頁，並保存到目前瀏覽器的 localStorage。 */
const STORAGE_KEY = "tickbrick_trip_v1";
const LEGACY_KEY = "hokkaido_itinerary_v47";
const DEFAULT_CATEGORIES = [{name:"交通",color:"#e3f8eb"},{name:"逛街",color:"#ffe1e1"},{name:"景點",color:"#e4eafb"},{name:"用餐",color:"#fcffc2"},{name:"其他",color:"#e6e6e6"}];
const INITIAL_ROWS = [
 ["06:30","07:30",60,"交通","➔ 桃園機場"],["07:30","09:30",120,"","辦理登機通關"],["09:30","13:05",215,"","Flight to SAPPORO (長榮 BR 116)"],
 ["13:05","14:30",85,"","抵達新千歲機場，辦理入境通關與提取行李"],["14:30","15:30",60,"交通","機場 ➔ 旅館（HELIO HOSTEL）"],
 ["15:30","16:00",30,"","旅館辦理 Check-in"],["16:00","18:00",120,"景點","北海道廳紅磚廳舍 ＆ 札幌市資料館"],
 ["18:00","19:00",60,"用餐","大通公園周邊湯咖哩"],["19:00","21:00",120,"逛街","東急百貨店(va、JOUETE)、BIC CAMERA"]
];
let state=loadState();
let activeCalendarMonth=state.activeDate?calendarMonthFor(state.activeDate):new Date(2026,9,1);
let draggedRow=null, autosaveTimer, calendarCreateMode=false, touchDrag=null, touchCandidate=null, touchClickUntil=0;
let exportLogoPromise, exportLogoFallbackNotified=false;

/* 建立含未解決衝突欄位的空白應用程式狀態。 */
function blankState(){return{version:2,dates:[],activeDate:"",days:{},staging:[],categories:DEFAULT_CATEGORIES.map(x=>({...x})),conflicts:[]};}
/* 產生供行程列識別與操作使用的短唯一 ID。 */
function makeId(){return"r"+Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
/* 建立行程列，保留 0 分鐘時長、待確認預設值並以 60 分鐘補足缺值。 */
function makeRow(date,start,end,duration,category,content){return{id:makeId(),date:date||"",start:start||"",end:end||"",duration:durationValue(duration),lock:"none",category:category||"",content:content||"",confirmed:false,pending:false};}
/* 載入目前或舊版瀏覽器資料，並交由正規化流程補齊待確認欄位。 */
function loadState(){
 try{
  const current=localStorage.getItem(STORAGE_KEY);if(current)return normalizeState(JSON.parse(current));
  const legacy=localStorage.getItem(LEGACY_KEY);
  if(legacy){const migrated=blankState();JSON.parse(legacy).forEach(old=>{const date=old.date||"2026-10-29";if(!migrated.days[date]){migrated.days[date]=[];migrated.dates.push(date);}migrated.days[date].push({...old,id:old.id||makeId(),date,confirmed:!!old.confirmed,pending:false});});migrated.dates.sort();migrated.activeDate=migrated.dates[0]||"";const normalized=normalizeState(migrated);localStorage.setItem(STORAGE_KEY,JSON.stringify(normalized));return normalized;}
 }catch(error){console.error("行程資料讀取失敗",error);}
 const initial=blankState(),date="2026-10-29";initial.dates=[date];initial.activeDate=date;initial.days[date]=INITIAL_ROWS.map(r=>makeRow(date,...r));return initial;
}
/* 將舊版或匯入資料正規化為含衝突與待確認保存資訊的目前狀態格式。 */
function normalizeState(input){
 const result=blankState();
 if(Array.isArray(input)){input.forEach(row=>{const date=row.date||"2026-10-29";if(!result.days[date]){result.days[date]=[];result.dates.push(date);}result.days[date].push({...row,id:row.id||makeId(),date,confirmed:!!row.confirmed,pending:false});});result.dates.sort();result.activeDate=result.dates[0]||"";return rebuildAutomaticConflicts(result);}
 result.version=input.version||1;result.dates=Array.isArray(input.dates)?[...new Set(input.dates.filter(validDate))]:[];
 result.activeDate=result.dates.includes(input.activeDate)?input.activeDate:(result.dates[0]||"");
 result.dates.forEach(date=>result.days[date]=Array.isArray(input.days&&input.days[date])?input.days[date].map(row=>({...row,id:row.id||makeId(),date,confirmed:!!row.confirmed,pending:!!row.pending})):[]);
 result.staging=Array.isArray(input.staging)?input.staging.map(row=>({...row,id:row.id||makeId(),date:"",start:"",end:"",confirmed:!!row.confirmed,pending:false})):[];
 result.categories=Array.isArray(input.categories)?input.categories.map(c=>({name:String(c.name),color:/^#[0-9a-f]{6}$/i.test(c.color)?c.color:"#FFFFFF"})):DEFAULT_CATEGORIES.map(c=>({...c}));
 result.conflicts=Array.isArray(input.conflicts)?input.conflicts.filter(conflict=>conflict&&typeof conflict==="object"&&typeof conflict.lockedRowId==="string"&&typeof conflict.lockedField==="string").map(conflict=>({...conflict})):[];
 normalizeDirectConflictMarkers(result);hydrateConflictBoundaries(result);DEFAULT_CATEGORIES.forEach(def=>{if(!result.categories.some(c=>c.name===def.name))result.categories.push({...def});});return rebuildAutomaticConflicts(result);
}
/* 驗證值是否為可建立日期頁籤的 YYYY-MM-DD 日期。 */
function validDate(value){return/^\d{4}-\d{2}-\d{2}$/.test(value)&&!isNaN(new Date(value+"T12:00:00").getTime());}
/* 將日期轉成該月份第一天，作為月曆切換的穩定基準。 */
function calendarMonthFor(value){const date=value?new Date(value+"T12:00:00"):new Date();return new Date(date.getFullYear(),date.getMonth(),1);}
/* 將目前或指定應用程式狀態寫入瀏覽器儲存空間。 */
function saveState(data){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data||state));}catch(error){console.error("自動保存失敗",error);showToast("瀏覽器儲存空間不足，請先匯出 JSON 備份");}}
/* 延遲保存以合併短時間內連續的資料修改。 */
function persist(){clearTimeout(autosaveTimer);autosaveTimer=setTimeout(()=>saveState(),120);}
/* 將文字轉義為可安全插入 HTML 字串的內容。 */
function esc(value){return String(value==null?"":value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
/* 將日期轉成顯示用的月日與星期文字，可選擇包含年份。 */
function dateLabel(value,year){if(!value)return"";const d=new Date(value+"T12:00:00"),w=["日","一","二","三","四","五","六"];return(year?d.getFullYear()+"/":"")+String(d.getMonth()+1).padStart(2,"0")+"/"+String(d.getDate()).padStart(2,"0")+"（"+w[d.getDay()]+"）";}
/* 顯示會被後續訊息取代的短暫系統提示。 */
function showToast(message){const toast=document.getElementById("toast");toast.textContent=message;toast.classList.add("show");clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.remove("show"),2100);}
/* 取得目前作用中日期的行程列。 */
function activeRows(){return state.days[state.activeDate]||[];}

/* 以 250ms 長按與 10px 移動門檻建立觸控拖曳候選，未啟動時不攔截頁面捲動。 */
function beginTouchDrag(event,details){
 if(event.pointerType!=="touch"||event.button!==0||touchDrag||touchCandidate)return;
 const candidate={...details,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,lastY:event.clientY,activated:false,cancelled:false,scrolling:false};
 touchCandidate=candidate;
 const move=moveEvent=>{
  if(moveEvent.pointerId!==candidate.pointerId)return;
  if(!candidate.activated&&Math.hypot(moveEvent.clientX-candidate.startX,moveEvent.clientY-candidate.startY)>10){
   candidate.cancelled=true;candidate.scrolling=true;clearTimeout(candidate.timer);
   const scrollBy=candidate.lastY-moveEvent.clientY;if(scrollBy)window.scrollBy(0,scrollBy);candidate.lastY=moveEvent.clientY;return;
  }
  if(candidate.scrolling){const scrollBy=candidate.lastY-moveEvent.clientY;if(scrollBy)window.scrollBy(0,scrollBy);candidate.lastY=moveEvent.clientY;return;}
  if(candidate.activated){moveEvent.preventDefault();updateTouchDrag(moveEvent.clientX,moveEvent.clientY);}
 };
 const finish=upEvent=>{
  if(upEvent.pointerId!==candidate.pointerId)return;
  clearTimeout(candidate.timer);if(candidate.activated){upEvent.preventDefault();updateTouchDrag(upEvent.clientX,upEvent.clientY);finishTouchDrag();}removeCandidate();
 };
 const cancel=cancelEvent=>{if(cancelEvent.pointerId!==candidate.pointerId)return;clearTimeout(candidate.timer);if(candidate.activated){clearTouchDragVisuals();touchDrag=null;}removeCandidate();};
 const removeCandidate=()=>{if(touchCandidate===candidate)touchCandidate=null;window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",finish);window.removeEventListener("pointercancel",cancel);};
 candidate.timer=setTimeout(()=>{if(candidate.cancelled)return;candidate.activated=true;touchCandidate=null;touchDrag={...candidate,target:null};details.source.classList.add(details.type==="tab"?"tab-dragging":"row-dragging");createTouchPreview(details.source,event.clientX,event.clientY);try{(details.capture||details.source).setPointerCapture(event.pointerId);}catch(error){}updateTouchDrag(event.clientX,event.clientY);},250);
 window.addEventListener("pointermove",move,{passive:false});window.addEventListener("pointerup",finish,{passive:false});window.addEventListener("pointercancel",cancel,{passive:false});
}
/* 建立跟隨手指的完整行程列或頁籤視覺預覽，不參與命中判斷。 */
function createTouchPreview(source,x,y){
 const preview=document.createElement("div"),rect=source.getBoundingClientRect();preview.className="touch-drag-preview";preview.dataset.type=source.matches(".date-tab")?"tab":"row";preview.style.width=rect.width+"px";
 preview.append(source.cloneNode(true));
 document.body.append(preview);positionTouchPreview(x,y);
}
/* 將觸控預覽置於手指右下方，避免遮住實際放置目標。 */
function positionTouchPreview(x,y){const preview=document.querySelector(".touch-drag-preview");if(preview){preview.style.transform="translate("+(x+14)+"px,"+(y+14)+"px)";}}
/* 清除目前觸控拖曳所留下的來源、插入線與目標提示。 */
function clearTouchDragVisuals(){document.querySelector(".touch-drag-preview")?.remove();document.querySelectorAll(".row-dragging,.tab-dragging,.touch-drop-before,.touch-drop-after,.tab-drop-before,.tab-drop-after,.drag-over,.drop-target").forEach(element=>element.classList.remove("row-dragging","tab-dragging","touch-drop-before","touch-drop-after","tab-drop-before","tab-drop-after","drag-over","drop-target"));}
/* 根據手指下方的列、暫存區或頁籤更新前後插入位置與放置目標。 */
function updateTouchDrag(x,y){
 if(!touchDrag)return;positionTouchPreview(x,y);touchDrag.target=null;clearTouchDropTarget();const element=document.elementFromPoint(x,y),tab=element&&element.closest(".date-tab"),row=element&&element.closest(".schedule-row[data-id]"),staging=element&&element.closest("#stagingSection"),emptyDay=element&&element.closest("#emptyDay");
 if(touchDrag.type==="tab"){
  if(!tab)return;const rect=tab.getBoundingClientRect(),before=x<rect.left+rect.width/2;tab.classList.add(before?"tab-drop-before":"tab-drop-after");touchDrag.target={kind:"tab",index:[...document.querySelectorAll(".date-tab")].indexOf(tab)+(before?0:1)};return;
 }
 if(row){const area=row.dataset.area;
  if(touchDrag.area==="day"&&area==="staging"){staging?.classList.add("drop-target");touchDrag.target={kind:"staging"};return;}
  if((touchDrag.area===area)||(touchDrag.area==="staging"&&area==="day")){const rect=row.getBoundingClientRect(),after=y>=rect.top+rect.height/2;row.classList.add(after?"touch-drop-after":"touch-drop-before");touchDrag.target={kind:"row",area,id:row.dataset.id,after};return;}
 }
 if(touchDrag.area==="day"&&staging){staging.classList.add("drop-target");touchDrag.target={kind:"staging"};}
 else if(touchDrag.area==="staging"&&emptyDay){emptyDay.classList.add("drag-over");touchDrag.target={kind:"empty-day"};}
}
/* 在重新判斷目標前移除上一個觸控放置提示，但保留來源與預覽。 */
function clearTouchDropTarget(){document.querySelectorAll(".touch-drop-before,.touch-drop-after,.tab-drop-before,.tab-drop-after,.drag-over,.drop-target").forEach(element=>element.classList.remove("touch-drop-before","touch-drop-after","tab-drop-before","tab-drop-after","drag-over","drop-target"));}
/* 完成觸控放置；只有有效目標才改資料，其他位置一律取消。 */
function finishTouchDrag(){
 const current=touchDrag;if(!current)return;clearTouchDragVisuals();touchDrag=null;
 if(current.type==="tab"&&current.target){touchClickUntil=Date.now()+450;const from=current.index,dropIndex=current.target.index,to=dropIndex>from?dropIndex-1:dropIndex,item=state.dates.splice(from,1)[0];state.dates.splice(to,0,item);persist();renderTabs();return;}
 if(current.type!=="row"||!current.target)return;
 const row=getRow(current.area,current.id);if(!row)return;
 if(current.target.kind==="staging"&&current.area==="day")moveRowToStaging(row);
 else if(current.target.kind==="empty-day"&&current.area==="staging")moveStagingRowToDay(row);
 else if(current.target.kind==="row"){
  if(current.area==="staging"&&current.target.area==="day")moveStagingRowToDay(row,current.target.id,current.target.after);
  else if(current.area===current.target.area)requestReorder(current.area,current.id,current.target.id,current.target.after);
 }
}

/* 繪製日期頁籤、當日清單、共用暫存區與類別色彩設定。 */
function render(){renderTabs();renderDay();renderStaging();renderCategories();renderCalendar();}
/* 繪製日期頁籤，保留滑鼠原生拖曳並掛上觸控長按拖曳入口。 */
function renderTabs(){
 const root=document.getElementById("dateTabs");root.innerHTML="";
 state.dates.forEach((date,index)=>{const tab=document.createElement("div");tab.className="date-tab"+(date===state.activeDate?" active":"");tab.draggable=true;tab.dataset.date=date;
  const select=document.createElement("button");select.type="button";select.className="date-tab-select";select.textContent=dateLabel(date);select.setAttribute("role","tab");select.setAttribute("aria-selected",date===state.activeDate?"true":"false");select.addEventListener("click",event=>{if(Date.now()<touchClickUntil){event.preventDefault();return;}state.activeDate=date;activeCalendarMonth=calendarMonthFor(date);persist();render();});
  const close=document.createElement("button");close.type="button";close.className="date-tab-close";close.textContent="×";close.setAttribute("aria-label","刪除 "+dateLabel(date,true));close.draggable=false;close.addEventListener("click",e=>{e.stopPropagation();deleteDate(date);});tab.append(select,close);
  tab.addEventListener("dragstart",e=>{if(e.target.closest(".date-tab-close")){e.preventDefault();return;}draggedRow={type:"tab",index,dropIndex:index};root.classList.add("is-dragging");tab.classList.add("tab-dragging");e.dataTransfer.effectAllowed="move";});
  tab.addEventListener("dragover",e=>{if(!draggedRow||draggedRow.type!=="tab")return;e.preventDefault();root.querySelectorAll(".tab-drop-before,.tab-drop-after").forEach(item=>item.classList.remove("tab-drop-before","tab-drop-after"));const before=e.clientX<tab.getBoundingClientRect().left+tab.offsetWidth/2;tab.classList.add(before?"tab-drop-before":"tab-drop-after");draggedRow.dropIndex=index+(before?0:1);});
  tab.addEventListener("drop",e=>{e.preventDefault();if(!draggedRow||draggedRow.type!=="tab")return;const from=draggedRow.index,to=draggedRow.dropIndex>from?draggedRow.dropIndex-1:draggedRow.dropIndex,item=state.dates.splice(from,1)[0];state.dates.splice(to,0,item);draggedRow=null;root.classList.remove("is-dragging");persist();renderTabs();});
  tab.addEventListener("dragend",()=>{draggedRow=null;root.classList.remove("is-dragging");root.querySelectorAll(".tab-dragging,.tab-drop-before,.tab-drop-after").forEach(item=>item.classList.remove("tab-dragging","tab-drop-before","tab-drop-after"));});root.appendChild(tab);
  tab.addEventListener("pointerdown",event=>{if(event.target.closest(".date-tab-close"))return;beginTouchDrag(event,{type:"tab",index,source:tab,capture:tab});});
 });
}
/* 繪製目前日期的行程表、標題、筆數與空白狀態。 */
function renderDay(){
 const rows=activeRows();document.getElementById("activeDateTitle").textContent=state.activeDate?dateLabel(state.activeDate,true):"尚未建立日期";
 document.getElementById("daySummary").textContent=rows.length?rows.length+" 項行程":"尚無行程";document.getElementById("emptyDay").hidden=rows.length>0;
 document.getElementById("addRowButton").disabled=!state.activeDate;
 const root=document.getElementById("tableBody");root.innerHTML=rows.map((row,index)=>rowMarkup(row,index,"day")).join("");bindRows(root,"day");
}
/* 繪製共用暫存區、筆數與空白狀態。 */
function renderStaging(){
 const root=document.getElementById("stagingBody");document.getElementById("stagingCount").textContent=state.staging.length+" 項";document.getElementById("emptyStaging").hidden=state.staging.length>0;
 root.innerHTML=state.staging.map((row,index)=>rowMarkup(row,index,"staging")).join("");bindRows(root,"staging");
}
/* 建立類別選單選項，並保留目前行程的選取值。 */
function categoryOptions(value){return'<option value=""></option>'+state.categories.map(c=>'<option value="'+esc(c.name)+'" '+(value===c.name?"selected":"")+'>'+esc(c.name)+'</option>').join("");}
/* 產生正式區或暫存區單列 HTML，並套用保存中的衝突與待確認提示狀態。 */
function rowMarkup(row,index,area){
 const color=(state.categories.find(c=>c.name===row.category)||{}).color||"#FFFFFF",pending=!!row.pending;
 const rowClass=["schedule-row",pending?"pending-row":"",area==="day"&&row.isNew?"new-row-highlight":"",hasConflictForRow(row.id)?"conflict-highlight":""].filter(Boolean).join(" ");
 const inputClass=field=>hasConflictForInput(row.id,field)?" conflict-field-highlight":"";
 const lockButton=field=>'<button class="lock-btn '+(row.lock===field?"locked":"")+'" data-lock="'+field+'" title="鎖定'+({start:"開始時間",end:"結束時間",duration:"總時長"}[field])+'">'+(row.lock===field?'<i class="fa-solid fa-lock" aria-hidden="true"></i>':'<i class="fa-solid fa-lock-open" aria-hidden="true"></i>')+'</button>';
 const editDisabled=area==="staging"||pending;
 return'<div class="'+rowClass+'" role="row" data-id="'+esc(row.id)+'" data-index="'+index+'" data-area="'+area+'">'+
 '<div class="order-cell" role="cell" draggable="true"><span class="drag-handle" title="拖曳調整順序">⠿</span>'+(pending?'<span class="pending-tag">待放置</span>':"")+'</div>'+
 '<div role="cell"><div class="time-cell"><input type="text" class="time-input'+inputClass("start")+'" aria-label="開始時間" value="'+esc(row.start)+'" placeholder="HH:MM" '+(editDisabled||row.lock==="start"?"disabled":"")+' data-field="start">'+(area==="day"?lockButton("start"):"")+'</div></div>'+
 '<div role="cell"><div class="time-cell"><input type="text" class="time-input'+inputClass("end")+'" aria-label="結束時間" value="'+esc(row.end)+'" placeholder="HH:MM" '+(editDisabled||row.lock==="end"?"disabled":"")+' data-field="end">'+(area==="day"?lockButton("end"):"")+'</div></div>'+
 '<div role="cell"><div class="duration-cell"><div class="duration-editor"><input type="text" inputmode="numeric" pattern="[0-9０-９]*" class="duration-input'+inputClass("duration")+'" value="'+esc(row.duration)+'" aria-label="總時長（分鐘）" '+(row.lock==="duration"?"disabled":"")+' data-field="duration"><span>分鐘</span>'+(area==="day"?lockButton("duration"):"")+'</div><span class="duration-display'+(Number(row.duration)===0?" duration-zero":"")+'">'+formatDuration(row.duration)+'</span></div></div>'+
 '<div role="cell"><div class="category-select-wrapper"><select class="category-select" aria-label="類別" style="background-color:'+color+'" data-field="category">'+categoryOptions(row.category)+'</select><i class="fa-solid fa-chevron-down category-select-icon" aria-hidden="true"></i></div></div>'+
 '<div role="cell"><div class="content-editor"><label class="confirmation-toggle"><input type="checkbox" data-confirmed-toggle '+(row.confirmed?"checked":"")+'> 待確認</label><textarea class="content-input'+(row.confirmed?" confirmation-pending":"")+'" aria-label="行程內容" placeholder="輸入行程內容" data-field="content" rows="1" wrap="soft">'+esc(row.content)+'</textarea></div></div>'+
 '<div role="cell"><div class="row-actions">'+(area==="day"?(pending?'<button class="button small primary" data-action="place">放置此處</button><button class="button small minor" data-action="stage">移至暫存</button>':'<button class="button small" data-action="move">移至其他日期</button><button class="button small" data-action="stage">移至暫存</button>'):'<button class="button small" data-action="move">移至其他日期</button>')+'</div></div>'+
 '<div role="cell"><button class="icon-button" data-action="delete" aria-label="刪除行程">×</button></div></div>';
}
/* 依文字內容自動調整行程 textarea 高度，避免出現內容框內的水平捲動。 */
function resizeContentTextarea(textarea){textarea.style.height="auto";textarea.style.height=textarea.scrollHeight+"px";}
/* 綁定行程列的桌面拖放、觸控拖放、欄位編輯、待確認切換與行程操作。 */
function bindRows(root,area){
 root.querySelectorAll(".schedule-row[data-id]").forEach(rowElement=>{const row=getRow(area,rowElement.dataset.id);
  rowElement.addEventListener("focusin",()=>{if(row.isNew){row.isNew=false;rowElement.classList.remove("new-row-highlight");persist();}});
  rowElement.addEventListener("dragstart",e=>{if(!e.target.closest(".order-cell")){e.preventDefault();return;}draggedRow={type:"row",area,id:row.id};e.dataTransfer.effectAllowed="move";const rect=rowElement.getBoundingClientRect();e.dataTransfer.setDragImage(rowElement,e.clientX-rect.left,e.clientY-rect.top);rowElement.classList.add("row-dragging");});
  rowElement.addEventListener("dragend",()=>{rowElement.classList.remove("row-dragging");draggedRow=null;document.querySelectorAll(".touch-drop-before,.touch-drop-after").forEach(item=>item.classList.remove("touch-drop-before","touch-drop-after"));});
  rowElement.addEventListener("dragover",e=>{const acceptsRow=draggedRow&&draggedRow.type==="row"&&(draggedRow.area===area||(area==="day"&&draggedRow.area==="staging"));if(acceptsRow){e.preventDefault();const after=e.clientY>=rowElement.getBoundingClientRect().top+rowElement.getBoundingClientRect().height/2;document.querySelectorAll(".touch-drop-before,.touch-drop-after").forEach(item=>item.classList.remove("touch-drop-before","touch-drop-after"));rowElement.classList.add(after?"touch-drop-after":"touch-drop-before");}});
  rowElement.addEventListener("dragleave",()=>rowElement.classList.remove("touch-drop-before","touch-drop-after"));
  rowElement.addEventListener("drop",e=>{const acceptsRow=draggedRow&&draggedRow.type==="row"&&(draggedRow.area===area||(area==="day"&&draggedRow.area==="staging"));if(!acceptsRow)return;e.preventDefault();e.stopPropagation();const after=e.clientY>=rowElement.getBoundingClientRect().top+rowElement.getBoundingClientRect().height/2;rowElement.classList.remove("touch-drop-before","touch-drop-after");if(area==="day"&&draggedRow.area==="staging"){const stagingRow=getRow("staging",draggedRow.id);if(stagingRow)moveStagingRowToDay(stagingRow,row.id,after);return;}requestReorder(area,draggedRow.id,row.id,after);});
  rowElement.querySelectorAll("[data-field]").forEach(input=>{const field=input.dataset.field,timeRetry=area==="day"&&!row.pending&&["start","end","duration"].includes(field),submit=()=>{if(timeRetry)handleTimeEdit(row.id,field,input.value);else updateRow(area,row.id,field,input.value);};input.addEventListener("change",()=>{if(input.dataset.submittedValue===input.value){delete input.dataset.submittedValue;return;}submit();});if(timeRetry)input.addEventListener("keydown",event=>{if(event.key!=="Enter"||event.isComposing)return;event.preventDefault();input.dataset.submittedValue=input.value;submit();});});
  rowElement.querySelectorAll(".content-input").forEach(textarea=>{resizeContentTextarea(textarea);textarea.addEventListener("input",()=>resizeContentTextarea(textarea));});
  rowElement.querySelectorAll("[data-confirmed-toggle]").forEach(input=>input.addEventListener("change",()=>updateRow(area,row.id,"confirmed",input.checked)));
  rowElement.querySelectorAll("[data-lock]").forEach(button=>button.addEventListener("click",()=>{row.lock=row.lock===button.dataset.lock?"none":button.dataset.lock;clearConflictsAfterSuccess();renderDay();renderStaging();}));
  rowElement.querySelector(".category-select").addEventListener("change",e=>e.currentTarget.style.backgroundColor=(state.categories.find(c=>c.name===e.currentTarget.value)||{}).color||"#fff");
  rowElement.querySelectorAll("[data-action]").forEach(button=>button.addEventListener("click",()=>rowAction(area,row.id,button.dataset.action)));
  rowElement.querySelector(".order-cell").addEventListener("pointerdown",event=>beginTouchDrag(event,{type:"row",area,id:row.id,source:rowElement,capture:event.currentTarget}));
 });
}
/* 依區域取得暫存區或目前日期的行程清單。 */
function getList(area){return area==="staging"?state.staging:activeRows();}
/* 依區域與 ID 取得單筆行程。 */
function getRow(area,id){return getList(area).find(r=>r.id===id);}
/* 將輸入的全形數字與全形冒號轉為半形，使混合輸入沿用既有時間與時長規則。 */
function normalizeNumericInput(value){return String(value??"").replace(/[０-９]/g,char=>String.fromCharCode(char.charCodeAt(0)-0xFEE0)).replace(/：/g,":");}
/* 單一行程只允許 0–1440 分鐘；舊資料仍保留原值，改由衝突流程提示。 */
function durationWithinLimit(value){const total=Number(normalizeNumericInput(value));return Number.isFinite(total)&&total>=0&&total<=1440;}
/* 建立舊資料超過單一行程時長上限時的可保存衝突，供畫面標示與匯出阻擋使用。 */
function durationLimitConflict(row,date,area){return{id:"duration-limit-"+row.id,date:date||"",area:area||"day",lockedRowId:row.id,lockedField:"duration",lockedValue:row.duration,requiredValue:"1440",operation:"單一行程時長上限",durationLimit:true};}
/* 同步所有日期與暫存行程的時長上限衝突；使用者修正回上限內時只移除這類衝突。 */
function syncDurationLimitConflicts(target=state){
 const ordinary=(target.conflicts||[]).filter(conflict=>!conflict.durationLimit),limits=[];
 (target.dates?.length?target.dates:Object.keys(target.days||{})).forEach(date=>(target.days[date]||[]).forEach(row=>{if(!durationWithinLimit(row.duration))limits.push(durationLimitConflict(row,date,"day"));}));
 (target.staging||[]).forEach(row=>{if(!durationWithinLimit(row.duration))limits.push(durationLimitConflict(row,"","staging"));});
 target.conflicts=ordinary.concat(limits);return target;
}
/* 列出中間正式行程的結束早於開始；待放置列不計入首尾跨午夜例外。 */
function middleEndBeforeStartConflicts(rows,date){return rows.filter(row=>!row.pending).slice(1,-1).filter(row=>row.start&&row.end&&timeToMin(row.end)<timeToMin(row.start)).map(row=>({id:"end-before-start-"+row.id,date:date||"",area:"day",lockedRowId:row.id,lockedField:"end",lockedValue:row.end,requiredValue:row.start,operation:"時間連動",endBeforeStart:true}));}
/* 取得第一筆中間跨午夜衝突，供時間試算快速中止不合法候選。 */
function middleEndBeforeStartConflict(rows,date){return middleEndBeforeStartConflicts(rows,date)[0]||null;}
/* 同步舊資料的中間跨午夜衝突，使其可標示、阻擋匯出並等待使用者修復。 */
function syncMiddleEndBeforeStartConflicts(target=state){
 const ordinary=(target.conflicts||[]).filter(conflict=>!conflict.endBeforeStart),invalid=[];
 (target.dates?.length?target.dates:Object.keys(target.days||{})).forEach(date=>invalid.push(...middleEndBeforeStartConflicts(target.days?.[date]||[],date)));
 target.conflicts=ordinary.concat(invalid);return target;
}
/* 將正式時間鏈拆成可獨立解除的原子衝突：單列起訖／時長不一致，以及相鄰兩列未串接。 */
function timelineAtomicConflicts(rows,date){
 const formal=rows.filter(row=>!row.pending),conflicts=[];
 formal.forEach(row=>{if(row.start&&row.end&&durationWithinLimit(row.duration)&&durationBetween(row.start,row.end)!==durationValue(row.duration))conflicts.push({id:"row-consistency-"+date+"-"+row.id,kind:"row-consistency",date,area:"day",rowId:row.id,lockedRowId:row.id,operation:"時間鏈檢核"});});
 for(let index=1;index<formal.length;index++){const left=formal[index-1],right=formal[index];if(left.end&&right.start&&left.end!==right.start)conflicts.push({id:"adjacency-"+date+"-"+left.id+"-"+right.id,kind:"adjacency",date,area:"day",leftRowId:left.id,rightRowId:right.id,operation:"時間鏈檢核"});}
 return conflicts;
}
/* 舊備份的直接修改記錄沒有情境資訊時，補成黃色來源標記；實際紅框與匯出阻擋改由原子檢核重建。 */
function normalizeDirectConflictMarkers(target){
 (target.conflicts||[]).forEach(conflict=>{if(conflict.directRowId&&conflict.directField&&!conflict.directContext)conflict.directContext={kind:"legacy-direct",field:conflict.directField,chainRowIds:[conflict.directRowId,conflict.lockedRowId].filter(Boolean)};});
 return target;
}
/* 自動檢核項目不保留快照；下一輪一律以現在的行程資料重建。 */
function isAutomaticTimelineConflict(conflict){return !!(conflict?.durationLimit||conflict?.endBeforeStart||conflict?.kind==="row-consistency"||conflict?.kind==="adjacency"||/^(?:duration-limit|end-before-start|row-consistency|adjacency)-/.test(String(conflict?.id||"")));}
/* 重建所有資料狀態可直接推得的衝突；鎖定與使用者直接輸入來源則保留為獨立記錄。 */
function rebuildAutomaticConflicts(target=state){
 normalizeDirectConflictMarkers(target);
 const retained=(target.conflicts||[]).filter(conflict=>!isAutomaticTimelineConflict(conflict)),automatic=[];
 (target.dates?.length?target.dates:Object.keys(target.days||{})).forEach(date=>{const rows=target.days?.[date]||[];rows.forEach(row=>{if(!durationWithinLimit(row.duration))automatic.push(durationLimitConflict(row,date,"day"));});automatic.push(...middleEndBeforeStartConflicts(rows,date),...timelineAtomicConflicts(rows,date));});
 (target.staging||[]).forEach(row=>{if(!durationWithinLimit(row.duration))automatic.push(durationLimitConflict(row,"","staging"));});
 target.conflicts=[];target.conflicts.push(...retained,...automatic);hydrateConflictBoundaries(target);
 const automaticIds=new Set(automatic.map(conflict=>conflict.id));target.conflicts=target.conflicts.filter(conflict=>!isAutomaticTimelineConflict(conflict)||automaticIds.has(conflict.id));return target;
}
/* 檢查匯入資料是否新增中間正式行程跨午夜，首尾正式行程仍保留既有例外。 */
function backupHasMiddleEndBeforeStart(raw){
 const lists=[];
 if(Array.isArray(raw)){const grouped=new Map();raw.forEach(row=>{const date=row?.date||"";if(!grouped.has(date))grouped.set(date,[]);grouped.get(date).push(row);});lists.push(...grouped.values());}
 else if(raw&&typeof raw==="object"){(raw.dates||Object.keys(raw.days||{})).forEach(date=>lists.push(raw.days?.[date]||[]));}
 return lists.some(rows=>middleEndBeforeStartConflicts(rows,"").length>0);
}
/* 判斷目前正式時間鏈是否含有不可參與連動的超上限時長。 */
function hasInvalidDurationInRows(rows){return rows.some(row=>!row.pending&&!durationWithinLimit(row.duration));}
/* 將內部時間欄位名稱轉為衝突提示可讀的中文名稱。 */
function fieldLabel(field){return({start:"開始時間",end:"結束時間",duration:"總時長"}[field]||field);}
/* 依保留直接輸入的實際不一致，列出仍須標紅的行程；來源欄位修好後只保留尚未解決的一側。 */
function directConflictRowIds(conflict){
 const context=conflict.directContext;if(!context)return[];const rows=state.days[conflict.date]||[],sourceIndex=rows.findIndex(row=>row.id===conflict.directRowId);
 if(sourceIndex<0)return[];const ids=new Set(),source=rows[sourceIndex],formal=rows.filter(row=>!row.pending),formalIndex=formal.findIndex(row=>row.id===source.id),invalid=row=>!row.start||!row.end||timeAfter(row.start,Number(row.duration))!==row.end||(formalIndex>0&&formalIndex<formal.length-1&&row===source&&timeToMin(row.end)<timeToMin(row.start));
 const previousIndex=findFormalBefore(rows,sourceIndex),nextIndex=findFormalAfter(rows,sourceIndex),previous=rows[previousIndex],next=rows[nextIndex],addInvalid=row=>{if(row&&invalid(row))ids.add(row.id);};
 if(conflict.directField){addInvalid(source);if(["start","duration"].includes(conflict.directField)&&previous&&previous.end!==source.start)ids.add(previous.id);if(["end","duration"].includes(conflict.directField)&&next&&source.end!==next.start)ids.add(next.id);return[...ids];}
 const chainIds=context.chainRowIds||[conflict.directRowId,conflict.lockedRowId],indexes=chainIds.map(id=>rows.findIndex(row=>row.id===id)).filter(index=>index>=0);if(!indexes.length)return[];
 const first=Math.min(...indexes),last=Math.max(...indexes);let prior=null;
 for(let index=first;index<=last;index++){const row=rows[index];if(!row||row.pending)continue;addInvalid(row);if(prior&&prior.end!==row.start){ids.add(prior.id);ids.add(row.id);}prior=row;}
 return[...ids];
}
/* 原子斷點已有黃色直接來源時，沿用來源規則只標示真正受影響的一側。 */
function atomicAdjacencyHasDirectSource(conflict){return state.conflicts.some(marker=>marker.directContext&&marker.date===conflict.date&&(((marker.directField==="start"||marker.directField==="duration")&&marker.directRowId===conflict.rightRowId)||((marker.directField==="end"||marker.directField==="duration")&&marker.directRowId===conflict.leftRowId)));}
/* 判斷一列是否是任何未解決衝突的實際參與列；沒有直接來源的斷點才同時標示兩端。 */
function hasConflictForRow(id){return state.conflicts.some(conflict=>{if(conflict.kind==="row-consistency")return conflict.rowId===id;if(conflict.kind==="adjacency")return !atomicAdjacencyHasDirectSource(conflict)&&(conflict.leftRowId===id||conflict.rightRowId===id);return conflict.directContext?directConflictRowIds(conflict).includes(id):conflict.lockedRowId===id;});}
/* 判斷輸入欄是否為直接輸入後仍須保留的衝突欄位。 */
function hasConflictForInput(id,field){return state.conflicts.some(conflict=>conflict.directRowId===id&&conflict.directField===field&&directConflictStillBlocks(conflict));}
/* 判定兩筆相鄰正式行程是否尚未串接，作為手動保留衝突的時間鏈邊界。 */
function isTimeBoundary(left,right){return !!(left&&right&&left.end&&right.start&&left.end!==right.start);}
/* 從黃底直接修改來源與目前不連續位置補齊舊資料的左右時間鏈邊界。 */
function deriveConflictBoundary(conflict,rows){
 if(!conflict?.directRowId)return null;const sourceIndex=rows.findIndex(row=>row.id===conflict.directRowId);if(sourceIndex<0)return null;
 const edges=[];for(let index=1;index<rows.length;index++){const left=rows[index-1],right=rows[index];if(!left.pending&&!right.pending&&isTimeBoundary(left,right))edges.push({left,right,index});}
 if(!edges.length)return null;const edge=edges.sort((a,b)=>Math.min(Math.abs(rows.indexOf(a.left)-sourceIndex),Math.abs(rows.indexOf(a.right)-sourceIndex))-Math.min(Math.abs(rows.indexOf(b.left)-sourceIndex),Math.abs(rows.indexOf(b.right)-sourceIndex)))[0];
 const owner=edge.left.id===conflict.directRowId?"right":edge.right.id===conflict.directRowId?"left":"";return owner?{leftRowId:edge.left.id,rightRowId:edge.right.id,owner}:null;
}
/* 載入舊備份時自動補齊手動保留衝突的邊界資料，讓後續結構操作不必要求使用者重做。 */
function hydrateConflictBoundaries(target){
 (target.conflicts||[]).forEach(conflict=>{if(conflict.boundary?.leftRowId&&conflict.boundary?.rightRowId&&conflict.boundary?.owner)return;const rows=target.days?.[conflict.date]||[];const boundary=deriveConflictBoundary(conflict,rows);if(boundary)conflict.boundary=boundary;});return target;
}
/* 取得目前日期仍有效的手動衝突邊界；邊界兩端必須相鄰且仍不連續。 */
function activeConflictBoundaries(rows=activeRows()){
 const seen=new Set();return state.conflicts.filter(conflict=>conflict.date===state.activeDate&&(conflict.kind==="adjacency"||conflict.boundary)).map(conflict=>{const boundary=conflict.kind==="adjacency"?{leftRowId:conflict.leftRowId,rightRowId:conflict.rightRowId}:conflict.boundary,key=boundary.leftRowId+":"+boundary.rightRowId;if(seen.has(key))return null;seen.add(key);return{conflict,leftIndex:rows.findIndex(row=>row.id===boundary.leftRowId),rightIndex:rows.findIndex(row=>row.id===boundary.rightRowId)};}).filter(item=>item&&item.leftIndex>=0&&item.rightIndex===item.leftIndex+1&&isTimeBoundary(rows[item.leftIndex],rows[item.rightIndex]));
}
/* 回傳指定索引所在、不跨越手動衝突邊界的正式時間鏈範圍。 */
function conflictChainScope(rows,index){
 let first=0,last=rows.length-1;activeConflictBoundaries(rows).forEach(item=>{if(index<=item.leftIndex)last=Math.min(last,item.leftIndex);if(index>=item.rightIndex)first=Math.max(first,item.rightIndex);});return{first,last};
}
/* 判斷排序來源與目標是否分屬同一條未被手動衝突切開的時間鏈。 */
function crossesConflictBoundary(rows,fromIndex,toIndex){const low=Math.min(fromIndex,toIndex),high=Math.max(fromIndex,toIndex);return activeConflictBoundaries(rows).some(item=>item.leftIndex>=low&&item.leftIndex<high);}
/* 取得某個黃底衝突來源行程；只有這類行程移除時需要請使用者選擇新的全鏈基準。 */
function originConflictFor(rowId){return state.conflicts.find(conflict=>conflict.date===state.activeDate&&conflict.directRowId===rowId&&conflict.boundary);}
/* 模擬移除來源行程後，取得原衝突左右兩側仍存在的時間鏈與各側最接近移除位置的行程。 */
function originRemovalSides(conflict,rowId,rows=activeRows()){
 const leftIndex=rows.findIndex(row=>row.id===conflict.boundary.leftRowId),rightIndex=rows.findIndex(row=>row.id===conflict.boundary.rightRowId),removedIndex=rows.findIndex(row=>row.id===rowId),remaining=rows.filter(row=>row.id!==rowId);if(leftIndex<0||rightIndex<0||removedIndex<0)return null;
 const split=conflict.boundary.leftRowId===rowId?leftIndex-1:leftIndex,adjustedSplit=removedIndex<=split?split-1:split;
 const left=remaining.slice(0,adjustedSplit+1).filter(row=>!row.pending),right=remaining.slice(adjustedSplit+1).filter(row=>!row.pending);return{left,right,leftAnchor:left.at(-1)||null,rightAnchor:right[0]||null};
}
/* 取得某側最接近移除位置的開始／結束時間鎖定，供基準文案與自動選擇使用。 */
function nearestTimeLock(rows,side){const ordered=side==="left"?[...rows].reverse():rows;return ordered.find(row=>["start","end"].includes(row.lock))||null;}
/* 以指定行程的既有時間或鎖定欄位為基準，向前與向後更新整條正式時間鏈。 */
function recalculateFromRemovalAnchor(rowId,operation){
 const rows=activeRows(),index=rows.findIndex(row=>row.id===rowId),anchor=rows[index];if(index<0||!anchor)return null;
 if(anchor.lock==="end"){const start=timeBefore(anchor.end,durationValue(anchor.duration)),conflict=setTimeValue(anchor,"start",start,operation);if(conflict)return conflict;}else{const end=timeAfter(anchor.start,durationValue(anchor.duration)),conflict=setTimeValue(anchor,"end",end,operation);if(conflict)return conflict;}
 return cascadeBackward(index,operation)||cascadeForward(index,operation);
}
/* 在移除衝突來源前，依左右時間鎖定顯示唯一基準告知或兩側基準滾輪。 */
function chooseOriginRemovalAnchor(conflict,row,run){
 const sides=originRemovalSides(conflict,row.id);if(!sides)return run("left");const leftLock=nearestTimeLock(sides.left,"left"),rightLock=nearestTimeLock(sides.right,"right"),label=(side,lock)=>lock?"以被鎖定的「"+dialogRowName(lock,"此")+"」行程為基準":"以「"+dialogRowName(side==="left"?sides.leftAnchor:sides.rightAnchor,"此")+"」行程為基準";
 if(Boolean(leftLock)!==Boolean(rightLock)){const side=leftLock?"left":"right",lock=leftLock||rightLock;openDialog("時間連動",'因為「'+dialogRowName(lock,"此")+'」的「'+fieldLabel(lock.lock)+'」已鎖定，將以此更新所有行程時間。',[{text:"我知道了",cls:"danger",run:()=>run(side)}]);return;}
 let selected="left";const content=document.createElement("div"),prompt=document.createElement("p"),wheel=document.createElement("div");prompt.textContent="請選擇更新所有行程時間的基準。";wheel.className="pending-duration-wheel";wheel.setAttribute("role","listbox");const options=["left","right"].filter(side=>side==="left"?sides.leftAnchor:sides.rightAnchor);options.forEach(side=>{const option=document.createElement("button");option.type="button";option.className="pending-duration-option"+(side===selected?" selected":"");option.setAttribute("role","option");option.textContent=label(side,side==="left"?leftLock:rightLock);option.addEventListener("click",()=>{selected=side;[...wheel.children].forEach(item=>item.classList.toggle("selected",item===option));});wheel.append(option);});content.append(prompt,wheel);openDialog("選擇時間基準",content,[{text:"套用調整",cls:"primary",run:()=>run(selected)},{text:"取消",cls:"",run:()=>render()}],{dialogClass:"pending-duration-dialog",actionsClass:"pending-duration-actions"});
}
/* 衝突來源移除後，以使用者選定側的最近基準重算全鏈，並將另一側鎖定造成的不相容保存為新邊界。 */
function resolveOriginRemoval(conflict,rowId,side,beforeRows,operation){
 const sides=originRemovalSides(conflict,rowId,beforeRows),anchor=side==="left"?(nearestTimeLock(sides?.left||[],"left")||sides?.leftAnchor):(nearestTimeLock(sides?.right||[],"right")||sides?.rightAnchor);state.conflicts=state.conflicts.filter(item=>item.id!==conflict.id);if(!anchor)return null;
 const result=recalculateFromRemovalAnchor(anchor.id,operation);if(!result)return null;
 const stored={...result,directRowId:anchor.id,directField:anchor.lock||"",directContext:{kind:"removal-anchor",chainRowIds:activeRows().map(row=>row.id)}};const boundary=deriveConflictBoundary(stored,activeRows());if(boundary)stored.boundary=boundary;recordConflict(stored);return stored;
}
/* 找出夾在既有衝突兩端之間的待放置行程，讓它依首次黃色來源決定加入左鏈或右鏈。 */
function boundaryForPendingRow(rowId,rows=activeRows()){
 const index=rows.findIndex(row=>row.id===rowId);return state.conflicts.find(conflict=>{const boundary=conflict.boundary,left=boundary&&rows.findIndex(row=>row.id===boundary.leftRowId),right=boundary&&rows.findIndex(row=>row.id===boundary.rightRowId);return conflict.date===state.activeDate&&left>=0&&right>=0&&left<index&&index<right;})||null;
}
/* 將待放置行程接到衝突來源指定的一側，同時把仍未接上的邊界移到新的相鄰行程。 */
function placePendingAtConflictBoundary(row,conflict){
 const rows=activeRows(),boundary=conflict.boundary,left=rows.find(item=>item.id===boundary.leftRowId),right=rows.find(item=>item.id===boundary.rightRowId);if(!left||!right)return false;row.pending=false;
 if(boundary.owner==="right"){row.end=right.start;row.start=timeBefore(row.end,durationValue(row.duration));boundary.rightRowId=row.id;}else{row.start=left.end;row.end=timeAfter(row.start,durationValue(row.duration));boundary.leftRowId=row.id;}
 return true;
}
/* 非衝突來源行程被移除時，將既有邊界端點移到同側下一筆正式行程，避免未連動的衝突被自動抹除。 */
function relocateConflictBoundariesAfterRemoval(rowId,beforeRows){
 state.conflicts.forEach(conflict=>{const boundary=conflict.boundary;if(conflict.date!==state.activeDate||!boundary||conflict.directRowId===rowId)return;const removedIndex=beforeRows.findIndex(row=>row.id===rowId);if(removedIndex<0)return;if(boundary.leftRowId===rowId){const replacement=[...beforeRows.slice(0,removedIndex)].reverse().find(row=>!row.pending);if(replacement)boundary.leftRowId=replacement.id;else delete conflict.boundary;}if(boundary.rightRowId===rowId){const replacement=beforeRows.slice(removedIndex+1).find(row=>!row.pending);if(replacement)boundary.rightRowId=replacement.id;else delete conflict.boundary;}});
}
/* 從目前日期向上找最近一筆非待放置正式行程索引。 */
function formalIndexBefore(index){const rows=activeRows();for(let i=index-1;i>=0;i--)if(!rows[i].pending)return i;return-1;}
/* 從目前日期向下找最近一筆非待放置正式行程索引。 */
function formalIndexAfter(index){const rows=activeRows();for(let i=index+1;i<rows.length;i++)if(!rows[i].pending)return i;return-1;}
/* 建立包含鎖定值、所需值與直接輸入來源的可保存衝突資料。 */
function conflictFor(row,field,required,operation,direct){return{ id:makeId(),date:state.activeDate,lockedRowId:row.id,lockedField:field,lockedValue:row[field],requiredValue:required,operation:operation||"時間連動",directRowId:direct&&direct.rowId||"",directField:direct&&direct.field||""};}
/* 建立相鄰行程吸收後會成為負時長的可保存衝突，不偽裝為鎖定欄位。 */
function insufficientDurationConflict(row,required,operation,direct){return{...conflictFor(row,"duration",required,operation,direct),insufficientDuration:true};}
/* 安全寫入推算時間；若欄位鎖定且值不同則回傳衝突而不覆寫。 */
function setTimeValue(row,field,value,operation,direct){
 if(field==="duration"&&!durationWithinLimit(value))return insufficientDurationConflict(row,Number(value),operation,direct);
 if(row.lock===field&&row[field]!==value)return conflictFor(row,field,value,operation,direct);row[field]=value;return null;
}
/* 以原始排序意圖在副本上重跑，只有排序真正可成立時才解除已回復操作的衝突。 */
function reorderConflictStillBlocks(conflict){
 const context=conflict.reorderContext;if(!context)return true;
 const rows=structuredClone(state.days[conflict.date]||[]),sourceIndex=rows.findIndex(row=>row.id===context.sourceId);
 if(sourceIndex<0)return false;
 const row=rows.splice(sourceIndex,1)[0],afterIndex=rows.findIndex(item=>item.id===context.afterId),beforeIndex=rows.findIndex(item=>item.id===context.beforeId);
 const insertAt=afterIndex>=0?afterIndex:(beforeIndex>=0?beforeIndex+1:rows.length);rows.splice(insertAt,0,row);
 const originalDate=state.activeDate,originalRows=state.days[conflict.date];state.activeDate=conflict.date;state.days[conflict.date]=rows;
 try{return !!recalculateReorderedDayRow(row,rows.indexOf(row),"重新檢查排序衝突");}
 finally{state.days[conflict.date]=originalRows;state.activeDate=originalDate;}
}
/* 檢查直接輸入衝突是否仍有實際參與列，作為黃底與保存提示的共同判定。 */
function directConflictStillBlocks(conflict){return !!directConflictRowIds(conflict).length;}
/* 判斷鎖定與已回復操作的衝突是否仍會阻擋目前資料；直接輸入以實際時間鏈判定。 */
function conflictStillBlocks(conflict){
 if(conflict.kind==="row-consistency"){const row=(state.days[conflict.date]||[]).find(item=>item.id===conflict.rowId);return !!row&&row.start&&row.end&&durationWithinLimit(row.duration)&&durationBetween(row.start,row.end)!==durationValue(row.duration);}
 if(conflict.kind==="adjacency"){const rows=state.days[conflict.date]||[],left=rows.find(item=>item.id===conflict.leftRowId),right=rows.find(item=>item.id===conflict.rightRowId);return isTimeBoundary(left,right);}
 if(conflict.durationLimit){const rows=conflict.area==="staging"?state.staging:(state.days[conflict.date]||[]),row=rows.find(item=>item.id===conflict.lockedRowId);return !!row&&!durationWithinLimit(row.duration);}
 if(conflict.endBeforeStart)return middleEndBeforeStartConflicts(state.days[conflict.date]||[],conflict.date).some(item=>item.lockedRowId===conflict.lockedRowId);
 if(conflict.reorderContext)return reorderConflictStillBlocks(conflict);
 if(conflict.directContext)return directConflictStillBlocks(conflict);
 const rows=state.days[conflict.date]||[],index=rows.findIndex(item=>item.id===conflict.lockedRowId),row=rows[index];if(!row)return false;
 if(row.lock!==conflict.lockedField)return false;
 if(conflict.directRowId===row.id)return row[conflict.lockedField]!==conflict.requiredValue;
 if(conflict.lockedField==="duration"){
  if(durationBetween(row.start,row.end)!==Number(row.duration))return true;
  const previousIndex=findFormalBefore(rows,index),nextIndex=findFormalAfter(rows,index),previous=rows[previousIndex],next=rows[nextIndex];
  return !!((previous&&previous.end&&row.start&&previous.end!==row.start)||(next&&next.start&&row.end&&next.start!==row.end));
 }
 const neighbourIndex=conflict.lockedField==="start"?findFormalBefore(rows,index):findFormalAfter(rows,index);
 if(neighbourIndex<0)return row[conflict.lockedField]!==conflict.requiredValue;
 const neighbour=rows[neighbourIndex];return conflict.lockedField==="start"?neighbour.end!==row.start:neighbour.start!==row.end;
}
/* 在指定行程陣列中向上找最近一筆非待放置正式行程。 */
function findFormalBefore(rows,index){for(let i=index-1;i>=0;i--)if(!rows[i].pending)return i;return-1;}
/* 在指定行程陣列中向下找最近一筆非待放置正式行程。 */
function findFormalAfter(rows,index){for(let i=index+1;i<rows.length;i++)if(!rows[i].pending)return i;return-1;}
/* 將正式時間鏈全部開始／結束鎖定換算為同一條鏈起點的時間約束。 */
function lockedChainBases(rows){
 const bases=[];let elapsed=0;
 rows.forEach((row,index)=>{if(row.pending||!durationWithinLimit(row.duration))return;const field=["start","end"].includes(row.lock)?row.lock:"";if(field&&row[field])bases.push({row,index,field,base:timeBefore(field==="start"?row.start:timeBefore(row.end,durationValue(row.duration)),elapsed),elapsed});elapsed+=durationValue(row.duration);});
 return bases;
}
/* 在單一未衝突時間鏈內，以全部時間鎖定或該鏈原首筆開始時間重算，絕不穿透其他鏈。 */
function recalculateConflictChain(scope,operation,preservedStart){
 const rows=activeRows(),segment=rows.slice(scope.first,scope.last+1),invalid=segment.find(row=>!row.pending&&!durationWithinLimit(row.duration));if(invalid)return durationLimitConflict(invalid,state.activeDate,"day");
 const bases=lockedChainBases(segment),anchor=bases.length?bases[0]:preservedStart?{base:preservedStart}:null;if(!anchor)return null;
 for(const constraint of bases){if(constraint===anchor)continue;if(constraint.base!==anchor.base){const start=timeAfter(anchor.base,constraint.elapsed),required=constraint.field==="start"?start:timeAfter(start,durationValue(constraint.row.duration)),conflict=conflictFor(constraint.row,constraint.field,required,operation);conflict.anchorRowId=anchor.row?.id||"";return conflict;}}
 let elapsed=0;for(const row of segment){if(row.pending)continue;const start=timeAfter(anchor.base,elapsed),end=timeAfter(start,durationValue(row.duration)),startConflict=setTimeValue(row,"start",start,operation),endConflict=startConflict||setTimeValue(row,"end",end,operation);if(endConflict)return endConflict;elapsed+=durationValue(row.duration);}return middleEndBeforeStartConflict(rows,state.activeDate);
}
/* 依整條正式鏈所有時間鎖定重算；多個鎖定不相容時回傳第一個實際衝突。 */
function recalculateLockedChain(operation,direct,preferredIndex=-1){
 const rows=activeRows();if(hasInvalidDurationInRows(rows)){const invalid=rows.find(row=>!row.pending&&!durationWithinLimit(row.duration));return durationLimitConflict(invalid,state.activeDate,"day");}const bases=lockedChainBases(rows);if(!bases.length)return null;const preferred=bases.find(item=>item.index===preferredIndex),anchor=preferred||bases[0];
 for(const constraint of bases){if(constraint===anchor)continue;if(constraint.base!==anchor.base){const start=timeAfter(anchor.base,constraint.elapsed),required=constraint.field==="start"?start:timeAfter(start,durationValue(constraint.row.duration)),conflict=conflictFor(constraint.row,constraint.field,required,operation,direct);conflict.anchorRowId=anchor.row.id;return conflict;}}
 let elapsed=0;
 for(const row of rows){if(row.pending)continue;const start=timeAfter(anchor.base,elapsed),end=timeAfter(start,durationValue(row.duration)),startConflict=setTimeValue(row,"start",start,operation,direct);if(startConflict)return startConflict;const endConflict=setTimeValue(row,"end",end,operation,direct);if(endConflict)return endConflict;elapsed+=durationValue(row.duration);}
 return middleEndBeforeStartConflict(rows,state.activeDate);
}
/* 結構性動作優先滿足整條時間鏈的時間鎖定，沒有時間鎖定時沿用既有鄰接串接。 */
function recalculateStructuralChain(index,operation){const rows=activeRows();if(hasInvalidDurationInRows(rows)){const invalid=rows.find(row=>!row.pending&&!durationWithinLimit(row.duration));return durationLimitConflict(invalid,state.activeDate,"day");}const conflict=typeof lockedChainBases==="function"&&lockedChainBases(rows).length?recalculateLockedChain(operation):cascadeFrom(index,operation);return conflict||middleEndBeforeStartConflict(rows,state.activeDate);}
/* 重新檢查所有已保存衝突；每次都從正式時間鏈重建原子衝突，不能由某個來源記錄誤刪其他斷點。 */
function refreshConflicts(){
 normalizeDirectConflictMarkers(state);
 const preserved=state.conflicts.filter(conflict=>!isAutomaticTimelineConflict(conflict)&&conflictStillBlocks(conflict)),automatic=[];
 (state.dates?.length?state.dates:Object.keys(state.days||{})).forEach(date=>{const rows=state.days?.[date]||[];rows.forEach(row=>{if(!durationWithinLimit(row.duration))automatic.push(durationLimitConflict(row,date,"day"));});automatic.push(...middleEndBeforeStartConflicts(rows,date),...timelineAtomicConflicts(rows,date));});
 (state.staging||[]).forEach(row=>{if(!durationWithinLimit(row.duration))automatic.push(durationLimitConflict(row,"","staging"));});
 state.conflicts=preserved.concat(automatic);hydrateConflictBoundaries(state);
}
/* 記錄鎖定衝突；排序回復時一併保存原本插入位置，供之後以真實重算判斷是否已解決。 */
function recordConflict(conflict,reorderContext){
 if(reorderContext)conflict={...conflict,reorderContext};if(conflict.directRowId&&!conflict.boundary){const boundary=deriveConflictBoundary(conflict,activeRows());if(boundary)conflict={...conflict,boundary};}
 state.conflicts=state.conflicts.filter(item=>!(item.directRowId&&item.directRowId===conflict.directRowId&&item.directField===conflict.directField));state.conflicts.push(conflict);persist();
}
/* 成功完成一項操作後刷新衝突並保存目前狀態。 */
function clearConflictsAfterSuccess(){refreshConflicts();persist();}
/* 在衝突回復後重新寫回使用者直接輸入的欄位值。 */
function setDirectValue(row,field,value){row[field]=value;}
/* 更新非正式時間連動入口與待確認欄位，並在成功後重檢既有衝突。 */
function updateRow(area,id,field,value){
 const row=getRow(area,id);if(!row)return;
 if(row.lock===field){showToast("此欄位已鎖定，請先解除鎖定");render();return;}
 if(field==="confirmed"){row.confirmed=Boolean(value);}
 else if(field==="duration"){if(!durationWithinLimit(value)){showToast("單一行程最長為 1440 分鐘");render();return;}row.duration=durationValue(value,0);}
 else if(field==="start"||field==="end"){row[field]=formatTime(value);}
 else row[field]=value;
 clearConflictsAfterSuccess();
 persist();renderDay();renderStaging();
}
/* 找出排序後應保留時間的鎖定開始／結束錨點；拖曳列自身優先，其次才是前後相鄰正式列。 */
function reorderTimeAnchorIndex(row,index){
 const rows=activeRows();if(["start","end"].includes(row.lock))return index;
 const previousIndex=findFormalBefore(rows,index),nextIndex=findFormalAfter(rows,index);
 if(nextIndex>=0&&["start","end"].includes(rows[nextIndex].lock))return nextIndex;
 if(previousIndex>=0&&["start","end"].includes(rows[previousIndex].lock))return previousIndex;
 return-1;
}
/* 依排序後的相鄰正式行程或鎖定時間錨點重算完整時間鏈；時間以 24 小時循環。 */
function recalculateReorderedDayRow(row,index,operation,preservedStart){
 if(row.pending)return null;
 const rows=activeRows(),scope=conflictChainScope(rows,index);if(activeConflictBoundaries(rows).length||!lockedChainBases(rows).length)return recalculateConflictChain(scope,operation,preservedStart||rows.slice(scope.first,scope.last+1).find(item=>!item.pending)?.start||"");
 if(typeof lockedChainBases==="function"&&lockedChainBases(activeRows()).length)return recalculateLockedChain(operation,undefined,reorderTimeAnchorIndex(row,index));
 const anchorIndex=reorderTimeAnchorIndex(row,index);
 if(anchorIndex>=0){
  const anchor=rows[anchorIndex],anchoredField=anchor.lock;
  const requiredField=anchoredField==="start"?"end":"start",requiredValue=anchoredField==="start"?timeAfter(anchor.start,durationValue(anchor.duration)):timeBefore(anchor.end,durationValue(anchor.duration));
  const anchorConflict=setTimeValue(anchor,requiredField,requiredValue,operation);if(anchorConflict)return anchorConflict;
  const backwardConflict=cascadeBackward(anchorIndex,operation);if(backwardConflict)return backwardConflict;
  return cascadeForward(anchorIndex,operation);
 }
 const previousIndex=findFormalBefore(rows,index);
 if(previousIndex>=0)return cascadeForward(index,operation);
 const nextIndex=findFormalAfter(rows,index);
 if(nextIndex<0||!rows[nextIndex].start)return null;
 const endConflict=setTimeValue(row,"end",rows[nextIndex].start,operation);
 if(endConflict)return endConflict;
 const start=timeBefore(row.end,durationValue(row.duration));
 const startConflict=setTimeValue(row,"start",start,operation);
 if(startConflict)return startConflict;
 return cascadeForward(nextIndex,operation);
}
/* 由桌面與觸控共用的排序入口；拖曳列鎖定開始／結束時間時，先取得使用者確認再重算。 */
function requestReorder(area,fromId,toId,placeAfter){
 const row=getRow(area,fromId);if(!row)return;
 if(area==="day"&&crossesConflictBoundary(activeRows(),activeRows().findIndex(item=>item.id===fromId),activeRows().findIndex(item=>item.id===toId))){draggedRow=null;openDialog("時間無法連動修改","時間無法連動修改，請先解決目前衝突\n＊行程移動將復原",[{text:"我知道了",cls:"danger",run:()=>render()}]);return;}
 if(area==="day"&&["start","end"].includes(row.lock)){
  const lockedField=fieldLabel(row.lock),subject=dialogRowName(row);draggedRow=null;
  openDialog("確認時間連動","由於「"+subject+"」的「"+lockedField+"」已鎖定，因此時間連動會以該行程的「"+lockedField+"」為基礎更新其他行程。",[{text:"我知道了",cls:"danger",run:()=>reorderRow(area,fromId,toId,placeAfter)},{text:"取消移動",cls:"",run:()=>render()}]);
  return;
 }
 reorderRow(area,fromId,toId,placeAfter);
}
/* 結構性操作遇時間鎖定衝突時，試算可單列調整時長的候選；取消或無候選都只回復操作。 */
function offerStructuralDurationAdjustment(beforeState,config){
 const {operation,conflict,candidateIds,mode,attempt,success,reorderContext,requiredIncrease=null,lockedRowIds=null}=config,rows=beforeState.days[beforeState.activeDate]||[],locked=Array.isArray(lockedRowIds)?rows.filter(row=>lockedRowIds.includes(row.id)):rows.filter(row=>!row.pending&&["start","end"].includes(row.lock)),candidates=structuralDurationCandidates(beforeState,candidateIds,mode,attempt,requiredIncrease);
 state=structuredClone(beforeState);
 if(!candidates.length){render();openDurationAdjustmentDialog({operation,candidates,locked,onCancel:()=>render()});return;}
 openDurationAdjustmentDialog({operation,candidates,locked,onCancel:()=>{state=structuredClone(beforeState);render();},apply:item=>{state=structuredClone(beforeState);const current=attempt({id:item.row.id,duration:item.target},false);if(current){state=structuredClone(beforeState);render();openDurationAdjustmentDialog({operation,candidates:[],locked,onCancel:()=>render()});return;}clearConflictsAfterSuccess();render();showToast(success);}});
}
/* 依目標列前後位置重新排序，並以排序專用時間錨點重算；未傳第四參數時維持桌面原生放下即置於目標後的舊行為。 */
function reorderRow(area,fromId,toId,placeAfter,adjustment,silent){
 if(!fromId||fromId===toId)return;const list=getList(area),from=list.findIndex(r=>r.id===fromId),to=list.findIndex(r=>r.id===toId);if(from<0||to<0)return;
 if(area==="day"&&crossesConflictBoundary(list,from,to)){if(silent)return{blockedByBoundary:true};draggedRow=null;openDialog("時間無法連動修改","時間無法連動修改，請先解決目前衝突\n＊行程移動將復原",[{text:"我知道了",cls:"danger",run:()=>render()}]);return;}
 const stateBackup=structuredClone(state),scopeBefore=area==="day"?conflictChainScope(list,from):null,preservedStart=scopeBefore&&list.slice(scopeBefore.first,scopeBefore.last+1).find(item=>!item.pending)?.start||"",backup=structuredClone(list),row=list.splice(from,1)[0],insertAt=placeAfter===undefined?to:to+(placeAfter?1:0)-(from<to+(placeAfter?1:0)?1:0);list.splice(insertAt,0,row);if(adjustment){const candidate=list.find(item=>item.id===adjustment.id);if(candidate)candidate.duration=adjustment.duration;}
 const reorderContext={sourceId:row.id,beforeId:list[insertAt-1]&&list[insertAt-1].id||"",afterId:list[insertAt+1]&&list[insertAt+1].id||""};
 if(area==="day"){const conflict=recalculateReorderedDayRow(row,list.indexOf(row),"重新排序",preservedStart);if(conflict){const candidateIds=reorderCandidateIds(list,conflict);state=stateBackup;if(silent)return conflict;if(!adjustment){offerStructuralDurationAdjustment(stateBackup,{operation:"重新排序",conflict,candidateIds,mode:structuralAdjustmentMode(conflict,list),attempt:(trial,trialSilent)=>reorderRow(area,fromId,toId,placeAfter,trial,trialSilent),success:"已調整時長並更新排序",reorderContext});return;}recordConflict(conflict,reorderContext);draggedRow=null;render();presentOperationConflict(conflict);return;}}
 if(silent)return null;
 draggedRow=null;clearConflictsAfterSuccess();render();if(area==="day")showToast("排序已更新");
}
/* 從指定正式行程向上串接，保留各列時長並以 24 小時循環推算開始時間。 */
function cascadeBackward(index,operation,direct){
 const rows=activeRows();let currentIndex=index;
 while(currentIndex>=0){const current=rows[currentIndex];if(!current||current.pending||!current.start||!durationWithinLimit(current.duration))break;const previousIndex=formalIndexBefore(currentIndex);if(previousIndex<0)break;const previous=rows[previousIndex];if(!durationWithinLimit(previous.duration))break;const endConflict=setTimeValue(previous,"end",current.start,operation,direct);if(endConflict)return endConflict;const start=timeBefore(previous.end,durationValue(previous.duration));const startConflict=setTimeValue(previous,"start",start,operation,direct);if(startConflict)return startConflict;currentIndex=previousIndex;}
 return null;
}
/* 從指定正式行程向下串接，保留各列時長並以 24 小時循環推算結束時間。 */
function cascadeForward(index,operation,direct){
 const rows=activeRows();let currentIndex=index;
 while(currentIndex>=0&&currentIndex<rows.length){const current=rows[currentIndex];if(!current||current.pending||!durationWithinLimit(current.duration))break;const previousIndex=formalIndexBefore(currentIndex);if(previousIndex>=0){const previous=rows[previousIndex];if(!previous.end||!durationWithinLimit(previous.duration))break;const startConflict=setTimeValue(current,"start",previous.end,operation,direct);if(startConflict)return startConflict;}
 if(!current.start)break;const end=timeAfter(current.start,durationValue(current.duration));const endConflict=setTimeValue(current,"end",end,operation,direct);if(endConflict)return endConflict;currentIndex=formalIndexAfter(currentIndex);}
 return middleEndBeforeStartConflict(rows,state.activeDate);
}
/* 從指定位置跳過待放置列，向上與向下重新串接正式行程時間鏈。 */
function cascadeFrom(index,operation,direct){const rows=activeRows(),current=rows[index],usable=!current||current.pending?formalIndexAfter(index):index,seed=usable>=0?usable:formalIndexBefore(index);return seed<0?null:cascadeBackward(seed,operation,direct)||cascadeForward(seed,operation,direct);}
/* 將輸入值正規化為 HH:MM 時間文字。 */
function formatTime(value){let str=normalizeNumericInput(value).replace(/[^\d:]/g,"");if(!str)return"";let parts=str.includes(":")?str.split(":"):(str.length>2?[str.slice(0,-2),str.slice(-2)]:[str,"0"]);const h=Math.min(23,Math.max(0,Number(parts[0])||0)),m=Math.min(59,Math.max(0,Number(parts[1])||0));return String(h).padStart(2,"0")+":"+String(m).padStart(2,"0");}
/* 將 HH:MM 時間轉換為當日累積分鐘數。 */
function timeToMin(value){const p=String(value||"00:00").split(":");return Number(p[0])*60+Number(p[1]);}
/* 將分鐘數以 24 小時循環轉換為 HH:MM。 */
function minToTime(value){const m=((Math.round(value)%1440)+1440)%1440;return String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0");}
/* 從開始時間加上分鐘數，以 24 小時循環回傳 HH:MM。 */
function timeAfter(start,duration){return minToTime(timeToMin(start)+Number(duration));}
/* 從結束時間扣除分鐘數，以 24 小時循環回傳 HH:MM。 */
function timeBefore(end,duration){return minToTime(timeToMin(end)-Number(duration));}
/* 計算兩個 HH:MM 間的循環時長；跨午夜時會加回 24 小時。 */
function durationBetween(start,end){const duration=timeToMin(end)-timeToMin(start);return duration>=0?duration:duration+1440;}
/* 以循環時間取得最短帶符號差值，跨午夜 23:00→00:00 為 +60 分鐘。 */
function signedTimeDelta(oldValue,newValue){return((timeToMin(newValue)-timeToMin(oldValue)+2160)%1440)-720;}
/* 將時長正規化為不可為負的分鐘數；缺值建立新列時才採 60 分鐘預設。 */
function durationValue(value,fallback=60){const total=Number(normalizeNumericInput(value));return Number.isFinite(total)&&total>=0?total:fallback;}
/* 將非負分鐘時長轉為列表顯示用文字，包含 0 分鐘。 */
function formatDuration(value){const total=durationValue(value,0),hours=Math.floor(total/60),minutes=total%60;return hours?(hours+"時"+(minutes?minutes+"分":"")):minutes+"分";}
/* 燈箱內引用行程名稱時只使用內容第一行，保留主畫面的完整多行內容。 */
function dialogRowName(row,fallback="此行程"){const first=String(row?.content??"").split(/\r?\n/,1)[0].trim();return first||fallback;}
/* 依修改欄位、相鄰正式行程與本列鎖定欄位列出可用時間調整選項。 */
function timeOptions(row,index,field){
 const previous=formalIndexBefore(index)>=0,next=formalIndexAfter(index)>=0,options=[],lockedField=row.lock==="none"?"":row.lock;
 const add=(key,text,changes,available=true)=>{if(available&&(!lockedField||!changes.includes(lockedField))){const option={key,text,changes};options.push(option);return option;}return null;};
 if(field==="start"){
  add("start-all","時長不變，更新前後行程時間",["start","end"]);
  /* 保留結束時間並更新本列時長；中間列僅在副本試算後仍完整串接時才會列為可用方案。 */
  add("start-self-end","結束時間不變，更新本時長",["start","duration"]);
  const updatePrevious=add("start-up","結束時間不變，更新本時長及前方行程時間",["start","duration"]);if(updatePrevious)updatePrevious.hasPrevious=previous;
  activeRows().forEach((candidate,candidateIndex)=>{
   if(candidate.pending||candidate.id===row.id||candidate.lock==="duration")return;
   const direction=candidateIndex<index?"前方":"後方",label=dialogRowName(candidate);
   const keepDuration=add("start-absorb-duration","時長不變，更新結束時間及"+direction+"：「"+label+"」的時長",["start","end"]);
   if(keepDuration)Object.assign(keepDuration,{targetId:candidate.id,direction,mode:"duration"});
   if(candidateIndex<index){const keepEnd=add("start-absorb-end","結束時間不變，更新本時長及"+direction+"：「"+label+"」的時長",["start","duration"]);if(keepEnd)Object.assign(keepEnd,{targetId:candidate.id,direction,mode:"end"});}
  });
 }else if(field==="end"){
  /* 結束時間的吸收方式依目前正式行程動態產生，候選仍須在副本試算後才會顯示。 */
 add("end-all","時長不變，更新前後行程時間",["start","end"]);
  /* 保留開始時間並更新本列時長；中間列僅在副本試算後仍完整串接時才會列為可用方案。 */
  add("end-self-start","開始時間不變，更新本時長",["end","duration"]);
  const updateNext=add("end-down","開始時間不變，更新本時長及後方行程時間",["end","duration"]);if(updateNext)updateNext.hasNext=next;
  activeRows().forEach((candidate,candidateIndex)=>{
   if(candidate.pending||candidate.id===row.id||candidate.lock==="duration")return;
   const direction=candidateIndex<index?"前方":"後方",label=dialogRowName(candidate);
   const keepDuration=add("end-absorb-duration","時長不變，更新開始時間及"+direction+"：「"+label+"」的時長",["start","end"]);
   if(keepDuration)Object.assign(keepDuration,{targetId:candidate.id,direction,mode:"duration"});
   /* 開始時間不變時，只有後方列可在不移動本列開始時間下吸收差額。 */
   if(candidateIndex>index){const keepStart=add("end-absorb-start","開始時間不變，更新本時長及"+direction+"：「"+label+"」的時長",["end","duration"]);if(keepStart)Object.assign(keepStart,{targetId:candidate.id,direction,mode:"start"});}
  });
 }else{
  activeRows().forEach((candidate,candidateIndex)=>{
   if(candidate.pending||candidate.id===row.id||candidate.lock==="duration")return;
   const direction=candidateIndex<index?"前方":"後方",label=dialogRowName(candidate);
   if(candidateIndex<index){const keepEnd=add("duration-absorb-end","結束時間不變，更新開始時間及"+direction+"：「"+label+"」的時長",["duration","start"]);if(keepEnd)Object.assign(keepEnd,{targetId:candidate.id,direction,mode:"end"});}
  });
  const updatePrevious=add("duration-up","結束時間不變，更新開始時間及之前行程的時間",["duration","start"]);if(updatePrevious)updatePrevious.hasPrevious=previous;
  activeRows().forEach((candidate,candidateIndex)=>{
   if(candidate.pending||candidate.id===row.id||candidate.lock==="duration")return;
   const direction=candidateIndex<index?"前方":"後方",label=dialogRowName(candidate);
   if(candidateIndex>index){const keepStart=add("duration-absorb-start","開始時間不變，更新結束時間及"+direction+"：「"+label+"」的時長",["duration","end"]);if(keepStart)Object.assign(keepStart,{targetId:candidate.id,direction,mode:"start"});}
  });
  const updateNext=add("duration-down","開始時間不變，更新結束時間及之後行程的時間",["duration","end"]);if(updateNext)updateNext.hasNext=next;
 }return options;
}
/* 讓指定正式行程吸收結束時間差額；中間列只平移時間、不改時長。 */
function applyEndAbsorbOption(row,index,value,option,direct){
 const rows=activeRows(),targetIndex=rows.findIndex(item=>item.id===option.targetId),target=rows[targetIndex],operation="更新"+option.direction+"行程的時長";
 if(!target||target.pending||targetIndex===index)return conflictFor(row,"end",value,operation,direct);
 const set=(item,field,next)=>setTimeValue(item,field,next,operation,direct),oldEnd=row.end,delta=signedTimeDelta(oldEnd,value);
 let conflict=null;
 if(option.mode==="duration"){
  const start=timeBefore(value,durationValue(row.duration));conflict=set(row,"end",value)||set(row,"start",start);if(conflict)return conflict;
  if(targetIndex>index){
   conflict=cascadeBackward(index,operation,direct);if(conflict)return conflict;
   for(let currentIndex=formalIndexAfter(index);currentIndex>=0&&currentIndex<targetIndex;currentIndex=formalIndexAfter(currentIndex)){const current=rows[currentIndex],previous=rows[formalIndexBefore(currentIndex)];conflict=set(current,"start",previous.end)||set(current,"end",timeAfter(current.start,durationValue(current.duration)));if(conflict)return conflict;}
   const previous=rows[formalIndexBefore(targetIndex)],nextDuration=durationValue(target.duration)-delta;conflict=set(target,"start",previous.end)||set(target,"duration",nextDuration)||set(target,"end",timeAfter(target.start,durationValue(target.duration)));
  }else{
   for(let currentIndex=formalIndexBefore(index);currentIndex>targetIndex;currentIndex=formalIndexBefore(currentIndex)){const current=rows[currentIndex],next=rows[formalIndexAfter(currentIndex)];conflict=set(current,"end",next.start)||set(current,"start",timeBefore(current.end,durationValue(current.duration)));if(conflict)return conflict;}
   const next=rows[formalIndexAfter(targetIndex)],nextDuration=durationValue(target.duration)+delta;conflict=set(target,"end",next.start)||set(target,"duration",nextDuration)||set(target,"start",timeBefore(target.end,durationValue(target.duration)))||cascadeForward(index,operation,direct);
  }
 }else{
  if(targetIndex<index)return conflictFor(target,"duration",target.duration,operation,direct);
  const duration=durationBetween(row.start,value);conflict=set(row,"end",value)||set(row,"duration",duration);if(conflict)return conflict;
  for(let currentIndex=formalIndexAfter(index);currentIndex>=0&&currentIndex<targetIndex;currentIndex=formalIndexAfter(currentIndex)){const current=rows[currentIndex],previous=rows[formalIndexBefore(currentIndex)];conflict=set(current,"start",previous.end)||set(current,"end",timeAfter(current.start,durationValue(current.duration)));if(conflict)return conflict;}
  const previous=rows[formalIndexBefore(targetIndex)],nextDuration=durationValue(target.duration)-delta;conflict=set(target,"start",previous.end)||set(target,"duration",nextDuration)||set(target,"end",timeAfter(target.start,durationValue(target.duration)));
 }
 return conflict||middleEndBeforeStartConflict(rows,state.activeDate)||null;
}
/* 讓指定行程吸收開始時間差額；時長不變可由兩側吸收，結束時間不變只可由前方吸收。 */
function applyStartAbsorbOption(row,index,value,option,direct){
 const rows=activeRows(),targetIndex=rows.findIndex(item=>item.id===option.targetId),target=rows[targetIndex],operation="更新"+option.direction+"行程的時長";
 if(!target||target.pending||targetIndex===index)return conflictFor(row,"start",value,operation,direct);
 const set=(item,field,next)=>setTimeValue(item,field,next,operation,direct),oldStart=row.start,delta=signedTimeDelta(oldStart,value);let conflict=null;
 if(option.mode==="duration"){
  const end=timeAfter(value,durationValue(row.duration));conflict=set(row,"start",value)||set(row,"end",end);if(conflict)return conflict;
  if(targetIndex>index){
   conflict=cascadeBackward(index,operation,direct);if(conflict)return conflict;
   for(let currentIndex=formalIndexAfter(index);currentIndex>=0&&currentIndex<targetIndex;currentIndex=formalIndexAfter(currentIndex)){const current=rows[currentIndex],previous=rows[formalIndexBefore(currentIndex)];conflict=set(current,"start",previous.end)||set(current,"end",timeAfter(current.start,durationValue(current.duration)));if(conflict)return conflict;}
   const previous=rows[formalIndexBefore(targetIndex)],nextDuration=durationValue(target.duration)-delta;if(nextDuration<0)return insufficientDurationConflict(target,nextDuration,operation,direct);conflict=set(target,"start",previous.end)||set(target,"duration",nextDuration)||set(target,"end",timeAfter(target.start,durationValue(target.duration)));
  }else{
   for(let currentIndex=formalIndexBefore(index);currentIndex>targetIndex;currentIndex=formalIndexBefore(currentIndex)){const current=rows[currentIndex],next=rows[formalIndexAfter(currentIndex)];conflict=set(current,"end",next.start)||set(current,"start",timeBefore(current.end,durationValue(current.duration)));if(conflict)return conflict;}
   const next=rows[formalIndexAfter(targetIndex)],nextDuration=durationValue(target.duration)+delta;if(nextDuration<0)return insufficientDurationConflict(target,nextDuration,operation,direct);conflict=set(target,"end",next.start)||set(target,"duration",nextDuration)||set(target,"start",timeBefore(target.end,durationValue(target.duration)))||cascadeForward(index,operation,direct);
  }
 }else{
  if(targetIndex>index)return conflictFor(target,"duration",target.duration,operation,direct);
  const duration=durationBetween(value,row.end);conflict=set(row,"start",value)||set(row,"duration",duration);if(conflict)return conflict;
  for(let currentIndex=formalIndexBefore(index);currentIndex>targetIndex;currentIndex=formalIndexBefore(currentIndex)){const current=rows[currentIndex],next=rows[formalIndexAfter(currentIndex)];conflict=set(current,"end",next.start)||set(current,"start",timeBefore(current.end,durationValue(current.duration)));if(conflict)return conflict;}
  const next=rows[formalIndexAfter(targetIndex)],nextDuration=durationValue(target.duration)+delta;if(nextDuration<0)return insufficientDurationConflict(target,nextDuration,operation,direct);conflict=set(target,"end",next.start)||set(target,"duration",nextDuration)||set(target,"start",timeBefore(target.end,durationValue(target.duration)));
 }
 return conflict||middleEndBeforeStartConflict(rows,state.activeDate)||null;
}
/* 讓指定行程吸收總時長差額；結束時間不變只可由前方吸收，開始時間不變只可由後方吸收。 */
function applyDurationAbsorbOption(row,index,value,option,direct){
 const rows=activeRows(),targetIndex=rows.findIndex(item=>item.id===option.targetId),target=rows[targetIndex],operation="更新"+option.direction+"行程的時長";
 if(!target||target.pending||targetIndex===index)return conflictFor(row,"duration",value,operation,direct);
 const set=(item,field,next)=>setTimeValue(item,field,next,operation,direct),delta=durationValue(value)-durationValue(row.duration);let conflict=null;
 if(option.mode==="end"){
  if(targetIndex>index)return conflictFor(target,"duration",target.duration,operation,direct);
  const start=timeBefore(row.end,durationValue(value));conflict=set(row,"duration",value)||set(row,"start",start);if(conflict)return conflict;
  for(let currentIndex=formalIndexBefore(index);currentIndex>targetIndex;currentIndex=formalIndexBefore(currentIndex)){const current=rows[currentIndex],next=rows[formalIndexAfter(currentIndex)];conflict=set(current,"end",next.start)||set(current,"start",timeBefore(current.end,durationValue(current.duration)));if(conflict)return conflict;}
  const next=rows[formalIndexAfter(targetIndex)],nextDuration=durationValue(target.duration)-delta;if(nextDuration<0)return insufficientDurationConflict(target,nextDuration,operation,direct);conflict=set(target,"end",next.start)||set(target,"duration",nextDuration)||set(target,"start",timeBefore(target.end,durationValue(target.duration)));
 }else{
  if(targetIndex<index)return conflictFor(target,"duration",target.duration,operation,direct);
  const end=timeAfter(row.start,durationValue(value));conflict=set(row,"duration",value)||set(row,"end",end);if(conflict)return conflict;
  for(let currentIndex=formalIndexAfter(index);currentIndex>=0&&currentIndex<targetIndex;currentIndex=formalIndexAfter(currentIndex)){const current=rows[currentIndex],previous=rows[formalIndexBefore(currentIndex)];conflict=set(current,"start",previous.end)||set(current,"end",timeAfter(current.start,durationValue(current.duration)));if(conflict)return conflict;}
  const previous=rows[formalIndexBefore(targetIndex)],nextDuration=durationValue(target.duration)-delta;if(nextDuration<0)return insufficientDurationConflict(target,nextDuration,operation,direct);conflict=set(target,"start",previous.end)||set(target,"duration",nextDuration)||set(target,"end",timeAfter(target.start,durationValue(target.duration)));
 }
 return conflict||middleEndBeforeStartConflict(rows,state.activeDate)||null;
}
/* 依使用者選擇的時間調整方式，更新本列與相鄰時間鏈；只在鎖定欄位衝突時停止。 */
function applyTimeOption(row,index,field,value,option,direct){
 const key=typeof option==="string"?option:option.key;
 if(key==="start-absorb-duration"||key==="start-absorb-end")return applyStartAbsorbOption(row,index,value,option,direct);
 if(key==="end-absorb-duration"||key==="end-absorb-start")return applyEndAbsorbOption(row,index,value,option,direct);
 if(key==="duration-absorb-end"||key==="duration-absorb-start")return applyDurationAbsorbOption(row,index,value,option,direct);
 const invalid=activeRows().find(item=>!item.pending&&!durationWithinLimit(item.duration)&&!(item.id===row.id&&field==="duration"&&durationWithinLimit(value)));if(invalid)return durationLimitConflict(invalid,state.activeDate,"day");
 const operation={"start-all":"更新前後行程時間","start-self-end":"更新本行程時長","start-up":"更新之前行程的時間","end-all":"更新前後行程時間","end-self-start":"更新本行程時長","end-down":"更新之後行程的時間","duration-up":"更新之前行程的時間","duration-down":"更新之後行程的時間"}[key];
 const set=(name,next)=>setTimeValue(row,name,next,operation,direct);
 let conflict=null;
 if(key==="start-all"){const end=timeAfter(value,durationValue(row.duration));conflict=set("start",value)||set("end",end)||cascadeFrom(index,operation,direct);}
 else if(key==="start-self-end"){const duration=durationBetween(value,row.end);conflict=set("start",value)||set("duration",duration);}

 else if(key==="end-all"){const start=timeBefore(value,durationValue(row.duration));conflict=set("end",value)||set("start",start)||cascadeFrom(index,operation,direct);}
 else if(key==="end-self-start"){const duration=durationBetween(row.start,value);conflict=set("end",value)||set("duration",duration);}

 else if(key==="start-up"){const duration=durationBetween(value,row.end);conflict=set("start",value)||set("duration",duration);if(!conflict)conflict=cascadeBackward(index,operation,direct);}
 else if(key==="end-down"){const duration=durationBetween(row.start,value);conflict=set("end",value)||set("duration",duration);if(!conflict)conflict=cascadeForward(index,operation,direct);}
 else if(key==="duration-up"){const start=timeBefore(row.end,Number(value));conflict=set("duration",value)||set("start",start);if(!conflict)conflict=cascadeBackward(index,operation,direct);}
 else if(key==="duration-down"){const end=timeAfter(row.start,Number(value));conflict=set("duration",value)||set("end",end);if(!conflict)conflict=cascadeForward(index,operation,direct);}
 const middleCrossMidnight=middleEndBeforeStartConflict(activeRows(),state.activeDate);
 return conflict||middleCrossMidnight||null;
}
/* 保留直接輸入值與其連動選擇，供日後檢查實際受影響時間鏈。 */
function preserveDirectConflict(backup,rowId,field,value,conflict,directContext){state.days[state.activeDate]=backup;const row=activeRows().find(item=>item.id===rowId);if(row)setDirectValue(row,field,value);recordConflict({...conflict,directContext});render();openConflictModal(conflict,true);}
/* 執行已選時間調整選項；若碰鎖定則保留直接輸入並保存衝突。 */
function executeTimeOption(row,index,field,value,option,successMessage){const backup=structuredClone(activeRows()),direct={rowId:row.id,field},conflict=applyTimeOption(row,index,field,value,option,direct);if(conflict){preserveDirectConflict(backup,row.id,field,value,conflict,{kind:"option",key:option.key,field});return;}clearConflictsAfterSuccess();render();showToast(successMessage||"時間連動已更新");}
/* 在完整狀態副本中試算一個時間連動方式，過程不保存、不繪製也不改變外部狀態。 */
function previewTimeOption(row,index,field,value,option){
 const original=state,trial=structuredClone(state);state=trial;
 try{const trialRow=activeRows().find(item=>item.id===row.id),conflict=applyTimeOption(trialRow,index,field,value,option,{rowId:row.id,field});return{option,conflict,trial};}
 finally{state=original;}
}
/* 判斷開始／結束輸入是否正好位於兩側已鎖定的正式時間邊界，並收集其局部驗證範圍。 */
function lockedBoundaryTimeEditScope(row,index,field,value){
 const rows=activeRows(),previousIndex=formalIndexBefore(index),nextIndex=formalIndexAfter(index),previous=rows[previousIndex],next=rows[nextIndex];
 if(row.pending||!['start','end'].includes(field)||!previous||!next||previous.lock!=="end"||next.lock!=="start"||![previous,row,next].every(item=>item.start&&item.end))return null;
 const connects=field==="start"?value===previous.end&&row.end===next.start:value===next.start&&row.start===previous.end;
 return connects?{previousIndex,nextIndex}:null;
}
/* 在雙側鎖定輸入的完整副本中，只驗證受影響正式列的起訖、時長與相接鏈，排除不一致候選。 */
function lockedBoundaryTrialScope(before,trial,rowId,boundary){
 const oldRows=before.days[before.activeDate]||[],trialRows=trial.days[trial.activeDate]||[],center=oldRows.findIndex(item=>item.id===rowId),ids=new Set([oldRows[boundary.previousIndex]?.id,rowId,oldRows[boundary.nextIndex]?.id].filter(Boolean));
 oldRows.forEach(row=>{if(row.pending)return;const next=trialRows.find(item=>item.id===row.id);if(!next||["start","end","duration"].some(field=>row[field]!==next[field]))ids.add(row.id);});
 const indexes=oldRows.map((row,index)=>ids.has(row.id)&&!row.pending?index:-1).filter(index=>index>=0),first=Math.min(...indexes),last=Math.max(...indexes),scope=[];
 for(let index=first;index<=last;index++){const row=oldRows[index];if(!row.pending)scope.push(row.id);}
 const trialScope=scope.map(id=>trialRows.find(row=>row.id===id));
 if(trialScope.some(row=>!row||!row.start||!row.end||timeAfter(row.start,durationValue(row.duration))!==row.end))return null;
 if(trialScope.some((row,index)=>index&&trialScope[index-1].end!==row.start))return null;
 return scope;
}
/* 比較雙側鎖定候選的完整受影響資料，收斂為相同結果供確認燈箱使用。 */
function matchingLockedBoundaryTrial(previews,before,rowId,field,boundary,row){
 const usable=previews.filter(preview=>!preview.conflict).map(preview=>({preview,scope:lockedBoundaryTrialScope(before,preview.trial,rowId,boundary)})).filter(item=>item.scope),ids=[...new Set(usable.flatMap(item=>item.scope))];
 if(!usable.length)return{usable,chosen:null};
 const snapshot=item=>JSON.stringify(ids.map(id=>item.preview.trial.days[item.preview.trial.activeDate].find(row=>row.id===id)||null)),signature=snapshot(usable[0]);
 if(!usable.every(item=>snapshot(item)===signature))return{usable,chosen:null};
 const chosen=usable[0].preview,nextRows=chosen.trial.days[chosen.trial.activeDate]||[],beforeRows=before.days[before.activeDate]||[],next=nextRows.find(item=>item.id===rowId),old=beforeRows.find(item=>item.id===rowId),othersUnchanged=beforeRows.length===nextRows.length&&beforeRows.filter(item=>item.id!==rowId).every(item=>JSON.stringify(item)===JSON.stringify(nextRows.find(next=>next.id===item.id))),allowed=next&&othersUnchanged&&Object.keys(next).every(key=>next[key]===old[key]||key===field||key==="duration"&&row.lock!=="duration");
 return{usable,chosen:allowed?chosen:null};
}
/* 在完整副本中試算首次或補齊時間的另一端與時間鏈，失敗時同樣不寫入真實資料。 */
function previewCompanionTime(row,index,field,value,operation){
 const original=state,trial=structuredClone(state);state=trial;
 try{const trialRow=activeRows().find(item=>item.id===row.id),companion=field==="start"?"end":"start";trialRow[field]=value;const next=field==="start"?timeAfter(trialRow.start,durationValue(trialRow.duration)):timeBefore(trialRow.end,durationValue(trialRow.duration)),direct={rowId:row.id,field},conflict=setTimeValue(trialRow,companion,next,operation,direct)||cascadeFrom(index,operation,direct),middle=middleEndBeforeStartConflict(activeRows(),state.activeDate);return{trial,conflict:conflict||middle||null};}
 finally{state=original;}
}
/* 顯示沒有可行連動方式時的合併阻擋原因，套用按鈕保留版位但不可操作。 */
function openNoTimeOptionDialog(row,index,field,value,operation,preview){
 const content=document.createElement("div");content.className="time-option-copy";appendNoTimeOptionMessage(content,[preview]);
 const preserve=()=>keepTimeEditConflict(structuredClone(activeRows()),row.id,index,field,value,null,preview);
 openDialog(timeEditDialogTitle(row,field,value),content,[{text:"套用變更",cls:"primary",run:()=>{}},{text:"保留衝突",cls:"danger",run:preserve},{text:"復原",cls:"",run:()=>renderDay()}],{dialogClass:"time-option-dialog",actionsClass:"time-option-wheel-actions",onCancel:preserve,disablePrimary:true,focusDialog:true});
}
/* 以安全文字節點呈現無解原因，只強調實際鎖定的行程名稱與欄位。 */
function appendNoTimeOptionMessage(content,previews){
 const locked=[],insufficient=[],timeOrder=[],seenLocked=new Set(),seenInsufficient=new Set(),seenTimeOrder=new Set(),appendJoined=(items,appendItem)=>items.forEach((item,index)=>{if(index)content.append(index===items.length-1?"及":"、");appendItem(item);});
 previews.forEach(preview=>{const conflict=preview&&preview.conflict;if(!conflict)return;const row=getRow("day",conflict.lockedRowId),name=dialogRowName(row),subject=name!=="此行程"?"「"+name+"」行程":"此行程";
  if(conflict.endBeforeStart){if(!seenTimeOrder.has(conflict.lockedRowId)){seenTimeOrder.add(conflict.lockedRowId);timeOrder.push(subject+"的結束時間不可早於開始時間");}return;}
  if(conflict.insufficientDuration){if(!seenInsufficient.has(conflict.lockedRowId)){seenInsufficient.add(conflict.lockedRowId);insufficient.push(subject+"的時長不足");}return;}
  const key=conflict.lockedRowId+":"+conflict.lockedField;if(!seenLocked.has(key)){seenLocked.add(key);locked.push(subject+"的「"+fieldLabel(conflict.lockedField)+"」");}
 });
 content.append("由於");if(locked.length){appendJoined(locked,item=>{const lock=document.createElement("span");lock.className="time-option-lock";lock.textContent=item;content.append(lock);});content.append("已鎖定");}if(locked.length&&(insufficient.length||timeOrder.length))content.append("，且");if(insufficient.length)appendJoined(insufficient,item=>content.append(item));if(insufficient.length&&timeOrder.length)content.append("，且");if(timeOrder.length)appendJoined(timeOrder,item=>content.append(item));if(!locked.length&&!insufficient.length&&!timeOrder.length)content.append("目前條件無法成立");content.append("，目前沒有可套用的調整方式。");
}
/* 彙整無可行時間選項的實際阻擋來源，依鎖定列欄位去重並區分時長不足。 */
function noTimeOptionMessage(previews){
 const locked=[],insufficient=[],timeOrder=[],seenLocked=new Set(),seenInsufficient=new Set(),seenTimeOrder=new Set(),join=items=>items.length<2?items[0]||"":items.length===2?items.join("及"):items.slice(0,-1).join("、")+"及"+items.at(-1);
 previews.forEach(preview=>{const conflict=preview&&preview.conflict;if(!conflict)return;const row=getRow("day",conflict.lockedRowId),name=dialogRowName(row),subject=name!=="此行程"?"「"+name+"」行程":"此行程";
  if(conflict.endBeforeStart){if(!seenTimeOrder.has(conflict.lockedRowId)){seenTimeOrder.add(conflict.lockedRowId);timeOrder.push(subject+"的結束時間不可早於開始時間");}return;}
  if(conflict.insufficientDuration){if(!seenInsufficient.has(conflict.lockedRowId)){seenInsufficient.add(conflict.lockedRowId);insufficient.push(subject+"的時長不足");}return;}
  const key=conflict.lockedRowId+":"+conflict.lockedField;if(!seenLocked.has(key)){seenLocked.add(key);locked.push(subject+"的「"+fieldLabel(conflict.lockedField)+"」");}
 });
 const reasons=[];if(locked.length)reasons.push(join(locked)+"已鎖定");if(insufficient.length)reasons.push(join(insufficient));if(timeOrder.length)reasons.push(join(timeOrder));return "由於"+(reasons.join("，且")||"目前條件無法成立")+"，目前沒有可套用的調整方式。";
}
/* 將時間連動衝突整理成使用者可辨識的原因，包含鎖定值、所需值或負時長吸收。 */
function timeOptionBlockReason(preview){
 const conflict=preview.conflict;if(!conflict)return"";
 if(conflict.insufficientDuration)return "「"+dialogRowName(getRow("day",conflict.lockedRowId))+"」的「總時長」需為 "+conflict.requiredValue+" 分鐘，會成為負值。";
 const subject=dialogRowName(getRow("day",conflict.lockedRowId));
 return "「"+subject+"」的「"+fieldLabel(conflict.lockedField)+"」鎖定為 "+conflict.lockedValue+"，時間串接需為 "+conflict.requiredValue+"。";
}
/* 以本列及最近正式前後列建立真實不一致衝突；未鎖定資料不會被假稱為鎖定欄位。 */
function keepTimeEditConflict(backup,rowId,index,field,value,option,preview){
 state.days[state.activeDate]=backup;const row=activeRows().find(item=>item.id===rowId);if(!row)return;setDirectValue(row,field,value);
 const rows=activeRows(),chainRowIds=[formalIndexBefore(index)>=0&&rows[formalIndexBefore(index)].id,row.id,formalIndexAfter(index)>=0&&rows[formalIndexAfter(index)].id].filter(Boolean);
 const directCheck={date:state.activeDate,directRowId:row.id,directContext:{chainRowIds}};if(!directConflictStillBlocks(directCheck)){clearConflictsAfterSuccess();render();return;}
 const original=preview&&preview.conflict,conflict=original?{...original}:{id:makeId(),date:state.activeDate,lockedRowId:row.id,lockedField:"",lockedValue:"",requiredValue:"",operation:"保留衝突"};
 const storedConflict={...conflict,directRowId:row.id,directField:field,directContext:{kind:"kept-option",key:option&&option.key||"",field,chainRowIds}};recordConflict(storedConflict);render();openConflictModal(storedConflict,true);
}
/* 將時間連動方式拆成「不變、更新、必要的前方／後方吸收目標」三個可連動選取位置。 */
function timeOptionParts(option){
 const key=typeof option==="string"?option:option.key;
 if(key==="start-absorb-duration"||key==="start-absorb-end"||key==="end-absorb-duration"||key==="end-absorb-start"||key==="duration-absorb-end"||key==="duration-absorb-start"){
  const target=activeRows().find(row=>row.id===option.targetId),label=dialogRowName(target);
  if(key==="start-absorb-duration")return["時長","結束時間",option.direction+"：「"+label+"」"];
  if(key==="start-absorb-end")return["結束時間","本時長",option.direction+"：「"+label+"」"];
  if(key==="duration-absorb-end")return["結束時間","開始時間",option.direction+"：「"+label+"」"];
  if(key==="duration-absorb-start")return["開始時間","結束時間",option.direction+"：「"+label+"」"];
  return[key==="end-absorb-duration"?"時長":"開始時間",key==="end-absorb-duration"?"開始時間":"本時長",option.direction+"：「"+label+"」"];
 }
 const parts={
  "start-all":["時長","前後行程時間",""] ,"start-self-end":["結束時間","本時長",""],"start-up":["結束時間","本時長","前方行程時間"],
  "end-all":["時長","前後行程時間",""] ,"end-self-start":["開始時間","本時長",""],"end-down":["開始時間","本時長","後方行程時間"],
  "duration-up":["結束時間","開始時間",option?.hasPrevious===false?"":"之前行程的時間"],"duration-down":["開始時間","結束時間",option?.hasNext===false?"":"之後行程的時間"]
 };return parts[key]||["","",""];
}
/* 回傳各時間候選在預覽中實際提及的列與欄位，避免顯示未由滾輪指定的連動變更。 */
function timeOptionPreviewFields(option,rowId){
 const targetId=option?.targetId,key=option?.key,fields=new Map(),add=(id,field)=>{if(!id)return;const values=fields.get(id)||new Set();values.add(field);fields.set(id,values);};
 if(key==="start-absorb-duration"){add(rowId,"end");add(targetId,"duration");}
 else if(key==="start-absorb-end"){add(rowId,"duration");add(targetId,"duration");}
 else if(key==="start-self-end"){add(rowId,"duration");}
 else if(key==="end-absorb-duration"){add(rowId,"start");add(targetId,"duration");}
 else if(key==="end-absorb-start"){add(rowId,"duration");add(targetId,"duration");}
 else if(key==="end-self-start"){add(rowId,"duration");}
 else if(key==="duration-absorb-end"){add(rowId,"start");add(targetId,"duration");}
 else if(key==="duration-absorb-start"){add(rowId,"end");add(targetId,"duration");}
 else if(key==="start-up"){add(rowId,"duration");}
 else if(key==="end-down"){add(rowId,"duration");}
 else if(key==="duration-up"){add(rowId,"start");}
 else if(key==="duration-down"){add(rowId,"end");}
 return fields;
}
/* 比較副本前後的預覽列，只呈現句中滾輪指定更新的欄位，並摘要其餘自動連動。 */
function timeOptionPreviewSummary(before,trial,rowId,option){
 const oldRows=before.days[before.activeDate]||[],newRows=trial.days[trial.activeDate]||[],fields=timeOptionPreviewFields(option,rowId),lines=[],entries=[];
 fields.forEach((selectedFields,id)=>{const old=oldRows.find(row=>row.id===id),next=newRows.find(row=>row.id===id);if(!old||!next)return;const changes=[...selectedFields].filter(field=>old[field]!==next[field]);if(!changes.length)return;const name=dialogRowName(old),details="："+changes.map(field=>fieldLabel(field)+" "+(field==="duration"?formatDuration(old[field])+"→"+formatDuration(next[field]):old[field]+"→"+next[field])).join("、");lines.push(name+details);entries.push({name,details});});
 const shownIds=new Set([...fields.keys()]),changed=newRows.filter((row,index)=>!row.pending&&oldRows[index]&&["start","end","duration"].some(field=>row[field]!==oldRows[index][field])),hasAutoLinked=changed.some(row=>!shownIds.has(row.id));return{lines,entries,hasAutoLinked};
}
/* 建立時間修改燈箱標題，清楚標示使用者輸入前後的欄位值。 */
function timeEditDialogTitle(row,field,value){
 const name=dialogRowName(row),subject=name!=="此行程"?"「"+name+"」":"此行程",before=field==="duration"?formatDuration(row[field]):row[field]||"空白",after=field==="duration"?formatDuration(value):value;
 return subject+"的「"+fieldLabel(field)+"」已從"+before+"修改為"+after;
}
/* 建立多值位置可操作、唯一值僅文字的句中時間調整滾輪，並支援滑鼠、拖曳與鍵盤切換。 */
function openTimeOptionWheel(row,index,field,value,options,previews){
 const valid=previews.filter(item=>!item.conflict&&!item.inconsistent),blocked=previews.filter(item=>item.conflict);let selected=0;const content=document.createElement("div");content.className="time-option-copy";
 if(!valid.length){appendNoTimeOptionMessage(content,blocked);openDialog(timeEditDialogTitle(row,field,value),content,[{text:"套用變更",cls:"primary",run:()=>{}},{text:"保留衝突",cls:"danger",run:()=>keepTimeEditConflict(structuredClone(activeRows()),row.id,index,field,value,null,null)},{text:"復原",cls:"",run:()=>renderDay()}],{dialogClass:"time-option-dialog",actionsClass:"time-option-wheel-actions",onCancel:()=>keepTimeEditConflict(structuredClone(activeRows()),row.id,index,field,value,null,null),disablePrimary:true,focusDialog:true});return;}
 const intro=document.createElement("p"),first=document.createElement("span"),middle=document.createTextNode("不變，更新"),second=document.createElement("span"),thirdWrap=document.createElement("span"),third=document.createElement("span"),thirdSuffix=document.createTextNode(""),suffix=document.createTextNode("。");intro.className="time-option-intro";intro.textContent="請選擇一項您希望的調整方式來完成安排。";thirdWrap.append("及",third,thirdSuffix);content.append(intro,first,middle,second,thirdWrap,suffix);let focusPosition=-1;const wheels={};
 const choose=(position,nextValue,restoreFocus=false,preserveWheel=false)=>{const current=timeOptionParts(valid[selected].option),candidate=valid.find(item=>{const parts=timeOptionParts(item.option);return parts[position]===nextValue&&parts.slice(0,position).every((part,i)=>part===current[i])&&parts.slice(position+1).every((part,i)=>part===current[position+1+i]);})||valid.find(item=>{const parts=timeOptionParts(item.option);return parts[position]===nextValue&&parts.slice(0,position).every((part,i)=>part===current[i]);})||valid.find(item=>timeOptionParts(item.option)[position]===nextValue);selected=valid.indexOf(candidate);focusPosition=restoreFocus?position:-1;update(preserveWheel?position:-1);};
 const renderWheel=(target,position)=>{const current=timeOptionParts(valid[selected].option),compatible=valid.filter(item=>timeOptionParts(item.option).slice(0,position).every((part,i)=>part===current[i])),values=[...new Set(compatible.map(item=>timeOptionParts(item.option)[position]).filter(Boolean))];if(values.length===1){clearTimeout(wheels[position]?._wheelTimer);target.textContent=current[position];return;}let wheel=wheels[position];if(!wheel){wheel=document.createElement("div");wheels[position]=wheel;wheel.className="time-option-wheel";wheel.dataset.position=position;wheel.tabIndex=0;wheel.setAttribute("role","listbox");wheel._clearVisual=()=>{wheel.classList.toggle("is-scrolling",false);Array.from(wheel.children).forEach(button=>button.classList.toggle("is-centered",false));};wheel._syncVisual=()=>{const at=Math.max(0,Math.min(wheel._values.length-1,Math.round(wheel.scrollTop/34)));wheel.classList.toggle("is-scrolling",true);Array.from(wheel.children).forEach((button,index)=>button.classList.toggle("is-centered",index===at));};wheel._preview=()=>{const at=Math.max(0,Math.min(wheel._values.length-1,Math.round(wheel.scrollTop/34))),live=timeOptionParts(valid[selected].option),currentAt=wheel._values.indexOf(live[position]);if(at!==currentAt)choose(position,wheel._values[at],true,true);};wheel._settle=()=>{clearTimeout(wheel._wheelTimer);wheel._wheelTimer=setTimeout(()=>wheel._preview(),16);};wheel._commit=()=>{clearTimeout(wheel._wheelTimer);wheel._clearVisual();const at=Math.max(0,Math.min(wheel._values.length-1,Math.round(wheel.scrollTop/34))),live=timeOptionParts(valid[selected].option),currentAt=wheel._values.indexOf(live[position]);wheel.scrollTop=at*34;if(at!==currentAt)choose(position,wheel._values[at],true);else update();};wheel.addEventListener("wheel",event=>{if(event.deltaMode===1){event.preventDefault();wheel._step(event.deltaY>0?1:-1);return;}},{passive:false});wheel.addEventListener("scroll",()=>{wheel._syncVisual();wheel._settle();});wheel.addEventListener("scrollend",()=>wheel._commit());wheel.addEventListener("keydown",event=>{if(["ArrowDown","ArrowRight"].includes(event.key)){event.preventDefault();wheel._step(1);}if(["ArrowUp","ArrowLeft"].includes(event.key)){event.preventDefault();wheel._step(-1);}});wheel.addEventListener("pointerdown",event=>{wheel._pointerId=event.pointerId;wheel._pointerY=event.clientY;});wheel.addEventListener("pointermove",event=>{if(event.pointerId!==wheel._pointerId||Math.abs(event.clientY-wheel._pointerY)<=12)return;if(!wheel.hasPointerCapture?.(wheel._pointerId))wheel.setPointerCapture?.(wheel._pointerId);wheel._step(event.clientY<wheel._pointerY?1:-1);wheel._pointerY=event.clientY;});wheel.addEventListener("pointerup",event=>{if(event.pointerId===wheel._pointerId)wheel._pointerId=null;});wheel.addEventListener("pointercancel",()=>{wheel._pointerId=null;});}if(target.firstChild!==wheel)target.replaceChildren(wheel);wheel._values=values;wheel._step=delta=>{wheel._commit?.();const live=timeOptionParts(valid[selected].option),at=wheel._values.indexOf(live[position]),next=Math.max(0,Math.min(wheel._values.length-1,at+delta));choose(position,wheel._values[next],true);};wheel._clearVisual?.();wheel.replaceChildren();values.forEach(text=>{const button=document.createElement("button");button.type="button";button.className="time-option-wheel-value"+(text===current[position]?" selected":"");button.setAttribute("role","option");button.setAttribute("aria-selected",String(text===current[position]));button.textContent=text;button.addEventListener("click",()=>choose(position,text));wheel.append(button);});const center=()=>{wheel.scrollTop=values.indexOf(current[position])*34;};center();requestAnimationFrame(center);};
 content.addEventListener("keydown",event=>{if(!["Home","End"].includes(event.key)||!event.target.classList?.contains("time-option-wheel"))return;event.preventDefault();const position=Number(event.target.dataset.position),wheel=wheels[position],target=event.key==="Home"?wheel._values[0]:wheel._values[wheel._values.length-1];choose(position,target,true);});
 const result=document.createElement("p");result.className="time-option-preview";content.append(result);
 const renderPreview=preview=>{result.replaceChildren();preview.entries.forEach(({name,details})=>{const entry=document.createElement("span"),icon=document.createElement("i"),nameNode=document.createElement("span"),detailsNode=document.createElement("span"),nameChars=[...name];entry.className="time-option-preview-entry";icon.className="fa-solid fa-tag time-option-preview-tag";icon.setAttribute("aria-hidden","true");nameNode.className="time-option-preview-name";nameNode.title=name;if(nameChars.length>20){const prefix=document.createElement("span"),suffix=document.createElement("span"),ellipsis=document.createElement("span");nameNode.classList.add("is-long");prefix.className="time-option-preview-name-prefix";prefix.textContent=nameChars.slice(0,5).join("");suffix.className="time-option-preview-name-suffix";suffix.textContent=nameChars.slice(5,20).join("");ellipsis.className="time-option-preview-name-ellipsis";ellipsis.textContent="...";nameNode.append(prefix,suffix,ellipsis);}else nameNode.textContent=name;detailsNode.className="time-option-preview-details";detailsNode.textContent=details;entry.append(icon,nameNode,detailsNode);result.append(entry);});if(preview.hasAutoLinked){const summary=document.createElement("span");summary.className="time-option-preview-summary";summary.textContent="＊其餘行程自動連動";result.append(summary);}};
const update=preservePosition=>{if(preservePosition!==0)renderWheel(first,0);if(preservePosition!==1)renderWheel(second,1);const showThird=Boolean(timeOptionParts(valid[selected].option)[2]);thirdWrap.hidden=!showThird;if(showThird){if(preservePosition!==2)renderWheel(third,2);thirdSuffix.textContent=valid[selected].option.targetId?"的時長":"";}Object.values(wheels).forEach(wheel=>{if(!wheel._homeEndBound){wheel._homeEndBound=true;wheel.addEventListener("keydown",event=>{if(!["Home","End"].includes(event.key))return;event.preventDefault();const position=Number(wheel.dataset.position),target=event.key==="Home"?wheel._values[0]:wheel._values[wheel._values.length-1];choose(position,target,true);});}Array.from(wheel.children).forEach(button=>{if(button._focusBound)return;button._focusBound=true;button.addEventListener("click",()=>choose(Number(wheel.dataset.position),button.textContent,true));});});result.hidden=["start-all","end-all"].includes(valid[selected].option.key);if(result.hidden)result.replaceChildren();else renderPreview(timeOptionPreviewSummary(state,valid[selected].trial,row.id,valid[selected].option));if(focusPosition>=0){content.querySelector('.time-option-wheel[data-position="'+focusPosition+'"]')?.focus?.();focusPosition=-1;}};
 update();
 const preserve=()=>keepTimeEditConflict(structuredClone(activeRows()),row.id,index,field,value,valid[selected].option,valid[selected]);
 openDialog(timeEditDialogTitle(row,field,value),content,[{text:valid.length===1?"我知道了":"套用變更",cls:"primary",beforeClose:()=>[0,1,2].forEach(position=>{const wheel=wheels[position];if(wheel?.parentNode)wheel._commit?.();}),run:()=>{state=valid[selected].trial;clearConflictsAfterSuccess();render();showToast("時間連動已更新");}},{text:"保留衝突",cls:"danger",run:preserve},{text:"復原",cls:"",run:()=>renderDay()}],{dialogClass:"time-option-dialog",actionsClass:"time-option-wheel-actions",onCancel:preserve,focusDialog:true});
}
/* 處理正式行程時間欄位輸入；鎖定前後完整串接且時長已吻合時只修正時長，否則決定首次連動或以副本預覽的選項燈箱。 */
function handleTimeEdit(id,field,value){
 const row=getRow("day",id);if(!row)return;const lockedField=row.lock==="none"?"":row.lock;if(row.lock===field){showToast("此欄位已鎖定，請先解除鎖定");renderDay();return;}
 if(field==="duration"&&!durationWithinLimit(value)){showToast("單一行程最長為 1440 分鐘");render();return;}
 const parsed=field==="duration"?durationValue(value,0):formatTime(value);if((field==="start"||field==="end")&&!parsed){showToast("請輸入有效時間");return;}const rows=activeRows(),index=rows.indexOf(row),backup=structuredClone(rows);
 if(field==="duration"&&(!row.start||!row.end)){row.duration=parsed;clearConflictsAfterSuccess();render();return;}
 const previousIndex=formalIndexBefore(index),nextIndex=formalIndexAfter(index),previous=rows[previousIndex],next=rows[nextIndex];
 if(field==="duration"&&!row.pending&&row.start&&row.end&&previous?.lock==="end"&&next?.lock==="start"&&previous.end===row.start&&row.end===next.start&&timeAfter(row.start,parsed)===row.end){row.duration=parsed;clearConflictsAfterSuccess();render();return;}
 if(field==="start"&&!row.pending&&row.end&&previous?.lock==="end"&&next?.lock==="start"&&parsed===previous.end&&row.end===next.start&&timeAfter(parsed,durationValue(row.duration))===row.end){row.start=parsed;clearConflictsAfterSuccess();render();showToast("時間連動已更新");return;}
 if(field==="end"&&!row.pending&&row.start&&previous?.lock==="end"&&next?.lock==="start"&&previous.end===row.start&&parsed===next.start&&timeAfter(row.start,durationValue(row.duration))===parsed){row.end=parsed;clearConflictsAfterSuccess();render();showToast("時間連動已更新");return;}
 if(!row.start&&!row.end&&(field==="start"||field==="end")){const preview=previewCompanionTime(row,index,field,parsed,"首次輸入時間");if(preview.conflict)return openNoTimeOptionDialog(row,index,field,parsed,"首次輸入時間",preview);state=preview.trial;clearConflictsAfterSuccess();render();return;}
 if((field==="start"&&!row.end)||(field==="end"&&!row.start)){const preview=previewCompanionTime(row,index,field,parsed,"補齊時間");if(preview.conflict)return openNoTimeOptionDialog(row,index,field,parsed,"補齊時間",preview);state=preview.trial;clearConflictsAfterSuccess();render();return;}
 const options=timeOptions(row,index,field);if(!options.length){showToast("目前鎖定條件下無法調整此欄位");renderDay();return;}
 const previews=options.map(option=>previewTimeOption(row,index,field,parsed,option));previews.forEach(preview=>{if(!preview.conflict&&timelineAtomicConflicts(preview.trial?.days?.[preview.trial?.activeDate]||[],preview.trial?.activeDate||"").length)preview.inconsistent=true;});const consistent=previews.filter(preview=>!preview.conflict&&!preview.inconsistent),signature=preview=>JSON.stringify(preview.trial?.days?.[preview.trial?.activeDate]||[]),distinct=consistent.filter((preview,position)=>consistent.findIndex(candidate=>signature(candidate)===signature(preview))===position),boundary=lockedBoundaryTimeEditScope(row,index,field,parsed),matched=boundary&&matchingLockedBoundaryTrial(distinct,structuredClone(state),row.id,field,boundary,row),valid=matched?matched.usable.map(item=>item.preview):distinct;
 if(boundary)previews.forEach(preview=>{if(!preview.conflict&&!matched.usable.some(item=>item.preview===preview))preview.inconsistent=true;});
 if(!valid.length)return openTimeOptionWheel(row,index,field,parsed,options,previews);
 openTimeOptionWheel(row,index,field,parsed,options,valid);
}

/* 行程操作：新增、刪除、跨日期待放置與移入暫存。 */
/* 在第一筆正式行程前新增預設 60 分鐘行程；只推算新列，不改動既有資料或衝突。 */
function addRow(){
 const rows=activeRows(),first=rows.find(r=>!r.pending);let start="",end="";
 if(first&&first.start){end=first.start;start=timeBefore(end,60);}
 const newRow=makeRow(state.activeDate,start,end,60,"","");newRow.isNew=true;rows.unshift(newRow);persist();render();showToast("已新增行程");
}
/* 依行程列動作分派刪除、暫存、放置或跨日期移動。 */
function rowAction(area,id,action){
 const row=getRow(area,id);if(!row)return;
 if(action==="delete")return confirmDeleteRow(area,row);
 if(action==="stage")moveRowToStaging(row);
 if(action==="place")placePending(row);
 if(action==="move")chooseDate(target=>moveToDate(area,row,target),{excludeCurrent:area==="day"});
}
/* 將正式行程移至暫存並重新串接來源日期，鎖定衝突時可試算來源列的增長時長。 */
function moveRowToStaging(row,adjustment,silent,originSide){
 row=activeRows().find(item=>item.id===(row&&row.id))||row;const list=activeRows(),index=list.indexOf(row);if(index<0)return;const origin=originConflictFor(row.id);if(origin&&!silent&&!originSide)return chooseOriginRemovalAnchor(origin,row,side=>moveRowToStaging(row,adjustment,false,side));
 const stateBackup=structuredClone(state),beforeRows=structuredClone(list),scopeBefore=conflictChainScope(list,index),preservedStart=list.slice(scopeBefore.first,scopeBefore.last+1).find(item=>!item.pending)?.start||"";list.splice(index,1);relocateConflictBoundariesAfterRemoval(row.id,beforeRows);if(adjustment){const candidate=list.find(item=>item.id===adjustment.id);if(candidate)candidate.duration=adjustment.duration;}row.start="";row.end="";row.date="";row.pending=false;row.lock="none";row.isNew=false;state.staging.push(row);
 if(origin&&originSide){const newConflict=resolveOriginRemoval(origin,row.id,originSide,beforeRows,"移至暫存");if(silent)return newConflict||null;draggedRow=null;clearConflictsAfterSuccess();render();showToast("行程已移至共用暫存區");if(newConflict)openCompletedRemovalConflict();return;}
 const conflict=recalculateMoveSourceChain(index,"移至暫存",preservedStart);if(conflict){const candidateIds=moveSourceCandidateIds(activeRows(),index),lockedRowIds=timeBoundaryLockedRowIds(activeRows(),index);state=stateBackup;if(silent)return conflict;if(!adjustment){offerStructuralDurationAdjustment(stateBackup,{operation:"移至暫存",conflict,candidateIds,lockedRowIds,mode:"expand",attempt:(trial,trialSilent)=>moveRowToStaging(getRow("day",row.id),trial,trialSilent),success:"已調整時長並移至共用暫存區"});return;}recordConflict(conflict);render();presentOperationConflict(conflict);return;}
 if(silent)return null;
 draggedRow=null;clearConflictsAfterSuccess();render();showToast("行程已移至共用暫存區");
}
/* 將暫存行程插入目前日期指定列的前後，並維持待放置狀態。 */
function moveStagingRowToDay(row,targetId,placeAfter=false){
 if(!state.activeDate)return;
 const stagingIndex=state.staging.indexOf(row);if(stagingIndex<0)return;state.staging.splice(stagingIndex,1);
 row.date=state.activeDate;row.pending=true;row.lock="none";row.isNew=false;
 const rows=activeRows(),targetIndex=targetId?rows.findIndex(item=>item.id===targetId):-1,insertAt=targetIndex<0?rows.length:targetIndex+(placeAfter?1:0);rows.splice(insertAt,0,row);
 draggedRow=null;clearConflictsAfterSuccess();render();showToast("行程已移至 "+dateLabel(state.activeDate)+"，確認位置後按「放置此處」");
}
/* 顯示刪除確認並在正式行程刪除後重新串接時間鏈。 */
function confirmDeleteRow(area,row,adjustment,silent){
 if(silent)return deleteRowWithAdjustment(area,row&&row.id,adjustment,true);
 const detail=document.createElement("div"),intro=document.createElement("p"),item=document.createElement("div");
 intro.textContent="您確定要刪除以下行程嗎？";item.className="delete-confirm-item";item.textContent=(row.start||"—")+" ~ "+(row.end||"—")+" : "+(row.content||"(無內容)");detail.append(intro,item);
 openDialog("確認刪除行程",detail,[{text:"刪除",cls:"danger",run:()=>deleteRowWithAdjustment(area,row.id,adjustment,false)},{text:"取消",cls:""}]);
}
/* 執行確認後的刪除；待放置列直接移除，正式列衝突時只試算刪除位置兩側時間邊界內的時長增加。 */
function deleteRowWithAdjustment(area,rowId,adjustment,silent,originSide){
 const row=getRow(area,rowId),list=getList(area),index=list.indexOf(row);if(index<0)return;const origin=area==="day"?originConflictFor(row.id):null;if(origin&&!silent&&!originSide)return chooseOriginRemovalAnchor(origin,row,side=>deleteRowWithAdjustment(area,rowId,adjustment,false,side));
 const stateBackup=structuredClone(state),beforeRows=structuredClone(list),scopeBefore=area==="day"?conflictChainScope(list,index):null,formalRows=list.filter(item=>!item.pending),preservedStart=scopeBefore?list.slice(scopeBefore.first,scopeBefore.last+1).find(item=>!item.pending)?.start||"":formalRows[0]?.start||"",deletedDuration=durationValue(row.duration);
 if(area==="day"&&row.pending){list.splice(index,1);if(silent)return null;clearConflictsAfterSuccess();render();showToast("行程已刪除");return;}
 list.splice(index,1);if(area==="day")relocateConflictBoundariesAfterRemoval(row.id,beforeRows);if(adjustment&&area==="day"){const candidate=activeRows().find(item=>item.id===adjustment.id);if(candidate)candidate.duration=adjustment.duration;}
 if(origin&&originSide){const newConflict=resolveOriginRemoval(origin,row.id,originSide,beforeRows,"刪除行程");if(silent)return newConflict||null;clearConflictsAfterSuccess();render();showToast("行程已刪除，時間自動串聯完成");if(newConflict)openCompletedRemovalConflict();return;}
 if(area==="day"){const conflict=recalculateDeleteStructuralChain(index,"刪除行程",preservedStart);if(conflict){const candidateIds=deleteStructuralCandidateIds(stateBackup.days[stateBackup.activeDate]||[],rowId),lockedRowIds=timeBoundaryLockedRowIds(activeRows(),index);state=stateBackup;if(silent)return conflict;if(!adjustment){offerStructuralDurationAdjustment(stateBackup,{operation:"刪除行程",conflict,candidateIds,lockedRowIds,mode:"expand",requiredIncrease:deletedDuration,attempt:(trial,trialSilent)=>deleteRowWithAdjustment(area,rowId,trial,trialSilent),success:"已調整時長並刪除行程"});return;}recordConflict(conflict);render();presentOperationConflict(conflict);return;}}
 if(silent)return null;
 clearConflictsAfterSuccess();render();showToast("行程已刪除，時間自動串聯完成");
}
/* 說明保留直接值後的真實時間不一致，不把未鎖定資料誤稱為鎖定欄位。 */
function directConflictDescription(conflict){
 const rows=state.days[conflict.date]||[],ids=conflict.directContext?.chainRowIds||[],items=ids.map(id=>rows.find(row=>row.id===id)).filter(Boolean),messages=[];
 items.forEach((row,index)=>{const label=dialogRowName(row),formal=rows.filter(item=>!item.pending),formalIndex=formal.findIndex(item=>item.id===row.id);if(formalIndex>0&&formalIndex<formal.length-1&&row.start&&row.end&&timeToMin(row.end)<timeToMin(row.start))messages.push("「"+label+"」結束時間不可早於開始時間");if(!row.start||!row.end)messages.push("「"+label+"」缺少"+(!row.start?"開始時間":"結束時間")+"，尚無法完成時間串接");else if(timeAfter(row.start,Number(row.duration))!==row.end)messages.push("「"+label+"」的開始時間 "+row.start+" 加總時長 "+formatDuration(row.duration)+" 不等於結束時間 "+row.end);if(index&&items[index-1].end!==row.start)messages.push("「"+dialogRowName(items[index-1],"前一項行程")+"」結束時間 "+items[index-1].end+" 不等於「"+label+"」開始時間 "+row.start);});
 return messages;
}
/* 顯示鎖定或真實不一致衝突的所需值與回復結果，關閉後仍保留黃／紅提示。 */
function openConflictModal(conflict,direct){const locked=getRow("day",conflict.lockedRowId),item=locked?"「"+dialogRowName(locked)+"」":"此行程",content=document.createElement("div"),title=document.createElement("span"),titleIcon=document.createElement("i"),titleText=document.createTextNode("行程時間衝突警告"),messageLine=document.createElement("p"),detail=document.createElement(direct?"div":"p"),hint=document.createElement("p");title.className="dialog-warning-title";titleIcon.className="fa-solid fa-triangle-exclamation dialog-warning-title-icon";titleIcon.setAttribute("aria-hidden","true");title.append(titleIcon,titleText);messageLine.className="conflict-message";messageLine.textContent=direct?"保留修改後，行程時間尚未一致。":conflict.insufficientDuration?"無法完成「"+conflict.operation+"」："+item+"的總時長不足，調整後會成為 "+conflict.requiredValue+" 分鐘。":"無法完成「"+conflict.operation+"」："+item+"的「"+fieldLabel(conflict.lockedField)+"」已鎖定。";if(direct){detail.className="conflict-reasons";directConflictDescription(conflict).forEach(reason=>{const line=document.createElement("div"),icon=document.createElement("i"),text=document.createTextNode(reason);line.className="conflict-reason";icon.className="fa-solid fa-thumbtack conflict-reason-icon";icon.setAttribute("aria-hidden","true");line.append(icon,text);detail.append(line);});}else detail.textContent=conflict.insufficientDuration?"請調整相鄰行程的總時長或本次輸入時間。":"此欄目前為 "+(conflict.lockedValue||"空白")+"，要維持時間串接必須改為 "+(conflict.requiredValue||"指定值")+"。";hint.className="conflict-hint";hint.textContent=direct?"＊提示將保留直到衝突解決。":"本次操作已復原；提示將保留，直到衝突確實解決。";content.append(messageLine,detail,hint);openDialog(title,content,[{text:"我知道了",cls:"danger",run:direct?undefined:()=>render()}],direct?{onCancel:()=>{}}:{});}
/* 以統一鎖定衝突燈箱提示會回復操作的行程動作。 */
function presentOperationConflict(conflict){openConflictModal(conflict);}
/* 移除衝突來源並完成可連動時間重算後，以單鍵燈箱提示另一側鎖定形成的新衝突。 */
function openCompletedRemovalConflict(){openDialog("時間衝突","已完成移除；部分行程時間仍有衝突，請確認紅色標示。",[{text:"我知道了",cls:"danger"}]);}
/* 移出目前日期前先重新串接來源日期；遇鎖定衝突則可試算來源列的時長增加。 */
function moveToDate(area,row,targetDate,adjustment,silent,originSide){
 if(!validDate(targetDate))return;
 row=(area==="staging"?state.staging:activeRows()).find(item=>item.id===(row&&row.id))||row;if(!row)return;const stateBackup=structuredClone(state);
 if(area==="day"&&targetDate===state.activeDate)return;
 const origin=area==="day"?originConflictFor(row.id):null;if(origin&&!silent&&!originSide)return chooseOriginRemovalAnchor(origin,row,side=>moveToDate(area,row,targetDate,adjustment,false,side));
 if(!state.dates.includes(targetDate)){state.dates.push(targetDate);state.days[targetDate]=[];}
 const list=area==="staging"?state.staging:activeRows(),index=list.indexOf(row),beforeRows=area==="day"?structuredClone(list):[],scopeBefore=area==="day"?conflictChainScope(list,index):null,preservedStart=scopeBefore?list.slice(scopeBefore.first,scopeBefore.last+1).find(item=>!item.pending)?.start||"":"";if(index>=0)list.splice(index,1);if(area==="day")relocateConflictBoundariesAfterRemoval(row.id,beforeRows);if(adjustment&&area==="day"){const candidate=activeRows().find(item=>item.id===adjustment.id);if(candidate)candidate.duration=adjustment.duration;}
 if(origin&&originSide){const newConflict=resolveOriginRemoval(origin,row.id,originSide,beforeRows,"移至其他日期");if(silent)return newConflict||null;row.date=targetDate;row.start="";row.end="";row.pending=true;row.lock="none";row.isNew=false;state.days[targetDate].unshift(row);state.activeDate=targetDate;activeCalendarMonth=calendarMonthFor(targetDate);clearConflictsAfterSuccess();render();showToast("行程已移至 "+dateLabel(targetDate)+"，確認位置後按「放置此處」");if(newConflict)openCompletedRemovalConflict();return;}
 if(area==="day"){const conflict=recalculateMoveSourceChain(index,"移至其他日期",preservedStart);if(conflict){const candidateIds=moveSourceCandidateIds(activeRows(),index),lockedRowIds=timeBoundaryLockedRowIds(activeRows(),index);state=stateBackup;if(silent)return conflict;if(!adjustment){offerStructuralDurationAdjustment(stateBackup,{operation:"移至其他日期",conflict,candidateIds,lockedRowIds,mode:"expand",attempt:(trial,trialSilent)=>moveToDate(area,getRow(area,row.id),targetDate,trial,trialSilent),success:"已調整時長並移至其他日期"});return;}recordConflict(conflict);render();presentOperationConflict(conflict);return;}}
 if(silent)return null;
 row.date=targetDate;row.start="";row.end="";row.pending=true;row.lock="none";row.isNew=false;state.days[targetDate].unshift(row);state.activeDate=targetDate;activeCalendarMonth=calendarMonthFor(targetDate);clearConflictsAfterSuccess();render();showToast("行程已移至 "+dateLabel(targetDate)+"，確認位置後按「放置此處」");
}
/* 取得放置位置前後最近時間鎖定的正式區段；待放置列不會形成邊界。 */
function placementTimeBoundaryScope(rows,index){return deleteTimeBoundaryScope(rows,index);}
/* 依相關時間鎖定重建放置區段；有右側鎖定時向上反推，有左側鎖定時向下串接，均不越界。 */
function recalculatePlacedBoundaryScope(index,operation){
 const rows=activeRows(),scope=placementTimeBoundaryScope(rows,index),segment=rows.slice(scope.first,scope.last+1),right=rows.slice(index+1,scope.last+1).find(row=>!row.pending&&["start","end"].includes(row.lock)),left=rows.slice(scope.first,index).reverse().find(row=>!row.pending&&["start","end"].includes(row.lock));
 const invalid=segment.find(row=>!row.pending&&!durationWithinLimit(row.duration));if(invalid)return durationLimitConflict(invalid,state.activeDate,"day");
 const write=(item,field,value)=>setTimeValue(item,field,value,operation);
 if(right){const rightIndex=rows.indexOf(right);if(right.lock==="end"){let cursor=right.end;for(let current=rightIndex;current>=scope.first;current--){const item=rows[current];if(item.pending)continue;const endConflict=write(item,"end",cursor),start=timeBefore(cursor,durationValue(item.duration)),startConflict=endConflict||write(item,"start",start);if(startConflict)return startConflict;cursor=start;}}else{let cursor=right.start;for(let current=rightIndex-1;current>=scope.first;current--){const item=rows[current];if(item.pending)continue;const endConflict=write(item,"end",cursor),start=timeBefore(cursor,durationValue(item.duration)),startConflict=endConflict||write(item,"start",start);if(startConflict)return startConflict;cursor=start;}const endConflict=write(right,"end",timeAfter(right.start,durationValue(right.duration)));if(endConflict)return endConflict;}return null;}
 if(left){const leftIndex=rows.indexOf(left);let cursor=left.lock==="start"?left.start:timeBefore(left.end,durationValue(left.duration));for(let current=leftIndex;current<=scope.last;current++){const item=rows[current];if(item.pending)continue;const startConflict=write(item,"start",cursor),end=timeAfter(cursor,durationValue(item.duration)),endConflict=startConflict||write(item,"end",end);if(endConflict)return endConflict;cursor=end;}return null;}
 return null;
}
/* 試算放置待確認行程；鎖定區段只改寫區段內時間，無時間鎖定時保留既有相鄰行程基準。 */
function tryPlacePending(rowId,candidateId,duration){
 const rows=activeRows(),row=rows.find(item=>item.id===rowId);if(!row)return{conflict:null};const index=rows.indexOf(row),candidate=candidateId&&rows.find(item=>item.id===candidateId);if(candidate)candidate.duration=duration;row.pending=false;
 const boundaryConflict=boundaryForPendingRow(rowId,rows);if(boundaryConflict){row.pending=true;placePendingAtConflictBoundary(row,boundaryConflict);return{conflict:null,scope:conflictChainScope(rows,rows.indexOf(row))};}
 const scope=placementTimeBoundaryScope(rows,index),hasTimeLock=rows.slice(scope.first,scope.last+1).some(item=>["start","end"].includes(item.lock));
 if(hasTimeLock)return{conflict:recalculatePlacedBoundaryScope(index,"放置待放置行程"),scope};
 const previous=rows.slice(0,index).reverse().find(item=>!item.pending&&item.end),next=rows.slice(index+1).find(item=>!item.pending&&item.start);
 if(previous){row.start=previous.end;row.end=timeAfter(row.start,durationValue(row.duration));}else if(next){row.end=next.start;row.start=timeBefore(row.end,durationValue(row.duration));}else{row.start="";row.end="";}
 return{conflict:!row.start&&!row.end?null:recalculateStructuralChain(index,"放置待放置行程"),scope};
}
/* 找出剛好吸收待放置行程實際時長差額、並保留區段原首列時間的單筆縮短候選。 */
function placementDurationDifference(before,rowIndex){
 const scope=placementTimeBoundaryScope(before,rowIndex),left=before.slice(scope.first,rowIndex).reverse().find(row=>!row.pending&&["start","end"].includes(row.lock)),right=before.slice(rowIndex+1,scope.last+1).find(row=>!row.pending&&["start","end"].includes(row.lock)),placed=before[rowIndex];
 if(left&&right){const leftBoundary=left.lock==="end"?left.end:timeAfter(left.start,durationValue(left.duration)),rightBoundary=right.lock==="start"?right.start:timeBefore(right.end,durationValue(right.duration)),between=before.slice(before.indexOf(left)+1,before.indexOf(right)).filter(row=>!row.pending||row===placed).reduce((sum,row)=>sum+durationValue(row.duration),0),available=durationBetween(leftBoundary,rightBoundary);return between-available;}
 return durationValue(placed.duration);
}
/* 以實際超額精確縮短指定候選，並以完整放置區段 trial 排除不成立結果。 */
function pendingDurationTarget(before,rowId,candidateId){
 const original=state.days[state.activeDate],candidate=before.find(item=>item.id===candidateId),placed=before.find(item=>item.id===rowId),rowIndex=before.findIndex(item=>item.id===rowId);if(!candidate||!placed||candidate.lock==="duration"||!durationWithinLimit(candidate.duration))return null;
 const scope=placementTimeBoundaryScope(before,rowIndex),reference=before.slice(scope.first,scope.last+1).find(item=>!item.pending&&item.start)?.start||"",current=durationValue(candidate.duration),target=current-placementDurationDifference(before,rowIndex);if(target<0||target>=current||!durationWithinLimit(target))return null;
 const trial=structuredClone(before);state.days[state.activeDate]=trial;const result=tryPlacePending(rowId,candidateId,target),first=activeRows().slice(scope.first,scope.last+1).find(item=>!item.pending&&item.start);state.days[state.activeDate]=original;return!result.conflict&&(!reference||first?.start===reference)?target:null;
}
/* 依調整方向找出符合循環時間鎖定的單列時長；刪除只接受剛好吸收被刪行程時長的增加，排除取模補 1,440 分鐘的偽候選。 */
function durationAdjustmentTarget(row,mode,probe,requiredIncrease=null){
 const current=durationValue(row.duration),residues=[];
 if(!durationWithinLimit(current))return null;
 for(let duration=0;duration<=1440;duration++)if(!probe(duration))residues.push(duration);
 const lower=residues.filter(duration=>duration>=0&&duration<current);
 const higher=residues.filter(duration=>duration>current&&(requiredIncrease===null||duration-current===requiredIncrease));
 if(mode==="shrink")return lower.length?Math.max(...lower):null;
 if(mode==="expand")return higher.length?Math.min(...higher):null;
 const options=lower.concat(higher);return options.length?options.reduce((best,value)=>Math.abs(value-current)<Math.abs(best-current)?value:best):null;
}
/* 刪除正式列時，從刪除位置向兩側找候選；只有開始／結束時間鎖定是邊界，總時長鎖定列會略過但不中斷搜尋。 */
function deleteStructuralCandidateIds(rows,rowId){
 const index=rows.findIndex(row=>row.id===rowId);if(index<0)return[];const ids=[],collect=(start,step)=>{for(let current=start;current>=0&&current<rows.length;current+=step){const row=rows[current];if(row.pending)continue;ids.push(row.id);if(["start","end"].includes(row.lock))break;}};
 collect(index-1,-1);collect(index+1,1);return ids;
}
/* 找出刪除後會重算的正式區段；最近開始／結束時間鎖定列是不可跨越、但仍包含在區段內的邊界。 */
function deleteTimeBoundaryScope(rows,index){
 let first=0,last=rows.length-1,leftLocked=false,rightLocked=false;
 for(let current=index-1;current>=0;current--){const row=rows[current];if(!row.pending&&["start","end"].includes(row.lock)){first=current;leftLocked=true;break;}}
 for(let current=index;current<rows.length;current++){const row=rows[current];if(!row.pending&&["start","end"].includes(row.lock)){last=current;rightLocked=true;break;}}
 return{first,last,leftLocked,rightLocked};
}
/* 取得結構性移除後實際重算區段內的開始／結束時間鎖定列，供燈箱原因精準說明。 */
function timeBoundaryLockedRowIds(rows,index){const scope=deleteTimeBoundaryScope(rows,index);return rows.slice(scope.first,scope.last+1).filter(row=>!row.pending&&["start","end"].includes(row.lock)).map(row=>row.id);}
/* 刪除時只重算最近時間鎖定邊界內的區段；區段有鎖定時一律以鎖定欄位為錨點，完全無鎖定才保留刪除前首筆開始時間。 */
function recalculateDeleteStructuralChain(index,operation,preservedStart){
 const rows=activeRows(),safeIndex=Math.min(Math.max(index,0),Math.max(rows.length-1,0)),scope=activeConflictBoundaries(rows).length?conflictChainScope(rows,safeIndex):deleteTimeBoundaryScope(rows,index),segment=rows.slice(scope.first,scope.last+1),bases=lockedChainBases(segment);if(!bases.length&&!preservedStart)return cascadeFrom(Math.max(0,index-1),operation);return recalculateConflictChain(scope,operation,bases.length?"":preservedStart);
}
/* 移出正式列後，只在最近開始／結束時間鎖定邊界內重算來源區段；有鎖定時完全以鎖定欄位為錨點，否則保留原首筆開始時間。 */
function recalculateMoveSourceChain(index,operation,preservedStart){
 const rows=activeRows(),safeIndex=Math.min(Math.max(index,0),Math.max(rows.length-1,0)),scope=activeConflictBoundaries(rows).length?conflictChainScope(rows,safeIndex):deleteTimeBoundaryScope(rows,index),segment=rows.slice(scope.first,scope.last+1),bases=lockedChainBases(segment);if(!bases.length&&!preservedStart)return null;return recalculateConflictChain(scope,operation,bases.length?"":preservedStart);
}
/* 回傳移出來源區段內可調整的正式列；總時長鎖定列略過但不截斷搜尋。 */
function moveSourceCandidateIds(rows,index){const scope=deleteTimeBoundaryScope(rows,index);return rows.slice(scope.first,scope.last+1).filter(row=>!row.pending&&row.lock!=="duration").map(row=>row.id);}
/* 將鎖定所需值和目前值的差異轉為排序可調整時長的方向。 */
function structuralAdjustmentMode(conflict,rows){
 const delta=conflict&&conflict.lockedValue&&conflict.requiredValue?signedTimeDelta(conflict.lockedValue,conflict.requiredValue):0,anchorIndex=rows&&rows.findIndex(row=>row.id===conflict.anchorRowId),conflictIndex=rows&&rows.findIndex(row=>row.id===conflict.lockedRowId),afterAnchor=anchorIndex>=0&&conflictIndex>anchorIndex;
 return(afterAnchor?delta>0:delta<0)?"shrink":"expand";
}
/* 依排序衝突兩端鎖定欄位界定候選：前端 start 與尾端 end 可連同中間列調整。 */
function reorderCandidateIds(rows,conflict){
 const anchorIndex=rows.findIndex(row=>row.id===conflict.anchorRowId),conflictIndex=rows.findIndex(row=>row.id===conflict.lockedRowId);if(anchorIndex<0||conflictIndex<0)return[];
 const first=Math.min(anchorIndex,conflictIndex),last=Math.max(anchorIndex,conflictIndex),ids=rows.slice(first+1,last).filter(row=>!row.pending).map(row=>row.id),firstRow=rows[first],lastRow=rows[last];if(firstRow.lock==="start")ids.unshift(firstRow.id);if(lastRow.lock==="end")ids.push(lastRow.id);return ids;
}
/* 只取造成結構衝突的兩個時間鎖定區間內行程，避免調整區間外不相關的時長。 */
function structuralCandidateIds(rows,conflict,includeFirstStart=true){
 const locked=rows.map((row,index)=>({row,index})).filter(item=>!item.row.pending&&["start","end"].includes(item.row.lock)),conflictIndex=rows.findIndex(row=>row.id===conflict.lockedRowId),other=locked.filter(item=>item.index!==conflictIndex).sort((left,right)=>Math.abs(left.index-conflictIndex)-Math.abs(right.index-conflictIndex))[0];
 if(conflictIndex<0||!other)return[];const first=Math.min(conflictIndex,other.index),last=Math.max(conflictIndex,other.index),ids=rows.slice(first+1,last).filter(row=>!row.pending).map(row=>row.id),firstLocked=locked.find(item=>item.index===first),lastLocked=locked.find(item=>item.index===last);if(includeFirstStart&&firstLocked&&firstLocked.row.lock==="start")ids.unshift(firstLocked.row.id);if(lastLocked&&lastLocked.row.lock==="end")ids.push(lastLocked.row.id);return ids;
}
/* 在完整操作副本上逐筆試算，列出可由單一未鎖定時長行程吸收的候選。 */
function structuralDurationCandidates(beforeState,candidateIds,mode,attempt,requiredIncrease=null){
 const originalState=state,beforeRows=beforeState.days[beforeState.activeDate]||[];
 const candidates=candidateIds.map(id=>beforeRows.find(row=>row.id===id)).filter(row=>row&&!row.pending&&row.lock!=="duration").map(row=>{
  const target=durationAdjustmentTarget(row,mode,duration=>{state=structuredClone(beforeState);const conflict=attempt({id:row.id,duration},true);state=originalState;return !!conflict;},requiredIncrease);return{row,target};
 }).filter(item=>item.target!==null);state=originalState;return candidates;
}
/* 顯示共用單列時長調整燈箱，確認後才套用原本結構操作與候選時長。 */
function openDurationAdjustmentDialog(config){
 const {operation,candidates,locked,apply,cancelText="取消",onCancel,onNoCandidates}=config,displayName=value=>value.length>20?value.slice(0,20)+"...":value,cause=locked.length?"由於"+locked.map(item=>"「"+displayName(dialogRowName(item))+"」的「"+fieldLabel(item.lock)+"」").join("及")+"已鎖定，造成時間衝突。":"造成時間衝突。";
 if(!candidates.length){onNoCandidates?.();const content=document.createElement("div"),title=document.createElement("span"),titleIcon=document.createElement("i"),titleText=document.createTextNode("時間衝突警告"),recovery=document.createElement("p");title.className="dialog-warning-title";titleIcon.className="fa-solid fa-triangle-exclamation dialog-warning-title-icon";titleIcon.setAttribute("aria-hidden","true");title.append(titleIcon,titleText);if(locked.length){const heading=document.createElement("p"),reasons=document.createElement("div");heading.className="pending-duration-no-candidates-heading";heading.textContent="下方行程已鎖定，造成時間衝突：";reasons.className="pending-duration-no-candidates-reasons";locked.forEach(item=>{const line=document.createElement("div"),icon=document.createElement("i"),text=document.createTextNode("「"+displayName(dialogRowName(item))+"」的「"+fieldLabel(item.lock)+"」已鎖定");line.className="pending-duration-no-candidates-reason";icon.className="fa-solid fa-thumbtack pending-duration-no-candidates-icon";icon.setAttribute("aria-hidden","true");line.append(icon,text);reasons.append(line);});content.append(heading,reasons);}recovery.className="pending-duration-no-candidates-recovery";recovery.textContent="目前沒有任一筆行程能單獨調整並符合安排，您的行程修改將復原。";content.append(recovery);openDialog(title,content,[{text:"我知道了",cls:"danger",run:onCancel||(()=>render())}],{dialogClass:"pending-duration-dialog",actionsClass:"pending-duration-actions"});return;}
 const content=document.createElement("div"),reason=document.createElement("p"),adjustment=document.createElement("p"),modeWrap=document.createElement("span"),targetWrap=document.createElement("span"),preview=document.createElement("p"),durationCandidates=candidates.filter(item=>!item.unchanged),fixedCandidate=candidates.find(item=>item.unchanged);let selected=0,mode=fixedCandidate&&durationCandidates.length?"調整":fixedCandidate?"固定":"調整",activeCandidate=null;content.className="pending-duration-content";reason.className="pending-duration-reason";reason.textContent="由於";locked.forEach((item,index)=>{const part=document.createElement("span"),connector=document.createElement("span");part.className="pending-duration-lock";part.textContent="「"+displayName(dialogRowName(item))+"」的「"+fieldLabel(item.lock)+"」";connector.textContent=index===locked.length-1?"已鎖定，造成時間衝突，請選擇一項您希望的調整方式來完成安排。":"及";reason.append(part,connector);});adjustment.className="pending-duration-adjustment";preview.className="pending-duration-result";
 const createWheel=(values,current,onSelect,className,wide=false)=>{const wheel=document.createElement("div");wheel.className=className+(wide?" is-wide":"");wheel.tabIndex=0;wheel.setAttribute("role","listbox");const refresh=()=>{wheel._clearVisual?.();wheel.replaceChildren();values.forEach((item,index)=>{const option=document.createElement("button"),name=item?.row?dialogRowName(item.row):String(item);option.type="button";option.className="pending-duration-option"+(index===current()?" selected":"");option.title=name;option.textContent=item?.row?displayName(name):name;option.setAttribute("aria-selected",index===current()?"true":"false");option.addEventListener("click",()=>onSelect(index));wheel.append(option);});wheel.scrollTop=current()*34;};wheel._clearVisual=()=>{wheel.classList.toggle("is-scrolling",false);Array.from(wheel.children).forEach(option=>option.classList.toggle("is-centered",false));};wheel._syncVisual=()=>{const next=Math.max(0,Math.min(values.length-1,Math.round(wheel.scrollTop/34)));wheel.classList.toggle("is-scrolling",true);Array.from(wheel.children).forEach((option,index)=>option.classList.toggle("is-centered",index===next));};wheel._preview=()=>{const next=Math.max(0,Math.min(values.length-1,Math.round(wheel.scrollTop/34)));if(next!==current())onSelect(next,true);};wheel._commit=()=>{clearTimeout(wheel._wheelTimer);wheel._clearVisual();const next=Math.max(0,Math.min(values.length-1,Math.round(wheel.scrollTop/34)));wheel.scrollTop=next*34;onSelect(next);};const settle=()=>{clearTimeout(wheel._wheelTimer);wheel._wheelTimer=setTimeout(()=>wheel._preview(),16);};const step=delta=>{wheel._commit();onSelect(Math.max(0,Math.min(values.length-1,current()+delta)));};wheel.addEventListener("wheel",event=>{if(event.deltaMode===1){event.preventDefault();step(event.deltaY>0?1:-1);return;}},{passive:false});wheel.addEventListener("scroll",()=>{wheel._syncVisual();settle();});wheel.addEventListener("scrollend",()=>wheel._commit());wheel.addEventListener("keydown",event=>{if(!["ArrowUp","ArrowDown","Home","End"].includes(event.key))return;event.preventDefault();if(event.key==="Home"){wheel._commit();onSelect(0);return;}if(event.key==="End"){wheel._commit();onSelect(values.length-1);return;}step(event.key==="ArrowUp"?-1:1);});let dragStart=null;wheel.addEventListener("pointerdown",event=>{dragStart=event.clientY;});wheel.addEventListener("pointermove",event=>{if(dragStart===null)return;const steps=Math.trunc((dragStart-event.clientY)/28);if(steps){wheel.setPointerCapture?.(event.pointerId);step(steps);dragStart=event.clientY;}});wheel.addEventListener("pointerup",()=>{dragStart=null;});wheel.addEventListener("pointercancel",()=>{dragStart=null;});wheel.refresh=refresh;refresh();return wheel;};
 const renderPreview=item=>{preview.replaceChildren();const fullName=item.row?dialogRowName(item.row):"",entry=document.createElement("span"),icon=document.createElement("i");entry.className="pending-duration-preview-entry";icon.className="fa-solid fa-tag pending-duration-tag";icon.setAttribute("aria-hidden","true");preview.title=fullName;if(item.unchanged){entry.append(icon,"將保留各行程既有時長，更新放置區段內相關行程時間。");}else{const name=document.createElement("span"),details=document.createElement("span"),chars=[...fullName];name.className="pending-duration-preview-name";name.title=fullName;if(chars.length>20){const prefix=document.createElement("span"),suffix=document.createElement("span"),ellipsis=document.createElement("span");name.className+=" is-long";prefix.className="pending-duration-preview-name-prefix";suffix.className="pending-duration-preview-name-suffix";ellipsis.className="pending-duration-preview-name-ellipsis";prefix.textContent=chars.slice(0,5).join("");suffix.textContent=chars.slice(5,20).join("");ellipsis.textContent="...";name.append(prefix,suffix,ellipsis);}else name.textContent=fullName;details.className="pending-duration-preview-details";details.textContent="：總時長 "+formatDuration(item.row.duration)+" → "+formatDuration(item.target)+"。";entry.append(icon,name,details);}preview.append(entry);};
 const modeValues=fixedCandidate&&durationCandidates.length?["調整","固定"]:[mode],modeWheel=modeValues.length>1?createWheel(modeValues,()=>modeValues.indexOf(mode),(index,preserveWheel=false)=>{mode=modeValues[index];selected=0;render(preserveWheel?"mode":null);},"pending-duration-mode-wheel"):null,wide=durationCandidates.some(item=>/^(前方|後方)：/.test(dialogRowName(item.row))),targetWheel=durationCandidates.length>1?createWheel(durationCandidates,()=>selected,(index,preserveWheel=false)=>{selected=index;render(preserveWheel?"target":null);},"pending-duration-wheel",wide):null;
 if(modeWheel)modeWrap.append(modeWheel);else modeWrap.textContent=mode;adjustment.append(modeWrap,"時長，更新",targetWrap,"的時間。");
 const render=preserveWheel=>{if(preserveWheel!=="mode")modeWheel?.refresh();if(mode==="固定"){targetWrap.replaceChildren();targetWrap.textContent="所有時程";activeCandidate=fixedCandidate;renderPreview(activeCandidate);return;}const current=durationCandidates[Math.min(selected,durationCandidates.length-1)];selected=durationCandidates.indexOf(current);if(targetWheel){if(targetWrap.firstElementChild!==targetWheel)targetWrap.replaceChildren(targetWheel);if(preserveWheel!=="target")targetWheel.refresh();}else{targetWrap.replaceChildren();targetWrap.textContent=displayName(dialogRowName(current.row));}activeCandidate=current;renderPreview(activeCandidate);};
 content.append(reason,adjustment,preview);render();
 const title=document.createElement("span"),titleIcon=document.createElement("i");title.className="dialog-warning-title";titleIcon.className="fa-solid fa-triangle-exclamation dialog-warning-title-icon";titleIcon.setAttribute("aria-hidden","true");title.append(titleIcon,document.createTextNode("時間衝突"));
 openDialog(title,content,[{text:"套用調整",cls:"primary",beforeClose:()=>{modeWheel?._commit?.();if(mode==="調整"&&targetWheel?.parentNode)targetWheel._commit?.();},run:()=>apply(activeCandidate)},{text:cancelText,cls:"",actionClass:"dialog-cancel",run:onCancel||(()=>render())}],{dialogClass:"pending-duration-dialog",actionsClass:"pending-duration-actions"});
}
/* 顯示放置區段可縮短時長或保留時長重排的候選；僅確認後才寫入資料。 */
function openPendingDurationDialog(row,before,conflict){
 const index=before.findIndex(item=>item.id===row.id),scope=placementTimeBoundaryScope(before,index),segment=before.slice(scope.first,scope.last+1),locked=segment.filter(item=>!item.pending&&["start","end"].includes(item.lock)),shortened=segment.filter(item=>item.id===row.id||(!item.pending&&item.lock!=="duration")).filter(item=>item.lock!=="duration").map(item=>({row:item,target:pendingDurationTarget(before,row.id,item.id)})).filter(item=>item.target!==null).map(item=>({...item,label:dialogRowName(item.row)+" 的時長"})),originalRows=state.days[state.activeDate],trial=structuredClone(before);state.days[state.activeDate]=trial;const unchangedResult=tryPlacePending(row.id,"",null);state.days[state.activeDate]=originalRows;const unchanged=!unchangedResult.conflict?{row:before[index],target:durationValue(row.duration),label:"既有時長不變，更新相關行程時間",previewText:"將保留各行程既有時長，更新放置區段內相關行程時間。",unchanged:true}:null,candidates=[...shortened,...(unchanged?[unchanged]:[])];
 openDurationAdjustmentDialog({operation:"放置待放置行程",candidates,locked,cancelText:"取消放置",onNoCandidates:()=>{state.days[state.activeDate]=before;render();},onCancel:()=>{state.days[state.activeDate]=before;render();},apply:item=>{state.days[state.activeDate]=structuredClone(before);const result=tryPlacePending(row.id,item.unchanged?"":item.row.id,item.unchanged?null:item.target);if(result.conflict){state.days[state.activeDate]=before;render();openDurationAdjustmentDialog({operation:"放置待放置行程",candidates:[],locked,cancelText:"取消放置",onCancel:()=>render()});return;}clearConflictsAfterSuccess();render();showToast(item.unchanged?"已放置行程並更新相關時間":"已調整時長並放置行程");}});
}
/* 判斷保留既有時長的放置試算是否真的改到既有正式行程時間，避免無需選擇時多開燈箱。 */
function placementReflowChangesExistingRows(before,rowId){return before.some(item=>!item.pending&&item.id!==rowId&&(()=>{const current=activeRows().find(row=>row.id===item.id);return current&&(current.start!==item.start||current.end!==item.end);})());}
/* 將待放置行程接到相鄰正式時間鏈；時間鎖定區段先讓使用者選擇縮短或保留時長重排。 */
function placePending(row){
 const rows=activeRows(),index=rows.indexOf(row);if(index<0)return;const before=structuredClone(rows),result=tryPlacePending(row.id,"",null),scope=placementTimeBoundaryScope(before,index),hasTimeLock=before.slice(scope.first,scope.last+1).some(item=>!item.pending&&["start","end"].includes(item.lock));
 if(result.conflict||(hasTimeLock&&placementReflowChangesExistingRows(before,row.id))){state.days[state.activeDate]=before;openPendingDurationDialog(row,before,result.conflict);return;}
 clearConflictsAfterSuccess();render();showToast("行程已放置並加入時間連動");
}

/* 日期頁籤與日曆：已有日期可跳轉，空白日期可建立新頁籤。 */
function openCalendar(createMode){const pop=document.getElementById("calendarPopover");if(createMode){calendarCreateMode=true;pop.hidden=false;}else{calendarCreateMode=false;pop.hidden=!pop.hidden;}if(!pop.hidden)renderCalendar();}
/* 繪製目前月份的日期按鈕、日期頁籤狀態與選取日期。 */
function renderCalendar(){
 const title=document.getElementById("calendarMonth"),grid=document.getElementById("calendarGrid");if(!title||!grid)return;
 const year=activeCalendarMonth.getFullYear(),month=activeCalendarMonth.getMonth();title.textContent=year+" 年 "+(month+1)+" 月";grid.innerHTML="";
 ["日","一","二","三","四","五","六"].forEach(d=>{const el=document.createElement("span");el.className="weekday";el.textContent=d;grid.appendChild(el);});
 const first=new Date(year,month,1).getDay(),total=new Date(year,month+1,0).getDate();for(let i=0;i<first;i++)grid.appendChild(document.createElement("span"));
 for(let day=1;day<=total;day++){const date=year+"-"+String(month+1).padStart(2,"0")+"-"+String(day).padStart(2,"0"),btn=document.createElement("button");btn.type="button";btn.className="calendar-day "+(state.dates.includes(date)?"has-date":"no-date")+(date===state.activeDate?" selected":"");btn.textContent=day;btn.title=state.dates.includes(date)?"已有日期頁籤":"尚未建立日期";btn.disabled=!calendarCreateMode&&!state.dates.includes(date);btn.addEventListener("click",()=>{if(state.dates.includes(date)){state.activeDate=date;activeCalendarMonth=calendarMonthFor(date);persist();render();document.getElementById("calendarPopover").hidden=true;}else if(calendarCreateMode)openDateAction(date);});grid.appendChild(btn);}
}
/* 開啟建立指定日期頁籤的確認燈箱。 */
function openDateAction(date){openDialog("建立日期頁籤？",dateLabel(date,true)+" 尚未建立行程頁籤。",[{text:"建立並前往",cls:"primary",run:()=>{state.dates.push(date);state.days[date]=[];state.activeDate=date;activeCalendarMonth=calendarMonthFor(date);persist();render();document.getElementById("calendarPopover").hidden=true;}},{text:"取消",cls:""}]);}
/* 開啟可切換月份的日期選擇燈箱，並將選取日期交給回呼處理。 */
function chooseDate(callback,{excludeCurrent=false}={}){
 let month=calendarMonthFor(state.activeDate),selected=excludeCurrent?"":state.activeDate||"";
 const content=document.createElement("div");content.className="date-choice";const hint=document.createElement("p");hint.textContent=excludeCurrent?"請選擇其他日期；目前日期無法移動。":"選擇已有日期，或選擇尚未建立的日期；新日期會自動建立頁籤。";
 const heading=document.createElement("div");heading.className="calendar-heading";const prev=document.createElement("button");prev.type="button";prev.textContent="‹";const title=document.createElement("strong");const next=document.createElement("button");next.type="button";next.textContent="›";heading.append(prev,title,next);
 const grid=document.createElement("div");grid.className="calendar-grid move-calendar-grid";const legend=document.createElement("div");legend.className="calendar-legend";legend.innerHTML='<span><i class="legend-has"></i>已有日期頁籤</span><span><i class="legend-none"></i>尚未建立</span>';
 const selection=document.createElement("p");selection.className="calendar-selection";
 let moveButton;
 /* 依目前月份與選取日期重繪燈箱內的可移動日期月曆。 */
 function draw(){const year=month.getFullYear(),monthIndex=month.getMonth();title.textContent=year+" 年 "+(monthIndex+1)+" 月";grid.innerHTML="";["日","一","二","三","四","五","六"].forEach(d=>{const day=document.createElement("span");day.className="weekday";day.textContent=d;grid.appendChild(day);});const first=new Date(year,monthIndex,1).getDay(),total=new Date(year,monthIndex+1,0).getDate();for(let i=0;i<first;i++)grid.appendChild(document.createElement("span"));for(let day=1;day<=total;day++){const date=year+"-"+String(monthIndex+1).padStart(2,"0")+"-"+String(day).padStart(2,"0"),isCurrent=excludeCurrent&&date===state.activeDate,button=document.createElement("button");button.type="button";button.className="calendar-day "+(state.dates.includes(date)?"has-date":"no-date")+(selected===date?" selected":"")+(isCurrent?" current-date-disabled":"");button.textContent=day;button.disabled=isCurrent;button.title=isCurrent?"目前日期，無法移動":"";if(!isCurrent)button.addEventListener("click",()=>{selected=date;selection.textContent="選取日期："+dateLabel(date,true);draw();});grid.appendChild(button);}selection.textContent=selected?"選取日期："+dateLabel(selected,true):"請選擇其他日期";if(moveButton)moveButton.disabled=!selected;}
 prev.addEventListener("click",()=>{month=new Date(month.getFullYear(),month.getMonth()-1,1);draw();});next.addEventListener("click",()=>{month=new Date(month.getFullYear(),month.getMonth()+1,1);draw();});draw();content.append(hint,heading,grid,legend,selection);
 openDialog("移至日期",content,[{text:"移至所選日期",cls:"primary",disabled:!selected,run:()=>callback(selected)},{text:"取消",cls:""}]);moveButton=document.getElementById("dialogActions").firstElementChild;moveButton.disabled=!selected;
}
/* 確認後刪除日期頁籤及其全部行程，並切換至可用日期。 */
function deleteDate(date=state.activeDate){if(!date)return;askConfirm("刪除日期頁籤","刪除 "+dateLabel(date,true)+" 與這一天的所有行程嗎？此操作無法復原。","刪除此日期",()=>{const idx=state.dates.indexOf(date);state.dates.splice(idx,1);delete state.days[date];if(state.activeDate===date)state.activeDate=state.dates[Math.min(idx,state.dates.length-1)]||"";if(state.activeDate)activeCalendarMonth=calendarMonthFor(state.activeDate);persist();render();});}

/* 現有類別顏色可以自訂，並納入自動保存及備份。 */
function renderCategories(){const root=document.getElementById("categoryColors");root.innerHTML="";state.categories.forEach(category=>{const label=document.createElement("label");label.className="category-color";const name=document.createElement("span");name.textContent=category.name;const input=document.createElement("input");input.type="color";input.value=category.color;input.setAttribute("aria-label",category.name+" 顏色");input.addEventListener("input",()=>{category.color=input.value;persist();renderDay();renderStaging();});label.append(name,input);root.appendChild(label);});}

/* JSON 匯入匯出保存完整日期、排序、暫存與類別顏色。 */
/* 重檢後回傳是否仍有必須阻擋匯出的未解決時間衝突。 */
function hasUnresolvedConflicts(){refreshConflicts();return state.conflicts.length>0;}
/* 無未解決衝突時才匯出包含目前資料與衝突狀態的 JSON 備份。 */
function exportJSON(){if(hasUnresolvedConflicts()){showToast("請先解決本次衝突再執行匯出");return;}downloadBlob(new Blob([JSON.stringify({app:"TickBrick",version:2,exportedAt:new Date().toISOString(),data:state},null,2)],{type:"application/json"}),"TickBrick_行程備份_"+todayString()+".json");}
/* 檢查原始備份中的所有正式與暫存行程，避免超上限資料覆蓋目前資料。 */
function backupHasOverLimitDuration(raw){
 const rows=Array.isArray(raw)?[...raw]:[];
 if(!Array.isArray(raw)&&raw&&typeof raw==="object"){(raw.dates||[]).forEach(date=>rows.push(...(raw.days?.[date]||[])));rows.push(...(raw.staging||[]));}
 return rows.some(row=>row&&!durationWithinLimit(row.duration));
}
/* 讀取 JSON 備份；先拒絕任一超過單一行程時長上限的資料，再要求使用者確認覆蓋。 */
function importJSON(file){const reader=new FileReader();reader.onload=()=>{try{const parsed=JSON.parse(reader.result),raw=parsed.data||parsed;if(!Array.isArray(raw)&&(!raw||typeof raw!=="object"||!Array.isArray(raw.dates)))throw new Error("format");if(backupHasOverLimitDuration(raw)){showToast("備份含有超過 1440 分鐘的行程，未覆蓋現有資料");return;}if(backupHasMiddleEndBeforeStart(raw)){showToast("備份含有中間行程結束時間早於開始時間，未覆蓋現有資料");return;}const imported=normalizeState(raw);askConfirm("匯入並取代現有資料","匯入備份會取代目前所有日期、行程、暫存項目與類別顏色。確定繼續嗎？","取代並匯入",()=>{state=imported;if(state.activeDate)activeCalendarMonth=calendarMonthFor(state.activeDate);persist();render();showToast("備份匯入完成");});}catch(error){showToast("無法讀取此 JSON 行程備份");}};reader.readAsText(file,"UTF-8");}
/* 取得今日的 YYYY-MM-DD 文字，供匯出檔名使用。 */
function todayString(){return new Date().toISOString().slice(0,10);}
/* 以指定檔名觸發瀏覽器下載 Blob。 */
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}

/* 先選日期，再輸出每天獨立圖片或 PDF；多檔以 ZIP 下載。 */
/* 開啟圖片或 PDF 匯出選擇器，並在有未解衝突時停止匯出流程。 */
function openExportDialog(kind){
 if(hasUnresolvedConflicts()){showToast("請先解決本次衝突再執行匯出");return;}
 if(!state.dates.length){showToast("請先新增日期頁籤");return;}
 const content=document.createElement("div");content.className="export-options";const all=document.createElement("label");all.className="select-all";all.innerHTML='<input type="checkbox" checked> 選取全部日期';content.appendChild(all);
 const list=document.createElement("div");list.className="export-date-list";state.dates.slice().sort().forEach(date=>{const label=document.createElement("label");label.innerHTML='<input type="checkbox" value="'+date+'" checked> '+esc(dateLabel(date,true));list.appendChild(label);});content.appendChild(list);
 const allInput=all.querySelector("input");let updatePdfMode=()=>{};allInput.addEventListener("change",()=>{list.querySelectorAll("input").forEach(i=>i.checked=allInput.checked);updatePdfMode();});list.addEventListener("change",()=>{allInput.checked=[...list.querySelectorAll("input")].every(i=>i.checked);updatePdfMode();});
 if(kind==="pdf"){const mode=document.createElement("fieldset");mode.className="pdf-mode";mode.innerHTML='<legend>多日期 PDF 方式</legend><label><input type="radio" name="pdfMode" value="merged" checked> 合併成一份 PDF（一天至少一頁） <span class="option-hint" hidden>需選擇至少兩個日期</span></label><label><input type="radio" name="pdfMode" value="separate"> 每天一份 PDF（多份時打包 ZIP）</label>';content.appendChild(mode);updatePdfMode=()=>{const merged=mode.querySelector('input[value="merged"]'),separate=mode.querySelector('input[value="separate"]'),hint=mode.querySelector(".option-hint"),count=list.querySelectorAll("input:checked").length,available=count>=2;merged.disabled=!available;hint.hidden=available;if(!available)separate.checked=true;};updatePdfMode();}
 openDialog(kind==="image"?"匯出圖片":"匯出 PDF",content,[{text:"匯出所選日期",cls:"primary",run:async()=>{const dates=[...list.querySelectorAll("input:checked")].map(i=>i.value);if(!dates.length){showToast("至少選擇一個日期");return;}try{if(kind==="image")await exportImages(dates);else await exportPdfs(dates,content.querySelector('input[name="pdfMode"]:checked').value);}catch(error){console.error("匯出失敗",error);showToast("匯出失敗，請稍後再試");}}},{text:"取消",cls:""}]);
}
/* 載入並快取匯出專用 LOGO；失敗時清除 Promise，讓下次匯出能以同站絕對 URL 重試。 */
function loadExportLogo(){
 if(!exportLogoPromise){
  const source=new URL("LOGO_橫.png",document.baseURI).href;
  exportLogoPromise=new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error("匯出 LOGO 載入失敗"));image.src=source;});
  exportLogoPromise.catch(()=>{exportLogoPromise=undefined;});
 }
 return exportLogoPromise;
}
/* 依所選日期建立 PNG 所需畫布；LOGO 不可用時仍以文字備援完成匯出。 */
async function exportImages(dates){exportLogoFallbackNotified=false;const files=await Promise.all(dates.map(async date=>{const canvas=await renderScheduleCanvas(date);return{name:date+".png",data:dataUrlBytes(canvas.toDataURL("image/png"))};}));if(files.length===1)downloadBlob(new Blob([files[0].data],{type:"image/png"}),files[0].name);else downloadBlob(zipFiles(files),"TickBrick_圖片_"+dates[0]+"_"+dates[dates.length-1]+".zip");}
/* 依選擇產生合併或分日 PDF；各頁以 LOGO 或文字備援繪製後再轉為影像。 */
async function exportPdfs(dates,mode){exportLogoFallbackNotified=false;const ordered=dates.slice().sort();if(mode==="merged"){downloadBlob(await buildPdf(ordered),"TickBrick_"+ordered[0]+"_"+ordered[ordered.length-1]+".pdf");return;}const files=await Promise.all(ordered.map(async date=>({name:date+".pdf",blob:await buildPdf([date])})));if(files.length===1)downloadBlob(files[0].blob,files[0].name);else downloadBlob(zipFiles(await Promise.all(files.map(async f=>({name:f.name,data:new Uint8Array(await f.blob.arrayBuffer())})))),"TickBrick_PDF_"+ordered[0]+"_"+ordered[ordered.length-1]+".zip");}
/* 以已載入的匯出 LOGO 或「行程樂高 TickBrick」文字建立單日或 PDF 續頁畫布，並標示待確認行程。 */
async function renderScheduleCanvas(date,rowSubset,continuation){
 const rows=rowSubset||(state.days[date]||[]).filter(row=>!row.pending),measure=document.createElement("canvas").getContext("2d"),prepared=rows.map(row=>{const lines=wrapText(measure,row.content||"",28,520),confirmationHeight=row.confirmed?26:0;return{row,lines,confirmationHeight,height:Math.max(90,lines.length*38+30+confirmationHeight)};}),contentHeight=prepared.reduce((sum,item)=>sum+item.height,0);
 const canvas=document.createElement("canvas");canvas.width=1240;canvas.height=Math.max(1754,261+contentHeight+70);const ctx=canvas.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);
 const logoX=80,logoY=40,logoVisibleHeight=60,logoDateGap=30,logoVisibleWidth=907/264*logoVisibleHeight,dateY=logoY+logoVisibleHeight+logoDateGap+28;
 try{const logo=await loadExportLogo();ctx.drawImage(logo,35,37,907,264,logoX,logoY,logoVisibleWidth,logoVisibleHeight);}catch(error){console.warn("匯出 LOGO 載入失敗，改用文字備援",error);ctx.font="bold 38px sans-serif";ctx.fillStyle="#2c3e50";ctx.fillText("行程樂高 TickBrick",logoX,logoY+45);if(!exportLogoFallbackNotified){exportLogoFallbackNotified=true;showToast("匯出 LOGO 無法載入，已改用文字備援");}}
 ctx.font="28px sans-serif";ctx.fillStyle="#555";ctx.fillText(dateLabel(date,true)+(continuation?"（續）":""),logoX,dateY);
 let y=205;const left=70,w1=240,w2=240;ctx.fillStyle="#2c3e50";ctx.fillRect(left,y,1100,56);ctx.fillStyle="#fff";ctx.font="bold 23px sans-serif";ctx.fillText("時間／時長",left+14,y+37);ctx.fillText("類別",left+w1+14,y+37);ctx.fillText("行程內容",left+w1+w2+14,y+37);y+=56;
 prepared.forEach(({row,lines,confirmationHeight,height})=>{ctx.fillStyle=row.pending?"#fcffc2":"#fff";ctx.fillRect(left,y,1100,height);ctx.strokeStyle="#d9dee4";ctx.strokeRect(left,y,1100,height);
  ctx.fillStyle="#222";ctx.font="26px sans-serif";ctx.fillText(row.start&&row.end?row.start+"–"+row.end:"—",left+14,y+38);ctx.font="20px sans-serif";ctx.fillStyle="#666";ctx.fillText(formatDuration(row.duration),left+14,y+68);
  ctx.fillStyle=(state.categories.find(c=>c.name===row.category)||{}).color||"#fff";ctx.fillRect(left+w1+8,y+10,110,height-20);ctx.fillStyle="#222";ctx.font="22px sans-serif";ctx.fillText(row.category||"",left+w1+15,y+42);
  if(row.confirmed){ctx.fillStyle="#826709";ctx.font="17px sans-serif";ctx.fillText("待確認",left+w1+w2+14,y+28);}ctx.fillStyle="#222";ctx.font="26px sans-serif";lines.forEach((line,i)=>ctx.fillText(line,left+w1+w2+14,y+38+confirmationHeight+i*38));if(row.pending){ctx.fillStyle="#826709";ctx.font="18px sans-serif";ctx.fillText("待放置",left+1000,y+30);}y+=height;});return canvas;
}
/* 文字匯出優先在空白處換行；沒有可換行空白的中文或超長網址才逐字折行。 */
function wrapText(ctx,text,size,width){
 ctx.font=size+"px sans-serif";const lines=[];
 String(text).split(/\r?\n/).forEach(paragraph=>{let line="",hasWord=false;const words=paragraph.match(/\S+/g)||[];
  if(!words.length){lines.push("");return;}
  words.forEach(word=>{const candidate=hasWord?line+" "+word:word;if(ctx.measureText(candidate).width<=width){line=candidate;hasWord=true;return;}if(hasWord)lines.push(line);line="";hasWord=false;
   for(const char of word){if(ctx.measureText(line+char).width>width&&line){lines.push(line);line=char;}else line+=char;}hasWord=Boolean(line);
  });if(hasWord)lines.push(line);
 });return lines.length?lines:[""];
}
/* 將 PNG data URL 轉成可下載或打包的 Blob。 */
function dataUrlBlob(url){const bytes=atob(url.split(",")[1]),arr=new Uint8Array(bytes.length);for(let i=0;i<bytes.length;i++)arr[i]=bytes.charCodeAt(i);return new Blob([arr],{type:"image/png"});}
/* 將 data URL 的 Base64 資料轉成位元組陣列。 */
function dataUrlBytes(url){const bytes=atob(url.split(",")[1]),arr=new Uint8Array(bytes.length);for(let i=0;i<bytes.length;i++)arr[i]=bytes.charCodeAt(i);return arr;}
/* 將各日期的畫布依既有分頁語意轉成 PDF，每頁皆可在 LOGO 失敗時使用文字備援。 */
async function buildPdf(dates){
 const enc=new TextEncoder(),objects=[],offsets=[0];let body="%PDF-1.4\n";const add=o=>{objects.push(o);return objects.length;};
 const catalog=add(""),pages=add(""),pageIds=[];
 for(const date of dates){const groups=rowsByPdfPage((state.days[date]||[]).filter(row=>!row.pending));for(let pageIndex=0;pageIndex<groups.length;pageIndex++){const canvas=await renderScheduleCanvas(date,groups[pageIndex],pageIndex>0),raw=atob(canvas.toDataURL("image/jpeg",.92).split(",")[1]),bin=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bin[i]=raw.charCodeAt(i);
  const image=add({bin,dict:"<< /Type /XObject /Subtype /Image /Width "+canvas.width+" /Height "+canvas.height+" /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length "+bin.length+" >>"}),stream=enc.encode("q\n595 0 0 842 0 0 cm\n/Im0 Do\nQ\n");
  const content=add({bin:stream,dict:"<< /Length "+stream.length+" >>"});pageIds.push(add("<< /Type /Page /Parent "+pages+" 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 "+image+" 0 R >> >> /Contents "+content+" 0 R >>"));}}
 objects[catalog-1]="<< /Type /Catalog /Pages "+pages+" 0 R >>";objects[pages-1]="<< /Type /Pages /Kids ["+pageIds.map(x=>x+" 0 R").join(" ")+"] /Count "+pageIds.length+" >>";
 objects.forEach((obj,i)=>{offsets.push(body.length);body+=(i+1)+" 0 obj\n";if(typeof obj==="string")body+=obj+"\nendobj\n";else body+=obj.dict+"\nstream\n"+binaryString(obj.bin)+"\nendstream\nendobj\n";});
 const xref=body.length;body+="xref\n0 "+(objects.length+1)+"\n0000000000 65535 f \n";offsets.slice(1).forEach(off=>body+=String(off).padStart(10,"0")+" 00000 n \n");body+="trailer\n<< /Size "+(objects.length+1)+" /Root "+catalog+" 0 R >>\nstartxref\n"+xref+"\n%%EOF";const bytes=new Uint8Array(body.length);for(let i=0;i<body.length;i++)bytes[i]=body.charCodeAt(i)&255;return new Blob([bytes],{type:"application/pdf"});
}
/* 依待確認標記與內容折行高度切分 PDF 頁面，避免分頁與畫布列高不一致。 */
function rowsByPdfPage(rows){
 if(!rows.length)return[[]];const measure=document.createElement("canvas").getContext("2d"),pages=[];let page=[],used=0;
 rows.forEach(row=>{const lines=wrapText(measure,row.content||"",28,520),height=Math.max(90,lines.length*38+30+(row.confirmed?26:0));if(page.length&&used+height>1450){pages.push(page);page=[];used=0;}page.push(row);used+=height;});if(page.length)pages.push(page);return pages;
}
/* 將位元組陣列分段轉為二進位字串，避免展開過多參數。 */
function binaryString(bytes){let value="";for(let i=0;i<bytes.length;i+=0x8000)value+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return value;}
/* 建立無壓縮 ZIP，包含各日圖片或 PDF。 */
const CRC_TABLE=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
/* 計算 ZIP 檔案項目所需的 CRC-32 檢查碼。 */
function crc32(bytes){let crc=0xffffffff;for(const b of bytes)crc=CRC_TABLE[(crc^b)&255]^(crc>>>8);return(crc^0xffffffff)>>>0;}
/* 將多個已產生的檔案組成未壓縮的 ZIP Blob。 */
function zipFiles(files){
 const enc=new TextEncoder(),parts=[],central=[];let offset=0;
 files.forEach(file=>{const name=enc.encode(file.name),data=file.data instanceof Uint8Array?file.data:new Uint8Array(file.data),crc=crc32(data),local=new Uint8Array(30+name.length),v=new DataView(local.buffer);
  v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);local.set(name,30);parts.push(local,data);
  const c=new Uint8Array(46+name.length),cv=new DataView(c.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint32(16,crc,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);c.set(name,46);central.push(c);offset+=local.length+data.length;});
 const size=central.reduce((n,b)=>n+b.length,0),end=new Uint8Array(22),dv=new DataView(end.buffer);dv.setUint32(0,0x06054b50,true);dv.setUint16(8,files.length,true);dv.setUint16(10,files.length,true);dv.setUint32(12,size,true);dv.setUint32(16,offset,true);return new Blob([...parts,...central,end],{type:"application/zip"});
}

/* 建立共用對話框，並依選用設定套用專用排列與初始鍵盤焦點。 */
function openDialog(title,content,actions,options={}){
 const dialog=document.getElementById("appDialog");dialog.oncancel=null;dialog.onclick=null;dialog.className="app-dialog"+(options.dialogClass?" "+options.dialogClass:"");dialog.toggleAttribute("tabindex",Boolean(options.focusDialog));const titleTarget=document.getElementById("dialogTitle");titleTarget.replaceChildren();if(typeof title==="string")titleTarget.textContent=title;else titleTarget.append(title);const target=document.getElementById("dialogContent");target.replaceChildren();if(typeof content==="string")target.textContent=content;else target.appendChild(content);
 const buttons=document.getElementById("dialogActions");buttons.className="dialog-actions"+(options.actionsClass?" "+options.actionsClass:"");buttons.replaceChildren();actions.forEach((action,index)=>{const button=document.createElement("button");button.type="button";button.className="button"+(action.cls?" "+action.cls:"")+(action.actionClass?" "+action.actionClass:"");button.textContent=action.text;button.disabled=Boolean(action.disabled);if(options.disablePrimary&&index===0){button.classList.add("dialog-primary-hidden");button.tabIndex=-1;button.disabled=true;}button.addEventListener("click",()=>{action.beforeClose?.();dialog.oncancel=null;dialog.onclick=null;dialog.close();if(action.run)action.run();});buttons.appendChild(button);});
 if(options.onCancel){let cancelled=false,pressedOutside=false;const outside=event=>{const box=dialog.getBoundingClientRect(),x=event.clientX,y=event.clientY;return event.target===dialog&&(x<box.left||x>box.right||y<box.top||y>box.bottom);},cancel=event=>{if(event)event.preventDefault();if(cancelled)return;cancelled=true;dialog.oncancel=null;dialog.onclick=null;dialog.onpointerdown=null;dialog.close();options.onCancel();};dialog.oncancel=cancel;dialog.onpointerdown=event=>{pressedOutside=outside(event);};dialog.onclick=event=>{if(pressedOutside&&outside(event))cancel(event);pressedOutside=false;};}dialog.showModal();if(options.focusDialog)dialog.focus();
}
/* 開啟含確認與取消按鈕的共用二次確認燈箱。 */
function askConfirm(title,message,confirmText,onConfirm){openDialog(title,message,[{text:confirmText,cls:"danger",run:onConfirm},{text:"取消",cls:""}]);}

/* 連接畫面事件並首次繪製。 */
document.getElementById("addRowButton").addEventListener("click",addRow);
document.getElementById("calendarToggle").addEventListener("click",()=>openCalendar(true));
document.getElementById("calendarPrev").addEventListener("click",()=>{activeCalendarMonth=new Date(activeCalendarMonth.getFullYear(),activeCalendarMonth.getMonth()-1,1);renderCalendar();});
document.getElementById("calendarNext").addEventListener("click",()=>{activeCalendarMonth=new Date(activeCalendarMonth.getFullYear(),activeCalendarMonth.getMonth()+1,1);renderCalendar();});
document.addEventListener("click",e=>{const pop=document.getElementById("calendarPopover"),menu=document.querySelector(".export-menu");if(!pop.contains(e.target)&&!document.getElementById("calendarToggle").contains(e.target))pop.hidden=true;if(menu.open&&!menu.contains(e.target))menu.open=false;});
const stagingSection=document.getElementById("stagingSection");
stagingSection.addEventListener("dragover",e=>{if(draggedRow&&draggedRow.type==="row"&&draggedRow.area==="day"){e.preventDefault();stagingSection.classList.add("drop-target");}});
stagingSection.addEventListener("dragleave",e=>{if(!stagingSection.contains(e.relatedTarget))stagingSection.classList.remove("drop-target");});
stagingSection.addEventListener("drop",e=>{e.preventDefault();stagingSection.classList.remove("drop-target");if(!draggedRow||draggedRow.type!=="row"||draggedRow.area!=="day")return;const row=getRow("day",draggedRow.id);if(row)moveRowToStaging(row);});
const emptyDay=document.getElementById("emptyDay");
emptyDay.addEventListener("dragover",e=>{if(draggedRow&&draggedRow.type==="row"&&draggedRow.area==="staging"){e.preventDefault();emptyDay.classList.add("drag-over");}});
emptyDay.addEventListener("dragleave",()=>emptyDay.classList.remove("drag-over"));
emptyDay.addEventListener("drop",e=>{e.preventDefault();emptyDay.classList.remove("drag-over");if(!draggedRow||draggedRow.type!=="row"||draggedRow.area!=="staging")return;const row=getRow("staging",draggedRow.id);if(row)moveStagingRowToDay(row);});
document.getElementById("exportJsonButton").addEventListener("click",exportJSON);
document.getElementById("importJsonButton").addEventListener("click",()=>document.getElementById("importFile").click());
document.getElementById("importFile").addEventListener("change",e=>{if(e.target.files[0])importJSON(e.target.files[0]);e.target.value="";});
document.getElementById("exportImageButton").addEventListener("click",()=>openExportDialog("image"));
document.getElementById("exportPdfButton").addEventListener("click",()=>openExportDialog("pdf"));
window.addEventListener("beforeunload",()=>saveState());
render();
