/**
 * AFFI Admin Panel Logic
 */

let adminData = {};

async function loadAdmin() {
    if (!currentUser || !currentUser.is_admin) return;
    switchAdminSection('adm-members');
}

function switchAdminSection(id) {
    document.querySelectorAll('.adm-section').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.adm-nav-btn').forEach(el => el.classList.remove('active'));
    const panel = document.getElementById(id);
    if (panel) panel.style.display = 'block';
    const btn = document.querySelector(`.adm-nav-btn[data-section="${id}"]`);
    if (btn) btn.classList.add('active');
    if (id === 'adm-members') loadAdminMembers();
    if (id === 'adm-events') loadAdminEvents();
    if (id === 'adm-news') loadAdminNews();
    if (id === 'adm-moderation') loadAdminModeration();
    if (id === 'adm-stats') { if (typeof loadStatsDashboard === 'function') loadStatsDashboard(); }
    if (id === 'adm-polls') { if (typeof loadPolls === 'function') loadPolls(); }
    if (id === 'adm-pubs') loadAdminPubs();
    if (id === 'adm-partners') loadAdminPartners();
    if (id === 'adm-board') loadAdminBoard();
    if (id === 'adm-cotisations') loadAdminCotisations();
    if (id === 'adm-challenge') loadAdminChallenge();
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

// === DASHBOARD (removed) ===

// === MEMBERS MANAGEMENT (unified: members + adhesions + RGPD + connexions) ===
async function loadAdminMembers(status, search) {
    const params = {};
    if (status) params.status = status;
    if (search) params.search = search;
    const members = await adminFetch('members', params);
    if (!document.getElementById('adm-members-list')) return;

    // Compute KPI counts
    const activeCount = members.filter(m => m.status === 'active').length;
    const pendingCount = members.filter(m => m.status === 'pending').length;
    const blockedCount = members.filter(m => m.status === 'blocked').length;
    const total = members.length;

    // Render summary bar
    const summaryEl = document.getElementById('adm-members-summary');
    if (summaryEl) {
        summaryEl.innerHTML = `
            <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:8px">
                <div style="display:flex;align-items:center;gap:6px;font-size:13px">
                    <span style="color:var(--green);font-size:16px">&#9679;</span>
                    <strong>${activeCount}</strong> a jour
                </div>
                <div style="display:flex;align-items:center;gap:6px;font-size:13px">
                    <span style="color:var(--orange);font-size:16px">&#9679;</span>
                    <strong>${pendingCount}</strong> pre-radiation
                </div>
                <div style="display:flex;align-items:center;gap:6px;font-size:13px">
                    <span style="color:var(--accent);font-size:16px">&#9679;</span>
                    <strong>${blockedCount}</strong> radies
                </div>
                <div style="display:flex;align-items:center;gap:6px;font-size:13px">
                    <strong>${total}</strong> total
                </div>
                <div style="margin-left:auto;display:flex;align-items:center;gap:6px;font-size:12px;color:var(--gray-500)">
                    <span style="color:var(--green)">&#9679;</span> RGPD OK
                    <span style="color:var(--orange)">&#9679;</span> Partiel
                    <span style="color:var(--accent)">&#9679;</span> Non
                </div>
            </div>
        `;
    }

    new DataTable('adm-members-list', {
        columns: [
            { key: 'name', label: 'Membre', render: (v, r) => `<strong>${esc(r.first_name)} ${esc(r.last_name)}</strong><br><span style="font-size:11px;color:var(--gray-500)">${esc(r.email)}</span>` },
            { key: 'company', label: 'Entreprise', render: v => esc(v || '-') },
            { key: 'membership_type', label: 'Type', render: v => `<span class="card-tag">${esc(v||'standard')}</span>` },
            { key: 'rgpd_status', label: 'RGPD', sortable: false, filterable: false, width: '60px',
              render: (v, r) => {
                  const ann = r.consent_annuaire;
                  const nl = r.consent_newsletter;
                  if (ann && nl) return '<span title="Consentements OK" style="color:var(--green);font-size:18px">&#9679;</span>';
                  if (ann || nl) return '<span title="Consentement partiel" style="color:var(--orange);font-size:18px">&#9679;</span>';
                  return '<span title="Aucun consentement" style="color:var(--accent);font-size:18px">&#9679;</span>';
              }
            },
            { key: 'cotisation_status', label: 'Cotisation', width: '80px',
              render: (v, r) => {
                  if (r.status === 'active') return '<span title="A jour" style="color:var(--green);font-size:16px">&#10004;</span>';
                  if (r.status === 'pending') return '<span title="En attente" style="color:var(--orange);font-size:16px">&#9888;</span>';
                  return '<span title="Radie/Bloque" style="color:var(--accent);font-size:16px">&#10008;</span>';
              }
            },
            { key: 'status', label: 'Statut', render: v => {
                const labels = { active: 'Actif', pending: 'En attente', blocked: 'Radie' };
                return `<span class="adm-badge adm-badge-${v}">${labels[v]||v}</span>`;
            }},
            { key: 'last_login', label: 'Derniere co.', type: 'date', render: v => v ? `<span style="font-size:11px">${formatDate(v)}</span>` : '<span style="color:var(--gray-300)">&mdash;</span>' },
        ],
        data: members.map(m => ({ ...m, name: (m.first_name||'') + ' ' + (m.last_name||'') })),
        actions: (m) => `
            ${m.status==='pending' ? `<button onclick="adminAction('approve_member',${m.id})" class="adm-btn adm-btn-ok" title="Approuver">&#10003;</button>` : ''}
            ${m.status==='active' ? `<button onclick="adminAction('block_member',${m.id})" class="adm-btn adm-btn-warn" title="Bloquer">&#10007;</button>` : ''}
            ${m.status==='blocked' ? `<button onclick="adminAction('activate_member',${m.id})" class="adm-btn adm-btn-ok" title="Reactiver">&#8635;</button>` : ''}
            <button onclick="event.stopPropagation();sendRGPDConsent(${m.id},'${esc(m.email).replace(/'/g,"&#39;")}','${esc(m.first_name).replace(/'/g,"&#39;")}')" class="adm-btn" title="Demander consentement RGPD" style="color:${m.consent_annuaire && m.consent_newsletter ? 'var(--green)' : 'var(--orange)'}">&#128274;</button>
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

    // RGPD status display
    const rgpdAnn = m.consent_annuaire ? '<span style="color:var(--green)">&#10004;</span> Oui' : '<span style="color:var(--accent)">&#10008;</span> Non';
    const rgpdNl = m.consent_newsletter ? '<span style="color:var(--green)">&#10004;</span> Oui' : '<span style="color:var(--accent)">&#10008;</span> Non';

    // Cotisation status
    const cotisationLabels = { active: 'A jour', pending: 'En attente', blocked: 'Radie' };
    const cotisationColors = { active: 'var(--green)', pending: 'var(--orange)', blocked: 'var(--accent)' };
    const cotisationStatus = cotisationLabels[m.status] || m.status;
    const cotisationColor = cotisationColors[m.status] || 'var(--gray-500)';

    // Subscriptions history placeholder (loaded async)
    const subsHtml = `<div id="member-subs-${m.id}"><span style="color:var(--gray-400);font-size:12px">Chargement...</span></div>`;

    const html = `<div class="adm-modal-bg" id="member-modal" >
        <div class="adm-modal" style="max-width:700px">
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

                <!-- Cotisation section -->
                <div style="background:var(--gray-50);border-radius:var(--radius);padding:16px;margin:16px 0">
                    <h4 style="color:var(--primary);margin-bottom:12px;font-size:14px">Cotisation</h4>
                    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
                        <span style="font-size:13px">Statut actuel :</span>
                        <strong style="color:${cotisationColor}">${cotisationStatus}</strong>
                        <button type="button" class="btn btn-primary" style="font-size:11px;padding:4px 12px;margin-left:auto" onclick="markCotisationAJour(${m.id})">Marquer a jour ${new Date().getFullYear()}</button>
                    </div>
                    <div style="max-height:120px;overflow-y:auto">${subsHtml}</div>
                </div>

                <!-- RGPD section -->
                <div style="background:var(--gray-50);border-radius:var(--radius);padding:16px;margin-bottom:16px">
                    <h4 style="color:var(--primary);margin-bottom:8px;font-size:14px">Consentements RGPD</h4>
                    <div style="display:flex;gap:24px;font-size:13px">
                        <span>Annuaire : ${rgpdAnn}</span>
                        <span>Newsletter : ${rgpdNl}</span>
                    </div>
                    ${m.last_login ? `<div style="font-size:12px;color:var(--gray-500);margin-top:8px">Derniere connexion : ${formatDate(m.last_login)}</div>` : ''}
                </div>

                <div style="display:flex;gap:12px;margin-top:16px">
                    <button type="submit" class="btn btn-accent" style="flex:1">Enregistrer</button>
                    <button type="button" class="btn btn-primary" style="flex:1" onclick="closeModal('member-modal')">Annuler</button>
                </div>
            </form>
        </div>
    </div>`;
    openModal(html);

    // Load subscription history async
    adminFetch('subscriptions', {}).then(subs => {
        const mySubs = subs.filter(s => s.member_id === m.id);
        const el = document.getElementById('member-subs-' + m.id);
        if (!el) return;
        if (!mySubs.length) { el.innerHTML = '<span style="font-size:12px;color:var(--gray-400)">Aucune cotisation enregistrée</span>'; return; }
        el.innerHTML = mySubs.map(s => `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--gray-100);font-size:13px">
            <span>${s.year}</span><span>${s.amount} €</span><span class="adm-badge adm-badge-${s.status === 'paid' ? 'active' : 'pending'}">${s.status === 'paid' ? 'Payée' : 'En attente'}</span>
        </div>`).join('');
    });
}

async function markCotisationAJour(memberId) {
    const year = new Date().getFullYear();
    const res = await adminPost({ action: 'update_member', id: memberId, status: 'active' });
    if (res.ok || !res.error) {
        showToast('Cotisation ' + year + ' marquee a jour', 'success');
        closeModal('member-modal');
        loadAdminMembers();
    } else {
        showToast(res.error || 'Erreur', 'error');
    }
}

async function loadAdminCotisations() {
    const year = new Date().getFullYear();
    const subs = await adminFetch('subscriptions', {year: String(year)});
    const members = await adminFetch('members', {});
    const el = document.getElementById('adm-cotisations-content');
    if (!el) return;

    const paid = subs.filter(s => s.status === 'paid').length;
    const pending = subs.filter(s => s.status === 'pending').length;
    const activeMembers = members.filter(m => m.status === 'active').length;
    const noCotis = activeMembers - subs.length;

    el.innerHTML = `
        <div style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap">
            <div style="display:flex;align-items:center;gap:6px;font-size:13px"><span style="color:var(--green);font-size:16px">&#9679;</span><strong>${paid}</strong> payées</div>
            <div style="display:flex;align-items:center;gap:6px;font-size:13px"><span style="color:var(--orange);font-size:16px">&#9679;</span><strong>${pending}</strong> en attente</div>
            <div style="display:flex;align-items:center;gap:6px;font-size:13px"><span style="color:var(--accent);font-size:16px">&#9679;</span><strong>${noCotis}</strong> sans cotisation</div>
            <div style="margin-left:auto"><strong>${year}</strong></div>
        </div>
        <div style="margin-bottom:12px"><button onclick="syncHelloAsso()" class="btn btn-primary" style="font-size:12px;padding:6px 14px;background:#49D2C0">&#127760; Synchroniser HelloAsso</button></div>
        <div id="adm-cotisations-table"></div>
    `;

    new DataTable('adm-cotisations-table', {
        columns: [
            { key: 'name', label: 'Membre', render: (v, r) => `<strong>${esc(r.first_name)} ${esc(r.last_name)}</strong><br><span style="font-size:11px;color:var(--gray-500)">${esc(r.email)}</span>` },
            { key: 'company', label: 'Entreprise' },
            { key: 'membership_type', label: 'Type', render: v => `<span class="card-tag">${esc(v||'')}</span>` },
            { key: 'amount', label: 'Montant', type: 'number', render: v => v ? v + ' €' : '-' },
            { key: 'payment_method', label: 'Paiement' },
            { key: 'status', label: 'Statut', render: v => {
                if (v === 'paid') return '<span class="adm-badge adm-badge-active">Payée</span>';
                if (v === 'pending') return '<span class="adm-badge adm-badge-pending">En attente</span>';
                return '<span class="adm-badge adm-badge-blocked">Impayée</span>';
            }},
            { key: 'paid_at', label: 'Payé le', type: 'date', render: v => v ? formatDate(v) : '-' },
        ],
        data: subs.map(s => ({...s, name: (s.first_name||'')+' '+(s.last_name||'')})),
        actions: (s) => s.status !== 'paid' ? `<button onclick="adminPost({action:'mark_subscription_paid',id:${s.id}}).then(()=>loadAdminCotisations())" class="adm-btn adm-btn-ok" title="Marquer payée">&#10003;</button>` : '',
        pageSize: 50,
    });
}

async function syncHelloAsso() {
    const data = await adminFetch('helloasso_sync', {});
    showToast(data.message, data.ok ? 'success' : 'info');
    if (data.synced > 0) loadAdminCotisations();
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

// === ADHESIONS (removed - now integrated in loadAdminMembers) ===

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
                <div class="form-group"><label>Image URL</label><input id="ne-image" value="${esc(e.image_url||'')}" placeholder="https://..." oninput="previewAdminImage('ne-image','ne-image-preview')"></div>
            </div>
            <div id="ne-image-preview" style="margin-top:8px"></div>
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
    setTimeout(() => previewAdminImage('ne-image', 'ne-image-preview'), 50);
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

// === LOGS (removed - integrated in unified members view) ===

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

// === CONNEXIONS (removed - last_login now shown in unified members view) ===

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
            <div class="form-group"><label>URL du logo</label><input id="pt-logo" value="${esc(p.logo_url||'')}" placeholder="https://..." oninput="previewAdminImage('pt-logo','pt-logo-preview')"></div>
            <div id="pt-logo-preview" style="margin-top:8px"></div>
            <div class="form-group"><label>Contact (email ou telephone)</label><input id="pt-contact" value="${esc(p.contact||'')}"></div>
            <div class="form-group"><label>Ordre d'affichage</label><input type="number" id="pt-sort" value="${p.sort_order||0}"></div>
            <div style="display:flex;gap:12px">
                <button type="submit" class="btn btn-accent" style="flex:1">${isEdit ? 'Enregistrer' : 'Ajouter le partenaire'}</button>
                <button type="button" class="btn btn-primary" style="flex:1" onclick="closeModal('partner-modal')">Annuler</button>
            </div>
        </form>
    </div></div>`;
    openModal(html);
    setTimeout(() => previewAdminImage('pt-logo', 'pt-logo-preview'), 50);
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

// === ORGANIGRAMME / BOARD ADMIN ===
let _boardData = [];
let _allMembersForBoard = [];

async function loadAdminBoard() {
    try {
        _boardData = await adminFetch('board', {});
    } catch(e) { _boardData = []; }
    if (!document.getElementById('adm-board-list')) return;
    if (!_boardData.length) {
        document.getElementById('adm-board-list').innerHTML = '<p class="empty-msg">Aucun poste dans l\'organigramme</p>';
        return;
    }
    const catLabels = {'bureau':'Bureau','bureau-other':'Autres Bureau','administrateur':'Administrateur'};
    const lvlLabels = {1:'1-President',2:'2-VP/SG/Tresorier',3:'3-Autre Bureau',4:'4-Administrateur'};
    new DataTable('adm-board-list', {
        columns: [
            { key: 'sort_order', label: 'Ordre', render: v => v },
            { key: 'first_name', label: 'Membre', render: (v, r) => r.first_name ? `<strong>${esc(r.first_name)} ${esc(r.last_name)}</strong>` : '<em style="color:var(--gray-400)">Non lie</em>' },
            { key: 'role', label: 'Role / Poste', render: v => `<strong>${esc(v||'')}</strong>` },
            { key: 'category', label: 'Categorie', render: v => catLabels[v] || v },
            { key: 'level', label: 'Niveau', render: v => lvlLabels[v] || v },
        ],
        data: _boardData,
        actions: (b) => `
            <button onclick="editBoardMember(${b.id})" class="adm-btn" title="Modifier">&#9998;</button>
            <button onclick="deleteBoardMember(${b.id})" class="adm-btn adm-btn-danger" title="Supprimer">&#128465;</button>
        `,
        pageSize: 50,
    });
}

async function _loadMembersForBoard() {
    if (_allMembersForBoard.length) return;
    try {
        _allMembersForBoard = await adminFetch('members', {});
    } catch(e) { _allMembersForBoard = []; }
}

async function showBoardMemberForm(item) {
    await _loadMembersForBoard();
    const b = item || {};
    const isEdit = !!b.id;
    const memberOptions = _allMembersForBoard.map(m =>
        `<option value="${m.id}" ${m.id === b.member_id ? 'selected' : ''}>${esc(m.first_name)} ${esc(m.last_name)} — ${esc(m.company||'')}</option>`
    ).join('');
    const html = `<div class="adm-modal-bg" id="board-modal"><div class="adm-modal" style="max-width:600px">
        <h3 style="margin-bottom:20px;color:var(--primary)">${isEdit ? 'Modifier' : 'Nouveau'} poste organigramme</h3>
        <form onsubmit="saveBoardMember(event,${isEdit ? b.id : 0})">
            <div class="form-group"><label>Membre *</label>
                <select id="bm-member" required><option value="">-- Choisir un membre --</option>${memberOptions}</select>
            </div>
            <div class="form-group"><label>Role / Poste *</label><input id="bm-role" required value="${esc(b.role||'')}" placeholder="President, Vice-President..."></div>
            <div class="form-group"><label>Titre (optionnel)</label><input id="bm-title" value="${esc(b.title||'')}" placeholder="Description complementaire"></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="form-group"><label>Categorie</label>
                    <select id="bm-category">
                        <option value="bureau" ${b.category==='bureau'?'selected':''}>Bureau</option>
                        <option value="bureau-other" ${b.category==='bureau-other'?'selected':''}>Autres Bureau</option>
                        <option value="administrateur" ${b.category==='administrateur'?'selected':''}>Administrateur</option>
                    </select>
                </div>
                <div class="form-group"><label>Niveau hierarchique</label>
                    <select id="bm-level">
                        <option value="1" ${b.level==1?'selected':''}>1 - President</option>
                        <option value="2" ${b.level==2?'selected':''}>2 - VP/SG/Tresorier</option>
                        <option value="3" ${b.level==3?'selected':''}>3 - Autre Bureau</option>
                        <option value="4" ${b.level==4?'selected':''}>4 - Administrateur</option>
                    </select>
                </div>
            </div>
            <div class="form-group"><label>Ordre d'affichage</label><input type="number" id="bm-sort" value="${b.sort_order||0}"></div>
            <div style="display:flex;gap:12px">
                <button type="submit" class="btn btn-accent" style="flex:1">${isEdit ? 'Enregistrer' : 'Ajouter le poste'}</button>
                <button type="button" class="btn btn-primary" style="flex:1" onclick="closeModal('board-modal')">Annuler</button>
            </div>
        </form>
    </div></div>`;
    openModal(html);
}

function editBoardMember(id) {
    const b = _boardData.find(x => x.id === id);
    if (b) showBoardMemberForm(b);
}

async function saveBoardMember(evt, id) {
    evt.preventDefault();
    const data = {
        member_id: parseInt(document.getElementById('bm-member').value) || null,
        role: document.getElementById('bm-role').value,
        title: document.getElementById('bm-title').value,
        category: document.getElementById('bm-category').value,
        level: parseInt(document.getElementById('bm-level').value) || 2,
        sort_order: parseInt(document.getElementById('bm-sort').value) || 0,
    };
    if (id > 0) {
        data.action = 'update_board_member';
        data.id = id;
    } else {
        data.action = 'create_board_member';
    }
    const res = await adminPost(data);
    if (res.ok) {
        closeModal('board-modal');
        loadAdminBoard();
        showToast(id > 0 ? 'Poste mis a jour' : 'Poste ajoute', 'success');
    } else {
        showToast(res.error || 'Erreur', 'error');
    }
}

async function deleteBoardMember(id) {
    const b = _boardData.find(x => x.id === id);
    if (!confirm('Supprimer le poste ' + (b ? b.role : '#' + id) + ' ?')) return;
    await adminPost({action: 'delete_board_member', id});
    loadAdminBoard();
    showToast('Poste supprime', 'success');
}

// === IMAGE PREVIEW IN ADMIN FORMS ===
function previewAdminImage(inputId, previewId) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    if (!input || !preview) return;
    const url = input.value;
    if (url && url.startsWith('http')) {
        preview.innerHTML = `<img src="${esc(url)}" style="max-width:200px;max-height:120px;border-radius:8px;border:1px solid var(--gray-200)" onerror="this.parentElement.innerHTML='<span style=color:var(--gray-400)>Image introuvable</span>'">`;
    } else if (url && url.startsWith('data:')) {
        preview.innerHTML = `<img src="${url}" style="max-width:200px;max-height:120px;border-radius:8px;border:1px solid var(--gray-200)">`;
    } else {
        preview.innerHTML = '';
    }
}

// === RGPD CONSENT EMAIL ===
async function sendRGPDConsent(memberId, email, firstName) {
    if (!confirm(`Envoyer un email de demande de consentement RGPD à ${firstName} (${email}) ?`)) return;
    try {
        const res = await fetch(`${API}/api/email`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken},
            body: JSON.stringify({
                action: 'send',
                to: email,
                subject: '[AFFI] Consentement RGPD — Protection de vos données personnelles',
                html: getRGPDEmailHTML(firstName)
            })
        });
        const data = await res.json();
        if (data.error) { showToast('Erreur: ' + data.error, 'error'); return; }
        showToast(`Email RGPD envoyé à ${email}`, 'success');
    } catch(e) {
        showToast('Erreur réseau', 'error');
    }
}

function getRGPDEmailHTML(firstName) {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f4f6f8">
<div style="max-width:600px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
    <div style="background:#1a3c6e;padding:28px;text-align:center">
        <img src="https://res.cloudinary.com/dsheinfad/image/upload/q_auto,f_auto/affi/logo-affi" alt="AFFI" style="height:40px;margin-bottom:8px"><br>
        <span style="color:rgba(255,255,255,.7);font-size:13px">Association Ferroviaire Française des Ingénieurs</span>
    </div>
    <div style="padding:32px 28px">
        <h2 style="color:#1a3c6e;margin:0 0 16px;font-size:22px">Consentement RGPD</h2>
        <p>Bonjour <strong>${firstName}</strong>,</p>
        <p>Dans le cadre de la réglementation européenne sur la protection des données personnelles (RGPD), l'AFFI vous informe des données que nous conservons et vous demande votre consentement explicite.</p>

        <div style="background:#f0f4f8;border-radius:8px;padding:20px;margin:20px 0">
            <h3 style="color:#1a3c6e;margin:0 0 12px;font-size:16px">&#128274; Données conservées par l'AFFI :</h3>
            <ul style="margin:0;padding-left:20px;line-height:2;color:#495057">
                <li><strong>Identité :</strong> Nom, prénom, email, téléphone</li>
                <li><strong>Professionnel :</strong> Entreprise, fonction, secteur d'activité</li>
                <li><strong>Adhésion :</strong> Type de cotisation, date d'inscription, statut</li>
                <li><strong>Technique :</strong> Date de dernière connexion (sécurité)</li>
            </ul>
        </div>

        <div style="background:#fff8e1;border-radius:8px;padding:20px;margin:20px 0;border-left:4px solid #ffc107">
            <h3 style="color:#e65100;margin:0 0 8px;font-size:16px">&#128101; L'annuaire des membres :</h3>
            <p style="margin:0;color:#495057">Si vous y consentez, votre profil (nom, entreprise, fonction, secteur) sera visible dans l'annuaire réservé aux membres connectés de l'AFFI. Cet annuaire permet aux adhérents de se retrouver et de se mettre en réseau. Votre email et téléphone ne sont <strong>jamais</strong> affichés dans l'annuaire public.</p>
        </div>

        <div style="background:#e8f5e9;border-radius:8px;padding:20px;margin:20px 0;border-left:4px solid #4caf50">
            <h3 style="color:#2e7d32;margin:0 0 8px;font-size:16px">&#9989; Vos droits :</h3>
            <ul style="margin:0;padding-left:20px;line-height:2;color:#495057">
                <li>Droit d'accès, de rectification et de suppression de vos données</li>
                <li>Droit de retirer votre consentement à tout moment</li>
                <li>Droit de portabilité de vos données</li>
                <li>Contact DPO : contact@ingenieur-ferroviaire.net</li>
            </ul>
        </div>

        <p style="text-align:center;margin:28px 0">
            <a href="https://affi-asso.vercel.app/#membres" style="display:inline-block;background:#c8102e;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:800;font-size:16px">Gérer mes consentements</a>
        </p>
        <p style="color:#6c757d;font-size:13px;text-align:center">Connectez-vous puis allez dans <strong>Profil & CV</strong> pour accepter ou refuser la publication dans l'annuaire et la newsletter.</p>
    </div>
    <div style="padding:16px 28px;background:#f8f9fa;text-align:center;font-size:12px;color:#6c757d;border-top:1px solid #e9ecef">
        AFFI — 60 rue Anatole France, 92300 Levallois-Perret<br>
        <a href="https://affi-asso.vercel.app" style="color:#1a3c6e">affi-asso.vercel.app</a> · Conformité RGPD (Règlement UE 2016/679)
    </div>
</div>
</body></html>`;
}

// Mass RGPD consent request (send to all members without consent)
async function sendRGPDConsentAll() {
    if (!confirm('Envoyer l\'email de consentement RGPD à TOUS les membres sans consentement ? Cette action peut prendre du temps.')) return;
    const members = await adminFetch('members', {});
    const needConsent = members.filter(m => !m.consent_annuaire && m.status === 'active' && m.email);
    if (!needConsent.length) { showToast('Tous les membres actifs ont déjà donné leur consentement', 'success'); return; }
    if (!confirm(`${needConsent.length} membre(s) sans consentement. Confirmer l'envoi ?`)) return;
    let sent = 0;
    for (const m of needConsent) {
        try {
            await fetch(`${API}/api/email`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken},
                body: JSON.stringify({action: 'send', to: m.email, subject: '[AFFI] Consentement RGPD', html: getRGPDEmailHTML(m.first_name)})
            });
            sent++;
        } catch(e) {}
    }
    showToast(`${sent}/${needConsent.length} emails RGPD envoyés`, 'success');
}

function exportCotisationsCSV() {
    adminFetch('subscriptions', {}).then(subs => {
        const headers = ['Année','Nom','Prénom','Email','Entreprise','Type','Montant','Méthode','Statut','Date paiement'];
        const rows = subs.map(s => [
            s.year, s.last_name, s.first_name, s.email, s.company||'',
            s.membership_type||'', s.amount||0, s.payment_method||'', s.status||'',
            s.paid_at ? s.paid_at.slice(0,10) : ''
        ]);
        const csv = [headers.join(';'), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(';'))].join('\n');
        const blob = new Blob(['\ufeff' + csv], {type:'text/csv;charset=utf-8'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `affi_cotisations_${new Date().getFullYear()}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
    });
}

// === CHALLENGE RIC ADMIN ===
async function loadAdminChallenge() {
    const el = document.getElementById('adm-challenge-content');
    if (!el) return;
    try {
        const [subjects, teams] = await Promise.all([
            adminFetch('challenge_subjects', {}),
            adminFetch('challenge_teams', {})
        ]);
        el.innerHTML = `
            <h4 style="color:var(--accent);margin-bottom:12px">Sujets proposes (${subjects.length})</h4>
            <div id="adm-challenge-subjects-table"></div>
            <div style="margin:24px 0"></div>
            <h4 style="color:var(--teal);margin-bottom:12px">Candidatures equipes (${teams.length})</h4>
            <div id="adm-challenge-teams-table"></div>
        `;
        if (subjects.length) {
            new DataTable('adm-challenge-subjects-table', {
                columns: [
                    { key: 'created_at', label: 'Date', type: 'date', render: v => `<span style="font-size:13px">${formatDate(v)}</span>` },
                    { key: 'title', label: 'Titre', render: v => `<strong>${esc(v)}</strong>` },
                    { key: 'company', label: 'Entreprise' },
                    { key: 'contact_name', label: 'Contact' },
                    { key: 'status', label: 'Statut', render: v => {
                        const colors = {draft:'var(--gray-400)',pending:'var(--orange)',open:'var(--green)',rejected:'var(--accent)'};
                        return `<span style="color:${colors[v]||'var(--gray-500)'};font-weight:700">${esc(v)}</span>`;
                    }},
                    { key: 'year', label: 'Annee' },
                ],
                data: subjects,
                actions: (s) => `
                    ${s.status !== 'open' ? `<button onclick="adminChallengeAction('approve_subject',${s.id})" class="adm-btn adm-btn-ok" title="Approuver">&#10003;</button>` : ''}
                    ${s.status !== 'rejected' ? `<button onclick="adminChallengeAction('reject_subject',${s.id})" class="adm-btn adm-btn-danger" title="Rejeter">&#10007;</button>` : ''}
                `,
                pageSize: 25,
            });
        }
        if (teams.length) {
            new DataTable('adm-challenge-teams-table', {
                columns: [
                    { key: 'created_at', label: 'Date', type: 'date', render: v => `<span style="font-size:13px">${formatDate(v)}</span>` },
                    { key: 'team_name', label: 'Equipe', render: v => `<strong>${esc(v)}</strong>` },
                    { key: 'subject_title', label: 'Sujet' },
                    { key: 'school', label: 'Ecole' },
                    { key: 'status', label: 'Statut', render: v => {
                        const colors = {pending:'var(--orange)',approved:'var(--green)',rejected:'var(--accent)'};
                        return `<span style="color:${colors[v]||'var(--gray-500)'};font-weight:700">${esc(v)}</span>`;
                    }},
                ],
                data: teams,
                actions: (t) => `
                    ${t.status !== 'approved' ? `<button onclick="adminChallengeAction('approve_team',${t.id})" class="adm-btn adm-btn-ok" title="Approuver">&#10003;</button>` : ''}
                    ${t.status !== 'rejected' ? `<button onclick="adminChallengeAction('reject_team',${t.id})" class="adm-btn adm-btn-danger" title="Rejeter">&#10007;</button>` : ''}
                `,
                pageSize: 25,
            });
        }
    } catch(e) {
        el.innerHTML = '<p class="empty-msg">Erreur de chargement</p>';
        console.warn('Admin Challenge:', e);
    }
}

async function adminChallengeAction(action, id) {
    try {
        await adminPost({action, id});
        loadAdminChallenge();
        showToast('Action effectuee', 'success');
    } catch(e) { alert('Erreur'); }
}
