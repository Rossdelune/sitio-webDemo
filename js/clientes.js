function limpiarFormularioCliente(){
  // Si había una conversión de cotización pendiente y el usuario empieza un
  // cliente nuevo desde cero (sin pasar por "Convertir a cliente"), se
  // descarta — así nunca se marca por error una cotización vieja.
  window._cqConvirtiendoId = null;
  // Campos de texto, número, fecha, textarea
  const ids=["c-nombre","c-cel","c-correo","c-tel","c-domicilio","c-tipo","c-marca",
    "c-modelo","c-talla","c-color-name","c-elab","c-sispago","m-busto","m-cintura",
    "m-cadera","m-copa","m-largo","c-precio-paquete","c-fecha","c-fecha-limite",
    "c-entrega","c-parcialidades","c-precio","c-anticipo",
    "c-fpago","c-obs"];
  ids.forEach(id=>{
    const el=document.getElementById(id);
    if(!el) return;
    if(el.tagName==="SELECT") el.selectedIndex=0;
    else el.value="";
  });
  // Elaboración e imagen vuelven a su default
  const elab=document.getElementById("c-elab");
  if(elab) elab.selectedIndex=0;
  const imagen=document.getElementById("c-imagen");
  if(imagen) imagen.selectedIndex=0;
  // Limpiar y ocultar campo cuenta anticipo
  const cuentaAnticEl=document.getElementById("c-cuenta-anticipo");
  if(cuentaAnticEl) cuentaAnticEl.value="";
  const fiCuentaAntic=document.getElementById("fi-cuenta-anticipo");
  if(fiCuentaAntic) fiCuentaAntic.style.display="none";
  const refAnticEl=document.getElementById("c-ref-anticipo");
  if(refAnticEl) refAnticEl.value="";
  const fiRefAntic=document.getElementById("fi-ref-anticipo");
  if(fiRefAntic) fiRefAntic.style.display="none";
  // Folio display
  const folioDisp=document.getElementById("c-folio-display");
  if(folioDisp) folioDisp.textContent="Se asignará al guardar";
  // Color picker reset
  selectedColor="#C8A8D0";
  const colorBox=document.getElementById("color-preview-box");
  if(colorBox) colorBox.style.background=selectedColor;
  const colorPicker=document.getElementById("color-picker");
  if(colorPicker) colorPicker.value=selectedColor;
  // Paquete: resetear a XV
  currentPkg="xv";
  ["xv","novia","solo","custom"].forEach(t=>{
    const btn=document.getElementById("pb-"+t);
    if(btn) btn.classList.toggle("active",t==="xv");
  });
  initPkgComponents("xv");
  // Adicionales: desmarcar todo
  initAdicionales();
  // Ocultar bloque de parcialidades
  const fiParc=document.getElementById("fi-parcialidades");
  if(fiParc) fiParc.style.display="none";
  // Resumen de costos a cero
  calcTotal();
  // Escaneo QR: limpiar mensaje del artículo del cliente anterior
  const scanMsg=document.getElementById("inv-scan-msg");
  if(scanMsg){ scanMsg.style.color=""; scanMsg.innerHTML=""; }
  const scanInput=document.getElementById("inv-scan-input");
  if(scanInput) scanInput.value="";
  window._qrArticuloActual=null;
  window._qrPrecio1=0;
  window._qrPrecio2=0;
  const precioWarn=document.getElementById("precio-auto-warn");
  if(precioWarn) precioWarn.style.display="none";
  // Segundo vestido: colapsar y limpiar por completo
  const bloqueV2=document.getElementById("bloque-vestido2");
  if(bloqueV2 && bloqueV2.style.display!=="none") toggleSegundoVestido();
  // Reset base de descuento a "ambos"
  document.querySelectorAll('input[name="c-desc-base"]').forEach(r=>{
    r.checked = (r.value === "ambos");
  });
  // Mensaje de error limpio
  const msg=document.getElementById("cliente-msg");
  if(msg) msg.textContent="";
}

// ══ COLOR PICKER ══
function initColorPicker(){
  document.getElementById("color-preview-box").style.background=selectedColor;
  document.getElementById("color-picker").value=selectedColor;
}
function onColorChange(val){
  selectedColor=val;
  document.getElementById("color-preview-box").style.background=val;
}
function onColorNameInput(val){}
function onColorChange2(val){
  const box=document.getElementById("color-preview-box2");
  if(box) box.style.background=val;
}

function toggleSegundoVestido(){
  const bloque = document.getElementById("bloque-vestido2");
  const btn = document.getElementById("btn-toggle-vestido2");
  const abrir = bloque.style.display==="none";
  bloque.style.display = abrir ? "block" : "none";
  if(!abrir){
    // Al quitar el segundo vestido, limpiar sus campos y su vínculo
    ["c-marca2","c-modelo2","c-talla2","c-color-name2","inv-scan-input2","m-busto2","m-cintura2","m-cadera2","m-copa2","m-largo2"].forEach(id=>{
      const el=document.getElementById(id); if(el) el.value="";
    });
    document.getElementById("color-picker2").value="#C8A8D0";
    document.getElementById("color-preview-box2").style.background="";
    const msg2=document.getElementById("inv-scan-msg2");
    if(msg2){msg2.style.color="";msg2.innerHTML="";}
    window._qrArticuloActual2 = null;
    window._qrPrecio2 = 0;
    actualizarPrecioAutoSuma();
  }
  document.getElementById("fi-toggle-vestido2").style.display = abrir ? "none" : "block";
}

function buscarPorQR2(){
  const input = document.getElementById("inv-scan-input2");
  const msg = document.getElementById("inv-scan-msg2");
  const id = (input.value||"").trim();
  msg.textContent="";
  if(!id) return;
  const inv = window._invData||[];
  const art = inv.find(x=>x.id===id);
  if(!art){
    msg.style.color="var(--rojo)";
    msg.textContent="✕ Artículo no encontrado en inventario.";
    return;
  }
  document.getElementById("c-modelo2").value = art.modelo||"";
  document.getElementById("c-marca2").value = art.marca||"";
  document.getElementById("c-talla2").value = art.talla||"";
  document.getElementById("c-color-name2").value = art.colorNombre||"";
  document.getElementById("color-picker2").value = art.colorHex||"#C8A8D0";
  document.getElementById("color-preview-box2").style.background = art.colorHex||"#C8A8D0";
  window._qrArticuloActual2 = art.id;
  window._qrPrecio2 = Number(art.precio)||0;
  actualizarPrecioAutoSuma();
  msg.style.color="var(--dorado-d)";
  msg.innerHTML = "✓ "+art.categoria+" · "+art.modelo+" · Talla "+art.talla+" · "+art.colorNombre+
    ' <button type="button" onclick="quitarArticuloEscaneado2()" style="background:none;border:none;color:var(--rojo);cursor:pointer;font-size:.68rem;text-decoration:underline;padding:0">✕ Quitar</button>';
  input.value="";
}

function quitarArticuloEscaneado2(){
  document.getElementById("c-modelo2").value="";
  document.getElementById("c-talla2").value="";
  document.getElementById("c-color-name2").value="";
  document.getElementById("color-picker2").value="#C8A8D0";
  document.getElementById("color-preview-box2").style.background="";
  window._qrArticuloActual2=null;
  window._qrPrecio2 = 0;
  actualizarPrecioAutoSuma();
  const msg=document.getElementById("inv-scan-msg2");
  if(msg){ msg.style.color=""; msg.innerHTML=""; }
}

function onInvColorChange(val){
  const box=document.getElementById("inv-color-preview-box");
  if(box) box.style.background=val;
}

// ══ PAQUETES ══
const PKG_XV=[
  {id:"ramo",    name:"Ramo",    opts:["Chico","Grande","Jumbo"], default:"Chico"},
  {id:"corsage", name:"Corsage", opts:["Estándar","Grande","Jumbo"],default:"Estándar"},
  {id:"aro",     name:"Aro",     opts:["Básico","Maxi","Sin aro"], default:"Básico"},
  {id:"tiara",   name:"Tiara",   opts:["Estándar","Grande"],       default:"Estándar"},
  {id:"ajustes", name:"Ajustes", opts:["Incluidos"],               default:"Incluidos"},
];
const PKG_NOVIA=[
  {id:"ramo",      name:"Ramo",           opts:["Chico","Grande","Jumbo"],   default:"Chico"},
  {id:"corsage",   name:"Corsage",        opts:["Estándar","Grande","Jumbo"],default:"Estándar"},
  {id:"crinolina", name:"Crinolina",      opts:["Estándar","1 Olán","Maxi"], default:"Estándar"},
  {id:"aro",       name:"Aro",            opts:["Básico","Maxi","Sin aro"],  default:"Básico"},
  {id:"velo",      name:"Velo bordado",   opts:["Corto","Largo","Mantilla"], default:"Corto"},
  {id:"ajustes",   name:"Ajustes",        opts:["Incluidos"],                default:"Incluidos"},
];
const PKG_CUSTOM=[
  {id:"ramo",      name:"Ramo",          opts:["Chico","Grande","Jumbo"],   default:""},
  {id:"corsage",   name:"Corsage",       opts:["Estándar","Grande","Jumbo"],default:""},
  {id:"aro",       name:"Aro",           opts:["Básico","Maxi","Sin aro"],  default:""},
  {id:"tiara",     name:"Tiara",         opts:["Estándar","Grande"],        default:""},
  {id:"crinolina", name:"Crinolina",     opts:["Estándar","1 Olán","Maxi"],default:""},
  {id:"velo",      name:"Velo bordado",  opts:["Corto","Largo","Mantilla"],default:""},
  {id:"ajustes",   name:"Ajustes",       opts:["Incluidos","No incluidos"], default:""},
];

