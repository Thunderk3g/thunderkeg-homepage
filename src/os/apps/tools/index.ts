import type { AppDefinition } from '../../types';
import { msfconsoleApp } from './msfconsole';
import { nmapApp } from './nmap';
import { sqlmapApp } from './sqlmap';
import { wiresharkApp } from './wireshark';
import { johnApp } from './john';
import { hashcatApp } from './hashcat';
import { aircrackApp } from './aircrack';
import { hydraApp } from './hydra';
import { niktoApp } from './nikto';
import { gobusterApp } from './gobuster';
import { burpsuiteApp } from './burpsuite';
import { whoisApp } from './whois';
import { reconngApp } from './recon';

/**
 * Simulated Kali security tools (educational, canned output only).
 */
export const toolApps: AppDefinition[] = [
  msfconsoleApp,
  nmapApp,
  sqlmapApp,
  wiresharkApp,
  johnApp,
  hashcatApp,
  aircrackApp,
  hydraApp,
  niktoApp,
  gobusterApp,
  burpsuiteApp,
  whoisApp,
  reconngApp,
];
