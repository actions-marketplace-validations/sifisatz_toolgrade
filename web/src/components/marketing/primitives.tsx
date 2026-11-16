"use client";

import { domAnimation, LazyMotion, MotionConfig } from "motion/react";
import {
  type CSSProperties,
  type ElementType,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

/** Lazy-loaded Motion features (~5 kB upfront) and the user's reduced-motion preference. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}

/** True once the element has scrolled into view (fires once). */
export function useInViewOnce<T extends Element>(margin = "0px 0px -15% 0px") {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margin, seen]);
  return [ref, seen] as const;
}

/**
 * Wraps a block whose CSS micro-animations (.seq, .grow-x, .draw, ...) should play once it is
 * on screen. Without JS or with reduced motion the final state shows (see marketing.css).
 */
export function InView({
  as: Tag = "div",
  className,
  style,
  children,
}: {
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const [ref, seen] = useInViewOnce<HTMLDivElement>();
  return (
    <Tag
      ref={ref}
      data-animate=""
      data-inview={seen ? "" : undefined}
      className={className}
      style={style}
    >
      {children}
    </Tag>
  );
}

/** Card with a border/glow spotlight that follows the pointer (pure CSS vars, no re-render). */
export function Spotlight({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`spotlight ${className ?? ""}`}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--x", `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty("--y", `${e.clientY - r.top}px`);
      }}
    >
      {children}
    </div>
  );
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(q.matches);
    const on = () => setReduced(q.matches);
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** Counts from 0 to `to` once `start` is true; jumps straight to `to` under reduced motion. */
export function useCountUp(to: number, start: boolean, durationMs = 1400) {
  const reduced = usePrefersReducedMotion();
  const [value, setValue] = useState(to);
  useEffect(() => {
    if (!start || reduced) {
      setValue(to);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / durationMs);
      setValue(to * (1 - (1 - p) ** 3));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    setValue(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, start, reduced, durationMs]);
  return value;
}
