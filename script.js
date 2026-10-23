const API_URL = "https://script.google.com/macros/s/AKfycbw3-BvT6yDTjE19Bb9ldMuO5BEKLTgxRtCc7y0cm4vybYqokJ3LbR9BgCVbieygyex6zA/exec"; // Mantén tu URL exacta

let rawData = [];
let chartMesesInstance = null;
let chartEstatusInstance = null;
let semaforoFiltroActivo = 0; // 0 = Todos, 1 = Nivel 1, 2 = Nivel 2, 3 = Nivel 3

document.addEventListener("DOMContentLoaded", function() {
  cargarDatos();
});

function cargarDatos() {
  fetch(API_URL)
    .then(response => response.json())
    .then(data => {
      rawData = data;
      poblarFiltros();
      aplicarFiltros();
    })
    .catch(error => {
      console.error("Error al obtener los datos:", error);
      document.getElementById('tbodyInspecciones').innerHTML = 
        '<tr><td colspan="12" class="text-center text-danger py-4">Error al cargar datos. Verifica la URL de Apps Script.</td></tr>';
    });
}

function poblarFiltros() {
  const selectMes = document.getElementById('selectMes');
  const selectEstacion = document.getElementById('selectEstacion');
  const selectEstatus = document.getElementById('selectEstatus');

  const mesesOrdenadosBase = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const mesesDisponibles = [...new Set(rawData.map(item => item.mes))].filter(Boolean);
  const meses = mesesOrdenadosBase.filter(m => mesesDisponibles.includes(m));

  const estaciones = [...new Set(rawData.map(item => item.estacion))].filter(Boolean);
  const estatusList = [...new Set(rawData.map(item => item.estatusAL))].filter(Boolean);

  selectMes.innerHTML = '<option value="TODOS">Todos los Meses</option>';
  meses.forEach(m => {
    selectMes.innerHTML += `<option value="${m}">${m}</option>`;
  });

  selectEstacion.innerHTML = '<option value="TODAS">Todas</option>';
  estaciones.forEach(e => {
    selectEstacion.innerHTML += `<option value="${e}">${e}</option>`;
  });

  selectEstatus.innerHTML = '<option value="TODOS">Todos</option>';
  estatusList.forEach(es => {
    selectEstatus.innerHTML += `<option value="${es}">${es}</option>`;
  });
}

function filtrarSemaforo(nivel) {
  semaforoFiltroActivo = nivel;
  
  [1, 2, 3].forEach(n => {
    const btn = document.getElementById(`btnSem${n}`);
    if (btn) {
      if (n === nivel) btn.classList.add('active');
      else btn.classList.remove('active');
    }
  });

  aplicarFiltros();
}

function aplicarFiltros() {
  const mesSeleccionado = document.getElementById('selectMes').value;
  const estacionSeleccionada = document.getElementById('selectEstacion').value;
  const estatusSeleccionado = document.getElementById('selectEstatus').value;
  const busqueda = document.getElementById('inputBuscar').value.toLowerCase();

  const datosFiltrados = rawData.filter(item => {
    const cumpleMes = (mesSeleccionado === 'TODOS' || item.mes === mesSeleccionado);
    const cumpleEstacion = (estacionSeleccionada === 'TODAS' || item.estacion === estacionSeleccionada);
    const cumpleEstatus = (estatusSeleccionado === 'TODOS' || item.estatusAL === estatusSeleccionado);
    
    const cumpleSemaforo = (semaforoFiltroActivo === 0 || item.semaforoAV === semaforoFiltroActivo);

    const textoCombinado = `${item.orden} ${item.aviso} ${item.avisoY4} ${item.equipo} ${item.objetoTecnico} ${item.estacion} ${item.estatusAL}`.toLowerCase();
    const cumpleBusqueda = busqueda === '' || textoCombinado.includes(busqueda);

    return cumpleMes && cumpleEstacion && cumpleEstatus && cumpleSemaforo && cumpleBusqueda;
  });

  actualizarKPIsAvanzados(datosFiltrados);
  renderizarGraficoMeses(datosFiltrados);
  renderizarGraficoEstatus(datosFiltrados);
  renderizarTabla(datosFiltrados);
}

function actualizarKPIsAvanzados(data) {
  // Órdenes Únicas Totales
  const ordenesUnicas = new Set(data.map(i => i.orden).filter(Boolean)).size;
  document.getElementById('kpiOrdenesTotales').innerText = ordenesUnicas;

  // Órdenes Gestionadas (Suma de OTAU OTEF + Cancelada + Asignado a otro puesto de trabajo)
  const gestionadas = data.filter(i => {
    const est = String(i.estatusAL).toUpperCase();
    return est.includes("OTAU OTEF") || est.includes("CANCELADA") || est.includes("ASIGNADO A OTRO PUESTO DE TRABAJO");
  }).length;
  document.getElementById('kpiEjecutadas').innerText = gestionadas;

  // Avisos Y4 Únicos (Columna AU)
  const avisosY4Unicos = new Set(data.map(i => i.avisoY4 || i.aviso).filter(Boolean)).size;
  document.getElementById('kpiAvisos').innerText = avisosY4Unicos;

  // Críticas en Columna AB ('S')
  const criticasS = data.filter(i => String(i.esCriticaAB).toUpperCase() === 'S').length;
  document.getElementById('kpiCriticas').innerText = criticasS;

  // Conteo Semáforo Columna AV (1, 2, 3)
  let sem1 = 0, sem2 = 0, sem3 = 0;
  data.forEach(i => {
    if (i.semaforoAV === 1) sem1++;
    else if (i.semaforoAV === 2) sem2++;
    else sem3++;
  });
  document.getElementById('semaforo1').innerText = sem1;
  document.getElementById('semaforo2').innerText = sem2;
  document.getElementById('semaforo3').innerText = sem3;
}

