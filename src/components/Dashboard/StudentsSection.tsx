import React, { useState, useEffect } from 'react';
import { Users, ChevronDown, ChevronRight, BookOpen, ExternalLink, Brain } from 'lucide-react';
import { fetchProvaData, getLinkByHabilidadeComponente } from '../../lib/supabase';
import { fetchProvaDataParceiro, getLinkByHabilidadeComponenteParceiro } from '../../lib/supabaseParceiro';
import { DashboardFilters } from '../../types';
import { GoogleGenerativeAI } from "@google/generative-ai";
import jsPDF from 'jspdf';

const getLinkFn = (system: 'prova-parana' | 'parceiro') =>
  system === 'prova-parana'
    ? getLinkByHabilidadeComponente
    : getLinkByHabilidadeComponenteParceiro;

interface StudentsSectionProps {
  filters: DashboardFilters;
  userProfile: { unidade: string } | null;
  selectedSystem: 'prova-parana' | 'parceiro';
  salasDeAula: any[];
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
  ano_escolar_resultados?: string;
  gradeMin?: number;
};

/** Extrai um "nível" para ordenar do mais fácil→mais difícil.
 * Regras:
 * - Se houver anos do EF: usa o MENOR (ex.: "3º ANO 4º ANO" -> 3).
 * - Se mencionar ENSINO MÉDIO (mesmo com ruído como "MºDIO"):
 *      tenta mapear 1º/2º/3º EM para níveis 10/11/12; se não achar série, usa 12.
 * - Se não identificar nada, retorna +∞ (vai para o fim).
 */
