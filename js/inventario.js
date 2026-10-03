// ══ INVENTARIO ══
// QR: se usa la librería QRCode.js cargada desde CDN

function renderResumenCategoriasInv(){
  const cont = document.getElementById("inv-resumen-categorias");
  if(!cont) return;
  const inv = (window._invData||[]);
  const categorias = [
    {label:"Vestidos de novia", match:"vestido de novia"},
    {label:"Vestidos de quinceañera", match:"vestido de quinceañera"}
  ];
  cont.innerHTML = categorias.map(cat=>{
    const total = inv
      .filter(a => (a.categoria||"").toLowerCase() === cat.match)
      .reduce((s,a)=>s+(Number(a.cantidad)||0), 0);
    return `<div style="background:#F5EDE0;border-radius:6px;padding:.55rem .9rem;flex:1;min-width:150px">
      <div style="font-size:.62rem;letter-spacing:.08em;text-transform:uppercase;color:var(--dorado-d)">${cat.label}</div>
      <div style="font-family:'Cormorant Garamond',serif;font-size:1.5rem;color:var(--texto);line-height:1.2">${total}</div>
    </div>`;
  }).join("");
}

async function refrescarInventarioDesdeServidor(){
  try{
    window._invData = await loadInventarioFS();
  }catch(e){ /* si falla la red, se queda con lo último que había en memoria */ }
}

function renderInventario(){
  const lista = document.getElementById("inv-lista");
  if(!lista) return;
  renderResumenCategoriasInv();
  const inv = (window._invData||[]);
  if(!inv.length){
    lista.innerHTML='<p style="color:#AAA;font-size:.82rem;padding:.5rem">Sin artículos registrados. Presiona "+ Agregar" para comenzar.</p>';
    return;
  }
  lista.innerHTML = inv.map(a => buildInvCard(a)).join("");
}

function ordenarTallas(tallas){
  const orden = ["XXS","XS","S","M","L","XL","XXL","XXXL","3XL","4XL"];
  return tallas.slice().sort((a,b)=>{
    const ia = orden.indexOf((a||"").toUpperCase());
    const ib = orden.indexOf((b||"").toUpperCase());
    if(ia>-1 && ib>-1) return ia-ib;
    if(ia>-1) return -1;
    if(ib>-1) return 1;
    return (a||"").localeCompare((b||""), undefined, {numeric:true});
  });
}

window._matrizCeldas = {};

function buildMatrizModelo(modelo, articulos){
  const tallas = ordenarTallas([...new Set(articulos.map(a=>a.talla||"—"))]);
  const coloresMap = {};
  articulos.forEach(a=>{
    const key = (a.colorNombre||a.colorHex||"—").toLowerCase();
    if(!coloresMap[key]) coloresMap[key] = {nombre:a.colorNombre||"—", hex:a.colorHex||"#CCC", articulos:[]};
    coloresMap[key].articulos.push(a);
  });
  const colores = Object.keys(coloresMap);
  const modelKey = (modelo||"modelo").replace(/[^a-zA-Z0-9]/g,"_")||"modelo";

  const totalPiezas = articulos.reduce((s,a)=>s+(Number(a.cantidad)||0),0);
  const precios = articulos.map(a=>Number(a.precio)||0).filter(p=>p>0);
  const precioMin = precios.length ? Math.min(...precios) : 0;
  const precioMax = precios.length ? Math.max(...precios) : 0;
  const rangoPrecio = precios.length
    ? (precioMin===precioMax
        ? "$"+precioMin.toLocaleString("es-MX")
        : "$"+precioMin.toLocaleString("es-MX")+" – $"+precioMax.toLocaleString("es-MX"))
    : "Sin precio";
  const categoria = articulos[0]?.categoria || "";

  const bloquesColor = colores.map(ck=>{
    const c = coloresMap[ck];
    const totalColor = c.articulos.reduce((s,a)=>s+(Number(a.cantidad)||0),0);
    const artConFoto = c.articulos.find(a=>a.fotoUrl) || c.articulos.find(a=>a.tieneFoto);
    const foto = artConFoto ? (artConFoto.fotoUrl || localStorage.getItem("foto_"+artConFoto.id) || "") : "";
    const fotoHTML = foto
      ? `<img src="${foto}" class="matriz-color-foto" style="object-fit:cover">`
      : `<div class="matriz-color-foto">👗</div>`;

    const tallasHTML = tallas.map(t=>{
      const matches = c.articulos.filter(a=>(a.talla||"—")===t);
      if(!matches.length) return `<div class="matriz-talla-item"><span class="matriz-vacia">–</span><div class="matriz-talla-label">${t}</div></div>`;
      const total = matches.reduce((s,a)=>s+(Number(a.cantidad)||0),0);
      const cellId = modelKey+"__"+t.replace(/\W/g,"")+"__"+ck.replace(/\W/g,"");
      window._matrizCeldas[cellId] = matches.map(a=>a.id);
      return `<div class="matriz-talla-item">
        <button class="matriz-badge" id="badge-${cellId}" onclick="toggleDetalleInvCelda('${cellId}','${modelKey}')">${total}</button>
        <div class="matriz-talla-label">${t}</div>
      </div>`;
    }).join("");

    return `<div class="matriz-color-block">
      ${fotoHTML}
      <div class="matriz-color-body">
        <div class="matriz-color-top">
          <div class="matriz-color-nombre"><span class="matriz-color-dot" style="background:${c.hex}"></span>${c.nombre}</div>
          <div class="matriz-color-cuenta">${totalColor} pieza${totalColor===1?"":"s"}</div>
        </div>
        <div class="matriz-tallas-row">${tallasHTML}</div>
      </div>
    </div>`;
  }).join("");

  return `<div class="matriz-modelo">
    <div class="matriz-header-bottom">
      <div class="matriz-header-top">
        <div class="matriz-modelo-nombre">${modelo}</div>
        <div class="matriz-header-stats">
          <div class="matriz-total-piezas">${totalPiezas} pieza${totalPiezas===1?"":"s"} en existencia</div>
          <div class="matriz-rango-precio">${rangoPrecio}</div>
        </div>
      </div>
      ${categoria?`<span class="matriz-categoria">${categoria}</span>`:""}
    </div>
    ${bloquesColor}
    <div class="matriz-detalle" id="detalle-${modelKey}"></div>
  </div>`;
}

