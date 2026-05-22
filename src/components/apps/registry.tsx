import type { AppKind } from "@/types/window";

import TerminalApp from "./terminal/TerminalApp";
import VoiceApp from "./voice/VoiceApp";
import ResumeApp from "./resume/ResumeApp";
import ProjectsApp from "./projects/ProjectsApp";
import AboutApp from "./about/AboutApp";
import SocialApp from "./social/SocialApp";
import TetrisApp from "./games/tetris/TetrisApp";
import DoomApp from "./games/doom/DoomApp";
import Mp3App from "./media/mp3/Mp3App";
import VlcApp from "./media/video/VlcApp";

export const APP_REGISTRY: Record<AppKind, React.ComponentType> = {
  terminal: TerminalApp,
  voice:    VoiceApp,
  resume:   ResumeApp,
  projects: ProjectsApp,
  about:    AboutApp,
  social:   SocialApp,
  tetris:   TetrisApp,
  doom:     DoomApp,
  mp3:      Mp3App,
  vlc:      VlcApp,
};
