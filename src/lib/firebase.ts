import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDSTPQp8e6McIkkm6arVD5tDjavL_cpIuo",
  authDomain: "prova-parana.firebaseapp.com",
  projectId: "prova-parana",
  storageBucket: "prova-parana.firebasestorage.app",
  messagingSenderId: "645022125554",
  appId: "1:645022125554:web:2bf8ee897dd786cdb32f6b"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Configure Firebase Auth persistence
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error('Erro ao configurar persistência do Firebase:', error);
});

export { auth };
export default app;