function toggleDetalleInvCelda(cellId, modelKey){
  const cont = document.getElementById("detalle-"+modelKey);
  if(!cont) return;
  const prevBadge = document.getElementById("badge-"+cont.dataset.activo);
  if(prevBadge) prevBadge.classList.remove("activa");
  if(cont.dataset.activo===cellId){
    cont.innerHTML=""; cont.dataset.activo="";
    return;
  }
  const ids = window._matrizCeldas[cellId]||[];
  const inv = window._invData||[];
  const piezas = ids.map(id=>inv.find(a=>a.id===id)).filter(Boolean);
  cont.innerHTML = '<div class="matriz-detalle-inner">' + piezas.map(a=>buildInvCard(a)).join("") + '</div>';
  cont.dataset.activo = cellId;
  const badge = document.getElementById("badge-"+cellId);
  if(badge) badge.classList.add("activa");
}

function buscarModeloInventario(q){
  const cont = document.getElementById("inv-buscar-resultados");
  if(!cont) return;
  const txt = (q||"").toLowerCase().trim().replace(/\s+/g," ");
  if(!txt){
    cont.innerHTML = '<p style="color:#AAA;font-size:.82rem;padding:.5rem">Empieza a escribir para ver coincidencias en vivo.</p>';
    return;
  }
  const inv = (window._invData||[]);
  const coincidencias = inv.filter(a =>
    (a.modelo||"").toLowerCase().trim().replace(/\s+/g," ").includes(txt) ||
    (a.categoria||"").toLowerCase().includes(txt) ||
    (a.colorNombre||"").toLowerCase().includes(txt)
  );
  if(!coincidencias.length){
    cont.innerHTML = '<p style="color:#AAA;font-size:.82rem;padding:.5rem">Sin coincidencias para "'+q+'".</p>';
    return;
  }
  window._matrizCeldas = {};
  const grupos = {};
  const etiquetas = {};
  coincidencias.forEach(a=>{
    const original = (a.modelo||"").trim() || "(sin modelo)";
    const key = original.toLowerCase().replace(/\s+/g," ");
    if(!grupos[key]){ grupos[key]=[]; etiquetas[key]=original; }
    grupos[key].push(a);
  });
  cont.innerHTML =
    '<p style="font-size:.72rem;color:var(--dorado-d);margin-bottom:.5rem">'+Object.keys(grupos).length+' modelo(s) encontrado(s):</p>' +
    Object.keys(grupos).map(k => buildMatrizModelo(etiquetas[k], grupos[k])).join("");
}