let currentPkg="xv";

function selPkg(type){
  currentPkg=type;
  ["xv","novia","solo","custom"].forEach(t=>{
    document.getElementById("pb-"+t).classList.toggle("active",t===type);
  });
  initPkgComponents(type);
}

function initPkgComponents(type){
  const cont=document.getElementById("pkg-components");
  if(type==="solo"){cont.innerHTML='<p style="font-size:.8rem;color:#AAA;padding:.5rem 0">Sin paquete — solo vestido.</p>';return;}
  const items=type==="novia"?PKG_NOVIA:type==="custom"?PKG_CUSTOM:PKG_XV;
  const isCustom=type==="custom";
  cont.innerHTML=items.map(c=>`
    <div class="comp-item" id="ci-${c.id}">
      <input type="checkbox" class="comp-check" id="chk-${c.id}" ${!isCustom?"checked":""} onchange="toggleComp('${c.id}')">
      <div class="comp-body">
        <div class="comp-name">${c.name}</div>
        <div class="comp-opts" id="opts-${c.id}">
          ${c.opts.map(o=>`<button class="comp-opt ${o===c.default?"sel":""}" onclick="selOpt('${c.id}','${o}',this)">${o}</button>`).join("")}
        </div>
        <input class="comp-spec" placeholder="Especificaciones adicionales..." id="spec-${c.id}">
      </div>
    </div>`).join("");
}

function selOpt(compId,opt,btn){
  document.querySelectorAll(`#opts-${compId} .comp-opt`).forEach(b=>b.classList.remove("sel"));
  btn.classList.add("sel");
}
function toggleComp(id){
  const chk=document.getElementById("chk-"+id);
  const body=document.querySelector(`#ci-${id} .comp-body`);
  body.style.opacity=chk.checked?"1":".35";
}
function updatePkg(){
  const tipo=document.getElementById("c-tipo").value;
  if(tipo==="xv")selPkg("xv");
  else if(tipo==="novia")selPkg("novia");
}

// ══ ADICIONALES ══
const ADICIONALES=[
  "Aro maxi","Ramo y corsage grande","Ramo y corsage jumbo",
  "Crinolina de 1 olán","Crinolina maxi","Kittys",
  "Accesorios (collar y aretes)","Muñecas","Osos",
  "Juego de tocados","Tiaras grandes","Tenis","Velo mantilla"
];
function initAdicionales(){
  const grid=document.getElementById("add-grid");
  grid.innerHTML=ADICIONALES.map((a,i)=>`
    <div class="add-item" id="ai-${i}">
      <div class="add-header">
        <input type="checkbox" class="add-check" id="ac-${i}" onchange="toggleAdicional(${i})">
        <label class="add-label" for="ac-${i}">${a}</label>
        <input type="number" class="add-price" id="ap-${i}" placeholder="$0" min="0" oninput="calcTotal()">
      </div>
      <input class="add-note" id="an-${i}" placeholder="Especificaciones...">
    </div>`).join("");
}
function toggleAdicional(i){
  const chk=document.getElementById("ac-"+i);
  document.getElementById("ai-"+i).classList.toggle("sel",chk.checked);
  calcTotal();
}
function getDescuentoCliente(){
  const promoRaw = (document.getElementById("c-promocion")?.value||"").trim();
  const m = promoRaw.match(/(\d+(?:[.,]\d+)?)\s*%?/);
  const pct = m ? Math.min(100, Math.max(0, parseFloat(m[1].replace(",", ".")))) : 0;
  const radio = document.querySelector('input[name="c-desc-base"]:checked');
  const base = radio ? radio.value : "ambos";
  const vestido = parseFloat(document.getElementById("c-precio")?.value)||0;
  const paquete = parseFloat(document.getElementById("c-precio-paquete")?.value)||0;
  const baseMonto = base==="vestido" ? vestido : base==="paquete" ? paquete : vestido + paquete;
  const monto = Math.round(baseMonto * pct / 100);
  return { pct, base, monto };
}
function calcTotal(){
  const vestido  = parseFloat(document.getElementById("c-precio").value)||0;
  const paquete  = parseFloat(document.getElementById("c-precio-paquete").value)||0;
  const anticipo = parseFloat(document.getElementById("c-anticipo").value)||0;
  let extras=0;
  ADICIONALES.forEach((_,i)=>{
    const chk=document.getElementById("ac-"+i);
    if(chk&&chk.checked){
      const p=parseFloat(document.getElementById("ap-"+i).value)||0;
      extras+=p;
    }
  });
  const desc   = getDescuentoCliente();
  const total  = vestido + paquete + extras - desc.monto;
  const saldo  = total - anticipo;
  document.getElementById("resumen-vestido").textContent  = "$"+vestido.toLocaleString("es-MX");
  document.getElementById("resumen-paquete").textContent  = "$"+paquete.toLocaleString("es-MX");
  document.getElementById("resumen-extras").textContent   = "$"+extras.toLocaleString("es-MX");
  document.getElementById("resumen-total").textContent    = "$"+total.toLocaleString("es-MX");
  document.getElementById("resumen-anticipo").textContent = "$"+anticipo.toLocaleString("es-MX");
  document.getElementById("resumen-saldo").textContent    = "$"+saldo.toLocaleString("es-MX");

  const w = document.getElementById("resumen-descuento-wrap");
  const e = document.getElementById("resumen-descuento");
  if(w && e){
    if(desc.monto > 0 && desc.pct > 0){
      w.style.display = "flex";
      e.textContent = "−$"+desc.monto.toLocaleString("es-MX")+" ("+desc.pct+"% "+desc.base+")";
    } else {
      w.style.display = "none";
      e.textContent = "";
    }
  }
}

// ══ GUARDAR CLIENTE ══
function getPkgData(){
  if(currentPkg==="solo")return{tipo:"solo",componentes:[],adicionales:getAdicionales()};
  const items=currentPkg==="novia"?PKG_NOVIA:currentPkg==="custom"?PKG_CUSTOM:PKG_XV;
  const comps=items.map(c=>{
    const chk=document.getElementById("chk-"+c.id);
    if(!chk||!chk.checked)return null;
    const selBtn=document.querySelector(`#opts-${c.id} .comp-opt.sel`);
    const spec=document.getElementById("spec-"+c.id);
    return{id:c.id,name:c.name,opcion:selBtn?selBtn.textContent:"",especificacion:spec?spec.value:""};
  }).filter(Boolean);
  return{tipo:currentPkg,componentes:comps,adicionales:getAdicionales()};
}
function getAdicionales(){
  return ADICIONALES.map((a,i)=>{
    const chk=document.getElementById("ac-"+i);
    if(!chk||!chk.checked)return null;
    return{nombre:a,precio:document.getElementById("ap-"+i).value||0,nota:document.getElementById("an-"+i).value};
  }).filter(Boolean);
}

// ══ SINCRONIZACIÓN AUTOMÁTICA: adicionales del pedido → tabla de Accesorios ══
// Antes, marcar un artículo adicional (aro, tenis, tiara, etc.) en el pedido de
// un cliente SOLO sumaba su precio al total — nunca creaba el registro
// correspondiente en la colección de Accesorios (la que alimenta Pedidos →
// Accesorios, con su propio seguimiento Pedido Realizado → En Compra → En
// Tienda → Recibido → Entregado). Eran dos sistemas desconectados: había que
// abrir "Registrar accesorio" a mano para que apareciera ahí.
// Esta función se llama automáticamente al guardar o editar un cliente y crea
// el registro que falte. Es idempotente (no duplica si ya existe uno para ese
// cliente+tipo) y solo AGREGA — nunca borra uno que ya esté en proceso, para
// no perder el rastro de una compra en curso si alguien desmarca el checkbox
// al editar.
async function sincronizarAccesoriosCliente(cliente){
  const adicionales = cliente?.paquete?.adicionales || [];
  if(!adicionales.length) return;
  try{
    allAccesorios = await loadAccesoriosFS();
    const yaExisten = new Set(
      allAccesorios.filter(a=>a.clienteId===cliente.id).map(a=>(a.tipo||"").trim().toLowerCase())
    );
    const faltantes = adicionales.filter(a=>!yaExisten.has((a.nombre||"").trim().toLowerCase()));
    for(const item of faltantes){
      const nuevo = {
        id: "acc_"+Date.now()+"_"+Math.random().toString(36).slice(2,7),
        fecha: fechaLocalISO(),
        tipo: item.nombre,
        cantidad: 1,
        clienteId: cliente.id,
        clienteNombre: cliente.nombre,
        estatus: "Pedido Realizado",
        registradoPor: currentUser.user,
        autoGenerado: true
      };
      await saveUnAccesorio(nuevo);
      allAccesorios.push(nuevo);
    }
  }catch(e){
    // No debe romper el guardado del cliente si esto falla — solo se avisa en consola.
    console.error("No se pudo sincronizar accesorios del cliente:", e);
  }
}

