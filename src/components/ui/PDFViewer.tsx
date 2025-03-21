'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Search, ZoomIn, ZoomOut } from 'lucide-react';

interface PDFViewerProps {
  pdfUrl: string;
  title?: string;
}

const PDFViewer: React.FC<PDFViewerProps> = ({ pdfUrl, title = 'Resume.pdf' }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [searchText, setSearchText] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  // Handle zoom in
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 25, 200));
  };
  
  // Handle zoom out
  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 25, 50));
  };
  
  // Handle next page
  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };
  
  // Handle previous page
  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };
  
  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real implementation, this would search the PDF content
    console.log(`Searching for: ${searchText}`);
  };
  
  return (
    <div className="flex flex-col h-full bg-gray-100 overflow-hidden">
      {/* PDF toolbar */}
      <div className="bg-gray-200 border-b border-gray-300 flex items-center justify-between p-2">
        <div className="flex items-center space-x-2">
          {/* Page navigation */}
          <button 
            className="p-1 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
          >
            <ChevronLeft size={16} />
          </button>
          
          <div className="text-xs">
            <span>Page </span>
            <span className="font-medium">{currentPage}</span>
            <span> of </span>
            <span className="font-medium">{totalPages}</span>
          </div>
          
          <button 
            className="p-1 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleNextPage}
            disabled={currentPage >= totalPages}
          >
            <ChevronRight size={16} />
          </button>
        </div>
        
        <div className="text-sm font-medium truncate max-w-[200px]">
          {title}
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Search button */}
          <button 
            className={`p-1 rounded ${isSearchOpen ? 'bg-gray-300' : 'hover:bg-gray-300'}`}
            onClick={() => setIsSearchOpen(!isSearchOpen)}
          >
            <Search size={16} />
          </button>
          
          {/* Zoom controls */}
          <button 
            className="p-1 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleZoomOut}
            disabled={zoomLevel <= 50}
          >
            <ZoomOut size={16} />
          </button>
          
          <div className="text-xs font-medium">{zoomLevel}%</div>
          
          <button 
            className="p-1 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleZoomIn}
            disabled={zoomLevel >= 200}
          >
            <ZoomIn size={16} />
          </button>
          
          {/* Download button */}
          <a 
            href={pdfUrl} 
            download
            className="p-1 rounded hover:bg-gray-300"
          >
            <Download size={16} />
          </a>
        </div>
      </div>
      
      {/* Search bar */}
      {isSearchOpen && (
        <div className="bg-gray-200 border-b border-gray-300 p-2">
          <form onSubmit={handleSearch} className="flex items-center space-x-2">
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search in document..."
              className="px-2 py-1 text-xs border border-gray-400 rounded flex-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button 
              type="submit"
              className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Search
            </button>
          </form>
        </div>
      )}
      
      {/* PDF content */}
      <div 
        className="flex-1 overflow-auto flex items-center justify-center bg-gray-700 p-4"
        style={{ 
          background: 'repeating-conic-gradient(#808080 0% 25%, #707070 0% 50%) 50% / 20px 20px' 
        }}
      >
        <div 
          className="bg-white shadow-xl transition-transform duration-200 overflow-hidden"
          style={{ 
            transform: `scale(${zoomLevel / 100})`,
            transformOrigin: 'center',
            width: '800px',
            height: '1100px'
          }}
        >
          <embed
            src={pdfUrl}
            type="application/pdf"
            width="100%"
            height="100%"
            title={title}
            style={{
              border: 'none',
            }}
            onLoad={(e) => {
              // In a real implementation, we would get the total pages from the PDF
              setTotalPages(1); // Default to 1 page
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default PDFViewer; 