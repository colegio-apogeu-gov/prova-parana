import React from 'react';
import { School, Users, BookOpen, BarChart3 } from 'lucide-react';

interface SystemSelectionProps {
  onSystemSelect: (system: 'prova-parana' | 'parceiro') => void;
}

const SystemSelection: React.FC<SystemSelectionProps> = ({ onSystemSelect }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <School className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Sistema de Avaliação Educacional</h1>
          <p className="text-xl text-gray-600">Escolha o sistema que deseja acessar</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Prova Paraná */}
          <div 
            onClick={() => onSystemSelect('prova-parana')}
            className="bg-white rounded-2xl shadow-xl p-8 cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-2xl border-2 border-transparent hover:border-blue-200"
          >
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <BarChart3 className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Prova Paraná Recomposição</h2>
              <p className="text-gray-600 mb-6">
                Sistema oficial de avaliação educacional do estado do Paraná para análise de desempenho dos estudantes.
              </p>
              <div className="space-y-2 text-sm text-gray-500">
                <div className="flex items-center justify-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>9º ano e 3º ano</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  <span>Língua Portuguesa e Matemática</span>
                </div>
              </div>
            </div>
          </div>

          {/* Avaliação Parceiro da Escola */}
          <div 
            onClick={() => onSystemSelect('parceiro')}
            className="bg-white rounded-2xl shadow-xl p-8 cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-2xl border-2 border-transparent hover:border-green-200"
          >
            <div className="text-center">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <School className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Avaliação Parceiro da Escola</h2>
              <p className="text-gray-600 mb-6">
                Sistema de avaliação complementar para análise detalhada do desempenho educacional com métricas específicas.
              </p>
              <div className="space-y-2 text-sm text-gray-500">
                <div className="flex items-center justify-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>8º ano e 2º ano</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  <span>Língua Portuguesa e Matemática</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">
            Selecione o sistema adequado para sua instituição de ensino
          </p>
        </div>
      </div>
    </div>
  );
};

export default SystemSelection;