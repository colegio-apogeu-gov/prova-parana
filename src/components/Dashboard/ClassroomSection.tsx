import React, { useState, useEffect } from 'react';
import { Users, Plus, ChevronDown, ChevronRight, UserPlus, UserMinus, Trash2, X, Search, Brain, ExternalLink, Download, Filter, SlidersHorizontal, BarChart3, Save, FileSpreadsheet } from 'lucide-react';
import ImportarAlunosModal from './ImportarAlunosModal';
import { getSalasDeAula, createSalaDeAula, addAlunoToSala, removeAlunoFromSala, deleteSalaDeAula, getAlunosDisponiveis, fetchProvaData, getLinkByHabilidadeComponente, updateSalaProfessores } from '../../lib/supabase';
import {
  getSalasDeAulaParceiro,
  addAlunoToSalaParceiro,
  removeAlunoFromSalaParceiro,
  createSalaDeAulaParceiro,
  deleteSalaDeAulaParceiro,
  fetchProvaDataParceiro,
  getLinkByHabilidadeComponenteParceiro,
  getAlunosDisponivelParceiro,
  updateSalaProfessoresParceiro
} from '../../lib/supabaseParceiro';
import {
  getSalasDeAulaMais,
  addAlunoToSalaMais,
  removeAlunoFromSalaMais,
  createSalaDeAulaMais,
  deleteSalaDeAulaMais,
  fetchProvaDataMais,
  getLinkByHabilidadeComponenteMais,
  getAlunosDisponiveisMais,
  updateSalaProfessoresMais
} from '../../lib/supabaseMais';

import MultiSelect from '../common/MultiSelect';
import { SalaDeAula, SalaDeAulaAluno, DashboardFilters } from '../../types';
import { GoogleGenerativeAI } from "@google/generative-ai";
import jsPDF from 'jspdf';

type SystemKey = 'prova-parana' | 'parceiro' | 'parana-mais';

const pick = <T,>(system: SystemKey, base: T, parceiro: T, mais: T): T =>
  system === 'prova-parana' ? base : system === 'parana-mais' ? mais : parceiro;

const apiMap = (system: SystemKey) => ({
  getSalasDeAula: pick(system, getSalasDeAula, getSalasDeAulaParceiro, getSalasDeAulaMais),
  addAlunoToSala: pick(system, addAlunoToSala, addAlunoToSalaParceiro, addAlunoToSalaMais),
  removeAlunoFromSala: pick(system, removeAlunoFromSala, removeAlunoFromSalaParceiro, removeAlunoFromSalaMais),
  createSalaDeAula: pick(system, createSalaDeAula, createSalaDeAulaParceiro, createSalaDeAulaMais),
  deleteSalaDeAula: pick(system, deleteSalaDeAula, deleteSalaDeAulaParceiro, deleteSalaDeAulaMais),
  fetchProvaData: pick(system, fetchProvaData, fetchProvaDataParceiro, fetchProvaDataMais),
  getLinkByHabilidadeComponente: pick(system, getLinkByHabilidadeComponente, getLinkByHabilidadeComponenteParceiro, getLinkByHabilidadeComponenteMais),
  updateSalaProfessores: pick(system, updateSalaProfessores, updateSalaProfessoresParceiro, updateSalaProfessoresMais),
});

// Chave do mapa de professores: por componente (a sala já é o escopo).
// Prefixo "comp||" mantém compatibilidade e evita colisão com chaves antigas.
const profKey = (componente: string) => `comp||${componente}`;


interface ClassroomSectionProps {
  userProfile: { unidade: string } | null;
  filters: DashboardFilters;
  selectedSystem: 'prova-parana' | 'parceiro' | 'parana-mais'; // ADICIONE
}


