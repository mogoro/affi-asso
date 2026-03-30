/**
 * AFFI Social Features — Feed, Jobs, Messages, Endorsements, Notifications
 */

// === FEED ===
async function loadFeed() {
    const res = await fetch(`${API}/api/social?action=feed`);
    const posts = await res.json();
    const el = document.getElementById('feed-list');
    if (!el) return;
    if (!posts.length) { el.innerHTML = '<p class="empty-msg">Aucune publication</p>'; return; }
    el.innerHTML = posts.map(p => {
        const initials = (p.first_name||'?')[0] + (p.last_name||'?')[0];
        const badges = (p.badges||[]).map(b => `<span class="profile-badge">${esc(b)}</span>`).join('');
        const comments = (p.comments||[]).map(c =>
            `<div class="feed-comment"><strong>${esc(c.first_name)} ${esc(c.last_name)}</strong> ${esc(c.content)}</div>`
        ).join('');
        return `<div class="feed-card">
            <div class="feed-header">
                <div class="member-avatar" style="width:42px;height:42px;font-size:14px">${initials}</div>
                <div>
                    <div class="feed-author">${esc(p.first_name)} ${esc(p.last_name)} ${badges}</div>
                    <div class="feed-meta">${esc(p.company||'')} &middot; ${formatDate(p.created_at)}</div>
                </div>
            </div>
            <div class="feed-content">${esc(p.content)}</div>
            ${p.link_url ? `<a href="${esc(p.link_url)}" target="_blank" class="feed-link">${esc(p.link_title||p.link_url)}</a>` : ''}
            <div class="feed-actions">
                <button onclick="likeFeed(${p.id})" class="feed-action-btn">&hearts; ${p.likes_count||0}</button>
                <button onclick="toggleComments(${p.id})" class="feed-action-btn">&#128172; ${p.comments_count||0}</button>
            </div>
            <div id="comments-${p.id}" class="feed-comments" style="display:none">
                ${comments}
                ${authToken ? `<form onsubmit="commentFeed(event,${p.id})" class="comment-form">
                    <input name="content" placeholder="Votre commentaire..." required>
                    <button type="submit">Envoyer</button>
                </form>` : ''}
            </div>
        </div>`;
    }).join('');
}

function toggleComments(postId) {
    const el = document.getElementById('comments-' + postId);
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

async function likeFeed(postId) {
    if (!authToken) return alert('Connectez-vous pour liker');
    await fetch(`${API}/api/social`, {method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+authToken},
        body: JSON.stringify({action:'like_feed', post_id: postId})});
    loadFeed();
}

async function commentFeed(evt, postId) {
    evt.preventDefault();
    const content = evt.target.content.value;
    await fetch(`${API}/api/social`, {method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+authToken},
        body: JSON.stringify({action:'comment_feed', post_id: postId, content})});
    evt.target.reset();
    loadFeed();
}

async function postToFeed(evt) {
    evt.preventDefault();
    const content = evt.target.content.value;
    await fetch(`${API}/api/social`, {method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+authToken},
        body: JSON.stringify({action:'post_feed', content})});
    evt.target.reset();
    loadFeed();
}

// === JOBS ===
async function loadJobs(search, sector, freelance) {
    const p = new URLSearchParams({action:'jobs'});
    if (search) p.set('search', search);
    if (sector) p.set('sector', sector);
    if (freelance) p.set('freelance', '1');
    const res = await fetch(`${API}/api/social?${p}`);
    const jobs = await res.json();
    const el = document.getElementById('jobs-list');
    if (!el) return;
    if (!jobs.length) { el.innerHTML = '<p class="empty-msg">Aucune offre</p>'; return; }
    el.innerHTML = jobs.map(j => `
        <div class="job-card">
            <div class="job-header">
                <div>
                    <div class="job-title">${esc(j.title)}</div>
                    <div class="job-company">${esc(j.company)} &middot; ${esc(j.location||'')}</div>
                </div>
                <div>
                    ${j.is_freelance ? '<span class="card-tag" style="background:var(--purple);color:#fff">Freelance</span>' : ''}
                    <span class="card-tag">${esc(j.contract_type||'CDI')}</span>
                </div>
            </div>
            <div class="job-desc">${esc(j.description||'')}</div>
            <div class="job-footer">
                ${j.salary_range ? `<span class="job-salary">${esc(j.salary_range)}</span>` : ''}
                <span class="card-tag">${esc(j.sector||'')}</span>
                <span style="font-size:12px;color:var(--gray-400)">${formatDate(j.created_at)}</span>
                ${authToken ? `<button onclick="applyJob(${j.id})" class="btn btn-accent" style="font-size:12px;padding:6px 16px;margin-left:auto">Postuler</button>` : ''}
            </div>
        </div>
    `).join('');
}

