// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAEEGZcVyWr6J5CoLv4sU6UorHS5bI7Paw",
  authDomain: "vtttttuiiiiii.firebaseapp.com",
  databaseURL: "https://vtttttuiiiiii-default-rtdb.firebaseio.com",
  projectId: "vtttttuiiiiii",
  storageBucket: "vtttttuiiiiii.firebasestorage.app",
  messagingSenderId: "842223989154",
  appId: "1:842223989154:web:026d755635983a0eb342fb",
  measurementId: "G-FWPX5RLN4R"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const rtdb = firebase.database();
