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
  saveDocument,
} from '../../services/documentService'
import Icon from '../../components/common/Icon'
import LatexCodeEditor, { type LatexEditorHandle } from './components/LatexCodeEditor'
import PdfViewer from './components/PdfViewer'
import CompilationConsole from './components/CompilationConsole'
import IdeMenuBar, { type IdeMenuActions } from './components/IdeMenuBar'
import IdeRail from './components/IdeRail'
import IdeSidePanel from './components/IdeSidePanel'
import FormattingToolbar from './components/FormattingToolbar'
import { parseOutline } from './utils/latexOutline'
import type { FormattingAction } from './utils/latexFormatting'
import type { EditorLayout } from './types'
import './editor-ide.css'

interface EditorPageProps {
  // Documento a editar; el editor se muestra al crear o abrir un proyecto desde el panel de proyectos
  documentId: string
  projectName: string
  onBack: () => void
}

export const EditorPage: React.FC<EditorPageProps> = ({ documentId, projectName, onBack }) => {
  // Diseño del IDE (paneles visibles)
  const [layout, setLayout] = useState<EditorLayout>('split')
  const [isSidePanelOpen, setIsSidePanelOpen] = useState<boolean>(true)
  const [activeOutlineLine, setActiveOutlineLine] = useState<number | null>(null)
  const editorRef = useRef<LatexEditorHandle | null>(null)

  // Estado del Documento
  const [currentDocument, setCurrentDocument] = useState<LatexDocument | null>(null)
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
  const contentRef = useRef<string>(content)
  contentRef.current = content

  // 1. Cargar el documento del proyecto abierto
  useEffect(() => {
    let mounted = true

    const initDocument = async () => {
      try {
        const docData = await getDocument(documentId)
        if (mounted) {
          setCurrentDocument(docData)
          const initialContent = docData.autoSave?.contenido || docData.content || DEFAULT_LATEX_TEMPLATE
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
        saveDocument(documentId, contentRef.current, true).catch(() => {})
      }
    }
  }, [documentId])

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
    setContent(newContent)
    if (!isInitialLoadRef.current && currentDocument?.id) {
      triggerAutoSave(currentDocument.id, newContent)
    } else if (!currentDocument?.id) {
      setSaveStatus('unsaved')
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

    // 2. Paso 1: Guardar documento en Backend con isAutoSave: false
    setSaveStatus('saving')
    try {
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

      if (compRes.success) {
        setCompileStatus('success')
        // 4. Actualizar pdfUrl solo si existe y notificar al visor
        if (compRes.pdfUrl) {
          setPdfUrl(compRes.pdfUrl)
          setPreviousPdfUrl(compRes.pdfUrl)
        }
        setCompileTimestamp(Date.now())
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

      if (res.success) {
        setCompileStatus('success')
        if (res.pdfUrl) {
          setPdfUrl(res.pdfUrl)
          setPreviousPdfUrl(res.pdfUrl)
        }
        setCompileTimestamp(Date.now())
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

  // 6. Navegación a la línea seleccionada en la consola
  const handleErrorClick = useCallback((line: number) => {
    setTargetLine(null)
    setTimeout(() => {
      setTargetLine(line)
    }, 20)
  }, [])

  const handleLineFocused = useCallback(() => {
    setTargetLine(null)
  }, [])

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

  const outline = useMemo(() => parseOutline(content), [content])
  const documentName = currentDocument?.name || `${projectName}.tex`

  const toggleConsole = () => setIsConsoleOpen((prev) => !prev)
  const toggleSidePanel = () => setIsSidePanelOpen((prev) => !prev)

  // Las acciones del editor de código requieren que el panel de código esté visible
  const withEditorVisible = (action: (editor: LatexEditorHandle) => void) => {
    if (layout === 'pdf') setLayout('split')
    requestAnimationFrame(() => {
      if (editorRef.current) action(editorRef.current)
    })
  }

  const handleFormat = (action: FormattingAction) => withEditorVisible((editor) => editor.format(action))
  const handleFind = () => withEditorVisible((editor) => editor.toggleFind())

  const handleOutlineSelect = (line: number) => {
    setActiveOutlineLine(line)
    if (layout === 'pdf') setLayout('split')
    handleErrorClick(line)
  }

  const menuActions: IdeMenuActions = {
    onBack,
    onSave: () => void handleSaveAndCompile(),
    onDownloadSource: handleDownloadSource,
    onDownloadPdf: handleDownloadPdf,
    onFind: handleFind,
    onInsert: handleFormat,
    onToggleSidePanel: toggleSidePanel,
    onToggleConsole: toggleConsole,
    onLayoutChange: setLayout,
  }

  const renderWorkspace = () => {
    if (isLoading || loadError) {
      return (
        <div className="ide-status-screen">
          {loadError ? (
            <p className="ide-status-error" role="alert">
              No fue posible abrir el proyecto: {loadError}
            </p>
          ) : (
            <p>Cargando proyecto...</p>
          )}
        </div>
      )
    }

    const showEditor = layout !== 'pdf'
    const showPdf = layout !== 'editor'
    // El panel de código toma un porcentaje fijo y el PDF ocupa el resto: así ningún panel
    // puede "robarle" espacio al otro por el tamaño de su contenido
    const editorFlex = showPdf ? `0 0 ${splitPercent}%` : '1 1 0'

    return (
      <div className="overleaf-split-container" ref={splitContainerRef}>
        {showEditor && (
          <section className="overleaf-panel panel-left ide-code-panel" style={{ flex: editorFlex }} aria-label="Código fuente">
            <div className="ide-file-tabs">
              <span className="ide-file-tab is-active" title={documentName}>
                <Icon name="file" size={14} />
                {documentName}
              </span>
            </div>
            <FormattingToolbar onFormat={handleFormat} onFind={handleFind} />
            <div className="ide-code-body">
              <LatexCodeEditor
                ref={editorRef}
                value={content}
                onChange={handleContentChange}
                onSave={() => void handleSaveAndCompile()}
                errors={errors}
                targetLine={targetLine}
                onLineFocused={handleLineFocused}
              />
            </div>
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
              documentName={documentName}
              pdfUrl={pdfUrl}
              previousPdfUrl={previousPdfUrl}
              compileStatus={compileStatus}
              compileTimestamp={compileTimestamp}
              isCompiling={compileStatus === 'compiling'}
              onCompileRequest={() => void handleCompile()}
              errorCount={errors.length}
              onToggleLogs={toggleConsole}
            />
          </section>
        )}
      </div>
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
        actions={menuActions}
      />

      <div className="ide-body">
        <IdeRail
          isSidePanelOpen={isSidePanelOpen}
          isConsoleOpen={isConsoleOpen}
          errorCount={errors.length}
          onToggleSidePanel={toggleSidePanel}
          onFind={handleFind}
          onToggleConsole={toggleConsole}
        />

        {isSidePanelOpen && (
          <IdeSidePanel
            fileName={documentName}
            outline={outline}
            activeLine={activeOutlineLine}
            onOutlineSelect={handleOutlineSelect}
          />
        )}

        <div className="overleaf-editor-root ide-workspace">
          {renderWorkspace()}

          <CompilationConsole
            errors={errors}
            warnings={warnings}
            log={compilationLog}
            compilationTime={compilationTime}
            onErrorClick={handleErrorClick}
            isOpen={isConsoleOpen}
            onToggleOpen={toggleConsole}
          />
        </div>
      </div>
    </div>
  )
}

export default EditorPage
