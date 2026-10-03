
// ══ MENSAJERÍA WHATSAPP ══
// Config en memoria — se carga desde Firestore al hacer login
let _waConfig = {
  phoneNumberId: "",
  token: "",
  numeroSoporte: "529212550819",
  dias: [15, 7, 3, 1],
  diasMorosa: 0
};

// Carga la config desde Firestore al iniciar sesión y dispara envío automático si hay token
async function waCargarConfig(){
  try{
    const snap = await db.collection("waConfig").doc("config").get();
    if(snap.exists){
      const d = snap.data();
      _waConfig.phoneNumberId  = d.phoneNumberId  || "";
      _waConfig.token          = d.token          || "";
      _waConfig.numeroSoporte  = d.numeroSoporte  || "529212550819";
      _waConfig.dias           = d.dias           || [15,7,3,1];
      _waConfig.diasMorosa     = Number(d.diasMorosa) || 0;
    }
    // Si hay token configurado, disparar envío automático
    if(waModoReal()) await waEnviarAutomatico();
  }catch(e){ console.warn("waCargarConfig:", e); }
}

// Envío automático al login — revisa pendientes (ya filtrados por hito, ver waCalcularPendientes) y los envía
async function waEnviarAutomatico(){
  const pendientes = await waCalcularPendientes();
  for(const p of pendientes){
    const clienteId = p.cliente.id || p.cliente.folio;
    if(!clienteId) continue;
    const numero = (p.cliente.cel||p.cliente.tel||"").replace(/\D/g,"");
    if(!numero) continue;
    const numeroFinal = numero.startsWith("52") ? numero : "52"+numero;
    const monto      = "$" + p.saldo.toLocaleString("es-MX");
    const fechaISO   = p.estado === "morosa" ? p.peldañoVencido : p.peldañoProximo;
    const fechaTexto = waFormatearFecha(fechaISO);
    const mensaje    = waGenerarMensaje(p.cliente.nombre||"clienta", monto, fechaTexto);
    try{
      const url  = `https://graph.facebook.com/v19.0/${_waConfig.phoneNumberId}/messages`;
      const body = {messaging_product:"whatsapp", to:numeroFinal, type:"text", text:{body:mensaje}};
      const r = await fetch(url,{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer "+_waConfig.token},
        body:JSON.stringify(body)
      });
      const j = await r.json();
      if(r.ok){
        if(p.estado === "morosa"){
          await waSetBanderaMorosa(clienteId, p.cliente.nombre, p.peldañoVencido);
        } else {
          await waSetBanderaHito(clienteId, p.cliente.nombre, p.peldañoProximo, p.hito, true);
        }
        await waRegistrarEnvio(p.cliente.id, p.cliente.nombre, numeroFinal, mensaje, "enviado");
      }
    }catch(e){ console.warn("waEnviarAutomatico error:", p.cliente.nombre, e); }
    await new Promise(r=>setTimeout(r,600));
  }
}

// Rellena los campos de la UI de config con los valores actuales
function waCargarConfigUI(){
  document.getElementById("wa-cfg-number-id").value      = _waConfig.phoneNumberId  || "";
  document.getElementById("wa-cfg-token").value          = _waConfig.token          || "";
  document.getElementById("wa-cfg-numero-soporte").value = _waConfig.numeroSoporte  || "529212550819";
  document.getElementById("wa-cfg-dias").value           = (_waConfig.dias || [15,7,3,1]).join(",");
  document.getElementById("wa-cfg-dias-morosa").value    = _waConfig.diasMorosa || "";
  document.getElementById("wa-cfg-msg").textContent      = "";
  document.getElementById("wa-test-resultado").textContent = "";
  // Mostrar vista previa del mensaje con datos de ejemplo
  document.getElementById("wa-preview-mensaje").textContent =
    waGenerarMensaje("María García", "$3,500.00", "15 de agosto de 2026");
}

