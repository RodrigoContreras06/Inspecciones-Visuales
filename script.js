const API_URL = "https://script.google.com/macros/s/AKfycbw3-BvT6yDTjE19Bb9ldMuO5BEKLTgxRtCc7y0cm4vybYqokJ3LbR9BgCVbieygyex6zA/exec"; // Mantén tu URL exacta de Apps Script

let rawData = [];
let chartMesesInstance = null;
let chartEstatusInstance = null; // Cambiado para enfocar en Estatus/Cumplimiento

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
        '<tr><td colspan="9" class="text-center text-danger py-4">Error al cargar datos. Verifica la URL del Apps Script API.</td></tr>';
    });
}

function poblarFiltros() {
  const selectMes = document.getElementById('selectMes');
  const selectEstacion = document.getElementById('selectEstacion');
  const selectEstatus = document.getElementById('selectEstatus');

  // Limpiar y extraer valores únicos limpios
  const meses = [...new Set(rawData.map(item => item.mes))].filter(Boolean);
  // Estación corresponde estrictamente a la columna de Puesto de Trabajo / Estación (row[4])
  const estaciones = [...new Set(rawData.map(item => item.puestoTrabajo))].filter(Boolean);
  // Estatus corresponde estrictamente al Status de Usuario o Sistema (ej. Pendiente, Programado, etc.)
  const estatusList = [...new Set(rawData.map(item => item.estatus || item.statusUsuario))].filter(Boolean);

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

function aplicarFiltros() {
  const mesSeleccionado = document.getElementById('selectMes').value;
  const estacionSeleccionada = document.getElementById('selectEstacion').value;
  const estatusSeleccionado = document.getElementById('selectEstatus').value;
  const busqueda = document.getElementById('inputBuscar').value.toLowerCase();

  const datosFiltrados = rawData.filter(item => {
    const cumpleMes = (mesSeleccionado === 'TODOS' || item.mes === mesSeleccionado);
    const cumpleEstacion = (estacionSeleccionada === 'TODAS' || item.puestoTrabajo === estacionSeleccionada);
    
    const estatusItem = item.estatus || item.statusUsuario || '';
    const cumpleEstatus = (estatusSeleccionado === 'TODOS' || estatusItem === estatusSeleccionado);
    
    // Buscador general (Orden, Aviso, Equipo, Objeto Técnico)
    const textoCombinado = `${item.orden} ${item.aviso} ${item.equipo} ${item.objetoTecnico} ${item.puestoTrabajo} ${estatusItem}`.toLowerCase();
    const cumpleBusqueda = busqueda === '' || textoCombinado.includes(busqueda);

    return cumpleMes && cumpleEstacion && cumpleEstatus && cumpleBusqueda;
  });

  actualizarKPIs(datosFiltrados);
  renderizarGraficoMeses(datosFiltrados);
  renderizarGraficoEstatus(datosFiltrados); // Gráfica circular enfocada en cumplimiento por estatus
  renderizarTabla(datosFiltrados);
}

function actualizarKPIs(data) {
  document.getElementById('kpiTotal').innerText = data.length;
  
  const ordenesUnicas = new Set(data.map(i => i.orden).filter(Boolean)).size;
  const avisosUnicos = new Set(data.map(i => i.aviso).filter(Boolean)).size;
  const equiposUnicos = new Set(data.map(i => i.equipo).filter(Boolean)).size;

  document.getElementById('kpiOrdenes').innerText = ordenesUnicas;
  document.getElementById('kpiAvisos').innerText = avisosUnicos;
  document.getElementById('kpiEquipos').innerText = equiposUnicos;
}

function renderizarTabla(data) {
  const tbody = document.getElementById('tbodyInspecciones');
  document.getElementById('badgeConteoFilas').innerText = `${data.length} Registros encontrados`;

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-4">No se encontraron registros coincidentes.</td></tr>';
    return;
  }

  let html = '';
  data.forEach(item => {
    html += `
      <tr>
        <td class="fw-bold text-primary">${item.orden || ''}</td>
        <td>${item.aviso || ''}</td>
        <td><span class="badge bg-light text-dark border">${item.puestoTrabajo || ''}</span></td>
        <td>${item.textoBreve || ''}</td>
        <td>${item.mes || ''}</td>
        <td><span class="badge bg-info text-dark">Sem ${item.semana || ''}</span></td>
        <td><small>${item.objetoTecnico || ''}</small></td>
        <td><code>${item.equipo || ''}</code></td>
        <td><small>${item.denominacionEquipo || ''}</small></td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

function renderizarGraficoMeses(data) {
  const conteoMes = {};
  data.forEach(i => {
    const m = i.mes || 'Sin Mes';
    conteoMes[m] = (conteoMes[m] || 0) + 1;
  });

  if (chartMesesInstance) chartMesesInstance.destroy();
  const ctxMes = document.getElementById('chartMeses').getContext('2d');
  chartMesesInstance = new Chart(ctxMes, {
    type: 'bar',
    data: {
      labels: Object.keys(conteoMes),
      datasets: [{
        label: 'Inspecciones',
        data: Object.values(conteoMes),
        backgroundColor: '#2a5298',
        borderRadius: 6
      }]
    },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });
}

function renderizarGraficoEstatus(data) {
  // Agrupar estrictamente por Estatus (para medir porcentaje de cumplimiento/estado)
  const conteoEstatus = {};
  data.forEach(i => {
    const est = i.estatus || i.statusUsuario || 'Sin Estatus';
    conteoEstatus[est] = (conteoEstatus[est] || 0) + 1;
  });

  const labels = Object.keys(conteoEstatus);
  const values = Object.values(conteoEstatus);

  if (chartEstatusInstance) chartEstatusInstance.destroy();
  const ctxEstatus = document.getElementById('chartPuestos').getContext('2d');
  
  // Cambiamos el título visual de la tarjeta de la gráfica si lo deseas o mantenemos la dona de cumplimiento
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
      plugins: {
        legend: { position: 'bottom' },
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
    }
  });
}
