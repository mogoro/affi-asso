/* === FEATURES: .ics, partage, dark mode, endorsements, polls, badges, stats === */

// === EXPORT .ICS ===
function downloadICS(title, description, location, startDate, endDate) {
    const fmt = d => new Date(d).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
    const ics = [
        'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//AFFI//FR',
        'BEGIN:VEVENT',
        `DTSTART:${fmt(startDate)}`,
        `DTEND:${fmt(endDate || new Date(new Date(startDate).getTime()+7200000))}`,
        `SUMMARY:${title}`,
        `DESCRIPTION:${(description||'').replace(/\n/g,'\\n')}`,
        `LOCATION:${location||''}`,
        `ORGANIZER:CN=AFFI:mailto:contact@ingenieur-ferroviaire.net`,
        'END:VEVENT','END:VCALENDAR'
    ].join('\r\n');
    const blob = new Blob([ics], {type:'text/calendar;charset=utf-8'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = title.replace(/[^a-zA-Z0-9]/g,'_') + '.ics';
    a.click();
}

// === SHARE SOCIAL ===
function shareLinkedIn(title, url) {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank', 'width=600,height=400');
}
function shareTwitter(title, url) {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`, '_blank', 'width=600,height=400');
}
function shareEmail(title, url) {
    window.location.href = `mailto:?subject=${encodeURIComponent('[AFFI] ' + title)}&body=${encodeURIComponent(title + '\n\n' + url)}`;
}
function copyLink(url) {
    navigator.clipboard.writeText(url).then(() => {
        if (typeof showToast === 'function') showToast('Lien copie !', 'success');
    });
}

function renderShareButtons(title, eventId) {
    const url = `https://affi-asso.vercel.app/#evenements`;
    return `<div class="share-bar">
        <span class="share-label">Partager :</span>
        <button onclick="event.stopPropagation();shareLinkedIn('${esc(title)}','${url}')" class="share-btn share-li" title="LinkedIn">in</button>
        <button onclick="event.stopPropagation();shareTwitter('${esc(title)}','${url}')" class="share-btn share-tw" title="Twitter">𝕏</button>
        <button onclick="event.stopPropagation();shareEmail('${esc(title)}','${url}')" class="share-btn share-em" title="Email">&#9993;</button>
        <button onclick="event.stopPropagation();copyLink('${url}')" class="share-btn share-cp" title="Copier le lien">&#128279;</button>
    </div>`;
}

// === DARK MODE ===
function initDarkMode() {
    const saved = localStorage.getItem('affi_dark_mode');
    if (saved === 'true') document.body.classList.add('dark-mode');
    // Injecter le toggle dans la navbar
    const actions = document.querySelector('.nav-actions');
    if (actions && !document.getElementById('dark-toggle')) {
        const btn = document.createElement('button');
        btn.id = 'dark-toggle';
        btn.className = 'nav-dark-toggle';
        btn.title = 'Mode sombre';
        btn.innerHTML = document.body.classList.contains('dark-mode') ? '&#9728;' : '&#127769;';
        btn.onclick = toggleDarkMode;
        actions.insertBefore(btn, actions.firstChild);
    }
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('affi_dark_mode', isDark);
    const btn = document.getElementById('dark-toggle');
    if (btn) btn.innerHTML = isDark ? '&#9728;' : '&#127769;';
}

// === ENDORSEMENTS ===
function renderEndorseButton(memberId, memberName) {
    return `<button onclick="event.stopPropagation();showEndorseForm(${memberId},'${esc(memberName)}')" class="ec-btn" style="background:var(--green);color:#fff;font-size:11px">&#10003; Recommander</button>`;
}

function showEndorseForm(memberId, name) {
    const skills = ['Signalisation & ERTMS','Infrastructure','Materiel roulant','Maintenance',
        'Numerique & IA','Ingenierie & Conseil','Genie civil','Telecoms','Energie','Management'];
    const html = `<div class="adm-modal-bg" id="endorse-modal" onclick="if(event.target===this)this.remove()"><div class="adm-modal">
        <h3 style="margin-bottom:16px;color:var(--primary)">Recommander ${esc(name)}</h3>
        <div class="form-group"><label>Competence</label>
            <div class="endorse-skills">${skills.map(s =>
                `<label class="endorse-skill-opt"><input type="radio" name="endorse-skill" value="${s}"> ${s}</label>`
            ).join('')}</div>
        </div>
        <button onclick="submitEndorse(${memberId})" class="btn btn-accent" style="width:100%;margin-top:12px">Valider la recommandation</button>
    </div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

async function submitEndorse(memberId) {
    const skill = document.querySelector('input[name="endorse-skill"]:checked')?.value;
    if (!skill) return alert('Selectionnez une competence');
    await fetch(`${API}/api/social`, {method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+authToken},
        body: JSON.stringify({action:'endorse', member_id: memberId, skill})});
    document.getElementById('endorse-modal')?.remove();
    if (typeof showToast === 'function') showToast('Recommandation envoyee !', 'success');
}

// === POLLS / SONDAGES ===
async function loadPolls() {
    try {
        const res = await fetch(`${API}/api/social?action=polls`, {headers:{'Authorization':'Bearer '+(typeof authToken!=='undefined'?authToken:'')}});
        const polls = await res.json();
        const el = document.getElementById('polls-container');
        if (!el) return;
        if (!polls.length) { el.innerHTML = '<p class="empty-msg">Aucun sondage en cours</p>'; return; }
        el.innerHTML = polls.map(p => {
            const totalVotes = p.total_votes || 0;
            const myVotes = p.my_votes || [];
            const hasVoted = myVotes.length > 0;
            return `<div class="poll-card">
                <div class="poll-header">
                    <h4 class="poll-title">${esc(p.title)}</h4>
                    ${p.description ? `<p class="poll-desc">${esc(p.description)}</p>` : ''}
                    <span class="poll-meta">${totalVotes} vote(s) · Par ${esc(p.first_name||'')} ${esc(p.last_name||'')}</span>
                </div>
                <div class="poll-options">
                    ${(p.options||[]).map(o => {
                        const pct = totalVotes > 0 ? Math.round(o.votes / totalVotes * 100) : 0;
                        const isMyVote = myVotes.includes(o.id);
                        return `<div class="poll-option ${isMyVote ? 'poll-voted' : ''}" onclick="${hasVoted ? '' : `votePoll(${p.id},${o.id})`}">
                            <div class="poll-bar" style="width:${pct}%"></div>
                            <span class="poll-opt-label">${esc(o.label)}</span>
                            <span class="poll-opt-pct">${pct}%</span>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        }).join('');
    } catch(e) { console.warn('Polls:', e); }
}

async function votePoll(pollId, optionId) {
    if (!authToken) return navigate('membres');
    await fetch(`${API}/api/social`, {method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+authToken},
        body: JSON.stringify({action:'vote_poll', poll_id: pollId, option_id: optionId})});
    loadPolls();
}

// === BADGE VERIFIE ===
function verifiedBadge(isVerified) {
    return isVerified ? '<span class="verified-badge" title="Membre verifie par l\'AFFI">&#10004;</span>' : '';
}

// === STATS DASHBOARD ===
async function loadStatsDashboard() {
    try {
        const res = await fetch(`${API}/api/admin?action=stats_dashboard`, {headers:{'Authorization':'Bearer '+authToken}});
        const s = await res.json();
        const el = document.getElementById('adm-stats-content');
        if (!el) return;
        el.innerHTML = `
            <div class="kpi-row" style="margin-bottom:32px">
                <div class="kpi-card"><div class="kpi-val">${s.total}</div><div class="kpi-label">Membres actifs</div></div>
                <div class="kpi-card"><div class="kpi-val">${s.verified}</div><div class="kpi-label">Verifies</div></div>
                <div class="kpi-card"><div class="kpi-val">${s.board}</div><div class="kpi-label">Bureau</div></div>
                <div class="kpi-card"><div class="kpi-val">${s.mentors}</div><div class="kpi-label">Mentors</div></div>
                <div class="kpi-card"><div class="kpi-val">${s.events_total}</div><div class="kpi-label">Evenements</div></div>
                <div class="kpi-card"><div class="kpi-val">${s.events_upcoming}</div><div class="kpi-label">A venir</div></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">
                <div class="card" style="padding:20px">
                    <h4 style="margin-bottom:12px;color:var(--primary)">Repartition par secteur</h4>
                    ${(s.by_sector||[]).map(x => {
                        const pct = Math.round(x.n / s.total * 100);
                        return `<div class="stat-bar-row">
                            <span class="stat-bar-label">${esc(x.sector||'Non renseigne')}</span>
                            <div class="stat-bar"><div class="stat-bar-fill" style="width:${pct}%"></div></div>
                            <span class="stat-bar-val">${x.n}</span>
                        </div>`;
                    }).join('')}
                </div>
                <div class="card" style="padding:20px">
                    <h4 style="margin-bottom:12px;color:var(--primary)">Repartition par region</h4>
                    ${(s.by_region||[]).map(x => {
                        const pct = Math.round(x.n / s.total * 100);
                        return `<div class="stat-bar-row">
                            <span class="stat-bar-label">${esc(x.region||'Non renseigne')}</span>
                            <div class="stat-bar"><div class="stat-bar-fill" style="width:${pct}%"></div></div>
                            <span class="stat-bar-val">${x.n}</span>
                        </div>`;
                    }).join('')}
                </div>
            </div>
            <div class="card" style="padding:20px;margin-top:24px">
                <h4 style="margin-bottom:12px;color:var(--primary)">Adhesions par mois</h4>
                <div class="chart-months">${(s.by_month||[]).reverse().map(x =>
                    `<div class="chart-col"><div class="chart-bar" style="height:${Math.max(8, x.n * 20)}px"></div><span class="chart-label">${x.month.slice(5)}</span><span class="chart-val">${x.n}</span></div>`
                ).join('')}</div>
            </div>`;
    } catch(e) { console.warn('Stats:', e); }
}

// === EVENT COMMUNICATION (admin) ===
function showEventCommForm(eventId, title) {
    const html = `<div class="adm-modal-bg" id="comm-modal" onclick="if(event.target===this)this.remove()"><div class="adm-modal">
        <h3 style="margin-bottom:16px;color:var(--primary)">Communiquer — ${esc(title)}</h3>
        <div class="form-group"><label>Objet</label><input type="text" id="comm-subject" value="[AFFI] ${esc(title)}"></div>
        <div class="form-group"><label>Message</label><textarea id="comm-body" style="min-height:120px" placeholder="Contenu du message..."></textarea></div>
        <div class="form-group"><label>Destinataires</label><select id="comm-type">
            <option value="registered">Inscrits a l'evenement</option>
            <option value="all">Tous les membres</option>
        </select></div>
        <button onclick="sendEventComm(${eventId})" class="btn btn-accent" style="width:100%">Envoyer</button>
    </div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

async function sendEventComm(eventId) {
    const subject = document.getElementById('comm-subject').value;
    const body = document.getElementById('comm-body').value;
    const type = document.getElementById('comm-type').value;
    if (!subject || !body) return alert('Remplissez tous les champs');
    await fetch(`${API}/api/admin`, {method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+authToken},
        body: JSON.stringify({action:'send_event_comm', event_id: eventId, subject, body, recipient_type: type})});
    document.getElementById('comm-modal')?.remove();
    if (typeof showToast === 'function') showToast('Communication enregistree !', 'success');
}

// === EMARGEMENT ===
async function markAttended(regId) {
    await fetch(`${API}/api/admin`, {method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+authToken},
        body: JSON.stringify({action:'event_attend', registration_id: regId})});
    if (typeof showToast === 'function') showToast('Presence enregistree', 'success');
}

// === CREATE POLL (admin) ===
function showCreatePollForm() {
    const html = `<div class="adm-modal-bg" id="poll-modal" onclick="if(event.target===this)this.remove()"><div class="adm-modal">
        <h3 style="margin-bottom:16px;color:var(--primary)">Creer un sondage</h3>
        <div class="form-group"><label>Question</label><input type="text" id="poll-title" placeholder="Ex: Quel theme pour le prochain colloque ?"></div>
        <div class="form-group"><label>Description (optionnel)</label><textarea id="poll-desc" style="min-height:60px"></textarea></div>
        <div class="form-group"><label>Options de reponse</label>
            <div id="poll-options-list">
                <input type="text" class="poll-opt-input" placeholder="Option 1">
                <input type="text" class="poll-opt-input" placeholder="Option 2">
                <input type="text" class="poll-opt-input" placeholder="Option 3">
            </div>
            <button onclick="document.getElementById('poll-options-list').insertAdjacentHTML('beforeend','<input type=\\'text\\' class=\\'poll-opt-input\\' placeholder=\\'Option supplem...\\'>')" style="margin-top:8px;font-size:12px;background:none;border:1px dashed var(--gray-300);padding:6px 12px;border-radius:6px;cursor:pointer;color:var(--gray-500)">+ Ajouter une option</button>
        </div>
        <div class="form-group" style="display:flex;gap:16px">
            <label><input type="checkbox" id="poll-anon"> Votes anonymes</label>
            <label><input type="checkbox" id="poll-multi"> Choix multiples</label>
        </div>
        <button onclick="submitPoll()" class="btn btn-accent" style="width:100%">Publier le sondage</button>
    </div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

async function submitPoll() {
    const title = document.getElementById('poll-title').value;
    const opts = [...document.querySelectorAll('.poll-opt-input')].map(i => i.value.trim()).filter(Boolean);
    if (!title || opts.length < 2) return alert('Titre et au moins 2 options requis');
    await fetch(`${API}/api/social`, {method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+authToken},
        body: JSON.stringify({action:'create_poll', title, description: document.getElementById('poll-desc').value,
            options: opts, is_anonymous: document.getElementById('poll-anon').checked,
            multiple_choice: document.getElementById('poll-multi').checked})});
    document.getElementById('poll-modal')?.remove();
    loadPolls();
    if (typeof showToast === 'function') showToast('Sondage publie !', 'success');
}

// Init dark mode on load
document.addEventListener('DOMContentLoaded', initDarkMode);
