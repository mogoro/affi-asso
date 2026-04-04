/**
 * AFFI — SPA Router, Slider, Page Logic
 */
const API = window.location.origin;
const PAGES = ['accueil','identite','annuaire','agenda','evenements','publications','replays','quizz','ecoles','adhesion','contact','membres'];
let _homeLoaded = false;

// === READING PROGRESS BAR ===
window.addEventListener('scroll', function() {
    const bar = document.getElementById('reading-progress');
    if (!bar) return;
    const h = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = h > 0 ? (window.scrollY / h * 100) + '%' : '0';
}, { passive: true });

// === LARGE FONT TOGGLE ===
function toggleLargeFont() {
    document.body.classList.toggle('large-font');
    localStorage.setItem('affi_large_font', document.body.classList.contains('large-font'));
}
(function() {
    if (localStorage.getItem('affi_large_font') === 'true') document.body.classList.add('large-font');
})();

// === ROUTER ===
const LOCKED_PAGES = ['evenements', 'replays', 'quizz', 'publications'];
const LOCKED_TITLES = {
    evenements: 'Evenements',
    replays: 'Replays & Webinaires',
    quizz: 'Quizz du Rail',
    publications: 'Publications'
};

function isLoggedIn() {
    return !!(typeof authToken !== 'undefined' && authToken && authToken.length > 5);
}

function navigate(page) {
    if (!PAGES.includes(page)) page = 'accueil';
    // Fermer toutes les popups ouvertes
    document.querySelectorAll('.event-detail-overlay').forEach(o => o.remove());
    document.querySelectorAll('.adm-modal-bg').forEach(o => o.remove());
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const el = document.getElementById('page-' + page);
    if (el) el.classList.add('active');
    document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.page === page));
    window.scrollTo({top: 0, behavior: 'smooth'});
    history.pushState(null, '', '#' + page);

    // Mettre a jour l'etat de la navbar
    updateNavbarState();
    updateNavSub(page);

    // Pages bloquees : remplacer tout le contenu par le cadenas
    if (LOCKED_PAGES.includes(page) && !isLoggedIn()) {
        renderLockedPage(page);
        return;
    }

    if (page === 'agenda') { loadAgenda(); if (typeof loadCourses === 'function') loadCourses(); }
    if (page === 'evenements') loadEvents();
    if (page === 'annuaire') { isLoggedIn() ? loadPublicAnnuaireFull() : loadPublicAnnuaire(); }
    if (page === 'publications') loadPublications();
    if (page === 'ecoles') { loadStages(); if (typeof loadEcoles === 'function') loadEcoles(); }
    if (page === 'replays') loadReplays();
    if (page === 'quizz') loadQuizz();
    if (page === 'accueil') { if (!_homeLoaded) { loadHome(); loadPartenaires(); loadReseauBouge(); loadPartnerBanner(); _homeLoaded = true; } lockCarriereIfNeeded(); if (isLoggedIn()) showWelcomeDashboard(); else hideWelcomeDashboard(); initScrollSpy(); }
    if (page === 'identite') { loadOrganigramme(); setTimeout(() => { if (typeof loadMap === 'function') loadMap(); }, 300); initScrollSpy(); }
    // Si connecte et on va sur membres, afficher directement l'espace membre
    if (page === 'membres' && isLoggedIn() && typeof showMemberArea === 'function') {
        showMemberArea();
    }
}

function renderLockedPage(page) {
    const el = document.getElementById('page-' + page);
    if (!el) return;
    // Sauvegarder le contenu original pour le restaurer apres connexion
    if (!el.dataset.originalSaved) {
        el.dataset.originalHtml = el.innerHTML;
        el.dataset.originalSaved = 'true';
    }
    el.innerHTML = `
        <section>
            <div class="container">
                <div class="section-line section-line-center"></div>
                <h2 class="section-title section-title-center">${LOCKED_TITLES[page] || page}</h2>
            </div>
        </section>
        <div class="locked-page">
            <div class="locked-page-content">
                <div class="locked-page-icon">&#128274;</div>
                <h2>Contenu reserve aux adherents</h2>
                <p>Connectez-vous ou adherez a l'AFFI pour acceder a cette rubrique.</p>
                <div style="display:flex;gap:12px;justify-content:center;margin-top:24px">
                    <a class="btn btn-accent" href="#" onclick="event.preventDefault();showLoginPopup()">Se connecter</a>
                    <a class="btn btn-primary" href="#adhesion" onclick="navigate('adhesion')">Adherer a l'AFFI</a>
                </div>
            </div>
        </div>`;
}

function restoreLockedPages() {
    LOCKED_PAGES.forEach(page => {
        const el = document.getElementById('page-' + page);
        if (el && el.dataset.originalSaved === 'true') {
            el.innerHTML = el.dataset.originalHtml;
            el.dataset.originalSaved = '';
        }
    });
}

function updateNavbarState() {
    const loggedIn = isLoggedIn();
    const userArea = document.getElementById('nav-user-area');
    if (!userArea) return;

    if (loggedIn && typeof currentUser !== 'undefined' && currentUser) {
        const initials = ((currentUser.first_name||'?')[0] + (currentUser.last_name||'?')[0]).toUpperCase();
        const hasPhoto = currentUser.photo_url && currentUser.photo_url.startsWith('http');
        userArea.innerHTML = `
            <a class="nav-user-logged" href="#membres" onclick="navigate('membres')">
                <div class="nav-user-avatar">${hasPhoto ? `<img src="${esc(currentUser.photo_url)}" alt="">` : initials}</div>
                <div>
                    <div class="nav-user-name">${esc(currentUser.first_name)}</div>
                    <div class="nav-user-role">${esc(currentUser.job_title || 'Membre')}</div>
                </div>
            </a>`;
    } else {
        userArea.innerHTML = `<a class="nav-member-btn" href="#" onclick="event.preventDefault();showLoginPopup()">Connexion</a>`;
    }

    // Quand connecte: "Adherer" -> "Tableau de bord"
    const adhesionLink = document.getElementById('nav-adhesion-link');
    if (adhesionLink) {
        if (loggedIn) {
            adhesionLink.dataset.page = 'membres';
            adhesionLink.setAttribute('onclick', "navigate('membres');document.getElementById('nav-links').classList.remove('open')");
            adhesionLink.querySelector('.nav-link-icon').textContent = '\u{1F4CA}';
            adhesionLink.querySelector('.nav-link-text').textContent = 'Tableau de bord';
        } else {
            adhesionLink.dataset.page = 'adhesion';
            adhesionLink.setAttribute('onclick', "navigate('adhesion');document.getElementById('nav-links').classList.remove('open')");
            adhesionLink.querySelector('.nav-link-icon').textContent = '\u{2795}';
            adhesionLink.querySelector('.nav-link-text').textContent = 'Adhérer';
        }
    }

    // Cadenas dynamiques dans la nav
    document.querySelectorAll('.nav-link-icon').forEach(icon => {
        const link = icon.closest('.nav-link');
        if (!link) return;
        const page = link.dataset.page;
        if (LOCKED_PAGES.includes(page)) {
            if (loggedIn) { icon.dataset.originalIcon && (icon.textContent = icon.dataset.originalIcon); }
            else { if (!icon.dataset.originalIcon) icon.dataset.originalIcon = icon.textContent; icon.textContent = '\u{1F512}'; }
        }
    });
}

// === NAV SEARCH ===
let _navSearchTimer;
async function onNavSearch(q) {
    clearTimeout(_navSearchTimer);
    const el = document.getElementById('nav-search-results');
    if (!el) return;
    if (q.length < 2) { el.style.display = 'none'; return; }
    _navSearchTimer = setTimeout(async () => {
        try {
            const [evRes, memRes, newsRes] = await Promise.all([
                fetch(`${API}/api/events?search=${encodeURIComponent(q)}&limit=5`).then(r=>r.json()).catch(()=>[]),
                fetch(`${API}/api/members?action=public_annuaire&search=${encodeURIComponent(q)}`).then(r=>r.json()).catch(()=>[]),
                fetch(`${API}/api/news?search=${encodeURIComponent(q)}&limit=3`).then(r=>r.json()).catch(()=>[]),
            ]);
            let html = '';
            if (evRes.length) {
                html += '<div style="padding:6px 14px;font-size:10px;font-weight:800;color:var(--gray-400);text-transform:uppercase;letter-spacing:1px;background:var(--gray-50)">Evenements</div>';
                html += evRes.slice(0,4).map(e => `<div class="nsr-item" onclick="navigate('agenda');setTimeout(()=>showEventDetail(${e.id}),300)">
                    <div class="nsr-avatar" style="background:var(--accent);font-size:14px">&#128197;</div>
                    <div><strong>${esc(e.title)}</strong><br><span style="font-size:12px;color:var(--gray-400)">${formatDate(e.start_date)} · ${esc(e.event_type||'')} · ${esc(e.location||'')}</span></div>
                </div>`).join('');
            }
            if (memRes.length) {
                html += '<div style="padding:6px 14px;font-size:10px;font-weight:800;color:var(--gray-400);text-transform:uppercase;letter-spacing:1px;background:var(--gray-50)">Membres</div>';
                html += memRes.slice(0,3).map(m => {
                    const initials = ((m.first_name||'?')[0] + (m.last_name||'?')[0]).toUpperCase();
                    const name = isLoggedIn() ? `${m.first_name} ${m.last_name}` : initials;
                    return `<div class="nsr-item" onclick="navigate('annuaire')">
                        <div class="nsr-avatar">${initials}</div>
                        <div><strong>${esc(name)}</strong><br><span style="font-size:12px;color:var(--gray-400)">${esc(m.company||'')} · ${esc(m.sector||'')}</span></div>
                    </div>`;
                }).join('');
            }
            if (newsRes.length) {
                html += '<div style="padding:6px 14px;font-size:10px;font-weight:800;color:var(--gray-400);text-transform:uppercase;letter-spacing:1px;background:var(--gray-50)">Actualites</div>';
                html += newsRes.slice(0,3).map(n => `<div class="nsr-item" onclick="navigate('publications')">
                    <div class="nsr-avatar" style="background:var(--teal);font-size:14px">&#128240;</div>
                    <div><strong>${esc(n.title)}</strong><br><span style="font-size:12px;color:var(--gray-400)">${formatDate(n.published_at)}</span></div>
                </div>`).join('');
            }
            if (!html) html = '<div class="nsr-item" style="color:var(--gray-400)">Aucun resultat pour "' + esc(q) + '"</div>';
            el.innerHTML = html;
            el.style.display = 'block';
        } catch(e) { el.style.display = 'none'; }
    }, 300);
}

// === NAV SUB (contextuel) ===
function updateNavSub() { /* Sous-nav supprimee — une seule ligne de navigation */ }

// === SCROLL SPY for sub-nav highlight ===
let _scrollSpySections = [];
function initScrollSpy() {
    const page = location.hash.slice(1) || 'accueil';
    if (page === 'identite') {
        _scrollSpySections = ['ident-association','ident-actions','ident-historique','ident-gouvernance','ident-organigramme'];
    } else if (page === 'accueil') {
        _scrollSpySections = [];
        setTimeout(() => {
            const ids = ['news-carousel-wrapper','home-events','anciens-grid','partenaires-unified'];
            _scrollSpySections = ids.filter(id => document.getElementById(id));
        }, 500);
    } else {
        _scrollSpySections = [];
    }
}
window.addEventListener('scroll', () => {
    if (!_scrollSpySections.length) return;
    const subLinks = document.querySelectorAll('.nav-sub-link');
    if (!subLinks.length) return;
    let activeIdx = 0;
    const offset = 140;
    for (let i = _scrollSpySections.length - 1; i >= 0; i--) {
        const el = document.getElementById(_scrollSpySections[i]);
        const target = el?.closest ? (el.closest('section') || el) : el;
        if (target && target.getBoundingClientRect().top <= offset) { activeIdx = i; break; }
    }
    subLinks.forEach((l, i) => l.classList.toggle('active', i === activeIdx));
});

// Fonction appelee par members.js apres login pour tout debloquer
function onUserLoggedIn() {
    restoreLockedPages();
    updateNavbarState();
    // Recharger la page courante pour afficher le contenu
    const currentPage = location.hash.slice(1) || 'accueil';
    if (LOCKED_PAGES.includes(currentPage) || currentPage === 'annuaire' || currentPage === 'accueil') {
        navigate(currentPage);
    }
    // Afficher un sondage en popup si disponible (1 seule fois par session)
    if (!sessionStorage.getItem('affi_poll_shown')) {
        setTimeout(() => showPollPopup(), 2000);
    }
}

