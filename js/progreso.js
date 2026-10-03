// ══ PROCESO PEDIDO (Ajustes) ══
const PASOS_PEDIDO = [
  {id:"ajuste1", label:"1er Ajuste"},
  {id:"ajuste2", label:"2do Ajuste"},
  {id:"ajuste3", label:"3er Ajuste"},
  {id:"entregado", label:"Entrega"}
];

function renderProceso(){
  const lista = document.getElementById("proceso-lista");
  if(!lista) return;
  const activos = allClientes.filter(c => c.estatus !== "Entregado" && !c.esNotaSencilla);
  if(!activos.length){
    lista.innerHTML='<p style="color:#AAA;font-size:.82rem;padding:.5rem">Sin pedidos activos.</p>';
    return;
  }
  lista.innerHTML = activos.map(c => buildProcesoCard(c)).join("");
  setTimeout(autoajustarTodasLasNotas, 0);
}

function filtrarProceso(q){
  const lista = document.getElementById("proceso-lista");
  if(!lista) return;
  const txt = q.toLowerCase();
  const filtrados = allClientes.filter(c =>
    c.estatus !== "Entregado" && !c.esNotaSencilla &&
    (c.nombre.toLowerCase().includes(txt) || (c.folio||"").includes(txt))
  );
  if(!filtrados.length){
    lista.innerHTML='<p style="color:#AAA;font-size:.82rem;padding:.5rem">Sin resultados.</p>';
    return;
  }
  lista.innerHTML = filtrados.map(c => buildProcesoCard(c)).join("");
  setTimeout(autoajustarTodasLasNotas, 0);
}

function buildDiagnosticoInventarioCliente(c){
  const inv = window._invData||[];
  const lineas = [];
  if(c.articuloId){
    const art = inv.find(a=>a.id===c.articuloId);
    lineas.push(art
      ? `Vestido 1 → ${art.modelo||"—"} (Stock actual: <strong>${art.cantidad??"—"}</strong>) · Descontado: ${c.progreso?.pedido?.entregado_descontado?"Sí":"No"}`
      : `Vestido 1 → ⚠️ artículo "${c.articuloId}" no encontrado en inventario`);
  } else {
    lineas.push("Vestido 1 → sin artículo vinculado");
  }
  if(c.vestido2){
    if(c.vestido2.articuloId){
      const art2 = inv.find(a=>a.id===c.vestido2.articuloId);
      lineas.push(art2
        ? `Vestido 2 → ${art2.modelo||"—"} (Stock actual: <strong>${art2.cantidad??"—"}</strong>) · Descontado: ${c.progreso?.pedido?.entregado_descontado2?"Sí":"No"}`
        : `Vestido 2 → ⚠️ artículo "${c.vestido2.articuloId}" no encontrado en inventario`);
    } else {
      lineas.push("Vestido 2 → sin artículo vinculado");
    }
  }
  return `<div style="margin-top:.5rem;padding:.5rem .6rem;background:#F5EDE0;border-radius:4px;font-size:.66rem;color:var(--dorado-d);line-height:1.7">
    <strong style="text-transform:uppercase;letter-spacing:.08em;font-size:.58rem">🔍 Diagnóstico de inventario (vivo)</strong><br>
    ${lineas.join("<br>")}
  </div>`;
}

