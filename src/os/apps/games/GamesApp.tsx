'use client';

import { useMemo, useState } from 'react';
import type { AppDefinition, AppProps, GameDefinition } from '../../types';
import { allGames } from './registry';
import { usePresence } from '../../net/realtime';

type Filter = 'all' | 'solo' | 'multi';

function randomRoom(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function bestScore(id: string): number {
  if (typeof window === 'undefined') return 0;
  return Number(window.localStorage.getItem('kos:best:' + id) ?? 0);
}
function setBest(id: string, score: number) {
  if (typeof window === 'undefined') return;
  if (score > bestScore(id)) window.localStorage.setItem('kos:best:' + id, String(score));
}

function Lobby({ game, onStart, onCancel }: { game: GameDefinition; onStart: (room: string) => void; onCancel: () => void }) {
  const [room, setRoom] = useState(randomRoom());
  return (
    <div className="kos-lobby">
      <div className="kos-lobby-card">
        <h3>{game.icon} {game.name}</h3>
        <p>{game.tagline}</p>
        <label>Room code</label>
        <div className="kos-lobby-row">
          <input value={room} onChange={(e) => setRoom(e.target.value.toUpperCase().slice(0, 8))} />
          <button className="kos-game-btn" onClick={() => setRoom(randomRoom())}>🎲</button>
        </div>
        <p className="kos-lobby-hint">
          Share this code (or open a second tab) and join the same room to play live.
        </p>
        <div className="kos-lobby-actions">
          <button className="kos-game-btn primary" onClick={() => onStart(room || 'public')}>Enter room</button>
          <button className="kos-game-btn" onClick={onCancel}>Back</button>
        </div>
      </div>
    </div>
  );
}

function GamesApp() {
  const [filter, setFilter] = useState<Filter>('all');
  const [active, setActive] = useState<GameDefinition | null>(null);
  const [room, setRoom] = useState<string | undefined>(undefined);
  const [lobby, setLobby] = useState<GameDefinition | null>(null);
  const { users, status } = usePresence('arcade');

  const games = useMemo(
    () => allGames.filter((g) => filter === 'all' || g.kind === filter),
    [filter],
  );

  const launch = (g: GameDefinition) => {
    if (g.kind === 'multi') setLobby(g);
    else {
      setRoom(undefined);
      setActive(g);
    }
  };

  if (active) {
    const Game = active.component;
    return (
      <div className="kos-arcade">
        <div className="kos-arcade-bar">
          <button className="kos-game-btn" onClick={() => setActive(null)}>‹ Arcade</button>
          <span className="kos-arcade-title">{active.icon} {active.name}</span>
          {active.kind === 'multi' && room && <span className="kos-arcade-room">room {room}</span>}
        </div>
        <div className="kos-arcade-stage">
          <Game
            instanceId={active.id + ':' + (room ?? 'solo')}
            room={room}
            onScore={(s) => setBest(active.id, s)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="kos-arcade">
      <div className="kos-arcade-header">
        <div>
          <h2>🎮 Kali Arcade</h2>
          <p className="kos-arcade-sub">
            {allGames.length} games · {allGames.filter((g) => g.kind === 'multi').length} multiplayer
          </p>
        </div>
        <div className={'kos-arcade-online s-' + status}>
          ● {users.length} online
        </div>
      </div>
      <div className="kos-arcade-filters">
        {(['all', 'solo', 'multi'] as Filter[]).map((f) => (
          <button
            key={f}
            className={'kos-arcade-filter' + (filter === f ? ' active' : '')}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : f === 'solo' ? 'Single-player' : 'Multiplayer'}
          </button>
        ))}
      </div>
      <div className="kos-arcade-grid">
        {games.map((g) => (
          <button key={g.id} className="kos-arcade-card" onClick={() => launch(g)}>
            <span className="kos-arcade-icon">{g.icon}</span>
            <span className="kos-arcade-name">{g.name}</span>
            <span className="kos-arcade-tag">{g.tagline}</span>
            <span className="kos-arcade-meta">
              {g.kind === 'multi' ? `👥 ${g.players ?? '2+'}` : `🏆 ${bestScore(g.id) || '—'}`}
            </span>
          </button>
        ))}
      </div>
      {lobby && (
        <Lobby
          game={lobby}
          onCancel={() => setLobby(null)}
          onStart={(r) => {
            setRoom(r);
            setActive(lobby);
            setLobby(null);
          }}
        />
      )}
    </div>
  );
}

export const gamesApp: AppDefinition = {
  id: 'games',
  title: 'Kali Arcade',
  icon: '🎮',
  category: 'Games',
  component: GamesApp,
  description: 'Single-player & live multiplayer games',
  defaultSize: { width: 820, height: 580 },
  minSize: { width: 420, height: 360 },
  desktop: true,
  launchCommands: ['games', 'arcade'],
};

export default GamesApp;
