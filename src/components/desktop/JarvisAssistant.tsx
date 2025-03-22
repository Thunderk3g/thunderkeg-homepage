import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { sendChatMessage } from '@/lib/ollama/client-helpers';

// Define Web Speech API interfaces
interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
  interpretation: any;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
  length: number;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
}

// Add type declarations for the Web Speech API
declare global {
  interface Window {
    SpeechRecognition?: {
      new(): SpeechRecognition;
    };
    webkitSpeechRecognition?: {
      new(): SpeechRecognition;
    };
  }
}

type SpeechRecognitionErrorEvent = {
  error: string;
  message?: string;
};

type SpeechSynthesisErrorEvent = {
  error: string;
  message?: string;
};

type JarvisStatus = 'idle' | 'listening' | 'processing' | 'speaking';

const JarvisAssistant: React.FC = () => {
  const [status, setStatus] = useState<JarvisStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  
  // Initialize speech recognition and synthesis on component mount
  useEffect(() => {
    // Check if browser supports speech recognition
    if (typeof window !== 'undefined' && 
        ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognitionAPI) {
        recognitionRef.current = new SpeechRecognitionAPI();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = 'en-US';
        
        // Configure speech recognition handlers
        recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
          const transcript = event.results[0][0].transcript;
          setTranscript(transcript);
          processCommand(transcript);
        };
        
        recognitionRef.current.onend = () => {
          if (status === 'listening') {
            setStatus('processing');
          }
        };
        
        recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error('Speech recognition error:', event.error);
          setError(`Recognition error: ${event.error}`);
          setStatus('idle');
        };
      }
    } else {
      setError('Speech recognition is not supported in your browser.');
    }
    
    // Check if browser supports speech synthesis
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = new SpeechSynthesisUtterance();
      
      synthRef.current.onend = () => {
        setStatus('idle');
      };
      
      synthRef.current.onerror = (event: SpeechSynthesisErrorEvent) => {
        console.error('Speech synthesis error:', event.error);
        setError(`Speech synthesis error: ${event.error}`);
        setStatus('idle');
      };
    } else {
      setError('Speech synthesis is not supported in your browser.');
    }
    
    // Clean up on component unmount
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [status]);
  
  // Process voice command using Ollama
  const processCommand = async (command: string) => {
    try {
      setStatus('processing');
      
      const aiResponse = await sendChatMessage([
        { 
          role: 'system', 
          content: 'You are Jarvis, a helpful voice assistant for a Kali Linux desktop. Keep responses brief and clear for voice output. Limit responses to 3 sentences maximum.' 
        },
        { role: 'user', content: command }
      ], 'llama3:latest', 'assistant');
      
      setResponse(aiResponse);
      speakResponse(aiResponse);
    } catch (error) {
      console.error('Error processing command:', error);
      const errorMsg = 'Sorry, I encountered an error processing your request.';
      setResponse(errorMsg);
      speakResponse(errorMsg);
      setError(error instanceof Error ? error.message : 'Unknown error');
    }
  };
  
  // Speak the AI response
  const speakResponse = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && synthRef.current) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      setStatus('speaking');
      synthRef.current.text = text;
      
      // Try to find a good voice
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(voice => 
        voice.name.includes('Male') || voice.name.includes('Daniel')
      );
      
      if (preferredVoice) {
        synthRef.current.voice = preferredVoice;
      }
      
      synthRef.current.rate = 1;
      synthRef.current.pitch = 1;
      
      window.speechSynthesis.speak(synthRef.current);
    } else {
      setStatus('idle');
    }
  };
  
  // Start listening for voice commands
  const startListening = () => {
    if (recognitionRef.current && status === 'idle') {
      setError(null);
      setTranscript('');
      setStatus('listening');
      
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        setError('Error starting speech recognition. Try again.');
        setStatus('idle');
      }
    }
  };
  
  // Stop listening
  const stopListening = () => {
    if (recognitionRef.current && status === 'listening') {
      try {
        recognitionRef.current.stop();
        setStatus('idle');
      } catch (error) {
        console.error('Error stopping speech recognition:', error);
      }
    }
  };
  
  return (
    <div className="flex flex-col h-full bg-gray-900 text-white p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-cyan-400">Jarvis Assistant</h2>
        <div className="flex space-x-2">
          {status === 'idle' ? (
            <button
              className="p-2 bg-gray-700 rounded-full hover:bg-gray-600 text-cyan-400"
              onClick={startListening}
            >
              <Mic size={24} />
            </button>
          ) : status === 'listening' ? (
            <button
              className="p-2 bg-red-700 rounded-full hover:bg-red-600 text-white animate-pulse"
              onClick={stopListening}
            >
              <MicOff size={24} />
            </button>
          ) : (
            <div className="p-2 bg-gray-700 rounded-full">
              {status === 'processing' ? (
                <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Volume2 size={24} className="text-cyan-400 animate-pulse" />
              )}
            </div>
          )}
        </div>
      </div>
      
      {error && (
        <div className="mb-4 p-3 bg-red-900 bg-opacity-50 rounded">
          <p className="text-red-300">{error}</p>
        </div>
      )}
      
      {transcript && (
        <div className="mb-4 p-3 bg-gray-800 rounded">
          <p className="text-sm text-gray-400">You said:</p>
          <p className="text-cyan-400">{transcript}</p>
        </div>
      )}
      
      {response && (
        <div className="p-3 bg-gray-800 rounded flex items-start">
          {status === 'speaking' && (
            <Volume2 size={18} className="text-cyan-400 mr-2 mt-1 animate-pulse flex-shrink-0" />
          )}
          <div>
            <p className="text-sm text-gray-400">Jarvis:</p>
            <p className="text-white">{response}</p>
          </div>
        </div>
      )}
      
      <div className="mt-auto p-3 bg-gray-800 bg-opacity-50 rounded text-sm text-gray-400">
        <p className="mb-1">Try saying:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>"Tell me about this system"</li>
          <li>"What time is it?"</li>
          <li>"What can you do?"</li>
          <li>"Open Terminal"</li>
        </ul>
      </div>
    </div>
  );
};

export default JarvisAssistant; 