/**
 * Vim-like keybindings for terminal interfaces
 */

import { useCallback } from 'react';

interface VimKeybindingsOptions {
  onEscape?: () => void;
  onInsertMode?: () => void;
  onHistoryUp?: () => void;
  onHistoryDown?: () => void;
  onSearch?: () => void;
  onCommandMode?: (command: string) => void;
}

export function useVimKeybindings({
  onEscape,
  onInsertMode,
  onHistoryUp,
  onHistoryDown,
  onSearch,
  onCommandMode,
}: VimKeybindingsOptions) {
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
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
        onCommandMode(command);
      }
      return;
    }
  }, [onEscape, onInsertMode, onHistoryUp, onHistoryDown, onSearch, onCommandMode]);
  
  return { handleKeyDown };
} 