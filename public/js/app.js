/**
 * AFFI — SPA Router & Page Logic
 */
const API = window.location.origin;
const PAGES = ['accueil','identite','agenda','evenements','publications','adhesion','contact','membres'];

// === ROUTER ===
function navigate(page) {
    if (!PAGES.includes(page)) page = 'accueil';
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const el = document.getElementById('page-' + page);
    if (el) el.classList.add('active');
    document.querySelectorAll('.nav-link').forEach(l => {
        l.classList.toggle('active', l.dataset.page === page);
    });
    window.scrollTo(0, 0);
    history.pushState(null, '', '#' + page);
    if (page === 'agenda' || page === 'evenements') loadEvents();
    if (page === 'publications') loadPublications();
    if (page === 'accueil') loadHome();
}

window.addEventListener('hashchange', () => navigate(location.hash.slice(1) || 'accueil'));
document.addEventListener('DOMContentLoaded', () => {
    navigate(location.hash.slice(1) || 'accueil');
    loadHome();
});

// === HOME ===
async function loadHome() {
    try {
        const [newsRes, eventsRes] = await Promise.all([
            fetch(`${API}/api/news?limit=3`),
            fetch(`${API}/api/events?upcoming=1&limit=3`)
        ]);
        const news = await newsRes.json();
        const events = await eventsRes.json();
        renderHomeNews(news);
        renderHomeEvents(events);
    } catch (e) { console.warn('Home load:', e); }
}

function renderHomeNews(items) {
    const el = document.getElementById('home-news');
    if (!el || !items.length) return;
    el.innerHTML = items.map(n => `
        <div class="card">
            <div class="card-img-placeholder">&#128240;</div>
            <div class="card-body">
                <div class="card-date">${formatDate(n.published_at)}</div>
                <div class="card-title">${esc(n.title)}</div>
                <div class="card-text">${esc(n.excerpt || (n.content || '').substring(0, 150))}</div>
            </div>
        </div>
    `).join('');
}

function renderHomeEvents(items) {
    const el = document.getElementById('home-events');
    if (!el || !items.length) return;
    el.innerHTML = items.map(e => `
        <div class="card">
            <div class="card-img-placeholder">&#128197;</div>
            <div class="card-body">
                <div class="card-date">${formatDate(e.start_date)}</div>
                <div class="card-title">${esc(e.title)}</div>
                <div class="card-text">${esc(e.description || '').substring(0, 120)}</div>
                ${e.event_type ? `<span class="card-tag">${esc(e.event_type)}</span>` : ''}
                ${e.location ? `<span class="card-tag">${esc(e.location)}</span>` : ''}
            </div>
        </div>
    `).join('');
}

// === EVENTS ===
async function loadEvents() {
    try {
        const res = await fetch(`${API}/api/events?limit=50`);
        const events = await res.json();
        const el = document.getElementById('events-list');
        if (!el) return;
        if (!events.length) { el.innerHTML = '<p class="text-center" style="color:var(--gray-400)">Aucun evenement programme</p>'; return; }
        el.innerHTML = events.map(e => `
            <div class="card">
                <div class="card-img-placeholder">&#128197;</div>
                <div class="card-body">
                    <div class="card-date">${formatDate(e.start_date)}${e.end_date ? ' - ' + formatDate(e.end_date) : ''}</div>
                    <div class="card-title">${esc(e.title)}</div>
                    <div class="card-text">${esc(e.description || '')}</div>
                    ${e.event_type ? `<span class="card-tag">${esc(e.event_type)}</span>` : ''}
                    ${e.location ? `<span class="card-tag">&#128205; ${esc(e.location)}</span>` : ''}
                    ${e.is_members_only ? '<span class="card-tag" style="background:#fef2f2;color:#b91c1c">Membres uniquement</span>' : ''}
                </div>
            </div>
        `).join('');
    } catch (e) { console.warn('Events:', e); }
}

// === PUBLICATIONS ===
async function loadPublications() {
    try {
        const res = await fetch(`${API}/api/publications?limit=50`);
        const pubs = await res.json();
        const el = document.getElementById('publications-list');
        if (!el) return;
        if (!pubs.length) { el.innerHTML = '<p class="text-center" style="color:var(--gray-400)">Aucune publication</p>'; return; }
        el.innerHTML = pubs.map(p => `
            <div class="card">
                <div class="card-body">
                    <div class="card-date">${formatDate(p.published_at)} ${p.category ? '&middot; ' + esc(p.category) : ''}</div>
                    <div class="card-title">${esc(p.title)}</div>
                    <div class="card-text">${esc(p.excerpt || (p.content || '').substring(0, 200))}</div>
                    ${p.file_url ? `<a href="${esc(p.file_url)}" target="_blank" class="card-link">Telecharger le document</a>` : ''}
                </div>
            </div>
        `).join('');
    } catch (e) { console.warn('Publications:', e); }
}

// === CONTACT FORM ===
async function submitContact(evt) {
    evt.preventDefault();
    const form = evt.target;
    const data = {
        name: form.name.value, email: form.email.value,
        subject: form.subject.value, message: form.message.value
    };
    try {
        const res = await fetch(`${API}/api/contact`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        if (res.ok) {
            document.getElementById('contact-success').style.display = 'block';
            form.reset();
        }
    } catch (e) { alert('Erreur: ' + e.message); }
}

// === HELPERS ===
function esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function formatDate(d) {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString('fr-FR', {day:'numeric',month:'long',year:'numeric'}); }
    catch { return d.substring(0, 10); }
}
