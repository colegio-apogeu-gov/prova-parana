-- Corrige parceiro/is_apogeu de 8 escolas parceiras que ficaram sem tag no IDEB
-- (eram exatamente as sem IDEB de Ensino Medio 2025; a tag original derivava do conjunto ENEM/EM).
-- Sem isso elas somem dos recortes por grupo/parceiros e do getIdebParceiros. Ex.: GERALDO FERNANDES (IDEB 7,1 em 2025).

UPDATE ideb_resultados SET parceiro='salta', is_apogeu=false WHERE inep_codigo IN ('41023927','41074629');
UPDATE ideb_resultados SET parceiro='tom', is_apogeu=false WHERE inep_codigo IN ('41597907','41028716','41029305','41031679','41077342','41033434');