async function showPollPopup() {
    try {
        const res = await fetch(`${API}/api/social?action=polls`, {
            headers: {'Authorization': 'Bearer ' + (typeof authToken !== 'undefined' ? authToken : '')}
        });
        const polls = await res.json();
        if (!polls || !polls.length) return;
        // Trouver un sondage auquel l'utilisateur n'a pas encore voté
        const unvoted = polls.find(p => !p.my_votes || p.my_votes.length === 0);
        if (!unvoted) return;
        sessionStorage.setItem('affi_poll_shown', '1');

        const totalVotes = unvoted.total_votes || 0;
        const optionsHtml = (unvoted.options || []).map(o => {
            const pct = totalVotes > 0 ? Math.round(o.votes / totalVotes * 100) : 0;
            return `<button class="poll-popup-option" onclick="votePollPopup(${unvoted.id},${o.id},this)">
                <span class="poll-popup-opt-label">${esc(o.label)}</span>
                <span class="poll-popup-opt-bar" style="width:${pct}%"></span>
                <span class="poll-popup-opt-pct">${pct}%</span>
            </button>`;
        }).join('');

        const html = `<div class="auth-overlay" id="poll-popup-overlay" style="z-index:1500">
            <div class="auth-card" style="max-width:480px">
                <button class="auth-close" onclick="document.getElementById('poll-popup-overlay').remove();document.body.style.overflow=''">&times;</button>
                <div style="padding:28px 32px">
                    <div style="text-align:center;margin-bottom:20px">
                        <div style="font-size:32px;margin-bottom:8px">&#128202;</div>
                        <h2 style="font-size:20px;font-weight:900;color:var(--primary);margin:0 0 4px">Votre avis compte !</h2>
                        <p style="color:var(--gray-500);font-size:13px;margin:0">${totalVotes} vote(s) · ${esc(unvoted.first_name || '')} ${esc(unvoted.last_name || '')}</p>
                    </div>
                    <h3 style="font-size:17px;font-weight:800;color:var(--gray-900);margin-bottom:16px;text-align:center">${esc(unvoted.title)}</h3>
                    ${unvoted.description ? `<p style="font-size:13px;color:var(--gray-500);text-align:center;margin-bottom:16px">${esc(unvoted.description)}</p>` : ''}
                    <div class="poll-popup-options" id="poll-popup-options">${optionsHtml}</div>
                    <p style="text-align:center;margin-top:16px;font-size:12px;color:var(--gray-400)">Cliquez sur une option pour voter</p>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        document.body.style.overflow = 'hidden';
    } catch(e) { console.warn('Poll popup:', e); }
}

async function votePollPopup(pollId, optionId, btn) {
    if (!authToken) return;
    // Highlight selected
    document.querySelectorAll('.poll-popup-option').forEach(b => b.classList.remove('poll-popup-voted'));
    btn.classList.add('poll-popup-voted');
    try {
        await fetch(`${API}/api/social`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken},
            body: JSON.stringify({action: 'vote_poll', poll_id: pollId, option_id: optionId})
        });
        // Refresh results
        const res = await fetch(`${API}/api/social?action=polls`, {headers: {'Authorization': 'Bearer ' + authToken}});
        const polls = await res.json();
        const poll = polls.find(p => p.id === pollId);
        if (poll) {
            const total = poll.total_votes || 1;
            const el = document.getElementById('poll-popup-options');
            if (el) {
                el.innerHTML = (poll.options || []).map(o => {
                    const pct = Math.round(o.votes / total * 100);
                    const voted = (poll.my_votes || []).includes(o.id);
                    return `<div class="poll-popup-option poll-popup-result ${voted ? 'poll-popup-voted' : ''}">
                        <span class="poll-popup-opt-label">${esc(o.label)}</span>
                        <span class="poll-popup-opt-bar" style="width:${pct}%"></span>
                        <span class="poll-popup-opt-pct">${pct}%</span>
                    </div>`;
                }).join('');
            }
        }
        showToast('Merci pour votre vote !', 'success');
    } catch(e) { console.warn('Vote:', e); }
}

function onUserLoggedOut() {
    updateNavbarState();
    // Re-naviguer pour reverrouiller si necessaire
    const currentPage = location.hash.slice(1) || 'accueil';
    navigate(currentPage);
}

// === SCROLL TO SECTION (Identite sub-pages) ===
function scrollToSection(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({behavior: 'smooth', block: 'start'});
}
window.addEventListener('hashchange', () => navigate(location.hash.slice(1) || 'accueil'));
document.addEventListener('DOMContentLoaded', () => {
    navigate(location.hash.slice(1) || 'accueil');
    initSlider();
    initCookieBanner();
    setTimeout(initScrollAnimations, 500);
    loadAdBanner();
});

// === LOGIN POPUP ===
function showLoginPopup() {
    document.querySelector('.auth-overlay')?.remove();
    const html = `<div class="auth-overlay" id="auth-overlay">
        <div class="auth-card">
            <button class="auth-close" onclick="document.getElementById('auth-overlay').remove();document.body.style.overflow=''">&times;</button>

            <!-- ÉTAPE 1: Connexion -->
            <div id="auth-step-login">
                <div class="auth-header">
                    <img src="https://res.cloudinary.com/dsheinfad/image/upload/q_auto,f_auto/affi/logo-affi" alt="AFFI" class="auth-logo">
                    <h2 class="auth-title">Connexion</h2>
                    <p class="auth-subtitle">Accédez à votre espace membre</p>
                </div>
                <form onsubmit="doPopupLogin(event)" class="auth-form">
                    <div class="auth-field">
                        <label class="auth-label" for="auth-email">Email</label>
                        <input type="email" id="auth-email" class="auth-input" required placeholder="votre@email.com" autocomplete="email">
                    </div>
                    <div class="auth-field">
                        <label class="auth-label" for="auth-password">Mot de passe</label>
                        <div class="auth-password-wrap">
                            <input type="password" id="auth-password" class="auth-input" required placeholder="Votre mot de passe" autocomplete="current-password">
                            <button type="button" class="auth-toggle-pw" onclick="toggleAuthPw()">Afficher</button>
                        </div>
                    </div>
                    <div id="auth-error" class="auth-error" style="display:none"></div>
                    <button type="submit" class="auth-submit" id="auth-submit-btn">Se connecter</button>
                </form>
                <div class="auth-divider"><span>ou</span></div>
                <div class="auth-footer-links">
                    <a href="#" onclick="event.preventDefault();showAuthStep('reset')">Mot de passe oublié ?</a>
                </div>
                <div class="auth-signup">
                    Pas encore membre ? <a href="#adhesion" onclick="document.getElementById('auth-overlay').remove();document.body.style.overflow='';navigate('adhesion')">Adhérer à l'AFFI</a>
                </div>
            </div>

            <!-- ÉTAPE 2: Reset - Demande email -->
            <div id="auth-step-reset" style="display:none">
                <div class="auth-header">
                    <h2 class="auth-title">Mot de passe oublié</h2>
                    <p class="auth-subtitle">Entrez votre email pour recevoir un code de réinitialisation</p>
                </div>
                <form onsubmit="doPopupRequestReset(event)" class="auth-form">
                    <div class="auth-field">
                        <label class="auth-label" for="auth-reset-email">Email</label>
                        <input type="email" id="auth-reset-email" class="auth-input" required placeholder="votre@email.com">
                    </div>
                    <div id="auth-reset-error" class="auth-error" style="display:none"></div>
                    <button type="submit" class="auth-submit" id="auth-reset-btn">Envoyer le code</button>
                </form>
                <div class="auth-footer-links">
                    <a href="#" onclick="event.preventDefault();showAuthStep('login')">&#8592; Retour à la connexion</a>
                </div>
            </div>

            <!-- ÉTAPE 3: Reset - Saisie code + nouveau MDP -->
            <div id="auth-step-code" style="display:none">
                <div class="auth-header">
                    <h2 class="auth-title">Saisissez le code</h2>
                    <p class="auth-subtitle">Un code à 6 chiffres a été envoyé à votre adresse email</p>
                </div>
                <form onsubmit="doPopupResetPassword(event)" class="auth-form">
                    <div class="auth-field">
                        <label class="auth-label" for="auth-code">Code de réinitialisation</label>
                        <input type="text" id="auth-code" class="auth-input auth-input-code" required maxlength="6" pattern="[0-9]{6}" placeholder="000000" inputmode="numeric" autocomplete="one-time-code">
                    </div>
                    <div class="auth-field">
                        <label class="auth-label" for="auth-new-pw">Nouveau mot de passe</label>
                        <input type="password" id="auth-new-pw" class="auth-input" required minlength="8" placeholder="Min. 8 caractères">
                    </div>
                    <div class="auth-field">
                        <label class="auth-label" for="auth-new-pw2">Confirmer le mot de passe</label>
                        <input type="password" id="auth-new-pw2" class="auth-input" required minlength="8" placeholder="Retapez le mot de passe">
                    </div>
                    <div id="auth-code-error" class="auth-error" style="display:none"></div>
                    <button type="submit" class="auth-submit" id="auth-code-btn">Modifier le mot de passe</button>
                </form>
                <div class="auth-footer-links">
                    <a href="#" onclick="event.preventDefault();showAuthStep('reset')">&#8592; Renvoyer un code</a>
                </div>
            </div>

            <!-- ÉTAPE 4: Succès -->
            <div id="auth-step-success" style="display:none">
                <div class="auth-header">
                    <div class="auth-success-icon">&#10003;</div>
                    <h2 class="auth-title">Mot de passe modifié !</h2>
                    <p class="auth-subtitle">Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.</p>
                </div>
                <button class="auth-submit" onclick="showAuthStep('login')">Se connecter</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    document.body.style.overflow = 'hidden';
    setTimeout(() => document.getElementById('auth-email')?.focus(), 100);
}

let _authResetToken = '';

function showAuthStep(step) {
    ['login','reset','code','success'].forEach(s => {
        const el = document.getElementById('auth-step-' + s);
        if (el) el.style.display = s === step ? 'block' : 'none';
    });
    // Focus first input
    setTimeout(() => {
        if (step === 'login') document.getElementById('auth-email')?.focus();
        if (step === 'reset') document.getElementById('auth-reset-email')?.focus();
        if (step === 'code') document.getElementById('auth-code')?.focus();
    }, 100);
}

function toggleAuthPw() {
    const inp = document.getElementById('auth-password');
    const btn = inp?.nextElementSibling;
    if (!inp) return;
    if (inp.type === 'password') { inp.type = 'text'; if (btn) btn.textContent = 'Masquer'; }
    else { inp.type = 'password'; if (btn) btn.textContent = 'Afficher'; }
}

async function doPopupRequestReset(evt) {
    evt.preventDefault();
    const email = document.getElementById('auth-reset-email').value;
    const errEl = document.getElementById('auth-reset-error');
    const btn = document.getElementById('auth-reset-btn');
    btn.textContent = 'Envoi en cours...'; btn.disabled = true;
    try {
        const res = await fetch(API + '/api/auth', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({action: 'request_reset', email})
        });
        const data = await res.json();
        _authResetToken = data.reset_token || '';
        showAuthStep('code');
    } catch(e) {
        errEl.textContent = 'Erreur réseau'; errEl.style.display = 'block';
    } finally { btn.textContent = 'Envoyer le code'; btn.disabled = false; }
}

async function doPopupResetPassword(evt) {
    evt.preventDefault();
    const code = document.getElementById('auth-code').value;
    const pw1 = document.getElementById('auth-new-pw').value;
    const pw2 = document.getElementById('auth-new-pw2').value;
    const errEl = document.getElementById('auth-code-error');
    const btn = document.getElementById('auth-code-btn');
    if (pw1 !== pw2) { errEl.textContent = 'Les mots de passe ne correspondent pas'; errEl.style.display = 'block'; return; }
    btn.textContent = 'Modification...'; btn.disabled = true;
    try {
        const res = await fetch(API + '/api/auth', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({action: 'reset_password', reset_token: _authResetToken, reset_code: code, new_password: pw1})
        });
        const data = await res.json();
        if (data.ok) { showAuthStep('success'); }
        else { errEl.textContent = data.error || 'Code invalide'; errEl.style.display = 'block'; }
    } catch(e) {
        errEl.textContent = 'Erreur réseau'; errEl.style.display = 'block';
    } finally { btn.textContent = 'Modifier le mot de passe'; btn.disabled = false; }
}

async function doPopupLogin(evt) {
    evt.preventDefault();
    const email = document.getElementById('popup-login-email').value;
    const password = document.getElementById('popup-login-password').value;
    const errEl = document.getElementById('popup-login-error');
    const btn = document.getElementById('popup-login-btn');
    btn.textContent = 'Connexion...';
    btn.disabled = true;
    try {
        const res = await fetch(API + '/api/auth', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({action: 'login', email, password})
        });
        const data = await res.json();
        if (data.token) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('affi_token', data.token);
            localStorage.setItem('affi_user', JSON.stringify(data.user));
            document.querySelector('.login-popup-overlay')?.remove();
            if (typeof onUserLoggedIn === 'function') onUserLoggedIn();
            showToast('Bienvenue, ' + (data.user.first_name || '') + ' !', 'success');
            const currentPage = location.hash.slice(1) || 'accueil';
            navigate(currentPage);
        } else {
            errEl.textContent = data.error || 'Email ou mot de passe incorrect';
            errEl.style.display = 'block';
            btn.textContent = 'Se connecter';
            btn.disabled = false;
        }
    } catch(e) {
        errEl.textContent = 'Erreur de connexion au serveur';
        errEl.style.display = 'block';
        btn.textContent = 'Se connecter';
        btn.disabled = false;
    }
}

// === HERO SLIDER ===
let currentSlide = 0;
function initSlider() {
    const slides = document.querySelectorAll('.slide');
    const dots = document.querySelectorAll('.slide-dot');
    if (!slides.length) return;
    function showSlide(n) {
        slides.forEach(s => s.classList.remove('active'));
        dots.forEach(d => d.classList.remove('active'));
        currentSlide = ((n % slides.length) + slides.length) % slides.length;
        slides[currentSlide].classList.add('active');
        if (dots[currentSlide]) dots[currentSlide].classList.add('active');
    }
    showSlide(0);
    let sliderInterval = setInterval(() => showSlide(currentSlide + 1), 5500);
    dots.forEach((d, i) => d.addEventListener('click', () => {
        showSlide(i);
        clearInterval(sliderInterval);
        sliderInterval = setInterval(() => showSlide(currentSlide + 1), 5500);
    }));
}

