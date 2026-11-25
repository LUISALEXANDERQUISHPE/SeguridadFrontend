import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import type {
  CompilationError,
  CompileStatus,
  LatexDocument,
  SaveStatus,
} from '../../types/document'
import {
  compileDocument,
  DEFAULT_LATEX_TEMPLATE,
  downloadPdfFile,
  downloadSourceFile,
  getDocument,
  getProjectTree,
  saveDocument,
} from '../../services/documentService'
import LatexCodeEditor, { type LatexEditorHandle } from './components/LatexCodeEditor'
import PdfViewer from './components/PdfViewer'
import CompilationConsole from './components/CompilationConsole'
import FileExplorer from './components/FileExplorer'
import FilePreview from './components/FilePreview'
import type { ProjectNode } from '../../types/document'
import { parseBibEntries } from '../../utils/bibtex'
import IdeMenuBar, { type IdeMenuActions } from './components/IdeMenuBar'
import IdeRail from './components/IdeRail'
import HistoryPanel from './history/HistoryPanel'
import FormattingToolbar from './components/FormattingToolbar'
import type { FormattingAction } from './utils/latexFormatting'
import type { EditorLayout } from './types'
import useCollaboration from './collab/useCollaboration'
import CollaboratorsBar from './collab/CollaboratorsBar'
import ShareProjectModal from './collab/ShareProjectModal'
import './editor-ide.css'

// Roles que pueden guardar y restaurar versiones (el backend también lo valida)
const EDIT_ROLES: ReadonlySet<string> = new Set(['propietario', 'editor'])

// El PDF se genera aunque la bibliografía falle (citas como [?]); en ese caso se abre la consola con la explicación
function hasBibliographyProblem(warnings: CompilationError[] = []): boolean {
  return warnings.some((warning) => Boolean(warning.friendlyMessage) && (warning.file === 'bibtex' || warning.file === 'biber' || /bibliograf/i.test(warning.message)))
}

interface EditorPageProps {
  // Documento activo (pestaña seleccionada); el editor se muestra al abrir un proyecto desde el panel
  documentId: string | null
  projectId: string | null
  projectName: string
  onBack: () => void
  onDocumentOpen?: (documentId: string) => void
  onDocumentDeleted?: (documentId: string) => void
  openTabs: Array<{ id: string; name: string }>
  onCloseTab: (documentId: string) => void
  onDocumentNameLoaded: (documentId: string, name: string) => void
}

