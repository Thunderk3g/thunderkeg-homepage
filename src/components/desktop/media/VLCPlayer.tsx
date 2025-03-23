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
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-3 flex justify-between items-center border-b border-gray-700 shadow-md">
        <div className="flex items-center">
          <div className="bg-orange-500 text-white font-bold px-2 py-1 rounded mr-2 shadow-sm">VLC</div>
          <h2 className="text-sm font-medium text-green-400">Media Player</h2>
        </div>
        <div className="flex space-x-3">
          <button className="text-gray-400 hover:text-white hover:bg-gray-800 p-1 rounded transition-colors">
            <Settings size={16} />
          </button>
        </div>
      </div>
      
      {/* Video Player */}
      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          src={currentVideo.url}
          className="w-full h-full object-contain"
          poster={currentVideo.thumbnail}
          onClick={togglePlayPause}
        />
        
        {/* Play/Pause Indicator Overlay */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-black bg-opacity-50 p-5 rounded-full">
              <Play size={40} className="text-white opacity-80" />
            </div>
          </div>
        )}
        
        {/* Big Play/Pause Button on Click (briefly shows) */}
        <div 
          className="absolute inset-0 cursor-pointer flex items-center justify-center"
          onClick={togglePlayPause}
        >
          {showControls && (
            <div className="transform transition-transform duration-200 hover:scale-110">
              {isPlaying ? (
                <div className="opacity-0 hover:opacity-100">
                  <div className="bg-black bg-opacity-50 p-8 rounded-full">
                    <Pause size={32} className="text-white" />
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
        
        {/* Video Controls Overlay */}
        {showControls && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent pt-10 pb-4 px-4 transition-opacity">
            {/* Title */}
            <div className="text-sm font-medium text-green-400 mb-2 flex items-center">
              <div className="w-2 h-2 bg-orange-500 rounded-full mr-2"></div>
              {currentVideo.title}
            </div>
            
            {/* Progress bar */}
            <div className="flex items-center space-x-3 mb-3">
              <span className="text-xs font-mono">{formatTime(currentTime)}</span>
              <div className="relative flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                <div 
                  className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-orange-500 to-orange-400 rounded-full"
                  style={{ width: `${(currentTime / currentVideo.duration) * 100}%` }}
                ></div>
                <input
                  type="range"
                  min="0"
                  max={currentVideo.duration}
                  value={currentTime}
                  onChange={handleSeek}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
              <span className="text-xs font-mono">{formatTime(currentVideo.duration)}</span>
            </div>
            
            {/* Controls */}
            <div className="flex justify-between items-center">
              <div className="flex space-x-6 items-center">
                <button 
                  onClick={handlePreviousVideo}
                  className="text-gray-300 hover:text-white transition-colors focus:outline-none"
                  aria-label="Previous video"
                >
                  <SkipBack size={22} />
                </button>
                
                <button 
                  onClick={togglePlayPause}
                  className="text-white hover:text-orange-400 transition-colors focus:outline-none"
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? 
                    <Pause size={28} className="transform hover:scale-110 transition-transform" /> : 
                    <Play size={28} className="transform hover:scale-110 transition-transform" />
                  }
                </button>
                
                <button 
                  onClick={handleNextVideo}
                  className="text-gray-300 hover:text-white transition-colors focus:outline-none"
                  aria-label="Next video"
                >
                  <SkipForward size={22} />
                </button>
                
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={toggleMute}
                    className="text-gray-300 hover:text-white transition-colors focus:outline-none"
                    aria-label={isMuted ? "Unmute" : "Mute"}
                  >
                    {isMuted ? <VolumeX size={22} /> : <Volume2 size={22} />}
                  </button>
                  
                  <div className="relative w-20 h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div 
                      className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-green-500 to-green-400 rounded-full"
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
              </div>
              
              <button 
                onClick={toggleFullscreen}
                className="text-gray-300 hover:text-white transition-colors focus:outline-none bg-gray-800 bg-opacity-50 p-1.5 rounded-full hover:bg-opacity-80"
                aria-label="Toggle fullscreen"
              >
                <Maximize2 size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Playlist */}
      <div className="h-32 bg-gray-900 overflow-y-auto border-t border-gray-700 shadow-inner">
        <div className="sticky top-0 p-2 text-xs font-medium text-orange-500 bg-gray-900 border-b border-gray-800 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          Playlist
        </div>
        <div className="divide-y divide-gray-800/50">
          {videos.map((video, index) => (
            <div 
              key={video.id}
              onClick={() => {
                setCurrentVideoIndex(index);
                setCurrentTime(0);
                setIsPlaying(true);
              }}
              className={`p-2 flex items-center hover:bg-gray-800 cursor-pointer transition-colors ${
                index === currentVideoIndex 
                  ? 'bg-gradient-to-r from-gray-800 to-gray-900 border-l-2 border-orange-500' 
                  : ''
              }`}
            >
              <div className="w-20 h-12 bg-gray-800 flex-shrink-0 mr-3 rounded-md overflow-hidden shadow-md">
                <img 
                  src={video.thumbnail} 
                  alt={video.title}
                  className="w-full h-full object-cover"
                />
                {index === currentVideoIndex && isPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40">
                    <div className="w-3 h-3 rounded-full bg-orange-500 animate-pulse"></div>
                  </div>
                )}
              </div>
              <div>
                <div className={`text-sm font-medium ${index === currentVideoIndex ? 'text-green-400' : 'text-white'}`}>
                  {video.title}
                </div>
                <div className="text-xs text-gray-400 mt-0.5 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {formatTime(video.duration)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 