// === HOME ===
async function loadHome() {
    // Show cached data immediately for fast first paint
    try {
        const cachedNews = sessionStorage.getItem('affi_home_news');
        const cachedEvents = sessionStorage.getItem('affi_home_events');
        if (cachedNews) { const n = JSON.parse(cachedNews); renderNewsCarousel(n); renderHomeNews(n); }
        if (cachedEvents) renderHomeEvents(JSON.parse(cachedEvents));
    } catch(e) {}
    // Then fetch fresh data
    try {
        const [newsRes, eventsRes] = await Promise.all([
            fetch(`${API}/api/news?limit=6`), fetch(`${API}/api/events?upcoming=1&limit=4`)
        ]);
        const news = await newsRes.json();
        const events = await eventsRes.json();
        try { sessionStorage.setItem('affi_home_news', JSON.stringify(news)); } catch(e) {}
        try { sessionStorage.setItem('affi_home_events', JSON.stringify(events)); } catch(e) {}
        renderNewsCarousel(news);
        renderHomeNews(news);
        renderHomeEvents(events);
    } catch (e) { console.warn('Home:', e); }
    // Load anciens bougent
    loadAnciensBougent();
    // Load jobs and feed on homepage
    if (typeof loadJobs === 'function') loadJobs();
    if (typeof loadFeed === 'function') loadFeed();
    lockCarriereIfNeeded();
    const fc = document.getElementById('feed-compose');
    if (fc) fc.style.display = (typeof authToken !== 'undefined' && authToken) ? 'block' : 'none';
    const jb = document.getElementById('btn-post-job');
    if (jb) jb.style.display = (typeof authToken !== 'undefined' && authToken) ? 'inline-block' : 'none';
}

function renderHomeNews(items) {
    const el = document.getElementById('home-news');
    if (!el) return;
    if (!items.length) { el.innerHTML = '<p style="color:var(--gray-400);text-align:center">Aucune actualite</p>'; return; }
    const bgs = ['cip-1','cip-2','cip-3','cip-4'];
    const icons = ['\ud83d\udcf0','\ud83d\udce2','\ud83c\udfc6','\ud83d\udcca'];
    el.innerHTML = items.map((n, i) => `
        <div class="card">
            <div class="card-img-placeholder ${bgs[i % 4]}">${icons[i % 4]}</div>
            <div class="card-body">
                <span class="card-date">${formatDate(n.published_at)}</span>
                <div class="card-title">${esc(n.title)}</div>
                <div class="card-text">${esc(n.excerpt || (n.content || '').substring(0, 160))}</div>
                <span class="card-link">Lire la suite</span>
            </div>
        </div>`).join('');
}

function renderHomeEvents(items) {
    const el = document.getElementById('home-events');
    if (!el) return;
    if (!items.length) { el.innerHTML = '<p style="color:var(--gray-400);text-align:center">Aucun evenement a venir</p>'; return; }
    const bgs = ['cip-2','cip-3','cip-1','cip-4'];
    const icons = ['\ud83c\udfeb','\ud83d\ude84','\ud83c\udfc6','\ud83e\udd1d'];
    el.innerHTML = items.map((e, i) => `
        <div class="card" style="cursor:pointer" onclick="showEventDetail(${e.id})">
            <div class="card-img-placeholder ${bgs[i % 4]}">${icons[i % 4]}</div>
            <div class="card-body">
                <span class="card-date">${formatDate(e.start_date)}</span>
                ${e.event_type ? `<span class="card-tag">${esc(e.event_type)}</span>` : ''}
                ${e.location ? `<span class="card-tag">\ud83d\udccd ${esc(e.location)}</span>` : ''}
                <div class="card-title">${esc(e.title)}</div>
                <div class="card-text">${esc((e.description || '').substring(0, 130))}</div>
                <span class="card-link">En savoir plus</span>
            </div>
        </div>`).join('');
}

// === NEWS CAROUSEL ===
let _homeNewsData = [];
let newsCarouselPos = 0;

function renderNewsCarousel(items) {
    _homeNewsData = items;
    const el = document.getElementById('news-carousel');
    if (!el) return;
    if (!items.length) { el.innerHTML = '<p style="color:var(--gray-400);text-align:center;padding:40px;width:100%">Aucune actualite</p>'; return; }
    const bgs = ['cip-1','cip-2','cip-3','cip-4'];
    const icons = ['\ud83d\udcf0','\ud83d\udce2','\ud83c\udfc6','\ud83d\udcca'];
    el.innerHTML = items.map((n, i) => `
        <div class="news-carousel-card" onclick="showNewsDetail(_homeNewsData[${i}])">
            <div class="ncc-img">
                ${n.image_url ? `<img src="${esc(n.image_url)}" class="ncc-img-placeholder" style="object-fit:cover" loading="lazy">` : `<div class="ncc-img-placeholder ${bgs[i % 4]}">${icons[i % 4]}</div>`}
                <div class="ncc-date">${formatDate(n.published_at)}</div>
            </div>
            <div class="ncc-body">
                <div class="ncc-title">${esc(n.title)}</div>
                <div class="ncc-excerpt">${esc(n.excerpt || (n.content || '').substring(0, 150))}</div>
                <span class="ncc-link">EN SAVOIR +</span>
            </div>
        </div>`).join('');
    newsCarouselPos = 0;
    updateCarouselTransform();
}

function slideNewsCarousel(dir) {
    const wrap = document.querySelector('.news-carousel-wrap');
    const carousel = document.getElementById('news-carousel');
    if (!wrap || !carousel) return;
    const cards = carousel.querySelectorAll('.news-carousel-card');
    if (!cards.length) return;
    const cardWidth = cards[0].offsetWidth + 20; // card width + gap
    const visibleWidth = wrap.offsetWidth - 96; // minus arrows
    const maxScroll = Math.max(0, carousel.scrollWidth - visibleWidth);
    newsCarouselPos = Math.max(0, Math.min(newsCarouselPos + dir * cardWidth, maxScroll));
    updateCarouselTransform();
}

function updateCarouselTransform() {
    const carousel = document.getElementById('news-carousel');
    if (carousel) carousel.style.transform = `translateX(-${newsCarouselPos}px)`;
}

// === NEWS DETAIL MODAL ===
function showNewsDetail(news) {
    const overlay = document.createElement('div');
    overlay.className = 'event-detail-overlay';
    overlay.onclick = function(e) { if (e.target === this) this.remove(); };
    const bgs = ['cip-1','cip-2','cip-3','cip-4'];
    overlay.innerHTML = `
        <div class="event-detail-modal" style="max-width:700px">
            <div class="edm-header ${news.image_url ? '' : bgs[Math.floor(Math.random()*4)]}">
                ${news.image_url ? `<img src="${esc(news.image_url)}" class="edm-header-bg">` : '<div class="edm-header-placeholder">\ud83d\udcf0</div>'}
                <button class="edm-close" onclick="this.closest('.event-detail-overlay').remove()">&times;</button>
            </div>
            <div style="padding:32px">
                <span class="card-date">${formatDate(news.published_at)}</span>
                ${news.category ? `<span class="card-tag">${esc(news.category)}</span>` : ''}
                <h1 style="font-size:26px;font-weight:900;color:var(--primary);margin:16px 0">${esc(news.title)}</h1>
                <div style="font-size:15px;color:var(--gray-700);line-height:1.8;white-space:pre-line">${esc(news.content || news.excerpt || '')}</div>
            </div>
        </div>`;
    document.body.appendChild(overlay);
}

// === EVENT DETAIL MODAL ===
let userRegisteredEventIds = new Set();

async function showEventDetail(eventId) {
    let event;
    try {
        const res = await fetch(`${API}/api/events?id=${eventId}`);
        event = await res.json();
        if (Array.isArray(event)) event = event[0];
    } catch(e) {
        event = allEvents.find(ev => ev.id === eventId);
        if (!event) event = _agendaEvents.find(ev => ev.id === eventId);
    }
    if (!event) return;

    const bgs = ['cip-1','cip-2','cip-3','cip-4'];
    const typeClass = 'ec-type-' + ((event.event_type||'default').toLowerCase().replace(/[^a-z]/g,''));
    const bgIdx = event.id % 4;
    const loggedIn = isLoggedIn();

    const overlay = document.createElement('div');
    overlay.className = 'event-detail-overlay';
    overlay.onclick = function(e) { if (e.target === this) this.remove(); };

    const formatFullDate = (d) => {
        if (!d) return '';
        const dt = new Date(d);
        const days = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
        const months = ['janvier','fevrier','mars','avril','mai','juin','juillet','aout','septembre','octobre','novembre','decembre'];
        return `${days[dt.getDay()]} ${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
    };
    const formatTime = (d) => {
        if (!d) return '';
        const dt = new Date(d);
        return `${dt.getHours()}h${String(dt.getMinutes()).padStart(2,'0')}`;
    };

    const evTitle = esc(event.title);
    const evDesc = esc(event.description || '');
    const evLoc = esc(event.location || '');
    const startDate = event.start_date || '';
    const endDate = event.end_date || '';

    overlay.innerHTML = `
        <div class="event-detail-modal">
            <div class="edm-header ${event.image_url ? '' : bgs[bgIdx]}">
                ${event.image_url ? `<img src="${esc(event.image_url)}" class="edm-header-bg">` : `<div class="edm-header-placeholder">${event.event_type === 'conference' ? '\ud83c\udfeb' : '\ud83d\udcc5'}</div>`}
                <button class="edm-close" onclick="this.closest('.event-detail-overlay').remove()">&times;</button>
            </div>
            <div class="edm-content">
                <div class="edm-main">
                    <span class="ec-type-badge ${typeClass}" style="display:inline-block;margin-bottom:12px">${esc(event.event_type || 'Evenement')}</span>
                    <h1>${evTitle}</h1>
                    ${event.location ? `<p class="edm-organizer">Organise par l'AFFI${event.location ? ' \u2014 ' + esc(event.location) : ''}</p>` : ''}
                    <div class="edm-description">${esc(event.description || 'Pas de description disponible.')}</div>
                    ${event.tags ? `<div style="margin-top:16px;display:flex;gap:6px;flex-wrap:wrap">${event.tags.split(',').map(t => '<span class="card-tag">'+esc(t.trim())+'</span>').join('')}</div>` : ''}
                </div>
                <div class="edm-sidebar">
                    <div class="edm-sidebar-section">
                        <div class="edm-icon">\ud83d\udcc5</div>
                        <div class="edm-label">Date</div>
                        <div class="edm-value">${formatFullDate(event.start_date)}<br>${formatTime(event.start_date)}${event.end_date ? ' - ' + formatTime(event.end_date) : ''}</div>
                    </div>

                    ${event.location ? `<div class="edm-sidebar-section">
                        <div class="edm-icon">\ud83d\udccd</div>
                        <div class="edm-label">Lieu</div>
                        <div class="edm-value">${esc(event.location)}${event.address ? '<br>' + esc(event.address) : ''}</div>
                    </div>` : `<div class="edm-sidebar-section">
                        <div class="edm-icon">\ud83d\udcbb</div>
                        <div class="edm-label">Format</div>
                        <div class="edm-value">En ligne</div>
                    </div>`}

                    <div class="edm-sidebar-section">
                        <div class="edm-icon">\ud83d\udc65</div>
                        <div class="edm-label">Inscriptions</div>
                        <div class="edm-value">${event.reg_count||0} inscrit${(event.reg_count||0)>1?'s':''} ${event.max_attendees ? '/ '+event.max_attendees+' places' : ''}</div>
                        ${event.max_attendees ? `<div style="margin-top:6px;height:6px;background:var(--gray-200);border-radius:3px;overflow:hidden"><div style="height:100%;background:${(event.reg_count||0)>=event.max_attendees?'var(--accent)':'var(--green)'};width:${Math.min(100,Math.round(((event.reg_count||0)/event.max_attendees)*100))}%;border-radius:3px"></div></div>` : ''}
                    </div>
                    ${loggedIn && event.registrants && event.registrants.length ? `<div class="edm-sidebar-section" style="text-align:left">
                        <div class="edm-label" style="text-align:center">Participants</div>
                        <div style="max-height:120px;overflow-y:auto">
                            ${event.registrants.map(r => `<div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:12px;color:var(--gray-700)">
                                <div style="width:24px;height:24px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0">${esc((r.first_name||'?')[0]+(r.last_name||'?')[0])}</div>
                                <span>${esc(r.first_name)} ${esc(r.last_name||'')}</span>
                                ${r.company ? `<span style="font-size:10px;color:var(--gray-400)">${esc(r.company)}</span>` : ''}
                            </div>`).join('')}
                        </div>
                    </div>` : ''}

                    <div class="edm-price">${event.price > 0 ? event.price + ' &euro;' : 'Gratuit'}</div>

                    ${loggedIn ? (userRegisteredEventIds.has(event.id)
                        ? `<button class="edm-btn-register" style="background:var(--green)" onclick="unregisterFromEvent(${event.id});this.closest('.event-detail-overlay').remove()">&#10003; INSCRIT</button>
                           <button class="edm-btn-decline" onclick="this.closest('.event-detail-overlay').remove()">FERMER</button>`
                        : `<button class="edm-btn-register" onclick="registerForEvent(${event.id})">S'INSCRIRE</button>
                           <button class="edm-btn-decline" onclick="this.closest('.event-detail-overlay').remove()">FERMER</button>`)
                    : `
                        <button class="edm-btn-register" onclick="showGuestRegistrationForm(${event.id},'${evTitle.replace(/'/g,"\\'")}')">S'INSCRIRE (invite)</button>
                        <div style="text-align:center;padding:12px;background:rgba(200,16,46,.08);border-radius:8px;font-size:13px;color:var(--accent);font-weight:600">
                            \ud83d\udd12 <a href="#" onclick="event.preventDefault();this.closest('.event-detail-overlay').remove();showLoginPopup()" style="color:var(--accent)">Connectez-vous</a> pour vous inscrire en tant que membre
                        </div>
                    `}

                    <div style="text-align:center;font-size:13px;font-weight:600;color:var(--gray-500)">AJOUTER A MON AGENDA</div>
                    <div class="edm-calendar-export">
                        <a href="#" onclick="event.preventDefault();downloadICS('${evTitle.replace(/'/g,"\\'")}','${evDesc.replace(/'/g,"\\'")}','${evLoc.replace(/'/g,"\\'")}','${startDate}','${endDate}')" title="iCal / Outlook">\ud83d\udcc5</a>
                        <a href="https://calendar.google.com/calendar/r/eventedit?text=${encodeURIComponent(event.title)}&dates=${(event.start_date||'').replace(/[-:]/g,'').replace(' ','T')}/${(event.end_date||event.start_date||'').replace(/[-:]/g,'').replace(' ','T')}&location=${encodeURIComponent(event.location||'')}" target="_blank" rel="noopener" title="Google Calendar">G</a>
                    </div>
                    <div style="text-align:center;font-size:13px;font-weight:600;color:var(--gray-500);margin-top:8px">PARTAGER</div>
                    <div style="display:flex;gap:8px;justify-content:center">
                        <a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.origin+'/#agenda')}&title=${encodeURIComponent(event.title)}" target="_blank" rel="noopener" class="share-btn share-li" title="LinkedIn">in</a>
                        <a href="mailto:?subject=${encodeURIComponent(event.title)}&body=${encodeURIComponent(event.title + '\\n' + formatFullDate(event.start_date) + '\\n' + (event.location||'En ligne') + '\\n\\n' + (event.description||'').substring(0,300))}" class="share-btn share-em" title="Email">&#9993;</a>
                        <button class="share-btn share-cp" onclick="navigator.clipboard.writeText(window.location.origin+'/#agenda');showToast('Lien copie !','success')" title="Copier le lien">&#128279;</button>
                    </div>
                </div>
            </div>
        </div>`;
    document.body.appendChild(overlay);
}

// === EVENT REGISTRATION ===
async function registerForEvent(eventId) {
    if (!isLoggedIn() || !authToken) { showLoginPopup(); return; }
    try {
        const res = await fetch(`${API}/api/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken },
            body: JSON.stringify({ action: 'register', event_id: eventId })
        });
        const data = await res.json();
        if (data.ok) {
            showToast('Inscription confirmee !', 'success');
            userRegisteredEventIds.add(eventId);
            document.querySelector('.event-detail-overlay')?.remove();
            const page = location.hash.slice(1) || 'accueil';
            if (page === 'agenda') loadAgenda();
        } else {
            showToast(data.error || 'Erreur lors de l\'inscription', 'error');
        }
    } catch(e) {
        showToast('Erreur de connexion', 'error');
    }
}

