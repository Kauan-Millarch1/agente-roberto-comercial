"""Final fix: bypass parametros for audio — extract audio.id directly in Edit Fields3"""
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
    # Fix Edit Fields3: extract audio.id directly from the trigger, bypass parametros
    if n['name'] == 'Edit Fields3':
        n['parameters']['assignments']['assignments'] = [
            {
                'id': 'audio-id-fix',
                'name': 'audio_id',
                'value': "={{ $('When Executed by Another Workflow').first().json.message.audio.id }}",
                'type': 'string'
            }
        ]
        print('[OK] Edit Fields3 -> extracts audio.id directly from trigger')

    # Fix HTTP Request: use audio_id from Edit Fields3 (not parametros)
    if n['name'] == 'HTTP Request':
        params = n['parameters']
        url = params.get('url', '')
        if 'msg.audio' in url or 'graph.facebook' in url:
            params['url'] = "={{ 'https://graph.facebook.com/v21.0/' + $json.audio_id }}"
            print('[OK] HTTP Request URL -> $json.audio_id from Edit Fields3')

    # Fix download_audio: use url field from Graph API response
    if n['name'] == 'download_audio':
        n['parameters']['url'] = '={{ $json.url }}'
        print('[OK] download_audio URL -> $json.url')

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
            if n['name'] == 'Edit Fields3':
                for a in n['parameters']['assignments']['assignments']:
                    print(f'Edit Fields3: {a["name"]} = {a["value"][:80]}')
            if n['name'] == 'HTTP Request':
                p = n['parameters']
                if 'audio_id' in p.get('url', '') or 'graph.facebook' in p.get('url', ''):
                    print(f'HTTP Request URL: {p["url"][:80]}')
            if n['name'] == 'download_audio':
                print(f'download_audio URL: {n["parameters"]["url"]}')
        print('PUT OK')
except urllib.error.HTTPError as e:
    body = e.read().decode('utf-8', errors='replace')
    print(f'HTTP {e.code}: {body[:500]}')
