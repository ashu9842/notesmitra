import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');

/** Opens a Google sign-in popup and returns the Firebase ID token. */
export const signInWithGoogle = async (): Promise<string> => {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user.getIdToken();
};

/**
 * Creates a Firebase email/password user (or signs in if already exists)
 * and sends a verification email via Firebase's own email infrastructure.
 * Best-effort — never throws, so signup flow is never blocked.
 */
export const sendFirebaseVerificationEmail = async (email: string, password: string): Promise<void> => {
  const continueUrl = window.location.origin + '/?firebaseVerify=1';
  try {
    let firebaseUser;
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      firebaseUser = result.user;
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        const result = await signInWithEmailAndPassword(auth, email, password);
        firebaseUser = result.user;
      } else {
        return; // unexpected — skip silently
      }
    }
    if (!firebaseUser.emailVerified) {
      await sendEmailVerification(firebaseUser, { url: continueUrl });
    }
  } catch {
    // Best-effort — don't crash signup
  }
};

/**
 * Resend the Firebase verification email to the currently signed-in Firebase user.
 * auth.currentUser is populated by sendFirebaseVerificationEmail (signup) or
 * checkFirebaseEmailVerified (login), so it should always be set for logged-in users.
 */
export const resendFirebaseVerificationEmail = async (): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in. Please log out and log back in, then try again.');
  if (user.emailVerified) throw new Error('Email is already verified.');
  const continueUrl = window.location.origin + '/?firebaseVerify=1';
  await sendEmailVerification(user, { url: continueUrl });
};

/**
 * Signs in to Firebase with email/password, reloads the user to get fresh
 * emailVerified status, and returns true if the email is verified in Firebase.
 * Used at login to sync Firebase verification state to the backend.
 */
/**
 * Returns:
 *   true  — user exists in Firebase AND email is verified
 *   false — user exists in Firebase but email is NOT yet verified
 *   null  — user not found in Firebase (old account, no Firebase record), or network error
 */
export const checkFirebaseEmailVerified = async (email: string, password: string): Promise<boolean | null> => {
  try {
    let user = auth.currentUser;
    if (!user || user.email?.toLowerCase() !== email.toLowerCase()) {
      const result = await signInWithEmailAndPassword(auth, email, password);
      user = result.user;
    } else {
      await user.reload();
    }
    return auth.currentUser?.emailVerified ?? false;
  } catch {
    // null = Firebase doesn't know this user (old account) — don't show verification banner
    return null;
  }
};

/**
 * Send a sign-in link (magic link) to the given email via Firebase.
 * Works for ANY email provider — Gmail, Outlook, Hotmail, etc.
 * Used as the password-reset delivery mechanism (no SMTP setup required).
 */
export const sendPasswordResetLinkViaFirebase = async (email: string): Promise<void> => {
  const actionCodeSettings = {
    url: `${window.location.origin}/?passwordReset=1`,
    handleCodeInApp: true,
  };
  await sendSignInLinkToEmail(auth, email, actionCodeSettings);
  // Store email so we can complete sign-in when the user returns
  localStorage.setItem('nm_pr_email', email);
};

/**
 * Complete the Firebase email-link sign-in started by sendPasswordResetLinkViaFirebase.
 * Call this when the app loads with ?passwordReset=1 in the URL.
 * Returns { email, idToken } on success, null if the URL is not a valid email link.
 */
export const completeFirebasePasswordReset = async (): Promise<{ email: string; idToken: string } | null> => {
  if (!isSignInWithEmailLink(auth, window.location.href)) return null;
  const email = localStorage.getItem('nm_pr_email');
  if (!email) return null;
  try {
    const result = await signInWithEmailLink(auth, email, window.location.href);
    const idToken = await result.user.getIdToken();
    localStorage.removeItem('nm_pr_email');
    return { email, idToken };
  } catch {
    localStorage.removeItem('nm_pr_email');
    return null;
  }
};
