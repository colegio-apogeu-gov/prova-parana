import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, TrendingUp, TrendingDown, Minus, BarChart3, Users, HelpCircle, School, AlertTriangle } from 'lucide-react';
import { fetchAllProvaData, getAnosProva, getComparacaoAnualAgregada, getComparacaoAnualNiveis } from '../../lib/supabase';
import { fetchAllProvaDataParceiro, getAnosProvaParceiro, getComparacaoAnualAgregadaParceiro, getComparacaoAnualNiveisParceiro } from '../../lib/supabaseParceiro';
import { fetchAllProvaDataMais, getAnosProvaMais, getComparacaoAnualAgregadaMais, getComparacaoAnualNiveisMais } from '../../lib/supabaseMais';
import MultiSelect from '../common/MultiSelect';
import { UserProfile, isGestao, ComparacaoAnualAgregado, ComparacaoAnualNivel } from '../../types';

interface ComparacaoAnualProps {
  userProfile: UserProfile | null;
  selectedSystem: 'prova-parana' | 'parceiro' | 'parana-mais';
}

interface AnoEscolarStats {
  anoEscolar: string;
  componente: string;
  totalAlunos: number;
  alunosAvaliados: number;
  mediaPercentual: number;
  totalAcertos: number;
  totalQuestoes: number;
}

interface ComparisonRow {
  anoEscolar: string;
  componente: string;
  ano1Stats: AnoEscolarStats | null;
  ano2Stats: AnoEscolarStats | null;
  delta: number | null;
  trend: 'up' | 'down' | 'flat' | 'n/a';
}

// Identidade do aluno. No modo multi-escola (gestão) dois alunos homônimos em
// escolas diferentes NÃO podem colapsar num só — por isso a unidade compõe a chave.
const alunoKey = (r: any) => `${r.unidade ?? ''}||${r.nome_aluno ?? ''}`;

function computeStats(rows: any[], anoEscolar: string, componente: string): AnoEscolarStats {
  const filtered = rows.filter(
    (r) => r.ano_escolar === anoEscolar && r.componente === componente && r.avaliado
  );

  const alunosUnicos = new Set(filtered.map(alunoKey));
  const totalAcertos = filtered.reduce((sum, r) => sum + (Number(r.acertos) || 0), 0);
  const totalQuestoes = filtered.reduce((sum, r) => sum + (Number(r.total) || 0), 0);
  const mediaPercentual = totalQuestoes > 0 ? (totalAcertos / totalQuestoes) * 100 : 0;

  return {
    anoEscolar,
    componente,
    totalAlunos: alunosUnicos.size,
    alunosAvaliados: alunosUnicos.size,
    mediaPercentual,
    totalAcertos,
    totalQuestoes,
  };
}

// Uma variação abaixo de 0,5 p.p. é considerada estabilidade.
function trendOf(delta: number | null): 'up' | 'down' | 'flat' | 'n/a' {
  if (delta === null) return 'n/a';
  if (delta > 0.5) return 'up';
  if (delta < -0.5) return 'down';
  return 'flat';
}

// ---- Níveis de aprendizagem: rótulo, ordem (pior→melhor) e cor ----
const NIVEL_RANK: Record<string, number> = {
  'Avançado': 4,
  'Aprendizado Adequado': 4,
  'Adequado': 3,
  'Aprendizado Intermediário': 2,
  'Básico': 2,
  'Defasagem': 1,
  'Abaixo do Básico': 1,
  '-': -1,
};
const nivelRank = (n: string) => (n in NIVEL_RANK ? NIVEL_RANK[n] : 0);
const nivelLabel = (n: string) => (n === '-' || n.trim() === '' ? 'Sem nível' : n);
const nivelDot = (n: string) => {
  const r = nivelRank(n);
  if (r >= 3) return 'bg-green-500';
  if (r === 2) return 'bg-amber-500';
  if (r === 1) return 'bg-red-500';
  return 'bg-gray-400';
};
// Melhor nível primeiro; "Sem nível" (-) por último.
const ordenarNiveis = (arr: string[]) =>
  [...arr].sort((a, b) => nivelRank(b) - nivelRank(a) || a.localeCompare(b));

type Cell = { acertos: number; total: number; alunos: number };

// Distribuição (%) por nível (denominador = soma dos alunos dos níveis da linha).
function distribuicao(m: Map<string, Cell>): { nivel: string; pct: number; alunos: number }[] {
  const totalAlunos = Array.from(m.values()).reduce((s, c) => s + c.alunos, 0);
  if (totalAlunos <= 0) return [];
  return ordenarNiveis(Array.from(m.keys())).map((nivel) => {
    const c = m.get(nivel)!;
    return { nivel, alunos: c.alunos, pct: (c.alunos / totalAlunos) * 100 };
  });
}

function statsFromCell(ae: string, comp: string, c: Cell | undefined): AnoEscolarStats | null {
  if (!c || c.total <= 0) return null;
  return {
    anoEscolar: ae,
    componente: comp,
    totalAlunos: c.alunos,
    alunosAvaliados: c.alunos,
    mediaPercentual: (c.acertos / c.total) * 100,
    totalAcertos: c.acertos,
    totalQuestoes: c.total,
  };
}

