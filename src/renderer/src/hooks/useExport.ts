import { useCallback, useState } from 'react'
import { useVaultStore } from '../store/vaultStore'

type ViewMode = 'edit' | 'preview' | 'split'

export function useExport(
  notify: (msg: string) => void,
  setViewMode: (mode: ViewMode) => void,
) {
  const store = useVaultStore()
  const [exportMenuOpen, setExportMenuOpen] = useState(false)

  const handleExportHTML = useCallback(async () => {
    if (!store.activeFile) return
    setExportMenuOpen(false)
    const { unified } = await import('unified')
    const { default: remarkParse } = await import('remark-parse')
    const { default: remarkGfm } = await import('remark-gfm')
    const { default: remarkHtml } = await import('remark-html')
    const result = await unified()
      .use(remarkParse).use(remarkGfm).use(remarkHtml, { sanitize: false })
      .process(store.activeContent)
    const dest = await window.api.exportHtml(store.activeFile.name, String(result))
    if (dest) notify(`Exported to: ${dest.split(/[/\\]/).pop()}`)
  }, [store.activeFile, store.activeContent, notify])

  const handleExportPDF = useCallback(async () => {
    if (!store.activeFile) return
    setExportMenuOpen(false)
    setViewMode('preview')
    await new Promise((r) => setTimeout(r, 200))
    const dest = await window.api.exportPdf(store.activeFile.name)
    if (dest) notify(`PDF saved: ${dest.split(/[/\\]/).pop()}`)
  }, [store.activeFile, notify, setViewMode])

  return { handleExportHTML, handleExportPDF, exportMenuOpen, setExportMenuOpen }
}
