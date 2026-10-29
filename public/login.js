// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCM5ZAhpxoT1oV5PqnXYe82gqfVzmYLB88",
  authDomain: "bible-a005d.firebaseapp.com",
  projectId: "bible-a005d",
  storageBucket: "bible-a005d.firebasestorage.app",
  messagingSenderId: "511311028262",
  appId: "1:511311028262:web:d1e4475f8c899c959886e7",
  measurementId: "G-HEZV6KNJL0"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();

// UI Elements
const btnGoogleSignIn = document.getElementById('btnGoogleSignIn');
const emailAuthForm = document.getElementById('emailAuthForm');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const btnSubmitEmail = document.getElementById('btnSubmitEmail');
const submitBtnText = document.getElementById('submitBtnText');
const toggleAuthText = document.getElementById('toggleAuthText');
const toggleAuthLink = document.getElementById('toggleAuthLink');
const authAlert = document.getElementById('authAlert');

let isSignUpMode = true;

// If already signed in, redirect to home
auth.onAuthStateChanged((user) => {
  if (user) {
    console.log('[Login] Already authenticated as:', user.email);
    window.location.href = '/';
  }
});

// 1. Google Sign-In Handler
btnGoogleSignIn.addEventListener('click', async () => {
  btnGoogleSignIn.disabled = true;
  hideAlert();

  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    const result = await auth.signInWithPopup(provider);
    console.log('[Login] Google sign-in success:', result.user.displayName);
    window.location.href = '/';
  } catch (error) {
    console.error('[Login] Google sign-in error:', error);
    btnGoogleSignIn.disabled = false;

    if (error.code === 'auth/popup-blocked') {
      // If popup was blocked by browser, try redirect flow
      console.log('[Login] Popup was blocked, redirecting instead...');
      auth.signInWithRedirect(provider);
      return;
    }

    if (error.code === 'auth/operation-not-allowed') {
      showAlert(
        '⚠️ Google Sign-In is not enabled yet in your Firebase Console!<br>' +
        'Please go to <b>Firebase Console > Authentication > Sign-in method > Google</b> and click <b>Save</b> at the bottom.'
      );
    } else if (error.code === 'auth/unauthorized-domain') {
      showAlert(
        `⚠️ Domain not authorized!<br>` +
        `Please add "<b>${window.location.hostname}</b>" to Firebase Console > Authentication > Settings > Authorized domains.`
      );
    } else if (error.code === 'auth/popup-closed-by-user') {
      showAlert('Sign-in popup was closed before completing. Please try again.');
    } else {
      showAlert(`Sign-in error: ${error.message}`);
    }
  }
});

// Check for redirect result if returning from redirect
auth.getRedirectResult().then((result) => {
  if (result.user) {
    window.location.href = '/';
  }
}).catch((error) => {
  if (error.code) showAlert(`Redirect sign-in error: ${error.message}`);
});

// 2. Email & Password Form Handler
emailAuthForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = authEmail.value.trim();
  const password = authPassword.value;

  btnSubmitEmail.disabled = true;
  hideAlert();

  try {
    if (isSignUpMode) {
      // Create Account
      await auth.createUserWithEmailAndPassword(email, password);
      console.log('[Login] Account created successfully');
      window.location.href = '/';
    } else {
      // Sign In
      await auth.signInWithEmailAndPassword(email, password);
      console.log('[Login] Signed in successfully');
      window.location.href = '/';
    }
  } catch (error) {
    btnSubmitEmail.disabled = false;
    console.error('[Login] Email auth error:', error);

    if (error.code === 'auth/operation-not-allowed') {
      showAlert(
        '⚠️ Email/Password sign-in is not enabled in Firebase!<br>' +
        'Please go to <b>Firebase Console > Authentication > Sign-in method > Email/Password</b> and enable it, or use Google Sign-In above.'
      );
    } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      showAlert('Invalid email or password. If you do not have an account yet, click "Sign Up" below.');
    } else if (error.code === 'auth/email-already-in-use') {
      showAlert('An account with this email already exists. Please switch to "Sign In".');
    } else {
      showAlert(error.message);
    }
  }
});

// 3. Toggle between Sign In and Sign Up
toggleAuthLink.addEventListener('click', (e) => {
  e.preventDefault();
  isSignUpMode = !isSignUpMode;

  if (isSignUpMode) {
    submitBtnText.textContent = 'Create Free Account';
    toggleAuthText.innerHTML = 'Already have an account? <a href="#" id="toggleAuthLink">Sign In</a>';
  } else {
    submitBtnText.textContent = 'Sign In';
    toggleAuthText.innerHTML = 'Don\'t have an account? <a href="#" id="toggleAuthLink">Sign Up</a>';
  }

  // Re-bind the link
  document.getElementById('toggleAuthLink').addEventListener('click', arguments.callee);
  hideAlert();
});

function showAlert(htmlMessage) {
  authAlert.innerHTML = htmlMessage;
  authAlert.classList.remove('hidden');
}

function hideAlert() {
  authAlert.innerHTML = '';
  authAlert.classList.add('hidden');
}

// 4. Continue as Guest Handler
const btnGuest = document.querySelector('.btn-guest');
if (btnGuest) {
  btnGuest.addEventListener('click', (e) => {
    e.preventDefault();
    sessionStorage.setItem('scripture_guest', 'true');
    window.location.href = '/';
  });
}
