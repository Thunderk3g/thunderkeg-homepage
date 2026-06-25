'use client';

import { useEffect, useState } from 'react';
import { usePresence } from '../net/realtime';

export function SystemTray() {
  const [now, setNow] = useState<Date>(() => new Date());
  const { users, status } = usePresence('global');

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className="kos-tray">
      <span
        className={'kos-tray-presence s-' + status}
        title={`${users.length} people online: ${users.map((u) => u.name).join(', ')}`}
      >
        👥 {users.length}
      </span>
      <span className="kos-tray-icon" title="network">🛜</span>
      <span className="kos-tray-icon" title="volume">🔊</span>
      <span className="kos-tray-icon" title="battery">🔋</span>
      <span className="kos-tray-clock" title={date}>
        {time}
      </span>
    </div>
  );
}