interface StudentData {
  nome_aluno: string;
  unidade: string;
  semestre: string;
  // Níveis de desempenho do aluno (nivel_aprendizagem ou padrao_desempenho).
  // Um aluno pode ter níveis distintos por componente, por isso é um conjunto.
  niveis: string[];
  componentes: {
    [key: string]: {
      componente: string;
      total_acertos: number;
      total_questoes: number;
      // Nível(is) de desempenho do aluno neste componente específico.
      niveis: string[];
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

// Filtros aplicados dentro de uma sala de aula específica.
// Todos os campos de seleção são multi-seleção (arrays).
interface SalaFilters {
  nome: string;                 // busca textual por nome do aluno
  niveis: string[];             // nível de desempenho (multi)
  componentes: string[];        // 'LP' | 'MT' (multi)
  habilidades: string[];        // habilidade_codigo (multi)
  desempenho: string[];         // faixas de desempenho: 'alto' | 'medio' | 'baixo' (multi)
}

const EMPTY_SALA_FILTERS: SalaFilters = {
  nome: '',
  niveis: [],
  componentes: [],
  habilidades: [],
  desempenho: [],
};

// Faixas de desempenho (percentual geral de acertos do aluno na sala).
const DESEMPENHO_BANDS: Array<{ key: string; label: string; min: number; max: number }> = [
  { key: 'alto', label: 'Alto desempenho (≥ 70%)', min: 70, max: 100.0001 },
  { key: 'medio', label: 'Médio desempenho (50% – 69%)', min: 50, max: 70 },
  { key: 'baixo', label: 'Baixo desempenho (< 50%)', min: -0.0001, max: 50 },
];

// Sala já normalizada, com alunos e o mapa de professores (turma||componente -> nome).
type SalaComAlunos = SalaDeAula & {
  sala_de_aula_alunos: SalaDeAulaAluno[];
  professores?: Record<string, string>;
};

// antes: ({ userProfile, filters })
const ClassroomSection: React.FC<ClassroomSectionProps> = ({ userProfile, filters, selectedSystem }) => {
  const [salas, setSalas] = useState<SalaComAlunos[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
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

  // Filtros por sala (cada sala tem seu próprio conjunto de filtros).
  const [salaFilters, setSalaFilters] = useState<{ [salaId: string]: SalaFilters }>({});
  // Salas cuja barra de filtros está visível.
  const [filtersVisible, setFiltersVisible] = useState<Set<string>>(new Set());
  // Salas cujos dados de prova (em lote) estão sendo carregados.
  const [loadingSalaData, setLoadingSalaData] = useState<Set<string>>(new Set());

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
      // Cada sistema retorna os alunos sob uma chave diferente
      // (sala_de_aula_alunos / _parceiros / _mais). Normaliza para que o
      // restante do componente sempre use `sala_de_aula_alunos`.
      const normalized: SalaComAlunos[] = (data || []).map((sala: any) => ({
        ...sala,
        sala_de_aula_alunos:
          sala.sala_de_aula_alunos ??
          sala.sala_de_aula_alunos_parceiros ??
          sala.sala_de_aula_alunos_mais ??
          [],
        professores: sala.professores ?? {},
      }));
      setSalas(normalized);
    } catch (error) {
      console.error('Erro ao carregar salas:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAlunosDisponiveis = async () => {
    if (!userProfile?.unidade) return;
    
    try {
      const getAlunosFn = pick(selectedSystem, getAlunosDisponiveis, getAlunosDisponivelParceiro, getAlunosDisponiveisMais);
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

  // Nomes de alunos que a unidade tem nas tabelas de prova. Diferente de
  // `alunosDisponiveis`, ignora os filtros do dashboard: a importação precisa
  // enxergar todos os alunos da unidade, senão um filtro ativo (ano, componente)
  // faria um aluno existente parecer inexistente e ele ficaria fora da sala.
  const carregarNomesDoBanco = async (): Promise<string[]> => {
    const getAlunosFn = pick(selectedSystem, getAlunosDisponiveis, getAlunosDisponivelParceiro, getAlunosDisponiveisMais);
    const alunos = await getAlunosFn({ unidade: userProfile?.unidade });
    return Array.from(new Set(alunos.map((a: { nome_aluno: string }) => a.nome_aluno)));
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

  // Agrupa as linhas brutas da prova de UM aluno em StudentData.
  // Reutilizado tanto pelo carregamento individual (expandir aluno) quanto
  // pelo carregamento em lote (preencher os filtros da sala).
  const buildStudentData = (nomeAluno: string, rows: any[]): StudentData => {
    const niveisSet = new Set<string>();
    const groupedData: StudentData = {
      nome_aluno: nomeAluno,
      unidade: userProfile?.unidade || '',
      semestre: '1',
      niveis: [],
      componentes: {}
    };

    // Níveis por componente (para o filtro condicional Componente → Nível).
    const niveisPorComp: { [comp: string]: Set<string> } = {};

    rows.forEach((item: any) => {
      if (item.nome_aluno !== nomeAluno) return;

      // O nível de desempenho aparece como nivel_aprendizagem (prova-parana/
      // parana-mais) ou padrao_desempenho (parceiro).
      const nivel = item.nivel_aprendizagem ?? item.padrao_desempenho;
      if (nivel) niveisSet.add(String(nivel));

      const componentKey = item.componente;
      if (!groupedData.componentes[componentKey]) {
        groupedData.componentes[componentKey] = {
          componente: item.componente === 'LP' ? 'Língua Portuguesa' : 'Matemática',
          total_acertos: 0,
          total_questoes: 0,
          niveis: [],
          habilidades: []
        };
      }
      if (nivel) {
        (niveisPorComp[componentKey] ||= new Set<string>()).add(String(nivel));
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
    });

    groupedData.niveis = Array.from(niveisSet);
    Object.entries(niveisPorComp).forEach(([comp, set]) => {
      if (groupedData.componentes[comp]) {
        groupedData.componentes[comp].niveis = Array.from(set);
      }
    });
    return groupedData;
  };

  const loadStudentData = async (nomeAluno: string, turma: string) => {
    const studentKey = `${nomeAluno}-${turma}`;

    if (studentsData[studentKey]) return;

    try {
      const data = await apiMap(selectedSystem).fetchProvaData({...filters,
        unidade: userProfile?.unidade,
        nome_aluno: nomeAluno});

      const groupedData = buildStudentData(nomeAluno, data);
      setStudentsData(prev => ({ ...prev, [studentKey]: groupedData }));
    } catch (error) {
      console.error('Erro ao carregar dados do aluno:', error);
    }
  };

  // Carrega (em lote) os dados de prova de todos os alunos de uma sala, para
  // que os filtros da sala (nível, componente, habilidade, desempenho) possam
  // operar sobre todos os alunos — não apenas os que foram expandidos.
  const loadSalaStudentsData = async (
    salaId: string,
    alunos: Array<{ nome_aluno: string; turma: string }>
  ) => {
    const pending = alunos.filter(a => !studentsData[`${a.nome_aluno}-${a.turma}`]);
    if (pending.length === 0) return;

    setLoadingSalaData(prev => new Set(prev).add(salaId));
    try {
      const results = await Promise.all(
        pending.map(async (aluno) => {
          const data = await apiMap(selectedSystem).fetchProvaData({
            ...filters,
            unidade: userProfile?.unidade,
            nome_aluno: aluno.nome_aluno,
          });
          return {
            key: `${aluno.nome_aluno}-${aluno.turma}`,
            value: buildStudentData(aluno.nome_aluno, data),
          };
        })
      );

      setStudentsData(prev => {
        const next = { ...prev };
        results.forEach(({ key, value }) => {
          next[key] = value;
        });
        return next;
      });
    } catch (error) {
      console.error('Erro ao carregar dados dos alunos da sala:', error);
    } finally {
      setLoadingSalaData(prev => {
        const next = new Set(prev);
        next.delete(salaId);
        return next;
      });
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
      // Ao abrir a sala, carrega os dados de prova de todos os alunos para
      // que os filtros (nível, componente, habilidade, desempenho) funcionem.
      const sala = salas.find(s => s.id === salaId);
      if (sala) {
        loadSalaStudentsData(
          salaId,
          sala.sala_de_aula_alunos.map(a => ({ nome_aluno: a.nome_aluno, turma: a.turma }))
        );
      }
    }
    setExpandedSalas(newExpanded);
  };

  // Retorna os filtros de uma sala, com fallback para o estado vazio.
  const getSalaFilters = (salaId: string): SalaFilters =>
    salaFilters[salaId] ?? EMPTY_SALA_FILTERS;

  const updateSalaFilter = <K extends keyof SalaFilters>(
    salaId: string,
    key: K,
    value: SalaFilters[K]
  ) => {
    setSalaFilters(prev => {
      const current = prev[salaId] ?? EMPTY_SALA_FILTERS;
      const updated: SalaFilters = { ...current, [key]: value };
      // Ao mudar o componente, limpa nível e habilidade (que são condicionados
      // ao componente selecionado) para não manter seleções incompatíveis.
      if (key === 'componentes') {
        updated.niveis = [];
        updated.habilidades = [];
      }
      return { ...prev, [salaId]: updated };
    });
  };

  const clearSalaFilters = (salaId: string) => {
    setSalaFilters(prev => ({ ...prev, [salaId]: { ...EMPTY_SALA_FILTERS } }));
  };

  const toggleFiltersVisible = (salaId: string) => {
    setFiltersVisible(prev => {
      const next = new Set(prev);
      next.has(salaId) ? next.delete(salaId) : next.add(salaId);
      return next;
    });
  };

  // Percentual geral de acertos de um aluno (todos os componentes somados).
  const getStudentOverallPct = (data: StudentData | undefined): number | null => {
    if (!data) return null;
    let acertos = 0;
    let total = 0;
    Object.values(data.componentes).forEach(c => {
      acertos += c.total_acertos;
      total += c.total_questoes;
    });
    if (total <= 0) return null;
    return (acertos / total) * 100;
  };

  // Conta quantos filtros estão ativos (para badge no botão).
  const countActiveFilters = (f: SalaFilters): number =>
    (f.nome.trim() ? 1 : 0) +
    f.niveis.length +
    f.componentes.length +
    f.habilidades.length +
    f.desempenho.length;

  // Aplica os filtros de uma sala à lista de alunos.
  const getFilteredAlunosDaSala = (
    sala: SalaDeAula & { sala_de_aula_alunos: SalaDeAulaAluno[] }
  ): SalaDeAulaAluno[] => {
    const f = getSalaFilters(sala.id);
    const nomeQuery = f.nome.trim().toLowerCase();

    return sala.sala_de_aula_alunos.filter(aluno => {
      // 1) Nome (busca textual)
      if (nomeQuery && !aluno.nome_aluno.toLowerCase().includes(nomeQuery)) {
        return false;
      }

      const data = studentsData[`${aluno.nome_aluno}-${aluno.turma}`];

      // Filtros que dependem dos dados de prova. Se os dados ainda não
      // carregaram, só mantém o aluno quando não há filtros desse tipo ativos.
      const needsData =
        f.niveis.length > 0 ||
        f.componentes.length > 0 ||
        f.habilidades.length > 0 ||
        f.desempenho.length > 0;

      if (needsData && !data) return false;

      // Componentes do aluno que passam pelo filtro de componente.
      // Quando há componente selecionado, os filtros de nível e habilidade
      // passam a considerar apenas esse(s) componente(s).
      const compEntries = Object.entries(data?.componentes ?? {});
      const compsConsiderados =
        f.componentes.length > 0
          ? compEntries.filter(([comp]) => f.componentes.includes(comp))
          : compEntries;

      // 3) Componente (multi) — o aluno precisa ter ao menos um dos selecionados
      if (f.componentes.length > 0 && compsConsiderados.length === 0) {
        return false;
      }

      // 2) Nível de desempenho (multi) — dentro do(s) componente(s) considerado(s)
      if (f.niveis.length > 0) {
        const niveisDisponiveis = new Set<string>();
        compsConsiderados.forEach(([, cData]) =>
          cData.niveis.forEach(n => niveisDisponiveis.add(n))
        );
        if (![...niveisDisponiveis].some(n => f.niveis.includes(n))) return false;
      }

      // 4) Habilidade_codigo (multi) — dentro do(s) componente(s) considerado(s)
      if (f.habilidades.length > 0) {
        const codigos = new Set<string>();
        compsConsiderados.forEach(([, cData]) =>
          cData.habilidades.forEach(h => codigos.add(h.habilidade_codigo))
        );
        if (![...codigos].some(c => f.habilidades.includes(c))) return false;
      }

      // 5) Faixa de desempenho (multi)
      if (f.desempenho.length > 0) {
        const pct = getStudentOverallPct(data);
        if (pct === null) return false;
        const inBand = f.desempenho.some(key => {
          const band = DESEMPENHO_BANDS.find(b => b.key === key);
          return band ? pct >= band.min && pct < band.max : false;
        });
        if (!inBand) return false;
      }

      return true;
    });
  };

  // Opções de nível/componente/habilidade disponíveis para uma sala,
  // derivadas dos dados de prova já carregados dos seus alunos.
  // `compFiltro` (componentes selecionados) restringe níveis e habilidades ao(s)
  // componente(s) escolhido(s) — usado para o filtro condicional Componente → Nível.
  const getSalaFilterOptions = (
    sala: SalaDeAula & { sala_de_aula_alunos: SalaDeAulaAluno[] },
    compFiltro: string[] = []
  ) => {
    const niveis = new Set<string>();
    const componentes = new Set<string>();
    const habilidades = new Map<string, string>(); // codigo -> descricao

    const consideraComp = (c: string) => compFiltro.length === 0 || compFiltro.includes(c);

    sala.sala_de_aula_alunos.forEach(aluno => {
      const data = studentsData[`${aluno.nome_aluno}-${aluno.turma}`];
      if (!data) return;
      Object.keys(data.componentes).forEach(c => componentes.add(c));
      Object.entries(data.componentes).forEach(([comp, cData]) => {
        if (!consideraComp(comp)) return;
        cData.niveis.forEach(n => niveis.add(n));
        cData.habilidades.forEach(h => {
          if (!habilidades.has(h.habilidade_codigo)) {
            habilidades.set(h.habilidade_codigo, h.descricao || '');
          }
        });
      });
    });

    const componenteLabel = (c: string) =>
      c === 'LP' ? 'Língua Portuguesa' : c === 'MT' ? 'Matemática' : c;

    return {
      niveis: Array.from(niveis).sort().map(n => ({ value: n, label: n })),
      componentes: Array.from(componentes).sort().map(c => ({
        value: c,
        label: componenteLabel(c),
      })),
      habilidades: Array.from(habilidades.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([codigo, descricao]) => ({
          value: codigo,
          label: descricao ? `${codigo} — ${descricao}` : codigo,
        })),
    };
  };

  // Média de nota por disciplina (componente) da SALA, calculada sobre a lista
  // de alunos JÁ FILTRADA (portanto condicionada aos filtros ativos da sala).
  // A "turma" exibida é o nome da sala de aula, não o código de turma do banco.
  // A média é ponderada por questões (mesma lógica usada no resto do app).
  interface MediaTurmaComp {
    componente: string;       // 'LP' | 'MT'
    componenteLabel: string;
    media: number | null;     // percentual (0–100) ou null se sem dados
    totalAlunos: number;      // nº de alunos com nota nesse componente
  }

  const getMediasTurmaComponente = (alunos: SalaDeAulaAluno[]): MediaTurmaComp[] => {
    // acumulador: componente -> { acertos, questoes, alunos:Set }
    const acc = new Map<string, { comp: string; acertos: number; questoes: number; alunos: Set<string> }>();

    alunos.forEach(aluno => {
      const data = studentsData[`${aluno.nome_aluno}-${aluno.turma}`];
      if (!data) return;
      Object.entries(data.componentes).forEach(([comp, cData]) => {
        if (cData.total_questoes <= 0) return;
        const entry = acc.get(comp) ?? { comp, acertos: 0, questoes: 0, alunos: new Set<string>() };
        entry.acertos += cData.total_acertos;
        entry.questoes += cData.total_questoes;
        entry.alunos.add(aluno.nome_aluno);
        acc.set(comp, entry);
      });
    });

    const componenteLabel = (c: string) =>
      c === 'LP' ? 'Língua Portuguesa' : c === 'MT' ? 'Matemática' : c;

    return Array.from(acc.values())
      .map(e => ({
        componente: e.comp,
        componenteLabel: componenteLabel(e.comp),
        media: e.questoes > 0 ? (e.acertos / e.questoes) * 100 : null,
        totalAlunos: e.alunos.size,
      }))
      .sort((a, b) =>
        a.componente.localeCompare(b.componente)
      );
  };

  // ---- Professores por turma/disciplina ----
  // Rascunho editável (por sala) antes de salvar; salvamento por sala.
  const [profDraft, setProfDraft] = useState<{ [salaId: string]: Record<string, string> }>({});
  const [savingProf, setSavingProf] = useState<Set<string>>(new Set());

  // Valor atual do campo professor: rascunho local tem prioridade sobre o salvo.
  const getProfessorValue = (sala: SalaComAlunos, componente: string): string => {
    const key = profKey(componente);
    const draft = profDraft[sala.id];
    if (draft && key in draft) return draft[key];
    return sala.professores?.[key] ?? '';
  };

  const setProfessorDraft = (salaId: string, componente: string, value: string) => {
    const key = profKey(componente);
    setProfDraft(prev => ({
      ...prev,
      [salaId]: { ...(prev[salaId] ?? {}), [key]: value },
    }));
  };

  // Há alterações não salvas nesta sala?
  const hasProfChanges = (sala: SalaComAlunos): boolean => {
    const draft = profDraft[sala.id];
    if (!draft) return false;
    return Object.entries(draft).some(([key, value]) => (sala.professores?.[key] ?? '') !== value);
  };

  const saveProfessores = async (sala: SalaComAlunos) => {
    const draft = profDraft[sala.id];
    if (!draft) return;
    // Mescla o mapa salvo com o rascunho e remove entradas vazias.
    const merged: Record<string, string> = { ...(sala.professores ?? {}) };
    Object.entries(draft).forEach(([key, value]) => {
      const v = value.trim();
      if (v) merged[key] = v;
      else delete merged[key];
    });

    setSavingProf(prev => new Set(prev).add(sala.id));
    try {
      await apiMap(selectedSystem).updateSalaProfessores(sala.id, merged);
      // Atualiza o estado local da sala e limpa o rascunho.
      setSalas(prev => prev.map(s => (s.id === sala.id ? { ...s, professores: merged } : s)));
      setProfDraft(prev => {
        const next = { ...prev };
        delete next[sala.id];
        return next;
      });
    } catch (error) {
      console.error('Erro ao salvar professores:', error);
      alert('Não foi possível salvar o(s) professor(es). Tente novamente.');
    } finally {
      setSavingProf(prev => {
        const next = new Set(prev);
        next.delete(sala.id);
        return next;
      });
    }
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
      await apiMap(selectedSystem).deleteSalaDeAula(salaId);
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="border border-green-600 text-green-700 px-4 py-2 rounded-lg font-medium hover:bg-green-50 transition-colors flex items-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Importar alunos
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nova Sala de Aula
          </button>
        </div>
      </div>

      {showImport && userProfile?.unidade && (
        <ImportarAlunosModal
          system={selectedSystem}
          unidade={userProfile.unidade}
          salasExistentes={salas}
          carregarNomesDoBanco={carregarNomesDoBanco}
          onClose={() => setShowImport(false)}
          onImportado={loadSalas}
        />
      )}

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
                  {expandedSalas.has(sala.id) && (() => {
                    const ativos = countActiveFilters(getSalaFilters(sala.id));
                    const aberto = filtersVisible.has(sala.id);
                    return (
                      <button
                        onClick={() => toggleFiltersVisible(sala.id)}
                        className={`relative flex items-center gap-1 px-2 py-1 rounded-lg text-sm transition-colors ${
                          aberto || ativos > 0
                            ? 'bg-green-100 text-green-700'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                        title="Filtrar alunos"
                      >
                        <SlidersHorizontal className="w-4 h-4" />
                        Filtros
                        {ativos > 0 && (
                          <span className="ml-1 inline-flex items-center justify-center w-5 h-5 text-xs font-semibold text-white bg-green-600 rounded-full">
                            {ativos}
                          </span>
                        )}
                      </button>
                    );
                  })()}
                  <button
                    onClick={() => handleDeleteSala(sala.id)}
                    className="text-red-600 hover:text-red-800 p-1"
                    title="Excluir sala"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => toggleSalaExpansion(sala.id)} className="p-1">
                    {expandedSalas.has(sala.id) ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
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

                  {/* Barra de filtros da sala */}
                  {filtersVisible.has(sala.id) && (() => {
                    const f = getSalaFilters(sala.id);
                    // Níveis e habilidades são escopados pelo componente selecionado.
                    const opts = getSalaFilterOptions(sala, f.componentes);
                    const ativos = countActiveFilters(f);
                    const componenteSelecionado = f.componentes.length > 0;
                    return (
                      <div className="mb-4 p-4 bg-white border border-gray-200 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                            <Filter className="w-4 h-4 text-gray-500" />
                            Filtrar alunos
                          </div>
                          {ativos > 0 && (
                            <button
                              onClick={() => clearSalaFilters(sala.id)}
                              className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800"
                            >
                              <X className="w-3 h-3" />
                              Limpar filtros
                            </button>
                          )}
                        </div>

                        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
                          {/* Nome */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Nome do aluno</label>
                            <div className="relative">
                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                              <input
                                type="text"
                                value={f.nome}
                                onChange={(e) => updateSalaFilter(sala.id, 'nome', e.target.value)}
                                placeholder="Buscar por nome..."
                                className="w-full pl-8 pr-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                              />
                            </div>
                          </div>

                          {/* Componente (multi) — vem primeiro */}
                          <MultiSelect
                            label="Componente"
                            options={opts.componentes}
                            selected={f.componentes}
                            onChange={(v) => updateSalaFilter(sala.id, 'componentes', v)}
                            emptyMessage="Carregando dados dos alunos..."
                          />

                          {/* Nível de desempenho (multi) — condicional ao componente */}
                          {componenteSelecionado && (
                            <MultiSelect
                              label="Nível de desempenho"
                              options={opts.niveis}
                              selected={f.niveis}
                              onChange={(v) => updateSalaFilter(sala.id, 'niveis', v)}
                              placeholder="Todos"
                              emptyMessage="Sem níveis para o componente"
                            />
                          )}

                          {/* Faixa de desempenho (multi) */}
                          <MultiSelect
                            label="Faixa de desempenho"
                            options={DESEMPENHO_BANDS.map(b => ({ value: b.key, label: b.label }))}
                            selected={f.desempenho}
                            onChange={(v) => updateSalaFilter(sala.id, 'desempenho', v)}
                          />

                          {/* Habilidade (multi) — também condicional ao componente */}
                          {componenteSelecionado && (
                            <MultiSelect
                              label="Habilidade"
                              options={opts.habilidades}
                              selected={f.habilidades}
                              onChange={(v) => updateSalaFilter(sala.id, 'habilidades', v)}
                              emptyMessage="Sem habilidades para o componente"
                            />
                          )}
                        </div>

                        {!componenteSelecionado && (
                          <p className="mt-2 text-xs text-gray-500">
                            Selecione um <strong>componente</strong> para filtrar por nível de desempenho e habilidade.
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  {(() => {
                    const alunosFiltrados = getFilteredAlunosDaSala(sala);
                    const total = sala.sala_de_aula_alunos.length;
                    const ativos = countActiveFilters(getSalaFilters(sala.id));
                    const medias = getMediasTurmaComponente(alunosFiltrados);
                    const salvando = savingProf.has(sala.id);
                    const carregandoDados = loadingSalaData.has(sala.id);
                    return (
                      <>
                        {/* Painel: médias por turma × disciplina + professor responsável */}
                        <div className="mb-4 bg-white border border-gray-200 rounded-lg overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
                            <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                              <BarChart3 className="w-4 h-4 text-green-600" />
                              Médias por disciplina
                              {ativos > 0 && (
                                <span className="text-xs font-normal text-gray-500">(com filtros aplicados)</span>
                              )}
                            </div>
                            {hasProfChanges(sala) && (
                              <button
                                onClick={() => saveProfessores(sala)}
                                disabled={salvando}
                                className="flex items-center gap-1 bg-green-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                              >
                                {salvando ? (
                                  <>
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                                    Salvando...
                                  </>
                                ) : (
                                  <>
                                    <Save className="w-3 h-3" />
                                    Salvar professores
                                  </>
                                )}
                              </button>
                            )}
                          </div>

                          {medias.length === 0 ? (
                            <p className="px-4 py-4 text-sm text-gray-500 flex items-center gap-2">
                              {carregandoDados ? (
                                <>
                                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></span>
                                  Carregando notas dos alunos...
                                </>
                              ) : (
                                'Sem notas para exibir com os filtros atuais.'
                              )}
                            </p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-left text-gray-500 border-b border-gray-100">
                                    <th className="px-4 py-2 font-medium">Sala de aula</th>
                                    <th className="px-4 py-2 font-medium">Disciplina</th>
                                    <th className="px-4 py-2 font-medium">Média</th>
                                    <th className="px-4 py-2 font-medium">Alunos</th>
                                    <th className="px-4 py-2 font-medium">Professor responsável</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {medias.map(m => {
                                    const mediaColor =
                                      m.media === null ? 'text-gray-400'
                                        : m.media >= 70 ? 'text-green-600'
                                        : m.media >= 50 ? 'text-yellow-600'
                                        : 'text-red-600';
                                    return (
                                      <tr key={m.componente} className="border-b border-gray-50 last:border-b-0">
                                        <td className="px-4 py-2 font-medium text-gray-900">{sala.nome}</td>
                                        <td className="px-4 py-2 text-gray-700">{m.componenteLabel}</td>
                                        <td className={`px-4 py-2 font-semibold ${mediaColor}`}>
                                          {m.media === null ? '—' : `${m.media.toFixed(1)}%`}
                                        </td>
                                        <td className="px-4 py-2 text-gray-600">{m.totalAlunos}</td>
                                        <td className="px-4 py-2">
                                          <input
                                            type="text"
                                            value={getProfessorValue(sala, m.componente)}
                                            onChange={(e) => setProfessorDraft(sala.id, m.componente, e.target.value)}
                                            placeholder="Nome do professor..."
                                            className="w-full min-w-[10rem] px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                          />
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        {ativos > 0 && (
                          <p className="mb-2 text-sm text-gray-600">
                            Mostrando {alunosFiltrados.length} de {total} aluno(s)
                          </p>
                        )}
                        <div className="space-y-2">
                          {alunosFiltrados.length === 0 ? (
                            <div className="text-center py-6 text-gray-500 bg-white rounded-lg border border-gray-200">
                              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                              <p>Nenhum aluno corresponde aos filtros selecionados</p>
                            </div>
                          ) : (
                            alunosFiltrados.map((aluno) => {
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
                              })
                          )}
                        </div>
                      </>
                    );
                  })()}
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