/* ═══════════════════════════════════════════════
   Hostel Management System - Frontend Controller
   Logic: Ultra-Stable & Premium Administration
   ═══════════════════════════════════════════════ */

'use strict';

const API_URL = "https://oodpfinal.onrender.com/api";

const State = {
    students: [],
    rooms: [],
    fees: [],
    complaints: [],
    activity: [],
    currentSection: 'dashboard',
    isSyncing: false,
    theme: localStorage.getItem('hms-theme') || 'light',
    stats: { totalStudents: 0, allottedStudents: 0, totalRooms: 0, availableRooms: 0, openComplaints: 0, totalFeesDue: 0 },
    charts: { trend: null, distribution: null }
};

// ── Theme ──
function initTheme() {
    document.documentElement.setAttribute('data-theme', State.theme);
    updateThemeIcon();
}
function toggleTheme() {
    State.theme = State.theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', State.theme);
    localStorage.setItem('hms-theme', State.theme);
    updateThemeIcon();
}
function updateThemeIcon() {
    const icon = document.querySelector('#themeToggle i');
    if (icon) icon.className = State.theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
}

// ── Sync ──
async function sync() {
    if (State.isSyncing) return;
    const syncInd = document.getElementById('syncIndicator');
    if (syncInd) syncInd.style.opacity = '1';

    const data = await Promise.all([
        request('/dashboard'), request('/students'), request('/rooms'), request('/fees'), request('/complaints')
    ]);
    
    if (syncInd) syncInd.style.opacity = '0';
    State.isSyncing = false;
    if (data.every(d => d !== null)) {
        const [stats, students, rooms, fees, complaints] = data;
        const changed = stats.totalStudents !== State.stats.totalStudents || stats.totalFeesDue !== State.stats.totalFeesDue;
        State.stats = stats; State.students = students; State.rooms = rooms; State.fees = fees; State.complaints = complaints;
        renderUI(changed);
    }
}

// ── Render ──
function renderUI(animate = false) {
    updateDashboard(animate);
    renderStudents();
    renderRooms();
    renderFees();
    renderComplaints();
    populateSelects();
    updateCharts();
}

function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    if (!obj) return;
    const isCurrency = obj.textContent.includes('₹') || id === 'dash-fees';
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const current = Math.floor(progress * (end - start) + start);
        obj.innerHTML = (isCurrency ? '₹' : '') + current.toLocaleString();
        if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
}

function updateDashboard(animate = false) {
    const s = State.stats;
    if (animate) {
        animateValue('dash-students', 0, s.totalStudents, 1000);
        animateValue('dash-rooms', 0, s.availableRooms, 1000);
        animateValue('dash-fees', 0, s.totalFeesDue, 1000);
        animateValue('dash-complaints', 0, s.openComplaints, 1000);
    } else {
        document.getElementById('dash-students').textContent = s.totalStudents;
        document.getElementById('dash-rooms').textContent = s.availableRooms;
        document.getElementById('dash-fees').textContent = "₹" + s.totalFeesDue.toLocaleString();
        document.getElementById('dash-complaints').textContent = s.openComplaints;
    }

    // Update Occupancy Progress
    const prog = document.getElementById('occupancy-progress');
    if (prog && s.totalRooms > 0) {
        const percent = ((s.totalRooms - s.availableRooms) / s.totalRooms) * 100;
        prog.style.width = percent + '%';
        prog.style.background = percent > 90 ? 'var(--error)' : percent > 70 ? 'var(--warning)' : 'var(--success)';
    }

    // Dynamic Insights
    const insight = document.getElementById('occupancy-insight');
    if (insight) {
        const percent = Math.round(((s.totalRooms - s.availableRooms) / s.totalRooms) * 100);
        let msg = `Your hostel is currently <strong>${percent}%</strong> occupied. `;
        if (percent > 90) msg += "Capacity is nearly full. Consider opening waitlists.";
        else if (percent > 50) msg += "Steady occupancy. 2nd floor is seeing most activity.";
        else msg += "High vacancy rate. Marketing campaigns recommended for Block B.";
        insight.innerHTML = msg;
    }
    
    const feed = document.getElementById('activity-feed');
    if (feed) {
        feed.innerHTML = State.activity.map(a => `
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px; padding: 12px; background: var(--bg-accent); border-radius: 12px;">
                <div style="width: 10px; height: 10px; border-radius: 50%; background: ${a.color};"></div>
                <div style="flex: 1; font-size: 14px;">${a.text}</div>
                <div style="font-size: 11px; color: var(--text-muted); font-weight: 600;">${a.time}</div>
            </div>
        `).join('');
    }
}

