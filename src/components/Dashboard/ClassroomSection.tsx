import React, { useState, useEffect } from 'react';
import { Users, Plus, ChevronDown, ChevronRight, UserPlus, UserMinus, Trash2, X, Search, Brain, ExternalLink, Download } from 'lucide-react';
import { getSalasDeAula, createSalaDeAula, addAlunoToSala, removeAlunoFromSala, deleteSalaDeAula, getAlunosDisponiveis, fetchProvaData, getLinkByHabilidadeComponente } from '../../lib/supabase';
import {
  getSalasDeAulaParceiro,
  addAlunoToSalaParceiro,
  removeAlunoFromSalaParceiro,
  createSalaDeAulaParceiro,
  fetchProvaDataParceiro,
  getLinkByHabilidadeComponenteParceiro,
  getAlunosDisponivelParceiro
} from '../../lib/supabaseParceiro';

import { SalaDeAula, SalaDeAulaAluno, DashboardFilters } from '../../types';
import { GoogleGenerativeAI } from "@google/generative-ai";
import jsPDF from 'jspdf';

const apiMap = (system: 'prova-parana' | 'parceiro') => ({
  getSalasDeAula: system === 'prova-parana' ? getSalasDeAula : getSalasDeAulaParceiro,
  addAlunoToSala: system === 'prova-parana' ? addAlunoToSala : addAlunoToSalaParceiro,
  removeAlunoFromSala: system === 'prova-parana' ? removeAlunoFromSala : removeAlunoFromSalaParceiro,
  createSalaDeAula: system === 'prova-parana' ? createSalaDeAula : createSalaDeAulaParceiro,
  fetchProvaData: system === 'prova-parana' ? fetchProvaData : fetchProvaDataParceiro,
  getLinkByHabilidadeComponente: system === 'prova-parana' ? getLinkByHabilidadeComponente : getLinkByHabilidadeComponenteParceiro,
});


interface ClassroomSectionProps {
  userProfile: { unidade: string } | null;
  filters: DashboardFilters;
  selectedSystem: 'prova-parana' | 'parceiro'; // ADICIONE
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
        descricao: string;
        acertos: number;
        total: number;
      }>;
    };
  };
}

