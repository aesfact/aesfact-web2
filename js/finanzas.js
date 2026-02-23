// js/finanzas.js - VERSIÓN CRUD + REPORTES PDF OPTIMIZADA
// =========================================================

let allTransactions = [];
let financeChart = null;
let currentEditId = null;

// --- INICIALIZACIÓN SEGURA Y ESPERA INTELIGENTE ---
document.addEventListener('DOMContentLoaded', () => {
    // Esperamos a que app.js termine de armar el window.supabaseClient
    const checkSupabase = setInterval(async () => {
        if (window.supabaseClient) {
            clearInterval(checkSupabase);
            iniciarModuloFinanzas();
        }
    }, 100);

    // Timeout de seguridad por si falla la red
    setTimeout(() => clearInterval(checkSupabase), 5000);
});

async function iniciarModuloFinanzas() {
    // 1. Verificar sesión
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    if (!session) { 
        window.location.href = 'admin.html';
        return;
    }

    // 2. Verificar permisos
    const permsRaw = sessionStorage.getItem('aesfact_permissions');
    if (!permsRaw || !JSON.parse(permsRaw).includes('finanzas')) {
        alert('⛔ Acceso Restringido.');
        window.location.href = 'admin.html';
        return;
    }

    // 3. Cargar datos
    await cargarProyectos();
    await cargarFinanzas();

    // 4. Fechas por defecto
    const hoy = new Date();
    document.getElementById('f-date').valueAsDate = hoy;
    document.getElementById('rep-end').valueAsDate = hoy;
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    document.getElementById('rep-start').valueAsDate = primerDia;
}

// --- CARGA DE DATOS ---
async function cargarProyectos() {
    const { data, error } = await window.supabaseClient.from('projects').select('title');
    if (error) { console.error("Error proyectos:", error); return; }

    const select = document.getElementById('f-project');
    select.innerHTML = '<option value="">-- Ninguno --</option>'; 
    if (data) {
        data.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.title;
            opt.textContent = p.title;
            select.appendChild(opt);
        });
    }
}

async function cargarFinanzas() {
    const { data, error } = await window.supabaseClient
        .from('finances')
        .select('*')
        .order('date', { ascending: false });

    if (error) { alert('Error cargando finanzas'); return; }
    
    allTransactions = data || [];
    renderizarTodo(allTransactions);
}

// --- RENDERIZADO (VISTA) ---
function renderizarTodo(datos) {
    actualizarTotales(datos);
    renderizarListas(datos);
    actualizarGrafico(datos);
}

function actualizarTotales(datos) {
    let ingresos = 0; let egresos = 0;
    datos.forEach(t => {
        if (t.type === 'ingreso') ingresos += parseFloat(t.amount);
        else egresos += parseFloat(t.amount);
    });

    const total = ingresos - egresos;
    const el = document.getElementById('net-total');
    el.textContent = `$${total.toFixed(2)}`;
    el.style.color = total >= 0 ? 'var(--dark-blue)' : 'var(--red-finance)';
}

function renderizarListas(datos) {
    const incList = document.getElementById('income-list');
    const expList = document.getElementById('expense-list');
    incList.innerHTML = ''; expList.innerHTML = '';

    if(datos.length === 0) {
        incList.innerHTML = '<p class="muted">No hay ingresos registrados.</p>';
        expList.innerHTML = '<p class="muted">No hay gastos registrados.</p>';
        return;
    }

    datos.forEach(t => {
        const div = document.createElement('div');
        const esIngreso = t.type === 'ingreso';
        div.className = `transaction-card ${esIngreso ? 't-income' : 't-expense'}`;
        
        const projectTag = t.related_project ? `<span class="t-project-badge">📂 ${escapeHtml(t.related_project)}</span>` : '';
        const dataStr = encodeURIComponent(JSON.stringify(t));

        div.innerHTML = `
            <div class="t-info" style="flex: 1;">
                <h4 style="margin: 0 0 5px 0;">${escapeHtml(t.concept)}</h4>
                <small style="color: #666;">📅 ${t.date} ${projectTag}</small>
            </div>
            <div style="display: flex; align-items: center; gap: 15px;">
                <div class="t-amount" style="color: ${esIngreso ? 'var(--green-finance)' : 'var(--red-finance)'}; font-weight: bold; font-size: 1.1rem; margin-right: 10px;">
                    ${esIngreso ? '+' : '-'}$${parseFloat(t.amount).toFixed(2)}
                </div>
                <div class="action-buttons">
                    <button onclick="prepararEdicion('${dataStr}')" class="btn-action btn-edit" title="Editar">✏️</button>
                    <button onclick="borrarMovimiento('${t.id}')" class="btn-action btn-delete" title="Eliminar">🗑️</button>
                </div>
            </div>
        `;
        if (esIngreso) incList.appendChild(div);
        else expList.appendChild(div);
    });
}

