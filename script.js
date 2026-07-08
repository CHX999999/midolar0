const configs = [
    { id: 'oficial', keys: ['Oficial'], l: 'Banco Nación' },
    { id: 'blue', keys: ['Blue'], l: 'Mercado Informal' },
    { id: 'tarjeta', keys: ['Tarjeta'], l: 'Impuestos' },
    { id: 'mep', keys: ['Bolsa', 'MEP'], l: 'Bolsa' },
    { id: 'ccl', keys: ['Contado con liquidación', 'CCL'], l: 'Liqui' },
    { id: 'cripto', keys: ['Cripto', 'Bitcoin'], l: 'Stablecoin' }
];

const container = document.getElementById('cards-view');
let charts = {}, lastPrices = {}, priceHistory = {}, fullHistory = {};
let currentView = 'cards';
let currentTimeframe = '1H';
let isFirstLoad = true;
let retryCount = 0;
const MAX_RETRIES = 3;

// Elementos del DOM
const loadingOverlay = document.getElementById('loading-overlay');
const errorBanner = document.getElementById('error-banner');
const errorMessage = document.getElementById('error-message');
const errorDismiss = document.getElementById('error-dismiss');
const updatePill = document.getElementById('last-update');
const themeToggle = document.getElementById('theme-toggle');
const viewToggle = document.getElementById('view-toggle');
const exportBtn = document.getElementById('export-btn');
const notification = document.getElementById('notification');

// Modo oscuro automático según sistema
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        if (savedTheme === 'light') document.body.classList.add('light-mode');
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        document.body.classList.add('light-mode');
    }
}
initTheme();

// Registrar Service Worker para PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('Service Worker registrado:', registration);
            })
            .catch(error => {
                console.log('Error al registrar Service Worker:', error);
            });
    });
}

// Inicialización de tarjetas con elementos avanzados
configs.forEach(m => {
    priceHistory[m.id] = Array(10).fill(0);
    fullHistory[m.id] = [];
    container.innerHTML += `
    <article class="card" id="card-${m.id}">
        <div class="card-top">
            <h2>${m.id.toUpperCase()}</h2>
            <span class="label-tag">${m.l}</span>
        </div>
        <div class="info-group">
            <div class="small-label">Compra</div>
            <div class="price-val" id="${m.id}-compra">---</div>
        </div>
        <div class="info-group">
            <div class="main-price" id="${m.id}-venta">---</div>
            <span class="spread-tag" id="${m.id}-spread">DIFERENCIA: ---</span>
            <div class="stats-row" id="${m.id}-stats"></div>
            <div class="converted-val" id="${m.id}-converted"></div>
        </div>
        <div class="chart-wrap">
            <div id="chart-${m.id}"></div>
        </div>
    </article>`;
});

// Inicializar gráficos
function initCharts() {
    const isLightMode = document.body.classList.contains('light-mode');
    const chartColors = {
        line: isLightMode ? '#0284C7' : '#38BDF8',
        area: isLightMode ? 'rgba(2, 132, 199, 0.15)' : 'rgba(56, 189, 248, 0.15)'
    };

    configs.forEach(m => {
        const options = {
            series: [{
                name: 'Precio',
                data: priceHistory[m.id]
            }],
            chart: {
                type: 'area',
                height: 45,
                sparkline: {
                    enabled: true
                },
                animations: {
                    enabled: true,
                    easing: 'easeinout',
                    speed: 800
                }
            },
            stroke: {
                curve: 'smooth',
                width: 2.5
            },
            fill: {
                type: 'gradient',
                gradient: {
                    shadeIntensity: 1,
                    opacityFrom: 0.5,
                    opacityTo: 0.05,
                    stops: [0, 100]
                }
            },
            colors: [chartColors.line],
            tooltip: {
                enabled: true,
                theme: isLightMode ? 'light' : 'dark',
                style: {
                    fontSize: '12px',
                    fontFamily: 'Inter, sans-serif'
                },
                y: {
                    formatter: function(value) {
                        return '$' + value.toFixed(2);
                    }
                }
            }
        };

        charts[m.id] = new ApexCharts(document.querySelector(`#chart-${m.id}`), options);
        charts[m.id].render();
    });
}

