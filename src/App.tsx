import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { auth } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getUserProfile } from './lib/supabase';
import LoginForm from './components/Auth/LoginForm';
import SystemSelection from './components/SystemSelection/SystemSelection';
import Navbar from './components/Navigation/Navbar';
import Dashboard from './components/Dashboard/Dashboard';
import UploadForm from './components/Upload/UploadForm';
import UploadFormParceiro from './components/Upload/UploadFormParceiro';
import CadastrarAtividades from './components/CadastrarAtividades/CadastrarAtividades';
import Graficos from './components/Graficos/Graficos';
import ComparacaoProvas from './components/ComparacaoProvas/ComparacaoProvas';
import ComparativoSemestres from './components/ComparativoSemestres/ComparativoSemestres';
import VisaoGeral from './components/VisaoGeral/VisaoGeral';
import { UserProfile } from './types';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSystem, setSelectedSystem] = useState<'prova-parana' | 'parceiro' | null>(() => {
    return (localStorage.getItem('selectedSystem') as 'prova-parana' | 'parceiro') || null;
  });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'upload' | 'atividades' | 'graficos' | 'comparacao' | 'semestres' | 'visaogeral'>(() => {
    return (localStorage.getItem('activeTab') as 'dashboard' | 'upload' | 'atividades' | 'graficos' | 'comparacao' | 'semestres' | 'visaogeral') || 'dashboard';
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

  useEffect(() => {
    if (selectedSystem) {
      localStorage.setItem('selectedSystem', selectedSystem);
    }
  }, [selectedSystem]);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      localStorage.removeItem('activeTab');
      localStorage.removeItem('selectedSystem');
      setUser(null);
      setUserProfile(null);
      setSelectedSystem(null);
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  const handleSystemSelect = (system: 'prova-parana' | 'parceiro') => {
    setSelectedSystem(system);
    setActiveTab('dashboard'); // Reset to dashboard when switching systems
  };

  const handleSystemSwitch = () => {
    setSelectedSystem(null);
    setActiveTab('dashboard');
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

  if (!selectedSystem) {
    return <SystemSelection onSystemSelect={handleSystemSelect} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar 
        user={user} 
        userProfile={userProfile}
        onLogout={handleLogout}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        selectedSystem={selectedSystem}
        onSystemSwitch={handleSystemSwitch}
      />
      
      <main className="container mx-auto px-4 py-8">
        {activeTab === 'visaogeral' ? (
          <VisaoGeral userProfile={userProfile} selectedSystem={selectedSystem} />
        ) : activeTab === 'dashboard' ? (
          <Dashboard userProfile={userProfile} selectedSystem={selectedSystem} />
        ) : activeTab === 'upload' ? (
          selectedSystem === 'prova-parana' ? (
            <UploadForm userProfile={userProfile} />
          ) : (
            <UploadFormParceiro userProfile={userProfile} />
          )
        ) : activeTab === 'graficos' ? (
          <Graficos userProfile={userProfile} selectedSystem={selectedSystem} />
        ) : activeTab === 'comparacao' ? (
          <ComparacaoProvas userProfile={userProfile} />
        ) : activeTab === 'semestres' ? (
          <ComparativoSemestres userProfile={userProfile} selectedSystem={selectedSystem} />
        ) : (
          <CadastrarAtividades selectedSystem={selectedSystem} />
        )}
      </main>
    </div>
  );
}

export default App;