'use client';

import type { AppDefinition } from '../../types';
import { ToolConsole } from './ToolConsole';

const BANNER = String.raw`
  aircrack-ng 1.7  —  802.11 WEP/WPA-PSK auditing suite

  ⚠  Simulation only — for portfolio/education. No radios, no real networks.
`;

interface FakeAp {
  bssid: string;
  pwr: number;
  ch: number;
  enc: 'WEP' | 'WPA2' | 'WPA3';
  essid: string;
  /** the "answer" the cracker pretends to recover */
  key: string;
}

const APS: FakeAp[] = [
  { bssid: '00:14:6C:7E:40:80', pwr: -42, ch: 6, enc: 'WEP', essid: 'linksys', key: '1F:1F:1F:1F:1F' },
  { bssid: '00:1D:7E:3A:91:2B', pwr: -58, ch: 11, enc: 'WPA2', essid: 'HomeNet_5G', key: 'sunshine99' },
  { bssid: 'E4:F4:C6:0D:AA:17', pwr: -67, ch: 1, enc: 'WPA2', essid: 'NETGEAR-guest', key: 'password123' },
  { bssid: 'A0:63:91:5C:DE:02', pwr: -71, ch: 9, enc: 'WPA3', essid: 'CorpWiFi', key: 'Tr0ub4dor&3' },
];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function showHelp(print: (t: string) => void) {
  print('Commands (simulated):');
  print('  airodump          scan the air for nearby access points');
  print('  airmon start      put wlan0 into monitor mode (wlan0mon)');
  print('  capture <bssid>   capture a 4-way handshake from a target AP');
  print('  aircrack <bssid>  crack the captured handshake against a wordlist');
  print('  clear / help      utility commands');
}

function dumpAps(print: (t: string) => void) {
  print(' BSSID              PWR  CH  ENC   ESSID');
  print(' ------------------ ---- --- ----- --------------------');
  APS.forEach((a) =>
    print(
      ` ${a.bssid}  ${String(a.pwr).padStart(3)}  ${String(a.ch).padStart(2)}  ${a.enc.padEnd(4)}  ${a.essid}`,
    ),
  );
}

async function airodump(print: (t: string) => void) {
  print('[*] Starting airodump-ng on wlan0mon ...');
  for (let i = 0; i < APS.length; i++) {
    await sleep(420);
    const a = APS[i];
    print(`    + beacon  ${a.bssid}  CH ${a.ch}  ${a.enc}  "${a.essid}"`);
  }
  await sleep(300);
  print('');
  dumpAps(print);
  print('');
  print('[*] ' + APS.length + ' stations seen. Pick one: capture <bssid>');
}

async function capture(bssid: string, print: (t: string) => void) {
  const ap = APS.find((a) => a.bssid.toLowerCase() === bssid.toLowerCase());
  if (!ap) {
    print('[-] No such BSSID in the (simulated) scan. Run airodump first.');
    return;
  }
  print(`[*] Locking to channel ${ap.ch}, BSSID ${ap.bssid} ("${ap.essid}")`);
  await sleep(500);
  print('[*] Sending deauth to encourage a client reconnect ... (simulated)');
  await sleep(600);
  print('[+] WPA handshake: ' + ap.bssid + '  (EAPOL 1/4 2/4 3/4 4/4 captured)');
  print(`[*] Written to /tmp/${ap.essid}-01.cap  —  now: aircrack ${ap.bssid}`);
}

async function crack(bssid: string, print: (t: string) => void) {
  const ap = APS.find((a) => a.bssid.toLowerCase() === bssid.toLowerCase());
  if (!ap) {
    print('[-] No capture file for that BSSID. Run capture <bssid> first.');
    return;
  }
  const total = 9822;
  print(`Opening /tmp/${ap.essid}-01.cap`);
  print(`Reading packets, please wait... (${ap.enc})`);
  await sleep(450);
  const keysPerSec = [612, 1180, 1740, 980];
  for (let step = 0; step < keysPerSec.length; step++) {
    await sleep(520);
    const tested = Math.floor((total / keysPerSec.length) * (step + 1));
    print(
      `  [00:00:0${step + 1}] ${tested}/${total} keys tested  (${keysPerSec[step]} k/s)`,
    );
  }
  await sleep(400);
  print('');
  print('                           KEY FOUND! [ ' + ap.key + ' ]');
  print('');
  const hex = ap.key
    .split('')
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
    .join(' ');
  print('   Master Key     : ' + hex.slice(0, 47).toUpperCase());
  print('   Decrypted EAPOL : 4 frames  |  Transient Key derived  (simulated)');
  print('');
  print('[i] Demo only — no key was actually recovered and no network was touched.');
}

async function handle(cmd: string, print: (t: string) => void) {
  const [c, ...rest] = cmd.split(/\s+/);
  const arg = (rest[0] ?? '').trim();
  switch (c) {
    case 'help':
    case '?':
      showHelp(print);
      break;
    case 'airmon':
    case 'airmon-ng':
      if (arg === 'start' || arg === '') {
        print('[*] Found 1 process that could cause trouble — ignored (simulation).');
        print('PHY   Interface  Driver       Chipset');
        print('phy0  wlan0      ath9k_htc    Atheros AR9271');
        print('       (monitor mode vif enabled for [phy0]wlan0 on [phy0]wlan0mon)');
      } else {
        print('Usage: airmon start');
      }
      break;
    case 'airodump':
    case 'airodump-ng':
      await airodump(print);
      break;
    case 'capture':
      if (!arg) print('Usage: capture <bssid>   (e.g. capture ' + APS[0].bssid + ')');
      else await capture(arg, print);
      break;
    case 'aircrack':
    case 'aircrack-ng':
    case 'crack':
      if (!arg) print('Usage: aircrack <bssid>   (capture a handshake first)');
      else await crack(arg, print);
      break;
    case 'clear':
    case 'banner':
      print(BANNER);
      break;
    default:
      print(`'${c}' is not a known command. Type 'help'.`);
  }
}

function Aircrack() {
  return (
    <ToolConsole
      banner={BANNER}
      prompt="root@kali:~#"
      intro="Type 'help'. Flow: airmon start → airodump → capture <bssid> → aircrack <bssid>"
      onCommand={handle}
    />
  );
}

export const aircrackApp: AppDefinition = {
  id: 'aircrack',
  title: 'aircrack-ng',
  icon: '📡',
  category: 'Wireless Attacks',
  component: Aircrack,
  description: 'WEP/WPA-PSK handshake cracking suite (simulation)',
  defaultSize: { width: 760, height: 480 },
  minSize: { width: 440, height: 300 },
  launchCommands: ['aircrack', 'aircrack-ng', 'airodump'],
};

export default Aircrack;
