import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { Readable } from "stream";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Cấu hình Multer để nhận file từ form-data vào bộ nhớ (RAM)
const upload = multer({ storage: multer.memoryStorage() });

// ── CẤU HÌNH CLOUDFLARE R2 ──────────────────────────────────────────────────
const ACCOUNT_ID = "0128968e99b7d14d7f018c40b605254b";
const BUCKET_NAME = "file-forge-storage";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

const CONVERTAPI_TIMEOUT_MS = 60_000;
const API_TOKEN = process.env.CONVERTAPI_SECRET || "PlaqkxUAGmgBVQisDpvwZwh5I84ZKmT9";

const ACTION_MAP = {
  "Convert DOCX to PDF":  { endpoint: "docx/to/pdf",      ext: "pdf"  },
  "Convert PDF to DOCX":  { endpoint: "pdf/to/docx",      ext: "docx" },
  "Convert Excel to PDF": { endpoint: "xlsx/to/pdf",      ext: "pdf"  },
  "Compress PDF":         { endpoint: "pdf/to/optimize",  ext: "pdf"  },
  "Compress DOCX":        { endpoint: "docx/to/optimize", ext: "docx" },
  "Gộp PDF":              { endpoint: "pdf/merge",        ext: "pdf", multiFile: true },
  "PNG to SVG":           { endpoint: "png/to/svg",       ext: "svg"  },
  "JPG to SVG":           { endpoint: "jpg/to/svg",       ext: "svg"  },
  "JPEG to SVG":          { endpoint: "jpg/to/svg",       ext: "svg"  },
  "WEBP to SVG":          { endpoint: "webp/to/svg",      ext: "svg"  },
  "GIF to SVG":           { endpoint: "gif/to/svg",       ext: "svg"  },
  "BMP to SVG":           { endpoint: "bmp/to/svg",       ext: "svg"  },
  "SVG to PNG":           { endpoint: "svg/to/png",       ext: "png"  },
  "SVG to JPG":           { endpoint: "svg/to/jpg",       ext: "jpg"  },
  "SVG to WEBP":          { endpoint: "svg/to/webp",      ext: "webp" },
  "SVG to PDF":           { endpoint: "svg/to/pdf",       ext: "pdf"  },
};

// ── UTILITIES ────────────────────────────────────────────────────────────────
function sanitizeFileName(name) {
  return (name || "file")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
}

