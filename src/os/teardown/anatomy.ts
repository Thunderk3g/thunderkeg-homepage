/**
 * Teardown anatomy: what each layer of the stack is, read three ways.
 *
 *   kali   what the layer is on a real Kali Linux (Xfce) machine
 *   site   what it actually is on this site, and which project of mine built it
 *   llm    the same layer in an LLM system
 *
 * The third reading is an analogy, and says so. It follows the "LLM OS"
 * sketch from Andrej Karpathy's 2023 talk *Intro to Large Language Models*:
 * the model is the kernel, the context window is working memory, retrieval is
 * the disk, tools are the applications. I have extended it downward to the
 * display and the hardware and upward to the panel; where a mapping is mine
 * or strained, the text says so rather than pretending the fit is exact.
 *
 * Editing rules: Kali facts come from docs/kali-desktop-research.md (checked
 * against Kali's own packaging) or are general Linux knowledge; nothing about
 * my work goes here that is not already in src/data/record.ts. `work` holds
 * subject ids from that record, so each layer links to the stack that proves
 * I have worked on it. scripts/teardown-anatomy.test.mts checks every id.
 *
 * Pure data: no imports from the desktop.
 */

export type Lens = 'kali' | 'site' | 'llm';

export const LENSES: { id: Lens; label: string; short: string; blurb: string }[] = [
  {
    id: 'kali',
    label: 'Kali Linux',
    short: 'Kali',
    blurb: 'What each layer is on a real Kali machine: the Xfce desktop on top, Linux and the hardware underneath.',
  },
  {
    id: 'site',
    label: 'This site',
    short: 'Here',
    blurb: 'What each layer really is here. Nothing on this desktop is an image: every part is something I built, and this names it.',
  },
  {
    id: 'llm',
    label: 'An LLM system',
    short: 'LLM',
    blurb: 'The same stack as an LLM application, after the "LLM OS" sketch: the model as kernel, the context window as memory, retrieval as the disk, tools as the apps. An analogy, flagged where it strains.',
  },
];

/** One named piece of a layer, and what it does, in a line. */
export type Piece = [name: string, what: string];

export interface Reading {
  /** the layer's name under this lens */
  name: string;
  /** what it is, in a sentence or two */
  gist: string;
  /** a heading for the pieces, when they are not simply the parts of the thing named */
  piecesLabel?: string;
  pieces: Piece[];
}

export type LayerKind = 'panel' | 'window' | 'nowindows' | 'desk' | 'board' | 'wall' | 'display' | 'session' | 'fs' | 'kernel' | 'hardware';

export interface Anatomy {
  kali: Reading;
  site: Reading;
  llm: Reading;
  /** subjects in src/data/record.ts where I have done this work */
  work: string[];
  /** other layers this one depends on, and how */
  links: [to: LayerKind, how: string][];
}

