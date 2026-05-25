# OpenObsidian — Tech Stack

Documentação completa de todas as ferramentas, bibliotecas e tecnologias usadas para criar o OpenObsidian.

---

## Visão geral

```
┌─────────────────────────────────────────────────────────┐
│                        Electron 29                       │
│   ┌──────────────────────────────────────────────────┐  │
│   │              Main Process (Node.js)              │  │
│   │  fs · path · chokidar · IPC handlers             │  │
│   └──────────────────────────────────────────────────┘  │
│   ┌──────────────────────────────────────────────────┐  │
│   │           Renderer Process (Chromium)            │  │
│   │  React 18 · TypeScript · CodeMirror 6            │  │
│   │  Zustand · D3.js · remark · FlexSearch           │  │
│   └──────────────────────────────────────────────────┘  │
│   Build: electron-vite → Vite → esbuild                  │
│   Package: electron-builder → NSIS / AppImage / deb      │
└─────────────────────────────────────────────────────────┘
```

---

## Runtime e plataforma

### [Electron](https://www.electronjs.org/) `v29`
**O que faz:** Framework que permite criar apps desktop multiplataforma usando tecnologias web (HTML, CSS, JavaScript). Empacota o Chromium (para a UI) e o Node.js (para acesso ao sistema) num único executável.

**Por que usamos:** É o padrão da indústria para apps como Obsidian, VS Code, Discord, Slack. Permite acessar o sistema de arquivos, criar janelas nativas, gerar instaladores.

**Onde usamos:**
- `src/main/index.ts` — processo principal; cria a janela, gerencia IPC, acessa o disco
- `src/preload/index.ts` — ponte segura entre o Node.js e o React (Context Bridge)

**Recursos usados do Electron:**
| API | Para que serve |
|---|---|
| `BrowserWindow` | Cria e configura a janela do app |
| `ipcMain` / `ipcRenderer` | Comunicação entre main e renderer |
| `contextBridge` | Expõe APIs do Node.js de forma segura ao React |
| `dialog` | Caixas de diálogo nativas (abrir pasta, salvar arquivo) |
| `shell` | Abrir arquivos no gerenciador de arquivos do SO |
| `Menu` | Menu nativo da barra de títulos (File, Edit…) |
| `app.getPath('userData')` | Pasta de dados do usuário (configurações, cache) |
| `webContents.printToPDF` | Exportar nota como PDF |

---

### [Node.js](https://nodejs.org/) `v20+`
**O que faz:** Runtime JavaScript do lado do servidor. Roda o processo principal do Electron.

**Módulos nativos usados:**
| Módulo | Uso |
|---|---|
| `fs` | Ler, escrever, copiar, renomear e deletar arquivos e pastas |
| `path` | Montar caminhos de forma cross-platform (`path.join`, `path.basename`, etc.) |
| `Buffer` | Codificar caminhos em base64 para nomes de arquivos de cache |

---

## Build tools

### [electron-vite](https://electron-vite.org/) `v2`
**O que faz:** Ferramenta de build especializada para projetos Electron. Configura o Vite separadamente para os três processos do Electron (main, preload, renderer) com as definições corretas para cada ambiente.

**Por que usamos:** Sem ele, configurar o Vite para funcionar com Electron (que mistura CommonJS e ESModules, Node.js e browser) é muito complexo. O electron-vite resolve isso automaticamente.

**Como usamos:**
- `npm run dev` — inicia o app em modo desenvolvimento com hot-reload
- `npm run build` — compila tudo para produção em `out/`

---

### [Vite](https://vitejs.dev/) `v5`
**O que faz:** Build tool para JavaScript/TypeScript moderno. No desenvolvimento usa ESModules nativos no browser (ultra-rápido). Na produção agrupa tudo com Rollup.

**Por que usamos:** Vem embutido no electron-vite. É responsável por processar o React (JSX/TSX), CSS e importações.

---

### [esbuild](https://esbuild.github.io/)
**O que faz:** Compilador/bundler JavaScript extremamente rápido, escrito em Go. O Vite o usa internamente para transformar TypeScript e JSX.

**Por que usamos:** Está embutido no Vite — não instalamos diretamente. É o que torna o `npm run build` tão rápido.

---

### [TypeScript](https://www.typescriptlang.org/) `v5.3`
**O que faz:** Superset do JavaScript que adiciona tipagem estática. Compila para JavaScript puro antes de rodar.

**Por que usamos:** Detecta erros em tempo de compilação, melhora o autocomplete no editor, e documenta as interfaces do código (ex: `TreeNode`, `NoteFile`, `EditorStats`, `ElectronAPI`).

**Arquivos de configuração:**
- `tsconfig.json` — base
- `tsconfig.node.json` — para o processo main
- `tsconfig.web.json` — para o renderer React