// Guarda la config en Firestore
async function waGuardarConfig(){
  const msg = document.getElementById("wa-cfg-msg");
  msg.style.color = "var(--rojo)"; msg.textContent = "";
  const phoneNumberId = document.getElementById("wa-cfg-number-id").value.trim();
  const token         = document.getElementById("wa-cfg-token").value.trim();
  const numeroSoporte = document.getElementById("wa-cfg-numero-soporte").value.trim().replace(/\D/g,"");
  const diasRaw       = document.getElementById("wa-cfg-dias").value.trim();
  const dias = diasRaw.split(",").map(d=>parseInt(d.trim(),10)).filter(d=>!isNaN(d)&&d>0);
  const diasMorosa = parseInt(document.getElementById("wa-cfg-dias-morosa").value, 10) || 0;
  if(!numeroSoporte){ msg.textContent="Ingresa el número de soporte."; return; }
  if(!dias.length)  { msg.textContent="Ingresa al menos un día de anticipación válido."; return; }
  try{
    await db.collection("waConfig").doc("config").set({phoneNumberId, token, numeroSoporte, dias, diasMorosa});
    _waConfig = { phoneNumberId, token, numeroSoporte, dias, diasMorosa };
    msg.style.color = "var(--verde)";
    msg.textContent = "✓ Configuración guardada correctamente.";
    toast("Configuración WA guardada ✓");
    // Actualizar vista previa con el nuevo número de soporte
    document.getElementById("wa-preview-mensaje").textContent =
      waGenerarMensaje("María García", "$3,500.00", "15 de agosto de 2026");
  }catch(e){ msg.textContent = "Error al guardar: " + e.message; }
}

// Devuelve true si el módulo tiene token y phone ID configurados (modo real)
function waModoReal(){
  return !!(_waConfig.token && _waConfig.phoneNumberId);
}

// Calcula días restantes entre hoy y una fecha ISO yyyy-mm-dd
function waDiasRestantes(fechaISO){
  if(!fechaISO) return null;
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const dest = new Date(fechaISO + "T12:00:00"); dest.setHours(0,0,0,0);
  return Math.round((dest - hoy) / (1000*60*60*24));
}

// Formatea una fecha ISO a texto legible en español
function waFormatearFecha(fechaISO){
  if(!fechaISO) return "—";
  const d = new Date(fechaISO + "T12:00:00");
  return d.toLocaleDateString("es-MX",{day:"numeric",month:"long",year:"numeric"});
}

// ══ v60.3 — Sistema de peldaños de parcialidades ══
function isoDeFecha(d){
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
}

function waCalcularPeldaños(c){
  if(!c || !c.fecha) return [];
  const N = Number(c.parcialidades) || 30;
  if(N <= 0) return [];
  const inicio = new Date(c.fecha + "T12:00:00");
  if(!isFinite(inicio.getTime())) return [];
  const finMs = c.fechaLimite ? new Date(c.fechaLimite + "T12:00:00").getTime() : null;
  const peldaños = [];
  let d = new Date(inicio);
  d.setDate(d.getDate() + N);
  for(let i = 0; i < 60; i++){
    if(finMs !== null && d.getTime() >= finMs) break;
    peldaños.push(isoDeFecha(d));
    d.setDate(d.getDate() + N);
  }
  // Forzar fechaLimite como último peldaño solo si queda a >= 7 días del
  // peldaño natural anterior. Si queda pegado (ej. 2 días después), no
  // aporta un punto de control real — fechaLimite sigue siendo el deadline
  // final vía la Regla 2 de waEstadoCliente.
  if(c.fechaLimite && !peldaños.includes(c.fechaLimite)){
    if(!peldaños.length){
      peldaños.push(c.fechaLimite);
    } else {
      const ultimo = peldaños[peldaños.length - 1];
      const diffDias = Math.round(
        (new Date(c.fechaLimite + "T12:00:00") - new Date(ultimo + "T12:00:00")) / (1000*60*60*24)
      );
      if(diffDias >= 7) peldaños.push(c.fechaLimite);
    }
  }
  return peldaños;
}

function waHayAbonoDespues(c, desdeISO){
  const desdeMs = new Date(desdeISO + "T12:00:00").getTime();
  const fechaAnt = c.fechaAnticipo || c.fecha;
  if(fechaAnt && Number(c.anticipo||0) > 0){
    if(new Date(fechaAnt + "T12:00:00").getTime() > desdeMs) return true;
  }
  for(const p of (c.pagos||[])){
    if(!p.fecha) continue;
    if(Number(p.monto||0) <= 0) continue;
    if(new Date(p.fecha + "T12:00:00").getTime() > desdeMs) return true;
  }
  return false;
}

