# Terminal-Themed AI Portfolio

An interactive terminal-style portfolio website featuring AI agents powered by Ollama and RAG. Visitors can engage with terminal-like interfaces to learn about professional background and personal projects through a unique developer-focused experience.

## Features

- **Terminal-Inspired Dark UI**: Vim-like keybindings, command-line interface, and terminal aesthetics
- **Dual AI Agents**: Specialized terminal personas for different audiences
  - **Professional Agent**: Focused on skills, experience, and qualifications
  - **Personal Agent**: Shares information about interests, projects, and collaboration opportunities
  
- **Local AI with Ollama**: Connect to your local Ollama instance for AI completion
- **Ollama Bridge Extension**: Securely connect to local Ollama API from HTTPS sites
- **RAG Integration**: Retrieval Augmented Generation with resume data
- **Vim-Like Experience**: Normal/insert modes, command history, terminal commands

## Tech Stack

- **Frontend**: Next.js, TypeScript, TailwindCSS
- **Animation**: Framer Motion for smooth transitions
- **AI Integration**: Ollama API, RAG implementation
- **Browser Extension**: Chrome/Firefox extension for secure Ollama access
- **UI**: Terminal-inspired components with Vim-like interactions
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- [Ollama](https://ollama.ai/) installed locally
- A language model pulled in Ollama (e.g., `ollama pull llama2`)

### Installation

1. Clone the repository
   ```
   git clone <repository-url>
   cd ai-portfolio
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Set up environment variables
   ```
   cp .env.local.example .env.local
   ```
   Edit `.env.local` to configure your Ollama instance and model.

### Running the Development Server

1. Start your local Ollama server
   ```
   ollama serve
   ```

2. In another terminal, start the Next.js development server
   ```
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) with your browser

## Terminal Commands

The terminal interface supports several commands:
- `help`: Show available commands
- `clear` or `cls`: Clear the terminal
- `switch`: Switch between professional and personal agents
- `about`: Show information about the terminal

## Vim-Like Keybindings

- Press `i` to enter insert mode (type commands)
- Press `Esc` to return to normal mode
- Use up/down arrows to navigate command history

## Customization

To customize this portfolio for your own use:

1. Update the resume data in `src/lib/rag/loader.ts` to reflect your own details
2. Configure the Ollama model in `.env.local`
3. Modify agent prompts in `src/lib/ollama/prompts.ts` to match your communication style
4. Replace social links in `src/app/page.tsx`

## RAG Implementation

The portfolio uses a simple Retrieval Augmented Generation (RAG) approach:
1. Resume data is chunked into sections
2. User queries are matched against relevant sections
3. Matching sections are included in the context sent to Ollama
4. The AI generates responses grounded in your actual resume data

## Deployment

For production deployment, you'll need to:
1. Set up an Ollama instance accessible to your deployed application
2. Configure environment variables on your hosting platform
3. Deploy the Next.js application to Vercel, Netlify, or similar

## Ollama Bridge Extension

This portfolio includes an optional browser extension that allows secure communication between the HTTPS website and your local Ollama API (HTTP). This solves the "mixed content" security restriction in modern browsers.

### Why the Extension is Needed

When accessing the portfolio via HTTPS, browsers block requests to HTTP services (like the local Ollama API) due to security restrictions. The extension creates a secure bridge to enable this communication.

### Using the Extension

1. Install the extension from the Chrome/Firefox store
2. Make sure Ollama is running locally
3. Visit the portfolio website - it will automatically detect and use the extension

For more details about the extension, see [OLLAMA_BRIDGE.md](./OLLAMA_BRIDGE.md).

## License

MIT

## Acknowledgements

- [Ollama](https://ollama.ai/) for local AI capabilities
- [Next.js](https://nextjs.org/) for the application framework
- [TailwindCSS](https://tailwindcss.com/) for styling
- [Framer Motion](https://www.framer.com/motion/) for animations
