// ══ LOGIN ══
let loginRole="admin";
let _desbloqueosTemp = new Set(); // secciones desbloqueadas por supervisor en esta sesión
function openLogin(role){
  loginRole=role;
  const a=role==="admin";
  document.getElementById("login-badge").textContent=a?"Administrador":"Colaborador";
  document.getElementById("login-title").textContent=a?"Bienvenida de nuevo":"Hola, ¿lista para crear?";
  document.getElementById("login-err").textContent="";
  document.getElementById("inp-u").value="";document.getElementById("inp-p").value="";
  document.getElementById("ov-login").classList.add("open");
  setTimeout(()=>document.getElementById("inp-u").focus(),80);
}
function showPass(){
  const input = document.getElementById("inp-p");
  if(input) input.type="text";
}
function hidePass(){
  const input = document.getElementById("inp-p");
  if(input) input.type="password";
}

function closeLogin(){
  document.getElementById("ov-login").classList.remove("open");
  hidePass();
}

async function doLogin(){
  const u=document.getElementById("inp-u").value.trim().toLowerCase();
  const p=document.getElementById("inp-p").value;
  const btn=document.getElementById("btn-login");
  const err=document.getElementById("login-err");
  err.textContent="";btn.innerHTML='<span class="spinner"></span>Verificando...';btn.disabled=true;
  try{
    // PASO 1 — Firebase Authentication valida usuario+contraseña.
    // El correo interno se arma con EMAIL_DOMAIN (ver comentario arriba).
    try{
      await auth.signInWithEmailAndPassword(u+EMAIL_DOMAIN, p);
    }catch(authErr){
      console.error("Firebase Auth error:",authErr);
      err.textContent="Usuario o contraseña incorrectos.";
      btn.innerHTML="Entrar";btn.disabled=false;return;
    }
    // PASO 2 — Ya autenticado en Firebase, se consulta Firestore (colección
    // "users", documento con ID = usuario) para obtener rol/permisos/nombre/
    // bloqueo.
    let match;
    try{
      const snap=await db.collection("users").doc(u).get();
      if(!snap.exists){
        err.textContent="Usuario válido en Firebase, pero sin documento en Firestore. Contacta al administrador.";
        btn.innerHTML="Entrar";btn.disabled=false;
        auth.signOut();
        return;
      }
      match=snap.data();match.user=u;
    }catch(fsErr){
      console.error("Firestore error:",fsErr);
      err.textContent="Error al leer Firestore: "+fsErr.message;
      btn.innerHTML="Entrar";btn.disabled=false;
      auth.signOut();
      return;
    }
    if(match.role!==loginRole){
      err.textContent="Usuario o contraseña incorrectos.";
      btn.innerHTML="Entrar";btn.disabled=false;
      auth.signOut();
      return;
    }
    if(match.blocked){err.textContent="Cuenta bloqueada. Contacta al administrador.";btn.innerHTML="Entrar";btn.disabled=false;auth.signOut();return;}
    // Clientes, inventario y cuentas se leen EN VIVO de Firestore.
    const [clientesFS,inventarioFS]=await Promise.all([loadClientesFS(),loadInventarioFS()]);
    allClientes=clientesFS;window._invData=inventarioFS;
    allCuentas=await asegurarCuentasFS();
    const now=new Date().toLocaleString("es-MX",{timeZone:"America/Mexico_City",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"});
    if(!match.accesos)match.accesos=[];
    match.accesos.unshift(now);
    try{await db.collection("users").doc(u).update({accesos:match.accesos});}
    catch(updErr){console.error("No se pudo registrar el acceso en Firestore:",updErr);}
    currentUser=match;closeLogin();enterPanel();
    await waCargarConfig();
    await waRefrescarBadge(true); // true = mostrar el aviso post-login si hay pendientes
  }catch(e){console.error("doLogin error:",e);err.textContent="Error de conexión: "+e.message;btn.innerHTML="Entrar";btn.disabled=false;}
}

// ══ PANEL ══
function enterPanel(){
  document.getElementById("screen-welcome").style.display="none";
  document.getElementById("screen-panel").classList.add("show");
  document.getElementById("top-user").textContent="@"+currentUser.user;
  if(currentUser.role!=="admin"){
    document.getElementById("admin-sub-colab").style.display="none";
    document.getElementById("admin-sub-permisos").style.display="none";
    document.getElementById("admin-sub-cuentas").style.display="none";
    document.getElementById("admin-sub-hist").style.display="none";
    document.getElementById("admin-sub-micuenta").style.display="none";
    document.getElementById("nb-mensajeria").style.display="none";
    // Mostrar botones del nav — bloqueados con 🔒, permitidos normal
    const permisos = currentUser.permisos||{};
    SECCIONES_CTRL.forEach(s=>{
      const nb = document.getElementById("nb-"+s.id);
      if(!nb) return;
      const permitido = permisos[s.id]!==false;
      nb.style.display="";
      if(!permitido){
        // Reemplazar el onclick por solicitud de auth, agregar candado visual
        nb.dataset.bloqueado="true";
        const textoOriginal = nb.innerHTML.replace(/🔒\s*/g,"");
        nb.innerHTML = "🔒 " + textoOriginal;
        nb.style.opacity="0.55";
      } else {
        nb.dataset.bloqueado="";
        nb.style.opacity="";
      }
    });
  } else {
    // Admin: restaurar todo por si la sesión anterior en esta misma pestaña fue de un worker
    document.getElementById("admin-sub-colab").style.display="";
    document.getElementById("admin-sub-permisos").style.display="";
    document.getElementById("admin-sub-cuentas").style.display="";
    document.getElementById("admin-sub-hist").style.display="";
    document.getElementById("admin-sub-micuenta").style.display="";
    document.getElementById("nb-mensajeria").style.display="";
    SECCIONES_CTRL.forEach(s=>{
      const nb = document.getElementById("nb-"+s.id);
      if(!nb) return;
      nb.dataset.bloqueado="";
      nb.style.opacity="";
      nb.innerHTML = nb.innerHTML.replace(/🔒\s*/g,"");
    });
  }
  document.getElementById("my-display").value=currentUser.display||"";
  document.getElementById("my-user").value=currentUser.user||"";
  document.getElementById("my-user").disabled=true;
  renderClientes();
  initColorPicker();
  initAdicionales();
  initPkgComponents("xv");
  goSec("lista-clientes");
}

function doLogout(){
  auth.signOut().catch(e=>console.error("Firebase signOut error:",e));
  currentUser=null;allUsers=[];allClientes=[];loginRole=null;window._invData=[];_desbloqueosTemp=new Set();window._lotePrint=[];
  document.getElementById("screen-panel").classList.remove("show");
  document.getElementById("screen-welcome").style.display="flex";
  document.getElementById("ov-login").classList.remove("open");
  document.getElementById("inp-u").value="";
  document.getElementById("inp-p").value="";
  document.getElementById("login-err").textContent="";
  document.getElementById("btn-login").innerHTML="Entrar";
  document.getElementById("btn-login").disabled=false;
  closeAllNav();
}
// ══ MI CUENTA ══
async function saveMyAccount(){
  const display=document.getElementById("my-display").value.trim();
  const p1=document.getElementById("my-p1").value;
  const p2=document.getElementById("my-p2").value;
  const msg=document.getElementById("my-msg");
  msg.style.color="var(--rojo)";msg.textContent="";
  if(!display){msg.textContent="El nombre es obligatorio.";return;}
  if(p1&&p1!==p2){msg.textContent="Las contraseñas no coinciden.";return;}
  if(p1&&p1.length<6){msg.textContent="Mínimo 6 caracteres.";return;}
  try{
    await db.collection("users").doc(currentUser.user).update({display});
    currentUser.display=display;
    document.getElementById("top-user").textContent="@"+currentUser.user;
    if(p1){
      try{
        await auth.currentUser.updatePassword(p1);
      }catch(pwErr){
        console.error("Error al actualizar contraseña:",pwErr);
        document.getElementById("my-p1").value="";document.getElementById("my-p2").value="";
        msg.textContent = pwErr.code==="auth/requires-recent-login"
          ? "El nombre se guardó. Por seguridad, cierra sesión y vuelve a entrar antes de cambiar tu contraseña."
          : "El nombre se guardó, pero la contraseña no pudo actualizarse: "+pwErr.message;
        return;
      }
    }
    document.getElementById("my-p1").value="";document.getElementById("my-p2").value="";
    msg.style.color="var(--verde)";msg.textContent="✓ Cambios guardados.";
    toast("Cuenta actualizada ✓");
  }catch(e){console.error(e);msg.textContent="Error al guardar.";}
}

async function saveClaveDesbloqueo(){
  const cd1=document.getElementById("my-cd1").value;
  const cd2=document.getElementById("my-cd2").value;
  const msg=document.getElementById("my-cd-msg");
  msg.style.color="var(--rojo)";msg.textContent="";
  if(!cd1){msg.textContent="Escribe la nueva clave de desbloqueo.";return;}
  if(cd1!==cd2){msg.textContent="Las claves no coinciden.";return;}
  if(cd1.length<6){msg.textContent="Mínimo 6 caracteres.";return;}
  try{
    await db.collection("users").doc(currentUser.user).update({claveDesbloqueo:cd1});
    currentUser.claveDesbloqueo=cd1;
    document.getElementById("my-cd1").value="";document.getElementById("my-cd2").value="";
    msg.style.color="var(--verde)";msg.textContent="✓ Clave de desbloqueo guardada.";
    toast("Clave de desbloqueo actualizada ✓");
  }catch(e){console.error(e);msg.textContent="Error al guardar.";}
}

// ══ COLABORADORES ══
async function loadWorkers(){
  const tbody=document.getElementById("workers-tbody");
  tbody.innerHTML='<tr><td colspan="5" style="color:#AAA;padding:1rem"><span class="spinner"></span>Cargando...</td></tr>';
  try{
    const snap=await db.collection("users").get();
    allUsers=snap.docs.map(d=>({...d.data(),user:d.id}));
    renderWorkers();
  }
  catch(e){console.error("Firestore error:",e);tbody.innerHTML='<tr><td colspan="5" style="color:var(--rojo)">Error de conexión.</td></tr>';}
}
function renderWorkers(){
  const tbody=document.getElementById("workers-tbody");
  tbody.innerHTML=allUsers.map(u=>`
    <tr>
      <td>${u.display}</td>
      <td style="color:#888">@${u.user}</td>
      <td><span class="${u.role==="admin"?"ba":"br"}">${u.role==="admin"?"Admin":"Colaborador"}</span></td>
      <td><span class="${u.blocked?"bb":"br"}">${u.blocked?"Bloqueado":"Activo"}</span></td>
      <td>
        <button class="ic-btn" onclick="openWorkerModal('${u.user}')" title="Editar">✏️</button>
        <button class="ic-btn" onclick="toggleBlock('${u.user}')" title="${u.blocked?"Desbloquear":"Bloquear"}">${u.blocked?"🔓":"🔒"}</button>
      </td>
    </tr>`).join("");
}
function openWorkerModal(username){
  editingWorker=username;
  document.getElementById("wm-msg").textContent="";
  document.getElementById("wm-msg").style.color="var(--cafe)";
  const passField=document.getElementById("w-pass");
  const passWrap=passField.closest(".field");
  if(username){
    const u=allUsers.find(x=>x.user===username);
    document.getElementById("wm-badge").textContent="Editar cuenta";
    document.getElementById("wm-title").textContent=u.display;
    document.getElementById("w-display").value=u.display;
    document.getElementById("w-user").value=u.user;
    document.getElementById("w-user").disabled=true;
    if(passWrap)passWrap.style.display="none";
  }else{
    document.getElementById("wm-badge").textContent="Nueva cuenta";
    document.getElementById("wm-title").textContent="Colaborador";
    document.getElementById("w-display").value="";document.getElementById("w-user").value="";
    document.getElementById("w-pass").value="";
    document.getElementById("w-user").disabled=false;
    if(passWrap)passWrap.style.display="";
  }
  document.getElementById("modal-worker").classList.add("open");
}
function closeWorkerModal(){document.getElementById("modal-worker").classList.remove("open");}
async function saveWorker(){
  const display=document.getElementById("w-display").value.trim();
  const user=document.getElementById("w-user").value.trim().toLowerCase();
  const pass=document.getElementById("w-pass").value;
  const msg=document.getElementById("wm-msg");
  if(!display||!user){msg.style.color="var(--rojo)";msg.textContent="Nombre y usuario son obligatorios.";return;}
  try{
    if(editingWorker){
      // Solo se actualiza el nombre a mostrar — el usuario (ID del documento) no se
      // puede cambiar aquí porque está ligado a la cuenta real de Firebase Authentication.
      await db.collection("users").doc(editingWorker).update({display});
    }else{
      if(!pass){msg.style.color="var(--rojo)";msg.textContent="La contraseña es obligatoria.";return;}
      if(pass.length<6){msg.style.color="var(--rojo)";msg.textContent="Mínimo 6 caracteres.";return;}
      const snap=await db.collection("users").doc(user).get();
      if(snap.exists){msg.style.color="var(--rojo)";msg.textContent="Ese usuario ya existe en Firestore.";return;}
      // Se crea la cuenta real en Firebase Authentication usando la instancia
      // secundaria — así no se cierra la sesión del admin que está creando el colaborador.
      try{
        await secondaryApp.auth().createUserWithEmailAndPassword(user+EMAIL_DOMAIN,pass);
        await secondaryApp.auth().signOut();
      }catch(authErr){
        console.error("Error al crear cuenta en Firebase Auth:",authErr);
        msg.style.color="var(--rojo)";
        msg.textContent = authErr.code==="auth/email-already-in-use"
          ? "Ya existe una cuenta de Firebase Authentication con ese usuario."
          : "No se pudo crear la cuenta: "+authErr.message;
        return;
      }
      await db.collection("users").doc(user).set({user,display,role:"worker",blocked:false,accesos:[],permisos:{clientes:true,pagos:true,pedidos:true,progreso:true,inventario:true}});
    }
    closeWorkerModal();loadWorkers();
    toast(editingWorker?"Cuenta actualizada ✓":"Colaborador creado ✓");
  }catch(e){console.error(e);msg.style.color="var(--rojo)";msg.textContent="Error al guardar.";}
}
async function toggleBlock(username){
  try{
    const idx=allUsers.findIndex(x=>x.user===username);
    const nuevoEstado=!allUsers[idx].blocked;
    await db.collection("users").doc(username).update({blocked:nuevoEstado});
    allUsers[idx].blocked=nuevoEstado;
    renderWorkers();toast(nuevoEstado?"Bloqueado 🔒":"Desbloqueado 🔓");
  }catch(e){console.error(e);toast("Error de conexión","err");}
}

// ══ HISTORIAL ══
async function loadHistorial(){
  const list=document.getElementById("log-list");
  list.innerHTML='<span class="spinner"></span> Cargando...';
  try{
    const snap=await db.collection("users").get();
    const entries=[];
    snap.docs.forEach(doc=>{
      const u=doc.data();
      (u.accesos||[]).forEach(ts=>entries.push({display:u.display,user:doc.id,role:u.role,ts}));
    });
    entries.sort((a,b)=>new Date(b.ts)-new Date(a.ts));
    if(!entries.length){list.innerHTML='<p style="color:#AAA;font-size:.82rem">Sin registros aún.</p>';return;}
    list.innerHTML=entries.slice(0,60).map(e=>`
      <div class="log-entry">
        <div class="log-dot"></div>
        <div>
          <div class="log-user">${e.display} <span style="font-size:.66rem;color:var(--morado);letter-spacing:.08em">${e.role==="admin"?"Admin":"Colaborador"}</span></div>
          <div class="log-time">@${e.user} · ${e.ts}</div>
        </div>
      </div>`).join("");
  }catch(e){console.error(e);list.innerHTML='<p style="color:var(--rojo)">Error de conexión.</p>';}
}


// ══ PERMISOS ══
const SECCIONES_CTRL = [
  {id:"clientes",       label:"👗 Clientes",          subs:["nuevo-cliente","lista-clientes"]},
  {id:"pagos",          label:"💳 Pagos",              subs:["pagos-pendientes","pagos-historial","nota-sencilla","corte-caja","pagos-cuentas","pagos-ingresos"]},
  {id:"pedidos",        label:"📋 Pedidos",            subs:["todos-pedidos","entregas-fecha","pedidos-accesorios"]},
  {id:"progreso",       label:"📦 Progreso",           subs:["progreso-pedido","progreso-agenda","progreso-diseno","progreso-formato"]},
  {id:"inventario",     label:"🏷️ Inventario",         subs:["inv-qr","inv-buscar","inv-paquetes"]},
  {id:"cotizaciones",   label:"📅 Cotizaciones",       subs:["nueva-cotizacion","cotizaciones-calendario"]},
];

let _permisosWorkerActual = null;

function renderPermisos(){
  const lista = document.getElementById("permisos-worker-list");
  const panel = document.getElementById("permisos-panel");
  if(!lista) return;
  const workers = allUsers.filter(u=>u.role==="worker");
  if(!workers.length){
    lista.innerHTML='<p style="color:#AAA;font-size:.82rem">No hay colaboradores registrados.</p>';
    return;
  }
  lista.innerHTML = workers.map(u=>`
    <button class="paso-btn" onclick="seleccionarWorkerPermisos('${u.user}')"
      style="${_permisosWorkerActual===u.user?'background:var(--dorado-g);color:#FFF8EC;border-color:transparent':''}">
      ${u.display}
    </button>`).join("");
  if(!_permisosWorkerActual) panel.style.display="none";
}

function seleccionarWorkerPermisos(username){
  _permisosWorkerActual = username;
  const u = allUsers.find(x=>x.user===username);
  if(!u) return;
  document.getElementById("permisos-worker-nombre").textContent = u.display;
  document.getElementById("permisos-panel").style.display="block";
  const permisos = u.permisos || {};
  const toggles = document.getElementById("permisos-toggles");
  toggles.innerHTML = SECCIONES_CTRL.map(s=>{
    const activo = permisos[s.id]!==false; // default: acceso permitido
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:.5rem 0;border-bottom:1px solid #F5F0E8">
      <span style="font-size:.84rem">${s.label}</span>
      <label class="toggle-switch">
        <input type="checkbox" id="perm-${s.id}" ${activo?"checked":""}>
        <span class="toggle-slider"></span>
      </label>
    </div>`;
  }).join("");
  renderPermisos(); // re-render para resaltar el seleccionado
}

async function guardarPermisos(){
  const msg = document.getElementById("permisos-msg");
  msg.textContent="";
  if(!_permisosWorkerActual) return;
  const permisos = {};
  SECCIONES_CTRL.forEach(s=>{
    permisos[s.id] = document.getElementById("perm-"+s.id)?.checked !== false;
  });
  try{
    await db.collection("users").doc(_permisosWorkerActual).update({permisos});
    const idx=allUsers.findIndex(x=>x.user===_permisosWorkerActual);
    if(idx>-1) allUsers[idx].permisos=permisos;
    msg.style.color="var(--verde)";
    msg.textContent="✓ Permisos guardados";
    toast("Permisos actualizados ✓");
  }catch(e){console.error(e);msg.style.color="var(--rojo)";msg.textContent="Error al guardar.";}
}
// Verifica si el usuario actual (worker) tiene permiso para una sección
function tienePermiso(secId){
  if(!currentUser || currentUser.role==="admin") return true;
  if(_desbloqueosTemp.has(secId)) return true;
  const seccion = SECCIONES_CTRL.find(s=>s.subs.includes(secId)||s.id===secId);
  if(!seccion) return true;
  if(_desbloqueosTemp.has(seccion.id)) return true;
  const permisos = currentUser.permisos||{};
  return permisos[seccion.id] !== false;
}

// ══ AUTORIZACIÓN SUPERVISOR ══
let _authSuperCallback = null;

function solicitarAuthSuper(callback){
  _authSuperCallback = callback;
  document.getElementById("auth-super-user").value="";
  document.getElementById("auth-super-pass").value="";
  document.getElementById("auth-super-err").textContent="";
  const modal = document.getElementById("modal-auth-super");
  modal.style.display="flex";
  setTimeout(()=>document.getElementById("auth-super-user").focus(),80);
}

function cerrarAuthSuper(){
  document.getElementById("modal-auth-super").style.display="none";
  _authSuperCallback=null;
}

async function verificarAuthSuper(){
  const u = document.getElementById("auth-super-user").value.trim().toLowerCase();
  const p = document.getElementById("auth-super-pass").value;
  const err = document.getElementById("auth-super-err");
  err.textContent="";
  try{
    // Primero se busca el documento del admin en Firestore para saber si ya
    // configuró su propia clave de desbloqueo (independiente de su login).
    const snap = await db.collection("users").doc(u).get();
    const admin = snap.exists ? snap.data() : null;
    if(!admin || admin.role!=="admin" || admin.blocked){err.textContent="Credenciales incorrectas.";return;}

    let ok=false;
    if(admin.claveDesbloqueo){
      // Tiene clave de desbloqueo propia: se compara directo, sin tocar Firebase Auth.
      ok = admin.claveDesbloqueo===p;
    }else{
      // Sin clave de desbloqueo configurada todavía: se usa su contraseña real
      // de login como respaldo, verificada contra Firebase Auth (instancia
      // secundaria, para no cerrar la sesión del usuario actual).
      try{
        await secondaryApp.auth().signInWithEmailAndPassword(u+EMAIL_DOMAIN,p);
        await secondaryApp.auth().signOut();
        ok=true;
      }catch(authErr){ok=false;}
    }
    if(!ok){err.textContent="Credenciales incorrectas.";return;}
    const cb = _authSuperCallback; // guardamos el callback ANTES de cerrar el modal, que lo pone en null
    cerrarAuthSuper();
    if(cb) cb();
  }catch(e){console.error("Error de autorización de supervisor:",e);err.textContent="Credenciales incorrectas.";}
}