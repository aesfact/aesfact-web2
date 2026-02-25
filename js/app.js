// app.js - MOTOR GLOBAL LIMPIO Y OPTIMIZADO
// ============================================================

const SUPABASE_URL = 'https://vjdwzfvvbybwwymtqoym.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqZHd6ZnZ2Ynlid3d5bXRxb3ltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NzU4NDgsImV4cCI6MjA4NzA1MTg0OH0.mjdhTGIBv4BpMbYKMdeTzmssekDxjKsTmFkkas692C4';

// 1. INICIALIZACIÓN GLOBAL
if (window.supabase) {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('✅ Supabase conectado globalmente');
} else {
    console.error('❌ Librería Supabase no encontrada');
}

// --- INICIO PRINCIPAL ---
document.addEventListener('DOMContentLoaded', async () => {
    setupRealtime();

    const stopRendering = await checkMaintenanceModeGuard();
    if (stopRendering) return; 

    // Renderizar lo público solo si estamos en una página pública (donde existe el navbar)
    if(document.getElementById('sidebar-nav')) {
        await renderPublic(); 
        bindSidebar();
        renderNav();
        bindNewsModal();
    }
    
    // Easter Egg del God Mode
    const adminTrigger = document.getElementById('admin-trigger');
    if (adminTrigger) {
        let clickCount = 0;
        let clickTimer = null;
        adminTrigger.addEventListener('click', () => {
            clickCount++;
            if (clickCount === 1) clickTimer = setTimeout(() => { clickCount = 0; }, 600); 
            if (clickCount === 3) {
                clearTimeout(clickTimer);
                window.location.href = 'admin.html';
            }
        });
    }
    
    // Iniciar Panel de Admin solo si estamos en el index de admin (Dashboard)
    if (document.getElementById('login-panel')) initAdmin();
});

// --- LÓGICA DEL GUARDIA DE MANTENIMIENTO ---
async function checkMaintenanceModeGuard() {
    const path = window.location.pathname;
    // Agregamos sysadmin.html a la lista blanca para que no lo bloquee
    if (path.includes('mantenimiento.html') || path.includes('login.html') || path.includes('admin.html') || path.includes('-admin.html') || path.includes('sysadmin.html')) { 
        return false; 
    }

    try {
        const { data } = await window.supabaseClient.from('site_controls').select('is_enabled').eq('control_name', 'maintenance_mode').maybeSingle();
        if (data && data.is_enabled) {
            const isAdmin = sessionStorage.getItem('aesfact_role'); 
            if (isAdmin) {
                mostrarAvisoAdmin(); 
                return false; 
            } else {
                window.location.href = 'mantenimiento.html';
                return true; 
            }
        }
    } catch (e) { console.error(e); }
    return false; 
}

function mostrarAvisoAdmin() {
    const banner = document.createElement('div');
    banner.style.cssText = "position:fixed; top:0; left:0; width:100%; background:#d32f2f; color:white; text-align:center; padding:5px; z-index:9999; font-size:12px; font-weight:bold;";
    banner.textContent = "⚠ MODO MANTENIMIENTO ACTIVO (Solo tú puedes ver esto)";
    document.body.appendChild(banner);
}

function setupRealtime() {
    if (!window.supabaseClient) return;
    window.supabaseClient.channel('custom-all-channel').on('postgres_changes', { event: '*', schema: 'public' }, () => {
        if(document.getElementById('sidebar-nav')) renderPublic();
    }).subscribe();
}

// --- UTILIDADES DE STORAGE (IMÁGENES) ---
window.uploadImageToStorage = async function(file, folderName) {
    try {
        const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, '_').toLowerCase();
        const filePath = `${folderName}/${Date.now()}_${cleanName}`;
        const { data, error } = await window.supabaseClient.storage.from('media').upload(filePath, file, { cacheControl: '3600', upsert: false });
        if (error) throw error;
        const { data: { publicUrl } } = window.supabaseClient.storage.from('media').getPublicUrl(filePath);
        return publicUrl;
    } catch (e) { console.error(e); alert('Error subiendo imagen'); return null; }
};

