'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume, Volume1, Volume2, VolumeX } from 'lucide-react';

// Sample tracks for the MP3 player
const SAMPLE_TRACKS = [
  {
    id: 1,
    title: "Digital Dreams",
    artist: "Tech Beats",
    duration: 184, // in seconds
    url: "/audio/sample1.mp3" 
  },
  {
    id: 2,
    title: "Cyber Rhythm",
    artist: "Neural Network",
    duration: 215, 
    url: "/audio/sample2.mp3"
  },
  {
    id: 3,
    title: "Hacker's Anthem",
    artist: "Code Raiders",
    duration: 172,
    url: "/audio/sample3.mp3"
  },
  {
    id: 4,
    title: "Terminal Grooves",
    artist: "Bash Beats",
    duration: 198,
    url: "/audio/sample4.mp3"
  },
  {
    id: 5,
    title: "Command Line",
    artist: "Kernel Panic",
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
      <div className="bg-gray-900 p-3 border-b border-gray-800">
        <h2 className="text-xl font-bold text-green-400">MP3 Player</h2>
      </div>
      
      {/* Cover Art */}
      <div className="p-4 flex justify-center">
        <div className="w-48 h-48 bg-gray-800 rounded-lg flex items-center justify-center">
          <div className="text-5xl text-gray-600">♪</div>
        </div>
      </div>
      
      {/* Track Info */}
      <div className="px-4 text-center mb-4">
        <h3 className="text-lg font-semibold text-green-400">{currentTrack.title}</h3>
        <p className="text-sm text-gray-400">{currentTrack.artist}</p>
      </div>
      
      {/* Progress Bar */}
      <div className="px-4 mb-4">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(currentTrack.duration)}</span>
        </div>
        <input
          type="range"
          min="0"
          max={currentTrack.duration}
          value={currentTime}
          onChange={handleTimeChange}
          onMouseDown={() => setIsDraggingSeeker(true)}
          onMouseUp={() => setIsDraggingSeeker(false)}
          className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
        />
      </div>
      
      {/* Controls */}
      <div className="px-4 flex justify-center items-center space-x-6 mb-6">
        <button 
          onClick={handlePreviousTrack} 
          className="p-2 rounded-full text-gray-300 hover:bg-gray-800"
        >
          <SkipBack size={24} />
        </button>
        <button 
          onClick={togglePlayPause} 
          className="p-3 bg-green-600 hover:bg-green-700 rounded-full text-white"
        >
          {isPlaying ? <Pause size={24} /> : <Play size={24} />}
        </button>
        <button 
          onClick={handleNextTrack} 
          className="p-2 rounded-full text-gray-300 hover:bg-gray-800"
        >
          <SkipForward size={24} />
        </button>
      </div>
      
      {/* Volume Control */}
      <div className="px-4 flex items-center space-x-2 mb-6">
        <button 
          onClick={toggleMute} 
          className="p-1 rounded text-gray-300 hover:bg-gray-800"
        >
          {getVolumeIcon()}
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={handleVolumeChange}
          className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
        />
      </div>
      
      {/* Playlist */}
      <div className="flex-1 overflow-y-auto border-t border-gray-800">
        <div className="p-2 text-sm text-gray-400">Playlist</div>
        <div className="divide-y divide-gray-800">
          {tracks.map((track, index) => (
            <div 
              key={track.id}
              onClick={() => handleTrackSelect(index)}
              className={`p-3 hover:bg-gray-800 cursor-pointer ${
                index === currentTrackIndex ? 'bg-gray-800 border-l-2 border-green-400' : ''
              }`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <div className={`text-sm ${index === currentTrackIndex ? 'text-green-400' : 'text-white'}`}>
                    {track.title}
                  </div>
                  <div className="text-xs text-gray-400">{track.artist}</div>
                </div>
                <div className="text-xs text-gray-500">{formatTime(track.duration)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 