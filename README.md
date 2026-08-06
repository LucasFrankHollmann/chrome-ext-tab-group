# Tytab

Extensão Chrome (Manifest V3) para organizar abas em grupos, feita com **React 19 + TypeScript + Vite 7**.

## Rodando

```bash
npm install
npm run build      # gera ícones, checa tipos, builda e valida o dist/
npm run dev        # rebuild em watch enquanto você desenvolve
```

Depois:

1. Abra `chrome://extensions`
2. Ative o **Modo do desenvolvedor**
3. **Carregar sem compactação** → selecione a pasta `dist/`
4. Ao alterar o código, o `npm run dev` regrava o `dist/`; clique em **Atualizar** na extensão (recarregar a página não basta para o service worker)

## Scripts

| Script | O que faz |
| --- | --- |
| `npm run build` | ícones → `tsc -b` → `vite build` → validação do `dist/` |
| `npm run dev` | `vite build --watch` (a extensão não usa o dev server do Vite) |
| `npm run icons` | regera os PNGs em `public/icons/` |
| `npm run verify` | confere se o `dist/` bate com o `manifest.json` |
| `npm run clean` | apaga o `dist/` |

## Permissões

| Permissão | Para quê |
| --- | --- |
| `tabs` | ler título/URL/favicon das abas, ativar, fixar, silenciar e fechar |
| `tabGroups` | criar, renomear, colorir, recolher e desfazer grupos |
| `storage` | salvar as preferências (`chrome.storage.sync`) |
| `contextMenus` | ações rápidas no menu de contexto do ícone |

Não há `host_permissions` nem content scripts: a extensão não lê o conteúdo das páginas.

## Funcionalidades

**Popup**
- Lista as abas da janela atual separadas por grupo (e "Sem grupo")
- Filtro por título, URL ou domínio
- Clique = selecionar a aba (`Shift`+clique seleciona intervalo)
- Com abas selecionadas: criar grupo com nome + cor, desagrupar ou fechar em lote
- Por grupo: renomear inline, trocar cor, recolher/expandir, desagrupar, fechar tudo
- Por aba: fechar
- Botões globais: recolher/expandir tudo, desagrupar tudo (com confirmação)
- Atualiza sozinho quando abas/grupos mudam fora do popup

**Background (service worker)**
- Menu de contexto: agrupar por domínio, desagrupar tudo, recolher/expandir grupos
- Agrupamento automático de abas novas pelo domínio (desligado por padrão)

**Opções**
- Agrupamento automático com dois modos exclusivos: **por domínio** (procura um grupo cujo *nome* seja o do domínio) ou **por predefinição** (você define nome do grupo + domínios que entram nele)
- Cor por domínio e recolher grupos recém-criados
- Mínimo de abas por grupo, cor padrão e lista de domínios ignorados

## Estrutura

```
popup.html / options.html      entradas HTML (raiz, como o Vite espera)
public/manifest.json           manifest MV3, copiado para dist/
public/icons/                  PNGs gerados por scripts/generate-icons.mjs
src/lib/types.ts               tipos, cores e settings padrão
src/lib/domain.ts              extração de domínio e rótulo do grupo
src/lib/storage.ts             chrome.storage.sync tipado
src/lib/tabs.ts                toda a lógica de abas/grupos (usada por popup e background)
src/background/index.ts        service worker: comandos, menus, auto-agrupamento
src/popup/                     UI React do popup
src/options/                   UI React das configurações
scripts/                       geração de ícones e validação do dist/
```

O `manifest.json` referencia `background.js` por nome fixo — o `vite.config.ts` garante esse nome de saída, enquanto popup e options recebem hash normalmente.

## Publicar

`npm run build` e compacte o conteúdo de `dist/` (não a pasta) em um `.zip` para o Chrome Web Store.