function buildProcesoCard(c){
  const prog = c.progreso?.pedido || {};
  const entrega = c.entrega ? new Date(c.entrega+"T12:00:00").toLocaleDateString("es-MX") : "—";
  const pasos = PASOS_PEDIDO.map(p => {
    const done = !!prog[p.id];
    const nota = prog[p.id+"_nota"]||"";
    const fPrueba = prog[p.id+"_fechaPrueba"]||"";
    const hPrueba = prog[p.id+"_horaPrueba"]||"";
    const fTerm   = prog[p.id+"_fechaTerminado"]||"";
    return `<div class="paso-row">
      <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.3rem;flex-wrap:wrap">
        <button class="paso-btn ${done?"done":""}" onclick="togglePasoPedido('${c.id}','${p.id}')">
          <span class="paso-check">${done?"✓":"○"}</span>${p.label}
        </button>
        <label style="font-size:.6rem;color:#AAA;display:flex;align-items:center;gap:.25rem">Prueba
          <input type="date" value="${fPrueba}" style="font-size:.66rem;border:1px solid #E8DDD0;border-radius:2px;padding:.15rem .3rem"
            onchange="guardarNotaPedido('${c.id}','${p.id}_fechaPrueba',this.value)">
        </label>
        <label style="font-size:.6rem;color:#AAA;display:flex;align-items:center;gap:.25rem">Terminado
          <input type="date" value="${fTerm}" style="font-size:.66rem;border:1px solid #E8DDD0;border-radius:2px;padding:.15rem .3rem"
            onchange="guardarNotaPedido('${c.id}','${p.id}_fechaTerminado',this.value)">
        </label>
      </div>
      <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.3rem;flex-wrap:wrap">
        <label style="font-size:.6rem;color:#AAA;display:flex;align-items:center;gap:.25rem">Hora
          <input type="time" id="hora-${c.id}-${p.id}" value="${hPrueba}" style="font-size:.66rem;border:1px solid #E8DDD0;border-radius:2px;padding:.15rem .3rem"
            onchange="guardarNotaPedido('${c.id}','${p.id}_horaPrueba',this.value)">
        </label>
        <button type="button" title="Borrar hora" onclick="borrarHoraPrueba('${c.id}','${p.id}')"
          style="background:none;border:1px solid #E8DDD0;border-radius:2px;color:#C0392B;cursor:pointer;font-size:.62rem;padding:.15rem .4rem;line-height:1">🗑️</button>
      </div>
      <textarea class="paso-nota-input" placeholder="Observaciones del ${p.label}..." rows="4"
  oninput="autoajustarTextarea(this)"
  onblur="guardarNotaPedido('${c.id}','${p.id+"_nota"}',this.value)">${nota}</textarea>
    </div>`;
  }).join("");
  return `<div class="proceso-card" id="pcard-${c.id}">
    <div class="proceso-card-header">
      <div>
        <div class="proceso-nombre">${c.nombre}</div>
        <div class="proceso-meta">Folio ${c.folio||"—"} · ${c.tipo==="xv"?"Quinceañera":"Novia"} · ${c.modelo||"—"}</div>
      </div>
      <span class="status-badge ${c.estatus==="Entregado"?"s-entregado":c.estatus==="Recibido"?"s-recibido":"s-pedido"}">${c.estatus||"—"}</span>
    </div>
    <div style="margin-top:.5rem">${pasos}</div>
    ${buildDiagnosticoInventarioCliente(c)}
    <div class="proceso-entrega">📅 Fecha de evento: <strong>${entrega}</strong></div>
  </div>`;
}

async function togglePasoPedido(clienteId, pasoId){
  const c = allClientes.find(x=>x.id===clienteId);
  if(!c) return;
  if(!c.progreso) c.progreso={};
  if(!c.progreso.pedido) c.progreso.pedido={};
  c.progreso.pedido[pasoId] = !c.progreso.pedido[pasoId];
  if(pasoId==="entregado" && c.progreso.pedido[pasoId]) c.estatus="Entregado";
  try{
    const [clientesFS,inventarioFS]=await Promise.all([loadClientesFS(),loadInventarioFS()]);
    allClientes = clientesFS;
    const idx = allClientes.findIndex(x=>x.id===clienteId);
    let avisoInventario = "";
    if(idx>-1){
      allClientes[idx].progreso = c.progreso;
      if(pasoId==="entregado" && c.progreso.pedido[pasoId]) allClientes[idx].estatus="Entregado";

      // Descontar/revertir del inventario al marcar/desmarcar Entrega
      if(pasoId==="entregado"){
        const cli = allClientes[idx];
        const inv = inventarioFS;
        const articulosTocados = [];
        const entregando = cli.progreso.pedido.entregado;

        // Vestido 1
        const yaDescontado = !!cli.progreso.pedido.entregado_descontado;
        if(entregando && !yaDescontado){
          if(cli.articuloId){
            const artIdx = inv.findIndex(a=>a.id===cli.articuloId);
            if(artIdx>-1){
              inv[artIdx].cantidad = Math.max(0, (Number(inv[artIdx].cantidad)||0) - 1);
              articulosTocados.push(inv[artIdx]);
              cli.progreso.pedido.entregado_descontado = true;
            } else {
              avisoInventario += " (vestido 1: artículo no encontrado en inventario)";
            }
          } else {
            avisoInventario += " (vestido 1: sin artículo vinculado)";
          }
        } else if(!entregando && yaDescontado && cli.articuloId){
          const artIdx = inv.findIndex(a=>a.id===cli.articuloId);
          if(artIdx>-1){ inv[artIdx].cantidad = (Number(inv[artIdx].cantidad)||0) + 1; articulosTocados.push(inv[artIdx]); }
          cli.progreso.pedido.entregado_descontado = false;
        }

        // Vestido 2 (si existe)
        if(cli.vestido2){
          const yaDescontado2 = !!cli.progreso.pedido.entregado_descontado2;
          if(entregando && !yaDescontado2){
            if(cli.vestido2.articuloId){
              const artIdx2 = inv.findIndex(a=>a.id===cli.vestido2.articuloId);
              if(artIdx2>-1){
                inv[artIdx2].cantidad = Math.max(0, (Number(inv[artIdx2].cantidad)||0) - 1);
                articulosTocados.push(inv[artIdx2]);
                cli.progreso.pedido.entregado_descontado2 = true;
              } else {
                avisoInventario += " (vestido 2: artículo no encontrado en inventario)";
              }
            } else {
              avisoInventario += " (vestido 2: sin artículo vinculado)";
            }
          } else if(!entregando && yaDescontado2 && cli.vestido2.articuloId){
            const artIdx2 = inv.findIndex(a=>a.id===cli.vestido2.articuloId);
            if(artIdx2>-1){ inv[artIdx2].cantidad = (Number(inv[artIdx2].cantidad)||0) + 1; articulosTocados.push(inv[artIdx2]); }
            cli.progreso.pedido.entregado_descontado2 = false;
          }
        }

        window._invData = inv;
        await saveUnCliente(cli);
        await Promise.all(articulosTocados.map(a=>saveUnArticulo(a)));
        renderProceso();
        renderClientes();
        renderInventario();
        toast(entregando ? "Entrega marcada ✓"+avisoInventario : "Entrega desmarcada", avisoInventario?"err":"ok");
        return;
      }
    }
    await saveUnCliente(allClientes[idx]);
    renderProceso();
  }catch(e){alert("ERROR REAL en togglePasoPedido:\n\n"+e.message+"\n\n"+e.stack);toast("Error al guardar","err");}
}

