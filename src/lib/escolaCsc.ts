import { createContext, useContext } from 'react';

// Escola escolhida pelo usuário do CSC (ver isCsc em types). O App só fornece o
// valor para o CSC; para usuários de escola ele é null e as telas seguem usando a
// unidade do próprio perfil.
export interface EscolaCsc {
  escola: string; // '' = nenhuma escolhida ainda
  setEscola: (escola: string) => void;
}

const EscolaCscContext = createContext<EscolaCsc | null>(null);

export const EscolaCscProvider = EscolaCscContext.Provider;

export const useEscolaCsc = (): EscolaCsc | null => useContext(EscolaCscContext);
