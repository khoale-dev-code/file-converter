import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { UploadCloud, FileSpreadsheet, Loader2, FileDown, CheckCircle } from 'lucide-react';

const ExcelToTxtConverter = () => {
  const [files, setFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Xử lý khi chọn nhiều file
  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
  };

  // Hàm phụ trợ đọc file dùng Promise
  const readFileAsArrayBuffer = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve({ fileName: file.name, data: e.target.result });
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  };

  const handleConvertAndMerge = async () => {
    if (files.length === 0) {
      alert('Vui lòng chọn ít nhất một file Excel!');
      return;
    }

    setIsProcessing(true);
    let combinedText = "";

    try {
      for (const file of files) {
        const { fileName, data } = await readFileAsArrayBuffer(file);
        const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });

        // Ghi chú tên file vào trong nội dung TXT để dễ phân biệt
        combinedText += `=== START OF FILE: ${fileName} ===\n`;

        // Duyệt qua tất cả các sheet trong mỗi file
        workbook.SheetNames.forEach((sheetName) => {
          const worksheet = workbook.Sheets[sheetName];
          const txtData = XLSX.utils.sheet_to_csv(worksheet, { FS: '\t' });
          combinedText += `--- Sheet: ${sheetName} ---\n`;
          combinedText += txtData + "\n\n";
        });

        combinedText += `=== END OF FILE: ${fileName} ===\n\n`;
      }

      // Tạo và tải file TXT tổng hợp
      const blob = new Blob([combinedText], { type: 'text/plain;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `merged_data_${new Date().getTime()}.txt`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error("Lỗi khi xử lý file:", error);
      alert("Có lỗi xảy ra trong quá trình chuyển đổi.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold text-white mb-3">Excel sang TXT</h2>
        <p className="text-zinc-400">Gộp và trích xuất dữ liệu từ nhiều file bảng tính sang văn bản thô.</p>
      </div>
      
      {/* Khu vực Upload (Dropzone) */}
      <div className="relative group cursor-pointer mb-8">
        <input 
          type="file" 
          accept=".xlsx, .xls" 
          multiple
          onChange={handleFileChange} 
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <div className="flex flex-col items-center justify-center p-16 border-2 border-dashed border-zinc-700 rounded-3xl bg-zinc-900/30 group-hover:bg-zinc-800/50 group-hover:border-zinc-500 transition-all">
          <UploadCloud className="w-12 h-12 text-zinc-500 group-hover:text-zinc-300 mb-4 transition-colors" />
          <span className="text-zinc-300 font-medium">
            {files.length > 0 ? `Đã chọn ${files.length} file` : "Nhấp hoặc kéo thả tối đa 50 file Excel vào đây"}
          </span>
          <span className="text-sm text-zinc-500 mt-2">Hỗ trợ .XLSX, .XLS</span>
        </div>
      </div>

      {/* Hiển thị danh sách file & Nút xử lý */}
      {files.length > 0 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-2xl">
            <h3 className="text-zinc-200 font-medium mb-4 flex items-center gap-2">
              <FileSpreadsheet size={20} className="text-emerald-500" />
              Danh sách file chờ gộp:
            </h3>
            
            <ul className="space-y-2">
              {files.slice(0, 5).map((f, i) => (
                <li key={i} className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-xl text-sm text-zinc-300">
                  <CheckCircle size={16} className="text-emerald-500" />
                  <span className="truncate">{f.name}</span>
                </li>
              ))}
              {files.length > 5 && (
                <li className="text-sm text-zinc-500 italic pl-2 pt-2">
                  ... và {files.length - 5} file khác
                </li>
              )}
            </ul>
          </div>

          <button 
            onClick={handleConvertAndMerge}
            disabled={isProcessing}
            className="w-full flex items-center justify-center gap-2 py-4 bg-white text-black font-semibold rounded-xl hover:bg-zinc-200 disabled:opacity-50 transition-colors"
          >
            {isProcessing ? (
              <><Loader2 className="animate-spin w-5 h-5" /> Đang xử lý...</>
            ) : (
              <><FileDown size={20} /> Gộp {files.length} file & Tải về .TXT</>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default ExcelToTxtConverter;