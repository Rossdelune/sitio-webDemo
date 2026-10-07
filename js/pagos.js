// ══ PAGOS ══
function renderPagosPendientes(){
  const tbody = document.getElementById("tbody-pendientes");
  if(!tbody) return;
  if(!allClientes.length){
    tbody.innerHTML='<tr><td colspan="8" style="color:#AAA;padding:1.5rem;text-align:center">Sin clientes registrados.</td></tr>';
    return;
  }
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  let sumaTotal=0, sumaPagado=0, sumaSaldo=0;
  const pendientes = allClientes.filter(c=>c.estatus!=="Entregado" && !c.esNotaSencilla).map(c=>{
    const precio = Number(c.precio||0);
    const paquete = Number(c.precioPaquete||0);
    const extras = (c.paquete?.adicionales||[]).reduce((s,a)=>s+Number(a.precio||0),0);
    const total = precio+paquete+extras;
    const pagado = Number(c.anticipo||0) + (c.pagos||[]).reduce((s,p)=>s+Number(p.monto||0),0);
    const saldo = total - pagado;
    const interes = c.interes==="si" ? total*0.1 : 0;
    const saldoFinal = saldo + interes;
    sumaTotal += total;
    sumaPagado += pagado;
    sumaSaldo += saldoFinal>0 ? saldoFinal : 0;
    if(saldoFinal<=0) return null; // ya liquidado — no debe aparecer en pendientes

    // Estado de vencimiento
    let estadoHTML = '';
    if(c.fechaLimite){
      const vence = new Date(c.fechaLimite+"T12:00:00");
      const diasDiff = Math.ceil((vence-hoy)/(1000*60*60*24));
      if(saldoFinal<=0){
        estadoHTML = '<span class="status-badge alerta-ok">Liquidado</span>';
      } else if(diasDiff<0){
        estadoHTML = '<span class="status-badge alerta-vencido">Vencido '+Math.abs(diasDiff)+' días</span>';
      } else if(diasDiff<=7){
        estadoHTML = '<span class="status-badge alerta-vence">Vence en '+diasDiff+' días</span>';
      } else {
        estadoHTML = '<span class="status-badge alerta-ok">Al corriente</span>';
      }
    } else {
      estadoHTML = '<span class="status-badge s-pedido">Sin fecha</span>';
    }

    return {c, total, pagado, saldoFinal, estadoHTML};
  }).filter(Boolean);

  // filtro de búsqueda (folio o nombre) — no afecta el resumen de arriba
  const q = normTexto((document.getElementById("buscar-pendiente")?.value||"").trim());
  const visibles = q ? pendientes.filter(r=>normTexto(r.c.nombre).includes(q) || normTexto(r.c.folio).includes(q)) : pendientes;

  const rows = visibles.map(r=>{
    const {c, total, pagado, saldoFinal, estadoHTML} = r;
    return `<tr>
      <td style="font-size:.72rem;color:#AAA">${c.folio||"—"}</td>
      <td><strong style="font-weight:400;font-size:.8rem">${c.nombre}</strong></td>
      <td style="font-size:.76rem">$${total.toLocaleString("es-MX")}</td>
      <td style="font-size:.76rem;color:var(--verde)">$${pagado.toLocaleString("es-MX")}</td>
      <td style="font-size:.76rem;color:var(--rojo);font-weight:${saldoFinal>0?'500':'400'}">$${saldoFinal.toLocaleString("es-MX")}</td>
      <td style="font-size:.74rem">${c.fechaLimite?new Date(c.fechaLimite+"T12:00:00").toLocaleDateString("es-MX"):"—"}</td>
      <td>${estadoHTML}</td>
      <td><button class="ic-btn" onclick="abrirAbonoModal('${c.id}')" title="Registrar abono">➕</button><button class="ic-btn" onclick="abrirAbonoModal('${c.id}')" title="Ver historial de abonos">📝</button></td>
    </tr>`;
  });
  if(rows.length){
    tbody.innerHTML = rows.join("");
  } else if(q){
    tbody.innerHTML = '<tr><td colspan="8" style="color:#AAA;padding:1.5rem;text-align:center">No se encontraron pendientes con esa búsqueda.</td></tr>';
  } else {
    tbody.innerHTML = '<tr><td colspan="8" style="color:#AAA;padding:1.5rem;text-align:center">Todos los pedidos están liquidados 🎀</td></tr>';
  }

  // contador de resultados
  const cEl = document.getElementById("buscar-pendiente-count");
  if(cEl) cEl.textContent = q ? `${visibles.length} de ${pendientes.length} pendientes` : "";

  // Resumen arriba — SIEMPRE sobre el total de pendientes, sin importar la búsqueda
  const resumen = document.getElementById("resumen-pendientes");
  if(resumen){
    resumen.innerHTML = `
      <div class="card" style="padding:.7rem .9rem;text-align:center">
        <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.1em;color:#AAA;margin-bottom:.3rem">Total facturado</div>
        <div style="font-size:1.1rem;font-weight:700;color:var(--cafe)">$${sumaTotal.toLocaleString("es-MX")}</div>
      </div>
      <div class="card" style="padding:.7rem .9rem;text-align:center">
        <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.1em;color:#AAA;margin-bottom:.3rem">Total cobrado</div>
        <div style="font-size:1.1rem;font-weight:700;color:var(--verde)">$${sumaPagado.toLocaleString("es-MX")}</div>
      </div>
      <div class="card" style="padding:.7rem .9rem;text-align:center">
        <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.1em;color:#AAA;margin-bottom:.3rem">Saldo pendiente</div>
        <div style="font-size:1.1rem;font-weight:700;color:var(--rojo)">$${sumaSaldo.toLocaleString("es-MX")}</div>
      </div>`;
  }
}
function filtrarPendientes(){
  const inp=document.getElementById("buscar-pendiente");
  document.getElementById("buscar-pendiente-clear").style.display=inp.value.trim()?"block":"none";
  renderPagosPendientes();
}
function limpiarBuscarPendiente(){
  const inp=document.getElementById("buscar-pendiente");
  inp.value="";
  document.getElementById("buscar-pendiente-clear").style.display="none";
  renderPagosPendientes();
  inp.focus();
}

