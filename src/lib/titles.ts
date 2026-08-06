import { getSettings } from './storage'
import type { TitleRule } from './types'

/**
 * Casa a URL com o padrao da regra. Sem "*", basta a URL conter o padrao
 * ("github.com/minha-org" pega qualquer pagina daquela org). Com "*", o padrao
 * vira glob ancorado na URL inteira ("https://*.jira.com/browse/*").
 * A comparacao ignora caixa e o "https://" do padrao e opcional.
 */
export function urlMatchesPattern(url: string, pattern: string): boolean {
  const target = pattern.trim().toLowerCase()
  if (!target) return false
  const haystack = url.toLowerCase()

  if (!target.includes('*')) return haystack.includes(target)

  // Escapa tudo menos "*", que virou ".*".
  const source = target.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  // Sem esquema no padrao, deixa o inicio livre: "*.jira.com/x" casa com https://.
  const prefix = /^[a-z]+:/.test(target) ? '' : '.*'
  return new RegExp(`^${prefix}${source}$`).test(haystack)
}

/** Primeira regra ativa que cobre a URL (a ordem da lista e a prioridade). */
export function matchTitleRule(url: string, rules: TitleRule[]): TitleRule | undefined {
  return rules.find(
    (rule) => rule.enabled && rule.title.trim() && urlMatchesPattern(url, rule.pattern),
  )
}

/**
 * Roda na pagina: troca o titulo e vigia o <title>. Sites que reescrevem o
 * titulo depois (Gmail, SPAs em geral) sobrescreveriam a renomeacao, entao o
 * observer reaplica. `data-tab-group-title` evita instalar dois observers.
 */
function applyTitleInPage(title: string): void {
  const doc = document
  const marker = 'tabGroupTitle'

  const write = () => {
    if (doc.title !== title) doc.title = title
  }

  write()
  if (doc.documentElement.dataset[marker] === title) return
  doc.documentElement.dataset[marker] = title

  const head = doc.querySelector('head')
  if (!head) return
  new MutationObserver(() => {
    // Se outra regra assumiu a aba (navegacao interna), este observer para.
    if (doc.documentElement.dataset[marker] !== title) return
    write()
  }).observe(head, { subtree: true, childList: true, characterData: true })
}

/**
 * Renomeia a aba se alguma regra cobrir sua URL. Devolve uma descricao da
 * decisao (aparece no console do service worker).
 */
export async function applyTitleRules(tab: chrome.tabs.Tab): Promise<string> {
  const settings = await getSettings()
  if (!settings.renameTabs) return 'renomear abas desligado'
  if (tab.id == null) return 'aba sem id'

  const url = tab.url || tab.pendingUrl || ''
  // Sem host permission em chrome:// e afins: injetar ali sempre falha.
  if (!/^https?:/.test(url)) return `nao renomeia ${url || 'aba sem URL'}`

  const rule = matchTitleRule(url, settings.titleRules)
  if (!rule) return 'nenhuma regra de nome casa com a URL'

  const title = rule.title.trim()
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: false },
      func: applyTitleInPage,
      args: [title],
    })
    return `renomeou a aba para "${title}"`
  } catch (error) {
    return `falhou ao renomear para "${title}": ${String(error)}`
  }
}
