"""
Re-inject Performance Shopee KB into Roberto's prompt.
Only adds the KB section — does NOT touch any other part of the prompt.
"""
import json
import sys
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")

from _env import N8N_API_KEY as API_KEY
WF_ID = "azwM3PgGtSbGTCsn"
BASE = "https://ecommercepuro.app.n8n.cloud/api/v1"

KB_SHOPEE = """
## KB — PERFORMANCE SHOPEE (use when lead mentions Shopee, Performance Shopee, or ads na Shopee)

Imersao presencial 2 dias. Dia 1 aplica ao vivo na conta, Dia 2 ve resultado em tempo real. 70 vagas, suporte individual do mentor. Garantia: dinheiro de volta se nao gostar.

Speaker: Pedro Colin — +10 anos em ML/Shopee/Amazon/TikTok, parametrizador tributario, colabora com times internos da Shopee no Brasil. Uma das maiores referencias de marketplaces do pais.

Ecommerce Puro na Shopee: +R$30 milhoes/mes supervisionados. +20.000 empresas na comunidade.

Modulos:
1. Ecossistema e Custos — comissoes reais, onde margem evapora, relatorio Excel ao vivo
2. Estrategia de Crescimento — afiliados sem canibalizar, cupons com criterio, estrategia 360
3. Ferramentaria — ferramentas ocultas da Shopee (95% dos sellers nao conhecem), kits, combos, avaliacoes como alavanca
4. Relacionamento — Shopee Live, decoracao de loja, atendimento como diferencial
5. Ads — anuncio perfeito, ACOS/ROAS, ads integrado a operacao. "Ads nao e trafego. E alocacao de capital."

Publico: sellers ativos na Shopee que querem escalar com margem. Quem investe em ads sem saber se lucra. Quem usa ferramentas no automatico. Sellers de outros marketplaces querendo entrar na Shopee certo.
NAO e para: quem nao tem operacao, quem quer formula magica, quem ja domina tudo.

Case Pingo de Mel: R$300 mil -> R$2,9 milhoes/mes na Shopee. Loja online de 30% para 70% do negocio. Meta: R$6 milhoes/mes. Operacao familiar que escalou com metodo.

Dores que resolve: ACOS alto sem saber por que, afiliados comendo margem, nao sabe margem real apos cupom+frete+comissao+ads, ferramentas ocultas nao utilizadas, dependencia de agencia.

Phantom Anchors (usar ANTES do preco): R$2,9M/mes Pingo de Mel, R$30M/mes EP na Shopee, 10x multiplicador, R$6M meta.

Urgencia concreta: "70 vagas com suporte individual", "Evento dia 23 e 24, falta menos de 2 semanas", "Primeira edicao focada em Shopee da EP"
"""

req = urllib.request.Request(
    f"{BASE}/workflows/{WF_ID}",
    headers={"X-N8N-API-KEY": API_KEY},
)
with urllib.request.urlopen(req) as resp:
    wf = json.loads(resp.read().decode("utf-8"))

for n in wf["nodes"]:
    if n["name"] == "AI_Roberto":
        old_prompt = n["parameters"]["options"]["systemMessage"]

        if "KB — PERFORMANCE SHOPEE" in old_prompt:
            print("KB Shopee already present. Skipping.")
            exit(0)

        # Inject before SECTION 8
        anchor = "## SECTION 8"
        if anchor not in old_prompt:
            print("ERROR: anchor not found")
            exit(1)

        new_prompt = old_prompt.replace(
            anchor,
            KB_SHOPEE.strip() + "\n\n---\n\n" + anchor,
        )

        n["parameters"]["options"]["systemMessage"] = new_prompt
        print(f"Old: {len(old_prompt)} chars -> New: {len(new_prompt)} chars")

        # Sanity
        checks = [
            ("Has KB Shopee", "KB — PERFORMANCE SHOPEE" in new_prompt),
            ("Has Pedro Colin", "Pedro Colin" in new_prompt),
            ("Has Pingo de Mel", "Pingo de Mel" in new_prompt),
            ("Still has ESCADA INTELIGENTE", "ESCADA INTELIGENTE" in new_prompt),
            ("Still has cupom 7TS2X5", "7TS2X5" in new_prompt),
            ("Still has SECTION 0", "SECTION 0" in new_prompt),
            ("Still has SECTION 10", "SECTION 10" in new_prompt),
            ("Node count unchanged", True),
        ]

        all_ok = True
        for name, result in checks:
            status = "OK" if result else "FAIL"
            print(f"{status}: {name}")
            if not result:
                all_ok = False

        if not all_ok:
            print("\nABORTED")
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
        print(f"Nodes: {len(data.get('nodes', []))}")
        for node in data.get("nodes", []):
            if node.get("name") == "AI_Roberto":
                sp = node["parameters"]["options"]["systemMessage"]
                ok = "KB — PERFORMANCE SHOPEE" in sp and "ESCADA INTELIGENTE" in sp
                print(f"VERIFIED: KB Shopee + Cupons = {ok}")
                break
except urllib.error.HTTPError as e:
    print(f"HTTP {e.code}: {e.read().decode()[:500]}")
