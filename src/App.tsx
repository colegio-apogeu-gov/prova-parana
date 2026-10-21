import React, { useState, useEffect, useMemo } from 'react';
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
import Descritores from './components/Descritores/Descritores';
import EnemDashboard from './components/Enem/EnemDashboard';
import IdebDashboard from './components/Ideb/IdebDashboard';
import AuditoriaDashboard from './components/Auditoria/AuditoriaDashboard';
import Graficos from './components/Graficos/Graficos';
import ComparacaoProvas from './components/ComparacaoProvas/ComparacaoProvas';
import ComparativoSemestres from './components/ComparativoSemestres/ComparativoSemestres';
import ComparacaoAnual from './components/ComparacaoAnual/ComparacaoAnual';
import { EscolhaEscola } from './components/common/SeletorEscola';
import { UserProfile, isCsc } from './types';
import { podeAuditar, registrarLogin, registrarInteracao, sistemaLabel } from './lib/auditoria';
import { EscolaCscProvider } from './lib/escolaCsc';

// Sistemas do Mapa APG. 'enem', 'ideb' e 'auditoria' são dashboards próprios (tela cheia).
type SelectedSystem = 'prova-parana' | 'parceiro' | 'parana-mais' | 'enem' | 'ideb' | 'auditoria';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  // Escola escolhida pelo CSC ('' = nenhuma). Vale para todas as abas e sistemas
  // até trocar de escola ou sair.
  const [escolaCsc, setEscolaCsc] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedSystem, setSelectedSystem] = useState<SelectedSystem | null>(() => {
    return (localStorage.getItem('selectedSystem') as SelectedSystem) || null;
  });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'upload' | 'atividades' | 'descritores' | 'graficos' | 'comparacao' | 'semestres' | 'comparacao-anual'>(() => {
    const stored = localStorage.getItem('activeTab');
    // 'visaogeral' foi removido; ignora valores antigos/inválidos salvos no localStorage.
    const validTabs = ['dashboard', 'upload', 'atividades', 'descritores', 'graficos', 'comparacao', 'semestres', 'comparacao-anual'];
    return (stored && validTabs.includes(stored) ? stored : 'dashboard') as
      'dashboard' | 'upload' | 'atividades' | 'descritores' | 'graficos' | 'comparacao' | 'semestres' | 'comparacao-anual';
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Registra o login na auditoria (fire-and-forget; nunca bloqueia o fluxo).
        registrarLogin(firebaseUser.uid, firebaseUser.metadata?.lastSignInTime ?? null);
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

  // 'Comparação Semestres' só existe para prova-parana. Se o usuário trocar de
  // sistema (ou tiver essa aba salva), volta para o dashboard.
  useEffect(() => {
    if (activeTab === 'semestres' && selectedSystem !== 'prova-parana') {
      setActiveTab('dashboard');
    }
  }, [activeTab, selectedSystem]);

  useEffect(() => {
    if (selectedSystem) {
      localStorage.setItem('selectedSystem', selectedSystem);
    }
  }, [selectedSystem]);

  // Auditoria: registra a "última interação" do usuário. Grava ao trocar de
  // sistema e a cada atividade (clique/tecla), com throttle interno (~2 min) para
  // não sobrecarregar o banco. O rótulo é o sistema atual (ou "Seleção de sistema").
  useEffect(() => {
    if (!user) return;
    const label = sistemaLabel(selectedSystem);
    registrarInteracao(user.uid, label);
    const handler = () => registrarInteracao(user.uid, label);
    window.addEventListener('pointerdown', handler);
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
    };
  }, [user, selectedSystem]);

  // CSC não tem escola fixa: as telas recebem um perfil com a unidade = escola
  // escolhida, e funcionam exatamente como para um usuário daquela escola.
  const csc = isCsc(userProfile);
  const perfilEfetivo = useMemo<UserProfile | null>(
    () => (csc && userProfile ? { ...userProfile, unidade: escolaCsc } : userProfile),
    [csc, userProfile, escolaCsc]
  );
  const escolaCscCtx = useMemo(
    () => (csc ? { escola: escolaCsc, setEscola: setEscolaCsc } : null),
    [csc, escolaCsc]
  );

  const handleLogout = async () => {
    try {
      await auth.signOut();
      localStorage.removeItem('activeTab');
      localStorage.removeItem('selectedSystem');
      setUser(null);
      setUserProfile(null);
      setEscolaCsc('');
      setSelectedSystem(null);
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  const handleSystemSelect = (system: SelectedSystem) => {
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
    return <SystemSelection onSystemSelect={handleSystemSelect} canAudit={podeAuditar(userProfile)} />;
  }

  // ENEM, IDEB e Auditoria são dashboards próprios (tela cheia).
  if (selectedSystem === 'enem') {
    return <EnemDashboard onSystemSwitch={handleSystemSwitch} onLogout={handleLogout} />;
  }

  if (selectedSystem === 'ideb') {
    return <IdebDashboard onSystemSwitch={handleSystemSwitch} onLogout={handleLogout} />;
  }

  if (selectedSystem === 'auditoria') {
    // Guarda de acesso: se não tiver permissão (ex.: seleção antiga no
    // localStorage), volta para a tela de seleção em vez de abrir a Auditoria.
    if (!podeAuditar(userProfile)) {
      return <SystemSelection onSystemSelect={handleSystemSelect} canAudit={false} />;
    }
    return <AuditoriaDashboard userProfile={userProfile} onSystemSwitch={handleSystemSwitch} onLogout={handleLogout} />;
  }

  return (
    <EscolaCscProvider value={escolaCscCtx}>
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

        {/* key: para o CSC, trocar de escola remonta as telas (filtros e dados recomeçam). */}
        <main key={escolaCsc} className="container mx-auto px-4 py-8">
          {csc && !escolaCsc ? (
            <EscolhaEscola />
          ) : activeTab === 'dashboard' ? (
            <Dashboard userProfile={perfilEfetivo} selectedSystem={selectedSystem} />
          ) : activeTab === 'upload' ? (
            selectedSystem === 'prova-parana' ? (
              <UploadForm userProfile={perfilEfetivo} />
            ) : (
              <UploadFormParceiro userProfile={perfilEfetivo} selectedSystem={selectedSystem} />
            )
          ) : activeTab === 'graficos' ? (
            <Graficos userProfile={perfilEfetivo} selectedSystem={selectedSystem} />
          ) : activeTab === 'comparacao' ? (
            <ComparacaoProvas userProfile={perfilEfetivo} />
          ) : activeTab === 'semestres' ? (
            <ComparativoSemestres userProfile={perfilEfetivo} selectedSystem={selectedSystem} />
          ) : activeTab === 'comparacao-anual' ? (
            <ComparacaoAnual userProfile={perfilEfetivo} selectedSystem={selectedSystem} />
          ) : activeTab === 'descritores' ? (
            <Descritores selectedSystem={selectedSystem} userProfile={perfilEfetivo} />
          ) : (
            <CadastrarAtividades selectedSystem={selectedSystem} />
          )}
        </main>
      </div>
    </EscolaCscProvider>
  );
}

export default App;