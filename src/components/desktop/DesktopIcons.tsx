'use client';

import React, { useState, useEffect } from 'react';
import { Terminal, File, User, Info, Code, Link, Folder, Volume2, Music, Film, Gamepad2 } from 'lucide-react';

interface DesktopIcon {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  position?: { gridRow: number; gridColumn: number };
  role?: 'both' | 'recruiter' | 'collaborator'; // Which user role can see this icon
}

interface DesktopIconsProps {
  onOpenTerminal: () => void;
  onOpenResume: () => void;
  onOpenAbout: () => void;
  onOpenProjects: () => void;
  onOpenSocialLinks: () => void;
  onOpenJarvis: () => void;
  onOpenDoom?: () => void;
  onOpenMP3Player?: () => void;
  onOpenVLCPlayer?: () => void;
  userRole: 'recruiter' | 'collaborator' | null;
}

const DesktopIcons: React.FC<DesktopIconsProps> = ({
  onOpenTerminal,
  onOpenResume,
  onOpenAbout,
  onOpenProjects,
  onOpenSocialLinks,
  onOpenJarvis,
  onOpenDoom,
  onOpenMP3Player,
  onOpenVLCPlayer,
  userRole
}) => {
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
  
  // Define desktop icons with specific grid positions and role requirements
  const icons: DesktopIcon[] = [
    {
      id: 'terminal',
      label: 'Terminal',
      icon: <Terminal className="w-8 h-8 text-green-400" />,
      action: onOpenTerminal,
      position: { gridRow: 1, gridColumn: 1 },
      role: 'both'
    },
    {
      id: 'resume',
      label: 'Resume',
      icon: <File className="w-8 h-8 text-blue-400" />,
      action: onOpenResume,
      position: { gridRow: 2, gridColumn: 1 },
      role: 'both'
    },
    {
      id: 'about',
      label: 'About Me',
      icon: <User className="w-8 h-8 text-purple-400" />,
      action: onOpenAbout,
      position: { gridRow: 3, gridColumn: 1 },
      role: 'both'
    },
    {
      id: 'projects',
      label: 'Projects',
      icon: <Code className="w-8 h-8 text-yellow-400" />,
      action: onOpenProjects,
      position: { gridRow: 4, gridColumn: 1 },
      role: 'both'
    },
    {
      id: 'social',
      label: 'Social Links',
      icon: <Link className="w-8 h-8 text-red-400" />,
      action: onOpenSocialLinks,
      position: { gridRow: 5, gridColumn: 1 },
      role: 'both'
    },
    {
      id: 'jarvis',
      label: 'Jarvis',
      icon: <Volume2 className="w-8 h-8 text-cyan-400" />,
      action: onOpenJarvis,
      position: { gridRow: 6, gridColumn: 1 },
      role: 'both'
    },
    {
      id: 'documents',
      label: 'Documents',
      icon: <Folder className="w-8 h-8 text-yellow-300" />,
      action: () => {}, // Placeholder for future functionality
      position: { gridRow: 7, gridColumn: 1 },
      role: 'both'
    },
    {
      id: 'doom',
      label: 'Doom',
      icon: <Gamepad2 className="w-8 h-8 text-green-300" />,
      action: onOpenDoom || (() => {}),
      position: { gridRow: 1, gridColumn: 2 },
      role: 'collaborator'
    },
    {
      id: 'mp3player',
      label: 'MP3 Player',
      icon: <Music className="w-8 h-8 text-pink-400" />,
      action: onOpenMP3Player || (() => {}),
      position: { gridRow: 2, gridColumn: 2 },
      role: 'collaborator'
    },
    {
      id: 'vlcplayer',
      label: 'VLC Player',
      icon: <Film className="w-8 h-8 text-orange-400" />,
      action: onOpenVLCPlayer || (() => {}),
      position: { gridRow: 3, gridColumn: 2 },
      role: 'collaborator'
    }
  ];
  
  // Handle icon click
  const handleIconClick = (iconId: string, action: () => void) => {
    setSelectedIcon(iconId);
    // Don't trigger action on single click, wait for double click
  };
  
  // Handle icon double-click
  const handleIconDoubleClick = (action: () => void) => {
    action();
    setSelectedIcon(null);
  };
  
  // Handle click outside to deselect
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.desktop-icon')) {
        setSelectedIcon(null);
      }
    };
    
    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, []);
  
  // Handle context menu
  const handleContextMenu = (e: React.MouseEvent, iconId: string) => {
    e.preventDefault();
    // Future implementation for right-click menu
  };
  
  // Filter icons based on user role
  const filteredIcons = icons.filter(icon => {
    if (!icon.role || icon.role === 'both') return true;
    return userRole === icon.role;
  });
  
  return (
    <div className="desktop-icons-grid absolute left-0 top-0 grid grid-cols-12 gap-1 p-2 pointer-events-none">
      {filteredIcons.map((icon) => (
        <div
          key={icon.id}
          className={`desktop-icon col-start-${icon.position?.gridColumn || 1} row-start-${icon.position?.gridRow || 1} w-20 h-24 flex flex-col items-center justify-center p-2 pointer-events-auto cursor-pointer ${
            selectedIcon === icon.id ? 'bg-blue-800 bg-opacity-30 rounded' : ''
          } hover:bg-gray-800 hover:bg-opacity-20 transition-colors duration-100`}
          onClick={() => handleIconClick(icon.id, icon.action)}
          onDoubleClick={() => handleIconDoubleClick(icon.action)}
          onContextMenu={(e) => handleContextMenu(e, icon.id)}
        >
          <div className="w-14 h-14 flex items-center justify-center mb-1 bg-gray-800 bg-opacity-40 rounded-lg p-2">
            {icon.icon}
          </div>
          <span className="text-xs text-center text-white font-medium px-1 py-0.5 rounded bg-black bg-opacity-50 w-full truncate">
            {icon.label}
          </span>
        </div>
      ))}
    </div>
  );
};

export default DesktopIcons; 