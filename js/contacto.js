// contacto.js - MINI-CRM DE MENSAJES Y ALERTAS EMAILJS PARA AESFACT
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

            // 1. Recopilar los datos del formulario
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
                status: 'Pendiente' // Todo mensaje nuevo nace pendiente
            };

            try {
                // 2. Guardar en la bóveda de Supabase para el panel Admin
                const { error } = await window.supabaseClient.from('contacts').insert([payload]);
                if (error) throw error;
                
                // 3. Enviar alerta silenciosa por correo usando EmailJS (REST API)
                const emailData = {
                    service_id: 'service_nzrn2yb',
                    template_id: 'template_2d08wh8',
                    user_id: 'tlT8GL7Ue5_rdRP8q',
                    template_params: {
                        nombre: nombreVal,
                        correo: correoVal,
                        telefono: telefonoVal || 'No proporcionó',
                        mensaje: mensajeVal
                    }
                };

                // Petición al servidor de EmailJS
                await fetch('https://api.emailjs.com/api/v1.0/email/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(emailData)
                });
                
                // Si todo sale bien, mostramos éxito
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

// Función global que será llamada desde loadAdminLists() en app.js
window.renderContactAdminList = function(contactsData) {
    const cContainer = document.getElementById('contacts-admin-list');
    if (!cContainer) return;

    cContainer.innerHTML = (!contactsData || contactsData.length === 0) 
        ? '<p class="muted" style="text-align:center; padding: 20px;">No hay mensajes en la bandeja.</p>' 
        : '';

    if (contactsData) {
        // Ordenar: Pendientes arriba, Resueltos abajo. Y por fecha.
        const sortedContacts = contactsData.sort((a, b) => {
            if (a.status === 'Pendiente' && b.status !== 'Pendiente') return -1;
            if (a.status !== 'Pendiente' && b.status === 'Pendiente') return 1;
            return new Date(b.date) - new Date(a.date);
        });

        sortedContacts.forEach(msg => {
            const isPending = msg.status === 'Pendiente';
            const statusColor = isPending ? '#e65100' : '#2e7d32'; // Naranja o Verde
            const statusBg = isPending ? '#fff3e0' : '#e8f5e9';
            const fechaMsg = new Date(msg.date).toLocaleString();

            const mDiv = document.createElement('div');
            mDiv.style.cssText = `background:#ffffff; border:1px solid #e1e4e8; border-radius:12px; padding:20px; box-shadow: 0 4px 6px rgba(0,0,0,0.02); border-left: 5px solid ${statusColor};`;
            
            // Link mágico para Gmail/Outlook
            const mailtoLink = `mailto:${encodeURIComponent(msg.email)}?subject=${encodeURIComponent("Respuesta a tu consulta - AESFACT")}`;

            mDiv.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px; flex-wrap:wrap; gap:10px;">
                    <div>
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom:5px;">
                            <strong style="color:var(--blue-accent); font-size:1.2rem;">👤 ${escapeHtml(msg.name)}</strong>
                            <span style="background:${statusBg}; color:${statusColor}; padding:3px 10px; border-radius:20px; font-size:0.75rem; font-weight:bold; text-transform:uppercase;">
                                ${isPending ? '🔴 Pendiente' : '🟢 Resuelto'}
                            </span>
                        </div>
                        <div style="color:var(--muted); font-size:0.9rem;">
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
                    <a href="${mailtoLink}" target="_blank" class="btn" style="background:#0d5d9e; text-decoration:none; display:inline-flex; align-items:center; gap:5px; padding:8px 15px;">
                        📧 Responder por Correo
                    </a>
                    
                    ${isPending ? 
                        `<button class="btn resolve-btn" style="background:#2e7d32; padding:8px 15px;">✅ Marcar Resuelto</button>` : 
                        `<button class="btn pending-btn" style="background:#f57f17; color:#fff; border:none; padding:8px 15px;">🔄 Reabrir Ticket</button>`
                    }
                    
                    <button class="btn del-msg-btn" style="background:transparent; color:#c62828; border:1px solid #ffcdd2; padding:8px 15px; margin-left:auto;">🗑️ Archivar</button>
                </div>
            `;

            // Botón: Marcar como Resuelto con Feedback
            const resolveBtn = mDiv.querySelector('.resolve-btn');
            if(resolveBtn) {
                resolveBtn.onclick = (e) => {
                    e.target.textContent = '⏳ Guardando...';
                    updateTicketStatus(msg.id, 'Resuelto');
                };
            }

            // Botón: Devolver a Pendiente con Feedback
            const pendingBtn = mDiv.querySelector('.pending-btn');
            if(pendingBtn) {
                pendingBtn.onclick = (e) => {
                    e.target.textContent = '⏳ Guardando...';
                    updateTicketStatus(msg.id, 'Pendiente');
                };
            }

            // Botón: Borrar (Archivar) con manejo de errores
            mDiv.querySelector('.del-msg-btn').onclick = async () => {
                if(confirm('¿Seguro que deseas eliminar este mensaje de la bandeja permanentemente?')) {
                    const { error } = await window.supabaseClient.from('contacts').delete().eq('id', msg.id);
                    if (error) alert('🚨 Error borrando: ' + error.message);
                    else if(typeof loadAdminLists === 'function') loadAdminLists(); 
                }
            };

            cContainer.appendChild(mDiv);
        });
    }
};

// Función interna mejorada para actualizar el estado
async function updateTicketStatus(id, newStatus) {
    try {
        const { error } = await window.supabaseClient.from('contacts').update({ status: newStatus }).eq('id', id);
        
        // Si Supabase se queja, que nos diga exactamente por qué
        if (error) {
            alert('🚨 Error de Supabase: ' + error.message);
            return;
        }
        
        // Forzar recarga de la lista. Si falla la función, forzamos recarga de página (Plan B infalible)
        if(typeof loadAdminLists === 'function') {
            loadAdminLists();
        } else {
            window.location.reload(); 
        }
        
    } catch (e) {
        console.error(e);
        alert('Error en el código: ' + e.message);
    }
}

// Utilidad local para evitar fallos
function escapeHtml(t) { return t ? t.toString().replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])) : ''; }