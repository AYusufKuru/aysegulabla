/**
 * engine.ts — Excel “AHP ve BSS” hesap motoru.
 *
 * Bu dosya ekran çizmez; sayı üretir. main.ts her yenilemede
 * compute(seed, state) çağırır. Sonuç Computed paketidir.
 *
 * Akış (Excel’deki sırayla):
 *  1) Her AHP matrisi ahp() → yerel ağırlık (toplamı 1)
 *  2) 1–5 puan → 100’lük skala: 100*(x−1)/4     (R/S/T sütunu)
 *  3) Senaryoya göre global ve yerel ağırlık
 *  4) SS (bss)      = Σ skala × global           → satır 92
 *     blok skoru    = Σ skala × yerel            → satır 93–96
 *     SS Sağlama    = Σ blok × W_ana             → satır 97 (SS ile örtüşmeli)
 *
 * Sözlük:
 *   const sc = ...  → “sc” adlı kutu. Bu dosyada iki anlamda kullanılır:
 *                     (a) bir göstergenin 1–5 puanları {CYL,KRC,GZL}
 *                     (b) senaryo tanımı (S1, S2, …)  — dikkat, aynı kısaltma.
 *   return { ... }  → fonksiyonun dışarı verdiği nesne / sayı.
 *   for (const x of liste) → listedeki her eleman için döngü.
 */
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

/** S1 canlı AHP; S2 makale ağırlığı; S3–S10 blok karışımı sabit. */
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

/** S3–S10’da AHP ana blok yerine bu sabit karışımlar kullanılır. */
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

/**
 * Likert 1–5 → 0–100. Excel R/S/T.
 * 1→0, 3→50, 5→100. Formül: 100*(x−1)/4
 * Math.min/max: 1’in altı 1, 5’in üstü 5 sayılır.
 */
export function to100(score: number): number {
  const x = Math.min(5, Math.max(1, score))
  return (100 * (x - 1)) / 4
}

/** Sayıyı Türkçe biçimle yaz (72,50). d = ondalık basamak. */
export function fmt(n: number, d = 2): string {
  return n.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d })
}

/** 0,253 gibi oranı yüzde metnine çevirir → "25,3%". */
export function fmtPct(n: number): string {
  return `${(n * 100).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}%`
}

/**
 * Tüm paneli besleyen tek hesap.
 * seed = Excel kopyası (88 gösterge, 19 matris).
 * state = kullanıcının değiştirdiği puan + üst üçgen.
 */