function buildInvCard(a){
  const foto = a.fotoUrl || (a.tieneFoto ? (localStorage.getItem("foto_"+a.id)||"") : "");
  const fotoHTML = foto
    ? `<img src="${foto}" style="width:64px;height:64px;object-fit:cover;border-radius:3px;border:1px solid #EEE;flex-shrink:0">`
    : `<div style="width:64px;height:64px;background:#F5F0E8;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0">👗</div>`;
  return `<div class="proceso-card" style="display:flex;gap:.8rem;align-items:flex-start">
    ${fotoHTML}
    <div style="flex:1;min-width:0">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem">
        <div>
          <div class="proceso-nombre">${a.modelo||"Sin nombre"}</div>
          <div class="proceso-meta">${a.categoria||"—"} · Talla ${a.talla||"—"} · <span style="display:inline-block;width:10px;height:10px;background:${a.colorHex||'#CCC'};border-radius:50%;vertical-align:middle"></span> ${a.colorNombre||"—"}</div>
          <div class="proceso-meta" style="margin-top:.2rem">Stock: <strong>${a.cantidad??1}</strong> · $${Number(a.precio||0).toLocaleString("es-MX")}</div>
          ${a.notas?`<div class="proceso-meta" style="margin-top:.2rem;font-style:italic">${a.notas}</div>`:""}
        </div>
        <div style="display:flex;gap:.4rem;flex-shrink:0">
          <button class="paso-btn" onclick="editarArticulo('${a.id}')" title="Editar">✎ Editar</button>
          <button class="paso-btn" onclick="agregarAlLote('${a.id}')" id="btn-lote-${a.id}" title="Agregar al lote de impresión">＋ Lote</button>
          <button class="paso-btn" onclick="verQR('${a.id}')" title="Ver QR">🔲 QR</button>
          <button class="paso-btn" onclick="eliminarArticulo('${a.id}')" title="Eliminar" style="color:#C0392B;border-color:#C0392B">✕</button>
        </div>
      </div>
    </div>
  </div>`;
}

function verQR(artId){
  const a = (window._invData||[]).find(x=>x.id===artId);
  if(!a) return;
  goSec("inv-detalle");
  const fotoDetalle = a.fotoUrl || (a.tieneFoto ? (localStorage.getItem("foto_"+a.id)||"") : "");
  const card = document.getElementById("inv-detalle-card");
  card.innerHTML = `
    <div style="display:flex;gap:1rem;flex-wrap:wrap;align-items:flex-start">
      ${fotoDetalle?`<img src="${fotoDetalle}" style="width:120px;height:120px;object-fit:cover;border-radius:4px;border:1px solid #EEE">`:""}
      <div style="flex:1;min-width:180px">
        <div class="proceso-nombre" style="font-size:1rem;margin-bottom:.3rem">${a.modelo||"Sin nombre"}</div>
        <div class="proceso-meta">${a.categoria||"—"}</div>
        <div class="proceso-meta">Talla: <strong>${a.talla||"—"}</strong></div>
        <div class="proceso-meta">Color: <span style="display:inline-block;width:10px;height:10px;background:${a.colorHex||'#CCC'};border-radius:50%;vertical-align:middle"></span> <strong>${a.colorNombre||"—"}</strong></div>
        <div class="proceso-meta">Precio: <strong>$${Number(a.precio||0).toLocaleString("es-MX")}</strong></div>
        <div class="proceso-meta">Stock: <strong>${a.cantidad??1}</strong></div>
        ${a.notas?`<div class="proceso-meta" style="margin-top:.3rem;font-style:italic">${a.notas}</div>`:""}
      </div>
    </div>
    <div style="margin-top:1rem;border-top:1px solid #F0E8D8;padding-top:.8rem">
      <div style="font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:var(--dorado-d);margin-bottom:.5rem">Código QR</div>
      <div id="qr-render-${artId}"></div>
      <div style="font-size:.68rem;color:#BBB;margin-top:.4rem">ID: ${artId}</div>
    </div>
    <div class="actions-row" style="margin-top:.8rem">
      <button class="paso-btn" onclick="imprimirQR('${artId}')">🖨️ Imprimir QR</button>
      <button class="btn-sec" onclick="goSec('inv-qr')">← Volver</button>
    </div>`;
  // Generar QR
  setTimeout(()=>{
    const el = document.getElementById("qr-render-"+artId);
    if(el && window.QRCode){
      el.innerHTML="";
      new QRCode(el,{text:artId,width:160,height:160,colorDark:"#3a2a1a",colorLight:"#ffffff"});
    }
  },100);
}

