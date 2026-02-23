// js/finanzas.js - ARRANQUE GARANTIZADO Y CRUD SEGURO
// =========================================================

let allTransactions = [];
let financeChart = null;
let currentEditId = null;

// 1. INICIALIZADOR PRINCIPAL
document.addEventListener('DOMContentLoaded', async () => {
    console.log("🟢 1. Finanzas: El HTML ha cargado.");
    
    try {
        // Aseguramos que la conexión exista sí o sí
        if (!window.supabaseClient) {
            console.log("🟠 2. Finanzas: Levantando Supabase manualmente...");
            window.supabaseClient = window.supabase.createClient(
                'https://vjdwzfvvbybwwymtqoym.supabase.co', 
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqZHd6ZnZ2Ynlid3d5bXRxb3ltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NzU4NDgsImV4cCI6MjA4NzA1MTg0OH0.mjdhTGIBv4BpMbYKMdeTzmssekDxjKsTmFkkas692C4'
            );
        } else {
            console.log("🟢 2. Finanzas: Conexión heredada de app.js exitosa.");
        }

        // Verificar sesión activa
        console.log("🟢 3. Finanzas: Verificando identidad...");
        const { data: { session }, error: sessionError } = await window.supabaseClient.auth.getSession();
        
        if (sessionError) throw sessionError;
        if (!session) {
            console.warn("🔴 Sesión no detectada. Redirigiendo al login...");
            window.location.href = 'admin.html';
            return;
        }

        // Verificar Permisos
        console.log("🟢 4. Finanzas: Verificando permisos...");
        const permsRaw = sessionStorage.getItem('aesfact_permissions');
        if (!permsRaw || !JSON.parse(permsRaw).includes('finanzas')) {
            alert('⛔ Acceso Restringido: Tu rol no tiene permisos de Tesorería.');
            window.location.href = 'admin.html';
            return;
        }

        // Si todo está bien, cargamos datos
        console.log("🟢 5. Finanzas: Todo en orden. Extrayendo datos BD...");
        await cargarProyectos();
        await cargarFinanzas();

        // Fechas por defecto
        const hoy = new Date();
        document.getElementById('f-date').valueAsDate = hoy;
        document.getElementById('rep-end').valueAsDate = hoy;
        document.getElementById('rep-start').valueAsDate = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

    } catch (error) {
        console.error("🚨 ERROR FATAL AL INICIAR FINANZAS:", error);
        document.getElementById('net-total').textContent = 'Error de conexión';
        document.getElementById('net-total').style.color = '#e74c3c';
        alert("Ocurrió un error al cargar Finanzas. Revisa la consola.");
    }
});

// --- FUNCIONES DE BASE DE DATOS ---
async function cargarProyectos() {
    try {
        const { data, error } = await window.supabaseClient.from('projects').select('title');
        if (error) throw error;

        const select = document.getElementById('f-project');
        select.innerHTML = '<option value="">-- Ninguno --</option>'; 
        if (data) {
            data.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.title; opt.textContent = p.title;
                select.appendChild(opt);
            });
        }
    } catch(e) { console.error("Error cargando lista de proyectos:", e); }
}

async function cargarFinanzas() {
    try {
        console.log("-> Solicitando transacciones...");
        const { data, error } = await window.supabaseClient
            .from('finances')
            .select('*')
            .order('date', { ascending: false });

        if (error) throw error;
        
        console.log(`-> ${data ? data.length : 0} transacciones recibidas.`);
        allTransactions = data || [];
        renderizarTodo(allTransactions);
    } catch(e) {
        console.error("Error BD Finanzas:", e);
        alert('Error descargando el historial financiero.');
    }
}

// --- PINTADO EN PANTALLA ---
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
    if(el) {
        el.textContent = `$${total.toFixed(2)}`;
        el.style.color = total >= 0 ? 'var(--dark-blue)' : 'var(--red-finance)';
    }
}

