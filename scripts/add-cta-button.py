"""Add CTA button flow to Roberto workflow
- Add preparar_mensagem Code node
- Add tipo_envio Switch node
- Add enviar_botao_cta HTTP Request node
- Reconnect: selecionar_mensagem -> preparar_mensagem -> tipo_envio -> (CTA or text) -> Merge1
"""
import json
import urllib.request
import urllib.error
import copy

from _env import N8N_API_KEY as API_KEY
WF_ID = 'azwM3PgGtSbGTCsn'
BASE = 'https://ecommercepuro.app.n8n.cloud/api/v1'

# GET
req = urllib.request.Request(f'{BASE}/workflows/{WF_ID}', headers={'X-N8N-API-KEY': API_KEY})
with urllib.request.urlopen(req) as resp:
    wf = json.loads(resp.read())

# Save backup
with open('scripts/roberto-backup-before-cta.json', 'w') as f:
    json.dump(wf, f)
print('[OK] Backup saved')

# Find position of selecionar_mensagem to place new nodes nearby
sel_pos = None
send_pos = None
for n in wf['nodes']:
    if n['name'] == 'selecionar_mensagem':
        sel_pos = n.get('position', [0, 0])
    if n['name'] == 'Send message and wait for response':
        send_pos = n.get('position', [0, 0])

print(f'selecionar_mensagem position: {sel_pos}')
print(f'Send message position: {send_pos}')

# === ADD NEW NODES ===

# 1. preparar_mensagem (Code node)
preparar_code = """const msg = $json.mensagem_atual || '';
const phone = $('parametros').first().json['contato-wpp'];

// Detecta link de checkout
const checkoutMatch = msg.match(/(https:\\/\\/checkout\\.ecommercepuro\\.com\\.br\\/pay\\/[^\\s]+)/);

if (checkoutMatch) {
  const url = checkoutMatch[1];
  const textBody = msg.replace(url, '').replace(/\\s+/g, ' ').trim();

  return [{
    json: {
      ...$json,
      tipo_envio: 'botao_cta',
      phone: phone,
      textBody: textBody || 'Aqui o link pra garantir sua vaga',
      checkoutUrl: url
    }
  }];
}

return [{
  json: {
    ...$json,
    tipo_envio: 'texto_normal',
    phone: phone
  }
}];"""

node_preparar = {
    "parameters": {"jsCode": preparar_code},
    "type": "n8n-nodes-base.code",
    "typeVersion": 2,
    "position": [sel_pos[0] + 300, sel_pos[1]],
    "id": "cta-preparar-001",
    "name": "preparar_mensagem"
}

# 2. tipo_envio (Switch node)
node_switch = {
    "parameters": {
        "rules": {
            "values": [
                {
                    "conditions": {
                        "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
                        "conditions": [
                            {
                                "leftValue": "={{ $json.tipo_envio }}",
                                "rightValue": "botao_cta",
                                "operator": {"type": "string", "operation": "equals"}
                            }
                        ],
                        "combinator": "and"
                    },
                    "renameOutput": True,
                    "outputKey": "botao_cta"
                },
                {
                    "conditions": {
                        "options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict", "version": 2},
                        "conditions": [
                            {
                                "leftValue": "={{ $json.tipo_envio }}",
                                "rightValue": "texto_normal",
                                "operator": {"type": "string", "operation": "equals"}
                            }
                        ],
                        "combinator": "and"
                    },
                    "renameOutput": True,
                    "outputKey": "texto_normal"
                }
            ]
        },
        "options": {}
    },
    "type": "n8n-nodes-base.switch",
    "typeVersion": 3.2,
    "position": [sel_pos[0] + 600, sel_pos[1]],
    "id": "cta-switch-001",
    "name": "tipo_envio"
}

