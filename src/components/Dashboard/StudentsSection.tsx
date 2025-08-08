import React, { useState, useEffect } from 'react';
import { Users, ChevronDown, ChevronRight, BookOpen, ExternalLink, Brain } from 'lucide-react';
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

/** Tipos internos para estruturar a saída do LLM e de fallback */
type WeakSkill = {
  componente: string;
  habilidade_id: string;
  habilidade_codigo: string;
  descricao_habilidade: string;
  percentual: number; // 0-100
};

type AtividadePorHabilidade = {
  habilidade_id: string;
  componente: string;
  descricao_habilidade: string;
  sugestoes: string[];
};

type CronoItem = {
  semana: number;
  foco: string; // “LP – H23: …”
  objetivo: string; // objetivo da semana
  tarefas: string[]; // tarefas práticas
};

type InsightsEstruturados = {
  analiseGeral: string;
  pontosMelhoria: string[];
  estrategias: string[];
  /** atividades específicas por habilidade, no formato solicitado */
  atividadesPorHabilidade: AtividadePorHabilidade[];
  /** cronograma de 4 semanas, do mais fácil→mais difícil */
  cronograma: CronoItem[];
  /** bloco formal de intervenção pedagógica */
  modeloIntervencao: {
    objetivoGeral: string;
    metasCurtoPrazo: string[];
    rotinaIntervencao: string[];
    acompanhamentoRegistro: string[];
    responsabilidades: string[];
  };
};

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
    if (linksCache.has(cacheKey)) return linksCache.get(cacheKey);

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
    newExpanded.has(studentName) ? newExpanded.delete(studentName) : newExpanded.add(studentName);
    setExpandedStudents(newExpanded);
  };

  const toggleComponentExpansion = (key: string) => {
    const newExpanded = new Set(expandedComponents);
    newExpanded.has(key) ? newExpanded.delete(key) : newExpanded.add(key);
    setExpandedComponents(newExpanded);
  };

  /** Utilitário: gera cronograma (4 semanas) ordenando do mais fácil→mais difícil (maior %→menor %) */
  const buildStudyPlan = (weakSkills: WeakSkill[]): CronoItem[] => {
    const ordered = [...weakSkills].sort((a, b) => b.percentual - a.percentual);
    const weeks = 4;
    const plan: CronoItem[] = [];
    // distribui ciclicamente as habilidades entre as semanas (mantendo a ordem fácil→difícil)
    ordered.forEach((skill, idx) => {
      const semana = (idx % weeks) + 1;
      const foco = `${skill.componente} – ${skill.habilidade_id}: ${skill.descricao_habilidade}`;
      const objetivo = `Elevar o desempenho em ${skill.habilidade_id} para ≥ 80% por meio de prática guiada e revisão de erros.`;
      const tarefas = [
        `Fazer a lista de atividades do componente ${skill.componente} – ${skill.habilidade_id}, que trata sobre ${skill.descricao_habilidade}.`,
        `Refazer itens com erro e registrar onde ocorreu a falha (leitura do enunciado, passo de cálculo, conceito).`,
        `Praticar 10 questões similares (gradativas) e medir tempo e acerto.`
      ];
      plan.push({ semana, foco, objetivo, tarefas });
    });

    // Agrupa por semana mantendo ordem
    const byWeek: Record<number, CronoItem> = {};
    for (let s = 1; s <= weeks; s++) {
      const itens = plan.filter(p => p.semana === s);
      byWeek[s] = {
        semana: s,
        foco: itens.map(i => i.foco).join(' | '),
        objetivo: `Consolidar conteúdos planejados da semana ${s}.`,
        tarefas: itens.flatMap(i => i.tarefas)
      };
    }
    return [byWeek[1], byWeek[2], byWeek[3], byWeek[4]];
  };

  /** Utilitário: monta atividades no formato solicitado por habilidade */
  const buildActivitiesPerSkill = (weakSkills: WeakSkill[]): AtividadePorHabilidade[] => {
    return weakSkills.map(skill => ({
      habilidade_id: skill.habilidade_id,
      componente: skill.componente,
      descricao_habilidade: skill.descricao_habilidade,
      sugestoes: [
        `Fazer a lista de atividades do componente ${skill.componente} – ${skill.habilidade_id}, que trata sobre ${skill.descricao_habilidade}.`,
        `Resolver novamente as questões erradas, explicando em voz alta cada passo da solução.`,
        `Aplicar um mini-desafio prático contextualizado envolvendo ${skill.descricao_habilidade}.`
      ]
    }));
  };

  /** Prompt estruturado para o Gemini, pedindo JSON estrito. */
  const buildLLMPrompt = (student: StudentData, weakSkills: WeakSkill[]) => {
    const skillsTxt = weakSkills.map(s =>
      `{"componente":"${s.componente}","habilidade_id":"${s.habilidade_id}","habilidade_codigo":"${s.habilidade_codigo}","descricao_habilidade":"${s.descricao_habilidade.replace(/"/g, "'")}","percentual":${s.percentual.toFixed(1)}}`
    ).join(",\n");

    return `
Analise o desempenho do aluno "${student.nome_aluno}" da unidade "${student.unidade}" no "${student.semestre}º" semestre.

DADOS_FRACAS:
[${skillsTxt}]

TAREFA:
1) Produza um objeto JSON **válido** e **apenas o JSON**, com as chaves:
{
  "analiseGeral": string,
  "pontosMelhoria": string[],
  "estrategias": string[],
  "atividadesPorHabilidade": [{
    "habilidade_id": string,
    "componente": string,
    "descricao_habilidade": string,
    "sugestoes": string[]  // inclua pelo menos uma no formato "Fazer a lista de atividades do componente {componente} – {habilidade_id}, que trata sobre {descricao_habilidade}."
  }],
  "cronograma": [{
    "semana": number,      // 1..4, ordene do mais fácil→mais difícil (maior %→menor %)
    "foco": string,        // exemplo: "Língua Portuguesa – H23: Inferência de informações implícitas"
    "objetivo": string,
    "tarefas": string[]
  }],
  "modeloIntervencao": {
    "objetivoGeral": string,
    "metasCurtoPrazo": string[],
    "rotinaIntervencao": string[],
    "acompanhamentoRegistro": string[],
    "responsabilidades": string[]
  }
}

REGRAS:
- O cronograma deve partir das habilidades com maior percentual (mais fáceis de recuperar) para as de menor percentual (mais difíceis).
- As "sugestoes" precisam conter pelo menos UMA frase exatamente neste formato:
  "Fazer a lista de atividades do componente {componente} – {habilidade_id}, que trata sobre {descricao_habilidade}."
- Responda **somente** com o JSON.
`;
  };

  const generateInsights = async (student: StudentData) => {
    const studentKey = student.nome_aluno;
    setGeneratingInsights(prev => new Set(prev).add(studentKey));

    try {
      // Coleta habilidades com desempenho < 100%
      const weakSkills: WeakSkill[] = [];
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

      // Prompt estruturado
      const prompt = buildLLMPrompt(student, weakSkills);

      // Chama LLM com parser robusto + fallback local
      const insights = await simulateGeminiAnalysis(prompt, weakSkills, student);

      // Gera PDF com todas as seções
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

  const simulateGeminiAnalysis = async (prompt: string, weakSkills: WeakSkill[], student: StudentData): Promise<InsightsEstruturados> => {
    try {
      const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const generatedText = (response?.text?.() ?? "").trim();

      if (generatedText) {
        const parsed = parseGeminiResponse(generatedText);
        if (parsed) return parsed;
      }
      // Se não veio JSON válido, usa fallback
      return fallbackInsights(weakSkills, student);
    } catch (error) {
      console.error("Erro ao chamar API do Gemini:", error);
      return fallbackInsights(weakSkills, student);
    }
  };

  const parseGeminiResponse = (text: string): InsightsEstruturados | null => {
    // tenta extrair JSON puro (pode vir com crases ou markdown)
    const jsonMatch = text.match(/\{[\s\S]*\}$/);
    if (!jsonMatch) return null;
    try {
      const obj = JSON.parse(jsonMatch[0]);
      // sanity check de campos mínimos
      if (!obj?.analiseGeral || !Array.isArray(obj?.cronograma) || !Array.isArray(obj?.atividadesPorHabilidade)) {
        return null;
      }
      return obj as InsightsEstruturados;
    } catch {
      return null;
    }
  };

  const fallbackInsights = (weakSkills: WeakSkill[], student: StudentData): InsightsEstruturados => {
    const atividadesPorHabilidade = buildActivitiesPerSkill(weakSkills);
    const cronograma = buildStudyPlan(weakSkills);
    const pontos = weakSkills
      .sort((a, b) => a.percentual - b.percentual)
      .slice(0, 3)
      .map(s => `${s.habilidade_id} (${s.componente}) com ${s.percentual.toFixed(1)}%`);

    return {
      analiseGeral: `O(a) aluno(a) ${student.nome_aluno} apresenta dificuldades distribuídas em ${weakSkills.length} habilidade(s). Recomenda-se começar pelas de maior percentual de acerto, para ganho rápido de confiança, e evoluir gradualmente para as de menor desempenho.`,
      pontosMelhoria: pontos,
      estrategias: [
        "Rotina de prática guiada (curta e frequente), com feedback imediato.",
        "Uso de exemplos graduados (do simples ao complexo) e retomada de pré-requisitos.",
        "Registro de erros recorrentes e modelagem de solução passo a passo."
      ],
      atividadesPorHabilidade,
      cronograma,
      modeloIntervencao: {
        objetivoGeral: "Aumentar a proficiência nas habilidades com baixo desempenho, garantindo avanços mensuráveis em 4 semanas.",
        metasCurtoPrazo: [
          "Elevar cada habilidade trabalhada para ≥ 80% de acerto.",
          "Reduzir o tempo médio por questão mantendo a precisão."
        ],
        rotinaIntervencao: [
          "3 a 5 sessões semanais de 30–40 minutos.",
          "Sequência: (1) revisão rápida do conceito; (2) 2–3 exemplos resolvidos; (3) prática independente; (4) correção e feedback."
        ],
        acompanhamentoRegistro: [
          "Planilha simples de acertos/erros por habilidade, com data e tipo de erro.",
          "Avaliações formativas semanais (mini-quiz de 5 itens)."
        ],
        responsabilidades: [
          "Professor(a): planejar e disponibilizar listas e feedback.",
          "Aluno(a): cumprir o cronograma e registrar dúvidas.",
          "Família/Escola: garantir rotina e ambiente de estudo."
        ]
      }
    };
  };

  /** PDF com Modelo de Intervenção, Cronograma e Atividades por Habilidade */
  const generatePDF = (student: StudentData, weakSkills: WeakSkill[], insights: InsightsEstruturados) => {
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

    // Cabeçalho
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Relatório Pedagógico Estruturado', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    // Dados do aluno
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    addText(`Aluno: ${student.nome_aluno}`, 20, yPosition);
    addText(`Unidade: ${student.unidade}`, 20, yPosition);
    addText(`Semestre: ${student.semestre}º`, 20, yPosition);
    addText(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 20, yPosition);

    // Habilidades com desempenho < 100%
    addTitle('Habilidades com Desempenho Abaixo de 100% (com % de acertos):');
    weakSkills
      .sort((a, b) => b.percentual - a.percentual)
      .forEach(skill => {
        addText(`• ${skill.habilidade_codigo} ${skill.habilidade_id} (${skill.componente}) – ${skill.descricao_habilidade}: ${skill.percentual.toFixed(1)}%`, 25, yPosition);
      });

    // Modelo de Intervenção
    addTitle('Modelo de Intervenção Pedagógica:');
    addText(`Objetivo Geral: ${insights.modeloIntervencao.objetivoGeral}`, 20, yPosition);
    addText('Metas de Curto Prazo:', 20, yPosition);
    insights.modeloIntervencao.metasCurtoPrazo.forEach(m => addText(`• ${m}`, 25, yPosition));
    addText('Rotina de Intervenção:', 20, yPosition);
    insights.modeloIntervencao.rotinaIntervencao.forEach(r => addText(`• ${r}`, 25, yPosition));
    addText('Acompanhamento e Registro:', 20, yPosition);
    insights.modeloIntervencao.acompanhamentoRegistro.forEach(a => addText(`• ${a}`, 25, yPosition));
    addText('Responsabilidades:', 20, yPosition);
    insights.modeloIntervencao.responsabilidades.forEach(r => addText(`• ${r}`, 25, yPosition));

    // Análise geral e estratégias
    addTitle('Análise Geral:');
    addText(insights.analiseGeral, 20, yPosition);
    addTitle('Estratégias Recomendadas:');
    insights.estrategias.forEach((e: string) => addText(`• ${e}`, 25, yPosition));

    // Atividades por habilidade (formato solicitado)
    addTitle('Atividades Sugeridas por Habilidade:');
    insights.atividadesPorHabilidade.forEach((a) => {
      addText(`${a.componente} – ${a.habilidade_id}: ${a.descricao_habilidade}`, 20, yPosition);
      a.sugestoes.forEach(s => addText(`• ${s}`, 25, yPosition));
    });

    // Cronograma (4 semanas, fácil→difícil)
    addTitle('Cronograma de Estudos (4 semanas: do mais fácil ao mais difícil):');
    insights.cronograma.forEach(item => {
      addText(`Semana ${item.semana} – Foco: ${item.foco}`, 20, yPosition);
      addText(`Objetivo: ${item.objetivo}`, 25, yPosition);
      item.tarefas.forEach(t => addText(`• ${t}`, 28, yPosition));
    });

    // Rodapé
    addText('Importante: relatório gerado com apoio de IA. Use com análise crítica e adapte à realidade do aluno.', 20, yPosition);

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
                  <p className="mt-2 text-xs text-gray-500 text-center max-w-xl mx-auto">
                    <strong>Importante:</strong> este relatório é gerado com apoio de inteligência artificial.
                    Ele representa uma sugestão baseada em dados, mas deve ser lido com análise crítica e adaptado conforme a realidade de cada aluno.
                  </p>
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
