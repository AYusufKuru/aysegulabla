import type { AhpResult } from "../types"

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

export function buildFull(upper: number[][]): number[][] {
  const n = upper.length
  const A = Array.from({ length: n }, () => Array(n).fill(1))
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < upper[i].length; k++) {
      const j = i + 1 + k
      const v = upper[i][k] > 0 ? upper[i][k] : 1
      A[i][j] = v
      A[j][i] = 1 / v
    }
  }
  return A
}

export function ahp(upper: number[][]): AhpResult {
  const n = upper.length
  const A = buildFull(upper)
  const col = Array(n).fill(0)
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) col[j] += A[i][j]
  }
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

export function setUpper(upper: number[][], i: number, j: number, value: number): number[][] {
  const next = upper.map((row) => row.slice())
  if (i === j) return next
  if (i < j) {
    next[i][j - i - 1] = value
  } else {
    next[j][i - j - 1] = value > 0 ? 1 / value : 1
  }
  return next
}

export function normalizeWeights(weights: number[]): number[] {
  const safe = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 1e-6))
  const sum = safe.reduce((a, b) => a + b, 0)
  return safe.map((w) => w / sum)
}

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
    const eq = rest / (n - 1)
    for (let i = 0; i < n; i++) if (i !== index) next[i] = eq
  } else {
    for (let i = 0; i < n; i++) {
      if (i !== index) next[i] = (next[i] / others) * rest
    }
  }
  return normalizeWeights(next)
}

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

export function randomWeights(n: number): number[] {
  if (n <= 0) return []
  if (n === 1) return [1]
  const raw = Array.from({ length: n }, () => 0.12 + Math.random())
  return normalizeWeights(raw)
}

export function randomUpper(n: number): number[][] {
  return upperFromWeights(randomWeights(n))
}
