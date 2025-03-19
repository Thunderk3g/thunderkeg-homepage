'use client';

import React, { useEffect, useRef } from 'react';

interface ParticleBackgroundProps {
  className?: string;
}

const ParticleBackground: React.FC<ParticleBackgroundProps> = ({ className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas dimensions
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Particle properties
    const particlesArray: {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      color: string;
    }[] = [];
    
    // Create particles
    const createParticles = () => {
      const particleCount = Math.min(Math.floor(window.innerWidth / 10), 100);
      
      for (let i = 0; i < particleCount; i++) {
        const size = Math.random() * 3 + 1;
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const speedX = Math.random() * 0.5 - 0.25;
        const speedY = Math.random() * 0.5 - 0.25;
        const color = `rgba(100, 255, 218, ${Math.random() * 0.5 + 0.1})`;
        
        particlesArray.push({
          x,
          y,
          size,
          speedX,
          speedY,
          color
        });
      }
    };
    
    // Update particles
    const updateParticles = () => {
      for (let i = 0; i < particlesArray.length; i++) {
        const p = particlesArray[i];
        
        p.x += p.speedX;
        p.y += p.speedY;
        
        if (p.x > canvas.width) p.x = 0;
        if (p.x < 0) p.x = canvas.width;
        if (p.y > canvas.height) p.y = 0;
        if (p.y < 0) p.y = canvas.height;
      }
    };
    
    // Draw particles
    const drawParticles = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      for (let i = 0; i < particlesArray.length; i++) {
        const p = particlesArray[i];
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }
      
      // Connect particles with lines
      connectParticles();
    };
    
    // Connect nearby particles with lines
    const connectParticles = () => {
      const maxDistance = 100;
      
      for (let i = 0; i < particlesArray.length; i++) {
        for (let j = i; j < particlesArray.length; j++) {
          const p1 = particlesArray[i];
          const p2 = particlesArray[j];
          
          const distance = Math.sqrt(
            Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2)
          );
          
          if (distance < maxDistance) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(100, 255, 218, ${0.1 * (1 - distance / maxDistance)})`;
            ctx.lineWidth = 1;
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }
    };
    
    // Animation loop
    const animate = () => {
      updateParticles();
      drawParticles();
      requestAnimationFrame(animate);
    };
    
    createParticles();
    animate();
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);
  
  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 z-0 ${className}`}
      style={{ pointerEvents: 'none' }}
    />
  );
};

export default ParticleBackground; 