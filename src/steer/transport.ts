import { DEFAULT_SETTINGS, Engine, type EngineSettings, type TokenSource } from './engine';
import type { ClientMsg, DimensionInfo, ServerMsg, TaskInfo } from './protocol';

/**
 * How the canvas reaches a steering backend. Two implementations speak the
 * same messages: the engine running in the page, and a WebSocket to the Python
 * backend (which is where a proxy-model focus monitor and Tier B live).
 */
export interface Transport {
  /** a short label for the footer: "in page" or the socket's host */
  readonly label: string;
  send(msg: ClientMsg): void;
  close(): void;
}

export type Receive = (msg: ServerMsg) => void;

export class LocalTransport implements Transport {
  readonly label = 'in page';
  private engine: Engine;

  constructor(
    source: TokenSource,
    dims: readonly DimensionInfo[],
    tasks: readonly TaskInfo[],
    receive: Receive,
    settings: Partial<EngineSettings> = {},
  ) {
    this.engine = new Engine(source, dims, tasks, { ...DEFAULT_SETTINGS, ...settings }, receive);
    this.engine.start();
  }

  send(msg: ClientMsg): void {
    this.engine.handle(msg);
  }

  close(): void {
    void this.engine.close();
  }
}

export class WsTransport implements Transport {
  readonly label: string;
  private ws: WebSocket;
  private queue: ClientMsg[] = [];
  private closed = false;

  /** `onDown` fires once if the socket never opens or drops; the canvas then falls back to the page. */
  constructor(url: string, receive: Receive, onDown: (reason: string) => void, connectTimeoutMs = 2500) {
    this.label = url.replace(/^wss?:\/\//, '').replace(/\/ws$/, '');
    this.ws = new WebSocket(url);
    let opened = false;
    const fail = (reason: string) => {
      if (this.closed) return;
      this.closed = true;
      try {
        this.ws.close();
      } catch {
        /* already closed */
      }
      onDown(reason);
    };
    const timer = setTimeout(() => !opened && fail('no answer'), connectTimeoutMs);
    this.ws.onopen = () => {
      opened = true;
      clearTimeout(timer);
      for (const msg of this.queue.splice(0)) this.ws.send(JSON.stringify(msg));
    };
    this.ws.onmessage = (ev) => {
      try {
        receive(JSON.parse(String(ev.data)) as ServerMsg);
      } catch {
        /* not ours */
      }
    };
    this.ws.onerror = () => fail(opened ? 'connection lost' : 'could not connect');
    this.ws.onclose = () => fail(opened ? 'connection closed' : 'could not connect');
  }

  send(msg: ClientMsg): void {
    if (this.closed) return;
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
    else this.queue.push(msg);
  }

  close(): void {
    this.closed = true;
    try {
      this.ws.close();
    } catch {
      /* already closed */
    }
  }
}
