import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, Edit2, Trash2, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';
import { getLinksQuestoes, createLinkQuestao, updateLinkQuestao, deleteLinkQuestao } from '../../lib/supabase';
import { LinkQuestao } from '../../types';

interface CadastrarAtividadesProps {
  selectedSystem: 'prova-parana' | 'parceiro';
}

const CadastrarAtividades: React.FC<CadastrarAtividadesProps> = ({ selectedSystem }) => {
  const [links, setLinks] = useState<LinkQuestao[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingLink, setEditingLink] = useState<LinkQuestao | null>(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    link: '',
    habilidade_codigo: '',
    componente: 'LP' as 'LP' | 'MT'
  });

  useEffect(() => {
    loadLinks();
  }, []);

  const loadLinks = async () => {
    setLoading(true);
    try {
      const data = await getLinksQuestoes();
      setLinks(data);
    } catch (error) {
      console.error('Erro ao carregar links:', error);
      setError('Erro ao carregar links');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (editingLink) {
        await updateLinkQuestao(editingLink.id, form);
        setSuccess('Link atualizado com sucesso!');
      } else {
        await createLinkQuestao(form);
        setSuccess('Link cadastrado com sucesso!');
      }
      
      await loadLinks();
      resetForm();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error: any) {
      setError(error.message || 'Erro ao salvar link');
    }
  };

  const handleEdit = (link: LinkQuestao) => {
    setEditingLink(link);
    setForm({
      link: link.link,
      habilidade_codigo: link.habilidade_codigo,
      componente: link.componente
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este link?')) return;

    try {
      await deleteLinkQuestao(id);
      await loadLinks();
      setSuccess('Link excluído com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error: any) {
      setError(error.message || 'Erro ao excluir link');
    }
  };

  const resetForm = () => {
    setForm({
      link: '',
      habilidade_codigo: '',
      componente: 'LP'
    });
    setEditingLink(null);
    setShowForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-green-100 p-2 rounded-lg">
            <BookOpen className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cadastrar Atividades</h1>
            <p className="text-gray-600">
              Gerencie os links das questões por habilidade - {selectedSystem === 'prova-parana' ? 'Prova Paraná' : 'Avaliação Parceiro da Escola'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Novo Link
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

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {editingLink ? 'Editar Link' : 'Novo Link'}
            </h3>
            <button
              onClick={resetForm}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Habilidade Código
                </label>
                <input
                  type="text"
                  value={form.habilidade_codigo}
                  onChange={(e) => setForm({ ...form, habilidade_codigo: e.target.value })}
                  placeholder="Ex: D020_M"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Componente
                </label>
                <select
                  value={form.componente}
                  onChange={(e) => setForm({ ...form, componente: e.target.value as 'LP' | 'MT' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="LP">Língua Portuguesa</option>
                  <option value="MT">Matemática</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Link da Questão
              </label>
              <input
                type="url"
                value={form.link}
                onChange={(e) => setForm({ ...form, link: e.target.value })}
                placeholder="https://exemplo.com/questao"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                {editingLink ? 'Atualizar' : 'Cadastrar'}
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Links Cadastrados ({links.length})
        </h3>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          </div>
        ) : links.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Habilidade</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Componente</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Link</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Ações</th>
                </tr>
              </thead>
              <tbody>
                {links.map((link) => (
                  <tr key={link.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-900">{link.habilidade_codigo}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {link.componente === 'LP' ? 'Língua Portuguesa' : 'Matemática'}
                    </td>
                    <td className="py-3 px-4 text-sm text-blue-600 max-w-xs truncate">
                      <a
                        href={link.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline flex items-center gap-1"
                      >
                        {link.link}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(link)}
                          className="text-blue-600 hover:text-blue-800 p-1"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(link.id)}
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
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum link cadastrado</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CadastrarAtividades;