export const LAYERS: Record<Exclude<LayerKind, 'window'>, Anatomy> = {
  panel: {
    kali: {
      name: 'xfce4-panel',
      gist: 'One bar across the top that hosts small plugins. The panel only lays them out; each plugin watches one thing.',
      pieces: [
        ['Whisker Menu', 'the Applications menu: search on top, categories on the right'],
        ['Launchers', 'text editor, browser, terminal'],
        ['Workspace Switcher', 'four virtual desktops, shown as a pager'],
        ['Window Buttons', 'one button per open window, icons only'],
        ['CPU Graph', "bars in Kali's blue, 128 px wide"],
        ['Status Tray', 'network, VPN address, volume, notifications, battery'],
        ['Clock', '24-hour by default'],
      ],
    },
    site: {
      name: 'Panel.tsx',
      gist: 'A flex row of React components that all read one store. No plugin runs on its own: change the store and the bar follows.',
      pieces: [
        ['Menu', 'every app from the registry, by category'],
        ['Pager', 'four workspaces held in the store'],
        ['Task list', 'a button per window; minimising flies the window into its button'],
        ['Load graph', 'how late a timer fires, not real CPU. A page cannot read that'],
        ['Tray', 'who else is here (a realtime channel), the music player, your battery'],
        ['Open to work', 'the one button a real panel would not have'],
      ],
    },
    llm: {
      name: 'Observability',
      gist: 'The strip that stays in view while the system works: what is running, how loaded it is, what it has cost. My extension of the analogy, not part of the original sketch.',
      pieces: [
        ['Traces', 'which call is in flight, and what it called: the task list'],
        ['Latency', 'time to first token and tokens per second: the load graph'],
        ['Cost meters', 'tokens in and out, priced: the tray'],
        ['Budget guards', 'the limit that stops a run before the invoice does'],
        ['Version in use', 'which model and prompt answered. Without it nothing reproduces'],
      ],
    },
    work: ['cost', 'eval-design'],
    links: [['session', 'reads the window list, the workspaces and the settings']],
  },

  nowindows: {
    kali: {
      name: 'xfwm4',
      gist: 'The window manager. It draws every title bar and border, decides which window is on top and which has the keyboard. With nothing open it has nothing to stack.',
      pieces: [
        ['Decorations', 'title bar, buttons and borders, from the Kali-Dark theme'],
        ['Stacking order', 'which window covers which'],
        ['Focus', 'which window gets the keys'],
        ['Compositor', 'blends windows and their shadows into one picture'],
        ['Tiling', 'drag to an edge, or Super and an arrow'],
      ],
    },
    site: {
      name: 'Window.tsx',
      gist: 'One component draws every frame. Open an app and take the desktop apart again: each window becomes its own layer here.',
      pieces: [
        ['Drag', 'moves the element with a transform and writes to the store once, on release'],
        ['Resize', 'from all eight edges'],
        ['Snap', 'a preview of the half or the whole screen'],
        ['Order', 'a z number per window in the store'],
      ],
    },
    llm: {
      name: 'Tools',
      gist: 'In the sketch, applications are the tools a model can call. None is in use, so the model has only what it already knows.',
      pieces: [
        ['Tool call', 'the model asks for a tool by name, with arguments'],
        ['Result', 'what comes back goes into the context for the next step'],
        ['Orchestrator', 'the loop that runs the calls: the window manager of the analogy'],
      ],
    },
    work: ['multi-agent', 'agent-governance'],
    links: [['session', 'every window is a row in the session']],
  },

  desk: {
    kali: {
      name: 'xfdesktop',
      gist: 'The desktop itself: launchers as icons, and a right-click menu. The card is in the style of Conky, a monitor people draw on their wallpaper; stock Kali does not ship one.',
      pieces: [
        ['Launchers', '.desktop files in ~/Desktop, drawn as icons'],
        ['Desktop menu', 'right-click: open a terminal here, change the wallpaper'],
        ['Conky-style card', 'live text drawn on the desktop'],
      ],
    },
    site: {
      name: 'Desktop.tsx',
      gist: 'A grid of buttons made from the app registry, and an introduction card whose numbers are read from the same record the board draws.',
      pieces: [
        ['App registry', 'thirteen apps, each one file: title, icon, size, component'],
        ['Icon grid', 'arrow keys move, Enter opens'],
        ['Welcome card', 'who I am, from the résumé data; the totals, from the Stacks record'],
        ['Year strip', "the board's timeline"],
      ],
    },
    llm: {
      name: 'System prompt and tool list',
      gist: 'What a model is told before you type anything: who it is, what tools exist, what is true right now. The card literally runs whoami.',
      pieces: [
        ['Identity', 'the persona and its limits: the card'],
        ['Tool descriptions', 'a name and a sentence per tool: the launchers and their tooltips'],
        ['Standing facts', 'what should be true for the whole conversation: the stats'],
        ['Instructions', 'what to do when unsure. Mine say: cite it or decline'],
      ],
    },
    work: ['grounding', 'compliance-review'],
    links: [
      ['session', 'a launcher asks the session to open a window'],
      ['board', 'the card and the board read the same totals'],
    ],
  },

  board: {
    kali: {
      name: 'No twin on Kali',
      gist: "Nothing in Xfce does this. The nearest relatives are Conky, which draws live data on the desktop, and Kali's own default wallpaper since 2026.1, which is isometric cubes.",
      pieces: [
        ['Conky', 'the closest idea: data drawn over the wallpaper'],
        ['kali-cubes', "Kali's wallpaper of isometric cubes. Mine are counted"],
      ],
    },
    site: {
      name: 'Stacks',
      gist: 'One canvas over the wallpaper: a stack per subject, a cube per dated thing I built, measured, studied or wrote. It redraws only when the record changes.',
      pieces: [
        ['The record', 'src/data/record.ts: work, projects, measurements'],
        ['Posts and notes', 'markdown in content/, read as they are published'],
        ['Research library', 'a paper becomes a cube at its first reading pass'],
        ['One model', 'the board, the card, Ctrl+K and /stacks all draw the same data'],
      ],
    },
    llm: {
      name: 'Long-term memory',
      gist: 'What was learned and kept, outside the context window. Each entry is dated and names its source, so it can be checked instead of trusted.',
      pieces: [
        ['Episodic record', 'what happened and when, not a summary of it'],
        ['Provenance', 'every item points at where it came from'],
        ['Consolidation', 'reading turns into memory at a fixed point: Pass 1'],
        ['Compiled knowledge', 'Mneme, my project: build the knowledge base once instead of re-deriving it per question'],
      ],
    },
    work: ['knowledge-compilation', 'research-practice'],
    links: [
      ['fs', 'the record, the posts and the saved library are all files or storage'],
      ['session', 'redraws when the stores it reads change'],
    ],
  },

  wall: {
    kali: {
      name: 'xfdesktop backdrop',
      gist: 'The picture behind everything. Kali packages its artwork separately, and one command swaps the whole look.',
      pieces: [
        ['kali-wallpapers', 'the artwork, in its own package'],
        ['Kali-Dark', 'the theme: surfaces #23252E, accent #2777FF'],
        ['kali-undercover', 'makes the desktop look like Windows 10, for working in public'],
        ['BackTrack mode', 'the red look of the old distribution, added in 2026.1'],
      ],
    },
    site: {
      name: 'A CSS background',
      gist: 'One element with a background, drifting a few pixels on a 20-second loop. Themes are a table of CSS variables. All the artwork is original: Kali marks are trademarks.',
      pieces: [
        ['Wallpapers', 'thirteen, drawn for this site'],
        ['Themes', 'a set of CSS variables swapped at the root'],
        ['Undercover', 'the same trick as the real one: a different theme and a bottom bar'],
      ],
    },
    llm: {
      name: 'The prior',
      gist: 'What a model does before any prompt: its defaults from pretraining. Everything above is laid over it, and it shows through wherever nothing covers it. My mapping, and a loose one.',
      pieces: [
        ['Pretraining', 'where the defaults come from'],
        ['Default behaviour', 'what you get when the prompt says nothing'],
        ['A default is a claim', 'my finding in production: a permissive default quietly routed most of a corpus around its safety check'],
      ],
    },
    work: ['constrained-retrieval'],
    links: [['session', 'the wallpaper and theme are settings in the session']],
  },

  display: {
    kali: {
      name: 'Xorg and LightDM',
      gist: 'The X server owns the screen, the keyboard and the mouse. Programs do not draw to the screen; they ask the server to. LightDM is the login screen that started this session.',
      pieces: [
        ['Xorg', 'the display server every window is a client of'],
        ['LightDM', 'the greeter you logged in through'],
        ['Compositing', "xfwm4's compositor merges every window into each frame"],
        ['Plymouth', 'the boot animation before any of this exists'],
        ['HiDPI mode', "Kali's switch that doubles the scale"],
      ],
    },
    site: {
      name: 'Your browser tab',
      gist: "The desktop is ordinary HTML laid out to this viewport. The browser's own compositor paints it, which is why the layers can be lifted apart with CSS at all.",
      pieces: [
        ['Viewport', 'the pixels this tab has'],
        ['Greeter', 'boot and login: two React screens before the desktop mounts'],
        ['Compositor', "the browser's. Teardown is one 3D transform on the desktop element"],
        ['Refresh', 'timed just now over 40 frames'],
      ],
    },
    llm: {
      name: 'Decoding',
      gist: "Where the model's internal state becomes something you can read, one token at a time, as a screen is painted one frame at a time. My extension of the analogy.",
      pieces: [
        ['Logits', 'a score for every possible next token'],
        ['Temperature', 'how much chance to allow. The assistant here runs at 0.4'],
        ['Sampling', 'top-p and friends: which tokens are even considered'],
        ['Streaming', 'tokens sent as they are chosen, so the answer appears as it is written'],
        ['Artefacts', 'Whisper loops I traced to the decoder, not the audio: a temperature ladder cleared every one'],
      ],
    },
    work: ['whisper-decoding'],
    links: [['hardware', 'the screen and its refresh rate']],
  },

  session: {
    kali: {
      name: 'systemd and the Xfce session',
      gist: 'What keeps the desktop alive: systemd starts and supervises everything, D-Bus lets the parts talk, and xfce4-session starts the desktop and remembers it.',
      pieces: [
        ['systemd', 'process 1: starts, supervises and restarts services'],
        ['D-Bus', 'the message bus desktop parts talk over'],
        ['xfce4-session', 'starts the panel, the window manager and the desktop'],
        ['xfconfd', 'the settings store every Xfce part reads'],
        ['xfce4-notifyd', 'draws notifications'],
        ['NetworkManager', 'connections, and the VPN address the panel shows'],
      ],
    },
    site: {
      name: 'One store',
      gist: 'A single zustand store holds every window, workspace and setting. Each "process" is a mounted React component. Only the settings survive a reload.',
      pieces: [
        ['Window table', 'position, size, order and state for each'],
        ['Focus', 'one id for the focused window, one number for the workspace'],
        ['Settings', 'saved to localStorage: the xfconf of this desktop'],
        ['Presence', 'a realtime channel: the nearest thing here to a bus'],
        ['Toasts', 'notifications, top right under the panel'],
      ],
    },
    llm: {
      name: 'Context window and the agent loop',
      gist: 'Working memory. In the sketch the context window is RAM: everything the model can see right now, and gone when the session ends, like this store on reload.',
      pieces: [
        ['Context window', 'finite. What is not in it does not exist for the model'],
        ['Turns', 'the conversation so far, re-sent on every call'],
        ['KV cache', 'keeps the work already done on earlier tokens, so each new one is cheap'],
        ['Agent loop', 'model asks, a tool runs, the result goes back in'],
        ['Compaction', 'what to do when it fills: summarise, or page out to memory'],
      ],
    },
    work: ['multi-agent', 'agent-governance'],
    links: [
      ['fs', 'settings are written through to storage'],
      ['kernel', 'every process runs on the kernel'],
    ],
  },

  fs: {
    kali: {
      name: 'ext4 and the Kali tree',
      gist: 'One tree of directories on disk. What makes it Kali is what apt puts in it: several hundred security tools, grouped into metapackages.',
      pieces: [
        ['/home/kali', 'your files. Kali has not logged in as root since 2020.1'],
        ['/etc', 'configuration, as text'],
        ['Wordlists', '/usr/share/wordlists: rockyou and the rest'],
        ['apt', 'installs from kali-rolling, the repository the tools arrive from'],
        ['Metapackages', 'kali-linux-default and friends: a tool set as one package'],
        ['/proc and /sys', 'the kernel, presented as files'],
      ],
    },
    site: {
      name: 'A tree in memory, and what persists',
      gist: 'The terminal and the file manager share one tree of plain objects, rebuilt on every load. What actually persists is small and stays in your browser.',
      pieces: [
        ['~/Documents', 'my résumé and posts, mounted as files from one typed source'],
        ['content/', 'the real disk: markdown in git, published by committing'],
        ['localStorage', 'your settings, and the Research library if you used it'],
        ['IndexedDB', 'the PostgreSQL data directory, if you opened psql'],
        ['Privacy', 'none of it is sent to a server'],
      ],
    },
    llm: {
      name: 'Retrieval store',
      gist: 'The disk of an LLM system: far more than fits in the context window, so the right part has to be fetched. This mapping is in the original sketch, and it is the layer most of my production work is on.',
      pieces: [
        ['Chunks', 'documents cut into pieces small enough to fetch'],
        ['Dense index', 'embeddings: finds what means the same'],
        ['Lexical index', 'BM25: finds what says the same words'],
        ['Fusion', 'reciprocal rank fusion merges the two rankings'],
        ['Hard filters', 'constraints similarity cannot express. Where they belong is my first research question'],
        ['Verification', 'drop any claim whose quoted evidence is not literally in the source'],
      ],
    },
    work: ['hybrid-retrieval', 'grounding', 'constrained-retrieval', 'knowledge-compilation', 'databases'],
    links: [['kernel', 'files are reached through the kernel']],
  },

  kernel: {
    kali: {
      name: 'Linux',
      gist: 'The one program that talks to the hardware. Everything above asks it for things through system calls. Kali builds its own, patched for wireless injection.',
      pieces: [
        ['Scheduler', 'which process runs next'],
        ['Memory manager', 'virtual memory and the page cache'],
        ['VFS', 'one interface over every file system'],
        ['Network stack', 'TCP/IP and netfilter; on Kali, patched to inject frames'],
        ['Drivers', 'modules for each device'],
        ['System calls', 'the only door in'],
      ],
    },
    site: {
      name: 'Two kernels',
      gist: "The pretend one is the browser: its JavaScript engine and event loop do the scheduling. The real one is Linux 6.8.12, which the VM app boots on an x86 emulator in this tab.",
      pieces: [
        ['Event loop', "the scheduler of this desktop. The panel's graph measures its lag"],
        ['v86', 'an x86 emulator in WebAssembly, booting a real kernel with 128 MB'],
        ['9p share', 'my portfolio mounted inside the guest at /mnt'],
        ['PGlite', 'PostgreSQL 18 compiled to WebAssembly, behind the psql app'],
        ['Routes', 'the network: /api calls to arXiv, Semantic Scholar and a language model'],
      ],
    },
    llm: {
      name: 'The model',
      gist: 'The one component everything else calls, through a narrow door: text in, a probability for every next token out. In the sketch, the model is the kernel.',
      pieces: [
        ['Tokenizer', 'text to integers. Script changes the count, which changes the cost'],
        ['Embeddings', 'each token as a vector'],
        ['Attention', 'every token reads the others and decides what matters'],
        ['MLP blocks', 'where most of the parameters live'],
        ['Layers', 'the same block, stacked many times'],
        ['LoRA', 'patching the kernel instead of rebuilding it: small low-rank updates'],
      ],
    },
    work: ['fine-tuning', 'transformer-internals', 'local-models'],
    links: [['hardware', 'the only thing that touches it']],
  },

  hardware: {
    kali: {
      name: 'The machine',
      gist: 'Where it all runs. Kali is unusually picky about one part: the wireless card has to support monitor mode and injection.',
      pieces: [
        ['CPU', 'cores the scheduler hands out'],
        ['Memory', 'what is running, and the page cache'],
        ['Disk', 'the tree, at rest'],
        ['GPU', 'draws the desktop; cracks hashes in hashcat'],
        ['Wi-Fi card', 'the chipset decides what Kali can do with it'],
        ['GRUB', 'the bootloader: firmware hands over to it, and it starts the kernel'],
      ],
    },
    site: {
      name: 'Your device',
      gist: 'As far as a web page is allowed to see it, which is deliberately not far: a core count, a rounded memory figure, a platform name.',
      pieces: [
        ['Cores', 'navigator.hardwareConcurrency'],
        ['Memory', 'rounded down by the browser, so a page cannot fingerprint you with it'],
        ['Page heap', 'what this tab is using, where the browser reports it'],
        ['Guest RAM', '128 MB handed to the Linux VM when it boots'],
      ],
    },
    llm: {
      name: 'Compute',
      gist: 'What the model runs on, and the reason for most engineering below the API: the weights, the activations and the cache all have to fit in memory at once.',
      pieces: [
        ['GPU memory', 'weights plus activations plus the KV cache'],
        ['Quantization', 'the same weights in fewer bits: 4-bit loading in ForgeLM'],
        ['Batching', 'more requests per pass: throughput bought with latency'],
        ['Hosting', 'hosted or local: pay per token, or pay for the machine'],
        ['Cost', 'the meter everything above is trying to keep down'],
      ],
    },
    work: ['fine-tuning', 'cost', 'local-models'],
    links: [],
  },
};

