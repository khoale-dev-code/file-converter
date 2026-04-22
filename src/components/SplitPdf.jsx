import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  Scissors, UploadCloud, Loader2, Download, FileDigit,
  CheckCircle2, RefreshCcw, AlertCircle, FileText, X, Info, Plus, Trash2, BookOpen
} from 'lucide-react';

const API_URL = "https://file-forge-backend.file-forge-api.workers.dev";
const MAX_FILE_SIZE_MB = 100;

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function parseToken(token) {
  const t = token.trim();
  if (!t) return { error: "Mục rỗng không hợp lệ." };

  if (/^\d+$/.test(t)) {
    const n = Number(t);
    if (n < 1) return { error: `Trang "${t}" không hợp lệ.` };
    return { start: n, end: n };
  }

  if (/^\d+-\d+$/.test(t)) {
    const [a, b] = t.split('-').map(Number);
    if (a < 1 || b < 1) return { error: `Khoảng "${t}" không hợp lệ.` };
    if (a > b) return { error: `Khoảng "${t}" không hợp lệ: trang bắt đầu phải <= trang kết thúc.` };
    return { start: a, end: b };
  }

  return { error: `"${t}" sai định dạng. Ví dụ đúng: 1-3, 5, 9-12` };
}

function normalizeInputToRanges(input) {
  if (!input.trim()) return { ranges: [], error: "Vui lòng chọn trang cần tách." };

  const tokens = input.split(',').map(s => s.trim()).filter(Boolean);
  const ranges = [];

  for (const token of tokens) {
    const parsed = parseToken(token);
    if (parsed.error) return { ranges: [], error: parsed.error };
    ranges.push({ start: parsed.start, end: parsed.end });
  }

  // loại trùng chính xác nhưng giữ nguyên thứ tự người dùng nhập
  const seen = new Set();
  const unique = ranges.filter(r => {
    const key = `${r.start}-${r.end}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { ranges: unique, error: null };
}

function rangesToApiString(ranges) {
  return ranges.map(r => (r.start === r.end ? `${r.start}` : `${r.start}-${r.end}`)).join(',');
}

function formatPreviewText(ranges) {
  if (!ranges.length) return "—";
  return ranges.map(renderRange).join(' | ');
}

function countSelectedPages(ranges) {
  return ranges.reduce((sum, r) => sum + (r.end - r.start + 1), 0);
}

function renderRange(r) {
  return r.start === r.end ? `${r.start}` : `${r.start}-${r.end}`;
}

function PageChips({ ranges, onRemove }) {
  if (!ranges.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {ranges.map((r, i) => (
        <span
          key={`${r.start}-${r.end}-${i}`}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[11px] font-mono rounded-md"
        >
          {renderRange(r)}
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="text-indigo-300/70 hover:text-white transition-colors"
            title="Xoá mục này"
          >
            <X size={11} />
          </button>
        </span>
      ))}
    </div>
  );
}

const SplitPdf = () => {
  const [file, setFile] = useState(null);
  const [pages, setPages] = useState("");
  const [pageError, setPageError] = useState("");
  const [status, setStatus] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [resultFileName, setResultFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const [fromPage, setFromPage] = useState("");
  const [toPage, setToPage] = useState("");

  const fileInputRef = useRef(null);
  const abortRef = useRef(null);

  const parsed = useMemo(() => normalizeInputToRanges(pages), [pages]);
  const selectedRanges = parsed.ranges;
  const selectedCount = countSelectedPages(selectedRanges);

  const handleFile = useCallback((f) => {
    if (!f) return;
    if (f.type !== 'application/pdf') {
      setErrorMessage("Chỉ chấp nhận file PDF.");
      setStatus("error");
      return;
    }
    if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setErrorMessage(`File quá lớn. Tối đa ${MAX_FILE_SIZE_MB}MB.`);
      setStatus("error");
      return;
    }
    setFile(f);
    setStatus("");
    setErrorMessage("");
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const handlePagesChange = (e) => {
    const value = e.target.value;
    setPages(value);
    const rs = normalizeInputToRanges(value);
    setPageError(rs.error || "");
  };

  const addRange = () => {
    const start = Number(fromPage);
    const end = Number(toPage);

    if (!start || !end || start < 1 || end < 1) {
      setPageError("Vui lòng nhập đầy đủ 'Từ trang' và 'Đến trang' (>= 1).");
      return;
    }
    if (start > end) {
      setPageError("'Từ trang' phải nhỏ hơn hoặc bằng 'Đến trang'.");
      return;
    }

    const nextRanges = [...selectedRanges, { start, end }];
    const nextText = rangesToApiString(nextRanges);
    const rs = normalizeInputToRanges(nextText);

    setPages(nextText);
    setPageError(rs.error || "");
    setFromPage("");
    setToPage("");
  };

  const removeRangeAt = (idx) => {
    const next = selectedRanges.filter((_, i) => i !== idx);
    const nextText = rangesToApiString(next);
    setPages(nextText);
    const rs = normalizeInputToRanges(nextText);
    setPageError(rs.error || "");
  };

  const clearAllRanges = () => {
    setPages("");
    setPageError("Vui lòng chọn trang cần tách.");
  };

  const handleProcess = async () => {
    if (!file) return;
    const check = normalizeInputToRanges(pages);
    if (check.error) {
      setPageError(check.error);
      return;
    }

    setStatus("processing");
    setErrorMessage("");
    setDownloadUrl(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const apiOptions = rangesToApiString(check.ranges); // giữ nguyên khoảng, ví dụ 1-10
      const formData = new FormData();
      formData.append("file", file);
      formData.append("action", "Split PDF");
      formData.append("options", apiOptions);

      const resProcess = await fetch(`${API_URL}/process`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      const data = await resProcess.json();

      if (data.success) {
        setDownloadUrl(data.downloadUrl);
        setResultFileName(data.fileName);
        setStatus("done");
      } else {
        throw new Error(data.error || "Không thể xử lý tệp tin này.");
      }
    } catch (e) {
      if (e.name === "AbortError") return;
      setErrorMessage(e.message);
      setStatus("error");
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    resetForm();
  };

  const resetForm = () => {
    setFile(null);
    setStatus("");
    setErrorMessage("");
    setDownloadUrl(null);
    setResultFileName("");
    setPageError("");
    setPages("");
    setFromPage("");
    setToPage("");
  };

  const isProcessing = status === "processing";

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase tracking-widest rounded-full mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          Cắt PDF thông minh
        </div>
        <h1 className="text-4xl font-black text-white tracking-tight mb-2">Tách trang PDF</h1>
        <p className="text-zinc-500 text-sm">Thiết kế theo logic người dùng: dễ chọn, dễ kiểm tra, ít sai sót</p>
      </div>

      <div className="space-y-4">
        {status !== "done" && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => !isProcessing && fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl transition-all duration-300 cursor-pointer
              ${isProcessing ? "pointer-events-none opacity-60" : ""}
              ${isDragging ? "border-indigo-500 bg-indigo-500/5" : ""}
              ${file && !isDragging ? "border-indigo-500/40 bg-indigo-500/5" : ""}
              ${!file && !isDragging ? "border-zinc-700 hover:border-zinc-500 bg-zinc-900/40" : ""}
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => handleFile(e.target.files[0])}
            />

            {file ? (
              <div className="flex items-center gap-4 p-5">
                <div className="p-3 bg-indigo-500/15 rounded-xl text-indigo-400 shrink-0">
                  <FileText size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">{file.name}</p>
                  <p className="text-zinc-500 text-xs font-mono mt-0.5">{formatBytes(file.size)}</p>
                </div>
                {!isProcessing && (
                  <button
                    onClick={(e) => { e.stopPropagation(); resetForm(); }}
                    className="p-1.5 text-zinc-600 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center py-12 px-6">
                <UploadCloud size={36} className={`mb-3 transition-colors ${isDragging ? "text-indigo-400" : "text-zinc-600"}`} />
                <p className="text-zinc-400 text-sm font-medium mb-1">
                  {isDragging ? "Thả file vào đây" : "Kéo thả hoặc click để chọn PDF"}
                </p>
                <p className="text-zinc-600 text-xs">Tối đa {MAX_FILE_SIZE_MB}MB</p>
              </div>
            )}
          </div>
        )}

        {file && status !== "done" && (
          <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-zinc-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <FileDigit size={13} className="text-indigo-500" />
                Chọn trang cần tách
              </label>
              <div className="flex items-center gap-1 text-zinc-600 text-[11px]">
                <Info size={11} />
                <span>Ví dụ: 1-2, 4-6, 9</span>
              </div>
            </div>

            {/* Hướng dẫn sử dụng */}
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3">
              <p className="text-[12px] text-indigo-300 font-semibold flex items-center gap-1.5 mb-1.5">
                <BookOpen size={13} />
                Hướng dẫn nhanh
              </p>
              <ul className="text-[11px] text-zinc-300 space-y-1 list-disc pl-4">
                <li>Cách 1: Nhập trực tiếp chuỗi trang: <span className="font-mono text-indigo-300">1-2,4-5,8</span></li>
                <li>Cách 2: Nhập <b>Từ trang</b> và <b>Đến trang</b> rồi bấm <b>Thêm khoảng</b></li>
                <li>Bạn có thể tách nhiều khoảng trong 1 lần xử lý</li>
                <li>Nhấn dấu <b>X</b> trên mỗi chip để xoá mục không cần</li>
              </ul>
            </div>

            <input
              type="text"
              value={pages}
              onChange={handlePagesChange}
              placeholder="Ví dụ: 1-2, 4-6, 9"
              disabled={isProcessing}
              className={`w-full bg-black/40 border rounded-xl px-4 py-3 text-white text-sm font-mono
                focus:outline-none focus:ring-2 transition-all
                ${pageError
                  ? "border-red-500/50 focus:ring-red-500/20"
                  : "border-zinc-700/50 focus:border-indigo-500/60 focus:ring-indigo-500/15"
                }
                disabled:opacity-50 disabled:cursor-not-allowed`}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="number"
                min="1"
                value={fromPage}
                onChange={(e) => setFromPage(e.target.value)}
                placeholder="Từ trang"
                className="bg-black/40 border border-zinc-700/50 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/60"
              />
              <input
                type="number"
                min="1"
                value={toPage}
                onChange={(e) => setToPage(e.target.value)}
                placeholder="Đến trang"
                className="bg-black/40 border border-zinc-700/50 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/60"
              />
              <button
                type="button"
                onClick={addRange}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-3 py-2.5 transition-colors"
              >
                <Plus size={14} />
                Thêm khoảng
              </button>
            </div>

            {pageError ? (
              <p className="text-red-400 text-xs flex items-center gap-1.5">
                <AlertCircle size={12} className="shrink-0" />
                {pageError}
              </p>
            ) : (
              <>
                <PageChips ranges={selectedRanges} onRemove={removeRangeAt} />
                <div className="text-[11px] text-zinc-500 space-y-0.5">
                  <p>Chuỗi gửi đi: <span className="text-zinc-300 font-mono">{rangesToApiString(selectedRanges) || "—"}</span></p>
                  <p>Bạn đang tách: <span className="text-zinc-200 font-mono">{formatPreviewText(selectedRanges)}</span></p>
                  <p>Tổng số trang đã chọn: <span className="text-indigo-300 font-semibold">{selectedCount}</span></p>
                </div>
                <button
                  type="button"
                  onClick={clearAllRanges}
                  className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  <Trash2 size={12} />
                  Xoá toàn bộ danh sách trang
                </button>
              </>
            )}
          </div>
        )}

        {isProcessing && (
          <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3 text-sm text-zinc-400">
              <Loader2 size={16} className="animate-spin text-indigo-400 shrink-0" />
              <span>Đang xử lý — vui lòng không đóng tab này</span>
            </div>
            <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full"
                style={{ width: '40%', animation: 'indeterminate 1.5s ease-in-out infinite' }}
              />
            </div>
            <style>{`@keyframes indeterminate { 0%{transform:translateX(-200%)} 100%{transform:translateX(400%)} }`}</style>
            <button onClick={handleCancel} className="text-zinc-600 hover:text-zinc-400 text-xs font-medium transition-colors">
              Huỷ
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="flex items-start gap-3 p-4 bg-red-500/8 border border-red-500/20 rounded-2xl">
            <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-red-400 text-sm font-medium">Đã xảy ra lỗi</p>
              <p className="text-red-500/70 text-xs mt-0.5 break-words">{errorMessage}</p>
            </div>
            <button onClick={resetForm} className="text-zinc-600 hover:text-white text-[11px] font-semibold uppercase shrink-0 transition-colors">
              Thử lại
            </button>
          </div>
        )}

        {file && !isProcessing && status !== "done" && (
          <button
            onClick={handleProcess}
            disabled={!!pageError || selectedRanges.length === 0}
            className="w-full py-4 rounded-2xl font-bold text-sm tracking-wide flex justify-center items-center gap-2.5 transition-all duration-200
              bg-indigo-600 text-white hover:bg-indigo-500 active:scale-[0.98]
              disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-indigo-600"
          >
            <Scissors size={16} />
            Tách ngay
          </button>
        )}

        {status === "done" && (
          <div className="bg-zinc-900/60 border border-emerald-500/20 rounded-2xl p-6 text-center space-y-5">
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-emerald-500/15 rounded-full flex items-center justify-center">
                <CheckCircle2 size={24} className="text-emerald-400" />
              </div>
              <h3 className="text-white font-bold text-lg">Tách trang thành công</h3>
              <p className="text-zinc-500 text-sm">
                Đã tách các mục: <span className="text-emerald-400 font-mono">{rangesToApiString(selectedRanges)}</span>
              </p>
            </div>
            <div className="space-y-2.5">
              <a
                href={downloadUrl}
                download={resultFileName}
                className="flex items-center justify-center gap-2.5 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl transition-colors"
              >
                <Download size={16} />
                Tải xuống {resultFileName}
              </a>
              <button
                onClick={resetForm}
                className="flex items-center justify-center gap-2 w-full py-3 text-zinc-500 hover:text-zinc-300 text-xs font-semibold uppercase tracking-wider transition-colors"
              >
                <RefreshCcw size={13} />
                Tách file khác
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SplitPdf;
