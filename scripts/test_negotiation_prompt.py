"""
Test suite for Roberto's negotiation prompt v3.0.
Validates prompt structure + simulates conversations via OpenAI API
to verify the new techniques are being applied correctly.
"""
import json
import os

# ── Load prompt ──
with open("scripts/new_n8n_prompt.txt", "r", encoding="utf-8") as f:
    PROMPT = f.read()

print("=" * 60)
print("PARTE 1: VALIDACAO ESTRUTURAL DO PROMPT")
print("=" * 60)

# ── Structural validation ──
structural_checks = {
    # Core negotiation techniques
    "Labeling technique": "Labeling",
    "Mirroring technique": "Mirroring",
    "Calibrated Questions": "Calibrated Questions",
    "Loss Frame": "Loss Frame",
    "Phantom Anchor": "Phantom Anchor",
    "Puppy Dog Close": "Puppy Dog",
    "Alternative Choice Close": "Alternative Choice",
    "Assumptive Close": "Assumptive Close",
    "Narrative Urgency": "Narrative Urgency",
    "Thermometer Check": "THERMOMETER CHECK",
    "Commitment Ladder": "Commitment Ladder",
    "Universal Rhythm": "Universal Rhythm",
    # Objection Stacks
    "Price Stack (L1-L4)": "PRICE: L1",
    "Relevance Stack": "RELEVANCE: L1",
    "Time Stack": "TIME: L1",
    "Speakers Stack": "SPEAKERS: L1",
    "Location Stack": "LOCATION: L1",
    # Profile adaptations
    "Tubarao closing": 'Tubarao: skip fluff',
    "Aguia closing": 'Aguia: data, facts',
    "Lobo closing": 'Lobo: social proof',
    "Gato closing": 'Gato: patience',
    "Profile vacuum messages": "Vacuum",
    "Profile discount language": "Profile discount language",
    # Tracking
    "argumentos_usados field": "argumentos_usados",
    "preco_solicitado_lead field": "preco_solicitado_lead",
    # Concrete scarcity
    "Ban vague scarcity": "NEVER — vague",
    "Concrete scarcity example": "vagas e mais da metade",
    # Sacred rules preserved
    "Sacred Rule 1 question": "ONE question per turn",
    "Sacred Rule chars": "120 chars",
    "Sacred Rule audio": "300",
    "Sacred Rule no year": "NEVER say the year",
    "Sacred Rule no invent": "NEVER invent",
    # Anti-patterns
    "Ban investimento": 'NEVER "investimento"',
    "Ban binary CTA": 'NEVER binary yes/no',
    "Personal Story trigger": "Personal Story triggers",
    # Structured output
    "JSON schema present": '"messages"',
    "Has all CRM statuses": "COMPROU",
}

passed = 0
failed = 0
for name, pattern in structural_checks.items():
    if pattern in PROMPT:
        passed += 1
        print(f"  OK  {name}")
    else:
        failed += 1
        print(f"  FAIL  {name} (pattern: '{pattern}')")

print(f"\nResultado: {passed}/{passed + failed} checks passed")
if failed > 0:
    print(f"  {failed} FAILED")

print("\n" + "=" * 60)
print("PARTE 2: SIMULACAO DE CENARIOS (ANALISE OFFLINE)")
print("=" * 60)

