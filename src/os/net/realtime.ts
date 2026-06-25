'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase, getClientId, getDisplayName } from './supabase';

export interface Peer {
  clientId: string;
  name: string;
  seat: number;
  isHost: boolean;
  isMe: boolean;
}

export type RoomStatus = 'connecting' | 'connected' | 'offline';

interface PresenceMeta {
  clientId: string;
  name: string;
  joinedAt: number;
}

/**
 * Host-authoritative realtime game room over Supabase broadcast + presence.
 * Seat 0 (earliest joiner) is the host and owns the canonical state.
 * Falls back to a local single-seat room when Supabase is unavailable.
 */
export function useGameRoom<S, M>(opts: {
  gameId: string;
  room: string;
  initialState: S;
  reduce: (state: S, move: M, ctx: { seat: number; peers: Peer[] }) => S;
  maxPlayers?: number;
}) {
  const { gameId, room, initialState, reduce } = opts;
  const clientId = useMemo(() => getClientId(), []);
  const name = useMemo(() => getDisplayName(), []);
  const joinedAt = useRef<number>(0);
  if (joinedAt.current === 0) joinedAt.current = performance.now() + Math.random();

  const [state, setState] = useState<S>(initialState);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [status, setStatus] = useState<RoomStatus>('connecting');

  const stateRef = useRef(state);
  stateRef.current = state;
  const peersRef = useRef(peers);
  peersRef.current = peers;
  const reduceRef = useRef(reduce);
  reduceRef.current = reduce;
  const channelRef = useRef<RealtimeChannel | null>(null);
  const versionRef = useRef(0);

  const mySeat = useMemo(() => peers.find((p) => p.isMe)?.seat ?? 0, [peers]);
  const isHost = useMemo(() => {
    const me = peers.find((p) => p.isMe);
    return me ? me.isHost : true;
  }, [peers]);
  const isHostRef = useRef(isHost);
  isHostRef.current = isHost;
  const mySeatRef = useRef(mySeat);
  mySeatRef.current = mySeat;

  const broadcastState = useCallback(() => {
    versionRef.current += 1;
    channelRef.current?.send({
      type: 'broadcast',
      event: 'state',
      payload: { state: stateRef.current, version: versionRef.current },
    });
  }, []);

  const applyAuthoritative = useCallback((move: M) => {
    const next = reduceRef.current(stateRef.current, move, {
      seat: mySeatRef.current,
      peers: peersRef.current,
    });
    stateRef.current = next;
    setState(next);
    broadcastState();
  }, [broadcastState]);

  const dispatch = useCallback(
    (move: M) => {
      if (isHostRef.current || !channelRef.current) {
        applyAuthoritative(move);
      } else {
        channelRef.current.send({
          type: 'broadcast',
          event: 'move',
          payload: { move, from: clientId },
        });
      }
    },
    [applyAuthoritative, clientId],
  );

  const reset = useCallback(
    (next?: S) => {
      const value = next ?? initialState;
      stateRef.current = value;
      setState(value);
      if (isHostRef.current) broadcastState();
    },
    [broadcastState, initialState],
  );

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setStatus('offline');
      setPeers([{ clientId, name, seat: 0, isHost: true, isMe: true }]);
      return;
    }

    const channel = supabase.channel(`kos:game:${gameId}:${room}`, {
      config: { broadcast: { self: false }, presence: { key: clientId } },
    });
    channelRef.current = channel;

    const recomputePeers = () => {
      const presenceState = channel.presenceState<PresenceMeta>();
      const metas: PresenceMeta[] = [];
      for (const key of Object.keys(presenceState)) {
        const entries = presenceState[key];
        if (entries && entries[0]) metas.push(entries[0]);
      }
      metas.sort((a, b) => a.joinedAt - b.joinedAt || a.clientId.localeCompare(b.clientId));
      const next: Peer[] = metas.map((m, i) => ({
        clientId: m.clientId,
        name: m.name,
        seat: i,
        isHost: i === 0,
        isMe: m.clientId === clientId,
      }));
      setPeers(next);
    };

    channel.on('presence', { event: 'sync' }, recomputePeers);
    channel.on('presence', { event: 'join' }, () => {
      recomputePeers();
      // Host pushes current state to newcomers.
      if (isHostRef.current) setTimeout(broadcastState, 120);
    });
    channel.on('presence', { event: 'leave' }, recomputePeers);

    channel.on('broadcast', { event: 'move' }, ({ payload }) => {
      if (isHostRef.current && payload?.move !== undefined) applyAuthoritative(payload.move as M);
    });
    channel.on('broadcast', { event: 'state' }, ({ payload }) => {
      if (typeof payload?.version === 'number' && payload.version >= versionRef.current) {
        versionRef.current = payload.version;
        stateRef.current = payload.state as S;
        setState(payload.state as S);
      }
    });
    channel.on('broadcast', { event: 'sync_request' }, () => {
      if (isHostRef.current) broadcastState();
    });

    channel.subscribe(async (s) => {
      if (s === 'SUBSCRIBED') {
        setStatus('connected');
        await channel.track({ clientId, name, joinedAt: joinedAt.current });
        setTimeout(() => {
          if (!isHostRef.current) {
            channel.send({ type: 'broadcast', event: 'sync_request', payload: { from: clientId } });
          }
        }, 200);
      }
    });

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, room, clientId, name]);

  return { state, dispatch, reset, peers, mySeat, isHost, status, clientId, name };
}