// Versión "en lote" de la sincronización de arriba: revisa TODOS los clientes
// ya existentes (no solo el que se acaba de guardar/editar) y crea en
// Accesorios los registros que falten. Sirve para ponerse al día una sola vez
// con los clientes que quedaron desconectados antes de este arreglo — y queda
// disponible como botón permanente por si vuelve a pasar (importaciones,
// clientes editados desde otro lado, etc.). Solo admins pueden correrla,
// porque escribe varios documentos nuevos de golpe.
async function sincronizarAccesoriosTodosClientes(){
  if(!currentUser || currentUser.role!=="admin"){
    toast("Solo un administrador puede ejecutar esta sincronización","err");
    return;
  }
  if(!confirm("Esto va a revisar TODOS los clientes y crear en Accesorios los artículos adicionales que tengan marcados en su pedido y todavía no estén registrados ahí. No se borra ni se duplica nada existente. ¿Continuar?")) return;
  const btn = document.getElementById("btn-sync-accesorios");
  const textoOriginal = btn ? btn.textContent : "";
  if(btn){ btn.disabled=true; btn.textContent="⏳ Sincronizando..."; }
  try{
    allAccesorios = await loadAccesoriosFS();
    allClientes = await loadClientesFS();
    let creados = 0, clientesTocados = 0;
    for(const cliente of allClientes){
      const adicionales = cliente?.paquete?.adicionales || [];
      if(!adicionales.length) continue;
      const yaExisten = new Set(
        allAccesorios.filter(a=>a.clienteId===cliente.id).map(a=>(a.tipo||"").trim().toLowerCase())
      );
      const faltantes = adicionales.filter(a=>!yaExisten.has((a.nombre||"").trim().toLowerCase()));
      if(!faltantes.length) continue;
      for(const item of faltantes){
        const nuevo = {
          id: "acc_"+Date.now()+"_"+Math.random().toString(36).slice(2,7),
          fecha: cliente.fecha || fechaLocalISO(), // se usa la fecha del pedido original, no la de hoy
          tipo: item.nombre,
          cantidad: 1,
          clienteId: cliente.id,
          clienteNombre: cliente.nombre,
          estatus: "Pedido Realizado",
          registradoPor: currentUser.user,
          autoGenerado: true
        };
        await saveUnAccesorio(nuevo);
        allAccesorios.push(nuevo);
        creados++;
      }
      clientesTocados++;
    }
    toast(`Sincronización completa ✓ — ${creados} accesorio(s) creado(s) en ${clientesTocados} cliente(s)`);
    renderAccesorios();
  }catch(e){
    console.error("sincronizarAccesoriosTodosClientes error:", e);
    toast("Error durante la sincronización — revisa la consola","err");
  }finally{
    if(btn){ btn.disabled=false; btn.textContent=textoOriginal; }
  }
}

async function saveCliente(){
  const nombre=document.getElementById("c-nombre").value.trim();
  const msg=document.getElementById("cliente-msg");
  const btnSave=document.getElementById("btn-guardar-cliente");
  msg.textContent="";
  if(!nombre){msg.textContent="El nombre es obligatorio.";return;}
  const elabVal=document.getElementById("c-elab").value;
  if(!elabVal){msg.textContent="La elaboración del vestido es un campo obligatorio.";return;}
  const colorHex=document.getElementById("color-picker").value;
  const colorName=document.getElementById("c-color-name").value.trim()||colorHex;
  const descInfo = getDescuentoCliente();
  const cliente={
    id:"C"+Date.now(),
    folio:null,
    fecha:document.getElementById("c-fecha").value,
    nombre,
    cel:document.getElementById("c-cel").value.trim(),
    tel:document.getElementById("c-tel").value.trim(),
    correo:document.getElementById("c-correo").value.trim(),
    domicilio:document.getElementById("c-domicilio").value.trim(),
    tipo:document.getElementById("c-tipo").value,
    marca:document.getElementById("c-marca").value.trim(),
    modelo:document.getElementById("c-modelo").value.trim(),
    talla:document.getElementById("c-talla").value.trim(),
    color:{hex:colorHex,nombre:colorName},
    elaboracion:document.getElementById("c-elab").value,
    medidas:{busto:document.getElementById("m-busto").value,cintura:document.getElementById("m-cintura").value,cadera:document.getElementById("m-cadera").value,copa:document.getElementById("m-copa").value,largo:document.getElementById("m-largo").value},
    paquete:getPkgData(),
    precioPaquete:document.getElementById("c-precio-paquete").value,
    precio:document.getElementById("c-precio").value,
    anticipo:document.getElementById("c-anticipo").value,
promocion:document.getElementById("c-promocion").value.trim(),
    descuentoPct:descInfo.pct,
    descuentoBase:descInfo.base,
    descuentoMonto:descInfo.monto,
    fechaAnticipo:document.getElementById("c-fecha").value,
    sispago:document.getElementById("c-sispago").value,
    parcialidades:document.getElementById("c-parcialidades").value||30,
    fechaLimite:document.getElementById("c-fecha-limite").value,
    proroga:false,
    prorogaDias:0,
    interes:"no",
    fpago:document.getElementById("c-fpago").value,
    cuentaAnticipoId:cuentaIdPorMetodo(document.getElementById("c-fpago").value, document.getElementById("c-cuenta-anticipo").value),
    refAnticipo:document.getElementById("c-ref-anticipo").value.trim(),
    entrega:document.getElementById("c-entrega").value,
    observaciones:document.getElementById("c-obs").value.trim(),
    estatus:document.getElementById("c-elab").value,
    imagen:document.getElementById("c-imagen").value,
    articuloId:window._qrArticuloActual||null,
    vestido2: document.getElementById("bloque-vestido2").style.display!=="none" && document.getElementById("c-modelo2").value.trim()
      ? {
          marca: document.getElementById("c-marca2").value.trim(),
          modelo: document.getElementById("c-modelo2").value.trim(),
          talla: document.getElementById("c-talla2").value.trim(),
          color: {hex:document.getElementById("color-picker2").value, nombre:document.getElementById("c-color-name2").value.trim()||document.getElementById("color-picker2").value},
          medidas: {busto:document.getElementById("m-busto2").value,cintura:document.getElementById("m-cintura2").value,cadera:document.getElementById("m-cadera2").value,copa:document.getElementById("m-copa2").value,largo:document.getElementById("m-largo2").value},
          articuloId: window._qrArticuloActual2||null
        }
      : null,
    pagos:[],
    progreso:{},
    creadoPor:currentUser.user,
    creadoEn:new Date().toLocaleString("es-MX",{timeZone:"America/Mexico_City"})
  };
  try{
    if(btnSave){btnSave.disabled=true;btnSave.innerHTML='<span class="spinner"></span>Generando folio...';}
    await new Promise(r=>setTimeout(r,0));
    allClientes=await loadClientesFS();
    // Folio calculado desde el máximo real de clientes ya guardados
    const foliosNum=allClientes.map(c=>parseInt(c.folio,10)||127);
    const maxFolio=allClientes.length?Math.max(...foliosNum):127;
    cliente.folio=String(maxFolio+1).padStart(4,"0");
    await saveUnCliente(cliente);
    allClientes.push(cliente);
    await sincronizarAccesoriosCliente(cliente);
    // Si este cliente viene de "Convertir a cliente", AHORA sí se cierra el
    // vínculo — nunca antes. Si esto falla, el cliente ya quedó guardado de
    // todas formas (no se rompe el flujo principal por un problema aquí).
    if(window._cqConvirtiendoId){
      try{
        const cotOrigen = allCotizaciones.find(c=>c.id===window._cqConvirtiendoId);
        if(cotOrigen){
          cotOrigen.estatus = "convertida";
          cotOrigen.clienteFolioConvertido = cliente.folio;
          await saveUnaCotizacion(cotOrigen);
        }
      }catch(e){ console.error("No se pudo cerrar el vínculo con la cotización:",e); }
      window._cqConvirtiendoId = null;
    }
    toast("Cliente guardado ✓ — Folio "+cliente.folio);
    if(btnSave){btnSave.disabled=false;btnSave.innerHTML='💾 Guardar cliente';}
    renderClientes();
    goSec("lista-clientes");
  }catch(e){
    console.error("saveCliente error:",e);
    msg.textContent="Error al guardar: "+e.message;
    if(btnSave){btnSave.disabled=false;btnSave.innerHTML='💾 Guardar cliente';}
  }
}