export function compute(seed: Seed, state: AppState): Computed {
  // 1) Her matris için ahp(üst üçgen) → weights, CR, …
  const matrix: Record<string, AhpResult> = {}
  for (const m of seed.matrices) {
    // Kullanıcı kaydı yoksa seed’deki Excel üst üçgeni.
    const upper = state.matrices[m.id] ?? m.upper
    matrix[m.id] = ahp(upper)
  }

  /**
   * Ana blok ağırlıkları.
   * BLOCKS sırası E,S,G,FO → AHP weights dizisinin 0,1,2,3. indeksi.
   * Object.fromEntries: [["E",0.3],["S",0.2],…] → { E:0.3, S:0.2, … }
   */
  const wBlockNew = Object.fromEntries(
    BLOCKS.map((b, i) => [b, matrix.blocks_new.weights[i] ?? 0]),
  ) as Record<BlockId, number>
  const wBlockArt = Object.fromEntries(
    BLOCKS.map((b, i) => [b, matrix.blocks_article.weights[i] ?? 0]),
  ) as Record<BlockId, number>

  // Alt grup yerel ağırlığı (blok içi toplam 1).
  const wSub: Record<string, number> = {}
  for (const m of seed.matrices.filter((x) => x.kind === "subs")) {
    // Bu matrisin bloğundaki alt gruplar, matris satır sırasıyla aynı hizada.
    const subs = seed.subgroups.filter((s) => s.block === m.block)
    subs.forEach((s, i) => {
      wSub[s.id] = matrix[m.id].weights[i] ?? 0
    })
  }

  // Gösterge yerel ağırlığı wk (alt grup içi toplam 1).
  const wInd: Record<number, number> = {}
  for (const m of seed.matrices.filter((x) => x.kind === "inds")) {
    const inds = seed.indicators.filter((i) => i.subId === m.subId)
    inds.forEach((ind, i) => {
      wInd[ind.id] = matrix[m.id].weights[i] ?? 0
    })
  }

  // Alt grup id → nesne (nInd, nSubInBlock eşit ağırlıkta lazım).
  const subById = Object.fromEntries(seed.subgroups.map((s) => [s.id, s]))

  // 2) Ham 1–5 → 100’lük. sc = o göstergenin üç işletme puanı.
  const scale: Record<number, Record<CompanyId, number>> = {}
  for (const ind of seed.indicators) {
    const sc = state.scores[ind.id] ?? ind.scores
    scale[ind.id] = {
      CYL: to100(sc.CYL),
      KRC: to100(sc.KRC),
      GZL: to100(sc.GZL),
    }
  }

  /**
   * Bir göstergenin senaryodaki ağırlıkları.
   *
   * global: BSS’ye (satır 92) giren Wt = ana blok × alt × gösterge (tarife göre).
   * local:  blok skoruna (93–96) giren; ana blok çarpanı YOK.
   * Excel: U = R*J (global), V = R*K (local).
   *
   * S1: canlı AHP üç düzey.
   * S2: makale ana blok × makale yerel (articleLocal).
   * S3: eşit ana blok, alt+gösterge AHP.
   * S4: eşit ana + eşit alt, gösterge AHP.
   * S5: üç düzey eşit (1/nSub * 1/nInd).
   * S6–S10: FIXED_BLOCKS karışımı × AHP yerel.
   */
  const weightFor = (
    recipe: string,
    ind: (typeof seed.indicators)[number],
  ): { global: number; local: number } => {
    const sub = subById[ind.subId]
    const eqSub = 1 / sub.nSubInBlock // o blokta n alt grup varsa her biri 1/n
    const eqInd = 1 / sub.nInd // o alt grupta n gösterge varsa her biri 1/n
    const ahpSub = wSub[ind.subId] ?? 0
    const ahpInd = wInd[ind.id] ?? 0
    const ahpLocal = ahpSub * ahpInd // Excel’deki yerel (K sütunu benzeri)

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

  /** SS Sağlama’da kullanılan ana blok karışımı (W_E, W_S, W_G, W_FO). */
  const blockMix = (recipe: string): Record<BlockId, number> => {
    if (recipe === "S1") return wBlockNew
    if (recipe === "S2") return wBlockArt
    return FIXED_BLOCKS[recipe] ?? { E: 0, S: 0, G: 0, FO: 0 }
  }

  // Toplam puan = 88 göstergenin 1–5 toplamı (ağırlıksız, max 440).
  const totalRaw = { CYL: 0, KRC: 0, GZL: 0 } as Record<CompanyId, number>
  for (const ind of seed.indicators) {
    const sc = state.scores[ind.id] ?? ind.scores
    for (const co of COMPANIES) totalRaw[co] += sc[co]
  }

  /**
   * 3–4) Her senaryo × her işletme.
   * sc burada senaryo tanımı (S1…S10), skor değil.
   *
   * İç döngü 88 gösterge:
   *   bss   += 100’lük × global     → satır 92
   *   blok  += 100’lük × local      → satır 93–96 (E/S/G/FO ayrı kova)
   * ssCheck = Σ blokSkor × anaBlokAğırlığı → satır 97
   */
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
      // reduce: E,S,G,FO’yu sırayla toplayarak tek SS Sağlama sayısı.
      const ssCheck = BLOCKS.reduce((sum, b) => sum + blocks[b] * mix[b], 0)
      byCo[co] = { bss, ssCheck, blocks }
    }
    scenarios[sc.id] = byCo
  }

  // BSS büyükten küçüğe işletme id listesi. b − a > 0 ise b önde.
  const ranking: Record<string, CompanyId[]> = {}
  for (const sc of SCENARIOS) {
    ranking[sc.id] = [...COMPANIES].sort(
      (a, b) => scenarios[sc.id][b].bss - scenarios[sc.id][a].bss,
    )
  }

  // CR > 0,10 olan matrisler (Saaty eşiği). Özet sayfasındaki uyarı listesi.
  const crAlerts = seed.matrices
    .map((m) => ({ id: m.id, title: m.title, cr: matrix[m.id].cr }))
    .filter((x) => x.cr > 0.1)

  // compute’un dışarı verdiği paket. Ekranlar bunları okur.
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
