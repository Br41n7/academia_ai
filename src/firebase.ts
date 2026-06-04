import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { getFirestore, getDocFromServer, doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, onSnapshot, orderBy, getCountFromServer, increment, limit } from 'firebase/firestore';
export { 
  collection, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot, 
  orderBy,
  getCountFromServer,
  increment,
  limit
} from 'firebase/firestore';
export { getDocFromServer, doc };
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Auth Helpers
export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const signInWithGoogleRedirect = () => signInWithRedirect(auth, googleProvider);
export const getGoogleRedirectResult = () => getRedirectResult(auth);
export const signOut = () => auth.signOut();

// Connection Test
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    }
  }
}
testConnection();

// Error Handling Helper
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function awardPoints(userId: string, points: number) {
  try {
    const profileRef = doc(db, 'profiles', userId);
    const profileSnap = await getDoc(profileRef);
    
    if (profileSnap.exists()) {
      const data = profileSnap.data();
      const update: any = {
        points: increment(points),
        last_active_at: new Date().toISOString()
      };
      
      // Backfill missing profile info if available
      if (!data.full_name && auth.currentUser?.displayName) {
        update.full_name = auth.currentUser.displayName;
      }
      if (!data.avatar_url && auth.currentUser?.photoURL) {
        update.avatar_url = auth.currentUser.photoURL;
      }
      
      await updateDoc(profileRef, update);
    } else {
      // Create profile if it doesn't exist
      await setDoc(profileRef, {
        id: userId,
        full_name: auth.currentUser?.displayName || 'Anonymous Student',
        avatar_url: auth.currentUser?.photoURL || '',
        points: points,
        study_streak: 1,
        badges: [],
        role: 'user',
        last_active_at: new Date().toISOString()
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `profiles/${userId}`);
  }
}
