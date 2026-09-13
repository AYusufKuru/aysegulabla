import type {
  AhpResult,
  AppState,
  BlockId,
  CompanyId,
  CompanyResult,
  Computed,
  ScenarioDef,
  Seed,
} from "../types"
import { ahp } from "./ahp"

export const COMPANIES: CompanyId[] = ["CYL", "KRC", "GZL"]
export const BLOCKS: BlockId[] = ["E", "S", "G", "FO"]

export const SCENARIOS: ScenarioDef[] = [
  { id: "S1", name: "Yeni AHP", mix: "AHP blok + alt grup + gösterge", note: "Canlı AHP ağırlıkları" },
  { id: "S2", name: "Makale", mix: "Makale blok × makale yerel", note: "Makaledeki ağırlık seti" },
  { id: "S3", name: "Eşit blok", mix: "25:25:25:25 · alt/gösterge AHP", note: "Ana bloklar eşit" },
  { id: "S4", name: "Eşit blok + alt grup", mix: "Blok ve alt grup eşit · gösterge AHP", note: "İki üst düzey eşit" },
  { id: "S5", name: "Tüm düzeyler eşit", mix: "Blok, alt grup ve gösterge eşit", note: "Tam eşitlik" },
  { id: "S6", name: "Çevre öncelikli", mix: "40:20:20:20", note: "E ağırlığı artırıldı" },
  { id: "S7", name: "Sosyal öncelikli", mix: "20:40:20:20", note: "S ağırlığı artırıldı" },
  { id: "S8", name: "Yönetişim öncelikli", mix: "20:20:40:20", note: "G ağırlığı artırıldı" },
  { id: "S9", name: "FO öncelikli", mix: "20:20:20:40", note: "FO ağırlığı artırıldı" },
  { id: "S10", name: "ESG modeli", mix: "34:33:33:0", note: "FO hariç klasik ESG" },
]

const FIXED_BLOCKS: Record<string, Record<BlockId, number>> = {
  S3: { E: 0.25, S: 0.25, G: 0.25, FO: 0.25 },
  S4: { E: 0.25, S: 0.25, G: 0.25, FO: 0.25 },
  S5: { E: 0.25, S: 0.25, G: 0.25, FO: 0.25 },
  S6: { E: 0.4, S: 0.2, G: 0.2, FO: 0.2 },
  S7: { E: 0.2, S: 0.4, G: 0.2, FO: 0.2 },
  S8: { E: 0.2, S: 0.2, G: 0.4, FO: 0.2 },
  S9: { E: 0.2, S: 0.2, G: 0.2, FO: 0.4 },
  S10: { E: 0.34, S: 0.33, G: 0.33, FO: 0 },
}

export function to100(score: number): number {
  const x = Math.min(5, Math.max(1, score))
  return (100 * (x - 1)) / 4
}

export function fmt(n: number, d = 2): string {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d })
}

export function fmtPct(n: number): string {
  return `${(n * 100).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}%`
}

