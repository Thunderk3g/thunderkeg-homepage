'use client';

import { useState } from 'react';
import type { AppDefinition, AppProps } from '../../types';

const KEYS = [
  ['C', '±', '%', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '−'],
  ['1', '2', '3', '+'],
  ['0', '.', '⌫', '='],
];

function CalculatorApp() {
  const [expr, setExpr] = useState('');
  const [result, setResult] = useState('0');

  const press = (k: string) => {
    if (k === 'C') {
      setExpr('');
      setResult('0');
    } else if (k === '⌫') {
      setExpr((e) => e.slice(0, -1));
    } else if (k === '=') {
      setResult(evaluate(expr));
    } else if (k === '±') {
      setExpr((e) => (e.startsWith('-') ? e.slice(1) : '-' + e));
    } else {
      const map: Record<string, string> = { '÷': '/', '×': '*', '−': '-', '%': '%' };
      setExpr((e) => e + (map[k] ?? k));
    }
  };

  return (
    <div className="kos-calc">
      <div className="kos-calc-display">
        <div className="kos-calc-expr">{expr || ' '}</div>
        <div className="kos-calc-result">{result}</div>
      </div>
      <div className="kos-calc-keys">
        {KEYS.flat().map((k) => (
          <button
            key={k}
            className={'kos-calc-key' + (['÷', '×', '−', '+', '='].includes(k) ? ' op' : '')}
            onClick={() => press(k)}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}

function evaluate(expr: string): string {
  if (!expr.trim()) return '0';
  if (!/^[-+*/%.()0-9\s]+$/.test(expr)) return 'Error';
  try {
    // eslint-disable-next-line no-new-func
    const val = Function(`"use strict"; return (${expr})`)();
    if (typeof val !== 'number' || !isFinite(val)) return 'Error';
    return String(Math.round(val * 1e10) / 1e10);
  } catch {
    return 'Error';
  }
}

export const calculatorApp: AppDefinition = {
  id: 'calculator',
  title: 'Calculator',
  icon: '🧮',
  category: 'Accessories',
  component: CalculatorApp,
  description: 'Basic calculator',
  defaultSize: { width: 300, height: 420 },
  minSize: { width: 240, height: 360 },
  launchCommands: ['calc', 'calculator', 'galculator'],
};

export default CalculatorApp;
