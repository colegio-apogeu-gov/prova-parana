import React, { useState, useEffect } from 'react';
import { Users, ChevronDown, ChevronRight, BookOpen, ExternalLink, Brain, Download } from 'lucide-react';
import { fetchProvaData, getLinkByHabilidadeComponente } from '../../lib/supabase';
import { DashboardFilters } from '../../types';
import { GoogleGenerativeAI } from "@google/generative-ai";
import jsPDF from 'jspdf';

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
        descricao: string;
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
  const [generatingInsights, setGeneratingInsights] = useState<Set<string>>(new Set());

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
            descricao: item.descricao_habilidade,
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
                descricao_habilidade: '', // Será preenchido pela API
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

      // Simula chamada para Gemini (substitua pela API real)
      const insights = await simulateGeminiAnalysis(prompt, weakSkills);
      
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

const simulateGeminiAnalysis = async (prompt: string, weakSkills: any[]) => {
  try {
    const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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
    // Tenta extrair seções estruturadas da resposta do Gemini
    const sections = {
      analiseGeral: '',
      pontosMelhoria: [] as string[],
      estrategias: [] as string[],
      atividades: [] as string[],
      cronograma: ''
    };

    // Parse básico da resposta - pode ser melhorado conforme o formato da resposta
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

      // Adiciona conteúdo à seção atual
      if (currentSection && trimmedLine) {
        if (currentSection === 'analiseGeral' || currentSection === 'cronograma') {
          sections[currentSection] += (sections[currentSection] ? ' ' : '') + trimmedLine;
        } else {
          // Para listas, adiciona como item separado
          if (trimmedLine.startsWith('-') || trimmedLine.startsWith('•') || trimmedLine.match(/^\d+\./)) {
            sections[currentSection as keyof typeof sections].push(trimmedLine.replace(/^[-•\d.]\s*/, ''));
          } else if (!trimmedLine.includes(':')) {
            sections[currentSection as keyof typeof sections].push(trimmedLine);
          }
        }
      }
    }

    // Fallback se não conseguiu parsear adequadamente
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
                                        {habilidade.habilidade_codigo} - {habilidade.habilidade_id}
                                      </p>
                                      <p className="text-sm text-gray-600">
                                        {habilidade.descricao}
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
                  
                  {/* Botão Gerar Insights */}
                  <div className="mt-4 pt-4 border-t border-gray-200 flex justify-center">
                    <button
                      onClick={() => generateInsights(student)}
                      disabled={generatingInsights.has(student.nome_aluno)}
                      className="bg-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      {generatingInsights.has(student.nome_aluno) ? (
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