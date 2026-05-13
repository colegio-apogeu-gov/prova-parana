// /pages/VisaoGeral.tsx
import React, { useState, useEffect } from 'react';
import { UserProfile } from '../../types';
import FilterPanel from './FilterPanel';
import ProficiencyGauge from './ProficiencyGauge';

import { getProficiencySummary, ProficiencyRow } from '../../lib/supabase';
import { getProficiencyDataParceiro } from '../../lib/supabaseParceiro';

interface VisaoGeralProps {
  userProfile: UserProfile | null;
  selectedSystem: 'prova-parana' | 'parceiro';
}

interface Filters {
  componente: string;
  regional: string;
  unidade: string;
  ano_escolar: string;
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
  // helper local: trata "Todos/Todas/All" como sem filtro
  const normalizeSelect = (x?: string) => {
    if (!x) return undefined;
    const s = x.trim().toLowerCase();
    if (!s || s === 'todos' || s === 'todas' || s === 'all') return undefined;
    return x;
  };

  setLoading(true);
  try {
    // -------------------- SISTEMA PARCEIRO --------------------
    if (selectedSystem === 'parceiro') {
      const comp = normalizeSelect(filters.componente);
      const ano  = normalizeSelect(filters.ano_escolar);
      const reg  = normalizeSelect(filters.regional);
      const uni  = normalizeSelect(filters.unidade);

      // Busca bruta do parceiro (sem aplicar filtros indevidos de "Todos/Todas")
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

          {/* Linha 2: Regional 1ª e 2ª */}
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

          {/* Linha 3: Rede toda 1ª e 2ª */}
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
        </>
      )}
    </div>
  );
};

export default VisaoGeral;
