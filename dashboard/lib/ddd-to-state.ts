/**
 * Maps Brazilian DDD (area codes) to state abbreviations.
 * Used to determine lead location from phone number.
 */

const DDD_MAP: Record<string, string> = {
  // São Paulo
  "11": "SP", "12": "SP", "13": "SP", "14": "SP", "15": "SP",
  "16": "SP", "17": "SP", "18": "SP", "19": "SP",
  // Rio de Janeiro
  "21": "RJ", "22": "RJ", "24": "RJ",
  // Espírito Santo
  "27": "ES", "28": "ES",
  // Minas Gerais
  "31": "MG", "32": "MG", "33": "MG", "34": "MG", "35": "MG",
  "37": "MG", "38": "MG",
  // Paraná
  "41": "PR", "42": "PR", "43": "PR", "44": "PR", "45": "PR", "46": "PR",
  // Santa Catarina
  "47": "SC", "48": "SC", "49": "SC",
  // Rio Grande do Sul
  "51": "RS", "53": "RS", "54": "RS", "55": "RS",
  // Distrito Federal
  "61": "DF",
  // Goiás
  "62": "GO", "64": "GO",
  // Tocantins
  "63": "TO",
  // Mato Grosso
  "65": "MT", "66": "MT",
  // Mato Grosso do Sul
  "67": "MS",
  // Acre
  "68": "AC",
  // Rondônia
  "69": "RO",
  // Bahia
  "71": "BA", "73": "BA", "74": "BA", "75": "BA", "77": "BA",
  // Sergipe
  "79": "SE",
  // Pernambuco
  "81": "PE", "87": "PE",
  // Alagoas
  "82": "AL",
  // Paraíba
  "83": "PB",
  // Rio Grande do Norte
  "84": "RN",
  // Ceará
  "85": "CE", "88": "CE",
  // Piauí
  "86": "PI", "89": "PI",
  // Pará
  "91": "PA", "93": "PA", "94": "PA",
  // Amazonas
  "92": "AM", "97": "AM",
  // Roraima
  "95": "RR",
  // Amapá
  "96": "AP",
  // Maranhão
  "98": "MA", "99": "MA",
};

const STATE_NAMES: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas",
  BA: "Bahia", CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo",
  GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul",
  MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná",
  PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte", RS: "Rio Grande do Sul",
  RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina",
  SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};

export function extractDDD(phone: string): string | null {
  const clean = phone.replace(/\D/g, "");
  // Brazilian format: 55 + DDD (2 digits) + number
  // Phone might be: 55XXYYYYYYYYY, +55XXYYYYYYYYY, etc.
  if (clean.startsWith("55") && clean.length >= 12) {
    return clean.substring(2, 4);
  }
  // Maybe just DDD + number
  if (clean.length >= 10 && clean.length <= 11) {
    return clean.substring(0, 2);
  }
  return null;
}

export function getStateFromPhone(phone: string): string | null {
  const ddd = extractDDD(phone);
  if (!ddd) return null;
  return DDD_MAP[ddd] ?? null;
}

export function getStateName(abbreviation: string): string {
  return STATE_NAMES[abbreviation] ?? abbreviation;
}

export interface StateLeadCount {
  state: string;
  name: string;
  count: number;
}

export function countLeadsByState(phones: string[]): StateLeadCount[] {
  const counts = new Map<string, number>();

  for (const phone of phones) {
    const state = getStateFromPhone(phone);
    if (state) {
      counts.set(state, (counts.get(state) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([state, count]) => ({
      state,
      name: getStateName(state),
      count,
    }))
    .sort((a, b) => b.count - a.count);
}

export { STATE_NAMES };
