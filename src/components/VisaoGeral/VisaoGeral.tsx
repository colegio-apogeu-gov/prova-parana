// /pages/VisaoGeral.tsx
import React, { useState, useEffect } from 'react';
import { UserProfile } from '../../types';
import FilterPanel from './FilterPanel';
import ProficiencyGauge from './ProficiencyGauge';

import { getProficiencySummary, ProficiencyRow } from '../../lib/supabase';
import { getProficiencyDataParceiro } from '../../lib/supabaseParceiro';
import { getProficiencyDataMais } from '../../lib/supabaseParanaMais';

interface VisaoGeralProps {
  userProfile: UserProfile | null;
  selectedSystem: 'prova-parana' | 'parceiro' | 'parana-mais';
}

interface Filters {
  componente: string;
  regional: string;
  unidade: string;
  ano_escolar: string;
}

interface ComparativoEscola {
  escola: string;
  lp2024: number | null;
  lp2025: number | null;
  lpDiff: number | null;
  mat2024: number | null;
  mat2025: number | null;
  matDiff: number | null;
  ch2024?: number | null;
  ch2025?: number | null;
  chDiff?: number | null;
  cn2024?: number | null;
  cn2025?: number | null;
  cnDiff?: number | null;
  mediaGeral2024: number | null;
  mediaGeral2025: number | null;
  mediaGeralDiff: number | null;
}

type CardData = {
  value: number;
  label: string;
  defasagem: number;
  intermediario: number;
  adequado: number;
};

