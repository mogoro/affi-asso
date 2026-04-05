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
    const adminTab = document.getElementById('admin-main-tab');
    if (adminTab) adminTab.style.display = currentUser && currentUser.is_admin ? 'inline-flex' : 'none';

    // Debloquer tout le site
    if (typeof onUserLoggedIn === 'function') onUserLoggedIn();

    switchTab('my-events');
}

// === TAB SYSTEM (flat — one row of tabs) ===
function switchTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.mtab-u').forEach(b => b.classList.remove('active'));
    document.querySelector(`.mtab-u[data-tab="${tab}"]`)?.classList.add('active');

    // Hide all content panels
    document.querySelectorAll('.mtab-content').forEach(c => c.style.display = 'none');
    const content = document.getElementById('mtab-' + tab);
    if (content) content.style.display = 'block';

    // Load data
    if (tab === 'my-events') loadMyEvents();
    if (tab === 'directory') loadDirectory();
    if (tab === 'profile') loadProfile();
    if (tab === 'announcements') { loadAnnouncements(); if (typeof loadMyProposals === 'function') loadMyProposals(); }
    if (tab === 'messages') loadConversations();
    if (tab === 'notifications') loadNotifications();
    if (tab === 'admin') { if (typeof loadAdmin === 'function') loadAdmin(); }
}

// Backward compat
function switchMemberTab(tab) { switchTab(tab); }
function switchMainTab(main) {
    if (main === 'admin') switchTab('admin');
    else switchTab('my-events');
}