// "?" com retângulo explicativo no hover (CSS puro, sem dependências).
const InfoTip: React.FC<{ text: string; align?: 'center' | 'right' }> = ({ text, align = 'center' }) => (
  <span className="relative inline-flex group align-middle ml-1">
    <HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-help" />
    <span
      className={`pointer-events-none absolute z-30 top-full mt-2 w-60 rounded-lg bg-gray-900 text-white text-xs font-normal normal-case leading-snug p-2.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-xl ${
        align === 'right' ? 'right-0' : 'left-1/2 -translate-x-1/2'
      }`}
    >
      {text}
    </span>
  </span>
);

const TIP_MEDIA =
  'Média ponderada por questões: soma dos acertos ÷ soma das questões de todos os alunos avaliados desta série/componente, × 100. Não é a média das notas individuais.';
const TIP_VARIACAO =
  'Diferença, em pontos percentuais, entre a Média do ano de comparação e a do ano base (Média do 2º ano − Média do 1º ano). Verde = subiu, vermelho = caiu.';
const TIP_TENDENCIA =
  'Baseada na variação: seta para cima = melhora (acima de +0,5 p.p.), para baixo = queda (abaixo de −0,5 p.p.) e traço = estável (entre −0,5 e +0,5 p.p.).';
const TIP_NIVEL =
  'Distribuição (%) dos alunos avaliados por nível no ano de comparação (% = alunos do nível ÷ total de alunos avaliados da linha). Ao escolher um nível no filtro, as colunas Média/Variação/Tendência passam a considerar apenas esse nível.';

/**
 * Monta as linhas de comparação a partir dos AGREGADOS (perfil gestão).
 *
 * Só usa as linhas por componente (as de rollup têm `componente === null`).
 * Somar `soma_acertos`/`soma_total` entre escolas reproduz exatamente a mesma
 * média ponderada por questões que o caminho de linhas brutas calcula.
 * Somar `alunos` entre escolas também é correto: um aluno pertence a uma única
 * unidade, então os conjuntos são disjuntos.
 */
function buildComparisonsFromAgg(
  rows: ComparacaoAnualAgregado[],
  anoBase: string,
  anoComparacao: string,
  unidadesSel: string[]
): ComparisonRow[] {
  // Anos iguais não formam comparação. Sem esta guarda, todas as linhas caem
  // em `s1` e a tela renderiza uma tabela com a coluna do 2º ano inteira "--"
  // em vez do aviso "selecione dois anos diferentes". (O caminho admin é
  // protegido pelo próprio useEffect que dispara loadComparison.)
  if (!anoBase || !anoComparacao || anoBase === anoComparacao) return [];
  const permitidas = unidadesSel.length > 0 ? new Set(unidadesSel) : null;

  type Cell = { acertos: number; total: number; alunos: number };
  const novaCell = (): Cell => ({ acertos: 0, total: 0, alunos: 0 });
  const acc = new Map<string, { ae: string; comp: string; s1: Cell; s2: Cell }>();

  rows.forEach((r) => {
    if (r.componente === null) return; // linha de rollup: usada só no KPI
    if (r.ano_prova !== anoBase && r.ano_prova !== anoComparacao) return;
    if (permitidas && !permitidas.has(r.unidade)) return;

    const key = `${r.ano_escolar}||${r.componente}`;
    const e = acc.get(key) ?? { ae: r.ano_escolar, comp: r.componente, s1: novaCell(), s2: novaCell() };
    const alvo = r.ano_prova === anoBase ? e.s1 : e.s2;
    alvo.acertos += r.soma_acertos;
    alvo.total += r.soma_total;
    alvo.alunos += r.alunos;
    acc.set(key, e);
  });

  const toStats = (ae: string, comp: string, c: Cell): AnoEscolarStats => ({
    anoEscolar: ae,
    componente: comp,
    totalAlunos: c.alunos,
    alunosAvaliados: c.alunos,
    mediaPercentual: c.total > 0 ? (c.acertos / c.total) * 100 : 0,
    totalAcertos: c.acertos,
    totalQuestoes: c.total,
  });

  return Array.from(acc.values())
    .sort((a, b) => (a.ae === b.ae ? a.comp.localeCompare(b.comp) : a.ae.localeCompare(b.ae)))
    .map((e) => {
      const hasS1 = e.s1.total > 0;
      const hasS2 = e.s2.total > 0;
      const s1 = toStats(e.ae, e.comp, e.s1);
      const s2 = toStats(e.ae, e.comp, e.s2);
      const delta = hasS1 && hasS2 ? s2.mediaPercentual - s1.mediaPercentual : null;

      return {
        anoEscolar: e.ae,
        componente: e.comp,
        ano1Stats: hasS1 ? s1 : null,
        ano2Stats: hasS2 ? s2 : null,
        delta,
        trend: trendOf(delta),
      };
    });
}