function renderizarListas(datos) {
    const incList = document.getElementById('income-list');
    const expList = document.getElementById('expense-list');
    incList.innerHTML = ''; expList.innerHTML = '';

    if (datos.length === 0) {
        incList.innerHTML = '<p style="color:#777;">No hay ingresos.</p>';
        expList.innerHTML = '<p style="color:#777;">No hay gastos.</p>';
        return;
    }

    datos.forEach(t => {
        const esIngreso = t.type === 'ingreso';
        const div = document.createElement('div');
        div.className = `transaction-card ${esIngreso ? 't-income' : 't-expense'}`;
        const projectTag = t.related_project ? `<span class="t-project-badge">📂 ${escapeHtml(t.related_project)}</span>` : '';
        const dataStr = encodeURIComponent(JSON.stringify(t));

        div.innerHTML = `
            <div class="t-info" style="flex: 1;">
                <h4 style="margin: 0 0 5px 0;">${escapeHtml(t.concept)}</h4>
                <small style="color: #666;">📅 ${t.date} ${projectTag}</small>
            </div>
            <div style="display: flex; align-items: center; gap: 15px;">
                <div class="t-amount" style="color: ${esIngreso ? 'var(--green-finance)' : 'var(--red-finance)'}; font-weight: bold; font-size: 1.1rem;">
                    ${esIngreso ? '+' : '-'}$${parseFloat(t.amount).toFixed(2)}
                </div>
                <div class="action-buttons">
                    <button onclick="prepararEdicion('${dataStr}')" class="btn-action btn-edit" title="Editar">✏️</button>
                    <button onclick="borrarMovimiento('${t.id}')" class="btn-action btn-delete" title="Eliminar">🗑️</button>
                </div>
            </div>
        `;
        if (esIngreso) incList.appendChild(div); else expList.appendChild(div);
    });
}

