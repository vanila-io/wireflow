"use client";

import { useEffect, useRef, type ReactNode } from "react";
import "./anim.css";

// Holds an animated illustration and pauses its CSS animations (anim.css,
// data-paused) while it is off screen or the tab is hidden, so they cost
// nothing there. Nothing runs per frame: an IntersectionObserver and the
// visibilitychange event only flip the attribute. Before this has run (or
// without IntersectionObserver) the animations simply play.
export default function PlayWhenVisible({
  children,
  className = "",
  testId,
}: {
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let onScreen = true;
    const update = () => el.toggleAttribute("data-paused", !onScreen || document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      update();
    });
    observer.observe(el);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return (
    <div ref={ref} className={`wf-anim ${className}`} data-testid={testId}>
      {children}
    </div>
  );
}
