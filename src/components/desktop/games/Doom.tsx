'use client';

import React, { useState, useRef } from 'react';
import { Gamepad2, Monitor, RefreshCw } from 'lucide-react';

interface DoomProps {
  onClose?: () => void;
}

export default function Doom({ onClose }: DoomProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleIframeError = () => {
    setError("Failed to load Doom game");
    setIsLoading(false);
  };

  const toggleFullscreen = () => {
    if (!iframeRef.current) return;

    try {
      if (!document.fullscreenElement) {
        iframeRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (e) {
      console.error("Error toggling fullscreen:", e);
    }
  };

  const refreshGame = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.location.reload();
      setIsLoading(true);
      setError(null);
    }
  };

  // Render functions for different states
  const renderLoading = () => (
    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-10">
      <div className="text-center">
        <div className="mb-4">
          <div className="w-12 h-12 border-4 border-gray-700 border-t-green-500 rounded-full animate-spin mx-auto"></div>
        </div>
        <p className="text-green-500">Loading DOOM...</p>
        <p className="text-xs text-gray-400 mt-2">Preparing to rip and tear</p>
      </div>
    </div>
  );
  
  const renderError = () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-center p-4 bg-gray-800 rounded-lg border border-red-500">
        <div className="text-red-500 text-xl mb-2">Error</div>
        <p className="mb-4">{error}</p>
        <button 
          onClick={refreshGame}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white"
        >
          Reload
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white p-4 select-none">
      {error ? renderError() : (
        <>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-green-400 flex items-center">
              <Gamepad2 className="mr-2" size={20} />
              DOOM
            </h2>
            <div className="flex space-x-2">
              <button 
                onClick={refreshGame} 
                className="p-1 bg-gray-800 hover:bg-gray-700 rounded text-cyan-400"
                title="Reload"
              >
                <RefreshCw size={18} />
              </button>
              <button 
                onClick={toggleFullscreen} 
                className="p-1 bg-gray-800 hover:bg-gray-700 rounded text-cyan-400"
                title="Fullscreen"
              >
                <Monitor size={18} />
              </button>
            </div>
          </div>
          
          <div className="relative flex-1 bg-black flex flex-col overflow-hidden rounded-md">
            {isLoading && renderLoading()}
            <iframe
              ref={iframeRef}
              src="https://dos.zone/player/?bundleUrl=https%3A%2F%2Fcdn.dos.zone%2Fcustom%2Fdos%2Fdoom.jsdos&anonymous=1"
              className="w-full h-full border-0"
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              allow="autoplay; fullscreen"
              title="DOOM Game"
            ></iframe>
          </div>
          
          <div className="p-2 bg-gray-900 mt-2 rounded border border-gray-800">
            <div className="text-xs text-green-400 mb-2">CONTROLS</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div className="flex justify-between">
                <span className="font-mono bg-gray-800 px-1 rounded">Arrows</span>
                <span className="text-gray-400">Move</span>
              </div>
              <div className="flex justify-between">
                <span className="font-mono bg-gray-800 px-1 rounded">Ctrl</span>
                <span className="text-gray-400">Fire</span>
              </div>
              <div className="flex justify-between">
                <span className="font-mono bg-gray-800 px-1 rounded">Space</span>
                <span className="text-gray-400">Use / Open Doors</span>
              </div>
              <div className="flex justify-between">
                <span className="font-mono bg-gray-800 px-1 rounded">Alt+Arrows</span>
                <span className="text-gray-400">Strafe</span>
              </div>
              <div className="flex justify-between">
                <span className="font-mono bg-gray-800 px-1 rounded">1-9</span>
                <span className="text-gray-400">Select Weapon</span>
              </div>
              <div className="flex justify-between">
                <span className="font-mono bg-gray-800 px-1 rounded">Esc</span>
                <span className="text-gray-400">Menu / Pause</span>
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Click on the game window to capture keyboard input
            </div>
          </div>
        </>
      )}
    </div>
  );
} 