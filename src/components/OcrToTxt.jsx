import React, { useState, useEffect } from 'react';
import Tesseract from 'tesseract.js';
import { UploadCloud, ScanText, Download, Loader2, FileImage, Sparkles, BrainCircuit } from 'lucide-react';

const OcrToTxt = () => {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  
  // State cho phần trích xuất chữ (OCR)
  const [extractedText, setExtractedText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');

  // State cho phần Tóm tắt AI
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryText, setSummaryText] = useState('');

  // Dọn dẹp URL preview khi component unmount
  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  const handleFileUpload = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile && selectedFile.type.startsWith('image/')) {
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setExtractedText('');
      setSummaryText('');
      setProgress(0);
    } else {
      alert("Vui lòng chọn file hình ảnh (JPG, PNG, WEBP)!");
    }
  };

  const extractTextWithOcr = async () => {
    if (!file) return;
    setIsExtracting(true);
    setProgress(0);
    setStatusText('Đang khởi tạo AI Nhận diện...');

    try {
      // Chạy Tesseract nhận diện Tiếng Việt + Tiếng Anh
      const result = await Tesseract.recognize(
        file,
        'vie+eng',
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              setStatusText('Đang quét từng dòng chữ...');
              setProgress(Math.round(m.progress * 100));
            } else {
              setStatusText('Đang tải dữ liệu ngôn ngữ (chỉ tốn lần đầu)...');
            }
          }
        }
      );
      
      setExtractedText(result.data.text);
    } catch (error) {
      console.error("Lỗi OCR:", error);
      alert("Không thể đọc được chữ từ ảnh này. Vui lòng thử ảnh nét hơn.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleAiSummarize = () => {
    if (!extractedText) return;
    setIsSummarizing(true);

    // TODO: Cắm API AI của bạn vào đây (Ví dụ: Fetch tới Cloudflare Worker gọi Llama-3 hoặc Gemini API)
    // Tạm thời giả lập AI đang đọc và tóm tắt mất 3 giây
    setTimeout(() => {
      setSummaryText(
        "✨ [Bản tóm tắt do AI tạo ra]\n\n" +
        "Tài liệu này đề cập đến các vấn đề chính sau:\n" +
        "- Điểm chính thứ nhất được AI phân tích từ nội dung ảnh.\n" +
        "- Điểm chính thứ hai giúp người đọc nắm bắt nhanh thông tin.\n" +
        "- Kết luận hoặc yêu cầu hành động có trong văn bản.\n\n" +
        "(Lưu ý: Đây là UI Demo, bạn cần kết nối API LLM thật vào hàm handleAiSummarize để AI hoạt động)"
      );
      setIsSummarizing(false);
    }, 3000);
  };

  const handleDownloadTxt = (content, suffix) => {
    if (!content) return;
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: `${file.name}_${suffix}.txt` });
    document.body.appendChild(link); link.click(); link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold text-white mb-3">Trích xuất chữ từ Ảnh (OCR)</h2>
        <p className="text-zinc-400">Dùng công nghệ thị giác máy tính để đọc chữ từ ảnh chụp tài liệu, sách báo, hóa đơn.</p>
      </div>

      <div className="relative group cursor-pointer mb-8">
        <input type="file" accept="image/jpeg, image/png, image/webp" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
        <div className="flex flex-col items-center justify-center p-16 border-2 border-dashed border-zinc-700 rounded-3xl bg-zinc-900/30 group-hover:bg-zinc-800/50 group-hover:border-zinc-500 transition-all">
          <ScanText className="w-12 h-12 text-zinc-500 group-hover:text-zinc-300 mb-4 transition-colors" />
          <span className="text-zinc-300 font-medium">Nhấp hoặc kéo thả Ảnh (JPG, PNG) vào đây</span>
        </div>
      </div>

      {file && !extractedText && (
        <div className="space-y-6">
          <div className="flex items-center gap-4 p-4 bg-zinc-900 border border-zinc-800 rounded-2xl">
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
              <img src={previewUrl} alt="Preview" className="w-full h-full object-cover opacity-80" />
            </div>
            <div className="flex-1">
              <p className="text-zinc-200 font-medium">{file.name}</p>
              <p className="text-sm text-zinc-500">Sẵn sàng phân tích</p>
            </div>
          </div>
          
          <button 
            onClick={extractTextWithOcr} disabled={isExtracting}
            className="w-full flex items-center justify-center gap-2 py-4 bg-white text-black font-semibold rounded-xl hover:bg-zinc-200 disabled:opacity-50 transition-colors"
          >
            {isExtracting ? (
              <><Loader2 className="animate-spin w-5 h-5" /> {statusText} {progress > 0 && `${progress}%`}</>
            ) : (
              <><ScanText size={20} /> Quét chữ ngay</>
            )}
          </button>
        </div>
      )}

      {/* KHU VỰC KẾT QUẢ VÀ TÓM TẮT AI */}
      {extractedText && (
        <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-500">
          
          {/* Cột 1: Chữ gốc */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white flex items-center gap-2">
              <FileImage className="text-emerald-400" size={20} /> Văn bản gốc
            </h3>
            <textarea 
              value={extractedText} 
              onChange={(e) => setExtractedText(e.target.value)} // Cho phép sửa lỗi chính tả
              className="w-full h-80 p-5 bg-zinc-900 border border-zinc-700 rounded-2xl text-zinc-300 font-sans text-sm leading-relaxed focus:outline-none focus:border-zinc-500 resize-none"
            />
            <div className="flex gap-3">
              <button onClick={() => handleDownloadTxt(extractedText, 'goc')} className="flex-1 py-3 bg-zinc-800 text-zinc-300 font-medium rounded-xl hover:bg-zinc-700 transition-colors flex justify-center items-center gap-2">
                <Download size={18} /> Lưu TXT
              </button>
              
              {/* NÚT KÍCH HOẠT AI */}
              <button 
                onClick={handleAiSummarize} 
                disabled={isSummarizing || summaryText}
                className="flex-[2] py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium rounded-xl hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 transition-all flex justify-center items-center gap-2 shadow-lg shadow-purple-900/20"
              >
                {isSummarizing ? <><Loader2 className="animate-spin w-5 h-5" /> AI đang đọc...</> : <><BrainCircuit size={18} /> Tóm tắt bằng AI</>}
              </button>
            </div>
          </div>

          {/* Cột 2: Bản tóm tắt AI (Chỉ hiện khi đã bấm nút) */}
          <div className={`space-y-4 transition-opacity duration-500 ${summaryText || isSummarizing ? 'opacity-100' : 'opacity-0 pointer-events-none hidden lg:block'}`}>
            <h3 className="text-lg font-medium text-white flex items-center gap-2">
              <Sparkles className="text-purple-400" size={20} /> AI Tóm tắt
            </h3>
            <textarea 
              value={summaryText} readOnly
              placeholder={isSummarizing ? "AI đang phân tích các ý chính..." : ""}
              className="w-full h-80 p-5 bg-purple-950/20 border border-purple-900/50 rounded-2xl text-purple-100 font-sans text-sm leading-relaxed focus:outline-none resize-none"
            />
            {summaryText && (
              <button onClick={() => handleDownloadTxt(summaryText, 'tom_tat')} className="w-full py-3 bg-purple-600/20 text-purple-300 border border-purple-500/30 font-medium rounded-xl hover:bg-purple-600/40 transition-colors flex justify-center items-center gap-2">
                <Download size={18} /> Lưu bản tóm tắt
              </button>
            )}
          </div>

        </div>
      )}
    </div>
  );
};

export default OcrToTxt;