window.deleteFileFromStorage = async function(url) {
    if (!url || !url.includes('/storage/v1/object/public/media/')) return null;
    const path = decodeURIComponent(url.split('/storage/v1/object/public/media/')[1]);
    if (path) {
        const { error } = await window.supabaseClient.storage.from('media').remove([path]);
        if (error) console.error('Error borrando archivo:', error.message);
    }
};

// --- MANEJO DE DATOS GLOBALES PARA TODAS LAS VISTAS ---
window.readData = async function() {
    if (!window.supabaseClient) return null;
    const dataStore = { mision:'', vision:'', valores:[], politica:'', objetivos:[], objetivos_calidad:[], news:[], projects:[], events:[], members:[], aesfact:{year:'',image:''}, gallery:[], contacts:[] };
    try {
        const queries = [
            window.supabaseClient.from('config').select('*'),
            window.supabaseClient.from('news').select('*').order('date', { ascending: false }),
            window.supabaseClient.from('projects').select('*').order('date', { ascending: false }),
            window.supabaseClient.from('events').select('*').order('date', { ascending: true }),
            window.supabaseClient.from('members').select('*'),
            window.supabaseClient.from('aesfact').select('*').eq('id', 'aesfact').single()
        ];
        if (sessionStorage.getItem('aesfact_role')) {
            queries.push(window.supabaseClient.from('contacts').select('*').order('date', { ascending: false }));
        }

        const res = await Promise.all(queries);
        const [conf, nw, pr, ev, me, ae] = res;
        const co = res[6]; 

        if(conf.data) conf.data.forEach(i=>{ try{ if(['valores','objetivos','objetivos_calidad'].includes(i.key)) dataStore[i.key]=JSON.parse(i.value); else dataStore[i.key]=i.value; }catch(e){} });
        dataStore.news=nw.data||[]; dataStore.projects=pr.data||[]; dataStore.events=ev.data||[]; dataStore.members=me.data||[];
        if(ae.data) dataStore.aesfact=ae.data;
        if(co && co.data) dataStore.contacts = co.data; 
        if(dataStore.aesfact.image) dataStore.gallery.push(dataStore.aesfact.image);
        dataStore.news.forEach(n=>{if(n.image)dataStore.gallery.push(n.image)});
        return dataStore;
    } catch(e) { return null; }
};