const VisaoGeral: React.FC<VisaoGeralProps> = ({ userProfile, selectedSystem }) => {
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    componente: '',
    regional: '',
    unidade: '',
    ano_escolar: ''
  });
  const [comparativoEscolasEF, setComparativoEscolasEF] = useState<ComparativoEscola[]>([]);
  const [comparativoEscolasEM, setComparativoEscolasEM] = useState<ComparativoEscola[]>([]);

  const [proficiencyData, setProficiencyData] = useState<{
    unidade1Avaliacao: CardData;
    unidade2Avaliacao: CardData;
    regional1Avaliacao: CardData;
    regional2Avaliacao: CardData;
    redeToda1Avaliacao: CardData;
    redeToda2Avaliacao: CardData;
  }>({
    unidade1Avaliacao: { value: 0, label: 'Unidade - 1ª Avaliação', defasagem: 0, intermediario: 0, adequado: 0 },
    unidade2Avaliacao: { value: 0, label: 'Unidade - 2ª Avaliação', defasagem: 0, intermediario: 0, adequado: 0 },
    regional1Avaliacao: { value: 0, label: 'Regional - 1ª Avaliação', defasagem: 0, intermediario: 0, adequado: 0 },
    regional2Avaliacao: { value: 0, label: 'Regional - 2ª Avaliação', defasagem: 0, intermediario: 0, adequado: 0 },
    redeToda1Avaliacao: { value: 0, label: 'Rede Toda - 1ª Avaliação', defasagem: 0, intermediario: 0, adequado: 0 },
    redeToda2Avaliacao: { value: 0, label: 'Rede Toda - 2ª Avaliação', defasagem: 0, intermediario: 0, adequado: 0 }
  });

  useEffect(() => {
    if (userProfile) {
      setFilters(prev => ({
        ...prev,
        unidade: userProfile.unidade || '',
        regional: userProfile.regional || ''
      }));
    }
  }, [userProfile]);

  useEffect(() => {
    loadProficiencyData();
    if (selectedSystem === 'parana-mais') {
      loadComparativoEscolas();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, selectedSystem]);

  // ---------- Utils de exibição ----------
  const getDominantLevel = (data: { defasagem: number; intermediario: number; adequado: number }) => {
    const { defasagem, intermediario, adequado } = data;
    const max = Math.max(defasagem, intermediario, adequado);
    if (max === defasagem) return 'Defasagem';
    if (max === intermediario) return 'Aprendizado Intermediário';
    return 'Aprendizado Adequado';
  };

// Pesos fixos (conforme validação institucional)
const WEIGHT_DEF = 2;
const WEIGHT_INT = 50;
const WEIGHT_ADE = 95;

const computeProfMedia = (def: number, inter: number, adeq: number) => {
  const N = def + inter + adeq;
  if (!N) return 0;
  return ((def * WEIGHT_DEF) + (inter * WEIGHT_INT) + (adeq * WEIGHT_ADE)) / N;
};


const normalizeComponente = (c?: string) =>
  !c || c.toLowerCase() === 'Todos' ? undefined : c;

  const getProficiencyColor = (nivel: string): string => {
    switch (nivel) {
      case 'Defasagem':
        return '#EF4444'; // vermelho
      case 'Aprendizado Intermediário':
        return '#F59E0B'; // amarelo
      case 'Aprendizado Adequado':
        return '#10B981'; // verde
      default:
        return '#9CA3AF'; // cinza
    }
  };

// ✅ Troque seu helper por este genérico
const normalizeSelect = (x?: string) => {
  if (!x) return undefined;
  const s = x.trim().toLowerCase();
  if (!s || s === 'todos' || s === 'todas' || s === 'all') return undefined;
  return x; // mantém o valor original quando não for "Todos/Todas"
};


  const safeN = (x: any) => {
    const n = Number(x);
    return Number.isFinite(n) ? n : 0;
  };

  const TrendBadge = ({
    curr,
    prev,
    betterWhen,
  }: {
    curr: number;
    prev: number;
    betterWhen: 'down' | 'up';
  }) => {
    const current = safeN(curr);
    const previous = safeN(prev);
    const rawDelta = current - previous;
    const improved = betterWhen === 'down' ? rawDelta < 0 : rawDelta > 0;
    const amount = Math.abs(rawDelta);
    if (amount === 0) return null;

    const sign = improved ? '+' : '−';
    const colorClass = improved ? 'text-green-600' : 'text-red-600';
    return (
      <span className={`text-xs font-semibold ${colorClass}`}>
        ({sign}{amount})
      </span>
    );
  };

  const Card = ({
    title, value, def, inter, adeq, compareTo
  }: {
    title: string;
    value: number;
    def: number;
    inter: number;
    adeq: number;
    compareTo?: { value: number; def: number; inter: number; adeq: number };
  }) => {
    const v = safeN(value);
    const d = safeN(def);
    const i = safeN(inter);
    const a = safeN(adeq);

    const cv = compareTo ? safeN(compareTo.value) : 0;
    const cd = compareTo ? safeN(compareTo.def)   : 0;
    const ci = compareTo ? safeN(compareTo.inter) : 0;
    const ca = compareTo ? safeN(compareTo.adeq)  : 0;

    const total = d + i + a;
    const totalCompare = cd + ci + ca;
    const diffPct = compareTo ? (v - cv) : 0;
    const diffTotal = compareTo ? (total - totalCompare) : 0;

    const dominantLevel = getDominantLevel({ defasagem: d, intermediario: i, adequado: a });
    const dominantColor = getProficiencyColor(dominantLevel);

    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">{title}</h3>
        <ProficiencyGauge value={v} color={dominantColor} />
        <div className="text-center mt-4">
          <p className="text-sm text-gray-600">Nível de Proficiência</p>
          <div className="flex items-center justify-center gap-2">
            <p className="text-lg font-semibold" style={{ color: dominantColor }}>
              {dominantLevel}
            </p>
            {compareTo && Math.abs(diffPct) >= 0.1 && (
              <span className={`text-sm font-semibold ${diffPct > 0 ? 'text-green-600' : 'text-red-600'}`}>
                ({diffPct > 0 ? '+' : ''}{diffPct.toFixed(1)}%)
                {totalCompare !== total && Number.isFinite(diffTotal) && (
                  <span className="ml-1">
                    ({diffTotal > 0 ? '+' : ''}{diffTotal} {Math.abs(diffTotal) === 1 ? 'aluno' : 'alunos'})
                  </span>
                )}
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-gray-700">Defasagem</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">
                {d} {Math.abs(d) === 1 ? 'aluno' : 'alunos'}
              </span>
              {compareTo && <TrendBadge curr={d} prev={cd} betterWhen="down" />}
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span className="text-gray-700">Intermediário</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">
                {i} {Math.abs(i) === 1 ? 'aluno' : 'alunos'}
              </span>
              {compareTo && <TrendBadge curr={i} prev={ci} betterWhen="down" />}
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-gray-700">Adequado</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">
                {a} {Math.abs(a) === 1 ? 'aluno' : 'alunos'}
              </span>
              {compareTo && <TrendBadge curr={a} prev={ca} betterWhen="up" />}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ---------- Helpers para mapear RPC → cards ----------
  const pickSem = (rows: ProficiencyRow[], n: number): ProficiencyRow | undefined =>
    rows.find(r => Number(r.semestre) === n);

const toCardFromRpc = (row?: ProficiencyRow) => {
  const def = Number(row?.defasagem ?? 0);
  const inter = Number(row?.intermediario ?? 0);
  const adeq = Number(row?.adequado ?? 0);

  return {
    value: computeProfMedia(def, inter, adeq), // ← novo cálculo
    defasagem: def,
    intermediario: inter,
    adequado: adeq,
  };
};


  // ---------- Fluxo “parceiro” (agregação leve em memória) ----------
  // Reaproveita sua coleção bruta do parceiro sem paginação infinita.
  const LEVEL_RANK: Record<string, number> = {
    'Defasagem': 0,
    'Aprendizado Intermediário': 1,
    'Aprendizado Adequado': 2,
  };
  const sanitizeLevel = (raw: any): 'Defasagem'|'Aprendizado Intermediário'|'Aprendizado Adequado'|null => {
    if (!raw) return null;
    const s = String(raw).trim();
    if (s === 'Defasagem') return 'Defasagem';
    if (s === 'Aprendizado Intermediário') return 'Aprendizado Intermediário';
    if (s === 'Aprendizado Adequado') return 'Aprendizado Adequado';
    return null;
  };
  type RawParceiro = {
    nome_aluno?: string;
    avaliado?: boolean;
    nivel_aprendizagem?: string;
    semestre?: string | number;
    regional?: string | null;
    unidade?: string | null;
  };
  const aggregateParceiro = (rows: RawParceiro[]) => {
    // pior nível por aluno
    const byStudent = new Map<string, number>();
    for (const item of rows) {
      if (!item?.avaliado) continue;
      const aluno = (item?.nome_aluno || '').trim();
      const lvl = sanitizeLevel(item?.nivel_aprendizagem);
      if (!aluno || !lvl) continue;
      const rank = LEVEL_RANK[lvl];
      if (!byStudent.has(aluno)) byStudent.set(aluno, rank);
      else byStudent.set(aluno, Math.min(byStudent.get(aluno)!, rank));
    }
  const total = byStudent.size;
  let def = 0, inter = 0, adeq = 0;
  for (const r of byStudent.values()) {
    if (r === 0) def++;
    else if (r === 1) inter++;
    else adeq++;
  }
  return {
    value: computeProfMedia(def, inter, adeq), // ← novo cálculo
    defasagem: def,
    intermediario: inter,
    adequado: adeq
  };
};

  // ---------- Loader principal ----------
const loadProficiencyData = async () => {
  const normalizeSelect = (x?: string) => {
    if (!x) return undefined;
    const s = x.trim().toLowerCase();
    if (!s || s === 'todos' || s === 'todas' || s === 'all') return undefined;
    return x;
  };

  setLoading(true);
  try {
    if (selectedSystem === 'parceiro') {
      const comp = normalizeSelect(filters.componente);
      const ano  = normalizeSelect(filters.ano_escolar);
      const reg  = normalizeSelect(filters.regional);
      const uni  = normalizeSelect(filters.unidade);

      const raw: RawParceiro[] = await getProficiencyDataParceiro({
        componente: comp,
        ano_escolar: ano,
        regional: reg,
        unidade: uni,
      });

      // Rede (sempre): separar S1/S2
      const redeS1 = raw.filter(d => String(d.semestre) === '1');
      const redeS2 = raw.filter(d => String(d.semestre) === '2');

      // Regional: só filtra se houver regional válida
      const regionalRaw = reg ? raw.filter(d => d.regional === reg) : raw;
      const regS1 = regionalRaw.filter(d => String(d.semestre) === '1');
      const regS2 = regionalRaw.filter(d => String(d.semestre) === '2');

      // Unidade: só filtra se houver unidade válida
      const unidadeRaw = uni ? raw.filter(d => d.unidade === uni) : raw;
      const uniS1 = unidadeRaw.filter(d => String(d.semestre) === '1');
      const uniS2 = unidadeRaw.filter(d => String(d.semestre) === '2');

      // Agrega
      const unidade1 = aggregateParceiro(uniS1);
      const unidade2 = aggregateParceiro(uniS2);
      const regional1 = aggregateParceiro(regS1);
      const regional2 = aggregateParceiro(regS2);
      const redeToda1 = aggregateParceiro(redeS1);
      const redeToda2 = aggregateParceiro(redeS2);

      setProficiencyData({
        unidade1Avaliacao: { label: 'Unidade - 1ª Avaliação', ...unidade1 },
        unidade2Avaliacao: { label: 'Unidade - 2ª Avaliação', ...unidade2 },
        regional1Avaliacao:{ label: 'Regional - 1ª Avaliação', ...regional1 },
        regional2Avaliacao:{ label: 'Regional - 2ª Avaliação', ...regional2 },
        redeToda1Avaliacao:{ label: 'Rede Toda - 1ª Avaliação', ...redeToda1 },
        redeToda2Avaliacao:{ label: 'Rede Toda - 2ª Avaliação', ...redeToda2 },
      });
      return;
    }

    if (selectedSystem === 'parana-mais') {
      const comp = normalizeSelect(filters.componente);
      const ano  = normalizeSelect(filters.ano_escolar);
      const reg  = normalizeSelect(filters.regional);
      const uni  = normalizeSelect(filters.unidade);

      const raw: RawParceiro[] = await getProficiencyDataMais({
        componente: comp,
        ano_escolar: ano,
        regional: reg,
        unidade: uni,
      });

      const redeS1 = raw.filter(d => String(d.semestre) === '1');
      const redeS2 = raw.filter(d => String(d.semestre) === '2');

      const regionalRaw = reg ? raw.filter(d => d.regional === reg) : raw;
      const regS1 = regionalRaw.filter(d => String(d.semestre) === '1');
      const regS2 = regionalRaw.filter(d => String(d.semestre) === '2');

      const unidadeRaw = uni ? raw.filter(d => d.unidade === uni) : raw;
      const uniS1 = unidadeRaw.filter(d => String(d.semestre) === '1');
      const uniS2 = unidadeRaw.filter(d => String(d.semestre) === '2');

      const unidade1 = aggregateParceiro(uniS1);
      const unidade2 = aggregateParceiro(uniS2);
      const regional1 = aggregateParceiro(regS1);
      const regional2 = aggregateParceiro(regS2);
      const redeToda1 = aggregateParceiro(redeS1);
      const redeToda2 = aggregateParceiro(redeS2);

      setProficiencyData({
        unidade1Avaliacao: { label: 'Unidade - 1ª Avaliação', ...unidade1 },
        unidade2Avaliacao: { label: 'Unidade - 2ª Avaliação', ...unidade2 },
        regional1Avaliacao:{ label: 'Regional - 1ª Avaliação', ...regional1 },
        regional2Avaliacao:{ label: 'Regional - 2ª Avaliação', ...regional2 },
        redeToda1Avaliacao:{ label: 'Rede Toda - 1ª Avaliação', ...redeToda1 },
        redeToda2Avaliacao:{ label: 'Rede Toda - 2ª Avaliação', ...redeToda2 },
      });
      return;
    }

    // -------------------- PROVA-PARANÁ (RPC) --------------------
    const comp = normalizeSelect(filters.componente);
    const ano  = normalizeSelect(filters.ano_escolar);
    const reg  = normalizeSelect(filters.regional);
    const uni  = normalizeSelect(filters.unidade);

    const base = { componente: comp, ano_escolar: ano };

    const [redeRows, regionalRows, unidadeRows] = await Promise.all([
      // REDE (sem regional/unidade) → traz TODA a rede quando filtros vazios
      getProficiencySummary({ ...base }),

      // REGIONAL (só se houver regional válida)
      reg ? getProficiencySummary({ ...base, regional: reg }) : Promise.resolve<ProficiencyRow[]>([]),

      // UNIDADE (só se houver unidade válida)
      uni ? getProficiencySummary({ ...base, unidade: uni }) : Promise.resolve<ProficiencyRow[]>([]),
    ]);

    // Se não houver regional/unidade selecionadas, usamos o agregado da REDE como fallback para os cards
    const REG = (regionalRows?.length ? regionalRows : redeRows) || [];
    const UNI = (unidadeRows?.length ? unidadeRows : redeRows) || [];

    const redeS1 = pickSem(redeRows || [], 1);
    const redeS2 = pickSem(redeRows || [], 2);
    const regS1  = pickSem(REG, 1);
    const regS2  = pickSem(REG, 2);
    const uniS1  = pickSem(UNI, 1);
    const uniS2  = pickSem(UNI, 2);

    const unidade1 = toCardFromRpc(uniS1);
    const unidade2 = toCardFromRpc(uniS2);
    const regional1 = toCardFromRpc(regS1);
    const regional2 = toCardFromRpc(regS2);
    const redeToda1 = toCardFromRpc(redeS1);
    const redeToda2 = toCardFromRpc(redeS2);

    setProficiencyData({
      unidade1Avaliacao: { label: 'Unidade - 1ª Avaliação', ...unidade1 },
      unidade2Avaliacao: { label: 'Unidade - 2ª Avaliação', ...unidade2 },
      regional1Avaliacao:{ label: 'Regional - 1ª Avaliação', ...regional1 },
      regional2Avaliacao:{ label: 'Regional - 2ª Avaliação', ...regional2 },
      redeToda1Avaliacao:{ label: 'Rede Toda - 1ª Avaliação', ...redeToda1 },
      redeToda2Avaliacao:{ label: 'Rede Toda - 2ª Avaliação', ...redeToda2 },
    });

  } catch (error) {
    console.error('Erro ao carregar dados de proficiência:', error);
  } finally {
    setLoading(false);
  }
};

const loadComparativoEscolas = async () => {
  try {
    const anoEscolar = filters.ano_escolar?.toUpperCase();

    const dadosEF: ComparativoEscola[] = [
      { escola: 'ANITA CANET, C E-EF M P', lp2024: 251, lp2025: 250, lpDiff: -1, mat2024: 257, mat2025: 258, matDiff: 1, mediaGeral2024: 254, mediaGeral2025: 254, mediaGeralDiff: 0 },
      { escola: 'ANTONIO TUPY PINHEIRO, C E-EF M PROFIS', lp2024: 242, lp2025: 256, lpDiff: 14, mat2024: 238, mat2025: 250, matDiff: 12, mediaGeral2024: 240, mediaGeral2025: 253, mediaGeralDiff: 13 },
      { escola: 'COSTA VIANA, C E-EF M PROFIS N', lp2024: 240, lp2025: 251, lpDiff: 11, mat2024: 242, mat2025: 251, matDiff: 9, mediaGeral2024: 241, mediaGeral2025: 251, mediaGeralDiff: 10 },
      { escola: 'CRISTO REI, C E-EF M PROFIS', lp2024: 232, lp2025: 249, lpDiff: 17, mat2024: 240, mat2025: 250, matDiff: 10, mediaGeral2024: 236, mediaGeral2025: 250, mediaGeralDiff: 14 },
      { escola: 'DECIO DOSSI, C E DR-EF M PROFIS', lp2024: 238, lp2025: 236, lpDiff: -2, mat2024: 247, mat2025: 234, matDiff: -13, mediaGeral2024: 243, mediaGeral2025: 235, mediaGeralDiff: -8 },
      { escola: 'FRANCISCO C MARTINS, C E-M P', lp2024: null, lp2025: null, lpDiff: null, mat2024: null, mat2025: null, matDiff: null, mediaGeral2024: null, mediaGeral2025: null, mediaGeralDiff: null },
      { escola: 'GODOFREDO MACHADO, E E-EF', lp2024: 237, lp2025: 263, lpDiff: 26, mat2024: 248, mat2025: 269, matDiff: 21, mediaGeral2024: 243, mediaGeral2025: 266, mediaGeralDiff: 24 },
      { escola: 'ISABEL L S SOUZA, C E PROFA-EF M PROFIS', lp2024: 235, lp2025: 252, lpDiff: 17, mat2024: 234, mat2025: 236, matDiff: 2, mediaGeral2024: 235, mediaGeral2025: 244, mediaGeralDiff: 10 },
      { escola: 'IVO LEAO, C E-EF M', lp2024: 235, lp2025: 257, lpDiff: 22, mat2024: 246, mat2025: 262, matDiff: 16, mediaGeral2024: 241, mediaGeral2025: 260, mediaGeralDiff: 19 },
      { escola: 'JOAO DE OLIVEIRA FRANCO, C E-EF M', lp2024: 230, lp2025: 265, lpDiff: 35, mat2024: 252, mat2025: 270, matDiff: 18, mediaGeral2024: 241, mediaGeral2025: 268, mediaGeralDiff: 27 },
      { escola: 'JOAO MAZZAROTTO, C E-EF M', lp2024: 227, lp2025: 231, lpDiff: 4, mat2024: 233, mat2025: 233, matDiff: 0, mediaGeral2024: 230, mediaGeral2025: 232, mediaGeralDiff: 2 },
      { escola: 'LIANE MARTA DA COSTA, C E-EF M PROFIS', lp2024: 241, lp2025: 230, lpDiff: -11, mat2024: 260, mat2025: 271, matDiff: 11, mediaGeral2024: 251, mediaGeral2025: 251, mediaGeralDiff: 0 },
      { escola: 'PAULO FREIRE, C E PROF-E F M N', lp2024: 222, lp2025: 246, lpDiff: 24, mat2024: 231, mat2025: 248, matDiff: 17, mediaGeral2024: 227, mediaGeral2025: 247, mediaGeralDiff: 21 },
      { escola: 'SANTO AGOSTINHO, C E-EF M', lp2024: 241, lp2025: 257, lpDiff: 16, mat2024: 230, mat2025: 254, matDiff: 24, mediaGeral2024: 236, mediaGeral2025: 256, mediaGeralDiff: 20 },
      { escola: 'TARSILA DO AMARAL, C E-EF M PROFIS', lp2024: 233, lp2025: 235, lpDiff: 2, mat2024: 233, mat2025: 243, matDiff: 10, mediaGeral2024: 233, mediaGeral2025: 239, mediaGeralDiff: 6 },
      { escola: 'TEREZA DA S RAMOS, C E PROFA-EF M', lp2024: 224, lp2025: 245, lpDiff: 21, mat2024: 236, mat2025: 246, matDiff: 10, mediaGeral2024: 230, mediaGeral2025: 246, mediaGeralDiff: 16 },
      { escola: 'Geral', lp2024: 235, lp2025: 248, lpDiff: 13, mat2024: 242, mat2025: 252, matDiff: 10, mediaGeral2024: 239, mediaGeral2025: 250, mediaGeralDiff: 11 }
    ];

    const dadosEM: ComparativoEscola[] = [
      { escola: 'ANITA CANET, C E-EF M P', lp2024: 271, lp2025: 289, lpDiff: 18, mat2024: 257, mat2025: 293, matDiff: 36, ch2024: 520, ch2025: 526, chDiff: 6, cn2024: 488, cn2025: 524, cnDiff: 36, mediaGeral2024: 384, mediaGeral2025: 408, mediaGeralDiff: 24 },
      { escola: 'ANTONIO TUPY PINHEIRO, C E-EF M PROFIS', lp2024: 280, lp2025: 284, lpDiff: 4, mat2024: 260, mat2025: 267, matDiff: 7, ch2024: 494, ch2025: 489, chDiff: -5, cn2024: 531, cn2025: 490, cnDiff: -41, mediaGeral2024: 391, mediaGeral2025: 383, mediaGeralDiff: -9 },
      { escola: 'COSTA VIANA, C E-EF M PROFIS N', lp2024: 288, lp2025: 300, lpDiff: 12, mat2024: 265, mat2025: 284, matDiff: 19, ch2024: 503, ch2025: 524, chDiff: 21, cn2024: 492, cn2025: 515, cnDiff: 23, mediaGeral2024: 387, mediaGeral2025: 406, mediaGeralDiff: 19 },
      { escola: 'CRISTO REI, C E-EF M PROFIS', lp2024: 293, lp2025: 295, lpDiff: 2, mat2024: 265, mat2025: 277, matDiff: 12, ch2024: 492, ch2025: 478, chDiff: -14, cn2024: 478, cn2025: 473, cnDiff: -5, mediaGeral2024: 382, mediaGeral2025: 381, mediaGeralDiff: -1 },
      { escola: 'DECIO DOSSI, C E DR-EF M PROFIS', lp2024: 275, lp2025: 283, lpDiff: 8, mat2024: 257, mat2025: 272, matDiff: 15, ch2024: 509, ch2025: 467, chDiff: -42, cn2024: 507, cn2025: 458, cnDiff: -49, mediaGeral2024: 387, mediaGeral2025: 370, mediaGeralDiff: -17 },
      { escola: 'FRANCISCO C MARTINS, C E-M P', lp2024: 295, lp2025: 290, lpDiff: -5, mat2024: 273, mat2025: 284, matDiff: 11, ch2024: 485, ch2025: 500, chDiff: 15, cn2024: 498, cn2025: 490, cnDiff: -8, mediaGeral2024: 388, mediaGeral2025: 391, mediaGeralDiff: 3 },
      { escola: 'GODOFREDO MACHADO, E E-EF', lp2024: null, lp2025: null, lpDiff: null, mat2024: null, mat2025: null, matDiff: null, ch2024: null, ch2025: null, chDiff: null, cn2024: null, cn2025: null, cnDiff: null, mediaGeral2024: null, mediaGeral2025: null, mediaGeralDiff: null },
      { escola: 'ISABEL L S SOUZA, C E PROFA-EF M PROFIS', lp2024: 267, lp2025: 280, lpDiff: 13, mat2024: 249, mat2025: 268, matDiff: 19, ch2024: 521, ch2025: 485, chDiff: -36, cn2024: 517, cn2025: 468, cnDiff: -49, mediaGeral2024: 389, mediaGeral2025: 375, mediaGeralDiff: -13 },
      { escola: 'IVO LEAO, C E-EF M', lp2024: 276, lp2025: 288, lpDiff: 12, mat2024: 258, mat2025: 275, matDiff: 17, ch2024: 494, ch2025: 473, chDiff: -21, cn2024: 500, cn2025: 477, cnDiff: -23, mediaGeral2024: 382, mediaGeral2025: 378, mediaGeralDiff: -4 },
      { escola: 'JOAO DE OLIVEIRA FRANCO, C E-EF M', lp2024: 279, lp2025: 287, lpDiff: 8, mat2024: 255, mat2025: 276, matDiff: 21, ch2024: 483, ch2025: 521, chDiff: 38, cn2024: 497, cn2025: 509, cnDiff: 12, mediaGeral2024: 379, mediaGeral2025: 398, mediaGeralDiff: 20 },
      { escola: 'JOAO MAZZAROTTO, C E-EF M', lp2024: 275, lp2025: 294, lpDiff: 19, mat2024: 261, mat2025: 276, matDiff: 15, ch2024: 503, ch2025: 503, chDiff: 0, cn2024: 499, cn2025: 496, cnDiff: -3, mediaGeral2024: 385, mediaGeral2025: 392, mediaGeralDiff: 8 },
      { escola: 'LIANE MARTA DA COSTA, C E-EF M PROFIS', lp2024: 275, lp2025: 261, lpDiff: -14, mat2024: 252, mat2025: 255, matDiff: 3, ch2024: 502, ch2025: 497, chDiff: -5, cn2024: 508, cn2025: 486, cnDiff: -22, mediaGeral2024: 384, mediaGeral2025: 375, mediaGeralDiff: -10 },
      { escola: 'PAULO FREIRE, C E PROF-E F M N', lp2024: 292, lp2025: 285, lpDiff: -7, mat2024: 261, mat2025: 268, matDiff: 7, ch2024: 685, ch2025: 462, chDiff: -223, cn2024: 727, cn2025: 472, cnDiff: -255, mediaGeral2024: 491, mediaGeral2025: 372, mediaGeralDiff: -120 },
      { escola: 'SANTO AGOSTINHO, C E-EF M', lp2024: 285, lp2025: 310, lpDiff: 25, mat2024: 261, mat2025: 299, matDiff: 38, ch2024: 509, ch2025: 529, chDiff: 20, cn2024: 519, cn2025: 505, cnDiff: -14, mediaGeral2024: 394, mediaGeral2025: 411, mediaGeralDiff: 17 },
      { escola: 'TARSILA DO AMARAL, C E-EF M PROFIS', lp2024: 293, lp2025: 294, lpDiff: 1, mat2024: 278, mat2025: 297, matDiff: 19, ch2024: 494, ch2025: 505, chDiff: 11, cn2024: 480, cn2025: 520, cnDiff: 40, mediaGeral2024: 386, mediaGeral2025: 404, mediaGeralDiff: 18 },
      { escola: 'TEREZA DA S RAMOS, C E PROFA-EF M', lp2024: 293, lp2025: 287, lpDiff: -6, mat2024: 264, mat2025: 262, matDiff: -2, ch2024: 776, ch2025: 474, chDiff: -302, cn2024: 766, cn2025: 468, cnDiff: -298, mediaGeral2024: 525, mediaGeral2025: 373, mediaGeralDiff: -152 },
      { escola: 'Geral', lp2024: 282, lp2025: 288, lpDiff: 6, mat2024: 261, mat2025: 277, matDiff: 16, ch2024: 531, ch2025: 496, chDiff: -36, cn2024: 534, cn2025: 490, cnDiff: -44, mediaGeral2024: 402, mediaGeral2025: 388, mediaGeralDiff: -14 }
    ];

    let dadosFiltradosEF = dadosEF;
    let dadosFiltradosEM = dadosEM;

    if (filters.unidade) {
      dadosFiltradosEF = dadosFiltradosEF.filter(d => d.escola === filters.unidade || d.escola === 'Geral');
      dadosFiltradosEM = dadosFiltradosEM.filter(d => d.escola === filters.unidade || d.escola === 'Geral');
    }

    setComparativoEscolasEF(dadosFiltradosEF);
    setComparativoEscolasEM(dadosFiltradosEM);
  } catch (error) {
    console.error('Erro ao carregar comparativo de escolas:', error);
    setComparativoEscolasEF([]);
    setComparativoEscolasEM([]);
  }
};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Visão Geral - Proficiência dos Alunos</h1>
      </div>

      <FilterPanel
        filters={filters}
        onFilterChange={setFilters}
        selectedSystem={selectedSystem}
        userProfile={userProfile}
      />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando dados...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Linha 1: Unidade 1ª e 2ª */}
          
          {selectedSystem !== 'parana-mais' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card
              title={proficiencyData.unidade1Avaliacao.label}
              value={proficiencyData.unidade1Avaliacao.value}
              def={proficiencyData.unidade1Avaliacao.defasagem}
              inter={proficiencyData.unidade1Avaliacao.intermediario}
              adeq={proficiencyData.unidade1Avaliacao.adequado}
            />
            <Card
              title={proficiencyData.unidade2Avaliacao.label}
              value={proficiencyData.unidade2Avaliacao.value}
              def={proficiencyData.unidade2Avaliacao.defasagem}
              inter={proficiencyData.unidade2Avaliacao.intermediario}
              adeq={proficiencyData.unidade2Avaliacao.adequado}
              compareTo={{
                value: proficiencyData.unidade1Avaliacao.value,
                def:   proficiencyData.unidade1Avaliacao.defasagem,
                inter: proficiencyData.unidade1Avaliacao.intermediario,
                adeq:  proficiencyData.unidade1Avaliacao.adequado
              }}
            />
          </div>
          )}

          {/* Linha 2: Regional 1ª e 2ª */}
          
          {selectedSystem !== 'parana-mais' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card
              title={proficiencyData.regional1Avaliacao.label}
              value={proficiencyData.regional1Avaliacao.value}
              def={proficiencyData.regional1Avaliacao.defasagem}
              inter={proficiencyData.regional1Avaliacao.intermediario}
              adeq={proficiencyData.regional1Avaliacao.adequado}
            />
            <Card
              title={proficiencyData.regional2Avaliacao.label}
              value={proficiencyData.regional2Avaliacao.value}
              def={proficiencyData.regional2Avaliacao.defasagem}
              inter={proficiencyData.regional2Avaliacao.intermediario}
              adeq={proficiencyData.regional2Avaliacao.adequado}
              compareTo={{
                value: proficiencyData.regional1Avaliacao.value,
                def:   proficiencyData.regional1Avaliacao.defasagem,
                inter: proficiencyData.regional1Avaliacao.intermediario,
                adeq:  proficiencyData.regional1Avaliacao.adequado
              }}
            />
          </div>
          )}

          {/* Linha 3: Rede toda 1ª e 2ª */}
          
          {selectedSystem !== 'parana-mais' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card
              title={proficiencyData.redeToda1Avaliacao.label}
              value={proficiencyData.redeToda1Avaliacao.value}
              def={proficiencyData.redeToda1Avaliacao.defasagem}
              inter={proficiencyData.redeToda1Avaliacao.intermediario}
              adeq={proficiencyData.redeToda1Avaliacao.adequado}
            />
            <Card
              title={proficiencyData.redeToda2Avaliacao.label}
              value={proficiencyData.redeToda2Avaliacao.value}
              def={proficiencyData.redeToda2Avaliacao.defasagem}
              inter={proficiencyData.redeToda2Avaliacao.intermediario}
              adeq={proficiencyData.redeToda2Avaliacao.adequado}
              compareTo={{
                value: proficiencyData.redeToda1Avaliacao.value,
                def:   proficiencyData.redeToda1Avaliacao.defasagem,
                inter: proficiencyData.redeToda1Avaliacao.intermediario,
                adeq:  proficiencyData.redeToda1Avaliacao.adequado
              }}
            />
          </div>
          )}

          {/* Tabelas Comparativas - Apenas para Paraná Mais */}
          {selectedSystem === 'parana-mais' && (
            <>
              {/* Tabela Ensino Fundamental */}
              {comparativoEscolasEF.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">
                    Comparativo por Escola - 2024 x 2025 (Ensino Fundamental)
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                            Escola
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Língua Portuguesa<br/>2024
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Língua Portuguesa<br/>2025
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            LP<br/>2024 x 2025
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Matemática<br/>2024
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Matemática<br/>2025
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Mat<br/>2024 x 2025
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Média Geral<br/>2024
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Média Geral<br/>2025
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            MG<br/>2024 x 2025
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {comparativoEscolasEF.map((escola, idx) => {
                          const isTotal = escola.escola === 'Geral';
                          const tdBgClass = isTotal ? 'bg-blue-50' : '';
                          return (
                            <tr key={idx} className={isTotal ? 'bg-blue-50 font-semibold' : 'hover:bg-gray-50'}>
                              <td className={`px-4 py-3 text-sm text-gray-900 sticky left-0 z-10 ${tdBgClass || 'bg-white'}`}>
                                {escola.escola}
                              </td>
                              <td className="px-4 py-3 text-sm text-center text-gray-900">
                                {escola.lp2024 !== null ? escola.lp2024 : '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-center text-gray-900">
                                {escola.lp2025 !== null ? escola.lp2025 : '-'}
                              </td>
                              <td className={`px-4 py-3 text-sm text-center font-semibold ${
                                escola.lpDiff === null ? '' :
                                escola.lpDiff > 0 ? 'text-green-600' :
                                escola.lpDiff < 0 ? 'text-red-600' :
                                'text-gray-900'
                              }`}>
                                {escola.lpDiff !== null ? escola.lpDiff : '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-center text-gray-900">
                                {escola.mat2024 !== null ? escola.mat2024 : '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-center text-gray-900">
                                {escola.mat2025 !== null ? escola.mat2025 : '-'}
                              </td>
                              <td className={`px-4 py-3 text-sm text-center font-semibold ${
                                escola.matDiff === null ? '' :
                                escola.matDiff > 0 ? 'text-green-600' :
                                escola.matDiff < 0 ? 'text-red-600' :
                                'text-gray-900'
                              }`}>
                                {escola.matDiff !== null ? escola.matDiff : '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-center text-gray-900">
                                {escola.mediaGeral2024 !== null ? escola.mediaGeral2024 : '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-center text-gray-900">
                                {escola.mediaGeral2025 !== null ? escola.mediaGeral2025 : '-'}
                              </td>
                              <td className={`px-4 py-3 text-sm text-center font-semibold ${
                                escola.mediaGeralDiff === null ? '' :
                                escola.mediaGeralDiff > 0 ? 'text-green-600' :
                                escola.mediaGeralDiff < 0 ? 'text-red-600' :
                                'text-gray-900'
                              }`}>
                                {escola.mediaGeralDiff !== null ? escola.mediaGeralDiff : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tabela Ensino Médio */}
              {comparativoEscolasEM.length > 0 && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">
                    Comparativo por Escola - 2024 x 2025 (Ensino Médio)
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                            Escola
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Língua Portuguesa<br/>2024
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Língua Portuguesa<br/>2025
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            LP<br/>2024 x 2025
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Matemática<br/>2024
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Matemática<br/>2025
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Mat<br/>2024 x 2025
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Ciências Humanas<br/>2024
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Ciências Humanas<br/>2025
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            CH<br/>2024 x 2025
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Ciências da Natureza<br/>2024
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Ciências da Natureza<br/>2025
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            CN<br/>2024 x 2025
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Média Geral<br/>2024
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Média Geral<br/>2025
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            MG<br/>2024 x 2025
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {comparativoEscolasEM.map((escola, idx) => {
                          const isTotal = escola.escola === 'Geral';
                          const tdBgClass = isTotal ? 'bg-blue-50' : '';
                          return (
                            <tr key={idx} className={isTotal ? 'bg-blue-50 font-semibold' : 'hover:bg-gray-50'}>
                              <td className={`px-4 py-3 text-sm text-gray-900 sticky left-0 z-10 ${tdBgClass || 'bg-white'}`}>
                                {escola.escola}
                              </td>
                              <td className="px-4 py-3 text-sm text-center text-gray-900">
                                {escola.lp2024 !== null ? escola.lp2024 : '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-center text-gray-900">
                                {escola.lp2025 !== null ? escola.lp2025 : '-'}
                              </td>
                              <td className={`px-4 py-3 text-sm text-center font-semibold ${
                                escola.lpDiff === null ? '' :
                                escola.lpDiff > 0 ? 'text-green-600' :
                                escola.lpDiff < 0 ? 'text-red-600' :
                                'text-gray-900'
                              }`}>
                                {escola.lpDiff !== null ? escola.lpDiff : '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-center text-gray-900">
                                {escola.mat2024 !== null ? escola.mat2024 : '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-center text-gray-900">
                                {escola.mat2025 !== null ? escola.mat2025 : '-'}
                              </td>
                              <td className={`px-4 py-3 text-sm text-center font-semibold ${
                                escola.matDiff === null ? '' :
                                escola.matDiff > 0 ? 'text-green-600' :
                                escola.matDiff < 0 ? 'text-red-600' :
                                'text-gray-900'
                              }`}>
                                {escola.matDiff !== null ? escola.matDiff : '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-center text-gray-900">
                                {escola.ch2024 !== null ? escola.ch2024 : '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-center text-gray-900">
                                {escola.ch2025 !== null ? escola.ch2025 : '-'}
                              </td>
                              <td className={`px-4 py-3 text-sm text-center font-semibold ${
                                escola.chDiff === null ? '' :
                                escola.chDiff! > 0 ? 'text-green-600' :
                                escola.chDiff! < 0 ? 'text-red-600' :
                                'text-gray-900'
                              }`}>
                                {escola.chDiff !== null ? escola.chDiff : '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-center text-gray-900">
                                {escola.cn2024 !== null ? escola.cn2024 : '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-center text-gray-900">
                                {escola.cn2025 !== null ? escola.cn2025 : '-'}
                              </td>
                              <td className={`px-4 py-3 text-sm text-center font-semibold ${
                                escola.cnDiff === null ? '' :
                                escola.cnDiff! > 0 ? 'text-green-600' :
                                escola.cnDiff! < 0 ? 'text-red-600' :
                                'text-gray-900'
                              }`}>
                                {escola.cnDiff !== null ? escola.cnDiff : '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-center text-gray-900">
                                {escola.mediaGeral2024 !== null ? escola.mediaGeral2024 : '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-center text-gray-900">
                                {escola.mediaGeral2025 !== null ? escola.mediaGeral2025 : '-'}
                              </td>
                              <td className={`px-4 py-3 text-sm text-center font-semibold ${
                                escola.mediaGeralDiff === null ? '' :
                                escola.mediaGeralDiff > 0 ? 'text-green-600' :
                                escola.mediaGeralDiff < 0 ? 'text-red-600' :
                                'text-gray-900'
                              }`}>
                                {escola.mediaGeralDiff !== null ? escola.mediaGeralDiff : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default VisaoGeral;
