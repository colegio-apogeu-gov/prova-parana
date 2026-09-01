import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck, RefreshCw, LogOut, Search, Download, LogIn, Activity,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, AlertCircle, Loader2,
} from 'lucide-react';
import { UserProfile } from '../../types';
import {
  getAuditoriaUsuarios, AuditoriaUsuario, perfilLabel, fmtDataHora, tempoDesde, sistemaLabel, podeAuditar,
} from '../../lib/auditoria';

interface AuditoriaDashboardProps {
  userProfile: UserProfile | null;
  onSystemSwitch: () => void;
  onLogout: () => void;
}

type Aba = 'login' | 'interacao';
const OPCOES_POR_PAGINA = [10, 25, 50, 100];

const norm = (s: string) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const AuditoriaDashboard: React.FC<AuditoriaDashboardProps> = ({ userProfile, onSystemSwitch, onLogout }) => {
  const [usuarios, setUsuarios] = useState<AuditoriaUsuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [aba, setAba] = useState<Aba>('login');
  const [busca, setBusca] = useState('');
  const [porPagina, setPorPagina] = useState(25);
  const [pagina, setPagina] = useState(1);
  const [exportando, setExportando] = useState(false);

  const autorizado = podeAuditar(userProfile);

  const carregar = async () => {
    setLoading(true);
    setErro('');
    try {
      const rows = await getAuditoriaUsuarios();
      setUsuarios(rows);
    } catch (e) {
      console.error(e);
      setErro('Não foi possível carregar os dados de auditoria. Verifique se a migration 20260815120000_auditoria_user_profiles.sql foi aplicada.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (autorizado) carregar(); else setLoading(false); }, [autorizado]);

  // Ordena por aba: login → último login desc; interação → última interação desc (nulos ao fim).
  const ordenados = useMemo(() => {
    const campo: keyof AuditoriaUsuario = aba === 'login' ? 'last_login_at' : 'last_interaction_at';
    return [...usuarios].sort((a, b) => {
      const va = a[campo] as string | null;
      const vb = b[campo] as string | null;
      if (!va && !vb) return (a.email || '').localeCompare(b.email || '');
      if (!va) return 1;
      if (!vb) return -1;
      return new Date(vb).getTime() - new Date(va).getTime();
    });
  }, [usuarios, aba]);

  const filtrados = useMemo(() => {
    const q = norm(busca);
    if (!q) return ordenados;
    return ordenados.filter((u) => norm(u.email).includes(q) || norm(u.unidade).includes(q));
  }, [ordenados, busca]);

  // Reset de página quando muda aba/busca/tamanho.
  useEffect(() => { setPagina(1); }, [aba, busca, porPagina]);

  const total = filtrados.length;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const inicio = (paginaSegura - 1) * porPagina;
  const visiveis = filtrados.slice(inicio, inicio + porPagina);
  const de = total === 0 ? 0 : inicio + 1;
  const ate = Math.min(inicio + porPagina, total);

  const baixarXlsx = async () => {
    setExportando(true);
    try {
      const XLSX = await import('xlsx');
      const cabLogin = ['E-mail', 'Unidade', 'Perfil', 'Último login', 'Nº de logins', 'Conta criada em'];
      const cabInter = ['E-mail', 'Unidade', 'Perfil', 'Última interação', 'Sistema da última interação', 'Tempo desde a última interação'];
      // Reaproveita a ordenação de cada seção (login por último login; interação por última interação).
      const ordLogin = [...usuarios].sort((a, b) => rankData(b.last_login_at) - rankData(a.last_login_at));
      const ordInter = [...usuarios].sort((a, b) => rankData(b.last_interaction_at) - rankData(a.last_interaction_at));
      const linhasLogin = ordLogin.map((u) => [u.email, u.unidade, perfilLabel(u.tipo_acesso), fmtDataHora(u.last_login_at), u.login_count, fmtDataHora(u.created_at)]);
      const linhasInter = ordInter.map((u) => [u.email, u.unidade, perfilLabel(u.tipo_acesso), fmtDataHora(u.last_interaction_at), sistemaLabel(u.last_interaction_system), tempoDesde(u.last_interaction_at)]);
      const wb = XLSX.utils.book_new();
      const wsLogin = XLSX.utils.aoa_to_sheet([cabLogin, ...linhasLogin]);
      const wsInter = XLSX.utils.aoa_to_sheet([cabInter, ...linhasInter]);
      wsLogin['!cols'] = [{ wch: 30 }, { wch: 32 }, { wch: 15 }, { wch: 18 }, { wch: 12 }, { wch: 18 }];
      wsInter['!cols'] = [{ wch: 30 }, { wch: 32 }, { wch: 15 }, { wch: 18 }, { wch: 26 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, wsLogin, 'Último login');
      XLSX.utils.book_append_sheet(wb, wsInter, 'Última interação');
      const hoje = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `Auditoria_APG_${hoje}.xlsx`);
    } catch (e) {
      console.error('Erro ao gerar planilha:', e);
      alert('Não foi possível gerar a planilha. Tente novamente.');
    } finally {
      setExportando(false);
    }
  };

  if (!autorizado) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center max-w-md">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Acesso restrito</h2>
          <p className="text-sm text-gray-500 mb-5">Você não tem permissão para acessar a Auditoria.</p>
          <button onClick={onSystemSwitch} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">Voltar à seleção de sistema</button>
        </div>
      </div>
    );
  }

  const th = 'px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap';
  const td = 'px-4 py-3 text-sm text-gray-700 whitespace-nowrap';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 w-11 h-11 rounded-full flex items-center justify-center text-white shadow">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">APG Gov · Auditoria de Acesso</h1>
              <p className="text-sm text-gray-500">Último login e última interação de cada usuário</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={carregar} title="Atualizar" className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg">
              <RefreshCw className="w-5 h-5" />
            </button>
            <button onClick={onSystemSwitch} title="Trocar sistema" className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg">
              <ChevronsLeft className="w-5 h-5" />
            </button>
            <button onClick={onLogout} title="Sair" className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Abas + ações */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-full p-1 self-start">
            {([
              { k: 'login', label: 'Último login', icon: <LogIn className="w-4 h-4" /> },
              { k: 'interacao', label: 'Última interação', icon: <Activity className="w-4 h-4" /> },
            ] as const).map((t) => (
              <button
                key={t.k}
                onClick={() => setAba(t.k)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  aba === t.k ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por e-mail ou unidade..."
                className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 min-w-[240px]"
              />
            </div>
            <button
              onClick={baixarXlsx}
              disabled={exportando || loading || usuarios.length === 0}
              className="flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Baixar planilha (.xlsx) com as duas seções"
            >
              {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Baixar planilha
            </button>
          </div>
        </div>

        {/* Corpo */}
        {erro ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{erro}</div>
        ) : loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-500 text-sm">Carregando usuários...</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                {aba === 'login' ? 'Último login por usuário' : 'Última interação por usuário'}
              </h3>
              <span className="text-xs text-gray-400">{total} usuário(s)</span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50/70 border-b border-gray-100">
                  {aba === 'login' ? (
                    <tr>
                      <th className={th}>E-mail</th>
                      <th className={th}>Unidade</th>
                      <th className={th}>Perfil</th>
                      <th className={th}>Último login</th>
                      <th className={th}>Nº de logins</th>
                      <th className={th}>Conta criada em</th>
                    </tr>
                  ) : (
                    <tr>
                      <th className={th}>E-mail</th>
                      <th className={th}>Unidade</th>
                      <th className={th}>Perfil</th>
                      <th className={th}>Última interação</th>
                      <th className={th}>Sistema</th>
                      <th className={th}>Tempo desde</th>
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {visiveis.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">Nenhum usuário encontrado.</td></tr>
                  ) : visiveis.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50/60">
                      <td className={`${td} font-medium text-gray-900`}>{u.email || '—'}</td>
                      <td className={td}>{u.unidade || '—'}</td>
                      <td className={td}>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${u.tipo_acesso === 'gestao' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>
                          {perfilLabel(u.tipo_acesso)}
                        </span>
                      </td>
                      {aba === 'login' ? (
                        <>
                          <td className={td}>{fmtDataHora(u.last_login_at)}</td>
                          <td className={td}>{u.login_count}</td>
                          <td className={td}>{fmtDataHora(u.created_at)}</td>
                        </>
                      ) : (
                        <>
                          <td className={td}>{fmtDataHora(u.last_interaction_at)}</td>
                          <td className={td}>{u.last_interaction_system ? sistemaLabel(u.last_interaction_system) : '—'}</td>
                          <td className={`${td} text-gray-500`}>{tempoDesde(u.last_interaction_at)}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginação (frontend) */}
            <div className="px-4 py-3 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>Registros por página:</span>
                <select
                  value={porPagina}
                  onChange={(e) => setPorPagina(Number(e.target.value))}
                  className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  {OPCOES_POR_PAGINA.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">{de}–{ate} de {total}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPagina(1)} disabled={paginaSegura <= 1}
                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"><ChevronsLeft className="w-4 h-4" /></button>
                  <button onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={paginaSegura <= 1}
                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"><ChevronLeft className="w-4 h-4" /></button>
                  <span className="text-sm text-gray-600 px-2">{paginaSegura} / {totalPaginas}</span>
                  <button onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={paginaSegura >= totalPaginas}
                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"><ChevronRight className="w-4 h-4" /></button>
                  <button onClick={() => setPagina(totalPaginas)} disabled={paginaSegura >= totalPaginas}
                    className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"><ChevronsRight className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-gray-400 pt-1">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>
            O "último login" vem do horário de autenticação do Firebase; a "última interação" é registrada durante a navegação (heartbeat a cada ~2 min).
            Os dados começam a ser coletados a partir da aplicação da funcionalidade.
          </span>
        </div>
      </div>
    </div>
  );
};

// Timestamp para ordenar nulos ao fim (nulo → -Infinity).
function rankData(iso: string | null): number {
  if (!iso) return -Infinity;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? -Infinity : t;
}

export default AuditoriaDashboard;
