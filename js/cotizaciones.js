// ══ COTIZACIONES EN VIVO EN FIRESTORE ══
// Cada cotización = un documento en la colección "cotizaciones", ID propio
// ("cot_"+Date.now()), completamente separado de la colección "clientes"
// y de su folio — así nunca se mezcla con compras reales.
let allCotizaciones = [];
let currentPkgCQ = "xv";
let _cqCal = { year:null, month:null, selDate:null };

async function loadCotizacionesFS(){
  const snap = await db.collection("cotizaciones").get();
  return snap.docs.map(d=>d.data());
}
async function saveUnaCotizacion(cot){
  await db.collection("cotizaciones").doc(String(cot.id)).set(cot);
}
// Eliminar cotización — mismo patrón de confirm() que ya usan accesorios,
// gastos e inventario. Borra el documento de Firestore y lo quita del
// arreglo local para refrescar la vista sin recargar todo el calendario.
async function eliminarCotizacionFS(id){
  if(!currentUser || currentUser.role!=="admin"){
    toast("Solo un administrador puede eliminar cotizaciones", "error");
    return;
  }
  if(!confirm("¿Eliminar esta cotización? Esta acción no se puede deshacer.")) return;
  try{
    await db.collection("cotizaciones").doc(String(id)).delete();
    allCotizaciones = allCotizaciones.filter(c=>c.id!==id);
    toast("✓ Cotización eliminada");
    renderCqCalendario();
  }catch(e){
    console.error(e);
    toast("Error al eliminar la cotización", "error");
  }
}
// Folio propio de cotizaciones — mismo criterio que getNextFolio() de clientes
// (máximo existente + 1), pero en su propio contador ("COT-0001", "COT-0002"...).
async function getNextFolioCotizacion(){
  const cots = await loadCotizacionesFS();
  if(!cots||cots.length===0) return "COT-0001";
  const nums = cots.map(c=>parseInt(String(c.folio||"").replace("COT-",""),10)||0);
  const max = Math.max(...nums);
  return "COT-"+String(max+1).padStart(4,"0");
}

// ══ PAQUETE — reutiliza PKG_XV/PKG_NOVIA/PKG_CUSTOM (mismos datos que Nuevo
// cliente), pero con su propio contenedor DOM (cq-pkg-components) para no
// pisar los IDs del formulario de clientes. ══
function cqSelPkg(type){
  currentPkgCQ = type;
  ["xv","novia","solo","custom"].forEach(t=>{
    document.getElementById("cq-pb-"+t).classList.toggle("active", t===type);
  });
  cqInitPkgComponents(type);
}
function cqInitPkgComponents(type){
  const cont = document.getElementById("cq-pkg-components");
  if(type==="solo"){ cont.innerHTML='<p style="font-size:.8rem;color:#AAA;padding:.5rem 0">Sin paquete — solo vestido.</p>'; return; }
  const items = type==="novia"?PKG_NOVIA:type==="custom"?PKG_CUSTOM:PKG_XV;
  const isCustom = type==="custom";
  cont.innerHTML = items.map(c=>`
    <div class="comp-item" id="cq-ci-${c.id}">
      <input type="checkbox" class="comp-check" id="cq-chk-${c.id}" ${!isCustom?"checked":""} onchange="cqToggleComp('${c.id}')">
      <div class="comp-body">
        <div class="comp-name">${c.name}</div>
        <div class="comp-opts" id="cq-opts-${c.id}">
          ${c.opts.map(o=>`<button class="comp-opt ${o===c.default?"sel":""}" onclick="cqSelOpt('${c.id}','${o}',this)">${o}</button>`).join("")}
        </div>
      </div>
    </div>`).join("");
}
function cqSelOpt(compId,opt,btn){
  document.querySelectorAll(`#cq-opts-${compId} .comp-opt`).forEach(b=>b.classList.remove("sel"));
  btn.classList.add("sel");
}
function cqToggleComp(id){
  const chk = document.getElementById("cq-chk-"+id);
  const body = document.querySelector(`#cq-ci-${id} .comp-body`);
  body.style.opacity = chk.checked ? "1" : ".35";
}
function cqGetPkgData(){
  if(currentPkgCQ==="solo") return {tipo:"solo", componentes:[]};
  const items = currentPkgCQ==="novia"?PKG_NOVIA:currentPkgCQ==="custom"?PKG_CUSTOM:PKG_XV;
  const comps = items.map(c=>{
    const chk = document.getElementById("cq-chk-"+c.id);
    if(!chk||!chk.checked) return null;
    const selBtn = document.querySelector(`#cq-opts-${c.id} .comp-opt.sel`);
    return {id:c.id, name:c.name, opcion: selBtn?selBtn.textContent:""};
  }).filter(Boolean);
  return {tipo:currentPkgCQ, componentes:comps};
}
// Re-aplica los componentes guardados de una cotización (usado al editar):
// marca los checkboxes que estaban activos y selecciona la opción guardada
// de cada uno, sobre el markup recién generado por cqInitPkgComponents.
function cqAplicarComponentesGuardados(componentes){
  if(!componentes || !componentes.length) return;
  componentes.forEach(comp=>{
    const chk = document.getElementById("cq-chk-"+comp.id);
    if(!chk) return;
    chk.checked = true;
    cqToggleComp(comp.id);
    const opts = document.querySelectorAll(`#cq-opts-${comp.id} .comp-opt`);
    opts.forEach(b=>{
      b.classList.toggle("sel", b.textContent===comp.opcion);
    });
  });
}
function cqCalcTotal(){
  const vestido = parseFloat(document.getElementById("cq-precio").value)||0;
  const paquete = parseFloat(document.getElementById("cq-precio-paquete").value)||0;
  const total = vestido + paquete;
  document.getElementById("cq-resumen-total").textContent = "$"+total.toLocaleString("es-MX");
}

