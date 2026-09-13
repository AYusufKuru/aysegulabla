import type { AppState, CompanyId, MatrixDef, Seed } from "../types"
import { randomUpper, upperFromWeights } from "./ahp"

export type RandomScope = "all" | "inds" | "subs" | "blocks"

function matchesScope(m: MatrixDef, scope: RandomScope): boolean {
  if (scope === "all") return true
  if (scope === "inds") return m.kind === "inds"
  if (scope === "subs") return m.kind === "subs"
  return m.kind === "blocks" || m.kind === "blocks_article"
}

const KEY = "bss-panel-v1"
const META_KEY = "bss-panel-meta-v1"
const INVERT_KEY = "bss-invert-ahp-66-88"

function invertAhbScores(scores: Record<CompanyId, number>): Record<CompanyId, number> {
  return {
    CYL: 5 - scores.CYL,
    KRC: 5 - scores.KRC,
    GZL: 5 - scores.GZL,
  }
}

export interface SaveFile {
  version: 1
  savedAt: string
  state: AppState
}

export interface SaveMeta {
  savedAt: string
  source: "auto" | "file"
}

function cloneUpper(upper: number[][]): number[][] {
  return upper.map((row) => row.slice())
}

export function stateFromSeed(seed: Seed): AppState {
  const scores: AppState["scores"] = {}
  const comments: AppState["comments"] = {}
  for (const ind of seed.indicators) {
    scores[ind.id] = { ...ind.scores }
    comments[ind.id] = { ...ind.comments }
  }
  const matrices: AppState["matrices"] = {}
  for (const m of seed.matrices) matrices[m.id] = cloneUpper(m.upper)
  return { scores, comments, matrices }
}

export function loadState(seed: Seed): AppState {
  const base = stateFromSeed(seed)
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return base
    const saved = JSON.parse(raw) as Partial<AppState>
    if (saved.scores) {
      for (const id of Object.keys(saved.scores)) {
        const n = Number(id)
        if (base.scores[n]) base.scores[n] = { ...base.scores[n], ...saved.scores[n] }
      }
      if (!localStorage.getItem(INVERT_KEY)) {
        for (let id = 63; id <= 85; id++) {
          if (!saved.scores[id] || !base.scores[id]) continue
          base.scores[id] = invertAhbScores(base.scores[id])
        }
        localStorage.setItem(INVERT_KEY, "1")
        persist(base, "auto")
      }
    }
    if (saved.comments) {
      for (const id of Object.keys(saved.comments)) {
        const n = Number(id)
        if (base.comments[n]) base.comments[n] = { ...base.comments[n], ...saved.comments[n] }
      }
    }
    if (saved.matrices) {
      for (const id of Object.keys(saved.matrices)) {
        if (base.matrices[id] && saved.matrices[id]?.length === base.matrices[id].length) {
          base.matrices[id] = saved.matrices[id]
        }
      }
    }
  } catch {
    return stateFromSeed(seed)
  }
  return base
}

export function persist(state: AppState, source: SaveMeta["source"] = "auto"): void {
  localStorage.setItem(KEY, JSON.stringify(state))
  const meta: SaveMeta = { savedAt: new Date().toISOString(), source }
  localStorage.setItem(META_KEY, JSON.stringify(meta))
}

export function loadMeta(): SaveMeta | null {
  try {
    const raw = localStorage.getItem(META_KEY)
    if (!raw) return null
    return JSON.parse(raw) as SaveMeta
  } catch {
    return null
  }
}

export function resetState(seed: Seed): AppState {
  localStorage.removeItem(KEY)
  localStorage.removeItem(META_KEY)
  return stateFromSeed(seed)
}

export function toSaveFile(state: AppState): SaveFile {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    state,
  }
}

export function parseSaveFile(raw: string, seed: Seed): AppState {
  const data = JSON.parse(raw) as SaveFile | AppState
  const incoming: AppState =
    typeof data === "object" && data !== null && "version" in data && "state" in data
      ? (data as SaveFile).state
      : (data as AppState)
  const base = stateFromSeed(seed)
  if (incoming.scores) {
    for (const id of Object.keys(incoming.scores)) {
      const n = Number(id)
      if (base.scores[n]) base.scores[n] = { ...base.scores[n], ...incoming.scores[n] }
    }
  }
  if (incoming.comments) {
    for (const id of Object.keys(incoming.comments)) {
      const n = Number(id)
      if (base.comments[n]) base.comments[n] = { ...base.comments[n], ...incoming.comments[n] }
    }
  }
  if (incoming.matrices) {
    for (const id of Object.keys(incoming.matrices)) {
      if (base.matrices[id] && incoming.matrices[id]?.length === base.matrices[id].length) {
        base.matrices[id] = incoming.matrices[id]
      }
    }
  }
  return base
}

export function downloadSave(state: AppState): SaveMeta {
  const file = toSaveFile(state)
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" })
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = `bss-kayit-${stamp}.json`
  a.click()
  URL.revokeObjectURL(a.href)
  persist(state, "file")
  return { savedAt: file.savedAt, source: "file" }
}

export function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 3
  return Math.min(5, Math.max(1, Math.round(n)))
}

export function setScore(state: AppState, id: number, co: CompanyId, value: number): AppState {
  return {
    ...state,
    scores: {
      ...state.scores,
      [id]: { ...state.scores[id], [co]: clampScore(value) },
    },
  }
}

export function setComment(state: AppState, id: number, co: CompanyId, value: string): AppState {
  return {
    ...state,
    comments: {
      ...state.comments,
      [id]: { ...state.comments[id], [co]: value },
    },
  }
}

export function setMatrixUpper(state: AppState, matrixId: string, upper: number[][]): AppState {
  return {
    ...state,
    matrices: { ...state.matrices, [matrixId]: upper },
  }
}

export function setMatrixFromWeights(state: AppState, matrixId: string, weights: number[]): AppState {
  return setMatrixUpper(state, matrixId, upperFromWeights(weights))
}

export function randomizeMatrices(state: AppState, seed: Seed, scope: RandomScope): AppState {
  const matrices = { ...state.matrices }
  for (const m of seed.matrices) {
    if (!matchesScope(m, scope)) continue
    matrices[m.id] = randomUpper(m.labels.length)
  }
  return { ...state, matrices }
}
