"""
Live negotiation test: simulates a full price objection conversation
using the Roberto system prompt via Anthropic API.

Tests the complete flow: price objection → escalation L1→L2→L3 → discount
"""
import json
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")

# Try to use anthropic SDK
try:
    import anthropic
except ImportError:
    print("Installing anthropic SDK...")
    os.system("pip install anthropic -q")
    import anthropic

# Load system prompt
with open("scripts/new_n8n_prompt.txt", "r", encoding="utf-8") as f:
    SYSTEM_PROMPT = f.read()

# Add mock tool context so Roberto knows what event to sell
TOOL_CONTEXT = """

## CONTEXTO DE TESTE (dados mockados para simulação)

Resultado do buscar_evento (use estes dados como se tivesse chamado a tool):
- Evento: Imersão Tributária
- Data: dia 8 e 9 de abril
- Local: São Paulo, SP
- Preço: R$ 6.000
- Palestrantes: Felipe Mano (advogado tributarista, já recuperou R$ 1.261.000 em ICMS para um único cliente), Neto Adam (contador especializado em ecommerce, 18 anos de experiência), Gustavo Lopes (seller que fatura R$ 200M/ano)
- knowledge_base highlights: seller de R$ 300k/mês no regime errado perde R$ 9.223/mês. 95% de redução em ICMS mensal possível (R$ 32k → R$ 2k). Total recuperado pela Confialtiva: +R$ 40M.
- Vagas: 90 vagas, 52 já vendidas
- Desconto máximo: R$ 5.000
- Formas: PIX, 6x

Resultado do resumo_lead: Nenhum contexto anterior. Lead novo.

IMPORTANTE PARA O TESTE:
- Não chame tools (elas não existem neste teste). Use os dados acima.
- Responda SOMENTE com o JSON structured output como faria no N8N.
- Siga TODAS as regras do prompt: 1 pergunta por turno, max 120 chars por bolha, etc.
"""

client = anthropic.Anthropic()

# Conversation turns simulating a full negotiation
conversation_turns = [
    {
        "role": "Abertura",
        "lead": "Oi, tudo bem?",
        "expected_stage": "Stage 1 → Opening",
        "check": "Saudação casual, pergunta sobre evento",
    },
    {
        "role": "Sondagem",
        "lead": "Vi o evento de tributária, parece interessante",
        "expected_stage": "Stage 2 → Sounding",
        "check": "Pergunta consultiva (NÃO elogio vazio)",
    },
    {
        "role": "Contexto do lead",
        "lead": "Tenho uma loja no Mercado Livre, faço uns 300 mil por mês, mas pago muito imposto",
        "expected_stage": "Stage 2→3 transition",
        "check": "NÃO dizer 'Caramba!' ou 'volume legal!'. Avançar para apresentação.",
    },
    {
        "role": "Apresentação (Stage 3)",
        "lead": "Me conta mais sobre o evento",
        "expected_stage": "Stage 3 → Audio presentation",
        "check": "acionar_audio: true, Puppy Dog Close, Phantom Anchor (números grandes antes do preço)",
    },
    {
        "role": "Preço (Stage 4)",
        "lead": "Quanto custa?",
        "expected_stage": "Stage 4 → Price + Alternative Choice",
        "check": "Phantom Anchor, preço confiante (sem hedge), Alternative Choice (PIX ou 6x), NÃO binário",
    },
    {
        "role": "Objeção preço L1",
        "lead": "Nossa, 6 mil? Tá caro demais",
        "expected_stage": "Stage 5 → Price Stack L1",
        "check": "AGREE primeiro, NÃO desconto, ROI reframe (L1), Thermometer Check",
    },
    {
        "role": "Objeção preço L2",
        "lead": "Sei lá, ainda acho pesado esse valor",
        "expected_stage": "Stage 5 → Price Stack L2",
        "check": "Escala para L2 (exemplo concreto via audio), NÃO repete L1, Price Reframe",
    },
    {
        "role": "Objeção preço L3 (Loss Frame)",
        "lead": "Hmm não sei, vou pensar",
        "expected_stage": "Stage 5 → Mirror ou L3",
        "check": "Mirror 'Pensar?' OU Loss Frame (audio). Escassez concreta se aplicável.",
    },
    {
        "role": "Negociação (Stage 5.1)",
        "lead": "Se tiver um desconto bom eu fecho",
        "expected_stage": "Stage 5.1 → Discount",
        "check": "'condição especial' (NÃO 'desconto'), Urgência Narrativa, Alternative Choice",
    },
    {
        "role": "Fechamento",
        "lead": "Pode ser no PIX então, me manda o link",
        "expected_stage": "Stage 6 → Close",
        "check": "Envia link, confirma vaga, escassez concreta ('38 vagas restantes')",
    },
]

