import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  suffix?: string;
  duration?: number;
}

export function AnimatedNumber({
  value,
  suffix = "",
  duration = 1400,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (started.current) return;
        if (entries.some((e) => e.isIntersecting)) {
          started.current = true;
          const startTime = performance.now();
          const tick = (now: number) => {
            const progress = Math.min(1, (now - startTime) / duration);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplay(Math.round(eased * value));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [value, duration]);

  return (
    <span ref={ref}>
      {display.toLocaleString("ru-RU")}
      {suffix}
    </span>
  );
}
