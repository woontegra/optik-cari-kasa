export function openPrintPreview(doc: { html: string; title: string }): void {
  const w = window.open('', '_blank', 'width=480,height=720');
  if (!w) return;
  w.document.write(doc.html);
  w.document.close();
  w.document.title = doc.title;
  setTimeout(() => w.print(), 300);
}