function actualizarGrafico(datos) {
    const ctx = document.getElementById('financeChart');
    if(!ctx) return;
    
    let totalIng = 0; let totalEgr = 0;
    datos.forEach(t => {
        if (t.type === 'ingreso') totalIng += parseFloat(t.amount);
        else totalEgr += parseFloat(t.amount);
    });

    if (financeChart) financeChart.destroy();

    financeChart = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['Ingresos', 'Gastos'],
            datasets: [{
                data: [totalIng, totalEgr],
                backgroundColor: ['#2ecc71', '#e74c3c'],
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

// --- LOGICA DEL FORMULARIO (MODAL) ---
window.abrirModal = () => {
    resetModal(); 
    document.getElementById('finance-modal').classList.remove('hidden');
    document.getElementById('modal-title').textContent = "Registrar Nuevo Movimiento";
};

window.cerrarModal = () => {
    document.getElementById('finance-modal').classList.add('hidden');
    resetModal();
};

function resetModal() {
    currentEditId = null; 
    document.getElementById('f-amount').value = '';
    document.getElementById('f-concept').value = '';
    document.getElementById('f-date').valueAsDate = new Date();
    document.getElementById('f-type').value = 'ingreso';
    document.getElementById('f-project').value = '';
    toggleProjectSelect();
}

window.prepararEdicion = (dataEncoded) => {
    const t = JSON.parse(decodeURIComponent(dataEncoded));
    currentEditId = t.id; 
    document.getElementById('f-type').value = t.type;
    document.getElementById('f-amount').value = t.amount;
    document.getElementById('f-concept').value = t.concept;
    document.getElementById('f-date').value = t.date;
    toggleProjectSelect(); 
    if (t.related_project) document.getElementById('f-project').value = t.related_project;
    document.getElementById('modal-title').textContent = "Editar Movimiento Existente";
    document.getElementById('finance-modal').classList.remove('hidden');
};

window.toggleProjectSelect = () => {
    const tipo = document.getElementById('f-type').value;
    const pContainer = document.getElementById('project-select-container');
    if (tipo === 'gasto') pContainer.classList.remove('hidden');
    else { pContainer.classList.add('hidden'); document.getElementById('f-project').value = ''; }
};

// CRUD REPARADO (INYECCIÓN DE ID)
window.guardarMovimiento = async () => {
    const btn = document.querySelector('#finance-modal .btn'); 
    const originalText = btn.textContent;
    btn.disabled = true; btn.textContent = "Guardando...";

    const tipo = document.getElementById('f-type').value;
    const monto = document.getElementById('f-amount').value;
    const concepto = document.getElementById('f-concept').value;
    const fecha = document.getElementById('f-date').value;
    const proyecto = document.getElementById('f-project').value;

    if (!monto || !concepto || !fecha) {
        alert('Completa los campos obligatorios');
        btn.disabled = false; btn.textContent = originalText;
        return;
    }

    const payload = {
        type: tipo,
        amount: parseFloat(monto),
        concept: concepto,
        date: fecha,
        related_project: (tipo === 'gasto' && proyecto) ? proyecto : null
    };

    try {
        if (currentEditId) {
            const { error } = await window.supabaseClient.from('finances').update(payload).eq('id', currentEditId);
            if (error) throw error;
        } else {
            payload.id = Date.now().toString(); // <--- EL ID MAGICO FALTANTE
            const { error } = await window.supabaseClient.from('finances').insert([payload]);
            if (error) throw error;
        }

        cerrarModal();
        await cargarFinanzas(); 
    } catch (e) {
        console.error(e);
        alert('Error al guardar: ' + e.message);
    } finally {
        btn.disabled = false; btn.textContent = originalText;
    }
};

window.borrarMovimiento = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este registro permanentemente?')) return;
    try {
        const { error } = await window.supabaseClient.from('finances').delete().eq('id', id);
        if (error) throw error;
        await cargarFinanzas();
    } catch (e) { alert('Error al borrar.'); }
};

window.filtrarFinanzas = (periodo) => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    
    if (periodo === 'todo') { renderizarTodo(allTransactions); return; }
    
    const hoy = new Date();
    const filtrados = allTransactions.filter(t => {
        const fechaT = new Date(t.date + 'T00:00:00');
        if (periodo === 'mes') return fechaT.getMonth() === hoy.getMonth() && fechaT.getFullYear() === hoy.getFullYear();
        if (periodo === 'anio') return fechaT.getFullYear() === hoy.getFullYear();
        return true;
    });
    renderizarTodo(filtrados);
};

// REPORTES PDF (INTACTO Y FUNCIONAL)
window.generarReportePDF = () => {
    const fechaStart = document.getElementById('rep-start').value;
    const fechaEnd = document.getElementById('rep-end').value;
    const tipo = document.getElementById('rep-type').value;

    if(!fechaStart || !fechaEnd) { alert("Por favor selecciona una fecha de inicio y fin."); return; }

    const start = new Date(fechaStart + 'T00:00:00');
    const end = new Date(fechaEnd + 'T23:59:59');

    const datosFiltrados = allTransactions.filter(t => {
        const fechaT = new Date(t.date + 'T00:00:00'); 
        const dentroRango = fechaT >= start && fechaT <= end;
        if (!dentroRango) return false;
        if (tipo === 'todo') return true;
        return t.type === tipo;
    });

    if(datosFiltrados.length === 0) { alert("No hay movimientos registrados en este rango de fechas."); return; }

    datosFiltrados.sort((a, b) => new Date(a.date) - new Date(b.date));

    let totalIng = 0; let totalEgr = 0;
    const tablaBody = datosFiltrados.map(t => {
        const amount = parseFloat(t.amount);
        if(t.type === 'ingreso') totalIng += amount; else totalEgr += amount;
        return [
            t.date, t.type.toUpperCase(), t.concept, t.related_project || '-',
            (t.type === 'ingreso' ? '+ ' : '- ') + `$${amount.toFixed(2)}`
        ];
    });

    const balancePeriodo = totalIng - totalEgr;
    const { jsPDF } = window.jspdf; const doc = new jsPDF();

    doc.setFillColor(4, 41, 58); doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(22); doc.text("AESFACT", 14, 20);
    doc.setFontSize(12); doc.text("Reporte Financiero Oficial", 14, 30); doc.text(`Generado: ${new Date().toLocaleDateString()}`, 150, 30);
    doc.setTextColor(0, 0, 0); doc.setFontSize(10); doc.text(`Periodo: ${fechaStart} al ${fechaEnd}`, 14, 50); doc.text(`Filtro: ${tipo.toUpperCase()}`, 14, 56);

    doc.autoTable({
        startY: 65, head: [['Fecha', 'Tipo', 'Concepto', 'Proyecto', 'Monto']], body: tablaBody,
        theme: 'grid', headStyles: { fillColor: [4, 41, 58] }, alternateRowStyles: { fillColor: [240, 240, 240] }
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(11); doc.setTextColor(50, 50, 50); doc.text("Resumen del Periodo:", 14, finalY);
    doc.setFontSize(12); doc.setTextColor(39, 174, 96); doc.text(`Total Ingresos: $${totalIng.toFixed(2)}`, 14, finalY + 7);
    doc.setTextColor(192, 57, 43); doc.text(`Total Gastos:   $${totalEgr.toFixed(2)}`, 14, finalY + 14);
    doc.setFontSize(14); doc.setTextColor(0, 0, 0); doc.text(`Balance Neto:   $${balancePeriodo.toFixed(2)}`, 14, finalY + 24);
    doc.setFontSize(8); doc.setTextColor(150, 150, 150); doc.text("Documento generado por el sistema administrativo de AESFACT.", 14, 280);
    doc.save(`Reporte_AESFACT_${fechaStart}_${fechaEnd}.pdf`);
};

function escapeHtml(text) {
    if (!text) return '';
    return text.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}