function renderHistorialPagos(){
  const tbody = document.getElementById("tbody-historial-pagos");
  if(!tbody) return;
  tbody.innerHTML = allClientes.map(c=>{
    const precio = Number(c.precio||0);
    const paquete = Number(c.precioPaquete||0);
    const extras = (c.paquete?.adicionales||[]).reduce((s,a)=>s+Number(a.precio||0),0);
    const total = totalConDescuentoCliente(c);
    const anticipo = Number(c.anticipo||0);
    const abonos = (c.pagos||[]).reduce((s,p)=>s+Number(p.monto||0),0);
    const pagado = anticipo+abonos;
    const interes = c.interes==="si" ? total*0.1 : 0;
    const saldo = total+interes-pagado;
    return `<tr>
      <td style="font-size:.72rem;color:#AAA">${c.folio||"—"}</td>
      <td style="font-size:.8rem">${c.nombre}</td>
      <td style="font-size:.76rem">$${total.toLocaleString("es-MX")}</td>
      <td style="font-size:.76rem;color:var(--verde)">$${anticipo.toLocaleString("es-MX")}</td>
      <td style="font-size:.76rem;color:var(--verde)">$${abonos.toLocaleString("es-MX")}</td>
      <td style="font-size:.76rem;color:${saldo>0?"var(--rojo)":"var(--verde)"}">$${saldo.toLocaleString("es-MX")}</td>
      <td style="font-size:.74rem">${interes>0?'<span class="status-badge alerta-interes">+$'+interes.toLocaleString("es-MX")+'</span>':"—"}</td>
      <td><span class="status-badge ${c.estatus==="Entregado"?"s-entregado":c.estatus==="Recibido"?"s-recibido":"s-pedido"}">${c.estatus||"—"}</span></td>
    </tr>`;
  }).join("");
}

// ══ CORTE DE CAJA ══
function renderCorteCaja(){
  const fecha = document.getElementById("corte-fecha").value;
  if(!fecha) return;

  const resumenEl   = document.getElementById("corte-resumen");
  const anticWrap   = document.getElementById("corte-anticipos-wrap");
  const abonoWrap   = document.getElementById("corte-abonos-wrap");
  const tbodyAntic  = document.getElementById("corte-tbody-anticipos");
  const tbodyAbono  = document.getElementById("corte-tbody-abonos");
  const emptyEl     = document.getElementById("corte-empty");

  // Anticipos del día
  const anticiposHoy = [];
  allClientes.forEach(c=>{
    const fa = c.fechaAnticipo || c.fecha;
    if(fa === fecha && Number(c.anticipo||0) > 0){
      anticiposHoy.push({
        folio: c.folio||"—",
        nombre: c.nombre,
        metodo: c.fpago||"—",
        cuenta: nombreCuenta(c.cuentaAnticipoId),
        ref: c.refAnticipo||"—",
        monto: Number(c.anticipo||0),
        registradoPor: c.creadoPor||"—"
      });
    }
  });

  // Abonos del día
  const abonosHoy = [];
  allClientes.forEach(c=>{
    (c.pagos||[]).forEach(p=>{
      if(p.fecha === fecha && Number(p.monto||0) > 0){
        abonosHoy.push({
          folio: c.folio||"—",
          nombre: c.nombre,
          metodo: p.metodo||"—",
          cuenta: nombreCuenta(p.cuentaId),
          ref: p.ref||"—",
          monto: Number(p.monto||0),
          registradoPor: p.registradoPor||"—"
        });
      }
    });
  });

  const totalAntic = anticiposHoy.reduce((s,x)=>s+x.monto,0);
  const totalAbon  = abonosHoy.reduce((s,x)=>s+x.monto,0);
  const totalDia   = totalAntic + totalAbon;

  // Desglose por método (anticipos + abonos juntos)
  const porMetodo = {};
  [...anticiposHoy, ...abonosHoy].forEach(x=>{
    const m = x.metodo||"—";
    porMetodo[m] = (porMetodo[m]||0) + x.monto;
  });
  const metodosHTML = Object.entries(porMetodo).map(([m,v])=>
    `<div style="font-size:.72rem;color:#888;margin-top:.2rem">${m}: <strong>$${v.toLocaleString("es-MX")}</strong></div>`
  ).join("");

  // Cards de resumen
  const fechaLabel = new Date(fecha+"T12:00:00").toLocaleDateString("es-MX",{weekday:"long",day:"2-digit",month:"long",year:"numeric"});
  resumenEl.innerHTML = `
    <div class="card" style="padding:.7rem .9rem;text-align:center;grid-column:1/-1">
      <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.1em;color:#AAA;margin-bottom:.2rem">Corte del día</div>
      <div style="font-size:.78rem;color:var(--dorado-d);margin-bottom:.4rem">${fechaLabel}</div>
      <div style="font-size:1.3rem;font-weight:700;color:var(--cafe)">$${totalDia.toLocaleString("es-MX")}</div>
      ${metodosHTML}
    </div>
    <div class="card" style="padding:.7rem .9rem;text-align:center">
      <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.1em;color:#AAA;margin-bottom:.3rem">Anticipos</div>
      <div style="font-size:1rem;font-weight:700;color:var(--verde)">$${totalAntic.toLocaleString("es-MX")}</div>
      <div style="font-size:.7rem;color:#AAA">${anticiposHoy.length} movimiento(s)</div>
    </div>
    <div class="card" style="padding:.7rem .9rem;text-align:center">
      <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.1em;color:#AAA;margin-bottom:.3rem">Abonos</div>
      <div style="font-size:1rem;font-weight:700;color:var(--verde)">$${totalAbon.toLocaleString("es-MX")}</div>
      <div style="font-size:.7rem;color:#AAA">${abonosHoy.length} movimiento(s)</div>
    </div>`;

  // Tabla anticipos
  if(anticiposHoy.length){
    tbodyAntic.innerHTML = anticiposHoy.map(x=>`<tr>
      <td style="font-size:.72rem;color:#AAA">${x.folio}</td>
      <td style="font-size:.8rem">${x.nombre}</td>
      <td style="font-size:.76rem">${x.metodo}</td>
      <td style="font-size:.72rem;color:#AAA">${x.cuenta}</td>
      <td style="font-size:.72rem;color:#AAA">${x.ref}</td>
      <td style="font-size:.76rem;color:var(--verde);font-weight:600">$${x.monto.toLocaleString("es-MX")}</td>
      <td style="font-size:.72rem;color:#AAA">${x.registradoPor}</td>
    </tr>`).join("");
    anticWrap.style.display="block";
  } else {
    anticWrap.style.display="none";
  }

  // Tabla abonos
  if(abonosHoy.length){
    tbodyAbono.innerHTML = abonosHoy.map(x=>`<tr>
      <td style="font-size:.72rem;color:#AAA">${x.folio}</td>
      <td style="font-size:.8rem">${x.nombre}</td>
      <td style="font-size:.76rem">${x.metodo}</td>
      <td style="font-size:.72rem;color:#AAA">${x.cuenta}</td>
      <td style="font-size:.72rem;color:#AAA">${x.ref}</td>
      <td style="font-size:.76rem;color:var(--verde);font-weight:600">$${x.monto.toLocaleString("es-MX")}</td>
      <td style="font-size:.72rem;color:#AAA">${x.registradoPor}</td>
    </tr>`).join("");
    abonoWrap.style.display="block";
  } else {
    abonoWrap.style.display="none";
  }

  emptyEl.style.display = (totalDia===0) ? "block" : "none";
}

