'use client';

import React, { useEffect, useRef, useState } from 'react';

/**
 * Shows a PDF by drawing its pages with pdf.js, so it works where a browser cannot show a PDF
 * inside the page (the Android app's WebView, some embedded browsers).
 */
export default function PdfViewer({ blob, className = 'max-h-[80vh]' }: { blob: Blob; className?: string }) {
  const holder = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let doc: { destroy: () => Promise<void> } | null = null;
    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
        doc = pdf;
        if (cancelled || !holder.current) return;
        holder.current.innerHTML = '';
        setPages(pdf.numPages);
        const width = holder.current.clientWidth;
        const ratio = window.devicePixelRatio || 1;
        for (let n = 1; n <= pdf.numPages && !cancelled; n++) {
          const page = await pdf.getPage(n);
          const scale = width / page.getViewport({ scale: 1 }).width;
          const viewport = page.getViewport({ scale: scale * ratio });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = '100%';
          canvas.className = 'block bg-white shadow-sm mb-3';
          canvas.setAttribute('aria-label', `Page ${n} of ${pdf.numPages}`);
          holder.current?.appendChild(canvas);
          await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
        }
      } catch (err) {
        console.error('PDF viewer failed:', err);
        if (!cancelled) setError('Could not show this PDF here. Use “open in a new tab”.');
      }
    })();
    return () => { cancelled = true; doc?.destroy(); };
  }, [blob]);

  return (
    <div className={`bg-surface2 p-2 sm:p-3 overflow-y-auto ${className}`}>
      {error ? <div className="p-8 text-center text-[13px] text-text3">{error}</div>
        : pages === 0 && <div className="p-8 text-center text-[13px] text-text3">Drawing pages…</div>}
      <div ref={holder} className="max-w-[820px] mx-auto" />
    </div>
  );
}