// === DASHBOARD: MY EVENTS ===
async function loadMyEvents() {
    const el = document.getElementById('my-events-list');
    if (!el) return;
    try {
        const res = await fetch(`${API}/api/events?action=my_registrations`, {
            headers: {'Authorization': 'Bearer ' + authToken}
        });
        const regs = await res.json();
        if (!regs || !regs.length) {
            el.innerHTML = '<p class="empty-msg">Vous n\'êtes inscrit à aucun événement pour le moment.</p>';
            return;
        }
        el.innerHTML = regs.map(r => {
            const d = new Date(r.start_date);
            const months = ['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc'];
            const isPast = d < new Date();
            return `<div class="evt-card ${isPast ? 'evt-card-past' : ''}" style="cursor:pointer" onclick="showEventDetail(${r.event_id || r.id})">
                <div class="evt-date-col" style="background:${isPast ? 'linear-gradient(135deg,#6c757d,#adb5bd)' : 'linear-gradient(135deg,var(--primary),var(--primary-light))'}">
                    <div class="evt-date-day">${d.getDate()}</div>
                    <div class="evt-date-month">${months[d.getMonth()] || ''}</div>
                    <div class="evt-date-year">${d.getFullYear()}</div>
                </div>
                <div class="evt-body">
                    <div class="evt-title">${esc(r.title)}</div>
                    <div class="evt-meta">
                        ${r.location ? `<span>&#128205; ${esc(r.location)}</span>` : ''}
                        <span class="adm-badge ${isPast ? 'adm-badge-blocked' : 'adm-badge-active'}">${isPast ? 'Passé' : 'À venir'}</span>
                        <span class="adm-badge adm-badge-active">&#10003; Inscrit</span>
                    </div>
                </div>
            </div>`;
        }).join('');
    } catch(e) {
        el.innerHTML = '<p class="empty-msg">Erreur de chargement</p>';
        console.warn('MyEvents:', e);
    }
}

// === DASHBOARD: NEWS ===
async function loadNewsDashboard() {
    try {
        const res = await fetch(`${API}/api/news?limit=10`);
        const news = await res.json();
        const el = document.getElementById('news-dashboard-list');
        if (!el) return;
        if (!news.length) { el.innerHTML = '<p class="empty-msg">Aucune nouveaute</p>'; return; }
        el.innerHTML = news.map(n => `
            <div style="padding:12px 0;border-bottom:1px solid var(--gray-100);display:flex;justify-content:space-between;align-items:center">
                <div>
                    <strong>${esc(n.title)}</strong>
                    <div style="font-size:12px;color:var(--gray-500)">${formatDate(n.published_at)}</div>
                </div>
                ${n.is_published ? '<span class="adm-badge adm-badge-active">Publiee</span>' : ''}
            </div>
        `).join('');
    } catch(e) { console.warn('News dashboard:', e); }
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
    if (!members.length) { el.innerHTML = '<p style="text-align:center;color:var(--gray-400);padding:40px">Aucun membre trouvé</p>'; return; }
    window._dirMembers = {};
    members.forEach(m => window._dirMembers[m.id] = m);

    // Alphabet letters present
    const letters = [...new Set(members.map(m => (m.last_name||'?')[0].toUpperCase()))].sort();

    el.innerHTML = `
        <div class="dir-alpha-bar">${letters.map(l => `<a class="dir-alpha-link" href="#" onclick="event.preventDefault();document.getElementById('dir-letter-${l}')?.scrollIntoView({behavior:'smooth',block:'start'})">${l}</a>`).join('')}</div>
        <div class="dir-results">
            <div class="dir-results-count">${members.length} membre${members.length>1?'s':''}</div>
            ${renderMemberList(members)}
        </div>
    `;
}

function renderMemberList(members) {
    const grouped = {};
    members.forEach(m => {
        const l = (m.last_name||'?')[0].toUpperCase();
        if (!grouped[l]) grouped[l] = [];
        grouped[l].push(m);
    });
    let html = '';
    Object.keys(grouped).sort().forEach(letter => {
        html += `<div class="dir-letter-anchor" id="dir-letter-${letter}">${letter}</div>`;
        html += grouped[letter].map(m => {
            const initials = ((m.first_name||'?')[0] + (m.last_name||'?')[0]).toUpperCase();
            const hasPhoto = m.photo_url && m.photo_url.startsWith('http');
            const availColors = {'en-poste':'var(--green)','ouvert':'var(--orange)','recherche':'var(--accent)','freelance':'var(--teal)'};
            const availLabels = {'en-poste':'En poste','ouvert':'Ouvert','recherche':'En recherche','freelance':'Freelance'};
            return `<div class="dir-member-card" onclick="showMemberModal(${m.id})">
                <div class="dir-mc-avatar">${hasPhoto ? `<img src="${esc(m.photo_url)}" alt="">` : initials}${m.availability && availColors[m.availability] ? `<span class="dir-mc-avail-dot" style="background:${availColors[m.availability]}" title="${availLabels[m.availability]||''}"></span>` : ''}</div>
                <div class="dir-mc-info">
                    <div class="dir-mc-name">${esc(m.first_name)} <strong>${esc(m.last_name)}</strong>${m.is_board ? ' <span class="dir-badge dir-badge-board">Bureau</span>' : ''}${m.is_mentor ? ' <span class="dir-badge dir-badge-mentor">Mentor</span>' : ''}</div>
                    <div class="dir-mc-title">${esc(m.job_title || '')}</div>
                    <div class="dir-mc-company">${esc(m.company || '')}${m.region ? ' · ' + esc(m.region) : ''}</div>
                </div>
                <div class="dir-mc-tags">
                    ${m.sector ? `<span class="dir-mc-tag">${esc(m.sector)}</span>` : ''}
                    ${m.specialty ? `<span class="dir-mc-tag">${esc(m.specialty)}</span>` : ''}
                </div>
                <div class="dir-mc-actions">
                    ${m.linkedin_url ? `<a href="${esc(m.linkedin_url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" class="dir-mc-li" title="LinkedIn">in</a>` : ''}
                </div>
            </div>`;
        }).join('');
    });
    return html;
}

function showMemberModal(id) {
    const m = window._dirMembers?.[id];
    if (!m) return;
    const initials = ((m.first_name||'?')[0] + (m.last_name||'?')[0]).toUpperCase();
    const hasPhoto = m.photo_url && m.photo_url.startsWith('http');
    const availLabels = {'en-poste':'En poste','ouvert':'Ouvert aux opportunités','recherche':'En recherche active','freelance':'Disponible en freelance'};
    const availColors = {'en-poste':'var(--green)','ouvert':'var(--orange)','recherche':'var(--accent)','freelance':'var(--teal)'};

    const html = `<div class="adm-modal-bg" id="member-detail-modal">
        <div class="adm-modal" style="max-width:560px;padding:0;overflow:hidden">
            <div class="dir-modal-header">
                <div class="dir-modal-avatar">${hasPhoto ? `<img src="${esc(m.photo_url)}" alt="">` : `<span>${initials}</span>`}</div>
                <div class="dir-modal-info">
                    <h2 class="dir-modal-name">${esc(m.first_name)} ${esc(m.last_name)}</h2>
                    <p class="dir-modal-job">${esc(m.job_title || 'Membre AFFI')}</p>
                    <p class="dir-modal-company">${esc(m.company || '')}</p>
                </div>
                <button class="auth-close" onclick="closeModal('member-detail-modal')" style="color:#fff">&times;</button>
            </div>
            <div style="padding:24px">
                <div class="dir-modal-badges">
                    ${m.is_board ? '<span class="dir-badge dir-badge-board">Bureau AFFI</span>' : ''}
                    ${m.is_mentor ? '<span class="dir-badge dir-badge-mentor">Mentor</span>' : ''}
                    ${m.availability && availLabels[m.availability] ? `<span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${availColors[m.availability]||'var(--gray-400)'};color:#fff">${availLabels[m.availability]}</span>` : ''}
                    ${m.membership_type ? `<span class="dir-tag">${esc(m.membership_type)}</span>` : ''}
                </div>
                ${m.bio ? `<div class="dir-modal-section"><h4>À propos</h4><p>${esc(m.bio)}</p></div>` : ''}
                ${m.interests ? `<div class="dir-modal-section"><h4>Centres d'intérêt</h4><p>${esc(m.interests)}</p></div>` : ''}
                <div class="dir-modal-grid">
                    ${m.sector ? `<div><span class="dir-modal-label">Secteur</span><span>${esc(m.sector)}</span></div>` : ''}
                    ${m.specialty ? `<div><span class="dir-modal-label">Spécialité</span><span>${esc(m.specialty)}</span></div>` : ''}
                    ${m.region ? `<div><span class="dir-modal-label">Région</span><span>${esc(m.region)}</span></div>` : ''}
                    ${m.phone && m.phone_visible ? `<div><span class="dir-modal-label">Téléphone</span><span>${esc(m.phone)}</span></div>` : ''}
                    ${m.joined_at ? `<div><span class="dir-modal-label">Membre depuis</span><span>${formatDate(m.joined_at)}</span></div>` : ''}
                </div>
                ${m.linkedin_url ? `<div style="margin-top:16px"><a href="${esc(m.linkedin_url)}" target="_blank" rel="noopener" class="dir-card-btn" style="background:#0077b5;color:#fff;display:inline-flex;padding:10px 20px;border-radius:6px;font-size:13px;font-weight:700;text-decoration:none;gap:6px">in Voir le profil LinkedIn</a></div>` : ''}
            </div>
        </div>
    </div>`;
    openModal(html);
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
        for (const k of ['first_name','last_name','phone','company','job_title','sector','bio','linkedin_url','specialty','region','photo_url','interests']) {
            const inp = document.getElementById('prof-' + k);
            if (inp) inp.value = p[k] || '';
        }
        const mentorCb = document.getElementById('prof-is_mentor');
        if (mentorCb) mentorCb.checked = !!p.is_mentor;
        const phoneVisCb = document.getElementById('prof-phone_visible');
        if (phoneVisCb) phoneVisCb.checked = !!p.phone_visible;
        const availSel = document.getElementById('prof-availability');
        if (availSel) availSel.value = p.availability || '';
        const consentAnn = document.getElementById('prof-consent_annuaire');
        if (consentAnn) consentAnn.checked = !!p.consent_annuaire;
        const consentNl = document.getElementById('prof-consent_newsletter');
        if (consentNl) consentNl.checked = !!p.consent_newsletter;
        // Photo preview
        updatePhotoPreview(p.photo_url, p.first_name, p.last_name);
        // Sector chips
        initProfSectorChips();
        const photoInput = document.getElementById('prof-photo_url');
        if (photoInput) photoInput.addEventListener('input', function() {
            updatePhotoPreview(this.value, document.getElementById('prof-first_name')?.value, document.getElementById('prof-last_name')?.value);
        });
        const cvEl = document.getElementById('prof-cv');
        if (cvEl) cvEl.value = p.cv_text || '';
        const cvDate = document.getElementById('cv-date');
        if (cvDate) cvDate.textContent = p.cv_updated_at ? 'Derniere MAJ: ' + formatDate(p.cv_updated_at) : '';
        refreshFormationsList();
    } catch (e) { console.warn('Profile:', e); }
}

async function saveProfile(evt) {
    evt.preventDefault();
    const f = evt.target;
    const data = {};
    for (const k of ['first_name','last_name','phone','company','job_title','sector','bio','linkedin_url','specialty','region','photo_url','interests']) {
        const inp = document.getElementById('prof-' + k);
        if (inp) data[k] = inp.value;
    }
    const mentorCb = document.getElementById('prof-is_mentor');
    if (mentorCb) data.is_mentor = mentorCb.checked;
    const phoneVisCb = document.getElementById('prof-phone_visible');
    if (phoneVisCb) data.phone_visible = phoneVisCb.checked;
    const availSel = document.getElementById('prof-availability');
    if (availSel) data.availability = availSel.value;
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

// === FORMATIONS TRACKING (#37) ===
function addFormation() {
    const title = prompt('Titre de la formation :');
    if (!title) return;
    const date = prompt('Date (ex: Mars 2026) :');
    const org = prompt('Organisme :');
    const cvEl = document.getElementById('prof-cv');
    if (cvEl) {
        const existing = cvEl.value;
        cvEl.value = (existing ? existing + '\n\n' : '') + `FORMATION: ${title}\nDate: ${date || 'Non precisee'}\nOrganisme: ${org || 'Non precise'}`;
    }
    refreshFormationsList();
    if (typeof showToast === 'function') showToast('Formation ajoutee au CV', 'success');
}

function refreshFormationsList() {
    const el = document.getElementById('prof-formations-list');
    if (!el) return;
    const cvEl = document.getElementById('prof-cv');
    if (!cvEl || !cvEl.value) { el.innerHTML = '<em>Aucune formation enregistree</em>'; return; }
    const lines = cvEl.value.split('\n');
    const formations = [];
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('FORMATION:')) {
            const title = lines[i].replace('FORMATION:', '').trim();
            const date = (lines[i+1] && lines[i+1].startsWith('Date:')) ? lines[i+1].replace('Date:', '').trim() : '';
            const org = (lines[i+2] && lines[i+2].startsWith('Organisme:')) ? lines[i+2].replace('Organisme:', '').trim() : '';
            formations.push({title, date, org});
        }
    }
    if (!formations.length) { el.innerHTML = '<em>Aucune formation enregistree</em>'; return; }
    el.innerHTML = formations.map(f => `<div style="padding:6px 0;border-bottom:1px solid var(--gray-100)"><strong>${esc(f.title)}</strong>${f.date ? ' — ' + esc(f.date) : ''}${f.org ? ' <span style="color:var(--gray-400)">(' + esc(f.org) + ')</span>' : ''}</div>`).join('');
}

// === QR CARTE DE VISITE (#35) ===
function generateMemberQR() {
    if (!currentUser) return;
    const data = `BEGIN:VCARD\nVERSION:3.0\nFN:${currentUser.first_name} ${currentUser.last_name}\nORG:${currentUser.company||'AFFI'}\nTITLE:${currentUser.job_title||''}\nEMAIL:${currentUser.email}\nURL:https://affi-asso.vercel.app/#annuaire\nEND:VCARD`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}`;

    const html = `<div class="adm-modal-bg" id="qr-modal">
        <div class="adm-modal" style="max-width:360px;text-align:center">
            <button class="auth-close" onclick="closeModal('qr-modal')">&times;</button>
            <div style="padding:28px">
                <h3 style="color:var(--primary);margin-bottom:16px">Ma carte de visite</h3>
                <img src="${qrUrl}" alt="QR Code" style="width:200px;height:200px;border-radius:8px;border:2px solid var(--gray-200)">
                <p style="margin-top:12px;font-size:15px;font-weight:800;color:var(--gray-900)">${esc(currentUser.first_name)} ${esc(currentUser.last_name)}</p>
                <p style="font-size:13px;color:var(--gray-500)">${esc(currentUser.job_title||'')}${currentUser.company ? ' · ' + esc(currentUser.company) : ''}</p>
                <p style="margin-top:16px;font-size:12px;color:var(--gray-400)">Scannez ce QR code pour ajouter ce contact</p>
                <a href="${qrUrl}" download="carte-affi.png" class="btn btn-primary" style="font-size:12px;padding:8px 16px;margin-top:12px;display:inline-block">Telecharger le QR</a>
            </div>
        </div>
    </div>`;
    openModal(html);
}

// === LINKEDIN IMPORT ===
function importLinkedIn() {
    const html = `<div class="adm-modal-bg" id="linkedin-modal">
        <div class="adm-modal" style="max-width:560px">
            <button class="auth-close" onclick="closeModal('linkedin-modal')">&times;</button>
            <div style="padding:28px">
                <div style="text-align:center;margin-bottom:20px">
                    <div style="font-size:36px;margin-bottom:8px;color:#0077b5">in</div>
                    <h2 style="font-size:20px;font-weight:900;color:var(--primary);margin:0">Importer depuis LinkedIn</h2>
                    <p style="font-size:13px;color:var(--gray-500);margin-top:4px">Copiez-collez les informations de votre profil LinkedIn</p>
                </div>
                <div class="form-group"><label>URL du profil LinkedIn</label><input type="url" id="li-url" placeholder="https://www.linkedin.com/in/votre-profil"></div>
                <div class="form-group"><label>Titre / Headline</label><input type="text" id="li-headline" placeholder="Ex: Ingénieur Signalisation chez SNCF Réseau"></div>
                <div class="form-group"><label>Entreprise actuelle</label><input type="text" id="li-company" placeholder="Ex: SNCF Réseau"></div>
                <div class="form-group"><label>Résumé / À propos</label><textarea id="li-summary" style="min-height:80px" placeholder="Copiez votre section 'À propos' de LinkedIn"></textarea></div>
                <div class="form-group"><label>Expériences (copiez-collez)</label><textarea id="li-experience" style="min-height:100px" placeholder="Copiez vos expériences professionnelles depuis LinkedIn. Chaque ligne sera ajoutée à votre CV."></textarea></div>
                <div class="form-group"><label>Formation</label><textarea id="li-education" style="min-height:60px" placeholder="Ex: ENPC - Ingénieur Civil, 2015"></textarea></div>
                <div class="form-group"><label>Compétences (séparées par des virgules)</label><input type="text" id="li-skills" placeholder="ERTMS, Signalisation, Gestion de projet..."></div>
                <button onclick="applyLinkedInImport()" class="btn btn-accent" style="width:100%;font-size:15px;padding:12px">Importer dans mon profil</button>
            </div>
        </div>
    </div>`;
    openModal(html);
}

async function applyLinkedInImport() {
    const url = document.getElementById('li-url').value.trim();
    const headline = document.getElementById('li-headline').value.trim();
    const company = document.getElementById('li-company').value.trim();
    const summary = document.getElementById('li-summary').value.trim();
    const experience = document.getElementById('li-experience').value.trim();
    const education = document.getElementById('li-education').value.trim();
    const skills = document.getElementById('li-skills').value.trim();

    // Remplir le profil
    if (url) document.getElementById('prof-linkedin_url').value = url;
    if (headline) document.getElementById('prof-job_title').value = headline;
    if (company) document.getElementById('prof-company').value = company;
    if (summary) document.getElementById('prof-bio').value = summary;

    // Construire le CV à partir des données LinkedIn
    let cvParts = [];
    if (summary) cvParts.push('RÉSUMÉ\n' + summary);
    if (experience) cvParts.push('\nEXPÉRIENCES PROFESSIONNELLES\n' + experience);
    if (education) cvParts.push('\nFORMATION\n' + education);
    if (skills) cvParts.push('\nCOMPÉTENCES\n' + skills);

    if (cvParts.length > 0) {
        const cvEl = document.getElementById('prof-cv');
        if (cvEl) {
            const existing = cvEl.value.trim();
            if (existing) {
                cvEl.value = cvParts.join('\n') + '\n\n--- Contenu précédent ---\n' + existing;
            } else {
                cvEl.value = cvParts.join('\n');
            }
        }
    }

    // Enregistrer le lien LinkedIn via l'API
    if (url) {
        try {
            await fetch(`${API}/api/members`, {
                method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken},
                body: JSON.stringify({action: 'import_linkedin', linkedin_data: {profileUrl: url, headline, company, summary}})
            });
        } catch(e) {}
    }

    // Mettre à jour les chips secteur si compétences fournies
    if (skills && typeof initProfSectorChips === 'function') {
        const sectorInput = document.getElementById('prof-sector');
        if (sectorInput && !sectorInput.value) {
            sectorInput.value = skills;
            initProfSectorChips();
        }
    }

    closeModal('linkedin-modal');
    if (typeof showToast === 'function') showToast('Profil et CV mis à jour depuis LinkedIn !', 'success');
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

// === UNIFIED CONTRIBUTION FORM ===
function updateContribForm() {
    const type = document.getElementById('contrib-type').value;
    const eventFields = document.getElementById('contrib-event-fields');
    const jobFields = document.getElementById('contrib-job-fields');
    if (eventFields) eventFields.style.display = (type === 'evenement') ? 'block' : 'none';
    if (jobFields) jobFields.style.display = (['emploi','stage','apprentissage'].includes(type)) ? 'block' : 'none';
}

function previewContribImage(input) {
    const preview = document.getElementById('contrib-image-preview');
    const img = document.getElementById('contrib-image-img');
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            img.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

async function submitContribution(evt) {
    evt.preventDefault();
    const type = document.getElementById('contrib-type').value;
    const title = document.getElementById('contrib-title').value;
    const content = document.getElementById('contrib-content').value;

    if (type === 'evenement') {
        // Use existing propose_event endpoint
        try {
            const res = await fetch(`${API}/api/members`, {
                method: 'POST',
                headers: {'Content-Type':'application/json','Authorization':'Bearer '+authToken},
                body: JSON.stringify({
                    action: 'propose_event',
                    title, description: content,
                    event_type: document.getElementById('contrib-event-type').value,
                    location: document.getElementById('contrib-location').value,
                    start_date: document.getElementById('contrib-start').value,
                    end_date: document.getElementById('contrib-end').value || null,
                })
            });
            const data = await res.json();
            if (data.ok || data.message) {
                document.getElementById('contrib-success').style.display = 'block';
                evt.target.reset();
                updateContribForm();
                showToast('Proposition soumise !','success');
                loadMyProposals();
            } else {
                showToast(data.error||'Erreur','error');
            }
        } catch(e) { showToast('Erreur: ' + e.message, 'error'); }
    } else if (type === 'actualite') {
        // Use existing propose_news endpoint
        try {
            const res = await fetch(`${API}/api/members`, {
                method: 'POST',
                headers: {'Content-Type':'application/json','Authorization':'Bearer '+authToken},
                body: JSON.stringify({action:'propose_news', title, content, excerpt: content.substring(0, 200)})
            });
            const data = await res.json();
            if (data.ok || data.message) {
                document.getElementById('contrib-success').style.display = 'block';
                evt.target.reset();
                updateContribForm();
                showToast('Proposition soumise !','success');
                loadMyProposals();
            } else {
                showToast(data.error||'Erreur','error');
            }
        } catch(e) { showToast('Erreur: ' + e.message, 'error'); }
    } else {
        // Announcement types: annonce, emploi, stage, apprentissage, collaboration
        const jobData = ['emploi','stage','apprentissage'].includes(type) ? {
            company: document.getElementById('contrib-company')?.value || '',
            location: document.getElementById('contrib-job-location')?.value || '',
            sector: document.getElementById('contrib-job-sector')?.value || '',
            duration: document.getElementById('contrib-job-duration')?.value || '',
            contact_email: document.getElementById('contrib-job-email')?.value || '',
        } : {};
        const fullContent = ['emploi','stage','apprentissage'].includes(type)
            ? `${content}\n\n---\nEntreprise : ${jobData.company}\nLieu : ${jobData.location}\nDomaine : ${jobData.sector}\nDuree : ${jobData.duration}\nContact : ${jobData.contact_email}`
            : content;
        try {
            const res = await fetch(`${API}/api/social`, {
                method: 'POST',
                headers: {'Content-Type':'application/json','Authorization':'Bearer '+authToken},
                body: JSON.stringify({action:'post_announcement', title, content: fullContent, category: type})
            });
            const data = await res.json();
            if (data.ok || data.message) {
                document.getElementById('contrib-success').style.display = 'block';
                evt.target.reset();
                updateContribForm();
                showToast('Annonce publiee !','success');
                loadContributions();
                loadMyProposals();
            } else {
                showToast(data.error||'Erreur','error');
            }
        } catch(e) { showToast('Erreur: ' + e.message, 'error'); }
    }
}

async function loadContributions() {
    try {
        const res = await fetch(`${API}/api/social?action=announcements`);
        const items = await res.json();
        const el = document.getElementById('contributions-list');
        if (!el) return;
        if (!items.length) { el.innerHTML = '<p class="empty-msg">Aucune annonce pour le moment</p>'; return; }
        el.innerHTML = items.map(a => `
            <div style="padding:16px;border-bottom:1px solid var(--gray-100)">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                    <span class="card-tag" style="background:${a.category==='emploi'?'var(--green)':a.category==='collaboration'?'var(--teal)':'var(--primary)'}">${esc(a.category||'general')}</span>
                    <span style="font-size:12px;color:var(--gray-400)">${formatDate(a.created_at)}</span>
                </div>
                <div style="font-weight:700;color:var(--primary);font-size:15px">${esc(a.title)}</div>
                <div style="font-size:13px;color:var(--gray-600);margin-top:4px">${esc((a.content||'').substring(0,200))}</div>
                <div style="font-size:12px;color:var(--gray-400);margin-top:8px">Par ${esc(a.first_name||'')} ${esc(a.last_name||'')}</div>
            </div>
        `).join('');
    } catch (e) { console.warn('Contributions:', e); }
}

// === PROFILE SECTOR CHIPS ===
const PROFILE_SECTORS = ['Signalisation & ERTMS','Matériel roulant','Infrastructure','Maintenance','Numérique & IA','Ingénierie & Conseil','Génie civil','Télécoms','Énergie','Management','Exploitation','Recherche & Formation'];

function initProfSectorChips() {
    const container = document.getElementById('prof-sector-chips');
    if (!container) return;
    const currentVal = document.getElementById('prof-sector')?.value || '';
    const selected = currentVal.split(',').map(s => s.trim()).filter(Boolean);
    container.innerHTML = PROFILE_SECTORS.map(s => {
        const active = selected.includes(s);
        return `<span class="sector-chip ${active ? 'sector-chip-active' : ''}" onclick="toggleProfSector(this,'${s}')">${s}</span>`;
    }).join('');
}

function toggleProfSector(el, sector) {
    el.classList.toggle('sector-chip-active');
    const chips = document.querySelectorAll('#prof-sector-chips .sector-chip-active');
    const values = Array.from(chips).map(c => c.textContent);
    document.getElementById('prof-sector').value = values.join(', ');
}

// === PHOTO PREVIEW ===
function previewProfilePhoto(input) {
    if (!input.files || !input.files[0]) return;
    resizeImage(input.files[0], 300, 300, function(dataUrl) {
        document.getElementById('prof-photo_url').value = dataUrl;
        updatePhotoPreview(dataUrl, document.getElementById('prof-first_name')?.value, document.getElementById('prof-last_name')?.value);
    });
}

function updatePhotoPreview(url, firstName, lastName) {
    const preview = document.getElementById('prof-photo-preview');
    const initialsEl = document.getElementById('prof-photo-initials');
    if (!preview) return;
    if (url && (url.startsWith('http') || url.startsWith('data:'))) {
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
        if (data.ok) {
            resetToken = data.reset_token || '';
            document.getElementById('reset-step1').style.display = 'none';
            document.getElementById('reset-step2').style.display = 'block';
            document.getElementById('reset-code-display').innerHTML =
                '<p style="color:var(--green);font-weight:600;margin-bottom:12px">Un code de réinitialisation a été généré. Contactez un administrateur pour l\'obtenir.</p>';
        } else {
            document.getElementById('reset-step1').style.display = 'none';
            document.getElementById('reset-step2').style.display = 'block';
            document.getElementById('reset-code-display').innerHTML =
                '<p style="color:var(--green);font-weight:600;margin-bottom:12px">Si ce compte existe, un code de réinitialisation a été généré. Contactez un administrateur.</p>';
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

// === RGPD EXPORT ===
async function exportMyData() {
    try {
        const res = await fetch(`${API}/api/members?action=profile`, {headers:{'Authorization':'Bearer '+authToken}});
        const profile = await res.json();
        // Remove sensitive fields
        delete profile.password_hash;
        const data = {
            export_date: new Date().toISOString(),
            rgpd_notice: "Export de vos données personnelles conformément au RGPD (Art. 15 & 20)",
            profile: profile,
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `affi_mes_donnees_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
        if (typeof showToast === 'function') showToast('Données exportées', 'success');
    } catch(e) { alert('Erreur export'); }
}
