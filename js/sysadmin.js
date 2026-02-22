// js/sysadmin.js
// Lógica exclusiva del Panel "God Mode"

const MODULOS_DISPONIBLES = ['mantenimiento', 'nosotros', 'proyectos', 'eventos', 'noticias', 'contactos', 'finanzas', 'integrantes', 'aesfact', 'panel_sysadmin'];

document.addEventListener('DOMContentLoaded', () => {
    // Le damos a app.js 300ms para que conecte a Supabase tranquilamente
    setTimeout(async () => {
        if (!window.supabaseClient) {
            console.error("Supabase no cargó a tiempo");
            return;
        }

        const { data: { session } } = await window.supabaseClient.auth.getSession();
        const localRole = sessionStorage.getItem('aesfact_role');

        if (!session || localRole !== 'SysAdmin') {
            alert('⛔ ACCESO RESTRINGIDO. Esta área es exclusiva para el Administrador de Sistemas.');
            window.location.href = 'admin.html';
            return;
        }

        // Si pasó los controles, cargamos el panel
        loadUsers();
        loadPermissions();
        loadLogs();
    }, 300);
});

window.switchTab = (tabId) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.sys-section').forEach(s => s.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById(`${tabId}-section`).classList.add('active');
};

// ==========================================
// 1. GESTIÓN DE USUARIOS
// ==========================================
async function loadUsers() {
    const tbody = document.getElementById('users-table-body');
    const { data, error } = await window.supabaseClient.rpc('get_all_admin_users');
    
    if (error) { tbody.innerHTML = `<tr><td colspan="4" style="color:red;">Error: ${error.message}</td></tr>`; return; }

    tbody.innerHTML = '';
    data.forEach(u => {
        const tr = document.createElement('tr');
        
        tr.innerHTML = `
            <td>
                <input type="text" id="name-${u.uid}" value="${escapeHtml(u.user_name)}" class="sys-select" style="width: 200px; margin-bottom: 5px;" placeholder="Ej. Juan Pérez">
                <br>
                <small class="muted">📧 ${escapeHtml(u.user_email)}</small>
            </td>
            <td>
                <select id="role-${u.uid}" class="sys-select">
                    <option value="SysAdmin" ${u.user_role === 'SysAdmin' ? 'selected' : ''}>SysAdmin</option>
                    <option value="Tesoreria" ${u.user_role === 'Tesoreria' ? 'selected' : ''}>Tesoreria</option>
                    <option value="Publirelacionista" ${u.user_role === 'Publirelacionista' ? 'selected' : ''}>Publirelacionista</option>
                    <option value="Secretaria" ${u.user_role === 'Secretaria' ? 'selected' : ''}>Secretaria</option>
                    <option value="Logistica" ${u.user_role === 'Logistica' ? 'selected' : ''}>Logistica</option>
                </select>
            </td>
            <td>
                <select id="status-${u.uid}" class="sys-select" style="color: ${u.user_status === 'activo' ? '#2ea043' : '#f85149'}; font-weight:bold;">
                    <option value="activo" ${u.user_status === 'activo' ? 'selected' : ''}>🟢 Activo</option>
                    <option value="pausado" ${u.user_status === 'pausado' ? 'selected' : ''}>🔴 Pausado</option>
                </select>
            </td>
            <td>
                <button class="btn btn-action" onclick="saveUser('${u.uid}')">💾 Aplicar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.saveUser = async (uid) => {
    const newName = document.getElementById(`name-${uid}`).value.trim();
    const newRole = document.getElementById(`role-${uid}`).value;
    const newStatus = document.getElementById(`status-${uid}`).value;

    if(!confirm(`¿Guardar cambios para este usuario?`)) return;

    const { error } = await window.supabaseClient.rpc('update_user_access', {
        target_uid: uid,
        new_role: newRole,
        new_status: newStatus,
        new_name: newName 
    });

    if (error) alert(`Error: ${error.message}`);
    else { alert('✅ Cambios aplicados correctamente.'); loadUsers(); }
};

// ==========================================
// 2. MATRIZ DE PERMISOS
// ==========================================
async function loadPermissions() {
    const grid = document.getElementById('permissions-grid');
    const { data, error } = await window.supabaseClient.from('role_permissions').select('*').order('role');
    if (error) { grid.innerHTML = 'Error cargando matriz.'; return; }

    grid.innerHTML = '';
    data.forEach(row => {
        if (row.role === 'SysAdmin') return; 

        const card = document.createElement('div'); card.className = 'perm-card';
        let checksHtml = '';
        MODULOS_DISPONIBLES.forEach(mod => {
            if(mod === 'panel_sysadmin') return; 
            const isChecked = row.allowed_modules.includes(mod) ? 'checked' : '';
            checksHtml += `
                <label class="checkbox-label">
                    <input type="checkbox" value="${mod}" class="chk-${row.role}" ${isChecked}>
                    <span>${mod.toUpperCase()}</span>
                </label>
            `;
        });

        card.innerHTML = `
            <div>
                <h4><span>Rol: ${row.role}</span> <button class="btn btn-action" style="padding: 4px 10px; font-size: 0.75rem;" onclick="savePermissions('${row.role}')">💾 Guardar</button></h4>
            </div>
            <div class="checkbox-group">${checksHtml}</div>
        `;
        grid.appendChild(card);
    });
}

window.savePermissions = async (roleName) => {
    const checkboxes = document.querySelectorAll(`.chk-${roleName}:checked`);
    const newModules = Array.from(checkboxes).map(chk => chk.value);
    const { error } = await window.supabaseClient.rpc('update_role_permissions', { target_role: roleName, new_modules: newModules });
    if (error) alert(`Error: ${error.message}`);
    else alert(`✅ Permisos de ${roleName} actualizados.`);
};

// ==========================================
// 3. HISTORIAL FORENSE (LOGS)
// ==========================================
window.loadLogs = async () => {
    const tbody = document.getElementById('logs-table-body');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Cargando...</td></tr>';

    const { data, error } = await window.supabaseClient.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(100); 

    if (error) { tbody.innerHTML = `<tr><td colspan="6" style="color:red;">Error: ${error.message}</td></tr>`; return; }
    if (data.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No hay actividad registrada aún.</td></tr>'; return; }

    tbody.innerHTML = '';
    data.forEach(log => {
        const tr = document.createElement('tr');
        const d = new Date(log.created_at);
        const fechaFormat = `${d.toLocaleDateString()} - ${d.toLocaleTimeString()}`;
        
        tr.innerHTML = `
            <td style="font-family: monospace; font-size: 0.85rem; color: var(--text-secondary);">${fechaFormat}</td>
            <td>
                <strong style="color:var(--text-primary); font-size:0.95rem;">${escapeHtml(log.user_name)}</strong><br>
                <small style="color:var(--text-secondary); font-size:0.75rem;">${escapeHtml(log.user_email)}</small>
            </td>
            <td><span class="badge-action act-${log.action_type}">${log.action_type}</span></td>
            <td style="text-transform: uppercase; font-size: 0.8rem; font-weight: bold; color: var(--text-primary);">${log.table_name}</td>
            <td style="font-family: monospace; color: var(--sys-orange);">${escapeHtml(log.ip_address)}</td>
            <td style="font-family: monospace; font-size: 0.8rem; color: var(--text-secondary);">${log.record_id ? escapeHtml(log.record_id.substring(0,8)) + '...' : '-'}</td>
        `;
        tbody.appendChild(tr);
    });
};

function escapeHtml(t) { return t ? t.toString().replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])) : ''; }