function resetFormCotizacion(){
  window._cqEditandoId = null;
  ["cq-nombre","cq-tel","cq-marca","cq-modelo","cq-color-name","cq-precio","cq-precio-paquete","cq-promocion",
   "cq-fecha-cita","cq-fecha-evento","cq-vigencia","cq-obs"].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value="";
  });
  const origen=document.getElementById("cq-origen"); if(origen) origen.value="";
  const msg=document.getElementById("cotizacion-msg"); if(msg) msg.textContent="";
  const titulo=document.querySelector("#sec-nueva-cotizacion .sec-title"); if(titulo) titulo.textContent="Nueva cotización";
  const btn=document.getElementById("btn-guardar-cotizacion"); if(btn) btn.innerHTML="💾 Guardar cotización";
  cqSelPkg("xv");
  cqCalcTotal();
}

async function guardarCotizacion(){
  const nombre = document.getElementById("cq-nombre").value.trim();
  const msg = document.getElementById("cotizacion-msg");
  const btn = document.getElementById("btn-guardar-cotizacion");
  const editando = !!window._cqEditandoId;
  msg.textContent="";
  if(!nombre){ msg.textContent="El nombre del prospecto es obligatorio."; return; }
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Guardando...';
  try{
    const datosFormulario = {
      nombre,
      telefono: document.getElementById("cq-tel").value.trim(),
      marca: document.getElementById("cq-marca").value.trim(),
      modelo: document.getElementById("cq-modelo").value.trim(),
      colorNombre: document.getElementById("cq-color-name").value.trim(),
      origen: document.getElementById("cq-origen").value,
      paquete: cqGetPkgData(),
      precio: parseFloat(document.getElementById("cq-precio").value)||0,
      precioPaquete: parseFloat(document.getElementById("cq-precio-paquete").value)||0,
      promocion: document.getElementById("cq-promocion").value.trim(),
      fechaCita: document.getElementById("cq-fecha-cita").value,
      fechaEvento: document.getElementById("cq-fecha-evento").value,
      vigencia: document.getElementById("cq-vigencia").value,
      anotaciones: document.getElementById("cq-obs").value.trim()
    };
    let cot;
    if(editando){
      // Edición: se conserva folio, estatus, historial de impresiones y
      // respaldo — solo se actualizan los datos que el formulario controla.
      const original = allCotizaciones.find(c=>c.id===window._cqEditandoId);
      if(!original) throw new Error("No se encontró la cotización original.");
      cot = Object.assign({}, original, datosFormulario);
    }else{
      cot = Object.assign({
        id: "cot_"+Date.now(),
        folio: await getNextFolioCotizacion(),
        estatus: "pendiente",
        motivoNoRegreso: "",
        clienteFolioConvertido: null,
        impresiones: [],
        cotizacionImagenUrl: "",
        fechaCreacion: fechaLocalISO(),
        creadoPor: currentUser ? currentUser.user : ""
      }, datosFormulario);
    }
    await saveUnaCotizacion(cot);
    if(editando){
      const idx = allCotizaciones.findIndex(c=>c.id===cot.id);
      if(idx>=0) allCotizaciones[idx]=cot; else allCotizaciones.push(cot);
      toast("✓ Cotización "+cot.folio+" actualizada");
    }else{
      allCotizaciones.push(cot);
      toast("✓ Cotización "+cot.folio+" guardada");
    }
    resetFormCotizacion();
    goSec("cotizaciones-calendario");
  }catch(e){
    console.error(e);
    msg.textContent = "Error al guardar la cotización.";
  }finally{
    btn.disabled = false; btn.innerHTML = editando ? "💾 Guardar cambios" : "💾 Guardar cotización";
  }
}

