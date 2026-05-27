// ── Source of truth: en-US ────────────────────────────────────────────────────
// All other locales are typed against this object.
// TypeScript will error at compile time if any locale is missing a key.

export const en = {
  // Settings modal
  settings:       'Settings',
  appearance:     'Appearance',
  language:       'Language',
  theme:          'Theme',
  themeDark:      '🌙 Dark',
  themeLight:     '☀️ Light',
  editorFontSize: 'Editor font size',
  editorFont:     'Editor font',

  // View mode buttons
  viewEdit:    'Edit',
  viewSplit:   'Split',
  viewPreview: 'Preview',

  // Toolbar tooltips
  ttDailyNote: 'Daily Note (today)',
  ttToc:       'Table of Contents',
  ttExport:    'Export note',
  ttGraph:     'Graph view (Ctrl+G)',
  ttHelp:      'Help (F1)',
  ttSettings:  'Settings (Ctrl+,)',
  ttFind:      'Find & Replace (Ctrl+F)',
  ttBack:      'Back (Alt+← or mouse button 4)',
  ttForward:   'Forward (Alt+→ or mouse button 5)',
  ttUnsaved:   'Unsaved changes',

  // Export menu
  exportHtml: 'Export as HTML',
  exportPdf:  'Export as PDF',

  // Welcome screen
  welcomeTagline:  'Open source markdown knowledge base',
  openVault:       'Open Vault Folder',
  openOtherVault:  'Open Other Vault…',
  openVaultBtn:    'Open Vault…',
  help:            '? Help',
  welcomeHint:     'Ctrl+Shift+O · Ctrl+N · Ctrl+Shift+F · Ctrl+G · F1',
  reopenVault:     'Open "{name}"',

  // Empty state
  emptyState: 'Select a note or create a new one',
  newNote:    'New Note (Ctrl+N)',
  graphView:  'Graph View (Ctrl+G)',

  // Sidebar
  filterNotes:          'Filter notes…',
  newNoteBtn:           'New Note (Ctrl+N)',
  newFolderBtn:         'New Folder',
  searchNotesBtn:       'Search notes (Ctrl+Shift+F)',
  expandSidebar:        'Expand sidebar',
  collapseSidebar:      'Collapse sidebar (Ctrl+\\)',
  pinned:               '📌 Pinned',
  noNotes:              'No notes yet',
  sortAZ:               'A→Z',
  sortZA:               'Z→A',
  sortRecent:           'Recent',
  folderNamePlaceholder:'Folder name…',

  // Context menu
  ctxNewNote:      '📄 New Note Here',
  ctxNewFolder:    '📁 New Folder Here',
  ctxRename:       '✏️ Rename',
  ctxDuplicate:    '📋 Duplicate',
  ctxPin:          '📌 Pin to top',
  ctxUnpin:        '📌 Unpin',
  ctxCopyPath:     '📎 Copy Path',
  ctxShowInFiles:  '📂 Show in File Manager',
  ctxDelete:       '🗑 Delete',
  ctxDeleteConfirm:'Delete "{name}"?',
  ctxDeleteBtn:    'Delete',
  ctxCancelBtn:    'Cancel',

  // Backlinks panel
  backlinks:   'Backlinks',
  noFileOpen:  'No file open',
  noBacklinks: 'No notes link here',

  // Search panel
  searchPlaceholder: 'Search all notes...',
  searchClose:       'Close',
  searching:         'Searching…',
  noResults:         'No results for "{query}"',

  // TOC panel
  tocTitle: 'Contents',
  tocEmpty: 'No headings found',

  // PDF viewer
  pdfOpenNotes: '📝 Open Notes',

  // DOCX viewer
  docxOpenInApp:  '↗ Open in App',
  docxConvert:    '⬇ Convert to .md',
  docxConverting: '…Converting',
  docxLoading:    'Loading document…',
  docxReadError:  'Could not read file: {error}',
  docxEmpty:      'Empty document.',

  // Template modal
  tplTitle:           'New Note',
  tplIn:              'in {folder}',
  tplNamePlaceholder: 'Note name…',
  tplCancel:          'Cancel',
  tplCreate:          'Create',
  tplBlank:           'Blank note',
  tplDaily:           'Daily note',
  tplMeeting:         'Meeting notes',
  tplProject:         'Project plan',
  tplBook:            'Book notes',
  tplIdea:            'Idea / brainstorm',

  // Notifications / toasts
  toastOpenVaultFirst:   'Open a vault first',
  toastNoVault:          'No vault open',
  toastBackupSaved:      'Backup saved to: {path}',
  toastExportedHtml:     'Exported to: {file}',
  toastExportedPdf:      'PDF saved: {file}',
  toastConverted:        'Converted to {name}.md',
  toastOpeningExisting:  'Opening existing note: {name}',
  toastOpenError:        'Could not open: {err}',
  toastConversionFailed: 'Conversion failed: {err}',

  // Daily note template content
  dailyAnnotations: '## Notes',
  dailyTasks:       '## Tasks',
  dailyTask1:       'Task 1',
  dailyTask2:       'Task 2',
  dailyTask3:       'Task 3',
}