async function unregisterFromEvent(eventId) {
    if (!isLoggedIn() || !authToken) return;
    try {
        const res = await fetch(`${API}/api/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken },
            body: JSON.stringify({ action: 'unregister', event_id: eventId })
        });
        const data = await res.json();
        if (data.ok) {
            userRegisteredEventIds.delete(eventId);
            showToast('Desinscription confirmee', 'success');
            const page = location.hash.slice(1) || 'accueil';
            if (page === 'agenda') loadAgenda();
        } else {
            showToast(data.error || 'Erreur', 'error');
        }
    } catch(e) { showToast('Erreur de connexion', 'error'); }
}

function showGuestRegistrationForm(eventId, eventTitle) {
    const overlay = document.createElement('div');
    overlay.className = 'event-detail-overlay';
    overlay.onclick = function(e) { if (e.target === this) this.remove(); };
    overlay.innerHTML = `
        <div class="event-detail-modal" style="max-width:500px">
            <div style="padding:32px">
                <h2 style="font-size:22px;font-weight:900;color:var(--primary);margin-bottom:4px">Inscription a l'evenement</h2>
                <p style="color:var(--gray-500);font-size:14px;margin-bottom:24px">${esc(eventTitle)}</p>
                <form onsubmit="submitGuestRegistration(event,${eventId})">
                    <div class="form-group"><label>Nom complet *</label><input id="gr-name" required></div>
                    <div class="form-group"><label>Email *</label><input type="email" id="gr-email" required></div>
                    <div class="form-group"><label>Entreprise</label><input id="gr-company"></div>
                    <div class="form-group"><label>Telephone</label><input id="gr-phone"></div>
                    <button type="submit" class="btn btn-accent" style="width:100%;font-size:15px;padding:14px">S'inscrire</button>
                </form>
                <p style="text-align:center;margin-top:16px;font-size:13px;color:var(--gray-400)">Deja membre ? <a href="#" onclick="event.preventDefault();this.closest('.event-detail-overlay').remove();showLoginPopup()" style="color:var(--accent);font-weight:700">Connectez-vous</a></p>
                <button onclick="this.closest('.event-detail-overlay').remove()" style="position:absolute;top:12px;right:12px;background:none;border:none;font-size:24px;color:var(--gray-400);cursor:pointer">&times;</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
}

async function submitGuestRegistration(evt, eventId) {
    evt.preventDefault();
    try {
        const res = await fetch(`${API}/api/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'guest_register',
                event_id: eventId,
                name: document.getElementById('gr-name').value,
                email: document.getElementById('gr-email').value,
                company: document.getElementById('gr-company').value,
                phone: document.getElementById('gr-phone').value,
            })
        });
        const data = await res.json();
        if (data.ok) {
            showToast('Inscription confirmee ! Vous recevrez un email de confirmation.', 'success');
            document.querySelector('.event-detail-overlay')?.remove();
        } else {
            showToast(data.error || 'Erreur', 'error');
        }
    } catch(e) { showToast('Erreur de connexion', 'error'); }
}

// === NOS ANCIENS BOUGENT ===
async function loadAnciensBougent() {
    try {
        const res = await fetch('/data/anciens_bougent.json');
        const anciens = await res.json();
        const el = document.getElementById('anciens-grid');
        if (!el) return;
        el.innerHTML = anciens.map(a => `
            <div class="ancien-card">
                <div class="ancien-avatar">${esc(a.photo_placeholder)}</div>
                <div class="ancien-name">${esc(a.title)}</div>
                <div class="ancien-desc">${esc(a.description)}</div>
                <a class="ancien-btn" href="#annuaire" onclick="navigate('annuaire')">EN SAVOIR +</a>
            </div>
        `).join('');
    } catch(e) { console.warn('Anciens:', e); }
}

// === AD BANNER ===
async function loadAdBanner() {
    // Placeholder for ad banner loading
}

// === AGENDA (upcoming events) ===
let _agendaEvents = [];
let _calYear, _calMonth;
let _agendaSearchQuery = '';
let _agendaTypeFilter = '';

function filterAgendaSearch(query) {
    _agendaSearchQuery = (query || '').toLowerCase();
    _applyAgendaFilters();
}

function filterAgendaType(type) {
    _agendaTypeFilter = type || '';
    _applyAgendaFilters();
}

function _applyAgendaFilters() {
    let filtered = _agendaEvents;
    if (_agendaSearchQuery) {
        filtered = filtered.filter(e =>
            (e.title || '').toLowerCase().includes(_agendaSearchQuery) ||
            (e.description || '').toLowerCase().includes(_agendaSearchQuery)
        );
    }
    if (_agendaTypeFilter) {
        filtered = filtered.filter(e => (e.event_type || '').toLowerCase() === _agendaTypeFilter);
    }
    renderAgendaEvents(filtered);
}

async function loadAgenda() {
    try {
        // Charger événements à venir
        const res = await fetch(`${API}/api/events?upcoming=1&limit=50`);
        _agendaEvents = await res.json();
        const now = new Date();
        _calYear = now.getFullYear();
        _calMonth = now.getMonth();
        renderCalendar();
        renderAgendaEvents(_agendaEvents);

        // Charger événements passés (3 derniers)
        const resPast = await fetch(`${API}/api/events?limit=10`);
        const allEvents = await resPast.json();
        const pastEvents = allEvents.filter(e => new Date(e.start_date) < now).slice(0, 3);
        renderPastAgenda(pastEvents);
    } catch (e) { console.warn('Agenda:', e); }
}

function renderPastAgenda(events) {
    const container = document.getElementById('past-events-list');
    if (!container) return;
    if (!events.length) { container.innerHTML = ''; return; }
    const months = ['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc'];
    container.innerHTML = events.map(e => {
        const d = new Date(e.start_date);
        return `<div class="evt-card evt-card-past" onclick="showEventDetail(${e.id})" style="cursor:pointer;position:relative">
            <div class="evt-date-col" style="background:linear-gradient(135deg,#6c757d,#adb5bd)">
                <div class="evt-date-day">${d.getDate()}</div>
                <div class="evt-date-month">${months[d.getMonth()]||''}</div>
                <div class="evt-date-year">${d.getFullYear()}</div>
            </div>
            <div class="evt-body">
                <div class="evt-title">${esc(e.title)}</div>
                <div class="evt-desc">${esc(e.description || '')}</div>
                <div class="evt-meta">
                    ${e.location ? `<span>&#128205; ${esc(e.location)}</span>` : ''}
                    <span style="color:var(--gray-400);font-style:italic">Événement passé</span>
                </div>
            </div>
        </div>`;
    }).join('');
}

let _calCollapsed = false;

function toggleCalendar() {
    const el = document.getElementById('agenda-calendar');
    if (!el) return;
    _calCollapsed = !_calCollapsed;
    el.classList.toggle('cal-collapsed', _calCollapsed);
}

function renderCalendar() {
    const el = document.getElementById('agenda-calendar');
    if (!el) return;
    const months = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const dows = ['LUN','MAR','MER','JEU','VEN','SAM','DIM'];
    const first = new Date(_calYear, _calMonth, 1);
    const lastDay = new Date(_calYear, _calMonth + 1, 0).getDate();
    let startDow = first.getDay() - 1; if (startDow < 0) startDow = 6;
    const prevLast = new Date(_calYear, _calMonth, 0).getDate();
    const today = new Date();

    // Which days have events this month
    const eventDays = new Set();
    _agendaEvents.forEach(e => {
        const d = new Date(e.start_date);
        if (d.getFullYear() === _calYear && d.getMonth() === _calMonth) eventDays.add(d.getDate());
    });

    let days = '';
    // Previous month fill
    for (let i = startDow - 1; i >= 0; i--) {
        days += `<div class="cal-day cal-other">${prevLast - i}</div>`;
    }
    // Current month
    for (let d = 1; d <= lastDay; d++) {
        const isToday = d === today.getDate() && _calMonth === today.getMonth() && _calYear === today.getFullYear();
        const hasEvent = eventDays.has(d);
        days += `<div class="cal-day${isToday ? ' cal-today' : ''}${hasEvent ? ' cal-has-event' : ''}" onclick="filterAgendaByDay(${d})">${d}</div>`;
    }
    // Next month fill
    const totalCells = startDow + lastDay;
    const remaining = (7 - totalCells % 7) % 7;
    for (let i = 1; i <= remaining; i++) {
        days += `<div class="cal-day cal-other">${i}</div>`;
    }

    el.innerHTML = `
        <div class="cal-header" onclick="toggleCalendar()" style="cursor:pointer" title="Cliquer pour afficher/masquer le calendrier">
            <button class="cal-nav" onclick="event.stopPropagation();changeCalMonth(-1)">&#8249;</button>
            <h3>${months[_calMonth]} ${_calYear} <span class="cal-toggle-icon">${_calCollapsed ? '&#9660;' : '&#9650;'}</span></h3>
            <button class="cal-nav" onclick="event.stopPropagation();changeCalMonth(1)">&#8250;</button>
        </div>
        <div class="cal-body">
            <div class="cal-grid">
                ${dows.map(d => `<div class="cal-dow">${d}</div>`).join('')}
                ${days}
            </div>
        </div>
    `;

    // Auto-collapse calendar when events scroll above it
    initCalAutoCollapse();
}

let _calObserver = null;
function initCalAutoCollapse() {
    if (_calObserver) _calObserver.disconnect();
    const calendar = document.getElementById('agenda-calendar');
    const eventsList = document.getElementById('agenda-list');
    if (!calendar || !eventsList) return;

    // Use IntersectionObserver to detect when events list top goes above calendar
    const sentinel = eventsList.querySelector('.evt-card');
    if (!sentinel) return;

    _calObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            // When first event card goes out of view above, collapse calendar
            if (!entry.isIntersecting && entry.boundingClientRect.top < 200) {
                if (!_calCollapsed) {
                    _calCollapsed = true;
                    calendar.classList.add('cal-collapsed');
                    const icon = calendar.querySelector('.cal-toggle-icon');
                    if (icon) icon.innerHTML = '&#9660;';
                }
            }
        });
    }, { threshold: 0, rootMargin: '-80px 0px 0px 0px' });

    _calObserver.observe(sentinel);
}

function changeCalMonth(delta) {
    _calMonth += delta;
    if (_calMonth > 11) { _calMonth = 0; _calYear++; }
    if (_calMonth < 0) { _calMonth = 11; _calYear--; }
    renderCalendar();
}

function filterAgendaByDay(day) {
    // Highlight selected day
    document.querySelectorAll('.cal-day').forEach(d => d.classList.remove('cal-selected'));
    event.target.classList.add('cal-selected');
    // Filter events to this day
    const filtered = _agendaEvents.filter(e => {
        const d = new Date(e.start_date);
        return d.getDate() === day && d.getMonth() === _calMonth && d.getFullYear() === _calYear;
    });
    if (filtered.length) {
        renderAgendaEvents(filtered);
    } else {
        renderAgendaEvents(_agendaEvents);
        if (typeof showToast === 'function') showToast('Aucun événement ce jour — affichage de tous les événements', 'info');
    }
}

function renderAgendaEvents(events) {
    const el = document.getElementById('agenda-list');
    if (!el) return;
    if (!events.length) { el.innerHTML = '<p style="color:var(--gray-400);text-align:center;padding:40px">Aucun événement à venir</p>'; return; }
    const months = ['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc'];
    const gradients = [
        'linear-gradient(135deg,#1a3c6e,#2d5a9e)',
        'linear-gradient(135deg,#0a8f8f,#0abfbf)',
        'linear-gradient(135deg,#e67e22,#f0a050)',
        'linear-gradient(135deg,#6c3fa0,#9b6fd0)',
        'linear-gradient(135deg,#c8102e,#e8354f)',
    ];
    el.innerHTML = events.map((e, i) => {
        const d = new Date(e.start_date);
        const day = d.getDate();
        const month = months[d.getMonth()] || '';
        const year = d.getFullYear();
        return `<div class="evt-card" style="cursor:pointer" onclick="showEventDetail(${e.id})">
            <div class="evt-date-col" style="background:${gradients[i % gradients.length]}">
                <div class="evt-date-day">${day}</div>
                <div class="evt-date-month">${month}</div>
                <div class="evt-date-year">${year}</div>
            </div>
            <div class="evt-body">
                <div class="evt-title">${esc(e.title)}</div>
                <div class="evt-desc">${esc(e.description || '')}</div>
                <div class="evt-meta">
                    ${e.location ? `<span>&#128205; ${esc(e.location)}</span>` : ''}
                    ${e.end_date && e.end_date !== e.start_date ? `<span>&#8594; ${formatDate(e.end_date)}</span>` : ''}
                </div>
                <div class="evt-actions">
                    <button onclick="downloadICS('${esc(e.title).replace(/'/g,"\\'")}','${esc(e.description||'').replace(/'/g,"\\'")}','${esc(e.location||'').replace(/'/g,"\\'")}','${e.start_date}','${e.end_date||''}')" class="btn btn-primary" style="font-size:12px;padding:6px 14px">&#128197; Calendrier</button>
                    ${typeof renderShareButtons==='function' ? renderShareButtons(e.title, e.id) : ''}
                </div>
            </div>
        </div>`;
    }).join('');
}

// === EVENTS (all / archive) ===
let allEvents = [];
async function loadEvents() {
    try {
        const res = await fetch(`${API}/api/events?limit=50`);
        allEvents = await res.json();
        renderFilteredEvents('');
    } catch (e) { console.warn('Events:', e); }
}

function filterEvents(btn, year) {
    document.querySelectorAll('#page-evenements .course-filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderFilteredEvents(year);
}

function renderFilteredEvents(year) {
    const el = document.getElementById('events-list');
    if (!el) return;
    const filtered = year ? allEvents.filter(e => (e.start_date||'').startsWith(year)) : allEvents;
    if (!filtered.length) { el.innerHTML = '<p style="color:var(--gray-400);text-align:center;padding:40px">Aucun evenement</p>'; return; }
    el.innerHTML = renderEventCards(filtered);
}

function renderEventCards(events) {
    const bgs = ['cip-1','cip-2','cip-3','cip-4'];
    return events.map((e, i) => `
        <div class="card" style="cursor:pointer" onclick="showEventDetail(${e.id})">
            <div class="card-img-placeholder ${bgs[i % 4]}">\ud83d\udcc5</div>
            <div class="card-body">
                <span class="card-date">${formatDate(e.start_date)}${e.end_date && e.end_date !== e.start_date ? ' \u2014 ' + formatDate(e.end_date) : ''}</span>
                <div class="flex-gap" style="margin-bottom:8px">
                    ${e.event_type ? `<span class="card-tag card-tag-primary">${esc(e.event_type)}</span>` : ''}
                    ${e.location ? `<span class="card-tag">\ud83d\udccd ${esc(e.location)}</span>` : ''}
                    ${e.is_members_only ? '<span class="card-tag" style="background:var(--accent);color:#fff">Membres</span>' : ''}
                </div>
                <div class="card-title">${esc(e.title)}</div>
                <div class="card-text">${esc(e.description || '')}</div>
                <div style="display:flex;gap:8px;align-items:center;margin-top:12px;flex-wrap:wrap">
                    <button onclick="event.stopPropagation();downloadICS('${esc(e.title)}','${esc(e.description||'')}','${esc(e.location||'')}','${e.start_date}','${e.end_date||''}')" class="btn btn-primary" style="font-size:11px;padding:6px 12px">&#128197; Ajouter au calendrier</button>
                    ${typeof renderShareButtons==='function' ? renderShareButtons(e.title, e.id) : ''}
                </div>
            </div>
        </div>`).join('');
}

// === PUBLICATIONS ===
let _pubsData = [];
let _pubCatFilter = '';

async function loadPublications() {
    try {
        const res = await fetch(`${API}/api/publications?limit=50`);
        const pubs = await res.json();
        const el = document.getElementById('publications-list');
        if (!el) return;
        if (!pubs.length) { el.innerHTML = '<p style="color:var(--gray-400);text-align:center;padding:40px">Aucune publication</p>'; return; }
        _pubsData = pubs;
        _pubCatFilter = '';
        // Reset filter buttons
        document.querySelectorAll('#page-publications .course-filter').forEach(b => b.classList.remove('active'));
        const allBtn = document.querySelector('#page-publications .course-filter');
        if (allBtn) allBtn.classList.add('active');
        renderFilteredPubs();
    } catch (e) { console.warn('Pubs:', e); }
}

function filterPubCat(btn, cat) {
    document.querySelectorAll('#page-publications .course-filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    _pubCatFilter = cat;
    renderFilteredPubs();
}

function renderFilteredPubs() {
    const el = document.getElementById('publications-list');
    if (!el || !_pubsData.length) return;
    const filtered = _pubCatFilter ? _pubsData.filter(p => (p.category || '') === _pubCatFilter) : _pubsData;
    if (!filtered.length) { el.innerHTML = '<p class="empty-msg">Aucune publication dans cette categorie</p>'; return; }
    el.innerHTML = filtered.map((p, i) => {
        const realIdx = _pubsData.indexOf(p);
        return `<div class="card" style="cursor:pointer" onclick="${typeof showNewsDetail === 'function' ? 'showNewsDetail(_pubsData[' + realIdx + '])' : ''}">
            <div class="card-body">
                <span class="card-date">${formatDate(p.published_at)}</span>
                ${p.category ? `<span class="card-tag">${esc(p.category)}</span>` : ''}
                <div class="card-title">${esc(p.title)}</div>
                <div class="card-text">${esc(p.excerpt || (p.content || '').substring(0, 220))}</div>
                <span class="card-link">Lire la suite</span>
            </div>
        </div>`;
    }).join('');
}

// === PARTNER ROTATING BANNER ===
let _partnerBannerData = [];
let _partnerBannerIdx = 0;
let _partnerBannerTimer = null;

async function loadPartnerBanner() {
    try {
        const cached = sessionStorage.getItem('affi_partenaires');
        const partenaires = cached ? JSON.parse(cached) : await (async () => { const r = await fetch('/data/partenaires.json'); const d = await r.json(); try { sessionStorage.setItem('affi_partenaires', JSON.stringify(d)); } catch(e) {} return d; })();
        if (!partenaires.length) return;
        _partnerBannerData = partenaires;
        _partnerBannerIdx = Math.floor(Math.random() * partenaires.length);
        showNextPartner();
        _partnerBannerTimer = setInterval(showNextPartner, 8000);
    } catch (e) { console.warn('Partner banner:', e); }
}

function showNextPartner() {
    const banner = document.getElementById('partner-banner');
    const content = document.getElementById('partner-banner-content');
    if (!banner || !content || !_partnerBannerData.length) return;
    const p = _partnerBannerData[_partnerBannerIdx % _partnerBannerData.length];
    _partnerBannerIdx++;
    const logoKey = typeof PARTENAIRES_LOGOS !== 'undefined' ? Object.keys(PARTENAIRES_LOGOS).find(k => p.name.includes(k)) : null;
    const logo = logoKey ? PARTENAIRES_LOGOS[logoKey] : '';
    content.innerHTML = `${logo ? `<img src="${logo}" alt="${esc(p.name)}" style="height:28px;width:auto;object-fit:contain">` : ''}<a href="${esc(p.website || '#')}" target="_blank" rel="noopener">${esc(p.name)}</a><span style="color:var(--gray-400)">${esc(p.sector || '')}</span>${p.city ? `<span style="color:var(--gray-400);font-size:12px">&#128205; ${esc(p.city)}</span>` : ''}`;
    banner.style.display = 'block';
}

// === LE RESEAU BOUGE ===
async function loadReseauBouge() {
    const el = document.getElementById('reseau-bouge-list');
    if (!el) return;
    try {
        const res = await fetch(`${API}/api/members?action=public_annuaire&limit=8`);
        const members = await res.json();
        if (!members.length) { el.innerHTML = '<p class="empty-msg">Aucune mobilite recente</p>'; return; }
        // Show recently active members with company info as career movements
        const recent = members.filter(m => m.company).slice(0, 6);
        if (!recent.length) { el.innerHTML = '<p class="empty-msg">Aucune mobilite recente</p>'; return; }
        el.innerHTML = recent.map(m => {
            const initials = ((m.first_name || '?')[0] + (m.last_name || '?')[0]).toUpperCase();
            return `<div class="card" style="text-align:center;padding:24px">
                <div style="width:56px;height:56px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;margin:0 auto 12px">${esc(initials)}</div>
                <div style="font-weight:700;color:var(--primary);font-size:15px">${esc((m.first_name || '')[0] + '.')} ${esc(m.last_name || '')}</div>
                ${m.job_title ? `<div style="font-size:13px;color:var(--gray-600);margin-top:4px">${esc(m.job_title)}</div>` : ''}
                ${m.company ? `<div style="font-size:13px;color:var(--accent);font-weight:600;margin-top:4px">${esc(m.company)}</div>` : ''}
                ${m.specialty ? `<div style="font-size:12px;color:var(--gray-400);margin-top:4px">${esc(m.specialty)}</div>` : ''}
            </div>`;
        }).join('');
    } catch (e) {
        el.innerHTML = '<p class="empty-msg">Section reservee aux membres</p>';
    }
}

// === ANNUAIRE PUBLIC ===
async function loadPublicAnnuaire(search, specialty, region, sector) {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (specialty) params.set('specialty', specialty);
    if (region) params.set('region', region);
    if (sector) params.set('sector', sector);
    try {
        const res = await fetch(`${API}/api/members?action=public_annuaire&${params}`);
        const members = await res.json();
        renderPublicAnnuaire(members);
    } catch (e) { console.warn('Annuaire:', e); }
}

function renderPublicAnnuaire(members) {
    const el = document.getElementById('public-annuaire-grid');
    if (!el) return;
    if (!members.length) { el.innerHTML = '<p style="text-align:center;color:var(--gray-400);grid-column:1/-1;padding:40px">Aucun expert trouve</p>'; return; }
    el.innerHTML = members.map(m => {
        const initials = (m.first_name || '?')[0] + (m.last_name || '?')[0];
        return `<div class="expert-card expert-card-anon">
            <div class="ec-banner">
                ${m.is_mentor ? '<div class="ec-mentor-flag">&#127891; Mentor</div>' : ''}
                ${m.is_board ? '<div class="ec-board-flag">Bureau AFFI</div>' : ''}
            </div>
            <div class="ec-avatar-wrap">
                <div class="ec-initials">${esc(initials.toUpperCase())}</div>
            </div>
            <div class="ec-body">
                <div class="ec-name">${esc(initials.toUpperCase())}</div>
                <div class="ec-job">${esc(m.job_title || '')}</div>
                <div class="ec-company">${esc(m.company || '')}</div>
                ${m.region ? `<div class="ec-location">&#128205; ${esc(m.region)}</div>` : ''}
            </div>
            <div class="ec-expertise">
                ${m.specialty ? `<span class="ec-tag ec-tag-specialty">${esc(m.specialty)}</span>` : ''}
                ${m.sector ? `<span class="ec-tag">${esc(m.sector)}</span>` : ''}
            </div>
            <div class="ec-anon-lock">
                <span class="locked-badge" onclick="event.stopPropagation();showLoginPopup()">&#128274; Connectez-vous pour voir le profil complet</span>
            </div>
            <div class="ec-footer">
                <span class="ec-rgpd">&#128994; Expert verifie</span>
            </div>
        </div>`;
    }).join('');
}

// Version complete de l'annuaire (connecte)
async function loadPublicAnnuaireFull(search, specialty, region, sector) {
    const params = new URLSearchParams({action: 'public_annuaire'});
    if (search) params.set('search', search);
    if (specialty) params.set('specialty', specialty);
    if (region) params.set('region', region);
    if (sector) params.set('sector', sector);
    try {
        const res = await fetch(`${API}/api/members?${params}`, {
            headers: {'Authorization': 'Bearer ' + (typeof authToken !== 'undefined' ? authToken : '')}
        });
        const members = await res.json();
        const el = document.getElementById('public-annuaire-grid');
        if (!el) return;
        if (!members.length) { el.innerHTML = '<p style="text-align:center;color:var(--gray-400);grid-column:1/-1;padding:40px">Aucun expert trouve</p>'; return; }
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
                <div class="ec-avatar-wrap">${avatarHtml}</div>
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
                    ${m.bio ? `<div class="ec-bio">${esc((m.bio || '').substring(0, 200))}${(m.bio||'').length > 200 ? '...' : ''}</div>` : ''}
                    ${m.linkedin_url ? `<div class="ec-actions"><a href="${esc(m.linkedin_url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" class="ec-btn ec-btn-li">in LinkedIn</a></div>` : ''}
                </div>
                <div class="ec-footer">
                    <span class="ec-rgpd">&#128994; Publie avec consentement</span>
                    <span class="ec-expand-hint">&#9660;</span>
                </div>
            </div>`;
        }).join('');
    } catch (e) { console.warn('Annuaire:', e); }
}

let _pubSearch;
function onPubSearch(v) {
    clearTimeout(_pubSearch);
    _pubSearch = setTimeout(() => onPubFilter(), 300);
}
function onPubFilter() {
    const s = document.getElementById('pub-search')?.value || '';
    const sp = document.getElementById('pub-specialty')?.value || '';
    const r = document.getElementById('pub-region')?.value || '';
    const sc = document.getElementById('pub-sector')?.value || '';
    isLoggedIn() ? loadPublicAnnuaireFull(s, sp, r, sc) : loadPublicAnnuaire(s, sp, r, sc);
}

// === WELCOME DASHBOARD ===
async function showWelcomeDashboard() {
    const slider = document.querySelector('.hero-slider');
    if (!slider || !currentUser) return;

    // Cacher le slider
    slider.style.display = 'none';

    // Creer ou mettre a jour le dashboard
    let dash = document.getElementById('welcome-dashboard');
    if (!dash) {
        dash = document.createElement('div');
        dash.id = 'welcome-dashboard';
        slider.parentElement.insertBefore(dash, slider);
    }

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon apres-midi' : 'Bonsoir';
    const initials = (currentUser.first_name||'?')[0] + (currentUser.last_name||'?')[0];

    // Charger les stats en parallele
    let stats = { events: 0, messages: 0, members: 0, mentors: 0 };
    try {
        const [evRes, memRes] = await Promise.all([
            fetch(`${API}/api/events?upcoming=1&limit=20`).then(r => r.json()).catch(() => []),
            fetch(`${API}/api/members?action=directory`, {headers:{'Authorization':'Bearer '+authToken}}).then(r => r.json()).catch(() => [])
        ]);
        stats.events = evRes.length || 0;
        stats.members = memRes.length || 0;
        stats.mentors = (memRes.filter && memRes.filter(m => m.is_mentor)) ? memRes.filter(m => m.is_mentor).length : 0;
    } catch(e) {}

    dash.innerHTML = `
        <div class="wd-container">
            <canvas id="wd-particles" class="wd-particles"></canvas>
            <div class="wd-content">
                <div class="wd-avatar-ring">
                    <div class="wd-avatar">${esc(initials.toUpperCase())}</div>
                </div>
                <h1 class="wd-greeting">${greeting},</h1>
                <h2 class="wd-name">${esc(currentUser.first_name)} ${esc(currentUser.last_name)}</h2>
                <p class="wd-subtitle">${esc(currentUser.job_title || '')}${currentUser.company ? ' — ' + esc(currentUser.company) : ''}</p>

                <div class="wd-stats">
                    <div class="wd-stat" style="--delay:0.1s">
                        <div class="wd-stat-val" data-target="${stats.events}">0</div>
                        <div class="wd-stat-label">Evenements a venir</div>
                    </div>
                    <div class="wd-stat" style="--delay:0.3s">
                        <div class="wd-stat-val" data-target="${stats.members}">0</div>
                        <div class="wd-stat-label">Membres actifs</div>
                    </div>
                    <div class="wd-stat" style="--delay:0.5s">
                        <div class="wd-stat-val" data-target="${stats.mentors}">0</div>
                        <div class="wd-stat-label">Mentors disponibles</div>
                    </div>
                </div>

                <div class="wd-actions">
                    <a class="wd-action" href="#membres" onclick="navigate('membres')">
                        <span class="wd-action-icon">&#128101;</span>
                        <span>Mon espace</span>
                    </a>
                    <a class="wd-action" href="#annuaire" onclick="navigate('annuaire')">
                        <span class="wd-action-icon">&#128269;</span>
                        <span>Annuaire</span>
                    </a>
                    <a class="wd-action" href="#evenements" onclick="navigate('evenements')">
                        <span class="wd-action-icon">&#128197;</span>
                        <span>Evenements</span>
                    </a>
                    <a class="wd-action" href="#quizz" onclick="navigate('quizz')">
                        <span class="wd-action-icon">&#127942;</span>
                        <span>Quizz</span>
                    </a>
                </div>
            </div>
        </div>`;

    // Animer les compteurs
    setTimeout(() => animateCounters(), 400);
    // Particules
    setTimeout(() => initParticles(), 100);
}

function hideWelcomeDashboard() {
    if (_particlesRAF) { cancelAnimationFrame(_particlesRAF); _particlesRAF = null; }
    const dash = document.getElementById('welcome-dashboard');
    if (dash) dash.remove();
    const slider = document.querySelector('.hero-slider');
    if (slider) slider.style.display = '';
}

function animateCounters() {
    document.querySelectorAll('.wd-stat-val').forEach(el => {
        const target = parseInt(el.dataset.target) || 0;
        let current = 0;
        const step = Math.max(1, Math.ceil(target / 40));
        const timer = setInterval(() => {
            current += step;
            if (current >= target) { current = target; clearInterval(timer); }
            el.textContent = current;
        }, 30);
    });
}

let _particlesRAF = null;
function initParticles() {
    const canvas = document.getElementById('wd-particles');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const particles = [];
    for (let i = 0; i < 50; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: Math.random() * 2 + 1,
            dx: (Math.random() - 0.5) * 0.5,
            dy: (Math.random() - 0.5) * 0.5,
            o: Math.random() * 0.3 + 0.1
        });
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${p.o})`;
            ctx.fill();
            p.x += p.dx; p.y += p.dy;
            if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
            if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
        });
        // Lignes entre particules proches
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < 100) {
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(255,255,255,${0.08 * (1 - dist/100)})`;
                    ctx.stroke();
                }
            }
        }
        _particlesRAF = requestAnimationFrame(draw);
    }
    draw();
}

