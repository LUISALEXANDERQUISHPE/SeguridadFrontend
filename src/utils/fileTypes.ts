// Debe coincidir con BackendSeguridad/src/utils/fileTypes.js
const TEXT_EXTENSIONS = new Set([
  'tex', 'ltx', 'latex', 'bib', 'bst', 'bbx', 'cbx', 'lbx', 'sty', 'cls', 'clo', 'cfg', 'def', 'dtx', 'ins',
  'tikz', 'pgf', 'txt', 'md', 'csv', 'tsv', 'dat', 'json', 'xml', 'yml', 'yaml', 'ist', 'gls', 'glo',
  'lua', 'py', 'r', 'm', 'js', 'ts', 'html', 'css', 'sh', 'bat', 'ini', 'toml', 'log',
])

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'])

export function getFileExtension(name: string): string {
  return name.match(/\.([^./]+)$/)?.[1]?.toLowerCase() || ''
}

/** Un archivo sin extensión (ej. "LICENSE") se considera texto */
export function isTextFileName(name: string): boolean {
  const extension = getFileExtension(name)
  return !extension || TEXT_EXTENSIONS.has(extension)
}

export function isImageFileName(name: string): boolean {
  return IMAGE_EXTENSIONS.has(getFileExtension(name))
}

/**
 * Contenido inicial al crear un archivo nuevo desde el explorador, según su extensión
 */
export function getStarterContent(name: string): string {
  switch (getFileExtension(name)) {
    case 'tex':
      return `% ${name}\n% Inclúyelo en el documento principal con \\input{ruta/sin-extension}\n\n`
    case 'bib':
      return `% ${name}\n% Úsalo con \\bibliography{ruta/sin-extension} (bibtex) o \\addbibresource{ruta/${name}} (biblatex)\n\n@article{clave2024,\n  author  = {Apellido, Nombre},\n  title   = {Título del artículo},\n  journal = {Nombre de la revista},\n  year    = {2024}\n}\n`
    case 'csv':
      return 'x,y\n0,0\n1,1\n2,4\n'
    case 'sty':
      return `\\NeedsTeXFormat{LaTeX2e}\n\\ProvidesPackage{${name.replace(/\.sty$/i, '')}}\n\n`
    default:
      return ''
  }
}

/**
 * Comando LaTeX para usar un archivo del proyecto con su ruta relativa a la raíz
 * (ej. \includegraphics{imagenes/logo.png}, \input{capitulos/intro}, \bibliography{bib/referencias})
 */
export function getLatexReference(path: string): string {
  const withoutExtension = path.replace(/\.[^./]+$/, '')
  const baseName = withoutExtension.split('/').pop() || 'archivo'
  const label = baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  switch (getFileExtension(path)) {
    case 'png': case 'jpg': case 'jpeg': case 'pdf': case 'eps':
      return `\\begin{figure}[h]\n  \\centering\n  \\includegraphics[width=0.8\\linewidth]{${path}}\n  \\caption{${baseName.replace(/([_&%#$])/g, '\\$1')}}\n  \\label{fig:${label}}\n\\end{figure}\n`
    case 'tex':
      return `\\input{${withoutExtension}}\n`
    case 'bib':
      return `% bibtex:\n\\bibliographystyle{plain}\n\\bibliography{${withoutExtension}}\n% biblatex (en el preámbulo): \\addbibresource{${path}}\n`
    case 'csv': case 'dat': case 'tsv':
      return `% Requiere \\usepackage{pgfplots} en el preámbulo\n\\begin{tikzpicture}\n  \\begin{axis}[xlabel={$x$}, ylabel={$y$}]\n    \\addplot table [${getFileExtension(path) === 'csv' ? 'col sep=comma, ' : ''}x index=0, y index=1] {${path}};\n  \\end{axis}\n\\end{tikzpicture}\n`
    case 'sty':
      return `\\usepackage{${withoutExtension}}\n`
    default:
      return path
  }
}
