/**
 * AFFI — SPA Router, Slider, Page Logic
 */
const API = window.location.origin;
const PAGES = ['accueil','identite','annuaire','agenda','evenements','publications','replays','quizz','ecoles','adhesion','contact','membres'];

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
    if (page === 'accueil') { loadHome(); loadPartenaires(); lockCarriereIfNeeded(); if (typeof loadPolls === 'function') loadPolls(); if (isLoggedIn()) showWelcomeDashboard(); else hideWelcomeDashboard(); }
    if (page === 'identite') { setTimeout(() => { if (typeof loadMap === 'function') loadMap(); }, 300); }
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
                    <a class="btn btn-accent" href="#membres" onclick="navigate('membres')">Se connecter</a>
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
        userArea.innerHTML = `<a class="nav-member-btn" href="#membres" onclick="navigate('membres')">Connexion</a>`;
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
            const res = await fetch(`${API}/api/members?action=public_annuaire&search=${encodeURIComponent(q)}`);
            const members = await res.json();
            if (!members.length) { el.innerHTML = '<div class="nsr-item" style="color:var(--gray-400)">Aucun resultat</div>'; el.style.display = 'block'; return; }
            el.innerHTML = members.slice(0, 6).map(m => {
                const initials = ((m.first_name||'?')[0] + (m.last_name||'?')[0]).toUpperCase();
                const name = isLoggedIn() ? `${m.first_name} ${m.last_name}` : initials;
                return `<div class="nsr-item" onclick="navigate('annuaire')">
                    <div class="nsr-avatar">${initials}</div>
                    <div><strong>${esc(name)}</strong><br><span style="font-size:12px;color:var(--gray-400)">${esc(m.company||'')} · ${esc(m.sector||'')}</span></div>
                </div>`;
            }).join('');
            el.style.display = 'block';
        } catch(e) { el.style.display = 'none'; }
    }, 300);
}

// === NAV SUB (contextuel) ===
function updateNavSub(page) {
    const sub = document.getElementById('nav-sub');
    const links = document.getElementById('nav-sub-links');
    if (!sub || !links) return;
    const subs = {
        identite: [
            {label:"L'association",action:"scrollToSection('ident-association')"},
            {label:"Ses actions",action:"scrollToSection('ident-actions')"},
            {label:"Historique",action:"scrollToSection('ident-historique')"},
            {label:"Gouvernance",action:"scrollToSection('ident-gouvernance')"},
            {label:"Organigramme",action:"scrollToSection('ident-organigramme')"},
            {label:"Carte",action:"scrollToSection('ident-cartographie')"},
        ],
        agenda: [
            {label:"Agenda",action:"navigate('agenda')"},
            {label:"Evenements",action:"navigate('evenements')"},
            {label:"Replays",action:"navigate('replays')"},
            {label:"Quizz du Rail",action:"navigate('quizz')"},
            {label:"Publications",action:"navigate('publications')"},
        ]
    };
    const items = subs[page];
    if (items) {
        links.innerHTML = items.map(i => `<a class="nav-sub-link" onclick="${i.action}">${i.label}</a>`).join('');
        sub.style.display = '';
    } else {
        sub.style.display = 'none';
    }
}

// Fonction appelee par members.js apres login pour tout debloquer
function onUserLoggedIn() {
    restoreLockedPages();
    updateNavbarState();
    // Recharger la page courante pour afficher le contenu
    const currentPage = location.hash.slice(1) || 'accueil';
    if (LOCKED_PAGES.includes(currentPage) || currentPage === 'annuaire' || currentPage === 'accueil') {
        navigate(currentPage);
    }
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
});

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
    try {
        const [newsRes, eventsRes] = await Promise.all([
            fetch(`${API}/api/news?limit=6`), fetch(`${API}/api/events?upcoming=1&limit=4`)
        ]);
        const news = await newsRes.json();
        const events = await eventsRes.json();
        renderHomeNews(news);
        renderHomeEvents(events);
    } catch (e) { console.warn('Home:', e); }
    // Load jobs and feed on homepage
    if (typeof loadJobs === 'function') loadJobs();
    if (typeof loadFeed === 'function') loadFeed();
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
        <div class="card">
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

// === AGENDA (upcoming events) ===
let _agendaEvents = [];
let _calYear, _calMonth;

