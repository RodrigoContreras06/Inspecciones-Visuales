// Coloca la URL pública de la Web App desplegada en Google Apps Script
const API_URL = "TU_URL_DE_APPS_SCRIPT_AQUI";

let rawData = [];
let chartMesesInstance = null;
let chartPuestosInstance = null;

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
  const selectPuesto = document.getElementById('selectPuesto');

  const meses = [...new Set(rawData.map(item => item.mes))].filter(Boolean);
  const puestos = [...new Set(rawData.map(item => item.puestoTrabajo))].filter(Boolean);

  selectMes.innerHTML = '<option value="TODOS">Todos los Meses</option>';
  meses.forEach(m => {
    selectMes.innerHTML += `<option value="${m}">${m}</option>`;
  });

  selectPuesto.innerHTML = '<option value="TODOS">Todos los Puestos</option>';
  puestos.forEach(p => {
    selectPuesto.innerHTML += `<option value="${p}">${p}</option>`;
  });
}

function aplicarFiltros() {
  const mesSeleccionado = document.getElementById('selectMes').value;
  const puestoSeleccionado = document.getElementById('selectPuesto').value;
  const busqueda = document.getElementById('inputBuscar').value.toLowerCase();

  const datosFiltrados = rawData.filter(item => {
    const cumpleMes = (mesSeleccionado === 'TODOS' || item.mes === mesSeleccionado);
    const cumplePuesto = (puestoSeleccionado === 'TODOS' || item.puestoTrabajo === puestoSeleccionado);
    
    const textoCombinado = `${item.orden} ${item.aviso} ${item.textoBreve} ${item.objetoTecnico} ${item.equipo} ${item.denominacionEquipo}`.toLowerCase();
    const cumpleBusqueda = busqueda === '' || textoCombinado.includes(busqueda);

    return cumpleMes && cumplePuesto && cumpleBusqueda;
  });

  actualizarKPIs(datosFiltrados);
  renderizarGraficos(datosFiltrados);
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

function renderizarGraficos(data) {
  // Conteo por Mes
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

  // Conteo por Puesto de Trabajo
  const conteoPuesto = {};
  data.forEach(i => {
    const p = i.puestoTrabajo || 'Sin Asignar';
    conteoPuesto[p] = (conteoPuesto[p] || 0) + 1;
  });

  if (chartPuestosInstance) chartPuestosInstance.destroy();
  const ctxPuesto = document.getElementById('chartPuestos').getContext('2d');
  chartPuestosInstance = new Chart(ctxPuesto, {
    type: 'doughnut',
    data: {
      labels: Object.keys(conteoPuesto),
      datasets: [{
        data: Object.values(conteoPuesto),
        backgroundColor: ['#11998e', '#f2994a', '#00b4db', '#e056fd', '#ff7979']
      }]
    },
    options: { responsive: true }
  });
}
