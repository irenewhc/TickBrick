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
function makeId(){return"r"+Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
/* 建立行程列，保留 0 分鐘時長、待確認預設值並以 60 分鐘補足缺值。 */
function makeRow(date,start,end,duration,category,content){return{id:makeId(),date:date||"",start:start||"",end:end||"",duration:durationValue(duration),lock:"none",category:category||"",content:content||"",confirmed:false,pending:false};}
/* 載入目前或舊版瀏覽器資料，並交由正規化流程補齊待確認欄位。 */
function loadState(){
 try{
  const current=localStorage.getItem(STORAGE_KEY);if(current)return normalizeState(JSON.parse(current));
  const legacy=localStorage.getItem(LEGACY_KEY);
  if(legacy){const migrated=blankState();JSON.parse(legacy).forEach(old=>{const date=old.date||"2026-10-29";if(!migrated.days[date]){migrated.days[date]=[];migrated.dates.push(date);}migrated.days[date].push({...old,id:old.id||makeId(),date,confirmed:!!old.confirmed,pending:false});});migrated.dates.sort();migrated.activeDate=migrated.dates[0]||"";localStorage.setItem(STORAGE_KEY,JSON.stringify(migrated));return migrated;}
 }catch(error){console.error("行程資料讀取失敗",error);}
 const initial=blankState(),date="2026-10-29";initial.dates=[date];initial.activeDate=date;initial.days[date]=INITIAL_ROWS.map(r=>makeRow(date,...r));return initial;
}
/* 將舊版或匯入資料正規化為含衝突與待確認保存資訊的目前狀態格式。 */
function normalizeState(input){
 const result=blankState();
 if(Array.isArray(input)){input.forEach(row=>{const date=row.date||"2026-10-29";if(!result.days[date]){result.days[date]=[];result.dates.push(date);}result.days[date].push({...row,id:row.id||makeId(),date,confirmed:!!row.confirmed,pending:false});});result.dates.sort();result.activeDate=result.dates[0]||"";return result;}
 result.version=input.version||1;result.dates=Array.isArray(input.dates)?[...new Set(input.dates.filter(validDate))]:[];
 result.activeDate=result.dates.includes(input.activeDate)?input.activeDate:(result.dates[0]||"");
 result.dates.forEach(date=>result.days[date]=Array.isArray(input.days&&input.days[date])?input.days[date].map(row=>({...row,id:row.id||makeId(),date,confirmed:!!row.confirmed,pending:!!row.pending})):[]);
 result.staging=Array.isArray(input.staging)?input.staging.map(row=>({...row,id:row.id||makeId(),date:"",start:"",end:"",confirmed:!!row.confirmed,pending:false})):[];
 result.categories=Array.isArray(input.categories)?input.categories.map(c=>({name:String(c.name),color:/^#[0-9a-f]{6}$/i.test(c.color)?c.color:"#FFFFFF"})):DEFAULT_CATEGORIES.map(c=>({...c}));
 result.conflicts=Array.isArray(input.conflicts)?input.conflicts.filter(conflict=>conflict&&typeof conflict==="object"&&typeof conflict.lockedRowId==="string"&&typeof conflict.lockedField==="string").map(conflict=>({...conflict})):[];
 DEFAULT_CATEGORIES.forEach(def=>{if(!result.categories.some(c=>c.name===def.name))result.categories.push({...def});});return result;
}
function validDate(value){return/^\d{4}-\d{2}-\d{2}$/.test(value)&&!isNaN(new Date(value+"T12:00:00").getTime());}
function calendarMonthFor(value){const date=value?new Date(value+"T12:00:00"):new Date();return new Date(date.getFullYear(),date.getMonth(),1);}
function saveState(data){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data||state));}catch(error){console.error("自動保存失敗",error);showToast("瀏覽器儲存空間不足，請先匯出 JSON 備份");}}
function persist(){clearTimeout(autosaveTimer);autosaveTimer=setTimeout(()=>saveState(),120);}
function esc(value){return String(value==null?"":value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function dateLabel(value,year){if(!value)return"";const d=new Date(value+"T12:00:00"),w=["日","一","二","三","四","五","六"];return(year?d.getFullYear()+"/":"")+String(d.getMonth()+1).padStart(2,"0")+"/"+String(d.getDate()).padStart(2,"0")+"（"+w[d.getDay()]+"）";}
function showToast(message){const toast=document.getElementById("toast");toast.textContent=message;toast.classList.add("show");clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.remove("show"),2100);}
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
 if(source.matches("tr")){const table=document.createElement("table"),body=document.createElement("tbody"),clone=source.cloneNode(true);table.append(body);body.append(clone);preview.append(table);}else preview.append(source.cloneNode(true));
 document.body.append(preview);positionTouchPreview(x,y);
}
/* 將觸控預覽置於手指右下方，避免遮住實際放置目標。 */
function positionTouchPreview(x,y){const preview=document.querySelector(".touch-drag-preview");if(preview){preview.style.transform="translate("+(x+14)+"px,"+(y+14)+"px)";}}
/* 清除目前觸控拖曳所留下的來源、插入線與目標提示。 */
function clearTouchDragVisuals(){document.querySelector(".touch-drag-preview")?.remove();document.querySelectorAll(".row-dragging,.tab-dragging,.touch-drop-before,.touch-drop-after,.tab-drop-before,.tab-drop-after,.drag-over,.drop-target").forEach(element=>element.classList.remove("row-dragging","tab-dragging","touch-drop-before","touch-drop-after","tab-drop-before","tab-drop-after","drag-over","drop-target"));}
/* 根據手指下方的列、暫存區或頁籤更新前後插入位置與放置目標。 */
function updateTouchDrag(x,y){
 if(!touchDrag)return;positionTouchPreview(x,y);touchDrag.target=null;clearTouchDropTarget();const element=document.elementFromPoint(x,y),tab=element&&element.closest(".date-tab"),row=element&&element.closest("tr[data-id]"),staging=element&&element.closest("#stagingSection"),emptyDay=element&&element.closest("#emptyDay");
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
function renderDay(){
 const rows=activeRows();document.getElementById("activeDateTitle").textContent=state.activeDate?dateLabel(state.activeDate,true):"尚未建立日期";
 document.getElementById("daySummary").textContent=rows.length?rows.length+" 項行程":"尚無行程";document.getElementById("emptyDay").hidden=rows.length>0;
 document.getElementById("addRowButton").disabled=!state.activeDate;
 const root=document.getElementById("tableBody");root.innerHTML=rows.map((row,index)=>rowMarkup(row,index,"day")).join("");bindRows(root,"day");
}
function renderStaging(){
 const root=document.getElementById("stagingBody");document.getElementById("stagingCount").textContent=state.staging.length+" 項";document.getElementById("emptyStaging").hidden=state.staging.length>0;
 root.innerHTML=state.staging.map((row,index)=>rowMarkup(row,index,"staging")).join("");bindRows(root,"staging");
}
function categoryOptions(value){return'<option value=""></option>'+state.categories.map(c=>'<option value="'+esc(c.name)+'" '+(value===c.name?"selected":"")+'>'+esc(c.name)+'</option>').join("");}
/* 產生正式區或暫存區單列 HTML，並套用保存中的衝突與待確認提示狀態。 */
function rowMarkup(row,index,area){
 const color=(state.categories.find(c=>c.name===row.category)||{}).color||"#FFFFFF",pending=!!row.pending;
 const rowClass=["schedule-row",pending?"pending-row":"",area==="day"&&row.isNew?"new-row-highlight":"",hasConflictForRow(row.id)?"conflict-highlight":""].filter(Boolean).join(" ");
 const inputClass=field=>hasConflictForInput(row.id,field)?" conflict-field-highlight":"";
 const lockButton=field=>'<button class="lock-btn '+(row.lock===field?"locked":"")+'" data-lock="'+field+'" title="鎖定'+({start:"開始時間",end:"結束時間",duration:"總時長"}[field])+'">'+(row.lock===field?'<i class="fa-solid fa-lock" aria-hidden="true"></i>':'<i class="fa-solid fa-lock-open" aria-hidden="true"></i>')+'</button>';
 const editDisabled=area==="staging"||pending;
 return'<tr class="'+rowClass+'" data-id="'+esc(row.id)+'" data-index="'+index+'" data-area="'+area+'">'+
 '<td class="order-cell" draggable="true"><span class="drag-handle" title="拖曳調整順序">⠿</span>'+(pending?'<span class="pending-tag">待放置</span>':"")+'</td>'+
 '<td><div class="time-cell"><input type="text" class="time-input'+inputClass("start")+'" aria-label="開始時間" value="'+esc(row.start)+'" placeholder="HH:MM" '+(editDisabled||row.lock==="start"?"disabled":"")+' data-field="start">'+(area==="day"?lockButton("start"):"")+'</div></td>'+
 '<td><div class="time-cell"><input type="text" class="time-input'+inputClass("end")+'" aria-label="結束時間" value="'+esc(row.end)+'" placeholder="HH:MM" '+(editDisabled||row.lock==="end"?"disabled":"")+' data-field="end">'+(area==="day"?lockButton("end"):"")+'</div></td>'+
 '<td><div class="duration-cell"><div class="duration-editor"><input type="number" class="duration-input'+inputClass("duration")+'" min="0" value="'+esc(row.duration)+'" aria-label="總時長（分鐘）" '+(pending||row.lock==="duration"?"disabled":"")+' data-field="duration"><span>分鐘</span>'+(area==="day"?lockButton("duration"):"")+'</div><span class="duration-display'+(Number(row.duration)===0?" duration-zero":"")+'">'+formatDuration(row.duration)+'</span></div></td>'+
 '<td><div class="category-select-wrapper"><select class="category-select" aria-label="類別" style="background-color:'+color+'" data-field="category">'+categoryOptions(row.category)+'</select><i class="fa-solid fa-chevron-down category-select-icon" aria-hidden="true"></i></div></td>'+
 '<td><div class="content-editor"><label class="confirmation-toggle"><input type="checkbox" data-confirmed-toggle '+(row.confirmed?"checked":"")+'> 待確認</label><textarea class="content-input'+(row.confirmed?" confirmation-pending":"")+'" aria-label="行程內容" placeholder="輸入行程內容" data-field="content" rows="1" wrap="soft">'+esc(row.content)+'</textarea></div></td>'+
 '<td><div class="row-actions">'+(area==="day"?(pending?'<button class="button small primary" data-action="place">放置此處</button><button class="button small minor" data-action="stage">移至暫存</button>':'<button class="button small" data-action="move">移至其他日期</button><button class="button small" data-action="stage">移至暫存</button>'):'<button class="button small" data-action="move">移至其他日期</button>')+'</div></td>'+
 '<td><button class="icon-button" data-action="delete" aria-label="刪除行程">×</button></td></tr>';
}
/* 依文字內容自動調整行程 textarea 高度，避免出現內容框內的水平捲動。 */
function resizeContentTextarea(textarea){textarea.style.height="auto";textarea.style.height=textarea.scrollHeight+"px";}
/* 綁定行程列的桌面拖放、觸控拖放、欄位編輯、待確認切換與行程操作。 */
function bindRows(root,area){
 root.querySelectorAll("tr[data-id]").forEach(tr=>{const row=getRow(area,tr.dataset.id);
  tr.addEventListener("focusin",()=>{if(row.isNew){row.isNew=false;tr.classList.remove("new-row-highlight");persist();}});
  tr.addEventListener("dragstart",e=>{if(!e.target.closest(".order-cell")){e.preventDefault();return;}draggedRow={type:"row",area,id:row.id};e.dataTransfer.effectAllowed="move";const rect=tr.getBoundingClientRect();e.dataTransfer.setDragImage(tr,e.clientX-rect.left,e.clientY-rect.top);tr.classList.add("row-dragging");});
  tr.addEventListener("dragend",()=>{tr.classList.remove("row-dragging");draggedRow=null;document.querySelectorAll(".touch-drop-before,.touch-drop-after").forEach(item=>item.classList.remove("touch-drop-before","touch-drop-after"));});
  tr.addEventListener("dragover",e=>{const acceptsRow=draggedRow&&draggedRow.type==="row"&&(draggedRow.area===area||(area==="day"&&draggedRow.area==="staging"));if(acceptsRow){e.preventDefault();const after=e.clientY>=tr.getBoundingClientRect().top+tr.getBoundingClientRect().height/2;document.querySelectorAll(".touch-drop-before,.touch-drop-after").forEach(item=>item.classList.remove("touch-drop-before","touch-drop-after"));tr.classList.add(after?"touch-drop-after":"touch-drop-before");}});
  tr.addEventListener("dragleave",()=>tr.classList.remove("touch-drop-before","touch-drop-after"));
  tr.addEventListener("drop",e=>{const acceptsRow=draggedRow&&draggedRow.type==="row"&&(draggedRow.area===area||(area==="day"&&draggedRow.area==="staging"));if(!acceptsRow)return;e.preventDefault();e.stopPropagation();const after=e.clientY>=tr.getBoundingClientRect().top+tr.getBoundingClientRect().height/2;tr.classList.remove("touch-drop-before","touch-drop-after");if(area==="day"&&draggedRow.area==="staging"){const stagingRow=getRow("staging",draggedRow.id);if(stagingRow)moveStagingRowToDay(stagingRow,row.id,after);return;}requestReorder(area,draggedRow.id,row.id,after);});
  tr.querySelectorAll("[data-field]").forEach(input=>input.addEventListener("change",()=>{
   const field=input.dataset.field;
   if(area==="day"&&!row.pending&&["start","end","duration"].includes(field))handleTimeEdit(row.id,field,input.value);
   else updateRow(area,row.id,field,input.value);
  }));
  tr.querySelectorAll(".content-input").forEach(textarea=>{resizeContentTextarea(textarea);textarea.addEventListener("input",()=>resizeContentTextarea(textarea));});
  tr.querySelectorAll("[data-confirmed-toggle]").forEach(input=>input.addEventListener("change",()=>updateRow(area,row.id,"confirmed",input.checked)));
  tr.querySelectorAll("[data-lock]").forEach(button=>button.addEventListener("click",()=>{row.lock=row.lock===button.dataset.lock?"none":button.dataset.lock;clearConflictsAfterSuccess();renderDay();renderStaging();}));
  tr.querySelector(".category-select").addEventListener("change",e=>e.currentTarget.style.backgroundColor=(state.categories.find(c=>c.name===e.currentTarget.value)||{}).color||"#fff");
  tr.querySelectorAll("[data-action]").forEach(button=>button.addEventListener("click",()=>rowAction(area,row.id,button.dataset.action)));
  tr.querySelector(".order-cell").addEventListener("pointerdown",event=>beginTouchDrag(event,{type:"row",area,id:row.id,source:tr,capture:event.currentTarget}));
 });
}
function getList(area){return area==="staging"?state.staging:activeRows();}
function getRow(area,id){return getList(area).find(r=>r.id===id);}
/* 將內部時間欄位名稱轉為衝突提示可讀的中文名稱。 */
function fieldLabel(field){return({start:"開始時間",end:"結束時間",duration:"總時長"}[field]||field);}
/* 判斷一列是否是任何未解決衝突的鎖定列。 */
function hasConflictForRow(id){return state.conflicts.some(conflict=>conflict.lockedRowId===id);}
/* 判斷輸入欄是否為直接輸入後仍須保留的衝突欄位。 */
function hasConflictForInput(id,field){return state.conflicts.some(conflict=>conflict.directRowId===id&&conflict.directField===field);}
/* 從目前日期向上找最近一筆非待放置正式行程索引。 */
function formalIndexBefore(index){const rows=activeRows();for(let i=index-1;i>=0;i--)if(!rows[i].pending)return i;return-1;}
/* 從目前日期向下找最近一筆非待放置正式行程索引。 */
function formalIndexAfter(index){const rows=activeRows();for(let i=index+1;i<rows.length;i++)if(!rows[i].pending)return i;return-1;}
/* 建立包含鎖定值、所需值與直接輸入來源的可保存衝突資料。 */
function conflictFor(row,field,required,operation,direct){return{ id:makeId(),date:state.activeDate,lockedRowId:row.id,lockedField:field,lockedValue:row[field],requiredValue:required,operation:operation||"時間連動",directRowId:direct&&direct.rowId||"",directField:direct&&direct.field||""};}
/* 建立相鄰行程吸收後會成為負時長的可保存衝突，不偽裝為鎖定欄位。 */
function insufficientDurationConflict(row,required,operation,direct){return{...conflictFor(row,"duration",required,operation,direct),insufficientDuration:true};}
/* 安全寫入推算時間；若欄位鎖定且值不同則回傳衝突而不覆寫。 */
function setTimeValue(row,field,value,operation,direct){if(row.lock===field&&row[field]!==value)return conflictFor(row,field,value,operation,direct);row[field]=value;return null;}
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
/* 檢查直接輸入衝突所涵蓋的實際正式行程鏈，確認每列時長與相鄰串接都已恢復一致。 */
function directConflictStillBlocks(conflict){
 const context=conflict.directContext;if(!context)return null;
 const rows=state.days[conflict.date]||[],directIndex=rows.findIndex(row=>row.id===conflict.directRowId),lockedIndex=rows.findIndex(row=>row.id===conflict.lockedRowId);
 if(directIndex<0||lockedIndex<0)return false;
 const start=Math.min(directIndex,lockedIndex),end=Math.max(directIndex,lockedIndex);let previous=null;
 for(let index=start;index<=end;index++){
  const row=rows[index];if(!row||row.pending)continue;
  if(!row.start||!row.end||timeAfter(row.start,Number(row.duration))!==row.end)return true;
  if(previous&&previous.end!==row.start)return true;
  previous=row;
 }
 return false;
}
/* 判斷鎖定與已回復操作的衝突是否仍會阻擋目前資料；直接輸入以實際時間鏈判定。 */
function conflictStillBlocks(conflict){
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
 rows.forEach((row,index)=>{if(row.pending)return;const field=["start","end"].includes(row.lock)?row.lock:"";if(field&&row[field])bases.push({row,index,field,base:timeBefore(field==="start"?row.start:timeBefore(row.end,durationValue(row.duration)),elapsed),elapsed});elapsed+=durationValue(row.duration);});
 return bases;
}
/* 依整條正式鏈所有時間鎖定重算；多個鎖定不相容時回傳第一個實際衝突。 */
function recalculateLockedChain(operation,direct,preferredIndex=-1){
 const rows=activeRows(),bases=lockedChainBases(rows);if(!bases.length)return null;const preferred=bases.find(item=>item.index===preferredIndex),anchor=preferred||bases[0];
 for(const constraint of bases.slice(1)){if(constraint.base!==anchor.base){const start=timeAfter(anchor.base,constraint.elapsed),required=constraint.field==="start"?start:timeAfter(start,durationValue(constraint.row.duration));return conflictFor(constraint.row,constraint.field,required,operation,direct);}}
 let elapsed=0;
 for(const row of rows){if(row.pending)continue;const start=timeAfter(anchor.base,elapsed),end=timeAfter(start,durationValue(row.duration)),startConflict=setTimeValue(row,"start",start,operation,direct);if(startConflict)return startConflict;const endConflict=setTimeValue(row,"end",end,operation,direct);if(endConflict)return endConflict;elapsed+=durationValue(row.duration);}
 return null;
}
/* 結構性動作優先滿足整條時間鏈的時間鎖定，沒有時間鎖定時沿用既有鄰接串接。 */
function recalculateStructuralChain(index,operation){return typeof lockedChainBases==="function"&&lockedChainBases(activeRows()).length?recalculateLockedChain(operation):cascadeFrom(index,operation);}
/* 重新檢查所有已保存衝突，僅保留仍確實阻擋的項目。 */
function refreshConflicts(){state.conflicts=state.conflicts.filter(conflictStillBlocks);}
/* 記錄鎖定衝突；排序回復時一併保存原本插入位置，供之後以真實重算判斷是否已解決。 */
function recordConflict(conflict,reorderContext){if(reorderContext)conflict={...conflict,reorderContext};state.conflicts=state.conflicts.filter(item=>!(item.directRowId&&item.directRowId===conflict.directRowId&&item.directField===conflict.directField));state.conflicts.push(conflict);persist();}
/* 成功完成一項操作後刷新衝突並保存目前狀態。 */
function clearConflictsAfterSuccess(){refreshConflicts();persist();}
/* 在衝突回復後重新寫回使用者直接輸入的欄位值。 */
function setDirectValue(row,field,value){row[field]=value;}
/* 更新非正式時間連動入口與待確認欄位，並在成功後重檢既有衝突。 */
function updateRow(area,id,field,value){
 const row=getRow(area,id);if(!row)return;
 if(row.lock===field){showToast("此欄位已鎖定，請先解除鎖定");render();return;}
 if(field==="confirmed"){row.confirmed=Boolean(value);}
 else if(field==="duration"){row.duration=durationValue(value,0);}
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
function recalculateReorderedDayRow(row,index,operation){
 if(row.pending)return null;
 if(typeof lockedChainBases==="function"&&lockedChainBases(activeRows()).length)return recalculateLockedChain(operation,undefined,reorderTimeAnchorIndex(row,index));
 const rows=activeRows(),anchorIndex=reorderTimeAnchorIndex(row,index);
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
 if(area==="day"&&["start","end"].includes(row.lock)){
  const lockedField=fieldLabel(row.lock),subject=String(row.content||"").trim()||"此行程";draggedRow=null;
  openDialog("確認時間連動","由於「"+subject+"」的「"+lockedField+"」已鎖定，因此時間連動會以該行程的「"+lockedField+"」為基礎更新其他行程。",[{text:"我知道了",cls:"primary",run:()=>reorderRow(area,fromId,toId,placeAfter)},{text:"取消移動",cls:"",run:()=>render()}]);
  return;
 }
 reorderRow(area,fromId,toId,placeAfter);
}
/* 依目標列前後位置重新排序，並以排序專用時間錨點重算；未傳第四參數時維持桌面原生放下即置於目標後的舊行為。 */
function reorderRow(area,fromId,toId,placeAfter){
 if(!fromId||fromId===toId)return;const list=getList(area),from=list.findIndex(r=>r.id===fromId),to=list.findIndex(r=>r.id===toId);if(from<0||to<0)return;
 const backup=structuredClone(list),row=list.splice(from,1)[0],insertAt=placeAfter===undefined?to:to+(placeAfter?1:0)-(from<to+(placeAfter?1:0)?1:0);list.splice(insertAt,0,row);
 const reorderContext={sourceId:row.id,beforeId:list[insertAt-1]&&list[insertAt-1].id||"",afterId:list[insertAt+1]&&list[insertAt+1].id||""};
 if(area==="day"){const conflict=recalculateReorderedDayRow(row,list.indexOf(row),"重新排序");if(conflict){state.days[state.activeDate]=backup;recordConflict(conflict,reorderContext);draggedRow=null;render();presentOperationConflict(conflict);return;}}
 draggedRow=null;clearConflictsAfterSuccess();render();if(area==="day")showToast("排序已更新");
}
/* 從指定正式行程向上串接，保留各列時長並以 24 小時循環推算開始時間。 */
function cascadeBackward(index,operation,direct){
 const rows=activeRows();let currentIndex=index;
 while(currentIndex>=0){const current=rows[currentIndex];if(!current||current.pending||!current.start)break;const previousIndex=formalIndexBefore(currentIndex);if(previousIndex<0)break;const previous=rows[previousIndex],endConflict=setTimeValue(previous,"end",current.start,operation,direct);if(endConflict)return endConflict;const start=timeBefore(previous.end,durationValue(previous.duration));const startConflict=setTimeValue(previous,"start",start,operation,direct);if(startConflict)return startConflict;currentIndex=previousIndex;}
 return null;
}
/* 從指定正式行程向下串接，保留各列時長並以 24 小時循環推算結束時間。 */
function cascadeForward(index,operation,direct){
 const rows=activeRows();let currentIndex=index;
 while(currentIndex>=0&&currentIndex<rows.length){const current=rows[currentIndex];if(!current||current.pending)break;const previousIndex=formalIndexBefore(currentIndex);if(previousIndex>=0){const previous=rows[previousIndex];if(!previous.end)break;const startConflict=setTimeValue(current,"start",previous.end,operation,direct);if(startConflict)return startConflict;}
 if(!current.start)break;const end=timeAfter(current.start,durationValue(current.duration));const endConflict=setTimeValue(current,"end",end,operation,direct);if(endConflict)return endConflict;currentIndex=formalIndexAfter(currentIndex);}
 return null;
}
/* 從指定位置跳過待放置列，向上與向下重新串接正式行程時間鏈。 */
function cascadeFrom(index,operation,direct){const rows=activeRows(),current=rows[index],usable=!current||current.pending?formalIndexAfter(index):index,seed=usable>=0?usable:formalIndexBefore(index);return seed<0?null:cascadeBackward(seed,operation,direct)||cascadeForward(seed,operation,direct);}
function formatTime(value){let str=String(value||"").replace(/[^\d:]/g,"");if(!str)return"";let parts=str.includes(":")?str.split(":"):(str.length>2?[str.slice(0,-2),str.slice(-2)]:[str,"0"]);const h=Math.min(23,Math.max(0,Number(parts[0])||0)),m=Math.min(59,Math.max(0,Number(parts[1])||0));return String(h).padStart(2,"0")+":"+String(m).padStart(2,"0");}
function timeToMin(value){const p=String(value||"00:00").split(":");return Number(p[0])*60+Number(p[1]);}
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
function durationValue(value,fallback=60){const total=Number(value);return Number.isFinite(total)&&total>=0?total:fallback;}
/* 將非負分鐘時長轉為列表顯示用文字，包含 0 分鐘。 */
function formatDuration(value){const total=durationValue(value,0),hours=Math.floor(total/60),minutes=total%60;return hours?(hours+"時"+(minutes?minutes+"分":"")):minutes+"分";}
/* 依修改欄位、相鄰正式行程與本列鎖定欄位列出可用時間調整選項。 */
function timeOptions(row,index,field){
 const previous=formalIndexBefore(index)>=0,next=formalIndexAfter(index)>=0,options=[],lockedField=row.lock==="none"?"":row.lock;
 const add=(key,text,changes,available=true)=>{if(available&&(!lockedField||!changes.includes(lockedField)))options.push({key,text,changes});};
 if(field==="start"){
 add("start-all","時長不變，更新前後行程時間",["start","end"]);
  add("start-fixed-previous","時長不變，更新結束時間及上一項行程的時長",["start","end"],previous);
  add("start-fixed-next","時長不變，更新結束時間及下一項行程的時長",["start","end"],next);
  add("start-previous","結束時間不變，更新時長及上一項行程的時長",["start","duration"],previous);
  add("start-up","結束時間不變，更新時長及之前行程的時間",["start","duration"]);
 }else if(field==="end"){
 add("end-all","時長不變，更新前後行程時間",["start","end"]);
  add("end-fixed-previous","時長不變，更新開始時間及上一項行程的時長",["start","end"],previous);
  add("end-fixed-next","時長不變，更新開始時間及下一項行程的時長",["start","end"],next);
  add("end-next","開始時間不變，更新時長及下一項行程的時長",["end","duration"],next);
  add("end-down","開始時間不變，更新時長及之後行程的時間",["end","duration"]);
 }else{
  add("duration-previous","結束時間不變，更新開始時間及上一項行程的時長",["duration","start"],previous);
  add("duration-up","結束時間不變，更新開始時間及之前行程的時間",["duration","start"]);
  add("duration-next","開始時間不變，更新結束時間及下一項行程的時長",["duration","end"],next);
  add("duration-down","開始時間不變，更新結束時間及之後行程的時間",["duration","end"]);
 }return options;
}
/* 依使用者選擇的時間調整方式，更新本列與相鄰時間鏈；只在鎖定欄位衝突時停止。 */
function applyTimeOption(row,index,field,value,key,direct){
 const operation={"start-all":"更新前後行程時間","start-fixed-previous":"更新上一項行程的時長","start-fixed-next":"更新下一項行程的時長","start-previous":"更新上一項行程的時長","start-up":"更新之前行程的時間","end-all":"更新前後行程時間","end-fixed-previous":"更新上一項行程的時長","end-fixed-next":"更新下一項行程的時長","end-next":"更新下一項行程的時長","end-down":"更新之後行程的時間","duration-previous":"更新上一項行程的時長","duration-next":"更新下一項行程的時長","duration-up":"更新之前行程的時間","duration-down":"更新之後行程的時間"}[key];
 const set=(name,next)=>setTimeValue(row,name,next,operation,direct);
 let conflict=null;
 if(key==="start-all"){const end=timeAfter(value,durationValue(row.duration));conflict=set("start",value)||set("end",end)||cascadeFrom(index,operation,direct);}
 else if(key==="start-fixed-previous"||key==="start-fixed-next"){const end=timeAfter(value,durationValue(row.duration)),neighbourIndex=key==="start-fixed-previous"?formalIndexBefore(index):formalIndexAfter(index),neighbour=activeRows()[neighbourIndex],delta=signedTimeDelta(row.start,value),nextDuration=durationValue(neighbour.duration)+(key==="start-fixed-previous"?delta:-delta);if(nextDuration<0)return insufficientDurationConflict(neighbour,nextDuration,operation,direct);conflict=set("start",value)||set("end",end);if(!conflict){if(key==="start-fixed-previous")conflict=setTimeValue(neighbour,"end",row.start,operation,direct)||setTimeValue(neighbour,"duration",nextDuration,operation,direct)||cascadeForward(index,operation,direct);else conflict=setTimeValue(neighbour,"start",row.end,operation,direct)||setTimeValue(neighbour,"duration",nextDuration,operation,direct)||cascadeBackward(index,operation,direct);}}
 else if(key==="end-all"){const start=timeBefore(value,durationValue(row.duration));conflict=set("end",value)||set("start",start)||cascadeFrom(index,operation,direct);}
 else if(key==="end-fixed-previous"||key==="end-fixed-next"){const start=timeBefore(value,durationValue(row.duration)),neighbourIndex=key==="end-fixed-previous"?formalIndexBefore(index):formalIndexAfter(index),neighbour=activeRows()[neighbourIndex],delta=signedTimeDelta(row.end,value),nextDuration=durationValue(neighbour.duration)+(key==="end-fixed-previous"?delta:-delta);if(nextDuration<0)return insufficientDurationConflict(neighbour,nextDuration,operation,direct);conflict=set("end",value)||set("start",start);if(!conflict){if(key==="end-fixed-previous")conflict=setTimeValue(neighbour,"end",row.start,operation,direct)||setTimeValue(neighbour,"duration",nextDuration,operation,direct)||cascadeForward(index,operation,direct);else conflict=setTimeValue(neighbour,"start",row.end,operation,direct)||setTimeValue(neighbour,"duration",nextDuration,operation,direct)||cascadeBackward(index,operation,direct);}}
 else if(key==="start-previous"||key==="start-up"){const duration=durationBetween(value,row.end);conflict=set("start",value)||set("duration",duration);if(!conflict){const previous=formalIndexBefore(index);if(key==="start-previous"&&previous>=0){const old=activeRows()[previous];conflict=setTimeValue(old,"end",row.start,operation,direct);if(!conflict)conflict=setTimeValue(old,"duration",durationBetween(old.start,old.end),operation,direct);}else if(key==="start-up")conflict=cascadeBackward(index,operation,direct);}}
 else if(key==="end-next"||key==="end-down"){const duration=durationBetween(row.start,value);conflict=set("end",value)||set("duration",duration);if(!conflict){const next=formalIndexAfter(index);if(key==="end-next"&&next>=0){const following=activeRows()[next];conflict=setTimeValue(following,"start",row.end,operation,direct);if(!conflict)conflict=setTimeValue(following,"duration",durationBetween(following.start,following.end),operation,direct);}else if(key==="end-down")conflict=cascadeForward(index,operation,direct);}}
 else if(key==="duration-previous"||key==="duration-up"){const start=timeBefore(row.end,Number(value));conflict=set("duration",value)||set("start",start);if(!conflict){const previous=formalIndexBefore(index);if(key==="duration-previous"&&previous>=0){const old=activeRows()[previous];conflict=setTimeValue(old,"end",row.start,operation,direct);if(!conflict)conflict=setTimeValue(old,"duration",durationBetween(old.start,old.end),operation,direct);}else if(key==="duration-up")conflict=cascadeBackward(index,operation,direct);}}
 else if(key==="duration-next"||key==="duration-down"){const end=timeAfter(row.start,Number(value));conflict=set("duration",value)||set("end",end);if(!conflict){const next=formalIndexAfter(index);if(key==="duration-next"&&next>=0){const following=activeRows()[next];conflict=setTimeValue(following,"start",row.end,operation,direct);if(!conflict)conflict=setTimeValue(following,"duration",durationBetween(following.start,following.end),operation,direct);}else if(key==="duration-down")conflict=cascadeForward(index,operation,direct);}}
 return conflict;
}
/* 保留直接輸入值與其連動選擇，供日後檢查實際受影響時間鏈。 */
function preserveDirectConflict(backup,rowId,field,value,conflict,directContext){state.days[state.activeDate]=backup;const row=activeRows().find(item=>item.id===rowId);if(row)setDirectValue(row,field,value);recordConflict({...conflict,directContext});render();openConflictModal(conflict,true);}
/* 執行已選時間調整選項；若碰鎖定則保留直接輸入並保存衝突。 */
function executeTimeOption(row,index,field,value,option,successMessage){const backup=structuredClone(activeRows()),direct={rowId:row.id,field},conflict=applyTimeOption(row,index,field,value,option.key,direct);if(conflict){preserveDirectConflict(backup,row.id,field,value,conflict,{kind:"option",key:option.key,field});return;}clearConflictsAfterSuccess();render();showToast(successMessage||"時間連動已更新");}
/* 處理正式行程時間欄位輸入，決定首次連動、單一自動選項或選項燈箱。 */
function handleTimeEdit(id,field,value){
 const row=getRow("day",id);if(!row)return;const lockedField=row.lock==="none"?"":row.lock;if(row.lock===field){showToast("此欄位已鎖定，請先解除鎖定");renderDay();return;}
 const parsed=field==="duration"?durationValue(value,0):formatTime(value),rows=activeRows(),index=rows.indexOf(row),backup=structuredClone(rows);
 if(field==="duration"&&(!row.start||!row.end)){row.duration=parsed;clearConflictsAfterSuccess();render();return;}
 if(!row.start&&!row.end&&(field==="start"||field==="end")){row[field]=parsed;const companion=field==="start"?"end":"start",next=field==="start"?timeAfter(row.start,durationValue(row.duration)):timeBefore(row.end,durationValue(row.duration)),direct={rowId:row.id,field},context={kind:"companion",field,operation:"首次輸入時間"};const ownConflict=setTimeValue(row,companion,next,"首次輸入時間",direct);if(ownConflict)return preserveDirectConflict(backup,row.id,field,parsed,ownConflict,context);const conflict=cascadeFrom(index,"首次輸入時間",direct);if(conflict)return preserveDirectConflict(backup,row.id,field,parsed,conflict,context);clearConflictsAfterSuccess();render();return;}
 if((field==="start"&&!row.end)||(field==="end"&&!row.start)){row[field]=parsed;const companion=field==="start"?"end":"start",next=field==="start"?timeAfter(row.start,durationValue(row.duration)):timeBefore(row.end,durationValue(row.duration)),direct={rowId:row.id,field},context={kind:"companion",field,operation:"補齊時間"};const ownConflict=setTimeValue(row,companion,next,"補齊時間",direct);if(ownConflict)return preserveDirectConflict(backup,row.id,field,parsed,ownConflict,context);const conflict=cascadeFrom(index,"補齊時間",direct);if(conflict)return preserveDirectConflict(backup,row.id,field,parsed,conflict,context);clearConflictsAfterSuccess();render();return;}
 const options=timeOptions(row,index,field);if(!options.length){showToast("目前鎖定條件下無法調整此欄位");renderDay();return;}
 if(options.length===1){const reason=lockedField?"因為此行程的「"+fieldLabel(lockedField)+"」已鎖定，幫您"+options[0].text:"幫您"+options[0].text;return executeTimeOption(row,index,field,parsed,options[0],reason);}
 const subject=String(row.content||"").trim()?"「"+row.content.trim()+"」":"此行程",question=subject+"的「"+fieldLabel(field)+"」已修改，您希望如何調整？";
 openDialog(question,"",options.map(option=>({text:option.text,cls:"minor",run:()=>executeTimeOption(row,index,field,parsed,option)})).concat([{text:"取消",cls:"",actionClass:"dialog-cancel",run:()=>renderDay()}]),{dialogClass:"time-option-dialog",actionsClass:"time-option-actions",focusDialog:true});
}

/* 行程操作：新增、刪除、跨日期待放置與移入暫存。 */
/* 在第一筆正式行程前新增預設時長行程，必要時以循環時間往前推算。 */
function addRow(){
 const rows=activeRows(),backup=structuredClone(activeRows()),first=rows.find(r=>!r.pending);let start="",end="";
 if(first&&first.start){end=first.start;start=timeBefore(end,60);}
 const newRow=makeRow(state.activeDate,start,end,60,"","");newRow.isNew=true;rows.unshift(newRow);if(start){const conflict=cascadeFrom(0,"新增行程");if(conflict){state.days[state.activeDate]=backup;recordConflict(conflict);render();presentOperationConflict(conflict);return;}}clearConflictsAfterSuccess();render();showToast("已新增行程");
}
/* 依行程列動作分派刪除、暫存、放置或跨日期移動。 */
function rowAction(area,id,action){
 const row=getRow(area,id);if(!row)return;
 if(action==="delete")return confirmDeleteRow(area,row);
 if(action==="stage")moveRowToStaging(row);
 if(action==="place")placePending(row);
 if(action==="move")chooseDate(target=>moveToDate(area,row,target));
}
/* 將正式行程移至暫存並重新串接來源日期，鎖定衝突時完整回復。 */
function moveRowToStaging(row){
 const list=activeRows(),index=list.indexOf(row);if(index<0)return;
 const backup=structuredClone(list);list.splice(index,1);row.start="";row.end="";row.date="";row.pending=false;row.lock="none";row.isNew=false;state.staging.push(row);
 const conflict=recalculateStructuralChain(Math.max(0,index-1),"移至暫存");if(conflict){state.staging.pop();state.days[state.activeDate]=backup;recordConflict(conflict);render();presentOperationConflict(conflict);return;}
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
function confirmDeleteRow(area,row){
 const detail=document.createElement("div"),intro=document.createElement("p"),item=document.createElement("div");
 intro.textContent="您確定要刪除以下行程嗎？";item.className="delete-confirm-item";item.textContent=(row.start||"—")+" ~ "+(row.end||"—")+" : "+(row.content||"(無內容)");detail.append(intro,item);
 openDialog("確認刪除行程",detail,[{text:"刪除",cls:"danger",run:()=>{const list=getList(area),index=list.indexOf(row),backup=area==="day"?structuredClone(list):null;list.splice(index,1);if(area==="day"){const conflict=recalculateStructuralChain(Math.max(0,index-1),"刪除行程");if(conflict){state.days[state.activeDate]=backup;recordConflict(conflict);render();presentOperationConflict(conflict);return;}}clearConflictsAfterSuccess();render();showToast("行程已刪除，時間自動串聯完成");}},{text:"取消",cls:""}]);
}
/* 顯示鎖定衝突的所需值與回復結果，關閉後仍保留黃／紅提示。 */
function openConflictModal(conflict,direct){const locked=getRow("day",conflict.lockedRowId),item=locked&&locked.content?"「"+locked.content+"」":"此行程";const content=document.createElement("div"),messageLine=document.createElement("p"),detail=document.createElement("p"),hint=document.createElement("p");messageLine.className="conflict-message";messageLine.textContent=conflict.insufficientDuration?"無法完成「"+conflict.operation+"」："+item+"的總時長不足，調整後會成為 "+conflict.requiredValue+" 分鐘。":"無法完成「"+conflict.operation+"」："+item+"的「"+fieldLabel(conflict.lockedField)+"」已鎖定。";detail.textContent=conflict.insufficientDuration?"請調整相鄰行程的總時長或本次輸入時間。":"此欄目前為 "+(conflict.lockedValue||"空白")+"，要維持時間串接必須改為 "+(conflict.requiredValue||"指定值")+"。";hint.className="conflict-hint";hint.textContent=direct?"已保留修改的欄位資訊，時間連動已復原，提示將保留直到衝突解決。":"本次操作已復原；提示將保留，直到衝突確實解決。";content.append(messageLine,detail,hint);openDialog("⚠️ 行程時間衝突警告",content,[{text:"我知道了",cls:"danger",run:()=>render()}]);}
/* 以統一鎖定衝突燈箱提示會回復操作的行程動作。 */
function presentOperationConflict(conflict){openConflictModal(conflict);}
/* 移出目前日期前先重新串接來源日期；遇鎖定衝突則完整回復移動。 */
function moveToDate(area,row,targetDate){
 if(!validDate(targetDate))return;
 const stateBackup=structuredClone(state);
 if(!state.dates.includes(targetDate)){state.dates.push(targetDate);state.days[targetDate]=[];}
 const list=area==="staging"?state.staging:activeRows(),index=list.indexOf(row),backup=area==="day"?structuredClone(list):null;if(index>=0)list.splice(index,1);
 if(area==="day"){const conflict=recalculateStructuralChain(Math.max(0,index-1),"移至其他日期");if(conflict){state=stateBackup;recordConflict(conflict);render();openConflictModal(conflict);return;}}
 row.date=targetDate;row.pending=true;row.lock="none";row.isNew=false;state.days[targetDate].push(row);state.activeDate=targetDate;activeCalendarMonth=calendarMonthFor(targetDate);clearConflictsAfterSuccess();render();showToast("行程已移至 "+dateLabel(targetDate)+"，確認位置後按「放置此處」");
}
/* 試算放置待確認行程；可選擇只調整一筆候選時長，失敗時不保存衝突。 */
function tryPlacePending(rowId,candidateId,duration){
 const rows=activeRows(),row=rows.find(item=>item.id===rowId);if(!row)return{conflict:null};const index=rows.indexOf(row),candidate=candidateId&&rows.find(item=>item.id===candidateId);if(candidate)candidate.duration=duration;
 const previous=rows.slice(0,index).reverse().find(item=>!item.pending&&item.end),next=rows.slice(index+1).find(item=>!item.pending&&item.start);row.pending=false;
 if(previous){row.start=previous.end;row.end=timeAfter(row.start,durationValue(row.duration));}
 else if(next){row.end=next.start;row.start=timeBefore(row.end,durationValue(row.duration));}
 else{row.start="";row.end="";}
 return{conflict:!row.start&&!row.end?null:recalculateStructuralChain(index,"放置待放置行程")};
}
/* 找出只調整指定候選一筆時長即可符合所有時間鎖定的唯一循環時長。 */
function pendingDurationTarget(before,rowId,candidateId){
 const original=state.days[state.activeDate],candidate=before.find(item=>item.id===candidateId);if(!candidate||candidate.lock==="duration")return null;
 const current=durationValue(candidate.duration),currentTrial=structuredClone(before);state.days[state.activeDate]=currentTrial;const currentResult=tryPlacePending(rowId,candidateId,current);state.days[state.activeDate]=original;if(!currentResult.conflict)return current;
 const residues=[];
 for(let duration=0;duration<1440;duration++){const trial=structuredClone(before);state.days[state.activeDate]=trial;const result=tryPlacePending(rowId,candidateId,duration);state.days[state.activeDate]=original;if(!result.conflict)residues.push(duration);}
 const candidates=residues.map(duration=>duration+Math.floor((current-1-duration)/1440)*1440).filter(duration=>duration>=0&&duration<current);return candidates.length?Math.max(...candidates):null;
}
/* 顯示可單獨吸收待放置衝突的行程選擇，並即時預覽原／新分鐘數。 */
function openPendingDurationDialog(row,before){
 const candidates=before.filter(item=>!item.pending&&item.lock!=="duration").concat(before.find(item=>item.id===row.id)).filter(Boolean).map(item=>({row:item,target:pendingDurationTarget(before,row.id,item.id)})).filter(item=>item.target!==null),displayName=value=>value.length>20?value.slice(0,20)+"...":value,locked=before.filter(item=>!item.pending&&["start","end"].includes(item.lock)),cause=locked.length?"由於"+locked.map(item=>"「"+displayName(String(item.content||"").trim()||"此行程")+"」的「"+fieldLabel(item.lock)+"」").join("及")+"已鎖定，造成時間衝突。":"造成時間衝突。";
 if(!candidates.length){state.days[state.activeDate]=before;render();openDialog("時間衝突",cause+"目前沒有一筆行程能單獨調整總時長並同時保留所有開始／結束時間鎖定。",[{text:"取消放置",cls:"",run:()=>render()}]);return;}
 state.days[state.activeDate]=before;const content=document.createElement("div"),reason=document.createElement("p"),adjustment=document.createElement("p"),wheel=document.createElement("div"),suffix=document.createElement("span"),preview=document.createElement("p");let selected=0,dragStart=null,dragging=false;content.className="pending-duration-content";reason.className="pending-duration-reason";reason.textContent="由於";locked.forEach((item,index)=>{const part=document.createElement("span"),connector=document.createElement("span");part.className="pending-duration-lock";part.textContent="「"+displayName(String(item.content||"").trim()||"此行程")+"」的「"+fieldLabel(item.lock)+"」";connector.textContent=index===locked.length-1?"已鎖定，造成時間衝突。":"及";reason.append(part,connector);});adjustment.className="pending-duration-adjustment";adjustment.textContent="請調整 ";suffix.textContent=" 時長，以便放置行程。";preview.className="pending-duration-result";wheel.className="pending-duration-wheel";wheel.tabIndex=0;wheel.setAttribute("role","listbox");
 const select=index=>{selected=Math.max(0,Math.min(candidates.length-1,index));[...wheel.children].forEach((item,itemIndex)=>{item.classList.toggle("selected",itemIndex===selected);item.setAttribute("aria-selected",itemIndex===selected?"true":"false");});wheel.scrollTop=selected*34;const item=candidates[selected],fullName=String(item.row.content||"").trim()||"此行程",name=displayName(fullName);preview.title=fullName;preview.textContent="「"+name+"」總時長："+durationValue(item.row.duration)+" 分鐘 → "+item.target+" 分鐘。";};
 candidates.forEach((item,index)=>{const option=document.createElement("button"),fullName=String(item.row.content||"").trim()||"此行程",name=displayName(fullName);option.type="button";option.className="pending-duration-option";option.title=fullName;option.textContent=name;option.addEventListener("click",()=>select(index));wheel.append(option);});
 wheel.addEventListener("wheel",event=>{event.preventDefault();select(selected+(event.deltaY>0?1:-1));},{passive:false});wheel.addEventListener("pointerdown",event=>{dragStart=event.clientY;dragging=false;});wheel.addEventListener("pointermove",event=>{if(dragStart===null)return;const steps=Math.trunc((dragStart-event.clientY)/28);if(steps){if(!dragging){wheel.setPointerCapture?.(event.pointerId);dragging=true;}select(selected+steps);dragStart=event.clientY;}});wheel.addEventListener("pointerup",()=>{dragStart=null;dragging=false;});wheel.addEventListener("keydown",event=>{const keys={ArrowUp:-1,ArrowDown:1,Home:-selected,End:candidates.length-1-selected};if(!(event.key in keys))return;event.preventDefault();select(selected+keys[event.key]);});adjustment.append(wheel,suffix);content.append(reason,adjustment,preview);requestAnimationFrame(()=>select(0));
 openDialog("時間衝突",content,[{text:"套用調整",cls:"primary",run:()=>{const item=candidates[selected];state.days[state.activeDate]=structuredClone(before);const result=tryPlacePending(row.id,item.row.id,item.target);if(result.conflict){state.days[state.activeDate]=before;render();openDialog("時間衝突","目前條件已變更，請重新選擇放置方式。",[{text:"取消放置",cls:"",run:()=>render()}]);return;}clearConflictsAfterSuccess();render();showToast("已調整時長並放置行程");}},{text:"取消放置",cls:"",actionClass:"dialog-cancel",run:()=>{state.days[state.activeDate]=before;render();}}],{actionsClass:"pending-duration-actions"});
}
/* 將待放置行程接到相鄰正式時間鏈；無法維持原時長時改提供可行的單列時長選擇。 */
function placePending(row){
 const rows=activeRows(),index=rows.indexOf(row);if(index<0)return;const before=structuredClone(rows),result=tryPlacePending(row.id,"",null);
 if(result.conflict){state.days[state.activeDate]=before;openPendingDurationDialog(row,before);return;}
 clearConflictsAfterSuccess();render();showToast("行程已放置並加入時間連動");
}

/* 日期頁籤與日曆：已有日期可跳轉，空白日期可建立新頁籤。 */
function openCalendar(createMode){const pop=document.getElementById("calendarPopover");if(createMode){calendarCreateMode=true;pop.hidden=false;}else{calendarCreateMode=false;pop.hidden=!pop.hidden;}if(!pop.hidden)renderCalendar();}
function renderCalendar(){
 const title=document.getElementById("calendarMonth"),grid=document.getElementById("calendarGrid");if(!title||!grid)return;
 const year=activeCalendarMonth.getFullYear(),month=activeCalendarMonth.getMonth();title.textContent=year+" 年 "+(month+1)+" 月";grid.innerHTML="";
 ["日","一","二","三","四","五","六"].forEach(d=>{const el=document.createElement("span");el.className="weekday";el.textContent=d;grid.appendChild(el);});
 const first=new Date(year,month,1).getDay(),total=new Date(year,month+1,0).getDate();for(let i=0;i<first;i++)grid.appendChild(document.createElement("span"));
 for(let day=1;day<=total;day++){const date=year+"-"+String(month+1).padStart(2,"0")+"-"+String(day).padStart(2,"0"),btn=document.createElement("button");btn.type="button";btn.className="calendar-day "+(state.dates.includes(date)?"has-date":"no-date")+(date===state.activeDate?" selected":"");btn.textContent=day;btn.title=state.dates.includes(date)?"已有日期頁籤":"尚未建立日期";btn.disabled=!calendarCreateMode&&!state.dates.includes(date);btn.addEventListener("click",()=>{if(state.dates.includes(date)){state.activeDate=date;activeCalendarMonth=calendarMonthFor(date);persist();render();document.getElementById("calendarPopover").hidden=true;}else if(calendarCreateMode)openDateAction(date);});grid.appendChild(btn);}
}
function openDateAction(date){openDialog("建立日期頁籤？",dateLabel(date,true)+" 尚未建立行程頁籤。",[{text:"建立並前往",cls:"primary",run:()=>{state.dates.push(date);state.days[date]=[];state.activeDate=date;activeCalendarMonth=calendarMonthFor(date);persist();render();document.getElementById("calendarPopover").hidden=true;}},{text:"取消",cls:""}]);}
function chooseDate(callback){
 let month=calendarMonthFor(state.activeDate),selected=state.activeDate||"";
 const content=document.createElement("div");content.className="date-choice";const hint=document.createElement("p");hint.textContent="選擇已有日期，或選擇尚未建立的日期；新日期會自動建立頁籤。";
 const heading=document.createElement("div");heading.className="calendar-heading";const prev=document.createElement("button");prev.type="button";prev.textContent="‹";const title=document.createElement("strong");const next=document.createElement("button");next.type="button";next.textContent="›";heading.append(prev,title,next);
 const grid=document.createElement("div");grid.className="calendar-grid move-calendar-grid";const legend=document.createElement("div");legend.className="calendar-legend";legend.innerHTML='<span><i class="legend-has"></i>已有日期頁籤</span><span><i class="legend-none"></i>尚未建立</span>';
 const selection=document.createElement("p");selection.className="calendar-selection";
 function draw(){const year=month.getFullYear(),monthIndex=month.getMonth();title.textContent=year+" 年 "+(monthIndex+1)+" 月";grid.innerHTML="";["日","一","二","三","四","五","六"].forEach(d=>{const day=document.createElement("span");day.className="weekday";day.textContent=d;grid.appendChild(day);});const first=new Date(year,monthIndex,1).getDay(),total=new Date(year,monthIndex+1,0).getDate();for(let i=0;i<first;i++)grid.appendChild(document.createElement("span"));for(let day=1;day<=total;day++){const date=year+"-"+String(monthIndex+1).padStart(2,"0")+"-"+String(day).padStart(2,"0"),button=document.createElement("button");button.type="button";button.className="calendar-day "+(state.dates.includes(date)?"has-date":"no-date")+(selected===date?" selected":"");button.textContent=day;button.addEventListener("click",()=>{selected=date;selection.textContent="選取日期："+dateLabel(date,true);draw();});grid.appendChild(button);}selection.textContent=selected?"選取日期："+dateLabel(selected,true):"請選擇日期";}
 prev.addEventListener("click",()=>{month=new Date(month.getFullYear(),month.getMonth()-1,1);draw();});next.addEventListener("click",()=>{month=new Date(month.getFullYear(),month.getMonth()+1,1);draw();});draw();content.append(hint,heading,grid,legend,selection);
 openDialog("移至日期",content,[{text:"移至所選日期",cls:"primary",run:()=>callback(selected)},{text:"取消",cls:""}]);
}
function deleteDate(date=state.activeDate){if(!date)return;askConfirm("刪除日期頁籤","刪除 "+dateLabel(date,true)+" 與這一天的所有行程嗎？此操作無法復原。","刪除此日期",()=>{const idx=state.dates.indexOf(date);state.dates.splice(idx,1);delete state.days[date];if(state.activeDate===date)state.activeDate=state.dates[Math.min(idx,state.dates.length-1)]||"";if(state.activeDate)activeCalendarMonth=calendarMonthFor(state.activeDate);persist();render();});}

/* 現有類別顏色可以自訂，並納入自動保存及備份。 */
function renderCategories(){const root=document.getElementById("categoryColors");root.innerHTML="";state.categories.forEach(category=>{const label=document.createElement("label");label.className="category-color";const name=document.createElement("span");name.textContent=category.name;const input=document.createElement("input");input.type="color";input.value=category.color;input.setAttribute("aria-label",category.name+" 顏色");input.addEventListener("input",()=>{category.color=input.value;persist();renderDay();renderStaging();});label.append(name,input);root.appendChild(label);});}

/* JSON 匯入匯出保存完整日期、排序、暫存與類別顏色。 */
/* 重檢後回傳是否仍有必須阻擋匯出的未解決時間衝突。 */
function hasUnresolvedConflicts(){refreshConflicts();return state.conflicts.length>0;}
/* 無未解決衝突時才匯出包含目前資料與衝突狀態的 JSON 備份。 */
function exportJSON(){if(hasUnresolvedConflicts()){showToast("請先解決本次衝突再執行匯出");return;}downloadBlob(new Blob([JSON.stringify({app:"TickBrick",version:2,exportedAt:new Date().toISOString(),data:state},null,2)],{type:"application/json"}),"TickBrick_行程備份_"+todayString()+".json");}
function importJSON(file){const reader=new FileReader();reader.onload=()=>{try{const parsed=JSON.parse(reader.result),raw=parsed.data||parsed;if(!Array.isArray(raw)&&(!raw||typeof raw!=="object"||!Array.isArray(raw.dates)))throw new Error("format");const imported=normalizeState(raw);askConfirm("匯入並取代現有資料","匯入備份會取代目前所有日期、行程、暫存項目與類別顏色。確定繼續嗎？","取代並匯入",()=>{state=imported;if(state.activeDate)activeCalendarMonth=calendarMonthFor(state.activeDate);persist();render();showToast("備份匯入完成");});}catch(error){showToast("無法讀取此 JSON 行程備份");}};reader.readAsText(file,"UTF-8");}
function todayString(){return new Date().toISOString().slice(0,10);}
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
function dataUrlBlob(url){const bytes=atob(url.split(",")[1]),arr=new Uint8Array(bytes.length);for(let i=0;i<bytes.length;i++)arr[i]=bytes.charCodeAt(i);return new Blob([arr],{type:"image/png"});}
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
function binaryString(bytes){let value="";for(let i=0;i<bytes.length;i+=0x8000)value+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return value;}
/* 建立無壓縮 ZIP，包含各日圖片或 PDF。 */
const CRC_TABLE=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(bytes){let crc=0xffffffff;for(const b of bytes)crc=CRC_TABLE[(crc^b)&255]^(crc>>>8);return(crc^0xffffffff)>>>0;}
function zipFiles(files){
 const enc=new TextEncoder(),parts=[],central=[];let offset=0;
 files.forEach(file=>{const name=enc.encode(file.name),data=file.data instanceof Uint8Array?file.data:new Uint8Array(file.data),crc=crc32(data),local=new Uint8Array(30+name.length),v=new DataView(local.buffer);
  v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);local.set(name,30);parts.push(local,data);
  const c=new Uint8Array(46+name.length),cv=new DataView(c.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint32(16,crc,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);c.set(name,46);central.push(c);offset+=local.length+data.length;});
 const size=central.reduce((n,b)=>n+b.length,0),end=new Uint8Array(22),dv=new DataView(end.buffer);dv.setUint32(0,0x06054b50,true);dv.setUint16(8,files.length,true);dv.setUint16(10,files.length,true);dv.setUint32(12,size,true);dv.setUint32(16,offset,true);return new Blob([...parts,...central,end],{type:"application/zip"});
}

/* 建立共用對話框，並依選用設定套用專用排列與初始鍵盤焦點。 */
function openDialog(title,content,actions,options={}){
 const dialog=document.getElementById("appDialog");dialog.className="app-dialog"+(options.dialogClass?" "+options.dialogClass:"");dialog.toggleAttribute("tabindex",Boolean(options.focusDialog));document.getElementById("dialogTitle").textContent=title;const target=document.getElementById("dialogContent");target.replaceChildren();if(typeof content==="string")target.textContent=content;else target.appendChild(content);
 const buttons=document.getElementById("dialogActions");buttons.className="dialog-actions"+(options.actionsClass?" "+options.actionsClass:"");buttons.replaceChildren();actions.forEach(action=>{const button=document.createElement("button");button.type="button";button.className="button"+(action.cls?" "+action.cls:"")+(action.actionClass?" "+action.actionClass:"");button.textContent=action.text;button.addEventListener("click",()=>{dialog.close();if(action.run)action.run();});buttons.appendChild(button);});dialog.showModal();if(options.focusDialog)dialog.focus();
}
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
