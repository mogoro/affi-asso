/**
 * AFFI — Member Area Logic (auth, dashboard, directory, announcements, CV, LinkedIn)
 */

let authToken = localStorage.getItem('affi_token') || '';
let currentUser = null;

// === AUTH ===
async function doLogin(evt) {
    evt.preventDefault();
    const f = evt.target;
    const email = f.email.value.trim();
    const password = f.password.value;
    try {
        const res = await fetch(`${API}/api/auth`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({action: 'login', email, password})
        });
        const data = await res.json();
        if (data.ok) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('affi_token', authToken);
            showMemberArea();
        } else {
            document.getElementById('login-error').textContent = data.error || 'Erreur de connexion';
            document.getElementById('login-error').style.display = 'block';
        }
    } catch (e) {
        document.getElementById('login-error').textContent = 'Erreur reseau';
        document.getElementById('login-error').style.display = 'block';
    }
}

async function checkSession() {
    if (!authToken) return false;
    try {
        const res = await fetch(`${API}/api/auth`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({action: 'check', token: authToken})
        });
        const data = await res.json();
        if (data.ok) { currentUser = data.user; return true; }
    } catch {}
    localStorage.removeItem('affi_token');
    authToken = '';
    return false;
}

function doLogout() {
    fetch(`${API}/api/auth`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({action: 'logout', token: authToken})
    }).catch(() => {});
    localStorage.removeItem('affi_token');
    authToken = '';
    currentUser = null;
    document.getElementById('login-section').style.display = 'block';
    document.getElementById('member-area').style.display = 'none';
}

async function showMemberArea() {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('member-area').style.display = 'block';

    // Update welcome
    const w = document.getElementById('welcome-name');
    if (w && currentUser) w.textContent = currentUser.first_name + ' ' + currentUser.last_name;

    // Show admin tab if admin
    const adminTab = document.getElementById('admin-tab');
    if (adminTab) adminTab.style.display = currentUser && currentUser.is_admin ? 'inline-block' : 'none';

    switchMemberTab('dashboard');
}

// === MEMBER TABS ===
function switchMemberTab(tab) {
    document.querySelectorAll('.mtab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.mtab').forEach(el => el.classList.remove('active'));
    const panel = document.getElementById('mtab-' + tab);
    if (panel) panel.style.display = 'block';
    const btn = document.querySelector(`.mtab[data-tab="${tab}"]`);
    if (btn) btn.classList.add('active');

    if (tab === 'directory') loadDirectory();
    if (tab === 'announcements') loadAnnouncements();
    if (tab === 'communaute') { if (typeof loadFeed === 'function') loadFeed(); }
    if (tab === 'carriere') { if (typeof loadJobs === 'function') loadJobs(); }
    if (tab === 'formations') { if (typeof loadCourses === 'function') loadCourses(); }
    if (tab === 'cartographie') { if (typeof loadMap === 'function') loadMap(); }
    if (tab === 'profile') loadProfile();
    if (tab === 'messages') loadConversations();
    if (tab === 'notifications') loadNotifications();
    if (tab === 'admin') loadAdmin();
}

// === DIRECTORY ===
async function loadDirectory(search, sector) {
    const params = new URLSearchParams({action: 'directory'});
    if (search) params.set('search', search);
    if (sector) params.set('sector', sector);
    try {
        const res = await fetch(`${API}/api/members?${params}`, {headers: {'Authorization': 'Bearer ' + authToken}});
        const members = await res.json();
        renderDirectory(members);
    } catch (e) { console.warn('Directory:', e); }
}

function renderDirectory(members) {
    const el = document.getElementById('directory-grid');
    if (!el) return;
    if (!members.length) { el.innerHTML = '<p style="text-align:center;color:var(--gray-400);grid-column:1/-1;padding:40px">Aucun membre trouve</p>'; return; }
    el.innerHTML = members.map(m => {
        const initials = (m.first_name || '?')[0] + (m.last_name || '?')[0];
        return `<div class="member-card">
            <div class="member-avatar">${esc(initials.toUpperCase())}</div>
            <div class="member-info">
                <div class="member-name">${esc(m.first_name)} ${esc(m.last_name)}</div>
                <div class="member-job">${esc(m.job_title || '')}</div>
                <div class="member-company">${esc(m.company || '')}</div>
                ${m.sector ? `<span class="card-tag">${esc(m.sector)}</span>` : ''}
                ${m.is_board ? '<span class="card-tag card-tag-primary">Bureau</span>' : ''}
            </div>
        </div>`;
    }).join('');
}

let _dirSearch;
function onDirSearch(v) {
    clearTimeout(_dirSearch);
    _dirSearch = setTimeout(() => loadDirectory(v, document.getElementById('dir-sector')?.value), 300);
}
function onDirSector() {
    loadDirectory(document.getElementById('dir-search')?.value, document.getElementById('dir-sector')?.value);
}

// === ANNOUNCEMENTS ===
async function loadAnnouncements() {
    try {
        const res = await fetch(`${API}/api/members?action=announcements`, {headers: {'Authorization': 'Bearer ' + authToken}});
        const items = await res.json();
        renderAnnouncements(items);
    } catch (e) { console.warn('Annonces:', e); }
}

function renderAnnouncements(items) {
    const el = document.getElementById('announcements-list');
    if (!el) return;
    if (!items.length) { el.innerHTML = '<p style="text-align:center;color:var(--gray-400);padding:40px">Aucune annonce</p>'; return; }
    const catColors = {emploi:'var(--accent)',collaboration:'var(--teal)',general:'var(--primary)'};
    el.innerHTML = items.map(a => `
        <div class="announcement-card">
            <div class="ann-header">
                <span class="ann-cat" style="background:${catColors[a.category] || 'var(--gray-500)'}">${esc(a.category)}</span>
                <span class="ann-date">${formatDate(a.created_at)}</span>
            </div>
            <div class="ann-title">${esc(a.title)}</div>
            <div class="ann-content">${esc(a.content)}</div>
            <div class="ann-author">Par ${esc(a.first_name)} ${esc(a.last_name)} ${a.company ? '(' + esc(a.company) + ')' : ''}</div>
        </div>
    `).join('');
}

async function postAnnouncement(evt) {
    evt.preventDefault();
    const f = evt.target;
    try {
        const res = await fetch(`${API}/api/members`, {
            method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken},
            body: JSON.stringify({action: 'post_announcement', title: f.title.value, content: f.content.value, category: f.category.value})
        });
        const data = await res.json();
        if (data.ok) { f.reset(); loadAnnouncements(); }
    } catch (e) { alert('Erreur: ' + e.message); }
}

// === PROFILE & CV ===
async function loadProfile() {
    try {
        const res = await fetch(`${API}/api/members?action=profile`, {headers: {'Authorization': 'Bearer ' + authToken}});
        const p = await res.json();
        if (p.error) return;
        // Fill form
        for (const k of ['first_name','last_name','phone','company','job_title','sector','bio','linkedin_url']) {
            const inp = document.getElementById('prof-' + k);
            if (inp) inp.value = p[k] || '';
        }
        const cvEl = document.getElementById('prof-cv');
        if (cvEl) cvEl.value = p.cv_text || '';
        const cvDate = document.getElementById('cv-date');
        if (cvDate) cvDate.textContent = p.cv_updated_at ? 'Derniere MAJ: ' + formatDate(p.cv_updated_at) : '';
    } catch (e) { console.warn('Profile:', e); }
}

async function saveProfile(evt) {
    evt.preventDefault();
    const f = evt.target;
    const data = {};
    for (const k of ['first_name','last_name','phone','company','job_title','sector','bio','linkedin_url']) {
        const inp = document.getElementById('prof-' + k);
        if (inp) data[k] = inp.value;
    }
    try {
        await fetch(`${API}/api/members`, {
            method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken},
            body: JSON.stringify({action: 'update_profile', ...data})
        });
        document.getElementById('profile-success').style.display = 'block';
        setTimeout(() => document.getElementById('profile-success').style.display = 'none', 3000);
    } catch (e) { alert('Erreur: ' + e.message); }
}

async function saveCv(evt) {
    evt.preventDefault();
    const cv = document.getElementById('prof-cv').value;
    try {
        await fetch(`${API}/api/members`, {
            method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken},
            body: JSON.stringify({action: 'update_cv', cv_text: cv})
        });
        document.getElementById('cv-success').style.display = 'block';
        setTimeout(() => document.getElementById('cv-success').style.display = 'none', 3000);
    } catch (e) { alert('Erreur: ' + e.message); }
}

// === LINKEDIN IMPORT ===
async function importLinkedIn() {
    // LinkedIn API requires OAuth - we provide a manual paste approach
    const url = prompt('Collez votre URL de profil LinkedIn :');
    if (!url) return;
    // We store the URL and let user fill details
    try {
        await fetch(`${API}/api/members`, {
            method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken},
            body: JSON.stringify({action: 'import_linkedin', linkedin_data: {profileUrl: url}})
        });
        document.getElementById('prof-linkedin_url').value = url;
        alert('URL LinkedIn enregistree. Completez votre profil avec vos informations LinkedIn.');
    } catch (e) { alert('Erreur: ' + e.message); }
}

// === ADMIN ===
async function loadAdmin() {
    if (!currentUser || !currentUser.is_admin) return;
    try {
        const res = await fetch(`${API}/api/members?action=stats`, {headers: {'Authorization': 'Bearer ' + authToken}});
        const stats = await res.json();
        renderAdmin(stats);
    } catch (e) { console.warn('Admin:', e); }
}

function renderAdmin(s) {
    const el = document.getElementById('admin-stats');
    if (!el) return;
    el.innerHTML = `
        <div class="kpi-row" style="margin-bottom:24px">
            <div class="kpi-card"><div class="kpi-val">${s.total_members||0}</div><div class="kpi-label">Membres total</div></div>
            <div class="kpi-card"><div class="kpi-val">${s.active_members||0}</div><div class="kpi-label">Actifs</div></div>
            <div class="kpi-card"><div class="kpi-val">${s.pending_members||0}</div><div class="kpi-label">En attente</div></div>
            <div class="kpi-card"><div class="kpi-val">${s.unread_messages||0}</div><div class="kpi-label">Messages non lus</div></div>
        </div>
        <h3 style="margin-bottom:12px;color:var(--primary)">Repartition par secteur</h3>
        ${(s.by_sector||[]).map(x => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--gray-100)"><span>${esc(x.sector||'Non renseigne')}</span><strong>${x.n}</strong></div>`).join('')}
    `;
}

// === INIT CHECK ===
document.addEventListener('DOMContentLoaded', async () => {
    if (authToken) {
        const valid = await checkSession();
        if (valid && location.hash === '#membres') showMemberArea();
    }
});