/* ───────────────────────── windows, by app ─────────────────────────
   A window is a layer whose reading depends on the app in it. `twin` is the
   program a real Kali machine would have in that place; `built` is what it is
   here; `tool` is the app as a tool in an LLM system. */

export interface AppAnatomy {
  twin: [name: string, what: string];
  built: [name: string, what: string];
  tool: [name: string, what: string];
  work: string[];
  links: [to: LayerKind, how: string][];
}

export const APPS: Record<string, AppAnatomy> = {
  terminal: {
    twin: ['QTerminal and zsh', "Kali's terminal, with its two-line prompt. zsh has been the default shell since 2020.4."],
    built: ['A React terminal', 'A terminal written in React in front of a shell I wrote in TypeScript: about fifty commands over the in-memory file system, with pipes, history and completion.'],
    tool: ['The shell tool', "The most general tool a model can be given, and the one that most needs a sandbox and a human sign-off for anything irreversible."],
    work: ['agent-governance', 'prompt-injection'],
    links: [
      ['fs', 'every command reads or writes the tree'],
      ['kernel', 'ai, research and news call out through the network'],
    ],
  },
  browser: {
    twin: ['Firefox ESR', "Kali's default browser: the extended-support build of Firefox."],
    built: ['A page in browser chrome', 'My "about me" rendered from the same typed résumé source as the PDF, the /resume page and the files in ~/Documents.'],
    tool: ['The browser tool', 'How a model reads the live web. It is also the front door for indirect prompt injection: the page is data, and must never be obeyed.'],
    work: ['prompt-injection', 'grounding'],
    links: [['fs', 'the same résumé is mounted as files']],
  },
  files: {
    twin: ['Thunar', "Xfce's file manager. This one borrows the layout of KDE's Dolphin, which Kali's KDE edition ships."],
    built: ['FileManager.tsx', 'Places, breadcrumbs, split view and an embedded terminal, over the same tree the shell uses.'],
    tool: ['File search', 'The simplest retrieval there is: list, open, read. Often the right first tool before any index.'],
    work: ['hybrid-retrieval'],
    links: [['fs', 'it is a view of the tree']],
  },
  research: {
    twin: ["Kali's tool menu", 'No twin as a program. Its role is the same as the grouped tools on a Kali box: the working set for the job. Mine is papers.'],
    built: ['A paper-study workbench', 'Search by what you want to learn, five tracks with weekly briefs, three-pass notes, highlights, a literature matrix and spaced recall. The library is saved in your browser.'],
    tool: ['Retrieval, end to end', 'Search, re-rank by keywords, then a model writes a brief from the retrieved abstracts only. The small-scale version of the grounded systems I build at work.'],
    work: ['hybrid-retrieval', 'grounding', 'speech-eval', 'rule-bases'],
    links: [
      ['fs', 'the library, notes and cards are saved to storage'],
      ['board', 'a paper becomes a cube at its first pass'],
      ['kernel', 'searches arXiv, Hugging Face and Semantic Scholar through /api'],
    ],
  },
  stacks: {
    twin: ['No twin', 'Nothing on Kali plays this part.'],
    built: ['The record, in words', 'The same data as the board behind the windows, as text: every subject and each dated thing under it. Also at /stacks.'],
    tool: ['Memory, made readable', 'A way to look at what the system remembers, with the source of each item. Memory you cannot inspect is memory you cannot trust.'],
    work: ['knowledge-compilation'],
    links: [['board', 'the same model, drawn as text']],
  },
  writing: {
    twin: ['Mousepad', "Kali's text editor is the nearest thing. Publishing is not a desktop feature."],
    built: ['Markdown, prerendered', 'Every post and paper note is a file in content/. Committing one publishes it to this app, to /writing and to the RSS feed.'],
    tool: ['The output that is kept', 'Most of what a model writes is thrown away. This is the part that survives the conversation and gets cited later.'],
    work: ['research-practice'],
    links: [
      ['fs', 'posts are files in content/'],
      ['board', 'a post is a cube on its subject'],
    ],
  },
  assistant: {
    twin: ['No twin', 'Stock Kali ships no assistant.'],
    built: ['A streamed chat', 'Asks a hosted open-weight model through /api/chat, with my résumé and the Stacks record as its only context, at temperature 0.4. If one model is rate-limited the next takes over; with no key it answers offline from the same text.'],
    tool: ['The chat loop itself', 'System prompt, context, your turn, tokens streamed back. It is told to answer only from the context and to say when something is not there.'],
    work: ['grounding', 'cost'],
    links: [
      ['kernel', 'calls the model through /api/chat'],
      ['board', 'the record is part of its context'],
      ['fs', 'so is the résumé'],
    ],
  },
  psql: {
    twin: ['PostgreSQL', "Kali ships it: Metasploit keeps its workspace in a PostgreSQL database."],
    built: ['PGlite', 'Real PostgreSQL 18 compiled to WebAssembly, running in this tab over my research library. The data directory lives in IndexedDB.'],
    tool: ['The SQL tool', 'Structured questions deserve a structured tool. In production my retrieval store is PostgreSQL with pgvector.'],
    work: ['databases', 'hybrid-retrieval'],
    links: [
      ['kernel', 'the database engine is a WebAssembly module'],
      ['fs', 'its data directory is in IndexedDB'],
    ],
  },
  vm: {
    twin: ['A virtual machine', 'What QEMU or VirtualBox is to a real Kali host: another computer, in a window.'],
    built: ['v86', 'An x86 emulator in WebAssembly booting a real Linux 6.8.12 kernel, with my portfolio mounted over 9p. Not a simulation: uname answers for itself.'],
    tool: ['The sandbox', "Where an agent's code should run: a machine with no credentials in it and nothing it can break."],
    work: ['agent-governance'],
    links: [
      ['kernel', 'boots a second, real kernel'],
      ['fs', 'mounts the tree inside the guest'],
      ['hardware', 'takes 128 MB of your memory while it runs'],
    ],
  },
  'code-editor': {
    twin: ['Mousepad and nano', "Kali's editors: one with a window, one for the terminal."],
    built: ['CodeMirror', 'Syntax highlighting and a Markdown preview, saving back into the in-memory tree.'],
    tool: ['The edit tool', 'How a coding agent changes a file. Small, reviewable diffs are the whole point.'],
    work: ['apis-backend'],
    links: [['fs', 'opens and saves files in the tree']],
  },
  music: {
    twin: ['No twin', 'Kali does not ship a music player by default.'],
    built: ['A stream player', 'Open music from Audius and commercial-free radio, proxied through /api/music, playing on from the panel.'],
    tool: ['No analogue', 'Not everything is an LLM. Some software is just for the person in the chair.'],
    work: [],
    links: [['kernel', 'streams through the network']],
  },
  hire: {
    twin: ['No twin', 'A portfolio has one app a distribution does not.'],
    built: ['A brief builder', 'What I take on, and a form that emails me a project brief. It falls back to your mail app if the server cannot send.'],
    tool: ['The human in the loop', 'The point where the system stops and a person takes over. Every system I build has one, on purpose.'],
    work: ['agent-governance', 'leading'],
    links: [['kernel', 'sends the brief through /api/hire']],
  },
  settings: {
    twin: ['Xfce Settings Manager', 'The front end to xfconf, where every Xfce setting is kept.'],
    built: ['Settings.tsx', 'Writes to the store, which saves to localStorage: theme, wallpaper, panel, motion.'],
    tool: ['Configuration', 'The settings that change behaviour without changing the model: temperature, limits, which tools are on. Version them like code.'],
    work: ['eval-design'],
    links: [['session', 'every setting is a field in the session']],
  },
};

const FALLBACK_APP: AppAnatomy = {
  twin: ['A client window', 'Any program xfwm4 draws a frame around.'],
  built: ['A React component', 'Mounted inside the frame drawn by Window.tsx.'],
  tool: ['A tool', 'Something the model can call by name.'],
  work: [],
  links: [['session', 'a row in the window table']],
};

export const appAnatomy = (appId: string): AppAnatomy => APPS[appId] ?? FALLBACK_APP;

/** A window's three readings, built from its app. */
export function windowAnatomy(appId: string): Anatomy {
  const a = appAnatomy(appId);
  const frame = LAYERS.nowindows;
  return {
    kali: { name: a.twin[0], gist: a.twin[1], piecesLabel: 'The frame around it: xfwm4', pieces: frame.kali.pieces },
    site: { name: a.built[0], gist: a.built[1], piecesLabel: 'The frame around it: Window.tsx', pieces: frame.site.pieces },
    llm: { name: a.tool[0], gist: a.tool[1], piecesLabel: 'How any tool is used', pieces: frame.llm.pieces },
    work: a.work,
    links: [...a.links, ['session', 'a row in the window table']],
  };
}
