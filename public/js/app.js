/**
 * AFFI — SPA Router, Slider, Page Logic
 */
const API = window.location.origin;
const PAGES = ['accueil','identite','annuaire','agenda','evenements','publications','replays','quizz','adhesion','contact','membres'];

// === ROUTER ===
function navigate(page) {
    if (!PAGES.includes(page)) page = 'accueil';
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const el = document.getElementById('page-' + page);
    if (el) el.classList.add('active');
    document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.page === page));
    window.scrollTo({top: 0, behavior: 'smooth'});
    history.pushState(null, '', '#' + page);
    if (page === 'agenda') { loadAgenda(); if (typeof loadCourses === 'function') loadCourses(); }
    if (page === 'evenements') loadEvents();
    if (page === 'annuaire') loadPublicAnnuaire();
    if (page === 'publications') loadPublications();
    if (page === 'replays') loadReplays();
    if (page === 'quizz') loadQuizz();
    if (page === 'accueil') loadHome();
    if (page === 'identite') { setTimeout(() => { if (typeof loadMap === 'function') loadMap(); }, 300); }
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
    setInterval(() => showSlide(currentSlide + 1), 5500);
    dots.forEach((d, i) => d.addEventListener('click', () => showSlide(i)));
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
async function loadAgenda() {
    try {
        const res = await fetch(`${API}/api/events?upcoming=1&limit=20`);
        const events = await res.json();
        const el = document.getElementById('agenda-list');
        if (!el) return;
        if (!events.length) { el.innerHTML = '<p style="color:var(--gray-400);text-align:center;padding:40px">Aucun evenement a venir</p>'; return; }
        el.innerHTML = renderEventCards(events);
    } catch (e) { console.warn('Agenda:', e); }
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
        return `<div class="member-card-v2" onclick="toggleMemberDetail(this)">
            <div class="mc-header">
                <div class="member-avatar">${esc(initials.toUpperCase())}${m.is_mentor ? '<span class="mentor-badge" title="Disponible pour conseiller">&#127891;</span>' : ''}</div>
                <div class="mc-identity">
                    <div class="member-name">${esc(m.first_name)} ${esc(m.last_name)}</div>
                    <div class="member-job">${esc(m.job_title || '')}</div>
                    <div class="member-company">${esc(m.company || '')}</div>
                </div>
            </div>
            <div class="mc-details">
                ${m.region ? `<div class="mc-detail-row"><span class="mc-icon">&#128205;</span> ${esc(m.region)}</div>` : ''}
                ${m.bio ? `<div class="mc-bio">${esc((m.bio || '').substring(0, 150))}${(m.bio||'').length > 150 ? '...' : ''}</div>` : ''}
                ${m.linkedin_url ? `<div class="mc-detail-row"><a href="${esc(m.linkedin_url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" class="mc-linkedin">&#128279; Profil LinkedIn</a></div>` : ''}
            </div>
            <div class="mc-tags">
                ${m.sector ? `<span class="card-tag">${esc(m.sector)}</span>` : ''}
                ${m.specialty ? `<span class="card-tag card-tag-specialty">${esc(m.specialty)}</span>` : ''}
                ${m.region ? `<span class="card-tag card-tag-region">${esc(m.region)}</span>` : ''}
                ${m.is_board ? '<span class="card-tag card-tag-primary">Bureau</span>' : ''}
                ${m.is_mentor ? '<span class="card-tag card-tag-mentor">Mentor disponible</span>' : ''}
            </div>
            <div class="mc-rgpd">
                <span class="mc-rgpd-icon">&#128994; Publie avec consentement (RGPD)</span>
            </div>
        </div>`;
    }).join('');
}

function toggleMemberDetail(card) {
    card.classList.toggle('mc-expanded');
}

let _pubSearch;
function onPubSearch(v) {
    clearTimeout(_pubSearch);
    _pubSearch = setTimeout(() => onPubFilter(), 300);
}
function onPubFilter() {
    loadPublicAnnuaire(
        document.getElementById('pub-search')?.value || '',
        document.getElementById('pub-specialty')?.value || '',
        document.getElementById('pub-region')?.value || '',
        document.getElementById('pub-sector')?.value || ''
    );
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

// === HELPERS ===
function esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function formatDate(d) {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString('fr-FR', {day:'numeric',month:'long',year:'numeric'}); }
    catch { return (d || '').substring(0, 10); }
}