// Actualizar colores de gráficos al cambiar tema
function updateChartColors() {
    const isLightMode = document.body.classList.contains('light-mode');
    const chartColors = {
        line: isLightMode ? '#0284C7' : '#38BDF8',
        area: isLightMode ? 'rgba(2, 132, 199, 0.1)' : 'rgba(56, 189, 248, 0.1)'
    };

    Object.keys(charts).forEach(id => {
        charts[id].updateOptions({
            colors: [chartColors.line],
            fill: {
                type: 'gradient',
                gradient: {
                    shadeIntensity: 1,
                    opacityFrom: 0.4,
                    opacityTo: 0.05,
                    stops: [0, 100]
                }
            },
            tooltip: {
                theme: isLightMode ? 'light' : 'dark'
            }
        });
    });
}

// Calcular estadísticas
function calculateStats(history) {
    if (history.length < 2) return { max: 0, min: 0, avg: 0, volatility: 0, change: 0, changePercent: 0 };
    
    const prices = history.filter(p => p > 0);
    if (prices.length === 0) return { max: 0, min: 0, avg: 0, volatility: 0, change: 0, changePercent: 0 };
    
    const max = Math.max(...prices);
    const min = Math.min(...prices);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const volatility = ((max - min) / avg * 100).toFixed(2);
    const change = prices[prices.length - 1] - prices[0];
    const changePercent = ((change / prices[0]) * 100).toFixed(2);
    
    return { max, min, avg, volatility, change, changePercent };
}

// Actualizar badges de estadísticas
function updateStatsBadges(id, stats) {
    const statsEl = document.getElementById(`${id}-stats`);
    if (!statsEl) return;
    
    statsEl.innerHTML = `
        <span class="stat-badge">MÁX: $${stats.max.toFixed(2)}</span>
        <span class="stat-badge">MÍN: $${stats.min.toFixed(2)}</span>
        <span class="stat-badge">VOL: ${stats.volatility}%</span>
    `;
}

// Mostrar/ocultar loading
function showLoading(show) {
    if (show) {
        loadingOverlay.classList.add('visible');
        updatePill.classList.add('is-loading');
    } else {
        loadingOverlay.classList.remove('visible');
        updatePill.classList.remove('is-loading');
    }
}

// Mostrar error
function showError(message) {
    errorMessage.textContent = message;
    errorBanner.hidden = false;
    setTimeout(() => {
        errorBanner.classList.add('visible');
    }, 10);
    updatePill.classList.add('has-error');
}

// Ocultar error
function hideError() {
    errorBanner.classList.remove('visible');
    setTimeout(() => {
        errorBanner.hidden = true;
    }, 350);
    updatePill.classList.remove('has-error');
}

// Mostrar notificación
function showNotification(message) {
    notification.textContent = message;
    notification.hidden = false;
    setTimeout(() => {
        notification.hidden = true;
    }, 4000);
}

// Lógica de conversión
window.validarYConvertir = () => {
    const input = document.getElementById('monto-usuario');
    const monto = parseFloat(input.value);
    
    configs.forEach(m => {
        const display = document.getElementById(`${m.id}-converted`);
        if (!isNaN(monto) && monto > 0 && lastPrices[m.id]) {
            const res = (monto / lastPrices[m.id]).toFixed(2);
            display.innerHTML = `RECIBÍS: ${res} USD`;
            display.style.opacity = '1';
        } else { 
            display.innerHTML = ''; 
            display.style.opacity = '0';
        }
    });
};

// Actualizar gráficos con nuevos datos
function updateCharts() {
    configs.forEach(m => {
        if (lastPrices[m.id]) {
            priceHistory[m.id].shift();
            priceHistory[m.id].push(lastPrices[m.id]);
            
            fullHistory[m.id].push({
                price: lastPrices[m.id],
                timestamp: Date.now()
            });
            
            // Mantener historial según timeframe
            const maxHistory = getTimeframeMax(currentTimeframe);
            if (fullHistory[m.id].length > maxHistory) {
                fullHistory[m.id] = fullHistory[m.id].slice(-maxHistory);
            }
            
            charts[m.id].updateSeries([{
                data: priceHistory[m.id]
            }]);
        }
    });
}

