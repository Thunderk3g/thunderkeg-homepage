'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, VolumeX, Volume2, Maximize2, Settings } from 'lucide-react';

// Sample videos for the VLC player
const SAMPLE_VIDEOS = [
  {
    id: 1,
    title: "Kali Linux Tutorial",
    duration: 360, // in seconds
    url: "/videos/sample1.mp4",
    thumbnail: "/images/video-thumb1.jpg"
  },
  {
    id: 2,
    title: "Ethical Hacking Basics",
    duration: 480,
    url: "/videos/sample2.mp4",
    thumbnail: "/images/video-thumb2.jpg"
  },
  {
    id: 3,
    title: "Network Security Demo",
    duration: 540,
    url: "/videos/sample3.mp4",
    thumbnail: "/images/video-thumb3.jpg"
  }
];

interface VLCPlayerProps {
  onClose?: () => void;
}

export default function VLCPlayer({ onClose }: VLCPlayerProps) {
  const [videos] = useState(SAMPLE_VIDEOS);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<HTMLDivElement | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentVideo = videos[currentVideoIndex];

  // Show/hide controls with timeout
  const resetControlsTimeout = () => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    
    setShowControls(true);
    
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  // Update current time while playing
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handleEnded = () => {
      const nextIndex = (currentVideoIndex + 1) % videos.length;
      setCurrentVideoIndex(nextIndex);
      setCurrentTime(0);
    };
    
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);
    
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
    };
  }, [currentVideoIndex, videos.length]);

  // Effect for handling fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Effect for controlling video playback
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    if (isPlaying) {
      video.play().catch(error => {
        console.error("Error playing video:", error);
        setIsPlaying(false);
      });
    } else {
      video.pause();
    }
    
    // Set volume and mute state
    video.volume = volume;
    video.muted = isMuted;
    
  }, [isPlaying, volume, isMuted, currentVideo]);

  // Toggle play/pause
  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
    resetControlsTimeout();
  };

  // Handle seeking
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
    
    resetControlsTimeout();
  };

  // Toggle mute
  const toggleMute = () => {
    setIsMuted(!isMuted);
    resetControlsTimeout();
  };

  // Handle volume change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    
    if (newVolume === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
    }
    
    resetControlsTimeout();
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!playerRef.current) return;
    
    if (isFullscreen) {
      document.exitFullscreen().catch(err => {
        console.error("Error exiting fullscreen:", err);
      });
    } else {
      playerRef.current.requestFullscreen().catch(err => {
        console.error("Error entering fullscreen:", err);
      });
    }
    
    resetControlsTimeout();
  };

  // Previous video
  const handlePreviousVideo = () => {
    const prevIndex = (currentVideoIndex - 1 + videos.length) % videos.length;
    setCurrentVideoIndex(prevIndex);
    setCurrentTime(0);
    resetControlsTimeout();
  };

  // Next video
  const handleNextVideo = () => {
    const nextIndex = (currentVideoIndex + 1) % videos.length;
    setCurrentVideoIndex(nextIndex);
    setCurrentTime(0);
    resetControlsTimeout();
  };

  // Format time (e.g., 03:45)
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      className="flex flex-col h-full bg-gray-950 text-white"
      ref={playerRef}
      onMouseMove={resetControlsTimeout}
    >
      {/* VLC Header */}
      <div className="bg-gray-900 p-2 flex justify-between items-center border-b border-gray-800">
        <div className="flex items-center">
          <div className="text-orange-500 font-bold mr-2">VLC</div>
          <h2 className="text-sm text-green-400">Media Player</h2>
        </div>
        <div className="flex space-x-2">
          <button className="text-gray-400 hover:text-white">
            <Settings size={16} />
          </button>
        </div>
      </div>
      
      {/* Video Player */}
      <div className="relative flex-1 bg-black flex items-center justify-center">
        <video
          ref={videoRef}
          src={currentVideo.url}
          className="w-full h-full object-contain"
          poster={currentVideo.thumbnail}
          onClick={togglePlayPause}
        />
        
        {/* Overlay for play/pause on click */}
        <div 
          className="absolute inset-0 cursor-pointer"
          onClick={togglePlayPause}
        />
        
        {/* Video Controls Overlay */}
        {showControls && (
          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 p-3 transition-opacity">
            {/* Title */}
            <div className="text-sm text-green-400 mb-1">{currentVideo.title}</div>
            
            {/* Progress bar */}
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-xs">{formatTime(currentTime)}</span>
              <input
                type="range"
                min="0"
                max={currentVideo.duration}
                value={currentTime}
                onChange={handleSeek}
                className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
              <span className="text-xs">{formatTime(currentVideo.duration)}</span>
            </div>
            
            {/* Controls */}
            <div className="flex justify-between items-center">
              <div className="flex space-x-4">
                <button 
                  onClick={handlePreviousVideo}
                  className="text-gray-300 hover:text-white"
                >
                  <SkipBack size={20} />
                </button>
                
                <button 
                  onClick={togglePlayPause}
                  className="text-gray-300 hover:text-white"
                >
                  {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                </button>
                
                <button 
                  onClick={handleNextVideo}
                  className="text-gray-300 hover:text-white"
                >
                  <SkipForward size={20} />
                </button>
                
                <div className="flex items-center space-x-1">
                  <button 
                    onClick={toggleMute}
                    className="text-gray-300 hover:text-white"
                  >
                    {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                  </button>
                  
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="w-16 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                  />
                </div>
              </div>
              
              <button 
                onClick={toggleFullscreen}
                className="text-gray-300 hover:text-white"
              >
                <Maximize2 size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Playlist */}
      <div className="h-28 bg-gray-900 overflow-y-auto border-t border-gray-800">
        <div className="p-1 text-xs text-orange-500 border-b border-gray-800">Playlist</div>
        <div className="divide-y divide-gray-800">
          {videos.map((video, index) => (
            <div 
              key={video.id}
              onClick={() => {
                setCurrentVideoIndex(index);
                setCurrentTime(0);
                setIsPlaying(true);
              }}
              className={`p-2 flex items-center hover:bg-gray-800 cursor-pointer ${
                index === currentVideoIndex ? 'bg-gray-800 border-l-2 border-orange-500' : ''
              }`}
            >
              <div className="w-16 h-9 bg-gray-800 flex-shrink-0 mr-3 rounded overflow-hidden">
                <img 
                  src={video.thumbnail} 
                  alt={video.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <div className={`text-sm ${index === currentVideoIndex ? 'text-green-400' : 'text-white'}`}>
                  {video.title}
                </div>
                <div className="text-xs text-gray-400">{formatTime(video.duration)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 