// Monta as linhas de comparação a partir dos dois conjuntos de dados brutos.
function buildComparisons(dataAno1: any[], dataAno2: any[]): ComparisonRow[] {
  const anosEscolaresSet = new Set<string>();
  const componentesSet = new Set<string>();

  [...dataAno1, ...dataAno2].forEach((r) => {
    if (r.ano_escolar) anosEscolaresSet.add(r.ano_escolar);
    if (r.componente) componentesSet.add(r.componente);
  });

  const anosEscolares = Array.from(anosEscolaresSet).sort();
  const componentes = Array.from(componentesSet).sort();

  const rows: ComparisonRow[] = [];

  for (const ae of anosEscolares) {
    for (const comp of componentes) {
      const s1 = computeStats(dataAno1, ae, comp);
      const s2 = computeStats(dataAno2, ae, comp);

      const hasS1 = s1.totalQuestoes > 0;
      const hasS2 = s2.totalQuestoes > 0;

      const delta = hasS1 && hasS2 ? s2.mediaPercentual - s1.mediaPercentual : null;

      rows.push({
        anoEscolar: ae,
        componente: comp,
        ano1Stats: hasS1 ? s1 : null,
        ano2Stats: hasS2 ? s2 : null,
        delta,
        trend: trendOf(delta),
      });
    }
  }

  return rows;
}

