"""Fix audio download flow in Roberto workflow
- parametros: extract audio.id instead of audio.url
- HTTP Request: call Graph API to get download URL from audio.id, then download
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

for n in wf['nodes']:
    # Fix 1: parametros — change msg.audio to extract audio.id
    if n['name'] == 'parametros':
        assignments = n['parameters']['assignments']['assignments']
        for a in assignments:
            if a.get('name') == 'msg.audio':
                old = a['value']
                # Change from audio.url to audio.id
                a['value'] = "={{ $('When Executed by Another Workflow').item.json.message.audio.id }}"
                print(f'[OK] parametros msg.audio: url -> id')

    # Fix 2: HTTP Request — change URL to Graph API media endpoint
    # Step 1: First call gets the download URL from the media ID
    # The current HTTP Request downloads the file directly
    # We need to change it to: https://graph.facebook.com/v21.0/{media_id}
    # This returns {url: "https://..."} and then we download from that URL
    if n['name'] == 'HTTP Request':
        params = n['parameters']
        old_url = params.get('url', '')
        if 'msg.audio' in old_url or 'parametros' in old_url:
            # Change to Graph API media endpoint to resolve the media ID
            params['url'] = "={{ 'https://graph.facebook.com/v21.0/' + $('parametros').first().json['msg.audio'] }}"
            # Keep authentication (WhatsApp API credentials)
            # Change response format to JSON (not file) — we need the download URL first
            params['options'] = {
                "response": {
                    "response": {
                        "responseFormat": "json"
                    }
                }
            }
            print(f'[OK] HTTP Request: resolve media ID via Graph API')

# Now we need to add a second HTTP Request to actually download the audio file
# Find position of current HTTP Request
http_pos = None
for n in wf['nodes']:
    if n['name'] == 'HTTP Request':
        http_pos = n.get('position', [0, 0])

# Add new node: download_audio (actual file download)
download_node = {
    "parameters": {
        "url": "={{ $json.url }}",
        "authentication": "predefinedCredentialType",
        "nodeCredentialType": "whatsAppApi",
        "options": {
            "response": {
                "response": {
                    "responseFormat": "file",
                    "outputPropertyName": "audio"
                }
            }
        }
    },
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.2,
    "position": [http_pos[0] + 300, http_pos[1]] if http_pos else [0, 0],
    "id": "audio-download-001",
    "name": "download_audio",
    "credentials": {
        "whatsAppApi": {
            "id": "nr456gATS6iXnlsx",
            "name": "WhatsApp - Ecommerce Puro"
        }
    }
}

wf['nodes'].append(download_node)
print(f'[OK] Added download_audio node')

# Reconnect:
# Old: HTTP Request -> openAI_audio
# New: HTTP Request (resolve ID) -> download_audio -> openAI_audio
conns = wf['connections']

# Change HTTP Request to point to download_audio instead of openAI_audio
if 'HTTP Request' in conns:
    for ot in conns['HTTP Request']:
        for i, out_list in enumerate(conns['HTTP Request'][ot]):
            new_list = []
            for c in out_list:
                if c.get('node') == 'openAI_audio':
                    new_list.append({"node": "download_audio", "type": "main", "index": 0})
                else:
                    new_list.append(c)
            conns['HTTP Request'][ot][i] = new_list
    print('[OK] HTTP Request -> download_audio')

# download_audio -> openAI_audio
conns['download_audio'] = {
    "main": [[{"node": "openAI_audio", "type": "main", "index": 0}]]
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
        node_names = [n['name'] for n in result['nodes']]
        print(f'download_audio exists: {"download_audio" in node_names}')
        rconns = result['connections']
        print(f'download_audio connected: {"download_audio" in rconns}')

        # Verify HTTP Request URL
        for n in result['nodes']:
            if n['name'] == 'HTTP Request':
                print(f'HTTP Request URL: {n["parameters"]["url"][:80]}')
            if n['name'] == 'download_audio':
                print(f'download_audio URL: {n["parameters"]["url"]}')
        print('PUT OK')
except urllib.error.HTTPError as e:
    body = e.read().decode('utf-8', errors='replace')
    print(f'HTTP {e.code}: {body[:500]}')
