/* 行程資料以日期分頁，並保存到目前瀏覽器的 localStorage。 */
const STORAGE_KEY = "tickbrick_trip_v1";
const LEGACY_KEY = "hokkaido_itinerary_v47";
const DEFAULT_CATEGORIES = [{name:"交通",color:"#E3F2FD"},{name:"逛街",color:"#FFFFFF"},{name:"景點",color:"#E8F5E9"},{name:"用餐",color:"#FFF3E0"}];
const INITIAL_ROWS = [
 ["06:30","07:30",60,"交通","➔ 桃園機場"],["07:30","09:30",120,"","辦理登機通關"],["09:30","13:05",215,"","Flight to SAPPORO (長榮 BR 116)"],
 ["13:05","14:30",85,"","抵達新千歲機場，辦理入境通關與提取行李"],["14:30","15:30",60,"交通","機場 ➔ 旅館（HELIO HOSTEL）"],
 ["15:30","16:00",30,"","旅館辦理 Check-in"],["16:00","18:00",120,"景點","北海道廳紅磚廳舍 ＆ 札幌市資料館"],
 ["18:00","19:00",60,"用餐","大通公園周邊湯咖哩"],["19:00","21:00",120,"逛街","東急百貨店(va、JOUETE)、BIC CAMERA"]
];
let state=loadState();
let activeCalendarMonth=state.activeDate?new Date(state.activeDate+"T12:00:00"):new Date(2026,9,1);
let draggedRow=null, autosaveTimer, calendarCreateMode=false;
let modifiedRowId=null, modifiedField=null, lockedConflictId=null;

