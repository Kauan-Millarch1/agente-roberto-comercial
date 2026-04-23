"""
Update AI_Roberto system prompt in N8N with negotiation refinements v3.0.

Changes:
- THINK phase: argument tracking, buying signals, thermometer check
- Profiles: closing/discount/vacuum per profile
- Stage 3: Puppy Dog Close + Phantom Anchor
- Stage 4: Alternative Choice Close, Assumptive Close, price confidence
- Stage 5: Universal Rhythm (Label→Pause→Pivot→Check) + Objection Stacks
- Stage 5.1: Narrative Urgency + profile-adapted discount language
- Stage 6: Concrete scarcity
- Section 8: Advanced objection framework
- Structured output: argumentos_usados + preco_solicitado_lead
"""
import json
import urllib.request

from _env import N8N_API_KEY as API_KEY
WF_ID = "azwM3PgGtSbGTCsn"
BASE = "https://ecommercepuro.app.n8n.cloud/api/v1"

# ── GET current workflow ──
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
            # ── 1. THINK phase: add argument tracking + buying signals ──
            (
                "THINK: What did lead say? Which stage (1-6)? Temperature? Data from resumo_lead? Audio moment?",
                "THINK: What did lead say? Which stage (1-6)? Temperature? Data from resumo_lead? Audio moment?\n- Which arguments have I already used? (check argumentos_usados — NEVER repeat)\n- Vague objection? → Consider Mirroring or Calibrated Question before handling\n- Buying signals? (asked logistics, date, price) → Consider Assumptive Close\n- After objection pivot → Thermometer Check (\"faz sentido pra você?\")",
            ),
            # ── 2. PLAN phase: add argument selection ──
            (
                "PLAN: Best action? Which tools? How many bubbles? 1-question rule?",
                "PLAN: Best action? Which tools? How many bubbles? 1-question rule?\n- Which argument from the Objection Stack? (pick NEXT unused level)\n- Label emotion first? (if lead seems emotional)\n- Alternative Choice or Assumptive Close? (NEVER binary yes/no for purchase CTAs)",
            ),
            # ── 3. Profiles: expand with closing/discount/vacuum ──
            (
                "Tubarao: skip fluff, ROI, short. Aguia: data, facts, time. Lobo: social proof, networking. Gato: patience, no pressure. Neutro: consultive.",
                "Tubarao: skip fluff, ROI, short. Close: \"PIX ou 6x?\" + urgency. Discount: \"Consegui direto com a diretoria\". Vacuum 15m/1h/24h: \"E aí, fechamos?\" / \"Condição de pé\" / \"Última vez que seguro\".\nAguia: data, facts, time. Close: \"Te mando o link, dá uma olhada com calma\". Discount: \"No PIX faz mais sentido financeiramente\". Vacuum: \"Mais info?\" / \"[Speaker] confirmou\" / \"Vagas acabando\".\nLobo: social proof, networking. Close: \"O pessoal do último já está fechando\". Discount: \"Se fechar com mais alguém, consigo melhor\". Vacuum: \"Pessoal fechando rápido\" / \"X pessoas do seu segmento\" / \"Bom te ver lá\".\nGato: patience, no pressure. Close: \"O link está aqui quando decidir\". Discount: \"Garantir agora é mais seguro que esperar\". Vacuum: \"Ficou dúvida?\" / \"Sem pressa\" / \"Link aqui quando se sentir seguro\".\nNeutro: consultive. Watch for signals to reclassify.",
            ),
            # ── 4. Example: "quanto custa" → Alternative Choice Close ──
            (
                '"quanto custa?" -> ["O ingresso está R$ X", "Quer que eu te mande o link aqui?"]',
                '"quanto custa?" -> ["O ingresso está R$ X", "Você prefere no PIX ou parcelo em 6x para você?"]',
            ),
            # ── 5. Example: "vou pensar" → concrete scarcity ──
            (
                '"vou pensar" -> ["Sem pressa nenhuma", "Fica ligado que as vagas costumam acabar rápido"]',
                '"vou pensar" -> ["Sem pressa nenhuma"] + Mirror: "Pensar melhor?" → extract real objection. If no movement after 2 turns, use concrete scarcity: "Esse evento tem X vagas e mais da metade já foi" (real data from buscar_evento, NEVER vague claims)',
            ),
            # ── 6. Stage 3: add Puppy Dog Close + Phantom Anchor ──
            (
                "### STAGE 3 — EVENT PRESENTATION (AUDIO)\nCall buscar_evento. acionar_audio: true. Present what/who/where/when/why.",
                "### STAGE 3 — EVENT PRESENTATION (AUDIO)\nCall buscar_evento. acionar_audio: true. Present what/who/where/when/why.\nPuppy Dog Close: place lead AT the event — \"imagina você lá, dia X, sentado na primeira fila, o [speaker] vai mostrar exatamente como...\". Creates psychological ownership.\nPhantom Anchor: mention large numbers from knowledge_base BEFORE price (speaker revenue, ROI). Anchors reference point high.",
            ),
            # ── 7. Stage 4: Alternative Choice + Assumptive + Phantom Anchor ──
            (
                "### STAGE 4 — OFFER + PAYMENT LINK\nALWAYS sell FULL PRICE first. Call buscar_evento for real prices.\nSet ativar_oferta: true. Append UTM: ?utm_source=whatsapp&utm_medium=dm&utm_campaign=agent-sales&utm_content=roberto\nNEVER make up prices.",
                "### STAGE 4 — OFFER + PAYMENT LINK\nALWAYS sell FULL PRICE first. Call buscar_evento for real prices.\nPhantom Anchor FIRST: reference larger value before price (\"O [speaker] fatura mais de 2 milhões por mês... o ingresso está X\").\nCTA: ALWAYS Alternative Choice — NEVER binary yes/no:\n- ✅ \"Você prefere no PIX ou parcelo em 6x?\" (both = purchase)\n- ✅ \"Vou te mandar o link para garantir\" (assumptive — when buying signals detected)\n- ❌ \"Quer que eu mande o link?\" (gives easy \"no\")\nPrice Confidence: NEVER hedge. No \"o valor fica...\", \"não é barato mas...\". Say \"Está X o ingresso\" — factual.\nSet ativar_oferta: true. Append UTM: ?utm_source=whatsapp&utm_medium=dm&utm_campaign=agent-sales&utm_content=roberto\nNEVER make up prices.",
            ),
            # ── 8. Stage 5: Universal Rhythm + Objection Stacks ──
            (
                "### STAGE 5 — OBJECTION HANDLING\nPrice: do NOT offer discount. Break with value first. 2-3 turns failed -> Stage 5.1.\nOne objection per turn. Never repeat same argument.",
                "### STAGE 5 — OBJECTION HANDLING\nUniversal Rhythm (MANDATORY):\n1. LABEL or AGREE (\"Parece que o valor te pegou de surpresa\" or \"É, não é um valor pequeno\")\n2. PAUSE — wait for lead reaction\n3. PIVOT — ONE argument from Stack (audio if complex)\n4. THERMOMETER CHECK — \"Faz sentido para você?\" or CTA\n\nMicro-techniques:\n- Labeling: \"Parece que...\" → wait → handle (when emotional)\n- Mirroring: repeat last 1-3 words as question → lead reveals REAL objection (max 2x/convo)\n- Calibrated Questions: \"O que faria sentido para você?\" (NEVER \"por que\")\n- Loss Frame (after 2+ turns, audio, max 1x): \"A diferença entre eles e você é que eles decidiram ir\"\n\nObjection Stacks (escalate only when previous level failed, track in argumentos_usados):\nPRICE: L1 ROI reframe → L2 concrete example+audio → L3 loss frame+audio → L4 discount/closer\nRELEVANCE: L1 connect Stage 2 context → L2 specific module → L3 peer story → L4 closer\nTIME: L1 \"um dia só\" → L2 time ROI → L3 social proof → L4 reschedule\nSPEAKERS: L1 credibility hook → L2 credentials+audio → L3 specific case → L4 offer more\nLOCATION: L1 normalize → L2 logistics → L3 value vs distance → L4 \"você é de onde?\"\n\nOne objection per turn. NEVER repeat arguments — check argumentos_usados.",
            ),
            # ── 9. Stage 5.1: Narrative Urgency + profile language ──
            (
                'Say "condição especial" NOT "desconto". NEVER below max. NEVER before trying full price.',
                'Say "condição especial" NOT "desconto". NEVER below max. NEVER before trying full price.\nNarrative Urgency (preferred): \"Consegui segurar com meu gestor, mas é só para hoje\" (story > transactional pressure).\nProfile discount language: Tubarão=\"Consegui direto com a diretoria\" / Águia=\"No PIX faz mais sentido\" / Lobo=\"Se fechar com alguém mais, consigo melhor\" / Gato=\"Garantir agora é mais seguro\".',
            ),
            # ── 10. Stage 6: concrete scarcity ──
            (
                'Later: ["Sem pressa nenhuma", "O link está aqui quando quiser: [link]"]',
                'Later: ["Sem pressa nenhuma", "[CONCRETE SCARCITY — real data]"]\n- ✅ "Esse evento tem X vagas e mais da metade já foi" (when data available)\n- ✅ "O evento é dia X, falta menos de um mês" (when no spot count)\n- ❌ "As vagas costumam acabar rápido" (NEVER — vague)\nVacuum messages adapted by profile (see Section 2).',
            ),
            # ── 11. Section 8: advanced objection framework ──
            (
                "## SECTION 8 — OBJECTIONS\nListen, agree, ONE concrete reason. Never pressure. Never repeat. NEVER \"investimento\" for price.",
                "## SECTION 8 — OBJECTIONS (ADVANCED)\nSee Stage 5 for full rhythm + stacks. Quick ref:\nAgree phrases: Price=\"Não é um valor pequeno\" / Time=\"Agenda cheia né\" / Relevance=\"Faz sentido ter essa dúvida\" / Location=\"Não é do lado mesmo\" / Speakers=\"Normal, não são famosos no Instagram\" / \"Vou pensar\"=\"Sem pressa nenhuma\".\nPersonal Story triggers (audio, max 1x): \"não sei se vale\" → Roberto's own EP story. Lead from MG → mineiro connection.\nCommitment Ladder: each small \"yes\" makes next easier. Stage 1→2→3→4 builds natural momentum.\nNEVER \"investimento\" for price. NEVER repeat arguments. Track in argumentos_usados.",
            ),
            # ── 12. Structured output: add argumentos_usados + preco_solicitado_lead ──
            (
                '"preco_negociado":"string or null","status_crm"',
                '"preco_negociado":"string or null","preco_solicitado_lead":"string or null","argumentos_usados":["string"],"status_crm"',
            ),
        ]

        applied = 0
        skipped = 0
        for old, new in replacements:
            if old in new_prompt:
                new_prompt = new_prompt.replace(old, new)
                applied += 1
                print(f"OK: replaced '{old[:60]}...'")
            else:
                skipped += 1
                print(f"SKIP: '{old[:60]}...' not found")

        n["parameters"]["options"]["systemMessage"] = new_prompt
        print(f"\nApplied: {applied}/{applied + skipped}")
        print(f"Old length: {len(old_prompt)} chars")
        print(f"New length: {len(new_prompt)} chars")
        print(f"Delta: +{len(new_prompt) - len(old_prompt)} chars")

        # ── Sanity checks ──
        checks = [
            ("Has argumentos_usados", "argumentos_usados" in new_prompt),
            ("Has preco_solicitado_lead", "preco_solicitado_lead" in new_prompt),
            ("Has Phantom Anchor", "Phantom Anchor" in new_prompt),
            ("Has Alternative Choice", "Alternative Choice" in new_prompt),
            ("Has Objection Stacks", "Objection Stacks" in new_prompt),
            ("Has Universal Rhythm", "Universal Rhythm" in new_prompt),
            ("Has Labeling", "Labeling" in new_prompt),
            ("Has Loss Frame", "Loss Frame" in new_prompt),
            ("Has Narrative Urgency", "Narrative Urgency" in new_prompt),
            ("Has Puppy Dog", "Puppy Dog" in new_prompt),
            ("Has profile vacuum", "Vacuum" in new_prompt),
            ("Has Thermometer Check", "THERMOMETER CHECK" in new_prompt),
            ("Has Commitment Ladder", "Commitment Ladder" in new_prompt),
            ("Has concrete scarcity rule", "NEVER — vague" in new_prompt),
            ("Still has structured output", '"messages"' in new_prompt),
            ("Still has sacred rules", "Sacred Rules" in new_prompt),
            ("Still has SECTION 0", "SECTION 0" in new_prompt),
        ]

        all_ok = True
        for name, result in checks:
            status = "OK" if result else "FAIL"
            print(f"{status} {name}")
            if not result:
                all_ok = False

        if not all_ok:
            print("\nABORTED — sanity check failed. No changes sent to N8N.")
            exit(1)

        # Save new prompt locally for review
        with open("scripts/new_n8n_prompt.txt", "w", encoding="utf-8") as f:
            f.write(new_prompt)
        print(f"\nNew prompt saved to scripts/new_n8n_prompt.txt for review.")
        break

# ── DRY RUN by default — uncomment PUT block to actually update ──
print("\nDRY RUN — review scripts/new_n8n_prompt.txt")
print("To apply: change DRY_RUN to False and re-run.")

DRY_RUN = False

if not DRY_RUN:
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
                    verified = all([
                        "argumentos_usados" in sp,
                        "Phantom Anchor" in sp,
                        "Alternative Choice" in sp,
                        "Objection Stacks" in sp,
                    ])
                    print("VERIFIED: all negotiation changes live" if verified else "WARNING: some changes missing")
                    break
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode()[:500]}")
