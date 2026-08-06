import { useEffect, useState } from 'react'
import { getSettings, resetSettings, saveSettings } from '@/lib/storage'
import { listGroups } from '@/lib/tabs'
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
  { id: 'grouping', label: 'Agrupamento' },
  { id: 'rename', label: 'Renomear abas' },
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
        <h1>Tab Group</h1>
        <p className="muted">Configuracoes de agrupamento de abas.</p>
      </header>

      <nav className="tabs" role="tablist" aria-label="Secoes das configuracoes">
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
                  Quando uma aba nova termina de carregar, ela entra sozinha em um grupo. Paginas
                  internas (nova aba, chrome://, arquivos locais) nunca sao agrupadas.
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
                    <strong>Por dominio</strong>
                    <small>
                      O grupo e escolhido <strong>pelo nome</strong>: uma aba de "docs.youtube.com"
                      procura um grupo chamado "youtube" (a caixa nao importa). Se nenhum grupo
                      tiver esse nome, um novo e criado quando houver abas soltas suficientes do
                      mesmo dominio. Renomear o grupo faz as proximas abas deixarem de encontra-lo.
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
                        <strong>Cor automatica por dominio</strong>
                        <small>Cada dominio recebe sempre a mesma cor.</small>
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
                    <strong>Por predefinicao</strong>
                    <small>
                      Voce define o nome do grupo e quais dominios entram nele. Dominios fora das
                      predefinicoes ficam soltos. O grupo e procurado pelo nome da predefinicao e,
                      se nao existir, criado quando houver abas soltas suficientes (veja o minimo
                      abaixo).
                    </small>
                  </span>
                </label>

                {settings.autoGroupMode === 'preset' && (
                  <div className="modes__body">
                    {presetDrafts.length === 0 && <p className="muted">Nenhuma predefinicao ainda.</p>}

                    {presetDrafts.map((preset) => (
                      <div className="preset" key={preset.id}>
                        <div className="preset__top">
                          <input
                            type="text"
                            className="preset__title"
                            placeholder="Nome do grupo (ex.: Trabalho)"
                            value={preset.title}
                            onChange={(event) =>
                              patchPreset(preset.id, { title: event.target.value })
                            }
                            onBlur={() => commitPresets(presetDrafts)}
                          />
                          <button
                            type="button"
                            className="btn btn--danger"
                            title="Remover predefinicao"
                            onClick={() =>
                              commitPresets(presetDrafts.filter((item) => item.id !== preset.id))
                            }
                          >
                            Remover
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
                          Um dominio por linha. Subdominios entram junto ("google.com" pega
                          "docs.google.com"). Com porta, o casamento e exato: "localhost:3000" pega
                          so essa porta, "localhost" pega todas.
                        </small>

                      </div>
                    ))}

                    <button type="button" className="btn" onClick={addPreset}>
                      Adicionar predefinicao
                    </button>
                  </div>
                )}
              </div>
            )}

            <label className="row row--inline">
              <span>
                <strong>Minimo de abas para criar um grupo</strong>
                <small>
                  Vale para os dois modos: um grupo novo so nasce com essa quantidade de abas soltas
                  (do mesmo dominio, ou da mesma predefinicao). Com 1, o grupo e criado ja na
                  primeira aba. Entrar em um grupo que ja existe nao depende disso.
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
                <strong>Recolher grupos recem-criados</strong>
                <small>Deixa a barra de abas mais limpa logo apos agrupar.</small>
              </span>
            </label>
          </section>

          <section className="card">
            <h2>Barra de abas</h2>

            <label className="row">
              <input
                type="checkbox"
                checked={settings.collapseOnTabSwitch}
                onChange={(event) => void update({ collapseOnTabSwitch: event.target.checked })}
              />
              <span>
                <strong>Recolher os grupos sem predefinicao ao trocar de aba</strong>
                <small>
                  Vale para os grupos que <strong>nao</strong> tem uma predefinicao com o mesmo
                  nome: esses seguem a caixa "Recolher este grupo ao trocar de aba" da propria
                  predefinicao, ligada ou desligada aqui. O Chrome nao permite recolher o grupo que
                  contem a aba ativa, entao esse continua aberto.
                </small>
              </span>
            </label>

            <h3 className="subhead">Por grupo</h3>
            <p className="muted">
              Os grupos abertos agora, em qualquer janela, mais os nomes das predefinicoes. A
              escolha aqui tem prioridade sobre a opcao acima e e guardada pelo nome do grupo —
              renomear o grupo faz ele voltar a seguir a opcao geral.
            </p>

            {groupRows.length === 0 && <p className="muted">Nenhum grupo aberto no momento.</p>}

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
                  <span className="grouprow__name">{row.title.trim() || '(sem nome)'}</span>
                  <span className="muted">
                    {own === undefined ? 'seguindo a opcao geral' : own ? 'recolhe' : 'fica aberto'}
                  </span>
                </label>
              )
            })}
          </section>

          <section className="card">
            <h2>Cor padrao</h2>
            <p className="muted">
              Usada quando a cor automatica esta desligada. As cores sao as mesmas do Chrome e
              acompanham o tema claro/escuro do sistema, como na barra de abas.
            </p>
            {swatches(settings.defaultColor, (color) => void update({ defaultColor: color }))}
          </section>

          <section className="card">
            <h2>Dominios ignorados</h2>
            <p className="muted">
              Um por linha. Essas abas nunca sao agrupadas automaticamente. Mesma regra de porta das
              predefinicoes: "localhost" ignora todas as portas, "localhost:3000" so aquela.
            </p>
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
        </>
      )}

      {tab === 'rename' && (
        <section className="card">
          <h2>Renomear abas</h2>

          <label className="row">
            <input
              type="checkbox"
              checked={settings.renameTabs}
              onChange={(event) => void update({ renameTabs: event.target.checked })}
            />
            <span>
              <strong>Aplicar nomes proprios as abas</strong>
              <small>
                Quando a pagina carrega e a URL casa com uma regra, o titulo da aba passa a ser o
                nome definido. Vale so para http/https. Se o site trocar o titulo depois, a
                extensao reaplica o seu.
              </small>
            </span>
          </label>

          <p className="muted">
            A primeira regra que casar e a que vale, de cima para baixo. O padrao pode ser um pedaco
            da URL ("github.com/koredata") ou usar "*" ("https://*.atlassian.net/browse/*").
          </p>

          {ruleDrafts.length === 0 && <p className="muted">Nenhuma regra ainda.</p>}

          {ruleDrafts.map((rule) => (
            <div className="rule" key={rule.id}>
              <label className="rule__toggle" title="Ativar ou desativar esta regra">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={(event) => patchRule(rule.id, { enabled: event.target.checked }, true)}
                />
              </label>
              <input
                type="text"
                className="rule__pattern"
                placeholder="URL ou padrao (ex.: mail.google.com/chat)"
                value={rule.pattern}
                spellCheck={false}
                onChange={(event) => patchRule(rule.id, { pattern: event.target.value })}
                onBlur={() => commitRules(ruleDrafts)}
              />
              <input
                type="text"
                className="rule__title"
                placeholder="Nome da aba"
                value={rule.title}
                onChange={(event) => patchRule(rule.id, { title: event.target.value })}
                onBlur={() => commitRules(ruleDrafts)}
              />
              <button
                type="button"
                className="btn btn--danger"
                title="Remover regra"
                onClick={() => commitRules(ruleDrafts.filter((item) => item.id !== rule.id))}
              >
                Remover
              </button>
            </div>
          ))}

          <button type="button" className="btn" onClick={addRule}>
            Adicionar regra
          </button>

          <small className="muted">
            Regras sem padrao ou sem nome nao sao salvas. A renomeacao vale enquanto a aba estiver
            aberta: recarregar a pagina reaplica, e remover a regra volta o titulo original no
            proximo carregamento.
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
          Restaurar padroes
        </button>
        <span className="saved" data-visible={savedAt > 0}>
          Salvo ✓
        </span>
      </footer>
    </main>
  )
}
