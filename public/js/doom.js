/**
 * JS-Doom Engine
 * 
 * This is a stub implementation of a JavaScript Doom engine interface.
 * In a complete implementation, this would be integrated with a JavaScript port of Doom
 * such as js-doom, DOOM.wasm, or another WebAssembly-based implementation.
 */

(function() {
  // Define the jsDoom constructor function
  window.jsDoom = function(config) {
    console.log('Creating jsDoom instance with config:', config);
    
    // Validate required parameters
    if (!config || !config.canvas) {
      console.error('jsDoom initialization error: Canvas is required');
      throw new Error('Canvas is required for jsDoom initialization');
    }
    
    // Store configuration options
    this.config = config || {};
    this.canvas = config.canvas;
    
    // Validate the canvas
    if (!this.canvas.getContext) {
      console.error('jsDoom initialization error: Invalid canvas element');
      throw new Error('Invalid canvas element');
    }
    
    this.context = this.canvas.getContext('2d');
    if (!this.context) {
      console.error('jsDoom initialization error: Could not get 2d context from canvas');
      throw new Error('Could not get 2d context from canvas');
    }
    
    this.width = config.width || 640;
    this.height = config.height || 400;
    this.wads = config.wads || [];
    this.isMuted = config.muted || false;
    this.running = false;
    
    // Log successful creation
    console.log('jsDoom instance created successfully');
    
    // Initialize the game
    this.init();
    
    // Return the game instance
    return this;
  };
  
  // Define the prototype methods
  window.jsDoom.prototype = {
    // Initialize the game
    init: function() {
      console.log('Initializing JS-Doom engine...');
      try {
        this.setupCanvas();
        this.renderLoadingScreen();
        
        // Simulate loading the WAD files
        console.log('Loading WAD files:', this.wads);
        setTimeout(() => {
          this.renderMenuScreen();
        }, 1500);
      } catch (error) {
        console.error('Error in jsDoom initialization:', error);
        throw error;
      }
    },
    
    // Set up the canvas
    setupCanvas: function() {
      console.log('Setting up canvas with dimensions:', this.width, 'x', this.height);
      try {
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.context.fillStyle = '#000';
        this.context.fillRect(0, 0, this.width, this.height);
      } catch (error) {
        console.error('Error setting up canvas:', error);
        throw new Error('Canvas setup failed: ' + error.message);
      }
    },
    
    // Render the loading screen
    renderLoadingScreen: function() {
      const ctx = this.context;
      
      // Clear the canvas
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, this.width, this.height);
      
      // Draw loading text
      ctx.fillStyle = '#f00';
      ctx.font = '30px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('LOADING DOOM...', this.width / 2, this.height / 2);
    },
    
    // Render the menu screen
    renderMenuScreen: function() {
      const ctx = this.context;
      
      // Clear the canvas
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, this.width, this.height);
      
      // Draw DOOM logo
      ctx.fillStyle = '#f00';
      ctx.font = 'bold 50px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('DOOM', this.width / 2, 100);
      
      // Draw menu options
      ctx.fillStyle = '#fff';
      ctx.font = '20px monospace';
      ctx.fillText('NEW GAME', this.width / 2, 200);
      ctx.fillText('OPTIONS', this.width / 2, 240);
      ctx.fillText('QUIT', this.width / 2, 280);
      
      // Draw selected option indicator
      ctx.fillText('>', this.width / 2 - 80, 200);
      
      // Draw status message
      ctx.font = '14px monospace';
      ctx.fillText('Click inside the game window and use the controls to play', this.width / 2, 350);
    },
    
    // Start the game
    start: function() {
      console.log('Starting JS-Doom engine...');
      this.running = true;
      this.renderGameScreen();
    },
    
    // Resume the game
    resume: function() {
      if (!this.running) {
        console.log('Resuming JS-Doom engine...');
        this.running = true;
        this.renderGameScreen();
      }
    },
    
    // Pause the game
    pause: function() {
      if (this.running) {
        console.log('Pausing JS-Doom engine...');
        this.running = false;
        
        // Draw paused indicator
        const ctx = this.context;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, this.width, this.height);
        
        ctx.fillStyle = '#fff';
        ctx.font = '30px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', this.width / 2, this.height / 2);
      }
    },
    
    // Reset the game
    reset: function() {
      console.log('Resetting JS-Doom engine...');
      this.renderMenuScreen();
    },
    
    // Render the game screen
    renderGameScreen: function() {
      if (!this.running) return;
      
      const ctx = this.context;
      
      // Clear the canvas
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, this.width, this.height);
      
      // Draw a simple 3D-like view
      // This is just a placeholder for the actual game rendering
      
      // Draw ceiling
      ctx.fillStyle = '#333';
      ctx.fillRect(0, 0, this.width, this.height / 2);
      
      // Draw floor
      ctx.fillStyle = '#666';
      ctx.fillRect(0, this.height / 2, this.width, this.height / 2);
      
      // Draw walls
      ctx.fillStyle = '#888';
      ctx.fillRect(this.width / 4, this.height / 4, this.width / 2, this.height / 2);
      
      // Draw weapon
      ctx.fillStyle = '#aaa';
      ctx.fillRect(this.width / 2 - 20, this.height - 80, 40, 80);
      
      // Draw HUD
      this.renderHUD();
    },
    
    // Render the HUD
    renderHUD: function() {
      const ctx = this.context;
      
      // Draw health
      ctx.fillStyle = '#f00';
      ctx.font = '20px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('HEALTH: 100%', 20, this.height - 20);
      
      // Draw armor
      ctx.fillStyle = '#0f0';
      ctx.fillText('ARMOR: 100%', 200, this.height - 20);
      
      // Draw ammo
      ctx.fillStyle = '#ff0';
      ctx.fillText('AMMO: 50', 380, this.height - 20);
      
      // Draw weapon
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'right';
      ctx.fillText('PISTOL', this.width - 20, this.height - 20);
    },
    
    // Mute the game
    mute: function() {
      console.log('Muting JS-Doom engine...');
      this.isMuted = true;
    },
    
    // Unmute the game
    unmute: function() {
      console.log('Unmuting JS-Doom engine...');
      this.isMuted = false;
    },
    
    // Destroy the game instance
    destroy: function() {
      console.log('Destroying JS-Doom engine...');
      this.running = false;
    }
  };
})(); 