// Ajusta la altura del textarea al contenido, sin límite de renglones
function autoajustarTextarea(ta){
  ta.style.height = "auto";
  ta.style.height = ta.scrollHeight + "px";
}

// Ajusta todos los textarea de notas visibles de una vez (al abrir sección o filtrar)
function autoajustarTodasLasNotas(){
  document.querySelectorAll(".paso-nota-input").forEach(ta=>{
    autoajustarTextarea(ta);
  });
}
async function guardarNotaPedido(clienteId, campo, valor){
  allClientes = await loadClientesFS();
  const idx = allClientes.findIndex(x=>x.id===clienteId);
  if(idx<0) return;
  if(!allClientes[idx].progreso) allClientes[idx].progreso={};
  if(!allClientes[idx].progreso.pedido) allClientes[idx].progreso.pedido={};
  allClientes[idx].progreso.pedido[campo] = valor;
  await saveUnCliente(allClientes[idx]);
}

// Botón independiente para borrar la hora de un ajuste — algunos navegadores de escritorio
// no muestran una "X" nativa en el input type="time" una vez que ya tiene valor, así que
// este botón limpia el campo en pantalla y guarda el valor vacío igual que guardarNotaPedido().
async function borrarHoraPrueba(clienteId, pasoId){
  const input = document.getElementById(`hora-${clienteId}-${pasoId}`);
  if(input) input.value = "";
  await guardarNotaPedido(clienteId, pasoId+"_horaPrueba", "");
  toast("Hora borrada ✓");
}

// ══ AGENDA SEMANAL DE AJUSTES ══
let _agendaOffset = 0; // 0 = semana actual, +1 siguiente, -1 anterior

function lunesDeSemana(fecha){
  const d = new Date(fecha);
  const dia = d.getDay(); // 0=Dom,1=Lun,...6=Sáb
  const diff = dia===0 ? -6 : 1-dia;
  d.setDate(d.getDate()+diff);
  d.setHours(0,0,0,0);
  return d;
}

function formatHora12(hhmm){
  if(!hhmm) return "";
  const [h,m] = hhmm.split(":").map(Number);
  const ampm = h>=12 ? "PM" : "AM";
  let h12 = h%12; if(h12===0) h12=12;
  return `${h12}:${String(m).padStart(2,"0")} ${ampm}`;
}

function fechaISO(d){
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}

function moverSemanaAgenda(delta){
  _agendaOffset += delta;
  renderAgendaAjustes();
}

function irHoyAgenda(){
  _agendaOffset = 0;
  renderAgendaAjustes();
}

function renderAgendaAjustes(){
  const grid = document.getElementById("agenda-grid");
  const label = document.getElementById("agenda-rango-label");
  if(!grid) return;

  const hoy = new Date();
  const base = lunesDeSemana(hoy);
  base.setDate(base.getDate() + (_agendaOffset*7));

  const diasNombre = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
  const dias = [];
  for(let i=0;i<7;i++){
    const d = new Date(base);
    d.setDate(base.getDate()+i);
    dias.push(d);
  }

  if(label){
    const ini = dias[0].toLocaleDateString("es-MX",{day:"numeric",month:"short"});
    const fin = dias[6].toLocaleDateString("es-MX",{day:"numeric",month:"short",year:"numeric"});
    label.textContent = `${ini} – ${fin}`;
  }

  const hoyISO = fechaISO(hoy);

  grid.innerHTML = dias.map((d,i)=>{
    const iso = fechaISO(d);
    const citas = [];
    allClientes.forEach(c=>{
      const prog = c.progreso?.pedido || {};
      PASOS_PEDIDO.forEach(p=>{
        const fPrueba = prog[p.id+"_fechaPrueba"] || "";
        const hPrueba = prog[p.id+"_horaPrueba"] || "";
        if(fPrueba === iso) citas.push({cliente:c, paso:p, hora:hPrueba});
      });
    });
    citas.sort((a,b)=>{
      if(a.hora && b.hora) return a.hora.localeCompare(b.hora);
      if(a.hora) return -1;
      if(b.hora) return 1;
      return 0;
    });
    const cuerpo = citas.length
      ? citas.map(ct=>`<div class="agenda-entry" onclick="irAClienteProceso('${ct.cliente.id}')">
          <div class="agenda-entry-paso">${ct.paso.label}</div>
          <div class="agenda-entry-nombre">${ct.hora?formatHora12(ct.hora)+" · ":""}${ct.cliente.nombre}</div>
        </div>`).join("")
      : '<div class="agenda-empty">Sin citas</div>';
    return `<div class="agenda-day ${iso===hoyISO?"hoy":""}">
      <div class="agenda-day-head">
        <div class="agenda-day-nombre">${diasNombre[i]}</div>
        <div class="agenda-day-fecha">${d.getDate()}/${d.getMonth()+1}</div>
      </div>
      <div class="agenda-day-body">${cuerpo}</div>
    </div>`;
  }).join("");
}

