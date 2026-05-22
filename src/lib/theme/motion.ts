import type { Transition } from "framer-motion";

export const motion = {
  snap: { duration: 0.15, ease: [0.2, 0.8, 0.2, 1] } satisfies Transition,
  glide: { duration: 0.25, ease: [0.2, 0.8, 0.2, 1] } satisfies Transition,
  pulse: {
    duration: 1.2,
    ease: "easeInOut",
    repeat: Infinity,
    repeatType: "reverse",
  } satisfies Transition,
};
