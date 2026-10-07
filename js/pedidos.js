// ══ AUTO-SUMA DE PRECIO POR ESCANEO ══
window._qrPrecio1 = 0;
window._qrPrecio2 = 0;
function actualizarPrecioAutoSuma(){
  const suma = (window._qrPrecio1||0) + (window._qrPrecio2||0);
  const warn = document.getElementById("precio-auto-warn");
  if(suma>0){
    document.getElementById("c-precio").value = suma;
    calcTotal();
    if(warn) warn.style.display="block";
  } else {
    if(warn) warn.style.display="none";
  }
}

function buscarPorQR(){
  const input = document.getElementById("inv-scan-input");
  const msg = document.getElementById("inv-scan-msg");
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
  // Autocompletar campos del formulario
  const catLower = (art.categoria||"").toLowerCase();
  if(catLower.includes("quinceañera")||catLower.includes("quinceanera")){
    document.getElementById("c-tipo").value = "xv";
    updatePkg();
  } else if(catLower.includes("novia")){
    document.getElementById("c-tipo").value = "novia";
    updatePkg();
  }
  document.getElementById("c-modelo").value = art.modelo||"";
  document.getElementById("c-marca").value = art.marca||"";
  document.getElementById("c-talla").value = art.talla||"";
  document.getElementById("c-color-name").value = art.colorNombre||"";
  document.getElementById("color-picker").value = art.colorHex||"#C8A8D0";
  window._qrPrecio1 = Number(art.precio)||0;
  actualizarPrecioAutoSuma();
  // Actualizar el color visualmente si existe la función
  if(typeof onColorChange==="function") onColorChange(art.colorHex||"#C8A8D0");
  if(typeof onColorNameInput==="function") onColorNameInput(art.colorNombre||"");
  window._qrArticuloActual = art.id;
  msg.style.color="var(--dorado-d)";
  msg.innerHTML = "✓ "+art.categoria+" · "+art.modelo+" · Talla "+art.talla+" · "+art.colorNombre+
    ' <button type="button" onclick="quitarArticuloEscaneado()" style="background:none;border:none;color:var(--rojo);cursor:pointer;font-size:.68rem;text-decoration:underline;padding:0">✕ Quitar</button>';
  input.value="";
}

function quitarArticuloEscaneado(){
  document.getElementById("c-modelo").value="";
  document.getElementById("c-talla").value="";
  document.getElementById("c-color-name").value="";
  selectedColor="#C8A8D0";
  const colorBox=document.getElementById("color-preview-box");
  if(colorBox) colorBox.style.background=selectedColor;
  const colorPicker=document.getElementById("color-picker");
  if(colorPicker) colorPicker.value=selectedColor;
  window._qrArticuloActual=null;
  window._qrPrecio1 = 0;
  actualizarPrecioAutoSuma();
  const msg=document.getElementById("inv-scan-msg");
  if(msg){ msg.style.color=""; msg.innerHTML=""; }
}


// ══ CONTRATO ══
function verContrato(id){
  const c=allClientes.find(x=>x.id===id);
  if(!c){toast("Cliente no encontrado","err");return;}
  generarContrato(c);
  document.getElementById("modal-contrato").classList.add("open");
  document.getElementById("modal-contrato").scrollTop=0;
}
function closeContrato(){document.getElementById("modal-contrato").classList.remove("open");}
function imprimirContrato(){window.print();}

function verNotaVenta(id){
  const c = allClientes.find(x=>x.id===id);
  if(!c){toast("Cliente no encontrado","err");return;}
  generarNotaVenta(c);
  document.getElementById("modal-nota").classList.add("open");
  document.getElementById("modal-nota").scrollTop=0;
}
function closeNotaVenta(){document.getElementById("modal-nota").classList.remove("open");}
function imprimirNota(){window.print();}

// ══ FORMATO DE ENTREGA ══
function verFormatoEntrega(id){
  const c=allClientes.find(x=>x.id===id);
  if(!c){toast("Cliente no encontrado","err");return;}
  generarFormatoEntrega(c);
  document.getElementById("modal-entrega").classList.add("open");
  document.getElementById("modal-entrega").scrollTop=0;
}
function closeEntrega(){document.getElementById("modal-entrega").classList.remove("open");}
function imprimirEntrega(){window.print();}

