/**
 * types.ts — Projedeki tüm veri kalıpları.
 *
 * seed.json bu tiplere uyar. main.ts state’i AppState tutar.
 * engine.ts hesap sonucunu Computed olarak üretir.
 * Ayrı veritabanı yok; bu arayüzler Excel satır/sütunlarının koddaki karşılığıdır.
 *
 * type     = olası değerlerin listesi ("CYL" | "KRC" | "GZL").
 * interface = bir nesnenin hangi alanları taşıyacağı (id, name, …).
 * Record<A,B> = “A anahtarına B değeri” sözlüğü. Örn. scores.CYL = 4.
 */

/** Üç TİGEM işletmesi: Ceylanpınar, Karacabey, Gözlü. */
export type CompanyId = "CYL" | "KRC" | "GZL"

/** Ana bloklar: Çevre, Sosyal, Yönetişim, Finans-Operasyon (Excel ESG+FO). */
export type BlockId = "E" | "S" | "G" | "FO"

/** Kenar menüdeki sayfalar. simulation = 1000 rastgele AHP denemesi. */
export type PageId = "dashboard" | "scoring" | "ahp" | "scenarios" | "simulation"

/** İşletme kimliği, adı, ili. */
export interface Company {
  id: CompanyId
  name: string
  region: string
}

/** Ana blok adı (Çevre vb.). */
export interface Block {
  id: BlockId
  name: string
  short: string
}

/**
 * Alt grup (ör. Enerji ve Emisyonlar).
 * nInd: kaç gösterge var (eşit ağırlık senaryosunda 1/nInd).
 * nSubInBlock: o blokta kaç alt grup var (1/nSubInBlock).
 * matrix: ilgili AHP sayfa kodu.
 */
export interface Subgroup {
  id: string
  block: BlockId
  name: string
  nInd: number
  nSubInBlock: number
  matrix: string
}

/**
 * 88 göstergeden biri. Excel AHP ve BSS satırı ≈ 3 + id.
 * scores: 1–5 ham puan (M/O/Q). comments: L/N/P açıklamaları.
 * articleLocal: makaledeki yerel ağırlık (S2 senaryosu).
 */
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

/**
 * Bir AHP matrisi tanımı.
 * upper: sadece üst üçgen (Excel sarı hücreler). Köşegen 1, alt üçgen 1/üst.
 * kind: ana blok, makale bloğu, alt grup veya gösterge matrisi.
 */
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

/** seed.json’un tamamı: paneli ayağa kaldıran Excel kopyası. */
export interface Seed {
  companies: Company[]
  blocks: Block[]
  subgroups: Subgroup[]
  indicators: Indicator[]
  matrices: MatrixDef[]
}

/**
 * Kullanıcının değiştirdiği canlı veri (tarayıcı localStorage).
 * scores / comments gösterge id’sine göre.
 * matrices: matris id → üst üçgen sayıları.
 */
export interface AppState {
  scores: Record<number, Record<CompanyId, number>>
  comments: Record<number, Record<CompanyId, string>>
  matrices: Record<string, number[][]>
}

/**
 * ahp() çıktısı. Excel’deki yerel ağırlık, λmax, CI, CR.
 * consistent: CR ≤ 0,10 (n≤2 ise her zaman tutarlı).
 */
export interface AhpResult {
  n: number
  weights: number[]
  lambdaMax: number
  ci: number
  cr: number
  consistent: boolean
}

/** S1–S10 senaryo başlığı (engine.ts listesi). */
export interface ScenarioDef {
  id: string
  name: string
  mix: string
  note: string
}

/**
 * Bir işletmenin bir senaryodaki sonucu.
 * bss = SS (Excel satır 92): Σ 100’lük × global ağırlık.
 * ssCheck = SS Sağlama (satır 97): Σ blokSkor × anaBlokAğırlığı.
 * blocks: E/S/G/FO içi 100’lük blok skorları (satır 93–96).
 */
export interface CompanyResult {
  bss: number
  ssCheck: number
  blocks: Record<BlockId, number>
}

/** compute() sonrası ekranların okuduğu paket. Hepsi engine.ts’de doldurulur. */
export interface Computed {
  matrix: Record<string, AhpResult> // matris id → yerel ağırlık + CR
  wBlockNew: Record<BlockId, number> // S1 ana blok ağırlıkları (E/S/G/FO)
  wBlockArt: Record<BlockId, number> // S2 makale ana blok ağırlıkları
  wSub: Record<string, number> // alt grup id → yerel ağırlık
  wInd: Record<number, number> // gösterge id → wk
  scale: Record<number, Record<CompanyId, number>> // gösterge × işletme, 0–100
  totalRaw: Record<CompanyId, number> // 88×(1–5) toplamı, ağırlıksız
  scenarios: Record<string, Record<CompanyId, CompanyResult>> // S1–S10 × CYL/KRC/GZL
  ranking: Record<string, CompanyId[]> // BSS büyükten küçüğe işletme id
  crAlerts: { id: string; title: string; cr: number }[] // CR > 0,10 olanlar
}

/**
 * 1000 ihtimal sayfasında bir firmanın bir denemedeki satırı.
 * bss ve ss aynı sayıdır (Özet kartı BSS = Senaryolar SS = Excel satır 92).
 * İkisi de listelenir; sunumda “aynı formül, iki ekran” diye gösterilir.
 */
export interface SimulationFirmScores {
  bss: number
  ss: number
  environment: number
  social: number
  governance: number
  fo: number
  ssCheck: number
}

/** Bir rastgele AHP denemesi: 1…1000 sıra + üç işletme. */
export interface SimulationTrial {
  n: number
  companies: Record<CompanyId, SimulationFirmScores>
}

/**
 * 1000’den seçilen örnek deneme (Excel indirme).
 * matrices = o denemede üretilen 19 rastgele AHP üst üçgeni.
 * companies = tablodaki 7 skor. Diğer tüm sayılar indirmede compute() ile yeniden bulunur.
 */
export interface SimulationSample {
  n: number
  matrices: Record<string, number[][]>
  companies: Record<CompanyId, SimulationFirmScores>
}