// antes: ({ userProfile, filters })
const ClassroomSection: React.FC<ClassroomSectionProps> = ({ userProfile, filters, selectedSystem }) => {
  const [salas, setSalas] = useState<(SalaDeAula & { sala_de_aula_alunos: SalaDeAulaAluno[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedSalas, setExpandedSalas] = useState<Set<string>>(new Set());
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());
  const [studentsData, setStudentsData] = useState<{ [key: string]: StudentData }>({});
  const [alunosDisponiveis, setAlunosDisponiveis] = useState<Array<{ nome_aluno: string; turma: string }>>([]);
  const [filteredAlunos, setFilteredAlunos] = useState<Array<{ nome_aluno: string; turma: string }>>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [addingStudents, setAddingStudents] = useState<{ [key: string]: boolean }>({});
  const [generatingInsights, setGeneratingInsights] = useState<Set<string>>(new Set());
  const [linksCache, setLinksCache] = useState<Map<string, string>>(new Map());
  
  const [form, setForm] = useState({
    nome: '',
    alunos: [] as Array<{ nome_aluno: string; turma: string }>
  });

  useEffect(() => {
    if (userProfile?.unidade) {
      loadSalas();
      loadAlunosDisponiveis();
    }
  }, [userProfile, selectedSystem]);

  const loadSalas = async () => {
    if (!userProfile?.unidade) return;
    
    setLoading(true);
    try {
      const data = await apiMap(selectedSystem).getSalasDeAula(userProfile.unidade);
      setSalas(data);
    } catch (error) {
      console.error('Erro ao carregar salas:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAlunosDisponiveis = async () => {
    if (!userProfile?.unidade) return;
    
    try {
      const getAlunosFn = selectedSystem === 'prova-parana' ? getAlunosDisponiveis : getAlunosDisponivelParceiro;
      const alunos = await getAlunosFn({
        unidade: userProfile.unidade,
        ...filters
      });
      setAlunosDisponiveis(alunos);
      setFilteredAlunos(alunos);
    } catch (error) {
      console.error('Erro ao carregar alunos disponíveis:', error);
    }
  };

  // Filtrar alunos baseado no termo de busca
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredAlunos(alunosDisponiveis);
    } else {
      const filtered = alunosDisponiveis.filter(aluno =>
        aluno.nome_aluno.toLowerCase().includes(searchTerm.toLowerCase()) ||
        aluno.turma.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredAlunos(filtered);
    }
  }, [searchTerm, alunosDisponiveis]);

  const loadStudentData = async (nomeAluno: string, turma: string) => {
    const studentKey = `${nomeAluno}-${turma}`;
    
    if (studentsData[studentKey]) return;

    try {
      const data = await apiMap(selectedSystem).fetchProvaData({...filters,
        unidade: userProfile?.unidade,
        nome_aluno: nomeAluno});

      const groupedData: StudentData = {
        nome_aluno: nomeAluno,
        unidade: userProfile?.unidade || '',
        semestre: '1',
        componentes: {}
      };

      data.forEach((item: any) => {
        if (item.nome_aluno === nomeAluno) {
          const componentKey = item.componente;
          if (!groupedData.componentes[componentKey]) {
            groupedData.componentes[componentKey] = {
              componente: item.componente === 'LP' ? 'Língua Portuguesa' : 'Matemática',
              total_acertos: 0,
              total_questoes: 0,
              habilidades: []
            };
          }

          if (item.avaliado) {
            groupedData.componentes[componentKey].total_acertos += item.acertos;
            groupedData.componentes[componentKey].total_questoes += item.total;
            groupedData.componentes[componentKey].habilidades.push({
              habilidade_id: item.habilidade_id,
              habilidade_codigo: item.habilidade_codigo,
              descricao: item.descricao_habilidade,
              acertos: item.acertos,
              total: item.total
            });
          }
        }
      });

      setStudentsData(prev => ({
        ...prev,
        [studentKey]: groupedData
      }));
    } catch (error) {
      console.error('Erro ao carregar dados do aluno:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile?.unidade) return;

    try {
      await 
      apiMap(selectedSystem).createSalaDeAula({nome: form.nome,
        unidade: userProfile.unidade,
        alunos: form.alunos});
      
      await loadSalas();
      setForm({ nome: '', alunos: [] });
      setShowForm(false);
    } catch (error) {
      console.error('Erro ao criar sala:', error);
    }
  };

  const toggleSalaExpansion = (salaId: string) => {
    const newExpanded = new Set(expandedSalas);
    if (newExpanded.has(salaId)) {
      newExpanded.delete(salaId);
    } else {
      newExpanded.add(salaId);
    }
    setExpandedSalas(newExpanded);
  };

  const toggleStudentExpansion = async (studentKey: string, nomeAluno: string, turma: string) => {
    const newExpanded = new Set(expandedStudents);
    if (newExpanded.has(studentKey)) {
      newExpanded.delete(studentKey);
    } else {
      newExpanded.add(studentKey);
      await loadStudentData(nomeAluno, turma);
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

  const handleAddStudent = async (salaId: string, aluno: { nome_aluno: string; turma: string }) => {
    try {
      setAddingStudents(prev => ({ ...prev, [salaId]: true }));
      await apiMap(selectedSystem).addAlunoToSala(salaId, aluno);
      await loadSalas();
    } catch (error) {
      console.error('Erro ao adicionar aluno:', error);
    } finally {
      setAddingStudents(prev => ({ ...prev, [salaId]: false }));
    }
  };

  const handleRemoveStudent = async (alunoId: string) => {
    if (!confirm('Tem certeza que deseja remover este aluno da sala?')) return;
    
    try {
      await apiMap(selectedSystem).removeAlunoFromSala(alunoId);
      await loadSalas();
    } catch (error) {
      console.error('Erro ao remover aluno:', error);
    }
  };

  const handleDeleteSala = async (salaId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta sala de aula?')) return;
    
    try {
      await deleteSalaDeAula(salaId);
      await loadSalas();
    } catch (error) {
      console.error('Erro ao excluir sala:', error);
    }
  };

  const getQuestionLink = async (habilidadeCodigo: string, componente: string) => {
    const cacheKey = `${habilidadeCodigo}-${componente}`;
    
    if (linksCache.has(cacheKey)) {
      return linksCache.get(cacheKey);
    }

    try {
      const link = await apiMap(selectedSystem).getLinkByHabilidadeComponente(habilidadeCodigo, componente);
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

  const generateInsights = async (student: StudentData) => {
    const studentKey = student.nome_aluno;
    setGeneratingInsights(prev => new Set(prev).add(studentKey));

    try {
      // Coleta habilidades com desempenho abaixo de 100%
      const weakSkills: Array<{
        componente: string;
        habilidade_id: string;
        habilidade_codigo: string;
        descricao_habilidade: string;
        percentual: number;
      }> = [];

      Object.entries(student.componentes).forEach(([componentKey, componentData]) => {
        componentData.habilidades.forEach(habilidade => {
          if (habilidade.total > 0) {
            const percentual = (habilidade.acertos / habilidade.total) * 100;
            if (percentual < 100) {
              weakSkills.push({
                componente: componentKey === 'LP' ? 'Língua Portuguesa' : 'Matemática',
                habilidade_id: habilidade.habilidade_id,
                habilidade_codigo: habilidade.habilidade_codigo,
                descricao_habilidade: habilidade.descricao,
                percentual
              });
            }
          }
        });
      });

      if (weakSkills.length === 0) {
        alert('Este aluno não possui habilidades com desempenho abaixo de 100%.');
        return;
      }

      // Prepara prompt para o Gemini
      const prompt = `
Analise o desempenho do aluno ${student.nome_aluno} da ${student.unidade} no ${student.semestre}º semestre.

O aluno teve dificuldades nas seguintes habilidades:
${weakSkills.map(skill => 
  `- ${skill.habilidade_id} (${skill.componente}): ${skill.percentual.toFixed(1)}% de acertos`
).join('\n')}

Por favor, forneça:
1. Uma análise geral do perfil de aprendizagem do aluno
2. Identificação dos principais pontos de melhoria
3. Estratégias pedagógicas específicas para cada habilidade com dificuldade
4. Sugestões de atividades práticas para reforço
5. Cronograma de estudos recomendado

Seja específico e prático nas recomendações, considerando que este é um relatório para educadores.
      `;

      // Chama API do Gemini
      const insights = await callGeminiAPI(prompt, weakSkills);
      
      // Gera PDF
      generatePDF(student, weakSkills, insights);

    } catch (error) {
      console.error('Erro ao gerar insights:', error);
      alert('Erro ao gerar insights. Tente novamente.');
    } finally {
      setGeneratingInsights(prev => {
        const newSet = new Set(prev);
        newSet.delete(studentKey);
        return newSet;
      });
    }
  };

  const callGeminiAPI = async (prompt: string, weakSkills: any[]) => {
    try {
      const genAI = new GoogleGenerativeAI('AIzaSyBbkB2tPNyqkW5WkE9EuAyjDzprosYfwNA');
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const generatedText = response.text();

      if (!generatedText) {
        throw new Error("Resposta vazia da API do Gemini");
      }

      return parseGeminiResponse(generatedText, weakSkills);

    } catch (error) {
      console.error("Erro ao chamar API do Gemini:", error);
      return {
        analiseGeral: `O aluno apresenta dificuldades em ${weakSkills.length} habilidade(s), indicando necessidade de reforço específico nas áreas identificadas.`,
        pontosMelhoria: weakSkills.map(skill =>
          `${skill.habilidade_id}: Necessita de atenção especial com ${skill.percentual.toFixed(1)}% de aproveitamento`
        ),
        estrategias: [
          "Implementar atividades de reforço direcionadas",
          "Utilizar metodologias ativas de aprendizagem",
          "Promover exercícios práticos contextualizados",
          "Acompanhamento individualizado do progresso"
        ],
        atividades: [
          "Exercícios de fixação específicos para cada habilidade",
          "Jogos educativos relacionados aos conteúdos",
          "Projetos práticos que integrem as habilidades",
          "Avaliações formativas regulares"
        ],
        cronograma: "Recomenda-se dedicar 30 minutos diários para cada habilidade com dificuldade, distribuindo as atividades ao longo de 4 semanas."
      };
    }
  };

  const parseGeminiResponse = (text: string, weakSkills: any[]) => {
    const sections = {
      analiseGeral: '',
      pontosMelhoria: [] as string[],
      estrategias: [] as string[],
      atividades: [] as string[],
      cronograma: ''
    };

    const lines = text.split('\n').filter(line => line.trim());
    
    let currentSection = '';
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.toLowerCase().includes('análise geral') || trimmedLine.toLowerCase().includes('analise geral')) {
        currentSection = 'analiseGeral';
        continue;
      } else if (trimmedLine.toLowerCase().includes('pontos de melhoria') || trimmedLine.toLowerCase().includes('melhorias')) {
        currentSection = 'pontosMelhoria';
        continue;
      } else if (trimmedLine.toLowerCase().includes('estratégias') || trimmedLine.toLowerCase().includes('estrategias')) {
        currentSection = 'estrategias';
        continue;
      } else if (trimmedLine.toLowerCase().includes('atividades')) {
        currentSection = 'atividades';
        continue;
      } else if (trimmedLine.toLowerCase().includes('cronograma')) {
        currentSection = 'cronograma';
        continue;
      }

      if (currentSection && trimmedLine) {
        if (currentSection === 'analiseGeral' || currentSection === 'cronograma') {
          sections[currentSection] += (sections[currentSection] ? ' ' : '') + trimmedLine;
        } else {
          if (trimmedLine.startsWith('-') || trimmedLine.startsWith('•') || trimmedLine.match(/^\d+\./)) {
            sections[currentSection as keyof typeof sections].push(trimmedLine.replace(/^[-•\d.]\s*/, ''));
          } else if (!trimmedLine.includes(':')) {
            sections[currentSection as keyof typeof sections].push(trimmedLine);
          }
        }
      }
    }

    if (!sections.analiseGeral) {
      sections.analiseGeral = text.substring(0, 200) + '...';
    }
    
    if (sections.pontosMelhoria.length === 0) {
      sections.pontosMelhoria = weakSkills.map(skill => 
        `${skill.habilidade_id}: Necessita de atenção especial com ${skill.percentual.toFixed(1)}% de aproveitamento`
      );
    }

    if (sections.estrategias.length === 0) {
      sections.estrategias = ['Implementar atividades de reforço direcionadas', 'Utilizar metodologias ativas de aprendizagem'];
    }

    if (sections.atividades.length === 0) {
      sections.atividades = ['Exercícios de fixação específicos', 'Jogos educativos relacionados aos conteúdos'];
    }

    if (!sections.cronograma) {
      sections.cronograma = 'Recomenda-se dedicar 30 minutos diários para cada habilidade com dificuldade.';
    }

    return sections;
  };

  const generatePDF = (student: StudentData, weakSkills: any[], insights: any) => {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.width;
    const pageHeight = pdf.internal.pageSize.height;
    let yPosition = 20;

    const addText = (text: string | string[], x: number, y: number, lineHeight = 6) => {
      const lines = Array.isArray(text) ? text : pdf.splitTextToSize(text, pageWidth - 40);
      lines.forEach(line => {
        if (yPosition >= pageHeight - 20) {
          pdf.addPage();
          yPosition = 20;
        }
        pdf.text(line, x, yPosition);
        yPosition += lineHeight;
      });
      yPosition += 4;
    };

    const addTitle = (title: string) => {
      if (yPosition >= pageHeight - 20) {
        pdf.addPage();
        yPosition = 20;
      }
      pdf.setFont('helvetica', 'bold');
      pdf.text(title, 20, yPosition);
      yPosition += 8;
      pdf.setFont('helvetica', 'normal');
    };

    // Título
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Relatório de Insights Pedagógicos', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    // Dados do aluno
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    addText(`Aluno: ${student.nome_aluno}`, 20, yPosition);
    addText(`Unidade: ${student.unidade}`, 20, yPosition);
    addText(`Semestre: ${student.semestre}º`, 20, yPosition);
    addText(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 20, yPosition);

    // Habilidades
    addTitle('Habilidades com Desempenho Abaixo de 100%:');
    weakSkills.forEach(skill => {
      addText(`• ${skill.habilidade_id} (${skill.componente}): ${skill.percentual.toFixed(1)}%`, 25, yPosition);
    });

    // Análise Geral
    addTitle('Análise Geral:');
    addText(insights.analiseGeral, 20, yPosition);

    // Estratégias
    addTitle('Estratégias Recomendadas:');
    insights.estrategias.forEach((e: string) => addText(`• ${e}`, 25, yPosition));

    // Atividades
    addTitle('Atividades Sugeridas:');
    insights.atividades.forEach((a: string) => addText(`• ${a}`, 25, yPosition));

    // Cronograma
    addTitle('Cronograma Recomendado:');
    addText(insights.cronograma, 20, yPosition);

    // Salvar PDF
    pdf.save(`insights-${student.nome_aluno.replace(/\s+/g, '-')}.pdf`);
  };

  const toggleAlunoSelection = (aluno: { nome_aluno: string; turma: string }) => {
    const isSelected = form.alunos.some(a => 
      a.nome_aluno === aluno.nome_aluno && a.turma === aluno.turma
    );
    
    if (isSelected) {
      setForm(prev => ({
        ...prev,
        alunos: prev.alunos.filter(a => 
          !(a.nome_aluno === aluno.nome_aluno && a.turma === aluno.turma)
        )
      }));
    } else {
      setForm(prev => ({
        ...prev,
        alunos: [...prev.alunos, aluno]
      }));
    }
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-green-100 p-2 rounded-lg">
            <Users className="w-5 h-5 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            Sala de Aula ({salas.length})
          </h3>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nova Sala de Aula
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Nova Sala de Aula</h3>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome da Sala de Aula
                  </label>
                  <input
                    type="text"
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Ex: Turma A - 9º ano"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Alunos ({form.alunos.length} selecionados)
                  </label>
                  
                  {/* Campo de busca */}
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar aluno por nome ou turma..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div className="border border-gray-300 rounded-lg max-h-60 overflow-y-auto">
                    {filteredAlunos.length > 0 ? (
                      filteredAlunos.map((aluno, index) => {
                        const isSelected = form.alunos.some(a => 
                          a.nome_aluno === aluno.nome_aluno && a.turma === aluno.turma
                        );
                        
                        return (
                          <label
                            key={index}
                            className={`flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 ${
                              isSelected ? 'bg-green-50' : ''
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleAlunoSelection(aluno)}
                              className="mr-3 text-green-600 focus:ring-green-500"
                            />
                            <div>
                              <p className="font-medium text-gray-900">{aluno.nome_aluno}</p>
                              <p className="text-sm text-gray-600">Turma: {aluno.turma}</p>
                            </div>
                          </label>
                        );
                      })
                    ) : (
                      <div className="p-4 text-center text-gray-500">
                        <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>Nenhum aluno encontrado</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors"
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {salas.length > 0 ? (
          salas.map((sala) => (
            <div key={sala.id} className="border border-gray-200 rounded-lg">
              <div className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between">
                <button
                  onClick={() => toggleSalaExpansion(sala.id)}
                  className="flex items-center gap-3 flex-1 text-left"
                >
                  <div>
                    <h4 className="font-medium text-gray-900">{sala.nome}</h4>
                    <p className="text-sm text-gray-600">
                      {sala.sala_de_aula_alunos.length} aluno(s)
                    </p>
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDeleteSala(sala.id)}
                    className="text-red-600 hover:text-red-800 p-1"
                    title="Excluir sala"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {expandedSalas.has(sala.id) ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              {expandedSalas.has(sala.id) && (
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  <div className="mb-4">
                    <select
                      onChange={(e) => {
                        const selectedAluno = alunosDisponiveis.find(a => 
                          `${a.nome_aluno}-${a.turma}` === e.target.value
                        );
                        if (selectedAluno) {
                          handleAddStudent(sala.id, selectedAluno);
                          e.target.value = '';
                        }
                      }}
                      disabled={addingStudents[sala.id]}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="">
                        {addingStudents[sala.id] ? 'Adicionando...' : 'Adicionar aluno...'}
                      </option>
                      {alunosDisponiveis
                        .filter(aluno => !sala.sala_de_aula_alunos.some(sa => 
                          sa.nome_aluno === aluno.nome_aluno && sa.turma === aluno.turma
                        ))
                        .map((aluno, index) => (
                          <option key={index} value={`${aluno.nome_aluno}-${aluno.turma}`}>
                            {aluno.nome_aluno} - Turma {aluno.turma}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    {sala.sala_de_aula_alunos.map((aluno) => {
                      const studentKey = `${aluno.nome_aluno}-${aluno.turma}`;
                      const studentData = studentsData[studentKey];
                      
                      return (
                        <div key={aluno.id} className="bg-white rounded-lg border border-gray-200">
                          <div className="p-3 flex items-center justify-between">
                            <button
                              onClick={() => toggleStudentExpansion(studentKey, aluno.nome_aluno, aluno.turma)}
                              className="flex items-center gap-3 flex-1 text-left"
                            >
                              <div>
                                <h5 className="font-medium text-gray-900">{aluno.nome_aluno}</h5>
                                <p className="text-sm text-gray-600">Turma: {aluno.turma}</p>
                              </div>
                            </button>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleRemoveStudent(aluno.id)}
                                className="text-red-600 hover:text-red-800 p-1"
                                title="Remover aluno"
                              >
                                <UserMinus className="w-4 h-4" />
                              </button>
                              {expandedStudents.has(studentKey) ? (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                              )}
                            </div>
                          </div>

                          {expandedStudents.has(studentKey) && studentData && (
                            <div className="border-t border-gray-200 p-3 bg-gray-50">
                              <div className="space-y-3">
                                {Object.entries(studentData.componentes).map(([componentKey, componentData]) => {
                                  const componentExpandKey = `${studentKey}-${componentKey}`;
                                  return (
                                    <div key={componentKey} className="bg-white rounded-lg border border-gray-200">
                                      <button
                                        onClick={() => toggleComponentExpansion(componentExpandKey)}
                                        className="w-full p-3 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
                                      >
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
                                                    {habilidade.habilidade_codigo} - {habilidade.habilidade_id}
                                                  </p>
                                                  <p className="text-sm text-gray-600">
                                                    {habilidade.descricao}
                                                  </p>
                                                </div>
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
                                                    className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition-colors ml-2"
                                                    title="Ver questão"
                                                  >
                                                    <ExternalLink className="w-4 h-4" />
                                                  </button>
                                                )}
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
                          
                          {/* Botão Gerar Insights */}
                          {expandedStudents.has(studentKey) && studentData && (
                            <div className="border-t border-gray-200 p-3 bg-gray-50 flex justify-center">
                              <button
                                onClick={() => generateInsights(studentData)}
                                disabled={generatingInsights.has(studentData.nome_aluno)}
                                className="bg-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                              >
                                {generatingInsights.has(studentData.nome_aluno) ? (
                                  <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    Gerando...
                                  </>
                                ) : (
                                  <>
                                    <Brain className="w-4 h-4" />
                                    Gerar Insights
                                  </>
                                )}
                              </button>
                                                          <p className="mt-2 text-xs text-gray-500 text-center max-w-xl mx-auto px-3">
                              <strong>Importante:</strong> este relatório é gerado com apoio de inteligência artificial.
                              Ele representa uma sugestão baseada em dados, mas deve ser lido com análise crítica e adaptado conforme a realidade de cada aluno.
                            </p>
                            </div>
                          )}
                          
                          {generatingInsights.has(studentKey) && (
                            <p className="mt-2 text-xs text-gray-500 text-center max-w-xl mx-auto px-3">
                              <strong>Importante:</strong> este relatório é gerado com apoio de inteligência artificial.
                              Ele representa uma sugestão baseada em dados, mas deve ser lido com análise crítica e adaptado conforme a realidade de cada aluno.
                            </p>
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
            <p>Nenhuma sala de aula criada</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClassroomSection;