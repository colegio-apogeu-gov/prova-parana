export interface UploadLogEntry {
  fileName: string;
  status: 'sucesso' | 'erro';
  unidade: string;
  anoProva: string;
  semestre: string;
  anoEscolar: string;
  componente: string;
  registrosInseridos: number;
  mensagemErro: string;
  timestamp: string;
}

export interface ParsedFileName {
  unidade: string;
  anoProva: string;
  semestre: string;
  anoEscolar: string;
  componente: string;
}

const CODIGO_PARA_UNIDADE: Record<string, string> = {
  ANITACANET: 'ANITA CANET C E EF M',
  ANTONIOTUPYPINHEIRO: 'ANTONIO TUPY PINHEIRO C E EF M',
  CARNEIRO: 'CARNEIRO C E GAL EF M PROFIS',
  COSTAVIANA: 'COSTA VIANA C E EF M PROFIS N',
  CRISTOREI: 'CRISTO REI C E EF M',
  DECIODOSSI: 'DECIO DOSSI C E DR EF M PROFIS',
  FRANCISCOCMARTINS: 'FRANCISCO C MARTINS C E EM PROF',
  GILDOASCHUCK: 'GILDO A SCHUCK C E PROF EF M ETI N',
  GODOFREDOMACHADO: 'GODOFREDO MACHADO E E EF',
  HOMEROBDEBARROS: 'HOMERO B DE BARROS C E EFM ETI',
  ISABELLSSOUZA: 'ISABEL L S SOUZA C E PROFA EF M',
  IVOLEAO: 'IVO LEAO C E EF M',
  JOAODEOLIVEIRAFRANCO: 'JOAO DE OLIVEIRA FRANCO C E EF M',
  JOAOMAZZAROTTO: 'JOAO MAZZAROTTO C E EF M',
  LIANEMARTADACOSTA: 'LIANE MARTA DA COSTA C E EF M',
  PAULOFREIRE: 'PAULO FREIRE C E PROF E F M N',
  SANTOAGOSTINHO: 'SANTO AGOSTINHO C E EF M',
  TARSILADOAMARAL: 'TARSILA DO AMARAL C E EF M',
  TEREZADASRAMOS: 'TEREZA DA S RAMOS C E PROFA EF M',
  VICTORDOAMARAL: 'VICTOR DO AMARAL C E PROF EFM ETI PROFI',
};

const ANO_ESCOLAR_MAP: Record<string, string> = {
  '1ANO': '1º ano',
  '2ANO': '2º ano',
  '3ANO': '3º ano',
  '4ANO': '4º ano',
  '5ANO': '5º ano',
  '6ANO': '6º ano',
  '7ANO': '7º ano',
  '8ANO': '8º ano',
  '9ANO': '9º ano',
};

export function parseFileName(fileName: string): ParsedFileName {
  const nameWithoutExt = fileName.replace(/\.(xlsx|xls|csv)$/i, '');
  const parts = nameWithoutExt.split('_');

  if (parts.length !== 5) {
    throw new Error(
      `Nome de arquivo invalido: "${fileName}". Esperado: NOMEDAESCOLA_ANOPROVA_SEMESTRE_ANOESCOLAR_COMPONENTE`
    );
  }

  const [codigoEscola, anoProva, semestre, anoEscolarCode, componente] = parts;

  const unidade = CODIGO_PARA_UNIDADE[codigoEscola.toUpperCase()];
  if (!unidade) {
    throw new Error(
      `Escola nao encontrada no mapeamento: "${codigoEscola}". Verifique o nome do arquivo.`
    );
  }

  if (!/^\d{4}$/.test(anoProva)) {
    throw new Error(`Ano da prova invalido: "${anoProva}". Esperado formato YYYY.`);
  }

  if (semestre !== '1' && semestre !== '2') {
    throw new Error(`Semestre invalido: "${semestre}". Esperado 1 ou 2.`);
  }

  const anoEscolar = ANO_ESCOLAR_MAP[anoEscolarCode.toUpperCase()];
  if (!anoEscolar) {
    throw new Error(
      `Ano escolar invalido: "${anoEscolarCode}". Esperado formato como 9ANO, 3ANO, etc.`
    );
  }

  const comp = componente.toUpperCase();
  if (comp !== 'LP' && comp !== 'MT') {
    throw new Error(`Componente invalido: "${componente}". Esperado LP ou MT.`);
  }

  return { unidade, anoProva, semestre, anoEscolar, componente: comp };
}

export function generateLogCSV(log: UploadLogEntry[]): string {
  const header = 'Arquivo;Status;Unidade;Ano Prova;Semestre;Ano Escolar;Componente;Registros Inseridos;Mensagem Erro;Timestamp';
  const rows = log.map((entry) =>
    [
      entry.fileName,
      entry.status,
      entry.unidade,
      entry.anoProva,
      entry.semestre,
      entry.anoEscolar,
      entry.componente,
      entry.registrosInseridos,
      entry.mensagemErro.replace(/;/g, ','),
      entry.timestamp,
    ].join(';')
  );
  return [header, ...rows].join('\n');
}

export function downloadLog(log: UploadLogEntry[]) {
  const csv = generateLogCSV(log);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `upload_log_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
