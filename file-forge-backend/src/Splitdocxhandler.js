// ════════════════════════════════════════════════════════════════════════════
// SPLIT DOCX — Thêm vào worker.js (file-forge-backend)
// Yêu cầu: npm install docx jszip
// ════════════════════════════════════════════════════════════════════════════

import JSZip from "jszip";
import { Document, Packer, Paragraph, HeadingLevel } from "docx";

// ── Mapping HeadingLevel ──────────────────────────────────────────────────
const HEADING_STYLE_MAP = {
  1: "Heading1",
  2: "Heading2",
  3: "Heading3",
};

// ── Đọc XML paragraphs từ DOCX (raw, dùng JSZip) ────────────────────────────
async function readDocxParagraphsRaw(fileBuffer) {
  const zip = await JSZip.loadAsync(fileBuffer);
  const wordDocXml = await zip.file("word/document.xml").async("string");

  // Parse XML đơn giản: lấy tất cả <w:p>...</w:p>
  const paragraphMatches = wordDocXml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [];
  return { paragraphMatches, zip, wordDocXml };
}

// ── Lấy style của paragraph (heading hay body) ────────────────────────────
function getParagraphStyle(pXml) {
  const styleMatch = pXml.match(/<w:pStyle w:val="([^"]+)"/);
  return styleMatch ? styleMatch[1] : null;
}

// ── Lấy text thuần từ paragraph XML ─────────────────────────────────────
function getTextFromParagraph(pXml) {
  const textMatches = pXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
  return textMatches
    .map(t => t.replace(/<w:t[^>]*>/, "").replace(/<\/w:t>/, ""))
    .join("")
    .trim();
}

