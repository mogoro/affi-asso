/**
 * AFFI Admin Panel Logic
 */

let adminData = {};

async function loadAdmin() {
    if (!currentUser || !currentUser.is_admin) return;
    switchAdminSection('adm-dashboard');
    loadAdminDashboard();
}

function switchAdminSection(id) {
    document.querySelectorAll('.adm-section').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.adm-nav-btn').forEach(el => el.classList.remove('active'));
    const panel = document.getElementById(id);
    if (panel) panel.style.display = 'block';
    const btn = document.querySelector(`.adm-nav-btn[data-section="${id}"]`);
    if (btn) btn.classList.add('active');
    if (id === 'adm-dashboard') loadAdminDashboard();
    if (id === 'adm-members') loadAdminMembers();
    if (id === 'adm-events') loadAdminEvents();
    if (id === 'adm-news') loadAdminNews();
    if (id === 'adm-announcements') loadAdminAnnouncements();
    if (id === 'adm-messages') loadAdminMessages();
    if (id === 'adm-pending') loadPendingContent();
    if (id === 'adm-logs') loadAdminLogs();
}

async function adminFetch(action, params) {
    const p = new URLSearchParams({action, ...params});
    const res = await fetch(`${API}/api/admin?${p}`, {headers: {'Authorization': 'Bearer ' + authToken}});
    return res.json();
}

async function adminPost(data) {
    const res = await fetch(`${API}/api/admin`, {
        method: 'POST', headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken},
        body: JSON.stringify(data)
    });
    return res.json();
}