// ══ CALENDARIO ══
async function cqCargarYRenderCalendario(){
  allCotizaciones = await loadCotizacionesFS();
  const buscar = document.getElementById("cq-buscar"); if(buscar) buscar.value = "";
  const hoy = new Date();
  if(_cqCal.year===null){ _cqCal.year=hoy.getFullYear(); _cqCal.month=hoy.getMonth(); }
  renderCqCalendario();
}
function cqCalMes(delta){
  _cqCal.month += delta;
  if(_cqCal.month<0){ _cqCal.month=11; _cqCal.year--; }
  if(_cqCal.month>11){ _cqCal.month=0; _cqCal.year++; }
  renderCqCalendario();
}
const CQ_MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
// Prioridad para colorear el día cuando hay varias cotizaciones con distinto
// estatus el mismo día: se muestra el color del estatus que más necesita
// atención (pendiente primero, convertida al final por ser ya un histórico).
const CQ_PRIORIDAD_DIA = ["pendiente","agendada","no_regreso","convertida"];
function cqClaseDelDia(citasDia){
  if(!citasDia.length) return "";
  for(const est of CQ_PRIORIDAD_DIA){
    if(citasDia.some(c=>c.estatus===est)) return "st-"+est.replace("_","-");
  }
  return "";
}
function renderCqCalendario(){
  const {year,month} = _cqCal;
  document.getElementById("cq-cal-mesnombre").textContent = CQ_MESES[month]+" "+year;
  const grid = document.getElementById("cq-cal-grid");
  const primerDia = new Date(year,month,1).getDay();
  const diasEnMes = new Date(year,month+1,0).getDate();
  const hoyStr = fechaLocalISO();
  let html = "";
  for(let i=0;i<primerDia;i++) html += `<div class="cq-cal-day blank"></div>`;
  for(let d=1; d<=diasEnMes; d++){
    const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const citasDia = allCotizaciones.filter(c=>c.fechaCita===dateStr);
    const cls = ["cq-cal-day", cqClaseDelDia(citasDia)];
    if(dateStr===hoyStr) cls.push("today");
    if(dateStr===_cqCal.selDate) cls.push("sel");
    const contador = citasDia.length ? `<div class="cq-cal-count">${citasDia.length}</div>` : "";
    html += `<div class="${cls.join(" ")}" onclick="cqSelectDay('${dateStr}')">${d}${contador}</div>`;
  }
  grid.innerHTML = html;
  if(_cqCal.selDate) renderCqDayList(_cqCal.selDate);
}
function cqSelectDay(dateStr){
  _cqCal.selDate = dateStr;
  renderCqCalendario();
}
const CQ_ESTATUS_LABEL = {
  pendiente:{label:"Pendiente", cls:"s-cot-pendiente"},
  agendada:{label:"Agendada", cls:"s-cot-agendada"},
  convertida:{label:"Convertida", cls:"s-cot-convertida"},
  no_regreso:{label:"No regresó", cls:"s-cot-noregreso"}
};
// Genera el HTML de una sola tarjeta de cotización — usado tanto por la
// vista de día del calendario como por los resultados del buscador.
function cqCardHTML(c){
  const est = CQ_ESTATUS_LABEL[c.estatus] || CQ_ESTATUS_LABEL.pendiente;
  const total = (c.precio||0) + (c.precioPaquete||0);
  const puedeConvertir = c.estatus!=="convertida";
  const esAdmin = currentUser && currentUser.role==="admin";
  const descModelo = [c.marca,c.modelo,c.colorNombre].filter(Boolean).join(" · ") || "—";
  // Expirada: la vigencia ya pasó Y sigue sin concretarse (pendiente/agendada).
  // NUNCA se oculta — solo se marca, como pidió el negocio.
  const expirada = c.vigencia && c.vigencia < fechaLocalISO() && (c.estatus==="pendiente"||c.estatus==="agendada");
  return `<div class="cq-cot-card">
      <div class="cq-cot-top">
        <div>
          <div class="cq-cot-nombre">${c.nombre}</div>
          <div class="cq-cot-modelo">${descModelo} · Folio ${c.folio}</div>
        </div>
        <div style="display:flex;gap:.3rem;flex-wrap:wrap;justify-content:flex-end">
          ${expirada?`<span class="status-badge" style="background:#F2E2E0;color:#8B4A42">⏰ Expirada</span>`:""}
          <span class="status-badge ${est.cls}">${est.label}</span>
        </div>
      </div>
      <div style="font-size:.78rem;color:#888">Cita: ${c.fechaCita||"—"} · Evento: ${c.fechaEvento||"—"} · Total estimado: $${total.toLocaleString("es-MX")}</div>
      ${c.vigencia?`<div style="font-size:.72rem;color:${expirada?"#8B4A42":"#AAA"}">Vigencia hasta: ${c.vigencia}</div>`:""}
      ${c.motivoNoRegreso?`<div style="font-size:.72rem;color:var(--rojo);margin-top:.3rem">Motivo: ${c.motivoNoRegreso}</div>`:""}
      ${c.cotizacionImagenUrl?`<div style="font-size:.72rem;margin-top:.3rem"><a href="${c.cotizacionImagenUrl}" target="_blank" rel="noopener">📎 Ver respaldo escaneado</a></div>`:""}
      <div class="cq-cot-actions">
        <button class="cq-btn-mini" onclick="cqImprimirCotizacion('${c.id}')">🖨️ Imprimir</button>
        ${puedeConvertir?`<button class="cq-btn-mini" onclick="cqEditarCotizacion('${c.id}')">✏️ Editar</button>`:""}
        ${puedeConvertir?`<button class="cq-btn-mini" onclick="cqCambiarEstatus('${c.id}','agendada')">Marcar agendada</button>`:""}
        ${puedeConvertir?`<button class="cq-btn-mini solid" onclick="cqConvertirCliente('${c.id}')">Convertir a cliente</button>`:""}
        ${puedeConvertir?`<button class="cq-btn-mini rojo" onclick="cqAbrirNoRegreso('${c.id}')">No regresó</button>`:""}
        ${esAdmin?`<button class="cq-btn-mini rojo" onclick="eliminarCotizacionFS('${c.id}')">🗑️ Eliminar</button>`:""}
      </div>
    </div>`;
}
function cqRenderLista(lista, mensajeVacio){
  const cont = document.getElementById("cq-day-list");
  if(!lista.length){
    cont.innerHTML = `<p style="color:#AAA;font-size:.82rem;padding:.5rem">${mensajeVacio}</p>`;
    return;
  }
  cont.innerHTML = lista.map(cqCardHTML).join("");
}
function renderCqDayList(dateStr){
  const citas = allCotizaciones.filter(c=>c.fechaCita===dateStr);
  cqRenderLista(citas, `Sin cotizaciones para el ${dateStr}.`);
}
// Buscador por nombre o folio — funciona sin importar el día seleccionado.
function cqBuscarCotizaciones(q){
  q = q.trim().toLowerCase();
  if(!q){
    if(_cqCal.selDate) renderCqDayList(_cqCal.selDate);
    else document.getElementById("cq-day-list").innerHTML = "";
    return;
  }
  const resultados = allCotizaciones.filter(c=>
    (c.nombre||"").toLowerCase().includes(q) || (c.folio||"").toLowerCase().includes(q)
  );
  cqRenderLista(resultados, "Sin resultados para esa búsqueda.");
}
async function cqCambiarEstatus(id, nuevoEstatus){
  const cot = allCotizaciones.find(c=>c.id===id);
  if(!cot) return;
  cot.estatus = nuevoEstatus;
  await saveUnaCotizacion(cot);
  toast("✓ Estatus actualizado");
  renderCqDayList(_cqCal.selDate);
}
const CQ_MOTIVOS = ["No encontró el modelo","No le gustó el color","Precio","No le convenció la promoción","Otro"];
let _cqMotivoTargetId = null;
function cqAbrirNoRegreso(id){
  _cqMotivoTargetId = id;
  const sel = document.getElementById("cq-motivo-select");
  sel.innerHTML = '<option value="">Seleccionar...</option>' + CQ_MOTIVOS.map(m=>`<option>${m}</option>`).join("");
  document.getElementById("cq-motivo-otro-wrap").style.display = "none";
  document.getElementById("cq-motivo-otro").value = "";
  document.getElementById("cq-motivo-msg").textContent = "";
  document.getElementById("modal-cq-motivo").style.display = "flex";
}
function cqCerrarMotivoModal(){
  document.getElementById("modal-cq-motivo").style.display = "none";
  _cqMotivoTargetId = null;
}
function cqConfirmarMotivo(){
  const sel = document.getElementById("cq-motivo-select").value;
  const otro = document.getElementById("cq-motivo-otro").value.trim();
  const msg = document.getElementById("cq-motivo-msg");
  if(!sel){ msg.textContent = "Selecciona un motivo."; return; }
  const motivoFinal = sel==="Otro" ? otro : sel;
  if(sel==="Otro" && !otro){ msg.textContent = "Especifica el motivo."; return; }
  const id = _cqMotivoTargetId;
  document.getElementById("modal-cq-motivo").style.display = "none";
  _cqMotivoTargetId = null;
  cqGuardarNoRegreso(id, motivoFinal);
}
async function cqGuardarNoRegreso(id, motivo){
  const cot = allCotizaciones.find(c=>c.id===id);
  if(!cot) return;
  cot.estatus = "no_regreso";
  cot.motivoNoRegreso = motivo;
  await saveUnaCotizacion(cot);
  toast("Registrado — no regresó a apartar");
  renderCqDayList(_cqCal.selDate);
}
// Convertir a cliente: prellena el formulario real de Nuevo cliente con los
// datos de la cotización. NO marca la cotización como convertida aquí — eso
// pasa solo cuando el cliente se guarda de verdad (ver saveCliente). Así, si
// se cancela o se cierra sin guardar, la cotización queda intacta.
function cqConvertirCliente(id){
  const cot = allCotizaciones.find(c=>c.id===id);
  if(!cot) return;
  goSec("nuevo-cliente"); // esto limpia el formulario Y la bandera anterior
  document.getElementById("c-nombre").value = cot.nombre;
  document.getElementById("c-cel").value = cot.telefono||"";
  document.getElementById("c-marca").value = cot.marca||"";
  document.getElementById("c-modelo").value = cot.modelo||"";
  document.getElementById("c-color-name").value = cot.colorNombre||"";
  let notaExtra = "";
  if(cot.paquete && (cot.paquete.tipo==="xv"||cot.paquete.tipo==="novia")){
    document.getElementById("c-tipo").value = cot.paquete.tipo;
    updatePkg();
  }else if(cot.paquete && (cot.paquete.tipo==="solo"||cot.paquete.tipo==="custom")){
    // El formulario de cliente solo admite XV/Novia — se deja en blanco a
    // propósito para que se elija a mano, en vez de forzar un valor incorrecto.
    notaExtra = "⚠️ Selecciona manualmente el tipo de paquete — la cotización era \""+(cot.paquete.tipo==="solo"?"Solo vestido":"Personalizado")+"\".";
  }
  document.getElementById("c-precio").value = cot.precio||"";
  document.getElementById("c-precio-paquete").value = cot.precioPaquete||"";
  const notaCot = `Convertido desde cotización ${cot.folio}${cot.promocion?" — promoción: "+cot.promocion:""}`;
  document.getElementById("c-obs").value = [notaCot, notaExtra].filter(Boolean).join("\n");
  calcTotal();
  // Se marca DESPUÉS de goSec (que ya limpió cualquier bandera vieja) para
  // que quede activa mientras el usuario revisa y guarda.
  window._cqConvirtiendoId = id;
  toast("Formulario prellenado — revisa y guarda el cliente");
}

// ══ IMPRESIÓN DE COTIZACIÓN ══
// El documento se genera desde los datos vivos de Firestore, así que puede
// reimprimirse idéntico desde cualquier dispositivo — "la nube" es la propia
// cotización guardada. Cada impresión se registra en el array "impresiones"
// del documento (fecha + usuario), sin necesidad de Storage (plan Spark).
let _cqPrintId = null;

function cqImprimirCotizacion(id){
  const c = allCotizaciones.find(x=>x.id===id);
  if(!c) return;
  _cqPrintId = id;
  const total = (c.precio||0) + (c.precioPaquete||0);
  const compsHtml = (c.paquete && c.paquete.componentes && c.paquete.componentes.length)
    ? c.paquete.componentes.map(k=>`<tr>
        <td style="border:1px solid #DDD;padding:.35rem .6rem">${k.name}</td>
        <td style="border:1px solid #DDD;padding:.35rem .6rem">${k.opcion||"—"}</td>
      </tr>`).join("")
    : `<tr><td colspan="2" style="border:1px solid #DDD;padding:.35rem .6rem;color:#999">Solo vestido — sin paquete</td></tr>`;
  const tipoPkgLabel = {xv:"Paquete XV",novia:"Paquete Novia",solo:"Solo vestido",custom:"Personalizado"}[c.paquete?c.paquete.tipo:"solo"]||"—";
  document.getElementById("cotizacion-print-content").innerHTML = `
    <div style="text-align:center;border-bottom:2px solid #C9A84C;padding-bottom:.8rem;margin-bottom:1rem">
      <div style="font-family:'Cormorant Garamond',serif;font-size:1.6rem;letter-spacing:.1em">Ross de Lune</div>
      <div style="font-size:.7rem;letter-spacing:.18em;text-transform:uppercase;color:#7A4F2A">Novias y Quinceañeras · Cotización</div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:.82rem;margin-bottom:1rem">
      <tr>
        <td style="padding:.3rem 0"><strong>Folio:</strong> ${c.folio}</td>
        <td style="padding:.3rem 0;text-align:right"><strong>Fecha:</strong> ${c.fechaCreacion||"—"}</td>
      </tr>
      <tr>
        <td style="padding:.3rem 0"><strong>Prospecto:</strong> ${c.nombre}</td>
        <td style="padding:.3rem 0;text-align:right"><strong>Teléfono:</strong> ${c.telefono||"—"}</td>
      </tr>
      <tr>
        <td style="padding:.3rem 0" colspan="2"><strong>Marca / Modelo / Color:</strong> ${[c.marca,c.modelo,c.colorNombre].filter(Boolean).join(" · ")||"—"}</td>
      </tr>
    </table>
    <div style="font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:#7A4F2A;margin-bottom:.4rem">${tipoPkgLabel}</div>
    <table style="width:100%;border-collapse:collapse;font-size:.8rem;margin-bottom:1rem">
      <tr>
        <th style="border:1px solid #DDD;padding:.35rem .6rem;background:#FAFAFA;text-align:left">Componente</th>
        <th style="border:1px solid #DDD;padding:.35rem .6rem;background:#FAFAFA;text-align:left">Opción</th>
      </tr>
      ${compsHtml}
    </table>
    <table style="width:100%;border-collapse:collapse;font-size:.85rem;margin-bottom:1rem">
      <tr><td style="padding:.25rem 0">Precio vestido:</td><td style="padding:.25rem 0;text-align:right">$${(c.precio||0).toLocaleString("es-MX")}</td></tr>
      <tr><td style="padding:.25rem 0">Precio paquete:</td><td style="padding:.25rem 0;text-align:right">$${(c.precioPaquete||0).toLocaleString("es-MX")}</td></tr>
      ${c.promocion?`<tr><td style="padding:.25rem 0">Promoción aplicada:</td><td style="padding:.25rem 0;text-align:right">${c.promocion}</td></tr>`:""}
      <tr><td style="padding:.4rem 0;border-top:1px solid #C9A84C;font-weight:700">Total estimado:</td><td style="padding:.4rem 0;border-top:1px solid #C9A84C;text-align:right;font-weight:700;font-size:1rem">$${total.toLocaleString("es-MX")}</td></tr>
    </table>
    ${c.vigencia?`<div style="font-size:.78rem;margin-bottom:.5rem"><strong>Vigencia de esta cotización:</strong> hasta el ${c.vigencia}</div>`:""}
    ${c.fechaEvento?`<div style="font-size:.78rem;margin-bottom:.5rem"><strong>Fecha del evento:</strong> ${c.fechaEvento}</div>`:""}
    ${c.anotaciones?`<div style="font-size:.78rem;margin-bottom:.5rem"><strong>Anotaciones:</strong> ${c.anotaciones}</div>`:""}
    <div style="text-align:center;margin-top:2rem;font-size:.68rem;color:#AAA">
      Los precios y promociones de esta cotización ${c.vigencia?`son válidos hasta el ${c.vigencia}`:"están sujetos a cambio sin previo aviso"}.<br>
      Ross de Lune · Novias y Quinceañeras
    </div>`;
  // Reset del bloque de respaldo cada vez que se abre el modal
  window._cqRespaldoBase64 = null;
  document.getElementById("cq-respaldo-input").value = "";
  document.getElementById("cq-respaldo-msg").textContent = "";
  const respaldoPreview = document.getElementById("cq-respaldo-preview");
  if(c.cotizacionImagenUrl){
    respaldoPreview.style.display = "block";
    respaldoPreview.innerHTML = `📎 Ya hay un respaldo guardado — <a href="${c.cotizacionImagenUrl}" target="_blank" rel="noopener">ver documento</a>`;
  }else{
    respaldoPreview.style.display = "none";
    respaldoPreview.innerHTML = "";
  }
  document.getElementById("modal-cotizacion-print").classList.add("open");
}
// Vista previa del archivo escaneado antes de subirlo (mismo patrón que previewContratoCliente).
function cqPreviewRespaldo(input){
  const file = input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    window._cqRespaldoBase64 = e.target.result;
    const preview = document.getElementById("cq-respaldo-preview");
    preview.style.display = "block";
    preview.textContent = "📎 "+file.name+" listo para subir";
  };
  reader.readAsDataURL(file);
}
// Sube el respaldo escaneado a Cloudinary reutilizando subirDocumentoCloudinary()
// (misma función que usa el contrato firmado) — no se duplica lógica de subida.
async function cqSubirRespaldo(){
  const msg = document.getElementById("cq-respaldo-msg");
  const btn = document.getElementById("cq-btn-subir-respaldo");
  msg.textContent = "";
  if(!window._cqRespaldoBase64){ msg.textContent = "Selecciona primero un archivo escaneado."; return; }
  if(!_cqPrintId){ msg.textContent = "No se identificó la cotización."; return; }
  const cot = allCotizaciones.find(x=>x.id===_cqPrintId);
  if(!cot){ msg.textContent = "No se encontró la cotización."; return; }
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Subiendo...';
  try{
    const url = await subirDocumentoCloudinary(window._cqRespaldoBase64);
    cot.cotizacionImagenUrl = url;
    await saveUnaCotizacion(cot);
    window._cqRespaldoBase64 = null;
    document.getElementById("cq-respaldo-input").value = "";
    const preview = document.getElementById("cq-respaldo-preview");
    preview.innerHTML = `📎 Respaldo guardado — <a href="${url}" target="_blank" rel="noopener">ver documento</a>`;
    toast("✓ Respaldo subido a Cloudinary");
    renderCqDayList(_cqCal.selDate);
  }catch(e){
    console.error(e);
    msg.textContent = "Error al subir el respaldo. Verifica tu conexión.";
  }finally{
    btn.disabled = false; btn.innerHTML = "📤 Subir respaldo";
  }
}
function cqCerrarPrint(){
  document.getElementById("modal-cotizacion-print").classList.remove("open");
  _cqPrintId = null;
}
async function cqEjecutarImpresion(){
  // Registrar la impresión en Firestore ANTES de abrir el diálogo del sistema
  if(_cqPrintId){
    const c = allCotizaciones.find(x=>x.id===_cqPrintId);
    if(c){
      if(!Array.isArray(c.impresiones)) c.impresiones = [];
      c.impresiones.push({fecha: fechaLocalISO(), usuario: currentUser?currentUser.user:""});
      try{ await saveUnaCotizacion(c); }catch(e){ console.error("No se pudo registrar la impresión",e); }
    }
  }
  // Mismo patrón que nota sencilla: ocultar barra, imprimir, restaurar
  const noPrintBar = document.querySelector("#modal-cotizacion-print .no-print");
  if(noPrintBar) noPrintBar.style.display="none";
  setTimeout(()=>{
    window.print();
    if(noPrintBar) noPrintBar.style.display="flex";
  },300);
}

// Editar cotización: reabre el formulario con todo prellenado y guarda
// sobre el mismo folio (ver guardarCotizacion). Solo disponible si no está
// convertida — una vez convertida queda congelada como histórico.
function cqEditarCotizacion(id){
  const cot = allCotizaciones.find(c=>c.id===id);
  if(!cot) return;
  goSec("nueva-cotizacion"); // limpia el formulario primero
  document.getElementById("cq-nombre").value = cot.nombre||"";
  document.getElementById("cq-tel").value = cot.telefono||"";
  document.getElementById("cq-marca").value = cot.marca||"";
  document.getElementById("cq-modelo").value = cot.modelo||"";
  document.getElementById("cq-color-name").value = cot.colorNombre||"";
  document.getElementById("cq-origen").value = cot.origen||"";
  document.getElementById("cq-precio").value = cot.precio||"";
  document.getElementById("cq-precio-paquete").value = cot.precioPaquete||"";
  document.getElementById("cq-promocion").value = cot.promocion||"";
  document.getElementById("cq-fecha-cita").value = cot.fechaCita||"";
  document.getElementById("cq-fecha-evento").value = cot.fechaEvento||"";
  document.getElementById("cq-vigencia").value = cot.vigencia||"";
  document.getElementById("cq-obs").value = cot.anotaciones||"";
  cqSelPkg((cot.paquete && cot.paquete.tipo) || "xv");
  cqAplicarComponentesGuardados(cot.paquete && cot.paquete.componentes);
  cqCalcTotal();
  window._cqEditandoId = id; // se activa DESPUÉS de goSec, que ya reseteó
  const titulo=document.querySelector("#sec-nueva-cotizacion .sec-title"); if(titulo) titulo.textContent="Editar cotización "+cot.folio;
  const btn=document.getElementById("btn-guardar-cotizacion"); if(btn) btn.innerHTML="💾 Guardar cambios";
}
