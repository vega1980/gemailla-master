import { auth, login as loginWithEmailAndPassword, onAuthStateChanged, signOut } from '@/infrastructure/firebase/auth';

const mapFirebaseUserToDomainUser = (firebaseUser) => {
  if (!firebaseUser) {
    return null;
  }

  const authUid = firebaseUser.uid || firebaseUser.id;

  return {
    id: authUid,
    uid: authUid,
    email: firebaseUser.email,
    fullName: firebaseUser.displayName,
    role: 'user',
  };
};

export const authService = {
  subscribeToAuthChanges: (onSessionChange, onError) => onAuthStateChanged(
    auth,
    (firebaseUser) => onSessionChange(mapFirebaseUserToDomainUser(firebaseUser)),
    onError,
  ),
  login: (email, password) => loginWithEmailAndPassword(email, password),
  logout: () => signOut(),
};
