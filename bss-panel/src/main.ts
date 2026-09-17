/**
 * main.ts — Uygulamanın merkezi (tek “controller”).
 *
 * index.html sadece boş #app bırakır; bu dosya:
 *  1) seed.json + localStorage → state
 *  2) compute() → BSS / SS
 *  3) seçilen sayfanın HTML’ini views/* üretir
 *  4) tıklamaları bind() ile state’e yazar, tekrar render
 *
 * Veritabanı yok. Kayıt store.persist → localStorage.
 *
 * Sözlük:
 *   let state = ...  → canlı veri; puan/AHP değişince yenilenir.
 *   const seed = ... → Excel kopyası; dosya değişmez, sadece okunur.
 *   return           → fonksiyondan çık. Örn. if (!root) return = “#app yoksa dur”.
 *   ?.               → “varsa devam et” (null ise hata verme).
 */
import "./style.css"
import seedJson from "./data/seed.json"
import type { AppState, BlockId, CompanyId, PageId, Seed, SimulationSample, SimulationTrial } from "./types"
import { compute } from "./lib/engine"
import { downloadExcel } from "./lib/excel"
import {
  downloadSave,
  loadMeta,
  loadState,
  parseSaveFile,
  persist,
  randomizeMatrices,
  resetState,
  setComment,
  setMatrixFromWeights,
  setMatrixUpper,
  setScore,
  type RandomScope,
  type SaveMeta,
} from "./lib/store"
import { setNormalizedWeight, setUpper } from "./lib/ahp"
import { dashboardView } from "./views/dashboard"
import { scoringView } from "./views/scoring"
import { ahpView } from "./views/ahp"
import { scenariosView } from "./views/scenarios"
import { simulationView } from "./views/simulation"
import { runThousandTrials } from "./lib/simulation"
import { downloadSampleTrials } from "./lib/simExport"

const seed = seedJson as Seed // 88 gösterge, 19 matris, işletmeler — değişmez kaynak
let state: AppState = loadState(seed) // puan + yorum + AHP üst üçgen (kayıtlı veya seed)
let page: PageId = "dashboard" // o an görünen kenar menü sayfası
let query = "" // puanlama arama kutusu
let blockFilter: BlockId | "all" = "all" // E/S/G/FO hapı
let selectedMatrix = "blocks_new" // AHP sayfasında açık matris
let openNotes = new Set<number>() // gerekçesi açık gösterge id’leri
let saveTimer = 0 // scheduleSave gecikme kimliği
let meta: SaveMeta | null = loadMeta() // son kayıt zamanı / kaynağı
let flash = "" // yeşil hapta kısa mesaj (“Excel indirildi” vb.)
let simTrials: SimulationTrial[] | null = null // 1000 ihtimal tablosu (kayıtlı AHP’yi değiştirmez)
let simSamples: SimulationSample[] | null = null // 1 / 500 / 1000 denemenin AHP matrisleri (Excel)
let simBusy = false // hesap sürerken butonu kilitle

const NAV: { id: PageId; label: string; hint: string; no: string }[] = [
  { id: "dashboard", label: "Özet", hint: "Skorlar ve sıralama", no: "01" },
  { id: "scoring", label: "Puanlama", hint: "1–5 girişleri", no: "02" },
  { id: "ahp", label: "AHP ağırlıkları", hint: "Karşılaştırma ve yerel ağırlık", no: "03" },
  { id: "scenarios", label: "Senaryolar", hint: "Duyarlılık tablosu", no: "04" },
  { id: "simulation", label: "1000 ihtimal", hint: "Rastgele AHP tablosu", no: "05" },
]

function formatSaved(iso: string): string {
  return new Date(iso).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * 200 ms bekle, sonra kaydet (her tuşta localStorage’a yazmamak için).
 * Yeni tuş gelince eski zamanlayıcı iptal (clearTimeout), süre baştan başlar.
 */
function scheduleSave() {
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    persist(state, "auto")
    meta = { savedAt: new Date().toISOString(), source: "auto" }
    const pill = document.querySelector(".save-pill")
    if (pill) pill.innerHTML = `<i></i> Otomatik kayıt · ${formatSaved(meta.savedAt)}`
  }, 200)
}

