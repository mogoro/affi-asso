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
    if (typeof onUserLoggedOut === 'function') onUserLoggedOut();
}

async function showMemberArea() {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('member-area').style.display = 'block';
    document.getElementById('reset-section') && (document.getElementById('reset-section').style.display = 'none');

    // Update welcome
    const w = document.getElementById('welcome-name');
    if (w && currentUser) w.textContent = currentUser.first_name + ' ' + currentUser.last_name;

    // Show admin tab if admin
    const adminTab = document.getElementById('admin-tab');
    if (adminTab) adminTab.style.display = currentUser && currentUser.is_admin ? 'inline-block' : 'none';

    // Debloquer tout le site
    if (typeof onUserLoggedIn === 'function') onUserLoggedIn();

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
    // communaute, carriere, formations, cartographie sont sur la page d'accueil et identite
    if (tab === 'proposer') loadMyProposals();
    if (tab === 'profile') loadProfile();
    if (tab === 'messages') loadConversations();
    if (tab === 'notifications') loadNotifications();
    if (tab === 'admin') loadAdmin();
}

// === DIRECTORY ===
async function loadDirectory(search, sector, specialty, mentor) {
    const params = new URLSearchParams({action: 'directory'});
    if (search) params.set('search', search);
    if (sector) params.set('sector', sector);
    if (specialty) params.set('specialty', specialty);
    if (mentor) params.set('mentor', mentor);
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
        const hasPhoto = m.photo_url && m.photo_url.startsWith('http');
        const avatarHtml = hasPhoto
            ? `<img src="${esc(m.photo_url)}" alt="${esc(m.first_name)}" class="ec-photo">`
            : `<div class="ec-initials">${esc(initials.toUpperCase())}</div>`;
        return `<div class="expert-card" onclick="toggleMemberDetail(this)">
            <div class="ec-banner">
                ${m.is_mentor ? '<div class="ec-mentor-flag">&#127891; Mentor</div>' : ''}
                ${m.is_board ? '<div class="ec-board-flag">Bureau AFFI</div>' : ''}
            </div>
            <div class="ec-avatar-wrap">
                ${avatarHtml}
            </div>
            <div class="ec-body">
                <div class="ec-name">${esc(m.first_name)} ${esc(m.last_name)}</div>
                <div class="ec-job">${esc(m.job_title || '')}</div>
                <div class="ec-company">${esc(m.company || '')}</div>
                ${m.region ? `<div class="ec-location">&#128205; ${esc(m.region)}</div>` : ''}
            </div>
            <div class="ec-expertise">
                ${m.specialty ? `<span class="ec-tag ec-tag-specialty">${esc(m.specialty)}</span>` : ''}
                ${m.sector ? `<span class="ec-tag">${esc(m.sector)}</span>` : ''}
            </div>
            <div class="ec-expand">
                ${m.bio ? `<div class="ec-bio">${esc((m.bio || '').substring(0, 200))}${(m.bio||'').length > 200 ? '...' : ''}</div>` : '<div class="ec-bio" style="color:var(--gray-400);font-style:italic">Pas de bio renseignee</div>'}
                <div class="ec-meta">
                    ${m.joined_at ? `<span>&#128197; Membre depuis ${formatDate(m.joined_at)}</span>` : ''}
                </div>
                <div class="ec-actions">
                    <button onclick="event.stopPropagation();startConversation(${m.id},'${esc(m.first_name)} ${esc(m.last_name)}')" class="ec-btn ec-btn-msg">&#128172; Message</button>
                    ${m.linkedin_url ? `<a href="${esc(m.linkedin_url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" class="ec-btn ec-btn-li">in LinkedIn</a>` : ''}
                </div>
            </div>
            <div class="ec-footer">
                <span class="ec-rgpd">${m.consent_annuaire ? '&#128994; Public' : '&#128308; Prive'}</span>
                <span class="ec-expand-hint">&#9660;</span>
            </div>
        </div>`;
    }).join('');
}

function toggleMemberDetail(card) {
    card.classList.toggle('mc-expanded');
}

let _dirSearch;
function onDirSearch(v) {
    clearTimeout(_dirSearch);
    _dirSearch = setTimeout(() => onDirFilter(), 300);
}
function onDirFilter() {
    const search = document.getElementById('dir-search')?.value || '';
    const sector = document.getElementById('dir-sector')?.value || '';
    const specialty = document.getElementById('dir-specialty')?.value || '';
    const mentor = document.getElementById('dir-mentor')?.checked ? '1' : '';
    loadDirectory(search, sector, specialty, mentor);
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
        for (const k of ['first_name','last_name','phone','company','job_title','sector','bio','linkedin_url','specialty','region','photo_url']) {
            const inp = document.getElementById('prof-' + k);
            if (inp) inp.value = p[k] || '';
        }
        const mentorCb = document.getElementById('prof-is_mentor');
        if (mentorCb) mentorCb.checked = !!p.is_mentor;
        const consentAnn = document.getElementById('prof-consent_annuaire');
        if (consentAnn) consentAnn.checked = !!p.consent_annuaire;
        const consentNl = document.getElementById('prof-consent_newsletter');
        if (consentNl) consentNl.checked = !!p.consent_newsletter;
        // Photo preview
        updatePhotoPreview(p.photo_url, p.first_name, p.last_name);
        const photoInput = document.getElementById('prof-photo_url');
        if (photoInput) photoInput.addEventListener('input', function() {
            updatePhotoPreview(this.value, document.getElementById('prof-first_name')?.value, document.getElementById('prof-last_name')?.value);
        });
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
    for (const k of ['first_name','last_name','phone','company','job_title','sector','bio','linkedin_url','specialty','region','photo_url']) {
        const inp = document.getElementById('prof-' + k);
        if (inp) data[k] = inp.value;
    }
    const mentorCb = document.getElementById('prof-is_mentor');
    if (mentorCb) data.is_mentor = mentorCb.checked;
    const consentAnn = document.getElementById('prof-consent_annuaire');
    if (consentAnn) data.consent_annuaire = consentAnn.checked;
    const consentNl = document.getElementById('prof-consent_newsletter');
    if (consentNl) data.consent_newsletter = consentNl.checked;
    try {
        await fetch(`${API}/api/members`, {
            method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken},
            body: JSON.stringify({action: 'update_profile', ...data})
        });
        const el = document.getElementById('profile-success');
        const annuaire = document.getElementById('prof-consent_annuaire')?.checked;
        el.innerHTML = annuaire
            ? 'Profil mis a jour ! &#128994; Votre profil est visible dans l\'annuaire public.'
            : 'Profil mis a jour ! &#128308; Votre profil n\'est PAS visible dans l\'annuaire public.';
        el.style.display = 'block';
        setTimeout(() => el.style.display = 'none', 5000);
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

// === PROPOSITIONS ===
async function proposeEvent(evt) {
    evt.preventDefault();
    try {
        const res = await fetch(`${API}/api/members`, {
            method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken},
            body: JSON.stringify({
                action: 'propose_event',
                title: document.getElementById('pe-title').value,
                event_type: document.getElementById('pe-type').value,
                location: document.getElementById('pe-location').value,
                start_date: document.getElementById('pe-start').value,
                end_date: document.getElementById('pe-end').value || null,
                description: document.getElementById('pe-desc').value,
            })
        });
        const data = await res.json();
        const el = document.getElementById('pe-success');
        el.textContent = data.message; el.style.display = 'block';
        evt.target.reset();
        setTimeout(() => el.style.display = 'none', 5000);
        loadMyProposals();
    } catch (e) { alert('Erreur: ' + e.message); }
}

async function proposeNews(evt) {
    evt.preventDefault();
    try {
        const res = await fetch(`${API}/api/members`, {
            method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken},
            body: JSON.stringify({
                action: 'propose_news',
                title: document.getElementById('pn-title').value,
                excerpt: document.getElementById('pn-excerpt').value,
                content: document.getElementById('pn-content').value,
            })
        });
        const data = await res.json();
        const el = document.getElementById('pn-success');
        el.textContent = data.message; el.style.display = 'block';
        evt.target.reset();
        setTimeout(() => el.style.display = 'none', 5000);
        loadMyProposals();
    } catch (e) { alert('Erreur: ' + e.message); }
}

async function loadMyProposals() {
    try {
        const res = await fetch(`${API}/api/members`, {
            method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken},
            body: JSON.stringify({action: 'my_proposals'})
        });
        const data = await res.json();
        const el = document.getElementById('my-proposals');
        if (!el) return;
        const all = [
            ...(data.events||[]).map(e => ({...e, type: 'Evenement', published: e.is_published})),
            ...(data.news||[]).map(n => ({...n, type: 'Actualite', published: n.is_published})),
            ...(data.announcements||[]).map(a => ({...a, type: 'Annonce', published: a.is_active})),
        ].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
        if (!all.length) { el.innerHTML = '<p class="empty-msg">Aucune proposition</p>'; return; }
        el.innerHTML = all.map(p => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--gray-100)">
                <div>
                    <span class="card-tag" style="margin-right:8px">${esc(p.type)}</span>
                    <strong>${esc(p.title)}</strong>
                    <span style="font-size:12px;color:var(--gray-400);margin-left:8px">${formatDate(p.created_at)}</span>
                </div>
                <span class="adm-badge ${p.published ? 'adm-badge-active' : 'adm-badge-pending'}">${p.published ? 'Publie' : 'En attente'}</span>
            </div>
        `).join('');
    } catch (e) { console.warn('Proposals:', e); }
}

