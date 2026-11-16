/**
 * @fileoverview Interface de Gestão e Teste de Visitas Domiciliares (v1.0 Sandbox).
 * Renderiza lares assistidos, metas com acompanhamento fraterno e formulário de nova visita.
 * Integração completa com o sistema de voz, código cromático SSVP e Central de Ajuda t5:
 * - Cartões de relatos interativos com pulso em AZUL SSVP para OUVIR.
 * - Campos de formulário com pulso em VERMELHO SSVP para FALAR.
 * - Botão [Teclado] sóbrio para exibir/recolher teclado virtual manual sem cobrir a tela na fala.
 * - Suporte nativo ao Modo de Ajuda "O que é isso?" (.ajuda-alvo com títulos e textos explicativos).
 * Conformidade com: dev/padroes/02_javascript_google.md e dev/padroes/05_acessibilidade_ergonomia.md
 */

import * as db from './db.js';
import { definirElementoLeitura, alternarTecladoVirtual } from './voz.js';

/**
 * Referência para o container principal da interface.
 * @type {HTMLElement|null}
 */
let containerConteudo = null;

/**
 * Inicializa a visualização das visitas e famílias no elemento #areaConteudo.
 * @return {Promise<void>}
 */
export async function inicializarVisitasUI() {
  containerConteudo = document.getElementById('areaConteudo');
  if (!containerConteudo) {
    console.warn('[VisitasUI] Elemento #areaConteudo não localizado.');
    return;
  }

  await renderizarPainelPrincipal();
}

/**
 * Renderiza o painel principal de acordo com o estado do banco local.
 * Se houver famílias cadastradas, exibe os cartões. Senão, exibe o convite para carregar o cenário de teste.
 * @return {Promise<void>}
 */
export async function renderizarPainelPrincipal() {
  if (!containerConteudo) return;

  const familias = await db.obterTodos(db.STORES.FAMILIAS);

  if (familias.length === 0) {
    renderizarBoasVindasSandbox();
  } else {
    await renderizarListaFamilias(familias);
  }
}

/**
 * Formata data ISO (AAAA-MM-DD) para padrão brasileiro DD/MM/AAAA.
 * @param {string} dataIso
 * @return {string}
 */