// Obtener máximo de historial según timeframe
function getTimeframeMax(tf) {
    const map = { '1H': 60, '24H': 288, '7D': 2016, '30D': 8640 };
    return map[tf] || 60;
}

// Cambiar timeframe
function changeTimeframe(tf) {
    currentTimeframe = tf;
    document.querySelectorAll('.timeframe-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tf === tf);
    });
    
    // Actualizar datos de gráficos según timeframe
    configs.forEach(m => {
        const maxHistory = getTimeframeMax(tf);
        const relevantHistory = fullHistory[m.id].slice(-maxHistory);
        priceHistory[m.id] = relevantHistory.map(h => h.price);
        
        if (charts[m.id]) {
            charts[m.id].updateSeries([{
                data: priceHistory[m.id]
            }]);
        }
    });
}

// Actualizar tabla comparativa
function updateTable() {
    const tbody = document.getElementById('table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    configs.forEach(m => {
        const stats = calculateStats(fullHistory[m.id] || []);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${m.id.toUpperCase()}</strong></td>
            <td id="table-${m.id}-compra">---</td>
            <td id="table-${m.id}-venta">---</td>
            <td id="table-${m.id}-spread">---</td>
            <td id="table-${m.id}-change">---</td>
            <td>$${stats.max.toFixed(2)}</td>
            <td>$${stats.min.toFixed(2)}</td>
            <td>${stats.volatility}%</td>
        `;
        tbody.appendChild(row);
    });
}

// Actualizar datos de tabla
function updateTableData() {
    configs.forEach(m => {
        const compraEl = document.getElementById(`table-${m.id}-compra`);
        const ventaEl = document.getElementById(`table-${m.id}-venta`);
        const spreadEl = document.getElementById(`table-${m.id}-spread`);
        const changeEl = document.getElementById(`table-${m.id}-change`);
        
        if (compraEl && lastPrices[m.id]) {
            const compra = document.getElementById(`${m.id}-compra`)?.textContent || '---';
            const venta = document.getElementById(`${m.id}-venta`)?.textContent || '---';
            const spread = document.getElementById(`${m.id}-spread`)?.textContent.replace('DIFERENCIA: ', '') || '---';
            const stats = calculateStats(fullHistory[m.id] || []);
            
            compraEl.textContent = compra;
            ventaEl.textContent = venta;
            spreadEl.textContent = spread;
            
            const sign = stats.change > 0 ? '+' : '';
            const color = stats.change > 0 ? '#10B981' : stats.change < 0 ? '#EF4444' : '#94A3B8';
            changeEl.innerHTML = `<span style="color: ${color}">${sign}${stats.changePercent}%</span>`;
        }
    });
}

// Cambiar vista
function toggleView() {
    currentView = currentView === 'cards' ? 'table' : 'cards';
    document.getElementById('cards-view').hidden = currentView !== 'cards';
    document.getElementById('table-view').hidden = currentView !== 'table';
    
    if (currentView === 'table') {
        updateTable();
        updateTableData();
    }
}

// Exportar datos
function exportData(format) {
    const data = configs.map(m => ({
        dolar: m.id.toUpperCase(),
        label: m.l,
        compra: document.getElementById(`${m.id}-compra`)?.textContent,
        venta: document.getElementById(`${m.id}-venta`)?.textContent,
        spread: document.getElementById(`${m.id}-spread`)?.textContent.replace('DIFERENCIA: ', ''),
        history: fullHistory[m.id]
    }));
    
    let content, filename, type;
    
    if (format === 'json') {
        content = JSON.stringify(data, null, 2);
        filename = 'dolar-elite-data.json';
        type = 'application/json';
    } else {
        const headers = ['Dólar', 'Etiqueta', 'Compra', 'Venta', 'Spread'];
        const rows = data.map(m => [m.dolar, m.label, m.compra, m.venta, m.spread]);
        content = [headers, ...rows].map(row => row.join(',')).join('\n');
        filename = 'dolar-elite-data.csv';
        type = 'text/csv';
    }
    
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    
    showNotification(`Datos exportados en ${format.toUpperCase()}`);
}

// Actualización de datos
async function update() {
    try {
        const res = await fetch('https://dolarapi.com/v1/dolares');
        
        if (!res.ok) {
            throw new Error(`Error HTTP: ${res.status}`);
        }
        
        const data = await res.json();
        
        let updatedCount = 0;
        
        data.forEach(i => {
            const c = configs.find(x => x.keys.includes(i.nombre));
            if(c && i.venta) {
                lastPrices[c.id] = i.venta;
                
                const compraEl = document.getElementById(`${c.id}-compra`);
                const ventaEl = document.getElementById(`${c.id}-venta`);
                const spreadEl = document.getElementById(`${c.id}-spread`);
                
                // Animación de cambio de precio
                const oldVenta = parseFloat(ventaEl.textContent) || 0;
                const newVenta = i.venta;
                
                compraEl.innerText = i.compra ? i.compra.toFixed(2) : '---';
                ventaEl.innerText = newVenta.toFixed(2);
                spreadEl.innerHTML = `DIFERENCIA: ${i.compra ? (i.venta - i.compra).toFixed(2) : '--'}`;
                
                // Actualizar estadísticas
                const stats = calculateStats(fullHistory[c.id] || []);
                updateStatsBadges(c.id, stats);
                
                // Efecto visual si el precio cambió
                if (oldVenta !== 0 && oldVenta !== newVenta) {
                    ventaEl.style.color = newVenta > oldVenta ? '#10B981' : '#EF4444';
                    setTimeout(() => {
                        ventaEl.style.color = '';
                    }, 1000);
                }
                
                updatedCount++;
            }
        });
        
        if (updatedCount > 0) {
            const now = new Date();
            updatePill.innerText = `Actualizado: ${now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
            hideError();
            retryCount = 0;
            
            if (!isFirstLoad) {
                updateCharts();
                if (currentView === 'table') {
                    updateTableData();
                }
            }
            
            validarYConvertir();
        } else {
            throw new Error('No se recibieron datos válidos');
        }
        
    } catch(e) { 
        console.error("Error al actualizar precios:", e);
        retryCount++;
        
        if (retryCount <= MAX_RETRIES) {
            showError(`No se pudieron obtener las cotizaciones. Reintentando (${retryCount}/${MAX_RETRIES})...`);
            setTimeout(update, 3000);
        } else {
            showError('No se pudieron obtener las cotizaciones. Verifica tu conexión.');
            retryCount = 0;
        }
    }
}