// ── LOTE DE IMPRESIÓN QR ──────────────────────────────────────────────
window._lotePrint = [];

function actualizarUILote(){
  const n = window._lotePrint.length;
  const cnt = document.getElementById("lote-count");
  const btn = document.getElementById("btn-lote-flotante");
  if(cnt) cnt.textContent = n;
  if(btn) btn.style.display = n > 0 ? "inline-flex" : "none";
}

function agregarAlLote(artId){
  const lote = window._lotePrint;
  const btnEl = document.getElementById("btn-lote-"+artId);
  if(lote.includes(artId)){
    // Si ya está, lo quitamos (toggle)
    window._lotePrint = lote.filter(x=>x!==artId);
    if(btnEl){ btnEl.textContent="＋ Lote"; btnEl.style.background=""; btnEl.style.color=""; }
  } else {
    if(lote.length >= 8){
      alert("El lote ya tiene 8 artículos (máximo por hoja). Imprime primero o vacía el lote.");
      return;
    }
    window._lotePrint.push(artId);
    if(btnEl){ btnEl.textContent="✔ En lote"; btnEl.style.background="#e8f5e9"; btnEl.style.color="#2e7d32"; }
  }
  actualizarUILote();
}

function abrirModalLote(){
  const lote = window._lotePrint;
  if(!lote.length){ alert("El lote está vacío. Agrega artículos con el botón \"＋ Lote\"."); return; }
  const grid = document.getElementById("lote-grid");
  const info = document.getElementById("lote-info-texto");
  if(info) info.textContent = lote.length + " artículo" + (lote.length===1?"":"s") + " · máx. 8 por hoja";
  grid.innerHTML = "";
  lote.forEach((artId, i) => {
    const a = (window._invData||[]).find(x=>x.id===artId);
    if(!a) return;
    const celda = document.createElement("div");
    celda.className = "lote-celda";
    celda.style.cssText = "border:1px solid #DDD;border-radius:4px;padding:6px;text-align:center;position:relative;";
    celda.innerHTML = `
      <div id="lote-qr-${artId}" style="display:flex;justify-content:center;margin-bottom:4px"></div>
      <div style="font-size:.65rem;font-weight:600;color:#1a1a1a;line-height:1.2">${a.modelo||"Artículo"}</div>
      <div style="font-size:.58rem;color:#888;margin-top:2px">${(a.categoria||"")} · T.${a.talla||"—"} · ${a.colorNombre||"—"}</div>
      <div style="font-size:.62rem;font-weight:600;color:#7A4F2A;margin-top:2px">$${Number(a.precio||0).toLocaleString("es-MX")}</div>
      <div style="font-size:.5rem;color:#BBB;margin-top:2px">${artId}</div>
      <button class="no-print" onclick="quitarDeLote('${artId}')" style="position:absolute;top:2px;right:2px;background:none;border:none;cursor:pointer;font-size:.65rem;color:#C0392B;padding:0;line-height:1" title="Quitar">✕</button>
    `;
    grid.appendChild(celda);
    // Generar QR
    setTimeout(()=>{
      const el = document.getElementById("lote-qr-"+artId);
      if(el && window.QRCode){
        el.innerHTML="";
        new QRCode(el,{text:artId,width:80,height:80,colorDark:"#3a2a1a",colorLight:"#ffffff"});
      }
    }, 80 * (i+1));
  });
  const modal = document.getElementById("modal-lote-print");
  modal.style.display = "flex";
}

function quitarDeLote(artId){
  window._lotePrint = window._lotePrint.filter(x=>x!==artId);
  const btnEl = document.getElementById("btn-lote-"+artId);
  if(btnEl){ btnEl.textContent="＋ Lote"; btnEl.style.background=""; btnEl.style.color=""; }
  actualizarUILote();
  if(!window._lotePrint.length){ cerrarModalLote(); return; }
  abrirModalLote(); // re-render
}

function limpiarLote(){
  window._lotePrint.forEach(artId=>{
    const btnEl = document.getElementById("btn-lote-"+artId);
    if(btnEl){ btnEl.textContent="＋ Lote"; btnEl.style.background=""; btnEl.style.color=""; }
  });
  window._lotePrint = [];
  actualizarUILote();
  cerrarModalLote();
}

