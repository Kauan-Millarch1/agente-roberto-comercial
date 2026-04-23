"""Update AI_Roberto system prompt in N8N workflow."""
import json
import urllib.request

from _env import N8N_API_KEY as API_KEY
WF_ID = "azwM3PgGtSbGTCsn"
BASE = "https://ecommercepuro.app.n8n.cloud/api/v1"

# GET current workflow
req = urllib.request.Request(
    f"{BASE}/workflows/{WF_ID}",
    headers={"X-N8N-API-KEY": API_KEY},
)
with urllib.request.urlopen(req) as resp:
    wf = json.loads(resp.read().decode("utf-8"))

for n in wf["nodes"]:
    if n["name"] == "AI_Roberto":
        old_prompt = n["parameters"]["options"]["systemMessage"]
        new_prompt = old_prompt

        replacements = [
            # 1. Emoji rule
            (
                'Emojis sparingly (1-2 max per message).',
                'Emojis: ONLY these 4: \U0001f680 \U0001f44a \U0001f919 \U0001f60a. ONLY in first 2 messages (opening). ZERO after opening.',
            ),
            # 2. No laughing
            (
                'NO slang: no "kk", "kkk", "blz", "firmeza", "mano", "brother". Laugh with "haha" or emojis.',
                'NO slang: no "kk", "kkk", "haha", "rs", "blz", "firmeza", "mano", "brother", "cara", "trem", "uai". NO laughing expressions.',
            ),
            # 3. NEVER list - add Caramba, parabens
            (
                'NEVER: "Entendido!"/"Que otimo!" at start, "Fico a disposicao", "investimento" for price, subordinate clauses, overly formal corporate language, slang or abbreviations.',
                'NEVER: "Entendido!"/"Que otimo!"/"Caramba!"/"Parabens!" at start, "Fico a disposicao", "investimento" for price, subordinate clauses, overly formal corporate language, slang or abbreviations, shallow praise for lead numbers.',
            ),
            # 4. 200 -> 300 chars
            ('Total > 200 chars? acionar_audio: true.', 'Total > 300 chars? acionar_audio: true.'),
            ('Total > 200 -> audio.', 'Total > 300 -> audio.'),
            # 5. Sacred Rule 2
            (
                '2. If explanation > 2 short bubbles, use audio (acionar_audio: true)',
                '2. If total chars > 300, use audio. Text is DEFAULT, audio is EXCEPTION.',
            ),
            # 6. Date rule
            (
                '6. No discount before lead objects to price',
                '6. No discount before lead objects to price\n7. DATES: NEVER say the year. "dia 8 e 9 de abril", NOT "8 e 9 de abril de 2026"',
            ),
            # 7. DEFAULT IS AUDIO -> TEXT
            (
                'DEFAULT IS AUDIO. When in doubt, audio.',
                'DEFAULT IS TEXT. Audio only for: event presentation (Stage 3), mirroring lead audio, strong price objection after 2+ turns, or total chars > 300.',
            ),
            (
                'Audio: messages[] = full spoken content. Text: max 2 bubbles, ~80 chars.',
                'Audio: messages[] = full spoken content. Text: max 2 bubbles, ~120 chars each.\nBefore sending audio, ask: does this NEED tone of voice and energy, or can I shorten to text?',
            ),
            # 8. acionar_audio description
            (
                'acionar_audio: true for event questions, objections, presentations. false for greetings, short questions.',
                'acionar_audio: true ONLY for event presentation, mirroring lead audio, strong price objection, or total > 300 chars. false for everything else.',
            ),
            # 9. Closing
            (
                'Bought: ["Boa, vaga garantida", "Qualquer coisa me chama aqui"]',
                'Bought: ["Vaga garantida", "Qualquer coisa me chama aqui"]',
            ),
            # 10. Bot question
            (
                'Bot question: "Haha sou da equipe comercial da Ecommerce Puro".',
                'Bot question: "Sou da equipe comercial da Ecommerce Puro". NEVER confirm or deny being AI.',
            ),
            # 11. Sounding tone
            (
                '### STAGE 2 \u2014 QUICK SOUNDING\nPick ONE question. If lead asks price -> Stage 4.',
                '### STAGE 2 \u2014 QUICK SOUNDING\nPick ONE question. If lead asks price -> Stage 4.\nTONE: Consultive, NOT flattering. NEVER praise lead numbers ("Caramba!", "Parabens!", "volume legal!"). Ask the NEXT question instead.',
            ),
        ]

        for old, new in replacements:
            if old in new_prompt:
                new_prompt = new_prompt.replace(old, new)
                print(f"OK: replaced '{old[:50]}...'")
            else:
                print(f"SKIP: '{old[:50]}...' not found")

        n["parameters"]["options"]["systemMessage"] = new_prompt
        print(f"\nOld length: {len(old_prompt)}, New length: {len(new_prompt)}")

        # Sanity checks
        checks = [
            ("No DEFAULT IS AUDIO", "DEFAULT IS AUDIO" not in new_prompt),
            ("Has DEFAULT IS TEXT", "DEFAULT IS TEXT" in new_prompt),
            ("Has emoji rule", "\U0001f680 \U0001f44a \U0001f919 \U0001f60a" in new_prompt),
            ("Has date rule", "NEVER say the year" in new_prompt),
            ("Has 300 chars", "300 chars" in new_prompt),
            ("Has Caramba banned", "Caramba" in new_prompt),
            ("Has sounding tone", "NOT flattering" in new_prompt),
            ("Has structured output", '"messages"' in new_prompt),
        ]

        all_ok = True
        for name, result in checks:
            status = "OK" if result else "FAIL"
            print(f"{status}: {name}")
            if not result:
                all_ok = False

        if not all_ok:
            print("ABORTED - sanity check failed")
            exit(1)
        break

# PUT
payload = {
    "name": wf["name"],
    "nodes": wf["nodes"],
    "connections": wf["connections"],
    "settings": wf.get("settings", {}),
    "staticData": wf.get("staticData", None),
}
body = json.dumps(payload, ensure_ascii=False).encode("utf-8")

req = urllib.request.Request(
    f"{BASE}/workflows/{WF_ID}",
    data=body,
    method="PUT",
    headers={"X-N8N-API-KEY": API_KEY, "Content-Type": "application/json"},
)

try:
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        print(f"\nSUCCESS! Workflow updated: {data['id']}")
        for n in data.get("nodes", []):
            if n.get("name") == "AI_Roberto":
                sp = n["parameters"]["options"]["systemMessage"]
                verified = all(
                    [
                        "DEFAULT IS TEXT" in sp,
                        "DEFAULT IS AUDIO" not in sp,
                        "NEVER say the year" in sp,
                        "300 chars" in sp,
                    ]
                )
                print("VERIFIED: all changes live" if verified else "WARNING: some changes missing")
                break
except urllib.error.HTTPError as e:
    print(f"HTTP {e.code}: {e.read().decode()[:500]}")