function generarFormatoEntrega(c){
  const precio  = Number(c.precio||0);
  const paquete = Number(c.precioPaquete||0);
  const extras  = (c.paquete?.adicionales||[]).reduce((s,a)=>s+Number(a.precio||0),0);
  const total   = totalConDescuentoCliente(c);
  const tipos   = {"xv":"Quinceañera","novia":"Novia","solo":"Solo vestido","custom":"Personalizado"};
  const fEntrega = c.entrega ? new Date(c.entrega+"T12:00:00").toLocaleDateString("es-MX",{day:"2-digit",month:"long",year:"numeric"}) : "—";
  const fContrato= c.fecha   ? new Date(c.fecha+"T12:00:00").toLocaleDateString("es-MX",{day:"2-digit",month:"2-digit",year:"numeric"}) : "—";
  const colorBox = c.color?.hex ? `<span style="display:inline-block;width:12px;height:12px;background:${c.color.hex};border:1px solid #CCC;border-radius:2px;vertical-align:middle;margin-right:4px"></span>` : "";

  // Artículos del pedido, uno por uno (componentes del paquete + adicionales), con estado Entregado/Pendiente.
  // Estado por default = "pendiente" si el artículo aún no tiene clave en c.entregaEstado — así nunca se
  // marca "Entregado" por accidente/olvido.
  const estadoMap = c.entregaEstado || {};
  const filaEstado = (key) => {
    const estado = estadoMap[key] || "pendiente";
    const esEntregado = estado === "entregado";
    return `<button type="button" class="no-print" onclick="toggleEntregaItem('${c.id}','${key}')"
      style="border:1px solid ${esEntregado?"#4C8C5A":"#B5442E"};color:${esEntregado?"#4C8C5A":"#B5442E"};background:${esEntregado?"#EFF6F0":"#FBEEEA"};
      padding:.2rem .7rem;border-radius:12px;font-size:.7rem;font-weight:700;letter-spacing:.05em;cursor:pointer;white-space:nowrap">
      ${esEntregado?"✓ Entregado":"⏳ Pendiente"}</button>
      <span class="print-only" style="font-weight:700;color:${esEntregado?"#4C8C5A":"#B5442E"}">${esEntregado?"Entregado":"Pendiente"}</span>`;
  };

  let accesoriosRows = "";
  (c.paquete?.componentes||[]).forEach(comp=>{
    const key = "comp_"+comp.id;
    accesoriosRows += `<tr>
      <td style="border:1px solid #DDD;padding:.4rem .6rem">${comp.name}${comp.opcion?" — "+comp.opcion:""}${comp.especificacion?" · "+comp.especificacion:""}</td>
      <td style="border:1px solid #DDD;padding:.4rem .6rem;text-align:center">${filaEstado(key)}</td>
    </tr>`;
  });
  (c.paquete?.adicionales||[]).forEach((a,i)=>{
    const key = "add_"+i;
    accesoriosRows += `<tr>
      <td style="border:1px solid #DDD;padding:.4rem .6rem">${a.nombre}${a.nota?" — "+a.nota:""} <span style="color:#999">($${Number(a.precio||0).toLocaleString("es-MX")})</span></td>
      <td style="border:1px solid #DDD;padding:.4rem .6rem;text-align:center">${filaEstado(key)}</td>
    </tr>`;
  });
  if(!accesoriosRows){
    accesoriosRows = `<tr><td colspan="2" style="border:1px solid #DDD;padding:.6rem;color:#999;text-align:center;font-style:italic">Sin accesorios adicionales</td></tr>`;
  }

  document.getElementById("entrega-content").innerHTML=`
  <div style="font-family:Arial,sans-serif;color:#1a1a1a;line-height:1.4;max-width:720px;margin:0 auto;font-size:10pt;position:relative">

    <!-- MARCA DE AGUA -->
    <div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-20deg);opacity:.1;pointer-events:none;z-index:0">
      <img src="logo_contrato.png" style="width:480px;height:auto">
    </div>

    <div style="position:relative;z-index:1">

      <!-- ENCABEZADO -->
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1.5pt solid #C9A84C;padding-bottom:8pt;margin-bottom:10pt">
        <div>
          <div style="font-size:14pt;font-weight:700;color:#7A4F2A">ROSS DE LUNE</div>
          <div style="font-size:7pt;color:#999;letter-spacing:.05em;margin-bottom:4pt">NOVIAS Y QUINCEAÑERAS</div>
          <div style="font-size:12pt;font-weight:700">FORMATO DE ENTREGA</div>
          <div style="font-size:7.5pt;color:#666;margin-top:3pt">Folio: <strong>${c.folio||"—"}</strong> · Contrato: <strong>${fContrato}</strong></div>
        </div>
        <img src="logo_contrato.png" style="width:80pt;height:auto;flex-shrink:0">
      </div>

      <!-- DATOS DEL CLIENTE -->
      <div style="font-weight:700;font-size:8pt;letter-spacing:.08em;text-transform:uppercase;color:#7A4F2A;border-bottom:1pt solid #EEE;padding-bottom:3pt;margin-bottom:6pt">Datos del cliente</div>
      <table style="width:100%;border-collapse:collapse;font-size:9pt;margin-bottom:12pt">
        <tr>
          <td style="border:1px solid #DDD;padding:.4rem .6rem;width:22%;background:#FAFAFA"><strong>Nombre</strong></td>
          <td style="border:1px solid #DDD;padding:.4rem .6rem;width:28%">${c.nombre||"—"}</td>
          <td style="border:1px solid #DDD;padding:.4rem .6rem;width:22%;background:#FAFAFA"><strong>Celular</strong></td>
          <td style="border:1px solid #DDD;padding:.4rem .6rem">${c.cel||"—"}</td>
        </tr>
        <tr>
          <td style="border:1px solid #DDD;padding:.4rem .6rem;background:#FAFAFA"><strong>Correo</strong></td>
          <td style="border:1px solid #DDD;padding:.4rem .6rem">${c.correo||"—"}</td>
          <td style="border:1px solid #DDD;padding:.4rem .6rem;background:#FAFAFA"><strong>Tipo de servicio</strong></td>
          <td style="border:1px solid #DDD;padding:.4rem .6rem">${tipos[c.tipo]||"—"}</td>
        </tr>
        <tr>
          <td style="border:1px solid #DDD;padding:.4rem .6rem;background:#FAFAFA"><strong>Modelo</strong></td>
          <td style="border:1px solid #DDD;padding:.4rem .6rem">${c.modelo||"—"}${c.marca?" · "+c.marca:""}</td>
          <td style="border:1px solid #DDD;padding:.4rem .6rem;background:#FAFAFA"><strong>Talla</strong></td>
          <td style="border:1px solid #DDD;padding:.4rem .6rem">${c.talla||"—"}</td>
        </tr>
        <tr>
          <td style="border:1px solid #DDD;padding:.4rem .6rem;background:#FAFAFA"><strong>Color</strong></td>
          <td style="border:1px solid #DDD;padding:.4rem .6rem">${colorBox}${c.color?.nombre||c.color?.hex||"—"}</td>
          <td style="border:1px solid #DDD;padding:.4rem .6rem;background:#FAFAFA"><strong>Fecha de evento</strong></td>
          <td style="border:1px solid #DDD;padding:.4rem .6rem"><strong>${fEntrega}</strong></td>
        </tr>
        <tr>
          <td style="border:1px solid #DDD;padding:.4rem .6rem;background:#FAFAFA"><strong>Total</strong></td>
          <td style="border:1px solid #DDD;padding:.4rem .6rem" colspan="3"><strong>$${total.toLocaleString("es-MX")}</strong></td>
        </tr>
        ${c.obs?`<tr>
          <td style="border:1px solid #DDD;padding:.4rem .6rem;background:#FAFAFA;vertical-align:top"><strong>Observaciones</strong></td>
          <td style="border:1px solid #DDD;padding:.4rem .6rem" colspan="3">${c.obs}</td>
        </tr>`:""}
      </table>

      <!-- ARTÍCULOS DEL PEDIDO -->
      <div style="font-weight:700;font-size:8pt;letter-spacing:.08em;text-transform:uppercase;color:#7A4F2A;border-bottom:1pt solid #EEE;padding-bottom:3pt;margin-bottom:6pt">Artículos del pedido</div>
      <table style="width:100%;border-collapse:collapse;font-size:9pt;margin-bottom:12pt">
        <tr style="background:#FAFAFA">
          <td style="border:1px solid #DDD;padding:.4rem .6rem;width:75%"><strong>Descripción</strong></td>
          <td style="border:1px solid #DDD;padding:.4rem .6rem;width:25%;text-align:center"><strong>Estado</strong></td>
        </tr>
        ${accesoriosRows}
      </table>

      <!-- DECLARACIÓN DE CONFORMIDAD -->
      <div style="font-weight:700;font-size:8pt;letter-spacing:.08em;text-transform:uppercase;color:#7A4F2A;border-bottom:1pt solid #EEE;padding-bottom:3pt;margin-bottom:8pt">Conformidad de entrega</div>
      <p style="font-size:9pt;color:#444;margin-bottom:16pt">
        Yo, <strong>${c.nombre||"_______________________________"}</strong>, declaro haber recibido de <strong>Ross de Lune</strong> el artículo descrito en este documento, en las condiciones pactadas y a mi entera satisfacción. Una vez recibido el artículo, Ross de Lune no se hace responsable de daños, alteraciones o pérdidas posteriores.
      </p>

      <!-- FIRMA -->
      <table style="width:100%;border-collapse:collapse;margin-top:24pt">
        <tr>
          <td style="width:45%;text-align:center;padding-top:40pt;border-top:1pt solid #1a1a1a">
            <div style="font-size:8.5pt">Nombre y firma del cliente</div>
            <div style="font-size:7.5pt;color:#888;margin-top:3pt">${c.nombre||""}</div>
          </td>
          <td style="width:10%"></td>
          <td style="width:45%;text-align:center;padding-top:40pt;border-top:1pt solid #1a1a1a">
            <div style="font-size:8.5pt">Fecha de evento</div>
            <div style="font-size:7.5pt;color:#888;margin-top:3pt">${fEntrega}</div>
          </td>
        </tr>
      </table>

      <!-- PIE -->
      <div style="margin-top:20pt;text-align:center;font-size:7pt;color:#BBB;border-top:1pt solid #EEE;padding-top:6pt">
        Ross de Lune · Tel: 921 255 0819 · rossdelune@hotmail.com · Propela 10, Puerto Esmeralda, Coatzacoalcos, Ver.
      </div>

    </div>
  </div>`;
}

// Alterna el estado Entregado/Pendiente de un artículo (componente de paquete o adicional) dentro
// del Formato de Entrega. Se guarda en c.entregaEstado en Firestore (mismo patrón que guardarNotaPedido)
// para que el estado no se pierda al reimprimir o cerrar el modal.
async function toggleEntregaItem(clienteId, itemKey){
  allClientes = await loadClientesFS();
  const c = allClientes.find(x=>x.id===clienteId);
  if(!c) return;
  if(!c.entregaEstado) c.entregaEstado = {};
  const actual = c.entregaEstado[itemKey] || "pendiente";
  c.entregaEstado[itemKey] = actual==="entregado" ? "pendiente" : "entregado";
  await saveUnCliente(c);
  generarFormatoEntrega(c);
  toast(c.entregaEstado[itemKey]==="entregado" ? "Marcado como entregado ✓" : "Marcado como pendiente ⏳");
}

function generarNotaVenta(c){
  const precio    = Number(c.precio||0);
  const paquete   = Number(c.precioPaquete||0);
  const extras    = (c.paquete?.adicionales||[]).reduce((s,a)=>s+Number(a.precio||0),0);
  const total     = totalConDescuentoCliente(c);
  const anticipo  = Number(c.anticipo||0);
  const saldo     = total-anticipo;
  const tipos     = {"xv":"Quinceañera","novia":"Novia","solo":"Solo vestido","custom":"Personalizado"};
  const fContrato = c.fecha   ? new Date(c.fecha+"T12:00:00").toLocaleDateString("es-MX",{day:"2-digit",month:"2-digit",year:"numeric"}) : "—";
  const fEntrega  = c.entrega ? new Date(c.entrega+"T12:00:00").toLocaleDateString("es-MX",{day:"2-digit",month:"2-digit",year:"numeric"}) : "—";
  const comps = (c.paquete?.componentes||[]).map(x=>x.name+(x.opcion?" ("+x.opcion+")":"")).join(", ")||"—";
  const folioNota = (c.folio||"????") + "-A";

  let accesoriosRows = "";
  if(c.paquete?.tipo && c.paquete.tipo!=="solo"){
    accesoriosRows += `<tr>
      <td style="text-align:center;border:1px solid #CCC;padding:.4rem">1</td>
      <td style="border:1px solid #CCC;padding:.4rem">${c.paquete.tipo==="xv"?"Paquete XV":c.paquete.tipo==="novia"?"Paquete Novia":"Paquete personalizado"} — ${comps}</td>
      <td style="text-align:right;border:1px solid #CCC;padding:.4rem">$${paquete.toLocaleString("es-MX")}</td>
    </tr>`;
  }
  (c.paquete?.adicionales||[]).forEach(a=>{
    accesoriosRows += `<tr>
      <td style="text-align:center;border:1px solid #CCC;padding:.4rem">1</td>
      <td style="border:1px solid #CCC;padding:.4rem">${a.nombre}${a.nota?" — "+a.nota:""}</td>
      <td style="text-align:right;border:1px solid #CCC;padding:.4rem">$${Number(a.precio||0).toLocaleString("es-MX")}</td>
    </tr>`;
  });
  const filasVacias = Math.max(0,6-(c.paquete?.adicionales?.length||0)-1);
  for(let i=0;i<filasVacias;i++){
    accesoriosRows+=`<tr>
      <td style="border:1px solid #CCC;padding:.4rem;height:22px">&nbsp;</td>
      <td style="border:1px solid #CCC;padding:.4rem">&nbsp;</td>
      <td style="border:1px solid #CCC;padding:.4rem">&nbsp;</td>
    </tr>`;
  }

  document.getElementById("nota-content").innerHTML = `
  <div style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:720px;margin:0 auto;font-size:.85rem;position:relative;">

    <!-- MARCA DE AGUA -->
    <div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-20deg);opacity:.15;pointer-events:none;z-index:0;text-align:center;">
      <img src="logo_contrato.png" style="width:500px;height:auto">
    </div>

    <div style="position:relative;z-index:1">
    <!-- ENCABEZADO -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border:2px solid #1a1a1a;padding:.6rem .8rem;margin-bottom:0">
      <div style="font-size:1.4rem;font-weight:700;letter-spacing:.05em">NOTA DE VENTA</div>
      <div style="text-align:right">
        <div>Folio: <strong>${folioNota}</strong></div>
        <div style="font-size:.75rem;color:#666">Ref. Contrato: ${c.folio||"—"}</div>
      </div>
    </div>

    <!-- DATOS -->
    <table style="width:100%;border-collapse:collapse;border:2px solid #1a1a1a;border-top:none">
      <tr>
        <td style="border:1px solid #CCC;padding:.4rem .6rem;width:15%"><strong>Nombre:</strong></td>
        <td style="border:1px solid #CCC;padding:.4rem .6rem;width:35%">${c.nombre||"—"}</td>
        <td style="border:1px solid #CCC;padding:.4rem .6rem;width:25%"><strong>Fecha de contrato:</strong></td>
        <td style="border:1px solid #CCC;padding:.4rem .6rem">${fContrato}</td>
      </tr>
      <tr>
        <td style="border:1px solid #CCC;padding:.4rem .6rem"><strong>Contacto:</strong></td>
        <td style="border:1px solid #CCC;padding:.4rem .6rem">${c.cel||"—"}</td>
        <td style="border:1px solid #CCC;padding:.4rem .6rem"><strong>Fecha entrega/evento:</strong></td>
        <td style="border:1px solid #CCC;padding:.4rem .6rem">${fEntrega}</td>
      </tr>
      <tr>
        <td style="border:1px solid #CCC;padding:.4rem .6rem"><strong>${c.vestido2?"Vestido 1 — Tipo:":"Tipo:"}</strong></td>
        <td style="border:1px solid #CCC;padding:.4rem .6rem">${tipos[c.tipo]||"—"}</td>
        <td style="border:1px solid #CCC;padding:.4rem .6rem"><strong>${c.vestido2?"Vestido 1 — Talla:":"Talla:"}</strong></td>
        <td style="border:1px solid #CCC;padding:.4rem .6rem">${c.talla||"—"}</td>
      </tr>
      <tr>
        <td style="border:1px solid #CCC;padding:.4rem .6rem"><strong>${c.vestido2?"Vestido 1 — Modelo:":"Modelo:"}</strong></td>
        <td style="border:1px solid #CCC;padding:.4rem .6rem">${c.modelo||"—"} ${c.marca?"("+c.marca+")":""}</td>
        <td style="border:1px solid #CCC;padding:.4rem .6rem"><strong>${c.vestido2?"Vestido 1 — Color:":"Color:"}</strong></td>
        <td style="border:1px solid #CCC;padding:.4rem .6rem">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c.color?.hex||"#CCC"};vertical-align:middle;margin-right:4px;border:1px solid #999;-webkit-print-color-adjust:exact;print-color-adjust:exact"></span>
          ${c.color?.nombre||"—"}
        </td>
      </tr>
      ${c.vestido2 ? `
      <tr>
        <td style="border:1px solid #CCC;padding:.4rem .6rem"><strong>Vestido 2 — Modelo:</strong></td>
        <td style="border:1px solid #CCC;padding:.4rem .6rem">${c.vestido2.modelo||"—"} ${c.vestido2.marca?"("+c.vestido2.marca+")":""}</td>
        <td style="border:1px solid #CCC;padding:.4rem .6rem"><strong>Vestido 2 — Talla/Color:</strong></td>
        <td style="border:1px solid #CCC;padding:.4rem .6rem">
          ${c.vestido2.talla||"—"} ·
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c.vestido2.color?.hex||"#CCC"};vertical-align:middle;margin-right:4px;border:1px solid #999;-webkit-print-color-adjust:exact;print-color-adjust:exact"></span>
          ${c.vestido2.color?.nombre||"—"}
        </td>
      </tr>` : ""}
      <tr>
        <td style="border:1px solid #CCC;padding:.4rem .6rem"><strong>Precio${c.vestido2?" (ambos vestidos)":""}:</strong></td>
        <td colspan="3" style="border:1px solid #CCC;padding:.4rem .6rem"><strong style="color:#7A4F2A">$${total.toLocaleString("es-MX")}</strong></td>
      </tr>
    </table>

    <!-- MEDIDAS -->
    <table style="width:100%;border-collapse:collapse;border:2px solid #1a1a1a;border-top:none">
      <tr><td colspan="6" style="background:#F0F0F0;font-weight:700;text-align:center;border:1px solid #CCC;padding:.3rem">${c.vestido2?"Medidas — Vestido 1":"Medidas"}</td></tr>
      <tr>
        <td style="border:1px solid #CCC;padding:.3rem .5rem;font-weight:600;text-align:center">Busto</td>
        <td style="border:1px solid #CCC;padding:.3rem .5rem;text-align:center">${c.medidas?.busto||""}</td>
        <td style="border:1px solid #CCC;padding:.3rem .5rem;font-weight:600;text-align:center">Cintura</td>
        <td style="border:1px solid #CCC;padding:.3rem .5rem;text-align:center">${c.medidas?.cintura||""}</td>
        <td style="border:1px solid #CCC;padding:.3rem .5rem;font-weight:600;text-align:center">Cadera</td>
        <td style="border:1px solid #CCC;padding:.3rem .5rem;text-align:center">${c.medidas?.cadera||""}</td>
      </tr>
      <tr>
        <td style="border:1px solid #CCC;padding:.3rem .5rem;font-weight:600;text-align:center">Copa</td>
        <td style="border:1px solid #CCC;padding:.3rem .5rem;text-align:center">${c.medidas?.copa||""}</td>
        <td style="border:1px solid #CCC;padding:.3rem .5rem;font-weight:600;text-align:center">Largo</td>
        <td colspan="3" style="border:1px solid #CCC;padding:.3rem .5rem;text-align:center">${c.medidas?.largo||""}</td>
      </tr>
    </table>
    ${c.vestido2 ? `
    <table style="width:100%;border-collapse:collapse;border:2px solid #1a1a1a;border-top:none">
      <tr><td colspan="6" style="background:#F0F0F0;font-weight:700;text-align:center;border:1px solid #CCC;padding:.3rem">Medidas — Vestido 2</td></tr>
      <tr>
        <td style="border:1px solid #CCC;padding:.3rem .5rem;font-weight:600;text-align:center">Busto</td>
        <td style="border:1px solid #CCC;padding:.3rem .5rem;text-align:center">${c.vestido2.medidas?.busto||""}</td>
        <td style="border:1px solid #CCC;padding:.3rem .5rem;font-weight:600;text-align:center">Cintura</td>
        <td style="border:1px solid #CCC;padding:.3rem .5rem;text-align:center">${c.vestido2.medidas?.cintura||""}</td>
        <td style="border:1px solid #CCC;padding:.3rem .5rem;font-weight:600;text-align:center">Cadera</td>
        <td style="border:1px solid #CCC;padding:.3rem .5rem;text-align:center">${c.vestido2.medidas?.cadera||""}</td>
      </tr>
      <tr>
        <td style="border:1px solid #CCC;padding:.3rem .5rem;font-weight:600;text-align:center">Copa</td>
        <td style="border:1px solid #CCC;padding:.3rem .5rem;text-align:center">${c.vestido2.medidas?.copa||""}</td>
        <td style="border:1px solid #CCC;padding:.3rem .5rem;font-weight:600;text-align:center">Largo</td>
        <td colspan="3" style="border:1px solid #CCC;padding:.3rem .5rem;text-align:center">${c.vestido2.medidas?.largo||""}</td>
      </tr>
    </table>` : ""}

    <!-- ACCESORIOS -->
    <table style="width:100%;border-collapse:collapse;border:2px solid #1a1a1a;border-top:none">
      <tr><td colspan="3" style="background:#F0F0F0;font-weight:700;text-align:center;border:1px solid #CCC;padding:.3rem">Accesorios</td></tr>
      <tr>
        <th style="border:1px solid #CCC;padding:.35rem .5rem;width:12%;background:#F9F9F9">Cantidad</th>
        <th style="border:1px solid #CCC;padding:.35rem .5rem;background:#F9F9F9">Artículo</th>
        <th style="border:1px solid #CCC;padding:.35rem .5rem;width:18%;background:#F9F9F9;text-align:right">Monto</th>
      </tr>
      ${accesoriosRows}
      <tr>
        <td colspan="2" style="border:1px solid #CCC;padding:.4rem .5rem;text-align:right">Precio del vestido:</td>
        <td style="border:1px solid #CCC;padding:.4rem .5rem;text-align:right">$${precio.toLocaleString("es-MX")}</td>
      </tr>
      <tr>
        <td colspan="2" style="border:1px solid #CCC;padding:.4rem .5rem;text-align:right;font-weight:700">TOTAL:</td>
        <td style="border:1px solid #CCC;padding:.4rem .5rem;text-align:right;font-weight:700;color:#7A4F2A">$${total.toLocaleString("es-MX")}</td>
      </tr>
      <tr>
        <td colspan="2" style="border:1px solid #CCC;padding:.4rem .5rem;text-align:right;color:#1E8449">Anticipo:</td>
        <td style="border:1px solid #CCC;padding:.4rem .5rem;text-align:right;color:#1E8449">$${anticipo.toLocaleString("es-MX")}</td>
      </tr>
      <tr>
        <td colspan="2" style="border:1px solid #CCC;padding:.4rem .5rem;text-align:right;font-weight:700;color:#C0392B">Saldo restante:</td>
        <td style="border:1px solid #CCC;padding:.4rem .5rem;text-align:right;font-weight:700;color:#C0392B">$${saldo.toLocaleString("es-MX")}</td>
      </tr>
    </table>

    <!-- REQUISICIONES ESPECIALES -->
    <table style="width:100%;border-collapse:collapse;border:2px solid #1a1a1a;border-top:none">
      <tr>
        <td style="border:1px solid #CCC;padding:.35rem .5rem;font-weight:600;width:30%">Requisiciones especiales</td>
        <td style="border:1px solid #CCC;padding:.5rem;min-height:40px">${c.observaciones||"&nbsp;"}</td>
      </tr>
    </table>

    <!-- FIRMA -->
    <div style="border:2px solid #1a1a1a;border-top:none;padding:.8rem">
      <div style="font-style:italic;font-size:.78rem;margin-bottom:1.5rem">
        El cliente acepta que la información aquí detallada es correcta, incluyendo modelo, color y medidas. Asimismo, está de acuerdo con los términos de pago y las fechas de entrega establecidas.
      </div>
      <div style="text-align:center">
<div style="border-top:1px solid #333;display:inline-block;width:280px;padding-top:.3rem;margin-top:60px">NOMBRE Y FIRMA DEL CLIENTE</div>      </div>
    </div>
    </div>
  </div>`;
}

