/**
 * =============================================================================
 *  1000 İHTİMAL — HESAP DOSYASI (lib/simulation.ts)
 * =============================================================================
 *
 *  Bu dosya ekran çizmez. Sadece sayı üretir.
 *  Ekrana basan dosya: views/simulation.ts
 *
 *  Ne yapıyoruz, düz Türkçe:
 *    Puanlama’daki 1–5 notlara dokunmayız.
 *    AHP ağırlıklarını 1000 kez rastgele atarız (AHP sayfasındaki
 *    “Tümü” butonu gibi). Her seferinde BSS, SS, bloklar ve
 *    SS Sağlama yeniden hesaplanır. Sonuç 1000 satırlık bir listedir.
 *
 *  Sayılar Excel’de neresi?
 *    BSS ve SS     satır 92   (aynı formül, iki isim)
 *    Çevre…FO      satır 93–96
 *    SS Sağlama    satır 97
 *
 *  Fonksiyonlar (sunum sırası):
 *    packFirm             bir firmanın sonucunu tablo kolonlarına çevir
 *    randomAllMatrices    19 AHP tablosunu rastgele doldur
 *    runOneTrial          tek bir rastgele dünya
 *    sampleTrialNumbers   Excel’e yazılacak 3 örnek (ilk / orta / son)
 *    runThousandTrials    bunu 1000 kez tekrarla; 3 örneği de sakla
 *    (Excel indirme: lib/simExport.ts)
 *    minMaxMean           ortalama, en küçük, en büyük, standart sapma
 *    summarizeTrials      her firma × her skor için minMaxMean
 *    histogram            BSS’leri 24 rafa böl (dağılım grafiği)
 *    firstPlaceCounts     kim kaç kez birinci
 *    sampleSeries         çizgi grafik için her 10. denemeyi al
 * =============================================================================
 */

import type {
  AppState,
  CompanyId,
  CompanyResult,
  Seed,
  SimulationFirmScores,
  SimulationSample,
  SimulationTrial,
} from "../types"
import { randomUpper } from "./ahp"
import { COMPANIES, compute } from "./engine"

/** Kaç rastgele dünya. for döngüsünün üst sınırı. */
export const TRIAL_COUNT = 1000

/**
 * 1) packFirm
 *
 * compute() bir işletme için { bss, ssCheck, blocks } verir.
 * Bu fonksiyon onu tablonun kolon adlarına çevirir.
 *
 * r.bss iki kolona yazılır: Özet’teki ad “BSS”, Senaryolar’daki ad “SS”.
 * return = { bss, ss, environment, social, governance, fo, ssCheck }
 */
export function packFirm(r: CompanyResult): SimulationFirmScores {
  return {
    bss: r.bss,
    ss: r.bss,
    environment: r.blocks.E,
    social: r.blocks.S,
    governance: r.blocks.G,
    fo: r.blocks.FO,
    ssCheck: r.ssCheck,
  }
}

/**
 * 2) randomAllMatrices
 *
 * AHP “Tümü” ile aynı iş: her matris için rastgele yerel ağırlık,
 * sonra a_ij = w_i / w_j tutarlı üst üçgen (ahp.randomUpper).
 *
 * const out = {}  → boş sözlük; anahtar matris id’si, değer üst üçgen.
 * for (const m of seed.matrices) → 19 matrisi gez.
 * m.labels.length = n (ana blokta 4, göstergede 3–12).
 * out[m.id] = [[a12, a13, …], [a23, …], …]  sıkıştırılmış üst üçgen.
 *
 * return out örneği:
 *   { blocks_new: [[2, 3, 0.5], [4, 1], [0.33], []], e_subs: … }
 */
export function randomAllMatrices(seed: Seed): Record<string, number[][]> {
  const out: Record<string, number[][]> = {}
  for (const m of seed.matrices) {
    out[m.id] = randomUpper(m.labels.length)
  }
  return out
}

