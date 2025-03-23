'use client';

import React, { useEffect, useRef, useState } from 'react';
import { RotateCcw, Pause, Play, Volume2, VolumeX } from 'lucide-react';

// Global interface for the jsDoom global variable
declare global {
  interface Window {
    jsDoom: any;
  }
}

interface DoomProps {
  onClose?: () => void;
}

export default function Doom({ onClose }: DoomProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameInstanceRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    let script: HTMLScriptElement | null = null;
    
    const initDoom = () => {
      // Check if script is already loaded
      if (window.jsDoom) {
        startGame();
        return;
      }
      
      // Load the JS-Doom engine
      script = document.createElement('script');
      script.src = '/js/doom.js';
      script.async = true;
      script.onload = () => {
        startGame();
      };
      script.onerror = () => {
        setError('Failed to load the DOOM engine');
        setIsLoading(false);
      };
      document.body.appendChild(script);
    };
    
    const startGame = () => {
      if (!canvasRef.current || !window.jsDoom) {
        setError('Failed to initialize game canvas');
        setIsLoading(false);
        return;
      }
      
      try {
        // Initialize the JS-Doom engine with our canvas
        gameInstanceRef.current = new window.jsDoom({
          canvas: canvasRef.current,
          width: canvasRef.current.width,
          height: canvasRef.current.height,
          wads: ['/doom/DOOM1.WAD.txt'],
          muted: isMuted,
        });
        
        // Start the game paused
        gameInstanceRef.current.pause();
        setIsPlaying(false);
        setIsLoading(false);
      } catch (err) {
        setError(`Error starting Doom: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setIsLoading(false);
      }
    };
    
    initDoom();
    
    // Cleanup function
    return () => {
      if (gameInstanceRef.current) {
        gameInstanceRef.current.destroy();
      }
      if (script && script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);
  
  // Handle play/pause toggle
  const togglePlayPause = () => {
    if (!gameInstanceRef.current) return;
    
    if (isPlaying) {
      gameInstanceRef.current.pause();
    } else {
      gameInstanceRef.current.resume();
    }
    
    setIsPlaying(!isPlaying);
  };
  
  // Handle mute toggle
  const toggleMute = () => {
    if (!gameInstanceRef.current) return;
    
    if (isMuted) {
      gameInstanceRef.current.unmute();
    } else {
      gameInstanceRef.current.mute();
    }
    
    setIsMuted(!isMuted);
  };
  
  // Reset the game
  const resetGame = () => {
    if (!gameInstanceRef.current) return;
    
    gameInstanceRef.current.reset();
    
    if (!isPlaying) {
      gameInstanceRef.current.pause();
    }
  };
  
  // Define instructions for keyboard controls
  const keyboardInstructions = [
    { key: 'W, ↑', action: 'Move Forward' },
    { key: 'S, ↓', action: 'Move Backward' },
    { key: 'A, ←', action: 'Turn Left' },
    { key: 'D, →', action: 'Turn Right' },
    { key: 'Ctrl', action: 'Fire' },
    { key: 'Space', action: 'Use / Open' },
    { key: 'Shift', action: 'Run' },
    { key: '1-8', action: 'Select Weapon' },
  ];
  
  // Render functions for different states
  const renderLoading = () => (
    <div className="flex items-center justify-center h-full">
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
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white"
        >
          Reload
        </button>
      </div>
    </div>
  );
  
  const renderGame = () => (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-green-400">DOOM</h2>
        <div className="flex space-x-2">
          <button 
            onClick={toggleMute} 
            className="p-1 bg-gray-800 hover:bg-gray-700 rounded text-cyan-400"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <button 
            onClick={togglePlayPause} 
            className="p-1 bg-gray-800 hover:bg-gray-700 rounded text-cyan-400"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button 
            onClick={resetGame}
            className="p-1 bg-gray-800 hover:bg-gray-700 rounded text-cyan-400"
            title="Restart"
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </div>
      
      <div className="flex-1 bg-black flex flex-col">
        <canvas 
          ref={canvasRef} 
          className="w-full h-full object-contain"
          width={640}
          height={400}
          tabIndex={1}
        />
      </div>
      
      <div className="p-2 bg-gray-900 mt-2 rounded border border-gray-800">
        <div className="text-xs text-green-400 mb-2">CONTROLS</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          {keyboardInstructions.map((instruction, index) => (
            <div key={index} className="flex justify-between">
              <span className="font-mono bg-gray-800 px-1 rounded">{instruction.key}</span>
              <span className="text-gray-400">{instruction.action}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 text-xs text-gray-500">
          Click on the game window to capture keyboard and mouse input
        </div>
      </div>
    </>
  );

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white p-4 select-none">
      {error ? renderError() : isLoading ? renderLoading() : renderGame()}
    </div>
  );
} 