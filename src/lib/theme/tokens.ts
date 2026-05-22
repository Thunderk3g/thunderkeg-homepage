import { tokens as raw } from "./tokens.cjs";

export const tokens = raw as {
  color: Record<string, string>;
  font: Record<string, string>;
  radius: Record<string, string>;
  shadow: Record<string, string>;
};

export type ThemeTokens = typeof tokens;
