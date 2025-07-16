import { auth } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

// Helper to get current Firebase user
export const getCurrentUser = () => {
  return auth.currentUser;
};

// Helper to get current Firebase user with promise
export const getCurrentUserAsync = (): Promise<User | null> => {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
};

// Helper to check if user is authenticated
export const isAuthenticated = () => {
  return !!auth.currentUser;
};

// Helper to refresh user token
export const refreshUserToken = async () => {
  const user = getCurrentUser();
  if (user) {
    try {
      await user.getIdToken(true);
      return true;
    } catch (error) {
      console.error('Erro ao renovar token:', error);
      return false;
    }
  }
  return false;
};