// --- FUNCIONES DE RENDERIZADO PÚBLICO ---
async function renderPublic() {
    const data = await window.readData(); if (!data) return;
    const txt=(i,v)=>{const e=document.getElementById(i);if(e)e.textContent=v||''};
    const lst=(i,a)=>{const e=document.getElementById(i);if(e){e.innerHTML='';(a||[]).forEach(x=>{const l=document.createElement('li');l.textContent=x;e.appendChild(l)})}};
    
    txt('mision',data.mision); txt('vision',data.vision); txt('politica',data.politica);
    lst('valores',data.valores); lst('objetivos',data.objetivos); lst('objetivos-calidad',data.objetivos_calidad);
    txt('aesfact-year',data.aesfact.year);
    
    const ai=document.getElementById('aesfact-image'); 
    if(ai) ai.src=data.aesfact.image||"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1280' height='720'%3E%3Crect fill='%2304293a' width='1280' height='720'/%3E%3Ctext x='50%' y='50%' fill='white' font-size='48' dominant-baseline='middle' text-anchor='middle'%3EAESFACT%3C/text%3E%3C/svg%3E";

    const render=(id,it,fn)=>{const e=document.getElementById(id);if(e){e.innerHTML='';it.forEach(x=>e.appendChild(fn(x)))}};
    render('events-list',data.events,e=>{const d=document.createElement('div');d.className='card';d.innerHTML=`<h4>${escapeHtml(e.title)} <small class="muted">${e.date}</small></h4><p>${escapeHtml(e.desc)}</p>`;return d});
    renderMembersByRole(data.members);
    render('news-list',data.news,n=>{
        const a=document.createElement('article');a.className='card';
        const img=n.image?`<img src="${n.image}" alt="Img">`:`<div style="height:200px;background:#04293a;display:flex;align-items:center;justify-content:center;color:white;">Sin imagen</div>`;
        
        // --- LA CORRECCIÓN ESTÁ AQUÍ ---
        // Limpiamos los saltos de línea del body ANTES de meterlo al onclick
        const safeTitle = escapeHtml(n.title).replace(/'/g, "\\'");
        const safeBody = escapeHtml(n.body).replace(/'/g, "\\'").replace(/\n/g, '\\n'); 
        
        a.innerHTML=`${img}<div class="news-content"><h4>${escapeHtml(n.title)}</h4><small>${n.date || 'Sin fecha'}</small><p>${escapeHtml(n.body.substring(0,120))}...</p><a class="read-more" onclick="openNewsModal('${safeTitle}','${n.date || ''}','${safeBody}','${n.image||''}')">Leer más →</a></div>`; 
        return a;
    });
    initCarousel(data.news.slice(0,5));
    const gl=document.getElementById('gallery-list');if(gl){gl.innerHTML='';data.gallery.forEach(i=>{const d=document.createElement('div');d.className='gallery-item';d.innerHTML=`<img src="${i}" onclick="openPhotoViewer('${i}')">`;gl.appendChild(d)})}

    // =========================================================
    // 🔥 ROADMAP DINÁMICO DE PROYECTOS (VISTA PÚBLICA) RESTAURADO
    // =========================================================
    const pl = document.getElementById('projects-list-container') || document.getElementById('projects-list');
    if (pl && data.projects) {
        window.currentStageFilter = window.currentStageFilter || 'all';
        window.currentStatusFilter = window.currentStatusFilter || 'all';

        if (!document.getElementById('projects-filter-ui')) {
            const filterUI = document.createElement('div');
            filterUI.id = 'projects-filter-ui';
            filterUI.className = 'projects-filters';
            filterUI.innerHTML = `
                <div class="filter-group">
                    <label>🎯 Filtrar por Etapa Anual</label>
                    <select id="filter-stage-select" onchange="window.currentStageFilter=this.value; window.renderFilteredProjects(window.aesfactData.projects);">
                        <option value="all">🌐 Ver Todas las Etapas</option>
                        <option value="etapa_1">🔵 Etapa 1: Proyección Académica</option>
                        <option value="etapa_2">🟢 Etapa 2: Compromiso Ambiental</option>
                        <option value="etapa_3">🟡 Etapa 3: Responsabilidad Social</option>
                        <option value="etapa_4">🔴 Etapa 4: Integración y Cierre</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>🚦 Filtrar por Estado del Proyecto</label>
                    <select id="filter-status-select" onchange="window.currentStatusFilter=this.value; window.renderFilteredProjects(window.aesfactData.projects);">
                        <option value="all">⚡ Todos los Estados</option>
                        <option value="En curso">⏳ Solo En Curso</option>
                        <option value="Terminado">✅ Solo Terminados</option>
                        <option value="Cancelado">❌ Solo Cancelados</option>
                    </select>
                </div>
            `;
            pl.parentNode.insertBefore(filterUI, pl);
        }

        window.aesfactData = window.aesfactData || {};
        window.aesfactData.projects = data.projects;

        window.renderFilteredProjects = (allProjects) => {
            pl.innerHTML = ''; 
            
            const etapas = [
                { id: 'etapa_1', name: '🔵 ETAPA 1: PROYECCIÓN ACADÉMICA Y TECNOLÓGICA', color: '#0d5d9e' },
                { id: 'etapa_2', name: '🟢 ETAPA 2: COMPROMISO AMBIENTAL', color: '#2e7d32' },
                { id: 'etapa_3', name: '🟡 ETAPA 3: RESPONSABILIDAD SOCIAL Y HUMANITARIA', color: '#f57f17' },
                { id: 'etapa_4', name: '🔴 ETAPA 4: INTEGRACIÓN Y CIERRE ANUAL', color: '#c62828' }
            ];

            document.getElementById('filter-stage-select').value = window.currentStageFilter;
            document.getElementById('filter-status-select').value = window.currentStatusFilter;

            let etapasToRender = etapas;
            if (window.currentStageFilter !== 'all') {
                etapasToRender = etapas.filter(e => e.id === window.currentStageFilter);
            }

            if(allProjects.length === 0) {
                pl.innerHTML = '<div class="card"><p class="muted">Aún no hay proyectos registrados en el plan anual.</p></div>';
                return;
            }

            etapasToRender.forEach(etapa => {
                const proyectosEtapa = allProjects.filter(p => (p.etapa || 'etapa_1') === etapa.id);
                
                const total = proyectosEtapa.length;
                const terminados = proyectosEtapa.filter(p => p.status === 'Terminado').length;
                let porcentaje = total === 0 ? 0 : Math.round((terminados / total) * 100);

                let proyectosToShow = proyectosEtapa;
                if (window.currentStatusFilter !== 'all') {
                    proyectosToShow = proyectosEtapa.filter(p => p.status === window.currentStatusFilter);
                }

                const stageContainer = document.createElement('div');
                stageContainer.className = 'roadmap-stage';
                stageContainer.style.borderLeft = `5px solid ${etapa.color}`;

                stageContainer.innerHTML = `
                    <div class="roadmap-header">
                        <h2 class="roadmap-title" style="color: ${etapa.color};">${etapa.name}</h2>
                        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                            <span style="font-weight:bold; color:var(--muted); font-size:0.95rem;">Progreso de la fase</span>
                            <span style="font-weight:bold; color:${etapa.color}; font-size:1.1rem;">${porcentaje}% <span style="font-size:0.85rem; color:var(--muted);">(${terminados}/${total} Proyectos completados)</span></span>
                        </div>
                        <div class="progress-container">
                            <div class="progress-bar" style="width: ${porcentaje}%; background-color: ${etapa.color};">
                                ${porcentaje > 5 ? porcentaje + '%' : ''}
                            </div>
                        </div>
                    </div>
                    <div class="stage-projects-list"></div>
                `;

                const listContainer = stageContainer.querySelector('.stage-projects-list');

                if (proyectosToShow.length === 0) {
                    if (total === 0) {
                        listContainer.innerHTML = `<div class="empty-stage-msg">Fase en planificación. Próximamente se añadirán proyectos a esta etapa.</div>`;
                    } else {
                        listContainer.innerHTML = `<div class="empty-stage-msg">No hay proyectos que coincidan con tus filtros actuales en esta etapa.</div>`;
                    }
                } else {
                    proyectosToShow.forEach((p, idx) => {
                        const c = document.createElement('div'); c.className = 'project-card-wide';
                        let sc = 'curso'; if (p.status === 'Terminado') sc = 'terminado'; if (p.status === 'Cancelado') sc = 'cancelado';
                        
                        let galHtml = '';
                        if (p.gallery && p.gallery.length > 0) {
                            const sid = `ps-${etapa.id}-${idx}`; 
                            let slides = ''; p.gallery.forEach((g, i) => slides += `<div class="project-slide ${i === 0 ? 'active' : ''}" data-i="${i}"><img src="${g}" onclick="openPhotoViewer('${g}')"></div>`);
                            const ctrls = p.gallery.length > 1 ? `<button class="p-nav prev" onclick="moveSlide('${sid}',-1)">&#10094;</button><button class="p-nav next" onclick="moveSlide('${sid}',1)">&#10095;</button><div class="p-counter"><span id="${sid}-c">1</span>/${p.gallery.length}</div>` : '';
                            galHtml = `<div class="project-gallery-wrapper" id="${sid}">${slides}${ctrls}</div>`;
                        }

                        let fbHtml = ''; if ((p.status === 'Terminado' || p.status === 'Cancelado') && p.feedback) fbHtml = `<div class="project-extra"><strong style="color:var(--blue-accent)">${p.status === 'Terminado' ? '🏁 Resultados / Conclusiones' : '⚠️ Motivo de cancelación'}</strong><p style="margin:5px 0 0 0;color:var(--muted)">${escapeHtml(p.feedback)}</p></div>`;
                        
                        let partHtml = '';
                        if (p.status === 'Terminado' && p.participants && p.participants.length > 0) {
                            let cardsHtml = '';
                            p.participants.forEach(part => {
                                let photoUrl = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='50' height='50'%3E%3Crect width='50' height='50' fill='%23ddd'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle'%3E👤%3C/text%3E%3C/svg%3E";
                                let role = "Voluntario";
                                let isExt = false;
                                if (part.type === 'member') {
                                    const realMember = data.members.find(m => m.id === part.id);
                                    if (realMember) {
                                        if (realMember.photo) photoUrl = realMember.photo;
                                        role = realMember.role || part.role;
                                    } else role = part.role;
                                } else { isExt = true; role = "Externo / Voluntario"; }
                                cardsHtml += `<div class="mini-member-card ${isExt ? 'external' : ''}"><img src="${photoUrl}" onclick="openPhotoViewer('${photoUrl}')" alt="${escapeHtml(part.name)}"><div class="mini-member-info"><h5>${escapeHtml(part.name)}</h5><p>${escapeHtml(role)}</p></div></div>`;
                            });
                            partHtml = `<div style="margin-top:25px;"><div style="font-size:0.85rem; font-weight:700; color:var(--blue-light); text-transform:uppercase; letter-spacing:1px; margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:5px;">👥 Equipo Participante</div><div class="project-participants-grid">${cardsHtml}</div></div>`;
                        }

                        c.innerHTML = `<div class="project-header"><div><h3>${escapeHtml(p.title)}</h3><span class="project-date">📅 ${p.date || 'Pendiente'}</span></div><span class="status-badge ${sc}">${p.status}</span></div><div class="project-body">${galHtml}<div class="project-description">${escapeHtml(p.desc).replace(/\n/g, '<br>')}</div>${fbHtml}${partHtml}</div>`;
                        listContainer.appendChild(c);
                    });
                }

                pl.appendChild(stageContainer);
            });
        };

        window.renderFilteredProjects(window.aesfactData.projects);
    }

    // Llenado de anillos en el index
    const ringsExist = document.getElementById('ring-etapa-1');
    if (ringsExist && data.projects) {
        const calculateStage = (stageId) => {
            const projs = data.projects.filter(p => (p.etapa || 'etapa_1') === stageId);
            const total = projs.length;
            const done = projs.filter(p => p.status === 'Terminado').length;
            return total === 0 ? 0 : Math.round((done / total) * 100);
        };
        const setRing = (id, val) => {
            const el = document.getElementById(`ring-etapa-${id}`);
            const text = document.getElementById(`val-etapa-${id}`);
            if(el && text) { el.style.setProperty('--prog', `${(val * 360) / 100}deg`); text.textContent = `${val}%`; }
        };
        setTimeout(() => { setRing('1', calculateStage('etapa_1')); setRing('2', calculateStage('etapa_2')); setRing('3', calculateStage('etapa_3')); setRing('4', calculateStage('etapa_4')); }, 300);
    }
}

// --- LÓGICA DE LOGIN PARA EL DASHBOARD ADMIN (admin.html) ---
function initAdmin() {
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    verificarSesionActiva();

    loginBtn?.addEventListener('click', async () => {
        const email = document.getElementById('admin-email').value.trim();
        const password = document.getElementById('admin-pass').value.trim();
        loginBtn.disabled = true; loginBtn.textContent = 'Verificando...';

        const { data, error } = await window.supabaseClient.auth.signInWithPassword({ email: email, password: password });
        if (error) { alert('Error de acceso: ' + error.message); loginBtn.disabled = false; loginBtn.textContent = 'Entrar'; return; }

        const { data: roleData, error: roleError } = await window.supabaseClient.from('admin_roles').select('role, status, name').eq('id', data.user.id).single();
        if (roleError || !roleData || roleData.status === 'pausado') {
            alert('⛔ Cuenta suspendida o sin rol. Contacta al SysAdmin.');
            await window.supabaseClient.auth.signOut();
            loginBtn.disabled = false; loginBtn.textContent = 'Entrar'; return;
        }

        const { data: permData } = await window.supabaseClient.from('role_permissions').select('allowed_modules').eq('role', roleData.role).single();
        sessionStorage.setItem('aesfact_role', roleData.role);
        sessionStorage.setItem('aesfact_name', roleData.name); 
        if(permData) sessionStorage.setItem('aesfact_permissions', JSON.stringify(permData.allowed_modules));

        iniciarPanelAdmin();
    });

    logoutBtn?.addEventListener('click', async () => {
        await window.supabaseClient.auth.signOut();
        sessionStorage.clear();
        location.reload();
    });
}

async function verificarSesionActiva() {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (session) {
        const { data: roleData } = await window.supabaseClient.from('admin_roles').select('role, status, name').eq('id', session.user.id).single();
        if (roleData && roleData.status !== 'pausado') {
            const { data: permData } = await window.supabaseClient.from('role_permissions').select('allowed_modules').eq('role', roleData.role).single();
            sessionStorage.setItem('aesfact_role', roleData.role);
            sessionStorage.setItem('aesfact_name', roleData.name); 
            if(permData) sessionStorage.setItem('aesfact_permissions', JSON.stringify(permData.allowed_modules));
            iniciarPanelAdmin();
        } else {
            await window.supabaseClient.auth.signOut();
            sessionStorage.clear();
            toggleAdmin(false); 
        }
    }
}

function iniciarPanelAdmin() {
    toggleAdmin(true); 
    aplicarPermisosVisuales(); 
    initMaintenanceControl();
}

function toggleAdmin(show) { 
    if (show) { 
        document.getElementById('login-panel').classList.add('hidden'); 
        document.getElementById('public-admin-title').classList.add('hidden'); 
        document.getElementById('admin-panel').classList.remove('hidden'); 
    }
}

function aplicarPermisosVisuales() {
    const permsRaw = sessionStorage.getItem('aesfact_permissions');
    if (!permsRaw) return;
    const allowed = JSON.parse(permsRaw);

    const moduleMap = {
        'panel_sysadmin':['#btn-sysadmin-link'], 'mantenimiento': ['.switch-container'],
        'nosotros': ['a[href="about-admin.html"]'], 'proyectos': ['a[href="projects-admin.html"]'],
        'eventos': ['a[href="events-admin.html"]'], 'noticias': ['a[href="news-admin.html"]'],
        'contactos': ['a[href="contacts-admin.html"]'], 'finanzas': ['a[href="finanzas.html"]'], 
        'integrantes': ['a[href="members-admin.html"]'], 'aesfact': ['a[href="aesfact-admin.html"]']
    };

    Object.values(moduleMap).forEach(selectors => { selectors.forEach(sel => { const el = document.querySelector(sel); if (el) el.style.display = 'none'; }); });
    allowed.forEach(modName => { if (moduleMap[modName]) { moduleMap[modName].forEach(sel => { const el = document.querySelector(sel); if (el) el.style.display = ''; }); } });

    const titleEl = document.getElementById('public-admin-title');
    if (titleEl && !titleEl.querySelector('.role-badge')) {
        const roleTitle = document.createElement('div');
        roleTitle.className = 'role-badge';
        roleTitle.innerHTML = `<span style="background:var(--blue-light); color:white; padding:5px 12px; border-radius:15px; font-size:0.85rem; font-weight:bold; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">👤 ${sessionStorage.getItem('aesfact_name') || 'Usuario'} | 🛡️ ${sessionStorage.getItem('aesfact_role')}</span>`;
        titleEl.appendChild(roleTitle);
        const dashTitle = document.querySelector('#admin-panel h2');
        if(dashTitle) dashTitle.appendChild(roleTitle);
    }
}

async function initMaintenanceControl() {
    const toggle = document.getElementById('maintenance-toggle');
    const text = document.getElementById('maint-status-text');
    if(!toggle || !text) return;
    try {
        const { data } = await window.supabaseClient.from('site_controls').select('*').eq('control_name', 'maintenance_mode').maybeSingle();
        if (data) { toggle.checked = data.is_enabled; updateMaintText(data.is_enabled); }
    } catch (e) {}

    toggle.addEventListener('change', async (e) => {
        const newState = e.target.checked;
        updateMaintText(newState);
        const { error } = await window.supabaseClient.from('site_controls').update({ is_enabled: newState }).eq('control_name', 'maintenance_mode'); 
        if(error) { alert('Error al guardar'); toggle.checked = !newState; updateMaintText(!newState); }
    });

    function updateMaintText(active) {
        if(active) { text.textContent = "🔴 MANTENIMIENTO ACTIVO"; text.style.color = "#d32f2f"; } 
        else { text.textContent = "🟢 Web Operativa"; text.style.color = "#2e7d32"; }
    }
}

// Funciones Auxiliares UI
window.moveSlide = (sid, dir) => {
    const w = document.getElementById(sid); if(!w) return;
    const s = w.querySelectorAll('.project-slide'); const t = s.length;
    let c = 0; s.forEach((x,i)=>{if(x.classList.contains('active'))c=i;x.classList.remove('active')});
    let n = c+dir; if(n<0)n=t-1; if(n>=t)n=0;
    s[n].classList.add('active'); const cnt=document.getElementById(`${sid}-c`); if(cnt)cnt.textContent=n+1;
};
function escapeHtml(t) { 
    return t ? t.toString().replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])) : ''; }