// ══ EDITAR CLIENTE ══
let _editClienteId = null;

async function eliminarCliente(id, nombre){
  if(!confirm(`¿Eliminar el cliente "${nombre}"? Esta acción no se puede deshacer.`)) return;
  try{
    allClientes = await loadClientesFS();
    const cliente = allClientes.find(c=>c.id===id);
    if(cliente) await eliminarClienteFS(cliente);
    allClientes = allClientes.filter(c=>c.id!==id);
    renderClientes();
    toast("Cliente eliminado ✓");
  }catch(e){console.error(e);toast("Error al eliminar","err");}
}

function abrirEditarCliente(id){
  const c = allClientes.find(x=>x.id===id);
  if(!c){toast("Cliente no encontrado","err");return;}
  _editClienteId = id;
  const msg = document.getElementById("edit-cliente-msg");
  if(msg) msg.textContent="";

  document.getElementById("edit-cliente-titulo").textContent = c.nombre||"Cliente";
  document.getElementById("edit-folio").value        = c.folio||"";
  document.getElementById("edit-fecha").value        = c.fecha||"";
  document.getElementById("edit-nombre").value       = c.nombre||"";
  document.getElementById("edit-cel").value          = c.cel||"";
  document.getElementById("edit-tel").value          = c.tel||"";
  document.getElementById("edit-correo").value       = c.correo||"";
  document.getElementById("edit-domicilio").value    = c.domicilio||"";
  document.getElementById("edit-tipo").value         = c.tipo||"";
  document.getElementById("edit-elab").value         = c.elaboracion||"Sobre pedido";
  document.getElementById("edit-marca").value        = c.marca||"";
  document.getElementById("edit-modelo").value       = c.modelo||"";
  document.getElementById("edit-talla").value        = c.talla||"";
  document.getElementById("edit-color-nombre").value = c.color?.nombre||"";
  const hex = c.color?.hex||"#C8A8D0";
  document.getElementById("edit-color-picker").value  = hex;
  document.getElementById("edit-color-preview").style.background = hex;
  // Vínculo con inventario (solo para descuento automático, no toca precio)
  window._editArticuloVinculado = c.articuloId || null;
  const scanMsg = document.getElementById("edit-inv-scan-msg");
  const scanInput = document.getElementById("edit-inv-scan-input");
  if(scanInput) scanInput.value="";
  if(scanMsg){
    const art = c.articuloId ? (window._invData||[]).find(a=>a.id===c.articuloId) : null;
    if(art){
      scanMsg.style.color="var(--dorado-d)";
      scanMsg.innerHTML = "✓ "+art.categoria+" · "+art.modelo+" · Talla "+art.talla+" · "+art.colorNombre+
        ' <button type="button" onclick="quitarArticuloVinculadoEdicion()" style="background:none;border:none;color:var(--rojo);cursor:pointer;font-size:.68rem;text-decoration:underline;padding:0">✕ Quitar</button>';
    } else if(c.articuloId){
      scanMsg.style.color="var(--rojo)";
      scanMsg.textContent="✕ Artículo vinculado ya no existe en inventario.";
    } else {
      scanMsg.style.color="";
      scanMsg.textContent="";
    }
  }
  // Segundo vestido (si el cliente ya tiene uno vinculado)
  const bloqueV2 = document.getElementById("bloque-edit-vestido2");
  if(c.vestido2){
    document.getElementById("edit-marca2").value = c.vestido2.marca||"";
    document.getElementById("edit-modelo2").value = c.vestido2.modelo||"";
    document.getElementById("edit-talla2").value = c.vestido2.talla||"";
    document.getElementById("edit-color-nombre2").value = c.vestido2.color?.nombre||"";
    const hex2 = c.vestido2.color?.hex||"#C8A8D0";
    document.getElementById("edit-color-picker2").value = hex2;
    document.getElementById("edit-color-preview2").style.background = hex2;
    document.getElementById("edit-busto2").value   = c.vestido2.medidas?.busto||"";
    document.getElementById("edit-cintura2").value = c.vestido2.medidas?.cintura||"";
    document.getElementById("edit-cadera2").value  = c.vestido2.medidas?.cadera||"";
    document.getElementById("edit-copa2").value    = c.vestido2.medidas?.copa||"";
    document.getElementById("edit-largo2").value   = c.vestido2.medidas?.largo||"";
    window._editArticuloVinculado2 = c.vestido2.articuloId || null;
    const scanMsg2 = document.getElementById("edit-inv-scan-msg2");
    if(scanMsg2){
      const art2 = c.vestido2.articuloId ? (window._invData||[]).find(a=>a.id===c.vestido2.articuloId) : null;
      if(art2){
        scanMsg2.style.color="var(--dorado-d)";
        scanMsg2.innerHTML = "✓ "+art2.categoria+" · "+art2.modelo+" · Talla "+art2.talla+" · "+art2.colorNombre+
          ' <button type="button" onclick="quitarArticuloVinculadoEdicion2()" style="background:none;border:none;color:var(--rojo);cursor:pointer;font-size:.68rem;text-decoration:underline;padding:0">✕ Quitar</button>';
      } else if(c.vestido2.articuloId){
        scanMsg2.style.color="var(--rojo)";
        scanMsg2.textContent="✕ Artículo vinculado ya no existe en inventario.";
      } else {
        scanMsg2.style.color=""; scanMsg2.textContent="";
      }
    }
    bloqueV2.style.display="block";
    document.getElementById("fi-edit-toggle-vestido2").style.display="none";
    window._editVestido2Activo = true;
  } else {
    bloqueV2.style.display="none";
    document.getElementById("fi-edit-toggle-vestido2").style.display="block";
    window._editArticuloVinculado2 = null;
    window._editVestido2Activo = false;
  }
  document.getElementById("edit-busto").value        = c.medidas?.busto||"";
  document.getElementById("edit-cintura").value      = c.medidas?.cintura||"";
  document.getElementById("edit-cadera").value       = c.medidas?.cadera||"";
  document.getElementById("edit-copa").value         = c.medidas?.copa||"";
  document.getElementById("edit-largo").value        = c.medidas?.largo||"";
  document.getElementById("edit-precio").value       = c.precio||"";
  document.getElementById("edit-precio-paquete").value = c.precioPaquete||"";
  document.getElementById("edit-anticipo").value     = c.anticipo||"";
  document.getElementById("edit-fpago").value        = c.fpago||"";
  // Mostrar campo cuenta si fpago es transferencia
  const esTransf = (c.fpago||"").toLowerCase()==="transferencia";
  document.getElementById("fi-edit-cuenta-anticipo").style.display = esTransf ? "block" : "none";
  document.getElementById("fi-edit-ref-anticipo").style.display = esTransf ? "block" : "none";
  if(esTransf) poblarSelectCuentaTransferencia("edit-cuenta-anticipo", c.cuentaAnticipoId||"");
  document.getElementById("edit-ref-anticipo").value = esTransf ? (c.refAnticipo||"") : "";
  document.getElementById("edit-sispago").value      = c.sispago||"En parcialidades";
  document.getElementById("edit-parcialidades").value= c.parcialidades||"30";
  document.getElementById("edit-fecha-limite").value = c.fechaLimite||"";
  document.getElementById("edit-entrega").value      = c.entrega||"";
  document.getElementById("edit-estatus").value      = c.estatus||"Pedido Realizado";
  document.getElementById("edit-obs").value          = c.observaciones||"";
    document.getElementById("edit-promocion").value    = c.promocion||"";
  const baseGuardadaEdit = c.descuentoBase || "ambos";
  document.querySelectorAll('input[name="edit-desc-base"]').forEach(r=>{
    r.checked = (r.value === baseGuardadaEdit);
  });

  // Contrato firmado: limpiar selección previa y mostrar el guardado (si existe)
  window._contratoEditBase64 = null;
  const contratoInput = document.getElementById("edit-contrato-input");
  if(contratoInput) contratoInput.value = "";
  const contratoPreview = document.getElementById("edit-contrato-preview");
  if(contratoPreview){
    if(c.contratoUrl){
      contratoPreview.style.display = "block";
      contratoPreview.innerHTML = `📎 Ya hay un contrato guardado — <a href="${c.contratoUrl}" target="_blank" rel="noopener">ver documento</a>`;
    } else {
      contratoPreview.style.display = "none";
      contratoPreview.innerHTML = "";
    }
  }

  const pkgTipo = c.paquete?.tipo || "solo";
  editCurrentPkg = pkgTipo;
  ["xv","novia","solo","custom"].forEach(t=>{
    document.getElementById("edit-pb-"+t).classList.toggle("active", t===pkgTipo);
  });
  editInitPkgComponents(pkgTipo, c.paquete?.componentes||[]);

  initEditAdicionales(c.paquete?.adicionales||[]);
  editToggleParcialidades();
  calcEditTotal();
  document.getElementById("modal-editar-cliente").classList.add("open");
}

