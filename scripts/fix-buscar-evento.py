"""Fix [ROBERTO] Tool — Buscar Evento workflow
- Fix input_evento references -> When Executed by Another Workflow
- Fix api_buscar_evento to list events then fetch detail by name
- Fix redis keys to use nome_evento from trigger
"""
import json
import urllib.request

import os
from _env import N8N_API_KEY as API_KEY
WF_ID = 'vnbtZQMsUl76h5p1'
BASE = 'https://ecommercepuro.app.n8n.cloud/api/v1'
TRIGGER = 'When Executed by Another Workflow'
EPK = os.environ.get('ECOMMERCE_PURO_API_KEY', '').strip()
if not EPK:
    raise SystemExit('Set ECOMMERCE_PURO_API_KEY in .env before running this script.')

# GET
req = urllib.request.Request(f'{BASE}/workflows/{WF_ID}', headers={'X-N8N-API-KEY': API_KEY})
with urllib.request.urlopen(req) as resp:
    wf = json.loads(resp.read())

for n in wf['nodes']:
    name = n['name']

    if name == 'api_buscar_evento':
        # Change to list endpoint (we filter by name in formatar_api_evento)
        n['parameters']['url'] = 'https://admin.ecommercepuro.com.br/api/events?status=ACTIVE&limit=20'
        print(f'[OK] api_buscar_evento -> list endpoint')

    if name == 'redis_get_evento':
        n['parameters']['key'] = "={{ 'roberto:events:' + $json.nome_evento + ':detail' }}"
        print(f'[OK] redis_get_evento key -> $json.nome_evento')

    if name == 'redis_set_evento':
        n['parameters']['key'] = "={{ 'roberto:events:' + $('" + TRIGGER + "').first().json.nome_evento + ':detail' }}"
        print(f'[OK] redis_set_evento key -> trigger.nome_evento')

    if name == 'formatar_api_evento':
        _js_template = """// Find event by name from list API, then fetch detail via $http
const nomeEvento = $('When Executed by Another Workflow').first().json.nome_evento || '';
const apiResponse = $input.first().json;
const events = apiResponse.data || apiResponse.events || [];

// Normalize for fuzzy match
const normalize = (s) => s.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^a-z0-9 ]/g, '').trim();
const query = normalize(nomeEvento);

let matched = events.find(e => normalize(e.name || '').includes(query) || query.includes(normalize(e.name || '')));

if (!matched) {
  const words = query.split(/\\s+/).filter(w => w.length > 3);
  matched = events.find(e => {
    const eName = normalize(e.name || '');
    return words.some(w => eName.includes(w));
  });
}

if (!matched) {
  return [{ json: { error: 'Evento nao encontrado: ' + nomeEvento, eventos_disponiveis: events.map(e => e.name) } }];
}

// Fetch detail using N8N helpers
const eventId = matched.id;
const detail = await this.helpers.httpRequest({
  method: 'GET',
  url: 'https://admin.ecommercepuro.com.br/api/events/' + eventId,
  headers: { 'Authorization': 'Bearer ' + __EPK__ },
  json: true
});

if (detail.success && detail.data) {
  const d = detail.data;
  const offers = (d.tiers || []).flatMap(t =>
    (t.offers || []).filter(o => !(o.name || '').match(/\\[(OrderBump|Upsell|Downsell)\\]/i))
  );

  return [{ json: {
    event_id: d.id,
    nome: d.name,
    slug: d.slug,
    data_inicio: d.startAt,
    data_fim: d.endAt,
    timezone: d.timezone,
    status: d.status,
    imagem: d.imageUrl,
    knowledge_base: d.richDescription || d.description || '',
    offers: offers.map(o => ({
      name: o.name,
      price: o.price,
      checkoutUrl: o.checkoutUrl + '?utm_source=whatsapp&utm_medium=dm&utm_campaign=agent-sales&utm_content=roberto'
    }))
  }}];
}

return [{ json: { error: 'Falha ao buscar detalhes do evento ' + eventId } }];
"""
        # Inject EPK from env var into the JS template as a JS string literal
        n['parameters']['jsCode'] = _js_template.replace('__EPK__', repr(EPK).replace('"', '\\"'))
        print(f'[OK] formatar_api_evento -> name lookup + detail fetch')

# PUT
# Only include known valid settings fields
raw_settings = wf.get('settings', {})
valid_keys = ['executionOrder', 'saveManualExecutions', 'callerPolicy', 'callerIds', 'errorWorkflow', 'timezone', 'saveExecutionProgress']
clean_settings = {k: v for k, v in raw_settings.items() if k in valid_keys}

payload = json.dumps({
    'name': wf['name'],
    'nodes': wf['nodes'],
    'connections': wf['connections'],
    'settings': clean_settings,
}).encode()

put_req = urllib.request.Request(
    f'{BASE}/workflows/{WF_ID}',
    data=payload,
    headers={'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json'},
    method='PUT'
)
with urllib.request.urlopen(put_req) as resp:
    result = json.loads(resp.read())
    print('PUT OK')

    # Verify
    for n in result['nodes']:
        if n['name'] == 'api_buscar_evento':
            url = n['parameters']['url']
            print(f'  api_buscar_evento URL: {url[:80]}')
        if n['name'] == 'formatar_api_evento':
            code = n['parameters']['jsCode']
            print(f'  formatar_api_evento: {len(code)} chars, has fetch: {"await fetch" in code}')
        if n['name'] == 'redis_get_evento':
            print(f'  redis_get_evento key: {n["parameters"]["key"]}')