// ══ MODAL ABONO ══
let abonoClienteId = null;
let editandoAbonoIndex = null; // null = registrando abono nuevo; número = editando c.pagos[i]
function abrirAbonoModal(id){
  const c = allClientes.find(x=>x.id===id);
  if(!c) return;
  abonoClienteId = id;
  editandoAbonoIndex = null;
  document.getElementById("abono-edit-aviso").style.display = "none";
  document.getElementById("btn-guardar-abono").textContent = "Registrar abono";
  const precio = Number(c.precio||0);
  const paquete = Number(c.precioPaquete||0);
  const extras = (c.paquete?.adicionales||[]).reduce((s,a)=>s+Number(a.precio||0),0);
  const total = totalConDescuentoCliente(c);
  const pagado = Number(c.anticipo||0)+(c.pagos||[]).reduce((s,p)=>s+Number(p.monto||0),0);
  const interes = c.interes==="si" ? total*0.1 : 0;
  const saldo = total+interes-pagado;
  document.getElementById("abono-cliente-nombre").textContent = c.nombre;
  document.getElementById("abono-total").textContent = "$"+(total+interes).toLocaleString("es-MX");
  document.getElementById("abono-pagado").textContent = "$"+pagado.toLocaleString("es-MX");
  document.getElementById("abono-saldo").textContent = "$"+saldo.toLocaleString("es-MX");
  document.getElementById("abono-monto").value = "";
  document.getElementById("abono-fecha").value = fechaLocalISO();
  document.getElementById("abono-ref").value = "";
  document.getElementById("abono-msg").textContent = "";
  document.getElementById("abono-proroga").checked = !!c.proroga;
  document.getElementById("abono-proroga-dias").value = c.prorogaDias||"";
  document.getElementById("fi-abono-proroga-dias").style.display = c.proroga?"block":"none";
  document.getElementById("abono-interes").value = c.interes||"no";
  renderHistorialAbonoModal(c);
  document.getElementById("modal-abono").classList.add("open");
}
function renderHistorialAbonoModal(c){
  const wrap = document.getElementById("abono-historial-lista");
  if(!wrap) return;
  const movs = [];
  if(Number(c.anticipo||0) > 0){
    movs.push({
      tipo:"anticipo",
      label:"Anticipo", monto:Number(c.anticipo),
      fecha:c.fechaAnticipo||c.fecha||null,
      metodo:c.fpago||null, ref:null, por:c.creadoPor||null
    });
  }
  (c.pagos||[]).forEach((p,i)=>{
    movs.push({
      tipo:"abono", idx:i,
      label:"Abono "+(i+1), monto:Number(p.monto||0),
      fecha:p.fecha||null, metodo:p.metodo||null,
      ref:p.ref||null, por:p.registradoPor||null
    });
  });
  if(!movs.length){
    wrap.innerHTML = '<div style="font-size:.76rem;color:#AAA;text-align:center;padding:.5rem 0">Sin abonos registrados</div>';
    return;
  }
  wrap.innerHTML = movs.map(m=>{
    const fechaTxt = m.fecha ? new Date(m.fecha+"T12:00:00").toLocaleDateString("es-MX") : "—";
    const detalle = [m.metodo, m.ref].filter(Boolean).join(" · ");
    const porTxt = m.por ? " · Reg. "+m.por : "";
    // El anticipo no lleva botones aquí — se edita solo desde "Editar cliente".
    const acciones = m.tipo==="abono"
      ? '<div style="display:flex;gap:.3rem;margin-left:.5rem">'
        + '<button type="button" onclick="iniciarEdicionAbono('+m.idx+')" title="Editar abono" style="background:none;border:none;cursor:pointer;font-size:.82rem;padding:.1rem .15rem;line-height:1">✏️</button>'
        + '<button type="button" onclick="eliminarAbono('+m.idx+')" title="Eliminar abono" style="background:none;border:none;cursor:pointer;font-size:.82rem;padding:.1rem .15rem;line-height:1">🗑️</button>'
        + '</div>'
      : '';
    return '<div style="display:flex;justify-content:space-between;align-items:center;background:#F9F5EF;border-radius:6px;padding:.5rem .6rem">'
      + '<div>'
      + '<div style="font-size:.76rem;color:var(--texto)">'+m.label+'</div>'
      + '<div style="font-size:.66rem;color:#AAA">'+fechaTxt+(detalle?" · "+detalle:"")+porTxt+'</div>'
      + '</div>'
      + '<div style="display:flex;align-items:center">'
      + '<div style="font-size:.78rem;font-weight:500;color:var(--verde)">$'+m.monto.toLocaleString("es-MX")+'</div>'
      + acciones
      + '</div>'
      + '</div>';
  }).join("");
}
// Precarga el formulario con los datos de un abono existente para editarlo
function iniciarEdicionAbono(i){
  const c = allClientes.find(x=>x.id===abonoClienteId);
  if(!c || !c.pagos || !c.pagos[i]) return;
  const p = c.pagos[i];
  editandoAbonoIndex = i;
  document.getElementById("abono-monto").value = p.monto||"";
  document.getElementById("abono-fecha").value = p.fecha||"";
  document.getElementById("abono-metodo").value = p.metodo||"Efectivo";
  toggleAbonoCuenta();
  if(p.metodo==="Transferencia") document.getElementById("abono-cuenta").value = p.cuentaId||"";
  document.getElementById("abono-ref").value = p.ref||"";
  document.getElementById("abono-msg").textContent = "";
  document.getElementById("abono-edit-label").textContent = "Abono "+(i+1);
  document.getElementById("abono-edit-aviso").style.display = "flex";
  document.getElementById("btn-guardar-abono").textContent = "💾 Guardar cambios del abono";
  document.getElementById("abono-monto").scrollIntoView({behavior:"smooth", block:"center"});
}
function cancelarEdicionAbono(){
  editandoAbonoIndex = null;
  document.getElementById("abono-monto").value = "";
  document.getElementById("abono-fecha").value = fechaLocalISO();
  document.getElementById("abono-metodo").value = "Efectivo";
  toggleAbonoCuenta();
  document.getElementById("abono-ref").value = "";
  document.getElementById("abono-msg").textContent = "";
  document.getElementById("abono-edit-aviso").style.display = "none";
  document.getElementById("btn-guardar-abono").textContent = "Registrar abono";
}
function toggleAbonoProroga(){
  const chk = document.getElementById("abono-proroga").checked;
  document.getElementById("fi-abono-proroga-dias").style.display = chk?"block":"none";
}
function closeAbonoModal(){
  document.getElementById("modal-abono").classList.remove("open");
  document.getElementById("abono-cuenta").innerHTML="";
  document.getElementById("fi-abono-cuenta").style.display="none";
  document.getElementById("abono-metodo").value="Efectivo";
  editandoAbonoIndex = null;
  document.getElementById("abono-edit-aviso").style.display = "none";
  document.getElementById("btn-guardar-abono").textContent = "Registrar abono";
}
function toggleAbonoCuenta(){
  const metodo = document.getElementById("abono-metodo").value;
  const mostrar = metodo==="Transferencia";
  document.getElementById("fi-abono-cuenta").style.display = mostrar ? "block" : "none";
  if(mostrar) poblarSelectCuentaTransferencia("abono-cuenta");
  else document.getElementById("abono-cuenta").innerHTML="";
}
function toggleCuentaAnticipo(){
  const metodo = document.getElementById("c-fpago").value;
  const mostrar = metodo==="Transferencia";
  document.getElementById("fi-cuenta-anticipo").style.display = mostrar ? "block" : "none";
  document.getElementById("fi-ref-anticipo").style.display = mostrar ? "block" : "none";
  if(mostrar) poblarSelectCuentaTransferencia("c-cuenta-anticipo");
  else { document.getElementById("c-cuenta-anticipo").innerHTML=""; document.getElementById("c-ref-anticipo").value=""; }
}
function toggleEditCuentaAnticipo(){
  const metodo = document.getElementById("edit-fpago").value.trim().toLowerCase();
  const mostrar = metodo==="transferencia";
  document.getElementById("fi-edit-cuenta-anticipo").style.display = mostrar ? "block" : "none";
  document.getElementById("fi-edit-ref-anticipo").style.display = mostrar ? "block" : "none";
  if(mostrar) poblarSelectCuentaTransferencia("edit-cuenta-anticipo");
  else { document.getElementById("edit-cuenta-anticipo").innerHTML=""; document.getElementById("edit-ref-anticipo").value=""; }
}