// === LOCK CARRIERE ===
function lockCarriereIfNeeded() { /* Section Carriere supprimee */ }

// === PARTENAIRES ===
const PARTENAIRES_LOGOS = {
    'Alstom': 'https://res.cloudinary.com/dsheinfad/image/upload/q_auto,f_auto/affi/logos/alstom',
    'Arcadis': 'https://res.cloudinary.com/dsheinfad/image/upload/q_auto,f_auto/affi/logos/arcadis',
    'BEA-TT': 'https://res.cloudinary.com/dsheinfad/image/upload/q_auto,f_auto/affi/logos/bea-tt',
    'Certifer': 'https://res.cloudinary.com/dsheinfad/image/upload/q_auto,f_auto/affi/logos/certifer',
    'EPSF': 'https://res.cloudinary.com/dsheinfad/image/upload/q_auto,f_auto/affi/logos/epsf',
    'FIF': 'https://res.cloudinary.com/dsheinfad/image/upload/q_auto,f_auto/affi/logos/fif',
    'Framafer': 'https://res.cloudinary.com/dsheinfad/image/upload/q_auto,f_auto/affi/logos/framafer',
    'RATP': 'https://res.cloudinary.com/dsheinfad/image/upload/q_auto,f_auto/affi/logos/ratp',
    'SNCF Reseau': 'https://res.cloudinary.com/dsheinfad/image/upload/q_auto,f_auto/affi/logos/sncf',
    'Vossloh': 'https://res.cloudinary.com/dsheinfad/image/upload/q_auto,f_auto/affi/logos/vossloh',
    'UIC': 'https://res.cloudinary.com/dsheinfad/image/upload/q_auto,f_auto/affi/logos/uic',
    'Universite de l\'Ingenierie': 'https://res.cloudinary.com/dsheinfad/image/upload/q_auto,f_auto/affi/logos/udi',
};

