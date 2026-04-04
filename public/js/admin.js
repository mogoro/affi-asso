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
    if (id === 'adm-moderation') loadAdminModeration();
    if (id === 'adm-stats') { if (typeof loadStatsDashboard === 'function') loadStatsDashboard(); }
    if (id === 'adm-polls') { if (typeof loadPolls === 'function') loadPolls(); }
    if (id === 'adm-adhesions') loadAdminAdhesions();
    if (id === 'adm-connexions') loadAdminConnexions();
    if (id === 'adm-logs') loadAdminLogs();
    if (id === 'adm-pubs') loadAdminPubs();
    if (id === 'adm-partners') loadAdminPartners();
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
    if (!document.getElementById('adm-members-list')) return;
    new DataTable('adm-members-list', {
        columns: [
            { key: 'name', label: 'Nom', render: (v, r) => `<strong>${esc(r.first_name)} ${esc(r.last_name)}</strong>` },
            { key: 'email', label: 'Email' },
            { key: 'company', label: 'Entreprise' },
            { key: 'sector', label: 'Secteur', render: v => v ? `<span class="card-tag">${esc(v)}</span>` : '-' },
            { key: 'membership_type', label: 'Type' },
            { key: 'status', label: 'Statut', render: v => `<span class="adm-badge adm-badge-${v}">${v}</span>` },
            { key: 'joined_at', label: 'Inscrit le', type: 'date', render: v => `<span style="font-size:12px">${formatDate(v)}</span>` },
        ],
        data: members.map(m => ({ ...m, name: (m.first_name||'') + ' ' + (m.last_name||'') })),
        actions: (m) => `
            ${m.status==='pending' ? `<button onclick="adminAction('approve_member',${m.id})" class="adm-btn adm-btn-ok" title="Approuver">&#10003;</button>` : ''}
            ${m.status==='active' ? `<button onclick="adminAction('block_member',${m.id})" class="adm-btn adm-btn-warn" title="Bloquer">&#10007;</button>` : ''}
            ${m.status==='blocked' ? `<button onclick="adminAction('activate_member',${m.id})" class="adm-btn adm-btn-ok" title="Reactiver">&#8635;</button>` : ''}
            <button onclick="editMember(${m.id})" class="adm-btn" title="Modifier">&#9998;</button>
            ${!m.is_admin ? `<button onclick="adminAction('delete_member',${m.id})" class="adm-btn adm-btn-danger" title="Supprimer">&#128465;</button>` : ''}
        `,
        pageSize: 25,
    });
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
    const html = `<div class="adm-modal-bg" id="member-modal" >
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
                    <button type="button" class="btn btn-primary" style="flex:1" onclick="closeModal('member-modal')">Annuler</button>
                </div>
            </form>
        </div>
    </div>`;
    openModal(html);
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
    closeModal('member-modal');
    loadAdminMembers();
}

// === ADHESIONS ===
async function loadAdminAdhesions() {
    const members = await adminFetch('members', {});
    const el = document.getElementById('adm-adhesions-content');
    if (!el) return;

    // Calculate adhesion stats
    const stats = { aJour: 0, rappel: 0, radiation: 0, preRadiation: 0, total: 0 };
    members.forEach(m => {
        if (m.status === 'active') stats.aJour++;
        else if (m.status === 'pending') stats.preRadiation++;
        else if (m.status === 'blocked') stats.radiation++;
        stats.total++;
    });

    // Group by company
    const byCompany = {};
    members.filter(m => m.status !== 'deleted').forEach(m => {
        const co = m.company || 'Non renseigne';
        byCompany[co] = (byCompany[co] || 0) + 1;
    });
    const topCompanies = Object.entries(byCompany).sort((a,b) => b[1]-a[1]).slice(0, 15);

    // Group by membership type
    const byType = {};
    members.filter(m => m.status !== 'deleted').forEach(m => {
        const t = m.membership_type || 'standard';
        byType[t] = (byType[t] || 0) + 1;
    });

    // Summary cards
    el.innerHTML = `
        <div class="kpi-row" style="margin-bottom:24px">
            <div class="kpi-card" style="border-top-color:var(--green)"><div class="kpi-val">${stats.aJour}</div><div class="kpi-label">A jour</div></div>
            <div class="kpi-card" style="border-top-color:var(--orange)"><div class="kpi-val">${stats.preRadiation}</div><div class="kpi-label">Pre-radiation</div></div>
            <div class="kpi-card" style="border-top-color:var(--accent)"><div class="kpi-val">${stats.radiation}</div><div class="kpi-label">Radies</div></div>
            <div class="kpi-card" style="border-top-color:var(--primary)"><div class="kpi-val">${stats.total}</div><div class="kpi-label">Total</div></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:24px">
            <div class="card"><div class="card-body">
                <h4 style="color:var(--primary);margin-bottom:12px">Par entreprise (top 15)</h4>
                ${topCompanies.map(([co, n]) => `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--gray-100)"><span>${esc(co)}</span><strong>${n}</strong></div>`).join('')}
            </div></div>
            <div class="card"><div class="card-body">
                <h4 style="color:var(--primary);margin-bottom:12px">Par type d'adhesion</h4>
                ${Object.entries(byType).map(([t, n]) => `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--gray-100)"><span class="card-tag">${esc(t)}</span><strong>${n}</strong></div>`).join('')}
            </div></div>
        </div>
        <div id="adm-adhesions-table"></div>
    `;

    new DataTable('adm-adhesions-table', {
        columns: [
            { key: 'name', label: 'Membre', render: (v, r) => `<strong>${esc(r.first_name)} ${esc(r.last_name)}</strong>` },
            { key: 'email', label: 'Email' },
            { key: 'company', label: 'Entreprise' },
            { key: 'membership_type', label: 'Type', render: v => `<span class="card-tag">${esc(v||'standard')}</span>` },
            { key: 'status', label: 'Etat adhesion', render: v => {
                const colors = { active: 'adm-badge-active', pending: 'adm-badge-pending', blocked: 'adm-badge-blocked' };
                const labels = { active: 'A jour', pending: 'Pre-radiation', blocked: 'Radie' };
                return `<span class="adm-badge ${colors[v]||''}">${labels[v]||v}</span>`;
            }},
            { key: 'joined_at', label: 'Depuis', type: 'date', render: v => formatDate(v) },
        ],
        data: members.filter(m => m.status !== 'deleted').map(m => ({ ...m, name: (m.first_name||'')+' '+(m.last_name||'') })),
        pageSize: 50,
    });
}

// === EVENTS ===
async function loadAdminEvents() {
    const events = await adminFetch('events', {});
    if (!document.getElementById('adm-events-list')) return;
    new DataTable('adm-events-list', {
        columns: [
            { key: 'start_date', label: 'Date', type: 'date', render: v => `<span style="white-space:nowrap;font-size:13px">${formatDate(v)}</span>` },
            { key: 'title', label: 'Titre', render: v => `<strong>${esc(v)}</strong>` },
            { key: 'event_type', label: 'Type', render: v => `<span class="card-tag">${esc(v||'')}</span>` },
            { key: 'location', label: 'Lieu' },
            { key: 'reg_count', label: 'Inscrits', render: (v, r) => `<strong style="color:var(--primary)">${v||0}</strong>${r.attended_count ? `<span style="color:var(--green);font-size:11px"> (${r.attended_count}&#10003;)</span>` : ''}` },
            { key: 'is_published', label: 'Publie', render: v => v ? '<span style="color:var(--green)">Oui</span>' : '<span style="color:var(--orange)">En attente</span>' },
        ],
        data: events,
        actions: (e) => `
            <button onclick="editEvent(${e.id})" class="adm-btn" title="Modifier">&#9998;</button>
            <button onclick="showEventCommForm(${e.id},'${esc(e.title).replace(/'/g,"&#39;")}')" class="adm-btn" title="Communiquer">&#128231;</button>
            <button onclick="showEventRegistrations(${e.id},'${esc(e.title).replace(/'/g,"&#39;")}')" class="adm-btn" title="Inscrits">&#128101;</button>
            ${!e.is_published ? `<button onclick="adminAction('publish_event',${e.id})" class="adm-btn adm-btn-ok" title="Publier">&#10003;</button>` : `<button onclick="adminAction('unpublish_event',${e.id})" class="adm-btn adm-btn-warn" title="Depublier">&#10007;</button>`}
            ${new Date(e.start_date) < new Date() ? `<button onclick="convertEventToArticle(${e.id})" class="adm-btn" title="Convertir en article" style="color:var(--teal)">&#128240;</button>` : ''}
            <button onclick="adminAction('delete_event',${e.id})" class="adm-btn adm-btn-danger">&#128465;</button>
        `,
        pageSize: 25,
    });
}

function showEventForm(editEvt) {
    const e = editEvt || {};
    const isEdit = !!e.id;
    const html = `<div class="adm-modal-bg" id="event-modal" ><div class="adm-modal" style="max-width:700px">
        <h3 style="margin-bottom:20px;color:var(--primary)">${isEdit ? 'Modifier' : 'Nouvel'} evenement</h3>
        <form onsubmit="${isEdit ? `updateEvent(event,${e.id})` : 'createEvent(event)'}">
            <div class="form-group"><label>Titre *</label><input id="ne-title" required value="${esc(e.title||'')}"></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="form-group"><label>Type</label><select id="ne-type">
                    <option ${(e.event_type||'')==='conference'?'selected':''}>conference</option>
                    <option ${(e.event_type||'')==='visite'?'selected':''}>visite</option>
                    <option ${(e.event_type||'')==='webinaire'?'selected':''}>webinaire</option>
                    <option ${(e.event_type||'')==='rencontre'?'selected':''}>rencontre</option>
                    <option ${(e.event_type||'')==='assemblee'?'selected':''}>assemblee</option>
                    <option ${(e.event_type||'')==='ceremonie'?'selected':''}>ceremonie</option>
                    <option ${(e.event_type||'')==='challenge'?'selected':''}>challenge</option>
                </select></div>
                <div class="form-group"><label>Lieu</label><input id="ne-location" value="${esc(e.location||'')}"></div>
            </div>
            <div class="form-group"><label>Adresse complete</label><input id="ne-address" value="${esc(e.address||'')}" placeholder="Ex: 1 Place aux Etoiles, 93210 Saint-Denis"></div>
            <div class="form-group"><label>Organisateur</label><input id="ne-organizer" value="${esc(e.organizer||'AFFI')}" placeholder="Ex: AFFI"></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="form-group"><label>Date debut *</label><input type="datetime-local" id="ne-start" required value="${e.start_date ? e.start_date.replace(' ','T').substring(0,16) : ''}"></div>
                <div class="form-group"><label>Date fin</label><input type="datetime-local" id="ne-end" value="${e.end_date ? e.end_date.replace(' ','T').substring(0,16) : ''}"></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
                <div class="form-group"><label>Places max</label><input type="number" id="ne-max" value="${e.max_attendees||''}"></div>
                <div class="form-group"><label>Prix (EUR)</label><input type="number" id="ne-price" step="0.01" value="${e.price||0}"></div>
                <div class="form-group"><label>Image URL</label><input id="ne-image" value="${esc(e.image_url||'')}" placeholder="https://..."></div>
            </div>
            <div class="form-group"><label>Description</label><textarea id="ne-desc" style="min-height:150px">${esc(e.description||'')}</textarea></div>
            <div class="form-group"><label>Mots-cles (separes par des virgules)</label><input id="ne-tags" value="${esc(e.tags||'')}" placeholder="Ex : ERTMS, signalisation, conference"></div>
            <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px">
                <label style="display:flex;align-items:center;gap:6px;font-size:14px"><input type="checkbox" id="ne-members" ${e.is_members_only ? 'checked' : ''}> Reserve aux membres</label>
                <label style="display:flex;align-items:center;gap:6px;font-size:14px"><input type="checkbox" id="ne-published" ${e.is_published !== false ? 'checked' : ''}> Publie</label>
            </div>
            <button type="submit" class="btn btn-accent" style="width:100%">${isEdit ? 'Enregistrer' : 'Creer l\'evenement'}</button>
        </form>
    </div></div>`;
    openModal(html);
}

async function createEvent(evt) {
    evt.preventDefault();
    await adminPost({
        action: 'create_event',
        title: document.getElementById('ne-title').value,
        event_type: document.getElementById('ne-type').value,
        location: document.getElementById('ne-location').value,
        address: document.getElementById('ne-address').value,
        organizer: document.getElementById('ne-organizer').value,
        start_date: document.getElementById('ne-start').value,
        end_date: document.getElementById('ne-end').value || null,
        description: document.getElementById('ne-desc').value,
        tags: document.getElementById('ne-tags').value,
        max_attendees: document.getElementById('ne-max').value ? parseInt(document.getElementById('ne-max').value) : null,
        price: parseFloat(document.getElementById('ne-price').value) || 0,
        image_url: document.getElementById('ne-image').value || null,
        is_members_only: document.getElementById('ne-members').checked,
        is_published: document.getElementById('ne-published').checked,
    });
    closeModal('event-modal');
    loadAdminEvents();
}

async function updateEvent(evt, id) {
    evt.preventDefault();
    await adminPost({
        action: 'update_event', id,
        title: document.getElementById('ne-title').value,
        event_type: document.getElementById('ne-type').value,
        location: document.getElementById('ne-location').value,
        address: document.getElementById('ne-address').value,
        organizer: document.getElementById('ne-organizer').value,
        start_date: document.getElementById('ne-start').value,
        end_date: document.getElementById('ne-end').value || null,
        description: document.getElementById('ne-desc').value,
        tags: document.getElementById('ne-tags').value,
        max_attendees: document.getElementById('ne-max').value ? parseInt(document.getElementById('ne-max').value) : null,
        price: parseFloat(document.getElementById('ne-price').value) || 0,
        image_url: document.getElementById('ne-image').value || null,
        is_members_only: document.getElementById('ne-members').checked,
        is_published: document.getElementById('ne-published').checked,
    });
    closeModal('event-modal');
    loadAdminEvents();
}

async function editEvent(id) {
    const events = await adminFetch('events', {});
    const e = events.find(ev => ev.id === id);
    if (e) showEventForm(e);
}

function convertEventToArticle(eventId) {
    adminFetch('events', {}).then(events => {
        const ev = events.find(e => e.id === eventId);
        if (!ev) return;
        const html = `<div class="adm-modal-bg" id="e2a-modal"><div class="adm-modal" style="max-width:600px">
            <h3 style="color:var(--primary);margin-bottom:16px">&#128240; Convertir en article</h3>
            <p style="font-size:13px;color:var(--gray-500);margin-bottom:16px">Creer un article a partir de l'evenement passe.</p>
            <form onsubmit="submitEventToArticle(event,${eventId})">
                <div class="form-group"><label>Titre de l'article</label><input id="e2a-title" required value="Retour sur : ${esc(ev.title)}"></div>
                <div class="form-group"><label>Categorie</label><select id="e2a-category">
                    <option value="Conference" ${ev.event_type==='conference'?'selected':''}>Conference</option>
                    <option value="Visite">Visite</option>
                    <option value="Publication">Publication</option>
                    <option value="Vie associative">Vie associative</option>
                </select></div>
                <div class="form-group"><label>Resume</label><textarea id="e2a-excerpt" style="min-height:60px">Retour sur l'evenement du ${formatDate(ev.start_date)}.</textarea></div>
                <div class="form-group"><label>Contenu complet</label><textarea id="e2a-content" style="min-height:150px">${esc(ev.description||'')}</textarea></div>
                <div style="display:flex;gap:12px">
                    <button type="submit" class="btn btn-accent" style="flex:1">Publier l'article</button>
                    <button type="button" class="btn btn-primary" style="flex:1" onclick="closeModal('e2a-modal')">Annuler</button>
                </div>
            </form>
        </div></div>`;
        openModal(html);
    });
}

async function submitEventToArticle(evt, eventId) {
    evt.preventDefault();
    const res = await adminPost({
        action: 'create_news',
        title: document.getElementById('e2a-title').value,
        category: document.getElementById('e2a-category').value,
        excerpt: document.getElementById('e2a-excerpt').value,
        content: document.getElementById('e2a-content').value,
        is_published: true,
    });
    if (res.ok) {
        closeModal('e2a-modal');
        showToast('Article publie !', 'success');
        loadAdminEvents();
    } else {
        showToast(res.error || 'Erreur', 'error');
    }
}

// === NEWS ===
async function loadAdminNews() {
    const items = await adminFetch('news', {});
    if (!document.getElementById('adm-news-list')) return;
    new DataTable('adm-news-list', {
        columns: [
            { key: 'published_at', label: 'Date', type: 'date', render: v => `<span style="font-size:13px">${formatDate(v)}</span>` },
            { key: 'title', label: 'Titre', render: v => `<strong>${esc(v)}</strong>` },
            { key: 'category', label: 'Categorie', render: v => v ? `<span class="card-tag">${esc(v)}</span>` : '-' },
            { key: 'is_published', label: 'Publie', render: v => v ? '<span style="color:var(--green)">Oui</span>' : '<span style="color:var(--orange)">En attente</span>' },
        ],
        data: items,
        actions: (n) => `
            <button onclick="editNews(${n.id})" class="adm-btn" title="Modifier">&#9998;</button>
            ${!n.is_published ? `<button onclick="adminAction('publish_news',${n.id})" class="adm-btn adm-btn-ok" title="Publier">&#10003;</button>` : `<button onclick="adminAction('unpublish_news',${n.id})" class="adm-btn adm-btn-warn" title="Depublier">&#10007;</button>`}
            <button onclick="adminAction('delete_news',${n.id})" class="adm-btn adm-btn-danger">&#128465;</button>
        `,
        pageSize: 25,
    });
}

function showNewsForm(editItem) {
    const n = editItem || {};
    const isEdit = !!n.id;
    const html = `<div class="adm-modal-bg" id="news-modal" ><div class="adm-modal" style="max-width:700px">
        <h3 style="margin-bottom:20px;color:var(--primary)">${isEdit ? 'Modifier l\'' : 'Nouvelle '}actualite</h3>
        <form onsubmit="${isEdit ? `updateNews(event,${n.id})` : 'createNews(event)'}">
            <div class="form-group"><label>Titre *</label><input id="nn-title" required value="${esc(n.title||'')}"></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="form-group"><label>Categorie</label><select id="nn-category">
                    <option value="">Aucune</option>
                    <option ${(n.category||'')==='Conference'?'selected':''}>Conference</option>
                    <option ${(n.category||'')==='Innovation'?'selected':''}>Innovation</option>
                    <option ${(n.category||'')==='Industrie'?'selected':''}>Industrie</option>
                    <option ${(n.category||'')==='Publication'?'selected':''}>Publication</option>
                    <option ${(n.category||'')==='Vie associative'?'selected':''}>Vie associative</option>
                </select></div>
                <div class="form-group"><label>Image URL</label><input id="nn-image" value="${esc(n.image_url||'')}" placeholder="https://..."></div>
            </div>
            <div class="form-group"><label>Resume (extrait)</label><textarea id="nn-excerpt" style="min-height:60px">${esc(n.excerpt||'')}</textarea></div>
            <div class="form-group"><label>Contenu complet</label><textarea id="nn-content" style="min-height:200px">${esc(n.content||'')}</textarea></div>
            <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px">
                <label style="display:flex;align-items:center;gap:6px;font-size:14px"><input type="checkbox" id="nn-published" ${n.is_published !== false ? 'checked' : ''}> Publie</label>
            </div>
            <button type="submit" class="btn btn-accent" style="width:100%">${isEdit ? 'Enregistrer' : 'Publier l\'actualite'}</button>
        </form>
    </div></div>`;
    openModal(html);
}

async function createNews(evt) {
    evt.preventDefault();
    await adminPost({
        action: 'create_news',
        title: document.getElementById('nn-title').value,
        excerpt: document.getElementById('nn-excerpt').value,
        content: document.getElementById('nn-content').value,
        category: document.getElementById('nn-category').value || null,
        image_url: document.getElementById('nn-image').value || null,
        is_published: document.getElementById('nn-published').checked,
    });
    closeModal('news-modal');
    loadAdminNews();
}

async function updateNews(evt, id) {
    evt.preventDefault();
    await adminPost({
        action: 'update_news', id,
        title: document.getElementById('nn-title').value,
        excerpt: document.getElementById('nn-excerpt').value,
        content: document.getElementById('nn-content').value,
        category: document.getElementById('nn-category').value || null,
        image_url: document.getElementById('nn-image').value || null,
        is_published: document.getElementById('nn-published').checked,
    });
    closeModal('news-modal');
    loadAdminNews();
}

async function editNews(id) {
    const items = await adminFetch('news', {});
    const n = items.find(x => x.id === id);
    if (n) showNewsForm(n);
}

// === ANNOUNCEMENTS MODERATION (kept for backward compat) ===
async function loadAdminAnnouncements() {
    loadAdminModeration();
}

// === CREATE MEMBER ===
function showCreateMemberForm() {
    const html = `<div class="adm-modal-bg" id="create-member-modal" ><div class="adm-modal">
        <h3 style="margin-bottom:20px;color:var(--primary)">Creer un nouveau membre</h3>
        <form onsubmit="createMember(event)">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="form-group"><label>Prenom *</label><input id="cm-fn" required></div>
                <div class="form-group"><label>Nom *</label><input id="cm-ln" required></div>
            </div>
            <div class="form-group"><label>Email *</label><input type="email" id="cm-email" required></div>
            <div class="form-group"><label>Mot de passe</label><input id="cm-pw" type="password" placeholder="Mot de passe (8 car. min, 1 maj, 1 min, 1 chiffre)"></div>
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
    openModal(html);
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
        closeModal('create-member-modal');
        loadAdminMembers();
    } else {
        alert(res.error || 'Erreur');
    }
}