async function guardarAbono(){
  const monto = parseFloat(document.getElementById("abono-monto").value);
  const fecha = document.getElementById("abono-fecha").value;
  const metodo = document.getElementById("abono-metodo").value;
  const cuentaSeleccionada = document.getElementById("abono-cuenta").value;
  const ref = document.getElementById("abono-ref").value.trim();
  const proroga = document.getElementById("abono-proroga").checked;
  const prorogaDias = parseInt(document.getElementById("abono-proroga-dias").value)||0;
  const interes = document.getElementById("abono-interes").value;
  const msg = document.getElementById("abono-msg");
  msg.textContent="";
  const estabaEditando = editandoAbonoIndex !== null;
  // Antes, esta validación solo corría si estabas EDITANDO un abono existente.
  // Al registrar uno nuevo con el campo de monto vacío o en 0, no se mostraba
  // ningún error: el botón simplemente cerraba el modal y mostraba
  // "Abono registrado ✓" sin haber guardado ningún pago real — por eso parecía
  // que "no dejaba registrar abonos". Ahora el monto se exige siempre.
  if(!monto || monto<=0){msg.textContent="Escribe un monto válido para registrar el abono.";return;}
  if(!fecha){msg.textContent="Selecciona la fecha del abono.";return;}
  try{
    allClientes = await loadClientesFS();
    const cuentaId = cuentaIdPorMetodo(metodo, cuentaSeleccionada);
    const idx = allClientes.findIndex(x=>x.id===abonoClienteId);
    const c = allClientes[idx];
    if(!c.pagos) c.pagos=[];
    if(estabaEditando){
      if(c.pagos[editandoAbonoIndex]){
        const original = c.pagos[editandoAbonoIndex];
        c.pagos[editandoAbonoIndex] = {
          ...original,
          monto, fecha, metodo, cuentaId, ref,
          editadoPor: currentUser.user,
          editadoEn: new Date().toLocaleString("es-MX",{timeZone:"America/Mexico_City"})
        };
      }
      editandoAbonoIndex = null;
    } else if(monto && monto>0){
      c.pagos.push({
        monto, fecha, metodo, cuentaId, ref,
        registradoPor: currentUser.user,
        registradoEn: new Date().toLocaleString("es-MX",{timeZone:"America/Mexico_City"})
      });
    }
    c.proroga = proroga;
    c.prorogaDias = prorogaDias;
    c.interes = interes;
    if(proroga && prorogaDias>0 && c.fecha){
      const d = new Date(c.fecha+"T12:00:00");
      d.setMonth(d.getMonth()+2);
      d.setDate(d.getDate()+prorogaDias);
      c.fechaLimite = d.toISOString().split("T")[0];
    } else if(!proroga && c.fecha){
      const d = new Date(c.fecha+"T12:00:00");
      d.setMonth(d.getMonth()+2);
      c.fechaLimite = d.toISOString().split("T")[0];
    }
    await saveUnCliente(c);
    // Si esta vez se otorgó prórroga, se limpian las banderas de hitos para que
    // la clienta vuelva a la ventana normal de avisos con su nueva fecha límite.
    if(proroga) await waBorrarBanderasHitosCliente(abonoClienteId);
    closeAbonoModal();
    renderPagosPendientes();
    renderHistorialPagos();
    toast(estabaEditando ? "Abono actualizado ✓" : "Abono registrado ✓");
  } catch(e){console.error(e);msg.textContent="Error al guardar.";}
}

// Elimina un abono específico del historial de un cliente (no toca el anticipo)
async function eliminarAbono(i){
  if(!confirm("¿Eliminar este abono? Esta acción no se puede deshacer.")) return;
  try{
    allClientes = await loadClientesFS();
    const idx = allClientes.findIndex(x=>x.id===abonoClienteId);
    const c = allClientes[idx];
    if(!c || !c.pagos || !c.pagos[i]) return;
    c.pagos.splice(i,1);
    await saveUnCliente(c);
    if(editandoAbonoIndex===i) editandoAbonoIndex = null;
    abrirAbonoModal(abonoClienteId); // reabre el modal ya actualizado: recalcula saldo e historial
    renderPagosPendientes();
    renderHistorialPagos();
    toast("Abono eliminado ✓");
  }catch(e){ console.error(e); toast("Error al eliminar","err"); }
}

function verPagos(id){
  goSec("pagos-pendientes");
  renderPagosPendientes();
}

// ══ NOTA SENCILLA ══
let notaSencillaItems = [];
async function abrirNotaSencilla(){
  closeAllNav();
  notaSencillaItems = [{desc:"",qty:1,precio:0}];
  const folio = "ns"+Date.now(); // Solo identificador interno para los callbacks del formulario, ya no es un folio real
  renderNotaSencilla(folio);
  document.getElementById("modal-nota-sencilla").classList.add("open");
}
function closeNotaSencilla(){document.getElementById("modal-nota-sencilla").classList.remove("open");}
function imprimirNotaSencilla(){window.print();}

