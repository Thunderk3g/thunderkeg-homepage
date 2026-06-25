'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGame, totalRespect, live } from './store';
import { districtAt } from './city';
import { missions, profile } from '@/data/resume';
import { missionPassedSting, blip } from './audio';
import Minimap from './Minimap';

function WeaponBox() {
  return (
    <div className="weapon-box" title="Equipped: resume">
      <span role="img" aria-label="resume">
        💼
      </span>
    </div>
  );
}

function Clock() {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      if (el.current) {
        el.current.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="clock" ref={el}>
      00:00
    </div>
  );
}

function Stars() {
  const completed = useGame((s) => s.completed);
  const filled = Math.min(6, completed.length);
  return (
    <div className="stars" title="Hireability level">
      {Array.from({ length: 6 }, (_, i) => (
        <span key={i} className={i < filled ? 'star on' : 'star'}>
          ★
        </span>
      ))}
    </div>
  );
}

function Money() {
  const respect = useGame((s) => s.respect);
  const el = useRef<HTMLDivElement>(null);
  const shown = useRef({ v: 0 });
  useEffect(() => {
    gsap.to(shown.current, {
      v: respect * 1000,
      duration: 0.9,
      ease: 'power2.out',
      onUpdate: () => {
        if (el.current) el.current.textContent = `$${String(Math.round(shown.current.v)).padStart(8, '0')}`;
      },
    });
  }, [respect]);
  return (
    <div className="money" ref={el}>
      $00000000
    </div>
  );
}

function RespectBar() {
  const respect = useGame((s) => s.respect);
  return (
    <div className="bars">
      <div className="bar-row">
        <div className="bar armor" title="Armor">
          <div style={{ width: '100%' }} />
        </div>
        <div className="bar health" title="Health">
          <div style={{ width: '100%' }} />
        </div>
      </div>
      <div className="bar respect" title="Respect">
        <div style={{ width: `${(respect / totalRespect) * 100}%` }} />
      </div>
    </div>
  );
}

function DistrictName() {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let last: string | null = null;
    let tl: gsap.core.Timeline | null = null;
    const check = () => {
      const d = districtAt(live.px, live.pz);
      if (d === last || !el.current) return;
      last = d;
      el.current.textContent = d;
      tl?.kill();
      tl = gsap.timeline();
      tl.fromTo(el.current, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }).to(
        el.current,
        { opacity: 0, duration: 0.8, delay: 3.5 },
      );
    };
    check(); // announce the spawn zone once
    const id = setInterval(check, 500);
    return () => {
      clearInterval(id);
      tl?.kill();
    };
  }, []);
  return <div className="zone-name" ref={el} />;
}

function MissionPanel() {
  const activeMission = useGame((s) => s.activeMission);
  const closeMission = useGame((s) => s.closeMission);
  const panel = useRef<HTMLDivElement>(null);
  const mission = missions.find((m) => m.id === activeMission);

  useEffect(() => {
    if (!activeMission || !panel.current) return;
    blip();
    const q = gsap.utils.selector(panel.current);
    const tl = gsap.timeline();
    tl.fromTo('.bar-top', { yPercent: -100 }, { yPercent: 0, duration: 0.45, ease: 'power2.out' })
      .fromTo('.bar-bottom', { yPercent: 100 }, { yPercent: 0, duration: 0.45, ease: 'power2.out' }, '<')
      .fromTo(q('.m-title'), { x: -60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: 'power3.out' }, '-=0.1')
      .fromTo(q('.m-place'), { x: -40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.4 }, '-=0.3')
      .fromTo(q('.m-brief'), { opacity: 0 }, { opacity: 1, duration: 0.4 }, '-=0.2')
      .fromTo(q('.m-line'), { x: -30, opacity: 0 }, { x: 0, opacity: 1, duration: 0.35, stagger: 0.12 }, '-=0.1')
      .fromTo(q('.m-done'), { opacity: 0 }, { opacity: 1, duration: 0.3 });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        useGame.getState().closeMission();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      tl.kill();
    };
  }, [activeMission]);

  if (!mission) return null;
  return (
    <div className="mission-overlay" ref={panel}>
      <div className="bar-top" />
      <div className="bar-bottom" />
      <div className="mission-card">
        <div className="m-title">{mission.title}</div>
        <div className="m-place">{mission.place}</div>
        <div className="m-brief">{mission.brief}</div>
        <ul>
          {mission.lines.map((l, i) => (
            <li className="m-line" key={i}>
              {l}
            </li>
          ))}
        </ul>
        <button className="m-done" onClick={closeMission}>
          COMPLETE MISSION&nbsp;&nbsp;<span className="kbd">SPACE</span>
        </button>
      </div>
    </div>
  );
}