// Helper: Lấy file từ R2 và trả về Buffer
async function getR2ObjectBuffer(key) {
  try {
    const data = await s3.send(new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
    const chunks = [];
    for await (const chunk of data.Body) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch (error) {
    if (error.name === 'NoSuchKey') return null;
    throw error;
  }
}

// Helper: Upload Buffer lên R2
async function putR2Object(key, buffer, contentType = "application/octet-stream") {
  await s3.send(new PutObjectCommand({ Bucket: BUCKET_NAME, Key: key, Body: buffer, ContentType: contentType }));
}

// ── BỘ XỬ LÝ PDF VÀ DOCX (Giữ nguyên logic của bạn) ──────────────────────────
function parsePageRanges(options) {
  const pages = new Set();
  for (const token of options.split(",")) {
    const t = token.trim();
    if (!t) continue;
    if (t.includes("-")) {
      const [a, b] = t.split("-").map(Number);
      if (!isNaN(a) && !isNaN(b) && a >= 1 && b >= a)
        for (let i = a; i <= b; i++) pages.add(i);
    } else {
      const n = Number(t);
      if (!isNaN(n) && n >= 1) pages.add(n);
    }
  }
  return [...pages].sort((a, b) => a - b);
}

async function extractPdfPages(fileBuffer, options) {
  const pageNumbers = parsePageRanges(options);
  if (pageNumbers.length === 0) throw new Error("Không có trang hợp lệ nào được chỉ định.");
  const srcPdf = await PDFDocument.load(fileBuffer);
  const totalPages = srcPdf.getPageCount();
  const invalid = pageNumbers.filter(p => p > totalPages);
  if (invalid.length > 0)
    throw new Error(`Trang ${invalid.join(", ")} vượt quá tổng số trang (${totalPages} trang).`);
  const outPdf = await PDFDocument.create();
  const copied = await outPdf.copyPages(srcPdf, pageNumbers.map(p => p - 1));
  copied.forEach(page => outPdf.addPage(page));
  return await outPdf.save();
}

const HEADING_STYLE_MAP = { 1: "Heading1", 2: "Heading2", 3: "Heading3" };
function getParagraphStyle(pXml) {
  const m = pXml.match(/<w:pStyle w:val="([^"]+)"/);
  return m ? m[1] : null;
}
function getTextFromParagraph(pXml) {
  const matches = pXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
  return matches.map(t => t.replace(/<w:t[^>]*>/, "").replace(/<\/w:t>/, "")).join("").trim();
}

async function readDocxParagraphs(fileBuffer) {
  const zip = await JSZip.loadAsync(fileBuffer);
  const xml = await zip.file("word/document.xml").async("string");
  const paragraphs = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [];
  return { paragraphs, zip };
}

async function buildDocxFromParagraphs(paragraphXmls, sourceZip) {
  const newZip = new JSZip();
  for (const filePath of Object.keys(sourceZip.files)) {
    if (sourceZip.files[filePath].dir || filePath === "word/document.xml") continue;
    newZip.file(filePath, await sourceZip.file(filePath).async("uint8array"));
  }
  const bodyContent = paragraphXmls.join("\n");
  newZip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  mc:Ignorable="w14 w15 wp14">
  <w:body>${bodyContent}<w:sectPr/></w:body>
</w:document>`);
  return await newZip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

async function splitDocxByHeading(fileBuffer, headingLevel = 1) {
  const targetStyle = HEADING_STYLE_MAP[headingLevel] || "Heading1";
  const { paragraphs, zip } = await readDocxParagraphs(fileBuffer);

  const sections = [];
  let current = null;
  const preamble = [];

  for (const pXml of paragraphs) {
    const style = getParagraphStyle(pXml);
    const isHeading = style && style.toLowerCase() === targetStyle.toLowerCase();
    if (isHeading) {
      if (current) sections.push(current);
      else if (preamble.length) sections.push({ title: "Phan_dau", paragraphs: [...preamble] });
      preamble.length = 0;
      const title = getTextFromParagraph(pXml) || `Section_${sections.length + 1}`;
      current = { title, paragraphs: [pXml] };
    } else {
      (current ? current.paragraphs : preamble).push(pXml);
    }
  }
  if (current) sections.push(current);
  else if (preamble.length) sections.push({ title: "Noi_dung", paragraphs: preamble });

  if (!sections.length)
    throw new Error(`Không tìm thấy Heading ${headingLevel} nào trong file. Hãy thử chế độ khác.`);

  return Promise.all(sections.map(async (sec, i) => {
    const safeTitle = sec.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);
    const fileName = `phan_${String(i + 1).padStart(2, "0")}_${safeTitle}.docx`;
    const bytes = await buildDocxFromParagraphs(sec.paragraphs, zip);
    return { fileName, bytes };
  }));
}

async function splitDocxByParagraphs(fileBuffer, paragraphsPerFile = 10) {
  const { paragraphs, zip } = await readDocxParagraphs(fileBuffer);
  const nonEmpty = paragraphs.filter(p => getTextFromParagraph(p).length > 0);
  if (!nonEmpty.length) throw new Error("Không tìm thấy nội dung văn bản trong file.");

  const outputs = [];
  for (let i = 0, part = 1; i < nonEmpty.length; i += paragraphsPerFile, part++) {
    const chunk = nonEmpty.slice(i, i + paragraphsPerFile);
    const fileName = `phan_${String(part).padStart(2, "0")}_doan_${i + 1}den${Math.min(i + paragraphsPerFile, nonEmpty.length)}.docx`;
    const bytes = await buildDocxFromParagraphs(chunk, zip);
    outputs.push({ fileName, bytes });
  }
  return outputs;
}

async function splitDocxByPageCount(fileBuffer, pagesPerFile = 5) {
  const WORDS_PER_PAGE = 300;
  const wordLimit = pagesPerFile * WORDS_PER_PAGE;
  const { paragraphs, zip } = await readDocxParagraphs(fileBuffer);

  const outputs = [];
  let chunk = [], wordCount = 0, part = 1;

  for (const pXml of paragraphs) {
    const words = getTextFromParagraph(pXml).split(/\s+/).filter(Boolean).length;
    chunk.push(pXml);
    wordCount += words;
    if (wordCount >= wordLimit) {
      outputs.push({ fileName: `phan_${String(part).padStart(2, "0")}_~${pagesPerFile}trang.docx`, bytes: await buildDocxFromParagraphs(chunk, zip) });
      chunk = []; wordCount = 0; part++;
    }
  }
  if (chunk.length) outputs.push({ fileName: `phan_${String(part).padStart(2, "0")}_cuoi.docx`, bytes: await buildDocxFromParagraphs(chunk, zip) });
  if (!outputs.length) throw new Error("Không thể tách file — nội dung quá ít.");
  return outputs;
}

// ── ENDPOINTS EXPRESS ────────────────────────────────────────────────────────

app.get("/", (req, res) => {
  res.send("File Forge API v2 is Live on Node.js/Render");
});

// 1: PRESIGNED URL
app.post("/get-presigned-url", async (req, res) => {
  try {
    const { fileName, contentType } = req.body;
    if (!fileName || !contentType) return res.status(400).json({ error: "Thiếu fileName hoặc contentType." });

    const fileId = `${Date.now()}_${fileName.replace(/\s+/g, "_")}`;
    const key = `uploads/${fileId}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType
    });

    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
    res.json({ signedUrl, fileKey: key, fileId });
  } catch (error) {
    res.status(500).json({ error: error.message || "Không thể tạo presigned URL." });
  }
});