---

## Frontend (Renderer)

### [React](https://react.dev/) `v18`
**O que faz:** Biblioteca para construir interfaces de usuário com componentes reutilizáveis e estado reativo.

**Por que usamos:** É o framework mais popular para UIs complexas. Gerencia toda a interface do OpenObsidian — sidebar, editor, modais, toolbar, etc.

**Hooks utilizados:**
| Hook | Onde / para que |
|---|---|
| `useState` | Estado local dos componentes (modal aberto, texto do filtro, etc.) |
| `useEffect` | Side effects: carregar vault, ouvir eventos, focar input |
| `useCallback` | Memorizar funções para evitar re-renders desnecessários |
| `useRef` | Referência ao editor CodeMirror, timers de autossave, refs de input |
| `useMemo` | Calcular listas filtradas/ordenadas sem recalcular a cada render |
| `forwardRef` + `useImperativeHandle` | Expor métodos do `MarkdownEditor` ao `App` (`insertText`, `openFind`) |

---

### [Zustand](https://zustand-demo.pmnd.rs/) `v4.5`
**O que faz:** Biblioteca de gerenciamento de estado global para React. Alternativa simples ao Redux.

**Por que usamos:** O app tem estado que precisa ser compartilhado entre componentes distantes (vault path, arquivo ativo, backlinks, tags, pinos). Zustand faz isso sem boilerplate.

**O que guardamos no store (`vaultStore.ts`):**
| Estado | Tipo | Descrição |
|---|---|---|
| `vaultPath` | `string \| null` | Caminho da pasta vault aberta |
| `tree` | `TreeNode[]` | Árvore de arquivos/pastas |
| `files` | `NoteFile[]` | Lista plana de todos os arquivos |
| `activeFile` | `NoteFile \| null` | Nota atualmente aberta |
| `activeContent` | `string` | Conteúdo atual no editor |
| `isDirty` | `boolean` | Há alterações não salvas? |
| `backlinks` | `Record<string, string[]>` | Mapa de backlinks |
| `tags` | `Record<string, string[]>` | Mapa de tags |
| `pinnedPaths` | `string[]` | Notas fixadas no topo |
| `tagFilter` | `string \| null` | Tag selecionada para filtrar |
| `searchOpen` | `boolean` | Painel de busca aberto? |

---

## Editor

### [CodeMirror 6](https://codemirror.net/) — múltiplos pacotes
**O que faz:** Editor de código/texto de alta performance para browser. Versão 6 foi reescrita do zero com arquitetura modular.

**Por que usamos:** É o editor usado pelo Obsidian, Replit e muitos outros. Suporta Markdown nativo, autocomplete, highlighting, busca, e é completamente extensível.

**Pacotes instalados:**

| Pacote | Versão | Para que serve |
|---|---|---|
| `@codemirror/state` | `^6.4.1` | Estado do editor (Document, Selection, Transaction) |
| `@codemirror/view` | `^6.25.1` | Renderização, ViewPlugin, decorações, eventos |
| `@codemirror/lang-markdown` | `^6.2.5` | Parser e highlighting de Markdown |
| `@codemirror/language` | `^6.10.1` | Infraestrutura de linguagens, `syntaxHighlighting` |
| `@codemirror/theme-one-dark` | `^6.1.2` | Tema escuro (base do modo dark) |
| `@codemirror/autocomplete` | `^6.20.2` | Popup de autocomplete (WikiLinks, slash commands) |
| `@codemirror/commands` | `^6.3.3` | Comandos do editor (histórico, indentação, etc.) |
| `@codemirror/search` | `^6.7.0` | Painel de Find & Replace (`Ctrl+F`) |
| `@lezer/highlight` | `^1.2.0` | Sistema de highlight baseado no parser Lezer |

**Como usamos:**
- `Compartment` — troca o tema claro/escuro em tempo real sem recriar o editor
- `ViewPlugin` + `RangeSetBuilder` — decorações de WikiLinks (texto roxo clicável)
- `EditorView.updateListener` — emite estatísticas de palavras/chars/cursor em tempo real
- `openSearchPanel` — abre o Find & Replace via `Ctrl+F` ou botão na toolbar

---

## Markdown

### [remark](https://remark.js.org/) `v15` + plugins
**O que faz:** Processador de Markdown para JavaScript. Converte Markdown → HTML via AST (Abstract Syntax Tree).

**Por que usamos:** Renderiza o Preview e é usado para exportar HTML.

| Pacote | Para que serve |
|---|---|
| `remark` | Core do processador (parse + stringify) |
| `remark-gfm` | Suporte a GitHub Flavored Markdown (tabelas, task lists, strikethrough) |
| `remark-html` | Converte o AST para string HTML |

---

