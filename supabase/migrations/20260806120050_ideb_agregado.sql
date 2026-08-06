-- Fecha a carga do IDEB: recalcula o agregado do Paraná (usado na aba Histórico).
-- Rodar SEMPRE depois das migrations 20260806120010..40_ideb_dados_N.sql.

SELECT refresh_ideb_agregado();

-- Conferência rápida: 16 linhas (11 edições dos anos finais + 5 do ensino médio).
-- SELECT etapa, ano, escolas, ideb, ideb_estadual FROM ideb_pr_agregado ORDER BY etapa, ano;
