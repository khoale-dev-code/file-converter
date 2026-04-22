import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { FileArchive, RefreshCw, ChevronLeft, FileSpreadsheet, Scissors } from 'lucide-react';

// Import các trang
import Home from './components/Home';
import CompressImage from './components/CompressImage';
import PdfToTxt from './components/PdfToTxt';
import ExcelToTxtConverter from './components/ExcelToTxtConverter';
import DocToTxt from './components/DocToTxt';
import BackendToolShell from './components/BackendToolShell';
import OcrToTxt from './components/OcrToTxt';
import SplitPdf from './components/SplitPdf';
import ImagesToPdf from './components/ImagesToPdf';
import ImageConverter from './components/Imageconverter';
import SplitDocx from './components/SplitDocx';

// Layout chuẩn iOS (Navigation Bar trong suốt + Kính mờ)
const Layout = ({ children }) => {
  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-blue-500/30 overflow-x-hidden">
      
      {/* Background Gradient giữ nguyên để đồng bộ với Home */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 blur-[120px] rounded-full" />
      </div>

      {/* Tầng hiển thị nội dung chính */}
      <div className="relative z-10 flex flex-col min-h-screen">
        
        {/* iOS Navigation Bar */}
        <header className="sticky top-0 z-50 w-full bg-[#1C1C1E]/70 backdrop-blur-2xl border-b border-white/10 shadow-sm">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
            {/* Nút Back chuẩn Apple (System Blue) */}
            <Link 
              to="/" 
              className="flex items-center gap-1 text-[#007AFF] hover:opacity-80 active:opacity-60 transition-opacity font-medium -ml-2"
            >
              <ChevronLeft size={24} strokeWidth={2.5} />
              <span className="text-[17px] mt-[1px]">Trang chủ</span>
            </Link>
            
            {/* Đệm (Spacer) để cân bằng layout */}
            <div className="w-[100px]"></div>
          </div>
        </header>

        {/* Nội dung trang công cụ */}
        <main className="flex-1 pb-20">
          {children}
        </main>
      </div>
    </div>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Trang chủ không bọc Layout vì nó đã tự có UI riêng */}
        <Route path="/" element={<Home />} />
        
        {/* Các tool Client-side (Hoạt động 100%) */}
        <Route path="/compress-image" element={<Layout><CompressImage /></Layout>} />
        <Route path="/pdf-to-txt" element={<Layout><PdfToTxt /></Layout>} />
        <Route path="/excel-to-txt" element={<Layout><ExcelToTxtConverter /></Layout>} />
        <Route path="/doc-to-txt" element={<Layout><DocToTxt /></Layout>} />
        <Route path="/ocr-to-txt" element={<Layout><OcrToTxt /></Layout>} />
        <Route path="/split-pdf" element={<Layout><SplitPdf /></Layout>} />
        <Route path="/images-to-pdf" element={<Layout><ImagesToPdf /></Layout>} />
        <Route path="/image-converter" element={<Layout><ImageConverter /></Layout>} />
        <Route path="/split-docx" element={<Layout><SplitDocx /></Layout>} />

        {/* Các tool Backend (Chờ Cloudflare) */}
        <Route path="/compress-pdf" element={
          <Layout>
            <BackendToolShell 
              title="Nén PDF" 
              description="Tối ưu hoá dung lượng file PDF mà không làm nhòe chữ." 
              accept=".pdf" 
              icon={FileArchive} 
              expectedAction="Compress PDF"
            />
          </Layout>
        } />
        
        <Route path="/compress-doc" element={
          <Layout>
            <BackendToolShell 
              title="Nén DOCX" 
              description="Giảm kích thước tài liệu Word chứa nhiều hình ảnh." 
              accept=".docx" 
              icon={FileArchive} 
              expectedAction="Compress DOCX"
            />
          </Layout>
        } />

        <Route path="/pdf-to-doc" element={
          <Layout>
            <BackendToolShell 
              title="PDF sang DOCX" 
              description="Chuyển đổi PDF sang Word giữ nguyên định dạng để dễ dàng chỉnh sửa." 
              accept=".pdf" 
              icon={RefreshCw} 
              expectedAction="Convert PDF to DOCX"
            />
          </Layout>
        } />

        <Route path="/doc-to-pdf" element={
          <Layout>
            <BackendToolShell 
              title="DOCX sang PDF" 
              description="Xuất file Word sang định dạng PDF chuẩn để in ấn." 
              accept=".docx" 
              icon={RefreshCw} 
              expectedAction="Convert DOCX to PDF"
            />
          </Layout>
        } />
        
        <Route path="/excel-to-pdf" element={
          <Layout>
            <BackendToolShell 
              title="Excel sang PDF" 
              description="Chuyển đổi bảng tính Excel (.xlsx, .xls) sang định dạng PDF giữ nguyên cột, hàng và màu sắc." 
              accept=".xlsx, .xls" 
              icon={FileSpreadsheet} 
              expectedAction="Convert Excel to PDF"
            />
          </Layout>
        } />
        <Route path="/excel-to-docx" element={
          <Layout>
            <BackendToolShell 
              title="Cắt DOCX" 
              description="Tách file Word theo heading, đoạn hoặc trang." 
              accept=".docx" 
              icon={Scissors} 
              expectedAction="Split DOCX"
            />
          </Layout>
        } />

      </Routes>
    </Router>
  );
}

export default App;