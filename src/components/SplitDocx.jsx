import React, { useState, useRef, useCallback } from 'react';
import {
  Scissors, UploadCloud, Loader2, Download, CheckCircle2,
  RefreshCcw, AlertCircle, FileText, X, BookOpen, Hash,
  AlignLeft, Archive, ChevronRight, Sparkles, Info
} from 'lucide-react';

const MAX_FILE_SIZE_MB = 50;

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function loadJSZip() {
  if (window._JSZipLoaded) return window.JSZip;
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    s.onload = () => { window._JSZipLoaded = true; resolve(window.JSZip); };
    s.onerror = () => reject(new Error('Không tải được JSZip. Kiểm tra kết nối mạng.'));
    document.head.appendChild(s);
  });
}

function readFileAsArrayBuffer(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => res(e.target.result);
    r.onerror = rej;
    r.readAsArrayBuffer(file);
  });
}

// ── XML helpers ──────────────────────────────────────────────────────────────
function getStyleId(pXml) {
  const m = pXml.match(/<w:pStyle w:val="([^"]+)"/);
  return m ? m[1] : '';
}

function getPlainText(pXml) {
  return (pXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [])
    .map(t => t.replace(/<w:t[^>]*>/, '').replace(/<\/w:t>/, ''))
    .join('').trim();
}

function isHeading(styleId, level) {
  const s = styleId.toLowerCase().replace(/[\s_-]/g, '');
  const patterns = {
    1: ['heading1', 'h1', 'tieude1', 'chuong1', 'mucluc1'],
    2: ['heading2', 'h2', 'tieude2', 'chuong2', 'mucluc2'],
    3: ['heading3', 'h3', 'tieude3', 'chuong3', 'mucluc3'],
  };
  return (patterns[level] || []).some(p => s.includes(p));
}

// ── PAGE BREAK DETECTION ─────────────────────────────────────────────────────
// Detects if a paragraph contains a real page break signal
function hasPageBreak(pXml) {
  // 1. Explicit page break run: <w:br w:type="page"/>
  if (/<w:br[^>]+w:type="page"/.test(pXml)) return true;
  // 2. lastRenderedPageBreak (Word's rendered page info embedded in XML)
  if (/<w:lastRenderedPageBreak\s*\/>/.test(pXml)) return true;
  // 3. pageBreakBefore in paragraph properties
  if (/<w:pageBreakBefore\s*\/>/.test(pXml) || /<w:pageBreakBefore w:val="1"/.test(pXml)) return true;
  return false;
}

// Check if paragraph is a section break (contains sectPr)
function hasSectPr(pXml) {
  return /<w:sectPr[\s>]/.test(pXml);
}

// Extract sectPr XML from a paragraph
function extractSectPr(pXml) {
  const m = pXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
  return m ? m[0] : null;
}

// Count real rendered pages in the document
function countRenderedPages(paragraphs) {
  let pages = 1;
  for (const p of paragraphs) {
    if (/<w:br[^>]+w:type="page"/.test(p)) pages++;
    if (/<w:lastRenderedPageBreak\s*\/>/.test(p)) pages++;
  }
  return pages;
}

