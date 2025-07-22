import React, { useState, useEffect } from 'react';
import { Users, ChevronDown, ChevronRight, BookOpen, ExternalLink } from 'lucide-react';
import { fetchProvaData, getLinkByHabilidadeComponente } from '../../lib/supabase';
import { DashboardFilters } from '../../types';

interface StudentsSectionProps {
  filters: DashboardFilters;
  userProfile: { unidade: string } | null;
}

interface StudentData {
  nome_aluno: string;
  unidade: string;
  semestre: string;
  componentes: {
    [key: string]: {
      componente: string;
      total_acertos: number;
      total_questoes: number;
      habilidades: Array<{
        habilidade_id: string;
        habilidade_codigo: string;
        acertos: number;
        total: number;
      }>;
    };
  };
}

const StudentsSection: React.FC<StudentsSectionProps> = ({ filters, userProfile }) => {
  const [studentsData, setStudentsData] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());
  const [linksCache, setLinksCache] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    loadStudentsData();
  }, [filters]);

  const loadStudentsData = async () => {
    setLoading(true);
    try {
      const data = await fetchProvaData({
        ...filters,
        unidade: userProfile?.unidade
      });

      // Group data by student
      const groupedData: { [key: string]: StudentData } = {};

      data.forEach((item: any) => {
        const studentKey = item.nome_aluno;
        
        if (!groupedData[studentKey]) {
          groupedData[studentKey] = {
            nome_aluno: item.nome_aluno,
            unidade: item.unidade,
            semestre: item.semestre,
            componentes: {}
          };
        }

        const componentKey = item.componente;
        if (!groupedData[studentKey].componentes[componentKey]) {
          groupedData[studentKey].componentes[componentKey] = {
            componente: item.componente === 'LP' ? 'Língua Portuguesa' : 'Matemática',
            total_acertos: 0,
            total_questoes: 0,
            habilidades: []
          };
        }

        if (item.avaliado) {
          groupedData[studentKey].componentes[componentKey].total_acertos += item.acertos;
          groupedData[studentKey].componentes[componentKey].total_questoes += item.total;
          groupedData[studentKey].componentes[componentKey].habilidades.push({
            habilidade_id: item.habilidade_id,
            habilidade_codigo: item.habilidade_codigo,
            acertos: item.acertos,
            total: item.total
          });
        }
      });

      const studentsArray = Object.values(groupedData).sort((a, b) => 
        a.nome_aluno.localeCompare(b.nome_aluno)
      );

      setStudentsData(studentsArray);
    } catch (error) {
      console.error('Erro ao carregar dados dos alunos:', error);
      setStudentsData([]);
    } finally {
      setLoading(false);
    }
  };

  const getQuestionLink = async (habilidadeCodigo: string, componente: string) => {
    const cacheKey = `${habilidadeCodigo}-${componente}`;
    
    if (linksCache.has(cacheKey)) {
      return linksCache.get(cacheKey);
    }

    try {
      const link = await getLinkByHabilidadeComponente(habilidadeCodigo, componente);
      const newCache = new Map(linksCache);
      newCache.set(cacheKey, link || '');
      setLinksCache(newCache);
      return link;
    } catch (error) {
      console.error('Erro ao buscar link:', error);
      return null;
    }
  };

  const handleQuestionLinkClick = async (habilidadeCodigo: string, componente: string) => {
    const link = await getQuestionLink(habilidadeCodigo, componente);
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer');
    } else {
      alert('Link não encontrado para esta habilidade');
    }
  };

  const toggleStudentExpansion = (studentName: string) => {
    const newExpanded = new Set(expandedStudents);
    if (newExpanded.has(studentName)) {
      newExpanded.delete(studentName);
    } else {
      newExpanded.add(studentName);
    }
    setExpandedStudents(newExpanded);
  };

  const toggleComponentExpansion = (key: string) => {
    const newExpanded = new Set(expandedComponents);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedComponents(newExpanded);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-indigo-100 p-2 rounded-lg">
          <Users className="w-5 h-5 text-indigo-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">
          Alunos ({studentsData.length})
        </h3>
      </div>

      <div className="space-y-3">
        {studentsData.length > 0 ? (
          studentsData.map((student) => (
            <div key={student.nome_aluno} className="border border-gray-200 rounded-lg">
              <button
                onClick={() => toggleStudentExpansion(student.nome_aluno)}
                className="w-full p-4 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
              >
                <div>
                  <h4 className="font-medium text-gray-900">{student.nome_aluno}</h4>
                  <p className="text-sm text-gray-600">
                    {student.unidade} • {student.semestre}º Semestre
                  </p>
                </div>
                {expandedStudents.has(student.nome_aluno) ? (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                )}
              </button>

              {expandedStudents.has(student.nome_aluno) && (
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  <div className="space-y-3">
                    {Object.entries(student.componentes).map(([componentKey, componentData]) => {
                      const componentExpandKey = `${student.nome_aluno}-${componentKey}`;
                      return (
                        <div key={componentKey} className="bg-white rounded-lg border border-gray-200">
                          <button
                            onClick={() => toggleComponentExpansion(componentExpandKey)}
                            className="w-full p-3 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <BookOpen className="w-4 h-4 text-blue-600" />
                              <div>
                                <p className="font-medium text-gray-900">{componentData.componente}</p>
                                <p className="text-sm text-gray-600">
                                  Nota: {componentData.total_acertos} / {componentData.total_questoes}
                                  {componentData.total_questoes > 0 && (
                                    <span className="ml-2 text-blue-600">
                                      ({((componentData.total_acertos / componentData.total_questoes) * 100).toFixed(1)}%)
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                            {expandedComponents.has(componentExpandKey) ? (
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            )}
                          </button>

                          {expandedComponents.has(componentExpandKey) && (
                            <div className="border-t border-gray-200 p-3 bg-gray-50">
                              <div className="space-y-2">
                                {componentData.habilidades.map((habilidade, index) => (
                                  <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                                    <div>
                                      <p className="text-sm font-medium text-gray-900">
                                        {habilidade.habilidade_id}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <div className="text-right">
                                      <p className="text-sm text-gray-600">
                                        {habilidade.acertos} / {habilidade.total}
                                      </p>
                                      {habilidade.total > 0 && (
                                        <p className="text-xs text-blue-600">
                                          {((habilidade.acertos / habilidade.total) * 100).toFixed(1)}%
                                        </p>
                                      )}
                                      </div>
                                      {habilidade.total > 0 && ((habilidade.acertos / habilidade.total) * 100) < 100 && (
                                        <button
                                          onClick={() => handleQuestionLinkClick(habilidade.habilidade_codigo, componentKey)}
                                          className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition-colors"
                                          title="Ver questão"
                                        >
                                          <ExternalLink className="w-4 h-4" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum aluno encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentsSection;