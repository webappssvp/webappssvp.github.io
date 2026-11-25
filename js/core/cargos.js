/**
 * @fileoverview Cargos da conferência (25/11/2026): PCF, VCF, SCF e TCF (presidente, vice, secretário e tesoureiro),
 * no lugar de PRE, VIC, SEC e TES; o mesmo padrão dos conselhos (PCP, VCP, SCP, TCP; PCC, VCC, SCC, TCC).
 * VIC também era o papel "vicentino". O script do CC troca as siglas sozinho em cada planilha
 * (Permissoes.gs, migrarSiglasDosCargos_); até lá, o app aceita as duas.
 */

/** Siglas antigas → atuais. */
const SIGLAS_ANTIGAS = {PRE: 'PCF', VIC: 'VCF', SEC: 'SCF', TES: 'TCF'};

/** Nome de cada cargo, na ordem em que aparecem nas listas. */
export const NOMES_DOS_CARGOS = {PCF: 'Presidente', VCF: 'Vice-presidente', SCF: 'Secretário(a)', TCF: 'Tesoureiro(a)'};
export const ORDEM_DOS_CARGOS = ['PCF', 'VCF', 'SCF', 'TCF'];

/**
 * @param {*} sigla Como veio da planilha ou do perfil.
 * @return {string} A sigla atual (PRE vira PCF; VIC vira VCF).
 */
export function siglaDoCargo(sigla) {
  const s = String(sigla === undefined || sigla === null ? '' : sigla).trim().toUpperCase();
  return SIGLAS_ANTIGAS[s] || s;
}

/**
 * @param {*} sigla
 * @return {string} "Presidente", "Vice-presidente"… ou a própria sigla, se não for conhecida.
 */
export function nomeDoCargo(sigla) {
  const s = siglaDoCargo(sigla);
  return NOMES_DOS_CARGOS[s] || s;
}