function blankState(){return{version:1,dates:[],activeDate:"",days:{},staging:[],categories:DEFAULT_CATEGORIES.map(x=>({...x}))};}
function makeId(){return"r"+Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
function makeRow(date,start,end,duration,category,content){return{id:makeId(),date:date||"",start:start||"",end:end||"",duration:Number(duration)||60,lock:"none",category:category||"",content:content||"",pending:false};}
function loadState(){
 try{
  const current=localStorage.getItem(STORAGE_KEY);if(current)return normalizeState(JSON.parse(current));
  const legacy=localStorage.getItem(LEGACY_KEY);
  if(legacy){const migrated=blankState();JSON.parse(legacy).forEach(old=>{const date=old.date||"2026-10-29";if(!migrated.days[date]){migrated.days[date]=[];migrated.dates.push(date);}migrated.days[date].push({...old,id:old.id||makeId(),date,pending:false});});migrated.dates.sort();migrated.activeDate=migrated.dates[0]||"";localStorage.setItem(STORAGE_KEY,JSON.stringify(migrated));return migrated;}
 }catch(error){console.error("行程資料讀取失敗",error);}
 const initial=blankState(),date="2026-10-29";initial.dates=[date];initial.activeDate=date;initial.days[date]=INITIAL_ROWS.map(r=>makeRow(date,...r));return initial;
}
function normalizeState(input){
 const result=blankState();
 if(Array.isArray(input)){input.forEach(row=>{const date=row.date||"2026-10-29";if(!result.days[date]){result.days[date]=[];result.dates.push(date);}result.days[date].push({...row,id:row.id||makeId(),date,pending:false});});result.dates.sort();result.activeDate=result.dates[0]||"";return result;}
 result.version=input.version||1;result.dates=Array.isArray(input.dates)?[...new Set(input.dates.filter(validDate))]:[];
 result.activeDate=result.dates.includes(input.activeDate)?input.activeDate:(result.dates[0]||"");
 result.dates.forEach(date=>result.days[date]=Array.isArray(input.days&&input.days[date])?input.days[date].map(row=>({...row,id:row.id||makeId(),date,pending:!!row.pending})):[]);
 result.staging=Array.isArray(input.staging)?input.staging.map(row=>({...row,id:row.id||makeId(),date:"",start:"",end:"",pending:false})):[];
 result.categories=Array.isArray(input.categories)?input.categories.map(c=>({name:String(c.name),color:/^#[0-9a-f]{6}$/i.test(c.color)?c.color:"#FFFFFF"})):DEFAULT_CATEGORIES.map(c=>({...c}));
 DEFAULT_CATEGORIES.forEach(def=>{if(!result.categories.some(c=>c.name===def.name))result.categories.push({...def});});return result;
}
function validDate(value){return/^\d{4}-\d{2}-\d{2}$/.test(value)&&!isNaN(new Date(value+"T12:00:00").getTime());}
function saveState(data){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data||state));}catch(error){console.error("自動保存失敗",error);showToast("瀏覽器儲存空間不足，請先匯出 JSON 備份");}}
function persist(){clearTimeout(autosaveTimer);autosaveTimer=setTimeout(()=>saveState(),120);}
function esc(value){return String(value==null?"":value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function dateLabel(value,year){if(!value)return"";const d=new Date(value+"T12:00:00"),w=["日","一","二","三","四","五","六"];return(year?d.getFullYear()+"/":"")+String(d.getMonth()+1).padStart(2,"0")+"/"+String(d.getDate()).padStart(2,"0")+"（"+w[d.getDay()]+"）";}
function showToast(message){const toast=document.getElementById("toast");toast.textContent=message;toast.classList.add("show");clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.remove("show"),2100);}
function activeRows(){return state.days[state.activeDate]||[];}

/* 繪製日期頁籤、當日清單、共用暫存區與類別色彩設定。 */
function render(){renderTabs();renderDay();renderStaging();renderCategories();renderCalendar();}
function renderTabs(){
 const root=document.getElementById("dateTabs");root.innerHTML="";
 state.dates.forEach((date,index)=>{const tab=document.createElement("button");tab.type="button";tab.className="date-tab"+(date===state.activeDate?" active":"");tab.textContent=dateLabel(date);tab.setAttribute("role","tab");tab.setAttribute("aria-selected",date===state.activeDate?"true":"false");tab.draggable=true;tab.dataset.date=date;
  tab.addEventListener("click",()=>{state.activeDate=date;activeCalendarMonth=new Date(date+"T12:00:00");persist();render();});
  tab.addEventListener("dragstart",e=>{draggedRow={type:"tab",index};e.dataTransfer.effectAllowed="move";});
  tab.addEventListener("dragover",e=>{if(draggedRow&&draggedRow.type==="tab")e.preventDefault();});
  tab.addEventListener("drop",e=>{e.preventDefault();if(!draggedRow||draggedRow.type!=="tab")return;const from=draggedRow.index,item=state.dates.splice(from,1)[0];state.dates.splice(index,0,item);draggedRow=null;persist();renderTabs();});root.appendChild(tab);
 });
}
function renderDay(){
 const rows=activeRows();document.getElementById("activeDateTitle").textContent=state.activeDate?dateLabel(state.activeDate,true):"尚未建立日期";
 document.getElementById("daySummary").textContent=rows.length?rows.length+" 項行程":"尚無行程";document.getElementById("emptyDay").hidden=rows.length>0;
 document.getElementById("addRowButton").disabled=!state.activeDate;
 const root=document.getElementById("tableBody");root.innerHTML=rows.map((row,index)=>rowMarkup(row,index,"day")).join("");document.getElementById("deleteDateButton").disabled=!state.activeDate;bindRows(root,"day");
}
function renderStaging(){
 const root=document.getElementById("stagingBody");document.getElementById("stagingCount").textContent=state.staging.length+" 項";document.getElementById("emptyStaging").hidden=state.staging.length>0;
 root.innerHTML=state.staging.map((row,index)=>rowMarkup(row,index,"staging")).join("");bindRows(root,"staging");
}
function categoryOptions(value){return'<option value="">未分類</option>'+state.categories.map(c=>'<option value="'+esc(c.name)+'" '+(value===c.name?"selected":"")+'>'+esc(c.name)+'</option>').join("");}
function rowMarkup(row,index,area){
 const color=(state.categories.find(c=>c.name===row.category)||{}).color||"#FFFFFF",pending=!!row.pending;
 const rowClass=["schedule-row",pending?"pending-row":"",area==="day"&&row.isNew?"new-row-highlight":"",lockedConflictId===row.id?"conflict-highlight":""].filter(Boolean).join(" ");
 const inputClass=field=>modifiedRowId===row.id&&modifiedField===field?" conflict-field-highlight":"";
 const lockButton=field=>'<button class="lock-btn '+(row.lock===field?"locked":"")+'" data-lock="'+field+'" title="鎖定'+({start:"開始時間",end:"結束時間",duration:"總時長"}[field])+'">'+(row.lock===field?"🔒":"🔓")+'</button>';
 const editDisabled=area==="staging"||pending;
 return'<tr class="'+rowClass+'" draggable="true" data-id="'+esc(row.id)+'" data-index="'+index+'" data-area="'+area+'">'+
 '<td class="order-cell"><span class="drag-handle" title="拖曳調整順序">⠿</span>'+(pending?'<span class="pending-tag">待放置</span>':"")+'</td>'+
 '<td><div class="time-cell"><input type="text" class="time-input'+inputClass("start")+'" aria-label="開始時間" value="'+esc(row.start)+'" placeholder="HH:MM" '+(editDisabled||row.lock==="start"?"disabled":"")+' data-field="start">'+(area==="day"?lockButton("start"):"")+'</div></td>'+
 '<td><div class="time-cell"><input type="text" class="time-input'+inputClass("end")+'" aria-label="結束時間" value="'+esc(row.end)+'" placeholder="HH:MM" '+(editDisabled||row.lock==="end"?"disabled":"")+' data-field="end">'+(area==="day"?lockButton("end"):"")+'</div></td>'+
 '<td><div class="duration-cell"><input type="number" class="duration-input'+inputClass("duration")+'" min="1" value="'+esc(row.duration)+'" aria-label="總時長（分鐘）" '+(pending||row.lock==="duration"?"disabled":"")+' data-field="duration"><span>分鐘</span>'+(area==="day"?lockButton("duration"):"")+'</div></td>'+
 '<td><select class="category-select" aria-label="類別" style="background-color:'+color+'" data-field="category">'+categoryOptions(row.category)+'</select></td>'+
 '<td><input class="content-input" type="text" aria-label="行程內容" value="'+esc(row.content)+'" placeholder="輸入行程內容" data-field="content"></td>'+
 '<td class="row-actions">'+(area==="day"?(pending?'<button class="button small primary" data-action="place">放置此處</button><button class="button small secondary" data-action="stage">移至暫存</button>':'<button class="button small secondary" data-action="move">移至日期</button><button class="button small secondary" data-action="stage">移至暫存</button>'):'<button class="button small secondary" data-action="move">移至日期</button>')+'</td>'+
 '<td><button class="icon-button" data-action="delete" aria-label="刪除行程">×</button></td></tr>';
}
function bindRows(root,area){
 root.querySelectorAll("tr[data-id]").forEach(tr=>{const row=getRow(area,tr.dataset.id);
  tr.addEventListener("focusin",()=>{if(row.isNew){row.isNew=false;tr.classList.remove("new-row-highlight");persist();}});
  tr.addEventListener("dragstart",e=>{if(e.target.closest("input,select,button")){e.preventDefault();return;}draggedRow={type:"row",area,id:row.id};e.dataTransfer.effectAllowed="move";});
  tr.addEventListener("dragover",e=>{if(draggedRow&&draggedRow.type==="row"&&draggedRow.area===area){e.preventDefault();tr.classList.add("drag-over");}});
  tr.addEventListener("dragleave",()=>tr.classList.remove("drag-over"));
  tr.addEventListener("drop",e=>{e.preventDefault();tr.classList.remove("drag-over");reorderRow(area,draggedRow&&draggedRow.id,row.id);});
  tr.querySelectorAll("[data-field]").forEach(input=>input.addEventListener("change",()=>{
   const field=input.dataset.field;
   if(area==="day"&&!row.pending&&["start","end","duration"].includes(field))handleTimeEdit(row.id,field,input.value);
   else updateRow(area,row.id,field,input.value);
  }));
  tr.querySelectorAll("[data-lock]").forEach(button=>button.addEventListener("click",()=>{row.lock=row.lock===button.dataset.lock?"none":button.dataset.lock;persist();renderDay();renderStaging();}));
  tr.querySelector(".category-select").addEventListener("change",e=>e.currentTarget.style.backgroundColor=(state.categories.find(c=>c.name===e.currentTarget.value)||{}).color||"#fff");
  tr.querySelectorAll("[data-action]").forEach(button=>button.addEventListener("click",()=>rowAction(area,row.id,button.dataset.action)));
 });
}
function getList(area){return area==="staging"?state.staging:activeRows();}
function getRow(area,id){return getList(area).find(r=>r.id===id);}
function updateRow(area,id,field,value){
 const row=getRow(area,id);if(!row)return;
 const backup=area==="day"?structuredClone(activeRows()):null;
 if(row.lock===field){showToast("此欄位已鎖定，請先解除鎖定");render();return;}
 if(field==="duration"){row.duration=Math.max(1,Number(value)||1);if(!row.pending&&row.start)row.end=minToTime(timeToMin(row.start)+row.duration);}
 else if(field==="start"||field==="end"){row[field]=formatTime(value);if(row.start&&row.end)row.duration=durationBetween(row.start,row.end);}
 else row[field]=value;
 if(!row.pending&&area==="day"&&(field==="start"||field==="duration"||field==="end")){const error=cascadeFrom(activeRows().indexOf(row));if(error){state.days[state.activeDate]=backup;showToast(error);}}
 persist();renderDay();renderStaging();
}
function reorderRow(area,fromId,toId){
 if(!fromId||fromId===toId)return;const list=getList(area),from=list.findIndex(r=>r.id===fromId),to=list.findIndex(r=>r.id===toId);if(from<0||to<0)return;
 modifiedRowId=null;modifiedField=null;lockedConflictId=null;
 const backup=structuredClone(list),row=list.splice(from,1)[0];list.splice(to,0,row);
 if(area==="day"){const error=cascadeFrom(Math.min(from,to));if(error){state.days[state.activeDate]=backup;modifiedRowId=fromId;draggedRow=null;persist();render();openConflictModal(error);return;}}
 draggedRow=null;persist();render();if(area==="day")showToast("排序已更新，時間自動串聯完成");
}
function cascadeFrom(index){
 const rows=activeRows();lockedConflictId=null;
 for(let i=Math.min(index,rows.length-1);i>0;i--){const current=rows[i],previous=rows[i-1];if(current.pending||previous.pending)break;if(!current.start)continue;
  if(previous.lock==="end"&&previous.end!==current.start){lockedConflictId=previous.id;return conflictMessage(previous,"end");}
  previous.end=current.start;
  if(previous.lock==="duration")previous.start=minToTime(timeToMin(previous.end)-Number(previous.duration||60));
  else if(previous.start)previous.duration=durationBetween(previous.start,previous.end);
 }
 for(let i=Math.max(0,index);i<rows.length;i++){const current=rows[i];if(current.pending)break;
  if(i===0){if(current.start&&current.duration)current.end=minToTime(timeToMin(current.start)+Number(current.duration));continue;}
  const previous=rows[i-1];if(previous.pending||!previous.end)break;
  const targetEnd=minToTime(timeToMin(previous.end)+Number(current.duration||60));
  if(current.lock==="start"&&current.start!==previous.end){lockedConflictId=current.id;return conflictMessage(current,"start");}
  if(current.lock==="end"&&current.end!==targetEnd){lockedConflictId=current.id;return conflictMessage(current,"end");}
  current.start=previous.end;if(current.lock==="end")current.duration=durationBetween(current.start,current.end);else current.end=targetEnd;
 }return"";
}
function conflictMessage(row,field){const item=row.content?"「"+row.content+"」":"行程項目",name={start:"開始時間",end:"結束時間",duration:"總時長"}[field];return item+" 的「"+name+"」已經被鎖定，無法被連動覆蓋，請重新確認。";}
function formatTime(value){let str=String(value||"").replace(/[^\d:]/g,"");if(!str)return"";let parts=str.includes(":")?str.split(":"):(str.length>2?[str.slice(0,-2),str.slice(-2)]:[str,"0"]);const h=Math.min(23,Math.max(0,Number(parts[0])||0)),m=Math.min(59,Math.max(0,Number(parts[1])||0));return String(h).padStart(2,"0")+":"+String(m).padStart(2,"0");}
function timeToMin(value){const p=String(value||"00:00").split(":");return Number(p[0])*60+Number(p[1]);}
function minToTime(value){const m=((Math.round(value)%1440)+1440)%1440;return String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0");}
function durationBetween(start,end){let d=timeToMin(end)-timeToMin(start);if(d<0)d+=1440;return d||1;}
function handleTimeEdit(id,field,value){
 modifiedRowId=null;modifiedField=null;lockedConflictId=null;
 const row=getRow("day",id);if(!row)return;if(row.lock===field){showToast("此欄位已鎖定，請先解除鎖定");renderDay();return;}
 const parsed=field==="duration"?Math.max(1,Number(value)||1):formatTime(value),rows=activeRows(),index=rows.indexOf(row),backup=structuredClone(rows);
 if(row.lock&&row.lock!=="none"){
  row[field]=parsed;
  let calculatedField="";
  if(row.lock==="start"){if(field==="end"){row.duration=durationBetween(row.start,row.end);calculatedField="總時長";}else if(field==="duration"){row.end=minToTime(timeToMin(row.start)+Number(row.duration));calculatedField="結束時間";}}
  else if(row.lock==="end"){if(field==="start"){row.duration=durationBetween(row.start,row.end);calculatedField="總時長";}else if(field==="duration"){row.start=minToTime(timeToMin(row.end)-Number(row.duration));calculatedField="開始時間";}}
  else if(row.lock==="duration"){if(field==="start"){row.end=minToTime(timeToMin(row.start)+Number(row.duration));calculatedField="結束時間";}else if(field==="end"){row.start=minToTime(timeToMin(row.end)-Number(row.duration));calculatedField="開始時間";}}
  return finishTimeEdit(row,index,backup,field,calculatedField);
 }
 if(!row.start&&!row.end){row[field]=parsed;if(field==="start"&&row.start)row.end=minToTime(timeToMin(row.start)+Number(row.duration||60));if(field==="end"&&row.end)row.start=minToTime(timeToMin(row.end)-Number(row.duration||60));persist();render();return;}
 if(field==="start"&&!row.end){row.start=parsed;row.end=minToTime(timeToMin(row.start)+Number(row.duration||60));return finishTimeEdit(row,index,backup,field,"結束時間");}
 if(field==="end"&&!row.start){row.end=parsed;row.start=minToTime(timeToMin(row.end)-Number(row.duration||60));return finishTimeEdit(row,index,backup,field,"開始時間");}
 const question=field==="start"?"開始時間已修改，請選擇要固定的欄位。":field==="end"?"結束時間已修改，請選擇要固定的欄位。":"總時長已修改，請選擇要固定的欄位。";
 const options=field==="start"?[
  {text:"總時長不變，推算結束時間",calculated:"結束時間",cls:"primary",apply:()=>{row.start=parsed;row.end=minToTime(timeToMin(row.start)+Number(row.duration||60));}},
  {text:"結束時間不變，推算總時長",calculated:"總時長",cls:"secondary",apply:()=>{row.start=parsed;row.duration=durationBetween(row.start,row.end);}}
 ]:field==="end"?[
  {text:"總時長不變，推算開始時間",calculated:"開始時間",cls:"primary",apply:()=>{row.end=parsed;row.start=minToTime(timeToMin(row.end)-Number(row.duration||60));}},
  {text:"開始時間不變，推算總時長",calculated:"總時長",cls:"secondary",apply:()=>{row.end=parsed;row.duration=durationBetween(row.start,row.end);}}
 ]:[
  {text:"開始時間不變，推算結束時間",calculated:"結束時間",cls:"primary",apply:()=>{row.duration=parsed;row.end=minToTime(timeToMin(row.start)+Number(row.duration));}},
  {text:"結束時間不變，推算開始時間",calculated:"開始時間",cls:"secondary",apply:()=>{row.duration=parsed;row.start=minToTime(timeToMin(row.end)-Number(row.duration));}}
 ];
 openDialog(question,question,options.map(option=>({text:option.text,cls:option.cls,run:()=>{option.apply();finishTimeEdit(row,index,backup,field,option.calculated);}})).concat([{text:"取消",cls:"secondary",run:()=>renderDay()}]));
}
function finishTimeEdit(row,index,backup,field,calculatedField){modifiedRowId=row.id;modifiedField=field;const error=cascadeFrom(index);if(error){state.days[state.activeDate]=backup;}else{modifiedRowId=null;modifiedField=null;persist();}render();if(error)openConflictModal(error);else if(calculatedField)showToast(calculatedField+"已修正");}

/* 行程操作：新增、刪除、跨日期待放置與移入暫存。 */
function addRow(){
 const rows=activeRows(),backup=structuredClone(activeRows()),first=rows.find(r=>!r.pending);let start="",end="";
 if(first&&first.start){end=first.start;start=minToTime(timeToMin(end)-60);}
 const newRow=makeRow(state.activeDate,start,end,60,"","");newRow.isNew=true;rows.unshift(newRow);if(start){const error=cascadeFrom(0);if(error){state.days[state.activeDate]=backup;modifiedRowId=newRow.id;modifiedField=null;render();openConflictModal(error);return;}}persist();render();showToast("已新增行程");
}
function rowAction(area,id,action){
 const row=getRow(area,id);if(!row)return;
 if(action==="delete")return confirmDeleteRow(area,row);
 if(action==="stage"){const list=getList(area),index=list.indexOf(row),backup=area==="day"?structuredClone(list):null;list.splice(index,1);row.start="";row.end="";row.date="";row.pending=false;row.lock="none";row.isNew=false;state.staging.push(row);if(area==="day"){const error=cascadeFrom(Math.max(0,index-1));if(error){state.staging.pop();state.days[state.activeDate]=backup;modifiedRowId=null;modifiedField=null;render();openConflictModal(error);return;}}persist();render();}
 if(action==="place")placePending(row);
 if(action==="move")chooseDate(target=>moveToDate(area,row,target));
}
function confirmDeleteRow(area,row){
 const detail=document.createElement("div"),intro=document.createElement("p"),item=document.createElement("div");
 intro.textContent="您確定要刪除以下行程嗎？";item.className="delete-confirm-item";item.textContent=(row.start||"—")+" ~ "+(row.end||"—")+" : "+(row.content||"(無內容)");detail.append(intro,item);
 openDialog("確認刪除行程",detail,[{text:"刪除",cls:"danger",run:()=>{const list=getList(area),index=list.indexOf(row),backup=area==="day"?structuredClone(list):null;list.splice(index,1);if(area==="day"){const error=cascadeFrom(Math.max(0,index-1));if(error){state.days[state.activeDate]=backup;modifiedRowId=null;modifiedField=null;render();openConflictModal(error);return;}}persist();render();showToast("行程已刪除，時間自動串聯完成");}},{text:"取消",cls:"secondary"}]);
}
function openConflictModal(message){
 const content=document.createElement("div"),messageLine=document.createElement("p"),hint=document.createElement("p");
 messageLine.className="conflict-message";messageLine.textContent=message;
 hint.className="conflict-hint";hint.textContent="系統已復原至修改前的狀態。黃色欄位是剛剛修改的欄位；紅框列是發生鎖定衝突的行程。";
 content.append(messageLine,hint);openDialog("⚠️ 行程時間衝突警告",content,[{text:"我知道了",cls:"danger",run:()=>{modifiedRowId=null;modifiedField=null;lockedConflictId=null;render();}}]);
}
function moveToDate(area,row,targetDate){
 if(!validDate(targetDate))return;
 if(!state.dates.includes(targetDate)){state.dates.push(targetDate);state.days[targetDate]=[];}
 const list=area==="staging"?state.staging:activeRows(),index=list.indexOf(row),backup=area==="day"?structuredClone(list):null;if(index>=0)list.splice(index,1);
 if(area==="day"){const error=cascadeFrom(Math.max(0,index-1));if(error){state.days[state.activeDate]=backup;modifiedRowId=null;modifiedField=null;render();openConflictModal(error);return;}}
 row.date=targetDate;row.pending=true;row.lock="none";row.isNew=false;state.days[targetDate].push(row);state.activeDate=targetDate;activeCalendarMonth=new Date(targetDate+"T12:00:00");persist();render();showToast("行程已移至 "+dateLabel(targetDate)+"，確認位置後按「放置此處」");
}
function placePending(row){
 const rows=activeRows(),index=rows.indexOf(row);if(index<0)return;const before=structuredClone(rows);
 const previous=rows.slice(0,index).reverse().find(r=>!r.pending&&r.end),next=rows.slice(index+1).find(r=>!r.pending&&r.start);row.pending=false;
 if(previous){row.start=previous.end;row.end=minToTime(timeToMin(row.start)+Number(row.duration||60));}
 else if(next){row.end=next.start;row.start=minToTime(timeToMin(row.end)-Number(row.duration||60));}
 else{row.start="";row.end="";}
 const error=cascadeFrom(index);if(error){state.days[state.activeDate]=before;modifiedRowId=row.id;modifiedField=null;render();openConflictModal(error);return;}
 persist();render();showToast("行程已放置並加入時間連動");
}

/* 日期頁籤與日曆：已有日期可跳轉，空白日期可建立新頁籤。 */
function openCalendar(createMode){const pop=document.getElementById("calendarPopover");if(createMode){calendarCreateMode=true;pop.hidden=false;}else{calendarCreateMode=false;pop.hidden=!pop.hidden;}if(!pop.hidden)renderCalendar();}
function renderCalendar(){
 const title=document.getElementById("calendarMonth"),grid=document.getElementById("calendarGrid");if(!title||!grid)return;
 const year=activeCalendarMonth.getFullYear(),month=activeCalendarMonth.getMonth();title.textContent=year+" 年 "+(month+1)+" 月";grid.innerHTML="";
 ["日","一","二","三","四","五","六"].forEach(d=>{const el=document.createElement("span");el.className="weekday";el.textContent=d;grid.appendChild(el);});
 const first=new Date(year,month,1).getDay(),total=new Date(year,month+1,0).getDate();for(let i=0;i<first;i++)grid.appendChild(document.createElement("span"));
 for(let day=1;day<=total;day++){const date=year+"-"+String(month+1).padStart(2,"0")+"-"+String(day).padStart(2,"0"),btn=document.createElement("button");btn.type="button";btn.className="calendar-day "+(state.dates.includes(date)?"has-date":"no-date")+(date===state.activeDate?" selected":"");btn.textContent=day;btn.title=state.dates.includes(date)?"已有日期頁籤":"尚未建立日期";btn.disabled=!calendarCreateMode&&!state.dates.includes(date);btn.addEventListener("click",()=>{if(state.dates.includes(date)){state.activeDate=date;persist();render();document.getElementById("calendarPopover").hidden=true;}else if(calendarCreateMode)openDateAction(date);});grid.appendChild(btn);}
}
function openDateAction(date){openDialog("建立日期頁籤？",dateLabel(date,true)+" 尚未建立行程頁籤。",[{text:"建立並前往",cls:"primary",run:()=>{state.dates.push(date);state.days[date]=[];state.activeDate=date;activeCalendarMonth=new Date(date+"T12:00:00");persist();render();document.getElementById("calendarPopover").hidden=true;}},{text:"取消",cls:"secondary"}]);}
function chooseDate(callback){
 let month=state.activeDate?new Date(state.activeDate+"T12:00:00"):new Date(),selected=state.activeDate||"";
 const content=document.createElement("div");content.className="date-choice";const hint=document.createElement("p");hint.textContent="選擇已有日期，或選擇尚未建立的日期；新日期會自動建立頁籤。";
 const heading=document.createElement("div");heading.className="calendar-heading";const prev=document.createElement("button");prev.type="button";prev.textContent="‹";const title=document.createElement("strong");const next=document.createElement("button");next.type="button";next.textContent="›";heading.append(prev,title,next);
 const grid=document.createElement("div");grid.className="calendar-grid move-calendar-grid";const legend=document.createElement("div");legend.className="calendar-legend";legend.innerHTML='<span><i class="legend-has"></i>已有日期頁籤</span><span><i class="legend-none"></i>尚未建立</span>';
 const selection=document.createElement("p");selection.className="calendar-selection";
 function draw(){const year=month.getFullYear(),monthIndex=month.getMonth();title.textContent=year+" 年 "+(monthIndex+1)+" 月";grid.innerHTML="";["日","一","二","三","四","五","六"].forEach(d=>{const day=document.createElement("span");day.className="weekday";day.textContent=d;grid.appendChild(day);});const first=new Date(year,monthIndex,1).getDay(),total=new Date(year,monthIndex+1,0).getDate();for(let i=0;i<first;i++)grid.appendChild(document.createElement("span"));for(let day=1;day<=total;day++){const date=year+"-"+String(monthIndex+1).padStart(2,"0")+"-"+String(day).padStart(2,"0"),button=document.createElement("button");button.type="button";button.className="calendar-day "+(state.dates.includes(date)?"has-date":"no-date")+(selected===date?" selected":"");button.textContent=day;button.addEventListener("click",()=>{selected=date;selection.textContent="選取日期："+dateLabel(date,true);draw();});grid.appendChild(button);}selection.textContent=selected?"選取日期："+dateLabel(selected,true):"請選擇日期";}
 prev.addEventListener("click",()=>{month.setMonth(month.getMonth()-1);draw();});next.addEventListener("click",()=>{month.setMonth(month.getMonth()+1);draw();});draw();content.append(hint,heading,grid,legend,selection);
 openDialog("移至日期",content,[{text:"移至所選日期",cls:"primary",run:()=>callback(selected)},{text:"取消",cls:"secondary"}]);
}
function addDateFromCalendar(){openCalendar(true);}
function deleteDate(){const date=state.activeDate;if(!date)return;askConfirm("刪除日期頁籤","刪除 "+dateLabel(date,true)+" 與這一天的所有行程嗎？此操作無法復原。","刪除此日期",()=>{const idx=state.dates.indexOf(date);state.dates.splice(idx,1);delete state.days[date];state.activeDate=state.dates[Math.min(idx,state.dates.length-1)]||"";if(state.activeDate)activeCalendarMonth=new Date(state.activeDate+"T12:00:00");persist();render();});}

/* 現有類別顏色可以自訂，並納入自動保存及備份。 */
function renderCategories(){const root=document.getElementById("categoryColors");root.innerHTML="";state.categories.forEach(category=>{const label=document.createElement("label");label.className="category-color";const name=document.createElement("span");name.textContent=category.name;const input=document.createElement("input");input.type="color";input.value=category.color;input.setAttribute("aria-label",category.name+" 顏色");input.addEventListener("input",()=>{category.color=input.value;persist();renderDay();renderStaging();});label.append(name,input);root.appendChild(label);});}

/* JSON 匯入匯出保存完整日期、排序、暫存與類別顏色。 */
function exportJSON(){downloadBlob(new Blob([JSON.stringify({app:"TickBrick",version:1,exportedAt:new Date().toISOString(),data:state},null,2)],{type:"application/json"}),"TickBrick_行程備份_"+todayString()+".json");}
function exportCSV(){const rows=state.dates.slice().sort().flatMap(date=>(state.days[date]||[]).map(row=>[date,row.start,row.end,row.duration,row.category,row.content]));const quote=value=>'"'+String(value==null?"":value).replace(/"/g,'""')+'"';const csv="\uFEFF日期,開始時間,結束時間,總時長,類別,行程內容\n"+rows.map(row=>row.map(quote).join(",")).join("\n");downloadBlob(new Blob([csv],{type:"text/csv;charset=utf-8"}),"TickBrick_行程_"+todayString()+".csv");}
function importJSON(file){const reader=new FileReader();reader.onload=()=>{try{const parsed=JSON.parse(reader.result),raw=parsed.data||parsed;if(!Array.isArray(raw)&&(!raw||typeof raw!=="object"||!Array.isArray(raw.dates)))throw new Error("format");const imported=normalizeState(raw);askConfirm("匯入並取代現有資料","匯入備份會取代目前所有日期、行程、暫存項目與類別顏色。確定繼續嗎？","取代並匯入",()=>{state=imported;if(state.activeDate)activeCalendarMonth=new Date(state.activeDate+"T12:00:00");persist();render();showToast("備份匯入完成");});}catch(error){showToast("無法讀取此 JSON 行程備份");}};reader.readAsText(file,"UTF-8");}
function todayString(){return new Date().toISOString().slice(0,10);}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}

/* 先選日期，再輸出每天獨立圖片或 PDF；多檔以 ZIP 下載。 */
function openExportDialog(kind){
 if(!state.dates.length){showToast("請先新增日期頁籤");return;}
 const content=document.createElement("div");content.className="export-options";const all=document.createElement("label");all.className="select-all";all.innerHTML='<input type="checkbox" checked> 選取全部日期';content.appendChild(all);
 const list=document.createElement("div");list.className="export-date-list";state.dates.slice().sort().forEach(date=>{const label=document.createElement("label");label.innerHTML='<input type="checkbox" value="'+date+'" checked> '+esc(dateLabel(date,true));list.appendChild(label);});content.appendChild(list);
 const allInput=all.querySelector("input");allInput.addEventListener("change",()=>list.querySelectorAll("input").forEach(i=>i.checked=allInput.checked));list.addEventListener("change",()=>allInput.checked=[...list.querySelectorAll("input")].every(i=>i.checked));
 if(kind==="pdf"){const mode=document.createElement("fieldset");mode.className="pdf-mode";mode.innerHTML='<legend>多日期 PDF 方式</legend><label><input type="radio" name="pdfMode" value="merged" checked> 合併成一份 PDF（一天至少一頁）</label><label><input type="radio" name="pdfMode" value="separate"> 每天一份 PDF（多份時打包 ZIP）</label>';content.appendChild(mode);}
 openDialog(kind==="image"?"匯出圖片":"匯出 PDF",content,[{text:"匯出所選日期",cls:"primary",run:()=>{const dates=[...list.querySelectorAll("input:checked")].map(i=>i.value);if(!dates.length){showToast("至少選擇一個日期");return;}if(kind==="image")exportImages(dates);else exportPdfs(dates,content.querySelector('input[name="pdfMode"]:checked').value);}},{text:"取消",cls:"secondary"}]);
}
function exportImages(dates){const files=dates.map(date=>({name:date+".png",data:dataUrlBytes(renderScheduleCanvas(date).toDataURL("image/png"))}));if(files.length===1)downloadBlob(new Blob([files[0].data],{type:"image/png"}),files[0].name);else downloadBlob(zipFiles(files),"TickBrick_圖片_"+dates[0]+"_"+dates[dates.length-1]+".zip");}
function exportPdfs(dates,mode){const ordered=dates.slice().sort();if(mode==="merged"){downloadBlob(buildPdf(ordered),"TickBrick_"+ordered[0]+"_"+ordered[ordered.length-1]+".pdf");return;}const files=ordered.map(date=>({name:date+".pdf",blob:buildPdf([date])}));if(files.length===1)downloadBlob(files[0].blob,files[0].name);else Promise.all(files.map(async f=>({name:f.name,data:new Uint8Array(await f.blob.arrayBuffer())}))).then(data=>downloadBlob(zipFiles(data),"TickBrick_PDF_"+ordered[0]+"_"+ordered[ordered.length-1]+".zip"));}
function renderScheduleCanvas(date,rowSubset,continuation){
 const rows=rowSubset||(state.days[date]||[]).filter(row=>!row.pending),measure=document.createElement("canvas").getContext("2d"),prepared=rows.map(row=>{const lines=wrapText(measure,row.content||"",28,520);return{row,lines,height:Math.max(90,lines.length*38+30)};}),contentHeight=prepared.reduce((sum,item)=>sum+item.height,0);
 const canvas=document.createElement("canvas");canvas.width=1240;canvas.height=Math.max(1754,261+contentHeight+70);const ctx=canvas.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.fillStyle="#263746";ctx.font="bold 44px sans-serif";ctx.fillText("行程樂高",80,100);ctx.font="28px sans-serif";ctx.fillStyle="#555";ctx.fillText(dateLabel(date,true)+(continuation?"（續）":""),80,150);
 let y=205;const left=70,w1=240,w2=240;ctx.fillStyle="#2c3e50";ctx.fillRect(left,y,1100,56);ctx.fillStyle="#fff";ctx.font="bold 23px sans-serif";ctx.fillText("時間／時長",left+14,y+37);ctx.fillText("類別",left+w1+14,y+37);ctx.fillText("行程內容",left+w1+w2+14,y+37);y+=56;
 prepared.forEach(({row,lines,height})=>{ctx.fillStyle=row.pending?"#fff7dd":"#fff";ctx.fillRect(left,y,1100,height);ctx.strokeStyle="#d9dee4";ctx.strokeRect(left,y,1100,height);
  ctx.fillStyle="#222";ctx.font="26px sans-serif";ctx.fillText(row.start&&row.end?row.start+"–"+row.end:"—",left+14,y+38);ctx.font="20px sans-serif";ctx.fillStyle="#666";ctx.fillText(row.duration+" 分鐘",left+14,y+68);
  ctx.fillStyle=(state.categories.find(c=>c.name===row.category)||{}).color||"#fff";ctx.fillRect(left+w1+8,y+10,110,height-20);ctx.fillStyle="#222";ctx.font="22px sans-serif";ctx.fillText(row.category||"未分類",left+w1+15,y+42);
  ctx.fillStyle="#222";ctx.font="26px sans-serif";lines.forEach((line,i)=>ctx.fillText(line,left+w1+w2+14,y+38+i*38));if(row.pending){ctx.fillStyle="#9a6700";ctx.font="18px sans-serif";ctx.fillText("待放置",left+1000,y+30);}y+=height;});return canvas;
}
function wrapText(ctx,text,size,width){ctx.font=size+"px sans-serif";const lines=[];let line="";for(const char of text){if(ctx.measureText(line+char).width>width&&line){lines.push(line);line=char;}else line+=char;}if(line||!lines.length)lines.push(line);return lines;}
function dataUrlBlob(url){const bytes=atob(url.split(",")[1]),arr=new Uint8Array(bytes.length);for(let i=0;i<bytes.length;i++)arr[i]=bytes.charCodeAt(i);return new Blob([arr],{type:"image/png"});}
function dataUrlBytes(url){const bytes=atob(url.split(",")[1]),arr=new Uint8Array(bytes.length);for(let i=0;i<bytes.length;i++)arr[i]=bytes.charCodeAt(i);return arr;}
function buildPdf(dates){
 const enc=new TextEncoder(),objects=[],offsets=[0];let body="%PDF-1.4\n";const add=o=>{objects.push(o);return objects.length;};
 const catalog=add(""),pages=add(""),pageIds=[];
 dates.forEach(date=>{const groups=rowsByPdfPage((state.days[date]||[]).filter(row=>!row.pending));groups.forEach((group,pageIndex)=>{const canvas=renderScheduleCanvas(date,group,pageIndex>0),raw=atob(canvas.toDataURL("image/jpeg",.92).split(",")[1]),bin=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bin[i]=raw.charCodeAt(i);
  const image=add({bin,dict:"<< /Type /XObject /Subtype /Image /Width "+canvas.width+" /Height "+canvas.height+" /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length "+bin.length+" >>"}),stream=enc.encode("q\n595 0 0 842 0 0 cm\n/Im0 Do\nQ\n");
  const content=add({bin:stream,dict:"<< /Length "+stream.length+" >>"});pageIds.push(add("<< /Type /Page /Parent "+pages+" 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 "+image+" 0 R >> >> /Contents "+content+" 0 R >>"));});});
 objects[catalog-1]="<< /Type /Catalog /Pages "+pages+" 0 R >>";objects[pages-1]="<< /Type /Pages /Kids ["+pageIds.map(x=>x+" 0 R").join(" ")+"] /Count "+pageIds.length+" >>";
 objects.forEach((obj,i)=>{offsets.push(body.length);body+=(i+1)+" 0 obj\n";if(typeof obj==="string")body+=obj+"\nendobj\n";else body+=obj.dict+"\nstream\n"+binaryString(obj.bin)+"\nendstream\nendobj\n";});
 const xref=body.length;body+="xref\n0 "+(objects.length+1)+"\n0000000000 65535 f \n";offsets.slice(1).forEach(off=>body+=String(off).padStart(10,"0")+" 00000 n \n");body+="trailer\n<< /Size "+(objects.length+1)+" /Root "+catalog+" 0 R >>\nstartxref\n"+xref+"\n%%EOF";const bytes=new Uint8Array(body.length);for(let i=0;i<body.length;i++)bytes[i]=body.charCodeAt(i)&255;return new Blob([bytes],{type:"application/pdf"});
}
function rowsByPdfPage(rows){
 if(!rows.length)return[[]];const measure=document.createElement("canvas").getContext("2d"),pages=[];let page=[],used=0;
 rows.forEach(row=>{const lines=wrapText(measure,row.content||"",28,520),height=Math.max(90,lines.length*38+30);if(page.length&&used+height>1450){pages.push(page);page=[];used=0;}page.push(row);used+=height;});if(page.length)pages.push(page);return pages;
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

/* 共用確認視窗。 */
function openDialog(title,content,actions){
 const dialog=document.getElementById("appDialog");document.getElementById("dialogTitle").textContent=title;const target=document.getElementById("dialogContent");target.replaceChildren();if(typeof content==="string")target.textContent=content;else target.appendChild(content);
 const buttons=document.getElementById("dialogActions");buttons.replaceChildren();actions.forEach(action=>{const button=document.createElement("button");button.type="button";button.className="button "+(action.cls||"secondary");button.textContent=action.text;button.addEventListener("click",()=>{dialog.close();if(action.run)action.run();});buttons.appendChild(button);});dialog.showModal();
}
function askConfirm(title,message,confirmText,onConfirm){openDialog(title,message,[{text:confirmText,cls:"danger",run:onConfirm},{text:"取消",cls:"secondary"}]);}

/* 連接畫面事件並首次繪製。 */
document.getElementById("addRowButton").addEventListener("click",addRow);
document.getElementById("addDateButton").addEventListener("click",addDateFromCalendar);
document.getElementById("deleteDateButton").addEventListener("click",deleteDate);
document.getElementById("calendarToggle").addEventListener("click",openCalendar);
document.getElementById("calendarPrev").addEventListener("click",()=>{activeCalendarMonth.setMonth(activeCalendarMonth.getMonth()-1);renderCalendar();});
document.getElementById("calendarNext").addEventListener("click",()=>{activeCalendarMonth.setMonth(activeCalendarMonth.getMonth()+1);renderCalendar();});
document.addEventListener("click",e=>{const pop=document.getElementById("calendarPopover");if(!pop.contains(e.target)&&!document.getElementById("calendarToggle").contains(e.target))pop.hidden=true;});
document.getElementById("exportJsonButton").addEventListener("click",exportJSON);
document.getElementById("exportCsvButton").addEventListener("click",exportCSV);
document.getElementById("importJsonButton").addEventListener("click",()=>document.getElementById("importFile").click());
document.getElementById("importFile").addEventListener("change",e=>{if(e.target.files[0])importJSON(e.target.files[0]);e.target.value="";});
document.getElementById("exportImageButton").addEventListener("click",()=>openExportDialog("image"));
document.getElementById("exportPdfButton").addEventListener("click",()=>openExportDialog("pdf"));
window.addEventListener("beforeunload",()=>saveState());
render();