/**
 * Tüm arayüzü yeniden kur.
 * innerHTML eski düğmeleri siler; bu yüzden sonra bind() tekrar bağlar.
 * Kaydırma: çizimden önce top alınır, bitince geri yazılır.
 *
 * 1000 ihtimal: tablo yoksa bu çizimde “Hesaplanıyor” gösterilir,
 * asıl döngü setTimeout ile bir sonraki tura bırakılır (arayüz donmasın).
 */
function render() {
  const root = document.querySelector<HTMLDivElement>("#app")
  if (!root) return // #app yoksa (sayfa henüz yok) hiçbir şey yapma

  let kickSimulation = false
  if (page === "simulation" && simTrials === null && !simBusy) {
    simBusy = true
    kickSimulation = true
  }

  const scroller = root.querySelector<HTMLElement>(".main")
  const top = scroller?.scrollTop ?? 0 // ?? 0 = kaydırıcı yoksa 0 kabul et
  const computed = compute(seed, state) // BSS, ağırlık, CR, sıralama

  let body = "" // seçilen sayfanın HTML’i
  if (page === "dashboard") body = dashboardView(seed, computed)
  if (page === "scoring") body = scoringView(seed, state, computed, query, blockFilter, openNotes)
  if (page === "ahp") body = ahpView(seed, state, computed, selectedMatrix)
  if (page === "scenarios") body = scenariosView(seed, computed)
  if (page === "simulation") body = simulationView(seed, simTrials, simBusy)

  root.innerHTML = `
    <aside class="side">
      <div class="brand">
        <div class="mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none">
            <rect x="1" y="1" width="30" height="30" rx="8" fill="#e8eef6" stroke="#c5d4e6"/>
            <path d="M10.5 22V10h6.1c2.7 0 4.4 1.6 4.4 3.9 0 1.4-.7 2.5-2 3.1 1.5.5 2.5 1.7 2.5 3.4 0 2.5-1.9 3.6-4.9 3.6h-6.1zm3-7.1h2.6c1.2 0 1.9-.6 1.9-1.5s-.7-1.5-1.9-1.5h-2.6v3zm0 5.3h3.1c1.4 0 2.2-.6 2.2-1.7s-.8-1.7-2.2-1.7h-3.1v3.4z" fill="#3d6ea8"/>
          </svg>
        </div>
        <div>
          <strong>BSS</strong>
          <span>Saha defteri</span>
        </div>
      </div>
      <p class="side-tag">TİGEM · ESG + FO</p>
      <nav>
        ${NAV.map(
          (n) => `
          <button type="button" class="${page === n.id ? "on" : ""}" data-page="${n.id}">
            <em>${n.no}</em>
            <span>
              <b>${n.label}</b>
              <small>${n.hint}</small>
            </span>
          </button>`,
        ).join("")}
      </nav>
      <div class="side-foot">
        <div class="save-pill ${flash ? "flash" : ""}">
          <i></i>
          ${
            flash
              ? flash
              : meta
                ? `${meta.source === "file" ? "Dosyaya kaydedildi" : "Otomatik kayıt"} · ${formatSaved(meta.savedAt)}`
                : "Henüz kayıt yok · puan girince kaydolur"
          }
        </div>
        <button type="button" id="save-excel">Excel indir</button>
        <button type="button" id="save-file">JSON yedek</button>
        <button type="button" id="load-file">JSON yükle</button>
        <input id="load-input" type="file" accept="application/json,.json" hidden />
        <button type="button" id="reset">Excel varsayılanına dön</button>
      </div>
    </aside>
    <main class="main">${body}</main>
  `

  bind(root, computed)
  const next = root.querySelector<HTMLElement>(".main")
  if (next) next.scrollTop = top

  if (kickSimulation) {
    window.setTimeout(() => {
      try {
        const run = runThousandTrials(seed, state)
        simTrials = run.trials
        simSamples = run.samples
      } finally {
        simBusy = false
        render()
      }
    }, 40)
  }
}

/**
 * innerHTML sonrası olayları bağla.
 * querySelectorAll("[data-page]") = data-page yazılmış tüm düğmeler.
 * forEach: her düğme için click dinleyicisi ekle.
 */
