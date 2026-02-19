// js/transparencia.js
// Lógica de solo lectura para el público
// (Encapsulada para evitar conflictos con app.js)

(() => { // <--- INICIO DE LA BURBUJA

    // Definimos nombres locales para evitar choque con app.js
    const SUPABASE_URL = 'https://vjdwzfvvbybwwymtqoym.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqZHd6ZnZ2Ynlid3d5bXRxb3ltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NzU4NDgsImV4cCI6MjA4NzA1MTg0OH0.mjdhTGIBv4BpMbYKMdeTzmssekDxjKsTmFkkas692C4';

    // Creamos un cliente local exclusivo para esta página
    const supabaseLocal = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    document.addEventListener('DOMContentLoaded', () => {
        console.log("🚀 Cargando módulo de transparencia...");
        cargarDatosPublicos();
    });

    async function cargarDatosPublicos() {
        // 1. Pedir datos a Supabase (Ordenados por fecha reciente)
        const { data: finances, error } = await supabaseLocal
            .from('finances')
            .select('*')
            .order('date', { ascending: false });

        if (error) {
            console.error("Error cargando transparencia:", error);
            const tabla = document.getElementById('public-transactions');
            if(tabla) tabla.innerHTML = '<tr><td colspan="5" style="text-align:center; color: red;">Error de conexión. Intente más tarde.</td></tr>';
            return;
        }

        console.log("Datos recibidos:", finances); // Para depuración

        // 2. Calcular Totales
        let totalIngresos = 0;
        let totalGastos = 0;

        finances.forEach(f => {
            if (f.type === 'ingreso') totalIngresos += parseFloat(f.amount);
            else totalGastos += parseFloat(f.amount);
        });

        const balance = totalIngresos - totalGastos;

        // 3. Pintar Números Grandes (Verificamos que existan los elementos)
        const elBalance = document.getElementById('public-balance');
        const elIngresos = document.getElementById('total-in');
        const elGastos = document.getElementById('total-out');

        if(elBalance) elBalance.textContent = `$${balance.toFixed(2)}`;
        if(elIngresos) elIngresos.textContent = `$${totalIngresos.toFixed(2)}`;
        if(elGastos) elGastos.textContent = `$${totalGastos.toFixed(2)}`;

        // Cambiar color del balance según sea positivo o negativo
        if(elBalance) elBalance.style.color = balance >= 0 ? '#0d5d9e' : '#c0392b';

        // 4. Pintar Gráfico
        pintarGraficoPublico(totalIngresos, totalGastos);

        // 5. Pintar Tabla
        pintarTablaPublica(finances);
    }

    function pintarGraficoPublico(ingresos, gastos) {
        const canvas = document.getElementById('publicChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        // Destruir gráfico anterior si existe (por si acaso)
        if (window.miGraficoPublico) window.miGraficoPublico.destroy();

        window.miGraficoPublico = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Ingresos (Entradas)', 'Gastos (Inversión)'],
                datasets: [{
                    data: [ingresos, gastos],
                    backgroundColor: ['#2ecc71', '#e74c3c'], 
                    borderWidth: 0,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) label += ': ';
                                label += `$${context.raw.toFixed(2)}`;
                                return label;
                            }
                        }
                    }
                }
            }
        });
    }

    function pintarTablaPublica(datos) {
        const tbody = document.getElementById('public-transactions');
        if(!tbody) return;
        
        tbody.innerHTML = '';

        if (datos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">Aún no hay registros financieros públicos.</td></tr>';
            return;
        }

        datos.forEach(f => {
            const row = document.createElement('tr');
            
            // Formato de etiqueta (Ingreso/Gasto)
            const tipoTag = f.type === 'ingreso' 
                ? '<span class="tag-ingreso">INGRESO</span>' 
                : '<span class="tag-gasto">GASTO</span>';
                
            // Proyecto (si existe)
            const proyecto = f.related_project 
                ? `<span style="color:#0277bd; font-weight:bold;">${escapeHtml(f.related_project)}</span>` 
                : '<span style="color:#ccc;">-</span>';

            // Monto con color
            const colorMonto = f.type === 'ingreso' ? '#27ae60' : '#c0392b';
            const signo = f.type === 'ingreso' ? '+' : '-';

            row.innerHTML = `
                <td>${f.date}</td>
                <td>${tipoTag}</td>
                <td>${escapeHtml(f.concept)}</td>
                <td>${proyecto}</td>
                <td style="color:${colorMonto}; font-weight:bold;">${signo}$${parseFloat(f.amount).toFixed(2)}</td>
            `;
            tbody.appendChild(row);
        });
    }

    // Utilidad simple para seguridad de texto
    function escapeHtml(text) {
        if (!text) return '';
        return text.toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

})(); // <--- FIN DE LA BURBUJA