const extractLowestGrade = (s?: string) => {
  if (!s) return Number.POSITIVE_INFINITY;
  const src = s.toUpperCase();

  // 1) EF: capturar todos os "Nº"
  const anosEF = [...src.matchAll(/(\d+)\s*º/g)].map(m => parseInt(m[1], 10)).filter(n => n >= 1 && n <= 9);
  if (anosEF.length) {
    return Math.min(...anosEF);
  }

  // 2) EM: detectar "ENSINO M?DIO" com tolerância a acentos/ruídos
  const isEM = /ENSINO\s*M[ÉE]?[[DÐ]IO|ENSINO\s*MºDIO/.test(src);
  if (isEM) {
    // tentar identificar 1º/2º/3º do EM
    const emSerie = src.match(/(\d+)\s*º/);
    if (emSerie) {
      const n = parseInt(emSerie[1], 10);
      if (n >= 1 && n <= 3) return 9 + n; // 1EM=10, 2EM=11, 3EM=12
    }
    // Sem série explícita: considere como mais difícil do que EF
    return 12;
  }

  return Number.POSITIVE_INFINITY;
};

/** Ordenação: menor ano primeiro; empate → maior percentual primeiro */
const compareByGradeThenPercent = (a: WeakSkill, b: WeakSkill) => {
  const ga = a.gradeMin ?? Number.POSITIVE_INFINITY;
  const gb = b.gradeMin ?? Number.POSITIVE_INFINITY;
  if (ga !== gb) return ga - gb;
  return (b.percentual ?? 0) - (a.percentual ?? 0);
};

/** Normaliza string para matching de palavras-chave (caixa alta, sem acentos). */
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

/** Gera atividades dinâmicas conforme descrição, componente e dificuldade. */
const suggestActivities = (skill: WeakSkill): string[] => {
  const desc = norm(skill.descricao_habilidade || '');
  const comp = norm(skill.componente || '');
  const pct = skill.percentual ?? 0;
  const nivel = skill.gradeMin ?? Number.POSITIVE_INFINITY;
  const isEM = (skill.ano_escolar_resultados || '').toUpperCase().includes('ENSINO') && (skill.ano_escolar_resultados || '').toUpperCase().includes('M');
  const areaLP = comp.includes('PORTUGUES') || comp.includes('LINGUA') || comp.includes('LÍNGUA') || comp.includes('LP');
  const areaMAT = comp.includes('MATEM');

  // Faixas de dificuldade
  const faixa = pct < 40 ? 'alta' : pct < 70 ? 'media' : 'leve';

  const base = [];
  // Ajustes por faixa
  if (faixa === 'alta') {
    base.push(
      'Reensino rápido do conceito em 3–5 minutos com exemplo concreto (quadro/figura).',
      'Resolver 2 exemplos guiados passo a passo, verbalizando cada etapa.',
      'Praticar 5 itens de baixa complexidade focando no erro mais comum e registrar onde ocorreu (leitura, cálculo, conceito).'
    );
  } else if (faixa === 'media') {
    base.push(
      'Revisar o conceito com 2 exemplos resolvidos e um contraexemplo.',
      'Prática escalonada (fácil→médio): 6–8 itens com correção imediata.',
      'Autoexplicação curta após cada item: “o que usei e por quê?”.'
    );
  } else {
    base.push(
      'Consolidação com 5–8 itens intercalando formatos diferentes.',
      'Explicar para um colega (ou em voz alta) a ideia central do item.',
      'Registrar 2 dicas pessoais para evitar o erro recorrente.'
    );
  }

  // Sugestões específicas por palavra-chave
  const sug = [] as string[];

  if (areaLP) {
    if (/INFER|IMPLICIT/.test(desc)) {
      sug.push('Leitura por pistas: sublinhar marcas linguísticas que sustentem a inferência e preencher um quadro “Pistas → Conclusão”.');
    }
    if (/TESE|ARGUMENT/.test(desc)) {
      sug.push('Mapa de argumentos: identificar tese, argumentos e evidências; reescrever um argumento fraco tornando-o mais específico.');
    }
    if (/ASSUNTO|TEMA|IDEIA PRINCIPAL|TITULO/.test(desc)) {
      sug.push('Localizar assunto/tema: criar um título alternativo e justificar com 2 palavras‑chave do texto.');
    }
    if (/COES|COER|CONECT|REFER/.test(desc)) {
      sug.push('Revisão de coesão: substituir conectivos e ajustar pronomes de referência em um trecho curto, explicando a escolha.');
    }
    if (/VOCAB|SINON|ANTON|SENTIDO|CONOT|DENOT/.test(desc)) {
      sug.push('Vocabulário em contexto: montar pares “palavra → sentido no texto → sinônimo possível” e testar em nova frase.');
    }
    if (/GRAFI|ORTOG|PONTU/.test(desc)) {
      sug.push('Reescrita focada: reescrever 3 frases ajustando acentuação e pontuação; justificar uma mudança feita.');
    }
    if (isEM) {
      sug.push('Contextualizar com gêneros do EM: selecionar um artigo/reportagem e aplicar a habilidade no texto atual (síntese crítica de 5 linhas).');
    }
  }

  if (areaMAT) {
    if (/ADIC|SUBTR|MULTI|DIVI|OPERAC/.test(desc)) {
      sug.push('Rotina operacional: 10 itens curtos mistos (±, ×, ÷), enfatizando estimativa antes do cálculo.');
    }
    if (/FRAC|DECIM|PORCENT|RAZAO|PROPOR/.test(desc)) {
      sug.push('Representação múltipla: mesma situação em fração, decimal e porcentagem; construir uma tabela de proporção para comparar.');
    }
    if (/EQUAC|1.?GRAU|INCOGN/.test(desc)) {
      sug.push('Passos de equação: isolar a incógnita destacando operação inversa; resolver 4 itens e checar substituindo o valor.');
    }
    if (/PROBLEM|SITUAC/.test(desc)) {
      sug.push('Leitura de problema: sublinhar dados, montar tabela “dados → pergunta → estratégia”, resolver e conferir unidade de medida.');
    }
    if (/GRAFIC|TABELA|DIAGR/.test(desc)) {
      sug.push('Leitura de dados: identificar eixos, unidade e tendência; responder 3 perguntas de interpretação direta e 2 de comparação.');
    }
    if (/ANG|TRIANG|PERIM|AREA|VOLUME|POLIG|MEDID/.test(desc)) {
      sug.push('Geometria ativa: desenhar/medir uma figura, calcular grandezas e explicar por que a fórmula se aplica.');
    }
    if (/MMC|MDC|MULTIP|DIVISOR|FATOR/.test(desc)) {
      sug.push('Fatoração guiada: árvore de fatores e verificação; aplicar em um problema de vida real (ex.: sincronizar ciclos).');
    }
    if (Number.isFinite(nivel) && nivel <= 5 && /DIVI|MULTI|TABU|OPERAC/.test(desc)) {
      sug.push('Refinar pré-requisito: 5 min de treino de tabuada/estratégias de decomposição antes dos itens principais.');
    }
    if (isEM) {
      sug.push('Modelagem: traduzir um enunciado em expressão/equação e verificar solução com gráfico simples (se aplicável).');
    }
  }

  const final = [...new Set([...sug, ...base])].slice(0, 5);
  return final.length ? final : base.slice(0, 3);
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

const StudentsSection: React.FC<StudentsSectionProps> = ({ filters, userProfile, selectedSystem, salasDeAula }) => {
  const [studentsData, setStudentsData] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSalaId, setSelectedSalaId] = useState<string>('');
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());
  const [linksCache, setLinksCache] = useState<Map<string, string>>(new Map());
  const [generatingInsights, setGeneratingInsights] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadStudentsData();
  }, [filters, selectedSystem, userProfile, selectedSalaId]);

  const loadStudentsData = async () => {
    setLoading(true);
    try {
const fetchFn =
  selectedSystem === 'prova-parana' ? fetchProvaData : fetchProvaDataParceiro;

const data = await fetchFn({
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
            total: item.total,
            ano_escolar_resultados: item.ano_escolar_resultados
          });
        }
      });

      let studentsArray = Object.values(groupedData).sort((a, b) =>
        a.nome_aluno.localeCompare(b.nome_aluno)
      );

      if (selectedSalaId) {
        const sala = salasDeAula.find(s => s.id === selectedSalaId);
        if (sala) {
          const alunosSala = new Set(
            (selectedSystem === 'prova-parana'
              ? sala.sala_de_aula_alunos
              : sala.sala_de_aula_alunos_parceiros
            )?.map((a: any) => a.nome_aluno) || []
          );
          studentsArray = studentsArray.filter(student => alunosSala.has(student.nome_aluno));
        }
      }

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
      const link = await getLinkFn(selectedSystem)(habilidadeCodigo, componente);
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
    const ordered = [...weakSkills].sort(compareByGradeThenPercent);
    const weeks = 4;
    const plan: CronoItem[] = [];
    // distribui ciclicamente as habilidades entre as semanas (mantendo a ordem fácil→difícil)
    ordered.forEach((skill, idx) => {
      const semana = (idx % weeks) + 1;
      let anoText = '';
      if (skill.ano_escolar_resultados && skill.ano_escolar_resultados.trim()) {
        anoText = ` [Ano(s): ${skill.ano_escolar_resultados}]`;
      } else if (Number.isFinite(skill.gradeMin)) {
        const n = Number(skill.gradeMin);
        anoText = n <= 9 ? ` [Ano: ${n}º]` : ' [Ensino Médio]';
      }
      const foco = `${skill.componente} – ${skill.habilidade_id}: ${skill.descricao_habilidade}${anoText}`;
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
      sugestoes: suggestActivities(skill)
    }));
  };

  /** Prompt estruturado para o Gemini, pedindo JSON estrito. */
  const buildLLMPrompt = (student: StudentData, weakSkills: WeakSkill[]) => {
    const skillsTxt = weakSkills.map(s =>
      `{"componente":"${s.componente}","habilidade_id":"${s.habilidade_id}","habilidade_codigo":"${s.habilidade_codigo}","descricao_habilidade":"${s.descricao_habilidade.replace(/"/g, "'")}","percentual":${s.percentual.toFixed(1)},"ano_escolar_resultados":"${s.ano_escolar_resultados ?? ""}","gradeMin":${s.gradeMin ?? -1}}`
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
    "foco": string,        // exemplo: "Língua Portuguesa – H23: Inferência de informações implícitas [Ano(s): 6º E 7º ANO]"
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
- **Ordem de dificuldade**: organize **do mais fácil → mais difícil** com base em 'ano_escolar_resultados'/'gradeMin' (menor ano primeiro; EF < EM). Em EMPATE, use **maior percentual** primeiro.
- No foco do cronograma, inclua os anos da habilidade ao final entre colchetes, ex.: [Ano(s): 6º E 7º ANO]; se não houver 'ano_escolar_resultados', use [Ano: {gradeMin}º] (EF) ou [Ensino Médio].
- **Atividades SUGERIDAS (dinâmicas)**: para cada habilidade, gere **3 a 5** sugestões **específicas** e **executáveis**, variando conforme:
  • **Dificuldade (percentual)**: 
    - <40% → reensino rápido, exemplos guiados, itens fáceis e registro do erro.
    - 40–69% → revisão com exemplos e contraexemplos, prática escalonada, autoexplicação curta.
    - 70–99% → consolidação com variação de formatos e explicações em voz alta.
  • **Componente e palavras‑chave na 'descricao_habilidade'** (use correspondência sem acentos/maiúsculas):
    - **LP**: 
      - Inferência/implícito → “pistas → conclusão”; localizar marcas linguísticas.
      - Tese/argumentação → mapa de tese‑argumentos‑evidências; fortalecer argumento fraco.
      - Assunto/tema/ideia principal → criar título alternativo e justificar com palavras‑chave.
      - Coesão/coerência/conectivos/referência → reescrita trocando conectivos e pronomes, justificando escolhas.
      - Vocabulário/ortografia/pontuação → quadro “palavra → sentido no texto → sinônimo”; reescrita com ajustes.
      - **EM**: contextualizar com gêneros do EM (artigo/reportagem) e síntese crítica curta.
    - **Matemática**:
      - Operações básicas → rotina mista com estimativa antes do cálculo.
      - Frações/decimais/porcentagem/razão e proporção → representações múltiplas e tabela proporcional.
      - Equações 1º grau → passos com operação inversa e verificação por substituição.
      - Problemas/situações → tabela “dados → pergunta → estratégia”; conferir unidade.
      - Gráficos/tabelas/diagramas → identificar eixos/unidade/tendência, responder leitura direta e comparação.
      - Geometria (ângulo/perímetro/área/volume) → construir/desenhar, medir e justificar fórmula.
      - MMC/MDC/múltiplos/divisores → fatoração guiada e aplicação prática.
      - **Pré‑requisito EF baixo (≤5º)** → 5 min de treino de tabuada/decomposição antes da prática.
      - **EM**: modelagem (expressão/equação) e, se aplicável, verificação gráfica simples.
- **Sem frases “engessadas”**: evite modelos genéricos ou repetitivos; personalize cada sugestão ao **conteúdo** da habilidade.
- **JSON estrito**: responda **apenas** com JSON válido. Não inclua comentários, explicações externas nem markdown.

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
                percentual,
                ano_escolar_resultados: habilidade.ano_escolar_resultados,
                gradeMin: extractLowestGrade(habilidade.ano_escolar_resultados)
              });
            }
          }
        });
      });

      weakSkills.sort(compareByGradeThenPercent);

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
    const sequenciaAnos = Array.from(
      new Set(
        weakSkills
          .map(w => w.gradeMin)
          .filter(n => Number.isFinite(n))
          .sort((a,b) => (a! - b!))
          .map(n => `${n}º`)
      )
    ).join(' → ');
    const pontos = [...weakSkills]
      .sort((a, b) => (a.gradeMin ?? 999) - (b.gradeMin ?? 999) || (b.percentual - a.percentual))
      .slice(0, 3)
      .map(s => `${s.habilidade_id} (${s.componente}, ${s.ano_escolar_resultados ?? '—'}) com ${s.percentual.toFixed(1)}%`);

    return {
      analiseGeral: `O(a) aluno(a) ${student.nome_aluno} apresenta dificuldades distribuídas em ${weakSkills.length} habilidade(s). Recomenda-se começar pelas habilidades de seriação de anos mais iniciais e evoluindo para os anos finais (Conteúdo mais fácil para o mais difícil de acordo com a BNCC).`,
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
    insights.estrategias.forEach((e: string) => addText(`• ${e}`, 25, yPosition));// Cronograma (4 semanas, fácil→difícil)
    addTitle('Cronograma de Estudos (4 semanas: do mais fácil ao mais difícil de acordo com a BNCC):');
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 p-2 rounded-lg">
            <Users className="w-5 h-5 text-indigo-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            Alunos ({studentsData.length})
          </h3>
        </div>
        <div className="w-64">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Filtrar por Sala de Aula
          </label>
          <select
            value={selectedSalaId}
            onChange={(e) => setSelectedSalaId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
          >
            <option value="">Todas as salas</option>
            {salasDeAula.map((sala) => (
              <option key={sala.id} value={sala.id}>
                {sala.nome}
              </option>
            ))}
          </select>
        </div>
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