export function compute(seed: Seed, state: AppState): Computed {
  const matrix: Record<string, AhpResult> = {}
  for (const m of seed.matrices) {
    const upper = state.matrices[m.id] ?? m.upper
    matrix[m.id] = ahp(upper)
  }

  const wBlockNew = Object.fromEntries(
    BLOCKS.map((b, i) => [b, matrix.blocks_new.weights[i] ?? 0]),
  ) as Record<BlockId, number>
  const wBlockArt = Object.fromEntries(
    BLOCKS.map((b, i) => [b, matrix.blocks_article.weights[i] ?? 0]),
  ) as Record<BlockId, number>

  const wSub: Record<string, number> = {}
  for (const m of seed.matrices.filter((x) => x.kind === "subs")) {
    const subs = seed.subgroups.filter((s) => s.block === m.block)
    subs.forEach((s, i) => {
      wSub[s.id] = matrix[m.id].weights[i] ?? 0
    })
  }

  const wInd: Record<number, number> = {}
  for (const m of seed.matrices.filter((x) => x.kind === "inds")) {
    const inds = seed.indicators.filter((i) => i.subId === m.subId)
    inds.forEach((ind, i) => {
      wInd[ind.id] = matrix[m.id].weights[i] ?? 0
    })
  }

  const subById = Object.fromEntries(seed.subgroups.map((s) => [s.id, s]))

  const scale: Record<number, Record<CompanyId, number>> = {}
  for (const ind of seed.indicators) {
    const sc = state.scores[ind.id] ?? ind.scores
    scale[ind.id] = {
      CYL: to100(sc.CYL),
      KRC: to100(sc.KRC),
      GZL: to100(sc.GZL),
    }
  }

  const weightFor = (
    recipe: string,
    ind: (typeof seed.indicators)[number],
  ): { global: number; local: number } => {
    const sub = subById[ind.subId]
    const eqSub = 1 / sub.nSubInBlock
    const eqInd = 1 / sub.nInd
    const ahpSub = wSub[ind.subId] ?? 0
    const ahpInd = wInd[ind.id] ?? 0
    const ahpLocal = ahpSub * ahpInd

    if (recipe === "S1") {
      return { global: wBlockNew[ind.block] * ahpLocal, local: ahpLocal }
    }
    if (recipe === "S2") {
      return { global: wBlockArt[ind.block] * ind.articleLocal, local: ind.articleLocal }
    }
    if (recipe === "S3") {
      const b = FIXED_BLOCKS.S3[ind.block]
      return { global: b * ahpLocal, local: ahpLocal }
    }
    if (recipe === "S4") {
      const b = FIXED_BLOCKS.S4[ind.block]
      const local = eqSub * ahpInd
      return { global: b * local, local }
    }
    if (recipe === "S5") {
      const b = FIXED_BLOCKS.S5[ind.block]
      const local = eqSub * eqInd
      return { global: b * local, local }
    }
    const fb = FIXED_BLOCKS[recipe]
    if (fb) {
      return { global: fb[ind.block] * ahpLocal, local: ahpLocal }
    }
    return { global: 0, local: 0 }
  }

  const blockMix = (recipe: string): Record<BlockId, number> => {
    if (recipe === "S1") return wBlockNew
    if (recipe === "S2") return wBlockArt
    return FIXED_BLOCKS[recipe] ?? { E: 0, S: 0, G: 0, FO: 0 }
  }

  const totalRaw = { CYL: 0, KRC: 0, GZL: 0 } as Record<CompanyId, number>
  for (const ind of seed.indicators) {
    const sc = state.scores[ind.id] ?? ind.scores
    for (const co of COMPANIES) totalRaw[co] += sc[co]
  }

  const scenarios: Record<string, Record<CompanyId, CompanyResult>> = {}
  for (const sc of SCENARIOS) {
    const mix = blockMix(sc.id)
    const byCo = {} as Record<CompanyId, CompanyResult>
    for (const co of COMPANIES) {
      const blocks = { E: 0, S: 0, G: 0, FO: 0 } as Record<BlockId, number>
      let bss = 0
      for (const ind of seed.indicators) {
        const w = weightFor(sc.id, ind)
        const x = scale[ind.id][co]
        bss += x * w.global
        blocks[ind.block] += x * w.local
      }
      const ssCheck = BLOCKS.reduce((sum, b) => sum + blocks[b] * mix[b], 0)
      byCo[co] = { bss, ssCheck, blocks }
    }
    scenarios[sc.id] = byCo
  }

  const ranking: Record<string, CompanyId[]> = {}
  for (const sc of SCENARIOS) {
    ranking[sc.id] = [...COMPANIES].sort(
      (a, b) => scenarios[sc.id][b].bss - scenarios[sc.id][a].bss,
    )
  }

  const crAlerts = seed.matrices
    .map((m) => ({ id: m.id, title: m.title, cr: matrix[m.id].cr }))
    .filter((x) => x.cr > 0.1)

  return {
    matrix,
    wBlockNew,
    wBlockArt,
    wSub,
    wInd,
    scale,
    totalRaw,
    scenarios,
    ranking,
    crAlerts,
  }
}
