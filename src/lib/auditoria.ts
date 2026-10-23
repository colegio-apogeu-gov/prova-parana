// =============================================================================
// Auditoria de acesso — quem pode ver, gravação de login/interação e leitura.
//
// O rastreio vive em user_profiles (migration 20260815120000). A gravação passa
// por RPCs SECURITY DEFINER, que só tocam nas colunas de auditoria. Todas as
// gravações são "fire-and-forget": um erro aqui nunca pode quebrar o login ou a
// navegação do usuário.
// =============================================================================

import { supabase } from './supabase';
import { UNIDADE_MAPEADA, UserProfile, TipoAcesso, normalizarTipoAcesso } from '../types';

// Perfis de gestão sempre veem a Auditoria; além deles, esta allowlist de
// e-mails (definida pelo produto). Comparação sem caixa.
export const AUDITORIA_EMAILS = ['teste@gmail.com'];

const isGestaoLike = (p: { tipo_acesso?: string | null } | null | undefined): boolean =>
  p?.tipo_acesso === 'gestao';

export const podeAuditar = (profile: UserProfile | null | undefined): boolean => {
  if (!profile) return false;
  if (isGestaoLike(profile)) return true;
  const email = (profile.email || '').trim().toLowerCase();
  return AUDITORIA_EMAILS.includes(email);
};

// Rótulos amigáveis dos sistemas (guardados direto em last_interaction_system).
export const SISTEMA_LABEL: Record<string, string> = {
  'prova-parana': 'Prova Paraná Recomposição',
  'parana-mais': 'Paraná Mais',
  'parceiro': 'Avaliação Parceiro',
  'enem': 'ENEM APG',
  'ideb': 'IDEB APG',
  'auditoria': 'Auditoria',
};
export const sistemaLabel = (id: string | null | undefined): string =>
  id ? (SISTEMA_LABEL[id] ?? id) : 'Seleção de sistema';

// ---------------------------------------------------------------------------
// Gravação
// ---------------------------------------------------------------------------
// Só enviamos o id (não o email): as RPCs de auditoria não tocam em campos de
// identidade, então não há como um chamador adulterar o e-mail de um perfil.
export const registrarLogin = async (id: string, lastSignInTime: string | null): Promise<void> => {
  try {
    // Firebase entrega lastSignInTime como string de data (UTC). Convertemos.
    const iso = lastSignInTime ? new Date(lastSignInTime).toISOString() : new Date().toISOString();
    await supabase.rpc('auditoria_registrar_login', { p_id: id, p_last_sign_in: iso });
  } catch (e) {
    console.warn('auditoria: falha ao registrar login (ignorado)', e);
  }
};

// Heartbeat de interação com throttle local (não martela o banco). Grava no
// máximo 1x por INTERVALO_MS por aba, salvo troca de sistema.
const INTERVALO_MS = 120_000; // 2 min
let ultimoRegistro = 0;
let ultimoSistema = '';

export const registrarInteracao = async (id: string, system: string): Promise<void> => {
  const agora = Date.now();
  if (system === ultimoSistema && agora - ultimoRegistro < INTERVALO_MS) return;
  ultimoRegistro = agora;
  ultimoSistema = system;
  try {
    await supabase.rpc('auditoria_registrar_interacao', { p_id: id, p_system: system });
  } catch (e) {
    console.warn('auditoria: falha ao registrar interação (ignorado)', e);
  }
};

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------
export interface AuditoriaUsuario {
  id: string;
  email: string;
  unidade: string;
  tipo_acesso: TipoAcesso;
  created_at: string | null;
  last_login_at: string | null;
  login_count: number;
  last_interaction_at: string | null;
  last_interaction_system: string | null;
}

const COLS = 'id,email,unidade,tipo_acesso,created_at,last_login_at,login_count,last_interaction_at,last_interaction_system';

// Lista todos os usuários (paginado, como o resto do app). A base de usuários é
// pequena, mas seguimos o padrão de 1000/página por segurança.
export const getAuditoriaUsuarios = async (): Promise<AuditoriaUsuario[]> => {
  const pageSize = 1000;
  const all: AuditoriaUsuario[] = [];
  let page = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select(COLS)
      .order('last_login_at', { ascending: false, nullsFirst: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw error;
    const chunk = (data || []) as any[];
    chunk.forEach((r) => {
      all.push({
        id: r.id,
        email: r.email ?? '',
        // Normaliza a unidade (mesmo mapa usado no getUserProfile).
        unidade: UNIDADE_MAPEADA[r.unidade as keyof typeof UNIDADE_MAPEADA] || r.unidade || '',
        tipo_acesso: normalizarTipoAcesso(r.tipo_acesso),
        created_at: r.created_at ?? null,
        last_login_at: r.last_login_at ?? null,
        login_count: typeof r.login_count === 'number' ? r.login_count : 0,
        last_interaction_at: r.last_interaction_at ?? null,
        last_interaction_system: r.last_interaction_system ?? null,
      });
    });
    if (chunk.length < pageSize) break;
    page++;
  }
  return all;
};

// ---------------------------------------------------------------------------
// Formatação (pt-BR)
// ---------------------------------------------------------------------------
export const perfilLabel = (t: TipoAcesso): string =>
  t === 'gestao' ? 'Gestão' : t === 'total' ? 'Total' : 'Administrador';

export const fmtDataHora = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// "há 3 dias", "há 2 h", "há 5 min", "agora".
export const tempoDesde = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const s = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (s < 60) return 'agora há pouco';
  const min = Math.floor(s / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const dias = Math.floor(h / 24);
  if (dias < 30) return `há ${dias} dia${dias > 1 ? 's' : ''}`;
  const meses = Math.floor(dias / 30);
  if (meses < 12) return `há ${meses} ${meses > 1 ? 'meses' : 'mês'}`;
  const anos = Math.floor(meses / 12);
  return `há ${anos} ano${anos > 1 ? 's' : ''}`;
};