# 3. enviar_botao_cta (HTTP Request)
node_cta = {
    "parameters": {
        "method": "POST",
        "url": "=https://graph.facebook.com/v21.0/1049018671622779/messages",
        "authentication": "predefinedCredentialType",
        "nodeCredentialType": "whatsAppApi",
        "sendBody": True,
        "specifyBody": "json",
        "jsonBody": """={
  "messaging_product": "whatsapp",
  "to": "{{ $json.phone }}",
  "type": "interactive",
  "interactive": {
    "type": "cta_url",
    "body": {
      "text": "{{ $json.textBody }}"
    },
    "action": {
      "name": "cta_url",
      "parameters": {
        "display_text": "Garantir minha vaga",
        "url": "{{ $json.checkoutUrl }}"
      }
    }
  }
}""",
        "options": {}
    },
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.2,
    "position": [sel_pos[0] + 900, sel_pos[1] - 150],
    "id": "cta-http-001",
    "name": "enviar_botao_cta"
}

# Add new nodes
wf['nodes'].append(node_preparar)
wf['nodes'].append(node_switch)
wf['nodes'].append(node_cta)
print('[OK] 3 nodes added')

# === RECONNECT ===
conns = wf['connections']

# Current: selecionar_mensagem -> Send message and wait for response
# New: selecionar_mensagem -> preparar_mensagem -> tipo_envio -> (CTA -> Merge1) / (texto -> Send message -> Merge1)

# 1. selecionar_mensagem -> preparar_mensagem (instead of Send message)
if 'selecionar_mensagem' in conns:
    old_conns = conns['selecionar_mensagem']
    # Replace the connection to Send message with preparar_mensagem
    for output_type in old_conns:
        for i, out_list in enumerate(old_conns[output_type]):
            new_list = []
            for conn in out_list:
                if conn.get('node') == 'Send message and wait for response':
                    new_list.append({"node": "preparar_mensagem", "type": "main", "index": 0})
                else:
                    new_list.append(conn)
            old_conns[output_type][i] = new_list
    print('[OK] selecionar_mensagem -> preparar_mensagem')

# 2. preparar_mensagem -> tipo_envio
conns['preparar_mensagem'] = {
    "main": [[{"node": "tipo_envio", "type": "main", "index": 0}]]
}
print('[OK] preparar_mensagem -> tipo_envio')

# 3. tipo_envio output 0 (botao_cta) -> enviar_botao_cta
# 3. tipo_envio output 1 (texto_normal) -> Send message and wait for response
conns['tipo_envio'] = {
    "main": [
        [{"node": "enviar_botao_cta", "type": "main", "index": 0}],
        [{"node": "Send message and wait for response", "type": "main", "index": 0}]
    ]
}
print('[OK] tipo_envio -> enviar_botao_cta / Send message')

# 4. enviar_botao_cta -> Merge1 (same destination as Send message)
conns['enviar_botao_cta'] = {
    "main": [[{"node": "Merge1", "type": "main", "index": 0}]]
}
print('[OK] enviar_botao_cta -> Merge1')

# === PUT ===
raw_settings = wf.get('settings', {})
valid_keys = ['executionOrder', 'saveManualExecutions', 'callerPolicy', 'callerIds', 'errorWorkflow', 'timezone', 'saveExecutionProgress']
clean_settings = {k: v for k, v in raw_settings.items() if k in valid_keys}

payload = json.dumps({
    'name': wf['name'],
    'nodes': wf['nodes'],
    'connections': wf['connections'],
    'settings': clean_settings,
}).encode()

try:
    put_req = urllib.request.Request(
        f'{BASE}/workflows/{WF_ID}',
        data=payload,
        headers={'X-N8N-API-KEY': API_KEY, 'Content-Type': 'application/json'},
        method='PUT'
    )
    with urllib.request.urlopen(put_req) as resp:
        result = json.loads(resp.read())
        # Verify
        node_names = [n['name'] for n in result['nodes']]
        print(f'preparar_mensagem exists: {"preparar_mensagem" in node_names}')
        print(f'tipo_envio exists: {"tipo_envio" in node_names}')
        print(f'enviar_botao_cta exists: {"enviar_botao_cta" in node_names}')

        rconns = result['connections']
        print(f'preparar_mensagem connected: {"preparar_mensagem" in rconns}')
        print(f'tipo_envio connected: {"tipo_envio" in rconns}')
        print(f'enviar_botao_cta connected: {"enviar_botao_cta" in rconns}')
        print('PUT OK')
except urllib.error.HTTPError as e:
    body = e.read().decode('utf-8', errors='replace')
    print(f'HTTP {e.code}: {body[:500]}')