function updateCharts() {
    const isDark = State.theme === 'dark';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';

    // ── Trend Chart (Fees & Students) ──
    const trendCtx = document.getElementById('trendChart')?.getContext('2d');
    if (trendCtx) {
        if (State.charts.trend) State.charts.trend.destroy();
        
        // Mocking some trend data based on current counts
        const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
        const studentGrowth = [12, 19, Math.max(0, State.stats.totalStudents - 5), Math.max(0, State.stats.totalStudents - 2), Math.max(0, State.stats.totalStudents - 1), State.stats.totalStudents];
        const feeCollection = [45000, 52000, 48000, 61000, 55000, State.stats.totalFeesDue / 10]; 

        State.charts.trend = new Chart(trendCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Residents',
                        data: studentGrowth,
                        borderColor: '#e14eca',
                        backgroundColor: 'rgba(225, 78, 202, 0.15)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 3,
                        pointRadius: 4,
                        pointBackgroundColor: '#e14eca'
                    },
                    {
                        label: 'Fees (k)',
                        data: feeCollection.map(v => v/1000),
                        borderColor: '#00f2c3',
                        backgroundColor: 'transparent',
                        tension: 0.4,
                        borderWidth: 2,
                        borderDash: [5, 5],
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, position: 'top', labels: { color: textColor, font: { family: 'Inter', weight: '600' } } }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { color: textColor } },
                    y: { grid: { color: gridColor }, ticks: { color: textColor } }
                }
            }
        });
    }

    // ── Distribution Chart (Rooms) ──
    const distCtx = document.getElementById('distributionChart')?.getContext('2d');
    if (distCtx) {
        if (State.charts.distribution) State.charts.distribution.destroy();

        const occupied = State.rooms.filter(r => r.status !== 'Available').length;
        const available = State.rooms.filter(r => r.status === 'Available').length;

        State.charts.distribution = new Chart(distCtx, {
            type: 'doughnut',
            data: {
                labels: ['Occupied', 'Vacant'],
                datasets: [{
                    data: [occupied, available],
                    backgroundColor: ['#e14eca', '#00f2c3'],
                    hoverOffset: 15,
                    borderWidth: 0,
                    borderRadius: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                plugins: {
                    legend: { position: 'bottom', labels: { color: textColor, padding: 20, font: { family: 'Inter', weight: '600' } } }
                }
            }
        });
    }
}

function renderStudents() {
    const list = document.getElementById('student-table-body');
    if (!list) return;
    const query = document.getElementById('globalSearch').value.toLowerCase();
    const filtered = State.students.filter(s => s.name.toLowerCase().includes(query) || s.id.toLowerCase().includes(query));
    list.innerHTML = filtered.map((s, idx) => `
        <tr>
            <td><code>#${s.id}</code></td>
            <td><strong>${s.name}</strong></td>
            <td>${s.phone}</td>
            <td>${s.courseYear}</td>
            <td>${s.roomNumber ? `<span class="badge badge-success">${s.roomNumber}</span>` : '—'}</td>
            <td><span style="font-weight: 800; color: ${s.totalDue > 0 ? 'var(--error)' : 'var(--success)'}">₹${s.totalDue}</span></td>
            <td>
                <button class="btn btn-outline" style="padding: 6px 14px; font-size: 11px;" onclick="viewStudentDetails('${s.id}')">View</button>
                <button class="btn btn-outline" style="padding: 6px 10px; font-size: 11px; color: var(--error); border-color: var(--error); margin-left: 4px;" onclick="deleteStudentDirect('${s.id}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function renderRooms() {
    const grid = document.getElementById('room-grid');
    if (!grid) return;
    grid.innerHTML = State.rooms.map((r, idx) => `
        <div class="room-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <span class="room-num">${r.roomNumber}</span>
                <span class="badge badge-${r.status === 'Available' ? 'success' : 'danger'}">${r.status}</span>
            </div>
            <div style="font-size: 14px; color: var(--text-muted); margin-bottom: 20px;">
                <i class="fas fa-layer-group" style="margin-right: 8px; opacity: 0.6;"></i>Block ${r.block} · ${r.type}
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-soft); padding-top: 16px;">
                <span style="font-weight: 900; font-size: 22px;">₹${r.rent}</span>
                <div>
                    <span style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Per Month</span>
                    <button class="btn btn-outline" style="padding: 4px 8px; font-size: 10px; margin-left: 8px; color: var(--error); border-color: var(--error);" onclick="deleteRoom('${r.roomNumber}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        </div>
    `).join('');
}

function renderFees() {
    const list = document.getElementById('fee-table-body');
    if (!list) return;
    list.innerHTML = State.fees.map((f, idx) => `
        <tr>
            <td><code>${f.studentId}</code></td>
            <td><strong>${f.studentName}</strong></td>
            <td style="color: var(--text-muted); font-size: 13px;">${f.date}</td>
            <td style="font-weight: 800;">₹${f.amount}</td>
            <td>${f.type}</td>
            <td><span class="badge badge-${f.status === 'Paid' ? 'success' : 'danger'}">${f.status}</span></td>
            <td>${f.status === 'Pending' ? `<button class="btn btn-primary" style="padding: 6px 14px; font-size: 11px;" onclick="payFee('${f.studentId}', '${f.date}', ${f.amount})">Clear Fee</button>` : '<i class="fas fa-check-circle" style="color: var(--success);"></i>'}</td>
        </tr>
    `).join('');
}

function renderComplaints() {
    const list = document.getElementById('complaint-table-body');
    if (!list) return;
    list.innerHTML = State.complaints.map((c, idx) => `
        <tr>
            <td><code>#${c.id}</code></td>
            <td><strong>${c.studentName}</strong></td>
            <td style="color: var(--text-muted); font-size: 13px;">${c.date}</td>
            <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${c.description}</td>
            <td><span class="badge badge-${c.status === 'Open' ? 'danger' : 'success'}">${c.status}</span></td>
            <td>${c.status === 'Open' ? `<button class="btn btn-primary" style="padding: 6px 14px; font-size: 11px;" onclick="resolveComplaint('${c.id}')">Resolve</button>` : '—'}</td>
        </tr>
    `).join('');
}

// ── Nav ──
function showSection(id, el) {
    if (State.currentSection === id) return;
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
    const target = document.getElementById(`section-${id}`);
    if (target) target.classList.add('active');
    if (el) el.classList.add('active');
    State.currentSection = id;
    document.getElementById('section-title').textContent = (el ? el.querySelector('span').textContent : "Dashboard") + " Control";
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

// ── API ──
async function request(endpoint, method = 'GET', data = null) {
    try {
        const options = { method, headers: { 'Content-Type': 'application/json' } };
        if (data) options.body = JSON.stringify(data);
        const res = await fetch(`${API_URL}${endpoint}`, options);
        return res.ok ? await res.json() : null;
    } catch { return null; }
}

function showToast(msg, type = "info") {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast-item';
    const color = type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--error)' : 'var(--primary)';
    toast.style.borderLeftColor = color;
    toast.innerHTML = `<div style="font-weight: 600; font-size: 14px;">${msg}</div>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

function logActivity(text, color) {
    State.activity.unshift({ text, color: color === 'blue' ? 'var(--primary)' : 'var(--success)', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
    if (State.activity.length > 6) State.activity.pop();
}

function populateSelects() {
    const studentSels = ['fee-student-select', 'complaint-student-select'];
    studentSels.forEach(id => {
        const sel = document.getElementById(id);
        if (sel) sel.innerHTML = State.students.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    });
    const roomSel = document.getElementById('room-select-dropdown');
    if (roomSel) roomSel.innerHTML = State.rooms.filter(r => r.status === 'Available').map(r => `<option value="${r.roomNumber}">${r.roomNumber} - Block ${r.block}</option>`).join('');
}

function viewStudentDetails(id) {
    const s = State.students.find(st => st.id === id);
    if (!s) return;
    document.getElementById('student-profile-body').innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;">
            <div><label style="font-size: 12px; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 4px;">Full Name</label><div style="font-weight: 700; font-size: 16px;">${s.name}</div></div>
            <div><label style="font-size: 12px; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 4px;">Identity</label><div style="font-family: monospace; color: var(--primary); font-weight: 800;">#${s.id}</div></div>
            <div><label style="font-size: 12px; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 4px;">Contact</label><div>${s.phone}</div></div>
            <div><label style="font-size: 12px; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 4px;">Unit</label><div><span class="badge badge-${s.roomNumber ? 'success' : 'warning'}">${s.roomNumber || 'Unassigned'}</span></div></div>
        </div>
        <input type="hidden" id="alloc-student-id" value="${s.id}">
    `;
    document.getElementById('alloc-student-name').textContent = s.name;
    openModal('modal-view-student');
}

async function addStudent() {
    const name = document.getElementById('s-name').value;
    const phone = document.getElementById('s-phone').value;
    const email = document.getElementById('s-email').value;
    const course = document.getElementById('s-course').value;
    const res = await request('/students', 'POST', { name, phone, email, courseYear: course });
    if (res) { closeModal('modal-add-student'); sync(); logActivity(`Account verified for ${name}`, 'blue'); showToast("Resident Registered", "success"); }
}

async function allotRoom() {
    const sid = document.getElementById('alloc-student-id').value;
    const rno = document.getElementById('room-select-dropdown').value;
    const res = await request('/rooms/allocate', 'POST', { studentId: sid, roomNumber: rno });
    if (res) { closeModal('modal-allocate-room'); closeModal('modal-view-student'); sync(); logActivity(`Room ${rno} assigned`, 'green'); showToast("Unit Allocated", "success"); }
}

// ── Init ──
window.onload = () => {
    initTheme(); sync();
    setInterval(sync, 15000);
    setInterval(() => {
        const ping = document.getElementById('ping');
        if (ping) ping.textContent = Math.floor(Math.random() * 10 + 5) + 'ms';
        const clock = document.getElementById('currentTime');
        if (clock) {
            const now = new Date();
            clock.innerHTML = `<i class="far fa-clock" style="margin-right: 8px; color: var(--primary);"></i>${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
        }
    }, 1000);
    
    document.body.style.opacity = '0';
    setTimeout(() => { document.body.style.transition = 'opacity 0.8s ease-out'; document.body.style.opacity = '1'; }, 100);
};

function filterStudents() { renderStudents(); }

function openAllocateModal() {
    closeModal('modal-view-student');
    openModal('modal-allocate-room');
}

async function deleteStudentDirect(sid) {
    if (confirm("Are you sure you want to remove this resident?")) {
        const res = await request('/students/' + sid, 'DELETE');
        if (res !== null) {
            sync();
            logActivity(`Resident ${sid} removed`, 'red');
            showToast("Resident Removed", "success");
        }
    }
}

async function deleteStudent() {
    const sid = document.getElementById('alloc-student-id').value;
    if (!sid) return;
    if (confirm("Are you sure you want to remove this resident?")) {
        const res = await request('/students/' + sid, 'DELETE');
        if (res !== null) {
            closeModal('modal-view-student');
            sync();
            logActivity(`Resident ${sid} removed`, 'red');
            showToast("Resident Removed", "success");
        }
    }
}

async function addRoom() {
    const num = document.getElementById('r-num').value;
    const block = document.getElementById('r-block').value;
    const type = document.getElementById('r-type').value;
    const rent = document.getElementById('r-rent').value;
    
    if (!num || !rent) {
        showToast("Please fill all required fields", "error");
        return;
    }
    
    const res = await request('/rooms', 'POST', { roomNumber: num, block: block, type: type, rent: rent });
    if (res) {
        closeModal('modal-add-room');
        sync();
        logActivity(`Room ${num} created`, 'blue');
        showToast("Room Added", "success");
    } else {
        showToast("Failed to add room", "error");
    }
}

async function deleteRoom(num) {
    if (confirm("Are you sure you want to delete room " + num + "?")) {
        const res = await request('/rooms/' + num, 'DELETE');
        if (res) {
            sync();
            logActivity(`Room ${num} deleted`, 'red');
            showToast("Room Deleted", "success");
        } else {
            showToast("Failed to delete room. It might be occupied.", "error");
        }
    }
}

async function payFee(sid, date, amount) {
    if (confirm("Confirm payment of ₹" + amount + "?")) {
        const res = await request('/fees/pay', 'POST', { studentId: sid, date: date, amount: amount });
        if (res) {
            sync();
            logActivity(`Payment of ₹${amount} cleared for ${sid}`, 'green');
            showToast("Payment Recorded", "success");
        }
    }
}

async function resolveComplaint(cid) {
    if (confirm("Mark this ticket as resolved?")) {
        const res = await request('/complaints/resolve', 'POST', { id: cid });
        if (res) {
            sync();
            logActivity(`Ticket ${cid} resolved`, 'blue');
            showToast("Ticket Resolved", "success");
        }
    }
}

async function addComplaint() {
    const sid = document.getElementById('complaint-student-select').value;
    const desc = document.getElementById('c-desc').value;
    if (!sid || !desc) {
        showToast("Please fill all fields", "error");
        return;
    }
    const res = await request('/complaints', 'POST', { studentId: sid, description: desc });
    if (res) {
        closeModal('modal-add-complaint');
        document.getElementById('c-desc').value = '';
        sync();
        logActivity(`New ticket raised`, 'warning');
        showToast("Ticket Submitted", "success");
    }
}