print("=" * 70)
print("  TESTE LIVE DE NEGOCIAÇÃO — Agente Roberto v3.0")
print("  Simulando conversa completa: Imersão Tributária (R$ 6.000)")
print("=" * 70)

messages = []
results = []

for i, turn in enumerate(conversation_turns):
    print(f"\n{'─' * 70}")
    print(f"  TURNO {i+1}: {turn['role']}")
    print(f"  Stage esperado: {turn['expected_stage']}")
    print(f"  Verificação: {turn['check']}")
    print(f"{'─' * 70}")
    print(f"\n  💬 LEAD: \"{turn['lead']}\"")

    # Add lead message
    messages.append({"role": "user", "content": turn["lead"]})

    # Call Claude with Roberto's prompt
    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system=SYSTEM_PROMPT + TOOL_CONTEXT,
            messages=messages,
        )

        roberto_response = response.content[0].text
        print(f"\n  🤖 ROBERTO:")

        # Try to parse JSON
        try:
            # Find JSON in response
            json_start = roberto_response.find("{")
            json_end = roberto_response.rfind("}") + 1
            if json_start >= 0 and json_end > json_start:
                json_str = roberto_response[json_start:json_end]
                data = json.loads(json_str)

                # Print messages
                if "messages" in data:
                    for msg in data["messages"]:
                        chars = len(msg)
                        flag = " ⚠️>120" if chars > 120 else ""
                        print(f"     💬 \"{msg}\" ({chars} chars{flag})")

                # Print key fields
                print(f"\n  📊 Structured Output:")
                key_fields = [
                    "intencao_detectada", "objecao_detectada", "acionar_audio",
                    "ativar_oferta", "status_crm", "preco_negociado",
                    "preco_solicitado_lead", "argumentos_usados",
                ]
                for field in key_fields:
                    if field in data and data[field] is not None:
                        val = data[field]
                        if isinstance(val, list) and len(val) == 0:
                            continue
                        print(f"     {field}: {val}")

                # Validation checks
                print(f"\n  ✅ Checklist:")
                checks_passed = 0
                checks_total = 0

                # Check 1: Messages exist
                checks_total += 1
                if "messages" in data and len(data["messages"]) > 0:
                    checks_passed += 1
                    print(f"     OK  Tem mensagens")
                else:
                    print(f"     FAIL  Sem mensagens")

                # Check 2: No message > 120 chars (when not audio)
                if not data.get("acionar_audio", False):
                    checks_total += 1
                    all_short = all(len(m) <= 120 for m in data.get("messages", []))
                    if all_short:
                        checks_passed += 1
                        print(f"     OK  Todas bolhas <= 120 chars")
                    else:
                        over = [m for m in data["messages"] if len(m) > 120]
                        print(f"     FAIL  {len(over)} bolha(s) > 120 chars")

                # Check 3: Max 1 question
                checks_total += 1
                questions = sum(1 for m in data.get("messages", []) if "?" in m)
                if questions <= 1:
                    checks_passed += 1
                    print(f"     OK  Max 1 pergunta ({questions})")
                else:
                    print(f"     FAIL  {questions} perguntas (max 1)")

                # Check 4: No forbidden words
                checks_total += 1
                full_text = " ".join(data.get("messages", []))
                forbidden = ["Entendido!", "Que ótimo!", "Caramba!", "Parabéns!", "fico à disposição", "investimento"]
                found_forbidden = [f for f in forbidden if f.lower() in full_text.lower()]
                if not found_forbidden:
                    checks_passed += 1
                    print(f"     OK  Sem palavras proibidas")
                else:
                    print(f"     FAIL  Proibidas encontradas: {found_forbidden}")

                # Check 5: No abbreviations
                checks_total += 1
                abbrevs = [" vc ", " ce ", " td ", " tb ", " pq ", " mto "]
                found_abbrev = [a.strip() for a in abbrevs if a in f" {full_text.lower()} "]
                if not found_abbrev:
                    checks_passed += 1
                    print(f"     OK  Sem abreviações")
                else:
                    print(f"     FAIL  Abreviações: {found_abbrev}")

                # Stage-specific checks
                if i == 5:  # Price objection L1
                    checks_total += 1
                    if not data.get("ativar_oferta", True) or data.get("preco_negociado") is None:
                        checks_passed += 1
                        print(f"     OK  Não ofereceu desconto na 1a objeção")
                    else:
                        print(f"     FAIL  Ofereceu desconto cedo demais")

                if i == 4:  # Price presentation
                    checks_total += 1
                    has_binary = any("quer que" in m.lower() for m in data.get("messages", []))
                    if not has_binary:
                        checks_passed += 1
                        print(f"     OK  Sem CTA binário")
                    else:
                        print(f"     FAIL  CTA binário detectado")

                if i == 8:  # Negotiation
                    checks_total += 1
                    has_desconto_word = "desconto" in full_text.lower()
                    has_condicao = "condição" in full_text.lower() or "condicao" in full_text.lower() or "consigo" in full_text.lower()
                    if not has_desconto_word and has_condicao:
                        checks_passed += 1
                        print(f"     OK  Diz 'condição especial', não 'desconto'")
                    elif has_desconto_word:
                        print(f"     FAIL  Usou a palavra 'desconto'")
                    else:
                        print(f"     OK  Sem 'desconto' (mas verificar linguagem)")

                print(f"\n  Resultado turno: {checks_passed}/{checks_total}")
                results.append({"turn": i+1, "passed": checks_passed, "total": checks_total})

            else:
                print(f"     {roberto_response[:500]}")
                results.append({"turn": i+1, "passed": 0, "total": 1, "error": "No JSON found"})

        except json.JSONDecodeError:
            print(f"     (Resposta não é JSON válido)")
            print(f"     {roberto_response[:500]}")
            results.append({"turn": i+1, "passed": 0, "total": 1, "error": "Invalid JSON"})

        # Add Roberto's response to conversation
        messages.append({"role": "assistant", "content": roberto_response})

    except Exception as e:
        print(f"\n  ERRO: {e}")
        results.append({"turn": i+1, "passed": 0, "total": 1, "error": str(e)})
        break

# ── Final Summary ──
print(f"\n\n{'=' * 70}")
print(f"  RESUMO FINAL DA NEGOCIAÇÃO")
print(f"{'=' * 70}")

total_passed = sum(r["passed"] for r in results)
total_checks = sum(r["total"] for r in results)
errors = [r for r in results if "error" in r]

print(f"\n  Turnos executados: {len(results)}/10")
print(f"  Checks passados: {total_passed}/{total_checks}")
if total_checks > 0:
    print(f"  Taxa de aprovação: {total_passed/total_checks*100:.0f}%")
if errors:
    print(f"  Erros: {len(errors)}")
    for e in errors:
        print(f"    Turno {e['turn']}: {e['error']}")

print(f"\n  {'NEGOCIAÇÃO APROVADA' if total_passed == total_checks and len(results) == 10 else 'VER DETALHES ACIMA'}")
