// Build DYNAMIC context v2.0 - final
// REGRA: $() SEMPRE com string literal, NUNCA com variavel

let hasTag = false;
let leadPhone = '';

try {
  const p = $('parametros').first().json;
  hasTag = p.has_event_tag || false;
  leadPhone = p['contato-wpp'] || '';
} catch (e) {}

// Event detail - static refs only
let knowledgeBase = '';
let offers = [];
let eventDetail = null;

function processEvent(raw) {
  if (!raw) return;
  const d = raw.event_detail || raw.data || raw;
  if (d && (d.knowledge_base || d.nome || d.name)) {
    eventDetail = d;
    knowledgeBase = d.knowledge_base || d.richDescription || d.description || '';
    let ol = d.offers || [];
    if (!Array.isArray(ol) && d.tiers && Array.isArray(d.tiers)) {
      ol = [];
      for (const t of d.tiers) {
        if (t.offers && Array.isArray(t.offers)) {
          for (const o of t.offers) ol.push(o);
        }
      }
    }
    offers = Array.isArray(ol) ? ol : [];
  }
}

try { if (!eventDetail) processEvent($('parse_cache_evento').first().json); } catch (e) {}
try { if (!eventDetail) processEvent($('redis_set_evento_detalhe').first().json); } catch (e) {}
try { if (!eventDetail) processEvent($('api_get_evento_detalhe').first().json); } catch (e) {}

// Events list - static refs only
let eventsList = [];
try {
  const raw = $('parse_cache_lista').first().json;
  if (raw) { const arr = raw.events_list || raw.events || raw.data || []; eventsList = Array.isArray(arr) ? arr : []; }
} catch (e) {}
if (eventsList.length === 0) {
  try {
    const raw = $('redis_set_eventos_lista').first().json;
    if (raw) { const arr = raw.events_list || raw.events || raw.data || []; eventsList = Array.isArray(arr) ? arr : []; }
  } catch (e) {}
}
if (eventsList.length === 0) {
  try {
    const raw = $('api_get_eventos_lista').first().json;
    if (raw) { const arr = raw.events_list || raw.events || raw.data || []; eventsList = Array.isArray(arr) ? arr : []; }
  } catch (e) {}
}

// Conversation summary
let conversationSummary = null;
try {
  const s = $('parse_conv_summary').first().json;
  if (s && s.conversation_summary) conversationSummary = s.conversation_summary;
} catch (e) {}

// Temperament
let temperamento = null;
try {
  temperamento = $('Redis_GET_temperamento').first().json.propertyName || null;
} catch (e) {}
if (temperamento === 'None' || temperamento === 'null') temperamento = null;

// Message count
let msgCount = 0;
try {
  msgCount = Number($('Redis_INCR_msg_count').first().json.value || 0);
} catch (e) {}

// Temperamento instruction
let instrucaoTemp = '';
try { instrucaoTemp = $('Code_verifica_temperamento').first().json.instrucao_temperamento || ''; } catch (e) {}

// ================================================================
// BUILD CONTEXT
// ================================================================
let ctx = '';

if (instrucaoTemp) {
  ctx += '## ACAO IMEDIATA OBRIGATORIA\nChame a tool temperamento_comportamental passando o historico. Faca AGORA.\n\n';
}

if (conversationSummary) {
  const cs = conversationSummary;
  ctx += '\n\n---\n\n## Contexto da Conversa\n';
  ctx += 'Lead: ' + (cs.lead_name || 'desconhecido') + '\n';
  ctx += 'Evento: ' + (cs.event_interest || 'indefinido') + '\n';
  ctx += 'Estagio: ' + (cs.stage || 'discovery') + '\n';
  if (cs.key_facts) ctx += 'Dados: ' + cs.key_facts + '\n';
  if (cs.objections_raised && cs.objections_raised.length) {
    ctx += 'Objecoes: ' + cs.objections_raised.join(', ') + '\n';
  }
  if (cs.arguments_used && cs.arguments_used.length) {
    ctx += 'Argumentos usados: ' + cs.arguments_used.join(', ') + '\n';
  }
  ctx += 'Interesse: ' + (cs.interest_level || 'indefinido') + '\n';
  ctx += 'Proxima acao: ' + (cs.next_action || 'nenhuma') + '\n';
  ctx += 'Msgs anteriores: ' + (cs.interaction_count || 0) + '\n';
  ctx += '\nRetome de onde parou. NAO repita argumentos. NAO peca info que ja tem.\n';
}

