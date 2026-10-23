const API_URL = "https://script.google.com/macros/s/AKfycbw3-BvT6yDTjE19Bb9ldMuO5BEKLTgxRtCc7y0cm4vybYqokJ3LbR9BgCVbieygyex6zA/exec"; // Asegúrate de mantener tu URL exacta

let rawData = [];
let chartMesesInstance = null;
let chartEstatusInstance = null;
let semaforoFiltroActivo = 0; // 0 = Todos, 1 = Nivel 1, 2 = Nivel 2, 3 = Nivel 3
let soloCriticasS = false;

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

function toggleFiltroCriticaS() {
  soloCriticasS = !soloCriticasS;
  const card = document.getElementById('cardCriticaS');
  if (soloCriticasS) {
    card.classList.add('active');
  } else {
    card.classList.remove('active');
  }
  aplicarFiltros();
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
    const cumpleCriticaS = (!soloCriticasS || String(item.esCriticaAB).trim().toUpperCase() === 'S');

    const textoCombinado = `${item.orden} ${item.aviso} ${item.avisoY4} ${item.equipo} ${item.objetoTecnico} ${item.estacion} ${item.estatusAL}`.toLowerCase();
    const cumpleBusqueda = busqueda === '' || textoCombinado.includes(busqueda);

    return cumpleMes && cumpleEstacion && cumpleEstatus && cumpleSemaforo && cumpleCriticaS && cumpleBusqueda;
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

  // Órdenes Gestionadas (Suma: OTAU OTEF + Cancelada + Asignado a otro puesto de trabajo)
  const gestionadas = data.filter(i => {
    const est = String(i.estatusAL).toUpperCase();
    return est.includes("OTAU OTEF") || est.includes("CANCELADA") || est.includes("ASIGNADO A OTRO PUESTO DE TRABAJO");
  }).length;

  document.getElementById('kpiEjecutadas').innerText = gestionadas;

  // Porcentaje de Cumplimiento / Gestión
  const pct = ordenesUnicas > 0 ? ((gestionadas / ordenesUnicas) * 100).toFixed(1) : 0;
  document.getElementById('kpiPorcentajeEjecucion').innerText = `${pct}%`;

  // Avisos Y4 Únicos Reales (Columna AU no vacía)
  const avisosY4Validos = data.filter(i => {
    const y4 = String(i.avisoY4).trim();
    return y4 !== '' && y4 !== '0' && y4 !== String(i.aviso).trim();
  });
  const avisosY4Unicos = new Set(avisosY4Validos.map(i => i.avisoY4)).size;
  document.getElementById('kpiAvisos').innerText = avisosY4Unicos;

  // Críticas S (Columna AB)
  const criticasS = data.filter(i => String(i.esCriticaAB).trim().toUpperCase() === 'S').length;
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

function formatearFechaDDMMYYYY(fechaStr) {
  if (!fechaStr) return '-';
  let f = fechaStr;
  if (f.includes('T')) f = f.split('T')[0];
  
  const partes = f.split('-');
  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`; // DD/MM/YYYY
  }
  return f;
}

function renderizarTabla(data) {
  const tbody = document.getElementById('tbodyInspecciones');
  document.getElementById('badgeConteoFilas').innerText = `${data.length} Registros encontrados`;

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="12" class="text-center text-danger py-4">No se encontraron registros coincidentes.</td></tr>';
    return;
  }

  const hoy = new Date();
  hoy.setHours(0,0,0,0);

  let html = '';
  data.forEach(item => {
    // 1. Semáforo de Criticidad Nivel 1, 2, 3
    let semBadge = '';
    if (item.semaforoAV === 1) semBadge = '<span class="badge bg-danger">Nivel 1</span>';
    else if (item.semaforoAV === 2) semBadge = '<span class="badge bg-warning text-dark">Nivel 2</span>';
    else semBadge = '<span class="badge bg-success">Nivel 3</span>';

    // 2. Criticidad Columna AB con Colores Corporativos (D, E, N, S, X)
    const letraAB = String(item.esCriticaAB).trim().toUpperCase() || '-';
    let critBadge = '';
    switch(letraAB) {
      case 'S':
        critBadge = '<span class="badge bg-danger" title="Crítico x Seguridad">S</span>';
        break;
      case 'D':
        critBadge = '<span class="badge bg-warning text-dark" title="Crítico x Disponibilidad">D</span>';
        break;
      case 'E':
        critBadge = '<span class="badge bg-primary" title="Esencial">E</span>';
        break;
      case 'N':
        critBadge = '<span class="badge bg-secondary" title="No Crítico">N</span>';
        break;
      case 'X':
        critBadge = '<span class="badge bg-dark" title="No Valorado">X</span>';
        break;
      default:
        critBadge = `<span class="badge bg-light text-dark border">${letraAB}</span>`;
    }

    // 3. Semáforo para Fecha Fin Extrema
    let fechaLimpiaStr = item.fechaFinExtrema || '';
    if (fechaLimpiaStr.includes('T')) fechaLimpiaStr = fechaLimpiaStr.split('T')[0];
    
    let fechaBadge = '';
    const fechaFormateada = formatearFechaDDMMYYYY(fechaLimpiaStr);
    
    const est = String(item.estatusAL).toUpperCase();
    const esGestionada = est.includes("OTAU OTEF") || est.includes("CANCELADA") || est.includes("ASIGNADO A OTRO PUESTO DE TRABAJO");

    if (fechaLimpiaStr && !esGestionada) {
      const fechaObj = new Date(fechaLimpiaStr + "T00:00:00");
      const diffDias = Math.ceil((fechaObj - hoy) / (1000 * 60 * 60 * 24));

      if (diffDias < 0) {
        fechaBadge = `<span class="badge bg-danger" title="Vencido hace ${Math.abs(diffDias)} días">${fechaFormateada}</span>`;
      } else if (diffDias <= 15) {
        fechaBadge = `<span class="badge bg-warning text-dark" title="Próximo a vencer (${diffDias} días)">${fechaFormateada}</span>`;
      } else {
        fechaBadge = `<span class="badge bg-success">${fechaFormateada}</span>`;
      }
    } else {
      fechaBadge = `<span class="badge bg-light text-dark border">${fechaFormateada}</span>`;
    }

    // Aviso Y4 limpio
    const y4Texto = (item.avisoY4 && item.avisoY4 !== '0' && item.avisoY4 !== item.aviso) ? item.avisoY4 : '-';

    html += `
      <tr>
        <td class="fw-bold text-primary">${item.orden || ''}</td>
        <td>${item.aviso || ''}</td>
        <td><small class="fw-bold text-dark">${y4Texto}</small></td>
        <td><span class="badge bg-light text-dark border">${item.estacion || ''}</span></td>
        <td>${item.textoBreve || ''}</td>
        <td>${item.mes || ''}</td>
        <td>${fechaBadge}</td>
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