function irAClienteProceso(clienteId){
  goSec("progreso-pedido");
  setTimeout(()=>{
    const el = document.getElementById("pcard-"+clienteId);
    if(el){
      el.scrollIntoView({behavior:"smooth", block:"center"});
      el.style.transition = "box-shadow .3s";
      el.style.boxShadow = "0 0 0 2px var(--dorado)";
      setTimeout(()=>{el.style.boxShadow="";},1800);
    }
  },150);
}

// ══ LISTA "FORMATO DE AJUSTES" (submenú Progreso) ══
async function renderFormatoAjustesLista(){
  const lista = document.getElementById("formato-ajustes-lista");
  if(!lista) return;
  lista.innerHTML = '<p style="color:#AAA;font-size:.82rem;padding:.5rem">Actualizando datos...</p>';
  try{
    allClientes = await loadClientesFS();
  }catch(e){
    toast("No se pudo actualizar, mostrando últimos datos","err");
  }
  if(!allClientes.length){
    lista.innerHTML='<p style="color:#AAA;font-size:.82rem;padding:.5rem">Sin clientes.</p>';
    return;
  }
  lista.innerHTML = allClientes.map(c => buildFormatoAjustesRow(c)).join("");
}

function filtrarFormatoAjustes(q){
  const lista = document.getElementById("formato-ajustes-lista");
  if(!lista) return;
  const txt = q.toLowerCase();
  const filtrados = allClientes.filter(c =>
    c.nombre.toLowerCase().includes(txt) || (c.folio||"").includes(txt)
  );
  if(!filtrados.length){
    lista.innerHTML='<p style="color:#AAA;font-size:.82rem;padding:.5rem">Sin resultados.</p>';
    return;
  }
  lista.innerHTML = filtrados.map(c => buildFormatoAjustesRow(c)).join("");
}

function buildFormatoAjustesRow(c){
  return `<div class="proceso-card" style="display:flex;align-items:center;justify-content:space-between;gap:.6rem">
    <div>
      <div class="proceso-nombre">${c.nombre}</div>
      <div class="proceso-meta">Folio ${c.folio||"—"} · ${c.tipo==="xv"?"Quinceañera":"Novia"} · ${c.modelo||"—"}</div>
    </div>
    <button class="paso-btn" onclick="abrirFormatoAjuste('${c.id}')">🖨️ Ver / Imprimir</button>
  </div>`;
}

// ══ FORMATO DE AJUSTE IMPRIMIBLE (4 cuadrantes) ══
async function abrirFormatoAjuste(id){
  let c = allClientes.find(x=>x.id===id);
  try{
    allClientes = await loadClientesFS();
    c = allClientes.find(x=>x.id===id) || c;
  }catch(e){
    toast("No se pudo actualizar, mostrando últimos datos","err");
  }
  if(!c) return;
  generarFormatoAjuste(c);
  document.getElementById("modal-ajustes").classList.add("open");
  document.getElementById("modal-ajustes").scrollTop=0;
}
function closeFormatoAjuste(){document.getElementById("modal-ajustes").classList.remove("open");}
function imprimirAjuste(){window.print();}