// === PHOTO PREVIEW ===
function updatePhotoPreview(url, firstName, lastName) {
    const preview = document.getElementById('prof-photo-preview');
    const initialsEl = document.getElementById('prof-photo-initials');
    if (!preview) return;
    if (url && url.startsWith('http')) {
        preview.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.innerHTML='<span style=\\'color:#fff;font-weight:800;font-size:18px\\'>${((firstName||'?')[0]+(lastName||'?')[0]).toUpperCase()}</span>'">`;
    } else {
        const initials = ((firstName||'?')[0] + (lastName||'?')[0]).toUpperCase();
        preview.innerHTML = `<span style="color:#fff;font-weight:800;font-size:18px">${initials}</span>`;
    }
}

// === PASSWORD RESET ===
let resetToken = '';

function showResetForm() {
    document.getElementById('reset-section').style.display = 'block';
    document.getElementById('reset-step1').style.display = 'block';
    document.getElementById('reset-step2').style.display = 'none';
    document.getElementById('reset-success').style.display = 'none';
    document.getElementById('reset-error').style.display = 'none';
}

async function requestReset(evt) {
    evt.preventDefault();
    const email = document.getElementById('reset-email').value.trim();
    try {
        const res = await fetch(`${API}/api/auth`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({action: 'request_reset', email})
        });
        const data = await res.json();
        if (data.ok && data.reset_code) {
            resetToken = data.reset_token;
            document.getElementById('reset-step1').style.display = 'none';
            document.getElementById('reset-step2').style.display = 'block';
            document.getElementById('reset-code-display').innerHTML =
                `<strong>Code de reinitialisation :</strong><br>` +
                `<span style="font-size:32px;font-weight:900;color:var(--primary);letter-spacing:8px">${data.reset_code}</span><br>` +
                `<span style="font-size:12px;color:var(--gray-500)">Valable 1 heure — pour ${email}</span>`;
        } else {
            showResetError(data.message || 'Erreur');
        }
    } catch (e) { showResetError('Erreur reseau'); }
}