function renderizarTabla(data) {
  const tbody = document.getElementById('tbodyInspecciones');
  document.getElementById('badgeConteoFilas').innerText = `${data.length} Registros encontrados`;

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="12" class="text-center text-danger py-4">No se encontraron registros coincidentes.</td></tr>';
    return;
  }

  let html = '';
  data.forEach(item => {
    // Badge de Criticidad Semáforo
    let semBadge = '';
    if (item.semaforoAV === 1) semBadge = '<span class="badge bg-danger">Nivel 1</span>';
    else if (item.semaforoAV === 2) semBadge = '<span class="badge bg-warning text-dark">Nivel 2</span>';
    else semBadge = '<span class="badge bg-success">Nivel 3</span>';

    // Badge de Criticidad Columna AB (Muestra la letra exacta: S, A, B, etc.)
    const letraAB = item.esCriticaAB || '-';
    let critBadge = '';
    if (letraAB.toUpperCase() === 'S') {
      critBadge = '<span class="badge bg-danger">S</span>';
    } else if (letraAB !== '-') {
      critBadge = `<span class="badge bg-secondary">${letraAB}</span>`;
    } else {
      critBadge = '<span class="badge bg-light text-muted border">-</span>';
    }

    // Formatear Fecha Fin Extrema limpia sin zona horaria
    let fechaLimpia = item.fechaFinExtrema || '';
    if (fechaLimpia.includes('T')) {
      fechaLimpia = fechaLimpia.split('T')[0];
    }

    html += `
      <tr>
        <td class="fw-bold text-primary">${item.orden || ''}</td>
        <td>${item.aviso || ''}</td>
        <td><small class="text-muted fw-bold">${item.avisoY4 || ''}</small></td>
        <td><span class="badge bg-light text-dark border">${item.estacion || ''}</span></td>
        <td>${item.textoBreve || ''}</td>
        <td>${item.mes || ''}</td>
        <td><small>${fechaLimpia}</small></td>
        <td><small>${item.objetoTecnico || ''}</small></td>
        <td><code class="text-danger">${item.equipo || ''}</code></td>
        <td><small>${item.denominacionEquipo || ''}</small></td>
        <td class="text-center">${critBadge}</td>
        <td class="text-center">${semBadge}</td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

function renderizarGraficoMeses(data) {
  const ordenMeses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const conteoMes = {};
  ordenMeses.forEach(m => conteoMes[m] = 0);

  data.forEach(i => {
    if (conteoMes.hasOwnProperty(i.mes)) conteoMes[i.mes]++;
  });

  const values = ordenMeses.map(m => conteoMes[m]);
  const maxVal = Math.max(...values, 5);

  if (chartMesesInstance) chartMesesInstance.destroy();
  const ctxMes = document.getElementById('chartMeses').getContext('2d');
  
  chartMesesInstance = new Chart(ctxMes, {
    type: 'bar',
    data: {
      labels: ordenMeses,
      datasets: [{
        label: 'Inspecciones',
        data: values,
        backgroundColor: '#2a5298',
        borderRadius: 6
      }]
    },
    options: { 
      responsive: true, 
      maintainAspectRatio: false,
      plugins: { 
        legend: { display: false }
      },
      scales: {
        y: { 
          beginAtZero: true, 
          suggestedMax: maxVal + 3,
          ticks: { precision: 0 } 
        }
      }
    },
    plugins: [{
      id: 'customLabelsBar',
      afterDatasetsDraw(chart) {
        const { ctx } = chart;
        chart.data.datasets.forEach((dataset, i) => {
          const meta = chart.getDatasetMeta(i);
          meta.data.forEach((bar, index) => {
            const dataVal = dataset.data[index];
            if (dataVal > 0) {
              ctx.fillStyle = '#333';
              ctx.font = 'bold 11px sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'bottom';
              ctx.fillText(dataVal, bar.x, bar.y - 4);
            }
          });
        });
      }
    }]
  });
}

function renderizarGraficoEstatus(data) {
  const conteoEstatus = {};
  data.forEach(i => {
    const est = i.estatusAL || 'Sin Estatus';
    conteoEstatus[est] = (conteoEstatus[est] || 0) + 1;
  });

  const labels = Object.keys(conteoEstatus);
  const values = Object.values(conteoEstatus);

  if (chartEstatusInstance) chartEstatusInstance.destroy();
  const ctxEstatus = document.getElementById('chartPuestos').getContext('2d');
  
  chartEstatusInstance = new Chart(ctxEstatus, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: ['#11998e', '#f2994a', '#00b4db', '#e056fd', '#ff7979', '#2ed573']
      }]
    },
    options: { 
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: function(context) {
              const total = values.reduce((a, b) => a + b, 0);
              const val = context.raw;
              const porcentaje = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
              return ` ${context.label}: ${val} (${porcentaje}%)`;
            }
          }
        }
      }
    },
    plugins: [{
      id: 'customLabelsDoughnut',
      afterDatasetsDraw(chart) {
        const { ctx } = chart;
        const meta = chart.getDatasetMeta(0);
        if (!meta.hidden) {
          meta.data.forEach((element, index) => {
            const dataVal = chart.data.datasets[0].data[index];
            if (dataVal > 0) {
              const { x, y } = element.tooltipPosition();
              ctx.fillStyle = '#000';
              ctx.font = 'bold 11px sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(dataVal, x, y);
            }
          });
        }
      }
    }]
  });
}
