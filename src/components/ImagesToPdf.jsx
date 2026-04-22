import React, { useState } from 'react';
import jsPDF from 'jspdf';
import { FileImage, UploadCloud, Loader2, Download, CheckCircle2, Trash2, RefreshCcw } from 'lucide-react';

const ImagesToPdf = () => {
  const [images, setImages] = useState([]);
  const [status, setStatus] = useState(""); // "", "processing", "done"
  const [progress, setProgress] = useState(0);
  const [pdfUrl, setPdfUrl] = useState(null);

  // Xử lý khi người dùng chọn ảnh
  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    // Chỉ lọc lấy các file ảnh
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length > 0) {
      // Nối thêm ảnh mới vào danh sách ảnh cũ (để người dùng có thể chọn nhiều lần)
      setImages(prev => [...prev, ...imageFiles]);
    }
  };

  // Xóa toàn bộ ảnh
  const handleClear = () => {
    setImages([]);
    setStatus("");
    setPdfUrl(null);
    setProgress(0);
  };

  // Hàm chính: Ghép ảnh thành PDF
  const generatePdf = async () => {
    if (images.length === 0) return;
    setStatus("processing");
    setProgress(0);

    try {
      // Khởi tạo file PDF khổ A4 (hướng dọc - portrait)
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < images.length; i++) {
        const file = images[i];
        const imgUrl = URL.createObjectURL(file);

        // Đọc kích thước ảnh thật để tính toán tỷ lệ thu phóng
        const img = new Image();
        img.src = imgUrl;
        await new Promise((resolve) => { img.onload = resolve; });

        // Thuật toán: Thu phóng ảnh vừa vặn vào trang A4 (Fit to Page)
        const imgRatio = img.width / img.height;
        const pageRatio = pageWidth / pageHeight;

        let renderWidth, renderHeight;
        if (imgRatio > pageRatio) {
          // Ảnh bè ngang hơn trang A4 -> Cố định chiều rộng, bóp chiều cao
          renderWidth = pageWidth;
          renderHeight = pageWidth / imgRatio;
        } else {
          // Ảnh thuôn dài hơn trang A4 -> Cố định chiều cao, bóp chiều rộng
          renderHeight = pageHeight;
          renderWidth = pageHeight * imgRatio;
        }

        // Căn giữa ảnh trên trang PDF
        const x = (pageWidth - renderWidth) / 2;
        const y = (pageHeight - renderHeight) / 2;

        // Nếu không phải ảnh đầu tiên thì thêm trang mới
        if (i > 0) pdf.addPage();
        
        // Chèn ảnh vào PDF (jsPDF tự động nhận diện dạng base64/URL)
        pdf.addImage(img, 'JPEG', x, y, renderWidth, renderHeight);

        // Dọn dẹp bộ nhớ RAM cho trình duyệt
        URL.revokeObjectURL(imgUrl);
        
        // Cập nhật thanh tiến trình
        setProgress(Math.round(((i + 1) / images.length) * 100));
      }

      // Xuất file PDF thành Blob URL để tải về
      const pdfBlob = pdf.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      
      setPdfUrl(url);
      setStatus("done");
    } catch (error) {
      console.error("Lỗi tạo PDF:", error);
      alert("Có lỗi xảy ra khi xử lý ảnh. Vui lòng thử lại!");
      setStatus("");
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald-500/20 mb-4">
          Client-side Engine
        </div>
        <h2 className="text-4xl font-black text-white mb-3">Ghép Ảnh thành PDF</h2>
        <p className="text-zinc-400">Gộp 10, 50 hay 100 ảnh thành một tài liệu duy nhất ngay trên trình duyệt, không giới hạn.</p>
      </div>

      <div className="space-y-6">
        {/* Vùng Chọn Ảnh */}
        {status === "" && (
          <div className="relative group">
            <input 
              type="file" 
              accept="image/*" 
              multiple 
              onChange={handleImageSelect} 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
            />
            <div className={`flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-[2rem] transition-all duration-300 ${
              images.length > 0 ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-900/40 group-hover:border-zinc-600'
            }`}>
              <UploadCloud className={`w-12 h-12 mb-3 ${images.length > 0 ? 'text-emerald-400' : 'text-zinc-600'}`} />
              <p className="text-zinc-300 font-medium">
                {images.length > 0 ? `Nhấp để chọn thêm ảnh` : "Kéo thả hoặc chọn nhiều ảnh (JPG, PNG)"}
              </p>
            </div>
          </div>
        )}

        {/* Bảng điều khiển khi đã có ảnh */}
        {images.length > 0 && status === "" && (
          <div className="bg-zinc-900/80 border border-zinc-800 p-6 rounded-3xl space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-zinc-300 font-medium flex items-center gap-2">
                <FileImage className="text-emerald-500" size={20} /> 
                Đã chọn: <span className="text-white font-bold">{images.length} ảnh</span>
              </span>
              <button onClick={handleClear} className="text-red-400 hover:text-red-300 text-sm font-medium flex items-center gap-1 transition-colors">
                <Trash2 size={16} /> Xóa hết
              </button>
            </div>
            
            <button 
              onClick={generatePdf}
              className="w-full py-4 bg-white text-black font-black uppercase tracking-widest text-sm rounded-2xl hover:bg-zinc-200 active:scale-95 transition-all shadow-lg shadow-white/10 flex items-center justify-center gap-2"
            >
              Tạo file PDF ngay
            </button>
          </div>
        )}

        {/* Trạng thái đang xử lý */}
        {status === "processing" && (
          <div className="p-10 border border-zinc-800 bg-zinc-900/50 rounded-[2.5rem] text-center space-y-6">
            <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto" />
            <div>
              <p className="text-white font-bold text-lg">Đang đóng gói PDF...</p>
              <p className="text-zinc-500 text-sm mt-1">Đang xử lý ảnh thứ {Math.round((progress / 100) * images.length)} / {images.length}</p>
            </div>
            {/* Thanh Progress Bar */}
            <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 transition-all duration-300 ease-out" 
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Trạng thái hoàn thành */}
        {status === "done" && (
          <div className="animate-in zoom-in-95 duration-500">
            <div className="p-10 bg-emerald-500/5 border border-emerald-500/20 rounded-[3rem] text-center">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-white mb-2">Gộp ảnh thành công!</h3>
              <p className="text-zinc-400 mb-8 text-sm">Tài liệu gồm {images.length} trang đã sẵn sàng.</p>
              
              <div className="space-y-4">
                <a 
                  href={pdfUrl} 
                  download={`Images_To_PDF_${Date.now()}.pdf`}
                  className="flex items-center justify-center gap-3 py-5 bg-emerald-600 text-white font-black uppercase tracking-widest text-sm rounded-2xl hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/20"
                >
                  <Download size={20} /> Tải file PDF
                </a>
                
                <button 
                  onClick={handleClear}
                  className="flex items-center justify-center gap-2 mx-auto pt-4 text-zinc-500 hover:text-white text-[10px] font-black uppercase tracking-[0.2em] transition-all"
                >
                  <RefreshCcw size={14} /> Gộp bộ ảnh khác
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImagesToPdf;