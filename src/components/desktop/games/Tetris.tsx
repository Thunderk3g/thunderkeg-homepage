'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RotateCcw, Pause, Play } from 'lucide-react';

// Tetris colors matching the theme
const COLORS = [
  'bg-gray-800', // Empty
  'bg-green-500', // I piece
  'bg-blue-500',  // J piece
  'bg-yellow-500', // L piece
  'bg-red-500',   // O piece
  'bg-purple-500', // S piece
  'bg-cyan-500',  // T piece
  'bg-orange-500', // Z piece
];

// Tetris shapes (tetrominos)
const SHAPES = [
  [], // Empty for easier indexing
  [[1, 1, 1, 1]],  // I
  [[2, 0, 0], [2, 2, 2]],  // J
  [[0, 0, 3], [3, 3, 3]],  // L
  [[4, 4], [4, 4]],  // O
  [[0, 5, 5], [5, 5, 0]],  // S
  [[0, 6, 0], [6, 6, 6]],  // T
  [[7, 7, 0], [0, 7, 7]],  // Z
];

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;

interface TetrisProps {
  onClose?: () => void;
}

export default function Tetris({ onClose }: TetrisProps) {
  const [board, setBoard] = useState<number[][]>([]);
  const [currentPiece, setCurrentPiece] = useState({ shape: 0, x: 0, y: 0, rotation: 0 });
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState(800);
  const [nextPiece, setNextPiece] = useState(Math.floor(Math.random() * 7) + 1);

  // Initialize the board
  useEffect(() => {
    const newBoard = Array(BOARD_HEIGHT).fill(0).map(() => Array(BOARD_WIDTH).fill(0));
    setBoard(newBoard);
    spawnPiece();
  }, []);

  // Get rotated piece
  const getRotatedPiece = useCallback((piece: number[][], rotation: number) => {
    let rotatedPiece = [...piece];
    for (let i = 0; i < rotation; i++) {
      const rows = rotatedPiece.length;
      const cols = rotatedPiece[0].length;
      const newPiece = Array(cols).fill(0).map(() => Array(rows).fill(0));
      
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          newPiece[c][rows - 1 - r] = rotatedPiece[r][c];
        }
      }
      rotatedPiece = newPiece;
    }
    return rotatedPiece;
  }, []);

  // Check if move is valid
  const isValidMove = useCallback((shape: number, x: number, y: number, rotation: number) => {
    const piece = getRotatedPiece(SHAPES[shape], rotation);
    const rows = piece.length;
    const cols = piece[0].length;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (piece[r][c] !== 0) {
          const newX = x + c;
          const newY = y + r;
          
          // Check boundaries
          if (newX < 0 || newX >= BOARD_WIDTH || newY < 0 || newY >= BOARD_HEIGHT) {
            return false;
          }
          
          // Check collision with existing pieces
          if (newY >= 0 && board[newY][newX] !== 0) {
            return false;
          }
        }
      }
    }
    return true;
  }, [board, getRotatedPiece]);

  // Spawn a new piece
  const spawnPiece = useCallback(() => {
    const shape = nextPiece;
    const rotation = 0;
    const width = SHAPES[shape][0].length;
    const x = Math.floor((BOARD_WIDTH - width) / 2);
    const y = 0;

    setCurrentPiece({ shape, x, y, rotation });
    setNextPiece(Math.floor(Math.random() * 7) + 1);

    if (!isValidMove(shape, x, y, rotation)) {
      setGameOver(true);
    }
  }, [nextPiece, isValidMove]);

  // Place the current piece on the board
  const placePiece = useCallback(() => {
    const { shape, x, y, rotation } = currentPiece;
    const piece = getRotatedPiece(SHAPES[shape], rotation);
    const newBoard = [...board.map(row => [...row])];
    const rows = piece.length;
    const cols = piece[0].length;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (piece[r][c] !== 0) {
          newBoard[y + r][x + c] = piece[r][c];
        }
      }
    }

    // Check for completed rows
    let clearedRows = 0;
    const finalBoard = newBoard.filter(row => {
      const isComplete = row.every(cell => cell !== 0);
      if (isComplete) clearedRows++;
      return !isComplete;
    });

    // Add empty rows at the top
    for (let i = 0; i < clearedRows; i++) {
      finalBoard.unshift(Array(BOARD_WIDTH).fill(0));
    }

    setBoard(finalBoard);
    setScore(prevScore => prevScore + (clearedRows * 100));
    
    // Increase speed every 500 points
    if (score % 500 === 0 && score > 0 && speed > 200) {
      setSpeed(prevSpeed => prevSpeed - 50);
    }

    spawnPiece();
  }, [board, currentPiece, getRotatedPiece, score, speed, spawnPiece]);

  // Move the piece down
  const moveDown = useCallback(() => {
    if (gameOver || isPaused) return;
    
    const { shape, x, y, rotation } = currentPiece;
    
    if (isValidMove(shape, x, y + 1, rotation)) {
      setCurrentPiece(prev => ({ ...prev, y: prev.y + 1 }));
    } else {
      placePiece();
    }
  }, [currentPiece, gameOver, isPaused, isValidMove, placePiece]);

  // Game loop
  useEffect(() => {
    if (gameOver || isPaused) return;
    
    const intervalId = setInterval(moveDown, speed);
    return () => clearInterval(intervalId);
  }, [moveDown, speed, gameOver, isPaused]);

  // Handle keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameOver || isPaused) return;
      
      const { shape, x, y, rotation } = currentPiece;
      
      switch (e.key) {
        case 'ArrowLeft':
          if (isValidMove(shape, x - 1, y, rotation)) {
            setCurrentPiece(prev => ({ ...prev, x: prev.x - 1 }));
          }
          break;
        case 'ArrowRight':
          if (isValidMove(shape, x + 1, y, rotation)) {
            setCurrentPiece(prev => ({ ...prev, x: prev.x + 1 }));
          }
          break;
        case 'ArrowDown':
          moveDown();
          break;
        case 'ArrowUp':
          const newRotation = (rotation + 1) % 4;
          if (isValidMove(shape, x, y, newRotation)) {
            setCurrentPiece(prev => ({ ...prev, rotation: newRotation }));
          }
          break;
        case ' ':
          // Hard drop
          let newY = y;
          while (isValidMove(shape, x, newY + 1, rotation)) {
            newY++;
          }
          setCurrentPiece(prev => ({ ...prev, y: newY }));
          placePiece();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPiece, gameOver, isPaused, isValidMove, moveDown, placePiece]);

  // Restart game
  const resetGame = () => {
    const newBoard = Array(BOARD_HEIGHT).fill(0).map(() => Array(BOARD_WIDTH).fill(0));
    setBoard(newBoard);
    setScore(0);
    setGameOver(false);
    setSpeed(800);
    setNextPiece(Math.floor(Math.random() * 7) + 1);
    spawnPiece();
  };

  // Toggle pause
  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  // Render the current piece on the board
  const renderBoard = () => {
    const displayBoard = [...board.map(row => [...row])];
    
    if (!gameOver && !isPaused) {
      const { shape, x, y, rotation } = currentPiece;
      const piece = getRotatedPiece(SHAPES[shape], rotation);
      const rows = piece.length;
      const cols = piece[0].length;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (piece[r][c] !== 0 && y + r >= 0 && y + r < BOARD_HEIGHT && x + c >= 0 && x + c < BOARD_WIDTH) {
            displayBoard[y + r][x + c] = piece[r][c];
          }
        }
      }
    }

    return (
      <div className="grid grid-cols-10 gap-px bg-gray-900 border border-gray-700 rounded">
        {displayBoard.map((row, rowIndex) => 
          row.map((cell, cellIndex) => (
            <div 
              key={`${rowIndex}-${cellIndex}`}
              className={`w-5 h-5 ${COLORS[cell] || 'bg-gray-800'}`}
            />
          ))
        )}
      </div>
    );
  };

  // Render the next piece
  const renderNextPiece = () => {
    const piece = SHAPES[nextPiece];
    const rows = piece.length;
    const cols = piece[0].length;
    const grid = Array(4).fill(0).map(() => Array(4).fill(0));

    // Center the piece in the preview
    const offsetX = Math.floor((4 - cols) / 2);
    const offsetY = Math.floor((4 - rows) / 2);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (piece[r][c] !== 0) {
          grid[offsetY + r][offsetX + c] = piece[r][c];
        }
      }
    }

    return (
      <div className="grid grid-cols-4 gap-px bg-gray-900 border border-gray-700 rounded">
        {grid.map((row, rowIndex) => 
          row.map((cell, cellIndex) => (
            <div 
              key={`next-${rowIndex}-${cellIndex}`}
              className={`w-4 h-4 ${COLORS[cell] || 'bg-gray-800'}`}
            />
          ))
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white p-4 select-none">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-green-400">Tetris</h2>
        <div className="flex space-x-2">
          <button 
            onClick={togglePause} 
            className="p-1 bg-gray-800 hover:bg-gray-700 rounded text-cyan-400"
          >
            {isPaused ? <Play size={18} /> : <Pause size={18} />}
          </button>
          <button 
            onClick={resetGame}
            className="p-1 bg-gray-800 hover:bg-gray-700 rounded text-cyan-400"
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </div>
      
      <div className="flex flex-1">
        <div className="flex-1">{renderBoard()}</div>
        <div className="w-24 ml-4 space-y-4">
          <div>
            <div className="text-xs text-gray-400 mb-1">NEXT</div>
            {renderNextPiece()}
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">SCORE</div>
            <div className="font-mono text-lg text-green-400">{score}</div>
          </div>
          <div className="border border-gray-700 rounded p-2 bg-gray-900">
            <div className="text-xs text-gray-400">CONTROLS</div>
            <div className="text-xs mt-1">
              <div>← → : Move</div>
              <div>↑ : Rotate</div>
              <div>↓ : Soft Drop</div>
              <div>Space : Hard Drop</div>
            </div>
          </div>
        </div>
      </div>
      
      {gameOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70">
          <div className="bg-gray-800 p-6 rounded-lg text-center">
            <h3 className="text-xl font-bold text-red-500 mb-2">Game Over</h3>
            <p className="mb-4">Your score: {score}</p>
            <button 
              onClick={resetGame}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white"
            >
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 