// ══ ADICIONALES EN EDICIÓN ══
let _editLibreSeq = 0;

// ══ PAQUETE EDITABLE (Editar cliente) ══
let editCurrentPkg = "solo";

function editSelPkg(type){
  editCurrentPkg = type;
  ["xv","novia","solo","custom"].forEach(t=>{
    document.getElementById("edit-pb-"+t).classList.toggle("active", t===type);
  });
  editInitPkgComponents(type, []);
}

function editInitPkgComponents(type, existingComponentes){
  const cont = document.getElementById("edit-pkg-components");
  if(type==="solo"){
    cont.innerHTML = '<p style="font-size:.8rem;color:#AAA;padding:.5rem 0">Sin paquete — solo vestido.</p>';
    return;
  }
  const items = type==="novia" ? PKG_NOVIA : type==="custom" ? PKG_CUSTOM : PKG_XV;
  const isCustom = type==="custom";
  cont.innerHTML = items.map(c=>{
    const match = existingComponentes.find(e=>e.id===c.id);
    const checked = existingComponentes.length ? !!match : !isCustom;
    const opcionSel = match ? match.opcion : c.default;
    const spec = match ? match.especificacion : "";
    return `
    <div class="comp-item" id="edit-ci-${c.id}">
      <input type="checkbox" class="comp-check" id="edit-chk-${c.id}" ${checked?"checked":""} onchange="editToggleComp('${c.id}')">
      <div class="comp-body" style="opacity:${checked?"1":".35"}">
        <div class="comp-name">${c.name}</div>
        <div class="comp-opts" id="edit-opts-${c.id}">
          ${c.opts.map(o=>`<button type="button" class="comp-opt ${o===opcionSel?"sel":""}" onclick="editSelOpt('${c.id}','${o}',this)">${o}</button>`).join("")}
        </div>
        <input class="comp-spec" placeholder="Especificaciones adicionales..." id="edit-spec-${c.id}" value="${spec||""}">
      </div>
    </div>`;
  }).join("");
}

function editSelOpt(compId, opt, btn){
  document.querySelectorAll(`#edit-opts-${compId} .comp-opt`).forEach(b=>b.classList.remove("sel"));
  btn.classList.add("sel");
}

function editToggleComp(id){
  const chk = document.getElementById("edit-chk-"+id);
  const body = document.querySelector(`#edit-ci-${id} .comp-body`);
  body.style.opacity = chk.checked ? "1" : ".35";
}

function getEditPkgData(){
  if(editCurrentPkg==="solo") return {tipo:"solo", componentes:[]};
  const items = editCurrentPkg==="novia" ? PKG_NOVIA : editCurrentPkg==="custom" ? PKG_CUSTOM : PKG_XV;
  const comps = items.map(c=>{
    const chk = document.getElementById("edit-chk-"+c.id);
    if(!chk||!chk.checked) return null;
    const selBtn = document.querySelector(`#edit-opts-${c.id} .comp-opt.sel`);
    const spec = document.getElementById("edit-spec-"+c.id);
    return {id:c.id, name:c.name, opcion:selBtn?selBtn.textContent:"", especificacion:spec?spec.value:""};
  }).filter(Boolean);
  return {tipo:editCurrentPkg, componentes:comps};
}

function initEditAdicionales(existing){
  const grid = document.getElementById("edit-add-grid");
  grid.innerHTML = ADICIONALES.map((a,i)=>{
    const match = existing.find(e=>e.nombre===a);
    return `
    <div class="add-item" id="edit-ai-${i}">
      <div class="add-header">
        <input type="checkbox" class="add-check" id="edit-ac-${i}" ${match?"checked":""} onchange="toggleEditAdicional(${i})">
        <label class="add-label" for="edit-ac-${i}">${a}</label>
        <input type="number" class="add-price" id="edit-ap-${i}" placeholder="$0" min="0" value="${match?match.precio:""}" oninput="calcEditTotal()">
      </div>
      <input class="add-note" id="edit-an-${i}" placeholder="Especificaciones..." value="${match&&match.nota?match.nota:""}">
    </div>`;
  }).join("");
  ADICIONALES.forEach((a,i)=>{
    const chk = document.getElementById("edit-ac-"+i);
    document.getElementById("edit-ai-"+i).classList.toggle("sel", chk.checked);
  });

  const libreGrid = document.getElementById("edit-libre-grid");
  libreGrid.innerHTML = "";
  const libres = existing.filter(e=>!ADICIONALES.includes(e.nombre));
  libres.forEach(l=>agregarProductoLibre(l.nombre, l.precio, l.nota));
}

function toggleEditAdicional(i){
  const chk = document.getElementById("edit-ac-"+i);
  document.getElementById("edit-ai-"+i).classList.toggle("sel", chk.checked);
  calcEditTotal();
}

function agregarProductoLibre(nombre="", precio="", nota=""){
  const id = "el-"+(_editLibreSeq++);
  const grid = document.getElementById("edit-libre-grid");
  const row = document.createElement("div");
  row.className = "add-item edit-libre-row";
  row.id = id;
  row.innerHTML = `
    <div class="add-header">
      <input type="text" class="edit-libre-nombre" placeholder="Nombre del producto" value="${nombre}" style="flex:1;border:none;border-bottom:1px solid #E8DDD0;padding:.3rem 0;font-size:.82rem;outline:none;background:transparent" oninput="calcEditTotal()">
      <input type="number" class="add-price edit-libre-precio" placeholder="$0" min="0" value="${precio}" oninput="calcEditTotal()">
      <button type="button" onclick="eliminarProductoLibre('${id}')" style="border:none;background:none;color:var(--rojo);font-size:1rem;cursor:pointer;padding:0 .3rem">✕</button>
    </div>
    <input type="text" class="add-note edit-libre-nota" placeholder="Especificaciones..." value="${nota}">`;
  grid.appendChild(row);
  calcEditTotal();
}

function eliminarProductoLibre(id){
  const row = document.getElementById(id);
  if(row) row.remove();
  calcEditTotal();
}

function getEditAdicionales(){
  const catalogo = ADICIONALES.map((a,i)=>{
    const chk = document.getElementById("edit-ac-"+i);
    if(!chk||!chk.checked) return null;
    return {nombre:a, precio:document.getElementById("edit-ap-"+i).value||0, nota:document.getElementById("edit-an-"+i).value};
  }).filter(Boolean);
  const libres = Array.from(document.querySelectorAll("#edit-libre-grid .edit-libre-row")).map(row=>{
    const nombre = row.querySelector(".edit-libre-nombre").value.trim();
    if(!nombre) return null;
    return {nombre, precio:row.querySelector(".edit-libre-precio").value||0, nota:row.querySelector(".edit-libre-nota").value};
  }).filter(Boolean);
  return [...catalogo, ...libres];
}

function getDescuentoClienteEdit(){
  const promoRaw = (document.getElementById("edit-promocion")?.value||"").trim();
  const m = promoRaw.match(/(\d+(?:[.,]\d+)?)\s*%?/);
  const pct = m ? Math.min(100, Math.max(0, parseFloat(m[1].replace(",", ".")))) : 0;
  const radio = document.querySelector('input[name="edit-desc-base"]:checked');
  const base = radio ? radio.value : "ambos";
  const vestido = parseFloat(document.getElementById("edit-precio")?.value)||0;
  const paquete = parseFloat(document.getElementById("edit-precio-paquete")?.value)||0;
  const baseMonto = base==="vestido" ? vestido : base==="paquete" ? paquete : vestido + paquete;
  const monto = Math.round(baseMonto * pct / 100);
  return { pct, base, monto };
}

function calcEditTotal(){
  const vestido  = parseFloat(document.getElementById("edit-precio").value)||0;
  const paquete  = parseFloat(document.getElementById("edit-precio-paquete").value)||0;
  const anticipo = parseFloat(document.getElementById("edit-anticipo").value)||0;
  const extras   = getEditAdicionales().reduce((s,a)=>s+Number(a.precio||0),0);
  const desc     = getDescuentoClienteEdit();
  const total    = vestido + paquete + extras - desc.monto;
  const saldo    = total - anticipo;
  const elExtras = document.getElementById("edit-resumen-extras");
  const elTotal  = document.getElementById("edit-resumen-total");
  const elSaldo  = document.getElementById("edit-resumen-saldo");
  if(elExtras) elExtras.textContent = "$"+extras.toLocaleString("es-MX");
  if(elTotal)  elTotal.textContent  = "$"+total.toLocaleString("es-MX");
  if(elSaldo)  elSaldo.textContent  = "$"+saldo.toLocaleString("es-MX");

  const w = document.getElementById("edit-resumen-descuento-wrap");
  const e = document.getElementById("edit-resumen-descuento");
  if(w && e){
    if(desc.monto > 0 && desc.pct > 0){
      w.style.display = "flex";
      e.textContent = "−$"+desc.monto.toLocaleString("es-MX")+" ("+desc.pct+"% "+desc.base+")";
    } else {
      w.style.display = "none";
      e.textContent = "";
    }
  }
}