// === ORGANIGRAMME DYNAMIQUE ===
async function loadOrganigramme() {
    try {
        const res = await fetch(`${API}/api/members?action=board`);
        const board = await res.json();
        const el = document.getElementById('organigramme-content');
        if (!el) return;
        if (!board || !board.length) {
            el.innerHTML = '<p class="empty-msg">Organigramme en cours de mise a jour.</p>';
            return;
        }

        const level1 = board.filter(b => b.level === 1);
        const level2 = board.filter(b => b.level === 2);
        const level3 = board.filter(b => b.level === 3 || b.category === 'bureau-other');
        const level4 = board.filter(b => b.level === 4 || b.category === 'administrateur');

        el.innerHTML = _renderOrgLevel1(level1) + _renderOrgLevel2(level2) + _renderOrgLevel3(level3) + _renderOrgLevel4(level4);
    } catch(e) { console.warn('Organigramme:', e); }
}

function _orgInitials(b) {
    const f = (b.first_name || '').charAt(0).toUpperCase();
    const l = (b.last_name || '').charAt(0).toUpperCase();
    return f + l;
}

function _orgTile(b, size, borderColor) {
    const cls = size === 'lg' ? 'org-tile-lg' : size === 'sm' ? 'org-tile-sm' : size === 'xs' ? 'org-tile-xs' : '';
    const bc = borderColor || 'var(--primary)';
    const avatar = b.photo_url
        ? `<img src="${b.photo_url}" class="org-tile-avatar" style="object-fit:cover" alt="">`
        : `<div class="org-tile-avatar" style="background:${bc}">${_orgInitials(b)}</div>`;
    const name = (b.first_name || '') + ' ' + (b.last_name || '');
    return `<div class="org-tile ${cls}" style="border-left-color:${bc}">
        ${avatar}
        <div class="org-tile-info">
            <div class="org-tile-name">${name.trim()}</div>
            <div class="org-tile-role">${b.role || ''}</div>
        </div>
    </div>`;
}

function _renderOrgLevel1(items) {
    if (!items.length) return '';
    return `<div class="org-section">
        <div class="org-section-label">President</div>
        <div class="org-tiles">${items.map(b => _orgTile(b, 'lg', 'var(--accent)')).join('')}</div>
    </div><div class="org-connector"></div>`;
}

function _renderOrgLevel2(items) {
    if (!items.length) return '';
    const vps = items.filter(b => { const r = (b.role||'').toLowerCase(); return r.includes('vice') || r.includes('vp'); });
    const sgs = items.filter(b => { const r = (b.role||'').toLowerCase(); return r.includes('secr'); });
    const tres = items.filter(b => { const r = (b.role||'').toLowerCase(); return r.includes('tres') || r.includes('trésor'); });
    const others = items.filter(b => !vps.includes(b) && !sgs.includes(b) && !tres.includes(b));
    let html = '';
    if (vps.length) {
        html += `<div class="org-section">
            <div class="org-section-label">Vice-Présidents</div>
            <div class="org-tiles">${vps.map(b => _orgTile(b, '', 'var(--primary)')).join('')}</div>
        </div><div class="org-connector"></div>`;
    }
    if (sgs.length) {
        html += `<div class="org-section">
            <div class="org-section-label">Secrétariat Général</div>
            <div class="org-tiles">${sgs.map(b => _orgTile(b, '', 'var(--teal)')).join('')}</div>
        </div><div class="org-connector"></div>`;
    }
    if (tres.length) {
        html += `<div class="org-section">
            <div class="org-section-label">Trésorerie</div>
            <div class="org-tiles">${tres.map(b => _orgTile(b, '', 'var(--gold)')).join('')}</div>
        </div><div class="org-connector"></div>`;
    }
    if (others.length) {
        html += `<div class="org-section">
            <div class="org-tiles">${others.map(b => _orgTile(b, '', 'var(--primary-light)')).join('')}</div>
        </div><div class="org-connector"></div>`;
    }
    return html;
}

function _renderOrgLevel3(items) {
    if (!items.length) return '';
    return `<div class="org-section">
        <div class="org-section-label">Autres membres du Bureau</div>
        <div class="org-tiles">${items.map(b => _orgTile(b, 'sm', 'var(--primary-light,#6c8ebf)')).join('')}</div>
    </div><div class="org-connector"></div>`;
}

function _renderOrgLevel4(items) {
    if (!items.length) return '';
    return `<div class="org-section">
        <div class="org-section-label">Administrateurs</div>
        <div class="org-tiles">${items.map(b => _orgTile(b, 'xs', 'var(--gray-400)')).join('')}</div>
    </div>`;
}

async function loadPartenaires() {
    try {
        const cached = sessionStorage.getItem('affi_partenaires');
        const partenaires = cached ? JSON.parse(cached) : await (async () => { const r = await fetch('/data/partenaires.json'); const d = await r.json(); try { sessionStorage.setItem('affi_partenaires', JSON.stringify(d)); } catch(e) {} return d; })();
        const el = document.getElementById('partenaires-unified');
        if (!el) return;
        el.innerHTML = `<div class="partenaires-unified-grid">
            ${partenaires.map(p => {
                const logoKey = Object.keys(PARTENAIRES_LOGOS).find(k => p.name.includes(k));
                const logo = logoKey ? PARTENAIRES_LOGOS[logoKey] : '';
                return `<a href="${esc(p.website)}" target="_blank" rel="noopener" class="pu-card">
                    <div class="pu-logo">${logo ? `<img src="${logo}" alt="${esc(p.name)}">` : `<span style="font-size:24px;font-weight:800;color:var(--primary)">${esc(p.name.substring(0,3))}</span>`}</div>
                    <div class="pu-body">
                        <div class="pu-name">${esc(p.name)}</div>
                        <div class="pu-sector">${esc(p.sector)}</div>
                        <div class="pu-desc">${esc(p.description)}</div>
                        <div class="pu-loc">&#128205; ${esc(p.city)}</div>
                    </div>
                </a>`;
            }).join('')}
            <a class="pu-card pu-card-simple">
                <div class="pu-logo"><span style="font-size:16px;font-weight:800;color:var(--primary)">Saferail</span></div>
                <div class="pu-body">
                    <div class="pu-name">Saferail</div>
                    <div class="pu-sector">A Colas Rail Company</div>
                </div>
            </a>
        </div>`;
    } catch (e) { console.warn('Partenaires:', e); }
}

