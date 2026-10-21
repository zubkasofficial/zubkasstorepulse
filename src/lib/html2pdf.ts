const SCRIPT_URL = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
let loadPromise: Promise<void> | null = null

export function loadHtml2Pdf(): Promise<void> {
  if (loadPromise) return loadPromise
  if ((window as unknown as { html2pdf?: unknown }).html2pdf) return Promise.resolve()

  loadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      loadPromise = null
      reject(new Error('Failed to load PDF library. Check your internet connection.'))
    }
    document.head.appendChild(script)
  })

  return loadPromise
}

type Html2PdfOptions = {
  margin?: number | [number, number, number, number]
  filename?: string
  image?: { type?: string; quality?: number }
  html2canvas?: { scale?: number; useCORS?: boolean; logging?: boolean }
  jsPDF?: { unit?: string; format?: string | [number, number]; orientation?: 'portrait' | 'landscape' }
}

export async function generatePdfFromElement(
  element: HTMLElement,
  filename: string,
  orientation: 'portrait' | 'landscape' = 'portrait',
  format: string | [number, number] = 'a4',
): Promise<void> {
  await loadHtml2Pdf()
  const html2pdf = (window as unknown as {
    html2pdf: () => { set: (opt: Html2PdfOptions) => { from: (el: HTMLElement) => { save: () => Promise<void> } } }
  }).html2pdf

  const options: Html2PdfOptions = {
    margin: [10, 10, 10, 10],
    filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'mm', format, orientation },
  }

  await html2pdf().set(options).from(element).save()
}

export function quickPrintElement(elementId: string): void {
  const styleId = 'zubkas-print-style'
  let style = document.getElementById(styleId) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = styleId
    style.textContent = `
      @media print {
        body * { visibility: hidden !important; }
        #${elementId}, #${elementId} * { visibility: visible !important; }
        #${elementId} {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          border: none !important;
          box-shadow: none !important;
        }
      }
    `
    document.head.appendChild(style)
  }

  const onAfterPrint = () => {
    window.removeEventListener('afterprint', onAfterPrint)
    if (style && style.parentNode) {
      style.parentNode.removeChild(style)
    }
  }
  window.addEventListener('afterprint', onAfterPrint)

  window.print()
}
