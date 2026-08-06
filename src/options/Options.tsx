import { useEffect, useState } from 'react'
import { getSettings, resetSettings, saveSettings } from '@/lib/storage'
import { listGroups } from '@/lib/tabs'
import { hasRenameAccess, RENAME_ORIGINS } from '@/lib/titles'
import { useDarkMode } from '@/lib/useDarkMode'
import {
  GROUP_COLORS,
  GROUP_COLOR_LABELS,
  groupCollapseKey,
  groupColorHex,
  type GroupColor,
  type GroupInfo,
  type GroupPreset,
  type Settings,
  type TitleRule,
} from '@/lib/types'
import './options.css'

const SAVED_MESSAGE_MS = 1600

const TABS = [
  { id: 'grouping', label: 'Grouping' },
  { id: 'rename', label: 'Rename tabs' },
] as const

type TabId = (typeof TABS)[number]['id']

/** Rascunho de predefinicao: dominios ficam como texto enquanto o usuario digita. */
interface PresetDraft {
  id: string
  title: string
  color: GroupColor
  domainsText: string
}

function parseDomains(text: string): string[] {
  const domains = text
    .split(/[\n,]/)
    .map((line) => line.trim().toLowerCase().replace(/^www\./, ''))
    .filter(Boolean)
  return [...new Set(domains)]
}

function toDraft(preset: GroupPreset): PresetDraft {
  return { ...preset, domainsText: preset.domains.join('\n') }
}