const ComparacaoAnual: React.FC<ComparacaoAnualProps> = ({ userProfile, selectedSystem }) => {
  // Usuário "gestão" enxerga todas as escolas nesta tela (e só nesta).
  const gestao = isGestao(userProfile);

  const [anosDisponiveis, setAnosDisponiveis] = useState<string[]>([]);
  const [anoBase, setAnoBase] = useState<string>('');
  const [anoComparacao, setAnoComparacao] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingAnos, setLoadingAnos] = useState(true);
  // Dados brutos dos dois anos. Guardados para que o filtro de unidades
  // recalcule as comparações sem refazer a busca no banco.
  const [rawAno1, setRawAno1] = useState<any[]>([]);
  const [rawAno2, setRawAno2] = useState<any[]>([]);
  const [filterComponente, setFilterComponente] = useState<string>('');
  const [filterAnoEscolar, setFilterAnoEscolar] = useState<string>('');
  // Multi-seleção de unidades (apenas para gestão). Vazio = todas.
  const [selectedUnidades, setSelectedUnidades] = useState<string[]>([]);
  // Dados AGREGADOS (apenas gestão): uma única chamada de RPC cobre todos os
  // anos e todas as escolas. Baixar as linhas brutas da rede inteira estourava
  // o statement_timeout do Postgres.
  const [agregados, setAgregados] = useState<ComparacaoAnualAgregado[]>([]);
  // Agregados por nível (gestão) — alimentam a coluna/filtro "Nível Aprendizagem".
  const [niveisAgg, setNiveisAgg] = useState<ComparacaoAnualNivel[]>([]);
  const [filterNivel, setFilterNivel] = useState<string>('');
  const [erro, setErro] = useState<string>('');

  const systemColor = selectedSystem === 'prova-parana' ? 'blue' : selectedSystem === 'parceiro' ? 'green' : 'orange';
  const systemTitle =
    selectedSystem === 'prova-parana'
      ? 'Prova Parana Recomposicao'
      : selectedSystem === 'parceiro'
      ? 'Avaliacao Parceiro da Escola'
      : 'Parana Mais';

  useEffect(() => {
    setErro('');
    if (gestao) {
      loadAgregados();
    } else {
      loadAnos();
    }
  }, [selectedSystem, userProfile, gestao]);

  // --- Caminho GESTÃO: agregação no servidor -------------------------------
  const loadAgregados = async () => {
    setLoadingAnos(true);
    setAgregados([]);
    setNiveisAgg([]);
    try {
      const fn =
        selectedSystem === 'prova-parana'
          ? getComparacaoAnualAgregada
          : selectedSystem === 'parceiro'
          ? getComparacaoAnualAgregadaParceiro
          : getComparacaoAnualAgregadaMais;
      const fnNiveis =
        selectedSystem === 'prova-parana'
          ? getComparacaoAnualNiveis
          : selectedSystem === 'parceiro'
          ? getComparacaoAnualNiveisParceiro
          : getComparacaoAnualNiveisMais;

      // A quebra por nível é complementar: se a RPC ainda não existir, a tela
      // continua funcionando (a coluna Nível fica vazia).
      const [rows, niveis] = await Promise.all([fn(), fnNiveis().catch(() => [] as ComparacaoAnualNivel[])]);
      setAgregados(rows);
      setNiveisAgg(niveis);

      const anos = Array.from(new Set(rows.map((r) => r.ano_prova)))
        .sort((a, b) => b.localeCompare(a));

      setAnosDisponiveis(anos);
      if (anos.length >= 2) {
        setAnoComparacao(anos[0]);
        setAnoBase(anos[1]);
      } else if (anos.length === 1) {
        setAnoComparacao(anos[0]);
        setAnoBase('');
      }
    } catch (error: any) {
      console.error('Erro ao carregar agregados:', error);
      setErro(
        error?.name === 'RpcAusenteError'
          ? `${error.message}`
          : 'Nao foi possivel carregar a comparacao de todas as escolas.'
      );
    } finally {
      setLoadingAnos(false);
    }
  };

  // --- Caminho ADMIN: comportamento original (uma escola) ------------------
  const loadAnos = async () => {
    setLoadingAnos(true);
    try {
      let anos: string[] = [];
      const unidade = userProfile?.unidade;

      if (selectedSystem === 'prova-parana') {
        anos = await getAnosProva(unidade);
      } else if (selectedSystem === 'parceiro') {
        anos = await getAnosProvaParceiro(unidade);
      } else {
        anos = await getAnosProvaMais(unidade);
      }

      setAnosDisponiveis(anos);
      if (anos.length >= 2) {
        setAnoComparacao(anos[0]);
        setAnoBase(anos[1]);
      } else if (anos.length === 1) {
        setAnoComparacao(anos[0]);
        setAnoBase('');
      }
    } catch (error) {
      console.error('Erro ao carregar anos:', error);
    } finally {
      setLoadingAnos(false);
    }
  };

  const loadComparison = async () => {
    if (!anoBase || !anoComparacao) return;

    setLoading(true);
    setRawAno1([]);
    setRawAno2([]);

    try {
      const baseFilters: any = { ano_prova: anoBase };
      const compFilters: any = { ano_prova: anoComparacao };

      if (userProfile?.unidade) {
        baseFilters.unidade = userProfile.unidade;
        compFilters.unidade = userProfile.unidade;
      }

      let dataAno1: any[] = [];
      let dataAno2: any[] = [];

      if (selectedSystem === 'prova-parana') {
        [dataAno1, dataAno2] = await Promise.all([
          fetchAllProvaData(baseFilters),
          fetchAllProvaData(compFilters),
        ]);
      } else if (selectedSystem === 'parceiro') {
        [dataAno1, dataAno2] = await Promise.all([
          fetchAllProvaDataParceiro(baseFilters),
          fetchAllProvaDataParceiro(compFilters),
        ]);
      } else {
        [dataAno1, dataAno2] = await Promise.all([
          fetchAllProvaDataMais(baseFilters),
          fetchAllProvaDataMais(compFilters),
        ]);
      }

      setRawAno1(dataAno1);
      setRawAno2(dataAno2);
    } catch (error) {
      console.error('Erro ao carregar dados comparativos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Só o admin refaz a busca ao trocar de ano. Gestão já tem tudo agregado.
  useEffect(() => {
    if (!gestao && anoBase && anoComparacao && anoBase !== anoComparacao) {
      loadComparison();
    }
  }, [anoBase, anoComparacao, selectedSystem, gestao]);

  // Unidades presentes nos dados carregados (fonte de verdade para o filtro).
  // Para gestão, `agregados` traz TODOS os anos de uma vez; é preciso restringir
  // aos dois anos comparados, senão o filtro listaria escolas que não têm dado
  // nenhum no período — e o banner diria "todas as N escolas" mentindo.
  const unidadesDisponiveis = useMemo(() => {
    const set = new Set<string>();
    if (gestao) {
      agregados.forEach((r) => {
        if (r.ano_prova === anoBase || r.ano_prova === anoComparacao) {
          set.add(r.unidade);
        }
      });
    } else {
      [...rawAno1, ...rawAno2].forEach((r) => {
        if (r.unidade) set.add(String(r.unidade));
      });
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [gestao, agregados, anoBase, anoComparacao, rawAno1, rawAno2]);

  // Ao trocar de sistema/ano, descarta unidades selecionadas que sumiram.
  useEffect(() => {
    if (selectedUnidades.length === 0) return;
    const validas = selectedUnidades.filter((u) => unidadesDisponiveis.includes(u));
    if (validas.length !== selectedUnidades.length) {
      setSelectedUnidades(validas);
    }
  }, [unidadesDisponiveis]);

  // Aplica o recorte de unidades (gestão). Vazio = todas as escolas.
  const filtrarPorUnidade = useMemo(() => {
    const ativo = gestao && selectedUnidades.length > 0;
    const permitidas = new Set(selectedUnidades);
    return (rows: any[]) => (ativo ? rows.filter((r) => permitidas.has(String(r.unidade))) : rows);
  }, [gestao, selectedUnidades]);

  // Comparações recomputadas quando os dados ou as unidades mudam.
  // Gestão parte dos agregados (RPC); admin, das linhas brutas.
  const comparisons = useMemo(() => {
    if (gestao) {
      return buildComparisonsFromAgg(agregados, anoBase, anoComparacao, selectedUnidades);
    }
    if (rawAno1.length === 0 && rawAno2.length === 0) return [];
    return buildComparisons(filtrarPorUnidade(rawAno1), filtrarPorUnidade(rawAno2));
  }, [gestao, agregados, anoBase, anoComparacao, selectedUnidades, rawAno1, rawAno2, filtrarPorUnidade]);

  // Nível de aprendizagem por linha bruta: parceiro usa padrao_desempenho;
  // os demais, nivel_aprendizagem. Vazio vira '-' (Sem nível).
  const getNivelRaw = (r: any): string => {
    const v = selectedSystem === 'parceiro' ? r.padrao_desempenho : r.nivel_aprendizagem;
    const s = (v ?? '').toString().trim();
    return s === '' ? '-' : s;
  };

  // Quebra por nível: `${ano_escolar}||${componente}` -> { base, comp } de Map<nivel, Cell>.
  // Gestão parte dos agregados por nível (RPC); admin, das linhas brutas (alunos distintos).
  const nivelBreakdown = useMemo(() => {
    const map = new Map<string, { base: Map<string, Cell>; comp: Map<string, Cell> }>();
    const ensure = (key: string) => {
      let e = map.get(key);
      if (!e) { e = { base: new Map(), comp: new Map() }; map.set(key, e); }
      return e;
    };
    const addCell = (m: Map<string, Cell>, nivel: string, acertos: number, total: number, alunos: number) => {
      const c = m.get(nivel) ?? { acertos: 0, total: 0, alunos: 0 };
      c.acertos += acertos; c.total += total; c.alunos += alunos;
      m.set(nivel, c);
    };

    if (gestao) {
      const permitidas = selectedUnidades.length > 0 ? new Set(selectedUnidades) : null;
      niveisAgg.forEach((r) => {
        if (r.ano_prova !== anoBase && r.ano_prova !== anoComparacao) return;
        if (permitidas && !permitidas.has(r.unidade)) return;
        const e = ensure(`${r.ano_escolar}||${r.componente}`);
        const alvo = r.ano_prova === anoBase ? e.base : e.comp;
        addCell(alvo, r.nivel, r.soma_acertos, r.soma_total, r.alunos);
      });
    } else {
      // admin: alunos DISTINTOS por (ano_escolar, componente, nível), via Set.
      type RawCell = { a: number; t: number; al: Set<string> };
      const sets = new Map<string, { base: Map<string, RawCell>; comp: Map<string, RawCell> }>();
      const ensureS = (key: string) => {
        let e = sets.get(key);
        if (!e) { e = { base: new Map(), comp: new Map() }; sets.set(key, e); }
        return e;
      };
      const addRaw = (which: 'base' | 'comp', rows: any[]) => {
        filtrarPorUnidade(rows).forEach((r) => {
          if (!r.avaliado || !r.ano_escolar || !r.componente) return;
          const nivel = getNivelRaw(r);
          const bucket = ensureS(`${r.ano_escolar}||${r.componente}`)[which];
          const c = bucket.get(nivel) ?? { a: 0, t: 0, al: new Set<string>() };
          c.a += Number(r.acertos) || 0;
          c.t += Number(r.total) || 0;
          c.al.add(alunoKey(r));
          bucket.set(nivel, c);
        });
      };
      addRaw('base', rawAno1);
      addRaw('comp', rawAno2);
      sets.forEach((e, key) => {
        const dst = ensure(key);
        e.base.forEach((c, nivel) => addCell(dst.base, nivel, c.a, c.t, c.al.size));
        e.comp.forEach((c, nivel) => addCell(dst.comp, nivel, c.a, c.t, c.al.size));
      });
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gestao, niveisAgg, anoBase, anoComparacao, selectedUnidades, rawAno1, rawAno2, filtrarPorUnidade, selectedSystem]);

  const availableNiveis = useMemo(() => {
    const set = new Set<string>();
    nivelBreakdown.forEach((e) => {
      e.base.forEach((_v, n) => set.add(n));
      e.comp.forEach((_v, n) => set.add(n));
    });
    return ordenarNiveis(Array.from(set));
  }, [nivelBreakdown]);

  // Se o nível filtrado deixar de existir (troca de sistema/ano/unidade), limpa.
  useEffect(() => {
    if (filterNivel && !availableNiveis.includes(filterNivel)) setFilterNivel('');
  }, [availableNiveis, filterNivel]);

  // Linhas exibidas: sempre trazem a distribuição por nível (ano de comparação).
  // Com um nível filtrado, Média/Alunos/Variação/Tendência passam a ser DAQUELE nível.
  const displayRows = useMemo(() => {
    return comparisons.map((row) => {
      const bd = nivelBreakdown.get(`${row.anoEscolar}||${row.componente}`);
      const nivelDist = bd ? distribuicao(bd.comp) : [];
      if (!filterNivel) {
        return { ...row, nivelDist };
      }
      const s1 = statsFromCell(row.anoEscolar, row.componente, bd?.base.get(filterNivel));
      const s2 = statsFromCell(row.anoEscolar, row.componente, bd?.comp.get(filterNivel));
      const delta = s1 && s2 ? s2.mediaPercentual - s1.mediaPercentual : null;
      return {
        anoEscolar: row.anoEscolar,
        componente: row.componente,
        ano1Stats: s1,
        ano2Stats: s2,
        delta,
        trend: trendOf(delta),
        nivelDist,
      };
    });
  }, [comparisons, nivelBreakdown, filterNivel]);

  const filteredComparisons = displayRows.filter((row) => {
    if (filterComponente && row.componente !== filterComponente) return false;
    if (filterAnoEscolar && row.anoEscolar !== filterAnoEscolar) return false;
    // Com nível filtrado, esconde linhas sem alunos daquele nível em nenhum dos anos.
    if (filterNivel && !row.ano1Stats && !row.ano2Stats) return false;
    return true;
  });

  const availableAnosEscolares = Array.from(new Set(comparisons.map((r) => r.anoEscolar))).sort();
  const availableComponentes = Array.from(new Set(comparisons.map((r) => r.componente))).sort();

  // Quantas escolas efetivamente entram na conta exibida.
  const escolasConsideradas =
    selectedUnidades.length > 0 ? selectedUnidades.length : unidadesDisponiveis.length;

  const overallDelta = (() => {
    const valid = filteredComparisons.filter((r) => r.delta !== null);
    if (valid.length === 0) return null;
    return valid.reduce((sum, r) => sum + (r.delta || 0), 0) / valid.length;
  })();

  // Alunos distintos avaliados, honrando os filtros ativos (unidades, ano
  // escolar e componente). Contar somando `totalAlunos` das linhas duplicaria
  // quem faz LP e MT — e, no modo multi-escola, inflaria muito o número.
  const contarAlunosDistintos = (rows: any[]) => {
    const alunos = new Set<string>();
    filtrarPorUnidade(rows).forEach((r) => {
      if (!r.avaliado) return;
      if (filterAnoEscolar && r.ano_escolar !== filterAnoEscolar) return;
      if (filterComponente && r.componente !== filterComponente) return;
      alunos.add(alunoKey(r));
    });
    return alunos.size;
  };

  // Versão para gestão: usa os agregados. Quando o filtro de componente está em
  // "Todos", conta pelas linhas de rollup (componente === null), que já trazem
  // alunos distintos por série — somar LP + MT contaria duas vezes quem fez as
  // duas provas. Somar entre unidades é seguro (conjuntos disjuntos).
  const contarAlunosAgregado = (ano: string) => {
    const permitidas = selectedUnidades.length > 0 ? new Set(selectedUnidades) : null;
    return agregados.reduce((soma, r) => {
      if (r.ano_prova !== ano) return soma;
      if (permitidas && !permitidas.has(r.unidade)) return soma;
      if (filterAnoEscolar && r.ano_escolar !== filterAnoEscolar) return soma;
      const casaComponente = filterComponente
        ? r.componente === filterComponente
        : r.componente === null;
      return casaComponente ? soma + r.alunos : soma;
    }, 0);
  };

  const totalAlunosAno1 = useMemo(
    () => (gestao ? contarAlunosAgregado(anoBase) : contarAlunosDistintos(rawAno1)),
    [gestao, agregados, anoBase, selectedUnidades, rawAno1, filtrarPorUnidade, filterAnoEscolar, filterComponente]
  );
  const totalAlunosAno2 = useMemo(
    () => (gestao ? contarAlunosAgregado(anoComparacao) : contarAlunosDistintos(rawAno2)),
    [gestao, agregados, anoComparacao, selectedUnidades, rawAno2, filtrarPorUnidade, filterAnoEscolar, filterComponente]
  );

  const TrendIcon = ({ trend, size = 'w-5 h-5' }: { trend: string; size?: string }) => {
    if (trend === 'up') return <TrendingUp className={`${size} text-green-600`} />;
    if (trend === 'down') return <TrendingDown className={`${size} text-red-600`} />;
    if (trend === 'flat') return <Minus className={`${size} text-gray-500`} />;
    return <Minus className={`${size} text-gray-300`} />;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className={`bg-${systemColor}-100 p-2 rounded-lg`}>
            <Calendar className={`w-6 h-6 text-${systemColor}-600`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-gray-900">Comparacao Anual</h2>
              {gestao && (
                <span className="text-xs font-medium bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                  Gestao
                </span>
              )}
            </div>
            <p className="text-gray-600 text-sm">
              {gestao
                ? `Compare o desempenho medio por ano escolar entre diferentes anos, em todas as escolas - ${systemTitle}`
                : `Compare o desempenho medio por ano escolar entre diferentes anos - ${systemTitle}`}
            </p>
          </div>
        </div>

        {erro ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Nao foi possivel carregar a comparacao</p>
              <p className="text-sm text-red-700 mt-1">{erro}</p>
            </div>
          </div>
        ) : loadingAnos ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : anosDisponiveis.length < 2 ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
            <p className="text-sm text-yellow-800">
              Sao necessarios dados de pelo menos 2 anos diferentes para realizar a comparacao.
              {anosDisponiveis.length === 1 && ` Atualmente ha dados apenas de ${anosDisponiveis[0]}.`}
              {anosDisponiveis.length === 0 && ' Nenhum dado encontrado.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className={`grid grid-cols-2 gap-4 ${gestao ? 'md:grid-cols-6' : 'md:grid-cols-5'}`}>
              {/* Unidades (somente gestão) */}
              {gestao && (
                <div className="col-span-2 md:col-span-1">
                  <MultiSelect
                    label="Unidades"
                    options={unidadesDisponiveis.map((u) => ({ value: u, label: u }))}
                    selected={selectedUnidades}
                    onChange={setSelectedUnidades}
                    placeholder={
                      unidadesDisponiveis.length > 0
                        ? `Todas (${unidadesDisponiveis.length})`
                        : 'Todas'
                    }
                    emptyMessage={loading || loadingAnos ? 'Carregando escolas...' : 'Nenhuma escola nos dados'}
                    accent={systemColor as 'blue' | 'green' | 'orange'}
                    searchable
                    showSelectAll
                    largeLabel
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ano Base</label>
                <select
                  value={anoBase}
                  onChange={(e) => setAnoBase(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">Selecione</option>
                  {anosDisponiveis.map((ano) => (
                    <option key={ano} value={ano}>{ano}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ano Comparacao</label>
                <select
                  value={anoComparacao}
                  onChange={(e) => setAnoComparacao(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">Selecione</option>
                  {anosDisponiveis.map((ano) => (
                    <option key={ano} value={ano}>{ano}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ano Escolar</label>
                <select
                  value={filterAnoEscolar}
                  onChange={(e) => setFilterAnoEscolar(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">Todos</option>
                  {availableAnosEscolares.map((ae) => (
                    <option key={ae} value={ae}>{ae}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Componente</label>
                <select
                  value={filterComponente}
                  onChange={(e) => setFilterComponente(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">Todos</option>
                  {availableComponentes.map((c) => (
                    <option key={c} value={c}>{c === 'LP' ? 'Lingua Portuguesa' : c === 'MT' ? 'Matematica' : c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nivel Aprendizagem</label>
                <select
                  value={filterNivel}
                  onChange={(e) => setFilterNivel(e.target.value)}
                  disabled={availableNiveis.length === 0}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <option value="">Todos</option>
                  {availableNiveis.map((n) => (
                    <option key={n} value={n}>{nivelLabel(n)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Escopo da comparação (gestão) */}
            {gestao && !loading && unidadesDisponiveis.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2">
                <School className="w-4 h-4 text-gray-500 shrink-0" />
                {selectedUnidades.length === 0 ? (
                  <span>
                    Comparando <strong>todas as {unidadesDisponiveis.length} escolas</strong> com dados nos anos selecionados.
                  </span>
                ) : (
                  <>
                    <span>
                      Comparando <strong>{escolasConsideradas}</strong> de {unidadesDisponiveis.length} escolas:
                    </span>
                    <span className="flex flex-wrap gap-1">
                      {selectedUnidades.map((u) => (
                        <span key={u} className="bg-white border border-gray-200 rounded px-2 py-0.5 text-xs text-gray-700">
                          {u}
                        </span>
                      ))}
                    </span>
                    <button
                      onClick={() => setSelectedUnidades([])}
                      className="ml-auto text-xs font-medium text-red-600 hover:text-red-800"
                    >
                      Limpar
                    </button>
                  </>
                )}
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
                  <p className="text-sm text-gray-500">Carregando dados comparativos...</p>
                </div>
              </div>
            ) : comparisons.length > 0 ? (
              <>
                <div className={`grid grid-cols-1 gap-4 ${gestao ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
                  {gestao && (
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                      <div className="flex items-center gap-2 mb-1">
                        <School className="w-4 h-4 text-gray-500" />
                        <span className="text-xs text-gray-500 font-medium">Escolas na comparacao</span>
                      </div>
                      <span className="text-2xl font-bold text-gray-900">{escolasConsideradas}</span>
                      <p className="text-xs text-gray-500 mt-1">
                        {selectedUnidades.length === 0 ? 'Todas as escolas' : `de ${unidadesDisponiveis.length} disponiveis`}
                      </p>
                    </div>
                  )}

                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                    <div className="flex items-center gap-2 mb-1">
                      <BarChart3 className="w-4 h-4 text-gray-500" />
                      <span className="text-xs text-gray-500 font-medium">Variacao Media Geral</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {overallDelta !== null ? (
                        <>
                          <span className={`text-2xl font-bold ${overallDelta > 0 ? 'text-green-700' : overallDelta < 0 ? 'text-red-700' : 'text-gray-700'}`}>
                            {overallDelta > 0 ? '+' : ''}{overallDelta.toFixed(1)}%
                          </span>
                          <TrendIcon trend={overallDelta > 0.5 ? 'up' : overallDelta < -0.5 ? 'down' : 'flat'} />
                        </>
                      ) : (
                        <span className="text-2xl font-bold text-gray-400">--</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{anoBase} para {anoComparacao}</p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-4 h-4 text-gray-500" />
                      <span className="text-xs text-gray-500 font-medium">Alunos Avaliados ({anoBase})</span>
                    </div>
                    <span className="text-2xl font-bold text-gray-900">{totalAlunosAno1.toLocaleString()}</span>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-4 h-4 text-gray-500" />
                      <span className="text-xs text-gray-500 font-medium">Alunos Avaliados ({anoComparacao})</span>
                    </div>
                    <span className="text-2xl font-bold text-gray-900">{totalAlunosAno2.toLocaleString()}</span>
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Ano Escolar</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-700">Componente</th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-700">
                            <span className="inline-flex items-center">Media {anoBase}<InfoTip text={TIP_MEDIA} /></span>
                          </th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-700">Alunos {anoBase}</th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-700">
                            <span className="inline-flex items-center">Media {anoComparacao}<InfoTip text={TIP_MEDIA} /></span>
                          </th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-700">Alunos {anoComparacao}</th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-700">
                            <span className="inline-flex items-center">Variacao<InfoTip text={TIP_VARIACAO} /></span>
                          </th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-700">
                            <span className="inline-flex items-center">Tendencia<InfoTip text={TIP_TENDENCIA} align="right" /></span>
                          </th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-700">
                            <span className="inline-flex items-center">Nivel Aprendizagem<InfoTip text={TIP_NIVEL} align="right" /></span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredComparisons.map((row, idx) => (
                          <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 font-medium text-gray-900">{row.anoEscolar}</td>
                            <td className="px-4 py-3 text-gray-700">
                              {row.componente === 'LP' ? 'Lingua Portuguesa' : row.componente === 'MT' ? 'Matematica' : row.componente}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {row.ano1Stats ? (
                                <span className="font-medium">{row.ano1Stats.mediaPercentual.toFixed(1)}%</span>
                              ) : (
                                <span className="text-gray-400">--</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-600">
                              {row.ano1Stats?.totalAlunos || '--'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {row.ano2Stats ? (
                                <span className="font-medium">{row.ano2Stats.mediaPercentual.toFixed(1)}%</span>
                              ) : (
                                <span className="text-gray-400">--</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-600">
                              {row.ano2Stats?.totalAlunos || '--'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {row.delta !== null ? (
                                <span className={`font-semibold ${row.delta > 0 ? 'text-green-700' : row.delta < 0 ? 'text-red-700' : 'text-gray-600'}`}>
                                  {row.delta > 0 ? '+' : ''}{row.delta.toFixed(1)}%
                                </span>
                              ) : (
                                <span className="text-gray-400">--</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex justify-center">
                                <TrendIcon trend={row.trend} size="w-4 h-4" />
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {filterNivel ? (
                                (() => {
                                  const d = row.nivelDist.find((x) => x.nivel === filterNivel);
                                  return d ? (
                                    <div className="flex items-center justify-center gap-1.5 text-xs">
                                      <span className={`w-2 h-2 rounded-full ${nivelDot(d.nivel)}`} />
                                      <span className="text-gray-700 tabular-nums">{d.pct.toFixed(0)}%</span>
                                      <span className="text-gray-500">({d.alunos})</span>
                                    </div>
                                  ) : (
                                    <span className="text-gray-400 text-xs flex justify-center">--</span>
                                  );
                                })()
                              ) : row.nivelDist.length > 0 ? (
                                <div className="flex flex-col gap-0.5 min-w-[9.5rem]">
                                  {row.nivelDist.map((d) => (
                                    <div key={d.nivel} className="flex items-center gap-1.5 text-xs" title={`${nivelLabel(d.nivel)}: ${d.alunos} aluno(s)`}>
                                      <span className={`w-2 h-2 rounded-full shrink-0 ${nivelDot(d.nivel)}`} />
                                      <span className="text-gray-700 tabular-nums w-8 text-right">{d.pct.toFixed(0)}%</span>
                                      <span className="text-gray-500 truncate">{nivelLabel(d.nivel)}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-400 text-xs flex justify-center">--</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {filteredComparisons.length > 0 && (
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">Visualizacao Comparativa</h3>
                    <div className="space-y-3">
                      {filteredComparisons.map((row, idx) => {
                        const maxVal = Math.max(
                          row.ano1Stats?.mediaPercentual || 0,
                          row.ano2Stats?.mediaPercentual || 0,
                          1
                        );
                        const barMax = Math.min(100, Math.ceil(maxVal / 10) * 10 + 10);

                        return (
                          <div key={idx} className="flex items-center gap-3">
                            <div className="w-32 text-xs font-medium text-gray-700 text-right shrink-0">
                              {row.anoEscolar} - {row.componente}
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-500 w-8">{anoBase}</span>
                                <div className="flex-1 bg-gray-100 rounded-full h-4 relative overflow-hidden">
                                  <div
                                    className="absolute top-0 left-0 h-full bg-blue-400 rounded-full transition-all duration-500"
                                    style={{ width: `${((row.ano1Stats?.mediaPercentual || 0) / barMax) * 100}%` }}
                                  />
                                  <span className="absolute right-2 top-0 h-full flex items-center text-[10px] font-medium text-gray-700">
                                    {row.ano1Stats ? `${row.ano1Stats.mediaPercentual.toFixed(1)}%` : '--'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-500 w-8">{anoComparacao}</span>
                                <div className="flex-1 bg-gray-100 rounded-full h-4 relative overflow-hidden">
                                  <div
                                    className={`absolute top-0 left-0 h-full rounded-full transition-all duration-500 ${
                                      row.trend === 'up' ? 'bg-green-400' : row.trend === 'down' ? 'bg-red-400' : 'bg-gray-400'
                                    }`}
                                    style={{ width: `${((row.ano2Stats?.mediaPercentual || 0) / barMax) * 100}%` }}
                                  />
                                  <span className="absolute right-2 top-0 h-full flex items-center text-[10px] font-medium text-gray-700">
                                    {row.ano2Stats ? `${row.ano2Stats.mediaPercentual.toFixed(1)}%` : '--'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="w-16 text-right shrink-0">
                              {row.delta !== null ? (
                                <span className={`text-xs font-semibold ${row.delta > 0 ? 'text-green-700' : row.delta < 0 ? 'text-red-700' : 'text-gray-500'}`}>
                                  {row.delta > 0 ? '+' : ''}{row.delta.toFixed(1)}%
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">--</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : anoBase && anoComparacao && anoBase !== anoComparacao ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                {gestao && selectedUnidades.length > 0
                  ? 'Nenhum dado encontrado para as escolas e anos selecionados.'
                  : 'Nenhum dado encontrado para os anos selecionados.'}
              </div>
            ) : anoBase === anoComparacao && anoBase ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                <p className="text-sm text-yellow-800">Selecione dois anos diferentes para comparar.</p>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default ComparacaoAnual;