// Ver/reimprimir una nota sencilla ya guardada (fila "Venta directa" en Lista de clientes)
function verNotaSencillaGuardada(id){
  const c = allClientes.find(x=>x.id===id && x.esNotaSencilla);
  if(!c){toast("Registro no encontrado","err");return;}
  const hoy = c.fecha ? new Date(c.fecha+"T12:00:00").toLocaleDateString("es-MX",{day:"2-digit",month:"2-digit",year:"numeric"}) : "—";
  const items = c.items||[];
  let itemsHTML = items.filter(it=>it.desc).map(it=>`
    <tr>
      <td style="border:1px solid #CCC;padding:.4rem;text-align:center">${it.qty||1}</td>
      <td style="border:1px solid #CCC;padding:.4rem">${it.desc}</td>
      <td style="border:1px solid #CCC;padding:.4rem;text-align:right">$${(Number(it.precio)||0).toLocaleString("es-MX")}</td>
      <td style="border:1px solid #CCC;padding:.4rem;text-align:right">$${((Number(it.qty)||1)*(Number(it.precio)||0)).toLocaleString("es-MX")}</td>
    </tr>`).join("");
  const vacías = Math.max(0,8-items.filter(it=>it.desc).length);
  for(let i=0;i<vacías;i++){
    itemsHTML+=`<tr><td style="border:1px solid #CCC;padding:.4rem;height:22px">&nbsp;</td><td style="border:1px solid #CCC">&nbsp;</td><td style="border:1px solid #CCC">&nbsp;</td><td style="border:1px solid #CCC">&nbsp;</td></tr>`;
  }
  document.getElementById("nota-sencilla-content").innerHTML = `
  <div style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:680px;margin:0 auto;font-size:.85rem;position:relative">
    <div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-20deg);opacity:.15;pointer-events:none;z-index:0">
      <img src="logo_contrato.png" style="width:480px;height:auto">
    </div>
    <div style="position:relative;z-index:1">
    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #C9A84C;padding-bottom:.6rem;margin-bottom:.5rem">
      <div><img src="logo_contrato.png" style="height:55px;width:auto"></div>
      <div style="text-align:right;font-size:.8rem">
        <div style="font-weight:700;font-size:1rem;color:#7A4F2A">ROSS DE LUNE</div>
        <div style="color:#888;font-size:.72rem">Novias y Quinceañeras</div>
        <div>Tel: 921 255 0819</div>
        <div>Propela 10, Puerto Esmeralda, Coatzacoalcos, Ver.</div>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:.5rem">
      <div style="font-size:1.1rem;font-weight:700">NOTA DE VENTA</div>
      <div style="font-size:.85rem">Folio: <strong>Sin folio</strong> &nbsp;·&nbsp; Fecha: ${hoy}</div>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:.4rem;font-size:.82rem">
      <tr>
        <td style="border:1px solid #CCC;padding:.35rem .5rem;width:20%"><strong>Cliente:</strong></td>
        <td style="border:1px solid #CCC;padding:.35rem .5rem;width:40%">${c.nombre||"—"}</td>
        <td style="border:1px solid #CCC;padding:.35rem .5rem;width:15%"><strong>Tel:</strong></td>
        <td style="border:1px solid #CCC;padding:.35rem .5rem">${c.tel||"—"}</td>
      </tr>
    </table>
    <table style="width:100%;border-collapse:collapse;margin-bottom:.4rem">
      <thead>
        <tr style="background:#F0F0F0">
          <th style="border:1px solid #CCC;padding:.35rem;width:10%;text-align:center">Cant.</th>
          <th style="border:1px solid #CCC;padding:.35rem;text-align:left">Descripción</th>
          <th style="border:1px solid #CCC;padding:.35rem;width:18%;text-align:right">Precio unit.</th>
          <th style="border:1px solid #CCC;padding:.35rem;width:18%;text-align:right">Subtotal</th>
        </tr>
      </thead>
      <tbody>${itemsHTML}</tbody>
    </table>
    <table style="width:100%;border-collapse:collapse;margin-bottom:.8rem">
      <tr>
        <td style="border:1px solid #CCC;padding:.4rem;text-align:right;font-weight:700;font-size:.95rem" colspan="4">
          TOTAL: <span style="color:#7A4F2A">$${Number(c.precio||0).toLocaleString("es-MX")}</span>
        </td>
      </tr>
    </table>
    <div style="display:flex;justify-content:flex-end;margin-top:.5rem">
      <div style="width:120px;height:80px;"></div>
    </div>
    </div>
  </div>`;
  document.getElementById("modal-nota-sencilla").classList.add("open");
}

function renderNotaSencilla(folio){
  const hoy = new Date().toLocaleDateString("es-MX",{day:"2-digit",month:"2-digit",year:"numeric"});
  document.getElementById("nota-sencilla-content").innerHTML = `
  <div style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:680px;margin:0 auto;font-size:.85rem">

    <!-- Formulario (solo pantalla, no imprime) -->
    <div class="no-print" style="background:#FAF6F0;border-radius:4px;padding:1rem;margin-bottom:1rem;border:1px solid #E8DDD0">
      <div style="font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:var(--dorado-d);margin-bottom:.8rem">Datos del cliente</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin-bottom:.8rem">
        <div><label style="font-size:.66rem;color:#888;text-transform:uppercase;letter-spacing:.1em;display:block;margin-bottom:.2rem">Nombre</label>
          <input id="ns-nombre" type="text" placeholder="Nombre del cliente" style="width:100%;border:none;border-bottom:1px solid #DDD;padding:.35rem 0;font-size:.85rem;outline:none;background:transparent" oninput="actualizarVistaNotaSencilla('${folio}')">
        </div>
        <div><label style="font-size:.66rem;color:#888;text-transform:uppercase;letter-spacing:.1em;display:block;margin-bottom:.2rem">Teléfono</label>
          <input id="ns-tel" type="tel" placeholder="921 000 0000" style="width:100%;border:none;border-bottom:1px solid #DDD;padding:.35rem 0;font-size:.85rem;outline:none;background:transparent" oninput="actualizarVistaNotaSencilla('${folio}')">
        </div>
      </div>
      <div style="font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:var(--dorado-d);margin-bottom:.6rem">Artículos</div>
      <div id="ns-items-form"></div>
      <button onclick="addNsItem('${folio}')" style="background:none;border:1px dashed #DDD;padding:.3rem .8rem;border-radius:2px;font-size:.7rem;color:#AAA;cursor:pointer;margin-top:.4rem">+ Agregar artículo</button>
      <div style="margin-top:.8rem;display:flex;justify-content:flex-end;gap:.5rem">
        <button id="btn-confirmar-nota-sencilla" onclick="generarEImprimirNotaSencilla('${folio}')" style="background:linear-gradient(135deg,#7A4F2A,#C9A84C);color:#FFF8EC;border:none;padding:.6rem 1.4rem;border-radius:2px;font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;cursor:pointer">✅ Confirmar y preparar impresión</button>
      </div>
    </div>

    <!-- Vista previa de impresión -->
    <div id="ns-print-area" style="display:none">
      <!-- contenido generado -->
    </div>
  </div>`;

  renderNsItemsForm(folio);
  actualizarVistaNotaSencilla(folio);
}

