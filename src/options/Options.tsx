import { useEffect, useState } from 'react'
import { getSettings, resetSettings, saveSettings } from '@/lib/storage'
import {
  GROUP_COLORS,
  GROUP_COLOR_HEX,
  GROUP_COLOR_LABELS,
  type GroupColor,
  type Settings,
} from '@/lib/types'
import './options.css'

const SAVED_MESSAGE_MS = 1600

export default function Options() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [savedAt, setSavedAt] = useState(0)
  const [ignoredDraft, setIgnoredDraft] = useState('')

  useEffect(() => {
    void getSettings().then((loaded) => {
      setSettings(loaded)
      setIgnoredDraft(loaded.ignoredDomains.join('\n'))
    })
  }, [])

  useEffect(() => {
    if (!savedAt) return
    const timer = window.setTimeout(() => setSavedAt(0), SAVED_MESSAGE_MS)
    return () => window.clearTimeout(timer)
  }, [savedAt])

  if (!settings) return <main className="page">Carregando…</main>

  const update = async (patch: Partial<Settings>) => {
    const next = await saveSettings(patch)
    setSettings(next)
    setSavedAt(Date.now())
  }

  const commitIgnored = () => {
    const domains = ignoredDraft
      .split(/[\n,]/)
      .map((line) => line.trim().toLowerCase())
      .filter(Boolean)
    void update({ ignoredDomains: [...new Set(domains)] })
  }

  return (
    <main className="page">
      <header className="page__header">
        <h1>Tab Group</h1>
        <p className="muted">Configuracoes de agrupamento de abas.</p>
      </header>

      <section className="card">
        <h2>Agrupamento automatico</h2>

        <label className="row">
          <input
            type="checkbox"
            checked={settings.autoGroupNewTabs}
            onChange={(event) => void update({ autoGroupNewTabs: event.target.checked })}
          />
          <span>
            <strong>Agrupar abas novas automaticamente</strong>
            <small>
              Ao abrir uma aba, ela entra no grupo do mesmo dominio (ou cria um, se houver abas
              soltas suficientes).
            </small>
          </span>
        </label>

        <label className="row">
          <input
            type="checkbox"
            checked={settings.colorizeByDomain}
            onChange={(event) => void update({ colorizeByDomain: event.target.checked })}
          />
          <span>
            <strong>Cor automatica por dominio</strong>
            <small>Cada dominio recebe sempre a mesma cor.</small>
          </span>
        </label>

        <label className="row">
          <input
            type="checkbox"
            checked={settings.collapseNewGroups}
            onChange={(event) => void update({ collapseNewGroups: event.target.checked })}
          />
          <span>
            <strong>Recolher grupos recem-criados</strong>
            <small>Deixa a barra de abas mais limpa logo apos agrupar.</small>
          </span>
        </label>

        <label className="row row--inline">
          <span>
            <strong>Minimo de abas por grupo</strong>
            <small>Dominios com menos abas que isso nao viram grupo.</small>
          </span>
          <input
            type="number"
            min={1}
            max={20}
            value={settings.minTabsPerGroup}
            onChange={(event) =>
              void update({ minTabsPerGroup: Math.max(1, Number(event.target.value) || 1) })
            }
          />
        </label>
      </section>

      <section className="card">
        <h2>Cor padrao</h2>
        <p className="muted">Usada quando a cor automatica esta desligada.</p>
        <div className="swatches">
          {GROUP_COLORS.map((color: GroupColor) => (
            <button
              key={color}
              type="button"
              className="swatch"
              style={{ background: GROUP_COLOR_HEX[color] }}
              aria-pressed={settings.defaultColor === color}
              aria-label={GROUP_COLOR_LABELS[color]}
              title={GROUP_COLOR_LABELS[color]}
              onClick={() => void update({ defaultColor: color })}
            />
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Dominios ignorados</h2>
        <p className="muted">Um por linha. Essas abas nunca sao agrupadas automaticamente.</p>
        <textarea
          rows={6}
          value={ignoredDraft}
          onChange={(event) => setIgnoredDraft(event.target.value)}
          onBlur={commitIgnored}
          spellCheck={false}
        />
        <button type="button" className="btn" onClick={commitIgnored}>
          Salvar lista
        </button>
      </section>

      <section className="card">
        <h2>Atalhos de teclado</h2>
        <ul className="shortcuts">
          <li>
            <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>G</kbd> — agrupar por dominio
          </li>
          <li>
            <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>U</kbd> — desagrupar tudo
          </li>
          <li>Recolher os outros grupos — sem atalho por padrao</li>
        </ul>
        <button
          type="button"
          className="btn"
          onClick={() => void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })}
        >
          Editar atalhos no Chrome
        </button>
      </section>

      <footer className="page__footer">
        <button
          type="button"
          className="btn btn--danger"
          onClick={() =>
            void resetSettings().then((next) => {
              setSettings(next)
              setIgnoredDraft(next.ignoredDomains.join('\n'))
              setSavedAt(Date.now())
            })
          }
        >
          Restaurar padroes
        </button>
        <span className="saved" data-visible={savedAt > 0}>
          Salvo ✓
        </span>
      </footer>
    </main>
  )
}
