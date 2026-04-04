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
    if (tab === 'announcements') loadAnnouncements();
    if (tab === 'messages') loadConversations();
    if (tab === 'proposer') { loadMyProposals(); if (typeof loadContributions === 'function') loadContributions(); }
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
                <div class="ec-name">${esc(m.first_name)} ${esc(m.last_name)}${typeof verifiedBadge==='function' ? verifiedBadge(m.is_verified) : ''}</div>
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
                    <button onclick="event.stopPropagation();startConversation(${m.id},'${esc(m.first_name).replace(/'/g,"&#39;")} ${esc(m.last_name).replace(/'/g,"&#39;")}')" class="ec-btn ec-btn-msg">&#128172; Message</button>
                    ${typeof renderEndorseButton==='function' ? renderEndorseButton(m.id, m.first_name+' '+m.last_name) : ''}
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
