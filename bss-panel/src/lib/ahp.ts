/**
 * ahp.ts — Saaty AHP matematiği.
 *
 * Excel’de üst üçgen girilir, ağırlık / λmax / CI / CR formülle gelir.
 * Burada aynı iş: upper → tam matris → sütun normalizasyonu → ağırlık.
 *
 * Bağlantı: engine.ts her matris için ahp() çağırır.
 * main.ts ikili seçince setUpper, yüzde girince upperFromWeights kullanır.
 *
 * Sözlük:
 *   const n = upper.length  → matris boyutu (kaç kriter karşılaştırılıyor).
 *   return A                → fonksiyon bitince tam matrisi verir.
 *   for (let i = 0; i < n; i++) → i = 0,1,2,…,n−1 (satır indeksi).
 */
import type { AhpResult } from "../types"

/**
 * Random Index (Saaty tablosu). CR = CI / RI[n].
 * n=1 veya 2’de karşılaştırma yok / tek çift → RI=0, CR=0 kabul.
 */
export const RI: Record<number, number> = {
  1: 0,
  2: 0,
  3: 0.58,
  4: 0.9,
  5: 1.12,
  6: 1.24,
  7: 1.32,
  8: 1.41,
  9: 1.45,
  10: 1.49,
  11: 1.51,
  12: 1.49,
}

/** Saaty 1–9 ölçeği. 1 eşit, 9 mutlak üstün; kesirler ters yön (sütun satırdan üstün). */
export const SAATY: { value: number; label: string }[] = [
  { value: 9, label: "9 — mutlak üstün" },
  { value: 8, label: "8" },
  { value: 7, label: "7 — çok güçlü" },
  { value: 6, label: "6" },
  { value: 5, label: "5 — güçlü" },
  { value: 4, label: "4" },
  { value: 3, label: "3 — orta" },
  { value: 2, label: "2" },
  { value: 1, label: "1 — eşit" },
  { value: 1 / 2, label: "1/2" },
  { value: 1 / 3, label: "1/3 — daha az" },
  { value: 1 / 4, label: "1/4" },
  { value: 1 / 5, label: "1/5" },
  { value: 1 / 6, label: "1/6" },
  { value: 1 / 7, label: "1/7" },
  { value: 1 / 8, label: "1/8" },
  { value: 1 / 9, label: "1/9 — çok daha az" },
]

/**
 * Ağırlıktan gelen oran (ör. 2,33) listede yoksa en yakın Saaty değerini seç.
 * Log mesafe kullanılır çünkü ölçek çarpımsaldır (2 ile 4, 4 ile 8 aynı “kat”).
 */
export function closestSaaty(v: number): number {
  let best = 1
  let dist = Infinity
  for (const o of SAATY) {
    const d = Math.abs(Math.log(v) - Math.log(o.value))
    if (d < dist) {
      dist = d
      best = o.value
    }
  }
  return best
}

/**
 * Üst üçgeni n×n tam matrise çevirir.
 *
 * Excel gibi: sadece sarı hücreler (i < j) saklanır.
 * Köşegen A[i][i] = 1 (kriter kendisine eşittir).
 * Karşılıklılık: A[i][j] = v ise A[j][i] = 1/v.
 *
 * upper[i] = satır i’nin sağındaki hücreler: [i,i+1], [i,i+2], …
 * Örnek n=3: upper = [ [a12, a13], [a23], [] ]
 */
export function buildFull(upper: number[][]): number[][] {
  const n = upper.length
  // n satır, her satır n tane 1 ile başlar (köşegen hazır).
  const A = Array.from({ length: n }, () => Array(n).fill(1))
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < upper[i].length; k++) {
      const j = i + 1 + k // üst üçgendeki sütun
      const v = upper[i][k] > 0 ? upper[i][k] : 1 // 0 veya negatif olmasın
      A[i][j] = v
      A[j][i] = 1 / v
    }
  }
  return A
}

/**
 * Klasik AHP (ortalama sütun yöntemi / “normalized column”):
 *
 *  1) Her sütunun toplamı  col[j] = Σ_i A[i][j]
 *  2) Hücreyi sütun toplamına böl  A[i][j] / col[j]  (sütun toplamı 1 olur)
 *  3) Satır ortası = yerel ağırlık  w[i] = (satırdaki normalize hücrelerin ortası)
 *  4) λmax ≈ Σ_j (col[j] × w[j])     (özdeğer tahmini)
 *  5) CI = (λmax − n) / (n − 1)
 *  6) CR = CI / RI[n]     eşik 0,10
 *
 * n≤2 ise tek karşılaştırma / yok → CR=0, her zaman tutarlı.
 */
