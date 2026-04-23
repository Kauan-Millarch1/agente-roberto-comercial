"""Fix audio field access — use dot notation for nested msg.audio"""
import json
import urllib.request
import urllib.error

from _env import N8N_API_KEY as API_KEY
WF_ID = 'azwM3PgGtSbGTCsn'
BASE = 'https://ecommercepuro.app.n8n.cloud/api/v1'

req = urllib.request.Request(f'{BASE}/workflows/{WF_ID}', headers={'X-N8N-API-KEY': API_KEY})
with urllib.request.urlopen(req) as resp:
    wf = json.loads(resp.read())

for n in wf['nodes']:
    # Fix HTTP Request — resolve media ID
    if n['name'] == 'HTTP Request':
        params = n['parameters']
        url = params.get('url', '')
        if 'msg.audio' in url or 'msg' in url:
            # Use dot notation: $json.msg.audio works for nested objects
            params['url'] = "={{ 'https://graph.facebook.com/v21.0/' + $('parametros').first().json.msg.audio }}"
            print(f'[OK] HTTP Request URL fixed to dot notation')

    # Fix Edit Fields3
    if n['name'] == 'Edit Fields3':
        assignments = n['parameters'].get('assignments', {}).get('assignments', [])
        for a in assignments:
            if a.get('name') == 'audio':
                a['value'] = "={{ $('parametros').first().json.msg.audio }}"
                print(f'[OK] Edit Fields3 audio fixed to dot notation')

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
                print(f'HTTP Request URL: {n["parameters"]["url"]}')
            if n['name'] == 'Edit Fields3':
                for a in n['parameters'].get('assignments', {}).get('assignments', []):
                    if a.get('name') == 'audio':
                        print(f'Edit Fields3 audio: {a["value"]}')
        print('PUT OK')
except urllib.error.HTTPError as e:
    body = e.read().decode('utf-8', errors='replace')
    print(f'HTTP {e.code}: {body[:500]}')