// ── PT-BR ────────────────────────────────────────────────────────────────────
const ptBR: typeof en = {
  settings:       'Configurações',
  appearance:     'Aparência',
  language:       'Idioma',
  theme:          'Tema',
  themeDark:      '🌙 Escuro',
  themeLight:     '☀️ Claro',
  editorFontSize: 'Tamanho da fonte',
  editorFont:     'Fonte do editor',

  viewEdit:    'Editar',
  viewSplit:   'Dividir',
  viewPreview: 'Visualizar',

  ttDailyNote: 'Nota diária (hoje)',
  ttToc:       'Índice',
  ttExport:    'Exportar nota',
  ttGraph:     'Grafo (Ctrl+G)',
  ttHelp:      'Ajuda (F1)',
  ttSettings:  'Configurações (Ctrl+,)',
  ttFind:      'Buscar e substituir (Ctrl+F)',
  ttBack:      'Voltar (Alt+← ou botão 4 do mouse)',
  ttForward:   'Avançar (Alt+→ ou botão 5 do mouse)',
  ttUnsaved:   'Alterações não salvas',

  exportHtml: 'Exportar como HTML',
  exportPdf:  'Exportar como PDF',

  welcomeTagline:  'Base de conhecimento Markdown open source',
  openVault:       'Abrir pasta do vault',
  openOtherVault:  'Abrir outro vault…',
  openVaultBtn:    'Abrir vault…',
  help:            '? Ajuda',
  welcomeHint:     'Ctrl+Shift+O · Ctrl+N · Ctrl+Shift+F · Ctrl+G · F1',
  reopenVault:     'Abrir "{name}"',

  emptyState: 'Selecione uma nota ou crie uma nova',
  newNote:    'Nova nota (Ctrl+N)',
  graphView:  'Grafo (Ctrl+G)',

  filterNotes:           'Filtrar notas…',
  newNoteBtn:            'Nova nota (Ctrl+N)',
  newFolderBtn:          'Nova pasta',
  searchNotesBtn:        'Buscar notas (Ctrl+Shift+F)',
  expandSidebar:         'Expandir barra lateral',
  collapseSidebar:       'Recolher barra lateral (Ctrl+\\)',
  pinned:                '📌 Fixadas',
  noNotes:               'Nenhuma nota ainda',
  sortAZ:                'A→Z',
  sortZA:                'Z→A',
  sortRecent:            'Recentes',
  folderNamePlaceholder: 'Nome da pasta…',

  ctxNewNote:      '📄 Nova nota aqui',
  ctxNewFolder:    '📁 Nova pasta aqui',
  ctxRename:       '✏️ Renomear',
  ctxDuplicate:    '📋 Duplicar',
  ctxPin:          '📌 Fixar no topo',
  ctxUnpin:        '📌 Desafixar',
  ctxCopyPath:     '📎 Copiar caminho',
  ctxShowInFiles:  '📂 Mostrar no explorador',
  ctxDelete:       '🗑 Excluir',
  ctxDeleteConfirm:'Excluir "{name}"?',
  ctxDeleteBtn:    'Excluir',
  ctxCancelBtn:    'Cancelar',

  backlinks:   'Backlinks',
  noFileOpen:  'Nenhum arquivo aberto',
  noBacklinks: 'Nenhuma nota aponta aqui',

  searchPlaceholder: 'Buscar em todas as notas...',
  searchClose:       'Fechar',
  searching:         'Buscando…',
  noResults:         'Nenhum resultado para "{query}"',

  tocTitle: 'Índice',
  tocEmpty: 'Nenhum título encontrado',

  pdfOpenNotes: '📝 Abrir notas',

  docxOpenInApp:  '↗ Abrir no app',
  docxConvert:    '⬇ Converter para .md',
  docxConverting: '…Convertendo',
  docxLoading:    'Carregando documento…',
  docxReadError:  'Não foi possível ler: {error}',
  docxEmpty:      'Documento vazio.',

  tplTitle:           'Nova nota',
  tplIn:              'em {folder}',
  tplNamePlaceholder: 'Nome da nota…',
  tplCancel:          'Cancelar',
  tplCreate:          'Criar',
  tplBlank:           'Nota em branco',
  tplDaily:           'Nota diária',
  tplMeeting:         'Notas de reunião',
  tplProject:         'Plano de projeto',
  tplBook:            'Notas de leitura',
  tplIdea:            'Ideia / brainstorm',

  toastOpenVaultFirst:   'Abra um vault primeiro',
  toastNoVault:          'Nenhum vault aberto',
  toastBackupSaved:      'Backup salvo em: {path}',
  toastExportedHtml:     'Exportado para: {file}',
  toastExportedPdf:      'PDF salvo: {file}',
  toastConverted:        'Convertido para {name}.md',
  toastOpeningExisting:  'Abrindo nota existente: {name}',
  toastOpenError:        'Não foi possível abrir: {err}',
  toastConversionFailed: 'Falha na conversão: {err}',

  dailyAnnotations: '## Anotações',
  dailyTasks:       '## Tarefas',
  dailyTask1:       'Tarefa 1',
  dailyTask2:       'Tarefa 2',
  dailyTask3:       'Tarefa 3',
}

