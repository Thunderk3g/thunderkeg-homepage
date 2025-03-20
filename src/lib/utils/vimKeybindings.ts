/**
 * Vim-like keybindings for terminal interfaces
 */

import { useCallback, useState } from 'react';

interface VimKeybindingsOptions {
  onEscape?: () => void;
  onInsertMode?: () => void;
  onHistoryUp?: () => void;
  onHistoryDown?: () => void;
  onSearch?: () => void;
  onCommandMode?: (command: string) => void;
  onCommandExecuted?: (command: string) => void;
  enabled?: boolean;
}

export function useVimKeybindings({
  onEscape,
  onInsertMode,
  onHistoryUp,
  onHistoryDown,
  onSearch,
  onCommandMode,
  onCommandExecuted,
  enabled = true,
}: VimKeybindingsOptions) {
  const [vimMode, setVimMode] = useState(enabled);
  const [currentVimCommand, setCurrentVimCommand] = useState<string>('');

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!enabled) return;
    
    // Escape key (exit insert mode)
    if (e.key === 'Escape' && onEscape) {
      e.preventDefault();
      onEscape();
      return;
    }
    
    // 'i' key for insert mode (when not in a field)
    if (e.key === 'i' && 
        !(e.target as HTMLElement).tagName.match(/^(INPUT|TEXTAREA)$/i) &&
        onInsertMode) {
      e.preventDefault();
      onInsertMode();
      return;
    }
    
    // History navigation with j/k or up/down
    if ((e.key === 'k' || e.key === 'ArrowUp') && onHistoryUp) {
      if (e.ctrlKey || !((e.target as HTMLElement).tagName === 'INPUT')) {
        e.preventDefault();
        onHistoryUp();
        return;
      }
    }
    
    if ((e.key === 'j' || e.key === 'ArrowDown') && onHistoryDown) {
      if (e.ctrlKey || !((e.target as HTMLElement).tagName === 'INPUT')) {
        e.preventDefault();
        onHistoryDown();
        return;
      }
    }
    
    // Search with '/'
    if (e.key === '/' && onSearch) {
      e.preventDefault();
      onSearch();
      return;
    }
    
    // Command mode with ':'
    if (e.key === ':' && onCommandMode) {
      e.preventDefault();
      const command = prompt('Enter command:');
      if (command) {
        setCurrentVimCommand(command);
        onCommandMode(command);
        
        // Execute command if handler is provided
        if (onCommandExecuted) {
          onCommandExecuted(command);
        }
      }
      return;
    }
  }, [onEscape, onInsertMode, onHistoryUp, onHistoryDown, onSearch, onCommandMode, onCommandExecuted, enabled]);
  
  return { handleKeyDown, vimMode, setVimMode, currentVimCommand };
} 