ctx += '\n\n---\n\n## Instrucoes Adaptativas\n';

const stage = conversationSummary ? conversationSummary.stage : 'discovery';
const interest = conversationSummary ? conversationSummary.interest_level : 'indefinido';

if (!stage || stage === 'discovery' || stage === 'opening') {
  ctx += 'MOMENTO: Descoberta. Voce nao sabe o que o lead quer.\n';
  ctx += 'TOM: Leve, curioso, acolhedor.\n';
  ctx += 'ACAO: Faca UMA pergunta para entender o interesse. Texto curto.\n';
} else if (stage === 'sounding' || stage === 'qualification') {
  ctx += 'MOMENTO: Sondagem. Entendendo o perfil do lead.\n';
  ctx += 'TOM: Consultivo. Escute mais que fala.\n';
  ctx += 'ACAO: Perguntas abertas sobre o negocio dele.\n';
} else if (stage === 'presentation' || stage === 'event_presentation') {
  ctx += 'MOMENTO: Apresentacao do evento.\n';
  ctx += 'TOM: Entusiasmado mas genuino.\n';
  ctx += 'ACAO: USE AUDIO. Apresente com energia e dados reais.\n';
} else if (stage === 'offer' || stage === 'offer_sent') {
  ctx += 'MOMENTO: Oferta. Lead pronto para ver preco.\n';
  ctx += 'ACAO: Seja direto. Mande preco e link. Sem hesitacao.\n';
} else if (stage === 'objection' || stage === 'negotiation') {
  ctx += 'MOMENTO: Objecao. Lead tem duvidas.\n';
  ctx += 'ACAO: Valide a preocupacao, reframe com argumento NOVO. Audio para objecoes fortes.\n';
} else if (stage === 'closing') {
  ctx += 'MOMENTO: Fechamento.\n';
  ctx += 'ACAO: Tire friccao. Facilite. Um empurrao sutil.\n';
}

if (temperamento) {
  ctx += '\nPerfil: ' + temperamento + '\n';
  if (temperamento === 'tubarao') ctx += 'ADAPTACAO: Direto, sem enrolacao. Resultados e ROI.\n';
  else if (temperamento === 'aguia') ctx += 'ADAPTACAO: Dados e detalhes. Preciso.\n';
  else if (temperamento === 'lobo') ctx += 'ADAPTACAO: Networking e comunidade.\n';
  else if (temperamento === 'gato') ctx += 'ADAPTACAO: Paciencia. Seguranca.\n';
}

if (msgCount <= 2) ctx += '\nConversa no inicio (' + msgCount + ' msgs). Nao apresse.\n';
else if (msgCount >= 15) ctx += '\nConversa longa (' + msgCount + ' msgs). Considere escalar para closer.\n';

if (interest === 'alto' || interest === 'high') ctx += 'INTERESSE ALTO: Avance para oferta.\n';
else if (interest === 'baixo' || interest === 'low') ctx += 'INTERESSE BAIXO: Nao force.\n';