function cerrarModalLote(){
  const modal = document.getElementById("modal-lote-print");
  if(modal) modal.style.display = "none";
}

function ejecutarImpresionLote(){
  const modal = document.getElementById("modal-lote-print");
  modal.classList.add("printing");
  setTimeout(()=>{
    window.print();
    modal.classList.remove("printing");
  }, 800);
}
// ─────────────────────────────────────────────────────────────────────

function imprimirQR(artId){
  const a = (window._invData||[]).find(x=>x.id===artId);
  if(!a) return;
  // Llenar el modal
  document.getElementById("qr-print-nombre").textContent = a.modelo||"Artículo";
  document.getElementById("qr-print-meta").textContent = (a.categoria||"") + " · Talla " + (a.talla||"—") + " · " + (a.colorNombre||"");
  document.getElementById("qr-print-precio").textContent = "$" + Number(a.precio||0).toLocaleString("es-MX");
  document.getElementById("qr-print-id").textContent = "ID: " + artId;
  // Generar QR en el modal
  const qrEl = document.getElementById("qr-print-img");
  qrEl.innerHTML = "";
  if(window.QRCode){
    new QRCode(qrEl,{text:artId,width:180,height:180,colorDark:"#3a2a1a",colorLight:"#ffffff"});
  }
  const modal = document.getElementById("modal-qr-print");
  modal.style.display = "flex";
}

function ejecutarImpresionQR(){
  const modal = document.getElementById("modal-qr-print");
  modal.classList.add("printing");
  setTimeout(()=>{
    window.print();
    modal.classList.remove("printing");
  }, 600);
}

function cerrarModalQR(){
  document.getElementById("modal-qr-print").style.display = "none";
  document.getElementById("qr-print-img").innerHTML = "";
}

function previewInvFoto(input){
  const file = input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = document.getElementById("inv-foto-preview");
    img.src = e.target.result;
    img.style.display="block";
  };
  reader.readAsDataURL(file);
}

// Sube una foto (base64) a Cloudinary y regresa la URL pública del archivo.
// Usa un "unsigned upload preset" configurado en la cuenta de Cloudinary de Ross de Lune,
// por lo que no requiere API secret expuesta en el código.
const CLOUDINARY_CLOUD  = "htaj9bcz";
const CLOUDINARY_PRESET = "archivo_rossdelune";
// Cuenta anterior (personal), usada antes del traspaso a la cuenta del negocio.
// Se conserva solo como referencia para identificar fotos aún no traspasadas.
const CLOUDINARY_CLOUD_ANTERIOR = "fbuz82vi";
async function subirFotoCloudinary(base64){
  const formData = new FormData();
  formData.append("file", base64);
  formData.append("upload_preset", CLOUDINARY_PRESET);
  const resp = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
    method: "POST",
    body: formData
  });
  if(!resp.ok) throw new Error("Cloudinary respondió con error");
  const data = await resp.json();
  return data.secure_url;
}

// Vista previa del contrato firmado seleccionado (imagen o PDF), antes de subirlo.
// prefix es "c" (Nuevo cliente) o "edit" (Editar cliente).
function previewContratoCliente(input, prefix){
  const file = input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const dataUrl = e.target.result;
    if(prefix==="c") window._contratoNuevoBase64 = dataUrl;
    else window._contratoEditBase64 = dataUrl;
    const preview = document.getElementById(prefix+"-contrato-preview");
    if(preview){
      preview.style.display = "block";
      preview.textContent = "📎 "+file.name+" listo para subir al guardar";
    }
  };
  reader.readAsDataURL(file);
}

