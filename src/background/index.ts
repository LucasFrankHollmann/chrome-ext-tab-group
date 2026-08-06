import {
  autoGroupTab,
  collapseAll,
  collapseForTabSwitch,
  collapsePendingGroups,
  getCurrentWindowId,
  groupByDomain,
  ungroupAll,
} from '@/lib/tabs'
import { applyTitleRules } from '@/lib/titles'
import { getSettings } from '@/lib/storage'

const MENU = {
  groupByDomain: 'group-by-domain',
  groupSameDomain: 'group-same-domain',
  ungroupAll: 'ungroup-all',
  collapseAll: 'collapse-all',
  expandAll: 'expand-all',
} as const

function createMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU.groupByDomain,
      title: 'Group tabs by site',
      contexts: ['action', 'page'],
    })
    chrome.contextMenus.create({
      id: MENU.ungroupAll,
      title: 'Ungroup all tabs',
      contexts: ['action', 'page'],
    })
    chrome.contextMenus.create({
      id: 'separator',
      type: 'separator',
      contexts: ['action', 'page'],
    })
    chrome.contextMenus.create({
      id: MENU.collapseAll,
      title: 'Collapse all groups',
      contexts: ['action', 'page'],
    })
    chrome.contextMenus.create({
      id: MENU.expandAll,
      title: 'Expand all groups',
      contexts: ['action', 'page'],
    })
  })
}

chrome.runtime.onInstalled.addListener(async (details) => {
  createMenus()
  // Garante que o storage comeca com os defaults gravados.
  await getSettings().then((settings) => chrome.storage.sync.set({ settings }))
  if (details.reason === 'install') {
    await chrome.tabs.create({ url: chrome.runtime.getURL('options.html') })
  }
})

chrome.runtime.onStartup.addListener(createMenus)

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const windowId = tab?.windowId ?? (await getCurrentWindowId())

  switch (info.menuItemId) {
    case MENU.groupByDomain:
      await groupByDomain(windowId)
      break
    case MENU.ungroupAll:
      await ungroupAll(windowId)
      break
    case MENU.collapseAll:
      await collapseAll(windowId, true)
      break
    case MENU.expandAll:
      await collapseAll(windowId, false)
      break
  }
})

// onCreated e onUpdated podem disparar quase juntos para a mesma aba; enfileirar
// evita que duas execucoes criem dois grupos para o mesmo dominio.
let queue: Promise<void> = Promise.resolve()

function enqueueTabWork(tabId: number | undefined) {
  if (tabId == null) return

  queue = queue.then(async () => {
    try {
      // Releitura: na hora de rodar, a aba pode ja ter sido movida/fechada.
      const tab = await chrome.tabs.get(tabId)
      const grouping = await autoGroupTab(tab)
      const renaming = await applyTitleRules(tab)
      const after = await chrome.tabs.get(tabId).catch(() => null)
      console.log(
        `[tab-group] aba ${tabId}`,
        tab.url,
        '→',
        grouping,
        '| grupo agora:',
        after?.groupId,
        '|',
        renaming,
      )
    } catch (error) {
      console.error('[tab-group] onTabWork', error)
    }
  })
}

// Abas novas costumam nascer sem URL; esperamos o commit da navegacao
// (changeInfo.url so aparece quando a URL efetivamente muda). O 'complete' e a
// segunda chance: se o grupo do commit se perdeu (troca de aba, ver onReplaced),
// aqui ele e refeito. autoGroupTab nao faz nada quando a aba ja esta agrupada.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!changeInfo.url && changeInfo.status !== 'complete') return
  enqueueTabWork(tabId)
})

chrome.tabs.onCreated.addListener((tab) => {
  if (!tab.url && !tab.pendingUrl) return
  enqueueTabWork(tab.id)
})

// O Chrome pre-carrega a pagina e troca a aba por outra, com id novo: a aba que
// agrupamos e destruida, o grupo fica vazio e desaparece. Reagrupa a substituta.
chrome.tabs.onReplaced.addListener((addedTabId) => {
  enqueueTabWork(addedTabId)
})

// Trocar de aba recolhe os grupos da janela. O Chrome nao deixa recolher o grupo
// que contem a aba ativa, entao esse fica aberto (os demais fecham).
function enqueueCollapse(windowId: number, origin: string) {
  queue = queue.then(async () => {
    // Os dois passos sao independentes de proposito: a fila de atrasados falhar
    // (storage indisponivel, por exemplo) nao pode impedir o recolher normal.
    try {
      const late = await collapsePendingGroups()
      if (late > 0) console.log(`[tab-group] ${late} grupo(s) atrasado(s) recolhido(s)`)
    } catch (error) {
      console.error('[tab-group] collapsePendingGroups', error)
    }

    try {
      console.log(`[tab-group] ${origin} → recolhendo na janela ${windowId}`)
      await collapseForTabSwitch(windowId, await getSettings())
    } catch (error) {
      console.error('[tab-group] collapseForTabSwitch', error)
    }
  })
}

chrome.tabs.onActivated.addListener(({ windowId }) => {
  enqueueCollapse(windowId, 'troca de aba')
})

// Trocar de janela nao dispara onActivated: sem isto, os grupos da janela que
// voltou ao foco ficavam abertos ate a proxima troca de aba dentro dela.
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return
  enqueueCollapse(windowId, 'troca de janela')
})
