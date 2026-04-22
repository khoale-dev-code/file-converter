import { useState, useEffect } from "react";

const tools = [
  { id: "compress-img", name: "Nén Ảnh", path: "/compress-image", color: "#007AFF", bg: "from-[#007AFF] to-[#0055D4]", desc: "Giảm dung lượng ảnh nhanh chóng", category: "Hình ảnh",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12h8M12 8v8"/>
      </svg>
    )
  },
  { id: "compress-pdf", name: "Nén PDF", path: "/compress-pdf", color: "#FF3B30", bg: "from-[#FF3B30] to-[#CC1500]", desc: "Tối ưu hóa tệp PDF", category: "PDF",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
        <line x1="9" y1="15" x2="15" y2="15"/>
      </svg>
    )
  },
  { id: "pdf-to-doc", name: "PDF → Word", path: "/pdf-to-doc", color: "#FF9500", bg: "from-[#FF9500] to-[#CC7000]", desc: "Chuyển đổi sang văn bản", category: "Chuyển đổi",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/>
        <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
      </svg>
    )
  },
  { id: "split-pdf", name: "Cắt PDF", path: "/split-pdf", color: "#5856D6", bg: "from-[#5856D6] to-[#3634A3]", desc: "Trích xuất trang từ PDF", category: "PDF",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/>
        <line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/>
      </svg>
    )
  },
  { id: "ocr-to-txt", name: "Scan chữ", path: "/ocr-to-txt", color: "#34C759", bg: "from-[#34C759] to-[#1A9E3E]", desc: "Nhận diện văn bản từ ảnh", category: "Hình ảnh",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <polyline points="4 7 4 4 7 4"/><polyline points="17 4 20 4 20 7"/><polyline points="20 17 20 20 17 20"/>
        <polyline points="7 20 4 20 4 17"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="12" x2="15" y2="12"/>
        <line x1="9" y1="15" x2="13" y2="15"/>
      </svg>
    )
  },
  { id: "img-to-pdf", name: "Ảnh → PDF", path: "/images-to-pdf", color: "#AF52DE", bg: "from-[#AF52DE] to-[#8030B5]", desc: "Gộp nhiều ảnh thành PDF", category: "Chuyển đổi",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
    )
  },
  { id: "image-converter", name: "Đổi đuôi", path: "/image-converter", color: "#FF2D55", bg: "from-[#FF2D55] to-[#CC0033]", desc: "Chuyển định dạng hình ảnh", category: "Hình ảnh",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      </svg>
    )
  },
  { id: "excel-to-pdf", name: "Excel → PDF", path: "/excel-to-pdf", color: "#32ADE6", bg: "from-[#32ADE6] to-[#1085B5]", desc: "Xuất bảng tính sang PDF", category: "Chuyển đổi",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/>
        <line x1="3" y1="15" x2="21" y2="15"/><line x1="12" y1="3" x2="12" y2="21"/>
      </svg>
    )
  },
  { id: "doc-to-txt", name: "Word → TXT", path: "/doc-to-txt", color: "#FFCC00", bg: "from-[#FFCC00] to-[#CC9900]", desc: "Trích xuất văn bản từ DOCX", category: "Chuyển đổi",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
      </svg>
    )
  },
  { id: "split-docx", name: "Cắt DOCX", path: "/split-docx", color: "#FF9500", bg: "from-[#FF9500] to-[#CC6600]", desc: "Tách file Word theo heading", category: "PDF",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
        <polyline points="13 2 13 9 20 9"/><line x1="9" y1="14" x2="15" y2="14"/>
      </svg>
    )
  },
];

const categories = ["Tất cả", "PDF", "Hình ảnh", "Chuyển đổi"];

const navItems = [
  { label: "Trang chủ", active: true, icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )},
  { label: "Lịch sử", active: false, icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  )},
  { label: "Cài đặt", active: false, icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
    </svg>
  )},
];

