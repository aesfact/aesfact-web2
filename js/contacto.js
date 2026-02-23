// js/contacto.js - MINI-CRM DE MENSAJES Y ALERTAS EMAILJS PARA AESFACT
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    // Escuchar el formulario público
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.onsubmit = async (e) => {
            e.preventDefault();
            const btn = contactForm.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.textContent = 'Enviando...';

            const nombreVal = document.getElementById('contact-name').value.trim();
            const correoVal = document.getElementById('contact-email').value.trim();
            const telefonoVal = document.getElementById('contact-phone').value.trim();
            const mensajeVal = document.getElementById('contact-message').value.trim();

            const payload = {
                id: Date.now().toString(36) + Math.random().toString(36).substr(2),
                name: nombreVal,
                email: correoVal,
                phone: telefonoVal,
                message: mensajeVal,
                status: 'Pendiente' 
            };

            try {
                // Forzar creación local de supabaseClient si está en la página de contacto público
                const client = window.supabaseClient || window.supabase.createClient('https://vjdwzfvvbybwwymtqoym.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqZHd6ZnZ2Ynlid3d5bXRxb3ltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NzU4NDgsImV4cCI6MjA4NzA1MTg0OH0.mjdhTGIBv4BpMbYKMdeTzmssekDxjKsTmFkkas692C4');

                // Guardar en Supabase
                const { error } = await client.from('contacts').insert([payload]);
                if (error) throw error;
                
                // Alerta silenciosa EmailJS
                const emailData = {
                    service_id: 'service_nzrn2yb',
                    template_id: 'template_2d08wh8',
                    user_id: 'tlT8GL7Ue5_rdRP8q',
                    template_params: {
                        nombre: nombreVal, correo: correoVal,
                        telefono: telefonoVal || 'No proporcionó', mensaje: mensajeVal
                    }
                };

                await fetch('https://api.emailjs.com/api/v1.0/email/send', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(emailData)
                });
                
                alert('¡Mensaje enviado con éxito! Te contactaremos pronto.');
                contactForm.reset();
            } catch (err) {
                console.error('Error en el proceso de contacto:', err);
                alert('Hubo un error al enviar el mensaje. Por favor, intenta de nuevo.');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Enviar Mensaje';
            }
        };
    }
});

// Función global para renderizar la lista en el Panel Admin
window.renderContactAdminList = function(contactsData) {
    const cContainer = document.getElementById('contacts-admin-list');
    if (!cContainer) return;

    cContainer.innerHTML = (!contactsData || contactsData.length === 0) 
        ? '<p class="muted" style="text-align:center; padding: 20px;">No hay mensajes en la bandeja.</p>' 
        : '';

    if (contactsData) {
        const sortedContacts = contactsData.sort((a, b) => {
            if (a.status === 'Pendiente' && b.status !== 'Pendiente') return -1;
            if (a.status !== 'Pendiente' && b.status === 'Pendiente') return 1;
            return new Date(b.date) - new Date(a.date);
        });

        sortedContacts.forEach(msg => {
            const isPending = msg.status === 'Pendiente';
            const statusColor = isPending ? '#e65100' : '#2e7d32'; 
            const statusBg = isPending ? '#fff3e0' : '#e8f5e9';
            const fechaMsg = new Date(msg.date).toLocaleString();

            const mDiv = document.createElement('div');
            mDiv.className = 'message-card';
            mDiv.style.borderLeft = `5px solid ${statusColor}`;
            
            const mailtoLink = `mailto:${encodeURIComponent(msg.email)}?subject=${encodeURIComponent("Respuesta a tu consulta - AESFACT")}`;

            mDiv.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px; flex-wrap:wrap; gap:10px;">
                    <div>
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom:5px;">
                            <strong style="color:var(--blue-accent); font-size:1.2rem;">👤 ${escapeHtml(msg.name)}</strong>
                            <span class="status-badge" style="background:${statusBg}; color:${statusColor}; border:1px solid ${statusColor};">
                                ${isPending ? '🔴 Pendiente' : '🟢 Resuelto'}
                            </span>
                        </div>
                        <div style="color:var(--text-muted); font-size:0.9rem;">
                            <span>📧 <a href="mailto:${escapeHtml(msg.email)}" style="color:var(--blue-light);">${escapeHtml(msg.email)}</a></span>
                            <span style="margin: 0 10px;">|</span>
                            <span>📞 ${escapeHtml(msg.phone || 'Sin teléfono')}</span>
                        </div>
                    </div>
                    <small class="muted" style="font-size:0.8rem;">📅 ${fechaMsg}</small>
                </div>
                
                <div style="background:#f8faff; padding:15px; border-radius:8px; margin-bottom:15px; color:#333; line-height:1.6; border: 1px solid #eef2f6;">
                    ${escapeHtml(msg.message).replace(/\n/g, '<br>')}
                </div>
                
                <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
                    <a href="${mailtoLink}" target="_blank" class="btn" style="background:var(--blue-light); text-decoration:none; padding:8px 15px;">
                        📧 Responder por Correo
                    </a>
                    
                    ${isPending ? 
                        `<button class="btn resolve-btn" style="background:#2e7d32; padding:8px 15px;">✅ Marcar Resuelto</button>` : 
                        `<button class="btn pending-btn" style="background:#f57f17; color:#fff; border:none; padding:8px 15px;">🔄 Reabrir Ticket</button>`
                    }
                    
                    <button class="btn del-msg-btn" style="background:#ffebee; color:#c62828; border:1px solid #ffcdd2; padding:8px 15px; margin-left:auto;">🗑️ Archivar</button>
                </div>
            `;

            // EVENTOS DE BOTONES
            const resolveBtn = mDiv.querySelector('.resolve-btn');
            if(resolveBtn) resolveBtn.onclick = (e) => { e.target.textContent = '⏳...'; updateTicketStatus(msg.id, 'Resuelto'); };

            const pendingBtn = mDiv.querySelector('.pending-btn');
            if(pendingBtn) pendingBtn.onclick = (e) => { e.target.textContent = '⏳...'; updateTicketStatus(msg.id, 'Pendiente'); };

            const delBtn = mDiv.querySelector('.del-msg-btn');
            if (delBtn) {
                delBtn.onclick = async (e) => {
                    if(confirm('¿Seguro que deseas archivar/eliminar este mensaje permanentemente?')) {
                        e.target.textContent = '⏳...';
                        try {
                            const { error } = await window.supabaseClient.from('contacts').delete().eq('id', msg.id);
                            if (error) throw error;
                            if (window.showNotification) window.showNotification('Mensaje archivado.');
                            if (window.loadContacts) await window.loadContacts();
                        } catch (err) {
                            if (window.showNotification) window.showNotification('Error al archivar.', 'error');
                        }
                    }
                };
            }

            cContainer.appendChild(mDiv);
        });
    }
};

// Función para actualizar estado (Pendiente <-> Resuelto)
async function updateTicketStatus(id, newStatus) {
    try {
        const { error } = await window.supabaseClient.from('contacts').update({ status: newStatus }).eq('id', id);
        if (error) throw error;
        
        if (window.showNotification) window.showNotification(`Ticket marcado como ${newStatus}.`);
        if (window.loadContacts) await window.loadContacts(); 
        
    } catch (e) {
        console.error(e);
        if (window.showNotification) window.showNotification('Error al cambiar el estado.', 'error');
    }
}

function escapeHtml(t) { return t ? t.toString().replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])) : ''; }