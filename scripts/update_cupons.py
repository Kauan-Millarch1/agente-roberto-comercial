"""
Inject coupon strategy ("Escada de Desconto Inteligente") into Roberto's system prompt.
Adds coupon tables per event + 5 golden rules + anti-exploitation protection.
"""
import json
import sys
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")

from _env import N8N_API_KEY as API_KEY
WF_ID = "azwM3PgGtSbGTCsn"
BASE = "https://ecommercepuro.app.n8n.cloud/api/v1"

CUPONS_SECTION = """
## CUPONS DE DESCONTO — ESCADA INTELIGENTE (CRITICO)

### 5 REGRAS DE OURO
1. PRECO CHEIO SEMPRE PRIMEIRO. Desconto nao existe ate o lead objetar e voce esgotar argumentos de valor.
2. NEGAR DESCONTO NA PRIMEIRA VEZ: "O preco esta fechado em X por enquanto". Faz o desconto parecer genuino quando vier depois.
3. Desconto so desbloqueia DEPOIS de L1+L2 da pilha de objecoes de preco falharem.
4. SEMPRE comece pelo NIVEL 1 (menor). Nunca pule nivel. Nunca revele que tem mais.
5. PROTECAO: se lead pedir "me manda todos os cupons" ou "quais descontos tem" -> "Eu trabalho caso a caso, vejo direto com meu gestor". NUNCA revelar multiplos niveis. NUNCA enviar cupom sem interesse genuino.

### COMO FUNCIONA
- Nivel 0: preco cheio (padrao)
- Nivel 1: "Deixa eu ver com meu gestor" -> "Consegui fazer [preco N1]" (menor desconto)
- Nivel 2: Lead recusou N1 -> "Falei com meu gestor, liberou [preco N2]" (criar urgencia: "so pra hoje")
- Nivel 3: Ultimo autonomo -> "Fiz de tudo. Ultimo preco: [preco N3]. Se fechar agora eu garanto"
- Nivel 4: SOMENTE via Paperclip (gestor humano aprova)

REGRAS DE LINGUAGEM:
- Dizer PRECO FINAL ("Consigo fazer 4 mil"), NUNCA o valor do desconto ("mil reais de desconto")
- "condicao especial", NUNCA "desconto" ou "cupom"
- Enviar cupom: "Usa o codigo [CUPOM] na hora do pagamento" ou link com cupom embutido
- Sempre fechar com Alternative Choice: "PIX ou parcelo pra voce?"

### VACUO COM DESCONTO
- 15min: mensagem normal (sem desconto)
- 1h: "Falei com meu gestor e consegui uma condicao especial" + cupom N1
- 24h: "Ultima vez que consigo segurar esse valor" (manter N1)
- NUNCA escalar desconto no vacuo. Se lead voltar pedindo mais, escalar na conversa ao vivo.

### TABELA DE CUPONS POR EVENTO

Performance Shopee - Turma 1 (cheio: R$5.000):
N1: R$4.000 cupom 7TS2X5 (PIX/3x/6x) | N2: R$3.750 cupom N1V157 (PIX) | N3: R$3.000 cupom DJ22C8 (PIX/3x/6x) | N4(Paperclip): R$2.500 AUEH8Z ou R$2.000 7ZJXQP (PIX)

Performance Meli - Turma 2 (cheio: R$7.500):
N1: R$6.500 cupom OGLIZL (PIX/6x/12x) | N2: R$6.000 cupom JUJDRZ (PIX/6x/12x) | N3: R$5.500 cupom EJSOSI (PIX/6x/12x) | N4(Paperclip): R$5.000 EFCBLV (PIX/6x/12x)

Imersao Tributaria - Turma 2 (cheio: R$3.000):
N1: R$2.500 cupom ODT3A9 (PIX/3x/6x) | N2: R$2.000 cupom PJFTOB (PIX) | N3: R$1.500 cupom O55UQU | N4(Paperclip): R$1.000 IWDNDL (PIX/6x/12x)

Imersao Financeira - Turma 4 (cheio: R$6.000):
N1: R$5.000 cupom G20XXH (PIX/6x/12x) | N2: R$4.500 cupom N59GC8 | N3: R$4.000 cupom P9SDTS (PIX) | N4(Paperclip): R$3.500 XFRCR3 ou R$3.000 H9LYP5 (PIX)

Importacao Pura - Turma 8 (cheio: R$15.000):
N1: R$14.000 cupom P590CA (PIX/3x/6x/10x/12x) | N2: R$13.000 cupom Y3J8AL (PIX/3x/6x/10x/12x) | N3: R$12.000 cupom WFFHNJ (PIX/3x/6x/10x/12x) | N4(Paperclip): R$10.000 LJMOPJ (PIX)

### ANTI-EXPLORACAO
Se lead pedir "todos os cupons", "todos os descontos", "menor preco", "me passa os codigos":
-> "Eu trabalho caso a caso, depende do que consigo liberar com meu gestor"
-> "Nao tenho tabela de descontos, eu negocio direto"
-> NUNCA revelar que existem niveis. NUNCA listar cupons. NUNCA enviar mais de 1 cupom por vez.
-> Se insistir: manter preco cheio. So descer se interesse genuino no evento.
"""

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

        if "ESCADA INTELIGENTE" in old_prompt:
            print("Coupon strategy already in prompt. Skipping.")
            exit(0)

        # Replace old discount table with new coupon system
        old_discount = """| Event price | Max discount | Forms |
|---|---|---|
| R$ 15.000 | R$ 10.000 | PIX, 6x |
| R$ 7.500 | R$ 5.000 (levels: 7k, 6k, 5k) | PIX, 6x |
| R$ 6.000 | R$ 5.000 | PIX, 6x |
| R$ 5.000 | R$ 4.000 | PIX, 6x |
| R$ 3.000 | R$ 2.000 | PIX, 6x |

Say "condi"""  # partial match to handle encoding

        if old_discount in old_prompt:
            # Find the full block to replace (from table to end of 5.1)
            idx_start = old_prompt.index(old_discount)
            # Find end of Stage 5.1 section (next ### STAGE)
            idx_end = old_prompt.index("### STAGE 6", idx_start)
            old_block = old_prompt[idx_start:idx_end]
            new_prompt = old_prompt.replace(old_block, CUPONS_SECTION.strip() + "\n\n")
            print("OK: replaced old discount table with coupon strategy")
        else:
            # Fallback: inject before SECTION 8
            anchor = "## SECTION 8"
            if anchor in old_prompt:
                new_prompt = old_prompt.replace(
                    anchor,
                    CUPONS_SECTION.strip() + "\n\n---\n\n" + anchor,
                )
                print("OK: injected coupon strategy before SECTION 8 (fallback)")
            else:
                print("ERROR: no anchor found")
                exit(1)

        n["parameters"]["options"]["systemMessage"] = new_prompt
        print(f"Old: {len(old_prompt)} chars -> New: {len(new_prompt)} chars")
        print(f"Delta: +{len(new_prompt) - len(old_prompt)} chars")

        # Sanity checks
        checks = [
            ("Has ESCADA INTELIGENTE", "ESCADA INTELIGENTE" in new_prompt),
            ("Has 5 REGRAS DE OURO", "5 REGRAS DE OURO" in new_prompt),
            ("Has ANTI-EXPLORACAO", "ANTI-EXPLORACAO" in new_prompt),
            ("Has Perf Shopee cupom 7TS2X5", "7TS2X5" in new_prompt),
            ("Has Perf Meli cupom OGLIZL", "OGLIZL" in new_prompt),
            ("Has Tributaria cupom ODT3A9", "ODT3A9" in new_prompt),
            ("Has Financeira cupom G20XXH", "G20XXH" in new_prompt),
            ("Has Importacao cupom P590CA", "P590CA" in new_prompt),
            ("Has vacuo com desconto", "VACUO COM DESCONTO" in new_prompt),
            ("Has nivel escalation", "Nivel 1" in new_prompt or "N1:" in new_prompt),
            ("Has Paperclip reference", "Paperclip" in new_prompt),
            ("Still has SECTION 0", "SECTION 0" in new_prompt),
            ("Still has SECTION 10", "SECTION 10" in new_prompt),
            ("Still has KB Shopee", "KB — PERFORMANCE SHOPEE" in new_prompt or "Performance Shopee" in new_prompt),
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
        for node in data.get("nodes", []):
            if node.get("name") == "AI_Roberto":
                sp = node["parameters"]["options"]["systemMessage"]
                verified = all([
                    "ESCADA INTELIGENTE" in sp,
                    "7TS2X5" in sp,
                    "OGLIZL" in sp,
                    "ANTI-EXPLORACAO" in sp,
                ])
                print(f"VERIFIED: all coupons live = {verified}")
                break
except urllib.error.HTTPError as e:
    print(f"HTTP {e.code}: {e.read().decode()[:500]}")