/* ───────── Lightweight presence + chat (no game state) ───────── */

export interface PresenceUser {
  clientId: string;
  name: string;
}

export function usePresence(channelName: string) {
  const clientId = useMemo(() => getClientId(), []);
  const name = useMemo(() => getDisplayName(), []);
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const [status, setStatus] = useState<RoomStatus>('connecting');

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setStatus('offline');
      setUsers([{ clientId, name }]);
      return;
    }
    const channel = supabase.channel(`kos:presence:${channelName}`, {
      config: { presence: { key: clientId } },
    });
    const sync = () => {
      const ps = channel.presenceState<{ clientId: string; name: string }>();
      const list: PresenceUser[] = [];
      for (const key of Object.keys(ps)) {
        const e = ps[key]?.[0];
        if (e) list.push({ clientId: e.clientId, name: e.name });
      }
      setUsers(list);
    };
    channel.on('presence', { event: 'sync' }, sync);
    channel.subscribe(async (s) => {
      if (s === 'SUBSCRIBED') {
        setStatus('connected');
        await channel.track({ clientId, name });
      }
    });
    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [channelName, clientId, name]);

  return { users, status, clientId, name };
}

export interface ChatMessage {
  id: string;
  from: string;
  name: string;
  text: string;
  ts: number;
}

export function useChat(channelName: string) {
  const clientId = useMemo(() => getClientId(), []);
  const name = useMemo(() => getDisplayName(), []);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    const channel = supabase.channel(`kos:chat:${channelName}`, {
      config: { broadcast: { self: true }, presence: { key: clientId } },
    });
    channelRef.current = channel;
    channel.on('broadcast', { event: 'msg' }, ({ payload }) => {
      setMessages((m) => [...m.slice(-199), payload as ChatMessage]);
    });
    const sync = () => {
      const ps = channel.presenceState<{ clientId: string; name: string }>();
      const list: PresenceUser[] = [];
      for (const key of Object.keys(ps)) {
        const e = ps[key]?.[0];
        if (e) list.push({ clientId: e.clientId, name: e.name });
      }
      setUsers(list);
    };
    channel.on('presence', { event: 'sync' }, sync);
    channel.subscribe(async (s) => {
      if (s === 'SUBSCRIBED') await channel.track({ clientId, name });
    });
    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [channelName, clientId, name]);

  const send = useCallback(
    (text: string) => {
      const t = text.trim();
      if (!t) return;
      const msg: ChatMessage = {
        id: clientId + ':' + Math.floor(performance.now()).toString(36),
        from: clientId,
        name,
        text: t.slice(0, 500),
        ts: Date.now(),
      };
      channelRef.current?.send({ type: 'broadcast', event: 'msg', payload: msg });
    },
    [clientId, name],
  );

  return { messages, users, send, clientId, name };
}