### [FlexSearch](https://github.com/nextapps-de/flexsearch) `v0.7`
**O que faz:** Motor de busca full-text em JavaScript. Extremamente rápido graças ao uso de índices invertidos e tokenização customizável.

**Por que usamos:** Alimenta o painel de busca (`Ctrl+Shift+F`) que pesquisa o conteúdo de todos os arquivos do vault em tempo real.

---

## Visualização

### [D3.js](https://d3js.org/) `v7`
**O que faz:** Biblioteca para criar visualizações de dados com SVG e Canvas. Inclui simulações de física (force layout).

**Por que usamos:** Renderiza o Graph View — os nós são notas, as arestas são WikiLinks. Usamos especificamente o `d3-force` para simular a física e posicionar os nós automaticamente.

**APIs do D3 utilizadas:**
| API | Para que serve |
|---|---|
| `d3.forceSimulation` | Simula a física (gravidade, repulsão entre nós) |
| `d3.forceLink` | Força de atração entre nós conectados |
| `d3.forceManyBody` | Repulsão entre todos os nós |
| `d3.forceCenter` | Centraliza o gráfico |
| `d3.zoom` | Zoom e pan do gráfico com scroll/drag |
| `d3.drag` | Arrastar nós individualmente |
| `d3.scaleLinear` | Escalar o tamanho dos nós por número de conexões |

---

## Monitoramento de arquivos

### [chokidar](https://github.com/paulmillr/chokidar) `v3.6`
**O que faz:** Biblioteca de watch de sistema de arquivos para Node.js. Detecta criação, modificação, deleção e renomeação de arquivos/pastas em tempo real.

**Por que usamos:** Observa a pasta vault e notifica o renderer via IPC quando algo muda — assim a sidebar atualiza automaticamente sem precisar dar F5.

**Eventos que escutamos:**
- `add` — arquivo criado
- `unlink` — arquivo deletado
- `change` — arquivo modificado
- `addDir` — pasta criada
- `unlinkDir` — pasta deletada

---

## Utilitários Electron

### [@electron-toolkit/utils](https://github.com/alex8088/electron-toolkit) `v4`
**O que faz:** Utilitários para projetos Electron. Fornece o helper `is.dev` para detectar se está em desenvolvimento, e `optimizer` para configurações automáticas de janela.

### [@electron-toolkit/tsconfig](https://github.com/alex8088/electron-toolkit) `v2`
**O que faz:** Configurações TypeScript base otimizadas para projetos Electron (main e renderer com settings diferentes).

---

## Empacotamento e distribuição

### [electron-builder](https://www.electron.build/) `v24`
**O que faz:** Ferramenta que empacota um projeto Electron em instaladores para Windows, Linux e macOS.

**Por que usamos:** Gera os instaladores que os usuários baixam e instalam com um duplo-clique.

**Targets configurados:**

| Sistema | Formato | Descrição |
|---|---|---|
| Windows | `NSIS` | Instalador `.exe` com assistente de instalação |
| Linux | `AppImage` | Executável portátil, roda em qualquer distro |
| Linux | `deb` | Pacote para Debian, Ubuntu, Mint |
| Linux | `flatpak` | Pacote sandboxado (ideal para Arch, Fedora, etc.) |
| macOS | `dmg` | Imagem de disco (configurado, não testado) |

**Configurações NSIS (Windows):**
- `oneClick: true` — instala sem perguntas
- `perMachine: false` — instala para o usuário atual (não requer admin)

**Configurações Flatpak (Linux):**
- Runtime: `org.freedesktop.Platform//23.08`
- Base app: `org.electronjs.Electron2.BaseApp//23.08`
- `--filesystem=home` — acesso à pasta home para abrir vaults

---

## CI/CD

### [GitHub Actions](https://github.com/features/actions)
**O que faz:** Plataforma de integração contínua integrada ao GitHub. Executa workflows automaticamente em resposta a eventos (push de tag, pull request, etc.).

**Por que usamos:** Quando fazemos `git push v0.x.x`, o GitHub Actions compila automaticamente o app nos servidores do GitHub e publica os instaladores como Release.

**Arquivo:** `.github/workflows/release.yml`

**Jobs configurados:**

| Job | Runner | O que faz |
|---|---|---|
| `build-windows` | `windows-latest` | Roda `npm run dist:win`, gera o `.exe` |
| `build-linux` | `ubuntu-latest` | Instala Flatpak, roda `npm run dist:linux`, gera AppImage + deb + flatpak |
| `release` | `ubuntu-latest` | Coleta artefatos dos dois jobs e cria um GitHub Release |

---

## Geração de ícones

### `scripts/generate-icons.js` (script próprio)
**O que faz:** Script Node.js puro (sem dependências externas) que gera todos os ícones do app em tempo de build.