function waEstadoCliente(c){
  if(!c.fecha) return { tipo: "fuera", motivo: "sin_fecha" };
  if((c.sispago||"") === "Liquidado") return { tipo: "fuera", motivo: "liquidado" };

  const precio  = Number(c.precio||0);
  const paquete = Number(c.precioPaquete||0);
  const extras  = (c.paquete?.adicionales||[]).reduce((s,a)=>s+Number(a.precio||0),0);
  const total   = precio + paquete + extras;
  const pagado  = Number(c.anticipo||0) + (c.pagos||[]).reduce((s,p)=>s+Number(p.monto||0),0);
  const interes = c.interes === "si" ? total * 0.1 : 0;
  const saldo   = (total - pagado) + interes;
  if(saldo <= 0) return { tipo:"fuera", motivo:"liquidada", saldo, total, pagado };

  const peldaños = waCalcularPeldaños(c);
  if(!peldaños.length) return { tipo:"fuera", motivo:"sin_peldaños", saldo, total, pagado };

  const hoy = fechaLocalISO();
  const vencidos = peldaños.filter(p => p < hoy);
  const prox     = peldaños.find(p => p >= hoy);

  if(vencidos.length){
    const ultimo = vencidos[vencidos.length - 1];
    const idx = peldaños.indexOf(ultimo);
    const inicio = idx === 0 ? c.fecha : peldaños[idx - 1];
    if(!waHayAbonoDespues(c, inicio)){
      return { tipo:"morosa", saldo, total, pagado, peldañoVencido: ultimo };
    }
  }

  if(c.fechaLimite && hoy > c.fechaLimite){
    return { tipo:"morosa", saldo, total, pagado, peldañoVencido: c.fechaLimite };
  }

  if(!prox) return { tipo:"al_corriente", saldo, total, pagado };
  const dr = waDiasRestantes(prox);
  const hitos = (_waConfig.dias || [15,7,3,1]).slice().sort((a,b)=>a-b);
  const cruzados = hitos.filter(h => dr <= h);
  if(!cruzados.length) return { tipo:"al_corriente", saldo, total, pagado, peldañoProximo: prox };
  return { tipo:"proxima", saldo, total, pagado, peldañoProximo: prox, diasRestantes: dr, hitosCruzados: cruzados };
}

// Genera el mensaje exacto que pidió Kateryn
function waGenerarMensaje(nombre, monto, fechaTexto){
  const soporte = _waConfig.numeroSoporte || "529212550819";
  return `Hola ${nombre}  \nEsperamos que te encuentres muy bien. Te recordamos que tienes un saldo pendiente de ${monto}, correspondiente al pago del ${fechaTexto}.\nTe agradeceríamos mucho realizar tu pago antes de la fecha indicada para mantener tu cuenta al corriente y evitar cargos adicionales.\nSi tienes alguna duda o necesitas apoyo, estamos para ayudarte: https://wa.me/${soporte}\n  Ross de Lune.`;
}

// Calcula qué clientes tienen un hito de aviso CRUZADO (faltan <= X días, incluye vencidos)
// que todavía no ha sido marcado como avisado. Si un cliente cruzó varios hitos sin marcar
// ninguno (ej. se saltaron 7 días sin entrar a la app), solo se muestra el hito MÁS URGENTE
// pendiente — no se repite la misma clienta varias veces en la lista.
//
// El saldo se calcula con la MISMA fórmula que ya usa Pagos → Pendientes, para que el
// número del mensaje de WhatsApp coincida siempre con lo que se ve en pantalla.
// Antes esta función usaba una fórmula más simple (precio − anticipo) que ignoraba el
// paquete, los adicionales y los abonos — por eso el monto se quedaba congelado.
// Calcula cuántos días han pasado desde la última parcialidad que le tocaba
// pagar a la clienta. Si no tiene parcialidades configuradas, cae al cálculo
// tradicional (días desde la fecha límite del contrato). Nunca devuelve negativo.