function generarFormatoAjuste(c){
  const prog = c.progreso?.pedido || {};
  const tipos = {"xv":"Quinceañera","novia":"Novia"};
  const colorBox = c.color?.hex ? `<span style="display:inline-block;width:11px;height:11px;background:${c.color.hex};border:1px solid #CCC;border-radius:2px;vertical-align:middle;margin-right:4px"></span>` : "";
  const fmtFecha = v => v ? new Date(v+"T12:00:00").toLocaleDateString("es-MX",{day:"2-digit",month:"2-digit",year:"2-digit"}) : "&nbsp;";

  const filasPruebas = PASOS_PEDIDO.map((p,i)=>{
    const no = i<3 ? (i+1)+"a" : "Entrega";
    const done = prog[p.id] ? "✓" : "&nbsp;";
    const horaPrueba = prog[p.id+"_horaPrueba"] || "&nbsp;";
    return `<tr>
      <td style="border:1px solid #999;padding:.3rem .4rem;text-align:center;font-weight:600">${no}</td>
      <td style="border:1px solid #999;padding:.3rem .4rem;text-align:center">${fmtFecha(prog[p.id+"_fechaPrueba"])}</td>
      <td style="border:1px solid #999;padding:.3rem .4rem;text-align:center;font-size:8pt">${horaPrueba}</td>
      <td style="border:1px solid #999;padding:.3rem .4rem;text-align:center">${done}</td>
      <td style="border:1px solid #999;padding:.3rem .4rem;text-align:center">${fmtFecha(prog[p.id+"_fechaTerminado"])}</td>
      <td style="border:1px solid #999;padding:.3rem .4rem;text-align:center">&nbsp;</td>
    </tr>`;
  }).join("");

  const medidasRows = [["Busto",c.medidas?.busto],["Cintura",c.medidas?.cintura],["Cadera",c.medidas?.cadera],["Copa",c.medidas?.copa],["Largo",c.medidas?.largo]]
    .map(([lab,val])=>`<tr><td style="border:1px solid #999;padding:.35rem .5rem;background:#FAFAFA;font-weight:600;width:45%">${lab}</td><td style="border:1px solid #999;padding:.35rem .5rem">${val||"&nbsp;"}</td></tr>`).join("");

  const medidasRows2 = c.vestido2 ? [["Busto",c.vestido2.medidas?.busto],["Cintura",c.vestido2.medidas?.cintura],["Cadera",c.vestido2.medidas?.cadera],["Copa",c.vestido2.medidas?.copa],["Largo",c.vestido2.medidas?.largo]]
    .map(([lab,val])=>`<tr><td style="border:1px solid #999;padding:.35rem .5rem;background:#FAFAFA;font-weight:600;width:45%">${lab}</td><td style="border:1px solid #999;padding:.35rem .5rem">${val||"&nbsp;"}</td></tr>`).join("") : "";

  const notas = PASOS_PEDIDO.map(p=>{
    const nota = prog[p.id+"_nota"]||"";
    return `<div style="border-bottom:1px dashed #CCC;padding:.35rem 0">
      <div style="font-weight:700;font-size:7.5pt;color:#7A4F2A;margin-bottom:.15rem">${p.label}</div>
      <div style="font-size:8.5pt;color:#333;min-height:12pt;white-space:pre-line;word-break:break-word">${nota||"&nbsp;"}</div>
    </div>`;
  }).join("");

  document.getElementById("ajustes-content").innerHTML = `
  <div style="font-family:Arial,sans-serif;color:#1a1a1a;line-height:1.35;max-width:720px;margin:0 auto;font-size:9pt;position:relative">

    <!-- MARCA DE AGUA -->
    <div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-20deg);opacity:.1;pointer-events:none;z-index:0">
      <img src="logo_contrato.png" style="width:420px;height:auto">
    </div>

    <div style="position:relative;z-index:1">

      <!-- ENCABEZADO -->
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1.5pt solid #C9A84C;padding-bottom:8pt;margin-bottom:8pt">
        <div>
          <div style="font-size:13pt;font-weight:700;color:#7A4F2A">ROSS DE LUNE</div>
          <div style="font-size:7pt;color:#999;letter-spacing:.05em;margin-bottom:3pt">NOVIAS Y QUINCEAÑERAS</div>
          <div style="font-size:11pt;font-weight:700">FORMATO DE AJUSTE</div>
        </div>
        <img src="logo_contrato.png" style="width:65pt;height:auto;flex-shrink:0">
      </div>

      <!-- DATOS DE LA PRENDA -->
      <table style="width:100%;border-collapse:collapse;font-size:8.5pt;margin-bottom:10pt">
        <tr>
          <td style="border:1px solid #999;padding:.3rem .5rem;background:#FAFAFA;font-weight:600;width:16%">Folio</td>
          <td style="border:1px solid #999;padding:.3rem .5rem;width:34%">${c.folio||"—"}</td>
          <td style="border:1px solid #999;padding:.3rem .5rem;background:#FAFAFA;font-weight:600;width:16%">Modelo</td>
          <td style="border:1px solid #999;padding:.3rem .5rem">${c.modelo||"—"}</td>
        </tr>
        <tr>
          <td style="border:1px solid #999;padding:.3rem .5rem;background:#FAFAFA;font-weight:600">Tipo de vestido</td>
          <td style="border:1px solid #999;padding:.3rem .5rem">${tipos[c.tipo]||"—"}</td>
          <td style="border:1px solid #999;padding:.3rem .5rem;background:#FAFAFA;font-weight:600">Color</td>
          <td style="border:1px solid #999;padding:.3rem .5rem">${colorBox}${c.color?.nombre||c.color?.hex||"—"}</td>
        </tr>
        <tr>
          <td style="border:1px solid #999;padding:.3rem .5rem;background:#FAFAFA;font-weight:600">Cliente</td>
          <td style="border:1px solid #999;padding:.3rem .5rem" colspan="3">${c.nombre||"—"}</td>
        </tr>
      </table>

      <!-- CUADRANTES SUPERIORES: MEDIDAS + PRUEBAS -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10pt;margin-bottom:8pt">
        <div>
          <div style="font-weight:700;font-size:7.5pt;letter-spacing:.08em;text-transform:uppercase;color:#7A4F2A;margin-bottom:4pt">${c.vestido2?"Medidas — Vestido 1":"Medidas"}</div>
          <table style="width:100%;border-collapse:collapse;font-size:8.5pt">${medidasRows}</table>
        </div>
        <div>
          <div style="font-weight:700;font-size:7.5pt;letter-spacing:.08em;text-transform:uppercase;color:#7A4F2A;margin-bottom:4pt">Pruebas</div>
          <table style="width:100%;border-collapse:collapse;font-size:8pt;text-align:center">
            <tr style="background:#FAFAFA">
              <td style="border:1px solid #999;padding:.25rem;font-weight:600">No.</td>
              <td style="border:1px solid #999;padding:.25rem;font-weight:600">Fecha</td>
              <td style="border:1px solid #999;padding:.25rem;font-weight:600">Hora</td>
              <td style="border:1px solid #999;padding:.25rem;font-weight:600">Terminado</td>
              <td style="border:1px solid #999;padding:.25rem;font-weight:600">Fecha</td>
              <td style="border:1px solid #999;padding:.25rem;font-weight:600">Hora</td>
            </tr>
            ${filasPruebas}
          </table>
        </div>
      </div>
      ${c.vestido2 ? `
      <div style="margin-bottom:8pt">
        <div style="font-weight:700;font-size:7.5pt;letter-spacing:.08em;text-transform:uppercase;color:#7A4F2A;margin-bottom:4pt">Medidas — Vestido 2</div>
        <table style="width:100%;border-collapse:collapse;font-size:8.5pt">${medidasRows2}</table>
      </div>` : ""}

      <!-- NOTAS POR AJUSTE (divididas) -->
      <div style="margin-bottom:10pt">
        <div style="font-weight:700;font-size:7.5pt;letter-spacing:.08em;text-transform:uppercase;color:#7A4F2A;margin-bottom:4pt">Anotaciones por ajuste</div>
        ${notas}
      </div>

      <!-- CUADRANTES INFERIORES: BOCETO + OBSERVACIONES -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10pt">
        <div>
          <div style="font-weight:700;font-size:7.5pt;letter-spacing:.08em;text-transform:uppercase;color:#7A4F2A;margin-bottom:4pt">Ajustes (boceto)</div>
          <div style="border:1px solid #999;min-height:150pt;padding:4pt;position:relative;display:flex;align-items:center;justify-content:center">
            <img src="boceto_figurin.jpg" style="max-width:100%;max-height:148pt;opacity:.55">
          </div>
        </div>
        <div>
          <div style="font-weight:700;font-size:7.5pt;letter-spacing:.08em;text-transform:uppercase;color:#7A4F2A;margin-bottom:4pt">Observaciones</div>
          <div style="border:1px solid #999;min-height:150pt;padding:6pt;font-size:8.5pt">${c.observaciones||"&nbsp;"}</div>
        </div>
      </div>

      <!-- FIRMAS -->
      <table style="width:100%;border-collapse:collapse;margin-top:20pt">
        <tr>
          <td style="width:45%;text-align:center;padding-top:30pt;border-top:1pt solid #1a1a1a">
            <div style="font-size:8pt">Nombre de cliente</div>
          </td>
          <td style="width:10%"></td>
          <td style="width:45%;text-align:center;padding-top:30pt;border-top:1pt solid #1a1a1a">
            <div style="font-size:8pt">Firma de conformidad de cliente</div>
          </td>
        </tr>
      </table>

    </div>
  </div>`;
}

