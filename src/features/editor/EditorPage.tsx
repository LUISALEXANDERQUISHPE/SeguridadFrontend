import React, { useCallback, useEffect, useRef, useState } from 'react'
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
import LatexCodeEditor from './components/LatexCodeEditor'
import PdfViewer from './components/PdfViewer'
import CompilationConsole from './components/CompilationConsole'
import EditorToolbar from './components/EditorToolbar'

interface EditorPageProps {
  // Documento a editar; el editor solo se muestra al crear o abrir un proyecto desde la barra lateral
  documentId: string
}

export const EditorPage: React.FC<EditorPageProps> = ({ documentId }) => {
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
        isCompiling={compileStatus === 'compiling'}
        isSaving={saveStatus === 'saving'}
      />

      {/* Espacio de trabajo dividido (Editor + Separador + Visor PDF) */}
      <div className="overleaf-split-container" ref={splitContainerRef}>
        {/* Panel Izquierdo: Editor LaTeX */}
        <div
          className="overleaf-panel panel-left"
          style={{ width: `${splitPercent}%` }}
        >
          <LatexCodeEditor
            value={content}
            onChange={handleContentChange}
            onSave={() => void handleSaveAndCompile()}
            errors={errors}
            targetLine={targetLine}
            onLineFocused={handleLineFocused}
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
        onErrorClick={handleErrorClick}
        isOpen={isConsoleOpen}
        onToggleOpen={() => setIsConsoleOpen((prev) => !prev)}
      />
    </div>
  )
}

export default EditorPage
