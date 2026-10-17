import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { ProjectNode } from '../../../types/document'
import { createProjectNode, deleteProjectNode, downloadProjectNode, getProjectTree, moveProjectNode, renameProjectNode } from '../../../services/documentService'
import { ConfirmModal } from '../../projects/components/ProjectModals'

interface FileExplorerProps {
  projectId: string
  currentDocumentId: string
  currentContent: string
  outlineVersion: number
  onOpenDocument: (id: string) => void
  onDocumentRenamed: (id: string, name: string) => void
  onNavigateToLine: (line: number) => void
}

const sectionPattern = /^\\(section|subsection|subsubsection)\*?\{([^}]*)\}/

function getExtension(name: string): string {
  return name.match(/(\.[^.]+)$/)?.[1] || ''
}

type IconName = 'chevron' | 'file' | 'folder' | 'newFile' | 'newFolder' | 'upload' | 'close'

const Icon: React.FC<{ name: IconName; size?: number }> = ({ name, size = 16 }) => {
  const paths: Record<IconName, React.ReactNode> = {
    chevron: <path d="m4 6 4 4 4-4" />,
    file: <><path d="M5 2.5h4l3 3v8H5z" /><path d="M9 2.5v3h3M7 8h3M7 11h3" /></>,
    folder: <path d="M2.5 4.5h4l1.5 1.5h5.5v7.5h-11z" />,
    newFile: <><path d="M5 2.5h4l3 3v8H5z" /><path d="M8 8v4M6 10h4" /></>,
    newFolder: <><path d="M2.5 4.5h4l1.5 1.5h5.5v7.5h-11z" /><path d="M8 8v4M6 10h4" /></>,
    upload: <><path d="M8 11V3M5 6l3-3 3 3M3 10.5v3h10v-3" /></>,
    close: <><path d="m4 4 8 8M12 4l-8 8" /></>,
  }
  return <svg className="file-icon" width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

export const FileExplorer: React.FC<FileExplorerProps> = ({ projectId, currentDocumentId, currentContent, outlineVersion, onOpenDocument, onDocumentRenamed, onNavigateToLine }) => {
  const [nodes, setNodes] = useState<ProjectNode[]>([])
  const [collapsed, setCollapsed] = useState(false)
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ node: ProjectNode | null; x: number; y: number } | null>(null)
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [nodeToDelete, setNodeToDelete] = useState<ProjectNode | null>(null)
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const editingInputRef = useRef<HTMLInputElement | null>(null)
  const uploadRef = useRef<HTMLInputElement | null>(null)

  const reload = async (): Promise<ProjectNode[]> => {
    try {
      const nextNodes = (await getProjectTree(projectId)).nodes
      setNodes(nextNodes)
      setError(null)
      return nextNodes
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No fue posible cargar los archivos')
      return []
    }
  }
  useEffect(() => { void reload() }, [projectId])
  useEffect(() => {
    const closeMenu = () => setContextMenu(null)
    window.addEventListener('click', closeMenu)
    return () => window.removeEventListener('click', closeMenu)
  }, [])

  const createNode = async (nodeType: 'archivo' | 'carpeta', parentId: string | null = null) => {
    const name = window.prompt(nodeType === 'carpeta' ? 'Nombre de la carpeta' : 'Nombre del archivo', nodeType === 'carpeta' ? 'nueva-carpeta' : 'nuevo.tex')
    if (!name?.trim()) return
    try {
      const node = await createProjectNode(projectId, { name: name.trim(), nodeType, parentId, content: nodeType === 'archivo' && name.endsWith('.tex') ? '\\n' : undefined })
      await reload()
      if (parentId) setOpenFolders((prev) => new Set(prev).add(parentId))
      if (node.tipo_archivo === 'tex') onOpenDocument(node.id)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No fue posible crear el elemento')
    }
  }

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>, parentId: string | null = null) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const dataBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
        reader.onerror = () => reject(new Error('No fue posible leer el archivo'))
        reader.readAsDataURL(file)
      })
      await createProjectNode(projectId, { name: file.name, nodeType: 'archivo', parentId, dataBase64, mimeType: file.type })
      await reload()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No fue posible subir el archivo')
    }
  }

  const uploadTo = (parentId: string | null) => {
    uploadRef.current?.setAttribute('data-parent-id', parentId || '')
    uploadRef.current?.click()
  }

  const startRename = (node: ProjectNode) => {
    setEditingNodeId(node.id)
    setEditingName(node.tipo_nodo === 'archivo' ? node.nombre.replace(/\.[^.]+$/, '') : node.nombre)
    setContextMenu(null)
    setTimeout(() => editingInputRef.current?.select(), 0)
  }

  const finishRename = async (node: ProjectNode) => {
    const baseName = editingName.trim()
    const extension = node.tipo_nodo === 'archivo' ? node.nombre.match(/(\.[^.]+)$/)?.[1] || '' : ''
    const name = `${baseName}${extension}`
    if (!baseName || name === node.nombre) {
      setEditingNodeId(null)
      return
    }
    try {
      await renameProjectNode(projectId, node.id, name)
      setEditingNodeId(null)
      onDocumentRenamed(node.id, name)
      await reload()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No fue posible cambiar el nombre')
    }
  }

  const removeNode = async (node: ProjectNode) => {
    await deleteProjectNode(projectId, node.id)
    const deletedIds = new Set<string>([node.id])
    let foundChild = true
    while (foundChild) {
      foundChild = false
      nodes.forEach((candidate) => {
        if (candidate.padre_id && deletedIds.has(candidate.padre_id) && !deletedIds.has(candidate.id)) {
          deletedIds.add(candidate.id)
          foundChild = true
        }
      })
    }
    const nextNodes = await reload()
    if (deletedIds.has(currentDocumentId)) {
      const nextDocument = nextNodes.find((candidate) =>
        candidate.tipo_nodo === 'archivo' &&
        candidate.tipo_archivo === 'tex' &&
        !deletedIds.has(candidate.id)
      )
      onOpenDocument(nextDocument?.id || '')
    }
  }

  const sections = useMemo(() => {
    const doc = nodes.find((node) => node.id === currentDocumentId)
    const source = currentContent || doc?.contenido_actual
    if (!source) return []
    return source.split('\n').flatMap((line, index) => {
      const match = line.match(sectionPattern)
      return match ? [{ title: match[2], line: index + 1, level: match[1].length }] : []
    })
  }, [nodes, currentDocumentId, currentContent, outlineVersion])

  const children = (parentId: string | null) => nodes.filter((node) => node.padre_id === parentId)
  const showContextMenu = (event: React.MouseEvent, node: ProjectNode | null) => {
    event.preventDefault()
    event.stopPropagation()
    setContextMenu({ node, x: event.clientX, y: event.clientY })
  }

  const handleDrop = async (event: React.DragEvent, target: ProjectNode | null) => {
    event.preventDefault()
    event.stopPropagation()
    setDropTargetId(null)
    const dragged = nodes.find((node) => node.id === draggedNodeId)
    if (!dragged || dragged.id === target?.id) return
    const parentId = target?.tipo_nodo === 'carpeta' ? target.id : target?.padre_id || null
    const siblings = nodes.filter((node) => node.padre_id === parentId && node.id !== dragged.id)
    const targetIndex = target && target.tipo_nodo !== 'carpeta'
      ? Math.max(0, siblings.findIndex((node) => node.id === target.id))
      : siblings.length
    try {
      await moveProjectNode(projectId, dragged.id, parentId, targetIndex)
      if (parentId) setOpenFolders((previous) => new Set(previous).add(parentId))
      await reload()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No fue posible mover el elemento')
    } finally {
      setDraggedNodeId(null)
    }
  }

  const renderNodes = (parentId: string | null, depth = 0): React.ReactNode =>
    children(parentId).map((node) => node.tipo_nodo === 'carpeta' ? (
      <React.Fragment key={node.id}>
        <div className={`file-tree-row ${openFolders.has(node.id) ? 'open' : ''} ${dropTargetId === node.id ? 'drop-target' : ''}`} style={{ paddingLeft: `${12 + depth * 16}px` }} onDragOver={(event) => { event.preventDefault(); setDropTargetId(node.id) }} onDragLeave={() => setDropTargetId(null)} onDrop={(event) => void handleDrop(event, node)}>
          <button className="file-tree-item" type="button" draggable onDragStart={() => setDraggedNodeId(node.id)} onDragEnd={() => { setDraggedNodeId(null); setDropTargetId(null) }} onContextMenu={(event) => showContextMenu(event, node)} onClick={() => setOpenFolders((prev) => { const next = new Set(prev); next.has(node.id) ? next.delete(node.id) : next.add(node.id); return next })}>
            <Icon name="chevron" /> <Icon name="folder" />
            {editingNodeId === node.id ? (
              <>
                <input
                  ref={editingInputRef}
                  className="file-tree-rename-input"
                  value={editingName}
                  onChange={(event) => setEditingName(event.target.value)}
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void finishRename(node)
                    if (event.key === 'Escape') setEditingNodeId(null)
                  }}
                  onBlur={() => void finishRename(node)}
                  aria-label={`Cambiar nombre de ${node.nombre}`}
                />
                {getExtension(node.nombre) && <span className="file-tree-extension">{getExtension(node.nombre)}</span>}
              </>
            ) : node.nombre}
          </button>
          <button className="file-tree-add" type="button" title="Crear archivo dentro de esta carpeta" onClick={() => void createNode('archivo', node.id)}><Icon name="newFile" size={14} /></button>
        </div>
        {openFolders.has(node.id) && renderNodes(node.id, depth + 1)}
      </React.Fragment>
    ) : (
      <button key={node.id} className={`file-tree-item file-tree-file ${node.id === currentDocumentId ? 'active' : ''} ${dropTargetId === node.id ? 'drop-target' : ''}`} style={{ paddingLeft: `${28 + depth * 16}px` }} type="button" draggable onDragStart={() => setDraggedNodeId(node.id)} onDragEnd={() => { setDraggedNodeId(null); setDropTargetId(null) }} onDragOver={(event) => { event.preventDefault(); setDropTargetId(node.id) }} onDragLeave={() => setDropTargetId(null)} onDrop={(event) => void handleDrop(event, node)} onContextMenu={(event) => showContextMenu(event, node)} onClick={() => onOpenDocument(node.id)}>
        <Icon name="file" />
        {editingNodeId === node.id ? (
          <>
            <input
              ref={editingInputRef}
              className="file-tree-rename-input"
              value={editingName}
              onChange={(event) => setEditingName(event.target.value)}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void finishRename(node)
                if (event.key === 'Escape') setEditingNodeId(null)
              }}
              onBlur={() => void finishRename(node)}
              aria-label={`Cambiar nombre de ${node.nombre}`}
            />
            {getExtension(node.nombre) && <span className="file-tree-extension">{getExtension(node.nombre)}</span>}
          </>
        ) : node.nombre}
      </button>
    ))

  if (collapsed) return <button className="file-explorer-collapsed" type="button" onClick={() => setCollapsed(false)} title="Mostrar archivos"><Icon name="chevron" /></button>
  return <aside className="file-explorer">
    <div className="file-tree-header"><strong><Icon name="chevron" /> File tree</strong><span><button type="button" onClick={() => void createNode('archivo')} title="Crear archivo"><Icon name="newFile" /></button><button type="button" onClick={() => void createNode('carpeta')} title="Crear carpeta"><Icon name="newFolder" /></button><button type="button" onClick={() => uploadRef.current?.click()} title="Subir archivo"><Icon name="upload" /></button><button type="button" onClick={() => setCollapsed(true)} title="Minimizar"><Icon name="close" /></button></span></div>
    <input ref={uploadRef} type="file" hidden onChange={(event) => void handleUpload(event, uploadRef.current?.getAttribute('data-parent-id') || null)} />
    {error && <div className="file-explorer-error">{error}</div>}
    <div className="file-tree-list" onDragOver={(event) => event.preventDefault()} onDrop={(event) => void handleDrop(event, null)}>{renderNodes(null)}</div>
    <div className="file-outline"><div className="file-outline-title"><Icon name="chevron" /> File outline</div>{sections.length === 0 ? <div className="file-outline-empty">Sin secciones</div> : sections.map((section) => <button key={`${section.line}-${section.title}`} type="button" className={`outline-item level-${section.level}`} onClick={() => onNavigateToLine(section.line)}>{section.title}</button>)}</div>
    {contextMenu && (
      <div className="file-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}>
        <button type="button" onClick={() => { void createNode('archivo', contextMenu.node?.tipo_nodo === 'carpeta' ? contextMenu.node.id : contextMenu.node?.padre_id || null); setContextMenu(null) }}>＋ Nuevo archivo</button>
        <button type="button" onClick={() => { void createNode('carpeta', contextMenu.node?.tipo_nodo === 'carpeta' ? contextMenu.node.id : contextMenu.node?.padre_id || null); setContextMenu(null) }}>＋ Nueva carpeta</button>
        <button type="button" onClick={() => { uploadTo(contextMenu.node?.tipo_nodo === 'carpeta' ? contextMenu.node.id : contextMenu.node?.padre_id || null); setContextMenu(null) }}>↑ Subir archivo</button>
        {contextMenu.node && <button type="button" onClick={() => startRename(contextMenu.node!)}>✎ Cambiar nombre</button>}
        {contextMenu.node?.tipo_nodo === 'archivo' && <button type="button" onClick={() => { void downloadProjectNode(projectId, contextMenu.node!); setContextMenu(null) }}>↓ Descargar</button>}
        {contextMenu.node && <button type="button" className="danger" onClick={() => { setNodeToDelete(contextMenu.node); setContextMenu(null) }}>× Eliminar</button>}
      </div>
    )}
    <ConfirmModal
      isOpen={nodeToDelete !== null}
      title="Eliminar elemento"
      message={nodeToDelete ? `¿Eliminar "${nodeToDelete.nombre}"${nodeToDelete.tipo_nodo === 'carpeta' ? ' y todo su contenido' : ''}? Esta acción no se puede deshacer.` : ''}
      confirmLabel="Eliminar"
      confirmingLabel="Eliminando..."
      danger
      onClose={() => setNodeToDelete(null)}
      onConfirm={async () => {
        if (nodeToDelete) await removeNode(nodeToDelete)
        setNodeToDelete(null)
      }}
    />
  </aside>
}

export default FileExplorer