async function loadAgenda() {
    try {
        const res = await fetch(`${API}/api/events?upcoming=1&limit=50`);
        _agendaEvents = await res.json();
        const now = new Date();
        _calYear = now.getFullYear();
        _calMonth = now.getMonth();
        renderCalendar();
        renderAgendaEvents(_agendaEvents);
    } catch (e) { console.warn('Agenda:', e); }
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
        return `<div class="evt-card">
            <div class="evt-date-col" style="background:${gradients[i % gradients.length]}">
                <div class="evt-date-day">${day}</div>
                <div class="evt-date-month">${month}</div>
                <div class="evt-date-year">${year}</div>
            </div>
            <div class="evt-body">
                <div class="evt-tags">
                    ${e.event_type ? `<span class="card-tag card-tag-primary">${esc(e.event_type)}</span>` : ''}
                    ${e.is_members_only ? '<span class="card-tag" style="background:var(--accent);color:#fff">Membres</span>' : ''}
                </div>
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
        <div class="card">
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
                    <button onclick="downloadICS('${esc(e.title)}','${esc(e.description||'')}','${esc(e.location||'')}','${e.start_date}','${e.end_date||''}')" class="btn btn-primary" style="font-size:11px;padding:6px 12px">&#128197; Ajouter au calendrier</button>
                    ${typeof renderShareButtons==='function' ? renderShareButtons(e.title, e.id) : ''}
                </div>
            </div>
        </div>`).join('');
}

// === PUBLICATIONS ===
async function loadPublications() {
    try {
        const res = await fetch(`${API}/api/publications?limit=50`);
        const pubs = await res.json();
        const el = document.getElementById('publications-list');
        if (!el) return;
        if (!pubs.length) { el.innerHTML = '<p style="color:var(--gray-400);text-align:center;padding:40px">Aucune publication</p>'; return; }
        el.innerHTML = pubs.map(p => `
            <div class="card">
                <div class="card-body">
                    <span class="card-date">${formatDate(p.published_at)}</span>
                    ${p.category ? `<span class="card-tag">${esc(p.category)}</span>` : ''}
                    <div class="card-title">${esc(p.title)}</div>
                    <div class="card-text">${esc(p.excerpt || (p.content || '').substring(0, 220))}</div>
                    <span class="card-link">Lire la suite</span>
                </div>
            </div>`).join('');
    } catch (e) { console.warn('Pubs:', e); }
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
                <span class="locked-badge">&#128274; Connectez-vous pour voir le profil complet</span>
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
function lockCarriereIfNeeded() {
    const jobsSection = document.getElementById('home-jobs');
    if (!jobsSection) return;
    const parent = jobsSection.closest('section');
    if (!parent) return;
    if (!isLoggedIn()) {
        if (!parent.querySelector('.locked-banner')) {
            jobsSection.style.display = 'none';
            parent.insertAdjacentHTML('beforeend', `
                <div class="locked-banner">
                    <span class="locked-banner-icon">&#128274;</span>
                    <div>
                        <strong>Espace Carriere reserve aux adherents</strong>
                        <p>Connectez-vous pour voir les offres d'emploi, stages et apprentissage.</p>
                    </div>
                    <a class="btn btn-accent" href="#membres" onclick="navigate('membres')" style="font-size:13px;padding:8px 20px;flex-shrink:0">Se connecter</a>
                </div>
            `);
        }
    } else {
        jobsSection.style.display = '';
        const banner = parent.querySelector('.locked-banner');
        if (banner) banner.remove();
    }
}

// === PARTENAIRES ===
const PARTENAIRES_LOGOS = {
    'Alstom': '/images/logos/alstom.png',
    'Arcadis': '/images/logos/arcadis.png',
    'BEA-TT': '/images/logos/bea-tt.png',
    'Certifer': '/images/logos/certifer.png',
    'EPSF': '/images/logos/epsf.png',
    'FIF': '/images/logos/fif.png',
    'Framafer': '/images/logos/framafer.png',
    'RATP': '/images/logos/ratp.png',
    'SNCF Reseau': '/images/logos/sncf.png',
    'Vossloh': '/images/logos/vossloh.png',
    'UIC': '/images/logos/uic.png',
    'Universite de l\'Ingenierie': '/images/logos/udi.png',
};

async function loadPartenaires() {
    try {
        const res = await fetch('/data/partenaires.json');
        const partenaires = await res.json();
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

async function submitAdhesion(evt) {
    evt.preventDefault();
    const f = evt.target;
    const data = {
        name: f.first_name.value + ' ' + f.last_name.value,
        email: f.email.value,
        subject: 'Demande adhesion - ' + f.membership_type.value,
        message: `Demande d'adhesion AFFI\n\nPrenom: ${f.first_name.value}\nNom: ${f.last_name.value}\nEmail: ${f.email.value}\nTelephone: ${f.phone.value}\nEntreprise: ${f.company.value}\nFonction: ${f.job_title.value}\nSecteur: ${f.sector.value}\nType: ${f.membership_type.value}`
    };
    try {
        const res = await fetch(`${API}/api/contact`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.ok) {
            document.getElementById('adhesion-success').style.display = 'block';
            f.reset();
        } else {
            alert(result.error || 'Erreur lors de l\'envoi');
        }
    } catch (e) {
        alert('Erreur réseau. Veuillez réessayer.');
    }
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

// === HELPERS ===
function esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function formatDate(d) {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString('fr-FR', {day:'numeric',month:'long',year:'numeric'}); }
    catch { return (d || '').substring(0, 10); }
}
