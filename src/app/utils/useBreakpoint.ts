import { useState, useEffect } from "react";

export type Breakpoint = "mobile" | "tablet" | "desktop";

const TABLET_MIN_WIDTH = 768;
const DESKTOP_MIN_WIDTH = 1280;

function readBreakpoint(): Breakpoint {
  const width = window.innerWidth;
  if (width < TABLET_MIN_WIDTH) return "mobile";
  if (width < DESKTOP_MIN_WIDTH) return "tablet";
  return "desktop";
}

export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState(readBreakpoint);

  useEffect(() => {
    function onResize() {
      setBreakpoint(readBreakpoint());
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return breakpoint;
}