// Devuelve array de objetos, cada uno con:
//   { cliente, estado:"proxima", saldo, peldañoProximo, diasRestantes, hito }
//   { cliente, estado:"morosa",  saldo, peldañoVencido }
// Los consumidores filtran por estado según lo que necesiten pintar.
async function waCalcularPendientes(){
  const resultados = [];
  const [banderasHitos, banderasMorosas] = await Promise.all([
    waObtenerBanderasHitos(),
    waObtenerBanderasMorosas()
  ]);
  const diasMorosa = Number(_waConfig.diasMorosa) || 0;
  const hoy = fechaLocalISO();

  (allClientes||[]).forEach(c => {
    const est = waEstadoCliente(c);
    if(est.tipo === "fuera") return;

    const clienteId = c.id || c.folio;
    if(!clienteId) return;

    if(est.tipo === "morosa"){
      // ¿Toca re-avisar?
      const porPeldaño = banderasMorosas[clienteId] || {};
      const ultimoAviso = porPeldaño[est.peldañoVencido];
      if(ultimoAviso){
        if(diasMorosa <= 0) return;
        const ms = new Date(hoy+"T12:00:00") - new Date(ultimoAviso+"T12:00:00");
        const diasDesde = Math.round(ms / (1000*60*60*24));
        if(diasDesde < diasMorosa) return;
      }
      resultados.push({
        cliente: c, estado: "morosa", saldo: est.saldo,
        peldañoVencido: est.peldañoVencido
      });
      return;
    }

    if(est.tipo === "proxima"){
      const porPeldaño = banderasHitos[clienteId] || {};
      const marcados = porPeldaño[est.peldañoProximo] || new Set();
      const hitoPendiente = est.hitosCruzados.find(h => !marcados.has(h));
      if(hitoPendiente === undefined) return;
      resultados.push({
        cliente: c, estado: "proxima", saldo: est.saldo,
        peldañoProximo: est.peldañoProximo,
        diasRestantes: est.diasRestantes,
        hito: hitoPendiente
      });
    }
  });
  return resultados;
}

// Devuelve la fecha/hora actual en formato legible (solo para guardar cuándo se marcó, no para comparar)
function waFechaHoy(){
  return new Date().toLocaleDateString("es-MX",{timeZone:"America/Mexico_City",year:"numeric",month:"2-digit",day:"2-digit"});
}

// Consulta qué hitos (7 días, 1 día, etc.) ya fueron marcados como avisados POR CLIENTE —
// sin importar en qué fecha calendario se marcaron. Devuelve { clienteId: Set(hitos marcados) }.
async function waObtenerBanderasHitos(){
  const map = {};
  try{
    const snap = await db.collection("waBanderas").where("tipoBandera","==","hito").get();
    snap.forEach(doc=>{
      const d = doc.data();
      if(!d.clienteId || d.hito === undefined) return;
      const peldaño = d.peldaño || "sin_peldaño";
      if(!map[d.clienteId]) map[d.clienteId] = {};
      if(!map[d.clienteId][peldaño]) map[d.clienteId][peldaño] = new Set();
      map[d.clienteId][peldaño].add(d.hito);
    });
  }catch(e){ console.warn("waObtenerBanderasHitos:", e); }
  return map;
}

// Marca o desmarca el hito de un cliente como avisado (ej. "ya se avisó el de 7 días a Laura").
// El ID del documento NO lleva fecha — por eso el aviso nunca se pierde si no entras el día exacto.
async function waSetBanderaHito(clienteId, clienteNombre, peldañoISO, hito, marcar){
  const hitoNum = Number(hito);
  const compacto = peldañoISO.replace(/-/g,"");
  const docId = clienteId + "_p" + compacto + "_h" + hitoNum;
  try{
    if(marcar){
      await db.collection("waBanderas").doc(docId).set({
        clienteId, clienteNombre, peldaño: peldañoISO, hito: hitoNum,
        tipoBandera:"hito", marcadoEl:waFechaHoy()
      });
    } else {
      await db.collection("waBanderas").doc(docId).delete();
    }
  }catch(e){ console.warn("waSetBanderaHito:", e); }
}

// ── Banderas de re-aviso moroso (Bug C, v60.1) ──
// Cuando una clienta ya agotó todos los hitos de waConfig.dias[] y sigue debiendo,
// se le hace seguimiento con un re-aviso cada diasMorosa días. Se guarda solo la
// fecha del último re-aviso para poder calcular el próximo.
async function waObtenerBanderasMorosas(){
  const map = {};
  try{
    const snap = await db.collection("waBanderas").where("tipoBandera","==","morosa").get();
    snap.forEach(doc=>{
      const d = doc.data();
      if(!d.clienteId || !d.fechaISO) return;
      const peldaño = d.peldaño || "sin_peldaño";
      if(!map[d.clienteId]) map[d.clienteId] = {};
      map[d.clienteId][peldaño] = d.fechaISO;
    });
  }catch(e){ console.warn("waObtenerBanderasMorosas:", e); }
  return map;
}
async function waSetBanderaMorosa(clienteId, clienteNombre, peldañoISO){
  const compacto = (peldañoISO||fechaLocalISO()).replace(/-/g,"");
  const docId = clienteId + "_p" + compacto + "_morosa";
  try{
    await db.collection("waBanderas").doc(docId).set({
      clienteId, clienteNombre, peldaño: peldañoISO||null,
      tipoBandera:"morosa", fechaISO: fechaLocalISO(), marcadoEl: waFechaHoy()
    });
  }catch(e){ console.warn("waSetBanderaMorosa:", e); }
}

