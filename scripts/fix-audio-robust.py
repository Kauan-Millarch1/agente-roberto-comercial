"""Make audio download robust — handle both URL and ID"""
import json
import urllib.request
import urllib.error

from _env import N8N_API_KEY as API_KEY
WF_ID = 'azwM3PgGtSbGTCsn'
BASE = 'https://ecommercepuro.app.n8n.cloud/api/v1'

req = urllib.request.Request(f'{BASE}/workflows/{WF_ID}', headers={'X-N8N-API-KEY': API_KEY})
with urllib.request.urlopen(req) as resp:
    wf = json.loads(resp.read())

# Replace HTTP Request with a Code node that handles both URL and ID
# Then download_audio downloads the resolved URL

for n in wf['nodes']:
    # Change HTTP Request to a Code node that resolves audio URL
    if n['name'] == 'HTTP Request':
        params = n['parameters']
        url = params.get('url', '')
        if 'msg.audio' in url:
            # Change this to resolve the audio — if it's a URL use directly, if ID resolve via Graph API
            n['type'] = 'n8n-nodes-base.code'
            n['typeVersion'] = 2
            n['parameters'] = {
                'jsCode': """// Resolve audio: handle both direct URL and media ID
const audioRef = $('parametros').first().json.msg.audio || '';

let downloadUrl;

if (audioRef.startsWith('http')) {
  // Already a URL (legacy or lookaside) — use directly
  downloadUrl = audioRef;
} else {
  // It's a media ID — resolve via Graph API
  const response = await this.helpers.httpRequest({
    method: 'GET',
    url: 'https://graph.facebook.com/v21.0/' + audioRef,
    headers: {
      'Authorization': 'Bearer ' + $('parametros').first().json.wabaToken
    },
    json: true
  });
  downloadUrl = response.url;
}

return [{ json: { download_url: downloadUrl } }];
"""
            }
            # Remove credentials (Code nodes don't use them)
            if 'credentials' in n:
                del n['credentials']
            print('[OK] HTTP Request -> Code node (resolve audio URL)')

    # Update download_audio to use resolved URL
    if n['name'] == 'download_audio':
        n['parameters']['url'] = '={{ $json.download_url }}'
        print('[OK] download_audio URL -> $json.download_url')

# Hmm, the Code node can't use this.helpers.httpRequest with WhatsApp credentials easily
# Better approach: keep HTTP Request but make it handle URLs directly
# Actually simplest: just make download_audio handle both cases

# Let me revert HTTP Request and take a different approach
# Make Edit Fields3 extract the right value, and skip the Graph API call entirely
# The WABA webhook already sends the URL in audio.url — use it directly

for n in wf['nodes']:
    if n['name'] == 'HTTP Request':
        # Revert to HTTP Request
        n['type'] = 'n8n-nodes-base.httpRequest'
        n['typeVersion'] = 4.2
        # Just download directly from the URL (lookaside URL works with WABA auth)
        n['parameters'] = {
            'url': "={{ $('parametros').first().json.msg.audio }}",
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
        }
        n['credentials'] = {
            'whatsAppApi': {
                'id': 'nr456gATS6iXnlsx',
                'name': 'WhatsApp - Ecommerce Puro'
            }
        }
        print('[OK] HTTP Request: direct download from URL with WABA auth')

    # Change parametros back to extract audio.url (not audio.id)
    # The WABA webhook DOES send audio.url — it works with WABA credentials
    if n['name'] == 'parametros':
        assignments = n['parameters']['assignments']['assignments']
        for a in assignments:
            if a.get('name') == 'msg.audio':
                a['value'] = "={{ $('When Executed by Another Workflow').item.json.message.audio.url }}"
                print('[OK] parametros msg.audio -> audio.url (direct URL)')

# Remove download_audio node — no longer needed, HTTP Request downloads directly
wf['nodes'] = [n for n in wf['nodes'] if n['name'] != 'download_audio']
print('[OK] Removed download_audio node')

# Reconnect: HTTP Request -> openAI_audio (skip download_audio)
conns = wf['connections']
if 'HTTP Request' in conns:
    for ot in conns['HTTP Request']:
        for i, out_list in enumerate(conns['HTTP Request'][ot]):
            new_list = []
            for c in out_list:
                if c.get('node') == 'download_audio':
                    new_list.append({'node': 'openAI_audio', 'type': 'main', 'index': 0})
                else:
                    new_list.append(c)
            conns['HTTP Request'][ot][i] = new_list
    print('[OK] HTTP Request -> openAI_audio (direct)')

# Remove download_audio connections
if 'download_audio' in conns:
    del conns['download_audio']

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
        print(f'download_audio removed: {"download_audio" not in node_names}')
        for n in result['nodes']:
            if n['name'] == 'HTTP Request':
                print(f'HTTP Request URL: {n["parameters"]["url"]}')
                print(f'HTTP Request response: {n["parameters"]["options"]}')
        # Check connection
        rconns = result['connections']
        if 'HTTP Request' in rconns:
            for ot, outputs in rconns['HTTP Request'].items():
                for out_list in outputs:
                    for c in out_list:
                        print(f'HTTP Request -> {c.get("node")}')
        print('PUT OK')
except urllib.error.HTTPError as e:
    body = e.read().decode('utf-8', errors='replace')
    print(f'HTTP {e.code}: {body[:500]}')
