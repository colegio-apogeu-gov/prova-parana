// Importação de alunos a partir de planilha (xlsx/csv) para criar salas de aula.
//
// A planilha traz (matricula, nome, turma, unidade) — só nome/turma/unidade são
// obrigatórios. As tabelas de prova (prova_resultados*) guardam o nome do aluno e
// a unidade, mas a "turma" delas é um código numérico sem significado; por isso a
// sala de aula é nomeada com a TURMA DA PLANILHA e populada com os alunos cujo
// nome casa com o que já existe no banco para aquela unidade.
//
// Casamento de unidade: a planilha escreve "ANITA CANET, C E-EF M P" e o banco
// "ANITA CANET C E EF M" — mesma escola, grafias diferentes. Comparar as strings
// inteiras é perigoso: o sufixo burocrático ("C E ... EF M PROFIS") é quase igual
// entre escolas distintas e faz "CARNEIRO, C E GAL-EF M PROFIS" parecer 69%
// igual a "DECIO DOSSI C E DR EF M PROFIS". Por isso só o NÚCLEO do nome (o
// trecho antes da vírgula) é comparado, contra os prefixos do nome do banco.

import * as XLSX from 'xlsx';
import { supabase } from './supabase';

export type SystemKey = 'prova-parana' | 'parceiro' | 'parana-mais';

const TABELAS: Record<SystemKey, { salas: string; alunos: string }> = {
  'prova-parana': { salas: 'sala_de_aula', alunos: 'sala_de_aula_alunos' },
  parceiro: { salas: 'sala_de_aula_parceiro', alunos: 'sala_de_aula_alunos_parceiros' },
  'parana-mais': { salas: 'sala_de_aula_mais', alunos: 'sala_de_aula_alunos_mais' },
};

// Núcleo do nome da escola precisa bater bem; medido contra os dados reais,
// as 20 escolas casam com 1.00 e as ausentes ficam em no máximo 0.67.
export const LIMIAR_UNIDADE = 0.8;

// Nome de aluno: só aceita divergência de digitação. Aferido na base real, os
// casos verdadeiros (HEUKE/HEUKO, ISACC/ISAAC) ficam >= 0.95, enquanto pessoas
// diferentes com sobrenome igual ("GABRIEL FANIN" vs "GABRIEL KAUAN DE SOUZA")
// chegam a 0.86 — abaixo desse corte o risco é colocar o aluno errado na sala.
export const LIMIAR_NOME = 0.95;

export interface LinhaPlanilha {
  nome: string;
  turma: string;
  unidade: string;
  matricula?: string;
}

// ---------------------------------------------------------------- normalização

export const normalizar = (s: unknown): string =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const levenshtein = (a: string, b: string): number => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[b.length];
};

/** Similaridade 0..1 entre duas strings já normalizadas. */
export const similaridade = (a: string, b: string): number => {
  const max = Math.max(a.length, b.length);
  return max === 0 ? 1 : 1 - levenshtein(a, b) / max;
};

// ------------------------------------------------------------------- unidade

/** Nome próprio da escola: o trecho antes da vírgula ("ANITA CANET, C E-EF M P"). */
export const nucleoUnidade = (unidade: string): string =>
  normalizar(String(unidade ?? '').split(',')[0]);

/**
 * Quanto o núcleo da planilha se parece com o começo do nome no banco.
 * Testa todos os prefixos de palavras para ignorar o sufixo burocrático.
 */
export const scoreUnidade = (nucleo: string, unidadeDb: string): number => {
  const toks = normalizar(unidadeDb).split(' ').filter(Boolean);
  let melhor = 0;
  for (let k = 1; k <= toks.length; k++) {
    melhor = Math.max(melhor, similaridade(nucleo, toks.slice(0, k).join(' ')));
  }
  return melhor;
};

/** Melhor unidade do banco para uma unidade da planilha (null se nada convence). */
export const casarUnidade = (
  unidadePlanilha: string,
  unidadesDb: string[]
): { unidade: string; score: number } | null => {
  const nucleo = nucleoUnidade(unidadePlanilha);
  if (!nucleo) return null;
  let melhor: { unidade: string; score: number } | null = null;
  unidadesDb.forEach((u) => {
    const score = scoreUnidade(nucleo, u);
    if (!melhor || score > melhor.score) melhor = { unidade: u, score };
  });
  return melhor && melhor.score >= LIMIAR_UNIDADE ? melhor : null;
};

// ---------------------------------------------------------------------- nomes

/** Índice dos nomes que existem no banco, para casar os nomes da planilha. */
export class IndiceNomes {
  private exatos = new Map<string, string>();
  private porExtremos = new Map<string, string[]>();

