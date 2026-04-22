import React, { useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { UploadCloud, FileText, Download, Loader2, FileDown } from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const PdfToTxt = () => {
  const [file, setFile] = useState(null);
  const [extractedText, setExtractedText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileUpload = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile?.type === 'application/pdf') {
      setFile(selectedFile); setExtractedText(''); setProgress(0);
    } else {
      alert("Vui lòng chọn đúng file PDF!");
    }
  };

  const extractTextFromPdf = async () => {
    if (!file) return;
    setIsExtracting(true); setProgress(0);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += `--- Trang ${i} ---\n` + textContent.items.map(item => item.str).join(' ') + '\n\n';
        setProgress(Math.round((i / pdf.numPages) * 100));
      }
      setExtractedText(fullText);
    } catch (error) {
      alert("File PDF này không thể trích xuất chữ.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleDownloadTxt = () => {
    if (!extractedText) return;
    const url = URL.createObjectURL(new Blob([extractedText], { type: 'text/plain;charset=utf-8' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: `${file.name}.txt` });
    document.body.appendChild(link); link.click(); link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold text-white mb-3">PDF sang TXT</h2>
        <p className="text-zinc-400">Trích xuất văn bản từ tài liệu PDF siêu tốc ngay trên trình duyệt.</p>
      </div>

      <div className="relative group cursor-pointer mb-8">
        <input type="file" accept=".pdf" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
        <div className="flex flex-col items-center justify-center p-16 border-2 border-dashed border-zinc-700 rounded-3xl bg-zinc-900/30 group-hover:bg-zinc-800/50 group-hover:border-zinc-500 transition-all">
          <FileDown className="w-12 h-12 text-zinc-500 group-hover:text-zinc-300 mb-4 transition-colors" />
          <span className="text-zinc-300 font-medium">Kéo thả file PDF vào đây</span>
        </div>
      </div>

      {file && !extractedText && (
        <div className="space-y-6">
          <div className="flex items-center gap-4 p-4 bg-zinc-900 border border-zinc-800 rounded-2xl">
            <div className="p-3 bg-zinc-800 rounded-xl text-zinc-400"><FileText size={24} /></div>
            <div className="flex-1"><p className="text-zinc-200 font-medium">{file.name}</p></div>
          </div>
          <button 
            onClick={extractTextFromPdf} disabled={isExtracting}
            className="w-full flex items-center justify-center gap-2 py-4 bg-white text-black font-semibold rounded-xl hover:bg-zinc-200 disabled:opacity-50 transition-colors"
          >
            {isExtracting ? <><Loader2 className="animate-spin w-5 h-5" /> Đang quét trang... {progress}%</> : 'Bắt đầu trích xuất'}
          </button>
        </div>
      )}

      {extractedText && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="p-4 bg-emerald-950/30 border border-emerald-900/50 text-emerald-400 rounded-xl text-center font-medium">
            ✨ Trích xuất hoàn tất!
          </div>
          <textarea 
            value={extractedText} readOnly
            className="w-full h-64 p-5 bg-zinc-900 border border-zinc-700 rounded-2xl text-zinc-300 font-mono text-sm leading-relaxed focus:outline-none focus:border-zinc-500 resize-y"
          />
          <button onClick={handleDownloadTxt} className="w-full flex items-center justify-center gap-2 py-4 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-500 transition-colors">
            <Download size={20} /> Tải file .TXT
          </button>
        </div>
      )}
    </div>
  );
};

export default PdfToTxt;