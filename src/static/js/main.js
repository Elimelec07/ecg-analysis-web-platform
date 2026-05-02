let graficasActivas = {};
let pacienteActual = 'records500/00000/00001_hr';
let tipoRuidoActual = 'limpio';

// --- PLUGIN: PAPEL MILIMETRADO CLÍNICO PERFECTO ---
const pluginPapelECG = {
    id: 'papelECG',
    beforeDraw: (chart) => {
        const { ctx, chartArea } = chart;
        if (!chartArea) return;

        ctx.save();
        ctx.fillStyle = '#fff5f5';
        ctx.fillRect(chartArea.left, chartArea.top, chartArea.width, chartArea.height);

        // La magia clínica: 
        // X: 3 segundos a 25mm/s = 75mm exactos en pantalla
        // Y: 5 mV (-2.5 a 2.5) a 10mm/mV = 50mm exactos en pantalla
        const mmX = chartArea.width / 75; 
        const mmY = chartArea.height / 50;

        ctx.beginPath();
        // Líneas Verticales (75 milímetros de tiempo)
        for (let i = 0; i <= 75; i++) {
            let x = chartArea.left + (i * mmX);
            ctx.moveTo(x, chartArea.top); 
            ctx.lineTo(x, chartArea.bottom);
            ctx.lineWidth = (i % 5 === 0) ? 1.0 : 0.4;
            ctx.strokeStyle = (i % 5 === 0) ? 'rgba(255, 99, 132, 0.5)' : 'rgba(255, 99, 132, 0.2)';
            ctx.stroke(); ctx.beginPath();
        }
        // Líneas Horizontales (50 milímetros de voltaje)
        for (let i = 0; i <= 50; i++) {
            let y = chartArea.top + (i * mmY);
            ctx.moveTo(chartArea.left, y); 
            ctx.lineTo(chartArea.right, y);
            ctx.lineWidth = (i % 5 === 0) ? 1.0 : 0.4;
            ctx.strokeStyle = (i % 5 === 0) ? 'rgba(255, 99, 132, 0.5)' : 'rgba(255, 99, 132, 0.2)';
            ctx.stroke(); ctx.beginPath();
        }
        ctx.restore();
    }
};

// --- RENDERIZADO DE GRÁFICA (CORREGIDO) ---
function dibujarDerivacion(idCanvas, datos, fs) {
    const ctx = document.getElementById(idCanvas).getContext('2d');
    if (graficasActivas[idCanvas]) graficasActivas[idCanvas].destroy();

    const etiquetasTiempo = datos.map((_, i) => (i / fs).toFixed(3));

    graficasActivas[idCanvas] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: etiquetasTiempo,
            datasets: [{
                data: datos,
                borderColor: '#111827', // Negro tinta médica
                borderWidth: 1.2,
                pointRadius: 0, 
                tension: 0.1 
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // Fundamental para llenar la cuadrícula CSS
            animation: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: {
                // ELIMINAMOS el min y max del Eje X. 
                // Ahora Chart.js dibujará los 1500 puntos completos de la onda.
                x: { display: false },
                
                // El Eje Y sí mantiene sus límites porque son Voltios (-2.5mV a 2.5mV)
                y: { display: false, min: -2.5, max: 2.5 } 
            },
            layout: { padding: 0 }
        },
        plugins: [pluginPapelECG]
    });
}

// --- LÓGICA DE COMUNICACIÓN CON PYTHON ---
function solicitarSenales() {
    // CAMBIO IMPORTANTE AQUÍ: '/api/ecg/ptb-xl/'
    fetch(`/api/ecg/ptb-xl/${pacienteActual}?ruido=${tipoRuidoActual}`)
        .then(respuesta => respuesta.json())
        .then(datosRecibidos => {
            if(datosRecibidos.estado === 'exito') {
                const fs = datosRecibidos.frecuencia_muestreo;
                const senales = datosRecibidos.datos_12_derivaciones;
                
                const derivaciones = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'];
                derivaciones.forEach(canal => {
                    dibujarDerivacion(`grafica_${canal}`, senales[canal], fs);
                });
            } else {
                alert("Error: " + datosRecibidos.mensaje);
            }
        });
}

// --- EVENTOS DE BOTONES ---
document.getElementById('btnCargar').addEventListener('click', () => {
    pacienteActual = document.getElementById('selectPTB').value;
    tipoRuidoActual = 'limpio'; 
    solicitarSenales();
});

document.getElementById('btnTemblor').addEventListener('click', () => {
    tipoRuidoActual = 'temblor'; solicitarSenales();
});

document.getElementById('btnRespiracion').addEventListener('click', () => {
    tipoRuidoActual = 'respiracion'; solicitarSenales();
});

document.getElementById('btnLimpio').addEventListener('click', () => {
    tipoRuidoActual = 'limpio'; solicitarSenales();
});

// Cargar la primera señal automáticamente al abrir la página
window.onload = solicitarSenales;