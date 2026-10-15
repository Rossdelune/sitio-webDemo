// Siembra cotizaciones de prueba para la sección "Estadísticas de cotizaciones".
// Requiere que el emulador de Firestore esté corriendo en localhost:8080.
// Uso: node seed-cotizaciones-stats.js

const PROJECT_ID = "rossdelune2026";
const BASE_URL = `http://localhost:8080/v1/projects/${PROJECT_ID}/databases/(default)/documents/cotizaciones`;

// ─── Conversores JS → Firestore REST ───
function toFirestoreValue(v){
  if(v === null || v === undefined) return { nullValue: null };
  if(typeof v === "string") return { stringValue: v };
  if(typeof v === "boolean") return { booleanValue: v };
  if(typeof v === "number"){
    if(Number.isInteger(v)) return { integerValue: String(v) };
    return { doubleValue: v };
  }
  if(Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } };
  if(typeof v === "object"){
    const fields = {};
    Object.entries(v).forEach(([k,val])=>{ fields[k] = toFirestoreValue(val); });
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}
function toFirestoreDoc(obj){
  const fields = {};
  Object.entries(obj).forEach(([k,v])=>{ fields[k] = toFirestoreValue(v); });
  return { fields };
}
async function crearCotizacion(id, data){
  const url = `${BASE_URL}?documentId=${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toFirestoreDoc(data))
  });
  if(!res.ok){
    const txt = await res.text();
    console.error(`❌ ${id}: ${res.status} ${txt.slice(0,200)}`);
    return false;
  }
  console.log(`✓ ${id} → ${data.folio} (${data.fechaCreacion} · ${data.estatus} · ${data.origen||"—"})`);
  return true;
}

// ─── Datos de prueba ───
// 3 años: 2024 (pocos), 2025 (medios), 2026 (muchos). Distribución pensada
// para que las estadísticas tengan datos variados: distintos orígenes,
// distintos estatus, distintos motivos de no regreso, distintos números
// de impresiones.

const COTIZACIONES = [
  // ─── 2024 (histórico, pocos casos) ───
  { folio:"COT-0001", fechaCreacion:"2024-03-15", nombre:"Ana Martínez",   estatus:"convertida", origen:"Redes sociales",     motivo:"", impresiones:2 },
  { folio:"COT-0002", fechaCreacion:"2024-06-20", nombre:"Beatriz López",  estatus:"no_regreso", origen:"Recomendación",      motivo:"Precio", impresiones:1 },
  { folio:"COT-0003", fechaCreacion:"2024-09-10", nombre:"Carmen Ruiz",    estatus:"convertida", origen:"Pasó por la tienda", motivo:"", impresiones:3 },

  // ─── 2025 (año intermedio) ───
  { folio:"COT-0004", fechaCreacion:"2025-01-15", nombre:"Diana Torres",   estatus:"convertida", origen:"Redes sociales",     motivo:"", impresiones:2 },
  { folio:"COT-0005", fechaCreacion:"2025-02-22", nombre:"Elena Sánchez",  estatus:"no_regreso", origen:"Redes sociales",     motivo:"No encontró el modelo", impresiones:1 },
  { folio:"COT-0006", fechaCreacion:"2025-03-30", nombre:"Fernanda Díaz",  estatus:"convertida", origen:"Recomendación",      motivo:"", impresiones:4 },
  { folio:"COT-0007", fechaCreacion:"2025-05-12", nombre:"Gabriela Mora",  estatus:"no_regreso", origen:"Pasó por la tienda", motivo:"Precio", impresiones:2 },
  { folio:"COT-0008", fechaCreacion:"2025-07-08", nombre:"Hilda Vargas",   estatus:"convertida", origen:"Otro",               motivo:"", impresiones:1 },
  { folio:"COT-0009", fechaCreacion:"2025-08-19", nombre:"Irene Castro",   estatus:"no_regreso", origen:"Recomendación",      motivo:"No le gustó el color", impresiones:3 },
  { folio:"COT-0010", fechaCreacion:"2025-10-04", nombre:"Julia Ramos",    estatus:"convertida", origen:"Redes sociales",     motivo:"", impresiones:2 },
  { folio:"COT-0011", fechaCreacion:"2025-11-25", nombre:"Karla Jiménez",  estatus:"no_regreso", origen:"Pasó por la tienda", motivo:"No le convenció la promoción", impresiones:1 },
  { folio:"COT-0012", fechaCreacion:"2025-12-10", nombre:"Laura Peña",     estatus:"convertida", origen:"Recomendación",      motivo:"", impresiones:5 },

  // ─── 2026 (año actual, el más cargado) ───
  { folio:"COT-0013", fechaCreacion:"2026-01-08", nombre:"Mariana Flores", estatus:"convertida", origen:"Redes sociales",     motivo:"", impresiones:3 },
  { folio:"COT-0014", fechaCreacion:"2026-01-22", nombre:"Natalia Cruz",   estatus:"no_regreso", origen:"Recomendación",      motivo:"Precio", impresiones:2 },
  { folio:"COT-0015", fechaCreacion:"2026-02-14", nombre:"Olivia Reyes",   estatus:"convertida", origen:"Pasó por la tienda", motivo:"", impresiones:1 },
  { folio:"COT-0016", fechaCreacion:"2026-03-05", nombre:"Patricia Luna",  estatus:"no_regreso", origen:"Redes sociales",     motivo:"No encontró el modelo", impresiones:4 },
  { folio:"COT-0017", fechaCreacion:"2026-03-28", nombre:"Quintina Soto",  estatus:"convertida", origen:"Otro",               motivo:"", impresiones:2 },
  { folio:"COT-0018", fechaCreacion:"2026-04-11", nombre:"Rosa Medina",    estatus:"no_regreso", origen:"Redes sociales",     motivo:"Precio", impresiones:1 },
  { folio:"COT-0019", fechaCreacion:"2026-05-02", nombre:"Sofía Herrera",  estatus:"convertida", origen:"Recomendación",      motivo:"", impresiones:3 },
  { folio:"COT-0020", fechaCreacion:"2026-05-19", nombre:"Teresa Ortiz",   estatus:"no_regreso", origen:"Redes sociales",     motivo:"No le gustó el color", impresiones:2 },
  { folio:"COT-0021", fechaCreacion:"2026-06-07", nombre:"Ursula Navarro", estatus:"convertida", origen:"Pasó por la tienda", motivo:"", impresiones:1 },
  { folio:"COT-0022", fechaCreacion:"2026-07-15", nombre:"Valeria Gil",    estatus:"pendiente",  origen:"Redes sociales",     motivo:"", impresiones:0 },
  { folio:"COT-0023", fechaCreacion:"2026-07-29", nombre:"Wendy Palacios", estatus:"agendada",   origen:"Recomendación",      motivo:"", impresiones:1 },
  { folio:"COT-0024", fechaCreacion:"2026-08-12", nombre:"Xóchitl Bravo",  estatus:"pendiente",  origen:"Pasó por la tienda", motivo:"", impresiones:0 },
  { folio:"COT-0025", fechaCreacion:"2026-08-30", nombre:"Yolanda Ríos",   estatus:"convertida", origen:"Redes sociales",     motivo:"", impresiones:2 },
  { folio:"COT-0026", fechaCreacion:"2026-09-14", nombre:"Zaira Campos",   estatus:"no_regreso", origen:"Otro",               motivo:"Otro: se casó en otra ciudad", impresiones:3 },
  { folio:"COT-0027", fechaCreacion:"2026-09-26", nombre:"Alejandra Vidal",estatus:"convertida", origen:"Recomendación",      motivo:"", impresiones:1 },
  { folio:"COT-0028", fechaCreacion:"2026-10-03", nombre:"Brenda Salas",   estatus:"pendiente",  origen:"Redes sociales",     motivo:"", impresiones:0 },
  { folio:"COT-0029", fechaCreacion:"2026-10-05", nombre:"Cecilia Ponce",  estatus:"agendada",   origen:"Recomendación",      motivo:"", impresiones:1 },
  { folio:"COT-0030", fechaCreacion:"2026-10-06", nombre:"Daniela Ibarra", estatus:"convertida", origen:"Redes sociales",     motivo:"", impresiones:8 }, // impresa muchas veces
];

async function main(){
  console.log("════════════════════════════════════════════════════");
  console.log("SEED — Cotizaciones para Estadísticas");
  console.log("════════════════════════════════════════════════════");
  console.log("Verificando que el emulador esté corriendo...");

  try{
    const ping = await fetch(`http://localhost:8080/`);
    if(!ping.ok) throw new Error("Emulador no responde");
    console.log("✓ Emulador de Firestore activo en localhost:8080\n");
  }catch(e){
    console.error("❌ No se puede conectar al emulador de Firestore.");
    console.error("   Arranca el emulador primero: firebase emulators:start");
    process.exit(1);
  }

  let creadas = 0;
  for(const c of COTIZACIONES){
    const id = "cot_seed_" + c.folio;
    const data = {
      id,
      folio: c.folio,
      nombre: c.nombre,
      telefono: "9210000000",
      marca: "",
      modelo: "",
      colorNombre: "",
      origen: c.origen,
      paquete: { tipo:"xv", componentes:[], adicionales:[] },
      precio: 0,
      precioPaquete: 0,
      promocion: "",
      fechaCita: c.fechaCreacion,
      fechaEvento: "",
      vigencia: "",
      anotaciones: "Semilla para pruebas de Estadísticas.",
      articuloId: null,
      descuentoPct: 0,
      descuentoBase: "ambos",
      descuentoMonto: 0,
      estatus: c.estatus,
      motivoNoRegreso: c.motivo,
      clienteFolioConvertido: null,
      impresiones: Array.from({length: c.impresiones}, (_,i)=>({
        fecha: c.fechaCreacion,
        usuario: "seed"
      })),
      cotizacionImagenUrl: "",
      fechaCreacion: c.fechaCreacion,
      creadoPor: "seed"
    };
    const ok = await crearCotizacion(id, data);
    if(ok) creadas++;
  }

  console.log("");
  console.log("════════════════════════════════════════════════════");
  console.log(`✓ ${creadas} de ${COTIZACIONES.length} cotizaciones sembradas.`);
  console.log("════════════════════════════════════════════════════");
  console.log("Abre el navegador → Cotizaciones → Estadísticas.");
  console.log("El selector debe mostrar los años: 2024, 2025, 2026.");
}

main();