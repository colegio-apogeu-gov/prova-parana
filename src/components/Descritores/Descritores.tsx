import React, { useState, useEffect, useMemo } from 'react';
import {
  ListChecks, Plus, Edit2, Trash2, CheckCircle, AlertCircle, Link2, X, Search, RefreshCw,
} from 'lucide-react';
import {
  ComponenteHabilidade,
  DescritorInput,
  DescritorOrfao,
  SystemKey,
  tipoProvaFromSystem,
  getComponentesHabilidades,
  createComponenteHabilidade,
  updateComponenteHabilidade,
  deleteComponenteHabilidade,
  getDescritoresOrfaos,
  vincularDescritorAResultados,
  ANOS_POR_TIPO,
  COMPONENTES_POR_TIPO,
} from '../../lib/descritores';

interface DescritoresProps {
  selectedSystem: SystemKey;
  userProfile: { unidade: string } | null;
}

const componenteLabel = (c: string) =>
  c === 'LP' ? 'Língua Portuguesa' : c === 'MT' ? 'Matemática' : c === 'CN' ? 'Ciências da Natureza' : c === 'CH' ? 'Ciências Humanas' : c;

const emptyForm = (
  tipoProva: 'prova-parana' | 'mais' | 'parceiro',
  ano: string,
  comp: string
): DescritorInput => ({
  tipo_prova: tipoProva,
  rede: 'ESTADUAL',
  ano_escolar: ano,
  componente: comp,
  habilidade_posicao: '',
  descricao: '',
});

