'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Gamepad2, Monitor, RefreshCw, ChevronDown } from 'lucide-react';

// Define available DOS games
const DOS_GAMES = [
  { 
    id: 'doom', 
    name: 'DOOM', 
    url: 'https://dos.zone/player/?bundleUrl=https%3A%2F%2Fcdn.dos.zone%2Fcustom%2Fdos%2Fdoom.jsdos&anonymous=1',
    controls: [
      { key: 'Arrows', action: 'Move' },
      { key: 'Ctrl', action: 'Fire' },
      { key: 'Space', action: 'Use / Open Doors' },
      { key: 'Alt+Arrows', action: 'Strafe' },
      { key: '1-9', action: 'Select Weapon' },
      { key: 'Esc', action: 'Menu / Pause' }
    ]
  },
  { 
    id: 'wolf3d', 
    name: 'Wolfenstein 3D', 
    url: 'https://dos.zone/player/?bundleUrl=https%3A%2F%2Fcdn.dos.zone%2Foriginal%2F2X%2F5%2F5159bf1ad3d2a70d3a7b605d719638b0c88ed1c8.jsdos&anonymous=1',
    controls: [
      { key: 'Arrows', action: 'Move' },
      { key: 'Alt', action: 'Strafe' },
      { key: 'Ctrl', action: 'Fire' },
      { key: 'Space', action: 'Open Door' },
      { key: '1-4', action: 'Change Weapon' },
      { key: 'Esc', action: 'Menu' }
    ]
  },
  { 
    id: 'duke3d', 
    name: 'Duke Nukem 3D', 
    url: 'https://dos.zone/player/?bundleUrl=https%3A%2F%2Fcdn.dos.zone%2Fcustom%2Fdos%2Fduke3d.jsdos&anonymous=1',
    controls: [
      { key: 'Arrows', action: 'Move' },
      { key: 'Ctrl', action: 'Fire' },
      { key: 'Space', action: 'Jump/Open' },
      { key: 'Shift', action: 'Run' },
      { key: 'Alt', action: 'Strafe' },
      { key: '1-0', action: 'Weapons' }
    ]
  },
  { 
    id: 'commander', 
    name: 'Commander Keen', 
    url: 'https://dos.zone/player/?bundleUrl=https%3A%2F%2Fcdn.dos.zone%2Fcustom%2Fdos%2Fcommanderkeen4.jsdos&anonymous=1',
    controls: [
      { key: 'Arrows', action: 'Move' },
      { key: 'Ctrl', action: 'Jump' },
      { key: 'Alt', action: 'Pogo' },
      { key: 'Esc', action: 'Menu' }
    ]
  },
  { 
    id: 'prince', 
    name: 'Prince of Persia', 
    url: 'https://dos.zone/player/?bundleUrl=https%3A%2F%2Fcdn.dos.zone%2Fcustom%2Fdos%2Fprinceofpersia.jsdos&anonymous=1',
    controls: [
      { key: 'Arrows', action: 'Move' },
      { key: 'Shift', action: 'Careful Walk' },
      { key: 'Space', action: 'Jump' },
      { key: 'Ctrl', action: 'Grab Ledge' }
    ]
  }
];

interface DOSPlayerProps {
  onClose?: () => void;
}

export default function DOSPlayer({ onClose }: DOSPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedGame, setSelectedGame] = useState(DOS_GAMES[0]);
  const [isGameMenuOpen, setIsGameMenuOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    // When game changes, reset to loading state
    setIsLoading(true);
    setError(null);
  }, [selectedGame]);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleIframeError = () => {
    setError("Failed to load game");
    setIsLoading(false);
  };

  const focusIframe = () => {
    if (iframeRef.current) {
      iframeRef.current.focus();
      setIsFocused(true);
    }
  };

  const handleIframeClick = () => {
    focusIframe();
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
      // Ensure focus after fullscreen toggle
      setTimeout(focusIframe, 100);
    } catch (e) {
      console.error("Error toggling fullscreen:", e);
    }
  };

  const changeGame = (game: typeof DOS_GAMES[0]) => {
    setSelectedGame(game);
    setIsGameMenuOpen(false);
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
        <p className="text-green-500">Loading {selectedGame.name}...</p>
        <p className="text-xs text-gray-400 mt-2">This may take a few moments</p>
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

  const renderFocusMessage = () => (
    <div className={`absolute top-2 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 px-3 py-1 rounded-full transition-opacity duration-300 ${isFocused ? 'opacity-0' : 'opacity-100'}`}>
      <p className="text-xs text-white">Click game to enable keyboard controls</p>
    </div>
  );

  const renderGameSelector = () => (
    <div className="relative">
      <button
        onClick={() => setIsGameMenuOpen(!isGameMenuOpen)}
        className="flex items-center justify-between w-44 px-3 py-1 bg-gray-800 rounded hover:bg-gray-700 transition-colors text-sm"
      >
        <span>{selectedGame.name}</span>
        <ChevronDown size={14} className={`ml-2 transition-transform duration-200 ${isGameMenuOpen ? 'rotate-180' : ''}`} />
      </button>
      {isGameMenuOpen && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-gray-800 rounded shadow-lg overflow-hidden">
          <ul className="max-h-48 overflow-y-auto py-1">
            {DOS_GAMES.map(game => (
              <li key={game.id}>
                <button
                  onClick={() => changeGame(game)}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-700 transition-colors ${game.id === selectedGame.id ? 'bg-gray-700 text-green-400' : ''}`}
                >
                  {game.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white p-4 select-none">
      {error ? renderError() : (
        <>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center space-x-3">
              <h2 className="text-xl font-bold text-green-400 flex items-center">
                <Gamepad2 className="mr-2" size={20} />
                DOS Games
              </h2>
              {renderGameSelector()}
            </div>
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
            {!isLoading && renderFocusMessage()}
            <iframe
              ref={iframeRef}
              src={selectedGame.url}
              className="w-full h-full border-0"
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              onClick={handleIframeClick}
              onMouseDown={handleIframeClick}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              allow="autoplay; fullscreen"
              title={`${selectedGame.name} Game`}
              tabIndex={0}
            ></iframe>
          </div>
          
          <div className="p-2 bg-gray-900 mt-2 rounded border border-gray-800">
            <div className="text-xs text-green-400 mb-2">CONTROLS - {selectedGame.name}</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {selectedGame.controls.map((control, index) => (
                <div key={index} className="flex justify-between">
                  <span className="font-mono bg-gray-800 px-1 rounded">{control.key}</span>
                  <span className="text-gray-400">{control.action}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 text-xs text-gray-500">
              <p>Click on the game window to capture keyboard input. Press Alt+Enter for in-game fullscreen.</p>
              <p className="mt-1">If keys aren't working, try clicking the game again or toggling fullscreen.</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
} 