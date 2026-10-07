// ══ COTIZACIONES EN VIVO EN FIRESTORE ══
// Cada cotización = un documento en la colección "cotizaciones", ID propio
// ("cot_"+Date.now()), completamente separado de la colección "clientes"
// y de su folio — así nunca se mezcla con compras reales.
let allCotizaciones = [];
let currentPkgCQ = "xv";
let _cqCal = { year:null, month:null, selDate:null };

async function loadCotizacionesFS(){
  const snap = await db.collection("cotizaciones").get({source:"server"});
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
    toast("Solo un administrador puede eliminar cotizaciones", "err");
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
    toast("Error al eliminar la cotización", "err");
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
// ══ ESCANEO QR EN EL COTIZADOR ══
// Versión adaptada de buscarPorQR() de pedidos.js. Usa IDs con prefijo "cq-"
// y llama a cqCalcTotal() en lugar de calcTotal(). Guarda el articuloId en
// window._cqArticuloActual y en la raíz de la cotización, para que sobreviva
// la conversión al cliente.
window._cqArticuloActual = null;

async function cqBuscarPorQR(){
  const input = document.getElementById("cq-inv-scan-input");
  const msg = document.getElementById("cq-inv-scan-msg");
  if(!input || !msg) return;
  const id = (input.value||"").trim();
  msg.textContent = "";
  if(!id) return;
  msg.style.color = "#AAA";
  msg.textContent = "⏳ Buscando en inventario...";

  // Leer el artículo directo de Firestore, no de window._invData.
  // Así el stock refleja el estado real, no el que había al hacer login.
  let art = null;
  try{
    const snap = await db.collection("inventario").doc(String(id)).get();
    if(snap.exists) art = snap.data();
  }catch(e){
    msg.style.color = "var(--rojo)";
    msg.textContent = "✕ Error al consultar inventario. Revisa tu conexión.";
    return;
  }

  if(!art){
    msg.style.color = "var(--rojo)";
    msg.textContent = "✕ Artículo no encontrado en inventario.";
    return;
  }

  document.getElementById("cq-marca").value = art.marca||"";
  document.getElementById("cq-modelo").value = art.modelo||"";
  document.getElementById("cq-color-name").value = art.colorNombre||"";
  if(art.precio){
    document.getElementById("cq-precio").value = art.precio;
  }
  window._cqArticuloActual = art.id;
  cqCalcTotal();

  const btnQuitar = ' <button type="button" onclick="cqQuitarArticuloEscaneado()" style="background:none;border:none;color:var(--rojo);cursor:pointer;font-size:.68rem;text-decoration:underline;padding:0">✕ Quitar</button>';
  const stock = Number(art.cantidad)||0;
  if(stock > 0){
    msg.style.color = "var(--dorado-d)";
    msg.innerHTML = "✓ "+art.categoria+" · "+art.modelo+" · Talla "+art.talla+" · "+art.colorNombre+btnQuitar;
  } else {
    msg.style.color = "#B8860B";
    msg.innerHTML = "⚠️ "+art.categoria+" · "+art.modelo+" · Talla "+art.talla+" · "+art.colorNombre+" — sin stock en tienda"+btnQuitar;
  }
  input.value = "";
}

function cqQuitarArticuloEscaneado(){
  window._cqArticuloActual = null;
  const msg = document.getElementById("cq-inv-scan-msg");
  if(msg){ msg.style.color = ""; msg.innerHTML = ""; }
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
  if(currentPkgCQ==="solo") return {tipo:"solo", componentes:[], adicionales:cqGetAdicionales()};
  const items = currentPkgCQ==="novia"?PKG_NOVIA:currentPkgCQ==="custom"?PKG_CUSTOM:PKG_XV;
  const comps = items.map(c=>{
    const chk = document.getElementById("cq-chk-"+c.id);
    if(!chk||!chk.checked) return null;
    const selBtn = document.querySelector(`#cq-opts-${c.id} .comp-opt.sel`);
    return {id:c.id, name:c.name, opcion: selBtn?selBtn.textContent:""};
  }).filter(Boolean);
  return {tipo:currentPkgCQ, componentes:comps, adicionales:cqGetAdicionales()};
}
// Re-aplica los componentes guardados de una cotización (usado al editar):
// marca los checkboxes que estaban activos y selecciona la opción guardada
// de cada uno, sobre el markup recién generado por cqInitPkgComponents.
function cqAplicarComponentesGuardados(componentes){
  const lista = componentes || [];
  // Recorre TODOS los componentes del tipo actual (no solo los que vienen en
  // la cotización) y aplica checked/opción según corresponda. Así, los que el
  // usuario DESmarcó en la cotización también quedan desmarcados al editar,
  // en vez de quedar con los defaults que dejó cqInitPkgComponents().
  const items = currentPkgCQ==="novia" ? PKG_NOVIA
              : currentPkgCQ==="custom" ? PKG_CUSTOM
              : PKG_XV;
  items.forEach(c=>{
    const chk = document.getElementById("cq-chk-"+c.id);
    if(!chk) return;
    const match = lista.find(x=>x.id===c.id);
    chk.checked = !!match;
    cqToggleComp(c.id);
    const opts = document.querySelectorAll(`#cq-opts-${c.id} .comp-opt`);
    const opcion = match ? match.opcion : c.default;
    opts.forEach(b=>b.classList.toggle("sel", b.textContent===opcion));
  });
}
// ══ DESCUENTO — parsea "promocion" y calcula el monto según la base elegida ══
// Acepta "10", "10%", "10 %". Si no hay match o el % es 0, no descuenta.
// Si el radio group no existe en el DOM (versión anterior de index.html),
// cae a "ambos" sin romper.
function cqGetDescuentoInfo(){
  const promoRaw = (document.getElementById("cq-promocion")?.value||"").trim();
  const m = promoRaw.match(/(\d+(?:[.,]\d+)?)\s*%?/);
  const pct = m ? Math.min(100, Math.max(0, parseFloat(m[1].replace(",", ".")))) : 0;

  const radio = document.querySelector('input[name="cq-desc-base"]:checked');
  const base = radio ? radio.value : "ambos";

  const vestido = parseFloat(document.getElementById("cq-precio")?.value)||0;
  const paquete = parseFloat(document.getElementById("cq-precio-paquete")?.value)||0;

  const baseMonto = base==="vestido" ? vestido
                  : base==="paquete" ? paquete
                  : vestido + paquete;

  const descuentoMonto = Math.round(baseMonto * pct / 100);
  const bruto = vestido + paquete;
  const neto  = bruto - descuentoMonto;

  return { pct, base, baseMonto, descuentoMonto, bruto, neto };
}

function cqCalcTotal(){
  const info = cqGetDescuentoInfo();
  const extras = cqGetAdicionales().reduce((s,a)=>s+Number(a.precio||0),0);
  const totalConExtras = info.neto + extras;
  document.getElementById("cq-resumen-total").textContent =
    "$" + totalConExtras.toLocaleString("es-MX");

  const wrap = document.getElementById("cq-resumen-descuento-wrap");
  const el   = document.getElementById("cq-resumen-descuento");
  if(wrap && el){
    if(info.pct > 0 && info.descuentoMonto > 0){
      wrap.style.display = "flex";
      el.textContent = "−$" + info.descuentoMonto.toLocaleString("es-MX")
                     + " (" + info.pct + "% " + info.base + ")";
    } else {
      wrap.style.display = "none";
      el.textContent = "";
    }
  }
}

// Pinta el grid de adicionales en el cotizador. Si recibe "existing", restaura
// los que ya venían guardados (usado al editar). Si no, pinta todo desmarcado.
// Referencia ADICIONALES en runtime porque clientes.js carga después de este archivo.
function cqInitAdicionales(existing){
  const grid = document.getElementById("cq-add-grid");
  if(!grid) return;
  if(typeof ADICIONALES === "undefined"){
    grid.innerHTML = '<p style="font-size:.8rem;color:#AAA;padding:.5rem 0">Cargando catálogo...</p>';
    return;
  }
  const guardados = existing || [];
  grid.innerHTML = ADICIONALES.map((a,i)=>{
    const match = guardados.find(e=>e.nombre===a);
    const checked = !!match;
    const precio = match ? (match.precio||"") : "";
    const nota = match ? (match.nota||"") : "";
    return `<div class="add-item ${checked?"sel":""}" id="cq-ai-${i}">
      <div class="add-header">
        <input type="checkbox" class="add-check" id="cq-ac-${i}" ${checked?"checked":""} onchange="cqToggleAdicional(${i})">
        <label class="add-label" for="cq-ac-${i}">${a}</label>
        <input type="number" class="add-price" id="cq-ap-${i}" placeholder="$0" min="0" value="${precio}" oninput="cqCalcTotal()">
      </div>
      <input class="add-note" id="cq-an-${i}" placeholder="Especificaciones..." value="${nota}">
    </div>`;
  }).join("");
}

function cqToggleAdicional(i){
  const chk = document.getElementById("cq-ac-"+i);
  if(!chk) return;
  document.getElementById("cq-ai-"+i).classList.toggle("sel", chk.checked);
  cqCalcTotal();
}

// Devuelve solo los adicionales marcados, con su precio y nota.
// Mismo formato que getAdicionales() de clientes.js para que se pueda transferir sin conversión.
function cqGetAdicionales(){
  if(typeof ADICIONALES === "undefined") return [];
  return ADICIONALES.map((a,i)=>{
    const chk = document.getElementById("cq-ac-"+i);
    if(!chk||!chk.checked) return null;
    return {
      nombre: a,
      precio: document.getElementById("cq-ap-"+i).value||0,
      nota: document.getElementById("cq-an-"+i).value||""
    };
  }).filter(Boolean);
}
function resetFormCotizacion(){
  window._cqEditandoId = null;
  ["cq-nombre","cq-tel","cq-marca","cq-modelo","cq-color-name","cq-precio","cq-precio-paquete","cq-promocion",
   "cq-fecha-cita","cq-fecha-evento","cq-vigencia","cq-obs"].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value="";
  });
  const origen=document.getElementById("cq-origen"); if(origen) origen.value="";
  const msg=document.getElementById("cotizacion-msg"); if(msg) msg.textContent="";
