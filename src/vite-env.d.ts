/// <reference types="vite/client" />

// Explicit declaration so TypeScript accepts Vite's ?url import for the PDF.js worker
declare module 'pdfjs-dist/build/pdf.worker.min.mjs?url' {
  const url: string;
  export default url;
}
