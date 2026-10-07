const firebaseConfig = {
  apiKey: "AIzaSyCA16iPWtJE_XEGfB6QoBvbn1kpUUCHjFA",
  authDomain: "rossdelune2026.firebaseapp.com",
  projectId: "rossdelune2026",
  storageBucket: "rossdelune2026.firebasestorage.app",
  messagingSenderId: "396024136594",
  appId: "1:396024136594:web:05286384348f6fbbe4374b",
  measurementId: "G-7Y4N4283TT"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
if(location.hostname==="localhost"||location.hostname==="127.0.0.1"){auth.useEmulator("http://localhost:9099");db.settings({host:"localhost:8080",ssl:false});console.log("🔧 Modo emulador activo");}

// Instancia secundaria de Firebase, SOLO para verificar credenciales de un
// segundo admin (modal de autorización de supervisor) sin cerrar la sesión
// del usuario que ya inició sesión — signInWithEmailAndPassword en la
// instancia principal reemplazaría la sesión activa, por eso se usa una
// instancia aislada aparte.
const secondaryApp = firebase.initializeApp(firebaseConfig,"secondary");

// La instancia secundaria debe apuntar también al emulador, para que el
// alta de colaboradores (saveWorker) cree el usuario en el emulador y no
// en la nube real. Va después de initializeApp porque necesita que la
// instancia exista primero.
if(location.hostname==="localhost"||location.hostname==="127.0.0.1"){
  secondaryApp.auth().useEmulator("http://localhost:9099");
  console.log("🔧 Secondary app apuntando al emulador");
}
// Colección "users" en Firestore: un documento por persona, ID = nombre de usuario.

// Firebase Authentication exige formato de correo, pero el formulario de
// login solo pide "usuario". Este sufijo arma un correo interno a partir
// del usuario: usuario "gerente" -> correo "gerente@rossdelune.app".
// No es un correo real, Firebase nunca le envía nada — solo lo usa como
// identificador único.
//
// IMPORTANTE: en Firebase Console → Authentication → Users, cada cuenta
// que crees ahí debe tener EXACTAMENTE este correo (usuario en minúsculas
// + este sufijo, sin espacios). Si no coincide letra por letra, el login
// falla sin mostrar un error claro.
const EMAIL_DOMAIN = "@rossdelune.app";

let currentUser = null, allUsers = [], allClientes = [];
let allCuentas = [];
let allGastos = [];
let allAccesorios = [];
let editingWorker = null;
let selectedColor = "#C8A8D0";