/**
 * 3) runOneTrial
 *
 * Bir ihtimalin algoritması:
 *   A) scores  = Puanlama’daki 1–5 (canlı state, kopyalanmaz bile; referans)
 *   B) matrices = rastgele 19 AHP  ← asıl rastgelelik burada
 *   C) compute(seed, trialState) → S1–S10
 *   D) S1 alınır; üç firma packFirm ile satıra döner
 *
 * n = tablodaki “#” (1…1000).
 * trialState localStorage’a yazılmaz.
 *
 * for (const co of COMPANIES) → CYL, KRC, GZL sırasıyla packFirm.
 * return { n, companies: { CYL: {bss,…}, KRC:…, GZL:… } }
 */
export function runOneTrial(seed: Seed, live: AppState, n: number): SimulationTrial {
  return executeTrial(seed, live, n).trial
}

/**
 * Tek denemenin iç işi. Tabloda görünmeyen matrices’i de döndürür
 * (örnek Excel’e yazmak için).
 */
function executeTrial(
  seed: Seed,
  live: AppState,
  n: number,
): { trial: SimulationTrial; matrices: Record<string, number[][]> } {
  const matrices = randomAllMatrices(seed)
  const trialState: AppState = {
    scores: live.scores,
    comments: live.comments,
    matrices,
  }

  const computed = compute(seed, trialState)
  const s1 = computed.scenarios.S1 // Yeni AHP senaryosu

  const companies = {} as Record<CompanyId, SimulationFirmScores>
  for (const co of COMPANIES) {
    companies[co] = packFirm(s1[co])
  }

  return { trial: { n, companies }, matrices }
}

/**
 * Excel’e yazılacak deneme numaraları: ilk, orta, son.
 * 1000 denemede → 1, 500, 1000. Hepsi o 1000’in içinden, yeni zar atılmaz.
 */
export function sampleTrialNumbers(count = TRIAL_COUNT): number[] {
  if (count < 1) return []
  const mid = Math.max(1, Math.round(count / 2))
  return [...new Set([1, mid, count])].sort((a, b) => a - b)
}

/**
 * 4) runThousandTrials
 *
 * Ana döngü. i = 1 birinci ihtimal, i = 1000 sonuncu.
 * const trials = [] → boş dizi.
 * trials.push(...)  → her turda bir SimulationTrial ekle.
 * samples           → 1 / 500 / 1000 numaralı denemelerin AHP matrisleri
 *                     (sayfada durmaz; “3 örneği Excel indir” bunları kullanır).
 *
 * Math.random her seferinde farklıdır; butona tekrar basınca tablo değişir.
 */
export function runThousandTrials(
  seed: Seed,
  live: AppState,
): { trials: SimulationTrial[]; samples: SimulationSample[] } {
  const want = new Set(sampleTrialNumbers())
  const trials: SimulationTrial[] = []
  const samples: SimulationSample[] = []
  for (let i = 1; i <= TRIAL_COUNT; i++) {
    const { trial, matrices } = executeTrial(seed, live, i)
    trials.push(trial)
    if (want.has(i)) samples.push({ n: i, matrices, companies: trial.companies })
  }
  return { trials, samples }
}

/**
 * 5) minMaxMean
 *
 * Bir sayı dizisinin özeti.
 * 1. döngü: min, max, toplam.
 * mean = sum / n          (Excel ORTALAMA)
 * 2. döngü: Σ(x − mean)²
 * std  = sqrt( sq / (n−1) )  (Excel STDEV.S)
 * n < 2 ise std = 0.
 */
export function minMaxMean(values: number[]): { min: number; max: number; mean: number; std: number } {
  let min = values[0]
  let max = values[0]
  let sum = 0
  for (const v of values) {
    if (v < min) min = v
    if (v > max) max = v
    sum += v
  }
  const n = values.length
  const mean = sum / n
  let sq = 0
  for (const v of values) sq += (v - mean) * (v - mean)
  const std = n < 2 ? 0 : Math.sqrt(sq / (n - 1))
  return { min, max, mean, std }
}

