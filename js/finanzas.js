// js/finanzas.js - VERSIÓN CRUD + REPORTES PDF
// ============================================

const SUPABASE_URL = 'https://vjdwzfvvbybwwymtqoym.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqZHd6ZnZ2Ynlid3d5bXRxb3ltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NzU4NDgsImV4cCI6MjA4NzA1MTg0OH0.mjdhTGIBv4BpMbYKMdeTzmssekDxjKsTmFkkas692C4';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Variables Globales
let allTransactions = [];
let financeChart = null;
let currentEditId = null; 

// --- INICIALIZACIÓN SEGURA ---
document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. Verificar sesión real de Supabase (Ya no usamos el sessionStorage inseguro)
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        alert('Acceso denegado. Debes iniciar sesión como Admin.');
        window.location.href = 'admin.html';
        return;
    }

    // 2. Verificar que tenga permiso de "finanzas" en su lista
    const permsRaw = sessionStorage.getItem('aesfact_permissions');
    if (!permsRaw || !JSON.parse(permsRaw).includes('finanzas')) {
        alert('⛔ Acceso Restringido: Tu rol no tiene permisos de Tesorería.');
        window.location.href = 'admin.html';
        return;
    }

    // 3. Cargar datos si pasó la seguridad
    await cargarProyectos();
    await cargarFinanzas();

    // Fechas por defecto
    const hoy = new Date();
    document.getElementById('f-date').valueAsDate = hoy;
    
    document.getElementById('rep-end').valueAsDate = hoy;
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    document.getElementById('rep-start').valueAsDate = primerDia;
});

// --- CARGA DE DATOS ---

async function cargarProyectos() {
    const { data, error } = await supabase.from('projects').select('title');
    if (error) return console.error(error);

    const select = document.getElementById('f-project');
    select.innerHTML = '<option value="">-- Ninguno --</option>'; 
    data.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.title;
        opt.textContent = p.title;
        select.appendChild(opt);
    });
}

async function cargarFinanzas() {
    const { data, error } = await supabase
        .from('finances')
        .select('*')
        .order('date', { ascending: false });

    if (error) return alert('Error cargando finanzas');
    
    allTransactions = data;
    renderizarTodo(allTransactions);
}

// --- RENDERIZADO (VISTA) ---

function renderizarTodo(datos) {
    actualizarTotales(datos);
    renderizarListas(datos);
    actualizarGrafico(datos);
}

function actualizarTotales(datos) {
    let ingresos = 0;
    let egresos = 0;

    datos.forEach(t => {
        if (t.type === 'ingreso') ingresos += parseFloat(t.amount);
        else egresos += parseFloat(t.amount);
    });

    const total = ingresos - egresos;
    const el = document.getElementById('net-total');
    
    el.textContent = `$${total.toFixed(2)}`;
    el.style.color = total >= 0 ? '#04293a' : '#d32f2f';
}

function renderizarListas(datos) {
    const incList = document.getElementById('income-list');
    const expList = document.getElementById('expense-list');
    incList.innerHTML = '';
    expList.innerHTML = '';

    datos.forEach(t => {
        const div = document.createElement('div');
        const esIngreso = t.type === 'ingreso';
        
        div.className = `transaction-card ${esIngreso ? 't-income' : 't-expense'}`;
        
        const projectTag = t.related_project 
            ? `<span class="t-project-badge">📂 ${escapeHtml(t.related_project)}</span>` 
            : '';

        const dataStr = encodeURIComponent(JSON.stringify(t));

        div.innerHTML = `
            <div class="t-info" style="flex: 1;">
                <h4 style="margin: 0 0 5px 0;">${escapeHtml(t.concept)}</h4>
                <small style="color: #666;">📅 ${t.date} ${projectTag}</small>
            </div>
            
            <div style="display: flex; align-items: center; gap: 15px;">
                <div class="t-amount" style="color: ${esIngreso ? '#27ae60' : '#c0392b'}; font-weight: bold; font-size: 1.1rem; margin-right: 10px;">
                    ${esIngreso ? '+' : '-'}$${parseFloat(t.amount).toFixed(2)}
                </div>
                
                <div class="action-buttons">
                    <button onclick="prepararEdicion('${dataStr}')" class="btn-action btn-edit" title="Editar Movimiento">✏️</button>
                    <button onclick="borrarMovimiento(${t.id})" class="btn-action btn-delete" title="Eliminar Movimiento">🗑️</button>
                </div>
            </div>
        `;

        if (esIngreso) incList.appendChild(div);
        else expList.appendChild(div);
    });
}