// === IMPORT CSV ===
function showImportForm() {
    const html = `<div class="adm-modal-bg" id="import-modal" ><div class="adm-modal">
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
    openModal(html);
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
    const url = `${API}/api/admin?action=export_csv${status ? '&status=' + status : ''}`;
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
    if (!document.getElementById('adm-logs-list')) return;
    if (!items.length) { document.getElementById('adm-logs-list').innerHTML = '<p class="empty-msg">Aucun log</p>'; return; }
    new DataTable('adm-logs-list', {
        columns: [
            { key: 'created_at', label: 'Date', type: 'date', render: v => `<span style="font-size:12px;white-space:nowrap">${formatDate(v)}</span>` },
            { key: 'user_name', label: 'Utilisateur', render: (v, r) => r.first_name ? esc(r.first_name) + ' ' + esc(r.last_name) : '#' + (r.user_id||'?') },
            { key: 'action', label: 'Action', render: v => `<span class="card-tag">${esc(v)}</span>` },
            { key: 'details', label: 'Détails' },
            { key: 'ip_address', label: 'IP', render: v => `<span style="font-size:12px;color:var(--gray-400)">${esc(v||'')}</span>` },
        ],
        data: items.map(l => ({ ...l, user_name: l.first_name ? l.first_name + ' ' + l.last_name : '#' + (l.user_id||'?') })),
        pageSize: 50,
    });
}

// === EVENT REGISTRATIONS (full attendance tracking) ===
async function showEventRegistrations(eventId, title) {
    const regs = await adminFetch('event_registrations', {event_id: String(eventId)});
    const presentCount = regs.filter(r => r.attended).length;
    const uncheckedCount = regs.length - presentCount;
    const html = `<div class="adm-modal-bg" id="regs-modal" ><div class="adm-modal" style="max-width:850px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
            <h3 style="color:var(--primary)">Inscriptions — ${esc(title)}</h3>
            <div style="display:flex;gap:8px">
                <button class="btn btn-primary" onclick="exportRegistrations(${eventId},'${esc(title).replace(/'/g,"\\'")}')" style="font-size:12px;padding:6px 16px">&#128196; Exporter CSV</button>
                <button class="btn btn-accent" onclick="closeModal('regs-modal')" style="font-size:12px;padding:6px 16px">Fermer</button>
            </div>
        </div>
        <div style="display:flex;gap:16px;margin-bottom:16px;padding:12px;background:var(--gray-50);border-radius:var(--radius)">
            <div><strong style="font-size:24px;color:var(--primary)">${regs.length}</strong> <span style="font-size:13px;color:var(--gray-500)">inscrits</span></div>
            <div><strong style="font-size:24px;color:var(--green)">${presentCount}</strong> <span style="font-size:13px;color:var(--gray-500)">presents</span></div>
            <div><strong style="font-size:24px;color:var(--orange)">${uncheckedCount}</strong> <span style="font-size:13px;color:var(--gray-500)">non pointes</span></div>
        </div>
        <div id="regs-table-container"></div>
    </div></div>`;
    openModal(html);
    if (regs.length) {
        new DataTable('regs-table-container', {
            columns: [
                { key: 'name', label: 'Nom', render: (v, r) => `<strong>${esc(r.first_name||'')} ${esc(r.last_name||'')}</strong>` },
                { key: 'email', label: 'Email' },
                { key: 'company', label: 'Entreprise' },
                { key: 'phone', label: 'Tel' },
                { key: 'registered_at', label: 'Inscrit le', type: 'date', render: v => `<span style="font-size:12px">${formatDate(v)}</span>` },
                { key: 'attended', label: 'Present', render: v => v ? '<span style="color:var(--green);font-weight:700">&#10003; Present</span>' : '<span style="color:var(--gray-400)">--</span>' },
            ],
            data: regs.map(r => ({ ...r, name: (r.first_name||'') + ' ' + (r.last_name||'') })),
            actions: (r) => `${!r.attended
                ? `<button onclick="markPresent(${r.id},${eventId},'${esc(title).replace(/'/g,"\\'")}')" class="adm-btn adm-btn-ok" title="Pointer present" style="font-size:16px">&#9745;</button>`
                : `<button onclick="unmarkPresent(${r.id},${eventId},'${esc(title).replace(/'/g,"\\'")}')" class="adm-btn adm-btn-warn" title="Retirer presence" style="font-size:16px">&#9746;</button>`}`,
            pageSize: 50,
        });
    } else {
        document.getElementById('regs-table-container').innerHTML = '<p class="empty-msg">Aucune inscription</p>';
    }
}

async function markPresent(regId, eventId, eventTitle) {
    await adminPost({action: 'event_attend', registration_id: regId});
    closeModal('regs-modal');
    showEventRegistrations(eventId, eventTitle);
}

async function unmarkPresent(regId, eventId, eventTitle) {
    await adminPost({action: 'event_unattend', registration_id: regId});
    closeModal('regs-modal');
    showEventRegistrations(eventId, eventTitle);
}

function exportRegistrations(eventId, eventTitle) {
    const table = document.querySelector('#regs-modal .adm-table, #regs-table-container table');
    if (!table) return;
    const rows = table.querySelectorAll('tbody tr');
    let csv = 'Nom,Email,Entreprise,Telephone,Inscrit le,Present\n';
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        const vals = [
            cells[0]?.textContent?.trim() || '',
            cells[1]?.textContent?.trim() || '',
            cells[2]?.textContent?.trim() || '',
            cells[3]?.textContent?.trim() || '',
            cells[4]?.textContent?.trim() || '',
            cells[5]?.textContent?.trim() || '',
        ];
        csv += vals.map(v => '"' + v.replace(/"/g,'""') + '"').join(',') + '\n';
    });
    const blob = new Blob(['\ufeff' + csv], {type: 'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inscriptions_${eventTitle.replace(/[^a-zA-Z0-9]/g,'_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Export CSV telecharge', 'success');
}

// === PENDING CONTENT (legacy, redirects to unified moderation) ===
async function loadPendingContent() {
    loadAdminModeration();
}

// === UNIFIED MODERATION VIEW ===
async function loadAdminModeration() {
    const [pending, announcements, messages] = await Promise.all([
        adminFetch('pending_content', {}),
        adminFetch('announcements', {}),
        adminFetch('messages', {})
    ]);
    const el = document.getElementById('adm-moderation-content');
    if (!el) return;

    const totalPending = (pending.total || 0) + (messages.filter(m => !m.is_read).length);
    const badge = document.getElementById('pending-count-badge');
    if (badge) badge.textContent = totalPending > 0 ? totalPending : '';

    el.innerHTML = `
        ${pending.events && pending.events.length ? `
            <h3 style="color:var(--accent);margin-bottom:12px">&#128197; Evenements a valider (${pending.events.length})</h3>
            <div id="mod-events-table"></div>
            <div style="margin-bottom:24px"></div>
        ` : ''}

        ${pending.news && pending.news.length ? `
            <h3 style="color:var(--accent);margin-bottom:12px">&#128240; Actualites a valider (${pending.news.length})</h3>
            <div id="mod-news-table"></div>
            <div style="margin-bottom:24px"></div>
        ` : ''}

        ${announcements.length ? `
            <h3 style="color:var(--primary);margin-bottom:12px">&#128227; Annonces membres (${announcements.length})</h3>
            <div id="mod-announcements-table"></div>
            <div style="margin-bottom:24px"></div>
        ` : ''}

        ${messages.length ? `
            <h3 style="color:var(--gray-600);margin-bottom:12px">&#128231; Messages contact (${messages.length})</h3>
            <div id="mod-messages-table"></div>
        ` : ''}

        ${!pending.total && !announcements.length && !messages.length ? '<p class="empty-msg">Rien a moderer pour le moment</p>' : ''}
    `;

    // Render DataTables for each section
    if (pending.events && pending.events.length) {
        new DataTable('mod-events-table', {
            columns: [
                { key: 'start_date', label: 'Date', type: 'date', render: (v, r) => `<span style="font-size:13px">${formatDate(v||r.created_at)}</span>` },
                { key: 'title', label: 'Titre', render: v => `<strong>${esc(v)}</strong>` },
                { key: 'author', label: 'Auteur', render: (v, r) => esc((r.first_name||'')+' '+(r.last_name||'')) },
            ],
            data: pending.events.map(e => ({ ...e, author: (e.first_name||'')+' '+(e.last_name||'') })),
            actions: (e) => `
                <button onclick="adminAction('publish_event',${e.id})" class="adm-btn adm-btn-ok" title="Publier">&#10003;</button>
                <button onclick="adminAction('delete_event',${e.id})" class="adm-btn adm-btn-danger" title="Supprimer">&#128465;</button>
            `,
            pageSize: 25,
        });
    }
    if (pending.news && pending.news.length) {
        new DataTable('mod-news-table', {
            columns: [
                { key: 'published_at', label: 'Date', type: 'date', render: (v, r) => `<span style="font-size:13px">${formatDate(v||r.created_at)}</span>` },
                { key: 'title', label: 'Titre', render: v => `<strong>${esc(v)}</strong>` },
                { key: 'author', label: 'Auteur', render: (v, r) => esc((r.first_name||'')+' '+(r.last_name||'')) },
            ],
            data: pending.news.map(n => ({ ...n, author: (n.first_name||'')+' '+(n.last_name||'') })),
            actions: (n) => `
                <button onclick="adminAction('publish_news',${n.id})" class="adm-btn adm-btn-ok" title="Publier">&#10003;</button>
                <button onclick="adminAction('delete_news',${n.id})" class="adm-btn adm-btn-danger" title="Supprimer">&#128465;</button>
            `,
            pageSize: 25,
        });
    }
    if (announcements.length) {
        new DataTable('mod-announcements-table', {
            columns: [
                { key: 'created_at', label: 'Date', type: 'date', render: v => `<span style="font-size:13px">${formatDate(v)}</span>` },
                { key: 'author', label: 'Auteur', render: (v, r) => `${esc(r.first_name||'')} ${esc(r.last_name||'')}` },
                { key: 'title', label: 'Titre', render: v => `<strong>${esc(v)}</strong>` },
                { key: 'category', label: 'Cat.', render: v => `<span class="card-tag">${esc(v||'')}</span>` },
                { key: 'is_active', label: 'Actif', render: v => v ? '<span style="color:var(--green)">Oui</span>' : '<span style="color:var(--orange)">En attente</span>' },
            ],
            data: announcements.map(a => ({ ...a, author: (a.first_name||'') + ' ' + (a.last_name||'') })),
            actions: (a) => `
                ${!a.is_active ? `<button onclick="adminAction('approve_announcement',${a.id})" class="adm-btn adm-btn-ok">&#10003;</button>` : `<button onclick="adminAction('reject_announcement',${a.id})" class="adm-btn adm-btn-warn">&#10007;</button>`}
                <button onclick="adminAction('delete_announcement',${a.id})" class="adm-btn adm-btn-danger">&#128465;</button>
            `,
            pageSize: 25,
        });
    }
    if (messages.length) {
        new DataTable('mod-messages-table', {
            columns: [
                { key: 'created_at', label: 'Date', type: 'date', render: v => `<span style="font-size:13px">${formatDate(v)}</span>` },
                { key: 'name', label: 'Nom', render: v => `<strong>${esc(v)}</strong>` },
                { key: 'email', label: 'Email' },
                { key: 'subject', label: 'Sujet' },
                { key: 'is_read', label: 'Lu', render: v => v ? 'Oui' : '<strong style="color:var(--accent)">Non lu</strong>' },
            ],
            data: messages,
            actions: (m) => `
                ${!m.is_read ? `<button onclick="adminAction('mark_read',${m.id})" class="adm-btn adm-btn-ok" title="Marquer lu">&#10003;</button>` : ''}
                <button onclick="adminAction('delete_message',${m.id})" class="adm-btn adm-btn-danger">&#128465;</button>
            `,
            pageSize: 25,
        });
    }
}

// === CONNEXIONS ===
async function loadAdminConnexions() {
    const items = await adminFetch('connexions', {});
    if (!document.getElementById('adm-connexions-list')) return;
    if (!items.length) { document.getElementById('adm-connexions-list').innerHTML = '<p class="empty-msg">Aucune connexion enregistree</p>'; return; }

    const now = new Date();
    const enriched = items.map(c => {
        const lastLogin = c.last_login ? new Date(c.last_login) : null;
        const diffMin = lastLogin ? Math.round((now - lastLogin) / 60000) : null;
        let ago = '';
        if (diffMin !== null) {
            if (diffMin < 1) ago = 'A l\'instant';
            else if (diffMin < 60) ago = `Il y a ${diffMin} min`;
            else if (diffMin < 1440) ago = `Il y a ${Math.round(diffMin/60)}h`;
            else ago = `Il y a ${Math.round(diffMin/1440)}j`;
        }
        const hasActiveSession = c.session_start && new Date(c.session_expires) > now;
        return { ...c, name: (c.first_name||'') + ' ' + (c.last_name||''), ago, hasActiveSession };
    });
    new DataTable('adm-connexions-list', {
        columns: [
            { key: 'name', label: 'Membre', render: (v, r) => `<strong>${esc(r.first_name)} ${esc(r.last_name)}</strong>${r.is_admin ? ' <span class="adm-badge adm-badge-active" style="font-size:10px">Admin</span>' : ''}` },
            { key: 'email', label: 'Email' },
            { key: 'company', label: 'Entreprise' },
            { key: 'role', label: 'Rôle', render: v => `<span class="card-tag">${esc(v||'member')}</span>` },
            { key: 'last_login', label: 'Dernière connexion', type: 'date', render: (v, r) => `<span style="font-size:13px">${formatDate(v)}</span><br><span style="font-size:11px;color:var(--gray-400)">${r.ago}</span>` },
            { key: 'hasActiveSession', label: 'Session', render: v => v ? '<span style="color:var(--green);font-weight:700">&#128994; Active</span>' : '<span style="color:var(--gray-400)">&#9898; Inactive</span>' },
        ],
        data: enriched,
        pageSize: 50,
    });
}

// === MESSAGES (legacy, now part of unified moderation) ===
async function loadAdminMessages() {
    loadAdminModeration();
}

// === PARTENAIRES ADMIN ===
let _partnersData = [];

async function loadAdminPartners() {
    try {
        _partnersData = await adminFetch('partners', {});
    } catch(e) { _partnersData = []; }
    if (!document.getElementById('adm-partners-list')) return;
    if (!_partnersData.length) {
        document.getElementById('adm-partners-list').innerHTML = '<p class="empty-msg">Aucun partenaire</p>';
        return;
    }
    new DataTable('adm-partners-list', {
        columns: [
            { key: 'logo_url', label: 'Logo', render: v => v ? `<img src="${esc(v)}" style="max-height:30px;max-width:50px;object-fit:contain">` : '<span style="color:var(--gray-400)">--</span>' },
            { key: 'name', label: 'Nom', render: v => `<strong>${esc(v)}</strong>` },
            { key: 'sector', label: 'Domaine' },
            { key: 'city', label: 'Ville' },
            { key: 'website_url', label: 'Site web', render: v => v ? `<a href="${esc(v)}" target="_blank" rel="noopener" style="font-size:11px">${esc(v.replace('https://www.','').replace('https://',''))}</a>` : '-' },
        ],
        data: _partnersData,
        actions: (p, idx) => `
            <button onclick="editPartner(${p.id})" class="adm-btn" title="Modifier">&#9998;</button>
            <button onclick="deletePartner(${p.id})" class="adm-btn adm-btn-danger" title="Supprimer">&#128465;</button>
        `,
        pageSize: 25,
    });
}

function showPartnerForm(partner) {
    const p = partner || {};
    const isEdit = !!p.id;
    const html = `<div class="adm-modal-bg" id="partner-modal"><div class="adm-modal" style="max-width:600px">
        <h3 style="margin-bottom:20px;color:var(--primary)">${isEdit ? 'Modifier' : 'Nouveau'} partenaire</h3>
        <form onsubmit="savePartner(event,${isEdit ? p.id : 0})">
            <div class="form-group"><label>Nom *</label><input id="pt-name" required value="${esc(p.name||'')}"></div>
            <div class="form-group"><label>Description</label><textarea id="pt-desc" style="min-height:80px">${esc(p.description||'')}</textarea></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="form-group"><label>Domaine d'activite</label><input id="pt-sector" value="${esc(p.sector||'')}"></div>
                <div class="form-group"><label>Ville</label><input id="pt-city" value="${esc(p.city||'')}"></div>
            </div>
            <div class="form-group"><label>Adresse</label><input id="pt-address" value="${esc(p.address||'')}"></div>
            <div class="form-group"><label>Site web</label><input id="pt-website" value="${esc(p.website_url||'')}" placeholder="https://..."></div>
            <div class="form-group"><label>URL du logo</label><input id="pt-logo" value="${esc(p.logo_url||'')}" placeholder="https://..."></div>
            <div class="form-group"><label>Contact (email ou telephone)</label><input id="pt-contact" value="${esc(p.contact||'')}"></div>
            <div class="form-group"><label>Ordre d'affichage</label><input type="number" id="pt-sort" value="${p.sort_order||0}"></div>
            <div style="display:flex;gap:12px">
                <button type="submit" class="btn btn-accent" style="flex:1">${isEdit ? 'Enregistrer' : 'Ajouter le partenaire'}</button>
                <button type="button" class="btn btn-primary" style="flex:1" onclick="closeModal('partner-modal')">Annuler</button>
            </div>
        </form>
    </div></div>`;
    openModal(html);
}

function editPartner(id) {
    const p = _partnersData.find(x => x.id === id);
    if (p) showPartnerForm(p);
}

async function savePartner(evt, id) {
    evt.preventDefault();
    const data = {
        name: document.getElementById('pt-name').value,
        description: document.getElementById('pt-desc').value,
        sector: document.getElementById('pt-sector').value,
        city: document.getElementById('pt-city').value,
        address: document.getElementById('pt-address').value,
        website_url: document.getElementById('pt-website').value,
        contact: document.getElementById('pt-contact').value,
        logo_url: document.getElementById('pt-logo').value || null,
        sort_order: parseInt(document.getElementById('pt-sort').value) || 0,
    };
    if (id > 0) {
        data.action = 'update_partner';
        data.id = id;
    } else {
        data.action = 'create_partner';
    }
    const res = await adminPost(data);
    if (res.ok) {
        closeModal('partner-modal');
        loadAdminPartners();
        showToast(id > 0 ? 'Partenaire mis a jour' : 'Partenaire ajoute', 'success');
    } else {
        showToast(res.error || 'Erreur', 'error');
    }
}

async function deletePartner(id) {
    const p = _partnersData.find(x => x.id === id);
    if (!confirm('Supprimer le partenaire ' + (p ? p.name : '#' + id) + ' ?')) return;
    await adminPost({action: 'delete_partner', id});
    loadAdminPartners();
    showToast('Partenaire supprime', 'success');
}