  constructor(nomesDb: string[]) {
    nomesDb.forEach((nome) => {
      const n = normalizar(nome);
      if (!n || this.exatos.has(n)) return;
      this.exatos.set(n, nome);
      const toks = n.split(' ');
      if (toks.length >= 2) {
        const chave = `${toks[0]}|${toks[toks.length - 1]}`;
        this.porExtremos.set(chave, [...(this.porExtremos.get(chave) ?? []), n]);
      }
    });
  }

  /**
   * Nome do banco correspondente, ou null. Casa por igualdade (ignorando
   * acento/caixa) e, como segunda tentativa, aceita erro de digitação apenas
   * quando primeiro e último nome são idênticos e a similaridade é altíssima.
   */
  casar(nomePlanilha: string): { nome: string; exato: boolean } | null {
    const n = normalizar(nomePlanilha);
    if (!n) return null;

    const exato = this.exatos.get(n);
    if (exato) return { nome: exato, exato: true };

    const toks = n.split(' ');
    if (toks.length < 2) return null;
    const candidatos = this.porExtremos.get(`${toks[0]}|${toks[toks.length - 1]}`) ?? [];

    let melhor: { nome: string; score: number } | null = null;
    candidatos.forEach((c) => {
      const score = similaridade(n, c);
      if (!melhor || score > melhor.score) melhor = { nome: c, score };
    });
    if (!melhor || melhor.score < LIMIAR_NOME) return null;
    return { nome: this.exatos.get(melhor.nome)!, exato: false };
  }
}

// -------------------------------------------------------------- leitura xlsx

const SINONIMOS: Record<keyof LinhaPlanilha, string[]> = {
  nome: ['nome', 'aluno', 'nome aluno', 'nome do aluno', 'estudante'],
  turma: ['turma', 'classe', 'sala', 'serie'],
  unidade: ['unidade', 'escola', 'colegio', 'instituicao'],
  matricula: ['matricula', 'ra', 'registro', 'codigo'],
};

const acharColuna = (cabecalhos: string[], campo: keyof LinhaPlanilha): string | null => {
  const alvos = SINONIMOS[campo];
  const exato = cabecalhos.find((h) => alvos.includes(normalizar(h).toLowerCase()));
  if (exato) return exato;
  return cabecalhos.find((h) => alvos.some((a) => normalizar(h).toLowerCase().includes(a))) ?? null;
};

export class PlanilhaInvalidaError extends Error {}

/** Lê xlsx/xls/csv e devolve as linhas. Exige as colunas nome, turma e unidade. */
export const lerPlanilhaAlunos = async (file: File): Promise<LinhaPlanilha[]> => {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new PlanilhaInvalidaError('A planilha está vazia.');

  const linhas = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
  if (!linhas.length) throw new PlanilhaInvalidaError('A planilha não tem linhas de dados.');

  const cabecalhos = Object.keys(linhas[0]);
  const colNome = acharColuna(cabecalhos, 'nome');
  const colTurma = acharColuna(cabecalhos, 'turma');
  const colUnidade = acharColuna(cabecalhos, 'unidade');
  const colMatricula = acharColuna(cabecalhos, 'matricula');

  const faltando = [
    !colNome && 'nome',
    !colTurma && 'turma',
    !colUnidade && 'unidade',
  ].filter(Boolean);
  if (faltando.length) {
    throw new PlanilhaInvalidaError(
      `A planilha precisa das colunas: ${faltando.join(', ')}. Encontrei: ${cabecalhos.join(', ')}.`
    );
  }

  return linhas
    .map((l) => ({
      nome: String(l[colNome!] ?? '').trim(),
      turma: String(l[colTurma!] ?? '').trim(),
      unidade: String(l[colUnidade!] ?? '').trim(),
      matricula: colMatricula ? String(l[colMatricula] ?? '').trim() : undefined,
    }))
    .filter((l) => l.nome && l.turma && l.unidade);
};

// ---------------------------------------------------------------------- plano

export interface SalaExistente {
  id: string;
  nome: string;
  sala_de_aula_alunos: Array<{ nome_aluno: string; turma: string }>;
}

export interface PlanoSala {
  nome: string;                                        // = turma da planilha
  salaExistenteId?: string;
  novos: Array<{ nome_aluno: string; turma: string }>; // alunos a inserir
  jaNaSala: number;
}

export interface PlanoImportacao {
  salas: PlanoSala[];
  linhasLidas: number;
  foraDaUnidade: number;
  naoEncontrados: string[];
  casadosPorAproximacao: Array<{ planilha: string; banco: string }>;
  unidadesDaPlanilha: Array<{ unidade: string; casa: boolean; score: number }>;
  totalNovos: number;
  salasNovas: number;
}