function renderNsItemsForm(folio){
  const cont = document.getElementById("ns-items-form");
  if(!cont) return;
  cont.innerHTML = notaSencillaItems.map((it,i)=>`
    <div style="display:grid;grid-template-columns:3fr 1fr 1.2fr auto;gap:.5rem;margin-bottom:.4rem;align-items:center">
      <input type="text" placeholder="Descripción del artículo" value="${it.desc}"
        style="border:none;border-bottom:1px solid #DDD;padding:.3rem 0;font-size:.82rem;outline:none;background:transparent"
        oninput="nsItemChange(${i},'desc',this.value,'${folio}')">
      <input type="number" placeholder="Cant." value="${it.qty}" min="1"
        style="border:none;border-bottom:1px solid #DDD;padding:.3rem 0;font-size:.82rem;outline:none;text-align:center;background:transparent"
        oninput="nsItemChange(${i},'qty',this.value,'${folio}')">
      <input type="number" placeholder="Precio $" value="${it.precio||""}"
        style="border:none;border-bottom:1px solid #DDD;padding:.3rem 0;font-size:.82rem;outline:none;text-align:right;background:transparent"
        oninput="nsItemChange(${i},'precio',this.value,'${folio}')">
      <button onclick="delNsItem(${i},'${folio}')" style="background:none;border:none;color:#DDD;cursor:pointer;font-size:1rem">✕</button>
    </div>`).join("");
}

function nsItemChange(i,field,val,folio){
  notaSencillaItems[i][field] = field==="desc" ? val : Number(val)||0;
  actualizarVistaNotaSencilla(folio);
}
function addNsItem(folio){
  notaSencillaItems.push({desc:"",qty:1,precio:0});
  renderNsItemsForm(folio);
  actualizarVistaNotaSencilla(folio);
}
function delNsItem(i,folio){
  notaSencillaItems.splice(i,1);
  renderNsItemsForm(folio);
  actualizarVistaNotaSencilla(folio);
}
function actualizarVistaNotaSencilla(folio){
  const subtotal = notaSencillaItems.reduce((s,it)=>s+(Number(it.qty)||1)*(Number(it.precio)||0),0);
  // actualizar totales en el form si hay un resumen visible
}