function PassedSplash() {
  const splash = useGame((s) => s.splash);
  const clearSplash = useGame((s) => s.clearSplash);
  const allDone = useGame((s) => s.allDone);
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!splash || !el.current) return;
    missionPassedSting();
    const m = missions.find((x) => x.title === splash);
    const tl = gsap.timeline({ onComplete: clearSplash });
    tl.fromTo(
      el.current.querySelector('.passed'),
      { scale: 2.6, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2)' },
    )
      .fromTo(
        el.current.querySelector('.passed-sub'),
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.4 },
        '-=0.15',
      )
      .to(el.current, { opacity: 0, duration: 0.6, delay: allDone ? 1.2 : 1.6 });
    return () => {
      tl.kill();
    };
  }, [splash, clearSplash, allDone]);

  if (!splash) return null;
  const m = missions.find((x) => x.title === splash);
  return (
    <div className="splash" ref={el}>
      <div className="passed">MISSION PASSED!</div>
      <div className="passed-sub">RESPECT +{m?.respect ?? 0}</div>
    </div>
  );
}

function FinaleSplash() {
  const allDone = useGame((s) => s.allDone);
  const splash = useGame((s) => s.splash);
  const el = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (allDone && !splash) {
      setShow(true);
    }
  }, [allDone, splash]);

  useEffect(() => {
    if (!show || !el.current) return;
    const tl = gsap.timeline();
    tl.fromTo(el.current, { opacity: 0 }, { opacity: 1, duration: 0.8 }).fromTo(
      el.current.querySelectorAll('.f-row'),
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, stagger: 0.18, ease: 'power3.out' },
    );
    return () => {
      tl.kill();
    };
  }, [show]);

  if (!show) return null;
  return (
    <div className="finale" ref={el} onClick={() => setShow(false)}>
      <div className="f-row f-big">100% COMPLETED</div>
      <div className="f-row f-name">{profile.name}</div>
      <div className="f-row f-sub">
        {profile.title} · {profile.company}
      </div>
      <div className="f-row f-contact">
        {profile.email} · {profile.phone} · {profile.location}
      </div>
      <div className="f-row f-hint">click anywhere to keep exploring · or read the plain resume at /resume</div>
    </div>
  );
}

function Hint() {
  const inCar = useGame((s) => s.inCar);
  return (
    <div className="hint">
      {inCar
        ? 'W/S drive · A/D steer · SPACE handbrake · E exit'
        : 'WASD move · SHIFT sprint · E enter car · walk into yellow markers'}
    </div>
  );
}

export default function Hud() {
  const started = useGame((s) => s.started);
  if (!started) return null;
  return (
    <>
      <div className="ps2-overlay" aria-hidden="true" />
      <div className="hud-tr">
        <WeaponBox />
        <Clock />
        <Money />
        <RespectBar />
        <Stars />
      </div>
      <div className="hud-bl">
        <Minimap />
      </div>
      <DistrictName />
      <Hint />
      <MissionPanel />
      <PassedSplash />
      <FinaleSplash />
    </>
  );
}