// ══ RENDER PEDIDOS ══
// ══ FILTRO ENTREGAS ══
function initFiltroEntregasAnio(){
  const sel=document.getElementById("ent-anio");
  if(!sel||sel.options.length)return;
  const hoy=new Date();
  const mesActual=hoy.getMonth();
  // pre-seleccionar el mes actual en el selector de mes
  const selMes=document.getElementById("ent-mes");
  if(selMes)selMes.value=String(mesActual);
  const anioActual=hoy.getFullYear();
  for(let a=anioActual-1;a<=anioActual+2;a++){
    const opt=document.createElement("option");
    opt.value=a;opt.textContent=a;
    if(a===anioActual)opt.selected=true;
    sel.appendChild(opt);
  }
}

function setFiltroEntregasModo(modo){
  const tabMes=document.getElementById("ftab-mes");
  const tabRango=document.getElementById("ftab-rango");
  const bloqueMes=document.getElementById("filtro-modo-mes");
  const bloqueRango=document.getElementById("filtro-modo-rango");
  const activeStyle="background:var(--dorado-g);color:#FFF8EC;border-color:transparent;";
  const inactiveStyle="background:transparent;color:var(--dorado-d);";
  if(modo==="mes"){
    tabMes.style.cssText+=activeStyle;
    tabRango.style.cssText+=inactiveStyle;
    bloqueMes.style.display="block";bloqueRango.style.display="none";
  } else {
    tabRango.style.cssText+=activeStyle;
    tabMes.style.cssText+=inactiveStyle;
    bloqueRango.style.display="block";bloqueMes.style.display="none";
  }
}