// Borra TODAS las banderas de hitos de un cliente (no toca la bandera morosa).
// Se usa al otorgar prórroga: la fecha límite se mueve, y con ella se reinicia
// el ciclo de avisos — así la clienta vuelve a la ventana normal 15/7/3/1 días.
async function waBorrarBanderasHitosCliente(clienteId){
  try{
    const snap = await db.collection("waBanderas")
      .where("clienteId","==",clienteId)
      .where("tipoBandera","==","hito")
      .get();
    if(snap.empty) return;
    const batch = db.batch();
    snap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }catch(e){ console.warn("waBorrarBanderasHitosCliente:", e); }
}

// Clic en "📲 Enviar por WhatsApp" — abre el wa.me y marca ese hito específico como avisado
async function waMarcarComoEnviado(clienteId, clienteNombre, peldañoISO, hito){
  const chk = document.getElementById(`chk-env-${clienteId}-${hito}`);
  if(chk){ chk.checked = true; chk.disabled = true; }

  if(hito === "morosa"){
    await waSetBanderaMorosa(clienteId, clienteNombre, peldañoISO);
    await waRegistrarEnvio(clienteId, clienteNombre, "", "", `enviado (wa.me manual, morosa)`);
    toast("📲 Enviado: morosa");
  } else {
    const hitoNum = Number(hito);
    await waSetBanderaHito(clienteId, clienteNombre, peldañoISO, hitoNum, true);
    await waRegistrarEnvio(clienteId, clienteNombre, "", "", `enviado (wa.me manual, aviso ${hitoNum}d)`);
    toast("📲 Enviado: aviso de " + hitoNum + " día" + (hitoNum===1?"":"s"));
  }
  waRefrescarBadge(false);
}

async function waToggleMarcarEnviado(checkbox, clienteId, clienteNombre, peldañoISO, hito){
  checkbox.disabled = true;
  if(hito === "morosa"){
    if(checkbox.checked){
      await waSetBanderaMorosa(clienteId, clienteNombre, peldañoISO);
      await waRegistrarEnvio(clienteId, clienteNombre, "", "", `enviado (marcado manual, morosa)`);
      toast("✓ Marcado: morosa");
    }
  } else {
    const hitoNum = Number(hito);
    await waSetBanderaHito(clienteId, clienteNombre, peldañoISO, hitoNum, checkbox.checked);
    if(checkbox.checked){
      await waRegistrarEnvio(clienteId, clienteNombre, "", "", `enviado (marcado manual, aviso ${hitoNum}d)`);
      toast("✓ Marcado: aviso de " + hitoNum + " día" + (hitoNum===1?"":"s"));
    }
  }
  waMostrarRecordatorios();
  waRefrescarBadge(false);
}

// Recalcula el badge rojo del nav y, si se pide, muestra el aviso post-login
async function waRefrescarBadge(mostrarAviso){
  const todos = await waCalcularPendientes();
  window._waPendientesHoy = todos;
  const morosas = todos.filter(p => p.estado === "morosa");
  const badge = document.getElementById("wa-badge-count");
  if(badge){
    if(morosas.length){
      badge.textContent = morosas.length>99 ? "99+" : morosas.length;
      badge.style.display = "inline-flex";
    } else {
      badge.style.display = "none";
    }
  }
  if(mostrarAviso && todos.length) waMostrarAvisoLogin(todos);
}