// ── ES-LATAM ─────────────────────────────────────────────────────────────────
const esLatam: typeof en = {
  settings:       'Configuración',
  appearance:     'Apariencia',
  language:       'Idioma',
  theme:          'Tema',
  themeDark:      '🌙 Oscuro',
  themeLight:     '☀️ Claro',
  editorFontSize: 'Tamaño de fuente',
  editorFont:     'Fuente del editor',

  viewEdit:    'Editar',
  viewSplit:   'Dividir',
  viewPreview: 'Vista previa',

  ttDailyNote: 'Nota diaria (hoy)',
  ttToc:       'Tabla de contenidos',
  ttExport:    'Exportar nota',
  ttGraph:     'Grafo (Ctrl+G)',
  ttHelp:      'Ayuda (F1)',
  ttSettings:  'Configuración (Ctrl+,)',
  ttFind:      'Buscar y reemplazar (Ctrl+F)',
  ttBack:      'Atrás (Alt+← o botón 4 del ratón)',
  ttForward:   'Adelante (Alt+→ o botón 5 del ratón)',
  ttUnsaved:   'Cambios sin guardar',

  exportHtml: 'Exportar como HTML',
  exportPdf:  'Exportar como PDF',

  welcomeTagline:  'Base de conocimiento Markdown de código abierto',
  openVault:       'Abrir carpeta del vault',
  openOtherVault:  'Abrir otro vault…',
  openVaultBtn:    'Abrir vault…',
  help:            '? Ayuda',
  welcomeHint:     'Ctrl+Shift+O · Ctrl+N · Ctrl+Shift+F · Ctrl+G · F1',
  reopenVault:     'Abrir "{name}"',

  emptyState: 'Selecciona una nota o crea una nueva',
  newNote:    'Nueva nota (Ctrl+N)',
  graphView:  'Grafo (Ctrl+G)',

  filterNotes:           'Filtrar notas…',
  newNoteBtn:            'Nueva nota (Ctrl+N)',
  newFolderBtn:          'Nueva carpeta',
  searchNotesBtn:        'Buscar notas (Ctrl+Shift+F)',
  expandSidebar:         'Expandir barra lateral',
  collapseSidebar:       'Contraer barra lateral (Ctrl+\\)',
  pinned:                '📌 Fijadas',
  noNotes:               'Sin notas aún',
  sortAZ:                'A→Z',
  sortZA:                'Z→A',
  sortRecent:            'Recientes',
  folderNamePlaceholder: 'Nombre de carpeta…',

  ctxNewNote:      '📄 Nueva nota aquí',
  ctxNewFolder:    '📁 Nueva carpeta aquí',
  ctxRename:       '✏️ Renombrar',
  ctxDuplicate:    '📋 Duplicar',
  ctxPin:          '📌 Fijar al inicio',
  ctxUnpin:        '📌 Desfijar',
  ctxCopyPath:     '📎 Copiar ruta',
  ctxShowInFiles:  '📂 Mostrar en explorador',
  ctxDelete:       '🗑 Eliminar',
  ctxDeleteConfirm:'¿Eliminar "{name}"?',
  ctxDeleteBtn:    'Eliminar',
  ctxCancelBtn:    'Cancelar',

  backlinks:   'Backlinks',
  noFileOpen:  'Ningún archivo abierto',
  noBacklinks: 'Ninguna nota apunta aquí',

  searchPlaceholder: 'Buscar en todas las notas...',
  searchClose:       'Cerrar',
  searching:         'Buscando…',
  noResults:         'Sin resultados para "{query}"',

  tocTitle: 'Contenido',
  tocEmpty: 'No se encontraron títulos',

  pdfOpenNotes: '📝 Abrir notas',

  docxOpenInApp:  '↗ Abrir en app',
  docxConvert:    '⬇ Convertir a .md',
  docxConverting: '…Convirtiendo',
  docxLoading:    'Cargando documento…',
  docxReadError:  'No se pudo leer: {error}',
  docxEmpty:      'Documento vacío.',

  tplTitle:           'Nueva nota',
  tplIn:              'en {folder}',
  tplNamePlaceholder: 'Nombre de la nota…',
  tplCancel:          'Cancelar',
  tplCreate:          'Crear',
  tplBlank:           'Nota en blanco',
  tplDaily:           'Nota diaria',
  tplMeeting:         'Notas de reunión',
  tplProject:         'Plan de proyecto',
  tplBook:            'Notas de lectura',
  tplIdea:            'Idea / lluvia de ideas',

  toastOpenVaultFirst:   'Abre un vault primero',
  toastNoVault:          'Ningún vault abierto',
  toastBackupSaved:      'Copia guardada en: {path}',
  toastExportedHtml:     'Exportado a: {file}',
  toastExportedPdf:      'PDF guardado: {file}',
  toastConverted:        'Convertido a {name}.md',
  toastOpeningExisting:  'Abriendo nota existente: {name}',
  toastOpenError:        'No se pudo abrir: {err}',
  toastConversionFailed: 'Error en la conversión: {err}',

  dailyAnnotations: '## Anotaciones',
  dailyTasks:       '## Tareas',
  dailyTask1:       'Tarea 1',
  dailyTask2:       'Tarea 2',
  dailyTask3:       'Tarea 3',
}

// ── Registry ──────────────────────────────────────────────────────────────────
export const translations = {
  'en-US':    en,
  'pt-BR':    ptBR,
  'es-LATAM': esLatam,
}