// Reset base de descuento a "ambos"
document.querySelectorAll('input[name="cq-desc-base"]').forEach(r=>{
  r.checked = (r.value === "ambos");
});
  const titulo=document.querySelector("#sec-nueva-cotizacion .sec-title"); if(titulo) titulo.textContent="Nueva cotización";
  const btn=document.getElementById("btn-guardar-cotizacion"); if(btn) btn.innerHTML="💾 Guardar cotización";
  // Reset del escáner QR
  window._cqArticuloActual = null;
  const cqScanMsgReset = document.getElementById("cq-inv-scan-msg");
  if(cqScanMsgReset){ cqScanMsgReset.style.color = ""; cqScanMsgReset.innerHTML = ""; }
  const cqScanInputReset = document.getElementById("cq-inv-scan-input");
  if(cqScanInputReset) cqScanInputReset.value = "";
  // Reset del selector de estadísticas (por si el usuario dejó un año filtrado)
  const statsSel = document.getElementById("cq-stats-anio");
  if(statsSel) statsSel.value = "";
cqSelPkg("xv");
  cqInitAdicionales();
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
    const descInfo = cqGetDescuentoInfo();
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
      anotaciones: document.getElementById("cq-obs").value.trim(),
            articuloId: window._cqArticuloActual || null,
      descuentoPct:   descInfo.pct,
      descuentoBase:  descInfo.base,
      descuentoMonto: descInfo.descuentoMonto
    };
    let cot;
    if(editando){
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
  try{
    // Timeout defensivo: el SDK de Firestore no rechaza la promesa cuando
    // se corta la red (solo reintenta en background). Si en 5 segundos no
    // hay respuesta, forzamos el error para poder avisar al usuario.
    allCotizaciones = await Promise.race([
      loadCotizacionesFS(),
      new Promise((_, reject)=>setTimeout(()=>reject(new Error("Timeout de conexión")), 5000))
    ]);
  }catch(e){
    console.error("No se pudo cargar el calendario:", e);
    const cont = document.getElementById("cq-day-list");
    if(cont){
      cont.innerHTML = '<p style="color:var(--rojo);font-size:.82rem;padding:.5rem">⚠️ No se pudieron cargar las cotizaciones. Revisa tu conexión a internet e intenta de nuevo.</p>';
    }
    // También mostrar la cabecera del calendario (por si una búsqueda previa
    // la dejó oculta), pero sin intentar pintar la cuadrícula.
    const headMes = document.querySelector("#sec-cotizaciones-calendario .cq-cal-head");
    const dowGrid = document.getElementById("cq-cal-dow");
    const mesGrid = document.getElementById("cq-cal-grid");
    [headMes, dowGrid, mesGrid].forEach(el=>{ if(el) el.style.display = ""; });
    return;
  }
  const buscar = document.getElementById("cq-buscar"); if(buscar) buscar.value = "";
  const clearBtn = document.getElementById("cq-buscar-clear"); if(clearBtn) clearBtn.style.display = "none";
  const headMes = document.querySelector("#sec-cotizaciones-calendario .cq-cal-head");
  const dowGrid = document.getElementById("cq-cal-dow");
  const mesGrid = document.getElementById("cq-cal-grid");
  [headMes, dowGrid, mesGrid].forEach(el=>{ if(el) el.style.display = ""; });
  const hoy = new Date();
  if(_cqCal.year===null){ _cqCal.year=hoy.getFullYear(); _cqCal.month=hoy.getMonth(); }
  renderCqCalendario();
}
function cqCalMes(delta){
  _cqCal.month += delta;
  if(_cqCal.month<0){ _cqCal.month=11; _cqCal.year--; }
  if(_cqCal.month>11){ _cqCal.month=0; _cqCal.year++; }
  // Al cambiar de mes, el día seleccionado del mes anterior ya no aplica —
  // se limpia para que no quede visible una lista de cotizaciones que no
  // corresponden al mes que se está viendo.
  _cqCal.selDate = null;
  document.getElementById("cq-day-list").innerHTML = "";
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
  const extras = (c.paquete?.adicionales||[]).reduce((s,a)=>s+Number(a.precio||0),0);
  const total = (c.precio||0) + (c.precioPaquete||0) + extras;
  const desc = Number(c.descuentoMonto)||0;
  const totalNeto = total - desc;
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
      <div style="font-size:.78rem;color:#888">Cita: ${c.fechaCita||"—"} · Evento: ${c.fechaEvento||"—"} · Total estimado: $${totalNeto.toLocaleString("es-MX")}${desc>0?` <span style="color:var(--dorado-d)">(desc. $${desc.toLocaleString("es-MX")})</span>`:""}</div>
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
  if(!dateStr){
    const cont = document.getElementById("cq-day-list");
    if(cont) cont.innerHTML = "";
    return;
  }
  const citas = allCotizaciones.filter(c=>c.fechaCita===dateStr);
  cqRenderLista(citas, `Sin cotizaciones para el ${dateStr}.`);
}
// Buscador por nombre o folio — funciona sin importar el día seleccionado.
function cqBuscarCotizaciones(q){
  q = q.trim();
  const headMes = document.querySelector("#sec-cotizaciones-calendario .cq-cal-head");
  const dowGrid = document.getElementById("cq-cal-dow");
  const mesGrid = document.getElementById("cq-cal-grid");
  const clearBtn = document.getElementById("cq-buscar-clear");

  if(!q){
    [headMes, dowGrid, mesGrid].forEach(el=>{ if(el) el.style.display = ""; });
    if(clearBtn) clearBtn.style.display = "none";
    if(_cqCal.selDate) renderCqDayList(_cqCal.selDate);
    else document.getElementById("cq-day-list").innerHTML = "";
    return;
  }

  [headMes, dowGrid, mesGrid].forEach(el=>{ if(el) el.style.display = "none"; });
  if(clearBtn) clearBtn.style.display = "block";

  // normTexto() vive en clientes.js (carga después de este archivo pero se
  // ejecuta mucho antes de que el buscador se use). Si por alguna razón no
  // está disponible, cae a un lowercase simple.
  const norm = (typeof normTexto === "function") ? normTexto : (s=>(s||"").toString().toLowerCase());
  const qn = norm(q);

  const resultados = allCotizaciones.filter(c=>{
    return norm(c.nombre).includes(qn)
        || norm(c.folio).includes(qn)
        || norm(c.telefono).includes(qn)
        || norm(c.marca).includes(qn)
        || norm(c.modelo).includes(qn);
  });
  cqRenderLista(resultados, "Sin resultados para esa búsqueda.");
}

