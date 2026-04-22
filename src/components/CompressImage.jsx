import React, { useState } from 'react';
import imageCompression from 'browser-image-compression';
import { UploadCloud, Download, ImageIcon, Loader2 } from 'lucide-react';

const CompressImage = () => {
  const [originalFile, setOriginalFile] = useState(null);
  const [compressedFile, setCompressedFile] = useState(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionRatio, setCompressionRatio] = useState(0);

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setOriginalFile(file);
      setCompressedFile(null);
      setCompressionRatio(0);
    }
  };

  const handleCompress = async () => {
    if (!originalFile) return;
    setIsCompressing(true);
    const options = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true };

    try {
      const compressedBlob = await imageCompression(originalFile, options);
      const file = new File([compressedBlob], `compressed_${originalFile.name}`, { type: compressedBlob.type });
      setCompressedFile(file);
      setCompressionRatio(((1 - (compressedBlob.size / originalFile.size)) * 100).toFixed(1));
    } catch (error) {
      alert("Đã xảy ra lỗi khi nén ảnh!");
    } finally {
      setIsCompressing(false);
    }
  };

  const formatBytes = (bytes) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold text-white mb-3">Nén Ảnh Cinematic</h2>
        <p className="text-zinc-400">Giảm dung lượng nhưng vẫn giữ được chi tiết và màu sắc tốt nhất.</p>
      </div>

      <div className="relative group cursor-pointer">
        <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
        <div className="flex flex-col items-center justify-center p-16 border-2 border-dashed border-zinc-700 rounded-3xl bg-zinc-900/30 group-hover:bg-zinc-800/50 group-hover:border-zinc-500 transition-all">
          <UploadCloud className="w-12 h-12 text-zinc-500 group-hover:text-zinc-300 mb-4 transition-colors" />
          <span className="text-zinc-300 font-medium">Nhấp hoặc kéo thả ảnh vào đây</span>
          <span className="text-sm text-zinc-500 mt-2">Hỗ trợ JPG, PNG, WEBP</span>
        </div>
      </div>

      {originalFile && (
        <div className="mt-8 space-y-6">
          <div className="flex items-center gap-4 p-4 bg-zinc-900 border border-zinc-800 rounded-2xl">
            <div className="p-3 bg-zinc-800 rounded-xl text-zinc-400"><ImageIcon size={24} /></div>
            <div className="flex-1">
              <p className="text-zinc-200 font-medium truncate">{originalFile.name}</p>
              <p className="text-sm text-zinc-500">Bản gốc: {formatBytes(originalFile.size)}</p>
            </div>
          </div>

          <button 
            onClick={handleCompress} disabled={isCompressing || compressedFile}
            className="w-full flex items-center justify-center gap-2 py-4 bg-white text-black font-semibold rounded-xl hover:bg-zinc-200 disabled:opacity-50 transition-colors"
          >
            {isCompressing ? <><Loader2 className="animate-spin w-5 h-5" /> Đang xử lý...</> : 'Bắt đầu nén ảnh'}
          </button>
        </div>
      )}

      {compressedFile && (
        <div className="mt-8 p-6 bg-emerald-950/30 border border-emerald-900/50 rounded-2xl space-y-6">
          <div className="text-center text-emerald-400 font-medium">✨ Đã nén thành công! (Giảm {compressionRatio}%)</div>
          
          <div className="flex items-center gap-4 p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <div className="p-3 bg-emerald-900/50 text-emerald-400 rounded-xl"><Download size={24} /></div>
            <div className="flex-1">
              <p className="text-emerald-100 font-medium truncate">{compressedFile.name}</p>
              <p className="text-sm text-emerald-500/80">Đã nén: {formatBytes(compressedFile.size)}</p>
            </div>
          </div>
          
          <a href={URL.createObjectURL(compressedFile)} download={compressedFile.name} className="w-full flex items-center justify-center py-4 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-500 transition-colors">
            Tải ảnh về máy
          </a>
        </div>
      )}
    </div>
  );
};

export default CompressImage;