/**
 * 6) summarizeTrials
 *
 * Kartlar + istatistik tablosu bunu okur.
 *
 * keys = yedi metrik adı.
 * dış for: üç firma.
 *   row = o firmanın boş özeti
 *   iç for: her metrik
 *     values = 1000 denemeden o kolon (örn. 1000 adet CYL.bss)
 *     row[key] = minMaxMean(values)
 *   out[co] = row
 *
 * return örneği:
 *   { CYL: { bss: { min, max, mean, std }, ss: … }, KRC: …, GZL: … }
 */
export function summarizeTrials(trials: SimulationTrial[]): Record<
  CompanyId,
  Record<keyof SimulationFirmScores, { min: number; max: number; mean: number; std: number }>
> {
  const keys: (keyof SimulationFirmScores)[] = [
    "bss",
    "ss",
    "environment",
    "social",
    "governance",
    "fo",
    "ssCheck",
  ]
  const out = {} as Record<
    CompanyId,
    Record<keyof SimulationFirmScores, { min: number; max: number; mean: number; std: number }>
  >
  for (const co of COMPANIES) {
    const row = {} as Record<keyof SimulationFirmScores, { min: number; max: number; mean: number; std: number }>
    for (const key of keys) {
      const values = trials.map((t) => t.companies[co][key])
      row[key] = minMaxMean(values)
    }
    out[co] = row
  }
  return out
}

/**
 * 7) histogram
 *
 * Excel FREKANS benzeri. values’u `bins` kovaya böler.
 *
 * min / max = lo–hi verilmişse o (üç firma ortak ölçek); yoksa dizinin kendi uçları.
 * span = max − min; 0 ise 1 alınır (bölme hatası olmasın).
 * counts = [0,0,…,0] uzunluğu bins.
 *
 * i = floor((v − min) / span * bins)  → hangi kova.
 * i = bins olursa son kovaya sıkıştır (tam max değeri).
 * counts[i]++ her düşen değer için kova 1 artar.
 *
 * return { min, max, counts }  counts[i] = o kovadaki deneme sayısı.
 */
export function histogram(
  values: number[],
  bins = 24,
  lo?: number,
  hi?: number,
): { min: number; max: number; counts: number[] } {
  const min = lo ?? Math.min(...values)
  const max = hi ?? Math.max(...values)
  const span = max - min || 1
  const counts = Array(bins).fill(0)
  for (const v of values) {
    let i = Math.floor(((v - min) / span) * bins)
    if (i >= bins) i = bins - 1
    if (i < 0) i = 0
    counts[i]++
  }
  return { min, max, counts }
}

/**
 * 8) firstPlaceCounts
 *
 * Her denemede BSS’si en yüksek işletmeyi sayar.
 *
 * n = { CYL:0, KRC:0, GZL:0 } sayaç.
 * dış for: 1000 deneme.
 *   best / v başlangıç Ceylanpınar.
 *   iç for: üç firmayı karşılaştır, daha büyük BSS varsa best güncelle.
 *   n[best]++ kazananın sayacı.
 *
 * return örn. { CYL: 410, KRC: 295, GZL: 295 }
 */
export function firstPlaceCounts(trials: SimulationTrial[]): Record<CompanyId, number> {
  const n: Record<CompanyId, number> = { CYL: 0, KRC: 0, GZL: 0 }
  for (const t of trials) {
    let best: CompanyId = "CYL"
    let v = t.companies.CYL.bss
    for (const co of COMPANIES) {
      if (t.companies[co].bss > v) {
        best = co
        v = t.companies[co].bss
      }
    }
    n[best]++
  }
  return n
}

/**
 * 9) sampleSeries
 *
 * 1000 noktayı çizmek kalabalık; her `step` denemeden bir BSS alınır.
 * step = 10 → ~100 nokta (sparkline).
 *
 * const out = []
 * i = 0, 10, 20, … trials.length’e kadar.
 * out.push(o denemenin o firma BSS’si)
 * return sayı dizisi, örn. [72.1, 68.4, …]
 */
export function sampleSeries(trials: SimulationTrial[], co: CompanyId, step = 10): number[] {
  const out: number[] = []
  for (let i = 0; i < trials.length; i += step) out.push(trials[i].companies[co].bss)
  return out
}
