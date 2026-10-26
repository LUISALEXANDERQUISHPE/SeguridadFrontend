import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import LatexCodeEditor from './components/LatexCodeEditor'
import PdfViewer from './components/PdfViewer'
import CompilationConsole from './components/CompilationConsole'
import EditorToolbar from './components/EditorToolbar'
import FileExplorer from './components/FileExplorer'
import FilePreview from './components/FilePreview'
import type { ProjectNode } from '../../types/document'
import { parseBibEntries } from '../../utils/bibtex'

// El PDF se genera aunque la bibliografía falle (citas como [?]); en ese caso se abre la consola con la explicación
function hasBibliographyProblem(warnings: CompilationError[] = []): boolean {
  return warnings.some((warning) => Boolean(warning.friendlyMessage) && (warning.file === 'bibtex' || warning.file === 'biber' || /bibliograf/i.test(warning.message)))
}

interface EditorPageProps {
  // Documento a editar; el editor solo se muestra al crear o abrir un proyecto desde la barra lateral
  documentId: string | null
  projectId: string | null
  onDocumentOpen?: (documentId: string) => void
  onDocumentDeleted?: (documentId: string) => void
  openTabs: Array<{ id: string; name: string }>
  onCloseTab: (documentId: string) => void
  onDocumentNameLoaded: (documentId: string, name: string) => void
}

export const EditorPage: React.FC<EditorPageProps> = ({ documentId, projectId, onDocumentOpen, onDocumentDeleted, openTabs, onCloseTab, onDocumentNameLoaded }) => {
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
          setLoadedProjectId(docData.projectId)
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
  }, [documentId, onDocumentNameLoaded])

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

  const handleContentChange = (newContent: string) => {
    // Los binarios (imágenes, PDFs...) no se editan: guardarlos como texto los corrompería
    if (currentDocument?.isText === false) return
    setContent(newContent)
    if (currentDocument?.id && /\.bib$/i.test(currentDocument.name)) {
      setEditedContents((previous) => ({ ...previous, [currentDocument.id]: newContent }))
    }
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
        if (hasBibliographyProblem(compRes.warnings)) setIsConsoleOpen(true)
      } else {
        console.log('[PDF] solicitud omitida porque success=false')
        setCompileStatus('failed')
        const prevPdf = compRes.previousPdfUrl || null
        setPreviousPdfUrl(prevPdf)
        if (!prevPdf) {
          setPdfUrl(null)
        }
        // 5. Mostrar errores en la consola inferior
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
        if (hasBibliographyProblem(res.warnings)) setIsConsoleOpen(true)
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

  if (isLoading || loadError) {
    return (
      <div className="overleaf-editor-root editor-status-screen">
        {loadError ? (
          <div className="modal-error">No fue posible abrir el proyecto: {loadError}</div>
        ) : (
          <div className="modal-loading">Cargando proyecto...</div>
        )}
      </div>
    )
  }

  return (
    <div className="overleaf-editor-root">
      {/* Barra de herramientas superior */}
      <EditorToolbar
        documentName={currentDocument?.name || 'Documento sin guardar'}
        saveStatus={saveStatus}
        compileStatus={compileStatus}
        lastSavedAt={lastSavedAt}
        onSave={() => void handleSaveAndCompile()}
        onCompile={() => void handleCompile()}
        onDownloadPdf={handleDownloadPdf}
        onDownloadSource={handleDownloadSource}
        onInsertText={handleInsertText}
        onToggleConsole={() => setIsConsoleOpen((previous) => !previous)}
        isCompiling={compileStatus === 'compiling'}
        isSaving={saveStatus === 'saving'}
      />

      {/* Espacio de trabajo dividido (Editor + Separador + Visor PDF) */}
      <div className="overleaf-split-container" ref={splitContainerRef}>
        {loadedProjectId && (
          <FileExplorer
            projectId={loadedProjectId}
            currentDocumentId={currentDocument?.id || ''}
            currentContent={content}
            outlineVersion={compileTimestamp}
            onOpenDocument={(id) => onDocumentOpen?.(id)}
            onDocumentDeleted={(id) => onDocumentDeleted?.(id)}
            onDocumentRenamed={(id, name) => {
              if (id === currentDocument.id) setCurrentDocument((previous) => previous ? { ...previous, name } : previous)
            }}
            onNavigateToLine={(line) => {
              setTargetLine(null)
              setTimeout(() => setTargetLine(line), 20)
            }}
            onInsertText={handleInsertText}
            onNodesLoaded={setProjectNodes}
            refreshKey={documentId || ''}
          />
        )}
        {/* Panel Izquierdo: Editor LaTeX */}
        <div
          className="overleaf-panel panel-left"
          style={{ width: `${splitPercent}%` }}
        >
          <LatexCodeEditor
            value={content}
            documentId={documentId}
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
            customBody={currentDocument?.isText === false && loadedProjectId ? (
              <FilePreview
                projectId={loadedProjectId}
                node={currentNode || { id: currentDocument.id, proyecto_id: loadedProjectId, padre_id: null, nombre: currentDocument.name, tipo_nodo: 'archivo', tamano_bytes: currentDocument.sizeBytes }}
                path={nodePaths.get(currentDocument.id) || currentDocument.name}
              />
            ) : undefined}
          />
        </div>

        {/* Separador arrastrable */}
        <div
          className={`overleaf-splitter ${isDragging ? 'dragging' : ''}`}
          onMouseDown={handleMouseDown}
          title="Arrastra para redimensionar los paneles"
        >
          <div className="splitter-handle" />
        </div>

        {/* Panel Derecho: Visor PDF */}
        <div
          className="overleaf-panel panel-right"
          style={{ width: `${100 - splitPercent}%` }}
        >
          <PdfViewer
            documentId={currentDocument?.id || null}
            documentName={currentDocument?.name || 'documento.pdf'}
            pdfUrl={pdfUrl}
            previousPdfUrl={previousPdfUrl}
            compileStatus={compileStatus}
            compileTimestamp={compileTimestamp}
            isCompiling={compileStatus === 'compiling'}
            onCompileRequest={() => void handleCompile()}
          />
        </div>
      </div>

      {/* Consola inferior de errores y logs */}
      <CompilationConsole
        errors={errors}
        warnings={warnings}
        log={compilationLog}
        compilationTime={compilationTime}
        onErrorClick={(line, file) => void handleErrorClick(line, file)}
        isOpen={isConsoleOpen}
        onToggleOpen={() => setIsConsoleOpen((prev) => !prev)}
      />
    </div>
  )
}

export default EditorPage
