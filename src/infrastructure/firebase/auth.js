export { auth } from '@/firebase';
export { onAuthStateChanged } from 'firebase/auth';

export const getCurrentUser = () => auth.currentUser;
export const signOut = (...args) => auth.signOut(...args);