function limpiarFiltroEntregas(){
  document.getElementById("ent-desde").value="";
  document.getElementById("ent-hasta").value="";
  setFiltroEntregasModo("mes");
  const tbody=document.getElementById("entregas-tbody");
  if(tbody)tbody.innerHTML='<tr><td colspan="9" style="color:#AAA;padding:1.5rem;text-align:center;">Selecciona un mes o rango y presiona "Filtrar"</td></tr>';
  document.getElementById("entregas-resumen").innerHTML="";
}

function renderEntregasFecha(){
  const tbody=document.getElementById("entregas-tbody");
  const resumenEl=document.getElementById("entregas-resumen");
  if(!tbody)return;
  const modoMes=document.getElementById("filtro-modo-mes").style.display!=="none";
  let filtrados=[];
  if(modoMes){
    const mes=parseInt(document.getElementById("ent-mes").value);
    const anio=parseInt(document.getElementById("ent-anio").value);
    filtrados=allClientes.filter(c=>{
      if(!c.entrega)return false;
      const d=new Date(c.entrega+"T12:00:00");
      return d.getMonth()===mes&&d.getFullYear()===anio;
    });
  } else {
    const desde=document.getElementById("ent-desde").value;
    const hasta=document.getElementById("ent-hasta").value;
    if(!desde&&!hasta){filtrados=allClientes.filter(c=>!c.esNotaSencilla);}
    else {
      filtrados=allClientes.filter(c=>{
        if(c.esNotaSencilla)return false;
        if(!c.entrega)return false;
        if(desde&&c.entrega<desde)return false;
        if(hasta&&c.entrega>hasta)return false;
        return true;
      });
    }
  }
  if(!filtrados.length){
    tbody.innerHTML='<tr><td colspan="9" style="color:#AAA;padding:1.5rem;text-align:center;">Sin entregas en este período.</td></tr>';
    if(resumenEl)resumenEl.innerHTML="";
    return;
  }
  const tipos={"xv":"Quinceañera","novia":"Novia","solo":"Solo vestido","custom":"Personalizado","":"—"};
  let totalGeneral=0,saldoGeneral=0;
  tbody.innerHTML=filtrados.map(c=>{
    const precio=Number(c.precio||0);
    const paquete=Number(c.precioPaquete||0);
    const extras=(c.paquete?.adicionales||[]).reduce((s,a)=>s+Number(a.precio||0),0);
    const total=totalConDescuentoCliente(c);
    const pagado=Number(c.anticipo||0)+(c.pagos||[]).reduce((s,p)=>s+Number(p.monto||0),0);
    const saldo=total-pagado;
    totalGeneral+=total;saldoGeneral+=saldo;
    return `<tr>
      <td style="font-size:.72rem;color:#AAA">${c.folio||"—"}</td>
      <td><strong style="font-weight:400;font-size:.8rem">${c.nombre}</strong></td>
      <td style="font-size:.76rem">${tipos[c.tipo]||c.tipo||"—"}</td>
      <td style="font-size:.76rem">${c.modelo||"—"}</td>
      <td><span class="color-dot" style="background:${c.color?.hex||'#CCC'}"></span><span style="font-size:.74rem">${c.color?.nombre||"—"}</span></td>
      <td style="font-size:.74rem">${c.entrega?new Date(c.entrega+"T12:00:00").toLocaleDateString("es-MX"):"—"}</td>
      <td style="font-size:.76rem">$${total.toLocaleString("es-MX")}</td>
      <td style="font-size:.76rem;color:${saldo>0?"var(--rojo)":"var(--verde)"}">$${saldo.toLocaleString("es-MX")}</td>
      <td><span class="status-badge ${c.estatus==="Entregado"?"s-entregado":c.estatus==="Recibido"?"s-recibido":"s-pedido"}">${c.estatus||"—"}</span></td>
    </tr>`;
  }).join("");
  if(resumenEl)resumenEl.innerHTML=`${filtrados.length} entrega${filtrados.length!==1?"s":""} &nbsp;·&nbsp; Total <strong>$${totalGeneral.toLocaleString("es-MX")}</strong> &nbsp;·&nbsp; Saldo pendiente <strong style="color:var(--rojo)">$${saldoGeneral.toLocaleString("es-MX")}</strong>`;
}

