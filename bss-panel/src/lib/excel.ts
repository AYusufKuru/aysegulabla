import type { AppState, BlockId, CompanyId, Computed, Seed } from "../types"
import { BLOCKS, COMPANIES, compute, SCENARIOS } from "./engine"
import { persist, type SaveMeta } from "./store"
import {
  colA1,
  loadTemplateZip,
  patchWorkbookView,
  readXml,
  saveTemplateZip,
  setNumber,
  setText,
  sheetFiles,
  writeXml,
} from "./xlsxPatch"

const MATRIX_SHEETS: Record<string, { sheet: string; origin: number; n: number }> = {
  blocks_article: { sheet: "ESG_FO_Makale", origin: 9, n: 4 },
  blocks_new: { sheet: "ESG_FO_AnaBlok", origin: 9, n: 4 },
  e_subs: { sheet: "E_AltGruplar", origin: 8, n: 4 },
  s_subs: { sheet: "S_AltGruplar", origin: 8, n: 3 },
  g_subs: { sheet: "G_AltGruplar", origin: 8, n: 2 },
  fo_subs: { sheet: "FO_AltGruplar", origin: 8, n: 4 },
  e_enerji_ind: { sheet: "E_EnerjiEmis", origin: 8, n: 7 },
  e_su_ind: { sheet: "E_SuYonetim", origin: 8, n: 7 },
  e_biyo_ind: { sheet: "E_BiyoToprak", origin: 8, n: 5 },
  e_atik_ind: { sheet: "E_AtikKimya", origin: 8, n: 7 },
  s_isgucu_ind: { sheet: "S_IsgucuIst", origin: 8, n: 9 },
  s_calisma_ind: { sheet: "S_CalismaKos", origin: 8, n: 8 },
  s_toplum_ind: { sheet: "S_ToplumKor", origin: 8, n: 3 },
  g_uyum_ind: { sheet: "G_UyumPolit", origin: 8, n: 12 },
  g_tedarik_ind: { sheet: "G_TedarikRisk", origin: 8, n: 7 },
  fo_finans_ind: { sheet: "FO_Finansal", origin: 8, n: 6 },
  fo_oper_ind: { sheet: "FO_Operasyonel", origin: 8, n: 5 },
  fo_hayvan_ind: { sheet: "FO_Hayvancilik", origin: 8, n: 8 },
  fo_bitki_ind: { sheet: "FO_BitkiselU", origin: 8, n: 4 },
}

const NAMES: Record<CompanyId, string> = {
  CYL: "Ceylanpınar",
  KRC: "Karacabey",
  GZL: "Gözlü",
}

const CODES: Record<CompanyId, string> = {
  CYL: "CYP",
  KRC: "KRC",
  GZL: "GZL",
}

function mixPct(w: Record<BlockId, number>): string {
  return BLOCKS.map((b) => Math.round(w[b] * 100)).join(":")
}

function tr4(n: number): string {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })
}

function deltaText(n: number): string {
  const abs = tr4(Math.abs(n))
  if (n > 0.00005) return `▲${abs}`
  if (n < -0.00005) return `▼${abs}`
  return abs
}

function patchAhb(xml: string, seed: Seed, state: AppState): string {
  let out = xml
  for (const ind of seed.indicators) {
    const row = 3 + ind.id
    const sc = state.scores[ind.id] ?? ind.scores
    const cm = state.comments[ind.id] ?? ind.comments
    out = setNumber(out, `M${row}`, sc.CYL)
    out = setNumber(out, `O${row}`, sc.KRC)
    out = setNumber(out, `Q${row}`, sc.GZL)
    out = setText(out, `L${row}`, cm.CYL ?? "")
    out = setText(out, `N${row}`, cm.KRC ?? "")
    out = setText(out, `P${row}`, cm.GZL ?? "")
  }
  return out
}

function patchMatrix(xml: string, upper: number[][], origin: number): string {
  let out = xml
  for (let i = 0; i < upper.length; i++) {
    for (let k = 0; k < upper[i].length; k++) {
      const col = 4 + i + k
      const row = origin + i
      out = setNumber(out, `${colA1(col)}${row}`, upper[i][k])
    }
  }
  return out
}

function patchScenarios(xml: string, computed: Computed): string {
  let out = xml
  out = setText(out, "C1", mixPct(computed.wBlockNew))
  out = setText(out, "D1", mixPct(computed.wBlockArt))
  SCENARIOS.forEach((sc, i) => {
    const col = colA1(3 + i)
    const rank = computed.ranking[sc.id]
    out = setText(out, `${col}18`, CODES[rank[0]])
    out = setText(out, `${col}19`, CODES[rank[1]])
    out = setText(out, `${col}20`, CODES[rank[2]])
  })
  return out
}

function patchYorum(xml: string, computed: Computed): string {
  let out = xml
  SCENARIOS.forEach((sc, i) => {
    const row = 3 + i
    const rank = computed.ranking[sc.id]
    out = setText(out, `C${row}`, NAMES[rank[0]])
    out = setText(out, `D${row}`, NAMES[rank[1]])
    out = setText(out, `E${row}`, NAMES[rank[2]])
  })
  COMPANIES.forEach((co, i) => {
    const scores = SCENARIOS.map((sc) => computed.scenarios[sc.id][co].bss)
    const min = Math.min(...scores)
    const max = Math.max(...scores)
    const avg = scores.reduce((s, x) => s + x, 0) / scores.length
    const row = 21 + i
    out = setNumber(out, `B${row}`, Number(min.toFixed(4)))
    out = setNumber(out, `C${row}`, Number(max.toFixed(4)))
    out = setNumber(out, `D${row}`, Number((max - min).toFixed(4)))
    out = setNumber(out, `E${row}`, Number(avg.toFixed(4)))
  })
  const rest = SCENARIOS.slice(1)
  rest.forEach((sc, i) => {
    const row = 33 + i
    for (const [j, co] of COMPANIES.entries()) {
      const d = computed.scenarios[sc.id][co].bss - computed.scenarios.S1[co].bss
      out = setText(out, `${colA1(2 + j)}${row}`, deltaText(d))
    }
  })
  return out
}

export async function downloadExcel(seed: Seed, state: AppState): Promise<SaveMeta> {
  const savedAt = new Date().toISOString()
  const computed = compute(seed, state)
  const files = await loadTemplateZip()
  const wbPath = "xl/workbook.xml"
  const relsPath = "xl/_rels/workbook.xml.rels"
  const paths = sheetFiles(readXml(files, wbPath), readXml(files, relsPath))
  writeXml(files, wbPath, patchWorkbookView(readXml(files, wbPath)))

  const ahpPath = paths["AHP ve BSS"]
  if (ahpPath) writeXml(files, ahpPath, patchAhb(readXml(files, ahpPath), seed, state))

  for (const [id, meta] of Object.entries(MATRIX_SHEETS)) {
    const path = paths[meta.sheet]
    const upper = state.matrices[id]
    if (!path || !upper) continue
    writeXml(files, path, patchMatrix(readXml(files, path), upper, meta.origin))
  }

  const scPath = paths["Senaryolar ve Skorlar"]
  if (scPath) writeXml(files, scPath, patchScenarios(readXml(files, scPath), computed))

  const yPath = paths["YORUM"]
  if (yPath) writeXml(files, yPath, patchYorum(readXml(files, yPath), computed))

  saveTemplateZip(files, "TEZ puanlama_hesaplama_AHP_Senaryolar.xlsx")
  persist(state, "file")
  return { savedAt, source: "file" }
}
