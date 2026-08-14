// =============================================================================
// Mapa das regionais do grupo APG (código → nome legível). Fonte única usada
// pelos relatórios/insights regionais de IDEB e ENEM.
//
// Os códigos vêm da coluna `regional` das bases (SJP/GUA/CWT). Os nomes foram
// confirmados pelos municípios das escolas de cada regional na própria base
// (ex.: escolas GUA estão em Guarapuava/Roncador). Se um código não for
// conhecido, exibe-se o próprio código — nunca um nome inventado.
// =============================================================================

export const REGIONAL_LABEL: Record<string, string> = {
  SJP: 'São José dos Pinhais',
  CWT: 'Curitiba',
  GUA: 'Guarapuava',
};

export const rotuloRegional = (cod: string): string => REGIONAL_LABEL[cod] ?? cod;