async function applyJob(jobId) {
    const letter = prompt('Lettre de motivation (optionnel) :');
    await fetch(`${API}/api/social`, {method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+authToken},
        body: JSON.stringify({action:'apply_job', job_id: jobId, cover_letter: letter||''})});
    alert('Candidature envoyee !');
}

function showJobForm() {
    const html = `<div class="adm-modal-bg" id="job-modal" onclick="if(event.target===this)this.remove()"><div class="adm-modal">
        <h3 style="margin-bottom:20px;color:var(--primary)">Publier une offre</h3>
        <form onsubmit="postJob(event)">
            <div class="form-group"><label>Titre du poste *</label><input name="title" required></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="form-group"><label>Entreprise</label><input name="company"></div>
                <div class="form-group"><label>Lieu</label><input name="location"></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="form-group"><label>Type de contrat</label><select name="contract_type">
                    <option>CDI</option><option>CDD</option>
                    <option>Stage</option><option>Apprentissage</option>
                    <option>Alternance</option><option>VIE</option>
                    <option>Freelance</option><option>Interim</option>
                </select></div>
                <div class="form-group"><label>Remuneration</label><input name="salary_range" placeholder="Ex: 45-55k EUR ou 800 EUR/mois"></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr auto;gap:12px">
                <div class="form-group"><label>Secteur</label><select name="sector">
                    <option value="">Selectionner...</option>
                    <option>Signalisation & ERTMS</option><option>Materiel roulant</option>
                    <option>Infrastructure</option><option>Maintenance</option>
                    <option>Numerique & IA</option><option>Ingenierie & Conseil</option>
                </select></div>
                <div class="form-group" style="display:flex;align-items:center;gap:8px;padding-top:24px">
                    <input type="checkbox" name="is_freelance"> <label>Freelance</label>
                </div>
            </div>
            <div class="form-group"><label>Description</label><textarea name="description" style="min-height:100px"></textarea></div>
            <button type="submit" class="btn btn-accent" style="width:100%">Publier l'offre</button>
        </form>
    </div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

async function postJob(evt) {
    evt.preventDefault();
    const f = evt.target;
    await fetch(`${API}/api/social`, {method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+authToken},
        body: JSON.stringify({action:'post_job', title:f.title.value, company:f.company.value, location:f.location.value,
            contract_type:f.contract_type.value, salary_range:f.salary_range.value, description:f.description.value,
            sector:f.sector.value, is_freelance:f.is_freelance.checked})});
    document.getElementById('job-modal')?.remove();
    f.reset();
    loadJobs();
}

// === MESSAGES ===
async function loadConversations() {
    const res = await fetch(`${API}/api/social?action=conversations`, {headers:{'Authorization':'Bearer '+authToken}});
    const convos = await res.json();
    const el = document.getElementById('conversations-list');
    if (!el) return;
    if (!convos.length) { el.innerHTML = '<p class="empty-msg">Aucun message</p>'; return; }
    el.innerHTML = convos.map(c => `
        <div class="conv-item ${c.unread ? 'conv-unread' : ''}" onclick="openThread(${c.other_id}, '${esc(c.first_name)} ${esc(c.last_name)}')">
            <div class="member-avatar" style="width:40px;height:40px;font-size:14px">${(c.first_name||'?')[0]}${(c.last_name||'?')[0]}</div>
            <div class="conv-info">
                <div class="conv-name">${esc(c.first_name)} ${esc(c.last_name)}</div>
                <div class="conv-preview">${esc((c.last_msg||'').substring(0,60))}</div>
            </div>
            <div class="conv-date">${formatDate(c.last_date)}</div>
        </div>
    `).join('');
}

async function openThread(otherId, name) {
    const res = await fetch(`${API}/api/social?action=thread&with=${otherId}`, {headers:{'Authorization':'Bearer '+authToken}});
    const msgs = await res.json();
    const el = document.getElementById('thread-panel');
    if (!el) return;
    el.style.display = 'block';
    el.innerHTML = `
        <div class="thread-header">
            <button onclick="document.getElementById('thread-panel').style.display='none'" style="background:none;border:none;font-size:20px;cursor:pointer">&larr;</button>
            <strong>${esc(name)}</strong>
        </div>
        <div class="thread-messages" id="thread-msgs">
            ${msgs.map(m => `
                <div class="thread-msg ${m.from_member_id === currentUser.id ? 'msg-mine' : 'msg-other'}">
                    <div class="msg-content">${esc(m.content)}</div>
                    <div class="msg-time">${formatDate(m.created_at)}</div>
                </div>
            `).join('')}
        </div>
        <form onsubmit="sendMessage(event,${otherId})" class="thread-input">
            <input name="content" placeholder="Votre message..." required autocomplete="off">
            <button type="submit" class="btn btn-accent" style="padding:10px 20px">Envoyer</button>
        </form>
    `;
    const msgBox = document.getElementById('thread-msgs');
    if (msgBox) msgBox.scrollTop = msgBox.scrollHeight;
}

async function sendMessage(evt, toId) {
    evt.preventDefault();
    const content = evt.target.content.value;
    await fetch(`${API}/api/social`, {method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+authToken},
        body: JSON.stringify({action:'send_message', to_member_id: toId, content})});
    evt.target.content.value = '';
    openThread(toId, '');
}

function startConversation(memberId, name) {
    switchMemberTab('messages');
    setTimeout(() => openThread(memberId, name), 300);
}

async function showNewMessageForm() {
    // Charger la liste des membres pour le selecteur
    try {
        const res = await fetch(`${API}/api/members?action=directory`, {headers:{'Authorization':'Bearer '+authToken}});
        const members = await res.json();
        const others = members.filter(m => m.id !== currentUser.id);
        const html = `<div class="adm-modal-bg" id="newmsg-modal" onclick="if(event.target===this)this.remove()"><div class="adm-modal">
            <h3 style="margin-bottom:16px;color:var(--primary)">Nouveau message</h3>
            <div class="form-group"><label>Destinataire</label>
                <select id="nm-to" style="width:100%;padding:10px;border:2px solid var(--gray-200);border-radius:var(--radius);font-family:inherit">
                    <option value="">Choisir un membre...</option>
                    ${others.map(m => `<option value="${m.id}">${esc(m.first_name)} ${esc(m.last_name)} — ${esc(m.company||'')}</option>`).join('')}
                </select>
            </div>
            <div class="form-group"><label>Message</label>
                <textarea id="nm-content" style="width:100%;padding:10px;border:2px solid var(--gray-200);border-radius:var(--radius);font-family:inherit;min-height:100px" required></textarea>
            </div>
            <button onclick="sendNewMessage()" class="btn btn-accent" style="width:100%">Envoyer</button>
        </div></div>`;
        document.body.insertAdjacentHTML('beforeend', html);
    } catch (e) { alert('Erreur: ' + e.message); }
}

async function sendNewMessage() {
    const toId = document.getElementById('nm-to').value;
    const content = document.getElementById('nm-content').value;
    if (!toId || !content) return alert('Selectionnez un destinataire et ecrivez un message');
    await fetch(`${API}/api/social`, {method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+authToken},
        body: JSON.stringify({action:'send_message', to_member_id: parseInt(toId), content})});
    document.getElementById('newmsg-modal')?.remove();
    loadConversations();
    const sel = document.getElementById('nm-to');
    const name = sel.options[sel.selectedIndex].text.split(' — ')[0];
    openThread(parseInt(toId), name);
}

// === NOTIFICATIONS ===
async function loadNotifications() {
    if (!authToken) return;
    const res = await fetch(`${API}/api/social?action=notifications`, {headers:{'Authorization':'Bearer '+authToken}});
    const data = await res.json();
    const badge = document.getElementById('notif-badge');
    if (badge) {
        badge.textContent = data.unread || '';
        badge.style.display = data.unread > 0 ? 'inline-block' : 'none';
    }
    const el = document.getElementById('notif-list');
    if (!el) return;
    el.innerHTML = (data.items||[]).map(n => `
        <div class="notif-item ${n.is_read ? '' : 'notif-unread'}">
            <div class="notif-title">${esc(n.title)}</div>
            <div class="notif-text">${esc(n.content||'')}</div>
            <div class="notif-date">${formatDate(n.created_at)}</div>
        </div>
    `).join('') || '<p class="empty-msg">Aucune notification</p>';
}

async function markAllNotifRead() {
    await fetch(`${API}/api/social`, {method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+authToken},
        body: JSON.stringify({action:'read_notifications'})});
    loadNotifications();
}

// === ENDORSEMENTS ===
async function endorseMember(memberId, skill) {
    const comment = prompt(`Validez la competence "${skill}" - commentaire (optionnel) :`);
    if (comment === null) return;
    await fetch(`${API}/api/social`, {method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+authToken},
        body: JSON.stringify({action:'endorse', member_id: memberId, skill, comment: comment||''})});
    alert('Competence validee !');
}

// Auto-load notifications every 30s
setInterval(() => { if (authToken) loadNotifications(); }, 30000);
