"use client";

import { animate, stagger } from "animejs";
import { useEffect, useRef } from "react";

export function Reveal({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    animate(ref.current.querySelectorAll("[data-reveal]"), {
      translateY: [10, 0],
      opacity: [0, 1],
      delay: stagger(55),
      duration: 420,
      easing: "outQuad"
    });
  }, []);

  return <div ref={ref}>{children}</div>;
}
