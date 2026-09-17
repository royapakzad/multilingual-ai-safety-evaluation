// services/authService.ts
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updatePassword,
  User as FirebaseUser
} from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signOut as secondarySignOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, firebaseConfig } from '../firebase.config';
import { User } from '../types';

export interface AuthState {
  user: User | null;
  loading: boolean;
}

// Create or get user profile from Firestore
const getUserProfile = async (firebaseUser: FirebaseUser): Promise<User> => {
  const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
  
  if (userDoc.exists()) {
    return userDoc.data() as User;
  } else {
    // Create new user profile
    const newUser: User = {
      email: firebaseUser.email || '',
      role: firebaseUser.email === 'rpakzad@taraazresearch.org' ? 'admin' : 'evaluator'
    };
    
    await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
    return newUser;
  }
};

export const signIn = async (email: string, password: string): Promise<User> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = await getUserProfile(userCredential.user);
    return user;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to sign in');
  }
};

// Creates a Firebase Auth account + Firestore profile for an approved access
// request. Runs on a throwaway secondary Firebase app instance so it doesn't
// sign the calling admin out of their own session (createUserWithEmailAndPassword
// always signs in as the newly created user on whichever app instance it runs on).
export const adminCreateAccount = async (email: string, tempPassword: string): Promise<string> => {
  const secondaryApp = initializeApp(firebaseConfig, `admin-create-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, tempPassword);
    const uid = userCredential.user.uid;
    const newUser: User = {
      email,
      role: email === 'rpakzad@taraazresearch.org' ? 'admin' : 'evaluator'
    };
    await setDoc(doc(db, 'users', uid), newUser);
    return uid;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to create account');
  } finally {
    await secondarySignOut(secondaryAuth).catch(() => {});
    await deleteApp(secondaryApp).catch(() => {});
  }
};

export const changePassword = async (newPassword: string): Promise<void> => {
  if (!auth.currentUser) {
    throw new Error('You must be signed in to change your password');
  }
  try {
    await updatePassword(auth.currentUser, newPassword);
  } catch (error: any) {
    if (error.code === 'auth/requires-recent-login') {
      throw new Error('For security, please sign out and back in, then try changing your password again.');
    }
    throw new Error(error.message || 'Failed to change password');
  }
};

export const signOut = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth);
  } catch (error: any) {
    throw new Error(error.message || 'Failed to sign out');
  }
};

export const onAuthStateChange = (callback: (authState: AuthState) => void): (() => void) => {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      try {
        const user = await getUserProfile(firebaseUser);
        callback({ user, loading: false });
      } catch (error) {
        console.error('Error getting user profile:', error);
        callback({ user: null, loading: false });
      }
    } else {
      callback({ user: null, loading: false });
    }
  });
};