function cqLimpiarBusqueda(){
  const inp = document.getElementById("cq-buscar");
  if(inp) inp.value = "";
  cqBuscarCotizaciones("");
}
async function cqCambiarEstatus(id, nuevoEstatus){
  const cot = allCotizaciones.find(c=>c.id===id);
  if(!cot) return;
  cot.estatus = nuevoEstatus;
  await saveUnaCotizacion(cot);
  toast("✓ Estatus actualizado");
  // Si hay una búsqueda activa, mantener la vista de resultados. Si no,
  // refrescar la lista del día seleccionado.
  const q = (document.getElementById("cq-buscar")?.value||"").trim();
  if(q) cqBuscarCotizaciones(q);
  else if(_cqCal.selDate) renderCqDayList(_cqCal.selDate);
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
  const q = (document.getElementById("cq-buscar")?.value||"").trim();
  if(q) cqBuscarCotizaciones(q);
  else if(_cqCal.selDate) renderCqDayList(_cqCal.selDate);
}
// Convertir a cliente: prellena el formulario real de Nuevo cliente con los
// datos de la cotización. NO marca la cotización como convertida aquí — eso
// pasa solo cuando el cliente se guarda de verdad (ver saveCliente). Así, si
// se cancela o se cierra sin guardar, la cotización queda intacta.
function cqConvertirCliente(id){
  const cot = allCotizaciones.find(c=>c.id===id);
  if(!cot) return;
  goSec("nuevo-cliente");
  document.getElementById("c-nombre").value = cot.nombre;
  document.getElementById("c-cel").value = cot.telefono||"";
  document.getElementById("c-marca").value = cot.marca||"";
  document.getElementById("c-modelo").value = cot.modelo||"";
  document.getElementById("c-color-name").value = cot.colorNombre||"";

  let notaExtra = "";
  if(cot.paquete && (cot.paquete.tipo==="xv"||cot.paquete.tipo==="novia")){
    document.getElementById("c-tipo").value = cot.paquete.tipo;
    updatePkg();
    if(typeof aplicarComponentesCotizacionAlCliente === "function"){
      aplicarComponentesCotizacionAlCliente(cot.paquete.componentes || []);
    }
  }else if(cot.paquete && cot.paquete.tipo==="custom"){
    // Personalizado: el select "c-tipo" solo tiene XV/Novia, pero el
    // selector de paquete sí admite "custom". Se activa ese botón y se
    // transfieren los componentes guardados.
    if(typeof selPkg === "function") selPkg("custom");
    if(typeof aplicarComponentesCotizacionAlCliente === "function"){
      aplicarComponentesCotizacionAlCliente(cot.paquete.componentes || []);
    }
    notaExtra = "⚠️ La cotización era \"Personalizado\". Revisa los componentes del paquete y selecciona el tipo de vestido si aplica.";
  }else if(cot.paquete && cot.paquete.tipo==="solo"){
    notaExtra = "⚠️ Selecciona manualmente el tipo de paquete — la cotización era \"Solo vestido\".";
  }

  // Precios ORIGINALES sin tocar — el descuento se aplica por separado.
  document.getElementById("c-precio").value = cot.precio||"";
  document.getElementById("c-precio-paquete").value = cot.precioPaquete||"";

  // Promoción + base del descuento
  document.getElementById("c-promocion").value = cot.promocion||"";
  const baseGuardada = cot.descuentoBase || "ambos";
  document.querySelectorAll('input[name="c-desc-base"]').forEach(r=>{
    r.checked = (r.value === baseGuardada);
  });

  // Fecha del evento
  if(cot.fechaEvento){
    document.getElementById("c-entrega").value = cot.fechaEvento;
  }

  // Adicionales
  const adicionalesCot = (cot.paquete && cot.paquete.adicionales) || [];
  if(typeof ADICIONALES !== "undefined"){
    ADICIONALES.forEach((a,i)=>{
      const match = adicionalesCot.find(x=>x.nombre===a);
      const chk = document.getElementById("ac-"+i);
      if(!chk) return;
      chk.checked = !!match;
      const item = document.getElementById("ai-"+i);
      if(item) item.classList.toggle("sel", !!match);
      if(match){
        const ap = document.getElementById("ap-"+i);
        const an = document.getElementById("an-"+i);
        if(ap) ap.value = match.precio||"";
        if(an) an.value = match.nota||"";
      }
    });
  }

  // Observaciones — solo lo que no tiene campo propio en el cliente
  const lineas = [`Convertido desde cotización ${cot.folio}`];
  if(cot.origen)      lineas.push(`Origen: ${cot.origen}`);
  if(cot.fechaCita)   lineas.push(`Fecha de la cita: ${cot.fechaCita}`);
  if(cot.vigencia)    lineas.push(`Vigencia de la cotización: hasta ${cot.vigencia}`);
  if(cot.anotaciones){ lineas.push(""); lineas.push(`Notas de la cotización: ${cot.anotaciones}`); }
  if(notaExtra)       { lineas.push(""); lineas.push(notaExtra); }
  document.getElementById("c-obs").value = lineas.join("\n");
  // Transferir vínculo con inventario al formulario de cliente. Se hace
  // DESPUÉS de goSec (que ya limpió window._qrArticuloActual) y ANTES de que
  // el usuario guarde, para que saveCliente lo tome y lo guarde.
  if(cot.articuloId){
    window._qrArticuloActual = cot.articuloId;
    const cqArtCli = (window._invData||[]).find(a=>a.id===cot.articuloId);
    const cliScanMsg = document.getElementById("inv-scan-msg");
    if(cliScanMsg && cqArtCli){
      const stockCli = Number(cqArtCli.cantidad)||0;
      if(stockCli > 0){
        cliScanMsg.style.color = "var(--dorado-d)";
        cliScanMsg.innerHTML = "✓ "+cqArtCli.categoria+" · "+cqArtCli.modelo+" · Talla "+cqArtCli.talla+" · "+cqArtCli.colorNombre;
      } else {
        cliScanMsg.style.color = "#B8860B";
        cliScanMsg.innerHTML = "⚠️ "+cqArtCli.categoria+" · "+cqArtCli.modelo+" · Talla "+cqArtCli.talla+" · "+cqArtCli.colorNombre+" — sin stock en tienda";
      }
    }
  }

  calcTotal();
  window._cqConvirtiendoId = id;
  toast("Formulario prellenado — revisa y guarda el cliente");
}

