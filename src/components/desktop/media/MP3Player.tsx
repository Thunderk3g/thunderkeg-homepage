'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume, Volume1, Volume2, VolumeX } from 'lucide-react';

// Sample tracks for the MP3 player
const SAMPLE_TRACKS = [
  {
    id: 1,
    title: "Synth Voyage",
    artist: "Pixel Collective",
    duration: 184, // in seconds
    url: "/audio/sample1.mp3" 
  },
  {
    id: 2,
    title: "Neural Pathways",
    artist: "Quantum Logic",
    duration: 215, 
    url: "/audio/sample2.mp3"
  },
  {
    id: 3,
    title: "Encrypted Beats",
    artist: "Code Artisans",
    duration: 172,
    url: "/audio/sample3.mp3"
  },
  {
    id: 4,
    title: "Command Sequence",
    artist: "Silicon Wave",
    duration: 198,
    url: "/audio/sample4.mp3"
  },
  {
    id: 5,
    title: "Binary Sunset",
    artist: "Algorithmic",
    duration: 226,
    url: "/audio/sample5.mp3"
  }
];

interface MP3PlayerProps {
  onClose?: () => void;
}

export default function MP3Player({ onClose }: MP3PlayerProps) {
  const [tracks] = useState(SAMPLE_TRACKS);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [isDraggingSeeker, setIsDraggingSeeker] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentTrack = tracks[currentTrackIndex];

  // Initialize audio element
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = volume;
    }
    
    // Update audio src when track changes
    if (currentTrack) {
      audioRef.current.src = currentTrack.url;
      
      if (isPlaying) {
        audioRef.current.play().catch(err => {
          console.error("Error playing audio:", err);
          setIsPlaying(false);
        });
      }
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [currentTrack, volume, isPlaying]);

  // Set up event listeners for audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (!isDraggingSeeker) {
        setCurrentTime(audio.currentTime);
      }
    };

    const handleEnded = () => {
      handleNextTrack();
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [isDraggingSeeker, currentTrackIndex]);

  // Play/Pause toggle
  const togglePlayPause = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(err => {
        console.error("Error playing audio:", err);
      });
    }
    
    setIsPlaying(!isPlaying);
  };

  // Previous track
  const handlePreviousTrack = () => {
    const newIndex = (currentTrackIndex - 1 + tracks.length) % tracks.length;
    setCurrentTrackIndex(newIndex);
    setCurrentTime(0);
    setIsPlaying(true);
  };

  // Next track
  const handleNextTrack = () => {
    const newIndex = (currentTrackIndex + 1) % tracks.length;
    setCurrentTrackIndex(newIndex);
    setCurrentTime(0);
    setIsPlaying(true);
  };

  // Mute toggle
  const toggleMute = () => {
    if (!audioRef.current) return;
    
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  // Volume change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
      
      if (newVolume === 0) {
        setIsMuted(true);
        audioRef.current.muted = true;
      } else if (isMuted) {
        setIsMuted(false);
        audioRef.current.muted = false;
      }
    }
  };

  // Time change
  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  // Format time for display (e.g., 03:45)
  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Get the appropriate volume icon based on current volume
  const getVolumeIcon = () => {
    if (isMuted || volume === 0) {
      return <VolumeX size={18} />;
    } else if (volume < 0.3) {
      return <Volume size={18} />;
    } else if (volume < 0.7) {
      return <Volume1 size={18} />;
    } else {
      return <Volume2 size={18} />;
    }
  };

  // Track selection
  const handleTrackSelect = (index: number) => {
    setCurrentTrackIndex(index);
    setCurrentTime(0);
    setIsPlaying(true);
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white select-none">
      {/* Player Header */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-4 border-b border-gray-700 flex justify-between items-center">
        <h2 className="text-xl font-bold text-green-400 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
          </svg>
          MP3 Player
        </h2>
      </div>
      
      {/* Cover Art */}
      <div className="p-6 flex justify-center">
        <div className="w-48 h-48 bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg shadow-xl flex items-center justify-center overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 to-blue-500/20 opacity-50"></div>
          <div className="text-6xl text-green-400 drop-shadow-lg z-10">♪</div>
          {isPlaying && (
            <div className="absolute bottom-3 right-3 flex space-x-1">
              <div className="w-1 h-3 bg-green-400 animate-pulse"></div>
              <div className="w-1 h-5 bg-green-400 animate-pulse delay-75"></div>
              <div className="w-1 h-4 bg-green-400 animate-pulse delay-150"></div>
              <div className="w-1 h-2 bg-green-400 animate-pulse delay-200"></div>
            </div>
          )}
        </div>
      </div>
      
      {/* Track Info */}
      <div className="px-6 text-center mb-5">
        <h3 className="text-xl font-semibold text-green-400 mb-1">{currentTrack.title}</h3>
        <p className="text-sm text-gray-400 font-medium">{currentTrack.artist}</p>
      </div>
      
      {/* Progress Bar */}
      <div className="px-6 mb-5">
        <div className="flex justify-between text-xs text-gray-400 mb-2">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(currentTrack.duration)}</span>
        </div>
        <div className="relative w-full h-2 bg-gray-800 rounded-full overflow-hidden">
          <div 
            className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-green-500 to-green-400 rounded-full"
            style={{ width: `${(currentTime / currentTrack.duration) * 100}%` }}
          ></div>
          <input
            type="range"
            min="0"
            max={currentTrack.duration}
            value={currentTime}
            onChange={handleTimeChange}
            onMouseDown={() => setIsDraggingSeeker(true)}
            onMouseUp={() => setIsDraggingSeeker(false)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
      </div>
      
      {/* Controls */}
      <div className="px-6 flex justify-center items-center space-x-8 mb-6">
        <button 
          onClick={handlePreviousTrack} 
          className="p-2 rounded-full text-gray-300 hover:text-green-400 hover:bg-gray-800 transition-colors"
          aria-label="Previous track"
        >
          <SkipBack size={24} />
        </button>
        <button 
          onClick={togglePlayPause} 
          className="p-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 rounded-full text-white shadow-lg transition-all transform hover:scale-105"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
        </button>
        <button 
          onClick={handleNextTrack} 
          className="p-2 rounded-full text-gray-300 hover:text-green-400 hover:bg-gray-800 transition-colors"
          aria-label="Next track"
        >
          <SkipForward size={24} />
        </button>
      </div>
      
      {/* Volume Control */}
      <div className="px-6 flex items-center space-x-3 mb-6">
        <button 
          onClick={toggleMute} 
          className="p-1.5 rounded text-gray-300 hover:text-green-400 hover:bg-gray-800 transition-colors"
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {getVolumeIcon()}
        </button>
        <div className="relative w-full h-2 bg-gray-800 rounded-full overflow-hidden">
          <div 
            className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-green-500 to-green-400"
            style={{ width: `${isMuted ? 0 : volume * 100}%` }}
          ></div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            aria-label="Volume control"
          />
        </div>
      </div>
      
      {/* Playlist */}
      <div className="flex-1 overflow-y-auto bg-gray-900/50 rounded-t-lg mx-2">
        <div className="sticky top-0 bg-gradient-to-r from-gray-800 to-gray-900 p-3 text-sm font-medium text-green-400 backdrop-blur-sm border-b border-gray-800 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          Playlist
        </div>
        <div className="divide-y divide-gray-800/50">
          {tracks.map((track, index) => (
            <div 
              key={track.id}
              onClick={() => handleTrackSelect(index)}
              className={`p-3 hover:bg-gray-800/70 cursor-pointer transition-colors ${
                index === currentTrackIndex 
                  ? 'bg-gradient-to-r from-gray-800 to-gray-900 border-l-2 border-green-400' 
                  : ''
              }`}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  {index === currentTrackIndex && isPlaying ? (
                    <div className="flex items-center space-x-0.5 mr-2">
                      <div className="w-0.5 h-2 bg-green-400 animate-pulse"></div>
                      <div className="w-0.5 h-3 bg-green-400 animate-pulse delay-75"></div>
                      <div className="w-0.5 h-1.5 bg-green-400 animate-pulse delay-150"></div>
                    </div>
                  ) : (
                    <div className="w-5 mr-2 text-center text-xs text-gray-500">{index + 1}</div>
                  )}
                  <div>
                    <div className={`text-sm font-medium ${index === currentTrackIndex ? 'text-green-400' : 'text-white'}`}>
                      {track.title}
                    </div>
                    <div className="text-xs text-gray-500">{track.artist}</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500 font-mono">{formatTime(track.duration)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 