function bind(root: HTMLElement, computed: ReturnType<typeof compute>) {
  root.querySelectorAll<HTMLButtonElement>("[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      page = btn.dataset.page as PageId
      render()
    })
  })

  root.querySelector("#save-excel")?.addEventListener("click", () => {
    void downloadExcel(seed, state)
      .then((next) => {
        meta = next
        flash = "Excel dosyası indirildi"
        render()
        window.setTimeout(() => {
          flash = ""
          const pill = document.querySelector(".save-pill")
          if (pill && meta) {
            pill.classList.remove("flash")
            pill.innerHTML = `<i></i> Excel indirildi · ${formatSaved(meta.savedAt)}`
          }
        }, 1800)
      })
      .catch(() => {
        alert("Excel indirilemedi. Sayfayı yenileyip tekrar deneyin.")
      })
  })

  root.querySelector("#save-file")?.addEventListener("click", () => {
    meta = downloadSave(state)
    flash = "JSON yedek indirildi"
    render()
    window.setTimeout(() => {
      flash = ""
      const pill = document.querySelector(".save-pill")
      if (pill && meta) {
        pill.classList.remove("flash")
        pill.innerHTML = `<i></i> JSON yedek · ${formatSaved(meta.savedAt)}`
      }
    }, 1800)
  })

  root.querySelector("#load-file")?.addEventListener("click", () => {
    document.querySelector<HTMLInputElement>("#load-input")?.click()
  })

  root.querySelector<HTMLInputElement>("#load-input")?.addEventListener("change", async (ev) => {
    const input = ev.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return // kullanıcı iptal ettiyse çık
    try {
      const text = await file.text()
      state = parseSaveFile(text, seed)
      persist(state, "file")
      meta = { savedAt: new Date().toISOString(), source: "file" }
      flash = "Kayıt yüklendi"
      render()
      window.setTimeout(() => {
        flash = ""
        const pill = document.querySelector(".save-pill")
        if (pill && meta) {
          pill.classList.remove("flash")
          pill.innerHTML = `<i></i> Dosyadan yüklendi · ${formatSaved(meta.savedAt)}`
        }
      }, 1600)
    } catch {
      alert("Bu dosya okunamadı. BSS kayıt JSON’u seçin.")
    } finally {
      input.value = ""
    }
  })

  root.querySelector("#reset")?.addEventListener("click", () => {
    if (!confirm("Tüm puan ve AHP girişleri Excel’deki değerlere döner. Emin misiniz?")) return // Hayır → hiçbir şey silme
    state = resetState(seed)
    meta = null
    flash = ""
    render()
  })

  const search = root.querySelector<HTMLInputElement>("#q")
  search?.addEventListener("input", () => {
    query = search.value
    const pos = search.selectionStart
    render()
    const again = document.querySelector<HTMLInputElement>("#q")
    again?.focus()
    if (again && pos != null) again.setSelectionRange(pos, pos)
  })

  root.querySelectorAll<HTMLButtonElement>("[data-block]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = btn.dataset.block as BlockId | "all"
      blockFilter = v
      render()
    })
  })

  // 1–5 chip: data-ind gösterge id, data-co işletme, data-v seçilen puan.
  root.querySelectorAll<HTMLButtonElement>(".chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.ind)
      const co = btn.dataset.co as CompanyId
      const v = Number(btn.dataset.v)
      state = setScore(state, id, co, v)
      scheduleSave()
      render()
    })
  })

  root.querySelectorAll<HTMLButtonElement>("[data-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.toggle)
      if (openNotes.has(id)) openNotes.delete(id)
      else openNotes.add(id)
      const box = document.getElementById(`extra-${id}`)
      if (!box) return
      box.hidden = !openNotes.has(id)
      btn.textContent = openNotes.has(id) ? "–" : "+"
    })
  })

  root.querySelectorAll<HTMLTextAreaElement>("[data-note]").forEach((el) => {
    el.addEventListener("input", () => {
      const id = Number(el.dataset.note)
      const co = el.dataset.co as CompanyId
      state = setComment(state, id, co, el.value)
      scheduleSave()
    })
  })

  root.querySelectorAll<HTMLButtonElement>("[data-random]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const scope = btn.dataset.random as RandomScope
      state = randomizeMatrices(state, seed, scope)
      const labels: Record<RandomScope, string> = {
        all: "Tüm AHP ağırlıkları rastgele atandı",
        inds: "Gösterge ağırlıkları (wk) rastgele atandı",
        subs: "Alt grup ağırlıkları rastgele atandı",
        blocks: "Ana blok ağırlıkları rastgele atandı",
      }
      flash = labels[scope] ?? "Rastgele ağırlıklar atandı"
      scheduleSave()
      render()
      window.setTimeout(() => {
        flash = ""
        const pill = document.querySelector(".save-pill")
        if (pill && meta) {
          pill.classList.remove("flash")
          pill.innerHTML = `<i></i> ${meta.source === "file" ? "Dosyaya kaydedildi" : "Otomatik kayıt"} · ${formatSaved(meta.savedAt)}`
        }
      }, 1800)
    })
  })

  root.querySelectorAll<HTMLButtonElement>("[data-matrix]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedMatrix = btn.dataset.matrix ?? selectedMatrix
      render()
    })
  })

  // AHP üst üçgen seçimi → setUpper → yeniden ağırlık/CR
  root.querySelectorAll<HTMLSelectElement>("select[data-mi]").forEach((sel) => {
    sel.addEventListener("change", () => {
      const id = sel.dataset.mi ?? ""
      const i = Number(sel.dataset.i)
      const j = Number(sel.dataset.j)
      const value = Number(sel.value)
      const current = state.matrices[id]
      state = setMatrixUpper(state, id, setUpper(current, i, j, value))
      scheduleSave()
      render()
    })
  })

  // Kaydırıcı sürüklenirken “başlangıç ağırlıkları”. slice() kopyadır.
  const originals: Record<string, number[]> = {}
  for (const id of Object.keys(computed.matrix)) {
    originals[id] = computed.matrix[id].weights.slice()
  }

  /**
   * Kaydırıcı / yüzde kutusu.
   * commit=false: sadece kardeş kutuları güncelle (sürüklerken).
   * commit=true:  a_ij = w_i/w_j yaz, kaydet, sayfayı yenile.
   * raw/100: ekrandaki 25,3 → 0,253 (AHP 0–1 ölçeği).
   */
  const applyWeights = (el: HTMLInputElement, commit: boolean) => {
    const id = el.dataset.wMatrix ?? ""
    const i = Number(el.dataset.wIndex)
    const raw = Number(el.value)
    if (!id || !originals[id] || !Number.isFinite(raw) || !Number.isInteger(i)) return
    const next = setNormalizedWeight(originals[id], i, raw / 100)
    root.querySelectorAll<HTMLInputElement>(`[data-w-matrix="${id}"]`).forEach((node) => {
      const j = Number(node.dataset.wIndex)
      if (node === el || !Number.isInteger(j)) return // sürüklenen kutuyu ezme
      node.value = (next[j] * 100).toFixed(1)
    })
    if (!commit) return
    state = setMatrixFromWeights(state, id, next)
    scheduleSave()
    render()
  }

  root.querySelectorAll<HTMLInputElement>("[data-w-matrix]").forEach((el) => {
    if (el.type === "range") {
      el.addEventListener("input", () => applyWeights(el, false))
      el.addEventListener("change", () => applyWeights(el, true))
    } else {
      el.addEventListener("change", () => applyWeights(el, true))
    }
  })

  root.querySelector("#sim-run")?.addEventListener("click", () => {
    if (simBusy) return
    simTrials = null
    simSamples = null
    render()
  })

  root.querySelector("#sim-sample-dl")?.addEventListener("click", () => {
    if (!simSamples?.length) return
    downloadSampleTrials(seed, state, simSamples)
    flash = "3 örnek deneme indirildi"
    render()
    window.setTimeout(() => {
      flash = ""
      const pill = document.querySelector(".save-pill")
      if (pill) {
        pill.classList.remove("flash")
        if (meta) pill.innerHTML = `<i></i> ${meta.source === "file" ? "Dosyaya kaydedildi" : "Otomatik kayıt"} · ${formatSaved(meta.savedAt)}`
      }
    }, 1800)
  })
}

render() // ilk çizim
window.addEventListener("beforeunload", () => persist(state, meta?.source ?? "auto")) // sekme kapanırken kaydet
