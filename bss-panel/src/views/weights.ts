/**
 * weights.ts — Ana blok / alt grup yüzde editörü (HTML).
 *
 * Bu dosya hesap yapmaz; kaydırıcı + yüzde kutusu üretir.
 * data-w-matrix ve data-w-index: main.ts applyWeights bunları okur.
 * Toplamı 1 yapan matematik: ahp.setNormalizedWeight.
 *
 * labels[i] ile weights[i] aynı sıradadır (0 = ilk satır).
 */
import { esc } from "../lib/dom"

/** 0,253 → "25.3" (input value; virgül değil nokta, tarayıcı sayı alanı). */
export function weightPct(n: number): string {
  return (n * 100).toFixed(1)
}

export function weightEditor(matrixId: string, labels: string[], weights: number[]): string {
  return labels
    .map((label, i) => {
      const pct = weightPct(weights[i] ?? 0)
      return `<div class="wedit">
        <span>${esc(label)}</span>
        <input type="range" min="1" max="99" step="0.1" value="${pct}" data-w-matrix="${esc(matrixId)}" data-w-index="${i}" aria-label="${esc(label)} ağırlık" />
        <label class="wpct">
          <input type="number" min="1" max="99" step="0.1" value="${pct}" data-w-matrix="${esc(matrixId)}" data-w-index="${i}" />
          <span>%</span>
        </label>
      </div>`
    })
    .join("")
}
