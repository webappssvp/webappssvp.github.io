/**
 * @fileoverview Metropolitanos e centrais que o app conhece (siglas/siglas_conselhos_centrais.json).
 * O metropolitano sai do endereço do site (campo "sites"); fora deles (localhost, GitHub Pages), o usuário escolhe.
 * Só aparecem os centrais com url_api. Em teste, a url_api pode vir do localStorage (ssvp_url_api:SP_SUD).
 * Módulo: js/core/conselhos.js
 */

const URL_LISTA = new URL('../../siglas/siglas_conselhos_centrais.json', import.meta.url);

/** Só no computador de quem desenvolve (ou pela rede local): mostra os Centrais sem script e aceita url_api local. */
export const EM_TESTE = /^(localhost|127\.0\.0\.1|192\.168\.)/.test(location.hostname);

let lista = null;

/**
 * @return {Promise<!Array<{sigla: string, nome: string, sites: !Array<string>,
 *     conselhos_centrais: !Array<{sigla: string, nome: string, url_api: ?string}>}>>}
 */
export async function carregarMetropolitanos() {
  if (!lista) {
    const resposta = await fetch(URL_LISTA, {cache: 'no-cache'});
    lista = (await resposta.json()).conselhos_metropolitanos || [];
  }
  return lista;
}

/**
 * Metropolitano do endereço em que o app foi aberto (ssvpsp.web.app → SP), ou null.
 * @return {Promise<?Object>}
 */
export async function metropolitanoDoSite() {
  const host = location.hostname.toLowerCase();
  return (await carregarMetropolitanos()).find((cm) => (cm.sites || []).includes(host)) || null;
}

/**
 * Endereço do script do CC. Em teste, o do localStorage vale mais que o do JSON.
 * @param {string} siglaCm
 * @param {!Object} cc
 * @return {string}
 */
export function urlApiDo(siglaCm, cc) {
  if (EM_TESTE) {
    try {
      const local = localStorage.getItem('ssvp_url_api:' + siglaCm + '_' + cc.sigla);
      if (local) {
        return local;
      }
    } catch (erro) {
      // localStorage bloqueado: fica com o do JSON
    }
  }
  return cc.url_api || '';
}

/**
 * Guarda (ou apaga) a url_api de teste de um CC.
 * @param {string} siglaCm
 * @param {string} siglaCc
 * @param {string} url
 */
export function definirUrlApiDeTeste(siglaCm, siglaCc, url) {
  try {
    if (url) {
      localStorage.setItem('ssvp_url_api:' + siglaCm + '_' + siglaCc, url.trim());
    } else {
      localStorage.removeItem('ssvp_url_api:' + siglaCm + '_' + siglaCc);
    }
  } catch (erro) {
    // sem localStorage não há url de teste
  }
}

/**
 * Centrais que aparecem no select: os com url_api (em teste, todos).
 * @param {!Object} cm
 * @return {!Array<!Object>}
 */
export function centraisDisponiveis(cm) {
  return (cm.conselhos_centrais || []).filter((cc) => EM_TESTE || urlApiDo(cm.sigla, cc));
}
