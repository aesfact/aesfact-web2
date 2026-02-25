// js/transparencia.js
// Lógica de solo lectura para el público

(() => {
    // Verificar que Supabase haya cargado antes de hacer nada
    const checkDependencies = setInterval(() => {
        if (window.supabase && typeof Chart !== 'undefined') {
            clearInterval(checkDependencies);
            iniciarTransparencia();
        }
    }, 100);

    // Timeout de seguridad de 5 segundos
    setTimeout(() => {
        clearInterval(checkDependencies);
        const tbody = document.getElementById('public-transactions');
        if (tbody && tbody.innerHTML.includes('Cargando')) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: #e74c3c;">No se pudo conectar con el servidor. Recargue la página.</td></tr>';
        }
    }, 5000);

    async function iniciarTransparencia() {
        console.log("🚀 Iniciando Portal de Transparencia...");
        
        // Reusamos el cliente global si ya existe, si no creamos uno local (Fail-safe)
        const supabaseUrl = 'https://vjdwzfvvbybwwymtqoym.supabase.co';
        const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqZHd6ZnZ2Ynlid3d5bXRxb3ltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NzU4NDgsImV4cCI6MjA4NzA1MTg0OH0.mjdhTGIBv4BpMbYKMdeTzmssekDxjKsTmFkkas692C4';
        const client = window.supabaseClient || window.supabase.createClient(supabaseUrl, supabaseKey);

        try {
            // 1. Pedir datos a Supabase
            const { data: finances, error } = await client
                .from('finances')
                .select('*')
                .order('date', { ascending: false });

            if (error) throw error;

            // 2. Calcular Totales
            let totalIngresos = 0;
            let totalGastos = 0;

            (finances || []).forEach(f => {
                if (f.type === 'ingreso') totalIngresos += parseFloat(f.amount);
                else totalGastos += parseFloat(f.amount);
            });

            const balance = totalIngresos - totalGastos;

            // 3. Pintar Números Grandes
            const elBalance = document.getElementById('public-balance');
            const elIngresos = document.getElementById('total-in');
            const elGastos = document.getElementById('total-out');

            if(elBalance) {
                elBalance.textContent = `$${balance.toFixed(2)}`;
                elBalance.style.color = balance >= 0 ? '#0d5d9e' : '#c0392b';
            }
            if(elIngresos) elIngresos.textContent = `$${totalIngresos.toFixed(2)}`;
            if(elGastos) elGastos.textContent = `$${totalGastos.toFixed(2)}`;

            // 4. Pintar Gráfico
            pintarGraficoPublico(totalIngresos, totalGastos);

            // 5. Pintar Tabla
            pintarTablaPublica(finances || []);

        } catch (e) {
            console.error("Error en transparencia:", e);
            const tbody = document.getElementById('public-transactions');
            if(tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: #e74c3c;">Ocurrió un error al cargar los registros.</td></tr>';
        }
    }

    function pintarGraficoPublico(ingresos, gastos) {
        const canvas = document.getElementById('publicChart');
        if (!canvas) return;

        if (window.miGraficoPublico) window.miGraficoPublico.destroy();

        window.miGraficoPublico = new Chart(canvas.getContext('2d'), {
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
        
        if (datos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">Aún no hay registros financieros públicos.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        datos.forEach(f => {
            const row = document.createElement('tr');
            
            const tipoTag = f.type === 'ingreso' 
                ? '<span class="tag-ingreso">INGRESO</span>' 
                : '<span class="tag-gasto">GASTO</span>';
                
            const proyecto = f.related_project 
                ? `<span style="color:#0277bd; font-weight:bold;">${escapeHtml(f.related_project)}</span>` 
                : '<span style="color:#ccc;">-</span>';

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

    function escapeHtml(text) {
        if (!text) return '';
        return text.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
})();