// ══ PROCESO DISEÑO (Elaboración propia) ══
const PASOS_DISENO = [
  {id:"bocetaje",   label:"Diseño — Bocetaje y medidas"},
  {id:"insumos",    label:"Adquisición de insumos"},
  {id:"corte",      label:"Corte"},
  {id:"confeccion", label:"Confección"},
  {id:"bordado",    label:"Bordado / Decoración"},
  {id:"ajuste1",    label:"1er Ajuste"},
  {id:"ajuste2",    label:"2do Ajuste"},
  {id:"ajuste3",    label:"3er Ajuste"},
  {id:"entregado",  label:"Preparación y entrega"}
];

function renderDiseno(){
  const lista = document.getElementById("diseno-lista");
  if(!lista) return;
  const activos = allClientes.filter(c =>
    (c.elaboracion==="Sobre diseño"||c.elaboracion==="Sobre pedido") &&
    c.estatus !== "Entregado"
  );
  if(!activos.length){
    lista.innerHTML='<p style="color:#AAA;font-size:.82rem;padding:.5rem">Sin vestidos en proceso de diseño.</p>';
    return;
  }
  lista.innerHTML = activos.map(c => buildDisenoCard(c)).join("");
  setTimeout(autoajustarTodasLasNotas, 0);
}

