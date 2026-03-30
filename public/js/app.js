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
        return `<div class="member-card">
            <div class="member-avatar">${esc(initials.toUpperCase())}${m.is_mentor ? '<span class="mentor-badge" title="Disponible pour conseiller">&#127891;</span>' : ''}</div>
            <div class="member-info">
                <div class="member-name">${esc(m.first_name)} ${esc(m.last_name)}</div>
                <div class="member-job">${esc(m.job_title || '')}</div>
                <div class="member-company">${esc(m.company || '')}</div>
                <div class="member-tags">
                    ${m.sector ? `<span class="card-tag">${esc(m.sector)}</span>` : ''}
                    ${m.specialty ? `<span class="card-tag card-tag-specialty">${esc(m.specialty)}</span>` : ''}
                    ${m.region ? `<span class="card-tag" style="background:var(--purple);color:#fff">${esc(m.region)}</span>` : ''}
                    ${m.is_board ? '<span class="card-tag card-tag-primary">Bureau</span>' : ''}
                    ${m.is_mentor ? '<span class="card-tag card-tag-mentor">Mentor</span>' : ''}
                </div>
                ${m.linkedin_url ? `<a href="${esc(m.linkedin_url)}" target="_blank" style="font-size:12px;margin-top:4px;display:inline-block">LinkedIn</a>` : ''}
            </div>
        </div>`;
    }).join('');
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
let quizzData = null;
let quizzState = { current: 0, score: 0, answers: [], finished: false };

async function loadQuizz() {
    try {
        const res = await fetch('/data/quizz_march_2026.json');
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
            <button class="btn btn-accent" onclick="startQuizz()">Commencer le Quizz</button>
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
