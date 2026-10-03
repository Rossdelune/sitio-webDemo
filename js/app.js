// ══ CLIENTES EN VIVO EN FIRESTORE ══
// Cada cliente = un documento en la
// colección "clientes", ID = folio (mismo criterio que usó el botón de
// migración). Inventario/notasSencillas/folioActual/cuentas SIGUEN en
// colección "clientes" de Firestore.
async function loadClientesFS(){
  const snap = await db.collection("clientes").get();
  return snap.docs.map(d=>d.data());
}
// ID del documento: el folio normalmente, pero algunos clientes (notas
// sencillas, venta directa) no tienen folio — en ese caso se usa su "id".
function idDocCliente(c){ return String(c.folio!=null && c.folio!=="" ? c.folio : c.id); }
// Guarda UN cliente (crear o actualizar) — la mayoría de los casos.
async function saveUnCliente(cliente){
  await db.collection("clientes").doc(idDocCliente(cliente)).set(cliente);
}
// Guarda el array completo — para los pocos casos donde se reescriben varios
// clientes a la vez. Usa batch (lotes de hasta 450) para no exceder límites.
async function saveClientesFS(clientesArray){
  for(let i=0;i<clientesArray.length;i+=450){
    const chunk=clientesArray.slice(i,i+450);
    const batch=db.batch();
    chunk.forEach(c=>batch.set(db.collection("clientes").doc(idDocCliente(c)),c));
    await batch.commit();
  }
}
async function eliminarClienteFS(cliente){
  await db.collection("clientes").doc(idDocCliente(cliente)).delete();
}

// ══ INVENTARIO EN VIVO EN FIRESTORE ══
// Cada artículo = un documento en la
// colección "inventario", ID = su "id" (INV..., siempre existe, sin casos
// especiales como el folio null de clientes).
async function loadInventarioFS(){
  const snap = await db.collection("inventario").get({source:"server"});
  return snap.docs.map(d=>d.data());
}
async function saveUnArticulo(articulo){
  await db.collection("inventario").doc(String(articulo.id)).set(articulo);
}
async function eliminarArticuloFS(id){
  await db.collection("inventario").doc(String(id)).delete();
}

// Folio automático — calcula desde el máximo real en la lista de clientes
async function getNextFolio(){
  const clientes = await loadClientesFS();
  if(!clientes||clientes.length===0) return "0128";
  const foliosNum = clientes.map(c=>parseInt(c.folio,10)||127);
  const maxFolio = Math.max(...foliosNum);
  return String(maxFolio+1).padStart(4,"0");
}
async function incrementFolio(){
  const clientes = await loadClientesFS();
  if(!clientes||clientes.length===0) return "0128";
  const foliosNum = clientes.map(c=>parseInt(c.folio,10)||127);
  const maxFolio = Math.max(...foliosNum);
  return String(maxFolio+1).padStart(4,"0");
}

