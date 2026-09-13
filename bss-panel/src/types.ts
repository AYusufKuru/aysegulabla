export type CompanyId = "CYL" | "KRC" | "GZL"
export type BlockId = "E" | "S" | "G" | "FO"
export type PageId = "dashboard" | "scoring" | "ahp" | "scenarios"

export interface Company {
  id: CompanyId
  name: string
  region: string
}

export interface Block {
  id: BlockId
  name: string
  short: string
}

export interface Subgroup {
  id: string
  block: BlockId
  name: string
  nInd: number
  nSubInBlock: number
  matrix: string
}

export interface Indicator {
  id: number
  code: string
  name: string
  reason: string
  block: BlockId
  subId: string
  articleLocal: number
  scores: Record<CompanyId, number>
  comments: Record<CompanyId, string>
}

export interface MatrixDef {
  id: string
  title: string
  group: string
  kind: "blocks" | "blocks_article" | "subs" | "inds"
  block?: BlockId | null
  subId?: string
  labels: string[]
  labelsFull: string[]
  upper: number[][]
}

export interface Seed {
  companies: Company[]
  blocks: Block[]
  subgroups: Subgroup[]
  indicators: Indicator[]
  matrices: MatrixDef[]
}

export interface AppState {
  scores: Record<number, Record<CompanyId, number>>
  comments: Record<number, Record<CompanyId, string>>
  matrices: Record<string, number[][]>
}

export interface AhpResult {
  n: number
  weights: number[]
  lambdaMax: number
  ci: number
  cr: number
  consistent: boolean
}

export interface ScenarioDef {
  id: string
  name: string
  mix: string
  note: string
}

export interface CompanyResult {
  bss: number
  ssCheck: number
  blocks: Record<BlockId, number>
}

export interface Computed {
  matrix: Record<string, AhpResult>
  wBlockNew: Record<BlockId, number>
  wBlockArt: Record<BlockId, number>
  wSub: Record<string, number>
  wInd: Record<number, number>
  scale: Record<number, Record<CompanyId, number>>
  totalRaw: Record<CompanyId, number>
  scenarios: Record<string, Record<CompanyId, CompanyResult>>
  ranking: Record<string, CompanyId[]>
  crAlerts: { id: string; title: string; cr: number }[]
}
