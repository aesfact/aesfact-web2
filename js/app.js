// app.js - VERSIÓN DEFINITIVA (ROLES, MENSAJES Y LIMPIEZA)
// ============================================================

const SUPABASE_URL = 'https://vjdwzfvvbybwwymtqoym.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqZHd6ZnZ2Ynlid3d5bXRxb3ltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NzU4NDgsImV4cCI6MjA4NzA1MTg0OH0.mjdhTGIBv4BpMbYKMdeTzmssekDxjKsTmFkkas692C4';

let supabase = null;
let currentEditId = null;
let tempParticipants = [];
let tempGallery = [];

// --- INICIO PRINCIPAL ---
// --- INICIO PRINCIPAL ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Iniciando AESFACT App...');
    
    await initSupabase();

    const stopRendering = await checkMaintenanceModeGuard();
    if (stopRendering) return; 

    await renderPublic(); 
    bindSidebar();
    renderNav();
    bindContact();
    bindNewsModal();
    
    // 🔥 EL EASTER EGG PRO (3 CLICS RÁPIDOS) 🔥
    const adminTrigger = document.getElementById('admin-trigger');
    if (adminTrigger) {
        let clickCount = 0;
        let clickTimer = null;
        
        adminTrigger.addEventListener('click', () => {
            clickCount++; // Sumamos un clic
            
            // Si es el primer clic, iniciamos un reloj de medio segundo
            if (clickCount === 1) {
                clickTimer = setTimeout(() => { 
                    clickCount = 0; // Si pasa medio segundo y no completó los 3 clics, se resetea
                }, 600); 
            }
            
            // Si logra hacer 3 clics rápidos antes de que acabe el tiempo... ¡Bum!
            if (clickCount === 3) {
                clearTimeout(clickTimer);
                window.location.href = 'admin.html';
            }
        });
    }
    
    if (document.body.classList.contains('admin')) initAdmin();
});

async function initSupabase() {
    if (window.supabase) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('✅ Supabase conectado');
        setupRealtime();
    } else console.error('❌ Librería Supabase no encontrada');
}