const Descritores: React.FC<DescritoresProps> = ({ selectedSystem, userProfile }) => {
  const tipoProva = tipoProvaFromSystem(selectedSystem);
  const anos = ANOS_POR_TIPO[tipoProva];
  const componentes = COMPONENTES_POR_TIPO[tipoProva];

  const [descritores, setDescritores] = useState<ComponenteHabilidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // filtros da lista
  const [fAno, setFAno] = useState('');
  const [fComp, setFComp] = useState('');
  const [busca, setBusca] = useState('');

  // form CRUD
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ComponenteHabilidade | null>(null);
  const [form, setForm] = useState<DescritorInput>(emptyForm(tipoProva, anos[0], componentes[0]));

  // orfaos
  const [orfaos, setOrfaos] = useState<DescritorOrfao[]>([]);
  const [orfaosLoading, setOrfaosLoading] = useState(true);
  const [linkTarget, setLinkTarget] = useState<DescritorOrfao | null>(null);

  useEffect(() => {
    loadDescritores();
    loadOrfaos();
    // reseta filtros/form ao trocar de sistema
    setForm(emptyForm(tipoProva, anos[0], componentes[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSystem]);

  const loadDescritores = async () => {
    setLoading(true);
    try {
      const data = await getComponentesHabilidades(tipoProva, {
        ano_escolar: fAno || undefined,
        componente: fComp || undefined,
        busca: busca || undefined,
      });
      setDescritores(data);
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar descritores');
    } finally {
      setLoading(false);
    }
  };

  const loadOrfaos = async () => {
    setOrfaosLoading(true);
    try {
      const data = await getDescritoresOrfaos(selectedSystem, userProfile?.unidade);
      setOrfaos(data);
    } catch (e: any) {
      // A RPC pode ainda nao existir se a migration nao foi aplicada; nao bloqueia a tela.
      console.error('Erro ao carregar orfaos:', e);
      setOrfaos([]);
    } finally {
      setOrfaosLoading(false);
    }
  };

  // recarrega lista quando filtros mudam
  useEffect(() => {
    const t = setTimeout(loadDescritores, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fAno, fComp, busca]);

  const flashSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  const openNew = (prefill?: Partial<DescritorInput>) => {
    setEditing(null);
    setForm({ ...emptyForm(tipoProva, anos[0], componentes[0]), ...prefill });
    setShowForm(true);
  };

  const openEdit = (d: ComponenteHabilidade) => {
    setEditing(d);
    setForm({
      tipo_prova: d.tipo_prova,
      rede: d.rede ?? 'ESTADUAL',
      ano_escolar: d.ano_escolar,
      componente: d.componente,
      habilidade_posicao: d.habilidade_posicao,
      descricao: d.descricao,
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setEditing(null);
    setForm(emptyForm(tipoProva, anos[0], componentes[0]));
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (editing) {
        await updateComponenteHabilidade(editing.id, form);
        flashSuccess('Descritor atualizado com sucesso!');
      } else {
        await createComponenteHabilidade(form);
        flashSuccess('Descritor cadastrado com sucesso!');
      }
      resetForm();
      await loadDescritores();
    } catch (e: any) {
      setError(e.message || 'Erro ao salvar descritor');
    }
  };

  const handleDelete = async (d: ComponenteHabilidade) => {
    if (!confirm(`Excluir o descritor ${d.posicao} (${d.ano_escolar} / ${d.componente})?`)) return;
    try {
      await deleteComponenteHabilidade(d.id);
      flashSuccess('Descritor excluído com sucesso!');
      await loadDescritores();
    } catch (e: any) {
      setError(e.message || 'Erro ao excluir descritor');
    }
  };

  const totalOrfaos = useMemo(() => orfaos.reduce((s, o) => s + o.qtd, 0), [orfaos]);

  return (
    <div className="space-y-6">
      {/* Cabecalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-purple-100 p-2 rounded-lg">
            <ListChecks className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Descritores</h1>
            <p className="text-gray-600">
              Gerencie os descritores (componentes_habilidades) —{' '}
              {selectedSystem === 'prova-parana'
                ? 'Prova Paraná Recomposição'
                : selectedSystem === 'parceiro'
                ? 'Avaliação Parceiro da Escola'
                : 'Paraná Mais'}
            </p>
          </div>
        </div>
        <button
          onClick={() => openNew()}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Novo Descritor
        </button>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <p className="text-sm text-green-600">{success}</p>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Form CRUD */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {editing ? 'Editar Descritor' : 'Novo Descritor'}
            </h3>
            <button onClick={resetForm} className="text-gray-500 hover:text-gray-700">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ano escolar</label>
                <select
                  value={form.ano_escolar}
                  onChange={(e) => setForm({ ...form, ano_escolar: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  {anos.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Componente</label>
                <select
                  value={form.componente}
                  onChange={(e) => setForm({ ...form, componente: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  {componentes.map((c) => (
                    <option key={c} value={c}>{componenteLabel(c)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rede</label>
                <input
                  type="text"
                  value={form.rede ?? ''}
                  onChange={(e) => setForm({ ...form, rede: e.target.value })}
                  placeholder="Ex: ESTADUAL"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Habilidade - Posição
              </label>
              <input
                type="text"
                value={form.habilidade_posicao ?? ''}
                onChange={(e) => setForm({ ...form, habilidade_posicao: e.target.value })}
                placeholder="Ex: H 07 (D025_P)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                Formato <code>H NN (CÓDIGO)</code>. Separamos automaticamente em habilidade (H07) e
                posição/código (D025_P).
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Descrição</label>
              <textarea
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Descrição da habilidade..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                required
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 transition-colors"
              >
                {editing ? 'Atualizar' : 'Cadastrar'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Seção: vincular resultados órfãos */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-amber-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              Resultados sem descritor ({orfaos.length} combinações
              {totalOrfaos > 0 ? ` · ${totalOrfaos} linhas` : ''})
            </h3>
          </div>
          <button
            onClick={loadOrfaos}
            className="text-gray-500 hover:text-gray-700 p-1"
            title="Recarregar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {orfaosLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
          </div>
        ) : orfaos.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-500 opacity-70" />
            <p>Nenhum resultado sem descritor. Tudo vinculado! 🎉</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="py-2 px-3 font-medium">Ano</th>
                  <th className="py-2 px-3 font-medium">Comp.</th>
                  <th className="py-2 px-3 font-medium">habilidade_id</th>
                  <th className="py-2 px-3 font-medium">habilidade_codigo</th>
                  <th className="py-2 px-3 font-medium">descrição atual</th>
                  <th className="py-2 px-3 font-medium">linhas</th>
                  <th className="py-2 px-3 font-medium">ação</th>
                </tr>
              </thead>
              <tbody>
                {orfaos.map((o, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 text-gray-900">{o.ano_escolar}</td>
                    <td className="py-2 px-3 text-gray-600">{o.componente}</td>
                    <td className="py-2 px-3 text-gray-900">{o.habilidade_id || '—'}</td>
                    <td className="py-2 px-3 text-gray-900">{o.habilidade_codigo || '—'}</td>
                    <td className="py-2 px-3 text-gray-600 max-w-xs truncate" title={o.descricao_habilidade}>
                      {o.descricao_habilidade || '—'}
                    </td>
                    <td className="py-2 px-3 text-gray-600">{o.qtd}</td>
                    <td className="py-2 px-3">
                      <button
                        onClick={() => setLinkTarget(o)}
                        className="flex items-center gap-1 text-amber-700 hover:text-amber-900 font-medium"
                      >
                        <Link2 className="w-4 h-4" />
                        Vincular
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lista de descritores + filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mr-auto">
            Descritores cadastrados ({descritores.length})
          </h3>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Ano</label>
            <select
              value={fAno}
              onChange={(e) => setFAno(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Todos</option>
              {anos.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Componente</label>
            <select
              value={fComp}
              onChange={(e) => setFComp(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Todos</option>
              {componentes.map((c) => (
                <option key={c} value={c}>{componenteLabel(c)}</option>
              ))}
            </select>
          </div>
          <div className="relative">
            <label className="block text-xs font-medium text-gray-600 mb-1">Busca</label>
            <Search className="absolute left-2.5 top-[34px] w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="código ou descrição..."
              className="pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : descritores.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-900">
                  <th className="py-3 px-4 font-medium">Ano</th>
                  <th className="py-3 px-4 font-medium">Componente</th>
                  <th className="py-3 px-4 font-medium">Habilidade</th>
                  <th className="py-3 px-4 font-medium">Código</th>
                  <th className="py-3 px-4 font-medium">Descrição</th>
                  <th className="py-3 px-4 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {descritores.map((d) => (
                  <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-900">{d.ano_escolar}</td>
                    <td className="py-3 px-4 text-gray-600">{componenteLabel(d.componente)}</td>
                    <td className="py-3 px-4 text-gray-900">{d.habilidade}</td>
                    <td className="py-3 px-4 text-gray-900 font-medium">{d.posicao}</td>
                    <td className="py-3 px-4 text-gray-600 max-w-md">{d.descricao}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(d)}
                          className="text-blue-600 hover:text-blue-800 p-1"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(d)}
                          className="text-red-600 hover:text-red-800 p-1"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <ListChecks className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum descritor encontrado</p>
          </div>
        )}
      </div>

      {linkTarget && (
        <LinkModal
          orfao={linkTarget}
          tipoProva={tipoProva}
          onClose={() => setLinkTarget(null)}
          onCreateNew={(prefill) => {
            setLinkTarget(null);
            openNew(prefill);
          }}
          onLinked={async (msg) => {
            setLinkTarget(null);
            flashSuccess(msg);
            await Promise.all([loadOrfaos(), loadDescritores()]);
          }}
          onError={(msg) => setError(msg)}
          selectedSystem={selectedSystem}
        />
      )}
    </div>
  );
};

// --- Modal para vincular um órfão a um descritor existente (ou criar novo) ---
interface LinkModalProps {
  orfao: DescritorOrfao;
  tipoProva: 'prova-parana' | 'mais' | 'parceiro';
  selectedSystem: SystemKey;
  onClose: () => void;
  onCreateNew: (prefill: Partial<DescritorInput>) => void;
  onLinked: (msg: string) => void | Promise<void>;
  onError: (msg: string) => void;
}

const LinkModal: React.FC<LinkModalProps> = ({
  orfao, tipoProva, selectedSystem, onClose, onCreateNew, onLinked, onError,
}) => {
  const [candidatos, setCandidatos] = useState<ComponenteHabilidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [preencher, setPreencher] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await getComponentesHabilidades(tipoProva, {
          ano_escolar: orfao.ano_escolar,
          componente: orfao.componente,
        });
        setCandidatos(data);
        // pré-seleciona o descritor cujo posicao == habilidade_codigo do órfão
        const match = data.find((d) => d.posicao === orfao.habilidade_codigo);
        if (match) setSelectedId(match.id);
      } catch (e: any) {
        onError(e.message || 'Erro ao carregar descritores candidatos');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLink = async () => {
    const descritor = candidatos.find((d) => d.id === selectedId);
    if (!descritor) return;
    setSaving(true);
    try {
      await vincularDescritorAResultados(selectedSystem, orfao, descritor, {
        preencherDescricao: preencher,
      });
      await onLinked(`Vinculado ${orfao.qtd} linha(s) ao descritor ${descritor.posicao}.`);
    } catch (e: any) {
      onError(e.message || 'Erro ao vincular');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Vincular resultado a descritor</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 mb-4">
            <p><strong>Ano:</strong> {orfao.ano_escolar} · <strong>Comp.:</strong> {orfao.componente}</p>
            <p><strong>habilidade_id:</strong> {orfao.habilidade_id || '—'} · <strong>código:</strong> {orfao.habilidade_codigo || '—'}</p>
            <p className="text-gray-500">{orfao.qtd} linha(s) sem descritor</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
            </div>
          ) : (
            <>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descritor de destino
              </label>
              {candidatos.length > 0 ? (
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3 focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Selecione um descritor...</option>
                  {candidatos.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.posicao} — {d.descricao.slice(0, 60)}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-gray-500 mb-3">
                  Nenhum descritor cadastrado para {orfao.ano_escolar} / {orfao.componente}.
                </p>
              )}

              <label className="flex items-center gap-2 text-sm text-gray-700 mb-4">
                <input
                  type="checkbox"
                  checked={preencher}
                  onChange={(e) => setPreencher(e.target.checked)}
                  className="text-purple-600 focus:ring-purple-500"
                />
                Também preencher descrição/código dos resultados com os dados do descritor
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleLink}
                  disabled={!selectedId || saving}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Vinculando...
                    </>
                  ) : (
                    <>
                      <Link2 className="w-4 h-4" />
                      Vincular
                    </>
                  )}
                </button>
                <button
                  onClick={() =>
                    onCreateNew({
                      tipo_prova: tipoProva,
                      rede: 'ESTADUAL',
                      ano_escolar: orfao.ano_escolar,
                      componente: orfao.componente,
                      habilidade_posicao: orfao.habilidade_codigo
                        ? `${orfao.habilidade_id} (${orfao.habilidade_codigo})`
                        : orfao.habilidade_id,
                      descricao: orfao.descricao_habilidade || '',
                    })
                  }
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Criar novo descritor
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Descritores;