function buscarPorQREdicion(){
  const input = document.getElementById("edit-inv-scan-input");
  const msg = document.getElementById("edit-inv-scan-msg");
  const id = (input.value||"").trim();
  msg.textContent="";
  if(!id) return;
  const inv = window._invData||[];
  const art = inv.find(x=>x.id===id);
  if(!art){
    msg.style.color="var(--rojo)";
    msg.textContent="✕ Artículo no encontrado en inventario.";
    return;
  }
  // Autocompletar campos del cliente (mismo comportamiento que Nuevo cliente)
  const catLower = (art.categoria||"").toLowerCase();
  if(catLower.includes("quinceañera")||catLower.includes("quinceanera")){
    document.getElementById("edit-tipo").value = "xv";
  } else if(catLower.includes("novia")){
    document.getElementById("edit-tipo").value = "novia";
  }
  document.getElementById("edit-marca").value = art.marca||"";
  document.getElementById("edit-modelo").value = art.modelo||"";
  document.getElementById("edit-talla").value = art.talla||"";
  document.getElementById("edit-color-nombre").value = art.colorNombre||"";
  document.getElementById("edit-color-picker").value = art.colorHex||"#C8A8D0";
  editColorChange(art.colorHex||"#C8A8D0");
  window._editArticuloVinculado = art.id;
  msg.style.color="var(--dorado-d)";
  msg.innerHTML = "✓ "+art.categoria+" · "+art.modelo+" · Talla "+art.talla+" · "+art.colorNombre+
    ' <button type="button" onclick="quitarArticuloVinculadoEdicion()" style="background:none;border:none;color:var(--rojo);cursor:pointer;font-size:.68rem;text-decoration:underline;padding:0">✕ Quitar</button>';
  input.value="";
}

function quitarArticuloVinculadoEdicion(){
  window._editArticuloVinculado = null;
  const msg=document.getElementById("edit-inv-scan-msg");
  if(msg){ msg.style.color=""; msg.innerHTML=""; }
}

function toggleSegundoVestidoEdicion(){
  const bloque = document.getElementById("bloque-edit-vestido2");
  const abrir = bloque.style.display==="none";
  bloque.style.display = abrir ? "block" : "none";
  if(!abrir){
    ["edit-marca2","edit-modelo2","edit-talla2","edit-color-nombre2","edit-inv-scan-input2","edit-busto2","edit-cintura2","edit-cadera2","edit-copa2","edit-largo2"].forEach(id=>{
      const el=document.getElementById(id); if(el) el.value="";
    });
    document.getElementById("edit-color-picker2").value="#C8A8D0";
    document.getElementById("edit-color-preview2").style.background="";
    const msg2=document.getElementById("edit-inv-scan-msg2");
    if(msg2){msg2.style.color="";msg2.innerHTML="";}
    window._editArticuloVinculado2 = null;
    window._editVestido2Activo = false;
  } else {
    window._editVestido2Activo = true;
  }
  document.getElementById("fi-edit-toggle-vestido2").style.display = abrir ? "none" : "block";
}

function buscarPorQREdicion2(){
  const input = document.getElementById("edit-inv-scan-input2");
  const msg = document.getElementById("edit-inv-scan-msg2");
  const id = (input.value||"").trim();
  msg.textContent="";
  if(!id) return;
  const inv = window._invData||[];
  const art = inv.find(x=>x.id===id);
  if(!art){
    msg.style.color="var(--rojo)";
    msg.textContent="✕ Artículo no encontrado en inventario.";
    return;
  }
  document.getElementById("edit-marca2").value = art.marca||"";
  document.getElementById("edit-modelo2").value = art.modelo||"";
  document.getElementById("edit-talla2").value = art.talla||"";
  document.getElementById("edit-color-nombre2").value = art.colorNombre||"";
  document.getElementById("edit-color-picker2").value = art.colorHex||"#C8A8D0";
  editColorChange2(art.colorHex||"#C8A8D0");
  window._editArticuloVinculado2 = art.id;
  msg.style.color="var(--dorado-d)";
  msg.innerHTML = "✓ "+art.categoria+" · "+art.modelo+" · Talla "+art.talla+" · "+art.colorNombre+
    ' <button type="button" onclick="quitarArticuloVinculadoEdicion2()" style="background:none;border:none;color:var(--rojo);cursor:pointer;font-size:.68rem;text-decoration:underline;padding:0">✕ Quitar</button>';
  input.value="";
}

function quitarArticuloVinculadoEdicion2(){
  window._editArticuloVinculado2 = null;
  const msg=document.getElementById("edit-inv-scan-msg2");
  if(msg){ msg.style.color=""; msg.innerHTML=""; }
}

function cerrarEditarCliente(){
  document.getElementById("modal-editar-cliente").classList.remove("open");
  _editClienteId = null;
}

function editColorChange(hex){
  document.getElementById("edit-color-preview").style.background = hex;
}
function editColorChange2(hex){
  document.getElementById("edit-color-preview2").style.background = hex;
}

function editToggleParcialidades(){
  const v = document.getElementById("edit-sispago").value;
  document.getElementById("edit-fi-parcialidades").style.display = v==="En parcialidades"?"block":"none";
}

async function guardarEdicionCliente(){
  const msg = document.getElementById("edit-cliente-msg");
  const btn = document.getElementById("btn-guardar-edicion");
  msg.textContent="";

  const nombre = document.getElementById("edit-nombre").value.trim();
  if(!nombre){msg.textContent="El nombre es obligatorio.";return;}

  const folioRaw = document.getElementById("edit-folio").value.trim();
  if(!folioRaw){msg.textContent="El folio es obligatorio.";return;}
  // Normalizar a 4 dígitos con ceros a la izquierda
  const folioNum = parseInt(folioRaw, 10);
  if(isNaN(folioNum)||folioNum<1){msg.textContent="El folio debe ser un número válido.";return;}
  const folioNormalizado = String(folioNum).padStart(4,"0");

  // Validar duplicado (ignorar el cliente que se está editando)
  const duplicado = allClientes.find(x=>x.folio===folioNormalizado && x.id!==_editClienteId);
  if(duplicado){msg.textContent=`El folio ${folioNormalizado} ya está en uso por: ${duplicado.nombre}`;return;}

  btn.disabled=true; btn.innerHTML='<span class="spinner"></span>Guardando...';

  try{
    allClientes = await loadClientesFS();
    const idx = allClientes.findIndex(x=>x.id===_editClienteId);
    if(idx===-1){msg.textContent="Error: cliente no encontrado.";btn.disabled=false;btn.innerHTML='💾 Guardar cambios';return;}

    const original = allClientes[idx];
    const folioAnterior = original.folio;
        const descInfoEdit = getDescuentoClienteEdit();
    const hex = document.getElementById("edit-color-picker").value;

    let contratoUrl = original.contratoUrl || "";
    if(window._contratoEditBase64){
      btn.innerHTML='<span class="spinner"></span>Subiendo contrato...';
      try{
        contratoUrl = await subirDocumentoCloudinary(window._contratoEditBase64);
      }catch(e){
        console.error("Error subiendo contrato:", e);
        msg.textContent = "No se pudo subir el contrato. Verifica tu conexión e intenta de nuevo.";
        btn.disabled=false; btn.innerHTML='💾 Guardar cambios';
        return;
      }
      btn.innerHTML='<span class="spinner"></span>Guardando...';
    }

    allClientes[idx] = {
      ...original,
      contratoUrl,
      folio:       folioNormalizado,
      fecha:       document.getElementById("edit-fecha").value,
      nombre,
      cel:         document.getElementById("edit-cel").value.trim(),
      tel:         document.getElementById("edit-tel").value.trim(),
      correo:      document.getElementById("edit-correo").value.trim(),
      domicilio:   document.getElementById("edit-domicilio").value.trim(),
      tipo:        document.getElementById("edit-tipo").value,
      elaboracion: document.getElementById("edit-elab").value,
      marca:       document.getElementById("edit-marca").value.trim(),
      modelo:      document.getElementById("edit-modelo").value.trim(),
      talla:       document.getElementById("edit-talla").value.trim(),
      color:       {hex, nombre: document.getElementById("edit-color-nombre").value.trim()||hex},
      articuloId:  window._editArticuloVinculado||null,
      vestido2: window._editVestido2Activo && document.getElementById("edit-modelo2").value.trim()
        ? {
            marca: document.getElementById("edit-marca2").value.trim(),
            modelo: document.getElementById("edit-modelo2").value.trim(),
            talla: document.getElementById("edit-talla2").value.trim(),
            color: {hex:document.getElementById("edit-color-picker2").value, nombre:document.getElementById("edit-color-nombre2").value.trim()||document.getElementById("edit-color-picker2").value},
            medidas: {
              busto:   document.getElementById("edit-busto2").value,
              cintura: document.getElementById("edit-cintura2").value,
              cadera:  document.getElementById("edit-cadera2").value,
              copa:    document.getElementById("edit-copa2").value,
              largo:   document.getElementById("edit-largo2").value
            },
            articuloId: window._editArticuloVinculado2||null
          }
        : null,
      paquete:     {...getEditPkgData(), adicionales:getEditAdicionales()},
      medidas:     {
        busto:   document.getElementById("edit-busto").value,
        cintura: document.getElementById("edit-cintura").value,
        cadera:  document.getElementById("edit-cadera").value,
        copa:    document.getElementById("edit-copa").value,
        largo:   document.getElementById("edit-largo").value
      },
      precio:        document.getElementById("edit-precio").value,
      precioPaquete: document.getElementById("edit-precio-paquete").value,
            promocion:      document.getElementById("edit-promocion").value.trim(),
      descuentoPct:   descInfoEdit.pct,
      descuentoBase:  descInfoEdit.base,
      descuentoMonto: descInfoEdit.monto,
      anticipo:      document.getElementById("edit-anticipo").value,
      fechaAnticipo: original.fechaAnticipo || original.fecha,
      fpago:         document.getElementById("edit-fpago").value.trim(),
      cuentaAnticipoId: cuentaIdPorMetodo(document.getElementById("edit-fpago").value.trim(), document.getElementById("edit-cuenta-anticipo").value) || original.cuentaAnticipoId || null,
      refAnticipo:   document.getElementById("edit-ref-anticipo").value.trim() || original.refAnticipo || "",
      sispago:       document.getElementById("edit-sispago").value,
      parcialidades: document.getElementById("edit-parcialidades").value||30,
      fechaLimite:   document.getElementById("edit-fecha-limite").value,
      entrega:       document.getElementById("edit-entrega").value,
      estatus:       document.getElementById("edit-estatus").value,
      observaciones: document.getElementById("edit-obs").value.trim(),
      editadoPor:    currentUser.user,
      editadoEn:     new Date().toLocaleString("es-MX",{timeZone:"America/Mexico_City"})
    };

    await saveUnCliente(allClientes[idx]);
    if(folioAnterior!==folioNormalizado){
      // El folio cambió → el ID del documento en Firestore también debe
      // cambiar. Se guarda primero con el folio nuevo (arriba) y luego se
      // borra el documento viejo, para no perder el registro si algo falla.
      await eliminarClienteFS({...allClientes[idx], folio:folioAnterior});
    }
    await sincronizarAccesoriosCliente(allClientes[idx]);
    toast("Cliente actualizado ✓ — Folio "+folioNormalizado);
    window._contratoEditBase64 = null;
    cerrarEditarCliente();
    renderClientes();
  }catch(e){
    console.error("guardarEdicionCliente error:",e);
    msg.textContent="Error al guardar. Verifica tu conexión.";
  }finally{
    btn.disabled=false; btn.innerHTML='💾 Guardar cambios';
  }
}