// Operating mode
if (!hasTag && conversationSummary && conversationSummary.event_id) {
  ctx += '\n\n## Modo\nLead ja mostrou interesse em ' + conversationSummary.event_interest + '. Retome.\n';
} else if (hasTag && knowledgeBase) {
  ctx += '\n\n## Modo\nEvento definido. Foco em vender.\n';
  ctx += '\n## Evento\n' + knowledgeBase + '\n';
  if (offers.length > 0) {
    ctx += '\n## Ofertas\n';
    for (const o of offers) {
      const name = o.nome || o.name || 'Oferta';
      try { if (name.match(/\[(OrderBump|Upsell|Downsell)\]/i)) continue; } catch (e) {}
      let line = '- ' + name;
      const rawPrice = o.preco || o.price;
      if (rawPrice) {
        const p = Number(rawPrice);
        line += ': R$ ' + (isNaN(p) ? String(rawPrice) : p.toLocaleString('pt-BR'));
      }
      if (o.link || o.payment_url || o.checkoutUrl) {
        const url = o.link || o.payment_url || o.checkoutUrl;
        line += ' - Link: ' + url + '?utm_source=whatsapp&utm_medium=dm&utm_campaign=agent-sales&utm_content=roberto';
      }
      ctx += line + '\n';
    }
  }
  if (offers.length > 0) {
    try {
      const mainOffer = offers.find(function(o) {
        const n = o.nome || o.name || '';
        try { return !n.match(/\[(OrderBump|Upsell|Downsell)\]/i); } catch (e) { return true; }
      });
      if (mainOffer) {
        const fullPrice = Number(mainOffer.preco || mainOffer.price);
        if (!isNaN(fullPrice) && fullPrice > 0) {
          ctx += '\n## Faixas de Desconto (ULTIMO RECURSO)\n';
          if (fullPrice >= 15000) ctx += 'Preco cheio: R$ 15.000 | Maximo: R$ 10.000 (PIX ou 6x)\n';
          else if (fullPrice >= 7500) ctx += 'Preco cheio: R$ 7.500 | Nivel 1: R$ 7.000 | Nivel 2: R$ 6.000 | Maximo: R$ 5.000 (PIX ou 6x)\n';
          else if (fullPrice >= 6000) ctx += 'Preco cheio: R$ 6.000 | Maximo: R$ 5.000 (PIX ou 6x)\n';
          else if (fullPrice >= 5000) ctx += 'Preco cheio: R$ 5.000 | Maximo: R$ 4.000 (PIX ou 6x)\n';
          else if (fullPrice >= 3000) ctx += 'Preco cheio: R$ 3.000 | Maximo: R$ 2.000 (PIX ou 6x)\n';
          ctx += 'REGRA: Venda pelo cheio PRIMEIRO. Desconto so apos esgotar argumentos de valor.\n';
        }
      }
    } catch (e) {}
  }
} else {
  ctx += '\n\n## Modo\nDiscovery. Use buscar_evento quando identificar o interesse.\n';
}

if (eventsList.length > 0) {
  ctx += '\n## Eventos Ativos\n';
  for (const ev of eventsList) {
    let line = '- ' + (ev.nome || ev.name || 'Evento');
    const startRaw = ev.startAt || ev.data || ev.date;
    const endRaw = ev.endAt;
    if (startRaw) {
      try {
        const dtStart = new Date(startRaw);
        if (!isNaN(dtStart.getTime())) {
          line += ' (' + dtStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ')';
          if (endRaw) {
            const dtEnd = new Date(endRaw);
            if (!isNaN(dtEnd.getTime())) {
              const startDay = new Date(dtStart.getFullYear(), dtStart.getMonth(), dtStart.getDate());
              const endDay = new Date(dtEnd.getFullYear(), dtEnd.getMonth(), dtEnd.getDate());
              // If endAt is midnight (00:00), the last real day is the previous day
              if (dtEnd.getHours() === 0 && dtEnd.getMinutes() === 0) {
                endDay.setDate(endDay.getDate() - 1);
              }
              const diffDays = Math.round((endDay - startDay) / (1000 * 60 * 60 * 24)) + 1;
              if (diffDays === 1) {
                line += ' [1 dia]';
              } else if (diffDays > 1) {
                line += ' [' + diffDays + ' dias]';
              }
            }
          }
        }
      } catch (e) {}
    }
    if (ev.id) line += ' [ID: ' + ev.id + ']';
    ctx += line + '\n';
  }
} else {
  ctx += '\n## Eventos Ativos\nNenhum evento ativo.\n';
}

ctx += '\n\n## Memoria\nUse salvar_resumo ao final. Inclua: stage, dados, interesse, objecoes, argumentos, proxima acao.\n';

if (leadPhone) ctx += '\n## Tecnico\nTelefone: ' + leadPhone + '\n';