export const EditorPage: React.FC<EditorPageProps> = ({
  documentId,
  projectId,
  projectName,
  onBack,
  onDocumentOpen,
  onDocumentDeleted,
  openTabs,
  onCloseTab,
  onDocumentNameLoaded,
}) => {
  // Diseño del IDE (paneles visibles)
  const [layout, setLayout] = useState<EditorLayout>('split')
  const [isSidePanelOpen, setIsSidePanelOpen] = useState<boolean>(true)
  // Historial de versiones del archivo abierto (HU-23)
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false)
  const editorRef = useRef<LatexEditorHandle | null>(null)

  // Estado del Documento
  const [currentDocument, setCurrentDocument] = useState<LatexDocument | null>(null)
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(projectId)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [content, setContent] = useState<string>(DEFAULT_LATEX_TEMPLATE)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)

  // Estado de Compilación
  const [compileStatus, setCompileStatus] = useState<CompileStatus>('idle')
  const [errors, setErrors] = useState<CompilationError[]>([])
  const [warnings, setWarnings] = useState<CompilationError[]>([])
  const [compilationLog, setCompilationLog] = useState<string>('')
  const [compilationTime, setCompilationTime] = useState<number | undefined>(undefined)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [previousPdfUrl, setPreviousPdfUrl] = useState<string | null>(null)
  const [compileTimestamp, setCompileTimestamp] = useState<number>(0)

  // Navegación a Línea de Error
  const [targetLine, setTargetLine] = useState<number | null>(null)
  const [isConsoleOpen, setIsConsoleOpen] = useState<boolean>(false)

  // Redimensionamiento de paneles
  const [splitPercent, setSplitPercent] = useState<number>(50)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const splitContainerRef = useRef<HTMLDivElement | null>(null)

  // Referencias para debounce y control de cambios
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitialLoadRef = useRef<boolean>(true)
  // Línea a la que saltar cuando termine de cargar el archivo abierto desde un error de compilación
  const pendingLineRef = useRef<number | null>(null)

  // Árbol del proyecto (lo carga el FileExplorer) y últimos textos editados en esta sesión, por si
  // el autoguardado de un .bib aún no llegó al servidor al cambiar de pestaña
  const [projectNodes, setProjectNodes] = useState<ProjectNode[]>([])
  const [editedContents, setEditedContents] = useState<Record<string, string>>({})
  const contentRef = useRef<string>(content)
  contentRef.current = content
  const [isShareOpen, setIsShareOpen] = useState<boolean>(false)

  // Los .bib editados se recuerdan para sugerir sus referencias en \cite{...}
  const rememberBibContent = (doc: LatexDocument | null, text: string) => {
    if (doc?.id && /\.bib$/i.test(doc.name)) {
      setEditedContents((previous) => ({ ...previous, [doc.id]: text }))
    }
  }

  // Edición colaborativa en tiempo real (solo archivos de texto). El servidor fusiona los
  // cambios de todos los colaboradores y guarda el resultado, por eso no se usa el autoguardado.
  const collab = useCollaboration({
    documentId: currentDocument?.id ?? null,
    enabled: Boolean(currentDocument && currentDocument.id === documentId && currentDocument.isText !== false && !isLoading),
    onSynced: (serverContent) => {
      setContent(serverContent)
      rememberBibContent(currentDocument, serverContent)
    },
    onRemoteChange: (nextContent, mapIndex) => {
      const textarea = editorRef.current?.getTextarea() ?? null
      const selection = textarea
        ? {
            start: textarea.selectionStart,
            end: textarea.selectionEnd,
            direction: textarea.selectionDirection,
            scrollTop: textarea.scrollTop,
            scrollLeft: textarea.scrollLeft,
          }
        : null
      // Render síncrono: el textarea debe reflejar el texto compartido antes del siguiente evento de teclado
      flushSync(() => setContent(nextContent))
      if (textarea && selection) {
        textarea.setSelectionRange(mapIndex(selection.start), mapIndex(selection.end), selection.direction)
        textarea.scrollTop = selection.scrollTop
        textarea.scrollLeft = selection.scrollLeft
      }
      rememberBibContent(currentDocument, nextContent)
      setSaveStatus('unsaved')
    },
    onSaved: (savedAt) => {
      if (!autoSaveTimerRef.current) setSaveStatus('saved')
      setLastSavedAt(new Date(savedAt).toLocaleTimeString())
    },
    onSaveError: () => setSaveStatus('error'),
  })

  // 1. Cargar el documento del proyecto abierto
  useEffect(() => {
    let mounted = true

    const initDocument = async () => {
      if (!documentId) {
        setCurrentDocument(null)
        setContent('')
        setLoadError(null)
        setIsLoading(false)
        return
      }
      try {
        const docData = await getDocument(documentId)
        if (mounted) {
          setCurrentDocument(docData)
          // Se conserva para que el File Tree siga visible aunque se cierren todas las pestañas.
          setLoadedProjectId(docData.projectId ?? projectId)
          onDocumentNameLoaded(documentId, docData.name)
          // Un archivo vacío (ej. un .bib o .csv nuevo) se abre vacío; no se rellena con la plantilla LaTeX
          const initialContent = docData.autoSave?.contenido || (docData.content ?? '')
          setContent(initialContent)
          setSaveStatus('saved')
          setLastSavedAt(docData.updatedAt ? new Date(docData.updatedAt).toLocaleTimeString() : null)
          if (docData.lastCompilation?.hasPdf && docData.lastCompilation.pdfUrl) {
            setPdfUrl(docData.lastCompilation.pdfUrl)
            setPreviousPdfUrl(docData.lastCompilation.pdfUrl)
            setCompileStatus('success')
            setCompileTimestamp(Date.now())
          } else {
            setPdfUrl(null)
            setPreviousPdfUrl(null)
            setCompileStatus(docData.lastCompilation?.status === 'fallida' ? 'failed' : 'idle')
          }
          setIsLoading(false)
          if (pendingLineRef.current) {
            const line = pendingLineRef.current
            pendingLineRef.current = null
            setTimeout(() => setTargetLine(line), 50)
          }
        }
      } catch (err: unknown) {
        if (mounted) {
          setLoadError(err instanceof Error ? err.message : 'Error al abrir el proyecto')
          setIsLoading(false)
        }
      } finally {
        setTimeout(() => {
          isInitialLoadRef.current = false
        }, 500)
      }
    }

    void initDocument()

    return () => {
      mounted = false
      // Si quedó un autoguardado pendiente al cerrar o cambiar de proyecto, enviarlo de inmediato
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
        autoSaveTimerRef.current = null
        if (documentId) {
          saveDocument(documentId, contentRef.current, true).catch(() => {})
        }
      }
    }
  }, [documentId, projectId, onDocumentNameLoaded])

  // 2. Manejo de Autoguardado con Debounce (isAutoSave: true)
  const triggerAutoSave = useCallback((docId: string, textToSave: string) => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }

    setSaveStatus('unsaved')

    autoSaveTimerRef.current = setTimeout(async () => {
      autoSaveTimerRef.current = null
      setSaveStatus('saving')
      try {
        const res = await saveDocument(docId, textToSave, true)
        setSaveStatus('saved')
        setLastSavedAt(new Date(res.document.updatedAt).toLocaleTimeString())
      } catch {
        setSaveStatus('error')
      }
    }, 2000) // 2 segundos tras dejar de escribir
  }, [])

  // Envía de inmediato el autoguardado pendiente, para que el historial trabaje con lo último escrito
  const flushPendingAutoSave = useCallback(async () => {
    // En edición colaborativa el servidor guarda con unos segundos de espera: forzar el guardado ahora
    if (collab.isSynced && documentId) {
      setSaveStatus('saving')
      const res = await saveDocument(documentId, contentRef.current, true)
      setSaveStatus('saved')
      setLastSavedAt(new Date(res.document.updatedAt).toLocaleTimeString())
      return
    }
    if (!autoSaveTimerRef.current || !documentId) return
    clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = null
    setSaveStatus('saving')
    const res = await saveDocument(documentId, contentRef.current, true)
    setSaveStatus('saved')
    setLastSavedAt(new Date(res.document.updatedAt).toLocaleTimeString())
  }, [documentId, collab.isSynced])

  // Muestra en el editor el contenido de una versión restaurada (ya guardado en el servidor)
  const { applyLocalChange, isActive: isCollabActive } = collab
  const handleVersionRestored = useCallback((restoredContent: string) => {
    // La versión restaurada se comparte con los demás colaboradores
    if (isCollabActive) applyLocalChange(restoredContent)
    setContent(restoredContent)
    setSaveStatus('saved')
    setLastSavedAt(new Date().toLocaleTimeString())
  }, [applyLocalChange, isCollabActive])

  const handleContentChange = (newContent: string) => {
    // Los binarios (imágenes, PDFs...) no se editan: guardarlos como texto los corrompería
    if (currentDocument?.isText === false) return
    if (collab.isActive) {
      // Sin conexión (o sin permisos de edición) el cambio no se acepta para no perderlo al resincronizar
      if (!collab.applyLocalChange(newContent)) return
      setContent(newContent)
      rememberBibContent(currentDocument, newContent)
      setSaveStatus('unsaved')
      return
    }
    setContent(newContent)
    rememberBibContent(currentDocument, newContent)
    if (!isInitialLoadRef.current && currentDocument?.id) {
      triggerAutoSave(currentDocument.id, newContent)
    } else if (!currentDocument?.id) {
      setSaveStatus('unsaved')
    }
  }

  const handleInsertText = (text: string) => {
    const editor = document.querySelector<HTMLTextAreaElement>('.editor-textarea')
    const currentText = contentRef.current
    const start = editor?.selectionStart ?? currentText.length
    const end = editor?.selectionEnd ?? start
    const nextContent = `${currentText.slice(0, start)}${text}${currentText.slice(end)}`

    handleContentChange(nextContent)

    if (editor) {
      const cursorPosition = start + text.length
      requestAnimationFrame(() => {
        editor.focus()
        editor.setSelectionRange(cursorPosition, cursorPosition)
      })
    }
  }

  // 3. Guardado Manual y Compilación Integrada (Ctrl+S / Cmd+S o Botón Guardar)
  const handleSaveAndCompile = useCallback(async () => {
    // 1. Obtener el contenido actual del editor
    const currentText = contentRef.current

    // Sin un proyecto cargado no hay nada que guardar
    if (!currentDocument?.id) return

    // Cancelar debounce previo de autoguardado
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }

    // 2. Paso 1: Guardar documento en Backend con isAutoSave: false (los binarios no se guardan como texto)
    if (currentDocument.isText !== false) setSaveStatus('saving')
    if (currentDocument.isText !== false) try {
      const res = await saveDocument(currentDocument.id, currentText, false, 'Guardado manual (Ctrl+S)')
      setSaveStatus('saved')
      setLastSavedAt(new Date(res.document.updatedAt).toLocaleTimeString())
    } catch {
      setSaveStatus('error')
      // Si el guardado falla, no continuar con la compilación
      return
    }

    // 3. Paso 2: Compilar automáticamente el contenido actual
    setCompileStatus('compiling')
    try {
      const compRes = await compileDocument(currentDocument.id, currentText)

      setCompilationLog(compRes.log || '')
      setCompilationTime(compRes.compilationTime)
      setErrors(compRes.errors || [])
      setWarnings(compRes.warnings || [])
      setCompileTimestamp(Date.now())

      if (compRes.success) {
        setCompileStatus('success')
        // 4. Actualizar pdfUrl solo si existe y notificar al visor
        if (compRes.pdfUrl) {
          setPdfUrl(compRes.pdfUrl)
          setPreviousPdfUrl(compRes.pdfUrl)
        }
        // Compilación limpia: volver al PDF; si la bibliografía falló, mostrar el registro con la explicación
        setIsConsoleOpen(hasBibliographyProblem(compRes.warnings))
      } else {
        console.log('[PDF] solicitud omitida porque success=false')
        setCompileStatus('failed')
        const prevPdf = compRes.previousPdfUrl || null
        setPreviousPdfUrl(prevPdf)
        if (!prevPdf) {
          setPdfUrl(null)
        }
        // 5. Mostrar los errores en el registro (panel del PDF)
        setIsConsoleOpen(true)
      }
    } catch (err: unknown) {
      console.log('[PDF] solicitud omitida porque success=false')
      setCompileStatus('failed')
      setErrors([
        {
          line: 1,
          file: currentDocument.name,
          message: err instanceof Error ? err.message : 'Error de conexión al compilar',
          type: 'error',
        },
      ])
      setIsConsoleOpen(true)
    }
  }, [currentDocument])

  // Atajo de teclado global Ctrl+S / Cmd+S
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void handleSaveAndCompile()
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [handleSaveAndCompile])

  // 4. Compilación independiente de LaTeX a PDF (Botón "Recompilar")
  const handleCompile = async () => {
    if (compileStatus === 'compiling') return

    if (!currentDocument?.id) return

    const currentText = contentRef.current
    setCompileStatus('compiling')

    try {
      const res = await compileDocument(currentDocument.id, currentText)

      setCompilationLog(res.log || '')
      setCompilationTime(res.compilationTime)
      setErrors(res.errors || [])
      setWarnings(res.warnings || [])
      setCompileTimestamp(Date.now())

      if (res.success) {
        setCompileStatus('success')
        if (res.pdfUrl) {
          setPdfUrl(res.pdfUrl)
          setPreviousPdfUrl(res.pdfUrl)
        }
        // Compilación limpia: volver al PDF; si la bibliografía falló, mostrar el registro con la explicación
        setIsConsoleOpen(hasBibliographyProblem(res.warnings))
      } else {
        console.log('[PDF] solicitud omitida porque success=false')
        setCompileStatus('failed')
        const prevPdf = res.previousPdfUrl || null
        setPreviousPdfUrl(prevPdf)
        if (!prevPdf) {
          setPdfUrl(null)
        }
        setIsConsoleOpen(true)
      }
    } catch (err: unknown) {
      console.log('[PDF] solicitud omitida porque success=false')
      setCompileStatus('failed')
      setErrors([
        {
          line: 1,
          file: currentDocument.name,
          message: err instanceof Error ? err.message : 'Error desconocido de conexión al compilar',
          type: 'error',
        },
      ])
      setIsConsoleOpen(true)
    }
  }

  // 5. Descargas
  const handleDownloadPdf = () => {
    if (!currentDocument?.id) return
    if (!pdfUrl && !previousPdfUrl) {
      console.log('[PDF] solicitud omitida porque success=false')
      return
    }
    void downloadPdfFile(currentDocument.id, currentDocument.name)
  }

  const handleDownloadSource = () => {
    if (!currentDocument?.id) {
      void downloadSourceFile('local', 'documento.tex', content)
      return
    }
    void downloadSourceFile(currentDocument.id, currentDocument.name, content)
  }

  // 6. Navegación a la línea seleccionada en la consola (abre el archivo si el error está en otro, ej. capitulos/intro.tex)
  const handleErrorClick = useCallback(async (line: number, file?: string) => {
    // Con el diseño "solo PDF" el código no se ve: pasar a vista dividida para mostrar la línea
    setLayout((current) => (current === 'pdf' ? 'split' : current))
    if (file && loadedProjectId && currentDocument) {
      try {
        const { nodes } = await getProjectTree(loadedProjectId)
        const byId = new Map(nodes.map((node) => [node.id, node]))
        const pathOf = (nodeId: string): string => {
          const parts: string[] = []
          let current = byId.get(nodeId)
          while (current && parts.length < 64) {
            parts.unshift(current.nombre)
            current = current.padre_id ? byId.get(current.padre_id) : undefined
          }
          return parts.join('/')
        }
        const normalized = file.replace(/\\/g, '/').replace(/^\.\//, '')
        const files = nodes.filter((node) => node.tipo_nodo === 'archivo')
        const target = files.find((node) => pathOf(node.id) === normalized)
          || files.find((node) => pathOf(node.id).endsWith(`/${normalized}`))
        if (target && target.id !== currentDocument.id) {
          pendingLineRef.current = line
          onDocumentOpen?.(target.id)
          return
        }
      } catch {
        // Si no se puede cargar el árbol, saltar a la línea en el archivo actual
      }
    }
    setTargetLine(null)
    setTimeout(() => {
      setTargetLine(line)
    }, 20)
  }, [loadedProjectId, currentDocument, onDocumentOpen])

  const handleLineFocused = useCallback(() => {
    setTargetLine(null)
  }, [])

  // Rutas relativas de los archivos del proyecto (ej. "imagenes/logo.png")
  const nodePaths = useMemo(() => {
    const byId = new Map(projectNodes.map((node) => [node.id, node]))
    const paths = new Map<string, string>()
    projectNodes.forEach((node) => {
      const parts: string[] = []
      let current: ProjectNode | undefined = node
      while (current && parts.length < 64) {
        parts.unshift(current.nombre)
        current = current.padre_id ? byId.get(current.padre_id) : undefined
      }
      paths.set(node.id, parts.join('/'))
    })
    return paths
  }, [projectNodes])

  // Entradas de todos los .bib del proyecto, para sugerirlas dentro de \cite{...}
  const citations = useMemo(() => {
    const seen = new Set<string>()
    return projectNodes
      .filter((node) => node.tipo_nodo === 'archivo' && /\.bib$/i.test(node.nombre))
      .flatMap((node) => parseBibEntries(editedContents[node.id] ?? node.contenido_actual ?? '', nodePaths.get(node.id) || node.nombre))
      .filter((entry) => !seen.has(entry.key) && Boolean(seen.add(entry.key)))
  }, [projectNodes, editedContents, nodePaths])

  const projectFiles = useMemo(
    () => projectNodes.filter((node) => node.tipo_nodo === 'archivo').map((node) => nodePaths.get(node.id) || node.nombre),
    [projectNodes, nodePaths]
  )

  const currentNode = currentDocument?.isText === false ? projectNodes.find((node) => node.id === currentDocument.id) : undefined

  // 7. Manejo de redimensionamiento de paneles (Split Drag)
  const handleMouseDown = () => {
    setIsDragging(true)
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      const container = splitContainerRef.current?.getBoundingClientRect()
      if (!container || container.width === 0) return
      const newPercent = Math.min(Math.max(25, ((e.clientX - container.left) / container.width) * 100), 75)
      setSplitPercent(newPercent)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  // El registro se muestra en el panel del PDF (como en Overleaf): al abrirlo, ese panel debe estar visible
  const toggleConsole = () => {
    const logsVisible = isConsoleOpen && layout !== 'editor' && !isHistoryOpen
    if (logsVisible) {
      setIsConsoleOpen(false)
      return
    }
    setIsHistoryOpen(false)
    if (layout === 'editor') setLayout('split')
    setIsConsoleOpen(true)
  }
  const toggleSidePanel = () => setIsSidePanelOpen((prev) => !prev)
  const isBinaryFile = currentDocument?.isText === false
  // Solo los archivos de texto tienen historial de versiones
  const canUseHistory = Boolean(currentDocument?.id) && !isBinaryFile
  const canEditDocument = EDIT_ROLES.has(currentDocument?.role ?? '')
  const showHistory = isHistoryOpen && canUseHistory && currentDocument !== null

  // Las acciones del editor de código requieren que el panel de código esté visible
  const withEditorVisible = (action: (editor: LatexEditorHandle) => void) => {
    setIsHistoryOpen(false)
    if (layout === 'pdf') setLayout('split')
    requestAnimationFrame(() => {
      if (editorRef.current) action(editorRef.current)
    })
  }

  const handleFormat = (action: FormattingAction) => withEditorVisible((editor) => editor.format(action))
  const handleFind = () => withEditorVisible((editor) => editor.toggleFind())

  const menuActions: IdeMenuActions = {
    onBack,
    onSave: () => void handleSaveAndCompile(),
    onDownloadSource: handleDownloadSource,
    onDownloadPdf: handleDownloadPdf,
    onFind: handleFind,
    onInsert: handleFormat,
    onToggleSidePanel: toggleSidePanel,
    onToggleConsole: toggleConsole,
    onLayoutChange: (nextLayout) => {
      setIsHistoryOpen(false)
      setLayout(nextLayout)
    },
    onToggleHistory: () => setIsHistoryOpen((open) => !open),
  }

  const renderEditorPanel = () => {
    if (isLoading || loadError) {
      return (
        <div className="ide-status-screen">
          {loadError ? (
            <p className="ide-status-error" role="alert">
              No fue posible abrir el archivo: {loadError}
            </p>
          ) : (
            <p>Cargando archivo...</p>
          )}
        </div>
      )
    }

    const preview =
      isBinaryFile && currentDocument && loadedProjectId ? (
        <FilePreview
          projectId={loadedProjectId}
          node={
            currentNode || {
              id: currentDocument.id,
              proyecto_id: loadedProjectId,
              padre_id: null,
              nombre: currentDocument.name,
              tipo_nodo: 'archivo',
              tamano_bytes: currentDocument.sizeBytes,
            }
          }
          path={nodePaths.get(currentDocument.id) || currentDocument.name}
        />
      ) : undefined

    return (
      <LatexCodeEditor
        ref={editorRef}
        value={content}
        documentId={documentId ?? undefined}
        openTabs={openTabs}
        onOpenTab={(id) => onDocumentOpen?.(id)}
        onCloseTab={onCloseTab}
        onChange={handleContentChange}
        onSave={() => void handleSaveAndCompile()}
        errors={errors}
        targetLine={targetLine}
        onLineFocused={handleLineFocused}
        citations={citations}
        projectFiles={projectFiles}
        readOnly={collab.isActive && (!collab.isSynced || !collab.canEdit)}
        remoteCursors={collab.collaborators}
        onSelectionChange={collab.updateCursor}
        toolbar={<FormattingToolbar onFormat={handleFormat} onFind={handleFind} />}
        customBody={preview}
      />
    )
  }

  const showEditor = layout !== 'pdf'
  const showPdf = layout !== 'editor'
  // El panel de código toma un porcentaje fijo y el PDF ocupa el resto: así ningún panel
  // puede "robarle" espacio al otro por el tamaño de su contenido
  const editorFlex = showPdf ? `0 0 ${splitPercent}%` : '1 1 0'

  // Espacio de trabajo: historial de versiones o editor + PDF + consola
  const renderWorkspace = () => {
    if (showHistory && currentDocument) {
      return (
        <HistoryPanel
          key={currentDocument.id}
          documentId={currentDocument.id}
          fileName={currentDocument.name}
          canEdit={canEditDocument}
          onClose={() => setIsHistoryOpen(false)}
          beforeChange={flushPendingAutoSave}
          onRestored={handleVersionRestored}
        />
      )
    }

    return (
      <>
    <div className="overleaf-split-container" ref={splitContainerRef}>
      {showEditor && (
        <section
          className="overleaf-panel panel-left ide-code-panel"
          style={{ flex: editorFlex }}
          aria-label="Código fuente"
        >
          {renderEditorPanel()}
        </section>
      )}

      {showEditor && showPdf && (
        <div
          className={`overleaf-splitter ${isDragging ? 'dragging' : ''}`}
          onMouseDown={handleMouseDown}
          title="Arrastra para redimensionar los paneles"
          aria-hidden="true"
        >
          <div className="splitter-handle" />
        </div>
      )}

      {showPdf && (
        <section className="overleaf-panel panel-right ide-pdf-panel" aria-label="Vista previa PDF">
          <PdfViewer
            documentId={currentDocument?.id || null}
            documentName={currentDocument?.name || `${projectName}.tex`}
            pdfUrl={pdfUrl}
            previousPdfUrl={previousPdfUrl}
            compileStatus={compileStatus}
            compileTimestamp={compileTimestamp}
            isCompiling={compileStatus === 'compiling'}
            onCompileRequest={() => void handleCompile()}
            errorCount={errors.length}
            onToggleLogs={toggleConsole}
            logsOpen={isConsoleOpen}
            logsPanel={
              <CompilationConsole
                errors={errors}
                warnings={warnings}
                log={compilationLog}
                compilationTime={compilationTime}
                documentName={currentDocument?.name}
                onErrorClick={(line, file) => void handleErrorClick(line, file)}
              />
            }
          />
        </section>
      )}
    </div>
      </>
    )
  }

  return (
    <div className="ide-root">
      <IdeMenuBar
        projectName={projectName}
        saveStatus={saveStatus}
        lastSavedAt={lastSavedAt}
        layout={layout}
        isSidePanelOpen={isSidePanelOpen}
        isConsoleOpen={isConsoleOpen}
        isHistoryOpen={showHistory}
        canUseHistory={canUseHistory}
        actions={menuActions}
        collaboration={
          <CollaboratorsBar
            status={collab.status}
            collaborators={collab.collaborators}
            errorMessage={collab.errorMessage}
            onShare={loadedProjectId ? () => setIsShareOpen(true) : undefined}
          />
        }
      />

      {isShareOpen && loadedProjectId && (
        <ShareProjectModal
          projectId={loadedProjectId}
          canShare={currentDocument?.role === 'propietario'}
          onClose={() => setIsShareOpen(false)}
        />
      )}

      <div className="ide-body">
        <IdeRail
          isSidePanelOpen={isSidePanelOpen}
          isConsoleOpen={isConsoleOpen}
          errorCount={errors.length}
          onToggleSidePanel={toggleSidePanel}
          onFind={handleFind}
          onToggleConsole={toggleConsole}
        />

        {isSidePanelOpen && loadedProjectId && (
          <FileExplorer
            projectId={loadedProjectId}
            currentDocumentId={currentDocument?.id || ''}
            currentContent={content}
            outlineVersion={compileTimestamp}
            onOpenDocument={(id) => onDocumentOpen?.(id)}
            onDocumentDeleted={(id) => onDocumentDeleted?.(id)}
            onDocumentRenamed={(id, name) => {
              if (id === currentDocument?.id) {
                setCurrentDocument((previous) => (previous ? { ...previous, name } : previous))
              }
            }}
            onNavigateToLine={(line) => {
              if (layout === 'pdf') setLayout('split')
              setTargetLine(null)
              setTimeout(() => setTargetLine(line), 20)
            }}
            onInsertText={handleInsertText}
            onNodesLoaded={setProjectNodes}
            refreshKey={documentId || ''}
          />
        )}

        <div className="overleaf-editor-root ide-workspace">{renderWorkspace()}</div>
      </div>
    </div>
  )
}

export default EditorPage
