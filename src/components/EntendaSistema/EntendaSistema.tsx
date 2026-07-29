import React, { useEffect } from 'react';
import { X, BookOpen, ExternalLink, Filter, BarChart3, LayoutGrid, Sparkles, Info } from 'lucide-react';
import { ENTENDA, EntendaSystemKey } from './entendaContent';

interface EntendaSistemaProps {
  system: EntendaSystemKey;
  open: boolean;
  onClose: () => void;
}

// Acento por sistema em CLASSES LITERAIS — o purge do Tailwind não sobrevive a
// interpolação (`bg-${cor}-100`), então cada variante é escrita por extenso.
const ACCENT: Record<EntendaSystemKey, {
  headerBg: string; iconWrap: string; dot: string; chip: string; ring: string;
}> = {
  'prova-parana': {
    headerBg: 'from-blue-600 to-blue-500',
    iconWrap: 'bg-blue-100 text-blue-700',
    dot: 'bg-blue-500',
    chip: 'bg-blue-50 text-blue-700 border-blue-100',
    ring: 'focus:ring-blue-500',
  },
  parceiro: {
    headerBg: 'from-green-600 to-green-500',
    iconWrap: 'bg-green-100 text-green-700',
    dot: 'bg-green-500',
    chip: 'bg-green-50 text-green-700 border-green-100',
    ring: 'focus:ring-green-500',
  },
  'parana-mais': {
    headerBg: 'from-orange-600 to-orange-500',
    iconWrap: 'bg-orange-100 text-orange-700',
    dot: 'bg-orange-500',
    chip: 'bg-orange-50 text-orange-700 border-orange-100',
    ring: 'focus:ring-orange-500',
  },
  enem: {
    headerBg: 'from-emerald-600 to-emerald-500',
    iconWrap: 'bg-emerald-100 text-emerald-700',
    dot: 'bg-emerald-500',
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    ring: 'focus:ring-emerald-500',
  },
};

// Bloco de seção com título e lista de itens (nome — descrição).
const SecaoLista: React.FC<{
  titulo: string;
  icon: React.ReactNode;
  dot: string;
  itens: { nome: string; desc: string }[];
}> = ({ titulo, icon, dot, itens }) => (
  <section className="bg-gray-50 border border-gray-200 rounded-xl p-4 sm:p-5">
    <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
      <span className="text-gray-500">{icon}</span>
      {titulo}
    </h3>
    <ul className="space-y-2.5">
      {itens.map((it, i) => (
        <li key={i} className="flex gap-2.5">
          <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
          <p className="text-sm text-gray-700 leading-relaxed">
            <span className="font-medium text-gray-900">{it.nome}</span>
            {it.desc ? <span className="text-gray-600"> — {it.desc}</span> : null}
          </p>
        </li>
      ))}
    </ul>
  </section>
);

const EntendaSistema: React.FC<EntendaSistemaProps> = ({ system, open, onClose }) => {
  const conteudo = ENTENDA[system];
  const accent = ACCENT[system];

  // Fecha com ESC e trava o scroll do fundo enquanto o modal está aberto.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !conteudo) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="entenda-titulo"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Card */}
      <div className="relative bg-white w-full sm:max-w-2xl sm:rounded-2xl shadow-2xl max-h-[100dvh] sm:max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className={`bg-gradient-to-r ${accent.headerBg} px-5 sm:px-6 py-4 flex items-start justify-between text-white`}>
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 id="entenda-titulo" className="text-lg font-semibold leading-tight">
                Entenda o Sistema
              </h2>
              <p className="text-sm text-white/85">{conteudo.titulo}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/20 rounded-lg p-1.5 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body (rolável) */}
        <div className="overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
          {/* Resumo / propósito */}
          <section>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${accent.chip}`}>
                <Info className="w-3.5 h-3.5" />
                Visão geral
              </span>
              {conteudo.publico && (
                <span className="text-xs text-gray-500">{conteudo.publico}</span>
              )}
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{conteudo.resumo}</p>
          </section>

          {/* Materiais informativos */}
          <section className={`border rounded-xl p-4 sm:p-5 ${accent.chip}`}>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-1">
              <BookOpen className="w-4 h-4" />
              Materiais informativos
            </h3>
            {conteudo.materiais.length > 0 ? (
              <div className="mt-3 space-y-2">
                {conteudo.materiais.map((m, i) => (
                  <a
                    key={i}
                    href={m.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2.5 hover:shadow-sm hover:border-gray-300 transition-all"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{m.label}</p>
                      {m.descricao && <p className="text-xs text-gray-500 truncate">{m.descricao}</p>}
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-400 shrink-0" />
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-600 mt-1">
                Os materiais complementares (tutoriais e guias) serão disponibilizados aqui em breve.
              </p>
            )}
          </section>

          {/* Principais abas/visões */}
          {conteudo.abas.length > 0 && (
            <SecaoLista
              titulo="Principais abas e visões"
              icon={<LayoutGrid className="w-4 h-4" />}
              dot={accent.dot}
              itens={conteudo.abas}
            />
          )}

          {/* Indicadores e gráficos */}
          {conteudo.indicadores.length > 0 && (
            <SecaoLista
              titulo="Indicadores e gráficos"
              icon={<BarChart3 className="w-4 h-4" />}
              dot={accent.dot}
              itens={conteudo.indicadores}
            />
          )}

          {/* Filtros */}
          {conteudo.filtros.length > 0 && (
            <section className="bg-gray-50 border border-gray-200 rounded-xl p-4 sm:p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
                <Filter className="w-4 h-4 text-gray-500" />
                Filtros disponíveis
              </h3>
              <div className="flex flex-wrap gap-2">
                {conteudo.filtros.map((f, i) => (
                  <span key={i} className="text-xs bg-white border border-gray-200 text-gray-700 rounded-full px-2.5 py-1">
                    {f}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Particularidades */}
          {conteudo.particularidades.length > 0 && (
            <section className="bg-amber-50 border border-amber-200 rounded-xl p-4 sm:p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-900 mb-3">
                <Sparkles className="w-4 h-4 text-amber-600" />
                Particularidades deste sistema
              </h3>
              <ul className="space-y-2">
                {conteudo.particularidades.map((p, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-amber-900/90 leading-relaxed">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 bg-amber-500" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-5 sm:px-6 py-3 flex justify-end bg-gray-50">
          <button
            onClick={onClose}
            className={`px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 focus:ring-2 focus:ring-offset-1 ${accent.ring} transition-colors`}
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
};

export default EntendaSistema;
