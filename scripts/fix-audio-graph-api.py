"""Fix audio download using Graph API 2-step method
Step 1: GET https://graph.facebook.com/v21.0/{media_id} -> returns {url}
Step 2: GET {url} with same auth -> downloads file

Both steps use WhatsApp API credentials (Bearer token)
Need to re-add download_audio node for step 2
"""
import json
import urllib.request
import urllib.error

from _env import N8N_API_KEY as API_KEY
WF_ID = 'azwM3PgGtSbGTCsn'
BASE = 'https://ecommercepuro.app.n8n.cloud/api/v1'

req = urllib.request.Request(f'{BASE}/workflows/{WF_ID}', headers={'X-N8N-API-KEY': API_KEY})
with urllib.request.urlopen(req) as resp:
    wf = json.loads(resp.read())

http_pos = None
for n in wf['nodes']:
    # Step 1: parametros extracts audio.id (not url)
    if n['name'] == 'parametros':
        assignments = n['parameters']['assignments']['assignments']
        for a in assignments:
            if a.get('name') == 'msg.audio':
                a['value'] = "={{ $('When Executed by Another Workflow').item.json.message.audio.id }}"
                print('[OK] parametros msg.audio -> audio.id')

    # Step 2: HTTP Request resolves media ID via Graph API (returns JSON with url field)
    if n['name'] == 'HTTP Request':
        http_pos = n.get('position', [0, 0])
        n['parameters'] = {
            'url': "={{ 'https://graph.facebook.com/v21.0/' + $('parametros').first().json.msg.audio }}",
            'authentication': 'predefinedCredentialType',
            'nodeCredentialType': 'whatsAppApi',
            'options': {
                'response': {
                    'response': {
                        'responseFormat': 'json'
                    }
                }
            }
        }
        n['credentials'] = {
            'whatsAppApi': {
                'id': 'nr456gATS6iXnlsx',
                'name': 'WhatsApp - Ecommerce Puro'
            }
        }
        print('[OK] HTTP Request -> Graph API resolve media ID (JSON response)')

# Step 3: Add download_audio node that downloads from the resolved URL
download_node = {
    'parameters': {
        'url': '={{ $json.url }}',
        'authentication': 'predefinedCredentialType',
        'nodeCredentialType': 'whatsAppApi',
        'options': {
            'response': {
                'response': {
                    'responseFormat': 'file',
                    'outputPropertyName': 'audio'
                }
            }
        }
    },
    'type': 'n8n-nodes-base.httpRequest',
    'typeVersion': 4.2,
    'position': [http_pos[0] + 300, http_pos[1]] if http_pos else [0, 0],
    'id': 'audio-download-v2',
    'name': 'download_audio',
    'credentials': {
        'whatsAppApi': {
            'id': 'nr456gATS6iXnlsx',
            'name': 'WhatsApp - Ecommerce Puro'
        }
    }
}

# Check if download_audio already exists (might have been removed)
existing = [n for n in wf['nodes'] if n['name'] == 'download_audio']
if existing:
    # Update existing
    for n in wf['nodes']:
        if n['name'] == 'download_audio':
            n['parameters'] = download_node['parameters']
            n['credentials'] = download_node['credentials']
    print('[OK] download_audio updated')
else:
    wf['nodes'].append(download_node)
    print('[OK] download_audio added')

# Reconnect: HTTP Request -> download_audio -> openAI_audio
conns = wf['connections']
if 'HTTP Request' in conns:
    for ot in conns['HTTP Request']:
        for i, out_list in enumerate(conns['HTTP Request'][ot]):
            new_list = []
            for c in out_list:
                if c.get('node') == 'openAI_audio':
                    new_list.append({'node': 'download_audio', 'type': 'main', 'index': 0})
                elif c.get('node') == 'download_audio':
                    new_list.append(c)  # already correct
                else:
                    new_list.append(c)
            conns['HTTP Request'][ot][i] = new_list
    print('[OK] HTTP Request -> download_audio')

conns['download_audio'] = {
    'main': [[{'node': 'openAI_audio', 'type': 'main', 'index': 0}]]
}
print('[OK] download_audio -> openAI_audio')

# PUT
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
        for n in result['nodes']:
            if n['name'] == 'HTTP Request':
                print(f'HTTP Request URL: {n["parameters"]["url"][:80]}')
                resp_fmt = n['parameters'].get('options',{}).get('response',{}).get('response',{}).get('responseFormat','?')
                print(f'HTTP Request response format: {resp_fmt}')
            if n['name'] == 'download_audio':
                print(f'download_audio URL: {n["parameters"]["url"]}')
                resp_fmt = n['parameters'].get('options',{}).get('response',{}).get('response',{}).get('responseFormat','?')
                print(f'download_audio response format: {resp_fmt}')

        rconns = result['connections']
        for src in ['HTTP Request', 'download_audio']:
            if src in rconns:
                for ot, outputs in rconns[src].items():
                    for out_list in outputs:
                        for c in out_list:
                            print(f'{src} -> {c.get("node")}')
        print('PUT OK')
except urllib.error.HTTPError as e:
    body = e.read().decode('utf-8', errors='replace')
    print(f'HTTP {e.code}: {body[:500]}')
