// Firebase Web Authentication (Scripture Studio Main Dashboard)
const firebaseConfig = {
  apiKey: "AIzaSyCM5ZAhpxoT1oV5PqnXYe82gqfVzmYLB88",
  authDomain: "bible-a005d.firebaseapp.com",
  projectId: "bible-a005d",
  storageBucket: "bible-a005d.firebasestorage.app",
  messagingSenderId: "511311028262",
  appId: "1:511311028262:web:d1e4475f8c899c959886e7",
  measurementId: "G-HEZV6KNJL0"
};

// Initialize Firebase App
if (typeof firebase !== 'undefined') {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  const auth = firebase.auth();

  // UI Elements
  const btnGoogleLogin = document.getElementById('btnGoogleLogin');
  const userProfileBadge = document.getElementById('userProfileBadge');
  const userAvatar = document.getElementById('userAvatar');
  const userName = document.getElementById('userName');
  const userEmail = document.getElementById('userEmail');
  const btnLogout = document.getElementById('btnLogout');

  // Listen to Auth State
  auth.onAuthStateChanged((user) => {
    window.currentUser = user;

    if (user) {
      console.log('[Auth] User signed in:', user.displayName || user.email);
      if (btnGoogleLogin) btnGoogleLogin.classList.add('hidden');
      if (userProfileBadge) userProfileBadge.classList.remove('hidden');

      if (userAvatar) userAvatar.src = user.photoURL || 'https://lh3.googleusercontent.com/a/default-user';
      if (userName) userName.textContent = user.displayName || user.email.split('@')[0];
      if (userEmail) userEmail.textContent = user.email || '';

      window.dispatchEvent(new CustomEvent('auth-changed', { detail: { user } }));
    } else {
      console.log('[Auth] No user signed in.');
      if (btnGoogleLogin) btnGoogleLogin.classList.remove('hidden');
      if (userProfileBadge) userProfileBadge.classList.add('hidden');

      window.dispatchEvent(new CustomEvent('auth-changed', { detail: { user: null } }));
    }
  });

  // Clicking "Sign in with Google" button
  if (btnGoogleLogin) {
    btnGoogleLogin.addEventListener('click', async () => {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      try {
        await auth.signInWithPopup(provider);
      } catch (err) {
        console.warn('[Auth] Popup failed, redirecting to dedicated login page:', err.message);
        // Fallback to dedicated login page
        window.location.href = '/login.html';
      }
    });
  }

  // Logout button
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      sessionStorage.removeItem('scripture_guest');
      await auth.signOut();
      window.location.replace('/login.html');
    });
  }
}