function estatusClass(e){
  return e==="Entregado"?"s-entregado":e==="En Tienda"?"s-tienda":e==="En Compra"?"s-compra":e==="Recibido"?"s-recibido":"s-pedido";
}

function renderPedidos(){
  const tbody=document.getElementById("pedidos-tbody");
  if(!tbody)return;
  // Filtra solo los pendientes — "Pedido Realizado" o sin estatus
  const pendientes=allClientes.filter(c=>!c.esNotaSencilla && (!c.estatus||c.estatus==="Pedido Realizado"||c.estatus==="Pedido realizado"||c.estatus==="En Compra"));
  if(!pendientes.length){
    tbody.innerHTML='<tr><td colspan="12" style="color:#AAA;padding:1.5rem;text-align:center;">Sin pedidos pendientes 🎀</td></tr>';return;
  }
  const tipos={"xv":"Quinceañera","novia":"Novia","solo":"Solo vestido","custom":"Personalizado","":" — "};
  tbody.innerHTML=pendientes.map(c=>{
    const precio=Number(c.precio||0);
    const anticipo=Number(c.anticipo||0);
    const extras=(c.paquete?.adicionales||[]).reduce((s,a)=>s+Number(a.precio||0),0);
    const total=totalConDescuentoCliente(c);
    const saldo=total-anticipo;
    const cls=estatusClass(c.estatus);
    return `<tr>
      <td style="font-size:.72rem;color:#AAA">${c.folio||"—"}</td>
      <td><strong style="font-weight:400;font-size:.8rem">${c.nombre}</strong></td>
      <td style="font-size:.76rem">${tipos[c.tipo]||c.tipo||"—"}</td>
      <td style="font-size:.76rem">${c.marca||"—"}</td>
      <td style="font-size:.76rem">${c.modelo||"—"}</td>
      <td style="font-size:.76rem">${c.talla||"—"}</td>
      <td><span class="color-dot" style="background:${c.color?.hex||'#CCC'}"></span><span style="font-size:.74rem">${c.color?.nombre||"—"}</span></td>
      <td style="font-size:.74rem">${c.entrega?new Date(c.entrega+"T12:00:00").toLocaleDateString("es-MX"):"—"}</td>
      <td style="font-size:.76rem">$${total.toLocaleString("es-MX")}</td>
      <td style="font-size:.76rem;color:var(--verde)">$${anticipo.toLocaleString("es-MX")}</td>
      <td style="font-size:.76rem;color:var(--rojo)">$${saldo.toLocaleString("es-MX")}</td>
      <td>
        <select class="status-badge ${cls}" onchange="cambiarEstatusPedido('${c.id}',this.value)">
          <option value="Pedido Realizado" ${!c.estatus||c.estatus==="Pedido Realizado"||c.estatus==="Pedido realizado"?"selected":""}>Pedido Realizado</option>
          <option value="En Compra" ${c.estatus==="En Compra"?"selected":""}>En Compra</option>
          <option value="En Tienda" ${c.estatus==="En Tienda"?"selected":""}>En Tienda</option>
          <option value="Recibido" ${c.estatus==="Recibido"?"selected":""}>Recibido</option>
          <option value="Entregado" ${c.estatus==="Entregado"?"selected":""}>Entregado</option>
        </select>
      </td>
    </tr>`;
  }).join("");
}

