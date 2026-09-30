let itineraryData = [
            { date: "2026-10-29", start: "06:30", end: "07:30", duration: 60, lock: "none", baseline: { start: "06:30", end: "07:30", duration: 60 }, category: "交通", content: "➔ 桃園機場" },
            { date: "2026-10-29", start: "07:30", end: "09:30", duration: 120, lock: "none", baseline: { start: "07:30", end: "09:30", duration: 120 }, category: "", content: "辦理登機通關" },
            { date: "2026-10-29", start: "09:30", end: "13:05", duration: 215, lock: "none", baseline: { start: "09:30", end: "13:05", duration: 215 }, category: "", content: "Flight to SAPPORO (長榮 BR 116)" },
            { date: "2026-10-29", start: "13:05", end: "14:30", duration: 85, lock: "none", baseline: { start: "13:05", end: "14:30", duration: 85 }, category: "", content: "抵達新千歲機場，辦理入境通關與提取行李" },
            { date: "2026-10-29", start: "14:30", end: "15:30", duration: 60, lock: "none", baseline: { start: "14:30", end: "15:30", duration: 60 }, category: "交通", content: "機場 ➔ 旅館（HELIO HOSTEL）" },
            { date: "2026-10-29", start: "15:30", end: "16:00", duration: 30, lock: "none", baseline: { start: "15:30", end: "16:00", duration: 30 }, category: "", content: "旅館辦理 Check-in" },
            { date: "2026-10-29", start: "16:00", end: "18:00", duration: 120, lock: "none", baseline: { start: "16:00", end: "18:00", duration: 120 }, category: "景點", content: "北海道廳紅磚廳舍 ＆ 札幌市資料館" },
            { date: "2026-10-29", start: "18:00", end: "19:00", duration: 60, lock: "none", baseline: { start: "18:00", end: "19:00", duration: 60 }, category: "用餐", content: "大通公園周邊湯咖哩" },
            { date: "2026-10-29", start: "19:00", end: "21:00", duration: 120, lock: "none", baseline: { start: "19:00", end: "21:00", duration: 120 }, category: "逛街", content: "東急百貨店(va、JOUETE)、BIC CAMERA" }
        ];

        if (localStorage.getItem('hokkaido_itinerary_v47')) {
            itineraryData = JSON.parse(localStorage.getItem('hokkaido_itinerary_v47'));
            itineraryData.forEach(row => {
                if (!row.baseline) {
                    row.baseline = { start: row.start, end: row.end, duration: row.duration };
                }
            });
        }

        // 顯示短暫提示訊息。

        function showToast(message) {
            const toast = document.getElementById('toast');
            toast.innerText = message;
            toast.style.display = 'block';
            setTimeout(() => {
                toast.style.display = 'none';
            }, 2500);
        }

        // 將日期轉成月/日與星期的顯示格式。

        function formatDateDisplay(dateStr) {
            if (!dateStr) return "";
            let d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            let m = String(d.getMonth() + 1).padStart(2, '0');
            let day = String(d.getDate()).padStart(2, '0');
            let weekdays = ['日', '一', '二', '三', '四', '五', '六'];
            return `${m}/${day} (${weekdays[d.getDay()]})`;
        }

        // 正規化使用者輸入的時間字串。

        function formatTimeString(val) {
            if (!val) return "00:00";
            val = val.replace(/[^\d:]/g, '');
            if (!val.includes(':')) {
                if (val.length === 3) val = '0' + val;
                if (val.length === 4) {
                    val = val.slice(0, 2) + ':' + val.slice(2, 4);
                } else if (val.length <= 2) {
                    val = val.padStart(2, '0') + ':00';
                }
            }
            let parts = val.split(':');
            let h = parseInt(parts[0]) || 0;
            let m = parseInt(parts[1]) || 0;
            if (h > 23) h = 23;
            if (m > 59) m = 59;
            return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
        }

        let modifiedIndex = null;
        let modifiedField = null;
        let lockedConflictIndex = null;

        // 依目前行程資料重繪行程表格。

        function renderTable() {
            const tbody = document.getElementById('tableBody');
            tbody.innerHTML = '';

            itineraryData.forEach((item, index) => {
                let tr = document.createElement('tr');
                tr.className = 'draggable-row';

                // 如果是新增行程，加上標記樣式
                if (item.isNew) {
                    tr.classList.add('new-row-highlight');
                }

                // 只要使用者點擊新增行程的任何地方，就自動拔除標記
                tr.addEventListener('focusin', () => {
                    if (item.isNew) {
                        item.isNew = false;
                        tr.classList.remove('new-row-highlight');
                    }
                })

                if (index === lockedConflictIndex) {
                    tr.classList.add('conflict-highlight');
                }
                tr.dataset.index = index;

                tr.addEventListener('dragover', handleDragOver);
                tr.addEventListener('dragleave', handleDragLeave);
                tr.addEventListener('drop', handleDrop);

                let catClass = '';
                if (item.category === '交通') catClass = 'cat-transport';
                else if (item.category === '用餐') catClass = 'cat-meal';
                else if (item.category === '景點') catClass = 'cat-attraction';
                else if (item.category === '逛街') catClass = 'cat-shopping';

                let startLocked = (item.lock === 'start');
                let endLocked = (item.lock === 'end');
                let durLocked = (item.lock === 'duration');

                let isStartModified = (index === modifiedIndex && modifiedField === 'start');
                let isEndModified = (index === modifiedIndex && modifiedField === 'end');
                let isDurModified = (index === modifiedIndex && modifiedField === 'duration');

                tr.innerHTML = `
            <td><span class="drag-handle" draggable="true" ondragstart="handleDragStart(event, ${index})" title="調整排序">☰</span></td>
            <td>
                <input type="date" value="${item.date}" onchange="updateData(${index}, 'date', this.value)">
                <div style="font-size: 10px; color: #7f8c8d; margin-top: 1px;">${formatDateDisplay(item.date)}</div>
            </td>
            <td>
                <div class="time-cell">
                    <input type="text" class="time-input ${isStartModified ? 'conflict-field-highlight' : ''}" value="${item.start}" placeholder="HH:MM" ${startLocked ? 'readonly' : ''} onchange="handleTimeChange(${index}, 'start', this.value)">
                    <button class="lock-btn ${startLocked ? 'locked' : ''}" onclick="toggleLock(${index}, 'start')">${startLocked ? '🔒' : '🔓'}</button>
                </div>
            </td>
            <td>
                <div class="time-cell">
                    <input type="text" class="time-input ${isEndModified ? 'conflict-field-highlight' : ''}" value="${item.end}" placeholder="HH:MM" ${endLocked ? 'readonly' : ''} onchange="handleTimeChange(${index}, 'end', this.value)">
                    <button class="lock-btn ${endLocked ? 'locked' : ''}" onclick="toggleLock(${index}, 'end')">${endLocked ? '🔒' : '🔓'}</button>
                </div>
            </td>
            <td>
                <div class="time-cell" style="justify-content: center; gap: 2px;">
                    <input type="number" class="${isDurModified ? 'conflict-field-highlight' : ''}" value="${item.duration}" ${durLocked ? 'readonly' : ''} onchange="handleInputChange(${index}, 'duration', this.value)" style="width: 48px;">分鐘
                    <button class="lock-btn ${durLocked ? 'locked' : ''}" onclick="toggleLock(${index}, 'duration')">${durLocked ? '🔒' : '🔓'}</button>
                </div>
            </td>
            <td>
                <select class="${catClass}" onchange="updateCategory(${index}, this.value)" style="width: 100%;">
                    <option value="" ${item.category === '' ? 'selected' : ''}></option>
                    <option value="交通" ${item.category === '交通' ? 'selected' : ''}>交通</option>
                    <option value="逛街" ${item.category === '逛街' ? 'selected' : ''}>逛街</option>
                    <option value="景點" ${item.category === '景點' ? 'selected' : ''}>景點</option>
                    <option value="用餐" ${item.category === '用餐' ? 'selected' : ''}>用餐</option>
                </select>
            </td>
            <td><input type="text" value="${item.content}" onchange="updateData(${index}, 'content', this.value)"></td>
            <td><button class="delete-btn" onclick="confirmDelete(${index})" title="刪除此行程">ｘ</button></td>
        `;
                tbody.appendChild(tr);
            });
        }

        // 刪除確認燈箱
        // 開啟刪除行程的確認燈箱。
        function confirmDelete(index) {
            let modal = document.getElementById('customModal');
            let titleEl = document.getElementById('modalTitle');
            let descEl = document.getElementById('modalDesc');
            let btnContainer = document.getElementById('modalButtonsContainer');

            let item = itineraryData[index];
            let contentDesc = item.content ? `「${item.content}」` : `第 ${index + 1} 項行程`;

            titleEl.innerText = `確認刪除行程`;
            descEl.innerHTML = `您確定要刪除以下行程嗎？<br><br><span style="color: #2c3e50; font-weight: bold; background: #ecf0f1; padding: 4px 8px; border-radius: 4px; display: inline-block;">${item.start} ~ ${item.end} : ${item.content || '(無內容)'}</span>`;
            btnContainer.innerHTML = '';

            let confirmBtn = document.createElement('button');
            confirmBtn.innerText = `刪除`;
            confirmBtn.style.background = '#e74c3c';
            confirmBtn.onclick = () => {
                executeDelete(index);
                modal.style.display = 'none';
            };

            let cancelBtn = document.createElement('button');
            cancelBtn.innerText = `取消`;
            cancelBtn.style.background = '#95a5a6';
            cancelBtn.onclick = () => {
                modal.style.display = 'none';
            };

            btnContainer.appendChild(confirmBtn);
            btnContainer.appendChild(cancelBtn);
            modal.style.display = 'flex';
        }

        // 刪除指定行程並同步時間。

        function executeDelete(index) {
            itineraryData.splice(index, 1);
            if (itineraryData.length > 0) {
                cascadeBidirectional(Math.max(0, index - 1));
            }
            renderTable();
            showToast('行程已刪除，時間自動串聯完成');
        }

        // 拖曳排序相關
        let draggedIndex = null;
        // 開始拖曳行程列並記錄來源索引。
        function handleDragStart(e, index) {
            lockedConflictIndex = null;
            modifiedIndex = null;
            modifiedField = null;

            draggedIndex = index;
            e.dataTransfer.setData('text/plain', draggedIndex);
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => {
                let rows = document.querySelectorAll('#tableBody tr');
                if (rows[draggedIndex]) rows[draggedIndex].classList.add('dragging');
            }, 0);
        }
        // 處理拖曳經過行程列的視覺提示。
        function handleDragOver(e) { e.preventDefault(); this.closest('tr').classList.add('drag-over'); }
        // 移除拖曳離開行程列時的視覺提示。
        function handleDragLeave(e) { this.closest('tr').classList.remove('drag-over'); }
        // 完成行程列拖放排序並檢查鎖定衝突。
        function handleDrop(e) {
            e.preventDefault();
            let targetRow = this.closest('tr');
            targetRow.classList.remove('drag-over');
            let droppedIndex = parseInt(targetRow.dataset.index);

            document.querySelectorAll('tr').forEach(tr => tr.classList.remove('dragging', 'drag-over'));

            if (isNaN(draggedIndex) || draggedIndex === droppedIndex) return;

            //只要完成拖曳，就把被拖曳的那列標記狀態解除
            //先註解，因為如果只拖曳，標記狀態留著比較友善
            // if (itineraryData[draggedIndex]) {
            //     itineraryData[draggedIndex].isNew = false;
            // }

            let backup = JSON.parse(JSON.stringify(itineraryData));
            let movedItem = itineraryData.splice(draggedIndex, 1)[0];
            itineraryData.splice(droppedIndex, 0, movedItem);

            let conflict = checkTimeLockConflict(0);
            if (conflict) {
                itineraryData = backup;
                lockedConflictIndex = conflict.rowIndex;
                modifiedIndex = null;
                modifiedField = null;
                renderTable();
                openConflictModal(conflict.message);
                return;
            }

            cascadeBidirectional(0);
            renderTable();
            showToast('排序已更新，時間自動串聯完成');
        }

        // 切換行程時間或時長欄位的鎖定狀態。

        function toggleLock(index, field) {
            if (itineraryData[index].lock === field) {
                itineraryData[index].lock = 'none';
            } else {
                itineraryData[index].lock = field;
            }
            renderTable();
        }

        // 將 HH:MM 時間換算為當日分鐘數。

        const timeToMin = (t) => {
            let parts = (t || "00:00").split(':');
            return parseInt(parts[0]) * 60 + parseInt(parts[1]);
        };
        // 將分鐘數換算為 HH:MM 時間字串。
        const minToTime = (m) => {
            if (isNaN(m)) return "00:00";
            if (m < 0) m += 1440;
            let h = Math.floor(m / 60) % 24;
            let min = m % 60;
            return String(h).padStart(2, '0') + ':' + String(min).padStart(2, '0');
        };

        // 處理開始或結束時間欄位的修改。

        function handleTimeChange(index, field, value) {
            let formatted = formatTimeString(value);
            handleInputChange(index, field, formatted);
        }

        // 核心邏輯 V1:檢核任一行程更改是否有跟目前鎖定欄位有衝突
        // 模擬時間連動並檢查是否違反鎖定欄位。
        function checkTimeLockConflict(startIndex) {
            // 1. 先把當前資料備份起來，並記錄哪些行原本就被鎖定、其原始數值是多少
            let originalLocks = itineraryData.map(row => ({
                lock: row.lock,
                start: row.start,
                end: row.end,
                duration: row.duration
            }));

            // 2. 進行一次完整的雙向連動模擬（從修改處往上、再往下，或直接從 0 開始全面 cascade）
            let simData = JSON.parse(JSON.stringify(itineraryData));
    
            // 執行全面雙向模擬
            for (let i = startIndex; i > 0; i--) {
                let curr = simData[i];
                let prev = simData[i - 1];
                if (curr.date === prev.date || !prev.date || prev.date.trim() === "") {
                    prev.end = curr.start;
                    if (prev.lock === 'duration') {
                        let pEndMin = timeToMin(prev.end);
                        let pDur = parseInt(prev.duration) || 60;
                        prev.start = minToTime(pEndMin - pDur);
                    } else {
                        let psMin = timeToMin(prev.start);
                        let peMin = timeToMin(prev.end);
                        let pdur = peMin - psMin;
                        if (pdur < 0) pdur += 1440;
                        prev.duration = pdur;
                    }
                }
            }

            for (let i = 0; i < simData.length - 1; i++) {
                let curr = simData[i];
                let next = simData[i + 1];
                if (curr.date === next.date || !next.date || next.date.trim() === "") {
                    next.start = curr.end;
                    if (next.lock === 'duration') {
                        let nsMin = timeToMin(next.start);
                        let ndur = parseInt(next.duration) || 60;
                        next.end = minToTime(nsMin + ndur);
                    } else {
                        let nsMin = timeToMin(next.start);
                        let ndur = parseInt(next.duration) || 60;
                        next.end = minToTime(nsMin + ndur);
                    }
                }
            }

            // 3. 檢查全場：只要有任何一個原本被鎖定的欄位，其數值在模擬後被改變了，就是衝突！
            for (let i = 0; i < simData.length; i++) {
                let orig = originalLocks[i];
                let sim = simData[i];

                if (orig.lock && orig.lock !== 'none') {
                    let fieldToCheck = orig.lock; // 'start', 'end', 或 'duration'
                    if (orig[fieldToCheck] !== sim[fieldToCheck]) {
                        let itemDesc = sim.content ? `「${sim.content}」` : `第 ${i + 1} 項`;
                        //let fieldNames = { 'start': '開始時間', 'end': '結束時間'};
                        let fieldNames = { 'start': '開始時間', 'end': '結束時間', 'duration': '總時長' };
                        return {
                            rowIndex: i,
                            message: `${itemDesc} 的${fieldNames[fieldToCheck]}已經被鎖定，無法被連動覆蓋，請重新確認。`
                        };
                    }
                }
            }

            return null;
        }

        // 核心邏輯 V0:檢核下方行程更改是否有跟上方鎖定欄位衝突
        /*function checkTimeLockConflict(startIndex) {
            let simData = JSON.parse(JSON.stringify(itineraryData));

            for (let i = startIndex; i > 0; i--) {
                let curr = simData[i];
                let prev = simData[i - 1];
                if (curr.date === prev.date || !prev.date || prev.date.trim() === "") {
                    let targetNewEnd = curr.start;
                    if (prev.lock === 'end' && prev.end !== targetNewEnd) {
                        let itemDesc = prev.content ? `「${prev.content}」` : `第 ${i} 項`;
                        return {
                            rowIndex: i - 1,
                            message: `${itemDesc} 的結束時間已經被鎖定，無法被更新，請重新確認。`
                        };
                    }
                    prev.end = targetNewEnd;

                    if (prev.lock === 'duration') {
                        let pEndMin = timeToMin(prev.end);
                        let pDur = parseInt(prev.duration) || 60;
                        prev.start = minToTime(pEndMin - pDur);
                    } else {
                        let psMin = timeToMin(prev.start);
                        let peMin = timeToMin(prev.end);
                        let pdur = peMin - psMin;
                        if (pdur < 0) pdur += 1440;
                        prev.duration = pdur;
                    }
                }
            }

            for (let i = startIndex; i < simData.length - 1; i++) {
                let curr = simData[i];
                let next = simData[i + 1];
                if (curr.date === next.date || !next.date || next.date.trim() === "") {
                    let targetNewStart = curr.end;
                    if (next.lock === 'start' && next.start !== targetNewStart) {
                        let itemDesc = next.content ? `「${next.content}」` : `第 ${i + 2} 項`;
                        return {
                            rowIndex: i + 1,
                            message: `${itemDesc} 的開始時間已經被鎖定，無法被更新，請重新確認。`
                        };
                    }
                    next.start = targetNewStart;

                    if (next.lock === 'duration') {
                        let nsMin = timeToMin(next.start);
                        let ndur = parseInt(next.duration) || 60;
                        next.end = minToTime(nsMin + ndur);
                    } else {
                        let nsMin = timeToMin(next.start);
                        let ndur = parseInt(next.duration) || 60;
                        next.end = minToTime(nsMin + ndur);
                    }
                }
            }
            return null;
        }
        */

        // 處理時長輸入並協調開始與結束時間。

        function handleInputChange(index, field, value) {
            lockedConflictIndex = null;
            modifiedIndex = null;
            modifiedField = null;
            let backup = JSON.parse(JSON.stringify(itineraryData));

            let row = itineraryData[index];
            row[field] = value;

            if (row.lock && row.lock !== 'none') {
                let fixedField = row.lock;
                let targetField = ['start', 'end', 'duration'].find(f => f !== fixedField && f !== field);
                if (!targetField) {
                    targetField = ['start', 'end', 'duration'].find(f => f !== fixedField);
                }
                executeDirectCalculation(index, fixedField, targetField);

                let conflict = checkTimeLockConflict(index);
                if (conflict) {
                    itineraryData = backup;
                    lockedConflictIndex = conflict.rowIndex;
                    modifiedIndex = index;
                    modifiedField = field;
                    renderTable();
                    openConflictModal(conflict.message);
                    return;
                }
                cascadeBidirectional(index);
                renderTable();
                return;
            }

            let changedFields = [];
            if (row.start !== row.baseline.start) changedFields.push('start');
            if (row.end !== row.baseline.end) changedFields.push('end');
            if (String(row.duration) !== String(row.baseline.duration)) changedFields.push('duration');

            if (changedFields.length === 1) {
                openLightbox(index, changedFields[0]);
                return;
            } else {
                let allFields = ['start', 'end', 'duration'];
                let unChanged = allFields.filter(f => !changedFields.includes(f));
                let targetToCalculate = unChanged.length > 0 ? unChanged[0] : 'duration';

                executeCalculation(index, targetToCalculate);

                let conflict = checkTimeLockConflict(index);
                if (conflict) {
                    itineraryData = backup;
                    lockedConflictIndex = conflict.rowIndex;
                    modifiedIndex = index;
                    modifiedField = field;
                    renderTable();
                    openConflictModal(conflict.message);
                    return;
                }
                cascadeBidirectional(index);
                renderTable();
            }
        }

        // 依鎖定欄位與輸入欄位直接計算另一時間欄位。

        function executeDirectCalculation(index, fixedField, targetField) {
            let row = itineraryData[index];
            let sMin = timeToMin(row.start);
            let eMin = timeToMin(row.end);
            let dur = parseInt(row.duration) || 0;

            if (fixedField === 'start' && targetField === 'end') {
                row.end = minToTime(sMin + dur);
            } else if (fixedField === 'start' && targetField === 'duration') {
                row.duration = eMin - sMin;
                if (row.duration < 0) row.duration += 1440;
            } else if (fixedField === 'end' && targetField === 'start') {
                row.start = minToTime(eMin - dur);
            } else if (fixedField === 'end' && targetField === 'duration') {
                row.duration = eMin - sMin;
                if (row.duration < 0) row.duration += 1440;
            } else if (fixedField === 'duration' && targetField === 'end') {
                row.end = minToTime(sMin + dur);
            } else if (fixedField === 'duration' && targetField === 'start') {
                row.start = minToTime(eMin - dur);
            }
            row.baseline = { start: row.start, end: row.end, duration: row.duration };
        }

        // 提供選項燈箱讓使用者選擇時間重算方式。

        function openLightbox(index, changedField) {
            let modal = document.getElementById('customModal');
            let titleEl = document.getElementById('modalTitle');
            let descEl = document.getElementById('modalDesc');
            let btnContainer = document.getElementById('modalButtonsContainer');

            let fieldNames = { 'start': '開始時間', 'end': '結束時間', 'duration': '總時長' };
            titleEl.innerText = `請選擇推算方式`;
            descEl.innerText = `您剛剛修改了第 ${index + 1} 列的「${fieldNames[changedField]}」，請選擇要固定哪一個欄位來進行推算：`;
            btnContainer.innerHTML = '';

            let otherFields = ['start', 'end', 'duration'].filter(f => f !== changedField);

            otherFields.forEach(targetField => {
                let btn = document.createElement('button');
                if (changedField === 'start') {
                    if (targetField === 'duration') btn.innerText = `「總時長」不變，推算結束時間`;
                    else btn.innerText = `「結束時間」不變，推算總時長`;
                } else if (changedField === 'duration') {
                    if (targetField === 'start') btn.innerText = `「開始時間」不變，推算結束時間`;
                    else btn.innerText = `「結束時間」不變，推算開始時間`;
                } else if (changedField === 'end') {
                    if (targetField === 'start') btn.innerText = `「開始時間」不變，推算總時長`;
                    else btn.innerText = `「總時長」不變，推算開始時間`;
                }

                btn.onclick = () => {
                    let backup = JSON.parse(JSON.stringify(itineraryData));
                    executeSingleFieldChoice(index, changedField, targetField);

                    let conflict = checkTimeLockConflict(index);
                    if (conflict) {
                        itineraryData = backup;
                        lockedConflictIndex = conflict.rowIndex;
                        modifiedIndex = index;
                        modifiedField = changedField;
                        renderTable();
                        modal.style.display = 'none';
                        openConflictModal(conflict.message);
                        return;
                    }
                    cascadeBidirectional(index);
                    renderTable();
                    modal.style.display = 'none';
                };
                btnContainer.appendChild(btn);
            });

            modal.style.display = 'flex';
        }

        // 顯示時間連動造成鎖定衝突的訊息。

        function openConflictModal(message) {
            let modal = document.getElementById('customModal');
            let titleEl = document.getElementById('modalTitle');
            let descEl = document.getElementById('modalDesc');
            let btnContainer = document.getElementById('modalButtonsContainer');

            titleEl.innerText = `⚠️ 行程時間衝突警告 ⚠️`;
            descEl.innerHTML = `<span style="color: #c0392b; font-weight: bold;">${message}</span><br><br>💡 提示：系統已復原至修改前的狀態。<br>💡 <span>提示：黃色為您剛剛修改的欄位，紅框列為發生衝突的行程。</span>`;
            btnContainer.innerHTML = '';

            let okBtn = document.createElement('button');
            okBtn.innerText = `我知道了`;
            okBtn.style.background = '#e74c3c';
            okBtn.onclick = () => {
                modal.style.display = 'none';
            };
            btnContainer.appendChild(okBtn);

            modal.style.display = 'flex';
        }

        // 依使用者選定欄位計算時間或時長。

        function executeSingleFieldChoice(index, changedField, targetField) {
            let row = itineraryData[index];
            let sMin = timeToMin(row.start);
            let eMin = timeToMin(row.end);
            let dur = parseInt(row.duration) || 0;
            let targetCalculatedName = '';

            if (changedField === 'start') {
                if (targetField === 'duration') {
                    row.end = minToTime(sMin + dur);
                    targetCalculatedName = '結束時間';
                } else {
                    row.duration = eMin - sMin;
                    if (row.duration < 0) row.duration += 1440;
                    targetCalculatedName = '總時長';
                }
            } else if (changedField === 'duration') {
                if (targetField === 'start') {
                    row.end = minToTime(sMin + dur);
                    targetCalculatedName = '結束時間';
                } else {
                    row.start = minToTime(eMin - dur);
                    targetCalculatedName = '開始時間';
                }
            } else if (changedField === 'end') {
                if (targetField === 'start') {
                    row.duration = eMin - sMin;
                    if (row.duration < 0) row.duration += 1440;
                    targetCalculatedName = '總時長';
                } else {
                    row.start = minToTime(eMin - dur);
                    targetCalculatedName = '開始時間';
                }
            }
            showToast(`${targetCalculatedName}已修正`);
            row.baseline = { start: row.start, end: row.end, duration: row.duration };
        }

        // 計算選定的開始、結束或時長欄位。

        function executeCalculation(index, targetToCalculate) {
            let row = itineraryData[index];
            let sMin = timeToMin(row.start);
            let eMin = timeToMin(row.end);
            let dur = parseInt(row.duration) || 0;

            if (targetToCalculate === 'duration') {
                row.duration = eMin - sMin;
                if (row.duration < 0) row.duration += 1440;
            } else if (targetToCalculate === 'end') {
                row.end = minToTime(sMin + dur);
            } else if (targetToCalculate === 'start') {
                row.start = minToTime(eMin - dur);
            }
            row.baseline = { start: row.start, end: row.end, duration: row.duration };
        }

        // 沿行程順序向前與向後連動時間。

        function cascadeBidirectional(startIndex) {
            for (let i = startIndex; i > 0; i--) {
                let curr = itineraryData[i];
                let prev = itineraryData[i - 1];
                if (curr.date === prev.date || !prev.date || prev.date.trim() === "") {
                    prev.end = curr.start;

                    if (prev.lock === 'duration') {
                        let pEndMin = timeToMin(prev.end);
                        let pDur = parseInt(prev.duration) || 60;
                        prev.start = minToTime(pEndMin - pDur);
                    } else {
                        let psMin = timeToMin(prev.start);
                        let peMin = timeToMin(prev.end);
                        let pdur = peMin - psMin;
                        if (pdur < 0) pdur += 1440;
                        prev.duration = pdur;
                    }
                    prev.baseline = { start: prev.start, end: prev.end, duration: prev.duration };
                }
            }

            for (let i = startIndex; i < itineraryData.length - 1; i++) {
                let curr = itineraryData[i];
                let next = itineraryData[i + 1];
                if (curr.date === next.date || !next.date || next.date.trim() === "") {
                    next.start = curr.end;

                    if (next.lock === 'duration') {
                        let nsMin = timeToMin(next.start);
                        let ndur = parseInt(next.duration) || 60;
                        next.end = minToTime(nsMin + ndur);
                    } else {
                        let nsMin = timeToMin(next.start);
                        let ndur = parseInt(next.duration) || 60;
                        next.end = minToTime(nsMin + ndur);
                    }
                    next.baseline = { start: next.start, end: next.end, duration: next.duration };
                }
            }
        }

        // 更新行程一般欄位並處理日期連動。

        function updateData(index, field, value) {
            lockedConflictIndex = null;
            modifiedIndex = null;
            modifiedField = null;
            
            let backup = JSON.parse(JSON.stringify(itineraryData));
            itineraryData[index][field] = value;
            itineraryData[index].baseline[field] = value;

            if (field === 'date') {
                let conflict = checkTimeLockConflict(index);
                if (conflict) {
                    itineraryData = backup;
                    lockedConflictIndex = conflict.rowIndex;
                    modifiedIndex = index;
                    modifiedField = field;
                    renderTable();
                    openConflictModal(conflict.message);
                    return;
                }
                cascadeBidirectional(index);
                renderTable();
            }
        }

        // 更新行程類別並重繪表格。

        function updateCategory(index, value) {
            itineraryData[index].category = value;
            renderTable();
        }

        // 新增行程在最上方
        // 在行程表最上方新增一筆行程。
        function addRow() {
            lockedConflictIndex = null;
            modifiedIndex = null;
            modifiedField = null;
    
        // 抓取原本排在最上面的那一列作為「下一行」
            let first = itineraryData[0];
    
        // 新行程的結束時間，直接接續原本第一行的開始時間；若完全沒資料則預設 07:30
            let newEnd = first ? first.start : "07:30";
            let newEndMin = timeToMin(newEnd);
    
        // 預設長度 60 分鐘，由結束時間往前推算開始時間
            let defaultDuration = 60;
            let newStart = minToTime(newEndMin - defaultDuration);

        // 使用 unshift 將新行程插入到陣列最前方
            itineraryData.unshift({
                date: first ? first.date : "2026-10-29",
                start: newStart,
                end: newEnd,
                duration: defaultDuration,
                lock: "none",
                baseline: { start: newStart, end: newEnd, duration: defaultDuration },
                category: "",
                content: "",
                isNew: true // 標記新增加的行程
            });

        // 從第 0 項開始全面連動對齊
            cascadeBidirectional(0);
            renderTable();
            showToast('已新增行程');
        } 

        // 新增行程在最下方
        // function addRow() {
        //     lockedConflictIndex = null;
        //     modifiedIndex = null;
        //     modifiedField = null;
        //     let last = itineraryData[itineraryData.length - 1];
        //     let newStart = last ? last.end : "08:30";
        //     let newEnd = "09:30";
        //     itineraryData.push({
        //         date: last ? last.date : "2026-10-29",
        //         start: newStart,
        //         end: newEnd,
        //         duration: 60,
        //         lock: "none",
        //         baseline: { start: newStart, end: newEnd, duration: 60 },
        //         category: "",
        //         content: ""
        //     });
        //     cascadeBidirectional(itineraryData.length - 2);
        //     renderTable();
        // }

        // 清除新增列標記狀態
        // 清除指定行程的新增加亮狀態。
        function clearNewState(index) {
            if (itineraryData[index] && itineraryData[index].isNew) {
                itineraryData[index].isNew = false;
             }
        }

        // 將行程資料與基準時間儲存至瀏覽器。

        function saveData() {
            itineraryData.forEach(row => {
                row.baseline = { start: row.start, end: row.end, duration: row.duration };
                row.isNew = false; // 儲存時清除新增列的標記
            });
            localStorage.setItem('hokkaido_itinerary_v47', JSON.stringify(itineraryData));
            showToast('行程已成功儲存！');
        }

        // 將目前行程匯出為 CSV 檔案。

        function exportCSV() {
            let csvContent = "\uFEFF日期,開始時間,結束時間,總時長,類別,行程內容\n";
            itineraryData.forEach(row => {
                csvContent += `"${formatDateDisplay(row.date)} (${row.date})","${row.start}","${row.end}","${row.duration}","${row.category}","${row.content}"\n`;
            });
            let blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            let url = URL.createObjectURL(blob);
            let a = document.createElement('a');
            a.href = url;
            a.download = '2026_北海道行程_刪除確認版.csv';
            a.click();
        }

        renderTable();