// 2: XỬ LÝ FILE
app.post("/process", upload.single("file"), async (req, res) => {
  try {
    let fileBuffer, originalName, action, options;

    if (req.is("application/json")) {
      action = req.body.action;
      options = req.body.options;
      if (!req.body.fileKey) return res.status(400).json({ error: "Thiếu fileKey." });

      fileBuffer = await getR2ObjectBuffer(req.body.fileKey);
      if (!fileBuffer) return res.status(404).json({ error: "File không tồn tại trên R2." });
      originalName = req.body.fileKey.split("_").slice(1).join("_") || "file";

    } else if (req.is("multipart/form-data")) {
      if (!req.file) return res.status(400).json({ error: "Thiếu file upload." });
      action = req.body.action;
      options = req.body.options;
      fileBuffer = req.file.buffer;
      originalName = req.file.originalname;
    } else {
      return res.status(415).json({ error: "Content-Type không được hỗ trợ." });
    }

    if (!action) return res.status(400).json({ error: "Thiếu tham số action." });
    const baseName = originalName.substring(0, originalName.lastIndexOf(".")) || originalName;

    // ── Split PDF ──
    if (action === "Split PDF") {
      if (!options?.trim()) return res.status(400).json({ error: "Thiếu thông tin trang cần tách." });
      const bytes = await extractPdfPages(fileBuffer, options);
      const safeBase = sanitizeFileName(baseName);
      const finalFileName = `${safeBase}_trang_${options.replace(/,/g, "_")}.pdf`;
      const fileId = `${Date.now()}_${finalFileName}`;

      await putR2Object(`processed/${fileId}`, Buffer.from(bytes), "application/pdf");
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      return res.json({ success: true, downloadUrl: `${protocol}://${req.get('host')}/download/${fileId}`, fileName: finalFileName });
    }

    // ── Split DOCX ──
    if (action === "Split DOCX") {
      if (!options?.trim()) return res.status(400).json({ error: "Thiếu thông tin tuỳ chọn." });
      let parsed;
      try { parsed = JSON.parse(options); } catch { return res.status(400).json({ error: "Options không hợp lệ (cần JSON)." }); }
      const { mode, headingLevel, paragraphsPerFile, pagesPerFile } = parsed;

      let outputFiles = [];
      if (mode === "heading") outputFiles = await splitDocxByHeading(fileBuffer, Number(headingLevel) || 1);
      else if (mode === "paragraph") outputFiles = await splitDocxByParagraphs(fileBuffer, Number(paragraphsPerFile) || 10);
      else if (mode === "pagecount") outputFiles = await splitDocxByPageCount(fileBuffer, Number(pagesPerFile) || 5);
      else return res.status(400).json({ error: `Chế độ tách không hợp lệ: ${mode}` });

      const results = [];
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;

      for (const { fileName, bytes } of outputFiles) {
        const fileId = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${fileName}`;
        await putR2Object(`processed/${fileId}`, Buffer.from(bytes), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        results.push({ fileName, downloadUrl: `${protocol}://${req.get('host')}/download/${fileId}` });
      }
      return res.json({ success: true, files: results });
    }

    // ── GỌI CONVERTAPI ──
    const config = ACTION_MAP[action];
    if (!config) return res.status(400).json({ error: "Chức năng này hiện chưa khả dụng." });

    const blob = new Blob([fileBuffer]);
    const apiFormData = new FormData();
    apiFormData.append("File", blob, originalName);
    if (action.endsWith("to SVG")) apiFormData.append("ColorType", "2");
    if (action.startsWith("SVG to")) { apiFormData.append("ScaleImage", "true"); apiFormData.append("ImageWidth", "0"); }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONVERTAPI_TIMEOUT_MS);

    let convertReq;
    try {
      convertReq = await fetch(`https://v2.convertapi.com/convert/${config.endpoint}?Secret=${API_TOKEN}`, {
        method: "POST",
        body: apiFormData,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    const convertRes = await convertReq.json().catch(() => null);
    if (!convertReq.ok) return res.status(502).json({ error: convertRes?.Message || `ConvertAPI HTTP ${convertReq.status}.` });
    if (!(convertRes?.Files?.length > 0)) return res.status(502).json({ error: convertRes?.Message || "ConvertAPI không trả dữ liệu file." });

    const outputBuffer = Buffer.from(convertRes.Files[0].FileData, "base64");
    const safeBase = sanitizeFileName(baseName);
    const finalFileName = `${safeBase}.${config.ext}`;
    const fileId = `${Date.now()}_${finalFileName}`;

    await putR2Object(`processed/${fileId}`, outputBuffer);

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    return res.json({ success: true, downloadUrl: `${protocol}://${req.get('host')}/download/${fileId}`, fileName: finalFileName });

  } catch (error) {
    if (error?.name === "AbortError") return res.status(504).json({ error: "Hết thời gian chờ xử lý ConvertAPI." });
    console.error("Process Error:", error);
    return res.status(500).json({ error: error.message || "Lỗi xử lý file." });
  }
});

// 3: TẢI FILE
app.get("/download/:fileName", async (req, res) => {
  try {
    const fileName = decodeURIComponent(req.params.fileName);
    const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: `processed/${fileName}` });
    const data = await s3.send(command);

    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("Content-Type", data.ContentType || "application/octet-stream");
    res.setHeader("Access-Control-Allow-Origin", "*");

    // Stream dữ liệu trực tiếp về client
    if (data.Body instanceof Readable) {
      data.Body.pipe(res);
    } else {
      res.send(Buffer.from(await data.Body.transformToByteArray()));
    }
  } catch (error) {
    if (error.name === 'NoSuchKey') {
      return res.status(404).send("File không tồn tại trên hệ thống.");
    }
    res.status(500).send("Lỗi khi tải file: " + error.message);
  }
});

// Khởi động Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