async function cambiarEstatusPedido(clienteId, nuevoEstatus){
  // Cambia el estatus desde la tabla de pedidos y refresca la lista
  // Si el nuevo estatus no es "Pedido Realizado", el cliente desaparece de la tabla
  try{
    allClientes = await loadClientesFS();
    const idx = allClientes.findIndex(x=>x.id===clienteId);
    if(idx===-1) return;
    allClientes[idx].estatus = nuevoEstatus;
    allClientes[idx].editadoPor = currentUser.user;
    allClientes[idx].editadoEn = new Date().toLocaleString("es-MX",{timeZone:"America/Mexico_City"});
    await saveUnCliente(allClientes[idx]);
    toast("Estatus actualizado ✓");
    renderPedidos();
  }catch(e){
    console.error(e);
    toast("Error al actualizar estatus","err");
  }
}

function generarContrato(c){
  const precio=Number(c.precio||0),paquete=Number(c.precioPaquete||0);
  const extras=(c.paquete?.adicionales||[]).reduce((s,a)=>s+Number(a.precio||0),0);
  const total=totalConDescuentoCliente(c),anticipo=Number(c.anticipo||0);
  const folioNota=(c.folio||"????")+ "-A";
  let fLimCalc=c.fechaLimite;
  if(!fLimCalc&&c.fecha){const d=new Date(c.fecha+"T12:00:00");d.setMonth(d.getMonth()+2);if(c.proroga&&c.prorogaDias)d.setDate(d.getDate()+parseInt(c.prorogaDias));fLimCalc=d.toISOString().split("T")[0];}
  const fC=c.fecha?new Date(c.fecha+"T12:00:00").toLocaleDateString("es-MX",{day:"2-digit",month:"long",year:"numeric"}):"___________";
  const fL=fLimCalc?new Date(fLimCalc+"T12:00:00").toLocaleDateString("es-MX",{day:"2-digit",month:"long",year:"numeric"}):"___________";
  const fE=c.entrega?new Date(c.entrega+"T12:00:00").toLocaleDateString("es-MX",{day:"2-digit",month:"long",year:"numeric"}):"___________";
  const autImg=c.imagen==="si"?"☑ Sí autorizo":"☑ No autorizo";
  const parc=c.parcialidades||30;
  document.getElementById("contrato-content").innerHTML=`
  <div style="font-family:Arial,sans-serif;color:#1a1a1a;line-height:1.35;max-width:720px;margin:0 auto;font-size:10pt">
    <div style="border-bottom:1pt solid #DDD;margin-bottom:8pt"></div>
    <div style="font-size:18pt;font-weight:700;margin-bottom:8pt">Folio ${c.folio||"____"}</div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6pt;border-bottom:1.5pt solid #C9A84C;padding-bottom:6pt">
      <div>
        <div style="font-size:13pt;font-weight:700;color:#7A4F2A">ROSS DE LUNE</div>
        <div style="font-size:7pt;color:#999;letter-spacing:.05em">NOVIAS Y QUINCEAÑERAS</div>
        <div style="font-size:11pt;font-weight:700;margin-top:5pt">CONTRATO DE SERVICIO</div>
        <div style="font-size:7.5pt;color:#666;margin-top:4pt">Folio: <strong>${c.folio||"____"}</strong> · Fecha: <strong>${fC}</strong></div>
        <div style="font-size:7.5pt;color:#666">Nota de Venta Anexa: <strong>${folioNota}</strong></div>
      </div>
      <img src="logo_contrato.png" style="width:90pt;height:auto;flex-shrink:0">
    </div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:6pt;font-size:7pt">
      <tr>
        <td style="width:50%;vertical-align:top;padding-right:8pt;font-size:10pt"><strong>Proveedor</strong><br>ROSS DE LUNE · Tel: 921 255 0819<br>rossdelune@hotmail.com<br>Propela 10, Puerto Esmeralda, Coatzacoalcos, Ver.</td>
        <td style="width:50%;vertical-align:top;border-left:1pt solid #DDD;padding-left:8pt;font-size:10pt"><strong>Cliente</strong><br>${c.nombre||"—"} · Cel: ${c.cel||"—"}<br>${c.correo||""} ${c.tel?"· Tel: "+c.tel:""}<br>${c.domicilio||""}</td>
      </tr>
    </table>
    <div style="font-weight:700;text-align:center;letter-spacing:.08em;margin-bottom:4pt;border-bottom:1pt solid #CCC;padding-bottom:2pt">CLÁUSULAS</div>
    <p style="margin-bottom:3pt"><strong>PRIMERA.- OBJETO DEL CONTRATO.</strong> EL PROVEEDOR se obliga a elaborar y/o proporcionar a LA CLIENTE el vestido y accesorios especificados en la NOTA DE VENTA Folio <strong>${folioNota}</strong>, anexa al presente contrato.</p>
    <p style="margin-bottom:3pt"><strong>SEGUNDA.- PRECIO Y FORMA DE PAGO.</strong> Precio total: <strong style="border-bottom:1.5pt solid #000;">$${total.toLocaleString("es-MX")}</strong>. Anticipo: <strong style="border-bottom:1.5pt solid #000;">$${anticipo.toLocaleString("es-MX")}</strong> al firmar. Sistema: <strong>${c.sispago==="En parcialidades"?"parcialidades cada "+parc+" días":"liquidado"}</strong>. La entrega solo procede si el total está liquidado. Sin pagos ni contacto por 30+ días y sin 50% de anticipo, el contrato se cancela automáticamente.</p>
    <p style="margin-bottom:3pt"><strong>SEGUNDA BIS.- FECHA LÍMITE DE PAGO E INTERESES MORATORIOS.</strong> El pago total deberá realizarse a más tardar el <strong>${fL}</strong>. Vencido dicho plazo se aplicará un cargo del 10% sobre el precio total, previo a la entrega.</p>
    <p style="margin-bottom:3pt"><strong>TERCERA.- AJUSTES Y MODIFICACIONES.</strong> EL PROVEEDOR realizará ajustes según fechas de prueba pactadas. Modificaciones adicionales podrán generar costo extra. No se realizarán cambios de última hora que alteren significativamente el diseño.</p>
    <p style="margin-bottom:3pt"><strong>CUARTA.- CONFIDENCIALIDAD Y USO DE IMAGEN.</strong> LA CLIENTA autoriza el uso de imágenes del vestido y/o evento para promoción, sin revelar datos personales. ${autImg}</p>
    <p style="margin-bottom:3pt"><strong>QUINTA.- CANCELACIONES Y DEVOLUCIONES.</strong> No se realizarán reembolsos de anticipos. Si LA CLIENTE cancela por cualquier motivo, no se reembolsará ninguna cantidad abonada.</p>
    <p style="margin-bottom:3pt"><strong>SEXTA.- AJUSTES Y COMPROMISO DE ASISTENCIA.</strong> LA CLIENTE asistirá a pruebas en fechas y horarios establecidos con 10 min de tolerancia. Puede reagendar una vez sin costo con 24 hrs de anticipación. A partir de la segunda cancelación/inasistencia, cada reprogramación tiene costo de $200.00 pagadero al momento de programar.</p>
    <p style="margin-bottom:3pt"><strong>SÉPTIMA.- GARANTÍA Y RESPONSABILIDAD.</strong> EL PROVEEDOR garantiza entrega en buen estado con medidas acordadas. Una vez entregado no responde por daños o alteraciones. Si transcurren 30 días sin recoger ni liquidar, el contrato se considera cancelado y EL PROVEEDOR podrá disponer del artículo.</p>
    <p style="margin-bottom:6pt"><strong>OCTAVA.- ACEPTACIÓN.</strong> Ambas partes manifiestan haber leído y comprendido el presente contrato, firmando de conformidad en ${fC}.</p>
    <table style="width:100%;border-collapse:collapse;margin-top:8pt;font-size:7pt;text-align:center">
      <tr>
        <td style="width:50%;padding:0 10pt"><div style="border-top:1pt solid #333;padding-top:3pt;margin-top:60pt">NOMBRE Y FIRMA DE LA CLIENTE</div><div style="color:#666;margin-top:2pt">${c.nombre||"___________________________"}</div></td>
        <td style="width:50%;padding:0 10pt"><div style="border-top:1pt solid #333;padding-top:3pt;margin-top:60pt">NOMBRE Y FIRMA DEL PROVEEDOR</div><div style="color:#666;margin-top:2pt">Ross de Lune</div></td>
      </tr>
    </table>
    <div style="text-align:center;margin-top:4pt;font-size:6.5pt;color:#AAA">Fecha de evento acordada: ${fE}</div>
  </div>`;
}