// ── Tạo DOCX từ mảng raw XML paragraphs (giữ nguyên formatting) ───────────
async function buildDocxFromRawParagraphs(paragraphXmls, sourceZip) {
  // Lấy template từ file gốc để giữ styles, fonts, numbering
  const newZip = new JSZip();

  // Copy toàn bộ file gốc
  const files = Object.keys(sourceZip.files);
  for (const filePath of files) {
    if (sourceZip.files[filePath].dir) continue;
    if (filePath === "word/document.xml") continue; // sẽ replace
    const content = await sourceZip.file(filePath).async("uint8array");
    newZip.file(filePath, content);
  }

  // Build document.xml mới chỉ với paragraphs đã chọn
  const paragraphsXml = paragraphXmls.join("\n");
  const newDocXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:cx="http://schemas.microsoft.com/office/drawing/2014/chartex"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
  xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"
  mc:Ignorable="w14 w15 wp14">
  <w:body>
    ${paragraphsXml}
    <w:sectPr/>
  </w:body>
</w:document>`;

  newZip.file("word/document.xml", newDocXml);

  return await newZip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

// ════════════════════════════════════════════════════════════════════════════
// MODE 1: Tách theo Heading
// ════════════════════════════════════════════════════════════════════════════
async function splitByHeading(fileBuffer, headingLevel = 1) {
  const targetStyle = HEADING_STYLE_MAP[headingLevel] || "Heading1";
  const { paragraphMatches, zip } = await readDocxParagraphsRaw(fileBuffer);

  const sections = []; // [{title, paragraphs: [xml]}]
  let current = null;

  // Phần nội dung trước heading đầu tiên (nếu có)
  let preamble = [];

  for (const pXml of paragraphMatches) {
    const style = getParagraphStyle(pXml);
    const isTargetHeading = style && style.toLowerCase() === targetStyle.toLowerCase();

    if (isTargetHeading) {
      // Lưu section trước
      if (current) sections.push(current);
      else if (preamble.length > 0) {
        sections.push({ title: "Phan_dau", paragraphs: preamble });
        preamble = [];
      }
      const title = getTextFromParagraph(pXml) || `Section_${sections.length + 1}`;
      current = { title, paragraphs: [pXml] };
    } else {
      if (current) {
        current.paragraphs.push(pXml);
      } else {
        preamble.push(pXml);
      }
    }
  }

  if (current) sections.push(current);
  else if (preamble.length > 0) {
    sections.push({ title: "Noi_dung", paragraphs: preamble });
  }

  if (sections.length === 0) {
    throw new Error(`Không tìm thấy Heading ${headingLevel} nào trong file. Hãy thử chế độ khác.`);
  }

  // Build DOCX cho từng section
  const outputs = [];
  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    const safeTitle = sec.title
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "_")
      .slice(0, 40);
    const fileName = `phan_${String(i + 1).padStart(2, "0")}_${safeTitle}.docx`;
    const bytes = await buildDocxFromRawParagraphs(sec.paragraphs, zip);
    outputs.push({ fileName, bytes });
  }

  return outputs;
}

// ════════════════════════════════════════════════════════════════════════════
// MODE 2: Tách theo số đoạn văn
// ════════════════════════════════════════════════════════════════════════════
async function splitByParagraphs(fileBuffer, paragraphsPerFile = 10) {
  const { paragraphMatches, zip } = await readDocxParagraphsRaw(fileBuffer);

  // Lọc bỏ paragraph rỗng để đếm chính xác hơn
  const nonEmpty = paragraphMatches.filter(p => getTextFromParagraph(p).length > 0);

  if (nonEmpty.length === 0) {
    throw new Error("Không tìm thấy nội dung văn bản trong file.");
  }

  const outputs = [];
  let partIndex = 1;

  for (let i = 0; i < nonEmpty.length; i += paragraphsPerFile) {
    const chunk = nonEmpty.slice(i, i + paragraphsPerFile);
    const fileName = `phan_${String(partIndex).padStart(2, "0")}_doan_${i + 1}_den_${Math.min(i + paragraphsPerFile, nonEmpty.length)}.docx`;
    const bytes = await buildDocxFromRawParagraphs(chunk, zip);
    outputs.push({ fileName, bytes });
    partIndex++;
  }

  return outputs;
}

// ════════════════════════════════════════════════════════════════════════════
// MODE 3: Tách theo ước tính số trang (300 từ/trang)
// ════════════════════════════════════════════════════════════════════════════
async function splitByPageCount(fileBuffer, pagesPerFile = 5) {
  const WORDS_PER_PAGE = 300;
  const wordsPerChunk = pagesPerFile * WORDS_PER_PAGE;

  const { paragraphMatches, zip } = await readDocxParagraphsRaw(fileBuffer);

  const outputs = [];
  let currentChunk = [];
  let currentWordCount = 0;
  let partIndex = 1;

  for (const pXml of paragraphMatches) {
    const text = getTextFromParagraph(pXml);
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    currentChunk.push(pXml);
    currentWordCount += wordCount;

    if (currentWordCount >= wordsPerChunk) {
      const fileName = `phan_${String(partIndex).padStart(2, "0")}_~${pagesPerFile}trang.docx`;
      const bytes = await buildDocxFromRawParagraphs(currentChunk, zip);
      outputs.push({ fileName, bytes });
      currentChunk = [];
      currentWordCount = 0;
      partIndex++;
    }
  }

  // Phần cuối còn dư
  if (currentChunk.length > 0) {
    const fileName = `phan_${String(partIndex).padStart(2, "0")}_cuoi.docx`;
    const bytes = await buildDocxFromRawParagraphs(currentChunk, zip);
    outputs.push({ fileName, bytes });
  }

  if (outputs.length === 0) {
    throw new Error("Không thể tách file — nội dung quá ít.");
  }

  return outputs;
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN HANDLER — Dán vào trong fetch() của worker, trước phần "Các action khác"
// ════════════════════════════════════════════════════════════════════════════
//
// Thêm vào ACTION_MAP: KHÔNG cần vì Split DOCX xử lý nội bộ
//
// Trong block "ENDPOINT 2: XỬ LÝ FILE", sau phần Split PDF, thêm đoạn này:
//
//   if (action === "Split DOCX") {
//     ... (xem bên dưới)
//   }
//
// ─────────────────────────────────────────────────────────────────────────────

export async function handleSplitDocx(fileBuffer, options, baseName, env, urlOrigin) {
  let parsedOptions;
  try {
    parsedOptions = typeof options === "string" ? JSON.parse(options) : options;
  } catch {
    throw new Error("Options không hợp lệ (cần JSON).");
  }

  const { mode, headingLevel, paragraphsPerFile, pagesPerFile } = parsedOptions;

  let outputFiles = [];

  if (mode === "heading") {
    outputFiles = await splitByHeading(fileBuffer, Number(headingLevel) || 1);
  } else if (mode === "paragraph") {
    outputFiles = await splitByParagraphs(fileBuffer, Number(paragraphsPerFile) || 10);
  } else if (mode === "pagecount") {
    outputFiles = await splitByPageCount(fileBuffer, Number(pagesPerFile) || 5);
  } else {
    throw new Error(`Chế độ tách không hợp lệ: ${mode}`);
  }

  // Lưu từng file vào R2 và tạo download URL
  const results = [];
  for (const { fileName, bytes } of outputFiles) {
    const fileId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${fileName}`;
    await env.FILE_STORAGE.put(`processed/${fileId}`, bytes.buffer);
    results.push({
      fileName,
      downloadUrl: `${urlOrigin}/download/${fileId}`,
    });
  }

  return results;
}

// ════════════════════════════════════════════════════════════════════════════
// HƯỚNG DẪN TÍCH HỢP VÀO index.js
// ════════════════════════════════════════════════════════════════════════════
//
// 1. Thêm import ở đầu index.js:
//    import { handleSplitDocx } from "./splitDocxHandler.js";
//
// 2. Trong block "ENDPOINT 2: XỬ LÝ FILE", sau phần "Split PDF", thêm:
//
//    if (action === "Split DOCX") {
//      if (!options || !options.trim()) {
//        return errorResponse("Thiếu thông tin tuỳ chọn (options).", 400, corsHeaders);
//      }
//      const files = await handleSplitDocx(fileBuffer, options, baseName, env, url.origin);
//      return jsonResponse({ success: true, files }, 200, corsHeaders);
//    }
//
// 3. npm install jszip (đã có sẵn nếu dùng worker cũ)
//    KHÔNG cần cài thêm "docx" vì ta dùng raw XML approach với JSZip
//
// ════════════════════════════════════════════════════════════════════════════