function formatarData(dataIso) {
  if (!dataIso || !dataIso.includes('-')) return dataIso || '';
  const partes = dataIso.split('-');
  if (partes.length !== 3) return dataIso;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

/**
 * Renderiza a tela inicial de convite para carregar o cenário de 4 semanas.
 * @return {void}
 */
function renderizarBoasVindasSandbox() {
  if (!containerConteudo) return;

  containerConteudo.innerHTML = `
    <article class="card-explicativo ajuda-alvo" style="border: 2px dashed #38bdf8; background: rgba(15, 23, 42, 0.95);"
      data-ajuda-titulo="Ambiente de Testes (Sandbox)"
      data-ajuda-texto="Ambiente de demonstração da Conferência Santa Dulce dos Pobres com dados de exemplo de famílias para testes no celular.">
      <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
        <span style="font-size: 2rem;">🧪</span>
        <div>
          <h2 class="card-explicativo-titulo" style="margin: 0; color: #38bdf8;">Ambiente de Testes (Sandbox v1.0)</h2>
          <span style="font-size: 0.75rem; color: #94a3b8;">Conferência Santa Dulce dos Pobres</span>
        </div>
      </div>
      <p class="card-explicativo-corpo" style="color: #cbd5e1; font-size: 0.9rem; line-height: 1.5;">
        Experimente a ergonomia vicentina 60+:
        toque em qualquer relato para a borda pulsar em <strong>Azul (Ouvir)</strong> ou toque em um campo de anotações
        para pulsar em <strong>Vermelho (Falar)</strong> sem que o teclado cubra a tela do celular!
      </p>
      <div style="margin-top: 1.25rem;">
        <button type="button" id="btnCarregarCenarioTeste" class="btn-submit ajuda-alvo" style="background-color: #0284c7; font-size: 0.95rem; padding: 0.85rem 1rem; border-radius: 10px;"
          data-ajuda-titulo="Botão Carregar Cenário"
          data-ajuda-texto="Insere dados de demonstração de 4 semanas de visitas no banco de dados local do seu aparelho para você testar.">
          📥 Carregar Cenário de 4 Semanas no Celular
        </button>
      </div>
    </article>

    <article class="card-explicativo ajuda-alvo"
      data-ajuda-titulo="Guia Rápido de Acessibilidade 60+"
      data-ajuda-texto="Apresenta os códigos de cores oficiais da SSVP para leitura em voz alta e ditado por voz.">
      <h3 class="card-explicativo-titulo">🎙️ Recursos de Acessibilidade 60+:</h3>
      <ul style="padding-left: 1.2rem; color: #cbd5e1; font-size: 0.85rem; line-height: 1.6;">
        <li><strong style="color: #38bdf8;">🔵 AZUL SSVP (Ouvir):</strong> Toque no relato. O card e a barra inferior acendem em azul suave para ouvir a leitura.</li>
        <li><strong style="color: #ef4444;">🔴 VERMELHO SSVP (Falar):</strong> Toque no campo. Ele acende em vermelho e prepara o microfone sem abrir o teclado virtual.</li>
        <li><strong>⌨️ Teclado Sob Demanda:</strong> Se quiser digitar manualmente, aperte o botão [Teclado] acima de cada campo.</li>
        <li><strong>📱 100% Offline:</strong> Todos os dados ficam salvos localmente no IndexedDB v3.</li>
      </ul>
    </article>
  `;

  const btnCarregar = document.getElementById('btnCarregarCenarioTeste');
  if (btnCarregar) {
    btnCarregar.addEventListener('click', async () => {
      btnCarregar.disabled = true;
      btnCarregar.textContent = 'Carregando dados no IndexedDB...';
      await db.carregarCenarioTesteLocal();
      await renderizarPainelPrincipal();
    });
  }
}

/**
 * Renderiza a lista de famílias ativas com seus relatos e formulários no DOM.
 * @param {Array<Object>} familias Lista de famílias ativas.
 * @return {Promise<void>}
 */
async function renderizarListaFamilias(familias) {
  if (!containerConteudo) return;

  const todasPessoas = await db.obterTodos(db.STORES.PESSOAS);
  const todasVisitas = await db.obterTodos(db.STORES.VISITAS);
  const todasMetas = await db.obterTodos(db.STORES.PLANO_PROMOCAO);
  const filaPendente = await db.obterFilaPendente();

  let html = `
    <!-- Barra de Status da Conferência e Fila de Sincronização -->
    <div class="ajuda-alvo" data-ajuda-titulo="Conferência Ativa" data-ajuda-texto="Mostra a conferência vicentina atual, a quantidade de lares assistidos e visitas aguardando sincronização." style="background: rgba(30, 41, 59, 0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 0.85rem; margin-bottom: 1.2rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; width: 100%; max-width: 480px;">
      <div>
        <div style="font-size: 0.72rem; text-transform: uppercase; color: #38bdf8; font-weight: 700; letter-spacing: 0.05em;">Conferência Ativa</div>
        <div style="font-size: 1rem; font-weight: 800; color: #ffffff;">Santa Dulce dos Pobres (SP)</div>
        <div style="font-size: 0.75rem; color: #94a3b8;">${familias.length} lares assistidos • ${filaPendente.length} visitas na fila offline</div>
      </div>
      <button type="button" id="btnRecarregarCenario" class="ajuda-alvo" data-ajuda-titulo="Recarregar Dados" data-ajuda-texto="Reinicia o banco local de dados do celular com o cenário de teste de 4 semanas." style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.22); color: #cbd5e1; border-radius: 8px; padding: 0.45rem 0.8rem; font-size: 0.75rem; font-weight: 600; cursor: pointer;">
        🔄 Recarregar
      </button>
    </div>
  `;

  for (const familia of familias) {
    const pessoasDaFamilia = todasPessoas.filter((p) => p.id_familia === familia.id_familia);
    const visitasDaFamilia = todasVisitas
      .filter((v) => v.id_familia === familia.id_familia)
      .sort((a, b) => new Date(b.data_visita).getTime() - new Date(a.data_visita).getTime());
    const metasDaFamilia = todasMetas.filter((m) => m.id_familia === familia.id_familia);

    const ultimaVisita = visitasDaFamilia[0] || null;

    html += `
      <article class="card-explicativo ajuda-alvo" data-ajuda-titulo="Cartão da Família Visitada" data-ajuda-texto="Contém o histórico completo do lar assistido: moradores, metas de promoção humana e registro de visitas." style="border-left: 4px solid #0064B6; margin-bottom: 1.5rem; background: #0F172A;">
        <!-- Cabeçalho do Lar -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
          <div>
            <span style="font-size: 0.72rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700;">Lar Assistido</span>
            <h3 style="font-size: 1.15rem; font-weight: 800; color: #ffffff; margin: 0.15rem 0;">${familia.nome_responsavel}</h3>
            <p style="font-size: 0.82rem; color: #cbd5e1; margin: 0;">📍 ${familia.endereco} - ${familia.bairro}</p>
          </div>
          <span style="background: #166534; color: #86efac; font-size: 0.7rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 9999px;">
            ${familia.status.toUpperCase()}
          </span>
        </div>

        <!-- Integrantes da Casa -->
        <div class="ajuda-alvo" data-ajuda-titulo="Moradores do Lar" data-ajuda-texto="Lista de pessoas que residem na casa e são acompanhadas pela Conferência Vicentina." style="background: rgba(255,255,255,0.03); border-radius: 8px; padding: 0.5rem 0.75rem; margin: 0.6rem 0; font-size: 0.8rem; color: #94a3b8;">
          👥 <strong>Moradores:</strong> ${pessoasDaFamilia.map((p) => `${p.nome_completo} (${p.parentesco || 'Membro'})`).join(', ')}
        </div>

        <!-- Metas Fraternas e Mudança Sistêmica -->
        <div class="ajuda-alvo" data-ajuda-titulo="Metas de Mudança Sistêmica" data-ajuda-texto="Objetivos pactuados com a família para promoção humana, autonomia, saúde, educação e trabalho." style="margin: 0.8rem 0; padding: 0.75rem; background: rgba(30, 41, 59, 0.7); border-radius: 8px; border: 1px solid rgba(255,255,255,0.06);">
          <div style="font-size: 0.78rem; font-weight: 700; color: #38bdf8; margin-bottom: 0.4rem;">🎯 Metas e Mudança Sistêmica:</div>
          ${metasDaFamilia.length === 0 ? '<p style="font-size: 0.8rem; color: #94a3b8; margin: 0;">Nenhuma meta ativa no momento.</p>' : ''}
          ${metasDaFamilia.map((meta) => {
            const textoParaLeituraMeta = `Meta da família: ${meta.descricao}. Status: ${meta.status_meta}. ${meta.justificativa_obstaculo ? `Observação: ${meta.justificativa_obstaculo}` : ''}`;
            return `
              <div class="card-leitura-interativo ajuda-alvo" data-leitura="true" data-texto-leitura="${encodeURIComponent(textoParaLeituraMeta)}" data-ajuda-titulo="Meta: ${meta.descricao}" data-ajuda-texto="Toque para ouvir a leitura em voz alta desta meta na barra inferior do aplicativo." tabindex="0" role="button" aria-label="Toque para ouvir esta meta" style="margin-bottom: 0.5rem; padding: 0.5rem; border-radius: 8px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.08); cursor: pointer; transition: all 0.2s ease;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: #ffffff; font-weight: 600; font-size: 0.82rem;">${meta.descricao}</span>
                  <span style="font-size: 0.68rem; font-weight: 700; padding: 0.15rem 0.4rem; border-radius: 4px; ${meta.status_meta === 'cumprida' ? 'background: #15803d; color: #bbf7d0;' : 'background: #b45309; color: #fef3c7;'}">
                    ${meta.status_meta.toUpperCase()}
                  </span>
                </div>
                ${meta.prazo_estimado ? `<div style="font-size: 0.72rem; color: #94a3b8; margin-top: 0.15rem;">Prazo: ${formatarData(meta.prazo_estimado)}</div>` : ''}
                ${meta.justificativa_obstaculo ? `<div style="font-size: 0.75rem; color: #fcd34d; margin-top: 0.2rem;">💡 <em>${meta.justificativa_obstaculo}</em></div>` : ''}
                <div style="font-size: 0.68rem; color: #38bdf8; margin-top: 0.35rem; font-weight: 600;">🔵 Toque aqui para ouvir na barra inferior</div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Relato da Última Visita (Card Interativo para Ouvir via Azul SSVP) -->
        ${ultimaVisita ? `
          <div class="card-leitura-interativo ajuda-alvo" data-leitura="true" data-texto-leitura="${encodeURIComponent(`Relato da última visita de ${formatarData(ultimaVisita.data_visita)}: ${ultimaVisita.relato_visita}. Auxílio entregue: ${ultimaVisita.auxilio_entregue || 'Cesta de alimentos'}`)}" data-ajuda-titulo="Relato da Última Visita" data-ajuda-texto="Toque para ouvir a leitura falada do relato da visita anterior através do sintetizador de voz." tabindex="0" role="button" aria-label="Toque para ouvir o relato da última visita" style="background: rgba(15, 23, 42, 0.85); border: 1.5px solid rgba(56, 189, 248, 0.3); border-radius: 10px; padding: 0.85rem; margin: 0.8rem 0; cursor: pointer; transition: all 0.2s ease;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
              <span style="font-size: 0.75rem; color: #38bdf8; font-weight: 700;">
                📅 Última Visita: ${formatarData(ultimaVisita.data_visita)} (${ultimaVisita.horario_inicio || ''})
              </span>
              <span style="font-size: 0.72rem; color: #38bdf8; font-weight: 700; background: rgba(56, 189, 248, 0.12); padding: 0.15rem 0.5rem; border-radius: 9999px;">
                🔵 Toque para Ouvir
              </span>
            </div>
            <p style="font-size: 0.86rem; color: #cbd5e1; line-height: 1.45; margin: 0; font-style: italic;">
              "${ultimaVisita.relato_visita}"
            </p>
            ${ultimaVisita.auxilio_entregue ? `
              <div style="font-size: 0.75rem; color: #86efac; margin-top: 0.45rem; font-weight: 600;">
                🎁 Auxílio: ${ultimaVisita.auxilio_entregue}
              </div>
            ` : ''}
          </div>
        ` : ''}

        <!-- Formulário da Nova Visita com Ditado por Voz e Botão Teclado -->
        <details class="ajuda-alvo" data-ajuda-titulo="Formulário de Nova Visita" data-ajuda-texto="Toque para abrir os campos de preenchimento da visita de hoje: relato, auxílio entregue e nova meta pactuada." style="margin-top: 0.9rem; background: rgba(30, 41, 59, 0.5); border-radius: 10px; padding: 0.6rem 0.85rem; border: 1px solid rgba(255,255,255,0.08);">
          <summary style="font-size: 0.88rem; font-weight: 700; color: #38bdf8; cursor: pointer; padding: 0.3rem 0;">
            ✍️ Registrar Nova Visita para ${familia.nome_responsavel}
          </summary>

          <form class="form-nova-visita" data-id-familia="${familia.id_familia}" style="display: flex; flex-direction: column; gap: 0.85rem; margin-top: 0.85rem;">
            
            <!-- Campo 1: Relato da Visita -->
            <div>
              <div class="barra-acao-campo">
                <label for="relato_${familia.id_familia}" style="font-size: 0.75rem; color: #94a3b8; font-weight: 600;">
                  Relato da Visita (🔴 Toque p/ Falar ou no Teclado):
                </label>
                <button type="button" class="btn-abrir-teclado ajuda-alvo" data-alvo-campo="relato_${familia.id_familia}" data-ajuda-titulo="Botão Teclado" data-ajuda-texto="Abre ou esconde o teclado na tela para você escrever manualmente neste campo.">
                  Teclado
                </button>
              </div>
              <textarea id="relato_${familia.id_familia}" name="relato_visita" rows="3" class="form-input ajuda-alvo" data-ajuda-titulo="Campo de Relato da Visita" data-ajuda-texto="Anote aqui a conversa, o estado de ânimo e as necessidades espirituais e materiais da família." placeholder="Toque aqui e aperte [Falar] na barra inferior..." required inputmode="none" style="width: 100%; box-sizing: border-box; resize: vertical; min-height: 4.5rem; border-radius: 8px;"></textarea>
            </div>

            <!-- Campo 2: Auxílio Entregue -->
            <div>
              <div class="barra-acao-campo">
                <label for="auxilio_${familia.id_familia}" style="font-size: 0.75rem; color: #94a3b8; font-weight: 600;">
                  Auxílio ou Cesta Entregue:
                </label>
                <button type="button" class="btn-abrir-teclado ajuda-alvo" data-alvo-campo="auxilio_${familia.id_familia}" data-ajuda-titulo="Botão Teclado" data-ajuda-texto="Abre ou fecha o teclado para o campo de auxílio.">
                  Teclado
                </button>
              </div>
              <input type="text" id="auxilio_${familia.id_familia}" name="auxilio_entregue" class="form-input ajuda-alvo" data-ajuda-titulo="Campo Auxílio Entregue" data-ajuda-texto="Registre o que a conferência forneceu: cesta básica, fraldas, remédios, etc." placeholder="Ex: Cesta básica mensal, remédios..." inputmode="none" style="width: 100%; box-sizing: border-box; border-radius: 8px;">
            </div>

            <!-- Campo 3: Nova Meta Pactuada -->
            <div>
              <div class="barra-acao-campo">
                <label for="meta_${familia.id_familia}" style="font-size: 0.75rem; color: #94a3b8; font-weight: 600;">
                  Nova Meta Pactuada (Mudança Sistêmica):
                </label>
                <button type="button" class="btn-abrir-teclado ajuda-alvo" data-alvo-campo="meta_${familia.id_familia}" data-ajuda-titulo="Botão Teclado" data-ajuda-texto="Abre ou fecha o teclado para o campo de meta.">
                  Teclado
                </button>
              </div>
              <input type="text" id="meta_${familia.id_familia}" name="nova_meta" class="form-input ajuda-alvo" data-ajuda-titulo="Campo Nova Meta" data-ajuda-texto="Registre um compromisso conjunto com a família para o próximo passo de promoção humana." placeholder="Ex: Marcar consulta com cardiologista na terça..." inputmode="none" style="width: 100%; box-sizing: border-box; border-radius: 8px;">
            </div>

            <button type="submit" class="btn-submit ajuda-alvo" data-ajuda-titulo="Botão Salvar Visita" data-ajuda-texto="Grava imediatamente a visita na memória segura do celular (IndexedDB), mesmo sem conexão com a internet." style="background-color: #15803d; font-size: 0.88rem; padding: 0.75rem 1rem; border-radius: 10px;">
              💾 Salvar Visita no Celular (IndexedDB)
            </button>
          </form>
        </details>
      </article>
    `;
  }

  containerConteudo.innerHTML = html;

  // 1. Vincula cards de leitura interativos (Modo OUVIR - Azul SSVP)
  const cardsLeitura = containerConteudo.querySelectorAll('[data-leitura="true"]');
  cardsLeitura.forEach((card) => {
    const dispararSelecaoLeitura = () => {
      const textoCodificado = card.getAttribute('data-texto-leitura') || '';
      const texto = decodeURIComponent(textoCodificado) || card.textContent || '';
      definirElementoLeitura(/** @type {HTMLElement} */ (card), texto);
    };

    card.addEventListener('click', dispararSelecaoLeitura);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        dispararSelecaoLeitura();
      }
    });
  });

  // 2. Vincula botões de controle de teclado virtual [Teclado]
  const botoesTeclado = containerConteudo.querySelectorAll('.btn-abrir-teclado');
  botoesTeclado.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const idCampo = btn.getAttribute('data-alvo-campo') || '';
      const campo = document.getElementById(idCampo);
      if (campo && (campo instanceof HTMLInputElement || campo instanceof HTMLTextAreaElement)) {
        alternarTecladoVirtual(campo, /** @type {HTMLElement} */ (btn));
      }
    });
  });

  // 3. Vincula submissão dos formulários de nova visita
  const formsNovaVisita = containerConteudo.querySelectorAll('.form-nova-visita');
  formsNovaVisita.forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const idFamilia = form.getAttribute('data-id-familia') || '';
      const formData = new FormData(/** @type {HTMLFormElement} */ (form));
      const relato = String(formData.get('relato_visita') || '').trim();
      const auxilio = String(formData.get('auxilio_entregue') || '').trim();
      const meta = String(formData.get('nova_meta') || '').trim();

      if (!relato) {
        alert('Por favor, preencha ou dite o relato da visita.');
        return;
      }

      await registrarNovaVisitaLocal(idFamilia, relato, auxilio, meta);
      alert('🎉 Visita salva com sucesso no celular (IndexedDB)! Pronta para sincronização posterior.');
      await renderizarPainelPrincipal();
    });
  });

  // 4. Botão de recarregar cenário
  const btnRecarregar = document.getElementById('btnRecarregarCenario');
  if (btnRecarregar) {
    btnRecarregar.addEventListener('click', async () => {
      if (confirm('Deseja recarregar o cenário de teste inicial de 4 semanas?')) {
        await db.carregarCenarioTesteLocal();
        await renderizarPainelPrincipal();
      }
    });
  }
}

/**
 * Registra a nova visita no IndexedDB v3 e enfileira na fila de sincronização sob demanda.
 * @param {string} idFamilia
 * @param {string} relato
 * @param {string} auxilio
 * @param {string} novaMetaTexto
 * @return {Promise<void>}
 */
async function registrarNovaVisitaLocal(idFamilia, relato, auxilio, novaMetaTexto) {
  const agora = new Date();
  const dataHoje = agora.toISOString().split('T')[0];
  const horaAgora = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;

  const cfa = 'SPSDITIC';
  const todasVisitas = await db.obterTodos(db.STORES.VISITAS);
  const proximoSeq = String(todasVisitas.length + 1).padStart(4, '0');
  const idNovaVisita = `${cfa}VS${proximoSeq}`;

  const novaVisita = {
    id_visita: idNovaVisita,
    id_familia: idFamilia,
    data_visita: dataHoje,
    horario_inicio: horaAgora,
    horario_fim: '',
    tipo_visita: 'regular',
    relato_visita: relato,
    auxilio_entregue: auxilio,
    status_sincronizacao: 'pendente'
  };

  // 1. Persiste no store de visitas
  await db.salvarItem(db.STORES.VISITAS, novaVisita);

  // 2. Enfileira na fila de sincronização offline
  await db.enfileirarSincronizacao('visitas', 'INSERIR', novaVisita);

  // 3. Se houver nova meta, cadastra no plano de promoção
  if (novaMetaTexto) {
    const todasMetas = await db.obterTodos(db.STORES.PLANO_PROMOCAO);
    const seqMeta = String(todasMetas.length + 1).padStart(4, '0');
    const idNovaMeta = `${cfa}PL${seqMeta}`;

    const novaMetaObj = {
      id_meta: idNovaMeta,
      id_familia: idFamilia,
      id_pessoa: '',
      tipo_registro: 'meta',
      descricao: novaMetaTexto,
      prazo_estimado: '',
      status_meta: 'em_andamento',
      justificativa_obstaculo: '',
      solucao_combinada: '',
      data_conclusao: '',
      observacoes: `Pactuada na visita de ${formatarData(dataHoje)}`
    };

    await db.salvarItem(db.STORES.PLANO_PROMOCAO, novaMetaObj);
    await db.enfileirarSincronizacao('plano_promocao', 'INSERIR', novaMetaObj);
  }
}