// === ECOLES & PARTENAIRES ACADEMIQUES ===
let allEcoles = [];
async function loadEcoles() {
    try {
        const res = await fetch('/data/ecoles.json');
        allEcoles = await res.json();
        renderEcoles('');
    } catch (e) { console.warn('Ecoles:', e); }
}

function filterEcoles(btn, type) {
    document.querySelectorAll('#page-ecoles .replay-filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderEcoles(type);
}

function renderEcoles(type) {
    const el = document.getElementById('ecoles-grid');
    if (!el) return;
    const filtered = type ? allEcoles.filter(e => e.type === type) : allEcoles;
    if (!filtered.length) { el.innerHTML = '<p class="empty-msg" style="grid-column:1/-1">Aucune ecole dans cette categorie</p>'; return; }
    el.innerHTML = filtered.map(e => `
        <div class="ecole-card${e.partenariat ? ' ecole-partenaire' : ''}">
            <div class="ecole-header">
                <div class="ecole-icon">&#127979;</div>
                <div>
                    <div class="ecole-name">${esc(e.name)}</div>
                    <div class="ecole-city">&#128205; ${esc(e.city)} — ${esc(e.region)}</div>
                </div>
            </div>
            <div class="ecole-desc">${esc(e.description)}</div>
            <div class="ecole-specs">
                <span class="card-tag">${esc(e.type)}</span>
                ${e.specialites.map(s => `<span class="card-tag card-tag-specialty">${esc(s)}</span>`).join('')}
                ${e.partenariat ? '<span class="card-tag card-tag-mentor">Partenaire AFFI</span>' : ''}
            </div>
            <a href="${esc(e.website)}" target="_blank" rel="noopener" class="ecole-link">&#128279; Visiter le site web</a>
        </div>
    `).join('');
}

// === STAGES & APPRENTISSAGE ===
async function loadStages(search, sector, type) {
    const p = new URLSearchParams({action:'jobs'});
    if (search) p.set('search', search);
    if (sector) p.set('sector', sector);
    try {
        const res = await fetch(`${API}/api/social?${p}`);
        let jobs = await res.json();
        // Filter for student-relevant contract types
        if (type) {
            jobs = jobs.filter(j => (j.contract_type||'').toLowerCase().includes(type.toLowerCase()));
        } else {
            jobs = jobs.filter(j => {
                const ct = (j.contract_type||'').toLowerCase();
                return ct.includes('stage') || ct.includes('apprenti') || ct.includes('alternance') || ct.includes('vie');
            });
        }
        const el = document.getElementById('stages-list');
        if (!el) return;
        if (!jobs.length) { el.innerHTML = '<p class="empty-msg">Aucune offre de stage ou apprentissage pour le moment. <a href="#accueil" onclick="navigate(\'accueil\')">Voir toutes les offres d\'emploi</a></p>'; return; }
        el.innerHTML = jobs.map(j => `
            <div class="job-card">
                <div class="job-header">
                    <div>
                        <div class="job-title">${esc(j.title)}</div>
                        <div class="job-company">${esc(j.company)} &middot; ${esc(j.location||'')}</div>
                    </div>
                    <div>
                        <span class="card-tag card-tag-specialty">${esc(j.contract_type||'Stage')}</span>
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
    } catch (e) { console.warn('Stages:', e); }
}

// === REPLAYS / MEDIATHEQUE ===
let allReplays = [];
async function loadReplays() {
    try {
        const res = await fetch('/data/replays.json');
        allReplays = await res.json();
        renderReplays('');
    } catch (e) { console.warn('Replays:', e); }
}

function filterReplays(btn, cat) {
    document.querySelectorAll('#page-replays .replay-filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderReplays(cat);
}

function renderReplays(cat) {
    const el = document.getElementById('replays-grid');
    if (!el) return;
    const filtered = cat ? allReplays.filter(r => r.category === cat) : allReplays;
    if (!filtered.length) { el.innerHTML = '<p style="text-align:center;color:var(--gray-400);padding:40px;grid-column:1/-1">Aucun replay dans cette categorie</p>'; return; }
    el.innerHTML = filtered.map(r => `
        <div class="replay-card">
            <div class="replay-thumb" onclick="openReplay('${esc(r.video_url)}')">
                <img src="${esc(r.thumbnail_url)}" alt="${esc(r.title)}">
                <div class="replay-play">&#9654;</div>
                ${r.duration ? `<span class="replay-duration">${esc(r.duration)}</span>` : ''}
            </div>
            <div class="replay-body">
                <span class="card-tag card-tag-primary">${esc(r.category)}</span>
                <span class="card-date">${formatDate(r.event_date)}</span>
                <div class="replay-title">${esc(r.title)}</div>
                <div class="replay-desc">${esc(r.description)}</div>
                <div class="replay-speaker">&#127908; ${esc(r.speaker_name)}</div>
            </div>
        </div>
    `).join('');
}

function openReplay(url) {
    const modal = document.getElementById('replay-modal');
    const iframe = document.getElementById('replay-iframe');
    if (modal && iframe) {
        iframe.src = url;
        modal.style.display = 'flex';
    }
}
function closeReplay() {
    const modal = document.getElementById('replay-modal');
    const iframe = document.getElementById('replay-iframe');
    if (modal) { modal.style.display = 'none'; iframe.src = ''; }
}

// === QUIZZ DU RAIL ===
const QUIZZ_CATALOG = [
    { file: 'quizz_march_2026.json', cat: 'General', icon: '&#128646;' },
    { file: 'quizz_infra_histoire.json', cat: 'Infrastructure', icon: '&#128218;' },
    { file: 'quizz_infra_reglementation.json', cat: 'Infrastructure', icon: '&#9878;' },
    { file: 'quizz_infra_signalisation.json', cat: 'Infrastructure', icon: '&#128681;' },
    { file: 'quizz_infra_voie.json', cat: 'Infrastructure', icon: '&#128740;' },
    { file: 'quizz_infra_energie.json', cat: 'Infrastructure', icon: '&#9889;' },
    { file: 'quizz_mr_histoire.json', cat: 'Materiel Roulant', icon: '&#128644;' },
    { file: 'quizz_mr_reglementation.json', cat: 'Materiel Roulant', icon: '&#9878;' },
    { file: 'quizz_mr_traction.json', cat: 'Materiel Roulant', icon: '&#9881;' },
    { file: 'quizz_mr_freinage.json', cat: 'Materiel Roulant', icon: '&#128721;' },
    { file: 'quizz_mr_confort.json', cat: 'Materiel Roulant', icon: '&#128186;' },
];
let quizzData = null;
let quizzState = { current: 0, score: 0, answers: [], finished: false };
let quizzCatalogData = [];

async function loadQuizz() {
    // Load metadata for all quizzes
    quizzCatalogData = [];
    const el = document.getElementById('quizz-container');
    if (el) el.innerHTML = '<p class="empty-msg">Chargement du catalogue...</p>';
    try {
        const results = await Promise.all(QUIZZ_CATALOG.map(q =>
            fetch(`/data/${q.file}`).then(r => r.json()).then(d => ({...d, cat: q.cat, icon: q.icon, file: q.file})).catch(() => null)
        ));
        quizzCatalogData = results.filter(Boolean);
        renderQuizzCatalog('');
    } catch (e) { console.warn('Quizz:', e); }
}

function filterQuizzCat(btn, cat) {
    document.querySelectorAll('#page-quizz .replay-filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderQuizzCatalog(cat);
}

function renderQuizzCatalog(cat) {
    const el = document.getElementById('quizz-container');
    if (!el) return;
    const filtered = cat ? quizzCatalogData.filter(q => q.cat === cat) : quizzCatalogData;
    el.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px">
            ${filtered.map(q => `
                <div class="quizz-catalog-card" onclick="selectQuizz('${q.file}')">
                    <div class="qcc-icon">${q.icon}</div>
                    <span class="card-tag card-tag-${q.cat === 'Infrastructure' ? 'specialty' : q.cat === 'Materiel Roulant' ? 'primary' : ''}" style="margin-bottom:8px">${esc(q.cat)}</span>
                    <div class="qcc-title">${esc(q.title.replace('Quizz du Rail — ',''))}</div>
                    <div class="qcc-desc">${esc(q.description)}</div>
                    <div class="qcc-meta">${q.questions.length} questions</div>
                </div>
            `).join('')}
        </div>`;
}

async function selectQuizz(file) {
    try {
        const res = await fetch(`/data/${file}`);
        quizzData = await res.json();
        quizzState = { current: 0, score: 0, answers: [], finished: false };
        renderQuizzIntro();
    } catch (e) { console.warn('Quizz:', e); }
}

function renderQuizzIntro() {
    const el = document.getElementById('quizz-container');
    if (!el || !quizzData) return;
    el.innerHTML = `
        <div class="quizz-intro">
            <div style="font-size:64px;margin-bottom:16px">&#128646;</div>
            <h3>${esc(quizzData.title)}</h3>
            <p>${esc(quizzData.description)}</p>
            <p style="margin:16px 0;color:var(--gray-500)">${quizzData.questions.length} questions &middot; Choix multiple &middot; Correction immediate</p>
            <div style="display:flex;gap:12px;justify-content:center">
                <button class="btn btn-accent" onclick="startQuizz()">Commencer le Quizz</button>
                <button class="btn btn-primary" onclick="loadQuizz()" style="background:var(--gray-500)">Retour au catalogue</button>
            </div>
        </div>`;
}

function startQuizz() {
    quizzState = { current: 0, score: 0, answers: [], finished: false };
    renderQuizzQuestion();
}

function renderQuizzQuestion() {
    const el = document.getElementById('quizz-container');
    if (!el || !quizzData) return;
    const q = quizzData.questions[quizzState.current];
    const num = quizzState.current + 1;
    const total = quizzData.questions.length;
    el.innerHTML = `
        <div class="quizz-progress">
            <div class="quizz-progress-bar" style="width:${(num / total) * 100}%"></div>
        </div>
        <div class="quizz-header">Question ${num} / ${total}</div>
        <div class="quizz-question">${esc(q.question)}</div>
        <div class="quizz-choices">
            ${q.choices.map((c, i) => `
                <button class="quizz-choice" onclick="answerQuizz(${i})" id="choice-${i}">${esc(c)}</button>
            `).join('')}
        </div>
        <div id="quizz-feedback" style="display:none"></div>`;
}

function answerQuizz(idx) {
    const q = quizzData.questions[quizzState.current];
    const correct = idx === q.answer;
    if (correct) quizzState.score++;
    quizzState.answers.push(idx);

    // Disable all buttons & highlight
    document.querySelectorAll('.quizz-choice').forEach((btn, i) => {
        btn.disabled = true;
        if (i === q.answer) btn.classList.add('quizz-correct');
        else if (i === idx && !correct) btn.classList.add('quizz-wrong');
    });

    const fb = document.getElementById('quizz-feedback');
    fb.style.display = 'block';
    fb.className = correct ? 'quizz-feedback-correct' : 'quizz-feedback-wrong';
    fb.innerHTML = `
        <strong>${correct ? '&#9989; Bonne reponse !' : '&#10060; Mauvaise reponse'}</strong>
        <p>${esc(q.explanation)}</p>
        <button class="btn btn-primary" onclick="${quizzState.current < quizzData.questions.length - 1 ? 'nextQuestion()' : 'showQuizzResult()'}" style="margin-top:12px">
            ${quizzState.current < quizzData.questions.length - 1 ? 'Question suivante' : 'Voir le resultat'}
        </button>`;
}

function nextQuestion() {
    quizzState.current++;
    renderQuizzQuestion();
}

function showQuizzResult() {
    const el = document.getElementById('quizz-container');
    if (!el) return;
    const total = quizzData.questions.length;
    const pct = Math.round((quizzState.score / total) * 100);
    let emoji = '&#128175;', msg = 'Excellent ! Vous etes un expert du rail !';
    if (pct < 40) { emoji = '&#128556;'; msg = 'Pas mal pour un debut ! Revisez et retentez votre chance.'; }
    else if (pct < 70) { emoji = '&#128077;'; msg = 'Bien joue ! Encore quelques efforts pour le top 10 !'; }
    else if (pct < 90) { emoji = '&#127881;'; msg = 'Tres bien ! Vous connaissez bien le ferroviaire.'; }

    // Save score locally
    const scores = JSON.parse(localStorage.getItem('affi_quizz_scores') || '[]');
    const name = (currentUser ? currentUser.first_name + ' ' + currentUser.last_name : 'Anonyme');
    scores.push({ name, score: quizzState.score, total, date: new Date().toISOString(), quizz: quizzData.id });
    localStorage.setItem('affi_quizz_scores', JSON.stringify(scores));

    // Top 10
    const quizzScores = scores.filter(s => s.quizz === quizzData.id).sort((a, b) => b.score - a.score).slice(0, 10);

    el.innerHTML = `
        <div class="quizz-result">
            <div style="font-size:64px">${emoji}</div>
            <h3>Votre score : ${quizzState.score} / ${total} (${pct}%)</h3>
            <p>${msg}</p>
            <button class="btn btn-accent" onclick="startQuizz()" style="margin-top:16px">Recommencer</button>
        </div>
        <div class="quizz-leaderboard">
            <h3>&#127942; Top 10 — ${esc(quizzData.title)}</h3>
            <div class="leaderboard-list">
                ${quizzScores.map((s, i) => `
                    <div class="leaderboard-row${i < 3 ? ' leaderboard-top' : ''}">
                        <span class="leaderboard-rank">${i + 1}</span>
                        <span class="leaderboard-name">${esc(s.name)}</span>
                        <span class="leaderboard-score">${s.score}/${s.total}</span>
                    </div>
                `).join('')}
            </div>
        </div>`;
}

// === CONTACT ===
async function submitContact(evt) {
    evt.preventDefault();
    const f = evt.target;
    try {
        const res = await fetch(`${API}/api/contact`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({name:f.name.value, email:f.email.value, subject:f.subject.value, message:f.message.value})
        });
        if (res.ok) { document.getElementById('contact-success').style.display = 'block'; f.reset(); }
    } catch (e) { alert('Erreur: ' + e.message); }
}

// === PHONE VALIDATION ===
function validatePhone(phone) {
    if (!phone) return true; // optional
    const cleaned = phone.replace(/[\s.\-]/g, '');
    return /^(\+33|0)[1-9]\d{8}$/.test(cleaned);
}

// === ADHESION WORKFLOW ===
const ADH_PRICES = { actif: 48, jeune: 32, etudiant: 24, retraite: 32, honneur: 0, partenaire: 0 };
const ADH_LABELS = { actif: 'Membre actif (+30 ans)', jeune: 'Jeune ingenieur (-30 ans)', etudiant: 'Etudiant', retraite: 'Retraite', honneur: "Membre d'honneur", partenaire: 'Membre partenaire' };

function sendAdhesionEmail(formData) {
    const body = {
        name: formData.first_name + ' ' + formData.last_name,
        email: formData.email,
        subject: '[AFFI] Nouvelle demande d\'adhesion - ' + formData.membership_type,
        message: `Nouvelle demande d'adhesion AFFI\n\n` +
            `Prenom: ${formData.first_name}\n` +
            `Nom: ${formData.last_name}\n` +
            `Email: ${formData.email}\n` +
            `Telephone: ${formData.phone || 'Non renseigne'}\n` +
            `Entreprise: ${formData.company || 'Non renseignee'}\n` +
            `Fonction: ${formData.job_title || 'Non renseignee'}\n` +
            `Secteur: ${formData.sector || 'Non renseigne'}\n` +
            `Type d'adhesion: ${formData.membership_type}\n` +
            `Montant: ${ADH_PRICES[formData.membership_type] || '?'} EUR`
    };
    fetch(`${API}/api/contact`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body)
    }).catch(() => {});
}