**Como funciona:**
- Gera um PNG de 512×512 manualmente pixel a pixel (Buffer raw → PNG com chunks IHDR/IDAT/IEND)
- Usa compressão `zlib.deflateSync` para criar o stream IDAT do PNG
- Gera o `.ico` (Windows) com múltiplos tamanhos embutidos (16, 32, 48, 256 px) — formato ICO construído manualmente
- Salva em `resources/icons/` (vários tamanhos para Linux) e `resources/icon.png` / `resources/icon.ico`

**Por que sem dependências:** Evita adicionar pacotes como `sharp` ou `jimp` só para gerar ícones. O script roda como `predist` antes de cada build de distribuição.

---

## Gerenciamento de pacotes

### [npm](https://www.npmjs.com/)
**O que faz:** Gerenciador de pacotes padrão do Node.js. Instala e gerencia todas as dependências listadas no `package.json`.

**Comandos usados no projeto:**
```bash
npm install          # instalar dependências
npm run dev          # iniciar em modo desenvolvimento
npm run build        # compilar para produção
npm run dist:win     # gerar instalador Windows
npm run dist:linux   # gerar instaladores Linux
npm run icons        # gerar ícones manualmente
```

---

## Persistência de dados

### LocalStorage (browser API)
**O que faz:** API nativa do browser/Electron para salvar dados simples no cliente.

**O que salvamos:**
| Chave | Conteúdo |
|---|---|
| `oo-settings` | Configurações da UI (tema, fonte, tamanho, largura da sidebar, sort) |
| `oo-pinned` | Lista de caminhos de notas fixadas |

### JSON em disco (`userData`)
**O que faz:** Arquivos JSON simples na pasta de dados do usuário, acessados pelo processo main via `fs`.

**Arquivos:**
| Arquivo | Conteúdo |
|---|---|
| `app-settings.json` | Caminho do último vault aberto |
| `indices/<key>.json` | Cache do índice do vault (conteúdo + mtime de cada arquivo) |

---

## Resumo de versões

```
Electron        29.4.6
Node.js         20+
React           18.2
TypeScript      5.3
electron-vite   2.0
Vite            5.0
CodeMirror      6.x
Zustand         4.5
D3.js           7.9
remark          15.0
remark-gfm      4.0
remark-html     16.0
chokidar        3.6
FlexSearch      0.7
electron-builder 24.9
```

---

## Estrutura de pastas

```
OpenObsidian/
├── src/
│   ├── main/
│   │   └── index.ts          # Processo principal Electron (IPC, fs, menu)
│   ├── preload/
│   │   └── index.ts          # Context Bridge (expõe APIs ao renderer)
│   └── renderer/
│       └── src/
│           ├── App.tsx        # Componente raiz, estado global, atalhos
│           ├── store/
│           │   └── vaultStore.ts      # Zustand store
│           ├── hooks/
│           │   └── useSettings.ts     # Hook de configurações (localStorage)
│           ├── styles/
│           │   └── app.css            # Estilos globais + variáveis CSS
│           └── components/
│               ├── Editor/
│               │   ├── MarkdownEditor.tsx  # CodeMirror 6
│               │   ├── MarkdownPreview.tsx # remark → HTML
│               │   └── StatusBar.tsx       # Palavras, chars, cursor
│               ├── Sidebar/
│               │   └── FileTree.tsx        # Árvore, pins, tags, sort
│               ├── Search/
│               │   └── SearchPanel.tsx     # Full-text search (FlexSearch)
│               ├── Graph/
│               │   └── GraphView.tsx       # D3.js force graph
│               ├── Backlinks/
│               │   └── BacklinksPanel.tsx  # Painel de backlinks
│               ├── Insert/
│               │   └── InsertMenu.tsx      # Menu de snippets
│               ├── Templates/
│               │   └── TemplateModal.tsx   # Picker de templates
│               ├── Settings/
│               │   └── SettingsModal.tsx   # Modal de configurações
│               └── Help/
│                   └── HelpModal.tsx       # Documentação em-app (F1)
├── docs/
│   ├── USER_GUIDE.md          # Guia do usuário
│   └── TECH_STACK.md          # Este arquivo
├── scripts/
│   └── generate-icons.js      # Gerador de ícones PNG/ICO puro Node.js
├── resources/
│   ├── icon.png               # Ícone 512×512
│   ├── icon.ico               # Ícone Windows (multi-size)
│   └── icons/                 # Ícones Linux (16, 32, 48, 64, 128, 256, 512 px)
├── .github/
│   └── workflows/
│       └── release.yml        # CI/CD GitHub Actions
├── electron.vite.config.ts    # Configuração do electron-vite
├── tsconfig.json              # TypeScript base
└── package.json               # Dependências e scripts
```