function actualizarGrafico(datos) {
    const ctx = document.getElementById('financeChart').getContext('2d');
    let totalIng = 0; let totalEgr = 0;

    datos.forEach(t => {
        if (t.type === 'ingreso') totalIng += parseFloat(t.amount);
        else totalEgr += parseFloat(t.amount);
    });

    if (financeChart) financeChart.destroy();

    financeChart = new Chart(ctx, {
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
            responsive: true,
            maintainAspectRatio: false,
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
    else {
        pContainer.classList.add('hidden');
        document.getElementById('f-project').value = ''; 
    }
};

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

    let error = null;

    if (currentEditId) {
        const response = await supabase.from('finances').update(payload).eq('id', currentEditId); 
        error = response.error;
    } else {
        const response = await supabase.from('finances').insert([payload]);
        error = response.error;
    }

    if (error) alert('Error: ' + error.message);
    else {
        alert(currentEditId ? 'Movimiento actualizado' : 'Movimiento registrado');
        cerrarModal();
        cargarFinanzas(); 
    }
    btn.disabled = false; btn.textContent = originalText;
};

window.borrarMovimiento = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este registro permanentemente?')) return;
    const { error } = await supabase.from('finances').delete().eq('id', id);
    if (error) alert('Error al borrar: ' + error.message);
    else cargarFinanzas();
};

function escapeHtml(text) {
    if (!text) return '';
    return text.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

window.filtrarFinanzas = (periodo) => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    if (periodo === 'todo') { renderizarTodo(allTransactions); return; }
    const hoy = new Date();
    const filtrados = allTransactions.filter(t => {
        const fechaT = new Date(t.date + 'T00:00:00');
        if (periodo === 'mes') return fechaT.getMonth() === hoy.getMonth() && fechaT.getFullYear() === hoy.getFullYear();
        if (periodo === 'anio') return fechaT.getFullYear() === hoy.getFullYear();
    });
    renderizarTodo(filtrados);
};

// ============================================
// --- NUEVO: GENERADOR DE REPORTES PDF ---
// ============================================

window.generarReportePDF = () => {
    // 1. Obtener valores del formulario
    const fechaStart = document.getElementById('rep-start').value;
    const fechaEnd = document.getElementById('rep-end').value;
    const tipo = document.getElementById('rep-type').value;

    if(!fechaStart || !fechaEnd) {
        alert("Por favor selecciona una fecha de inicio y fin.");
        return;
    }

    // 2. Filtrar Datos
    const start = new Date(fechaStart);
    const end = new Date(fechaEnd);
    end.setHours(23, 59, 59); // Asegurar que incluya todo el último día

    const datosFiltrados = allTransactions.filter(t => {
        const fechaT = new Date(t.date + 'T00:00:00'); // Ajuste de zona horaria simple
        const dentroRango = fechaT >= start && fechaT <= end;
        
        if (!dentroRango) return false;
        if (tipo === 'todo') return true;
        return t.type === tipo;
    });

    if(datosFiltrados.length === 0) {
        alert("No hay movimientos registrados en este rango de fechas.");
        return;
    }

    // 3. Ordenar por fecha (Antiguo a Nuevo para el reporte)
    datosFiltrados.sort((a, b) => new Date(a.date) - new Date(b.date));

    // 4. Calcular Totales del Reporte
    let totalIng = 0;
    let totalEgr = 0;
    const tablaBody = datosFiltrados.map(t => {
        const amount = parseFloat(t.amount);
        if(t.type === 'ingreso') totalIng += amount;
        else totalEgr += amount;

        return [
            t.date,
            t.type.toUpperCase(),
            t.concept,
            t.related_project || '-',
            (t.type === 'ingreso' ? '+ ' : '- ') + `$${amount.toFixed(2)}`
        ];
    });

    const balancePeriodo = totalIng - totalEgr;

    // 5. Generar PDF con jsPDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Encabezado
    doc.setFillColor(4, 41, 58); // Azul oscuro (Tu color de marca)
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("AESFACT", 14, 20);
    
    doc.setFontSize(12);
    doc.text("Reporte Financiero Oficial", 14, 30);
    doc.text(`Generado: ${new Date().toLocaleDateString()}`, 150, 30);

    // Info del Reporte
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`Periodo: ${fechaStart} al ${fechaEnd}`, 14, 50);
    doc.text(`Filtro: ${tipo.toUpperCase()}`, 14, 56);

    // Tabla
    doc.autoTable({
        startY: 65,
        head: [['Fecha', 'Tipo', 'Concepto', 'Proyecto', 'Monto']],
        body: tablaBody,
        theme: 'grid',
        headStyles: { fillColor: [4, 41, 58] }, // Azul oscuro en encabezado tabla
        alternateRowStyles: { fillColor: [240, 240, 240] }
    });

    // Totales al final
    const finalY = doc.lastAutoTable.finalY + 10;
    
    doc.setFontSize(11);
    doc.setTextColor(50, 50, 50);
    doc.text("Resumen del Periodo:", 14, finalY);
    
    doc.setFontSize(12);
    doc.setTextColor(39, 174, 96); // Verde
    doc.text(`Total Ingresos: $${totalIng.toFixed(2)}`, 14, finalY + 7);
    
    doc.setTextColor(192, 57, 43); // Rojo
    doc.text(`Total Gastos:   $${totalEgr.toFixed(2)}`, 14, finalY + 14);
    
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(`Balance Neto:   $${balancePeriodo.toFixed(2)}`, 14, finalY + 24);

    // Pie de página
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("Documento generado por el sistema administrativo de AESFACT.", 14, 280);

    // Descargar
    doc.save(`Reporte_AESFACT_${fechaStart}_${fechaEnd}.pdf`);
};