export default function Options() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [tab, setTab] = useState<TabId>('grouping')
  const [savedAt, setSavedAt] = useState(0)
  const [ignoredDraft, setIgnoredDraft] = useState('')
  const [presetDrafts, setPresetDrafts] = useState<PresetDraft[]>([])
  const [ruleDrafts, setRuleDrafts] = useState<TitleRule[]>([])
  const [openGroups, setOpenGroups] = useState<GroupInfo[]>([])
  const [renameAccess, setRenameAccess] = useState(false)
  const dark = useDarkMode()

  useEffect(() => {
    void getSettings().then((loaded) => {
      setSettings(loaded)
      setIgnoredDraft(loaded.ignoredDomains.join('\n'))
      setPresetDrafts(loaded.presets.map(toDraft))
      setRuleDrafts(loaded.titleRules)
    })
    // Os grupos de verdade, de todas as janelas: e por eles que o usuario procura
    // a configuracao, nao pela predefinicao que talvez nem exista.
    void listGroups().then(setOpenGroups)
    void hasRenameAccess().then(setRenameAccess)
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

  const commitIgnored = () => void update({ ignoredDomains: parseDomains(ignoredDraft) })

  /** Salva os rascunhos como predefinicoes (descarta as que ficaram sem nome). */
  const commitPresets = (drafts: PresetDraft[]) => {
    setPresetDrafts(drafts)
    void update({
      presets: drafts
        .filter((draft) => draft.title.trim())
        .map(({ id, title, color, domainsText }) => ({
          id,
          title: title.trim(),
          color,
          domains: parseDomains(domainsText),
        })),
    })
  }

  const patchPreset = (id: string, patch: Partial<PresetDraft>, commit = false) => {
    const next = presetDrafts.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft))
    if (commit) commitPresets(next)
    else setPresetDrafts(next)
  }

  const addPreset = () =>
    commitPresets([
      ...presetDrafts,
      { id: crypto.randomUUID(), title: '', color: settings.defaultColor, domainsText: '' },
    ])

  /** Salva as regras de nome (descarta as que ficaram sem padrao ou sem nome). */
  const commitRules = (drafts: TitleRule[]) => {
    setRuleDrafts(drafts)
    void update({
      titleRules: drafts
        .filter((rule) => rule.pattern.trim() && rule.title.trim())
        .map((rule) => ({ ...rule, pattern: rule.pattern.trim(), title: rule.title.trim() })),
    })
  }

  const patchRule = (id: string, patch: Partial<TitleRule>, commit = false) => {
    const next = ruleDrafts.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule))
    if (commit) commitRules(next)
    else setRuleDrafts(next)
  }

  const addRule = () =>
    commitRules([...ruleDrafts, { id: crypto.randomUUID(), pattern: '', title: '', enabled: true }])

  /**
   * Liga/desliga a renomeacao. O acesso aos sites e opcional no manifest, entao
   * ligar pede a permissao na hora — `chrome.permissions.request` so funciona
   * dentro do clique, por isso nada de await antes dele. Recusar deixa a opcao
   * desligada; desligar devolve a permissao, para nao ficar acesso sobrando.
   */
  const toggleRename = async (enabled: boolean) => {
    if (!enabled) {
      await update({ renameTabs: false })
      await chrome.permissions.remove({ origins: RENAME_ORIGINS }).catch(() => false)
      setRenameAccess(await hasRenameAccess())
      return
    }

    const granted = await chrome.permissions.request({ origins: RENAME_ORIGINS })
    setRenameAccess(granted)
    if (granted) await update({ renameTabs: true })
  }

  const requestRenameAccess = async () => {
    setRenameAccess(await chrome.permissions.request({ origins: RENAME_ORIGINS }))
  }

  /** Grupos abertos + nomes de predefinicao, sem repetir o mesmo nome. */
  const groupRows = [
    ...openGroups.map((group) => ({ title: group.title, color: group.color })),
    ...settings.presets.map((preset) => ({ title: preset.title, color: preset.color })),
  ].reduce<{ key: string; title: string; color: GroupColor }[]>((rows, row) => {
    const key = groupCollapseKey(row.title)
    if (!rows.some((item) => item.key === key)) rows.push({ key, ...row })
    return rows
  }, [])

  const swatches = (selected: GroupColor, onPick: (color: GroupColor) => void) => (
    <div className="swatches">
      {GROUP_COLORS.map((color: GroupColor) => (
        <button
          key={color}
          type="button"
          className="swatch"
          style={{ background: groupColorHex(color, dark) }}
          aria-pressed={selected === color}
          aria-label={GROUP_COLOR_LABELS[color]}
          title={GROUP_COLOR_LABELS[color]}
          onClick={() => onPick(color)}
        />
      ))}
    </div>
  )

  return (
    <main className="page">
      <header className="page__header">
        <h1>Tytab</h1>
        <p className="muted">Tab grouping settings.</p>
      </header>

      <nav className="tabs" role="tablist" aria-label="Settings sections">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            className="tabs__item"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === 'grouping' && (
        <>
          <section className="card">
            <h2>Automatic grouping</h2>

            <label className="row">
              <input
                type="checkbox"
                checked={settings.autoGroupNewTabs}
                onChange={(event) => void update({ autoGroupNewTabs: event.target.checked })}
              />
              <span>
                <strong>Group new tabs automatically</strong>
                <small>
                  When a new tab finishes loading, it joins a group on its own. Internal pages (new
                  tab, chrome://, local files) are never grouped.
                </small>
              </span>
            </label>

            {settings.autoGroupNewTabs && (
              <div className="modes">
                <label className="row">
                  <input
                    type="radio"
                    name="auto-group-mode"
                    checked={settings.autoGroupMode === 'domain'}
                    onChange={() => void update({ autoGroupMode: 'domain' })}
                  />
                  <span>
                    <strong>By site</strong>
                    <small>
                      The group is picked <strong>by name</strong>: a tab on "docs.youtube.com"
                      looks for a group named "youtube" (case does not matter). If no group has
                      that name, a new one is created once there are enough loose tabs from the
                      same site. Renaming the group stops the next tabs from finding it.
                    </small>
                  </span>
                </label>

                {settings.autoGroupMode === 'domain' && (
                  <div className="modes__body">
                    <label className="row">
                      <input
                        type="checkbox"
                        checked={settings.colorizeByDomain}
                        onChange={(event) =>
                          void update({ colorizeByDomain: event.target.checked })
                        }
                      />
                      <span>
                        <strong>Automatic color per site</strong>
                        <small>Each site always gets the same color.</small>
                      </span>
                    </label>
                  </div>
                )}

                <label className="row">
                  <input
                    type="radio"
                    name="auto-group-mode"
                    checked={settings.autoGroupMode === 'preset'}
                    onChange={() => void update({ autoGroupMode: 'preset' })}
                  />
                  <span>
                    <strong>By preset</strong>
                    <small>
                      You define the group name and which sites go into it. Sites outside the
                      presets stay loose. The group is looked up by the preset name and, if it does
                      not exist, created once there are enough loose tabs (see the minimum below).
                    </small>
                  </span>
                </label>

                {settings.autoGroupMode === 'preset' && (
                  <div className="modes__body">
                    {presetDrafts.length === 0 && <p className="muted">No presets yet.</p>}

                    {presetDrafts.map((preset) => (
                      <div className="preset" key={preset.id}>
                        <div className="preset__top">
                          <input
                            type="text"
                            className="preset__title"
                            placeholder="Group name (e.g. Work)"
                            value={preset.title}
                            onChange={(event) =>
                              patchPreset(preset.id, { title: event.target.value })
                            }
                            onBlur={() => commitPresets(presetDrafts)}
                          />
                          <button
                            type="button"
                            className="btn btn--danger"
                            title="Remove preset"
                            onClick={() =>
                              commitPresets(presetDrafts.filter((item) => item.id !== preset.id))
                            }
                          >
                            Remove
                          </button>
                        </div>

                        {swatches(preset.color, (color) => patchPreset(preset.id, { color }, true))}

                        <textarea
                          rows={3}
                          placeholder={'youtube.com\nnetflix.com'}
                          value={preset.domainsText}
                          spellCheck={false}
                          onChange={(event) =>
                            patchPreset(preset.id, { domainsText: event.target.value })
                          }
                          onBlur={() => commitPresets(presetDrafts)}
                        />
                        <small className="muted">
                          One site per line. Subdomains are included ("google.com" catches
                          "docs.google.com"). With a port, the match is exact: "localhost:3000"
                          catches only that port, "localhost" catches all of them.
                        </small>

                      </div>
                    ))}

                    <button type="button" className="btn" onClick={addPreset}>
                      Add preset
                    </button>
                  </div>
                )}
              </div>
            )}

            <label className="row row--inline">
              <span>
                <strong>Minimum tabs to create a group</strong>
                <small>
                  Applies to both modes: a new group is only born with this many loose tabs (from
                  the same site, or the same preset). With 1, the group is created on the very
                  first tab. Joining a group that already exists does not depend on this.
                </small>
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

            <label className="row">
              <input
                type="checkbox"
                checked={settings.collapseNewGroups}
                onChange={(event) => void update({ collapseNewGroups: event.target.checked })}
              />
              <span>
                <strong>Collapse newly created groups</strong>
                <small>
                  Keeps the tab strip tidy right after grouping. A group holding the active tab
                  cannot be collapsed by the browser, so it collapses on the next tab switch.
                </small>
              </span>
            </label>
          </section>

          <section className="card">
            <h2>Tab strip</h2>

            <label className="row">
              <input
                type="checkbox"
                checked={settings.collapseOnTabSwitch}
                onChange={(event) => void update({ collapseOnTabSwitch: event.target.checked })}
              />
              <span>
                <strong>Collapse groups on tab switch</strong>
                <small>
                  Applies to every group that has no setting of its own in the list below. The
                  group holding the tab you switched to always stays open.
                </small>
              </span>
            </label>

            <h3 className="subhead">Per group</h3>
            <p className="muted">
              The groups open right now, in any window, plus your preset names. A choice here wins
              over the option above and is stored by group name — renaming a group makes it follow
              the general option again.
            </p>

            {groupRows.length === 0 && <p className="muted">No groups open right now.</p>}

            {groupRows.map((row) => {
              const own = settings.groupCollapse[groupCollapseKey(row.title)]
              return (
                <label className="grouprow" key={row.key}>
                  <input
                    type="checkbox"
                    checked={own ?? settings.collapseOnTabSwitch}
                    onChange={(event) =>
                      void update({
                        groupCollapse: {
                          ...settings.groupCollapse,
                          [groupCollapseKey(row.title)]: event.target.checked,
                        },
                      })
                    }
                  />
                  <span
                    className="exceptions__dot"
                    style={{ background: groupColorHex(row.color, dark) }}
                  />
                  <span className="grouprow__name">{row.title.trim() || '(unnamed)'}</span>
                  <span className="muted">
                    {own === undefined ? 'follows the general option' : own ? 'collapses' : 'stays open'}
                  </span>
                </label>
              )
            })}
          </section>

          <section className="card">
            <h2>Default color</h2>
            <p className="muted">
              Used when the automatic color is off. The colors mirror the browser's own palette and
              follow the system light/dark theme, like the tab strip does.
            </p>
            {swatches(settings.defaultColor, (color) => void update({ defaultColor: color }))}
          </section>

          <section className="card">
            <h2>Ignored sites</h2>
            <p className="muted">
              One per line. These tabs are never grouped automatically. Same port rule as the
              presets: "localhost" ignores every port, "localhost:3000" only that one.
            </p>
            <textarea
              rows={6}
              value={ignoredDraft}
              onChange={(event) => setIgnoredDraft(event.target.value)}
              onBlur={commitIgnored}
              spellCheck={false}
            />
            <button type="button" className="btn" onClick={commitIgnored}>
              Save list
            </button>
          </section>
        </>
      )}

      {tab === 'rename' && (
        <section className="card">
          <h2>Rename tabs</h2>

          <label className="row">
            <input
              type="checkbox"
              checked={settings.renameTabs}
              onChange={(event) => void toggleRename(event.target.checked)}
            />
            <span>
              <strong>Apply your own names to tabs</strong>
              <small>
                When a page loads and its URL matches a rule, the tab title becomes the name you
                set. Works on http/https only. If the site changes the title later, the extension
                puts yours back.
              </small>
              <small>
                Turning this on asks for access to websites: the title only exists inside the page
                itself, so there is no other way to change it. Nothing is read or sent anywhere,
                and turning this off hands the access back. The rest of the extension does not
                need it.
              </small>
            </span>
          </label>

          {settings.renameTabs && !renameAccess && (
            <div className="warn">
              <span>
                <strong>Website access was revoked.</strong> Renaming is on but cannot run on
                pages — the access was removed in chrome://extensions.
              </span>
              <button type="button" className="btn" onClick={() => void requestRenameAccess()}>
                Grant access
              </button>
            </div>
          )}

          <p className="muted">
            The first rule that matches wins, top to bottom. The pattern can be a piece of the URL
            ("github.com/my-org") or use "*" ("https://*.atlassian.net/browse/*").
          </p>

          {ruleDrafts.length === 0 && <p className="muted">No rules yet.</p>}

          {ruleDrafts.map((rule) => (
            <div className="rule" key={rule.id}>
              <label className="rule__toggle" title="Enable or disable this rule">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={(event) => patchRule(rule.id, { enabled: event.target.checked }, true)}
                />
              </label>
              <input
                type="text"
                className="rule__pattern"
                placeholder="URL or pattern (e.g. mail.google.com/chat)"
                value={rule.pattern}
                spellCheck={false}
                onChange={(event) => patchRule(rule.id, { pattern: event.target.value })}
                onBlur={() => commitRules(ruleDrafts)}
              />
              <input
                type="text"
                className="rule__title"
                placeholder="Tab name"
                value={rule.title}
                onChange={(event) => patchRule(rule.id, { title: event.target.value })}
                onBlur={() => commitRules(ruleDrafts)}
              />
              <button
                type="button"
                className="btn btn--danger"
                title="Remove rule"
                onClick={() => commitRules(ruleDrafts.filter((item) => item.id !== rule.id))}
              >
                Remove
              </button>
            </div>
          ))}

          <button type="button" className="btn" onClick={addRule}>
            Add rule
          </button>

          <small className="muted">
            Rules without a pattern or without a name are not saved. Renaming lasts while the tab
            is open: reloading the page applies it again, and removing the rule restores the
            original title on the next load.
          </small>
        </section>
      )}

      <footer className="page__footer">
        <button
          type="button"
          className="btn btn--danger"
          onClick={() =>
            void resetSettings().then((next) => {
              setSettings(next)
              setIgnoredDraft(next.ignoredDomains.join('\n'))
              setPresetDrafts(next.presets.map(toDraft))
              setRuleDrafts(next.titleRules)
              setSavedAt(Date.now())
            })
          }
        >
          Restore defaults
        </button>
        <span className="saved" data-visible={savedAt > 0}>
          Saved ✓
        </span>
      </footer>
    </main>
  )
}