// ══ RENDER CLIENTES ══
// ══ MENÚ DESPLEGABLE DE ACCIONES POR CLIENTE ══
function toggleClienteMenu(id, btnEl){
  const orig = document.getElementById("menu-"+id);
  if(!orig) return;
  const portalActivo = document.getElementById("cliente-menu-portal");
  const yaAbierto = portalActivo && portalActivo.dataset.forId===id;
  cerrarClienteMenus();
  if(yaAbierto) return;
  const clone = orig.cloneNode(true);
  clone.removeAttribute("id");
  clone.id = "cliente-menu-portal";
  clone.dataset.forId = id;
  clone.style.display = "block";
  clone.style.position = "fixed";
  clone.style.zIndex = "500";
  document.body.appendChild(clone);
  const r = btnEl.getBoundingClientRect();
  let left = r.right - clone.offsetWidth;
  if(left < 8) left = 8;
  clone.style.top = (r.bottom + 2) + "px";
  clone.style.left = left + "px";
}
function cerrarClienteMenus(){
  document.querySelectorAll(".cliente-menu").forEach(m=>{ if(m.id!=="cliente-menu-portal") m.style.display="none"; });
  const portal = document.getElementById("cliente-menu-portal");
  if(portal) portal.remove();
}
document.addEventListener("click", function(e){
  if(!e.target.closest(".menu-toggle") && !e.target.closest(".cliente-menu")){
    cerrarClienteMenus();
  }
});

async function repararEstatusAtascado(clienteId){
  if(!confirm("Esto regresará este cliente a 'Pedido Realizado' Y reiniciará por completo el interruptor de Entrega (para que quede sin marcar), para que puedas marcar la Entrega real desde cero. Si el inventario ya se había descontado, se le regresa el stock. ¿Continuar?")) return;
  try{
    const [clientesFS,inventarioFS] = await Promise.all([loadClientesFS(),loadInventarioFS()]);
    allClientes = clientesFS;
    const idx = allClientes.findIndex(x=>x.id===clienteId);
    if(idx===-1){ toast("Cliente no encontrado","err"); return; }
    const cli = allClientes[idx];
    if(!cli.progreso) cli.progreso = {};
    if(!cli.progreso.pedido) cli.progreso.pedido = {};

    // Restaurar inventario si ya se había descontado (vestido 1 y 2)
    const inv = inventarioFS;
    const articulosTocados = [];
    if(cli.progreso.pedido.entregado_descontado && cli.articuloId){
      const artIdx = inv.findIndex(a=>a.id===cli.articuloId);
      if(artIdx>-1){ inv[artIdx].cantidad = (Number(inv[artIdx].cantidad)||0) + 1; articulosTocados.push(inv[artIdx]); }
    }
    if(cli.progreso.pedido.entregado_descontado2 && cli.vestido2?.articuloId){
      const artIdx2 = inv.findIndex(a=>a.id===cli.vestido2.articuloId);
      if(artIdx2>-1){ inv[artIdx2].cantidad = (Number(inv[artIdx2].cantidad)||0) + 1; articulosTocados.push(inv[artIdx2]); }
    }

    cli.estatus = "Pedido Realizado";
    cli.progreso.pedido.entregado = false;
    cli.progreso.pedido.entregado_descontado = false;
    cli.progreso.pedido.entregado_descontado2 = false;
    await saveUnCliente(cli);
    if(articulosTocados.length){
      await Promise.all(articulosTocados.map(a=>saveUnArticulo(a)));
      window._invData = inv;
    }
    toast("Reparado por completo ✓ — el botón de Entrega ya está sin marcar"+(articulosTocados.length?" y el stock se restauró":""));
    renderClientes();
    renderInventario();
  }catch(e){ console.error(e); toast("Error al reparar","err"); }
}