// Sube el contrato firmado (imagen o PDF) a Cloudinary. Usa /auto/upload en vez de
// /image/upload porque detecta automáticamente si el archivo es imagen o PDF.
async function subirDocumentoCloudinary(base64){
  const formData = new FormData();
  formData.append("file", base64);
  formData.append("upload_preset", CLOUDINARY_PRESET);
  const resp = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/auto/upload`, {
    method: "POST",
    body: formData
  });
  if(!resp.ok) throw new Error("Cloudinary respondió con error");
  const data = await resp.json();
  return data.secure_url;
}

function agregarFilaTalla(){
  const cont = document.getElementById("inv-tallas-extra");
  const div = document.createElement("div");
  div.className = "fg2 fila-talla-extra";
  div.style.alignItems = "flex-end";
  div.innerHTML = `
    <div class="fi"><label>Talla</label><input type="text" class="extra-talla" placeholder="XS, S, M, L..."></div>
    <div class="fi" style="display:flex;gap:.5rem;align-items:flex-end">
      <div style="flex:1"><label>Cantidad</label><input type="number" class="extra-cantidad" placeholder="1" value="1"></div>
      <button type="button" class="ic-btn" onclick="this.closest('.fila-talla-extra').remove()" title="Quitar esta talla">🗑️</button>
    </div>`;
  cont.appendChild(div);
}

function limpiarFormInv(){
  ["inv-categoria","inv-marca","inv-modelo","inv-talla","inv-color-nombre","inv-precio","inv-cantidad","inv-notas"].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.value = id==="inv-cantidad"?"1":"";
  });
  document.getElementById("inv-color-picker").value="#C8A8D0";
  const invColorBox=document.getElementById("inv-color-preview-box");
  if(invColorBox) invColorBox.style.background="#C8A8D0";
  const prev=document.getElementById("inv-foto-preview");
  prev.src="";prev.style.display="none";
  document.getElementById("inv-foto-input").value="";
  document.getElementById("inv-msg").textContent="";
  window._editandoArticuloId=null;
  document.getElementById("inv-tallas-extra").innerHTML="";
  const btnExtraWrap=document.getElementById("inv-tallas-extra-btn-wrap");
  if(btnExtraWrap) btnExtraWrap.style.display="";
  const titulo=document.getElementById("inv-nuevo-title");
  if(titulo) titulo.textContent="Nuevo artículo";
  const btn=document.getElementById("btn-guardar-articulo");
  if(btn) btn.textContent="💾 Guardar artículo";
}

function editarArticulo(artId){
  const a = (window._invData||[]).find(x=>x.id===artId);
  if(!a) return;
  goSec("inv-nuevo"); // dispara limpiarFormInv(); llenamos los campos después
  window._editandoArticuloId = artId;
  // Ahora también se pueden agregar tallas nuevas al editar, sin importar
  // qué tan viejo sea el modelo.
  const btnExtraWrap=document.getElementById("inv-tallas-extra-btn-wrap");
  if(btnExtraWrap) btnExtraWrap.style.display="";
  document.getElementById("inv-categoria").value = a.categoria||"";
  document.getElementById("inv-marca").value = a.marca||"";
  document.getElementById("inv-modelo").value = a.modelo||"";
  document.getElementById("inv-talla").value = a.talla||"";
  document.getElementById("inv-color-picker").value = a.colorHex||"#C8A8D0";
  const invColorBox=document.getElementById("inv-color-preview-box");
  if(invColorBox) invColorBox.style.background = a.colorHex||"#C8A8D0";
  document.getElementById("inv-color-nombre").value = a.colorNombre||"";
  document.getElementById("inv-precio").value = a.precio||"";
  document.getElementById("inv-cantidad").value = a.cantidad??1;
  document.getElementById("inv-notas").value = a.notas||"";
  const fotoPreview = document.getElementById("inv-foto-preview");
  const fotoActual = a.fotoUrl || (a.tieneFoto ? (localStorage.getItem("foto_"+artId)||"") : "");
  if(fotoActual){ fotoPreview.src=fotoActual; fotoPreview.style.display="block"; }
  const titulo=document.getElementById("inv-nuevo-title");
  if(titulo) titulo.textContent="Editar artículo";
  const btn=document.getElementById("btn-guardar-articulo");
  if(btn) btn.textContent="💾 Guardar cambios";
}

async function guardarArticuloInv(){
  const msg = document.getElementById("inv-msg");
  msg.textContent="";
  const modelo = document.getElementById("inv-modelo").value.trim();
  const categoria = document.getElementById("inv-categoria").value;
  if(!modelo){msg.textContent="El modelo o nombre es obligatorio.";return;}
  if(!categoria){msg.textContent="Selecciona una categoría.";return;}

  const editId = window._editandoArticuloId||null;
  const fotoPreview = document.getElementById("inv-foto-preview");
  const fotoActual = fotoPreview.style.display!=="none" ? fotoPreview.src : "";
  const artIdBase = editId || ("INV"+Date.now());

  const btn = document.getElementById("btn-guardar-articulo");
  const btnTextoOriginal = btn ? btn.textContent : "";
  if(btn){ btn.disabled = true; btn.textContent = "⏳ Subiendo foto..."; }

  // Si fotoActual empieza con "data:" es una foto nueva recién seleccionada → hay que subirla.
  // Si ya es una URL (https://...) es una foto existente sin cambios → no se vuelve a subir.
  let fotoUrl = "";
  try{
    if(fotoActual.startsWith("data:")){
      fotoUrl = await subirFotoCloudinary(fotoActual);
    } else if(fotoActual){
      fotoUrl = fotoActual;
    }
  }catch(e){
    console.error("Error subiendo foto a Cloudinary:", e);
    msg.textContent = "No se pudo subir la foto. Verifica tu conexión e intenta de nuevo.";
    if(btn){ btn.disabled=false; btn.textContent=btnTextoOriginal; }
    return;
  }

  if(btn) btn.textContent = "💾 Guardando...";

  // Campos compartidos entre todas las tallas del mismo modelo
  const camposComunes = {
    categoria,
    marca: document.getElementById("inv-marca").value.trim(),
    modelo,
    colorHex: document.getElementById("inv-color-picker").value,
    colorNombre: document.getElementById("inv-color-nombre").value.trim(),
    precio: document.getElementById("inv-precio").value,
    notas: document.getElementById("inv-notas").value.trim(),
    fotoUrl: fotoUrl,
    tieneFoto: !!fotoUrl
  };

  try{
    const inv = await loadInventarioFS();

    if(editId){
      // Actualiza el artículo que se está editando
      const existente = inv.find(x=>x.id===editId);
      const articulo = {
        id: editId,
        ...camposComunes,
        talla: document.getElementById("inv-talla").value.trim(),
        cantidad: document.getElementById("inv-cantidad").value||1,
        creadoEn: existente ? existente.creadoEn : new Date().toLocaleString("es-MX",{timeZone:"America/Mexico_City"}),
        actualizadoEn: new Date().toLocaleString("es-MX",{timeZone:"America/Mexico_City"})
      };
      await saveUnArticulo(articulo);
      let todos = inv.map(x=>x.id===editId?articulo:x);

      // Tallas nuevas agregadas durante esta edición — se crean como artículos independientes
      const filasExtra = [];
      document.querySelectorAll("#inv-tallas-extra .fila-talla-extra").forEach(fila=>{
        const t = fila.querySelector(".extra-talla").value.trim();
        const c = fila.querySelector(".extra-cantidad").value||1;
        if(t) filasExtra.push({talla:t, cantidad:c});
      });

      if(filasExtra.length){
        const ahora = new Date().toLocaleString("es-MX",{timeZone:"America/Mexico_City"});
        const modeloNorm = (camposComunes.modelo||"").trim().toLowerCase();
        // Se agrega colorNorm a la comparación: antes solo se comparaba modelo+talla,
        // así que un modelo+talla ya existente en OTRO color se detectaba como "el mismo
        // artículo" y se fusionaba con él (sumando cantidad) en vez de crear uno nuevo,
        // descartando el color recién escrito en el formulario.
        const colorNorm = (camposComunes.colorNombre||"").trim().toLowerCase();
        let agregadas = 0, actualizadas = 0;
        for(let i=0;i<filasExtra.length;i++){
          const tallaNorm = (filasExtra[i].talla||"").trim().toLowerCase();
          const existente = todos.find(x =>
            (x.modelo||"").trim().toLowerCase()===modeloNorm &&
            (x.talla||"").trim().toLowerCase()===tallaNorm &&
            (x.colorNombre||"").trim().toLowerCase()===colorNorm
          );
          if(existente){
            // Ya existe esa talla para este modelo — se suma la cantidad, no se duplica
            const actualizado = {
              ...existente,
              cantidad: (Number(existente.cantidad)||0) + (Number(filasExtra[i].cantidad)||0),
              actualizadoEn: ahora
            };
            await saveUnArticulo(actualizado);
            todos = todos.map(x=>x.id===actualizado.id?actualizado:x);
            actualizadas++;
          } else {
            const nuevoArt = {
              id: "INV"+Date.now()+"_x"+i,
              ...camposComunes,
              talla: filasExtra[i].talla,
              cantidad: filasExtra[i].cantidad,
              creadoEn: ahora,
              actualizadoEn: null
            };
            await saveUnArticulo(nuevoArt);
            todos = [...todos, nuevoArt];
            agregadas++;
          }
        }
        let msg = [];
        if(agregadas) msg.push(agregadas+" talla(s) nueva(s) agregada(s)");
        if(actualizadas) msg.push(actualizadas+" talla(s) existente(s) sumada(s)");
        toast("Artículo actualizado — "+msg.join(" y ")+" ✓");
      } else {
        toast("Artículo actualizado ✓");
      }
      window._invData = todos;
      // Mostramos el dato que ya tenemos en memoria (correcto) en vez de volver
      // a pedirlo al servidor — evita la carrera con Firestore justo después
      // de escribir varios documentos seguidos.
      closeAllNav();
      document.querySelectorAll(".section").forEach(s=>s.classList.remove("active"));
      const secInv=document.getElementById("sec-inv-qr");
      if(secInv) secInv.classList.add("active");
      renderInventario();
      return;
    }

    // Creación: la talla principal + las tallas adicionales que se hayan agregado.
    // Cada talla queda como un artículo independiente en Firestore, con su propio
    // ID (y por lo tanto su propio QR), compartiendo el resto de los datos.
    const filas = [{
      talla: document.getElementById("inv-talla").value.trim(),
      cantidad: document.getElementById("inv-cantidad").value||1
    }];
    document.querySelectorAll("#inv-tallas-extra .fila-talla-extra").forEach(fila=>{
      const t = fila.querySelector(".extra-talla").value.trim();
      const c = fila.querySelector(".extra-cantidad").value||1;
      if(t) filas.push({talla:t, cantidad:c});
    });

    const ahora = new Date().toLocaleString("es-MX",{timeZone:"America/Mexico_City"});
    const modeloNorm = (camposComunes.modelo||"").trim().toLowerCase();
    // Mismo fix que arriba: el color entra a la comparación de "¿ya existe este
    // artículo?" para que un modelo+talla en un color nuevo se guarde como artículo
    // independiente en vez de fusionarse con el que ya existía en otro color.
    const colorNorm = (camposComunes.colorNombre||"").trim().toLowerCase();
    let todosFinal = [...inv];
    let agregadas2 = 0, actualizadas2 = 0;
    for(let i=0;i<filas.length;i++){
      const tallaNorm = (filas[i].talla||"").trim().toLowerCase();
      const existente = todosFinal.find(x =>
        (x.modelo||"").trim().toLowerCase()===modeloNorm &&
        (x.talla||"").trim().toLowerCase()===tallaNorm &&
        (x.colorNombre||"").trim().toLowerCase()===colorNorm
      );
      if(existente){
        const actualizado = {
          ...existente,
          cantidad: (Number(existente.cantidad)||0) + (Number(filas[i].cantidad)||0),
          actualizadoEn: ahora
        };
        await saveUnArticulo(actualizado);
        todosFinal = todosFinal.map(x=>x.id===actualizado.id?actualizado:x);
        actualizadas2++;
      } else {
        const articulo = {
          id: i===0 ? artIdBase : artIdBase+"_"+i,
          ...camposComunes,
          talla: filas[i].talla,
          cantidad: filas[i].cantidad,
          creadoEn: ahora,
          actualizadoEn: null
        };
        await saveUnArticulo(articulo);
        todosFinal = [...todosFinal, articulo];
        agregadas2++;
      }
    }
    window._invData = todosFinal;
    let msg2 = [];
    if(agregadas2) msg2.push(agregadas2+" nueva(s)");
    if(actualizadas2) msg2.push(actualizadas2+" sumada(s) a talla existente");
    toast("Guardado — "+msg2.join(" y ")+" ✓");
    closeAllNav();
    document.querySelectorAll(".section").forEach(s=>s.classList.remove("active"));
    const secInv2=document.getElementById("sec-inv-qr");
    if(secInv2) secInv2.classList.add("active");
    renderInventario();
  }catch(e){console.error("guardarArticuloInv error:",e);msg.textContent="Error al guardar. Verifica tu conexión.";}
  finally{
    if(btn){ btn.disabled=false; btn.textContent=btnTextoOriginal; }
  }
}

async function eliminarArticulo(artId){
  if(!confirm("¿Eliminar este artículo del inventario?")) return;
  try{
    await eliminarArticuloFS(artId);
    window._invData = (window._invData||[]).filter(x=>x.id!==artId);
    try{ localStorage.removeItem("foto_"+artId); }catch(e){}
    renderInventario();
    toast("Artículo eliminado ✓");
  }catch(e){toast("Error al eliminar","err");}
}