// === DASHBOARD ===
async function loadAdminDashboard() {
    const s = await adminFetch('dashboard', {});
    adminData.dashboard = s;
    const el = document.getElementById('adm-dashboard-content');
    if (!el) return;
    el.innerHTML = `
        <div class="kpi-row">
            <div class="kpi-card" style="border-top-color:var(--primary)"><div class="kpi-val">${s.total_members||0}</div><div class="kpi-label">Membres total</div></div>
            <div class="kpi-card" style="border-top-color:var(--green)"><div class="kpi-val">${s.active_members||0}</div><div class="kpi-label">Actifs</div></div>
            <div class="kpi-card" style="border-top-color:var(--orange)"><div class="kpi-val">${s.pending_members||0}</div><div class="kpi-label">En attente</div></div>
            <div class="kpi-card" style="border-top-color:var(--accent)"><div class="kpi-val">${s.unread_messages||0}</div><div class="kpi-label">Messages non lus</div></div>
            <div class="kpi-card" style="border-top-color:var(--teal)"><div class="kpi-val">${s.mentors||0}</div><div class="kpi-label">Mentors</div></div>
            <div class="kpi-card" style="border-top-color:var(--purple)"><div class="kpi-val">${s.consent_annuaire||0}</div><div class="kpi-label">Annuaire public</div></div>
        </div>
        ${s.incomplete_profiles > 0 ? `<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:var(--radius);padding:12px 16px;margin-bottom:20px;font-size:14px;color:#92400e"><strong>Alerte :</strong> ${s.incomplete_profiles} profil(s) incomplet(s) (secteur, entreprise ou specialite manquant)</div>` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">
            <div class="card"><div class="card-body">
                <h3 style="color:var(--primary);margin-bottom:16px">Derniers inscrits</h3>
                ${(s.recent_members||[]).map(m => `
                    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--gray-100)">
                        <div><strong>${esc(m.first_name)} ${esc(m.last_name)}</strong><br><span style="font-size:12px;color:var(--gray-500)">${esc(m.email)}</span></div>
                        <span class="adm-badge adm-badge-${m.status}">${m.status}</span>
                    </div>`).join('')}
            </div></div>
            <div class="card"><div class="card-body">
                <h3 style="color:var(--primary);margin-bottom:16px">Par secteur</h3>
                ${(s.by_sector||[]).map(x => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--gray-100)"><span>${esc(x.sector||'Non renseigne')}</span><strong>${x.n}</strong></div>`).join('')}
            </div></div>
            <div class="card"><div class="card-body">
                <h3 style="color:var(--primary);margin-bottom:16px">Par region</h3>
                ${(s.by_region||[]).map(x => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--gray-100)"><span>${esc(x.region||'Non renseignee')}</span><strong>${x.n}</strong></div>`).join('')}
            </div></div>
            <div class="card"><div class="card-body">
                <h3 style="color:var(--primary);margin-bottom:16px">Par specialite</h3>
                ${(s.by_specialty||[]).map(x => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--gray-100)"><span>${esc(x.specialty||'Non renseignee')}</span><strong>${x.n}</strong></div>`).join('')}
            </div></div>
        </div>`;
}

// === MEMBERS MANAGEMENT ===
async function loadAdminMembers(status, search) {
    const params = {};
    if (status) params.status = status;
    if (search) params.search = search;
    const members = await adminFetch('members', params);
    const el = document.getElementById('adm-members-list');
    if (!el) return;
    el.innerHTML = `<table class="adm-table"><thead><tr>
        <th>Nom</th><th>Email</th><th>Entreprise</th><th>Secteur</th><th>Type</th><th>Statut</th><th>Inscrit le</th><th>Actions</th>
    </tr></thead><tbody>${members.map(m => `<tr>
        <td><strong>${esc(m.first_name)} ${esc(m.last_name)}</strong></td>
        <td style="font-size:13px">${esc(m.email)}</td>
        <td>${esc(m.company||'')}</td>
        <td><span class="card-tag">${esc(m.sector||'-')}</span></td>
        <td>${esc(m.membership_type)}</td>
        <td><span class="adm-badge adm-badge-${m.status}">${m.status}</span></td>
        <td style="font-size:12px">${formatDate(m.joined_at)}</td>
        <td class="adm-actions">
            ${m.status==='pending' ? `<button onclick="adminAction('approve_member',${m.id})" class="adm-btn adm-btn-ok" title="Approuver">&#10003;</button>` : ''}
            ${m.status==='active' ? `<button onclick="adminAction('block_member',${m.id})" class="adm-btn adm-btn-warn" title="Bloquer">&#10007;</button>` : ''}
            ${m.status==='blocked' ? `<button onclick="adminAction('activate_member',${m.id})" class="adm-btn adm-btn-ok" title="Reactiver">&#8635;</button>` : ''}
            <button onclick="editMember(${m.id})" class="adm-btn" title="Modifier">&#9998;</button>
            ${!m.is_admin ? `<button onclick="adminAction('delete_member',${m.id})" class="adm-btn adm-btn-danger" title="Supprimer">&#128465;</button>` : ''}
        </td>
    </tr>`).join('')}</tbody></table>`;
}

async function adminAction(action, id) {
    if (action.includes('delete') && !confirm('Confirmer la suppression ?')) return;
    if (action === 'block_member' && !confirm('Bloquer ce membre ?')) return;
    await adminPost({action, id});
    // Reload current section
    const active = document.querySelector('.adm-nav-btn.active');
    if (active) switchAdminSection(active.dataset.section);
}

async function editMember(id) {
    const m = await adminFetch('member_detail', {id: String(id)});
    if (!m || m.error) return alert('Membre introuvable');
    const html = `<div class="adm-modal-bg" id="member-modal" onclick="if(event.target===this)this.remove()">
        <div class="adm-modal">
            <h3 style="margin-bottom:20px;color:var(--primary)">Modifier le membre #${m.id}</h3>
            <form onsubmit="saveMemberEdit(event,${m.id})">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                    <div class="form-group"><label>Prenom</label><input id="em-fn" value="${esc(m.first_name||'')}"></div>
                    <div class="form-group"><label>Nom</label><input id="em-ln" value="${esc(m.last_name||'')}"></div>
                </div>
                <div class="form-group"><label>Email</label><input id="em-email" value="${esc(m.email||'')}"></div>
                <div class="form-group"><label>Telephone</label><input id="em-phone" value="${esc(m.phone||'')}"></div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                    <div class="form-group"><label>Entreprise</label><input id="em-company" value="${esc(m.company||'')}"></div>
                    <div class="form-group"><label>Fonction</label><input id="em-job" value="${esc(m.job_title||'')}"></div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                    <div class="form-group"><label>Secteur</label><input id="em-sector" value="${esc(m.sector||'')}"></div>
                    <div class="form-group"><label>Type adhesion</label><select id="em-type">
                        <option ${m.membership_type==='standard'?'selected':''}>standard</option>
                        <option ${m.membership_type==='entreprise'?'selected':''}>entreprise</option>
                        <option ${m.membership_type==='etudiant'?'selected':''}>etudiant</option>
                        <option ${m.membership_type==='retraite'?'selected':''}>retraite</option>
                    </select></div>
                </div>
                <div class="form-group"><label>Statut</label><select id="em-status">
                    <option ${m.status==='active'?'selected':''}>active</option>
                    <option ${m.status==='pending'?'selected':''}>pending</option>
                    <option ${m.status==='blocked'?'selected':''}>blocked</option>
                </select></div>
                <div style="display:flex;gap:12px;margin-top:16px">
                    <button type="submit" class="btn btn-accent" style="flex:1">Enregistrer</button>
                    <button type="button" class="btn btn-primary" style="flex:1" onclick="document.getElementById('member-modal').remove()">Annuler</button>
                </div>
            </form>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

async function saveMemberEdit(evt, id) {
    evt.preventDefault();
    await adminPost({
        action: 'update_member', id,
        first_name: document.getElementById('em-fn').value,
        last_name: document.getElementById('em-ln').value,
        email: document.getElementById('em-email').value,
        phone: document.getElementById('em-phone').value,
        company: document.getElementById('em-company').value,
        job_title: document.getElementById('em-job').value,
        sector: document.getElementById('em-sector').value,
        membership_type: document.getElementById('em-type').value,
        status: document.getElementById('em-status').value,
    });
    document.getElementById('member-modal')?.remove();
    loadAdminMembers();
}

// === EVENTS ===
async function loadAdminEvents() {
    const events = await adminFetch('events', {});
    const el = document.getElementById('adm-events-list');
    if (!el) return;
    el.innerHTML = `<table class="adm-table"><thead><tr><th>Date</th><th>Titre</th><th>Type</th><th>Lieu</th><th>Publie</th><th>Actions</th></tr></thead><tbody>
        ${events.map(e => `<tr>
            <td style="white-space:nowrap;font-size:13px">${formatDate(e.start_date)}</td>
            <td><strong>${esc(e.title)}</strong></td>
            <td><span class="card-tag">${esc(e.event_type||'')}</span></td>
            <td style="font-size:13px">${esc(e.location||'')}</td>
            <td>${e.is_published ? '<span style="color:var(--green)">Oui</span>' : '<span style="color:var(--orange)">En attente</span>'}</td>
            <td class="adm-actions">
                ${!e.is_published ? `<button onclick="adminAction('publish_event',${e.id})" class="adm-btn adm-btn-ok" title="Publier">&#10003;</button>` : `<button onclick="adminAction('unpublish_event',${e.id})" class="adm-btn adm-btn-warn" title="Depublier">&#10007;</button>`}
                <button onclick="adminAction('delete_event',${e.id})" class="adm-btn adm-btn-danger">&#128465;</button>
            </td>
        </tr>`).join('')}</tbody></table>`;
}

function showEventForm() {
    const html = `<div class="adm-modal-bg" id="event-modal" onclick="if(event.target===this)this.remove()"><div class="adm-modal">
        <h3 style="margin-bottom:20px;color:var(--primary)">Nouvel evenement</h3>
        <form onsubmit="createEvent(event)">
            <div class="form-group"><label>Titre</label><input id="ne-title" required></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="form-group"><label>Type</label><select id="ne-type"><option>conference</option><option>visite</option><option>rencontre</option><option>challenge</option><option>webinaire</option></select></div>
                <div class="form-group"><label>Lieu</label><input id="ne-location"></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="form-group"><label>Date debut</label><input type="datetime-local" id="ne-start" required></div>
                <div class="form-group"><label>Date fin</label><input type="datetime-local" id="ne-end"></div>
            </div>
            <div class="form-group"><label>Description</label><textarea id="ne-desc" style="min-height:100px"></textarea></div>
            <button type="submit" class="btn btn-accent" style="width:100%">Creer</button>
        </form>
    </div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

async function createEvent(evt) {
    evt.preventDefault();
    await adminPost({
        action: 'create_event',
        title: document.getElementById('ne-title').value,
        event_type: document.getElementById('ne-type').value,
        location: document.getElementById('ne-location').value,
        start_date: document.getElementById('ne-start').value,
        end_date: document.getElementById('ne-end').value || null,
        description: document.getElementById('ne-desc').value,
    });
    document.getElementById('event-modal')?.remove();
    loadAdminEvents();
}

// === NEWS ===
async function loadAdminNews() {
    const items = await adminFetch('news', {});
    const el = document.getElementById('adm-news-list');
    if (!el) return;
    el.innerHTML = `<table class="adm-table"><thead><tr><th>Date</th><th>Titre</th><th>Publie</th><th>Actions</th></tr></thead><tbody>
        ${items.map(n => `<tr>
            <td style="font-size:13px">${formatDate(n.published_at)}</td>
            <td><strong>${esc(n.title)}</strong></td>
            <td>${n.is_published ? '<span style="color:var(--green)">Oui</span>' : '<span style="color:var(--orange)">En attente</span>'}</td>
            <td class="adm-actions">
                ${!n.is_published ? `<button onclick="adminAction('publish_news',${n.id})" class="adm-btn adm-btn-ok" title="Publier">&#10003;</button>` : `<button onclick="adminAction('unpublish_news',${n.id})" class="adm-btn adm-btn-warn" title="Depublier">&#10007;</button>`}
                <button onclick="adminAction('delete_news',${n.id})" class="adm-btn adm-btn-danger">&#128465;</button>
            </td>
        </tr>`).join('')}</tbody></table>`;
}

function showNewsForm() {
    const html = `<div class="adm-modal-bg" id="news-modal" onclick="if(event.target===this)this.remove()"><div class="adm-modal">
        <h3 style="margin-bottom:20px;color:var(--primary)">Nouvelle actualite</h3>
        <form onsubmit="createNews(event)">
            <div class="form-group"><label>Titre</label><input id="nn-title" required></div>
            <div class="form-group"><label>Resume</label><input id="nn-excerpt"></div>
            <div class="form-group"><label>Contenu</label><textarea id="nn-content" style="min-height:120px"></textarea></div>
            <button type="submit" class="btn btn-accent" style="width:100%">Publier</button>
        </form>
    </div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

async function createNews(evt) {
    evt.preventDefault();
    await adminPost({action:'create_news', title:document.getElementById('nn-title').value, excerpt:document.getElementById('nn-excerpt').value, content:document.getElementById('nn-content').value});
    document.getElementById('news-modal')?.remove();
    loadAdminNews();
}

// === ANNOUNCEMENTS MODERATION ===
async function loadAdminAnnouncements() {
    const items = await adminFetch('announcements', {});
    const el = document.getElementById('adm-announcements-list');
    if (!el) return;
    el.innerHTML = `<table class="adm-table"><thead><tr><th>Date</th><th>Auteur</th><th>Titre</th><th>Cat.</th><th>Actif</th><th>Actions</th></tr></thead><tbody>
        ${items.map(a => `<tr>
            <td style="font-size:13px">${formatDate(a.created_at)}</td>
            <td>${esc(a.first_name)} ${esc(a.last_name)}</td>
            <td><strong>${esc(a.title)}</strong><br><span style="font-size:12px;color:var(--gray-500)">${esc((a.content||'').substring(0,80))}</span></td>
            <td><span class="card-tag">${esc(a.category)}</span></td>
            <td>${a.is_active ? '<span style="color:var(--green)">Oui</span>' : '<span style="color:var(--orange)">En attente</span>'}</td>
            <td class="adm-actions">
                ${!a.is_active ? `<button onclick="adminAction('approve_announcement',${a.id})" class="adm-btn adm-btn-ok" title="Approuver">&#10003;</button>` : `<button onclick="adminAction('reject_announcement',${a.id})" class="adm-btn adm-btn-warn" title="Masquer">&#10007;</button>`}
                <button onclick="adminAction('delete_announcement',${a.id})" class="adm-btn adm-btn-danger">&#128465;</button>
            </td>
        </tr>`).join('')}</tbody></table>`;
}

// === CREATE MEMBER ===
function showCreateMemberForm() {
    const html = `<div class="adm-modal-bg" id="create-member-modal" onclick="if(event.target===this)this.remove()"><div class="adm-modal">
        <h3 style="margin-bottom:20px;color:var(--primary)">Creer un nouveau membre</h3>
        <form onsubmit="createMember(event)">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="form-group"><label>Prenom *</label><input id="cm-fn" required></div>
                <div class="form-group"><label>Nom *</label><input id="cm-ln" required></div>
            </div>
            <div class="form-group"><label>Email *</label><input type="email" id="cm-email" required></div>
            <div class="form-group"><label>Mot de passe</label><input id="cm-pw" value="affi2026" placeholder="Par defaut: affi2026"></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="form-group"><label>Entreprise</label><input id="cm-company"></div>
                <div class="form-group"><label>Fonction</label><input id="cm-job"></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="form-group"><label>Secteur</label><select id="cm-sector">
                    <option value="">Selectionner...</option>
                    <option>Signalisation & ERTMS</option><option>Materiel roulant</option>
                    <option>Infrastructure</option><option>Maintenance</option>
                    <option>Ingenierie & Conseil</option><option>Numerique & IA</option>
                    <option>Gestion de projet</option><option>Recherche & Formation</option>
                </select></div>
                <div class="form-group"><label>Specialite</label><select id="cm-specialty">
                    <option value="">Selectionner...</option>
                    <option>Signalisation / ERTMS</option><option>Materiel Roulant</option>
                    <option>Infrastructure / Voie</option><option>Energie</option>
                    <option>Telecoms</option><option>Exploitation</option>
                </select></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="form-group"><label>Region</label><select id="cm-region">
                    <option value="">Selectionner...</option>
                    <option>Ile-de-France</option><option>Auvergne-Rhone-Alpes</option>
                    <option>Hauts-de-France</option><option>Occitanie</option>
                    <option>Grand Est</option><option>Provence-Alpes-Cote d'Azur</option>
                    <option>Nouvelle-Aquitaine</option><option>Pays de la Loire</option>
                    <option>Bretagne</option><option>Normandie</option>
                </select></div>
                <div class="form-group"><label>Role</label><select id="cm-role">
                    <option value="member">Membre</option>
                    <option value="moderator">Moderateur</option>
                    <option value="admin">Administrateur</option>
                </select></div>
            </div>
            <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px">
                <label><input type="checkbox" id="cm-consent-ann"> Consent annuaire public</label>
                <label><input type="checkbox" id="cm-consent-nl"> Consent newsletter</label>
                <label><input type="checkbox" id="cm-mentor"> Mentor</label>
            </div>
            <button type="submit" class="btn btn-accent" style="width:100%">Creer le membre</button>
        </form>
    </div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

async function createMember(evt) {
    evt.preventDefault();
    const role = document.getElementById('cm-role').value;
    const res = await adminPost({
        action: 'create_member',
        first_name: document.getElementById('cm-fn').value,
        last_name: document.getElementById('cm-ln').value,
        email: document.getElementById('cm-email').value,
        password: document.getElementById('cm-pw').value || 'affi2026',
        company: document.getElementById('cm-company').value,
        job_title: document.getElementById('cm-job').value,
        sector: document.getElementById('cm-sector').value,
        specialty: document.getElementById('cm-specialty').value,
        region: document.getElementById('cm-region').value,
        role: role,
        is_admin: role === 'admin',
        is_mentor: document.getElementById('cm-mentor').checked,
        consent_annuaire: document.getElementById('cm-consent-ann').checked,
        consent_newsletter: document.getElementById('cm-consent-nl').checked,
        status: 'active',
    });
    if (res.ok) {
        alert(res.message);
        document.getElementById('create-member-modal')?.remove();
        loadAdminMembers();
    } else {
        alert(res.error || 'Erreur');
    }
}

// === IMPORT CSV ===
function showImportForm() {
    const html = `<div class="adm-modal-bg" id="import-modal" onclick="if(event.target===this)this.remove()"><div class="adm-modal">
        <h3 style="margin-bottom:20px;color:var(--primary)">Import de membres (CSV)</h3>
        <p style="font-size:13px;color:var(--gray-500);margin-bottom:16px">Format attendu : fichier CSV avec colonnes <strong>email, first_name, last_name, company, job_title, sector, specialty, region, consent_annuaire (Oui/Non), consent_newsletter (Oui/Non)</strong>. Le mot de passe par defaut est "affi2026".</p>
        <div class="form-group">
            <label>Fichier CSV</label>
            <input type="file" id="import-file" accept=".csv,.txt" style="padding:8px">
        </div>
        <div id="import-preview" style="display:none;margin-bottom:16px;max-height:200px;overflow-y:auto;font-size:12px;background:var(--gray-50);padding:12px;border-radius:var(--radius)"></div>
        <div style="display:flex;gap:12px">
            <button class="btn btn-primary" onclick="previewImport()" style="flex:1">Verifier</button>
            <button class="btn btn-accent" id="btn-do-import" onclick="doImport()" style="flex:1;display:none">Importer</button>
        </div>
        <div id="import-result" style="display:none;margin-top:16px;padding:12px;border-radius:var(--radius);font-size:13px"></div>
    </div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

let importRows = [];
function previewImport() {
    const file = document.getElementById('import-file').files[0];
    if (!file) return alert('Selectionnez un fichier');
    const reader = new FileReader();
    reader.onload = function(e) {
        const lines = e.target.result.split('\n').filter(l => l.trim());
        if (lines.length < 2) return alert('Fichier vide ou invalide');
        const headers = lines[0].split(/[,;]/).map(h => h.trim().toLowerCase().replace(/['"]/g,''));
        importRows = [];
        for (let i = 1; i < lines.length; i++) {
            const vals = lines[i].split(/[,;]/).map(v => v.trim().replace(/^["']|["']$/g,''));
            const row = {};
            headers.forEach((h, j) => { row[h] = vals[j] || ''; });
            if (row.email) importRows.push(row);
        }
        const preview = document.getElementById('import-preview');
        preview.style.display = 'block';
        preview.innerHTML = `<strong>${importRows.length} lignes detectees</strong><br>` +
            importRows.slice(0,5).map(r => `${r.first_name || r.prenom || ''} ${r.last_name || r.nom || ''} — ${r.email}`).join('<br>') +
            (importRows.length > 5 ? `<br>... et ${importRows.length - 5} autres` : '');
        document.getElementById('btn-do-import').style.display = 'block';
    };
    reader.readAsText(file);
}

async function doImport() {
    // Normalize field names (support French headers)
    const normalized = importRows.map(r => ({
        email: r.email || '',
        first_name: r.first_name || r.prenom || '',
        last_name: r.last_name || r.nom || '',
        company: r.company || r.entreprise || '',
        job_title: r.job_title || r.fonction || '',
        sector: r.sector || r.secteur || '',
        specialty: r.specialty || r.specialite || r.expertise_ferroviaire || '',
        region: r.region || '',
        consent_annuaire: r.consent_annuaire || r.consentement_annuaire || '',
        consent_newsletter: r.consent_newsletter || r.consentement_newsletters || '',
    }));
    const res = await adminPost({ action: 'import_csv', rows: normalized });
    const el = document.getElementById('import-result');
    el.style.display = 'block';
    if (res.ok) {
        el.style.background = '#ecfdf5'; el.style.color = '#065f46';
        el.innerHTML = `<strong>${res.imported} membre(s) importe(s)</strong>` +
            (res.errors.length ? `<br>Erreurs:<br>${res.errors.join('<br>')}` : '');
        loadAdminMembers();
    } else {
        el.style.background = '#fef2f2'; el.style.color = '#991b1b';
        el.textContent = res.error || 'Erreur';
    }
}

// === EXPORT CSV ===
function exportMembers() {
    const status = document.getElementById('adm-status-filter')?.value || '';
    const url = `${API}/api/admin?action=export_csv${status ? '&status=' + status : ''}&token=${authToken}`;
    // Use fetch with auth header
    fetch(url, { headers: { 'Authorization': 'Bearer ' + authToken } })
        .then(r => r.blob())
        .then(blob => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'affi_membres_export.csv';
            a.click();
        })
        .catch(e => alert('Erreur export: ' + e.message));
}

// === LOGS ===
async function loadAdminLogs() {
    const items = await adminFetch('logs', {});
    const el = document.getElementById('adm-logs-list');
    if (!el) return;
    if (!items.length) { el.innerHTML = '<p class="empty-msg">Aucun log</p>'; return; }
    el.innerHTML = `<table class="adm-table"><thead><tr><th>Date</th><th>Utilisateur</th><th>Action</th><th>Details</th><th>IP</th></tr></thead><tbody>
        ${items.map(l => `<tr>
            <td style="font-size:12px;white-space:nowrap">${formatDate(l.created_at)}</td>
            <td>${l.first_name ? esc(l.first_name) + ' ' + esc(l.last_name) : '#' + (l.user_id||'?')}</td>
            <td><span class="card-tag">${esc(l.action)}</span></td>
            <td style="font-size:13px">${esc(l.details||'')}</td>
            <td style="font-size:12px;color:var(--gray-400)">${esc(l.ip_address||'')}</td>
        </tr>`).join('')}</tbody></table>`;
}

// === PENDING CONTENT (MODERATION) ===
async function loadPendingContent() {
    const data = await adminFetch('pending_content', {});
    const badge = document.getElementById('pending-count-badge');
    if (badge) badge.textContent = data.total > 0 ? data.total : '';
    const el = document.getElementById('adm-pending-list');
    if (!el) return;
    if (!data.total) { el.innerHTML = '<p class="empty-msg" style="color:var(--green)">&#10003; Aucun contenu en attente de validation</p>'; return; }
    let html = '';
    if (data.events.length) {
        html += `<h4 style="color:var(--primary);margin:16px 0 8px">Evenements proposes (${data.events.length})</h4>`;
        html += data.events.map(e => `
            <div class="announcement-card">
                <div class="ann-header">
                    <span><strong>${esc(e.title)}</strong></span>
                    <span class="ann-date">${formatDate(e.created_at)}</span>
                </div>
                <div style="font-size:13px;color:var(--gray-500);margin-bottom:8px">
                    ${e.event_type ? `<span class="card-tag">${esc(e.event_type)}</span>` : ''}
                    ${e.location ? ` &#128205; ${esc(e.location)}` : ''}
                    ${e.start_date ? ` &#128197; ${formatDate(e.start_date)}` : ''}
                </div>
                <div class="ann-content">${esc(e.description || '')}</div>
                <div class="ann-author">Propose par ${esc(e.first_name||'')} ${esc(e.last_name||'')}</div>
                <div style="margin-top:12px;display:flex;gap:8px">
                    <button onclick="adminAction('publish_event',${e.id})" class="btn btn-accent" style="font-size:12px;padding:6px 16px">Publier</button>
                    <button onclick="adminAction('delete_event',${e.id})" class="btn btn-primary" style="font-size:12px;padding:6px 16px;background:var(--gray-500)">Rejeter</button>
                </div>
            </div>`).join('');
    }
    if (data.news.length) {
        html += `<h4 style="color:var(--primary);margin:16px 0 8px">Actualites proposees (${data.news.length})</h4>`;
        html += data.news.map(n => `
            <div class="announcement-card">
                <div class="ann-header">
                    <span><strong>${esc(n.title)}</strong></span>
                    <span class="ann-date">${formatDate(n.created_at)}</span>
                </div>
                <div class="ann-content">${esc(n.content || n.excerpt || '')}</div>
                <div class="ann-author">Propose par ${esc(n.first_name||'')} ${esc(n.last_name||'')}</div>
                <div style="margin-top:12px;display:flex;gap:8px">
                    <button onclick="adminAction('publish_news',${n.id})" class="btn btn-accent" style="font-size:12px;padding:6px 16px">Publier</button>
                    <button onclick="adminAction('delete_news',${n.id})" class="btn btn-primary" style="font-size:12px;padding:6px 16px;background:var(--gray-500)">Rejeter</button>
                </div>
            </div>`).join('');
    }
    if (data.announcements.length) {
        html += `<h4 style="color:var(--primary);margin:16px 0 8px">Annonces proposees (${data.announcements.length})</h4>`;
        html += data.announcements.map(a => `
            <div class="announcement-card">
                <div class="ann-header">
                    <span class="ann-cat" style="background:var(--teal)">${esc(a.category)}</span>
                    <span class="ann-date">${formatDate(a.created_at)}</span>
                </div>
                <div class="ann-title">${esc(a.title)}</div>
                <div class="ann-content">${esc(a.content || '')}</div>
                <div class="ann-author">Par ${esc(a.first_name||'')} ${esc(a.last_name||'')}</div>
                <div style="margin-top:12px;display:flex;gap:8px">
                    <button onclick="adminAction('approve_announcement',${a.id})" class="btn btn-accent" style="font-size:12px;padding:6px 16px">Publier</button>
                    <button onclick="adminAction('delete_announcement',${a.id})" class="btn btn-primary" style="font-size:12px;padding:6px 16px;background:var(--gray-500)">Rejeter</button>
                </div>
            </div>`).join('');
    }
    el.innerHTML = html;
}

// === MESSAGES ===
async function loadAdminMessages() {
    const items = await adminFetch('messages', {});
    const el = document.getElementById('adm-messages-list');
    if (!el) return;
    el.innerHTML = items.map(m => `
        <div class="announcement-card" style="${m.is_read ? '' : 'border-left:4px solid var(--accent)'}">
            <div class="ann-header">
                <span><strong>${esc(m.name)}</strong> &lt;${esc(m.email)}&gt;</span>
                <span class="ann-date">${formatDate(m.created_at)}</span>
            </div>
            ${m.subject ? `<div class="ann-title">${esc(m.subject)}</div>` : ''}
            <div class="ann-content">${esc(m.message)}</div>
            <div style="margin-top:12px;display:flex;gap:8px">
                ${!m.is_read ? `<button onclick="adminAction('mark_read',${m.id})" class="adm-btn adm-btn-ok">Marquer lu</button>` : '<span style="color:var(--gray-400);font-size:12px">Lu</span>'}
                <button onclick="adminAction('delete_message',${m.id})" class="adm-btn adm-btn-danger">Supprimer</button>
            </div>
        </div>`).join('');
}