// ══ FECHA LOCAL (sin desfase UTC) ══
// new Date().toISOString() convierte a UTC; en Coatzacoalcos (UTC-6) eso
// hace que después de las 6:00 PM la fecha se recorra un día. Esta función
// arma la fecha con los componentes LOCALES del dispositivo (año/mes/día).
function fechaLocalISO(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const dia = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${dia}`;
}

// ══ TOAST ══
function toast(msg,type="ok"){
  const t=document.getElementById("toast");
  t.textContent=msg;t.className="toast "+type;
  setTimeout(()=>t.classList.add("show"),10);
  setTimeout(()=>t.classList.remove("show"),3000);
}

// ══ CUENTAS Y GASTOS EN VIVO EN FIRESTORE ══
// Cuentas: colección "cuentas", un documento por cuenta, ID = su "id" (cta_efectivo, etc.)
// Gastos: colección "gastos", un documento por gasto, ID = su "id"
function cuentasDefault(){
  return [
    {id:"cta_efectivo", nombre:"Efectivo", tipo:"efectivo", activa:true},
    {id:"cta_tarjeta",  nombre:"Tarjeta",  tipo:"tarjeta",  activa:true},
    {id:"cta_transf1",  nombre:"Transferencia cuenta 1", tipo:"transferencia", activa:true},
    {id:"cta_transf2",  nombre:"Transferencia cuenta 2", tipo:"transferencia", activa:true}
  ];
}
async function loadCuentasFS(){
  const snap = await db.collection("cuentas").get();
  return snap.docs.map(d=>d.data());
}
async function saveUnaCuenta(cuenta){
  await db.collection("cuentas").doc(String(cuenta.id)).set(cuenta);
}
// Si Firestore todavía no tiene ninguna cuenta, se crean las 4 base la primera vez.
async function asegurarCuentasFS(){
  const cuentas = await loadCuentasFS();
  if(cuentas.length) return cuentas;
  const defaults = cuentasDefault();
  await Promise.all(defaults.map(c=>saveUnaCuenta(c)));
  return defaults;
}
async function loadGastosFS(){
  const snap = await db.collection("gastos").get();
  return snap.docs.map(d=>d.data());
}
async function saveUnGasto(gasto){
  await db.collection("gastos").doc(String(gasto.id)).set(gasto);
}
async function eliminarGastoFS(id){
  await db.collection("gastos").doc(String(id)).delete();
}
// notasSencillas: un solo documento con un array (son solo notas de registro, no
// necesitan ser documentos individuales — se lee/escribe siempre completo).
async function agregarNotaSencillaFS(nota){
  const ref = db.collection("notasSencillas").doc("data");
  const snap = await ref.get();
  const lista = snap.exists ? (snap.data().lista||[]) : [];
  lista.push(nota);
  await ref.set({lista});
}
// Accesorios: colección "accesorios", un documento por registro, ID = su "id"
async function loadAccesoriosFS(){
  const snap = await db.collection("accesorios").get();
  return snap.docs.map(d=>d.data());
}
async function saveUnAccesorio(acc){
  await db.collection("accesorios").doc(String(acc.id)).set(acc);
}
async function eliminarAccesorioFS(id){
  await db.collection("accesorios").doc(String(id)).delete();
}
// Llena un <select> con las cuentas activas tipo "transferencia" (Transferencia cuenta 1, cuenta 2, etc.)
function poblarSelectCuentaTransferencia(selectId, valorActual){
  const sel = document.getElementById(selectId);
  if(!sel) return;
  const opciones = (allCuentas||[]).filter(c=>c.tipo==="transferencia" && c.activa);
  sel.innerHTML = '<option value="">Seleccionar cuenta...</option>' + opciones.map(c=>`<option value="${c.id}">${c.nombre}</option>`).join("");
  if(valorActual) sel.value = valorActual;
}
// Busca el id de la cuenta base (Efectivo o Tarjeta) según el método de pago
function cuentaIdPorMetodo(metodo, cuentaSeleccionadaId){
  if(!metodo) return null;
  if(metodo==="Transferencia") return cuentaSeleccionadaId || null;
  const tipo = metodo==="Efectivo" ? "efectivo" : metodo==="Tarjeta" ? "tarjeta" : null;
  if(!tipo) return null;
  const cuenta = (allCuentas||[]).find(c=>c.tipo===tipo && c.activa);
  return cuenta ? cuenta.id : null;
}
// Resuelve un cuentaId a su nombre para mostrar en tablas/reportes
function nombreCuenta(cuentaId){
  if(!cuentaId) return "Sin cuenta asignada";
  const c = (allCuentas||[]).find(x=>x.id===cuentaId);
  return c ? c.nombre : "Sin cuenta asignada";
}



// ══ NAVEGACIÓN ══
const NAVS=["clientes","pagos","pedidos","progreso","inventario","cotizaciones","mensajeria","config"];
function toggleNav(name){
  const isOpen=document.getElementById("sub-"+name).classList.contains("open");
  NAVS.forEach(n=>{
    document.getElementById("sub-"+n).classList.remove("open");
    document.getElementById("nb-"+n).classList.remove("open");
  });
  if(!isOpen){
    document.getElementById("sub-"+name).classList.add("open");
    document.getElementById("nb-"+name).classList.add("open");
  }
}
function closeAllNav(){
  NAVS.forEach(n=>{
    document.getElementById("sub-"+n).classList.remove("open");
    document.getElementById("nb-"+n).classList.remove("open");
  });
}

function goSec(id){
  // Verificar permiso — si el worker no tiene acceso, pedir auth supervisor
  if(currentUser && currentUser.role==="worker" && !tienePermiso(id)){
    solicitarAuthSuper(()=>{
      // Registrar desbloqueo temporal para esta sección y su grupo
      _desbloqueosTemp.add(id);
      const seccion = SECCIONES_CTRL.find(s=>s.subs.includes(id)||s.id===id);
      if(seccion){
        _desbloqueosTemp.add(seccion.id);
        // Quitar candado visual del botón nav
        const nb = document.getElementById("nb-"+seccion.id);
        if(nb && nb.dataset.bloqueado){
          nb.innerHTML = nb.innerHTML.replace(/🔒\s*/g,"");
          nb.style.opacity="";
          nb.dataset.bloqueado="";
        }
      }
      goSec(id);
    });
    return;
  }
  closeAllNav();
  document.querySelectorAll(".section").forEach(s=>s.classList.remove("active"));
  const sec=document.getElementById("sec-"+id);
  if(sec)sec.classList.add("active");
  if(id==="colaboradores")loadWorkers();
  if(id==="historial-accesos")loadHistorial();
  if(id==="permisos"){_permisosWorkerActual=null;renderPermisos();}
  if(id==="cuentas-config"){renderCuentasConfig();}
  if(id==="todos-pedidos"){renderPedidos();initFiltroEntregasAnio();}
  if(id==="pedidos-accesorios"){
    const pInp=document.getElementById("acc-periodo");
    if(pInp && !pInp.value) pInp.value=fechaLocalISO().slice(0,7);
    renderAccesorios();
  }
  if(id==="entregas-fecha"){initFiltroEntregasAnio();}
  if(id==="pagos-pendientes"){renderPagosPendientes();}
  if(id==="pagos-historial"){renderHistorialPagos();}
  if(id==="pagos-cuentas"){renderCuentasPagos();}
  if(id==="pagos-ingresos"){initIngresosMensuales();}
  if(id==="corte-caja"){
    const hoy=fechaLocalISO();
    const inp=document.getElementById("corte-fecha");
    if(inp && !inp.value) inp.value=hoy;
    renderCorteCaja();
  }
  if(id==="progreso-pedido"){renderProceso();}
  if(id==="progreso-agenda"){renderAgendaAjustes();}
  if(id==="progreso-diseno"){renderDiseno();}
  if(id==="progreso-formato"){renderFormatoAjustesLista();}
  if(id==="nueva-cotizacion"){resetFormCotizacion();}
  if(id==="cotizaciones-calendario"){cqCargarYRenderCalendario();}
  if(id==="inv-qr"){
    const lista=document.getElementById("inv-lista");
    if(lista) lista.innerHTML='<p style="color:#AAA;font-size:.82rem;padding:.5rem">⏳ Cargando inventario directo del servidor...</p>';
    const resumen=document.getElementById("inv-resumen-categorias");
    if(resumen) resumen.innerHTML="";
    refrescarInventarioDesdeServidor().then(renderInventario);
  }
  if(id==="inv-buscar"){
    const inp=document.getElementById("inv-buscar-input");
    if(inp) inp.value="";
    const cont=document.getElementById("inv-buscar-resultados");
    if(cont) cont.innerHTML='<p style="color:#AAA;font-size:.82rem;padding:.5rem">⏳ Cargando inventario directo del servidor...</p>';
    refrescarInventarioDesdeServidor().then(()=>buscarModeloInventario(""));
  }
  if(id==="inv-nuevo"){limpiarFormInv();}
  if(id==="lista-clientes"){renderClientes();}
  if(id==="nuevo-cliente"){limpiarFormularioCliente();}
  if(id==="mensajeria-recordatorios"){waMostrarRecordatorios();waRefrescarBadge(false);}
  if(id==="mensajeria-morosas"){waMostrarMorosas();waRefrescarBadge(false);}
  if(id==="mensajeria-historial"){waLoadHistorial();}
  if(id==="mensajeria-config"){waCargarConfigUI();}
}


// ══ GASTOS (salidas) ══
function openGastoModal(){
  document.getElementById("gm-msg").textContent="";
  document.getElementById("ga-fecha").value = fechaLocalISO();
  document.getElementById("ga-monto").value = "";
  document.getElementById("ga-desc").value = "";
  document.getElementById("ga-categoria").selectedIndex = 0;
  const sel = document.getElementById("ga-cuenta");
  const opciones = (allCuentas||[]).filter(c=>c.activa).map(c=>'<option value="'+c.id+'">'+c.nombre+'</option>').join("");
  sel.innerHTML = '<option value="">Seleccionar cuenta...</option>' + opciones;
  document.getElementById("modal-gasto").classList.add("open");
}
function closeGastoModal(){
  document.getElementById("modal-gasto").classList.remove("open");
}
async function saveGasto(){
  const fecha = document.getElementById("ga-fecha").value;
  const monto = parseFloat(document.getElementById("ga-monto").value);
  const cuentaId = document.getElementById("ga-cuenta").value;
  const categoria = document.getElementById("ga-categoria").value;
  const descripcion = document.getElementById("ga-desc").value.trim();
  const msg = document.getElementById("gm-msg");
  msg.textContent="";
  if(!fecha){ msg.textContent="Selecciona la fecha del gasto."; return; }
  if(!monto || monto<=0){ msg.textContent="Escribe un monto válido."; return; }
  if(!cuentaId){ msg.textContent="Selecciona de qué cuenta sale el dinero."; return; }
  try{
    const nuevoGasto = {
      id:"gasto_"+Date.now(), fecha, monto, cuentaId, categoria, descripcion,
      registradoPor: currentUser.user,
      registradoEn: new Date().toLocaleString("es-MX",{timeZone:"America/Mexico_City"})
    };
    await saveUnGasto(nuevoGasto);
    allGastos = [...(allGastos||[]), nuevoGasto];
    closeGastoModal();
    toast("Gasto registrado ✓");
    renderCuentasPagos();
  }catch(e){ console.error(e); msg.textContent="Error al guardar."; }
}
async function eliminarGasto(id){
  if(!confirm("¿Eliminar este gasto? Esta acción no se puede deshacer.")) return;
  try{
    await eliminarGastoFS(id);
    allGastos = (allGastos||[]).filter(g=>g.id!==id);
    toast("Gasto eliminado ✓");
    renderCuentasPagos();
  }catch(e){ console.error(e); toast("Error al eliminar","err"); }
}

// ══ ACCESORIOS (registro de compras online por cliente / venta suelta) ══
function openAccesorioModal(){
  document.getElementById("am-msg").textContent="";
  document.getElementById("ac-fecha").value = fechaLocalISO();
  const selTipo = document.getElementById("ac-tipo");
  selTipo.innerHTML = ADICIONALES.map(a=>'<option value="'+a+'">'+a+'</option>').join("") + '<option value="__otro">Otro...</option>';
  selTipo.selectedIndex = 0;
  document.getElementById("ac-otro-wrap").style.display="none";
  document.getElementById("ac-tipo-otro").value="";
  document.getElementById("ac-cantidad").value="1";
  const selCli = document.getElementById("ac-cliente");
  const opciones = (allClientes||[]).slice().sort((a,b)=>(a.folio||0)-(b.folio||0))
    .map(c=>'<option value="'+c.id+'">#'+c.folio+' — '+c.nombre+'</option>').join("");
  selCli.innerHTML = '<option value="">Sin cliente / venta suelta</option>' + opciones;
  document.getElementById("modal-accesorio").classList.add("open");
}
function closeAccesorioModal(){
  document.getElementById("modal-accesorio").classList.remove("open");
}
function toggleAccOtro(){
  const v = document.getElementById("ac-tipo").value;
  document.getElementById("ac-otro-wrap").style.display = (v==="__otro") ? "block" : "none";
}
async function saveAccesorio(){
  const fecha = document.getElementById("ac-fecha").value;
  const selTipo = document.getElementById("ac-tipo").value;
  const tipoOtro = document.getElementById("ac-tipo-otro").value.trim();
  const tipo = (selTipo==="__otro") ? tipoOtro : selTipo;
  const cantidad = parseInt(document.getElementById("ac-cantidad").value,10);
  const clienteId = document.getElementById("ac-cliente").value;
  const msg = document.getElementById("am-msg");
  msg.textContent="";
  if(!fecha){ msg.textContent="Selecciona la fecha."; return; }
  if(!tipo){ msg.textContent="Selecciona o escribe el tipo de artículo."; return; }
  if(!cantidad || cantidad<=0){ msg.textContent="Escribe una cantidad válida."; return; }
  try{
    const [accesoriosFS,clientesFS] = await Promise.all([loadAccesoriosFS(),loadClientesFS()]);
    allClientes = clientesFS;
    allAccesorios = accesoriosFS;
    const cliente = clienteId ? allClientes.find(c=>c.id===clienteId) : null;
    const nuevo = {
      id:"acc_"+Date.now(), fecha, tipo, cantidad,
      clienteId: clienteId||null, clienteNombre: cliente ? cliente.nombre : "",
      estatus:"Pedido Realizado",
      registradoPor: currentUser.user
    };
    await saveUnAccesorio(nuevo);
    allAccesorios.push(nuevo);
    closeAccesorioModal();
    toast("Accesorio registrado ✓");
    renderAccesorios();
  }catch(e){ console.error(e); msg.textContent="Error al guardar."; }
}
async function eliminarAccesorio(id){
  if(!confirm("¿Eliminar este registro? Esta acción no se puede deshacer.")) return;
  try{
    await eliminarAccesorioFS(id);
    allAccesorios = (allAccesorios||[]).filter(a=>a.id!==id);
    toast("Registro eliminado ✓");
    renderAccesorios();
  }catch(e){ console.error(e); toast("Error al eliminar","err"); }
}
function estatusClassAcc(e){
  return e==="Entregado"?"s-entregado":e==="En Tienda"?"s-tienda":e==="En Compra"?"s-compra":e==="Recibido"?"s-recibido":"s-pedido";
}
async function cambiarEstatusAccesorio(id, nuevoEstatus){
  try{
    allAccesorios = await loadAccesoriosFS();
    const idx = allAccesorios.findIndex(a=>a.id===id);
    if(idx===-1) return;
    allAccesorios[idx].estatus = nuevoEstatus;
    allAccesorios[idx].editadoPor = currentUser.user;
    allAccesorios[idx].editadoEn = new Date().toLocaleString("es-MX",{timeZone:"America/Mexico_City"});
    await saveUnAccesorio(allAccesorios[idx]);
    toast("Estatus actualizado ✓");
    renderAccesorios();
  }catch(e){ console.error(e); toast("Error al actualizar estatus","err"); }
}
async function renderAccesorios(){
  const tbodyPed = document.getElementById("acc-pedidos-tbody");
  const cardsEl = document.getElementById("acc-resumen-cards");
  const periodoInp = document.getElementById("acc-periodo");
  if(!periodoInp.value) periodoInp.value = fechaLocalISO().slice(0,7);
  const periodo = periodoInp.value; // "YYYY-MM"
  tbodyPed.innerHTML = '<tr><td colspan="6" style="color:#AAA;padding:1rem;"><span class="spinner"></span>Cargando...</td></tr>';
  let accesoriosFS, clientesFS;
  try{ [accesoriosFS,clientesFS] = await Promise.all([loadAccesoriosFS(),loadClientesFS()]); }catch(e){ tbodyPed.innerHTML='<tr><td colspan="6" style="color:var(--rojo)">Error al cargar.</td></tr>'; return; }
  allClientes = clientesFS;
  allAccesorios = accesoriosFS;

  // Tabla de pedidos activos — mismo criterio que "Todos los pedidos" de vestidos:
  // solo se muestra mientras el estatus es "Pedido Realizado" o "En Compra".
  // En cuanto pasa a "En Tienda" (o más adelante), desaparece de esta lista.
  const activos = allAccesorios.filter(a=>!a.estatus||a.estatus==="Pedido Realizado"||a.estatus==="En Compra")
    .slice().sort((a,b)=>(b.fecha||"").localeCompare(a.fecha||""));
  tbodyPed.innerHTML = activos.length ? activos.map(a=>{
    const cls = estatusClassAcc(a.estatus);
    return '<tr>'
      + '<td style="font-size:.72rem;color:#AAA">'+(a.fecha||"—")+'</td>'
      + '<td style="font-size:.78rem">'+a.tipo+'</td>'
      + '<td style="font-size:.78rem;font-weight:600">'+Number(a.cantidad||0).toLocaleString("es-MX")+'</td>'
      + '<td style="font-size:.76rem;color:#888">'+(a.clienteNombre||"Venta suelta")+'</td>'
      + '<td><select class="status-badge '+cls+'" onchange="cambiarEstatusAccesorio(\''+a.id+'\',this.value)">'
        + '<option value="Pedido Realizado" '+((!a.estatus||a.estatus==="Pedido Realizado")?"selected":"")+'>Pedido Realizado</option>'
        + '<option value="En Compra" '+(a.estatus==="En Compra"?"selected":"")+'>En Compra</option>'
        + '<option value="En Tienda" '+(a.estatus==="En Tienda"?"selected":"")+'>En Tienda</option>'
        + '<option value="Recibido" '+(a.estatus==="Recibido"?"selected":"")+'>Recibido</option>'
        + '<option value="Entregado" '+(a.estatus==="Entregado"?"selected":"")+'>Entregado</option>'
      + '</select></td>'
      + '<td><button class="ic-btn" onclick="eliminarAccesorio(\''+a.id+'\')" title="Eliminar">🗑️</button></td>'
      + '</tr>';
  }).join("") : '<tr><td colspan="6" style="color:#AAA;padding:1.5rem;text-align:center">Sin pedidos de accesorios activos 🎀</td></tr>';

  // Resumen mensual por tipo — cuenta TODOS los registros del mes sin importar estatus,
  // porque su propósito es planeación de capital, no seguimiento de entrega.
  const delMes = allAccesorios.filter(a=>(a.fecha||"").slice(0,7)===periodo);
  const porTipo = {};
  delMes.forEach(a=>{ porTipo[a.tipo] = (porTipo[a.tipo]||0) + Number(a.cantidad||0); });
  const tipos = Object.keys(porTipo).sort((x,y)=>porTipo[y]-porTipo[x]);
  cardsEl.innerHTML = tipos.length ? tipos.map(t=>
    '<div class="card" style="padding:.6rem .7rem;text-align:center">'
    + '<div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.06em;color:#AAA;margin-bottom:.25rem">'+t+'</div>'
    + '<div style="font-size:1.05rem;font-weight:700;color:var(--cafe)">'+porTipo[t].toLocaleString("es-MX")+'</div>'
    + '</div>'
  ).join("") : '<div style="color:#AAA;font-size:.8rem;padding:.4rem">Sin registros este mes.</div>';
}

// ══ INGRESOS MENSUALES (gráfica de líneas por concepto/cuenta) ══
const MESES_CORTOS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const COLORES_LINEA = ["#7A4F2A","#27AE60","#2E86AB","#C0392B","#6B4F7A","#D68910","#16A085","#8E44AD"];

async function initIngresosMensuales(){
  const sel = document.getElementById("ingresos-anio");
  let clientesFS, cuentasFS, gastosFS;
  try{ [clientesFS,cuentasFS,gastosFS] = await Promise.all([loadClientesFS(),loadCuentasFS(),loadGastosFS()]); }catch(e){ return; }
  allClientes = clientesFS;
  allCuentas = cuentasFS;
  allGastos = gastosFS;
  const anioActual = new Date().getFullYear();
  const anios = new Set([anioActual]);
  allClientes.forEach(c=>{
    const fa = (c.fechaAnticipo||c.fecha||"").slice(0,4);
    if(fa) anios.add(parseInt(fa,10));
    (c.pagos||[]).forEach(p=>{
      const fp = (p.fecha||"").slice(0,4);
      if(fp) anios.add(parseInt(fp,10));
    });
  });
  const listaAnios = Array.from(anios).filter(a=>!isNaN(a)).sort((a,b)=>b-a);
  sel.innerHTML = listaAnios.map(a=>`<option value="${a}">${a}</option>`).join("");
  sel.value = anioActual;
  renderIngresosMensuales();
}

// Construye, para el año dado, una serie de 12 meses por cada concepto:
// una por cada cuenta activa + "Sin cuenta asignada" (para no esconder dinero sin clasificar)
function calcularSeriesPorConcepto(anio){
  // seriesMap agrupa por cuentaId real (incluye cuentas inactivas o ya eliminadas del catálogo);
  // solo cae en "sin asignar" cuando el registro nunca tuvo cuentaId.
  const seriesMap = {}; // key: cuentaId o "_sin_asignar" -> montos[12]
  function sumar(cuentaId, mes, monto){
    if(mes<0||mes>11) return;
    const key = cuentaId || "_sin_asignar";
    if(!seriesMap[key]) seriesMap[key] = new Array(12).fill(0);
    seriesMap[key][mes] += monto;
  }

  allClientes.forEach(c=>{
    const fa = c.fechaAnticipo||c.fecha||"";
    if(fa.slice(0,4)===anio && Number(c.anticipo||0)>0){
      sumar(c.cuentaAnticipoId||null, parseInt(fa.slice(5,7),10)-1, Number(c.anticipo||0));
    }
    (c.pagos||[]).forEach(p=>{
      const fp = p.fecha||"";
      if(fp.slice(0,4)===anio && Number(p.monto||0)>0){
        sumar(p.cuentaId||null, parseInt(fp.slice(5,7),10)-1, Number(p.monto||0));
      }
    });
  });

  const todas = [];
  // 1) Cuentas activas del catálogo, en su orden — aunque tengan $0 este año, para que la leyenda sea estable
  allCuentas.filter(c=>c.activa).forEach(c=>{
    todas.push({id:c.id, nombre:c.nombre, montos: seriesMap[c.id] || new Array(12).fill(0)});
    delete seriesMap[c.id];
  });
  // 2) Cuentas inactivas que sí tuvieron movimientos este año — conservan su nombre real, no se pierden
  allCuentas.filter(c=>!c.activa).forEach(c=>{
    if(seriesMap[c.id]){
      todas.push({id:c.id, nombre:c.nombre+" (inactiva)", montos: seriesMap[c.id]});
      delete seriesMap[c.id];
    }
  });
  // 3) Cualquier cuentaId restante que ya no exista en el catálogo (cuenta eliminada)
  Object.keys(seriesMap).forEach(key=>{
    if(key==="_sin_asignar") return;
    todas.push({id:key, nombre:"Cuenta eliminada", montos: seriesMap[key]});
  });
  // 4) Sin cuenta asignada — solo si realmente hay algo sin clasificar
  if(seriesMap["_sin_asignar"] && seriesMap["_sin_asignar"].reduce((s,m)=>s+m,0)>0){
    todas.push({id:null, nombre:"Sin cuenta asignada", montos: seriesMap["_sin_asignar"]});
  }
  return todas;
}

// Suma los gastos generales de la tienda por mes (independiente de por cuál cuenta salieron)
function calcularGastosPorMes(anio){
  const montos = new Array(12).fill(0);
  (allGastos||[]).forEach(g=>{
    const f = g.fecha||"";
    if(f.slice(0,4)===anio && Number(g.monto||0)>0){
      const mes = parseInt(f.slice(5,7),10)-1;
      if(mes>=0 && mes<12) montos[mes] += Number(g.monto||0);
    }
  });
  return montos;
}

function renderIngresosMensuales(){
  const anio = document.getElementById("ingresos-anio").value;
  const ingresoSeries = calcularSeriesPorConcepto(anio);
  const gastosPorMes = calcularGastosPorMes(anio);
  const totalesPorMesIngreso = MESES_CORTOS.map((_,i)=> ingresoSeries.reduce((s,serie)=>s+serie.montos[i],0));
  const netaPorMes = totalesPorMesIngreso.map((ing,i)=> ing - gastosPorMes[i]);
  const totalAnio = totalesPorMesIngreso.reduce((a,b)=>a+b,0);

  document.getElementById("ingresos-total-card").innerHTML = `
    <div class="card" style="padding:.7rem .9rem;text-align:center">
      <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.1em;color:#AAA;margin-bottom:.3rem">Total recibido en ${anio}</div>
      <div style="font-size:1.3rem;font-weight:700;color:var(--dorado-d)">$${totalAnio.toLocaleString("es-MX")}</div>
    </div>`;

  // Se agregan Gastos y Ganancia neta como dos barras más por mes, junto a las de cada cuenta
  const seriesParaGrafica = [
    ...ingresoSeries,
    {id:"_gastos", nombre:"Gastos", montos:gastosPorMes, colorFijo:"#8B0000"},
    {id:"_neta",   nombre:"Ganancia neta", montos:netaPorMes, colorFijo:"#1A1A1A"}
  ];
  dibujarGraficaIngresos(seriesParaGrafica, totalesPorMesIngreso, netaPorMes);
}

function dibujarGraficaIngresos(series, totalesPorMesIngreso, netaPorMes){
  const canvas = document.getElementById("ingresos-chart");
  const legendEl = document.getElementById("ingresos-legend");
  if(!canvas) return;
  const dpr = window.devicePixelRatio||1;
  const W = Math.max(canvas.parentElement.clientWidth, 280), H = 280;
  canvas.style.width = W+"px"; canvas.style.height = H+"px";
  canvas.width = W*dpr; canvas.height = H*dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,W,H);

  const PL=56, PR=12, PT=16, PB=34, cW=W-PL-PR, cH=H-PT-PB;
  const maxMonto = Math.max(1, ...series.flatMap(s=>s.montos));
  const step = maxMonto/4;
  const cy = v => PT+cH-(v/maxMonto)*cH;
  function colorDe(serie, idx){
    if(serie.colorFijo) return serie.colorFijo;
    return serie.id===null ? "#AAAAAA" : COLORES_LINEA[idx % COLORES_LINEA.length];
  }

  // Líneas guía horizontales + eje Y
  for(let i=0;i<=4;i++){
    const v = step*i, y = cy(v);
    ctx.beginPath();
    ctx.strokeStyle = i===0 ? "#E8DDD0" : "#F2ECE1";
    ctx.lineWidth = i===0 ? 1 : 0.6;
    ctx.moveTo(PL,y); ctx.lineTo(PL+cW,y); ctx.stroke();
    ctx.fillStyle = "#AAA"; ctx.font = "10px Lato,sans-serif"; ctx.textAlign = "right";
    ctx.fillText("$"+Math.round(v).toLocaleString("es-MX"), PL-6, y+3);
  }
  // Eje X — meses (centrado sobre cada grupo de barras)
  for(let i=0;i<12;i++){
    ctx.fillStyle = "#3A2A1A"; ctx.font = "10px Lato,sans-serif"; ctx.textAlign = "center";
    ctx.fillText(MESES_CORTOS[i], PL + (cW/12)*i + (cW/12)/2, H-10);
  }

  // Barras agrupadas por mes — una barra por concepto/cuenta + Gastos + Ganancia neta
  const grupoW = cW/12;
  const barW = (grupoW*0.8) / Math.max(series.length,1);
  const maxDip = PB-10; // espacio disponible bajo el eje para un mes con pérdida (ganancia neta negativa)
  series.forEach((serie,idx)=>{
    const color = colorDe(serie, idx);
    serie.montos.forEach((monto,i)=>{
      if(monto===0) return;
      const x = PL + grupoW*i + grupoW*0.1 + barW*idx;
      ctx.fillStyle = color;
      if(monto>0){
        const y = cy(monto);
        ctx.fillRect(x, y, barW*0.9, PT+cH-y);
      } else {
        const dip = Math.min(maxDip, (Math.abs(monto)/maxMonto)*cH);
        ctx.fillRect(x, PT+cH, barW*0.9, dip);
      }
    });
  });

  // Eje base
  ctx.beginPath(); ctx.strokeStyle="#E8DDD0"; ctx.lineWidth=1;
  ctx.moveTo(PL,PT+cH); ctx.lineTo(PL+cW,PT+cH); ctx.stroke();

  // Leyenda (HTML, debajo de la gráfica)
  if(legendEl){
    legendEl.innerHTML = series.map((serie,idx)=>{
      const color = colorDe(serie, idx);
      const totalSerie = serie.montos.reduce((s,m)=>s+m,0);
      return `<div style="display:flex;align-items:center;gap:.35rem;font-size:.72rem;color:var(--texto)">
        <span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block"></span>
        ${serie.nombre} — <strong>$${totalSerie.toLocaleString("es-MX")}</strong>
      </div>`;
    }).join("");
  }

  // Fila de totales por mes — solo ingresos reales (no mezcla Gastos ni Ganancia neta, para no duplicar cifras)
  const totalesEl = document.getElementById("ingresos-totales-mes");
  if(totalesEl){
    const totalesPorMes = totalesPorMesIngreso || MESES_CORTOS.map((_,i)=> series.filter(s=>!s.colorFijo).reduce((s,serie)=>s+serie.montos[i],0));
    totalesEl.innerHTML = '<div style="width:100%;font-size:.65rem;text-transform:uppercase;letter-spacing:.08em;color:#AAA;margin-bottom:.3rem">Total recibido por mes (todas las cuentas)</div>'
      + totalesPorMes.map((total,i)=>
        `<div style="flex:1;min-width:70px;text-align:center;background:var(--bg);border-radius:4px;padding:.3rem .2rem">
          <div style="font-size:.65rem;color:#AAA">${MESES_CORTOS[i]}</div>
          <div style="font-size:.74rem;font-weight:700;color:${total>0?'var(--dorado-d)':'#CCC'}">$${total.toLocaleString("es-MX")}</div>
        </div>`
      ).join("");
  }

  // Fila de reporte — Ganancia neta por mes (ingresos - gastos), en rojo si ese mes fue pérdida
  const netaEl = document.getElementById("ingresos-neta-mes");
  if(netaEl && netaPorMes){
    const totalNetaAnio = netaPorMes.reduce((a,b)=>a+b,0);
    netaEl.innerHTML = `<div style="width:100%;font-size:.65rem;text-transform:uppercase;letter-spacing:.08em;color:#AAA;margin-bottom:.3rem">Ganancia neta por mes (ingresos − gastos) · Total del año: <strong style="color:${totalNetaAnio>=0?'var(--verde)':'var(--rojo)'}">$${totalNetaAnio.toLocaleString("es-MX")}</strong></div>`
      + netaPorMes.map((neta,i)=>
        `<div style="flex:1;min-width:70px;text-align:center;background:var(--bg);border-radius:4px;padding:.3rem .2rem;border:1px solid ${neta<0?'var(--rojo)':'transparent'}">
          <div style="font-size:.65rem;color:#AAA">${MESES_CORTOS[i]}</div>
          <div style="font-size:.74rem;font-weight:700;color:${neta>0?'var(--verde)':neta<0?'var(--rojo)':'#CCC'}">${neta<0?'-':''}$${Math.abs(neta).toLocaleString("es-MX")}</div>
        </div>`
      ).join("");
  }
}
window.addEventListener("resize", ()=>{
  const sec = document.getElementById("sec-pagos-ingresos");
  if(sec && sec.classList.contains("active")) setTimeout(renderIngresosMensuales,80);
});