function bindSidebar() { const b=document.getElementById('sidebar-toggle'),s=document.getElementById('sidebar'),o=document.getElementById('sidebar-overlay'); if(b)b.onclick=()=>{s.classList.add('open');o.classList.add('open');}; if(o)o.onclick=()=>{s.classList.remove('open');o.classList.remove('open');}; }
function renderNav() { const n=document.getElementById('sidebar-nav'); if(!n)return; const l=[{t:'Inicio',h:'index.html'}, {t:'Nosotros',h:'about.html'}, {t:'Proyectos',h:'projects.html'}, {t:'Eventos',h:'events.html'}, {t:'Noticias',h:'news.html'}, {t:'Transparencia', h:'transparencia.html'}, {t:'Galería',h:'gallery.html'}, {t:'Integrantes',h:'members.html'}, {t:'Contacto',h:'contact.html'}]; n.innerHTML=''; l.forEach(i=>{const a=document.createElement('a');a.href=i.h;a.textContent=i.t;if(location.pathname.includes(i.h))a.classList.add('active');n.appendChild(a)}); }
function bindNewsModal(){document.getElementById('news-modal')?.addEventListener('click',e=>{if(e.target===document.getElementById('news-modal'))document.getElementById('news-modal').classList.add('hidden')})}
function openNewsModal(t,d,b,i){ const m=document.getElementById('news-modal'),mb=document.getElementById('news-modal-body');if(!m||!mb)return; mb.innerHTML=`<div style="display:flex;flex-direction:column;gap:16px;">${i?`<img src="${i}" style="width:100%;height:300px;object-fit:cover;border-radius:12px;">`:''}<div><h2 style="color:#013a63;margin:0 0 8px 0;">${escapeHtml(t)}</h2><small style="color:#ff6b6b;font-weight:600;">${d}</small></div><div style="color:#013a63;line-height:1.8;">${escapeHtml(b).replace(/\n/g,'<br>')}</div></div>`; m.classList.remove('hidden'); }
function closeNewsModal(){document.getElementById('news-modal')?.classList.add('hidden')}
function initCarousel(n) { 
    const c = document.getElementById('news-carousel');
    if (!c) return; 
    
    if (!n.length) {
        c.innerHTML = '<div class="card"><p class="muted">Sin noticias.</p></div>';
        return;
    } 
    
    c.innerHTML = ''; 
    const ct = document.createElement('div'); 
    ct.className = 'carousel-slides'; 
    
    n.forEach((x, i) => { 
        const s = document.createElement('div'); 
        s.className = `carousel-slide ${i === 0 ? 'active' : ''}`; 
        s.style.backgroundImage = x.image ? `url('${x.image}')` : 'linear-gradient(135deg,#04293a,#0d5d9e)'; 
        
        // --- LA MAGIA DEL CLIC ---
        s.style.cursor = 'pointer'; // Cambia el mouse a una "manito"
        s.onclick = () => window.location.href = 'news.html'; // Redirección
        
        s.innerHTML = `<div class="carousel-caption"><div class="content"><h3>${escapeHtml(x.title)}</h3><small>${x.date}</small></div></div>`; 
        ct.appendChild(s); 
    }); 
    
    c.appendChild(ct); 
    let idx = 0; 
    setInterval(() => {
        ct.children[idx].classList.remove('active');
        idx = (idx + 1) % ct.children.length;
        ct.children[idx].classList.add('active');
    }, 5000); 
}
function openPhotoViewer(s){const p=document.getElementById('photo-viewer'),i=document.getElementById('photo-viewer-img');if(p&&i){i.src=s;p.classList.add('open')}}
function renderMembersByRole(m){ const c=document.getElementById('members-list');if(!c)return; c.innerHTML=''; const q=[{title:'Presidente y Vicepresidenta',roles:['Presidente','Presidenta','Vicepresidente','Vicepresidenta','Vicepresedenta']},{title:'Logística',roles:['Logistica','Logística']},{title:'Publirelacionista',roles:['Publirelacionista','Relaciones Públicas','Relaciones Publicas']},{title:'Tesorería',roles:['Tesorero','Tesorería','Tesorera']},{title:'Secretaria',roles:['Secretaria','Secretario']},{title:'Vocales',roles:['Vocal','Vocales']},{title:'Colaboradores',roles:['Colaborador','Colaboradores']}]; const cr=(x)=>{ const d=document.createElement('div'); d.className='member-card'; const i=x.photo||"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Crect width='220' height='220' fill='%23ddd'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle'%3E👤%3C/text%3E%3C/svg%3E"; d.innerHTML=`<img src="${i}" onclick="openPhotoViewer('${i}')"><div><h4>${escapeHtml(x.name)}</h4><p class="muted">${escapeHtml(x.role)}</p><p>${escapeHtml(x.email)}</p></div>`; return d; }; const norm=r=>(r||'').trim().toLowerCase(); const u=new Set(); q.forEach(g=>{ const s=document.createElement('section'); s.className='card quadrant'; s.innerHTML=`<h3>${g.title}</h3>`; const d=document.createElement('div'); d.className='quadrant-grid'; const mat=m.filter(x=>g.roles.map(norm).includes(norm(x.role))); mat.forEach(x=>{d.appendChild(cr(x));u.add(x.id)}); if(mat.length){s.appendChild(d); c.appendChild(s);} }); const oth=m.filter(x=>!u.has(x.id)); if(oth.length){ const s=document.createElement('section'); s.className='card quadrant'; s.innerHTML=`<h3>Otros</h3>`; const d=document.createElement('div'); d.className='quadrant-grid'; oth.forEach(x=>d.appendChild(cr(x))); s.appendChild(d); c.appendChild(s); } }