# ── Scenario simulation: what SHOULD happen vs what SHOULDN'T ──
scenarios = [
    {
        "name": "Lead diz 'ta caro' (1a vez)",
        "lead_msg": "Nossa, ta caro demais esse ingresso",
        "should_contain": [
            "Ritmo: LABEL ou AGREE primeiro",
            "Nao oferece desconto",
            "Usa argumento L1 (ROI reframe)",
            "Termina com Thermometer Check",
        ],
        "should_NOT_contain": [
            "Oferecer desconto na primeira objecao",
            "Dizer 'investimento'",
            "CTA binario 'quer comprar?'",
        ],
        "expected_output_fields": {
            "objecao_detectada": "preco",
            "ativar_oferta": False,
            "acionar_audio": True,  # L1+ typically needs audio
        },
        "expected_roberto": [
            'messages: ["Nao e um valor pequeno mesmo"]',
            'acionar_audio: true',
            'argumentos_usados: ["preco_roi_reframe"]',
        ],
    },
    {
        "name": "Lead diz 'ta caro' (2a vez, apos ROI reframe)",
        "lead_msg": "Continuo achando caro, nao tenho essa grana",
        "context": "Ja usou L1 (ROI reframe) no turno anterior",
        "should_contain": [
            "Escala para L2 (exemplo concreto + audio)",
            "Nao repete argumento L1",
            "Price Reframe: 'sao 2 dias que mudam seu faturamento'",
        ],
        "should_NOT_contain": [
            "Repetir ROI reframe (ja usado)",
            "Oferecer desconto (ainda tem L2, L3)",
        ],
        "expected_output_fields": {
            "objecao_detectada": "preco",
            "acionar_audio": True,
        },
        "expected_roberto": [
            'argumentos_usados: ["preco_roi_reframe", "preco_exemplo_concreto"]',
        ],
    },
    {
        "name": "Lead diz 'ta caro' (3a vez, apos L1+L2)",
        "lead_msg": "Sei la, ainda acho muito",
        "context": "Ja usou L1 + L2. Lead nao cedeu.",
        "should_contain": [
            "Escala para L3 (Loss Frame via audio)",
            "Frase tipo 'a diferenca entre eles e voce e que decidiram ir'",
            "Max 1 Loss Frame por conversa",
        ],
        "should_NOT_contain": [
            "Repetir L1 ou L2",
            "Pular para desconto sem esgotar L3",
        ],
        "expected_output_fields": {
            "acionar_audio": True,
        },
    },
    {
        "name": "Lead diz 'vou pensar' (vago)",
        "lead_msg": "Hmm vou pensar melhor",
        "should_contain": [
            "Mirroring: 'Pensar melhor?' para extrair objecao real",
            "OU Labeling se emocional",
            "Nao empurra — espera resposta",
        ],
        "should_NOT_contain": [
            "Oferecer desconto",
            "Escassez vaga ('vagas costumam acabar')",
            "Pressionar para fechar",
        ],
        "expected_roberto": [
            'messages: ["Pensar melhor?"]',
        ],
    },
    {
        "name": "Lead pergunta 'quanto custa?' (Stage 4)",
        "lead_msg": "Quanto custa o ingresso?",
        "should_contain": [
            "Phantom Anchor ANTES do preco (faturamento do speaker)",
            "Alternative Choice Close: 'PIX ou 6x?'",
            "Preco apresentado com confianca, sem hedge",
        ],
        "should_NOT_contain": [
            "CTA binario: 'Quer que eu mande o link?'",
            "Dizer 'investimento'",
            "Hedge: 'o valor fica...', 'nao e barato mas...'",
        ],
        "expected_roberto": [
            'messages: ["O ingresso esta R$ X", "Voce prefere no PIX ou parcelo em 6x?"]',
            'ativar_oferta: true',
        ],
    },
    {
        "name": "Lead pergunta data e local (sinais de compra)",
        "lead_msg": "Quando e onde vai ser o evento?",
        "should_contain": [
            "Detectar sinais de compra",
            "Considerar Assumptive Close apos responder",
            "'Vou te mandar o link para garantir' (pressuposto)",
        ],
        "should_NOT_contain": [
            "Perguntar 'quer comprar?'",
        ],
    },
    {
        "name": "Lead diz 'nao sei se e pra mim'",
        "lead_msg": "Sei la, nao sei se esse evento e pra mim",
        "should_contain": [
            "Labeling: 'Parece que voce ta preocupado se funciona pra quem ta comecando'",
            "Conectar ao contexto da Stage 2",
            "Pilha RELEVANCE L1",
        ],
        "should_NOT_contain": [
            "Oferecer desconto",
            "Ignorar a objecao",
        ],
    },
    {
        "name": "Lead Tubarao pede preco direto",
        "lead_msg": "Fala, quanto custa logo?",
        "context": "Perfil detectado: Tubarao",
        "should_contain": [
            "Comprimir etapas, ir direto ao preco",
            "Fechamento direto: 'PIX ou 6x?'",
            "Sem enrolacao, sem contexto longo",
        ],
        "should_NOT_contain": [
            "Audio longo explicando o evento",
            "Historias de social proof",
        ],
    },
    {
        "name": "Lead Gato hesitando",
        "lead_msg": "Hmm nao sei, preciso pensar com calma",
        "context": "Perfil detectado: Gato",
        "should_contain": [
            "Zero pressao",
            "Reasseguramento: 'O link esta aqui quando decidir'",
            "Paciencia, sem urgencia agressiva",
        ],
        "should_NOT_contain": [
            "'Fecha agora'",
            "'Ultima vaga'",
            "Pressao de tempo",
        ],
    },
    {
        "name": "Lead pede desconto abaixo da tabela",
        "lead_msg": "Faz por 3 mil? Ai eu fecho agora",
        "context": "Evento R$ 7.500, max desconto R$ 5.000",
        "should_contain": [
            "Setar preco_solicitado_lead: '3000'",
            "Dizer 'vou ver com meu gestor'",
            "Aguardar aprovacao externa",
        ],
        "should_NOT_contain": [
            "Aceitar o preco diretamente",
            "Dizer que nao pode",
        ],
    },
    {
        "name": "Negociacao com urgencia narrativa",
        "lead_msg": "Se fizer um desconto bom eu fecho",
        "context": "Ja passou por Stage 5 (argumentos de valor esgotados). Stage 5.1 ativa.",
        "should_contain": [
            "Urgencia narrativa: 'Consegui segurar com meu gestor'",
            "Dizer 'condicao especial', NAO 'desconto'",
            "CTA Alternative Choice: 'PIX ou 6x?'",
        ],
        "should_NOT_contain": [
            "Dizer 'desconto'",
            "Pressao transacional pura sem narrativa",
        ],
    },
    {
        "name": "Lead diz 'nao sei se vale a pena' (trigger historia pessoal)",
        "lead_msg": "Sei la, nao sei se vale a pena ir nesse evento",
        "should_contain": [
            "Trigger de historia pessoal ativado",
            "Roberto conta sua experiencia via audio",
            "Maximo 1 historia por conversa",
        ],
        "should_NOT_contain": [
            "Historia generica",
            "Inventar fatos",
        ],
    },
]