function renderClientes(lista){
  const tbody=document.getElementById("clientes-tbody");
  const data=[...(lista||allClientes)].sort((a,b)=>{
    const fa=parseInt(a.folio,10);
    const fb=parseInt(b.folio,10);
    return (isNaN(fa)?Infinity:fa)-(isNaN(fb)?Infinity:fb);
  });
  if(!allClientes.length){
    tbody.innerHTML='<tr><td colspan="24" style="color:#AAA;padding:1.5rem;text-align:center;">Sin clientes registrados aún.</td></tr>';return;
  }
  if(!data.length){
    tbody.innerHTML='<tr><td colspan="24" style="color:#AAA;padding:1.5rem;text-align:center;">No se encontraron clientes con esa búsqueda.</td></tr>';return;
  }
  const tipos={"xv":"Quinceañera","novia":"Novia","solo":"Solo vestido","custom":"Personalizado","":" — "};
  const pkgNombre={"xv":"Paquete XV","novia":"Paquete Novia","solo":"Solo vestido","custom":"Personalizado","":" — "};
  tbody.innerHTML=data.map(c=>{
    // Calcular costo total
    const precio=Number(c.precio||0);
    const paquete=Number(c.precioPaquete||0);
    const extras=(c.paquete?.adicionales||[]).reduce((s,a)=>s+Number(a.precio||0),0);
    const total=precio+paquete+extras;
    // Adicionales como lista
    const adicionales=(c.paquete?.adicionales||[]).map(a=>a.nombre).join(", ")||"—";
    // Fecha formateada
    const fContrato=c.fecha?new Date(c.fecha+"T12:00:00").toLocaleDateString("es-MX"):"—";
    const fEntrega=c.entrega?new Date(c.entrega+"T12:00:00").toLocaleDateString("es-MX"):"—";
    const fVence=c.fechaLimite?new Date(c.fechaLimite+"T12:00:00").toLocaleDateString("es-MX"):"—";
    // Alerta vencimiento
    let venceClass="";
    if(c.fechaLimite){
      const hoy=new Date();hoy.setHours(0,0,0,0);
      const vence=new Date(c.fechaLimite+"T12:00:00");
      const dias=Math.ceil((vence-hoy)/(1000*60*60*24));
      if(dias<0) venceClass="color:var(--rojo);font-weight:500";
      else if(dias<=7) venceClass="color:#856404;font-weight:500";
    }
    return `<tr>
      <td style="font-size:.74rem;white-space:nowrap">${fContrato}</td>
      <td style="font-size:.74rem;color:#888">${c.esNotaSencilla?"Sin folio":(c.folio||"—")}</td>
      <td style="white-space:nowrap"><strong style="font-weight:500;font-size:.82rem">${c.nombre}</strong></td>
      <td style="font-size:.76rem;white-space:nowrap">${c.cel||"—"}</td>
      <td style="font-size:.76rem;white-space:nowrap">${c.tel||"—"}</td>
      <td style="font-size:.74rem">${c.correo||"—"}</td>
      <td style="font-size:.74rem;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.domicilio||"—"}</td>
      <td style="font-size:.76rem;white-space:nowrap">$${total.toLocaleString("es-MX")}</td>
      <td style="font-size:.74rem">${c.sispago==="En parcialidades"?"Parcialidades":"Liquidado"}</td>
      <td style="font-size:.74rem;text-align:center">${c.sispago==="En parcialidades"?(c.parcialidades||30)+" días":"—"}</td>
      <td style="font-size:.76rem;white-space:nowrap">${c.esNotaSencilla?"Venta directa":(tipos[c.tipo]||c.tipo||"—")}</td>
      <td style="font-size:.74rem">${c.elaboracion||"—"}</td>
      <td style="font-size:.76rem">${c.modelo||"—"}</td>
      <td style="white-space:nowrap"><span class="color-dot" style="background:${c.color?.hex||"#CCC"}"></span><span style="font-size:.74rem">${c.color?.nombre||"—"}</span></td>
      <td style="font-size:.76rem;text-align:center">${c.talla||"—"}</td>
      <td style="font-size:.74rem">${pkgNombre[c.paquete?.tipo]||"—"}</td>
      <td style="font-size:.74rem;white-space:nowrap">${fEntrega}</td>
      <td style="font-size:.76rem;white-space:nowrap;color:var(--verde)">$${Number(c.anticipo||0).toLocaleString("es-MX")}</td>
      <td style="font-size:.74rem">${c.fpago||"—"}</td>
      <td style="font-size:.74rem;white-space:nowrap;${venceClass}">${fVence}</td>
      <td><span class="status-badge ${c.estatus==="Entregado"?"s-entregado":c.estatus==="Recibido"?"s-recibido":"s-pedido"}" style="white-space:nowrap">${c.estatus||"—"}</span>
        ${((c.estatus==="Entregado") !== !!(c.progreso?.pedido?.entregado)) ? `<br><button onclick="repararEstatusAtascado('${c.id}')" style="margin-top:.2rem;background:none;border:1px solid var(--rojo);color:var(--rojo);border-radius:10px;padding:.1rem .5rem;font-size:.62rem;cursor:pointer;white-space:nowrap" title="El estatus y el botón real de Entrega no coinciden en este cliente — toca para reiniciar ambos y marcar la entrega correctamente">⚠️ Reparar</button>` : ""}
      </td>
      <td style="font-size:.72rem;max-width:160px">${adicionales}</td>
      <td style="font-size:.74rem">${c.elaboracion==="Sobre pedido"?"✓":"—"}</td>
      <td style="position:relative">
        ${c.esNotaSencilla?
          `<button class="ic-btn menu-toggle" onclick="toggleClienteMenu('${c.id}',this)" title="Más opciones">⋮</button>
        <div class="cliente-menu" id="menu-${c.id}" style="display:none">
          <button onclick="verNotaSencillaGuardada('${c.id}');cerrarClienteMenus()">🧾 Ver nota</button>
          ${currentUser.role==="admin"?`<button onclick="eliminarCliente('${c.id}','${c.nombre}');cerrarClienteMenus()" style="color:var(--rojo)">🗑️ Eliminar venta directa</button>`:""}
        </div>`
          :
          `<button class="ic-btn menu-toggle" onclick="toggleClienteMenu('${c.id}',this)" title="Más opciones">⋮</button>
        <div class="cliente-menu" id="menu-${c.id}" style="display:none">
          <button onclick="verPagos('${c.id}');cerrarClienteMenus()">💳 Pagos</button>
          <button onclick="abrirAbonoModal('${c.id}');cerrarClienteMenus()">📝 Historial de abonos</button>
          <button onclick="verContrato('${c.id}');cerrarClienteMenus()">📄 Contrato</button>
          ${c.contratoUrl?`<button onclick="window.open('${c.contratoUrl}','_blank');cerrarClienteMenus()">📎 Documento firmado</button>`:""}
          <button onclick="verNotaVenta('${c.id}');cerrarClienteMenus()">🧾 Nota de venta</button>
          <button onclick="verFormatoEntrega('${c.id}');cerrarClienteMenus()">📦 Formato de entrega</button>
          ${currentUser.role==="admin"?`<button onclick="abrirEditarCliente('${c.id}');cerrarClienteMenus()">✏️ Editar cliente</button><button onclick="eliminarCliente('${c.id}','${c.nombre}');cerrarClienteMenus()" style="color:var(--rojo)">🗑️ Eliminar cliente</button>`:""}
        </div>`
        }
      </td>
    </tr>`;
  }).join("");
  const cEl=document.getElementById("buscar-cliente-count");
  if(cEl){
    const q=(document.getElementById("buscar-cliente")?.value||"").trim();
    const estatusActivo=(document.getElementById("filtro-estatus-cliente")?.value||"");
    cEl.textContent=(q||estatusActivo)?`${data.length} de ${allClientes.length} clientes`:"";
  }
}
function normTexto(s){
  return (s||"").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
}
function filtrarClientes(){
  const inp=document.getElementById("buscar-cliente");
  const q=normTexto(inp.value.trim());
  document.getElementById("buscar-cliente-clear").style.display=q?"block":"none";
  const estatusSel=document.getElementById("filtro-estatus-cliente");
  const estatusFiltro=estatusSel?estatusSel.value:"";
  if(!q && !estatusFiltro){renderClientes();return;}
  let filtrados=allClientes;
  if(q){
    filtrados=filtrados.filter(c=>normTexto(c.nombre).includes(q) || normTexto(c.folio).includes(q));
  }
  if(estatusFiltro){
    filtrados=filtrados.filter(c=>(c.estatus||"")===estatusFiltro);
  }
  renderClientes(filtrados);
}
function limpiarBuscarCliente(){
  const inp=document.getElementById("buscar-cliente");
  inp.value="";
  document.getElementById("buscar-cliente-clear").style.display="none";
  renderClientes();
  inp.focus();
}
function verCliente(id){toast("Expediente completo · próxima fase 🎀","ok");}

// inicializar color preview
document.getElementById("color-preview-box") && (document.getElementById("color-preview-box").style.background=selectedColor);

// ══ FECHAS Y PARCIALIDADES ══
function calcFechaLimite(){
  const fecha = document.getElementById("c-fecha").value;
  if(!fecha) return;
  const d = new Date(fecha+"T12:00:00");
  d.setMonth(d.getMonth()+2);
  document.getElementById("c-fecha-limite").value = d.toISOString().split("T")[0];
}
function toggleParcialidades(){
  const v = document.getElementById("c-sispago").value;
  document.getElementById("fi-parcialidades").style.display = v==="En parcialidades"?"grid":"none";
}
// Aplica los componentes del paquete de una cotización al grid de Nuevo cliente.
// Se llama desde cqConvertirCliente justo después de updatePkg(), que ya dejó
// el grid con los valores por defecto.
function aplicarComponentesCotizacionAlCliente(componentes){
  const lista = componentes || [];
  // Recorre TODOS los componentes del tipo actual (no solo los que vienen
  // en la cotización) y aplica checked/opción/especificación según corresponda.
  // Así, los que el usuario DESMARCÓ en la cotización también quedan
  // desmarcados en el cliente, en vez de quedarse con el default de updatePkg().
  const items = currentPkg==="novia" ? PKG_NOVIA : currentPkg==="custom" ? PKG_CUSTOM : PKG_XV;
  items.forEach(c=>{
    const chk = document.getElementById("chk-"+c.id);
    if(!chk) return;
    const match = lista.find(x=>x.id===c.id);
    chk.checked = !!match;
    toggleComp(c.id);
    const opts = document.querySelectorAll(`#opts-${c.id} .comp-opt`);
    const opcion = match ? match.opcion : c.default;
    opts.forEach(b=>b.classList.toggle("sel", b.textContent===opcion));
    const spec = document.getElementById("spec-"+c.id);
    if(spec) spec.value = match ? (match.especificacion||"") : "";
  });
}