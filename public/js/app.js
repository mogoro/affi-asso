/**
 * AFFI — SPA Router, Slider, Page Logic
 */
const API = window.location.origin;
const PAGES = ['accueil','identite','agenda','evenements','publications','adhesion','contact','membres'];

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
    if (page === 'publications') loadPublications();
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
