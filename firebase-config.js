/*
  Brinka Web — Firebase opcional

  A app funciona já em modo localStorage.
  Para sincronizar entre PC e iPhone:
  1. Cria projeto Firebase
  2. Ativa Firestore Database
  3. Cola aqui a configuração da tua app web
  4. Muda BRINKA_FIREBASE_ENABLED para true
*/

window.BRINKA_FIREBASE_ENABLED = false;

window.BRINKA_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCxdAnxDKikfKyzAvV9RHxOk-FyJbgCqa0",
  authDomain: "app-brinka.firebaseapp.com",
  projectId: "app-brinka",
  storageBucket: "app-brinka.firebasestorage.app",
  messagingSenderId: "1030667180151",
  appId: "1:1030667180151:web:a97f74baa1471220be8e72"
};
