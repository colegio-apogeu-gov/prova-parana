import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { auth } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getUserProfile } from './lib/supabase';
import LoginForm from './components/Auth/LoginForm';
import Navbar from './components/Navigation/Navbar';
import Dashboard from './components/Dashboard/Dashboard';
import UploadForm from './components/Upload/UploadForm';
import CadastrarAtividades from './components/CadastrarAtividades/CadastrarAtividades';
import Graficos from './components/Graficos/Graficos';
import { UserProfile } from './types';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'upload' | 'atividades' | 'graficos'>(() => {
    return (localStorage.getItem('activeTab') as 'dashboard' | 'upload' | 'atividades' | 'graficos') || 'dashboard';
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          // Load user profile
          try {
            const profile = await getUserProfile(firebaseUser.uid);
            setUserProfile(profile);
          } catch (error: any) {
            if (error.code !== 'PGRST116') {
              console.error('Erro ao carregar perfil:', error);
            }
          }
        } catch (error) {
          console.error('Erro ao carregar dados do usuário:', error);
        }
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      localStorage.removeItem('activeTab');
      setUser(null);
      setUserProfile(null);
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm onLogin={setUser} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar 
        user={user} 
        userProfile={userProfile}
        onLogout={handleLogout}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      
      <main className="container mx-auto px-4 py-8">
        {activeTab === 'dashboard' ? (
          <Dashboard userProfile={userProfile} />
        ) : activeTab === 'upload' ? (
          <UploadForm userProfile={userProfile} />
        ) : activeTab === 'graficos' ? (
          <Graficos userProfile={userProfile} />
        ) : (
          <CadastrarAtividades />
        )}
      </main>
    </div>
  );
}

export default App;