// --- LÓGICA DEL GUARDIA ---
async function checkMaintenanceModeGuard() {
    const path = window.location.pathname;

    if (path.includes('mantenimiento.html') || 
        path.includes('login.html') || 
        path.includes('admin.html')) { 
        return false; 
    }

    try {
        const { data, error } = await supabase
            .from('site_controls')
            .select('is_enabled')
            .eq('control_name', 'maintenance_mode')
            .maybeSingle();

        const isMaintenanceOn = data ? data.is_enabled : false;

        if (isMaintenanceOn) {
            const isAdmin = sessionStorage.getItem('aesfact_role'); 
            
            if (isAdmin) {
                console.log('🛡️ Mantenimiento ACTIVO (Admin Acceso).');
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
    if (!supabase) return;
    supabase.channel('custom-all-channel').on('postgres_changes', { event: '*', schema: 'public' }, () => {
        renderPublic();
        if (document.body.classList.contains('admin') && !document.getElementById('admin-panel').classList.contains('hidden')) {
            loadAdminLists();
        }
    }).subscribe();
}

// --- UTILIDADES DE STORAGE ---
async function uploadImageToStorage(file, folderName) {
    try {
        const cleanName = file.name.replace(/[^a-zA-Z0-9.]/g, '_').toLowerCase();
        const filePath = `${folderName}/${Date.now()}_${cleanName}`;
        
        const { data, error } = await supabase.storage.from('media').upload(filePath, file, { cacheControl: '3600', upsert: false });
        if (error) throw error;
        
        const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(filePath);
        return publicUrl;
    } catch (e) { console.error(e); alert('Error subiendo imagen'); return null; }
}

function getFilePathFromUrl(url) {
    if (!url || !url.includes('/storage/v1/object/public/media/')) return null;
    const path = url.split('/storage/v1/object/public/media/')[1];
    return decodeURIComponent(path);
}

async function deleteFileFromStorage(url) {
    const path = getFilePathFromUrl(url);
    if (path) {
        const { error } = await supabase.storage.from('media').remove([path]);
        if (error) console.error('Error borrando archivo de storage:', error.message);
        else console.log('✅ Archivo eliminado correctamente:', path);
    }
}

// --- MANEJO DE DATOS PÚBLICOS ---
async function readData() {
    if (!supabase) return null;
    const dataStore = { mision:'', vision:'', valores:[], politica:'', objetivos:[], objetivos_calidad:[], news:[], projects:[], events:[], members:[], aesfact:{year:'',image:''}, gallery:[], contacts:[] };
    try {
        const queries = [
            supabase.from('config').select('*'),
            supabase.from('news').select('*').order('date', { ascending: false }),
            supabase.from('projects').select('*').order('date', { ascending: false }),
            supabase.from('events').select('*').order('date', { ascending: true }),
            supabase.from('members').select('*'),
            supabase.from('aesfact').select('*').eq('id', 'aesfact').single()
        ];
        
        // Si es Admin, también traemos los mensajes
        if (sessionStorage.getItem('aesfact_role')) {
            queries.push(supabase.from('contacts').select('*').order('date', { ascending: false }));
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
}

async function renderPublic() {
    const data = await readData(); if (!data) return;
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
        a.innerHTML=`${img}<div class="news-content"><h4>${escapeHtml(n.title)}</h4><small>${n.date}</small><p>${escapeHtml(n.body.substring(0,120))}...</p><a class="read-more" onclick="openNewsModal('${escapeHtml(n.title)}','${n.date}','${escapeHtml(n.body)}','${n.image||''}')">Leer más →</a></div>`; return a;
    });
    initCarousel(data.news.slice(0,5));
    const gl=document.getElementById('gallery-list');if(gl){gl.innerHTML='';data.gallery.forEach(i=>{const d=document.createElement('div');d.className='gallery-item';d.innerHTML=`<img src="${i}" onclick="openPhotoViewer('${i}')">`;gl.appendChild(d)})}

    // PROYECTOS
    const pl=document.getElementById('projects-list-container')||document.getElementById('projects-list');
    if(pl){
        pl.innerHTML='';
        if(data.projects.length===0) pl.innerHTML='<div class="card"><p class="muted">No hay proyectos.</p></div>';
        data.projects.forEach((p,idx)=>{
            const c=document.createElement('div'); c.className='project-card-wide';
            let sc='curso'; if(p.status==='Terminado')sc='terminado'; if(p.status==='Cancelado')sc='cancelado';
            
            let galHtml='';
            if(p.gallery&&p.gallery.length>0){
                const sid=`ps-${idx}`;
                let slides=''; p.gallery.forEach((g,i)=>slides+=`<div class="project-slide ${i===0?'active':''}" data-i="${i}"><img src="${g}" onclick="openPhotoViewer('${g}')"></div>`);
                const ctrls=p.gallery.length>1?`<button class="p-nav prev" onclick="moveSlide('${sid}',-1)">&#10094;</button><button class="p-nav next" onclick="moveSlide('${sid}',1)">&#10095;</button><div class="p-counter"><span id="${sid}-c">1</span>/${p.gallery.length}</div>`:'';
                galHtml=`<div class="project-gallery-wrapper" id="${sid}">${slides}${ctrls}</div>`;
            }

            let fbHtml=''; if((p.status==='Terminado'||p.status==='Cancelado')&&p.feedback) fbHtml=`<div class="project-extra"><strong style="color:var(--blue-accent)">${p.status==='Terminado'?'🏁 Resultados / Conclusiones':'⚠️ Motivo de cancelación'}</strong><p style="margin:5px 0 0 0;color:var(--muted)">${escapeHtml(p.feedback)}</p></div>`;
            
            let partHtml='';
            if(p.status==='Terminado'&&p.participants&&p.participants.length>0){
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

            c.innerHTML=`<div class="project-header"><div><h3>${escapeHtml(p.title)}</h3><span class="project-date">📅 ${p.date||'Pendiente'}</span></div><span class="status-badge ${sc}">${p.status}</span></div><div class="project-body">${galHtml}<div class="project-description">${escapeHtml(p.desc).replace(/\n/g,'<br>')}</div>${fbHtml}${partHtml}</div>`;
            pl.appendChild(c);
        });
    }
}

window.moveSlide = (sid, dir) => {
    const w = document.getElementById(sid); if(!w) return;
    const s = w.querySelectorAll('.project-slide'); const t = s.length;
    let c = 0; s.forEach((x,i)=>{if(x.classList.contains('active'))c=i;x.classList.remove('active')});
    let n = c+dir; if(n<0)n=t-1; if(n>=t)n=0;
    s[n].classList.add('active'); const cnt=document.getElementById(`${sid}-c`); if(cnt)cnt.textContent=n+1;
};

// ============================================================
// --- ADMINISTRACIÓN SEGURA (CON PERMISOS DINÁMICOS) ---
// ============================================================

function initAdmin() {
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');

    verificarSesionActiva();

    loginBtn?.addEventListener('click', async () => {
        const email = document.getElementById('admin-email').value.trim();
        const password = document.getElementById('admin-pass').value.trim();
        
        loginBtn.disabled = true;
        loginBtn.textContent = 'Verificando...';

        const { data, error } = await supabase.auth.signInWithPassword({
            email: email, password: password,
        });

        if (error) {
            console.error("🚨 Error real de Supabase:", error.message); 
            alert('Error de acceso: ' + error.message);
            loginBtn.disabled = false; loginBtn.textContent = 'Entrar'; return;
        }

        // AHORA PEDIMOS TAMBIÉN EL 'name'
        const { data: roleData, error: roleError } = await supabase
            .from('admin_roles')
            .select('role, status, name') 
            .eq('id', data.user.id).single();

        if (roleError || !roleData) {
            alert('No tienes un Rol asignado. Contacta al SysAdmin.');
            await supabase.auth.signOut();
            loginBtn.disabled = false; loginBtn.textContent = 'Entrar'; return;
        }

        if (roleData.status === 'pausado') {
            alert('⛔ Tu cuenta ha sido temporalmente suspendida por el SysAdmin.');
            await supabase.auth.signOut();
            loginBtn.disabled = false; loginBtn.textContent = 'Entrar'; return;
        }

        const { data: permData } = await supabase.from('role_permissions').select('allowed_modules').eq('role', roleData.role).single();

        // GUARDAMOS EL NOMBRE TAMBIÉN
        sessionStorage.setItem('aesfact_role', roleData.role);
        sessionStorage.setItem('aesfact_name', roleData.name); 
        if(permData) sessionStorage.setItem('aesfact_permissions', JSON.stringify(permData.allowed_modules));

        iniciarPanelAdmin();
    });

    logoutBtn?.addEventListener('click', async () => {
        await supabase.auth.signOut();
        sessionStorage.removeItem('aesfact_role');
        sessionStorage.removeItem('aesfact_name');
        sessionStorage.removeItem('aesfact_permissions');
        location.reload();
    });

    setupAdminListeners(); 
}

async function verificarSesionActiva() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        const { data: roleData } = await supabase.from('admin_roles').select('role, status, name').eq('id', session.user.id).single();
        
        if (roleData && roleData.status !== 'pausado') {
            const { data: permData } = await supabase.from('role_permissions').select('allowed_modules').eq('role', roleData.role).single();
            sessionStorage.setItem('aesfact_role', roleData.role);
            sessionStorage.setItem('aesfact_name', roleData.name); // GUARDAMOS EL NOMBRE
            if(permData) sessionStorage.setItem('aesfact_permissions', JSON.stringify(permData.allowed_modules));
            iniciarPanelAdmin();
        } else {
            if (roleData && roleData.status === 'pausado') {
                alert('⛔ Tu sesión ha caducado porque tu cuenta fue suspendida.');
            }
            await supabase.auth.signOut();
            sessionStorage.removeItem('aesfact_role');
            sessionStorage.removeItem('aesfact_name');
            sessionStorage.removeItem('aesfact_permissions');
            toggleAdmin(false); 
        }
    }
}

function iniciarPanelAdmin() {
    toggleAdmin(true); 
    aplicarPermisosVisuales(); 
    loadAdminData(); 
    loadAdminLists();
    initMaintenanceControl();
}

function toggleAdmin(show) { // <-- AQUÍ ESTÁ, A SALVO
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
        'panel_sysadmin':['#btn-sysadmin-link'],
        'mantenimiento': ['.switch-container'],
        'nosotros':      ['a[href="#sec-about"]', '#sec-about'],
        'proyectos':     ['a[href="#sec-projects"]', '#sec-projects'],
        'eventos':       ['a[href="#sec-events"]', '#sec-events'],
        'noticias':      ['a[href="#sec-news"]', '#sec-news'],
        'contactos':     ['a[href="#sec-contacts"]', '#sec-contacts'], // EL DE MENSAJES
        'finanzas':      ['a[href="finanzas.html"]'], 
        'integrantes':   ['a[href="#sec-members"]', '#sec-members'],
        'aesfact':       ['a[href="#sec-aesfact"]', '#sec-aesfact']
    };

    Object.values(moduleMap).forEach(selectors => {
        selectors.forEach(sel => {
            const el = document.querySelector(sel);
            if (el) el.style.display = 'none';
        });
    });

    allowed.forEach(modName => {
        if (moduleMap[modName]) {
            moduleMap[modName].forEach(sel => {
                const el = document.querySelector(sel);
                if (el) el.style.display = ''; 
            });
        }
    });

    const titleEl = document.getElementById('public-admin-title');
    if (titleEl && !titleEl.querySelector('.role-badge')) {
        const roleTitle = document.createElement('div');
        roleTitle.className = 'role-badge';
        
        // AHORA MUESTRA EL NOMBRE Y EL ROL
        const userName = sessionStorage.getItem('aesfact_name') || 'Usuario';
        const userRole = sessionStorage.getItem('aesfact_role');
        
        roleTitle.innerHTML = `<span style="background:var(--blue-light); color:white; padding:5px 12px; border-radius:15px; font-size:0.85rem; font-weight:bold; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">👤 ${userName} | 🛡️ ${userRole}</span>`;
        
        titleEl.appendChild(roleTitle);
        const dashTitle = document.querySelector('#admin-panel h2');
        if(dashTitle) dashTitle.appendChild(roleTitle);
    }
}

// --- LÓGICA DEL SWITCH DE MANTENIMIENTO ---
async function initMaintenanceControl() {
    const toggle = document.getElementById('maintenance-toggle');
    const text = document.getElementById('maint-status-text');
    if(!toggle || !text) return;

    try {
        const { data, error } = await supabase.from('site_controls').select('*').eq('control_name', 'maintenance_mode').maybeSingle();
        if (!error) {
            const isMaintained = (data && data.is_enabled === true);
            toggle.checked = isMaintained;
            updateMaintText(isMaintained);
        }
    } catch (e) { console.error(e); }

    toggle.addEventListener('change', async (e) => {
        const newState = e.target.checked;
        updateMaintText(newState);
        const { error } = await supabase.from('site_controls').update({ is_enabled: newState }).eq('control_name', 'maintenance_mode'); 
        if(error) {
            alert('Error al guardar: ' + error.message);
            toggle.checked = !newState;
            updateMaintText(!newState);
        }
    });

    function updateMaintText(active) {
        if(active) {
            text.textContent = "🔴 MANTENIMIENTO ACTIVO";
            text.style.color = "#d32f2f";
        } else {
            text.textContent = "🟢 Web Operativa";
            text.style.color = "#2e7d32";
        }
    }
}

// --- FUNCIONES DE ADMINISTRACIÓN Y LISTAS ---
async function loadAdminData() {
    const d = await readData(); if(!d)return;
    const set=(i,v)=>{const e=document.getElementById(i);if(e)e.value=v||''};
    set('edit-mision',d.mision); set('edit-vision',d.vision); set('edit-valores',d.valores.join('\n'));
    set('edit-politica',d.politica); set('edit-objetivos',d.objetivos.join('\n')); set('edit-objetivos-calidad',d.objetivos_calidad.join('\n'));
    set('aesfact-year',d.aesfact.year); setupProjectManager(d.members);
}

function setupAdminListeners() {
    document.getElementById('save-about')?.addEventListener('click',async()=>{
        const v=id=>document.getElementById(id)?.value||''; const a=id=>v(id).split('\n').filter(Boolean);
        const up=[{key:'mision',value:v('edit-mision')},{key:'vision',value:v('edit-vision')},{key:'politica',value:v('edit-politica')},{key:'valores',value:JSON.stringify(a('edit-valores'))},{key:'objetivos',value:JSON.stringify(a('edit-objetivos'))},{key:'objetivos_calidad',value:JSON.stringify(a('edit-objetivos-calidad'))}];
        for(let u of up) await supabase.from('config').upsert({key:u.key,value:u.value}); alert('Guardado');
    });
    document.getElementById('save-aesfact')?.addEventListener('click',async()=>{
        const y=document.getElementById('aesfact-year').value; let i=document.getElementById('aesfact-image-url').value;
        const f=document.getElementById('aesfact-image-file'); if(f.files[0]) i=await uploadImageToStorage(f.files[0],'aesfact')||i;
        await supabase.from('aesfact').upsert({id:'aesfact',year:y,image:i}); alert('Guardado');
    });
    setupCrud('news','news',['title','body','date','image'],'noticias');
    setupCrud('evt','events',['title','desc','date'],'eventos');
    setupCrud('mem','members',['name','role','email','phone','photo'],'integrantes');
}

// --- GESTIÓN DE PROYECTOS (ADMIN) ---
function setupProjectManager(allMembers) {
    const status=document.getElementById('proj-status');
    const search=document.getElementById('proj-member-search');
    const res=document.getElementById('proj-member-results');
    
    status?.addEventListener('change',()=>{
        const v=status.value;
        document.getElementById('proj-feedback-section').classList.add('hidden');
        document.getElementById('proj-participants-section').classList.add('hidden');
        if(v==='Terminado'){document.getElementById('proj-feedback-section').classList.remove('hidden');document.getElementById('proj-participants-section').classList.remove('hidden');}
        else if(v==='Cancelado')document.getElementById('proj-feedback-section').classList.remove('hidden');
    });

    search?.addEventListener('input',(e)=>{
        const t=e.target.value.toLowerCase(); if(t.length<2){res.style.display='none';return}
        const m=allMembers.filter(x=>x.name.toLowerCase().includes(t));
        res.innerHTML='';
        if(m.length){
            res.style.display='block';
            m.forEach(x=>{
                const d=document.createElement('div'); d.style.padding='8px'; d.style.cursor='pointer'; d.style.borderBottom='1px solid #eee'; d.textContent=`${x.name} (${x.role})`;
                d.onmouseover=()=>d.style.background='#f0f0f0'; d.onmouseout=()=>d.style.background='white';
                d.onclick=()=>{ addParticipant({id:x.id,name:x.name,role:x.role,type:'member'}); search.value=''; res.style.display='none'; };
                res.appendChild(d);
            });
        } else res.style.display='none';
    });

    const addExtBtn = document.getElementById('proj-add-external');
    if(addExtBtn) {
        addExtBtn.onclick=()=>{
            const n=document.getElementById('proj-external-name').value.trim();
            if(n){addParticipant({id:Date.now(),name:n,role:'Externo',type:'external'});document.getElementById('proj-external-name').value='';}
        };
    }

    window.addParticipant=(p)=>{if(tempParticipants.some(x=>x.name===p.name))return; tempParticipants.push(p); renderParts();};
    window.removeParticipant=(n)=>{tempParticipants=tempParticipants.filter(p=>p.name!==n); renderParts();};
    
    function renderParts(){
        const l=document.getElementById('proj-participants-list'); if(!l) return; l.innerHTML='';
        tempParticipants.forEach(p=>{
            const s=document.createElement('span'); s.style.cssText=`padding:5px 10px;border-radius:15px;font-size:0.85rem;display:flex;align-items:center;gap:5px;${p.type==='member'?'background:#e3f2fd;color:#0d47a1':'background:#eee;color:#444'}`;
            s.innerHTML=`${p.name} <small>(${p.role||''})</small> <span onclick="removeParticipant('${p.name}')" style="cursor:pointer;font-weight:bold">&times;</span>`;
            l.appendChild(s);
        });
    }

    const saveProjBtn = document.getElementById('add-proj');
    if(saveProjBtn) {
        saveProjBtn.onclick=async()=>{
            const btn=document.getElementById('add-proj'); btn.disabled=true; btn.textContent='Guardando...';
            const t=document.getElementById('proj-title').value; if(!t){alert('Falta título'); btn.disabled=false; return;}
            
            const f=document.getElementById('proj-gallery-files');
            if(f.files.length){ for(let file of f.files){const u=await uploadImageToStorage(file,'proyectos'); if(u)tempGallery.push(u);} }

            const pl={title:t, desc:document.getElementById('proj-desc').value, date:document.getElementById('proj-date').value, status:status.value, feedback:document.getElementById('proj-feedback').value, participants:tempParticipants, gallery:tempGallery};
            
            let err=null;
            if(currentEditId) { const r=await supabase.from('projects').update(pl).eq('id',currentEditId); err=r.error; }
            else { const r=await supabase.from('projects').insert([{...pl, id:Date.now().toString()}]); err=r.error; }

            if(err) alert('Error guardando'); else { alert('Guardado'); resetProj(); loadAdminLists(); }
            btn.disabled=false; btn.textContent='Guardar Proyecto';
        };
    }
    const cancelProjBtn = document.getElementById('cancel-proj');
    if(cancelProjBtn) cancelProjBtn.onclick=resetProj;
}

function resetProj(){
    currentEditId=null;
    ['proj-title','proj-desc','proj-date','proj-feedback','proj-gallery-files','proj-member-search','proj-external-name'].forEach(id=>{const el = document.getElementById(id); if(el) el.value=''});
    const statusEl = document.getElementById('proj-status'); if(statusEl) statusEl.value='En curso';
    ['proj-feedback-section','proj-participants-section','cancel-proj'].forEach(id=>{const el = document.getElementById(id); if(el) el.classList.add('hidden')});
    const addProjEl = document.getElementById('add-proj'); if(addProjEl) addProjEl.textContent='Guardar Proyecto';
    const gpEl = document.getElementById('proj-gallery-preview'); if(gpEl) gpEl.innerHTML=''; 
    tempParticipants=[]; tempGallery=[]; 
    const plEl = document.getElementById('proj-participants-list'); if(plEl) plEl.innerHTML='';
}

function loadProjectToEdit(i){
    currentEditId=i.id;
    document.getElementById('proj-title').value=i.title; document.getElementById('proj-desc').value=i.desc||'';
    document.getElementById('proj-date').value=i.date||''; 
    const st=document.getElementById('proj-status'); st.value=i.status||'En curso'; st.dispatchEvent(new Event('change'));
    document.getElementById('proj-feedback').value=i.feedback||'';
    tempParticipants=i.participants||[];
    const l=document.getElementById('proj-participants-list'); l.innerHTML='';
    tempParticipants.forEach(p=>{
        const s=document.createElement('span'); s.style.cssText=`padding:5px 10px;border-radius:15px;font-size:0.85rem;display:flex;align-items:center;gap:5px;${p.type==='member'?'background:#e3f2fd;color:#0d47a1':'background:#eee;color:#444'}`;
        s.innerHTML=`${p.name} <small>(${p.role||''})</small> <span onclick="removeParticipant('${p.name}')" style="cursor:pointer;font-weight:bold">&times;</span>`;
        l.appendChild(s);
    });
    tempGallery=i.gallery||[]; renderAdminGalleryPreview();
    document.getElementById('add-proj').textContent='Actualizar Proyecto'; document.getElementById('cancel-proj').classList.remove('hidden');
    document.getElementById('sec-projects').scrollIntoView({behavior:'smooth'});
}

function renderAdminGalleryPreview(){
    const p=document.getElementById('proj-gallery-preview'); if(!p)return; p.innerHTML='';
    tempGallery.forEach((u,i)=>{
        const w=document.createElement('div'); w.style.cssText='position:relative;width:80px;height:80px;';
        w.innerHTML=`<img src="${u}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;"><button style="position:absolute;top:-5px;right:-5px;background:red;color:white;border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;">✕</button>`;
        w.querySelector('button').onclick=async(e)=>{
            e.preventDefault();
            if(confirm('¿Borrar esta imagen del servidor permanentemente?')) {
                await deleteFileFromStorage(tempGallery[i]);
                tempGallery.splice(i,1);
                renderAdminGalleryPreview();
            }
        };
        p.appendChild(w);
    });
}

function setupCrud(pf,tb,fds,fld){
    const add=document.getElementById(`add-${pf}`), can=document.getElementById(`cancel-${pf}`); if(!add)return;
    add.onclick=async()=>{
        const pl={}; add.disabled=true; add.textContent='...';
        for(let f of fds){
            const fi=document.getElementById(`${pf}-${f}-file`);
            if(fi?.files[0]) pl[f]=await uploadImageToStorage(fi.files[0],fld);
            else if(document.getElementById(`${pf}-${f}-url`)) pl[f]=document.getElementById(`${pf}-${f}-url`).value;
            else if(document.getElementById(`${pf}-${f}`)) pl[f]=document.getElementById(`${pf}-${f}`).value;
        }
        if((tb==='news'||tb==='members')&&(!pl.title&&!pl.name)){add.disabled=false;return alert('Datos faltantes')}
        const r=currentEditId?await supabase.from(tb).update(pl).eq('id',currentEditId):await supabase.from(tb).insert([{...pl,id:Date.now().toString()}]);
        if(r.error)alert('Error'); else {alert('Guardado'); resetForm(pf,fds); loadAdminLists();}
        add.disabled=false; add.textContent=currentEditId?'Actualizar':'Agregar';
    };
    if(can) can.onclick=()=>resetForm(pf,fds);
}

function resetForm(pf,fds){
    currentEditId=null; fds.forEach(f=>{if(document.getElementById(`${pf}-${f}`))document.getElementById(`${pf}-${f}`).value='';if(document.getElementById(`${pf}-${f}-url`))document.getElementById(`${pf}-${f}-url`).value='';if(document.getElementById(`${pf}-${f}-file`))document.getElementById(`${pf}-${f}-file`).value=''});
    const add=document.getElementById(`add-${pf}`), can=document.getElementById(`cancel-${pf}`);
    if(add)add.textContent='Agregar'; if(can)can.classList.add('hidden');
}

// --- CARGA DE LISTAS ADMIN ---
async function loadAdminLists() {
    const d = await readData(); if(!d) return;
    const sm = document.getElementById('search-mem');
    
    if (sm && !sm.dataset.l) { 
        sm.dataset.l="1"; 
        sm.addEventListener('input', (e) => { 
            const t = e.target.value.toLowerCase(); 
            renderList('member-admin-list', d.members.filter(m => m.name.toLowerCase().includes(t)), 'name', 'members', 'mem', ['name', 'role', 'email', 'phone', 'photo']); 
        }); 
    }

    const renderList = (cid, it, lbl, tb, pf, fds) => {
        const c = document.getElementById(cid); if(!c) return; 
        c.innerHTML = it.length ? '' : '<p class="muted">Sin registros.</p>';
        it.forEach(x => {
            const div = document.createElement('div'); div.className = 'card'; div.style.cssText = 'padding:10px 15px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;';
            let thumb = ''; 
            const imgPath = x.photo || x.image;
            if((tb==='members'||tb==='news') && imgPath) thumb = `<img src="${imgPath}" style="width:30px;height:30px;border-radius:50%;object-fit:cover;margin-right:10px;">`;
            div.innerHTML = `<div style="display:flex;align-items:center;">${thumb}<b>${escapeHtml(x[lbl])}</b></div><div><button class="btn edit-btn" style="padding:4px 8px;font-size:0.8rem;margin-right:5px;">✏️</button><button class="btn del-btn" style="padding:4px 8px;font-size:0.8rem;background:#d32f2f;">🗑️</button></div>`;
            div.querySelector('.del-btn').onclick = async () => { 
                if(confirm('¿Borrar este registro permanentemente?')) { 
                    if(x.image) await deleteFileFromStorage(x.image);
                    if(x.photo) await deleteFileFromStorage(x.photo);
                    if(x.gallery && Array.isArray(x.gallery)) for(let url of x.gallery) await deleteFileFromStorage(url);
                    await supabase.from(tb).delete().eq('id', x.id); 
                    loadAdminLists(); 
                } 
            };
            div.querySelector('.edit-btn').onclick = () => {
                if (tb === 'projects') loadProjectToEdit(x);
                else { 
                    currentEditId = x.id; 
                    fds.forEach(f => { 
                        if(document.getElementById(`${pf}-${f}-url`)) document.getElementById(`${pf}-${f}-url`).value = x[f]||''; 
                        else if(document.getElementById(`${pf}-${f}`)) document.getElementById(`${pf}-${f}`).value = x[f]||''; 
                    }); 
                    const add = document.getElementById(`add-${pf}`), can = document.getElementById(`cancel-${pf}`); 
                    if(add) { add.textContent = 'Actualizar'; add.scrollIntoView({behavior:'smooth'}); } 
                    if(can) can.classList.remove('hidden'); 
                }
            };
            c.appendChild(div);
        });
    };

    renderList('news-admin-list', d.news, 'title', 'news', 'news', ['title', 'body', 'date', 'image']);
    renderList('event-admin-list', d.events, 'title', 'events', 'evt', ['title', 'desc', 'date']);
    const st = sm ? sm.value.toLowerCase() : '';
    renderList('member-admin-list', st ? d.members.filter(m => m.name.toLowerCase().includes(st)) : d.members, 'name', 'members', 'mem', ['name', 'role', 'email', 'phone', 'photo']);
    renderList('proj-admin-list', d.projects, 'title', 'projects', 'proj', []);

    // --- RENDERIZAR BANDEJA DE MENSAJES ---
    const cContainer = document.getElementById('contacts-admin-list');
    if (cContainer && d.contacts) {
        cContainer.innerHTML = d.contacts.length ? '' : '<p class="muted">No hay mensajes en la bandeja.</p>';
        d.contacts.forEach(msg => {
            const mDiv = document.createElement('div');
            mDiv.style.cssText = 'background:#f8f9fa; border:1px solid #e1e4e8; border-radius:8px; padding:15px;';
            const fechaMsg = new Date(msg.date).toLocaleString();
            mDiv.innerHTML = `
                <div style="border-bottom:1px solid #eee; padding-bottom:10px; margin-bottom:10px; display:flex; justify-content:space-between; flex-wrap:wrap; gap:10px;">
                    <div>
                        <strong style="color:var(--blue-accent); font-size:1.1rem;">👤 ${escapeHtml(msg.name)}</strong><br>
                        <small>📧 <a href="mailto:${escapeHtml(msg.email)}">${escapeHtml(msg.email)}</a> | 📞 ${escapeHtml(msg.phone || 'Sin teléfono')}</small>
                    </div>
                    <small class="muted">📅 ${fechaMsg}</small>
                </div>
                <p style="margin:0 0 15px 0; color:#444; white-space:pre-wrap; line-height: 1.5;">${escapeHtml(msg.message)}</p>
                <button class="btn del-msg-btn" style="background:#ffebee; color:#c62828; border:1px solid #ffcdd2; padding:6px 12px; font-size:0.85rem;">🗑️ Borrar Mensaje</button>
            `;
            mDiv.querySelector('.del-msg-btn').onclick = async () => {
                if(confirm('¿Eliminar este mensaje permanentemente?')) {
                    await supabase.from('contacts').delete().eq('id', msg.id);
                    loadAdminLists(); 
                }
            };
            cContainer.appendChild(mDiv);
        });
    }
}

// --- FUNCIONES COMUNES ---
function escapeHtml(t) { return t ? t.toString().replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])) : ''; }
function uid() { return Date.now().toString(36) + Math.random().toString(36).substr(2); }
function bindSidebar() { const b=document.getElementById('sidebar-toggle'),s=document.getElementById('sidebar'),o=document.getElementById('sidebar-overlay'); if(b)b.onclick=()=>{s.classList.add('open');o.classList.add('open');}; if(o)o.onclick=()=>{s.classList.remove('open');o.classList.remove('open');}; }
function renderNav() { const n=document.getElementById('sidebar-nav'); if(!n)return; const l=[{t:'Inicio',h:'index.html'}, {t:'Nosotros',h:'about.html'}, {t:'Proyectos',h:'projects.html'}, {t:'Eventos',h:'events.html'}, {t:'Noticias',h:'news.html'}, {t:'Transparencia', h:'transparencia.html'}, {t:'Galería',h:'gallery.html'}, {t:'Integrantes',h:'members.html'}, {t:'Contacto',h:'contact.html'}]; n.innerHTML=''; l.forEach(i=>{const a=document.createElement('a');a.href=i.h;a.textContent=i.t;if(location.pathname.includes(i.h))a.classList.add('active');n.appendChild(a)}); }
function bindContact() { const f=document.getElementById('contact-form'); if(f)f.onsubmit=async e=>{ e.preventDefault(); await supabase.from('contacts').insert([{id:uid(),name:f['contact-name'].value,email:f['contact-email'].value,phone:f['contact-phone'].value,message:f['contact-message'].value}]); alert('Enviado');f.reset(); }; }
function bindNewsModal(){document.getElementById('news-modal')?.addEventListener('click',e=>{if(e.target===document.getElementById('news-modal'))document.getElementById('news-modal').classList.add('hidden')})}
function openNewsModal(t,d,b,i){ const m=document.getElementById('news-modal'),mb=document.getElementById('news-modal-body');if(!m||!mb)return; mb.innerHTML=`<div style="display:flex;flex-direction:column;gap:16px;">${i?`<img src="${i}" style="width:100%;height:300px;object-fit:cover;border-radius:12px;">`:''}<div><h2 style="color:#013a63;margin:0 0 8px 0;">${escapeHtml(t)}</h2><small style="color:#ff6b6b;font-weight:600;">${d}</small></div><div style="color:#013a63;line-height:1.8;">${escapeHtml(b).replace(/\n/g,'<br>')}</div></div>`; m.classList.remove('hidden'); }
function closeNewsModal(){document.getElementById('news-modal')?.classList.add('hidden')}
function initCarousel(n){ const c=document.getElementById('news-carousel');if(!c)return; if(!n.length){c.innerHTML='<div class="card"><p class="muted">Sin noticias.</p></div>';return} c.innerHTML=''; const ct=document.createElement('div'); ct.className='carousel-slides'; n.forEach((x,i)=>{ const s=document.createElement('div'); s.className=`carousel-slide ${i===0?'active':''}`; s.style.backgroundImage=x.image?`url('${x.image}')`:'linear-gradient(135deg,#04293a,#0d5d9e)'; s.innerHTML=`<div class="carousel-caption"><div class="content"><h3>${escapeHtml(x.title)}</h3><small>${x.date}</small></div></div>`; ct.appendChild(s); }); c.appendChild(ct); let idx=0; setInterval(()=>{ct.children[idx].classList.remove('active');idx=(idx+1)%ct.children.length;ct.children[idx].classList.add('active')},5000); }
function openPhotoViewer(s){const p=document.getElementById('photo-viewer'),i=document.getElementById('photo-viewer-img');if(p&&i){i.src=s;p.classList.add('open')}}
function renderMembersByRole(m){ const c=document.getElementById('members-list');if(!c)return; c.innerHTML=''; const q=[{title:'Presidente y Vicepresidenta',roles:['Presidente','Presidenta','Vicepresidente','Vicepresidenta','Vicepresedenta']},{title:'Logística',roles:['Logistica','Logística']},{title:'Publirelacionista',roles:['Publirelacionista','Relaciones Públicas','Relaciones Publicas']},{title:'Tesorería',roles:['Tesorero','Tesorería','Tesorera']},{title:'Secretaria',roles:['Secretaria','Secretario']},{title:'Vocales',roles:['Vocal','Vocales']},{title:'Colaboradores',roles:['Colaborador','Colaboradores']}]; const cr=(x)=>{ const d=document.createElement('div'); d.className='member-card'; const i=x.photo||"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Crect width='220' height='220' fill='%23ddd'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle'%3E👤%3C/text%3E%3C/svg%3E"; d.innerHTML=`<img src="${i}" onclick="openPhotoViewer('${i}')"><div><h4>${escapeHtml(x.name)}</h4><p class="muted">${escapeHtml(x.role)}</p><p>${escapeHtml(x.email)}</p></div>`; return d; }; const norm=r=>(r||'').trim().toLowerCase(); const u=new Set(); q.forEach(g=>{ const s=document.createElement('section'); s.className='card quadrant'; s.innerHTML=`<h3>${g.title}</h3>`; const d=document.createElement('div'); d.className='quadrant-grid'; const mat=m.filter(x=>g.roles.map(norm).includes(norm(x.role))); mat.forEach(x=>{d.appendChild(cr(x));u.add(x.id)}); if(mat.length){s.appendChild(d); c.appendChild(s);} }); const oth=m.filter(x=>!u.has(x.id)); if(oth.length){ const s=document.createElement('section'); s.className='card quadrant'; s.innerHTML=`<h3>Otros</h3>`; const d=document.createElement('div'); d.className='quadrant-grid'; oth.forEach(x=>d.appendChild(cr(x))); s.appendChild(d); c.appendChild(s); } }