function filtrarDiseno(q){
  const lista = document.getElementById("diseno-lista");
  if(!lista) return;
  const txt = q.toLowerCase();
  const filtrados = allClientes.filter(c =>
    (c.elaboracion==="Sobre diseño"||c.elaboracion==="Sobre pedido") &&
    c.estatus !== "Entregado" &&
    (c.nombre.toLowerCase().includes(txt)||(c.folio||"").includes(txt))
  );
  if(!filtrados.length){
    lista.innerHTML='<p style="color:#AAA;font-size:.82rem;padding:.5rem">Sin resultados.</p>';
    return;
  }
  lista.innerHTML = filtrados.map(c => buildDisenoCard(c)).join("");
}

function buildDisenoCard(c){
  const prog = c.progreso?.diseno || {};
  const entrega = c.entrega ? new Date(c.entrega+"T12:00:00").toLocaleDateString("es-MX") : "—";
  const fechaInicio = prog.fechaInicio||"";

  const pasos = PASOS_DISENO.map(p => {
    const done = !!prog[p.id];
    const nota = prog[p.id+"_nota"]||"";
    return `<div class="paso-row">
      <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.3rem">
        <button class="paso-btn ${done?"done":""}" onclick="togglePasoDiseno('${c.id}','${p.id}')">
          <span class="paso-check">${done?"✓":"○"}</span>${p.label}
        </button>
      </div>
      <textarea class="paso-nota-input" placeholder="Observaciones..." rows="4"
        oninput="autoajustarTextarea(this)"
        onblur="guardarNotaDiseno('${c.id}','${p.id+"_nota"}',this.value)">${nota}</textarea>
    </div>`;
  }).join("");

  // Tabla de suministros
  const sumi = prog.suministros||[{insumo:"",categoria:"",proveedor:"",estado:"",fechaRecepcion:""}];
  const sumiRows = sumi.map((s,i)=>`
    <tr>
      <td><input class="sumi-input" value="${s.insumo||""}" placeholder="Tela, hilo..." onblur="guardarSuministro('${c.id}',${i},'insumo',this.value)"></td>
      <td><input class="sumi-input" value="${s.categoria||""}" placeholder="Categoría" onblur="guardarSuministro('${c.id}',${i},'categoria',this.value)"></td>
      <td><input class="sumi-input" value="${s.proveedor||""}" placeholder="Proveedor" onblur="guardarSuministro('${c.id}',${i},'proveedor',this.value)"></td>
      <td>
        <select class="sumi-input" onblur="guardarSuministro('${c.id}',${i},'estado',this.value)" onchange="guardarSuministro('${c.id}',${i},'estado',this.value)">
          <option value="" ${!s.estado?"selected":""}>—</option>
          <option value="Pendiente" ${s.estado==="Pendiente"?"selected":""}>Pendiente</option>
          <option value="Solicitado" ${s.estado==="Solicitado"?"selected":""}>Solicitado</option>
          <option value="Recibido" ${s.estado==="Recibido"?"selected":""}>Recibido</option>
        </select>
      </td>
      <td><input class="sumi-input" type="date" value="${s.fechaRecepcion||""}" onblur="guardarSuministro('${c.id}',${i},'fechaRecepcion',this.value)"></td>
      <td><button class="btn-del-row" onclick="eliminarSuministro('${c.id}',${i})">✕</button></td>
    </tr>`).join("");

  return `<div class="proceso-card" id="dcard-${c.id}">
    <div class="proceso-card-header">
      <div>
        <div class="proceso-nombre">${c.nombre}</div>
        <div class="proceso-meta">Folio ${c.folio||"—"} · ${c.elaboracion} · ${c.modelo||"—"}</div>
      </div>
      <span class="status-badge ${c.estatus==="Entregado"?"s-entregado":c.estatus==="Recibido"?"s-recibido":"s-pedido"}">${c.estatus||"—"}</span>
    </div>

    <!-- Fechas -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin:.6rem 0;font-size:.78rem">
      <div>
        <div style="font-size:.66rem;color:#AAA;text-transform:uppercase;letter-spacing:.08em;margin-bottom:.2rem">Fecha inicio elaboración</div>
        <input type="date" class="sumi-input" style="width:100%" value="${fechaInicio}"
          onblur="guardarNotaDiseno('${c.id}','fechaInicio',this.value)">
      </div>
      <div>
        <div style="font-size:.66rem;color:#AAA;text-transform:uppercase;letter-spacing:.08em;margin-bottom:.2rem">Fecha de entrega</div>
        <div style="padding:.3rem 0;font-weight:600;color:var(--dorado-d)">${entrega}</div>
      </div>
    </div>

    <!-- Etapas -->
    <div style="border-top:1px solid #F0E8D8;padding-top:.7rem;margin-bottom:.7rem">
      <div style="font-size:.66rem;color:var(--dorado-d);text-transform:uppercase;letter-spacing:.1em;margin-bottom:.5rem">Etapas de elaboración</div>
      ${pasos}
    </div>

    <!-- Suministros -->
    <div style="border-top:1px solid #F0E8D8;padding-top:.7rem">
      <div style="font-size:.66rem;color:var(--dorado-d);text-transform:uppercase;letter-spacing:.1em;margin-bottom:.4rem">Suministros</div>
      <div style="overflow-x:auto">
        <table class="sumi-tabla">
          <thead><tr>
            <th>Insumo</th><th>Categoría</th><th>Proveedor</th><th>Estado</th><th>Fecha recepción</th><th></th>
          </tr></thead>
          <tbody id="sumi-tbody-${c.id}">${sumiRows}</tbody>
        </table>
      </div>
      <button class="btn-add-row" onclick="agregarSuministro('${c.id}')">+ Agregar insumo</button>
    </div>
  </div>`;
}