// ── Build DOCX blob preserving section properties ────────────────────────────
async function buildDocx(paragraphXmls, sourceZip, JSZip, inheritedSectPr = null) {
  const newZip = new JSZip();

  for (const path of Object.keys(sourceZip.files)) {
    const entry = sourceZip.files[path];
    if (entry.dir || path === 'word/document.xml') continue;
    newZip.file(path, await entry.async('uint8array'));
  }

  const body = paragraphXmls.length
    ? paragraphXmls.join('\n')
    : '<w:p><w:r><w:t></w:t></w:r></w:p>';

  // Use the last sectPr found in this chunk, or the inherited one from the source doc
  let finalSectPr = inheritedSectPr || '<w:sectPr/>';

  // If last paragraph already has sectPr embedded, extract and use it, then strip from paragraph
  const lastP = paragraphXmls[paragraphXmls.length - 1] || '';
  if (hasSectPr(lastP)) {
    const extracted = extractSectPr(lastP);
    if (extracted) finalSectPr = extracted;
  }

  newZip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
  mc:Ignorable="w14">
  <w:body>${body}${finalSectPr}</w:body>
</w:document>`);

  return await newZip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

function makeSafeFileName(text, idx, suffix = '') {
  const clean = (text || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '').trim()
    .replace(/\s+/g, '_').slice(0, 45);
  const num = String(idx).padStart(2, '0');
  return `phan_${num}${clean ? '_' + clean : ''}${suffix}.docx`;
}

// Extract the root sectPr from the document body (the last one, not inside paragraphs)
function extractRootSectPr(docXml) {
  // The root sectPr is directly inside <w:body>, not inside <w:p>
  // Find sectPr that appears after the last </w:p>
  const lastPEnd = docXml.lastIndexOf('</w:p>');
  if (lastPEnd === -1) return null;
  const afterLastP = docXml.slice(lastPEnd);
  const m = afterLastP.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
  return m ? m[0] : null;
}

// ── MODE 1: Split by Heading ─────────────────────────────────────────────────
async function splitByHeading(paragraphs, level, zip, JSZip, rootSectPr, onProgress) {
  const sections = [];
  let current = null;
  const preamble = [];

  for (const pXml of paragraphs) {
    if (isHeading(getStyleId(pXml), level)) {
      if (current) sections.push(current);
      else if (preamble.length) sections.push({ title: 'Mo_dau', paragraphs: [...preamble] });
      preamble.length = 0;
      current = { title: getPlainText(pXml) || `Chuong_${sections.length + 1}`, paragraphs: [pXml] };
    } else {
      (current ? current.paragraphs : preamble).push(pXml);
    }
  }
  if (current) sections.push(current);
  else if (preamble.length) sections.push({ title: 'Noi_dung', paragraphs: preamble });

  if (!sections.length)
    throw new Error(`Không tìm thấy Heading ${level} nào. Thử chọn H2/H3 hoặc đổi chế độ tách.`);

  return Promise.all(sections.map(async (sec, i) => {
    onProgress(`Đang tạo phần ${i + 1}/${sections.length}…`);
    const blob = await buildDocx(sec.paragraphs, zip, JSZip, rootSectPr);
    return { fileName: makeSafeFileName(sec.title, i + 1), blob, count: sec.paragraphs.length };
  }));
}

// ── MODE 2: Split by paragraph count ────────────────────────────────────────
async function splitByParagraph(paragraphs, perFile, zip, JSZip, rootSectPr, onProgress) {
  const filled = paragraphs.filter(p => getPlainText(p).length > 0);
  if (!filled.length) throw new Error('Không có nội dung văn bản trong file.');

  const results = [];
  const total = Math.ceil(filled.length / perFile);
  for (let i = 0, part = 1; i < filled.length; i += perFile, part++) {
    onProgress(`Đang tạo phần ${part}/${total}…`);
    const chunk = filled.slice(i, i + perFile);
    const blob = await buildDocx(chunk, zip, JSZip, rootSectPr);
    results.push({ fileName: `phan_${String(part).padStart(2,'0')}_doan_${i+1}-${Math.min(i+perFile,filled.length)}.docx`, blob, count: chunk.length });
  }
  return results;
}

// ── MODE 3: Split by page — IMPROVED ────────────────────────────────────────
// Strategy:
//   1. First try to use REAL page breaks embedded in the XML (lastRenderedPageBreak / explicit breaks)
//   2. If not enough real breaks found, fall back to word-count estimation
async function splitByPage(paragraphs, pagesPerFile, zip, JSZip, rootSectPr, onProgress) {
  // Count real page breaks
  let realPageBreaks = 0;
  for (const p of paragraphs) {
    if (/<w:br[^>]+w:type="page"/.test(p)) realPageBreaks++;
    if (/<w:lastRenderedPageBreak\s*\/>/.test(p)) realPageBreaks++;
  }

  const USE_REAL_BREAKS = realPageBreaks >= 2; // Only use if we have meaningful data

  if (USE_REAL_BREAKS) {
    // ── Real page break splitting ──────────────────────────────────────────
    // Build page groups based on actual page break markers
    const pages = [[]]; // pages[i] = array of paragraphs on page i

    for (const pXml of paragraphs) {
      // lastRenderedPageBreak means THIS paragraph starts a new page
      if (/<w:lastRenderedPageBreak\s*\/>/.test(pXml) && pages[pages.length - 1].length > 0) {
        pages.push([]);
      }
      pages[pages.length - 1].push(pXml);

      // Explicit page break at END of paragraph → next paragraph is new page
      if (/<w:br[^>]+w:type="page"/.test(pXml)) {
        pages.push([]);
      }
    }

    // Remove trailing empty page
    if (pages[pages.length - 1].length === 0) pages.pop();

    const results = [];
    const totalFiles = Math.ceil(pages.length / pagesPerFile);

    for (let i = 0, part = 1; i < pages.length; i += pagesPerFile, part++) {
      onProgress(`Đang tạo phần ${part}/${totalFiles} (trang ${i+1}–${Math.min(i+pagesPerFile, pages.length)})…`);
      const chunkPages = pages.slice(i, i + pagesPerFile);
      const allParas = chunkPages.flat();
      const blob = await buildDocx(allParas, zip, JSZip, rootSectPr);
      const pageLabel = `trang_${i+1}-${Math.min(i+pagesPerFile, pages.length)}`;
      results.push({
        fileName: `phan_${String(part).padStart(2,'0')}_${pageLabel}.docx`,
        blob,
        count: allParas.length,
        pageCount: chunkPages.length,
        method: 'real'
      });
    }

    if (!results.length) throw new Error('Không thể tách theo trang thực tế.');
    return results;

  } else {
    // ── Fallback: word-count estimation ───────────────────────────────────
    const WORDS_PER_PAGE = 300;
    const limit = pagesPerFile * WORDS_PER_PAGE;
    const results = [];
    let chunk = [], wc = 0, part = 1;

    for (const pXml of paragraphs) {
      const w = getPlainText(pXml).split(/\s+/).filter(Boolean).length;
      chunk.push(pXml);
      wc += w;
      if (wc >= limit) {
        onProgress(`Đang tạo phần ${part}…`);
        const blob = await buildDocx(chunk, zip, JSZip, rootSectPr);
        results.push({
          fileName: `phan_${String(part).padStart(2,'0')}_~${pagesPerFile}trang.docx`,
          blob,
          count: chunk.length,
          method: 'estimate'
        });
        chunk = []; wc = 0; part++;
      }
    }
    if (chunk.length) {
      const blob = await buildDocx(chunk, zip, JSZip, rootSectPr);
      results.push({
        fileName: `phan_${String(part).padStart(2,'0')}_cuoi.docx`,
        blob,
        count: chunk.length,
        method: 'estimate'
      });
    }
    if (!results.length) throw new Error('Nội dung quá ít để tách theo trang.');
    return results;
  }
}

// ── Download all as ZIP ──────────────────────────────────────────────────────
async function downloadAllZip(results, baseName, JSZip) {
  const zip = new JSZip();
  for (const r of results) zip.file(r.fileName, await r.blob.arrayBuffer());
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${baseName}_tach.zip` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function downloadOne(result) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(result.blob), download: result.fileName });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ════════════════════════════════════════════════════════════════════════════
// CONSTANTS & SUB-COMPONENTS
// ════════════════════════════════════════════════════════════════════════════
const MODES = [
  { id: 'heading',   label: 'Tách theo Heading', icon: BookOpen,  accent: '#5856D6', bg: 'rgba(88,86,214,0.1)',  desc: 'Mỗi Heading → 1 file',         detail: 'Phù hợp luận văn, báo cáo, sách có chương rõ ràng', badge: 'Phổ biến' },
  { id: 'paragraph', label: 'Tách theo đoạn',    icon: AlignLeft, accent: '#FF9500', bg: 'rgba(255,149,0,0.1)', desc: 'N đoạn văn → 1 file',           detail: 'Chia đều nội dung dài mà không cần heading',         badge: null },
  { id: 'pagecount', label: 'Tách theo trang',   icon: Hash,      accent: '#34C759', bg: 'rgba(52,199,89,0.1)', desc: 'Tách theo trang thực tế',       detail: 'Đọc page break thực trong file · Giữ định dạng trang', badge: 'Cải tiến' },
];