export function ahp(upper: number[][]): AhpResult {
  const n = upper.length
  const A = buildFull(upper)

  // Sütun toplamları.
  const col = Array(n).fill(0)
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) col[j] += A[i][j]
  }

  // Ağırlık = normalize satırın ortalaması.
  const weights = Array(n).fill(0)
  for (let i = 0; i < n; i++) {
    let s = 0
    for (let j = 0; j < n; j++) s += A[i][j] / col[j]
    weights[i] = s / n
  }

  let lambdaMax = 0
  for (let j = 0; j < n; j++) lambdaMax += col[j] * weights[j]

  const ci = n <= 1 ? 0 : (lambdaMax - n) / (n - 1)
  const ri = RI[n] ?? 1.49
  const cr = n <= 2 || ri === 0 ? 0 : ci / ri

  return {
    n,
    weights,
    lambdaMax,
    ci,
    cr,
    consistent: n <= 2 || cr <= 0.1,
  }
}

/**
 * Hücre (i,j) değişince üst üçgen kopyasını güncelle.
 * i===j köşegen; dokunulmaz.
 * i<j üst hücre. i>j alt hücre yazılmışsa asıl kayıt üste 1/değer olarak gider
 * (Excel’de de alt üçgen formülle 1/üst’tür).
 */
export function setUpper(upper: number[][], i: number, j: number, value: number): number[][] {
  const next = upper.map((row) => row.slice()) // kopya; orijinali bozma
  if (i === j) return next
  if (i < j) {
    next[i][j - i - 1] = value
  } else {
    next[j][i - j - 1] = value > 0 ? 1 / value : 1
  }
  return next
}

/**
 * Ağırlıkları toplama 1 olacak şekilde ölçekler (yüzde toplamı %100).
 * 0 veya NaN → çok küçük pozitif (bölme hatası olmasın).
 */
export function normalizeWeights(weights: number[]): number[] {
  const safe = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 1e-6))
  const sum = safe.reduce((a, b) => a + b, 0)
  return safe.map((w) => w / sum)
}

/**
 * Kaydırıcı algoritması: bir ağırlık değişince diğerleri orantılı küçülür/büyür.
 *
 * Örnek: [0.40, 0.30, 0.30], index 0’ı 0.50 yap:
 *   clamped = 0.50, rest = 0.50 (kalan %50)
 *   others = 0.30+0.30 = 0.60
 *   yeni 1 = 0.30/0.60 * 0.50 = 0.25
 *   yeni 2 = aynı 0.25
 * Toplam yine 1.
 *
 * 0.01–0.99 aralığı: bir kriter %0 veya %100 olmasın (AHP’de 0 ağırlık sorunlu).
 */
export function setNormalizedWeight(weights: number[], index: number, value: number): number[] {
  const n = weights.length
  if (n <= 0) return []
  if (n === 1) return [1]
  const next = weights.slice()
  const clamped = Math.min(0.99, Math.max(0.01, value))
  const rest = 1 - clamped
  const others = next.reduce((s, w, i) => (i === index ? s : s + w), 0)
  next[index] = clamped
  if (others <= 1e-9) {
    // Diğerleri neredeyse 0 ise kalanı eşit böl.
    const eq = rest / (n - 1)
    for (let i = 0; i < n; i++) if (i !== index) next[i] = eq
  } else {
    for (let i = 0; i < n; i++) {
      if (i !== index) next[i] = (next[i] / others) * rest
    }
  }
  return normalizeWeights(next)
}

/**
 * Ağırlıktan tutarlı matris: a_ij = w_i / w_j.
 * Bu matrisin AHP’si tekrar aynı w’yi verir, CR ≈ 0.
 * Yüzde kutusu / kaydırıcı bunu kullanır.
 */
export function upperFromWeights(weights: number[]): number[][] {
  const w = normalizeWeights(weights)
  const n = w.length
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n - i - 1 }, (_, k) => {
      const j = i + 1 + k
      return w[j] > 0 ? w[i] / w[j] : 1
    }),
  )
}

/** Rastgele pozitif sayılar → normalize. AHP “Tümü / Göstergeler / …” butonları. */
export function randomWeights(n: number): number[] {
  if (n <= 0) return []
  if (n === 1) return [1]
  // 0.12+rastgele: hiçbir ağırlık sıfıra çok yaklaşmasın.
  const raw = Array.from({ length: n }, () => 0.12 + Math.random())
  return normalizeWeights(raw)
}

export function randomUpper(n: number): number[][] {
  return upperFromWeights(randomWeights(n))
}