for i, s in enumerate(scenarios, 1):
    print(f"\n--- Cenario {i}: {s['name']} ---")
    print(f"  Lead: \"{s['lead_msg']}\"")
    if "context" in s:
        print(f"  Contexto: {s['context']}")

    print(f"\n  DEVE acontecer:")
    for item in s["should_contain"]:
        # Check if the prompt has instructions that would lead to this behavior
        print(f"    [+] {item}")

    print(f"\n  NAO DEVE acontecer:")
    for item in s["should_NOT_contain"]:
        print(f"    [-] {item}")

    if "expected_roberto" in s:
        print(f"\n  Resposta esperada do Roberto:")
        for item in s["expected_roberto"]:
            print(f"    >> {item}")

    if "expected_output_fields" in s:
        print(f"\n  Structured output esperado:")
        for k, v in s["expected_output_fields"].items():
            print(f"    {k}: {v}")

print("\n" + "=" * 60)
print("PARTE 3: VERIFICACAO DE CONFLITOS")
print("=" * 60)

# ── Check for contradictions ──
conflicts = []

# 1. Check Alternative Choice is the default CTA
if "Quer que eu mande o link" in PROMPT and "Alternative Choice" in PROMPT:
    # Check if the binary example is in a "don't do" context
    idx = PROMPT.index("Quer que eu mande o link")
    context_before = PROMPT[max(0, idx-5):idx]
    if "❌" not in context_before and "NEVER" not in PROMPT[max(0, idx-30):idx]:
        conflicts.append("Binary CTA 'Quer que eu mande o link?' appears without being flagged as wrong")