// ══ CUENTAS — Config (crear/renombrar/desactivar) ══
function renderCuentasConfig(){
  const tbody = document.getElementById("cuentas-config-tbody");
  if(!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4" style="color:#AAA;padding:1rem;"><span class="spinner"></span>Cargando...</td></tr>';
  loadCuentasFS().then(cuentas=>{
    allCuentas = cuentas;
    if(!allCuentas.length){ tbody.innerHTML='<tr><td colspan="4" style="color:#AAA;padding:1rem;">Sin cuentas registradas.</td></tr>'; return; }
    const tipoLabel = {efectivo:"Efectivo", tarjeta:"Tarjeta", transferencia:"Transferencia", otro:"Otro"};
    tbody.innerHTML = allCuentas.map(c=>`<tr>
      <td style="font-size:.8rem">${c.nombre}</td>
      <td style="font-size:.76rem;color:#888">${tipoLabel[c.tipo]||c.tipo}</td>
      <td><span class="status-badge ${c.activa?'s-entregado':'s-pedido'}">${c.activa?'Activa':'Inactiva'}</span></td>
      <td style="white-space:nowrap">
        <button class="ic-btn" onclick="openCuentaModal('${c.id}')" title="Editar">✏️</button>
        <button class="ic-btn" onclick="toggleCuentaActiva('${c.id}')" title="${c.activa?'Desactivar':'Activar'}">${c.activa?'🚫':'✅'}</button>
      </td>
    </tr>`).join("");
  }).catch(()=>{ tbody.innerHTML='<tr><td colspan="4" style="color:var(--rojo);padding:1rem;">Error al cargar.</td></tr>'; });
}

let editingCuenta = null;
function toggleCuentaCampos(){
  const tipo = document.getElementById("cu-tipo").value;
  const esTransf = tipo==="transferencia";
  document.getElementById("fi-cu-nombre").style.display = esTransf ? "none" : "block";
  document.getElementById("fi-cu-banco").style.display   = esTransf ? "block" : "none";
  document.getElementById("fi-cu-digitos").style.display = esTransf ? "block" : "none";
}
function openCuentaModal(id){
  editingCuenta = id;
  const badge = document.getElementById("cm-badge");
  const title = document.getElementById("cm-title");
  document.getElementById("cm-msg").textContent="";
  if(id){
    const c = allCuentas.find(x=>x.id===id);
    badge.textContent="Editar cuenta"; title.textContent="Editar cuenta";
    document.getElementById("cu-tipo").value = c?.tipo||"transferencia";
    document.getElementById("cu-nombre").value = c?.nombre||"";
    document.getElementById("cu-banco").value = c?.banco||"";
    document.getElementById("cu-digitos").value = c?.digitos||"";
  } else {
    badge.textContent="Nueva cuenta"; title.textContent="Cuenta";
    document.getElementById("cu-tipo").value="transferencia";
    document.getElementById("cu-nombre").value="";
    document.getElementById("cu-banco").value="";
    document.getElementById("cu-digitos").value="";
  }
  toggleCuentaCampos();
  document.getElementById("modal-cuenta").classList.add("open");
}
function closeCuentaModal(){
  document.getElementById("modal-cuenta").classList.remove("open");
  editingCuenta = null;
}
async function saveCuenta(){
  const tipo = document.getElementById("cu-tipo").value;
  const msg = document.getElementById("cm-msg");
  msg.textContent="";
  let nombre, banco="", digitos="";
  if(tipo==="transferencia"){
    banco = document.getElementById("cu-banco").value.trim();
    digitos = document.getElementById("cu-digitos").value.trim();
    if(!banco){ msg.textContent="Escribe el nombre del banco."; return; }
    if(!/^\d{4}$/.test(digitos)){ msg.textContent="Los últimos dígitos deben ser exactamente 4 números."; return; }
    nombre = `${banco} •••• ${digitos}`;
  } else {
    nombre = document.getElementById("cu-nombre").value.trim();
    if(!nombre){ msg.textContent="Escribe un nombre para la cuenta."; return; }
  }
  try{
    allCuentas = await loadCuentasFS();
    if(!allCuentas.length) allCuentas = cuentasDefault();
    const dup = allCuentas.find(x=>x.nombre.toLowerCase()===nombre.toLowerCase() && x.id!==editingCuenta);
    if(dup){ msg.textContent="Ya existe una cuenta con ese nombre."; return; }
    let cuentaGuardada;
    if(editingCuenta){
      const idx = allCuentas.findIndex(x=>x.id===editingCuenta);
      if(idx>-1){ allCuentas[idx].nombre=nombre; allCuentas[idx].tipo=tipo; allCuentas[idx].banco=banco; allCuentas[idx].digitos=digitos; cuentaGuardada=allCuentas[idx]; }
    } else {
      const nuevoId = "cta_"+Date.now();
      cuentaGuardada = {id:nuevoId, nombre, tipo, banco, digitos, activa:true};
      allCuentas.push(cuentaGuardada);
    }
    await saveUnaCuenta(cuentaGuardada);
    closeCuentaModal();
    renderCuentasConfig();
    toast("Cuenta guardada ✓");
  }catch(e){ console.error(e); msg.textContent="Error al guardar."; }
}
async function toggleCuentaActiva(id){
  try{
    allCuentas = await loadCuentasFS();
    const idx = allCuentas.findIndex(x=>x.id===id);
    if(idx<0) return;
    allCuentas[idx].activa = !allCuentas[idx].activa;
    await saveUnaCuenta(allCuentas[idx]);
    renderCuentasConfig();
    toast(allCuentas[idx].activa?"Cuenta activada ✓":"Cuenta desactivada ✓");
  }catch(e){ console.error(e); toast("Error al actualizar","err"); }
}

// ══ CUENTAS — Pagos (saldos, entradas, salidas) ══
function selectAsignarCuentaHTML(clienteId, tipo, pagoIndex){
  const opciones = (allCuentas||[]).filter(c=>c.activa)
    .map(c=>'<option value="'+c.id+'">'+c.nombre+'</option>').join("");
  const idxAttr = (pagoIndex===null||pagoIndex===undefined) ? "null" : pagoIndex;
  return '<select style="font-size:.72rem;padding:.2rem .3rem" onchange="asignarCuentaEntrada(\''+clienteId+'\',\''+tipo+'\','+idxAttr+',this.value)">'
    + '<option value="">Sin asignar</option>' + opciones + '</select>';
}

async function renderCuentasPagos(){
  const cardsEl = document.getElementById("cuentas-saldo-cards");
  const avisoEl = document.getElementById("cuentas-sin-asignar-aviso");
  const tbodyEntradas = document.getElementById("cuentas-tbody-entradas");
  const tbodySalidas = document.getElementById("cuentas-tbody-salidas");
  tbodyEntradas.innerHTML = '<tr><td colspan="6" style="color:#AAA;padding:1rem;"><span class="spinner"></span>Cargando...</td></tr>';
  tbodySalidas.innerHTML = '<tr><td colspan="7" style="color:#AAA;padding:1rem;"><span class="spinner"></span>Cargando...</td></tr>';
  let clientesFS, cuentasFS, gastosFS;
  try{ [clientesFS,cuentasFS,gastosFS] = await Promise.all([loadClientesFS(),loadCuentasFS(),loadGastosFS()]); }catch(e){ tbodyEntradas.innerHTML='<tr><td colspan="6" style="color:var(--rojo)">Error al cargar.</td></tr>'; return; }
  allClientes = clientesFS;
  allCuentas = cuentasFS;
  allGastos = gastosFS;

  // Entradas: anticipos + abonos de todos los clientes
  const entradas = [];
  allClientes.forEach(c=>{
    if(Number(c.anticipo||0) > 0){
      entradas.push({
        clienteId:c.id, tipo:"anticipo", pagoIndex:null,
        fecha:c.fechaAnticipo||c.fecha||"—", nombre:c.nombre,
        metodo:c.fpago||"—", cuentaId:c.cuentaAnticipoId||null,
        monto:Number(c.anticipo||0)
      });
    }
    (c.pagos||[]).forEach((p,i)=>{
      if(Number(p.monto||0) > 0){
        entradas.push({
          clienteId:c.id, tipo:"abono", pagoIndex:i,
          fecha:p.fecha||"—", nombre:c.nombre,
          metodo:p.metodo||"—", cuentaId:p.cuentaId||null,
          monto:Number(p.monto||0)
        });
      }
    });
  });
  entradas.sort((a,b)=>(b.fecha||"").localeCompare(a.fecha||""));

  // Saldos por cuenta activa
  const cuentasActivas = allCuentas.filter(c=>c.activa);
  cardsEl.innerHTML = cuentasActivas.map(cu=>{
    const totalEntradas = entradas.filter(e=>e.cuentaId===cu.id).reduce((s,e)=>s+e.monto,0);
    const totalSalidas = allGastos.filter(g=>g.cuentaId===cu.id).reduce((s,g)=>s+Number(g.monto||0),0);
    const saldo = totalEntradas - totalSalidas;
    return '<div class="card" style="padding:.7rem .8rem;text-align:center">'
      + '<div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.08em;color:#AAA;margin-bottom:.3rem">'+cu.nombre+'</div>'
      + '<div style="font-size:1.05rem;font-weight:700;color:var(--cafe)">$'+saldo.toLocaleString("es-MX")+'</div>'
      + '<div style="font-size:.65rem;color:#AAA;margin-top:.2rem">Entradas $'+totalEntradas.toLocaleString("es-MX")+' · Salidas $'+totalSalidas.toLocaleString("es-MX")+'</div>'
      + '</div>';
  }).join("");

  const sinAsignar = entradas.filter(e=>!e.cuentaId);
  if(sinAsignar.length){
    const totalSinAsignar = sinAsignar.reduce((s,e)=>s+e.monto,0);
    avisoEl.style.display="block";
    avisoEl.innerHTML = '<div class="card" style="padding:.6rem .9rem;border-left:3px solid var(--dorado-d)">'
      + '<div style="font-size:.78rem;color:var(--cafe)">⚠️ Hay <strong>'+sinAsignar.length+'</strong> movimiento(s) por $'+totalSinAsignar.toLocaleString("es-MX")+' sin cuenta asignada. Asígnalos en la tabla de abajo para que su saldo cuente.</div></div>';
  } else {
    avisoEl.style.display="none";
  }

  tbodyEntradas.innerHTML = entradas.length ? entradas.map(e=>{
    const cuentaCelda = e.cuentaId ? nombreCuenta(e.cuentaId) : selectAsignarCuentaHTML(e.clienteId, e.tipo, e.pagoIndex);
    return '<tr>'
      + '<td style="font-size:.72rem;color:#AAA">'+e.fecha+'</td>'
      + '<td style="font-size:.8rem">'+e.nombre+'</td>'
      + '<td style="font-size:.74rem;color:#AAA">'+(e.tipo==="anticipo"?"Anticipo":"Abono")+'</td>'
      + '<td style="font-size:.76rem">'+e.metodo+'</td>'
      + '<td style="font-size:.72rem">'+cuentaCelda+'</td>'
      + '<td style="font-size:.76rem;color:var(--verde);font-weight:600">$'+e.monto.toLocaleString("es-MX")+'</td>'
      + '</tr>';
  }).join("") : '<tr><td colspan="6" style="color:#AAA;padding:1rem;text-align:center">Sin movimientos registrados.</td></tr>';

  tbodySalidas.innerHTML = allGastos.length ? allGastos.slice().sort((a,b)=>(b.fecha||"").localeCompare(a.fecha||"")).map(g=>
    '<tr>'
    + '<td style="font-size:.72rem;color:#AAA">'+(g.fecha||"—")+'</td>'
    + '<td style="font-size:.74rem">'+nombreCuenta(g.cuentaId)+'</td>'
    + '<td style="font-size:.74rem">'+(g.categoria||"—")+'</td>'
    + '<td style="font-size:.74rem;color:#888">'+(g.descripcion||"—")+'</td>'
    + '<td style="font-size:.76rem;color:var(--rojo);font-weight:600">$'+Number(g.monto||0).toLocaleString("es-MX")+'</td>'
    + '<td style="font-size:.72rem;color:#AAA">'+(g.registradoPor||"—")+'</td>'
    + '<td><button class="ic-btn" onclick="eliminarGasto(\''+g.id+'\')" title="Eliminar">🗑️</button></td>'
    + '</tr>'
  ).join("") : '<tr><td colspan="7" style="color:#AAA;padding:1rem;text-align:center">Sin gastos registrados.</td></tr>';
}

async function asignarCuentaEntrada(clienteId, tipo, pagoIndex, cuentaId){
  try{
    allClientes = await loadClientesFS();
    const idx = allClientes.findIndex(x=>x.id===clienteId);
    if(idx<0) return;
    if(tipo==="anticipo"){
      allClientes[idx].cuentaAnticipoId = cuentaId||null;
    } else if(tipo==="abono" && pagoIndex!==null && allClientes[idx].pagos && allClientes[idx].pagos[pagoIndex]){
      allClientes[idx].pagos[pagoIndex].cuentaId = cuentaId||null;
    }
    await saveUnCliente(allClientes[idx]);
    toast("Cuenta asignada ✓");
    renderCuentasPagos();
  }catch(e){ console.error(e);toast("Error al asignar cuenta","err"); }
}

async function generarEImprimirNotaSencilla(folio){
  const btnConfirmar = document.getElementById("btn-confirmar-nota-sencilla");
  if(btnConfirmar){
    if(btnConfirmar.disabled) return; // ya se está procesando o ya se guardó — evita duplicados por doble clic
    btnConfirmar.disabled = true;
    btnConfirmar.style.opacity = ".6";
  }

  const nombre  = document.getElementById("ns-nombre")?.value||"—";
  const tel     = document.getElementById("ns-tel")?.value||"—";
  const hoy     = new Date().toLocaleDateString("es-MX",{day:"2-digit",month:"2-digit",year:"numeric"});
  const subtotal= notaSencillaItems.reduce((s,it)=>s+(Number(it.qty)||1)*(Number(it.precio)||0),0);

  let itemsHTML = notaSencillaItems.filter(it=>it.desc).map(it=>`
    <tr>
      <td style="border:1px solid #CCC;padding:.4rem;text-align:center">${it.qty||1}</td>
      <td style="border:1px solid #CCC;padding:.4rem">${it.desc}</td>
      <td style="border:1px solid #CCC;padding:.4rem;text-align:right">$${(Number(it.precio)||0).toLocaleString("es-MX")}</td>
      <td style="border:1px solid #CCC;padding:.4rem;text-align:right">$${((Number(it.qty)||1)*(Number(it.precio)||0)).toLocaleString("es-MX")}</td>
    </tr>`).join("");

  // Filas vacías
  const vacías = Math.max(0,8-notaSencillaItems.filter(it=>it.desc).length);
  for(let i=0;i<vacías;i++){
    itemsHTML+=`<tr><td style="border:1px solid #CCC;padding:.4rem;height:22px">&nbsp;</td><td style="border:1px solid #CCC">&nbsp;</td><td style="border:1px solid #CCC">&nbsp;</td><td style="border:1px solid #CCC">&nbsp;</td></tr>`;
  }

  const printArea = document.getElementById("ns-print-area");
  printArea.style.display="block";
  printArea.innerHTML = `
  <div style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:680px;margin:0 auto;font-size:.85rem;position:relative">

    <!-- MARCA DE AGUA -->
    <div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-20deg);opacity:.15;pointer-events:none;z-index:0">
      <img src="logo_contrato.png" style="width:480px;height:auto">
    </div>

    <div style="position:relative;z-index:1">
    <!-- ENCABEZADO NEGOCIO -->
    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #C9A84C;padding-bottom:.6rem;margin-bottom:.5rem">
      <div>
        <img src="logo_contrato.png" style="height:55px;width:auto">
      </div>
      <div style="text-align:right;font-size:.8rem">
        <div style="font-weight:700;font-size:1rem;color:#7A4F2A">ROSS DE LUNE</div>
        <div style="color:#888;font-size:.72rem">Novias y Quinceañeras</div>
        <div>Tel: 921 255 0819</div>
        <div>Propela 10, Puerto Esmeralda, Coatzacoalcos, Ver.</div>
      </div>
    </div>

    <!-- TÍTULO -->
    <div style="display:flex;justify-content:space-between;margin-bottom:.5rem">
      <div style="font-size:1.1rem;font-weight:700">NOTA DE VENTA</div>
      <div style="font-size:.85rem">Fecha: ${hoy}</div>
    </div>

    <!-- DATOS CLIENTE -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:.4rem;font-size:.82rem">
      <tr>
        <td style="border:1px solid #CCC;padding:.35rem .5rem;width:20%"><strong>Cliente:</strong></td>
        <td style="border:1px solid #CCC;padding:.35rem .5rem;width:40%">${nombre}</td>
        <td style="border:1px solid #CCC;padding:.35rem .5rem;width:15%"><strong>Tel:</strong></td>
        <td style="border:1px solid #CCC;padding:.35rem .5rem">${tel}</td>
      </tr>
    </table>

    <!-- ARTÍCULOS -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:.4rem">
      <thead>
        <tr style="background:#F0F0F0">
          <th style="border:1px solid #CCC;padding:.35rem;width:10%;text-align:center">Cant.</th>
          <th style="border:1px solid #CCC;padding:.35rem;text-align:left">Descripción</th>
          <th style="border:1px solid #CCC;padding:.35rem;width:18%;text-align:right">Precio unit.</th>
          <th style="border:1px solid #CCC;padding:.35rem;width:18%;text-align:right">Subtotal</th>
        </tr>
      </thead>
      <tbody>${itemsHTML}</tbody>
    </table>

    <!-- TOTAL -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:.8rem">
      <tr>
        <td style="border:1px solid #CCC;padding:.4rem;text-align:right;font-weight:700;font-size:.95rem" colspan="4">
          TOTAL: <span style="color:#7A4F2A">$${subtotal.toLocaleString("es-MX")}</span>
        </td>
      </tr>
    </table>

    <!-- ESPACIO PARA SELLO -->
    <div style="display:flex;justify-content:flex-end;margin-top:.5rem">
      <div style="width:120px;height:80px;"></div>
    </div>
    </div>
  </div>`;

  // notasSencillas ahora vive en Firestore también, igual que el "cliente" de venta directa
  try{
    await agregarNotaSencillaFS({fecha:new Date().toISOString(),nombre,tel,items:notaSencillaItems,total:subtotal});
    const nuevoCliente={
      id:"NS"+Date.now(),
      esNotaSencilla:true,
      folio:null,
      fecha:fechaLocalISO(),
      nombre,
      tel,
      estatus:"Venta directa",
      precio:subtotal,
      anticipo:subtotal,
      sispago:"Liquidado",
      items:notaSencillaItems
    };
    await saveUnCliente(nuevoCliente);
    allClientes = await loadClientesFS();
    renderClientes();
  }catch(e){console.error("Error guardando folio",e);}

  // Ocultar formulario y mostrar solo impresión
  const noPrintBar = document.querySelector("#modal-nota-sencilla .no-print");
  if(noPrintBar) noPrintBar.style.display="none";
  setTimeout(()=>{
    window.print();
    if(noPrintBar) noPrintBar.style.display="flex";
  },300);
}