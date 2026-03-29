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
        </div>
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
            <td>${e.is_published ? '<span style="color:var(--green)">Oui</span>' : '<span style="color:var(--gray-400)">Non</span>'}</td>
            <td class="adm-actions"><button onclick="adminAction('delete_event',${e.id})" class="adm-btn adm-btn-danger">&#128465;</button></td>
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
            <td>${n.is_published ? '<span style="color:var(--green)">Oui</span>' : 'Non'}</td>
            <td class="adm-actions"><button onclick="adminAction('delete_news',${n.id})" class="adm-btn adm-btn-danger">&#128465;</button></td>
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