/**
 * Monta o plano de importação para UMA unidade (a do usuário logado): descarta
 * linhas de outras escolas, casa cada aluno com o banco e agrupa por turma.
 */
export const planejarImportacao = (params: {
  linhas: LinhaPlanilha[];
  unidadeDb: string;
  alunosDb: string[];
  salasExistentes: SalaExistente[];
}): PlanoImportacao => {
  const { linhas, unidadeDb, alunosDb, salasExistentes } = params;
  const indice = new IndiceNomes(alunosDb);

  // Cada unidade distinta da planilha é avaliada uma vez só (comparação é cara).
  const unidadesDaPlanilha = Array.from(new Set(linhas.map((l) => l.unidade))).map((u) => {
    const score = scoreUnidade(nucleoUnidade(u), unidadeDb);
    return { unidade: u, casa: score >= LIMIAR_UNIDADE, score };
  });
  const daMinhaUnidade = new Set(unidadesDaPlanilha.filter((u) => u.casa).map((u) => u.unidade));

  const porTurma = new Map<string, Map<string, string>>(); // turma -> (nomeDb -> nomeDb)
  const naoEncontrados = new Set<string>();
  const aproximados = new Map<string, string>();
  let foraDaUnidade = 0;

  linhas.forEach((l) => {
    if (!daMinhaUnidade.has(l.unidade)) {
      foraDaUnidade++;
      return;
    }
    const casado = indice.casar(l.nome);
    if (!casado) {
      naoEncontrados.add(l.nome);
      return;
    }
    if (!casado.exato) aproximados.set(l.nome, casado.nome);
    const turma = porTurma.get(l.turma) ?? new Map<string, string>();
    turma.set(casado.nome, casado.nome);
    porTurma.set(l.turma, turma);
  });

  const existentePorNome = new Map(
    salasExistentes.map((s) => [normalizar(s.nome), s] as const)
  );

  const salas: PlanoSala[] = Array.from(porTurma.entries())
    .map(([turma, alunos]) => {
      const existente = existentePorNome.get(normalizar(turma));
      const jaNaSala = new Set(
        (existente?.sala_de_aula_alunos ?? []).map((a) => normalizar(a.nome_aluno))
      );
      const novos = Array.from(alunos.keys())
        .filter((nome) => !jaNaSala.has(normalizar(nome)))
        .sort((a, b) => a.localeCompare(b))
        .map((nome) => ({ nome_aluno: nome, turma }));
      return {
        nome: turma,
        salaExistenteId: existente?.id,
        novos,
        jaNaSala: alunos.size - novos.length,
      };
    })
    .filter((s) => s.novos.length > 0)
    .sort((a, b) => a.nome.localeCompare(b.nome));

  return {
    salas,
    linhasLidas: linhas.length,
    foraDaUnidade,
    naoEncontrados: Array.from(naoEncontrados).sort((a, b) => a.localeCompare(b)),
    casadosPorAproximacao: Array.from(aproximados.entries()).map(([planilha, banco]) => ({
      planilha,
      banco,
    })),
    unidadesDaPlanilha: unidadesDaPlanilha.sort((a, b) => b.score - a.score),
    totalNovos: salas.reduce((s, x) => s + x.novos.length, 0),
    salasNovas: salas.filter((s) => !s.salaExistenteId).length,
  };
};

// ------------------------------------------------------------------ aplicação

/**
 * Cria as salas e insere os alunos. Salas já existentes com o mesmo nome são
 * reaproveitadas (só recebem quem falta), então reimportar não duplica nada.
 */
export const aplicarImportacao = async (
  system: SystemKey,
  unidadeDb: string,
  plano: PlanoImportacao,
  onProgress?: (feitas: number, total: number) => void
): Promise<{ salasCriadas: number; alunosInseridos: number }> => {
  const t = TABELAS[system];
  let salasCriadas = 0;
  let alunosInseridos = 0;

  for (let i = 0; i < plano.salas.length; i++) {
    const sala = plano.salas[i];
    let salaId = sala.salaExistenteId;

    if (!salaId) {
      const { data, error } = await supabase
        .from(t.salas)
        .insert({ nome: sala.nome, unidade: unidadeDb })
        .select('id')
        .single();
      if (error) throw error;
      salaId = data.id;
      salasCriadas++;
    }

    const { error: erroAlunos } = await supabase
      .from(t.alunos)
      .insert(sala.novos.map((a) => ({ sala_id: salaId, nome_aluno: a.nome_aluno, turma: a.turma })));
    if (erroAlunos) throw erroAlunos;
    alunosInseridos += sala.novos.length;

    onProgress?.(i + 1, plano.salas.length);
  }

  return { salasCriadas, alunosInseridos };
};