// Muestra el modal de aviso justo después de iniciar sesión
function waMostrarAvisoLogin(pendientes){
  const esAdmin = currentUser && currentUser.role==="admin";
  const proximas = pendientes.filter(p => p.estado === "proxima");
  const morosas  = pendientes.filter(p => p.estado === "morosa");

  const fila = (p) => {
    if(p.estado === "proxima"){
      const dr = p.diasRestantes;
      const txtDr = dr===0 ? "Vence hoy" : `Faltan ${dr} día${dr===1?"":"s"}`;
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem 0;border-bottom:1px solid var(--borde);font-size:.82rem">
        <span>${p.cliente.nombre||"—"} <span style="color:#888;font-size:.72rem">Folio ${p.cliente.folio||"—"}</span></span>
        <span style="color:var(--dorado-d);font-size:.72rem">${txtDr} · aviso ${p.hito}d</span>
      </div>`;
    }
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem 0;border-bottom:1px solid var(--borde);font-size:.82rem">
      <span>${p.cliente.nombre||"—"} <span style="color:#888;font-size:.72rem">Folio ${p.cliente.folio||"—"}</span></span>
      <span style="color:var(--rojo);font-size:.72rem">Debe el pago del ${waFormatearFecha(p.peldañoVencido)}</span>
    </div>`;
  };

  const seccion = (titulo, lista, color) => lista.length
    ? `<div style="font-size:.66rem;letter-spacing:.12em;text-transform:uppercase;color:${color};margin:.6rem 0 .3rem">${titulo}</div>${lista.map(fila).join("")}`
    : "";

  document.getElementById("wa-aviso-lista").innerHTML =
    seccion("Próximas a vencer", proximas, "var(--dorado-d)")
    + seccion("Morosas", morosas, "var(--rojo)");

  const partes = [];
  if(proximas.length) partes.push(`${proximas.length} próxima${proximas.length===1?"":"s"}`);
  if(morosas.length)  partes.push(`${morosas.length} morosa${morosas.length===1?"":"s"}`);
  document.getElementById("wa-aviso-titulo").textContent =
    "Recordatorios de pago — " + partes.join(" · ");

  document.getElementById("wa-aviso-btn").style.display = esAdmin ? "" : "none";
  document.getElementById("wa-aviso-nota-worker").style.display = esAdmin ? "none" : "";
  document.getElementById("modal-wa-aviso").classList.add("open");
}

function closeAvisoWa(){
  document.getElementById("modal-wa-aviso").classList.remove("open");
}
function irARecordatoriosDesdeAviso(){
  closeAvisoWa();
  toggleNav("mensajeria");
  goSec("mensajeria-recordatorios");
}

// Renderiza la lista de recordatorios pendientes.
// Solo aparecen aquí las que tienen un hito CRUZADO Y AÚN NO MARCADO — al marcarlas desaparecen
// de esta lista hasta que crucen el siguiente hito (ej. de 7 días a 1 día).
// Modo manual: enlace wa.me/ + checkbox, ambos solo visibles para admin.
async function waMostrarRecordatorios(){
  const lista = document.getElementById("wa-recordatorios-lista");
  const badge = document.getElementById("wa-modo-badge");
  const esReal = waModoReal();
  const esAdmin = currentUser && currentUser.role==="admin";

  badge.innerHTML = esReal
    ? '<span style="color:var(--verde)">✅ Mensajería activa — los mensajes se envían automáticamente al iniciar sesión</span>'
    : '<span style="color:var(--dorado-d)">🔶 Modo manual — envía los recordatorios con el enlace de WhatsApp</span>';

  lista.innerHTML = '<span class="spinner"></span> Calculando recordatorios...';
  const todos = await waCalcularPendientes();
  const pendientes = todos.filter(p => p.estado === "proxima");

  if(!pendientes.length){
    lista.innerHTML = '<p style="color:#AAA;font-size:.82rem;padding:.5rem">No hay recordatorios pendientes por enviar.</p>';
    return;
  }

  lista.innerHTML = pendientes.map(p=>{
    const clienteId  = p.cliente.id || p.cliente.folio || "";
    const monto      = "$" + p.saldo.toLocaleString("es-MX");
    const fechaTexto = waFormatearFecha(p.peldañoProximo);
    const msgTexto   = waGenerarMensaje(p.cliente.nombre||"clienta", monto, fechaTexto);
    const numero     = (p.cliente.cel||p.cliente.tel||"").replace(/\D/g,"");
    const numeroFinal= numero ? (numero.startsWith("52")?numero:"52"+numero) : "";
    const numDisplay = numero ? numero : '<span style="color:var(--rojo)">Sin número registrado</span>';
    const linkWa     = numeroFinal ? `https://wa.me/${numeroFinal}?text=${encodeURIComponent(msgTexto)}` : "";
    const nombreEsc  = (p.cliente.nombre||"").replace(/'/g,"\\'");
    const dr         = p.diasRestantes;
    const txtDr      = dr===0 ? "Vence hoy" : `Faltan ${dr} día${dr===1?"":"s"}`;
    const etiqueta   = `${txtDr} · pendiente aviso de ${p.hito} día${p.hito===1?"":"s"}`;

    const accionesAdmin = esAdmin ? `
      <div style="display:flex;align-items:center;gap:.9rem;margin-top:.6rem;flex-wrap:wrap">
        ${linkWa
          ? `<a href="${linkWa}" target="_blank" class="btn-sec" style="text-decoration:none;display:inline-block" onclick="waMarcarComoEnviado('${clienteId}','${nombreEsc}','${p.peldañoProximo}','${p.hito}')">📲 Enviar por WhatsApp</a>`
          : '<span style="font-size:.72rem;color:var(--rojo)">Sin número — no se puede generar el enlace</span>'}
        <label style="display:flex;align-items:center;gap:.35rem;font-size:.76rem;color:#666;cursor:pointer">
          <input type="checkbox" id="chk-env-${clienteId}-${p.hito}" onchange="waToggleMarcarEnviado(this,'${clienteId}','${nombreEsc}','${p.peldañoProximo}','${p.hito}')">
          ✓ Marcar como enviado
        </label>
      </div>` : "";

    return `<div style="border:1px solid var(--borde);border-radius:4px;padding:.8rem;margin-bottom:.7rem">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.4rem;margin-bottom:.5rem">
        <div>
          <strong style="font-size:.9rem">${p.cliente.nombre||"—"}</strong>
          <span style="font-size:.72rem;color:#888;margin-left:.5rem">Folio ${p.cliente.folio||"—"}</span>
        </div>
        <span style="font-size:.7rem;background:#E8F8EE;color:var(--verde);border-radius:20px;padding:.18rem .7rem">${etiqueta}</span>
      </div>
      <div style="font-size:.75rem;color:#666;margin-bottom:.5rem">📱 ${numDisplay}</div>
      <div style="background:#F9F5EF;border-radius:3px;padding:.55rem .75rem;font-size:.78rem;white-space:pre-line;color:var(--texto);line-height:1.6">${msgTexto}</div>
      ${accionesAdmin}
    </div>`;
  }).join("");
}

async function waMostrarMorosas(){
  const lista = document.getElementById("wa-morosas-lista");
  const esAdmin = currentUser && currentUser.role==="admin";

  lista.innerHTML = '<span class="spinner"></span> Calculando...';
  const todos = await waCalcularPendientes();
  const morosas = todos.filter(p => p.estado === "morosa");

  const badgeSub = document.getElementById("wa-badge-morosas");
  if(badgeSub){
    if(morosas.length){
      badgeSub.textContent = morosas.length>99 ? "99+" : morosas.length;
      badgeSub.style.display = "inline-flex";
    } else {
      badgeSub.style.display = "none";
    }
  }

  if(!morosas.length){
    lista.innerHTML = '<p style="color:#AAA;font-size:.82rem;padding:.5rem">Sin clientas morosas.</p>';
    return;
  }

  lista.innerHTML = morosas.map(p=>{
    const clienteId  = p.cliente.id || p.cliente.folio || "";
    const monto      = "$" + p.saldo.toLocaleString("es-MX");
    const fechaTexto = waFormatearFecha(p.peldañoVencido);
    const msgTexto   = waGenerarMensaje(p.cliente.nombre||"clienta", monto, fechaTexto);
    const numero     = (p.cliente.cel||p.cliente.tel||"").replace(/\D/g,"");
    const numeroFinal= numero ? (numero.startsWith("52")?numero:"52"+numero) : "";
    const numDisplay = numero ? numero : '<span style="color:var(--rojo)">Sin número registrado</span>';
    const linkWa     = numeroFinal ? `https://wa.me/${numeroFinal}?text=${encodeURIComponent(msgTexto)}` : "";
    const nombreEsc  = (p.cliente.nombre||"").replace(/'/g,"\\'");
    const etiqueta   = `Debe el pago del ${fechaTexto}`;

    const accionesAdmin = esAdmin ? `
      <div style="display:flex;align-items:center;gap:.9rem;margin-top:.6rem;flex-wrap:wrap">
        ${linkWa
          ? `<a href="${linkWa}" target="_blank" class="btn-sec" style="text-decoration:none;display:inline-block" onclick="waMarcarComoEnviado('${clienteId}','${nombreEsc}','${p.peldañoVencido}','morosa')">📲 Enviar por WhatsApp</a>`
          : '<span style="font-size:.72rem;color:var(--rojo)">Sin número — no se puede generar el enlace</span>'}
        <label style="display:flex;align-items:center;gap:.35rem;font-size:.76rem;color:#666;cursor:pointer">
          <input type="checkbox" id="chk-env-${clienteId}-morosa" onchange="waToggleMarcarEnviado(this,'${clienteId}','${nombreEsc}','${p.peldañoVencido}','morosa')">
          ✓ Marcar como enviado
        </label>
      </div>` : "";

    return `<div style="border:1px solid var(--borde);border-radius:4px;padding:.8rem;margin-bottom:.7rem">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.4rem;margin-bottom:.5rem">
        <div>
          <strong style="font-size:.9rem">${p.cliente.nombre||"—"}</strong>
          <span style="font-size:.72rem;color:#888;margin-left:.5rem">Folio ${p.cliente.folio||"—"}</span>
        </div>
        <span style="font-size:.7rem;background:#FBEAEA;color:var(--rojo);border-radius:20px;padding:.18rem .7rem">${etiqueta}</span>
      </div>
      <div style="font-size:.75rem;color:#666;margin-bottom:.5rem">📱 ${numDisplay}</div>
      <div style="background:#F9F5EF;border-radius:3px;padding:.55rem .75rem;font-size:.78rem;white-space:pre-line;color:var(--texto);line-height:1.6">${msgTexto}</div>
      ${accionesAdmin}
    </div>`;
  }).join("");
}

// Registra cada envío/simulación en Firestore para el historial
async function waRegistrarEnvio(clienteId, clienteNombre, numero, mensaje, estado){
  try{
    await db.collection("waMensajes").add({
      clienteId, clienteNombre, numero, mensaje, estado,
      fecha: new Date().toLocaleString("es-MX",{timeZone:"America/Mexico_City",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})
    });
  }catch(e){ console.warn("waRegistrarEnvio:", e); }
}

// Carga el historial de mensajes desde Firestore
async function waLoadHistorial(){
  const cont = document.getElementById("wa-historial-lista");
  cont.innerHTML = '<span class="spinner"></span> Cargando...';
  try{
    const snap = await db.collection("waMensajes").orderBy("fecha","desc").limit(100).get();
    if(snap.empty){ cont.innerHTML='<p style="color:#AAA;font-size:.82rem">Sin mensajes registrados aún.</p>'; return; }
    cont.innerHTML = snap.docs.map(doc=>{
      const d = doc.data();
      const colorEstado = d.estado==="enviado" ? "var(--verde)" : d.estado==="simulado" ? "var(--dorado-d)" : "var(--rojo)";
      const iconoEstado = d.estado==="enviado" ? "✅" : d.estado==="simulado" ? "🔶" : "❌";
      return `<div style="border-bottom:1px solid var(--borde);padding:.6rem 0;display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem;flex-wrap:wrap">
        <div>
          <div style="font-size:.82rem;font-weight:600">${d.clienteNombre||"—"}</div>
          <div style="font-size:.72rem;color:#888">${d.numero||"—"} · ${d.fecha||"—"}</div>
        </div>
        <span style="font-size:.72rem;color:${colorEstado};white-space:nowrap">${iconoEstado} ${d.estado}</span>
      </div>`;
    }).join("");
  }catch(e){ cont.innerHTML='<p style="color:var(--rojo)">Error al cargar historial: '+e.message+'</p>'; }
}

// Envía un mensaje de prueba al número indicado en la UI
async function waEnviarPrueba(){
  const res    = document.getElementById("wa-test-resultado");
  const numero = document.getElementById("wa-test-numero").value.trim().replace(/\D/g,"");
  res.textContent = "";
  if(!numero){ res.innerHTML='<span style="color:var(--rojo)">Ingresa un número de prueba.</span>'; return; }
  const numeroFinal = numero.startsWith("52") ? numero : "52"+numero;
  const mensaje = waGenerarMensaje("María García (prueba)", "$3,500.00", "15 de agosto de 2026");
  if(!waModoReal()){
    res.innerHTML='<span style="color:var(--rojo)">⚠️ Configura el Phone Number ID y el token antes de enviar.</span>';
    return;
  }
  try{
    const url  = `https://graph.facebook.com/v19.0/${_waConfig.phoneNumberId}/messages`;
    const body = { messaging_product:"whatsapp", to:numeroFinal, type:"text", text:{body:mensaje} };
    const r = await fetch(url,{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":"Bearer "+_waConfig.token},
      body:JSON.stringify(body)
    });
    const j = await r.json();
    if(!r.ok) throw new Error(j.error?.message||"Error Meta API");
    res.innerHTML='<span style="color:var(--verde)">✅ Mensaje de prueba enviado a '+numeroFinal+'</span>';
    toast("Prueba enviada ✓");
  }catch(e){ res.innerHTML='<span style="color:var(--rojo)">Error: '+e.message+'</span>'; }
}