async function togglePasoDiseno(clienteId, pasoId){
  const c = allClientes.find(x=>x.id===clienteId);
  if(!c) return;
  if(!c.progreso) c.progreso={};
  if(!c.progreso.diseno) c.progreso.diseno={};
  c.progreso.diseno[pasoId] = !c.progreso.diseno[pasoId];
  if(pasoId==="entregado" && c.progreso.diseno[pasoId]) c.estatus="Entregado";
  try{
    allClientes = await loadClientesFS();
    const idx = allClientes.findIndex(x=>x.id===clienteId);
    if(idx>-1){
      allClientes[idx].progreso = c.progreso;
      if(pasoId==="entregado" && c.progreso.diseno[pasoId]) allClientes[idx].estatus="Entregado";
    }
    await saveUnCliente(allClientes[idx]);
    renderDiseno();
  }catch(e){console.error(e);toast("Error al guardar","err");}
}

async function guardarNotaDiseno(clienteId, campo, valor){
  try{
    allClientes = await loadClientesFS();
    const idx = allClientes.findIndex(x=>x.id===clienteId);
    if(idx<0) return;
    if(!allClientes[idx].progreso) allClientes[idx].progreso={};
    if(!allClientes[idx].progreso.diseno) allClientes[idx].progreso.diseno={};
    allClientes[idx].progreso.diseno[campo] = valor;
    await saveUnCliente(allClientes[idx]);
  }catch(e){console.error(e);toast("Error al guardar","err");}
}

async function guardarSuministro(clienteId, idx_sumi, campo, valor){
  try{
    allClientes = await loadClientesFS();
    const idx = allClientes.findIndex(x=>x.id===clienteId);
    if(idx<0) return;
    if(!allClientes[idx].progreso) allClientes[idx].progreso={};
    if(!allClientes[idx].progreso.diseno) allClientes[idx].progreso.diseno={};
    if(!allClientes[idx].progreso.diseno.suministros) allClientes[idx].progreso.diseno.suministros=[];
    if(!allClientes[idx].progreso.diseno.suministros[idx_sumi]) allClientes[idx].progreso.diseno.suministros[idx_sumi]={};
    allClientes[idx].progreso.diseno.suministros[idx_sumi][campo] = valor;
    await saveUnCliente(allClientes[idx]);
  }catch(e){console.error(e);toast("Error al guardar","err");}
}

async function agregarSuministro(clienteId){
  try{
    allClientes = await loadClientesFS();
    const idx = allClientes.findIndex(x=>x.id===clienteId);
    if(idx<0) return;
    if(!allClientes[idx].progreso) allClientes[idx].progreso={};
    if(!allClientes[idx].progreso.diseno) allClientes[idx].progreso.diseno={};
    if(!allClientes[idx].progreso.diseno.suministros) allClientes[idx].progreso.diseno.suministros=[];
    allClientes[idx].progreso.diseno.suministros.push({insumo:"",categoria:"",proveedor:"",estado:"",fechaRecepcion:""});
    await saveUnCliente(allClientes[idx]);
    renderDiseno();
  }catch(e){console.error(e);toast("Error al guardar","err");}
}

async function eliminarSuministro(clienteId, idx_sumi){
  try{
    allClientes = await loadClientesFS();
    const idx = allClientes.findIndex(x=>x.id===clienteId);
    if(idx<0) return;
    allClientes[idx].progreso.diseno.suministros.splice(idx_sumi,1);
    await saveUnCliente(allClientes[idx]);
    renderDiseno();
  }catch(e){console.error(e);toast("Error al guardar","err");}
}