'use client';

import type { Peer, RoomStatus } from '../../net/realtime';

/** Shared header for multiplayer games: room code, seated players, presence. */
export function RoomBar({
  room,
  peers,
  status,
  seats,
}: {
  room: string;
  peers: Peer[];
  status: RoomStatus;
  seats?: string[];
}) {
  return (
    <div className="kos-roombar">
      <div className="kos-roombar-room">
        <span className="kos-roombar-label">room</span>
        <code>{room}</code>
      </div>
      <div className="kos-roombar-players">
        {peers.map((p) => (
          <span key={p.clientId} className={'kos-roombar-chip' + (p.isMe ? ' me' : '')}>
            {seats && p.seat < seats.length ? <b>{seats[p.seat]}</b> : null} {p.name}
            {p.isHost ? ' ⚑' : ''}
          </span>
        ))}
        {peers.length === 0 && <span className="kos-roombar-chip">connecting…</span>}
      </div>
      <div className={'kos-roombar-status s-' + status}>
        {status === 'connected' ? '● live' : status === 'offline' ? '○ offline' : '◌ …'}
      </div>
    </div>
  );
}
