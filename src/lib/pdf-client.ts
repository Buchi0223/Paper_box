export type PdfClientResult = {
  text: string;
  pages: number;
  pdfInfo: {
    title?: string;
    author?: string;
  };
};

export async function extractTextFromPdf(file: File): Promise<PdfClientResult> {
  // SSR でのモジュール評価を避けるため動的インポート
  const pdfjsLib = await import("pdfjs-dist");

  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

  const textParts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    textParts.push(pageText);
  }

  const metadata = await pdf.getMetadata();
  const info = (metadata?.info || {}) as Record<string, string>;

  return {
    text: textParts.join("\n"),
    pages: pdf.numPages,
    pdfInfo: {
      title: info.Title || undefined,
      author: info.Author || undefined,
    },
  };
}