function actualizarGrafico(datos) {
    const canvas = document.getElementById('financeChart');
    if (!canvas) return;

    let totalIng = 0; let totalEgr = 0;
    datos.forEach(t => {
        if (t.type === 'ingreso') totalIng += parseFloat(t.amount);
        else totalEgr += parseFloat(t.amount);
    });

    if (financeChart) financeChart.destroy();
    
    // Evitar error si ambos son 0
    if(totalIng === 0 && totalEgr === 0) return;

    financeChart = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['Ingresos', 'Gastos'],
            datasets: [{
                data: [totalIng, totalEgr],
                backgroundColor: ['#2ecc71', '#e74c3c'],
                hoverOffset: 4,
                borderWidth: 0
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
}

// --- CRUD DEL MODAL ---
window.abrirModal = () => {
    resetModal(); 
    document.getElementById('finance-modal').classList.remove('hidden');
    document.getElementById('modal-title').textContent = "Registrar Nuevo Movimiento";
};

window.cerrarModal = () => { document.getElementById('finance-modal').classList.add('hidden'); resetModal(); };

function resetModal() {
    currentEditId = null; 
    document.getElementById('f-amount').value = '';
    document.getElementById('f-concept').value = '';
    document.getElementById('f-date').valueAsDate = new Date();
    document.getElementById('f-type').value = 'ingreso';
    document.getElementById('f-project').value = '';
    window.toggleProjectSelect();
}

window.prepararEdicion = (dataEncoded) => {
    const t = JSON.parse(decodeURIComponent(dataEncoded));
    currentEditId = t.id; 
    document.getElementById('f-type').value = t.type;
    document.getElementById('f-amount').value = t.amount;
    document.getElementById('f-concept').value = t.concept;
    document.getElementById('f-date').value = t.date;
    window.toggleProjectSelect(); 
    if (t.related_project) document.getElementById('f-project').value = t.related_project;
    document.getElementById('modal-title').textContent = "Editar Movimiento Existente";
    document.getElementById('finance-modal').classList.remove('hidden');
};

window.toggleProjectSelect = () => {
    const tipo = document.getElementById('f-type').value;
    const pContainer = document.getElementById('project-select-container');
    if (tipo === 'gasto') pContainer.classList.remove('hidden'); else { pContainer.classList.add('hidden'); document.getElementById('f-project').value = ''; }
};

window.guardarMovimiento = async () => {
    const btn = document.getElementById('btn-save-modal'); 
    const originalText = btn.textContent;
    btn.disabled = true; btn.textContent = "Guardando...";

    const tipo = document.getElementById('f-type').value;
    const monto = document.getElementById('f-amount').value;
    const concepto = document.getElementById('f-concept').value.trim();
    const fecha = document.getElementById('f-date').value;
    const proyecto = document.getElementById('f-project').value;

    if (!monto || !concepto || !fecha) {
        alert('Por favor completa los campos obligatorios (Monto, Concepto y Fecha).');
        btn.disabled = false; btn.textContent = originalText;
        return;
    }

    const payload = {
        type: tipo, amount: parseFloat(monto), concept: concepto, date: fecha,
        related_project: (tipo === 'gasto' && proyecto) ? proyecto : null
    };

    try {
        if (currentEditId) {
            const { error } = await window.supabaseClient.from('finances').update(payload).eq('id', currentEditId);
            if (error) throw error;
        } else {
            payload.id = Date.now().toString(); 
            const { error } = await window.supabaseClient.from('finances').insert([payload]);
            if (error) throw error;
        }
        window.cerrarModal();
        await cargarFinanzas(); 
    } catch (e) {
        console.error("Error al guardar:", e);
        alert('Error al guardar el movimiento en la base de datos.');
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

// --- FILTROS VISUALES ---
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

// --- GENERADOR DE REPORTES PDF ---
window.generarReportePDF = () => {
    const fechaStart = document.getElementById('rep-start').value;
    const fechaEnd = document.getElementById('rep-end').value;
    const tipo = document.getElementById('rep-type').value;

    if(!fechaStart || !fechaEnd) { alert("Selecciona un rango de fechas válido."); return; }

    const start = new Date(fechaStart + 'T00:00:00');
    const end = new Date(fechaEnd + 'T23:59:59');

    const datosFiltrados = allTransactions.filter(t => {
        const fechaT = new Date(t.date + 'T00:00:00'); 
        const dentroRango = fechaT >= start && fechaT <= end;
        if (!dentroRango) return false;
        if (tipo === 'todo') return true;
        return t.type === tipo;
    });

    if(datosFiltrados.length === 0) { alert("No hay movimientos registrados en este rango."); return; }
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
    
    try {
        const { jsPDF } = window.jspdf; 
        const doc = new jsPDF();

        doc.setFillColor(4, 41, 58); doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255); doc.setFontSize(22); doc.text("AESFACT", 14, 20);
        doc.setFontSize(12); doc.text("Reporte Financiero Oficial", 14, 30); doc.text(`Generado: ${new Date().toLocaleDateString()}`, 150, 30);
        
        doc.setTextColor(0, 0, 0); doc.setFontSize(10); 
        doc.text(`Periodo evaluado: ${fechaStart} hasta ${fechaEnd}`, 14, 50); 
        doc.text(`Filtro aplicado: ${tipo.toUpperCase()}`, 14, 56);

        doc.autoTable({
            startY: 65, head: [['Fecha', 'Tipo', 'Concepto', 'Proyecto', 'Monto']], body: tablaBody,
            theme: 'grid', headStyles: { fillColor: [4, 41, 58] }, alternateRowStyles: { fillColor: [240, 240, 240] }
        });

        const finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(11); doc.setTextColor(50, 50, 50); doc.text("Resumen del Periodo:", 14, finalY);
        doc.setFontSize(12); doc.setTextColor(39, 174, 96); doc.text(`Total Ingresos: $${totalIng.toFixed(2)}`, 14, finalY + 7);
        doc.setTextColor(192, 57, 43); doc.text(`Total Gastos:   $${totalEgr.toFixed(2)}`, 14, finalY + 14);
        doc.setFontSize(14); doc.setTextColor(0, 0, 0); doc.text(`Balance Neto:   $${balancePeriodo.toFixed(2)}`, 14, finalY + 24);
        
        doc.setFontSize(8); doc.setTextColor(150, 150, 150); doc.text("Documento generado por el sistema administrativo central de AESFACT.", 14, 280);
        doc.save(`Reporte_AESFACT_${fechaStart}_al_${fechaEnd}.pdf`);
    } catch(e) {
        console.error("Error PDF:", e);
        alert("Ocurrió un error al generar el PDF. Verifica tu conexión a internet.");
    }
};

function escapeHtml(text) {
    if (!text) return '';
    return text.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}