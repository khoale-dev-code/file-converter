import React, { useState, useRef } from 'react';
import * as mammoth from 'mammoth';
import { FileText, Download, Loader2, FileType2, X, CheckCircle2, Copy } from 'lucide-react';

const DocToTxt = () => {
  const [file, setFile] = useState(null);
  const [extractedText, setExtractedText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileUpload = (e) => {
    const selectedFile = e.target ? e.target.files[0] : e[0];
    if (selectedFile && (selectedFile.name.endsWith('.docx') || selectedFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
      setFile(selectedFile);
      setExtractedText('');
    } else {
      alert("Vui lòng chọn đúng định dạng file .DOCX!");
    }
  };

  const extractTextFromDocx = async () => {
    if (!file) return;
    setIsExtracting(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      // mammoth trích xuất văn bản thô cực nhanh
      const result = await mammoth.extractRawText({ arrayBuffer });
      
      // Giả lập delay 1 xíu để user kịp thấy hiệu ứng Loading (vì mammoth chạy quá nhanh)
      setTimeout(() => {
        setExtractedText(result.value);
        setIsExtracting(false);
      }, 600);
      
    } catch (error) {
      console.error("Lỗi khi đọc file Word:", error);
      alert("Không thể đọc file DOCX này. Vui lòng kiểm tra lại file.");
      setIsExtracting(false);
    }
  };

  const handleDownloadTxt = () => {
    if (!extractedText) return;
    const url = URL.createObjectURL(new Blob([extractedText], { type: 'text/plain;charset=utf-8' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: `${file.name.replace('.docx', '')}.txt` });
    document.body.appendChild(link); link.click(); link.remove();
    URL.revokeObjectURL(url);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(extractedText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const resetTool = () => {
    setFile(null);
    setExtractedText('');
    if(fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 lg:py-20 animate-in fade-in slide-in-from-bottom-4 duration-700 font-sans tracking-tight text-white">
      
      {/* Header Section (iOS Large Title Style) */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-[#1C1C1E]/80 backdrop-blur-xl border border-white/10 rounded-[20px] shadow-lg mb-6">
          <FileType2 className="w-8 h-8 text-[#007AFF]" />
        </div>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
          Word sang Văn bản
        </h2>
        <p className="text-[#8E8E93] text-[15px] max-w-md mx-auto leading-relaxed">
          Trích xuất toàn bộ văn bản từ tài liệu Word (.docx) nhanh chóng và giữ nguyên bố cục đoạn văn.
        </p>
      </div>

      {/* Upload Zone */}
      {!file && (
        <div 
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileUpload(e.dataTransfer.files); }}
          className={`relative overflow-hidden transition-all duration-300 rounded-[32px] border cursor-pointer
            ${isDragging ? 'border-[#007AFF] bg-[#007AFF]/10 scale-[1.02]' : 'border-white/10 bg-[#1C1C1E]/60 hover:bg-[#2C2C2E]/60'} 
            backdrop-blur-2xl shadow-xl`}
        >
          <input 
            type="file" 
            accept=".docx" 
            onChange={handleFileUpload} 
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
            ref={fileInputRef}
          />
          
          <div className="flex flex-col items-center justify-center p-14 text-center">
            <FileText className={`w-12 h-12 mb-4 transition-colors ${isDragging ? 'text-[#007AFF]' : 'text-[#8E8E93]'}`} />
            <h3 className="text-[17px] font-semibold text-white mb-1">
              Chọn tài liệu Word
            </h3>
            <p className="text-[13px] text-[#8E8E93]">
              Kéo thả file .docx vào đây hoặc chạm để duyệt
            </p>
          </div>
        </div>
      )}

      {/* File Details & Extract Button */}
      {file && !extractedText && (
        <div className="space-y-4 animate-in zoom-in-95 duration-300">
          {/* iOS Settings Row Style */}
          <div className="flex items-center justify-between p-4 bg-[#1C1C1E]/80 backdrop-blur-2xl border border-white/10 rounded-[24px] shadow-lg">
            <div className="flex items-center gap-4 overflow-hidden">
              <div className="p-3 bg-[#007AFF]/20 rounded-[14px]">
                <FileText className="text-[#007AFF]" size={24} />
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
              onClick={resetTool}
              className="p-2 mr-1 bg-white/5 hover:bg-white/10 rounded-full text-[#8E8E93] transition-colors active:scale-90"
            >
              <X size={18} />
            </button>
          </div>
          
          <button 
            onClick={extractTextFromDocx} 
            disabled={isExtracting}
            className="relative w-full overflow-hidden flex items-center justify-center gap-2 py-4 bg-[#007AFF] text-white font-semibold text-[17px] rounded-[24px] hover:bg-[#007AFF]/90 transition-all active:scale-[0.97] disabled:opacity-70 disabled:active:scale-100 shadow-lg shadow-blue-500/20"
          >
            {isExtracting ? (
              <><Loader2 className="animate-spin w-5 h-5" /> Đang đọc tài liệu...</>
            ) : (
              'Bắt đầu lấy chữ'
            )}
          </button>
        </div>
      )}

      {/* Result State */}
      {extractedText && (
        <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
          
          {/* Success Banner */}
          <div className="flex items-center justify-center gap-2 p-3 bg-[#34C759]/10 border border-[#34C759]/20 text-[#34C759] rounded-[20px] text-[15px] font-medium">
            <CheckCircle2 size={18} /> Trích xuất hoàn tất
          </div>

          {/* Text Area Output (iOS Notes App Style) */}
          <div className="relative">
            <textarea 
              value={extractedText} 
              readOnly
              className="w-full h-72 p-6 bg-[#1C1C1E]/80 backdrop-blur-2xl border border-white/10 rounded-[28px] text-[#EBEBF5] font-mono text-[14px] leading-relaxed focus:outline-none focus:border-[#007AFF]/50 focus:ring-1 focus:ring-[#007AFF]/50 resize-y shadow-inner custom-scrollbar"
              placeholder="Nội dung sẽ hiển thị ở đây..."
            />
            {/* Quick Copy Button floating top-right */}
            <button 
              onClick={handleCopyText}
              className="absolute top-4 right-4 p-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-white backdrop-blur-md transition-all active:scale-90"
              title="Sao chép văn bản"
            >
              {isCopied ? <CheckCircle2 size={16} className="text-[#34C759]" /> : <Copy size={16} />}
            </button>
          </div>

          {/* Action Buttons Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            <button 
              onClick={handleDownloadTxt} 
              className="flex items-center justify-center gap-2 py-4 bg-[#34C759] text-white font-semibold text-[17px] rounded-[24px] active:scale-[0.97] transition-all shadow-lg shadow-green-500/20"
            >
              <Download size={20} /> Tải file .TXT
            </button>
            <button 
              onClick={resetTool}
              className="py-4 bg-white/10 text-white font-semibold text-[17px] rounded-[24px] active:scale-[0.97] transition-all"
            >
              Chọn tệp khác
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocToTxt;