"""
Update AI_Roberto: remove 'faz sentido?' (gives easy 'no') and replace
with forward-moving questions that presuppose progress.

Rule: vendedor bom NUNCA da brecha pro 'nao'.
"""
import json
import sys
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")

from _env import N8N_API_KEY as API_KEY
WF_ID = "azwM3PgGtSbGTCsn"
BASE = "https://ecommercepuro.app.n8n.cloud/api/v1"

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
            # 1. THINK phase
            (
                'After objection pivot → Thermometer Check ("faz sentido pra você?")',
                'After objection pivot → close with forward-moving question (NEVER "faz sentido?" — easy "no"). Use: "PIX ou 6x?", "quer que te explique mais sobre [topic]?"',
            ),
            # 2. Universal Rhythm step 4
            (
                '4. THERMOMETER CHECK — "Faz sentido para você?" or CTA',
                '4. ADVANCE — forward-moving question where BOTH answers = progress. NEVER "faz sentido?" (easy "no"). Use: "PIX ou 6x?", "quer que te explique mais sobre [topic]?", "o que mais quer saber?"',
            ),
        ]

        applied = 0
        for old, new in replacements:
            if old in new_prompt:
                new_prompt = new_prompt.replace(old, new)
                applied += 1
                print(f"OK: replaced '{old[:60]}...'")
            else:
                print(f"SKIP: '{old[:60]}...' not found")

        n["parameters"]["options"]["systemMessage"] = new_prompt
        print(f"\nApplied: {applied}/{len(replacements)}")
        print(f"Old: {len(old_prompt)} chars -> New: {len(new_prompt)} chars")

        # Sanity
        checks = [
            ("No 'faz sentido pra voce?' as CTA", 'faz sentido pra você?"' not in new_prompt or 'NEVER "faz sentido' in new_prompt),
            ("Has ADVANCE step", "ADVANCE" in new_prompt),
            ("Has forward-moving", "forward-moving" in new_prompt),
            ("Has NEVER faz sentido", 'NEVER "faz sentido' in new_prompt),
            ("Still has Alternative Choice", "Alternative Choice" in new_prompt),
            ("Still has Objection Stacks", "Objection Stacks" in new_prompt),
        ]

        all_ok = True
        for name, result in checks:
            status = "OK" if result else "FAIL"
            print(f"{status}: {name}")
            if not result:
                all_ok = False

        if not all_ok:
            print("\nABORTED — sanity check failed")
            exit(1)

        with open("scripts/new_n8n_prompt.txt", "w", encoding="utf-8") as f:
            f.write(new_prompt)
        break

# PUT to N8N
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
        for node in data.get("nodes", []):
            if node.get("name") == "AI_Roberto":
                sp = node["parameters"]["options"]["systemMessage"]
                has_advance = "ADVANCE" in sp
                no_faz_sentido_cta = 'faz sentido pra você?"' not in sp or 'NEVER "faz sentido' in sp
                print(f"VERIFIED: ADVANCE present={has_advance}, no-brecha={no_faz_sentido_cta}")
                break
except urllib.error.HTTPError as e:
    print(f"HTTP {e.code}: {e.read().decode()[:500]}")