async function resetPassword(evt) {
    evt.preventDefault();
    const code = document.getElementById('reset-code').value.trim();
    const pw1 = document.getElementById('reset-newpw').value;
    const pw2 = document.getElementById('reset-newpw2').value;
    if (pw1 !== pw2) return showResetError('Les mots de passe ne correspondent pas');
    if (pw1.length < 6) return showResetError('Le mot de passe doit faire au moins 6 caracteres');
    try {
        const res = await fetch(`${API}/api/auth`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({action: 'reset_password', reset_token: resetToken, reset_code: code, new_password: pw1})
        });
        const data = await res.json();
        if (data.ok) {
            document.getElementById('reset-step2').style.display = 'none';
            document.getElementById('reset-success').style.display = 'block';
            document.getElementById('reset-error').style.display = 'none';
        } else {
            showResetError(data.error || 'Code invalide ou expire');
        }
    } catch (e) { showResetError('Erreur reseau'); }
}

function showResetError(msg) {
    const el = document.getElementById('reset-error');
    el.textContent = msg;
    el.style.display = 'block';
}

// === INIT CHECK ===
document.addEventListener('DOMContentLoaded', async () => {
    if (authToken) {
        const valid = await checkSession();
        if (valid) {
            if (typeof onUserLoggedIn === 'function') onUserLoggedIn();
            if (location.hash === '#membres') showMemberArea();
        } else {
            authToken = '';
            localStorage.removeItem('affi_token');
        }
    }
    if (typeof updateNavbarState === 'function') updateNavbarState();
});
