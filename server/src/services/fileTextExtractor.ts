import mammoth from "mammoth";

export type ExtractedFileText = {
  filename: string;
  mimeType: string;
  extension: string;
  sizeKb: number;
  extractedText: string;
  extractedLength: number;
  parser: "plain_text" | "docx" | "pdf" | "unsupported";
  warnings: string[];
};

const MAX_TEXT_LENGTH = 30_000;

/** Normalize text: collapse excessive blank lines, trim */
function cleanText(raw: string): string {
  return raw
    .replace(/\t/g, "  ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function truncate(text: string, maxLength: number): { text: string; warning?: string } {
  if (text.length <= maxLength) return { text };
  return {
    text: text.slice(0, maxLength),
    warning: `文件正文较长（共 ${text.length} 字符），以下为前 ${maxLength} 字符摘录。`
  };
}

/** Extract text from plain text files (txt, md, csv, json, xml, log, etc.) */
function extractPlainText(buffer: Buffer): string {
  return buffer.toString("utf8");
}

/** Extract text from DOCX files using mammoth */
async function extractDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

/** Extract text from PDF files using pdf-parse v2 */
async function extractPdf(buffer: Buffer): Promise<string> {
  // Dynamic import to handle optional pdf-parse dependency
  let PDFParse: new (options: { data: Uint8Array }) => {
    getText: () => Promise<{ text: string }>;
  };

  try {
    const pdfModule = await import("pdf-parse");
    PDFParse = (pdfModule as { PDFParse: typeof PDFParse }).PDFParse;
  } catch {
    throw new Error("PDF 解析库未安装，请联系管理员安装 pdf-parse。");
  }

  if (!PDFParse) {
    throw new Error("PDF 解析库未安装，请联系管理员安装 pdf-parse。");
  }

  const parser = new PDFParse({ data: new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength) });
  const result = await parser.getText();
  const text = result.text || "";
  if (!text.trim()) {
    throw new Error(
      "该 PDF 可能是扫描件或图片版 PDF，暂未抽取到文字。请上传文本型 PDF、DOCX 或 TXT 文件。"
    );
  }
  return text;
}

const plainTextExtensions = new Set([
  "txt",
  "md",
  "markdown",
  "csv",
  "json",
  "xml",
  "log",
  "yaml",
  "yml",
  "html",
  "htm"
]);

const plainTextMimes = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/xml",
  "text/xml",
  "text/html",
  "application/javascript"
]);

function looksLikePlainText(extension: string, mimeType: string): boolean {
  if (plainTextExtensions.has(extension.toLowerCase())) return true;
  if (plainTextMimes.has(mimeType)) return true;
  return false;
}

export async function extractFileText(
  file: Express.Multer.File
): Promise<ExtractedFileText> {
  const filename = file.originalname || "unknown";
  const mimeType = file.mimetype || "application/octet-stream";
  const extension = filename.split(".").pop()?.toLowerCase() || "";
  const sizeKb = Math.max(1, Math.round(file.size / 1024));

  const warnings: string[] = [];
  let extractedText = "";
  let parser: ExtractedFileText["parser"] = "unsupported";

  const isDocx =
    extension === "docx" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  const isPdf =
    extension === "pdf" || mimeType === "application/pdf";

  try {
    if (isDocx) {
      extractedText = await extractDocx(file.buffer);
      parser = "docx";
    } else if (isPdf) {
      extractedText = await extractPdf(file.buffer);
      parser = "pdf";
    } else if (looksLikePlainText(extension, mimeType)) {
      extractedText = extractPlainText(file.buffer);
      parser = "plain_text";
    } else {
      warnings.push(
        `暂不支持 .${extension || "未知"} 格式，请上传 DOCX、PDF、TXT、MD、JSON 或 CSV 文件。`
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "文件解析失败";
    warnings.push(`文件解析失败：${message}`);
    extractedText = "";
    parser = "unsupported";
  }

  const cleaned = cleanText(extractedText);
  const truncated = truncate(cleaned, MAX_TEXT_LENGTH);
  if (truncated.warning) warnings.push(truncated.warning);

  return {
    filename,
    mimeType,
    extension,
    sizeKb,
    extractedText: truncated.text,
    extractedLength: truncated.text.length,
    parser,
    warnings
  };
}