async function submitAdhesion(evt) {
    evt.preventDefault();
    const f = evt.target;
    const prenom = f.first_name.value;
    const nom = f.last_name.value;
    const email = f.email.value;
    const phone = f.phone.value;
    if (phone && !validatePhone(phone)) {
        alert('Numero de telephone invalide. Format attendu : 06 12 34 56 78 ou +33 6 12 34 56 78');
        return;
    }
    const entreprise = f.company.value;
    const fonction = f.job_title.value;
    const secteur = f.sector.value;
    const type = f.membership_type.value;
    const prix = ADH_PRICES[type] || 0;
    const label = ADH_LABELS[type] || type;

    // Save to contact_messages
    try {
        await fetch(`${API}/api/contact`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                name: prenom + ' ' + nom, email,
                subject: 'Adhesion ' + label,
                message: `Adhesion AFFI 2026\nType: ${label} (${prix} EUR)\nPrenom: ${prenom}\nNom: ${nom}\nEmail: ${email}\nTel: ${phone}\nEntreprise: ${entreprise}\nFonction: ${fonction}\nSecteur: ${secteur}`
            })
        });
    } catch(e) {}

    // Show payment choice modal
    openModal(`<div class="adm-modal-bg" id="modal-adh-payment">
        <div class="adm-modal" style="max-width:540px;padding:36px;text-align:center">
            <h2 style="color:var(--primary);font-size:22px;margin-bottom:8px">Adhesion enregistree !</h2>
            <p style="color:var(--gray-600);margin-bottom:4px">${esc(label)}</p>
            <p style="font-size:28px;font-weight:900;color:var(--accent);margin-bottom:20px">${prix > 0 ? prix + ' EUR / an' : 'Exonere'}</p>
            <div style="background:var(--gray-50);border-radius:var(--radius);padding:16px;margin-bottom:20px;text-align:left;font-size:13px;color:var(--gray-500)">
                <strong style="color:var(--primary)">&#10003; Recapitulatif</strong><br>
                ${esc(prenom)} ${esc(nom)} &mdash; ${esc(email)}<br>
                ${entreprise ? esc(entreprise) + ' &mdash; ' : ''}${esc(label)}<br>
                ${secteur ? 'Secteur : ' + esc(secteur) + '<br>' : ''}
                Montant : ${prix} EUR
            </div>
            ${prix > 0 ? `<p style="font-size:15px;font-weight:700;color:var(--primary);margin-bottom:16px">Choisissez votre mode de paiement :</p>
            <div style="display:flex;flex-direction:column;gap:12px;max-width:400px;margin:0 auto 20px">
                <a href="https://www.helloasso.com/associations/affi-association-ferroviaire-francaise-des-ingenieurs-et-cadres/adhesions/affi-cotisation-2026" target="_blank" rel="noopener" class="btn btn-accent" style="font-size:14px;padding:14px 24px">&#128179; Carte bancaire / HelloAsso &mdash; ${prix} EUR</a>
                <button class="btn btn-primary" onclick="showAdhCheque('${esc(prenom)}','${esc(nom)}','${esc(email)}','${esc(phone)}','${esc(entreprise)}','${esc(fonction)}','${esc(label)}','${prix}')" style="font-size:14px;padding:14px 24px">&#128231; Cheque &mdash; Imprimer le bulletin</button>
                <button class="btn btn-primary" onclick="showAdhVirement('${esc(label)}','${prix}')" style="font-size:14px;padding:14px 24px;background:var(--teal)">&#127974; Virement bancaire &mdash; Voir IBAN</button>
            </div>` : '<p style="color:var(--gray-500);margin-bottom:16px">Votre categorie ne requiert pas de cotisation. Nous vous recontactons sous 48h.</p>'}
            <button onclick="closeModal('modal-adh-payment')" style="background:none;border:none;color:var(--gray-400);font-size:13px;cursor:pointer;font-family:inherit">Fermer</button>
        </div>
    </div>`);
    document.getElementById('adhesion-success').style.display = 'block';
    f.reset();
    showToast("Demande d'adhesion envoyee !", 'success');
    sendAdhesionEmail({ first_name: prenom, last_name: nom, email, phone, company: entreprise, job_title: fonction, sector: secteur, membership_type: type });
}

function showAdhCheque(prenom, nom, email, phone, entreprise, fonction, label, prix) {
    closeModal('modal-adh-payment');
    openModal(`<div class="adm-modal-bg" id="modal-adh-cheque">
        <div class="adm-modal" style="max-width:540px;padding:36px;text-align:center">
            <div style="font-size:48px;margin-bottom:12px">&#128231;</div>
            <h2 style="color:var(--primary);font-size:22px;margin-bottom:8px">Paiement par cheque</h2>
            <p style="color:var(--gray-600);margin-bottom:16px">${esc(label)} &mdash; <strong>${prix} EUR</strong></p>
            <div id="adh-bulletin-content" style="background:var(--gray-50);border:2px solid var(--primary);border-radius:var(--radius);padding:20px;margin-bottom:16px;text-align:left;font-size:14px;line-height:1.8">
                <strong style="color:var(--primary)">Bulletin d'adhesion AFFI 2026</strong><br>
                <strong>Prenom :</strong> ${esc(prenom)}<br>
                <strong>Nom :</strong> ${esc(nom)}<br>
                <strong>Email :</strong> ${esc(email)}<br>
                ${phone ? '<strong>Tel :</strong> ' + esc(phone) + '<br>' : ''}
                ${entreprise ? '<strong>Entreprise :</strong> ' + esc(entreprise) + '<br>' : ''}
                ${fonction ? '<strong>Fonction :</strong> ' + esc(fonction) + '<br>' : ''}
                <strong>Type :</strong> ${esc(label)}<br>
                <strong>Montant :</strong> ${prix} EUR<br>
                <hr style="border:none;border-top:1px solid var(--gray-200);margin:8px 0">
                <strong>Cheque a l'ordre de :</strong> AFFI<br>
                <strong>Adresse :</strong> AFFI &mdash; 60 rue Anatole France &mdash; 92300 Levallois-Perret
            </div>
            <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
                <button class="btn btn-primary" onclick="printAdhesionBulletin()" style="font-size:13px;padding:10px 20px">&#128424; Imprimer le bulletin</button>
            </div>
            <p style="margin-top:16px;font-size:12px;color:var(--gray-400)">Votre compte sera active des reception du reglement.</p>
            <button onclick="closeModal('modal-adh-cheque')" style="margin-top:8px;background:none;border:none;color:var(--gray-400);font-size:13px;cursor:pointer;font-family:inherit">Fermer</button>
        </div>
    </div>`);
}

function showAdhVirement(label, prix) {
    closeModal('modal-adh-payment');
    openModal(`<div class="adm-modal-bg" id="modal-adh-virement">
        <div class="adm-modal" style="max-width:540px;padding:36px;text-align:center">
            <div style="font-size:48px;margin-bottom:12px">&#127974;</div>
            <h2 style="color:var(--primary);font-size:22px;margin-bottom:8px">Virement bancaire</h2>
            <p style="color:var(--gray-600);margin-bottom:16px">${esc(label)} &mdash; <strong>${prix} EUR</strong></p>
            <div style="background:var(--gray-50);border:2px solid var(--primary);border-radius:var(--radius);padding:20px;margin-bottom:16px;text-align:left;font-size:14px;line-height:1.8">
                <strong style="color:var(--primary)">Coordonnees bancaires AFFI</strong><br>
                <strong>Banque :</strong> CIC<br>
                <strong>IBAN :</strong> <span style="font-family:monospace;background:var(--gray-100);padding:2px 8px;border-radius:4px">FR76 3006 6100 0100 0206 2440 168</span><br>
                <strong>BIC :</strong> CMCIFRPP<br>
                <strong>Titulaire :</strong> AFFI<br>
                <hr style="border:none;border-top:1px solid var(--gray-200);margin:8px 0">
                <strong>Montant :</strong> ${prix} EUR<br>
                <strong>Reference :</strong> Adhesion AFFI 2026 + votre nom
            </div>
            <p style="font-size:12px;color:var(--gray-400)">Votre compte sera active des reception du virement.</p>
            <button onclick="closeModal('modal-adh-virement')" style="margin-top:12px;background:none;border:none;color:var(--gray-400);font-size:13px;cursor:pointer;font-family:inherit">Fermer</button>
        </div>
    </div>`);
}

function printAdhesionBulletin() {
    const content = document.getElementById('adh-bulletin-content');
    if (!content) return;
    const w = window.open('', '_blank');
    w.document.write('<html><head><title>Bulletin adhesion AFFI 2026</title><style>body{font-family:Arial,sans-serif;padding:40px;color:#333}h2{color:#1a3c6e}strong{color:#1a3c6e}hr{border:none;border-top:1px solid #ddd;margin:12px 0}</style></head><body>' + content.innerHTML + '</body></html>');
    w.document.close();
    w.print();
}

// === COOKIE CONSENT ===
function initCookieBanner() {
    if (!localStorage.getItem('affi_cookies_accepted')) {
        const el = document.getElementById('cookie-banner');
        if (el) el.style.display = 'flex';
    }
}
function acceptCookies(level) {
    localStorage.setItem('affi_cookies_accepted', level || 'all');
    const el = document.getElementById('cookie-banner');
    if (el) { el.style.opacity = '0'; setTimeout(() => el.style.display = 'none', 300); }
}

// === MODAL HELPERS (prevent body scroll + stable positioning) ===
function openModal(html) {
    document.body.style.overflow = 'hidden';
    document.body.insertAdjacentHTML('beforeend', html);
    // Stop clicks inside .adm-modal from closing the backdrop
    const latest = document.querySelector('.adm-modal-bg:last-child .adm-modal');
    if (latest) latest.addEventListener('mousedown', function(e) { e.stopPropagation(); });
}
function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
    if (!document.querySelector('.adm-modal-bg')) {
        document.body.style.overflow = '';
    }
}
// Close backdrop ONLY on direct mousedown on the dark overlay itself
document.addEventListener('mousedown', function(e) {
    // Only close if the mousedown is DIRECTLY on the backdrop (not on the modal content inside)
    if (e.target.classList.contains('adm-modal-bg')) {
        // Small delay to avoid conflict with any button click inside
        setTimeout(function() {
            if (e.target.parentNode) {
                e.target.remove();
                if (!document.querySelector('.adm-modal-bg')) {
                    document.body.style.overflow = '';
                }
            }
        }, 50);
    }
});
// Close on Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const modal = document.querySelector('.adm-modal-bg');
        if (modal) {
            modal.remove();
            if (!document.querySelector('.adm-modal-bg')) {
                document.body.style.overflow = '';
            }
        }
    }
});

// === TOAST NOTIFICATIONS ===
function showToast(msg, type) {
    type = type || 'info';
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('toast-visible'), 10);
    setTimeout(() => { toast.classList.remove('toast-visible'); setTimeout(() => toast.remove(), 300); }, 4000);
}

// === SCROLL ANIMATIONS ===
function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('fade-in-visible'); observer.unobserve(e.target); } });
    }, { threshold: 0.1 });
    document.querySelectorAll('.card, .board-card, .kpi-card, .pu-card, .ecole-card, .replay-card').forEach(el => {
        el.classList.add('fade-in');
        observer.observe(el);
    });
}

// === RESIZE IMAGE UTILITY ===
function resizeImage(file, maxWidth, maxHeight, callback) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            let w = img.width, h = img.height;
            if (w > maxWidth) { h = h * maxWidth / w; w = maxWidth; }
            if (h > maxHeight) { w = w * maxHeight / h; h = maxHeight; }
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            callback(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// === HELPERS ===
function esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function formatDate(d) {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString('fr-FR', {day:'numeric',month:'long',year:'numeric'}); }
    catch { return (d || '').substring(0, 10); }
}