export default function Home() {
  const [activeCategory, setActiveCategory] = useState("Tất cả");
  const [hoveredTool, setHoveredTool] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const today = new Date().toLocaleDateString("vi-VN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });

  const filtered = tools.filter(t => {
    const matchCat = activeCategory === "Tất cả" || t.category === activeCategory;
    const matchSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.desc.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-sans overflow-x-hidden" 
         style={{ fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-15%] left-[-5%] w-[55%] h-[55%] rounded-full opacity-25"
          style={{ background: "radial-gradient(circle, #007AFF 0%, transparent 70%)", filter: "blur(100px)" }} />
        <div className="absolute bottom-[-10%] right-[-5%] w-[50%] h-[50%] rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #AF52DE 0%, transparent 70%)", filter: "blur(100px)" }} />
        <div className="absolute top-[40%] left-[40%] w-[35%] h-[35%] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #34C759 0%, transparent 70%)", filter: "blur(80px)" }} />
        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
      </div>

      {/* macOS Traffic Lights + Window Chrome */}
      <div className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* macOS Window Frame */}
        <div className="pt-6 pb-2 hidden sm:flex items-center gap-2 mb-2">
          <div className="w-3 h-3 rounded-full bg-[#FF5F57] shadow-[0_0_6px_#FF5F57aa] hover:brightness-110 cursor-pointer transition-all" />
          <div className="w-3 h-3 rounded-full bg-[#FEBC2E] shadow-[0_0_6px_#FEBC2Eaa] hover:brightness-110 cursor-pointer transition-all" />
          <div className="w-3 h-3 rounded-full bg-[#28C840] shadow-[0_0_6px_#28C840aa] hover:brightness-110 cursor-pointer transition-all" />
          <div className="flex-1 mx-4 h-7 rounded-md bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center gap-2 cursor-text px-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 text-white/30">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <span className="text-[11px] text-white/30 tracking-wide">Tìm kiếm công cụ...</span>
          </div>
        </div>

        {/* Main Layout: Sidebar + Content */}
        <div className="flex gap-6 min-h-[calc(100vh-80px)] pb-24 sm:pb-8">
          
          {/* macOS Sidebar */}
          <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 pt-4">
            <div className="sticky top-6 space-y-1">
              
              <div className="mb-5">
                <p className="text-[10px] font-semibold text-white/30 uppercase tracking-[0.15em] px-3 mb-2">Điều hướng</p>
                {navItems.map(item => (
                  <button key={item.label}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 cursor-pointer ${item.active ? "bg-white/10 text-white" : "text-white/50 hover:text-white/80 hover:bg-white/5"}`}>
                    {item.icon}
                    {item.label}
                    {item.active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#007AFF]" />}
                  </button>
                ))}
              </div>

              <div>
                <p className="text-[10px] font-semibold text-white/30 uppercase tracking-[0.15em] px-3 mb-2">Danh mục</p>
                {categories.map(cat => (
                  <button key={cat} onClick={() => setActiveCategory(cat)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 cursor-pointer ${activeCategory === cat ? "bg-[#007AFF]/15 text-[#007AFF]" : "text-white/50 hover:text-white/80 hover:bg-white/5"}`}>
                    <div className={`w-2 h-2 rounded-sm ${activeCategory === cat ? "bg-[#007AFF]" : "bg-white/20"}`} />
                    {cat}
                    {activeCategory === cat && (
                      <span className="ml-auto text-[10px] bg-[#007AFF]/20 text-[#007AFF] rounded-full px-1.5 py-0.5">
                        {cat === "Tất cả" ? tools.length : tools.filter(t => t.category === cat).length}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Storage Widget */}
              <div className="mt-6 mx-1 p-3 rounded-xl bg-white/5 border border-white/8">
                <p className="text-[11px] font-semibold text-white/60 mb-2">Bộ nhớ đã dùng</p>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-1.5">
                  <div className="h-full w-[42%] rounded-full bg-gradient-to-r from-[#007AFF] to-[#5856D6]" />
                </div>
                <p className="text-[10px] text-white/30">4.2 GB / 10 GB</p>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 pt-4 min-w-0">
            
            {/* Header */}
            <div className={`mb-6 transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
              <p className="text-[12px] font-medium text-white/30 uppercase tracking-[0.12em] mb-1">{today}</p>
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div>
                  <h1 className="text-[32px] sm:text-[42px] font-bold tracking-tight text-white leading-tight">
                    Công cụ
                    <span className="ml-3 text-transparent bg-clip-text" 
                      style={{ backgroundImage: "linear-gradient(135deg, #007AFF, #AF52DE)" }}>
                      của bạn
                    </span>
                  </h1>
                  <p className="text-[14px] text-white/40 mt-1 font-light">
                    {filtered.length} công cụ{activeCategory !== "Tất cả" ? ` trong "${activeCategory}"` : ""}
                  </p>
                </div>

                {/* Search bar - mobile/tablet */}
                <div className="relative lg:w-56">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm..."
                    className="w-full bg-white/6 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-[13px] text-white placeholder-white/30 outline-none focus:border-[#007AFF]/50 focus:bg-white/8 transition-all backdrop-blur-md" />
                </div>
              </div>
            </div>

            {/* Category pills — mobile */}
            <div className="flex gap-2 mb-5 overflow-x-auto pb-1 lg:hidden scrollbar-hide">
              {categories.map(cat => (
                <button key={cat} onClick={() => setActiveCategory(cat)}
                  className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-semibold border transition-all duration-200 cursor-pointer ${activeCategory === cat ? "bg-[#007AFF] border-[#007AFF] text-white shadow-lg shadow-[#007AFF]/30" : "border-white/15 text-white/50 hover:border-white/30 hover:text-white/80"}`}>
                  {cat}
                </button>
              ))}
            </div>

            {/* Spotlight / Featured tool */}
            {activeCategory === "Tất cả" && !searchQuery && (
              <div className={`mb-5 transition-all duration-700 delay-100 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
                <div className="relative overflow-hidden rounded-2xl border border-white/10 cursor-pointer group"
                  style={{ background: "linear-gradient(135deg, #007AFF22 0%, #AF52DE22 100%)" }}>
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: "linear-gradient(135deg, #007AFF33 0%, #AF52DE33 100%)" }} />
                  <div className="relative p-5 flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-xl text-white"
                      style={{ background: "linear-gradient(135deg, #007AFF, #0055D4)" }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
                        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                        <polyline points="13 2 13 9 20 9"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#007AFF]">Đề xuất hôm nay</span>
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#FF9500]/20">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#FF9500] animate-pulse" />
                          <span className="text-[9px] font-bold text-[#FF9500]">MỚI</span>
                        </div>
                      </div>
                      <h3 className="text-[16px] font-bold text-white">Nén PDF & Ảnh cùng lúc</h3>
                      <p className="text-[12px] text-white/50 mt-0.5 truncate">Tối ưu toàn bộ tài liệu trong một thao tác duy nhất</p>
                    </div>
                    <div className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center group-hover:border-white/40 group-hover:bg-white/5 transition-all flex-shrink-0">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-white/60 group-hover:text-white transition-colors">
                        <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tools Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {filtered.map((tool, i) => (
                <a href={tool.path} key={tool.id}
                  onMouseEnter={() => setHoveredTool(tool.id)}
                  onMouseLeave={() => setHoveredTool(null)}
                  className={`group block relative transition-all duration-300 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
                  style={{ transitionDelay: `${i * 40 + 200}ms` }}>
                  
                  {/* Card */}
                  <div className={`relative h-full rounded-2xl border border-white/8 overflow-hidden cursor-pointer transition-all duration-300 ${hoveredTool === tool.id ? "border-white/20 shadow-2xl shadow-black/50 -translate-y-1 scale-[1.02]" : ""}`}
                    style={{ background: "rgba(28, 28, 35, 0.7)", backdropFilter: "blur(20px)" }}>
                    
                    {/* Hover glow */}
                    <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`}
                      style={{ background: `radial-gradient(circle at 50% 0%, ${tool.color}18 0%, transparent 70%)` }} />
                    
                    {/* Top accent line */}
                    <div className="absolute top-0 left-0 right-0 h-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{ background: `linear-gradient(90deg, transparent, ${tool.color}80, transparent)` }} />

                    <div className="p-4 flex flex-col h-full">
                      {/* Icon */}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white mb-3 flex-shrink-0 shadow-lg transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-105`}
                        style={{ background: `linear-gradient(135deg, ${tool.color}, ${tool.color}bb)`, boxShadow: `0 4px 15px ${tool.color}40` }}>
                        {tool.icon}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="text-[14px] font-semibold text-white leading-tight mb-1 group-hover:text-white transition-colors">
                          {tool.name}
                        </h3>
                        <p className="text-[11px] text-white/40 leading-snug line-clamp-2">
                          {tool.desc}
                        </p>
                      </div>

                      {/* Category tag + arrow */}
                      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/5">
                        <span className="text-[10px] font-medium text-white/30 uppercase tracking-wider">
                          {tool.category}
                        </span>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 ${hoveredTool === tool.id ? "bg-white/15" : "bg-white/5"}`}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                            className={`w-3 h-3 transition-all duration-300 ${hoveredTool === tool.id ? "text-white translate-x-0.5" : "text-white/30"}`}>
                            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </a>
              ))}

              {/* Empty state */}
              {filtered.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 text-white/30">
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                  </div>
                  <p className="text-[16px] font-semibold text-white/50">Không tìm thấy công cụ</p>
                  <p className="text-[13px] text-white/25 mt-1">Thử tìm kiếm với từ khóa khác</p>
                </div>
              )}
            </div>

            {/* Stats bar */}
            <div className={`mt-8 grid grid-cols-3 gap-3 transition-all duration-700 delay-500 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
              {[["10", "Công cụ"], ["3", "Danh mục"], ["∞", "Miễn phí"]].map(([num, label]) => (
                <div key={label} className="rounded-xl bg-white/4 border border-white/8 p-3 text-center">
                  <p className="text-[22px] font-bold text-white">{num}</p>
                  <p className="text-[11px] text-white/35 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </main>
        </div>
      </div>

      {/* Mobile Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
        <div className="mx-4 mb-4">
          <div className="flex items-center justify-around py-3 px-2 rounded-2xl border border-white/10 shadow-2xl"
            style={{ background: "rgba(20, 20, 28, 0.88)", backdropFilter: "blur(40px)" }}>
            {navItems.map(item => (
              <button key={item.label}
                className={`flex flex-col items-center gap-1 px-4 py-1 rounded-xl transition-all cursor-pointer ${item.active ? "text-[#007AFF]" : "text-white/40 hover:text-white/70"}`}>
                <div className={`transition-transform ${item.active ? "scale-110" : ""}`}>
                  {item.icon}
                </div>
                <span className="text-[10px] font-semibold">{item.label}</span>
                {item.active && <div className="w-1 h-1 rounded-full bg-[#007AFF]" />}
              </button>
            ))}
          </div>
        </div>
      </nav>
    </div>
  );
}