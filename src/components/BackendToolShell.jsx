import React, { useState, useRef } from 'react';
import { UploadCloud, File, Download, Loader2, ServerCog, CheckCircle2, X, FileText, ShieldCheck } from 'lucide-react';

const BackendToolShell = ({ title, description, accept, icon: Icon, expectedAction }) => {
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [resultFileName, setResultFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);

  const API_URL = "https://file-forge-backend.file-forge-api.workers.dev/process";

  const handleFileUpload = (e) => {
    const selectedFile = e.target ? e.target.files[0] : e[0];
    if (selectedFile) {
      setFile(selectedFile);
      setDownloadUrl(null);
      setResultFileName("");
      setProgress(0);
    }
  };

  const simulateProgress = () => {
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) {
          clearInterval(interval);
          return prev;
        }
        return prev + 5;
      });
    }, 100);
    return interval;
  };

  const handleProcess = async () => {
    if (!file) return;
    setIsProcessing(true);
    const progressInterval = simulateProgress();

    const formData = new FormData();
    formData.append("file", file);
    formData.append("action", expectedAction);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setProgress(100);
        setTimeout(() => {
          setDownloadUrl(data.downloadUrl);
          setResultFileName(data.fileName);
        }, 500);
      } else {
        alert("Lỗi: " + (data.error || "Không thể xử lý file"));
      }
    } catch (error) {
      alert("Lỗi kết nối máy chủ.");
    } finally {
      clearInterval(progressInterval);
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 lg:py-20 animate-in fade-in slide-in-from-bottom-4 duration-700 font-sans tracking-tight text-white">
      
      {/* Header Section (iOS Large Title Style) */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-[#1C1C1E]/80 backdrop-blur-xl border border-white/10 rounded-[20px] shadow-lg mb-6">
          <Icon className="w-8 h-8 text-blue-500" />
        </div>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
          {title}
        </h2>
        <p className="text-[#8E8E93] text-[15px] max-w-md mx-auto leading-relaxed">
          {description}
        </p>
      </div>

      {/* Upload Zone (iOS Frosted Glass Container) */}
      {!file && (
        <div 
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileUpload(e.dataTransfer.files); }}
          className={`relative overflow-hidden transition-all duration-300 rounded-[32px] border 
            ${isDragging ? 'border-blue-500 bg-[#007AFF]/10 scale-[1.02]' : 'border-white/10 bg-[#1C1C1E]/60 hover:bg-[#2C2C2E]/60'} 
            backdrop-blur-2xl shadow-xl`}
        >
          <input 
            type="file" 
            accept={accept} 
            onChange={handleFileUpload} 
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
            ref={fileInputRef}
          />
          
          <div className="flex flex-col items-center justify-center p-14 text-center">
            <UploadCloud className={`w-12 h-12 mb-4 transition-colors ${isDragging ? 'text-blue-500' : 'text-[#8E8E93]'}`} />
            <h3 className="text-[17px] font-semibold text-white mb-1">
              Chọn tệp tin
            </h3>
            <p className="text-[13px] text-[#8E8E93]">
              Kéo thả vào đây hoặc chạm để duyệt
            </p>
          </div>
        </div>
      )}

      {/* File Details & Actions */}
      {file && !downloadUrl && (
        <div className="space-y-4 animate-in zoom-in-95 duration-300">
          {/* iOS Settings Row Style */}
          <div className="flex items-center justify-between p-4 bg-[#1C1C1E]/80 backdrop-blur-2xl border border-white/10 rounded-[24px] shadow-lg">
            <div className="flex items-center gap-4 overflow-hidden">
              <div className="p-3 bg-blue-500/20 rounded-[14px]">
                <FileText className="text-blue-500" size={24} />
              </div>
              <div className="flex flex-col truncate">
                <span className="text-[15px] font-semibold text-white truncate max-w-[200px] sm:max-w-[300px]">
                  {file.name}
                </span>
                <span className="text-[13px] text-[#8E8E93] mt-0.5">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
              </div>
            </div>
            <button 
              onClick={() => {setFile(null); if(fileInputRef.current) fileInputRef.current.value = "";}}
              className="p-2 mr-1 bg-white/5 hover:bg-white/10 rounded-full text-[#8E8E93] transition-colors active:scale-90"
            >
              <X size={18} />
            </button>
          </div>
          
          {/* iOS Primary Button */}
          <button 
            onClick={handleProcess} 
            disabled={isProcessing}
            className="relative w-full overflow-hidden flex items-center justify-center gap-2 py-4 bg-[#007AFF] text-white font-semibold text-[17px] rounded-[24px] hover:bg-[#007AFF]/90 transition-all active:scale-[0.97] disabled:opacity-70 disabled:active:scale-100 shadow-lg shadow-blue-500/20"
          >
            {isProcessing ? (
              <div className="flex flex-col w-full px-6">
                <div className="flex justify-between text-[13px] mb-1.5 font-medium">
                  <span>Đang xử lý...</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full h-1.5 bg-black/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white transition-all duration-300 ease-out rounded-full" style={{ width: `${progress}%` }} />
                </div>
              </div>
            ) : (
              <>Bắt đầu xử lý</>
            )}
          </button>
        </div>
      )}

      {/* Success State */}
      {downloadUrl && (
        <div className="animate-in slide-in-from-bottom-4 duration-500">
          <div className="p-8 bg-[#1C1C1E]/80 backdrop-blur-2xl border border-white/10 rounded-[32px] text-center shadow-2xl">
            <div className="w-16 h-16 bg-[#34C759]/20 text-[#34C759] rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 size={36} strokeWidth={2.5} />
            </div>
            <h4 className="text-[22px] font-bold text-white mb-1.5">Hoàn tất!</h4>
            <p className="text-[14px] text-[#8E8E93] mb-8 font-medium truncate px-4">{resultFileName}</p>
            
            <div className="flex flex-col gap-3">
              <a 
                href={downloadUrl} 
                download={resultFileName}
                className="flex items-center justify-center gap-2 py-4 bg-[#34C759] text-white font-semibold text-[17px] rounded-[20px] active:scale-[0.97] transition-all shadow-lg shadow-green-500/20"
              >
                <Download size={20} /> Tải tệp xuống
              </a>
              <button 
                onClick={() => {setFile(null); setDownloadUrl(null); if(fileInputRef.current) fileInputRef.current.value = "";}}
                className="py-4 bg-white/10 text-white font-semibold text-[17px] rounded-[20px] active:scale-[0.97] transition-all"
              >
                Xử lý tệp khác
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div className="mt-10 flex justify-center items-center gap-6 opacity-50">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#8E8E93]">
          <ServerCog size={14} /> Edge Computing
        </div>
        <div className="w-[1px] h-3 bg-white/20"></div>
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#8E8E93]">
          <ShieldCheck size={14} /> AES-256
        </div>
      </div>
    </div>
  );
};

export default BackendToolShell;