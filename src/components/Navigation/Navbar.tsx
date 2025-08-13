import React from 'react';
import { School, BarChart3, Upload, LogOut, BookOpen, PieChart } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { signOut } from 'firebase/auth';
import { User } from 'firebase/auth';
import { UserProfile } from '../../types';

interface NavbarProps {
  user: User;
  userProfile: UserProfile | null;
  onLogout: () => void;
  activeTab: 'dashboard' | 'upload' | 'atividades' | 'graficos';
  onTabChange: (tab: 'dashboard' | 'upload' | 'atividades' | 'graficos') => void;
}

const Navbar: React.FC<NavbarProps> = ({ 
  user,
  userProfile,
  onLogout,
  activeTab, 
  onTabChange
}) => {
  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <School className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Prova Paraná</h1>
                <p className="text-xs text-gray-500">{userProfile?.unidade}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => onTabChange('dashboard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'dashboard'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Dashboard
            </button>
            {/*<button
              onClick={() => onTabChange('upload')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'upload'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Upload className="w-4 h-4" />
              Upload
            </button>*/}
            <button
              onClick={() => onTabChange('graficos')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'graficos'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <PieChart className="w-4 h-4" />
              Gráficos
            </button>
            {/*<button
              onClick={() => onTabChange('atividades')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'atividades'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Cadastrar Atividades
            </button>*/}
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{user.email}</p>
              <p className="text-xs text-gray-500">Administrador</p>
            </div>
            <button
              onClick={onLogout}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Sair"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