// Eventos
themeToggle.onclick = () => {
    document.body.classList.toggle('light-mode');
    localStorage.setItem('theme', document.body.classList.contains('light-mode') ? 'light' : 'dark');
    updateChartColors();
};

viewToggle.onclick = toggleView;

exportBtn.onclick = () => {
    const format = prompt('Exportar como (json/csv):', 'json');
    if (format && ['json', 'csv'].includes(format.toLowerCase())) {
        exportData(format.toLowerCase());
    }
};

errorDismiss.onclick = () => {
    hideError();
};

document.getElementById('monto-usuario').addEventListener('input', validarYConvertir);

// Timeframe buttons
document.querySelectorAll('.timeframe-btn').forEach(btn => {
    btn.onclick = () => changeTimeframe(btn.dataset.tf);
});

// Inicialización
async function init() {
    showLoading(true);
    
    // Esperar a que ApexCharts esté disponible
    if (typeof ApexCharts === 'undefined') {
        await new Promise(resolve => {
            const checkInterval = setInterval(() => {
                if (typeof ApexCharts !== 'undefined') {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
        });
    }
    
    initCharts();
    await update();
    
    showLoading(false);
    isFirstLoad = false;
    
    // Actualizar cada 30 segundos
    setInterval(update, 30000);
}

// Iniciar aplicación
init();