// TONE REINFORCEMENT
ctx += '\n\n---\n\n## LEMBRETE FINAL DE VOZ\n';
ctx += 'Você é o Roberto, 32 anos, mineiro de BH. Consultor comercial no WhatsApp.\n';
ctx += 'REGRAS:\n';
ctx += '- SEMPRE comece cada mensagem com letra MAIÚSCULA\n';
ctx += '- NUNCA comece com validação vazia ("Que ótimo!", "Entendido!", "Caramba!", "Parabéns!")\n';
ctx += '- Cada msg max 120 chars. Total > 200 chars = acionar_audio: true. Abaixo de 200, texto.\n';
ctx += '- NUNCA prometa algo que não pode fazer (email, ligação, lembrete)\n';
ctx += '- NUNCA use abreviações: escreva "você" (não "vc"/"ce"), "para" (não "pra"), "está" (não "ta"), "tudo" (não "td"), "muito" (não "mto")\n';
ctx += '- NUNCA use "kkk", "kk", "mano", "cara", "trem", "uai"\n';
ctx += '- NUNCA use investimento para falar de preço\n';
ctx += '- ACENTUAÇÃO OBRIGATÓRIA: "você", "não", "está", "preço", "anúncio", "também", "condição". Texto sem acento = parece IA.\n';
ctx += '- DATAS: NUNCA diga o ano. "dia 8 e 9 de abril", NÃO "8 e 9 de abril de 2026"\n';
ctx += '- ÁUDIO: quando acionar_audio=true, escreva o CONTEÚDO COMPLETO em messages[]. O workflow converte para voz. NUNCA escreva "vou te mandar um áudio" — escreva direto o que seria falado.\n';
ctx += '- DESPEDIDA: lead disse "beleza/ok/valeu/tchau/falou/obrigado"? UMA bolha curta de tchau e PARE. NUNCA "qualquer coisa me chama". Se lead responder de novo com palavra de fechamento → NÃO RESPONDA, conversa acabou.\n';
ctx += '- DESCONTO: UM preço por turno. NUNCA mostre múltiplos preços de uma vez (parece tabela). Espere resposta antes de baixar. Feche com "PIX ou 6x?", NUNCA "ou prefere deixar pra próxima turma?".\n';
ctx += '- LINK COM DESCONTO: SEMPRE adicione ?coupon=CODIGO na URL do checkout. Sem cupom = lead paga cheio. Consulte a tabela de cupons no system prompt.\n';
ctx += '- NUNCA PROMETA SEM ENTREGAR: se disser "vou te mandar o link", o link TEM que estar nas messages[] do MESMO turno. Nunca "vou ajustar e te mando" sem mandar.\n';

const stageEx = stage || 'discovery';
ctx += '\nEXEMPLO de tom:\n';
if (stageEx === 'discovery' || stageEx === 'opening') {
  ctx += 'Lead: "oi" -> Roberto: ["Opa, tudo bem e você?", "Me conta, viu algum evento nosso que te interessou?"]\n';
} else if (stageEx === 'sounding' || stageEx === 'qualification') {
  ctx += 'Lead: "tenho loja no ML" -> Roberto: ["ML está bombando mesmo", "Você já foi em evento de ecommerce?"]\n';
} else if (stageEx === 'presentation' || stageEx === 'event_presentation') {
  ctx += 'Lead: "me conta mais" -> Roberto: ["A imersão é dia X em SP, dois dias intensos com fulano e ciclano, foco em Y e Z..."] + acionar_audio: true (conteúdo completo, NÃO anúncio)\n';
} else if (stageEx === 'offer' || stageEx === 'offer_sent') {
  ctx += 'Lead: "quanto custa?" -> Roberto: ["Está R$ X", "Quer que eu mande o link?"]\n';
} else if (stageEx === 'objection' || stageEx === 'negotiation') {
  ctx += 'Lead: "tá caro" -> Roberto: ["É, não é barato mesmo, mas olha só o que você leva: dois dias com os maiores players do mercado, acesso a estratégias que já geraram X para quem aplicou..."] + acionar_audio: true (conteúdo com argumento real)\n';
} else if (stageEx === 'closing') {
  ctx += 'Lead: "vou pensar" -> Roberto: ["De boa", "As vagas acabam rápido para esse"]\n';
}

return [{ json: { dynamic_context: ctx } }];
