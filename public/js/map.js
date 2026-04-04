/**
 * AFFI Map & Courses
 */
let mapInstance = null;
let _leafletLoaded = false;
function loadLeaflet() {
    return new Promise((resolve) => {
        if (_leafletLoaded || window.L) { _leafletLoaded = true; resolve(); return; }
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => { _leafletLoaded = true; resolve(); };
        document.body.appendChild(script);
    });
}

async function loadMap(mode) {
    await loadLeaflet();
    const container = document.getElementById('map-container');
    try {
        mode = mode || 'member';
        document.querySelectorAll('#ident-cartographie .course-filter').forEach(b => b.classList.remove('active'));
        const btn = document.getElementById('map-mode-' + mode);
        if (btn) btn.classList.add('active');

        const res = await fetch(`${API}/api/map?group=${mode}`);
        const data = await res.json();

        if (!container) return;

        if (mapInstance) { mapInstance.remove(); mapInstance = null; }
        mapInstance = L.map('map-container').setView([47.0, 2.5], 6);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap', maxZoom: 18
        }).addTo(mapInstance);

        const colors = {'Signalisation & ERTMS':'#c8102e','Materiel roulant':'#2563eb','Infrastructure':'#059669',
            'Maintenance':'#d97706','Numerique & IA':'#6c3fa0','Ingenierie & Conseil':'#0a8f8f','Gestion de projet':'#d4a843'};

        if (mode === 'company') {
            data.forEach(c => {
                if (!c.lat || !c.lng) return;
                const size = Math.min(40, 16 + (c.member_count || 1) * 4);
                const icon = L.divIcon({
                    className: 'map-marker-company',
                    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:${size/3}px;font-weight:800;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3)">${c.member_count}</div>`,
                    iconSize: [size, size], iconAnchor: [size/2, size/2]
                });
                const members = (c.members || []).map(m => `<li>${m}</li>`).join('');
                L.marker([c.lat, c.lng], {icon}).addTo(mapInstance)
                    .bindPopup(`<div style="font-family:Inter,sans-serif"><strong style="font-size:16px;color:#004d2e">${c.company}</strong><br><span style="color:#6b7280">${c.member_count} membre(s)</span><ul style="margin:8px 0 0 16px;font-size:13px">${members}</ul></div>`);
            });
            document.getElementById('map-legend').innerHTML = `<p style="color:var(--gray-500);font-size:13px;text-align:center">${data.length} entreprises representees &middot; La taille du cercle indique le nombre de membres</p>`;
        } else {
            data.forEach(m => {
                if (!m.lat || !m.lng) return;
                const color = colors[m.sector] || '#004d2e';
                const icon = L.divIcon({
                    className: 'map-marker-member',
                    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>`,
                    iconSize: [14, 14], iconAnchor: [7, 7]
                });
                const badges = (m.badges || []).map(b => `<span style="background:#d4a843;color:#fff;padding:1px 6px;border-radius:8px;font-size:10px;margin-right:4px">${b}</span>`).join('');
                const skills = (m.skills || []).slice(0, 4).map(s => `<span style="background:#f1f3f5;padding:1px 6px;border-radius:4px;font-size:11px;margin:1px">${s}</span>`).join(' ');
                L.marker([m.lat, m.lng], {icon}).addTo(mapInstance)
                    .bindPopup(`<div style="font-family:Inter,sans-serif;min-width:200px">
                        <strong style="font-size:15px;color:#004d2e">${m.first_name} ${m.last_name}</strong> ${badges}<br>
                        <span style="color:#2563eb;font-weight:600">${m.job_title || ''}</span><br>
                        <span style="color:#6b7280">${m.company || ''} &middot; ${m.location || ''}</span><br>
                        <div style="margin-top:6px">${skills}</div>
                        ${authToken ? `<button onclick="startConversation(${m.id},'${m.first_name} ${m.last_name}')" style="margin-top:8px;background:#004d2e;color:#fff;border:none;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:12px">Contacter</button>` : ''}
                    </div>`);
            });
            const legendHtml = Object.entries(colors).map(([k,v]) => `<span style="display:inline-flex;align-items:center;gap:4px;margin-right:12px"><span style="width:10px;height:10px;border-radius:50%;background:${v};display:inline-block"></span><span style="font-size:12px">${k}</span></span>`).join('');
            document.getElementById('map-legend').innerHTML = `<div style="text-align:center">${legendHtml}</div><p style="color:var(--gray-500);font-size:13px;text-align:center;margin-top:8px">${data.length} membres localises</p>`;
        }

        setTimeout(() => mapInstance.invalidateSize(), 100);
    } catch(e) {
        console.error('loadMap:', e);
        if (container) container.innerHTML = '<p class="empty-msg">Erreur de chargement de la carte</p>';
    }
}

// === COURSES ===
async function loadCourses(category) {
    const el = document.getElementById('courses-list');
    try {
        const p = new URLSearchParams();
        if (category) p.set('category', category);
        const res = await fetch(`${API}/api/courses?${p}`);
        const courses = await res.json();
        if (!el) return;
        if (!courses.length) { el.innerHTML = '<p class="empty-msg">Aucune formation disponible</p>'; return; }

        const levelColors = {'Debutant':'var(--green)','Intermediaire':'var(--orange)','Avance':'var(--accent)','Tous niveaux':'var(--primary)'};
        const catIcons = {'Signalisation':'\ud83d\udea6','Numerique & IA':'\ud83e\udd16','Ingenierie':'\ud83d\udcd0','Management':'\ud83d\udcca'};

        el.innerHTML = courses.map(c => `
            <div class="card course-card">
                <div class="card-img-placeholder" style="height:160px;background:linear-gradient(135deg,${levelColors[c.level]||'var(--primary)'},var(--primary-dark));font-size:48px;color:rgba(255,255,255,.3)">
                    ${catIcons[c.category] || '\ud83c\udf93'}
                </div>
                <div class="card-body">
                    <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">
                        <span class="card-tag" style="background:${levelColors[c.level]||'var(--primary)'};color:#fff">${esc(c.level)}</span>
                        <span class="card-tag">${esc(c.category)}</span>
                        ${c.is_online ? '<span class="card-tag" style="background:#dbeafe;color:#1d4ed8">En ligne</span>' : ''}
                        <span class="card-tag">${esc(c.duration)}</span>
                    </div>
                    <div class="card-title">${esc(c.title)}</div>
                    <div class="card-text">${esc(c.description)}</div>
                    <div style="margin:12px 0;padding:12px;background:var(--gray-50);border-radius:var(--radius);font-size:13px">
                        <strong>Formateur :</strong> ${esc(c.instructor)}<br>
                        <span style="color:var(--gray-500)">${esc(c.instructor_bio||'')}</span>
                    </div>
                    ${c.objectives ? `<div style="font-size:13px;margin-bottom:12px"><strong>Objectifs :</strong><br><span style="color:var(--gray-600);white-space:pre-line">${esc(c.objectives)}</span></div>` : ''}
                    <div class="course-footer">
                        <div>
                            <span class="course-price">${c.price > 0 ? c.price + ' EUR' : 'Gratuit'}</span>
                            ${c.next_date ? `<span style="font-size:13px;color:var(--gray-500);margin-left:12px">${formatDate(c.next_date)}</span>` : ''}
                            ${c.location ? `<span style="font-size:13px;color:var(--gray-500);margin-left:8px">\ud83d\udccd ${esc(c.location)}</span>` : ''}
                        </div>
                        <button class="btn btn-accent" style="font-size:13px;padding:8px 20px" onclick="alert('Inscription envoyee !')">S'inscrire</button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch(e) {
        console.error('loadCourses:', e);
        if (el) el.innerHTML = '<p class="empty-msg">Erreur de chargement des formations</p>';
    }
}

function filterCourses(btn, cat) {
    document.querySelectorAll('.course-filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadCourses(cat);
}

// === FULL-SCREEN MAP ===
function openFullMap() {
    const html = `<div class="adm-modal-bg" id="fullmap-modal">
        <div style="width:95vw;height:90vh;background:var(--white);border-radius:12px;overflow:hidden;position:relative">
            <button onclick="closeModal('fullmap-modal');setTimeout(()=>{if(mapInstance)mapInstance.invalidateSize()},200)" style="position:absolute;top:12px;right:12px;z-index:1000;background:var(--white);border:1px solid var(--gray-300);border-radius:50%;width:36px;height:36px;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:var(--shadow)">&times;</button>
            <div id="fullmap-container" style="width:100%;height:100%"></div>
        </div>
    </div>`;
    openModal(html);
    // Copy map to fullscreen
    setTimeout(() => {
        const container = document.getElementById('fullmap-container');
        if (!container || !window.L) return;
        const fullMap = L.map('fullmap-container').setView([47.0, 2.5], 6);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap', maxZoom: 18
        }).addTo(fullMap);
        // Copy markers from existing map
        if (mapInstance) {
            mapInstance.eachLayer(layer => {
                if (layer instanceof L.Marker) {
                    const ll = layer.getLatLng();
                    const popup = layer.getPopup();
                    const marker = L.marker(ll, {icon: layer.options.icon}).addTo(fullMap);
                    if (popup) marker.bindPopup(popup.getContent());
                }
            });
        }
        setTimeout(() => fullMap.invalidateSize(), 100);
    }, 200);
}
