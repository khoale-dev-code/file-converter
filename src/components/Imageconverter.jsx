import React, { useState, useRef, useCallback } from 'react';
import {
  UploadCloud, Download, RefreshCcw, AlertCircle,
  FileImage, X, Loader2, CheckCircle2, ArrowRight
} from 'lucide-react';

const API_URL = "https://file-forge-backend.file-forge-api.workers.dev";
const MAX_FILE_SIZE_MB = 100;

// ── Cấu hình các chế độ chuyển đổi ─────────────────────────────────────────

const MODES = {
  "image-to-svg": {
    label: "Ảnh → SVG",
    description: "Chuyển PNG, JPG, WEBP, GIF, BMP sang định dạng SVG giữ nguyên màu sắc",
    accepts: ".png,.jpg,.jpeg,.webp,.gif,.bmp",
    acceptLabel: "PNG, JPG, WEBP, GIF, BMP",
    outputExt: "svg",
    getAction: (file) => {
      const ext = file.name.split('.').pop().toLowerCase();
      const map = { png: "PNG to SVG", jpg: "JPG to SVG", jpeg: "JPEG to SVG", webp: "WEBP to SVG", gif: "GIF to SVG", bmp: "BMP to SVG" };
      return map[ext] || "PNG to SVG";
    },
  },
  "svg-to-png": {
    label: "SVG → PNG",
    description: "Chuyển file SVG sang ảnh PNG chất lượng cao, giữ nguyên màu và độ trong suốt",
    accepts: ".svg",
    acceptLabel: "SVG",
    outputExt: "png",
    getAction: () => "SVG to PNG",
  },
  "svg-to-jpg": {
    label: "SVG → JPG",
    description: "Chuyển SVG sang JPG, phù hợp để nhúng vào tài liệu hoặc web",
    accepts: ".svg",
    acceptLabel: "SVG",
    outputExt: "jpg",
    getAction: () => "SVG to JPG",
  },
  "svg-to-webp": {
    label: "SVG → WEBP",
    description: "Chuyển SVG sang WEBP — định dạng ảnh hiện đại, nhẹ nhất cho web",
    accepts: ".svg",
    acceptLabel: "SVG",
    outputExt: "webp",
    getAction: () => "SVG to WEBP",
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getPreviewUrl(file) {
  if (!file) return null;
  return URL.createObjectURL(file);
}

// ── Mode selector tab ────────────────────────────────────────────────────────

function ModeTab({ id, label, active, onClick }) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-200
        ${active
          ? "bg-violet-600 text-white"
          : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
        }`}
    >
      {label}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const ImageConverter = () => {
  const [modeId, setModeId] = useState("image-to-svg");
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState(""); // "" | "processing" | "done" | "error"
  const [errorMessage, setErrorMessage] = useState("");
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [resultFileName, setResultFileName] = useState("");
  const [resultPreview, setResultPreview] = useState(null);
  const fileInputRef = useRef(null);
  const abortRef = useRef(null);

  const mode = MODES[modeId];

  const handleModeChange = (id) => {
    setModeId(id);
    resetForm();
  };

  const handleFile = useCallback((f) => {
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    const allowedExts = mode.accepts.replace(/\./g, '').split(',');
    if (!allowedExts.includes(ext)) {
      setErrorMessage(`Định dạng không được hỗ trợ. Chỉ chấp nhận: ${mode.acceptLabel}`);
      setStatus("error");
      return;
    }
    if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setErrorMessage(`File quá lớn. Tối đa ${MAX_FILE_SIZE_MB}MB.`);
      setStatus("error");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(getPreviewUrl(f));
    setStatus("");
    setErrorMessage("");
    setDownloadUrl(null);
    setResultPreview(null);
  }, [mode, previewUrl]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const handleProcess = async () => {
    if (!file) return;
    setStatus("processing");
    setErrorMessage("");
    setDownloadUrl(null);
    setResultPreview(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("action", mode.getAction(file));

      const res = await fetch(`${API_URL}/process`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      const data = await res.json();

      if (data.success) {
        setDownloadUrl(data.downloadUrl);
        setResultFileName(data.fileName);
        // Tải preview kết quả
        try {
          const imgRes = await fetch(data.downloadUrl);
          const blob = await imgRes.blob();
          setResultPreview(URL.createObjectURL(blob));
        } catch (_) {}
        setStatus("done");
      } else {
        throw new Error(data.error || "Không thể xử lý file này.");
      }
    } catch (e) {
      if (e.name === "AbortError") return;
      console.error("Lỗi:", e);
      setErrorMessage(e.message);
      setStatus("error");
    }
  };

  const resetForm = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (resultPreview) URL.revokeObjectURL(resultPreview);
    setFile(null);
    setPreviewUrl(null);
    setStatus("");
    setErrorMessage("");
    setDownloadUrl(null);
    setResultFileName("");
    setResultPreview(null);
  };

  const isProcessing = status === "processing";

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">

      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[10px] font-bold uppercase tracking-widest rounded-full mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
          Image Converter
        </div>
        <h1 className="text-4xl font-black text-white tracking-tight mb-2">Chuyển đổi hình ảnh</h1>
        <p className="text-zinc-500 text-sm">Chuyển đổi giữa ảnh raster và SVG — giữ nguyên màu sắc</p>
      </div>

      {/* Mode tabs */}
      <div className="flex flex-wrap gap-2 justify-center mb-8 p-1.5 bg-zinc-900/60 border border-zinc-800/60 rounded-2xl">
        {Object.entries(MODES).map(([id, m]) => (
          <ModeTab key={id} id={id} label={m.label} active={modeId === id} onClick={handleModeChange} />
        ))}
      </div>

      {/* Mode description */}
      <p className="text-center text-zinc-500 text-sm mb-6">{mode.description}</p>

      <div className="space-y-4">

        {/* Drop zone */}
        {status !== "done" && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => !isProcessing && fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl transition-all duration-300 cursor-pointer overflow-hidden
              ${isProcessing ? "pointer-events-none opacity-60" : ""}
              ${isDragging ? "border-violet-500 bg-violet-500/5" : ""}
              ${file && !isDragging ? "border-violet-500/40 bg-violet-500/5" : ""}
              ${!file && !isDragging ? "border-zinc-700 hover:border-zinc-500 bg-zinc-900/40" : ""}
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={mode.accepts}
              className="hidden"
              onChange={(e) => handleFile(e.target.files[0])}
            />

            {file ? (
              <div className="flex items-center gap-4 p-5">
                {/* Thumbnail preview */}
                {previewUrl && (
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-zinc-800 shrink-0 flex items-center justify-center border border-zinc-700/50">
                    <img
                      src={previewUrl}
                      alt="preview"
                      className="w-full h-full object-contain"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">{file.name}</p>
                  <p className="text-zinc-500 text-xs font-mono mt-0.5">{formatBytes(file.size)}</p>
                  <p className="text-violet-400/70 text-[11px] mt-1">
                    → sẽ xuất ra <span className="font-mono uppercase">.{mode.outputExt}</span>
                  </p>
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
                <FileImage size={36} className={`mb-3 transition-colors ${isDragging ? "text-violet-400" : "text-zinc-600"}`} />
                <p className="text-zinc-400 text-sm font-medium mb-1">
                  {isDragging ? "Thả file vào đây" : "Kéo thả hoặc click để chọn ảnh"}
                </p>
                <p className="text-zinc-600 text-xs">{mode.acceptLabel} · Tối đa {MAX_FILE_SIZE_MB}MB</p>
              </div>
            )}
          </div>
        )}

        {/* Processing */}
        {isProcessing && (
          <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3 text-sm text-zinc-400">
              <Loader2 size={16} className="animate-spin text-violet-400 shrink-0" />
              <span>Đang chuyển đổi — vui lòng không đóng tab này</span>
            </div>
            <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-500 rounded-full"
                style={{ width: '40%', animation: 'indeterminate 1.5s ease-in-out infinite' }}
              />
            </div>
            <style>{`@keyframes indeterminate{0%{transform:translateX(-200%)}100%{transform:translateX(400%)}}`}</style>
            <button onClick={() => { abortRef.current?.abort(); resetForm(); }}
              className="text-zinc-600 hover:text-zinc-400 text-xs font-medium transition-colors">
              Huỷ
            </button>
          </div>
        )}

        {/* Error */}
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

        {/* CTA */}
        {file && !isProcessing && status !== "done" && (
          <button
            onClick={handleProcess}
            className="w-full py-4 rounded-2xl font-bold text-sm tracking-wide flex justify-center items-center gap-2.5 transition-all duration-200
              bg-violet-600 text-white hover:bg-violet-500 active:scale-[0.98]"
          >
            <ArrowRight size={16} />
            Chuyển đổi sang .{mode.outputExt.toUpperCase()}
          </button>
        )}

        {/* Success */}
        {status === "done" && (
          <div className="bg-zinc-900/60 border border-emerald-500/20 rounded-2xl overflow-hidden">
            {/* Preview so sánh trước / sau */}
            {previewUrl && resultPreview && (
              <div className="grid grid-cols-2 gap-px bg-zinc-800/50">
                <div className="bg-zinc-900 p-4">
                  <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-wider mb-2">Gốc</p>
                  <div className="rounded-lg overflow-hidden bg-zinc-800 flex items-center justify-center min-h-[120px]"
                    style={{ backgroundImage: 'repeating-conic-gradient(#333 0% 25%, #2a2a2a 0% 50%)', backgroundSize: '16px 16px' }}>
                    <img src={previewUrl} alt="original" className="max-w-full max-h-40 object-contain" />
                  </div>
                </div>
                <div className="bg-zinc-900 p-4">
                  <p className="text-emerald-500/70 text-[10px] font-bold uppercase tracking-wider mb-2">Kết quả</p>
                  <div className="rounded-lg overflow-hidden bg-zinc-800 flex items-center justify-center min-h-[120px]"
                    style={{ backgroundImage: 'repeating-conic-gradient(#333 0% 25%, #2a2a2a 0% 50%)', backgroundSize: '16px 16px' }}>
                    <img src={resultPreview} alt="result" className="max-w-full max-h-40 object-contain" />
                  </div>
                </div>
              </div>
            )}

            <div className="p-6 text-center space-y-4">
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-10 h-10 bg-emerald-500/15 rounded-full flex items-center justify-center">
                  <CheckCircle2 size={20} className="text-emerald-400" />
                </div>
                <h3 className="text-white font-bold">Chuyển đổi thành công</h3>
                <p className="text-zinc-500 text-xs font-mono">{resultFileName}</p>
              </div>

              <div className="space-y-2.5">
                <a
                  href={downloadUrl}
                  download={resultFileName}
                  className="flex items-center justify-center gap-2.5 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl transition-colors"
                >
                  <Download size={16} />
                  Tải xuống .{mode.outputExt.toUpperCase()}
                </a>
                <button
                  onClick={resetForm}
                  className="flex items-center justify-center gap-2 w-full py-3 text-zinc-500 hover:text-zinc-300 text-xs font-semibold uppercase tracking-wider transition-colors"
                >
                  <RefreshCcw size={13} />
                  Chuyển đổi file khác
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default ImageConverter;