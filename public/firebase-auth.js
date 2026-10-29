// Firebase Web Authentication (Google Sign-In)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCM5ZAhpxoT1oV5PqnXYe82gqfVzmYLB88",
  authDomain: "bible-a005d.firebaseapp.com",
  projectId: "bible-a005d",
  storageBucket: "bible-a005d.firebasestorage.app",
  messagingSenderId: "511311028262",
  appId: "1:511311028262:web:d1e4475f8c899c959886e7",
  measurementId: "G-HEZV6KNJL0"
};

// Initialize Firebase App & Auth
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

// UI Elements
const btnGoogleLogin = document.getElementById('btnGoogleLogin');
const userProfileBadge = document.getElementById('userProfileBadge');
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');
const userEmail = document.getElementById('userEmail');
const btnLogout = document.getElementById('btnLogout');

// Sign In with Google Popup
export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    console.log('[FirebaseAuth] Signed in successfully:', user.displayName);
    return user;
  } catch (error) {
    console.error('[FirebaseAuth] Error signing in with Google:', error);
    if (error.code === 'auth/unauthorized-domain') {
      alert(
        'Domain not authorized in Firebase!\n\n' +
        'Please go to Firebase Console > Authentication > Settings > Authorized domains, and make sure your current domain (e.g. localhost or vercel.app) is added.'
      );
    } else if (error.code !== 'auth/popup-closed-by-user') {
      alert(`Google Sign-In Error: ${error.message}`);
    }
    throw error;
  }
}

// Sign Out
export async function logoutUser() {
  try {
    await signOut(auth);
    console.log('[FirebaseAuth] Signed out successfully.');
  } catch (error) {
    console.error('[FirebaseAuth] Error signing out:', error);
  }
}

// Listen to Auth State Changes
onAuthStateChanged(auth, (user) => {
  window.currentUser = user;

  if (user) {
    // User is signed in
    if (btnGoogleLogin) btnGoogleLogin.classList.add('hidden');
    if (userProfileBadge) userProfileBadge.classList.remove('hidden');

    if (userAvatar) userAvatar.src = user.photoURL || 'https://lh3.googleusercontent.com/a/default-user';
    if (userName) userName.textContent = user.displayName || 'Believer';
    if (userEmail) userEmail.textContent = user.email || '';

    // Dispatch custom event for app.js
    window.dispatchEvent(new CustomEvent('auth-changed', { detail: { user } }));
  } else {
    // User is signed out
    if (btnGoogleLogin) btnGoogleLogin.classList.remove('hidden');
    if (userProfileBadge) userProfileBadge.classList.add('hidden');

    window.dispatchEvent(new CustomEvent('auth-changed', { detail: { user: null } }));
  }
});

// Event Listeners for Header Buttons
if (btnGoogleLogin) {
  btnGoogleLogin.addEventListener('click', loginWithGoogle);
}

if (btnLogout) {
  btnLogout.addEventListener('click', logoutUser);
}