function ModeBtn({ m, selected, onSelect }) {
  const Icon = m.icon;
  return (
    <button type="button" onClick={onSelect}
      className="w-full text-left rounded-2xl border p-3.5 transition-all duration-150 active:scale-[0.99] relative"
      style={{ borderColor: selected ? m.accent : 'rgb(39,39,42)', background: selected ? m.bg : 'rgba(24,24,27,0.5)' }}>
      {m.badge && (
        <span className="absolute top-2.5 right-2.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ background: m.bg, color: m.accent }}>{m.badge}</span>
      )}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: selected ? m.accent : '#27272a' }}>
          <Icon size={14} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${selected ? 'text-white' : 'text-zinc-300'}`}>{m.label}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">{m.desc}</p>
          {selected && <p className="text-[11px] mt-1 font-medium" style={{ color: m.accent }}>{m.detail}</p>}
        </div>
        <div className="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all"
          style={{ borderColor: selected ? m.accent : '#52525b', background: selected ? m.accent : 'transparent' }}>
          {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
        </div>
      </div>
    </button>
  );
}

// Page break info badge
function PageBreakBadge({ docInfo }) {
  if (!docInfo) return null;
  const { realPageBreaks, renderedPages, estimatedPages } = docInfo;

  if (realPageBreaks > 0) {
    return (
      <div className="flex items-start gap-2 p-3 bg-emerald-500/8 border border-emerald-500/20 rounded-xl">
        <CheckCircle2 size={13} className="text-emerald-400 shrink-0 mt-0.5" />
        <p className="text-emerald-400 text-[11px]">
          <span className="font-bold">Phát hiện {realPageBreaks} page break thực tế</span> trong file.
          Chế độ "Tách theo trang" sẽ dùng dữ liệu này → kết quả chính xác hơn, giữ được định dạng trang.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 p-3 bg-yellow-500/8 border border-yellow-500/20 rounded-xl">
      <Info size={13} className="text-yellow-400 shrink-0 mt-0.5" />
      <p className="text-yellow-400/80 text-[11px]">
        File không chứa page break metadata. Chế độ trang sẽ ước tính ~300 từ/trang.
        Để có kết quả tốt hơn, hãy lưu file từ Word với tùy chọn "Save with compatibility".
      </p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════════════
const SplitDocx = () => {
  const [file, setFile]                 = useState(null);
  const [mode, setMode]                 = useState('heading');
  const [headingLevel, setHeadingLevel] = useState('1');
  const [paragraphsPerFile, setPPF]     = useState('10');
  const [pagesPerFile, setPagesPF]      = useState('5');
  const [status, setStatus]             = useState('');
  const [progressMsg, setProgressMsg]   = useState('');
  const [errorMsg, setErrorMsg]         = useState('');
  const [results, setResults]           = useState([]);
  const [isDragging, setIsDragging]     = useState(false);
  const [step, setStep]                 = useState(1);
  const [docInfo, setDocInfo]           = useState(null);
  const [JSZipRef, setJSZipRef]         = useState(null);

  const fileInputRef = useRef(null);
  const selectedMode = MODES.find(m => m.id === mode);

  // ── File handling ──────────────────────────────────────────────────────────
  const handleFile = useCallback(async (f) => {
    if (!f) return;
    if (!f.name.match(/\.docx$/i)) { setErrorMsg('Chỉ chấp nhận file .docx'); setStatus('error'); return; }
    if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) { setErrorMsg(`File quá lớn. Tối đa ${MAX_FILE_SIZE_MB}MB.`); setStatus('error'); return; }

    setStatus('reading'); setProgressMsg('Đang tải thư viện và đọc file…'); setErrorMsg(''); setResults([]);

    try {
      const JSZip = await loadJSZip();
      setJSZipRef(() => JSZip);

      const buf = await readFileAsArrayBuffer(f);
      const zip = await JSZip.loadAsync(buf);
      const xml = await zip.file('word/document.xml').async('string');
      const paragraphs = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [];

      const hc = { 1: 0, 2: 0, 3: 0 };
      let wc = 0;
      let realPageBreaks = 0;

      for (const p of paragraphs) {
        const s = getStyleId(p);
        if (isHeading(s, 1)) hc[1]++;
        else if (isHeading(s, 2)) hc[2]++;
        else if (isHeading(s, 3)) hc[3]++;
        wc += getPlainText(p).split(/\s+/).filter(Boolean).length;
        if (/<w:br[^>]+w:type="page"/.test(p)) realPageBreaks++;
        if (/<w:lastRenderedPageBreak\s*\/>/.test(p)) realPageBreaks++;
      }

      const estimatedPages = Math.ceil(wc / 300);
      const renderedPages = realPageBreaks > 0 ? realPageBreaks + 1 : estimatedPages;

      setDocInfo({
        totalParagraphs: paragraphs.length,
        headingCounts: hc,
        wordCount: wc,
        estimatedPages,
        realPageBreaks,
        renderedPages,
      });
      setFile(f);
      setStatus('');
      setStep(2);
    } catch (e) {
      setErrorMsg(e.message || 'Không đọc được file. Hãy dùng file .docx hợp lệ.');
      setStatus('error');
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setIsDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  // ── Process ────────────────────────────────────────────────────────────────
  const handleProcess = async () => {
    if (!file || !JSZipRef) return;
    setStatus('processing'); setProgressMsg('Đang chuẩn bị…'); setErrorMsg('');

    try {
      const JSZip = JSZipRef;
      const buf = await readFileAsArrayBuffer(file);
      const zip = await JSZip.loadAsync(buf);
      const xml = await zip.file('word/document.xml').async('string');
      const paragraphs = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [];
      const onProgress = msg => setProgressMsg(msg);

      // Extract root section properties to preserve page formatting
      const rootSectPr = extractRootSectPr(xml);

      let output = [];
      if (mode === 'heading')
        output = await splitByHeading(paragraphs, Number(headingLevel), zip, JSZip, rootSectPr, onProgress);
      if (mode === 'paragraph')
        output = await splitByParagraph(paragraphs, Number(paragraphsPerFile) || 10, zip, JSZip, rootSectPr, onProgress);
      if (mode === 'pagecount')
        output = await splitByPage(paragraphs, Number(pagesPerFile) || 5, zip, JSZip, rootSectPr, onProgress);

      setResults(output); setStatus('done'); setStep(3);
    } catch (e) {
      setErrorMsg(e.message || 'Lỗi xử lý file.'); setStatus('error');
    }
  };

  const reset = () => {
    setFile(null); setStatus(''); setErrorMsg(''); setResults([]);
    setDocInfo(null); setStep(1); setProgressMsg('');
  };
  const isBusy = status === 'reading' || status === 'processing';

  // Page count display: use real if available, else estimated
  const displayPageCount = docInfo
    ? (docInfo.realPageBreaks > 0 ? docInfo.renderedPages : docInfo.estimatedPages)
    : 0;
  const pageCountLabel = docInfo?.realPageBreaks > 0 ? 'trang thực tế' : 'trang (ước tính)';

  // Estimated files for page mode
  const estimatedPageFiles = () => {
    if (!docInfo) return '?';
    const total = docInfo.realPageBreaks > 0 ? docInfo.renderedPages : docInfo.estimatedPages;
    return Math.ceil(total / (Number(pagesPerFile) || 5));
  };

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">

      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] font-bold uppercase tracking-widest rounded-full mb-4">
          <Sparkles size={10} />
          Xử lý 100% trên trình duyệt · Không upload server · Miễn phí
        </div>
        <h1 className="text-4xl font-black text-white tracking-tight mb-1.5">Tách file Word</h1>
        <p className="text-zinc-500 text-sm">3 chế độ tách · Giữ định dạng trang · Tải về từng file hoặc ZIP</p>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2 mb-6">
        {['Chọn file', 'Tuỳ chọn', 'Tải xuống'].map((label, i) => {
          const n = i + 1; const active = step === n; const done = step > n;
          return (
            <React.Fragment key={n}>
              <div className={`flex items-center gap-1.5 text-xs font-semibold ${active ? 'text-white' : done ? 'text-emerald-400' : 'text-zinc-600'}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${active ? 'bg-orange-500 text-white' : done ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-600'}`}>
                  {done ? '✓' : n}
                </div>
                <span className="hidden sm:inline">{label}</span>
              </div>
              {i < 2 && <div className={`flex-1 h-px ${step > n ? 'bg-emerald-500/40' : 'bg-zinc-800'}`} />}
            </React.Fragment>
          );
        })}
      </div>

      <div className="space-y-3">

        {/* STEP 1: Upload */}
        {step === 1 && (
          <div onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200
              ${isDragging ? 'border-orange-500 bg-orange-500/5' : 'border-zinc-700 hover:border-zinc-500 bg-zinc-900/40'}`}>
            <input ref={fileInputRef} type="file" accept=".docx" className="hidden" onChange={e => handleFile(e.target.files[0])} />
            <div className="flex flex-col items-center py-14 px-6">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${isDragging ? 'bg-orange-500/20' : 'bg-zinc-800'}`}>
                <UploadCloud size={28} className={isDragging ? 'text-orange-400' : 'text-zinc-500'} />
              </div>
              <p className="text-zinc-300 text-sm font-semibold mb-1">{isDragging ? 'Thả file vào đây' : 'Kéo thả hoặc click để chọn'}</p>
              <p className="text-zinc-600 text-xs mb-5">Chỉ nhận .docx · Tối đa {MAX_FILE_SIZE_MB}MB</p>
              <div className="px-5 py-2.5 bg-orange-500 hover:bg-orange-400 text-white text-xs font-bold rounded-xl transition-colors">Chọn file DOCX</div>
            </div>
          </div>
        )}

        {/* Reading indicator */}
        {status === 'reading' && (
          <div className="flex items-center gap-3 p-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl">
            <Loader2 size={15} className="animate-spin text-orange-400 shrink-0" />
            <span className="text-zinc-400 text-sm">{progressMsg}</span>
          </div>
        )}

        {/* STEP 2: Config */}
        {step === 2 && !isBusy && (
          <>
            {/* File card */}
            <div className="flex items-center gap-3 p-4 bg-zinc-900/60 border border-zinc-800/60 rounded-2xl">
              <div className="w-10 h-10 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-center shrink-0">
                <FileText size={18} className="text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate">{file?.name}</p>
                <p className="text-zinc-500 text-[11px] mt-0.5">
                  {file && formatBytes(file.size)}
                  {docInfo && ` · ${displayPageCount} ${pageCountLabel} · ${docInfo.totalParagraphs} đoạn`}
                </p>
              </div>
              <button onClick={reset} className="p-1.5 text-zinc-600 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors">
                <X size={13} />
              </button>
            </div>

            {/* Stats */}
            {docInfo && (
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'H1 headings', value: docInfo.headingCounts[1], color: '#5856D6' },
                  { label: 'H2 headings', value: docInfo.headingCounts[2], color: '#FF9500' },
                  { label: docInfo.realPageBreaks > 0 ? 'Trang thực tế' : 'Trang ước tính', value: displayPageCount, color: '#34C759' },
                  { label: 'Page breaks', value: docInfo.realPageBreaks, color: docInfo.realPageBreaks > 0 ? '#06b6d4' : '#52525b' },
                ].map(s => (
                  <div key={s.label} className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-3 text-center">
                    <p className="text-xl font-black" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-zinc-600 text-[10px] mt-0.5 leading-tight">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Page break info */}
            {docInfo && mode === 'pagecount' && <PageBreakBadge docInfo={docInfo} />}

            {/* Modes */}
            <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-4 space-y-2">
              <p className="text-zinc-500 text-[11px] font-semibold uppercase tracking-wider mb-3">Chế độ tách</p>
              {MODES.map(m => (
                <ModeBtn key={m.id} m={m} selected={mode === m.id}
                  onSelect={() => { setMode(m.id); }} />
              ))}
            </div>

            {/* Options */}
            <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-4 space-y-3">
              <p className="text-zinc-500 text-[11px] font-semibold uppercase tracking-wider">Tuỳ chọn</p>

              {mode === 'heading' && (
                <div className="space-y-2">
                  <p className="text-zinc-400 text-xs">Cấp Heading để tách</p>
                  <div className="flex gap-2">
                    {['1', '2', '3'].map(lv => (
                      <button key={lv} type="button" onClick={() => setHeadingLevel(lv)}
                        className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-all
                          ${headingLevel === lv ? 'bg-[#5856D6] border-[#5856D6] text-white' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>
                        H{lv}
                        {docInfo && <span className="block text-[10px] font-normal opacity-60">{docInfo.headingCounts[lv]} mục</span>}
                      </button>
                    ))}
                  </div>
                  {docInfo?.headingCounts[headingLevel] === 0 && (
                    <p className="text-yellow-500 text-[11px]">⚠ Không tìm thấy H{headingLevel} trong file này. Thử chọn cấp khác.</p>
                  )}
                </div>
              )}

              {mode === 'paragraph' && (
                <div className="space-y-2">
                  <p className="text-zinc-400 text-xs">Số đoạn mỗi file</p>
                  <input type="number" min="1" max="1000" value={paragraphsPerFile}
                    onChange={e => setPPF(e.target.value)}
                    className="w-full bg-black/40 border border-zinc-700/50 rounded-xl px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-orange-500/60" />
                  {docInfo && (
                    <p className="text-zinc-600 text-[11px]">
                      → Sẽ tạo ~{Math.ceil(docInfo.totalParagraphs / (Number(paragraphsPerFile) || 10))} file
                    </p>
                  )}
                </div>
              )}

              {mode === 'pagecount' && (
                <div className="space-y-2">
                  <p className="text-zinc-400 text-xs">
                    Số trang mỗi file
                    {docInfo?.realPageBreaks > 0
                      ? ' (dùng page break thực tế)'
                      : ' (ước tính ~300 từ/trang)'}
                  </p>
                  <input type="number" min="1" max="500" value={pagesPerFile}
                    onChange={e => setPagesPF(e.target.value)}
                    className="w-full bg-black/40 border border-zinc-700/50 rounded-xl px-4 py-3 text-white text-sm font-mono focus:outline-none focus:border-green-500/60" />
                  {docInfo && (
                    <p className="text-zinc-600 text-[11px]">
                      → Sẽ tạo ~{estimatedPageFiles()} file từ {displayPageCount} {pageCountLabel}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Page break info shown when switching to pagecount mode */}
            {docInfo && mode === 'pagecount' && (
              <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-4">
                <p className="text-zinc-500 text-[11px] font-semibold uppercase tracking-wider mb-2">Định dạng trang được bảo toàn</p>
                <div className="space-y-1.5">
                  {[
                    { label: 'Kích thước trang (A4, Letter…)', ok: true },
                    { label: 'Lề trang (margin)', ok: true },
                    { label: 'Header & Footer', ok: true },
                    { label: 'Cột văn bản (columns)', ok: true },
                    { label: 'Hướng trang (portrait/landscape)', ok: true },
                    { label: 'Đánh số trang liên tục', ok: false, note: 'Sẽ đếm lại từ 1 mỗi file' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-2">
                      <span className={item.ok ? 'text-emerald-400' : 'text-yellow-400'} style={{ fontSize: 11 }}>
                        {item.ok ? '✓' : '⚠'}
                      </span>
                      <span className="text-zinc-400 text-[11px]">{item.label}</span>
                      {item.note && <span className="text-zinc-600 text-[10px]">— {item.note}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Processing */}
        {status === 'processing' && (
          <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <Loader2 size={15} className="animate-spin text-orange-400 shrink-0" />
              <span className="text-zinc-300 text-sm font-medium">{progressMsg}</span>
            </div>
            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-orange-500 rounded-full" style={{ width: '55%', animation: 'ind 1.6s ease-in-out infinite' }} />
            </div>
            <style>{`@keyframes ind{0%{transform:translateX(-150%)}100%{transform:translateX(300%)}}`}</style>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="flex items-start gap-3 p-4 bg-red-500/8 border border-red-500/20 rounded-2xl">
            <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-400 text-sm font-semibold">Lỗi</p>
              <p className="text-red-400/70 text-xs mt-0.5">{errorMsg}</p>
            </div>
            <button onClick={() => { setStatus(''); setStep(file ? 2 : 1); }}
              className="text-zinc-500 hover:text-white text-[11px] font-bold uppercase transition-colors shrink-0">OK</button>
          </div>
        )}

        {/* CTA */}
        {step === 2 && !isBusy && status !== 'done' && (
          <button onClick={handleProcess}
            className="w-full py-4 rounded-2xl font-bold text-sm flex justify-center items-center gap-2.5 bg-orange-500 hover:bg-orange-400 text-white transition-all active:scale-[0.98]">
            <Scissors size={15} />
            Tách ngay · {selectedMode?.label}
            <ChevronRight size={14} className="ml-auto opacity-60" />
          </button>
        )}

        {/* STEP 3: Results */}
        {step === 3 && results.length > 0 && (
          <div className="space-y-3">
            <div className="bg-zinc-900/60 border border-emerald-500/20 rounded-2xl p-5">
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-500/15 rounded-full flex items-center justify-center">
                  <CheckCircle2 size={20} className="text-emerald-400" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-bold">Tách thành công!</p>
                  <p className="text-zinc-500 text-xs">
                    {results.length} file · {selectedMode?.label}
                    {results[0]?.method === 'real' && (
                      <span className="ml-1.5 text-emerald-400 font-semibold">· Dùng page break thực tế ✓</span>
                    )}
                    {results[0]?.method === 'estimate' && (
                      <span className="ml-1.5 text-yellow-400">· Ước tính từ</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => JSZipRef && downloadAllZip(results, file?.name.replace(/\.docx$/i, '') || 'tai_lieu', JSZipRef)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold rounded-xl transition-colors">
                  <Archive size={13} />
                  Tải ZIP
                </button>
              </div>

              {/* File list */}
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {results.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-zinc-800/40 border border-zinc-700/40 rounded-xl group">
                    <div className="w-8 h-8 bg-orange-500/10 rounded-lg flex items-center justify-center shrink-0">
                      <FileText size={13} className="text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-zinc-200 truncate font-medium">{r.fileName}</p>
                      <p className="text-[10px] text-zinc-600">
                        {r.pageCount ? `${r.pageCount} trang · ` : ''}{r.count} đoạn · {formatBytes(r.blob.size)}
                      </p>
                    </div>
                    <button onClick={() => downloadOne(r)}
                      className="w-7 h-7 rounded-lg bg-zinc-700/60 hover:bg-emerald-500/20 border border-zinc-600/40 hover:border-emerald-500/30 flex items-center justify-center transition-all">
                      <Download size={12} className="text-zinc-400 group-hover:text-emerald-400" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={reset}
              className="w-full py-3.5 bg-zinc-900/60 border border-zinc-800/60 rounded-2xl text-zinc-400 hover:text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
              <RefreshCcw size={14} />
              Tách file khác
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default SplitDocx;