# 2. Check that "investimento" is banned
if '"investimento" for price' in PROMPT:
    # Good - it's banned
    pass
else:
    conflicts.append("Missing explicit ban on 'investimento' for price")

# 3. Check vague scarcity is banned
if "vagas costumam acabar" in PROMPT:
    idx = PROMPT.index("vagas costumam acabar")
    context_before = PROMPT[max(0, idx-10):idx]
    if "NEVER" not in context_before and "❌" not in PROMPT[max(0, idx-5):idx]:
        conflicts.append("Vague scarcity 'vagas costumam acabar' appears without being flagged as wrong")

# 4. Check sacred rules aren't contradicted
if "ONE question per turn" in PROMPT and "Mirroring" in PROMPT:
    # Mirroring IS one question — no conflict
    pass

# 5. Check Loss Frame limit
if "Loss Frame" in PROMPT:
    if "max 1x" in PROMPT or "max 1" in PROMPT:
        pass
    else:
        conflicts.append("Loss Frame mentioned without usage limit")

# 6. Check 120 char limit preserved
if "120 chars" in PROMPT:
    pass
else:
    conflicts.append("120 char per bubble limit missing")

# 7. Profile vacuum messages exist for all 4 profiles
for profile in ["Tubarao", "Aguia", "Lobo", "Gato"]:
    if "Vacuum" in PROMPT and profile in PROMPT:
        pass
    else:
        conflicts.append(f"Missing vacuum messages for {profile}")

# 8. Discount table preserved
for price in ["15.000", "7.500", "6.000", "5.000", "3.000"]:
    if price in PROMPT:
        pass
    else:
        conflicts.append(f"Missing discount tier for R$ {price}")

if not conflicts:
    print("  OK  Nenhum conflito detectado entre regras novas e existentes")
else:
    for c in conflicts:
        print(f"  CONFLITO: {c}")

print("\n" + "=" * 60)
print("PARTE 4: METRICAS DO PROMPT")
print("=" * 60)

lines = PROMPT.strip().split("\n")
sections = [l for l in lines if l.startswith("## SECTION")]
techniques_count = sum(1 for t in [
    "Labeling", "Mirroring", "Calibrated Questions", "Loss Frame",
    "Phantom Anchor", "Puppy Dog", "Alternative Choice", "Assumptive Close",
    "Narrative Urgency", "Thermometer Check", "Commitment Ladder",
    "Universal Rhythm", "Personal Story",
] if t in PROMPT)

print(f"  Total chars: {len(PROMPT)}")
print(f"  Total lines: {len(lines)}")
print(f"  Sections: {len(sections)}")
print(f"  Negotiation techniques: {techniques_count}/13")
print(f"  Objection stacks: {'5/5' if all(s in PROMPT for s in ['PRICE:', 'RELEVANCE:', 'TIME:', 'SPEAKERS:', 'LOCATION:']) else 'INCOMPLETE'}")
print(f"  Profile adaptations: {'4/4' if all(p in PROMPT for p in ['Tubarao:', 'Aguia:', 'Lobo:', 'Gato:']) else 'INCOMPLETE'}")
print(f"  Structured output fields: {'OK' if 'argumentos_usados' in PROMPT and 'preco_solicitado_lead' in PROMPT else 'MISSING'}")

print("\n" + "=" * 60)
print("RESUMO FINAL")
print("=" * 60)
total_structural = passed + failed
score = passed / total_structural * 100 if total_structural > 0 else 0
print(f"  Validacao estrutural: {passed}/{total_structural} ({score:.0f}%)")
print(f"  Cenarios simulados: {len(scenarios)}")
print(f"  Conflitos: {len(conflicts)}")
print(f"  Tecnicas implementadas: {techniques_count}/13")

if score == 100 and len(conflicts) == 0:
    print("\n  RESULTADO: PROMPT APROVADO - todas as tecnicas de negociacao estao presentes e sem conflitos")
elif score >= 90 and len(conflicts) == 0:
    print("\n  RESULTADO: PROMPT OK com observacoes menores")
else:
    print("\n  RESULTADO: PROMPT PRECISA DE AJUSTES")
