/** Cores aceitas pelo Chrome para grupos de abas ("blue", "red", ...). */
export type GroupColor = `${chrome.tabGroups.Color}`

export const GROUP_COLORS: GroupColor[] = [
  'grey',
  'blue',
  'red',
  'yellow',
  'green',
  'pink',
  'purple',
  'cyan',
  'orange',
]

/** Rotulos das cores nativas do Chrome, como o navegador as chama. */
export const GROUP_COLOR_LABELS: Record<GroupColor, string> = {
  grey: 'Grey',
  blue: 'Blue',
  red: 'Red',
  yellow: 'Yellow',
  green: 'Green',
  pink: 'Pink',
  purple: 'Purple',
  cyan: 'Cyan',
  orange: 'Orange',
}

/**
 * Cores usadas para desenhar os grupos na UI da extensao, imitando o seletor de
 * cores do proprio navegador. Cada cor tem dois valores porque o navegador pinta
 * o grupo com tons diferentes no tema claro e no escuro.
 *
 * Nao ha API que entregue esses valores: `chrome.tabGroups` so devolve o nome da
 * cor ("blue"), e nas versoes novas do Chrome o tom sai da paleta dinamica do
 * tema. Ou seja, isto e uma aproximacao calibrada a mao — os valores `dark` vem
 * do seletor de cores do navegador do usuario (captura de tela), que e bem mais
 * saturado que a paleta antiga (Material 2) usada aqui antes.
 */
export const GROUP_COLOR_HEX: Record<GroupColor, { light: string; dark: string }> = {
  grey: { light: '#5f6368', dark: '#e3e0ec' },
  blue: { light: '#1a73e8', dark: '#4c5ff7' },
  red: { light: '#d93025', dark: '#f52d4d' },
  yellow: { light: '#f9ab00', dark: '#f4d31f' },
  green: { light: '#1e8e3e', dark: '#6be97f' },
  pink: { light: '#d01884', dark: '#f4218d' },
  purple: { light: '#9334e6', dark: '#8f3ff0' },
  cyan: { light: '#007b83', dark: '#2fe0ef' },
  orange: { light: '#e8710a', dark: '#fa7b17' },
}

/** Cor de um grupo no tema em uso — combina com o que o Chrome desenha. */
export function groupColorHex(color: GroupColor, dark: boolean): string {
  return dark ? GROUP_COLOR_HEX[color].dark : GROUP_COLOR_HEX[color].light
}

/** Como uma aba nova escolhe seu grupo quando o agrupamento automatico esta ligado. */
export type AutoGroupMode = 'domain' | 'preset'

/** Grupo pre-definido pelo usuario: um nome fixo e os dominios que caem nele. */
export interface GroupPreset {
  id: string
  title: string
  color: GroupColor
  /** Dominios normalizados ("youtube.com"); subdominios tambem casam. */
  domains: string[]
  /**
   * Legado: hoje a preferencia por grupo vive em `Settings.groupCollapse`, que
   * vale para qualquer grupo (nao so os de predefinicao). Ainda e lido como
   * fallback para nao perder a escolha de quem configurou antes.
   */
  collapseOnTabSwitch?: boolean
}

/**
 * Regra de renomeacao: quando a URL da aba casa com `pattern`, o titulo da aba
 * passa a ser `title`.
 */
export interface TitleRule {
  id: string
  /** Pedaco de URL ("mail.google.com/chat") ou glob com "*" ("*.jira.com/browse/*"). */
  pattern: string
  /** Titulo que a aba passa a mostrar. */
  title: string
  enabled: boolean
}

export interface Settings {
  /** Agrupa automaticamente uma aba nova junto das outras do mesmo dominio. */
  autoGroupNewTabs: boolean
  /** Regra usada pelo agrupamento automatico: por dominio ou por predefinicao. */
  autoGroupMode: AutoGroupMode
  /** Predefinicoes usadas quando `autoGroupMode` é 'preset'. */
  presets: GroupPreset[]
  /** Minimo de abas do mesmo dominio para que "Agrupar por dominio" crie um grupo. */
  minTabsPerGroup: number
  /** Cor usada ao criar um grupo manualmente. */
  defaultColor: GroupColor
  /** Usa uma cor diferente por dominio ao agrupar automaticamente. */
  colorizeByDomain: boolean
  /** Recolhe os grupos recem-criados. */
  collapseNewGroups: boolean
  /**
   * Recolhe, na troca de aba, os grupos que nao tem preferencia propria em
   * `groupCollapse`.
   */
  collapseOnTabSwitch: boolean
  /**
   * Preferencia por grupo, com prioridade sobre `collapseOnTabSwitch`. A chave e
   * o nome do grupo normalizado (`groupCollapseKey`), porque e o unico
   * identificador estavel: o id de um grupo muda a cada sessao do navegador.
   */
  groupCollapse: Record<string, boolean>
  /** Dominios que nunca devem ser agrupados automaticamente. */
  ignoredDomains: string[]
  /** Renomeia abas cuja URL casa com a regra, quando a pagina carrega. */
  renameTabs: boolean
  titleRules: TitleRule[]
}

export const DEFAULT_SETTINGS: Settings = {
  autoGroupNewTabs: false,
  autoGroupMode: 'domain',
  presets: [],
  minTabsPerGroup: 2,
  defaultColor: 'blue',
  colorizeByDomain: true,
  collapseNewGroups: false,
  collapseOnTabSwitch: true,
  ignoredDomains: ['newtab', 'localhost'],
  groupCollapse: {},
  renameTabs: false,
  titleRules: [],
}

/** Aba no formato consumido pela UI (subset serializavel de chrome.tabs.Tab). */
export interface TabInfo {
  id: number
  windowId: number
  index: number
  title: string
  url: string
  domain: string
  favIconUrl?: string
  active: boolean
  pinned: boolean
  audible: boolean
  muted: boolean
  discarded: boolean
  groupId: number
}

export interface GroupInfo {
  id: number
  title: string
  color: GroupColor
  collapsed: boolean
  windowId: number
}

export const UNGROUPED = -1 satisfies number

/** Chave de `Settings.groupCollapse`: nome do grupo sem caixa nem espaco em volta. */
export function groupCollapseKey(title: string): string {
  return title.trim().toLowerCase()
}
