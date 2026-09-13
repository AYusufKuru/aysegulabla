import { esc } from "../lib/dom"

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