// ══ ESTADÍSTICAS DEL COTIZADOR ══
// Calcula métricas sobre las cotizaciones creadas en un año. Solo lectura —
// nunca escribe en Firestore. Se apoya en los campos que ya existen en
// cada documento: estatus, origen, motivoNoRegreso, impresiones.

async function renderEstadisticasCotizador(){
  // 1) Cargar cotizaciones frescas del servidor
  let cots;
  try{
    cots = await loadCotizacionesFS();
    allCotizaciones = cots;
  }catch(e){
    console.error("No se pudieron cargar cotizaciones:", e);
    const kpis = document.getElementById("cq-stats-kpis");
    if(kpis) kpis.innerHTML = '<div style="grid-column:1/-1;padding:1rem;color:var(--rojo);text-align:center">⚠️ No se pudieron cargar las cotizaciones. Revisa tu conexión.</div>';
    return;
  }

  // 2) Poblar select de años (solo la primera vez, o si cambió la lista)
  const sel = document.getElementById("cq-stats-anio");
  if(sel){
    const anios = new Set();
    cots.forEach(c=>{
      const y = (c.fechaCreacion||"").slice(0,4);
      if(y && /^\d{4}$/.test(y)) anios.add(y);
    });
    const anioActual = String(new Date().getFullYear());
    anios.add(anioActual);
    const listaAnios = [...anios].sort((a,b)=>b.localeCompare(a));
    const valorPrevio = sel.value;
    sel.innerHTML = listaAnios.map(a=>`<option value="${a}">${a}</option>`).join("");
    sel.value = valorPrevio && listaAnios.includes(valorPrevio) ? valorPrevio : anioActual;
  }

  const anio = (sel && sel.value) || String(new Date().getFullYear());

  // 3) Filtrar por año
  const delAnio = cots.filter(c=>(c.fechaCreacion||"").slice(0,4) === anio);

  // 4) KPIs generales
  const total      = delAnio.length;
  const convertidas = delAnio.filter(c=>c.estatus==="convertida").length;
  const noRegreso  = delAnio.filter(c=>c.estatus==="no_regreso").length;
  const pendientes = delAnio.filter(c=>c.estatus==="pendiente"||c.estatus==="agendada").length;
  const baseTasa   = convertidas + noRegreso;
  const tasa       = baseTasa > 0 ? Math.round(convertidas * 100 / baseTasa) : 0;

  const kpis = document.getElementById("cq-stats-kpis");
  if(kpis){
    kpis.innerHTML = `
      <div class="card" style="padding:.7rem .9rem;text-align:center">
        <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.1em;color:#AAA;margin-bottom:.3rem">Total cotizaciones</div>
        <div style="font-size:1.2rem;font-weight:700;color:var(--cafe)">${total}</div>
      </div>
      <div class="card" style="padding:.7rem .9rem;text-align:center">
        <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.1em;color:#AAA;margin-bottom:.3rem">Convertidas</div>
        <div style="font-size:1.2rem;font-weight:700;color:#3A6EA5">${convertidas}</div>
      </div>
      <div class="card" style="padding:.7rem .9rem;text-align:center">
        <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.1em;color:#AAA;margin-bottom:.3rem">No regresaron</div>
        <div style="font-size:1.2rem;font-weight:700;color:var(--rojo)">${noRegreso}</div>
      </div>
      <div class="card" style="padding:.7rem .9rem;text-align:center">
        <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.1em;color:#AAA;margin-bottom:.3rem">Tasa de conversión</div>
        <div style="font-size:1.2rem;font-weight:700;color:var(--verde)">${tasa}%</div>
        <div style="font-size:.62rem;color:#AAA;margin-top:.2rem">Sobre ${baseTasa} con veredicto</div>
      </div>
      <div class="card" style="padding:.7rem .9rem;text-align:center">
        <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.1em;color:#AAA;margin-bottom:.3rem">Pendientes / Agendadas</div>
        <div style="font-size:1.2rem;font-weight:700;color:#B8860B">${pendientes}</div>
      </div>`;
  }

  // 5) Origen
  const porOrigen = {};
  delAnio.forEach(c=>{
    const o = (c.origen||"Sin especificar").trim();
    if(!porOrigen[o]) porOrigen[o] = { total:0, convertidas:0, noRegreso:0 };
    porOrigen[o].total++;
    if(c.estatus==="convertida") porOrigen[o].convertidas++;
    if(c.estatus==="no_regreso") porOrigen[o].noRegreso++;
  });
  const filasOrigen = Object.entries(porOrigen)
    .map(([o,v])=>({
      origen:o,
      total:v.total,
      convertidas:v.convertidas,
      noRegreso:v.noRegreso,
      tasa: (v.convertidas+v.noRegreso)>0 ? Math.round(v.convertidas*100/(v.convertidas+v.noRegreso)) : 0
    }))
    .sort((a,b)=>b.total-a.total);

  const contOrigen = document.getElementById("cq-stats-origen");
  if(contOrigen){
    if(!filasOrigen.length){
      contOrigen.innerHTML = '<p style="color:#AAA;font-size:.82rem;padding:.5rem">Sin datos para este año.</p>';
    }else{
      contOrigen.innerHTML = `
        <div style="overflow-x:auto">
          <table class="tbl">
            <thead><tr>
              <th>Origen</th><th style="text-align:right">Total</th>
              <th style="text-align:right">Convertidas</th>
              <th style="text-align:right">No regresaron</th>
              <th style="text-align:right">Tasa</th>
            </tr></thead>
            <tbody>
              ${filasOrigen.map(f=>`<tr>
                <td style="font-size:.8rem">${f.origen}</td>
                <td style="font-size:.76rem;text-align:right">${f.total}</td>
                <td style="font-size:.76rem;text-align:right;color:#3A6EA5">${f.convertidas}</td>
                <td style="font-size:.76rem;text-align:right;color:var(--rojo)">${f.noRegreso}</td>
                <td style="font-size:.76rem;text-align:right;color:var(--verde);font-weight:600">${f.tasa}%</td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>`;
    }
  }

  // 6) Motivos de no regreso
  const porMotivo = {};
  delAnio.filter(c=>c.estatus==="no_regreso").forEach(c=>{
    const m = (c.motivoNoRegreso||"Sin especificar").trim();
    porMotivo[m] = (porMotivo[m]||0) + 1;
  });
  const filasMotivo = Object.entries(porMotivo)
    .map(([m,n])=>({motivo:m, cantidad:n, pct: noRegreso>0 ? Math.round(n*100/noRegreso) : 0}))
    .sort((a,b)=>b.cantidad-a.cantidad);

  const contMotivos = document.getElementById("cq-stats-motivos");
  if(contMotivos){
    if(!filasMotivo.length){
      contMotivos.innerHTML = '<p style="color:#AAA;font-size:.82rem;padding:.5rem">Sin cotizaciones "no regresó" este año.</p>';
    }else{
      contMotivos.innerHTML = `
        <div style="overflow-x:auto">
          <table class="tbl">
            <thead><tr>
              <th>Motivo</th>
              <th style="text-align:right">Cantidad</th>
              <th style="text-align:right">% del total</th>
            </tr></thead>
            <tbody>
              ${filasMotivo.map(f=>`<tr>
                <td style="font-size:.8rem">${f.motivo}</td>
                <td style="font-size:.76rem;text-align:right">${f.cantidad}</td>
                <td style="font-size:.76rem;text-align:right;color:var(--rojo);font-weight:600">${f.pct}%</td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>`;
    }
  }

  // 7) Impresiones
  const totalImpresiones = delAnio.reduce((s,c)=>s + (Array.isArray(c.impresiones)?c.impresiones.length:0), 0);
  const conAlMenosUna = delAnio.filter(c=>Array.isArray(c.impresiones) && c.impresiones.length>0);
  const promedio = conAlMenosUna.length > 0 ? (totalImpresiones / conAlMenosUna.length).toFixed(1) : "0";
  const topImpresas = delAnio
    .filter(c=>Array.isArray(c.impresiones) && c.impresiones.length>0)
    .map(c=>({folio:c.folio, nombre:c.nombre, veces:c.impresiones.length}))
    .sort((a,b)=>b.veces-a.veces)
    .slice(0,10);

  const contImpr = document.getElementById("cq-stats-impresiones");
  if(contImpr){
    const encabezado = `
      <div style="display:flex;gap:.6rem;flex-wrap:wrap;margin-bottom:.6rem">
        <div style="background:#F5EDE0;border-radius:6px;padding:.5rem .9rem;flex:1;min-width:150px">
          <div style="font-size:.62rem;letter-spacing:.08em;text-transform:uppercase;color:var(--dorado-d)">Total impresiones</div>
          <div style="font-family:'Cormorant Garamond',serif;font-size:1.4rem;color:var(--texto);line-height:1.2">${totalImpresiones}</div>
        </div>
        <div style="background:#F5EDE0;border-radius:6px;padding:.5rem .9rem;flex:1;min-width:150px">
          <div style="font-size:.62rem;letter-spacing:.08em;text-transform:uppercase;color:var(--dorado-d)">Promedio por cotización impresa</div>
          <div style="font-family:'Cormorant Garamond',serif;font-size:1.4rem;color:var(--texto);line-height:1.2">${promedio}</div>
        </div>
      </div>`;
    if(!topImpresas.length){
      contImpr.innerHTML = encabezado + '<p style="color:#AAA;font-size:.82rem;padding:.5rem">Sin impresiones registradas este año.</p>';
    }else{
      contImpr.innerHTML = encabezado + `
        <div style="overflow-x:auto">
          <table class="tbl">
            <thead><tr>
              <th>Folio</th><th>Nombre</th>
              <th style="text-align:right">Veces impresa</th>
            </tr></thead>
            <tbody>
              ${topImpresas.map(f=>`<tr>
                <td style="font-size:.72rem;color:#AAA">${f.folio||"—"}</td>
                <td style="font-size:.8rem">${f.nombre}</td>
                <td style="font-size:.76rem;text-align:right;font-weight:600">${f.veces}</td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>`;
    }
  }
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
  const extras = (c.paquete?.adicionales||[]).reduce((s,a)=>s+Number(a.precio||0),0);
  const total = (c.precio||0) + (c.precioPaquete||0) + extras;
  const desc = Number(c.descuentoMonto)||0;
  const totalNeto = total - desc;
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
        ${(c.paquete?.adicionales && c.paquete.adicionales.length)?`
    <div style="font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:#7A4F2A;margin-bottom:.4rem;margin-top:.6rem">Artículos adicionales</div>
    <table style="width:100%;border-collapse:collapse;font-size:.8rem;margin-bottom:1rem">
      <tr>
        <th style="border:1px solid #DDD;padding:.35rem .6rem;background:#FAFAFA;text-align:left">Artículo</th>
        <th style="border:1px solid #DDD;padding:.35rem .6rem;background:#FAFAFA;text-align:left">Especificación</th>
        <th style="border:1px solid #DDD;padding:.35rem .6rem;background:#FAFAFA;text-align:right">Monto</th>
      </tr>
      ${c.paquete.adicionales.map(a=>`<tr>
        <td style="border:1px solid #DDD;padding:.35rem .6rem">${a.nombre}</td>
        <td style="border:1px solid #DDD;padding:.35rem .6rem;color:#777">${a.nota||"—"}</td>
        <td style="border:1px solid #DDD;padding:.35rem .6rem;text-align:right">$${Number(a.precio||0).toLocaleString("es-MX")}</td>
      </tr>`).join("")}
    </table>`:""}
    <table style="width:100%;border-collapse:collapse;font-size:.85rem;margin-bottom:1rem">
      <tr><td style="padding:.25rem 0">Precio vestido:</td><td style="padding:.25rem 0;text-align:right">$${(c.precio||0).toLocaleString("es-MX")}</td></tr>
      <tr><td style="padding:.25rem 0">Precio paquete:</td><td style="padding:.25rem 0;text-align:right">$${(c.precioPaquete||0).toLocaleString("es-MX")}</td></tr>
            ${extras>0?`<tr><td style="padding:.25rem 0">Adicionales:</td><td style="padding:.25rem 0;text-align:right">$${extras.toLocaleString("es-MX")}</td></tr>`:""}
      ${c.promocion?`<tr><td style="padding:.25rem 0">Promoción aplicada:</td><td style="padding:.25rem 0;text-align:right">${c.promocion}</td></tr>`:""}
      ${desc>0?`<tr><td style="padding:.25rem 0;color:#7A4F2A">Descuento (${c.descuentoPct}% ${c.descuentoBase||"ambos"}):</td><td style="padding:.25rem 0;text-align:right;color:#7A4F2A">−$${desc.toLocaleString("es-MX")}</td></tr>`:""}
      <tr><td style="padding:.4rem 0;border-top:1px solid #C9A84C;font-weight:700">Total estimado:</td><td style="padding:.4rem 0;border-top:1px solid #C9A84C;text-align:right;font-weight:700;font-size:1rem">$${totalNeto.toLocaleString("es-MX")}</td></tr>
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
  // Restaurar vínculo con inventario — tres estados posibles:
  //   disponible  → artículo existe y tiene stock
  //   sin-stock   → artículo existe pero cantidad = 0
  //   eliminado   → el artículo ya no está en el inventario
  window._cqArticuloActual = cot.articuloId || null;
  const cqScanMsgEdit = document.getElementById("cq-inv-scan-msg");
  const cqScanInputEdit = document.getElementById("cq-inv-scan-input");
  if(cqScanInputEdit) cqScanInputEdit.value = "";
  if(cqScanMsgEdit){
    const artEdit = cot.articuloId ? (window._invData||[]).find(a=>a.id===cot.articuloId) : null;
    const btnQuitar = ' <button type="button" onclick="cqQuitarArticuloEscaneado()" style="background:none;border:none;color:var(--rojo);cursor:pointer;font-size:.68rem;text-decoration:underline;padding:0">✕ Quitar</button>';
    if(artEdit){
      const stock = Number(artEdit.cantidad)||0;
      if(stock > 0){
        cqScanMsgEdit.style.color = "var(--dorado-d)";
        cqScanMsgEdit.innerHTML = "✓ "+artEdit.categoria+" · "+artEdit.modelo+" · Talla "+artEdit.talla+" · "+artEdit.colorNombre+btnQuitar;
      } else {
        cqScanMsgEdit.style.color = "#B8860B";
        cqScanMsgEdit.innerHTML = "⚠️ "+artEdit.categoria+" · "+artEdit.modelo+" · Talla "+artEdit.talla+" · "+artEdit.colorNombre+" — sin stock en tienda"+btnQuitar;
      }
    } else if(cot.articuloId){
      cqScanMsgEdit.style.color = "var(--rojo)";
      cqScanMsgEdit.innerHTML = "✕ Artículo eliminado del inventario"+btnQuitar;
    } else {
      cqScanMsgEdit.style.color = "";
      cqScanMsgEdit.innerHTML = "";
    }
  }
  // Restaurar base de descuento (default "ambos" si es cotización histórica)
const baseGuardada = cot.descuentoBase || "ambos";
document.querySelectorAll('input[name="cq-desc-base"]').forEach(r=>{
  r.checked = (r.value === baseGuardada);
});
  cqSelPkg((cot.paquete && cot.paquete.tipo) || "xv");
  cqAplicarComponentesGuardados(cot.paquete && cot.paquete.componentes);
  cqInitAdicionales(cot.paquete && cot.paquete.adicionales);
  cqCalcTotal();
  window._cqEditandoId = id; // se activa DESPUÉS de goSec, que ya reseteó
  const titulo=document.querySelector("#sec-nueva-cotizacion .sec-title"); if(titulo) titulo.textContent="Editar cotización "+cot.folio;
  const btn=document.getElementById("btn-guardar-cotizacion"); if(btn) btn.innerHTML="💾 Guardar cambios";
}
