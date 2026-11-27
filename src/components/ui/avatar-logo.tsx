"use client";

import { useEffect, useRef, useState } from "react";

interface AvatarLogoProps {
  size?: number;
  className?: string;
  mood?: "idle" | "happy" | "working";
}

/**
 * Mascote geometrico recortado (sem fundo preto) inspirado no open-bot-avatar:
 * apenas o bichinho com olhos em pilula que seguem o cursor e piscam.
 */
export function AvatarLogo({ size = 36, className = "", mood = "idle" }: AvatarLogoProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const el = svgRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const max = 4.2;
      const factor = Math.min(1, dist / 240);
      setLook({
        x: (dx / dist) * max * factor,
        y: (dy / dist) * max * factor,
      });
    }

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setBlink(true);
      window.setTimeout(() => setBlink(false), 140);
    }, 4400);
    return () => window.clearInterval(id);
  }, []);

  const eyeHeight = blink ? 2.5 : mood === "happy" ? 10 : 14;
  const eyeY = blink ? 52 : mood === "happy" ? 47 : 45;

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox="12 4 76 82"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Mascote Pega-Oferta"
    >
      {/* Antena */}
      <rect x="46" y="10" width="8" height="14" rx="4" fill="#D94E0F" />
      <circle cx="50" cy="11" r="6.5" fill="#F06526" />

      {/* Corpo do bichinho (fundo 100% transparente) */}
      <rect x="16" y="23" width="68" height="60" rx="22" fill="#F06526" />

      {/* Visor interno */}
      <rect x="24" y="34" width="52" height="36" rx="14" fill="#111318" />

      {/* Olhos em pilula com tracking de cursor */}
      <g
        style={{
          transform: `translate(${look.x.toFixed(2)}px, ${look.y.toFixed(2)}px)`,
          transition: "transform 90ms ease-out",
        }}
      >
        <rect
          x="34"
          y={eyeY}
          width="9"
          height={eyeHeight}
          rx="4.5"
          fill="#FFFFFF"
          style={{ transition: "height 80ms ease, y 80ms ease" }}
        />
        <rect
          x="57"
          y={eyeY}
          width="9"
          height={eyeHeight}
          rx="4.5"
          fill="#FFFFFF"
          style={{ transition: "height 80ms ease, y 80ms ease" }}
        />
      </g>

      {/* Micro-sorriso */}
      <rect x="45" y="75" width="10" height="3.5" rx="1.75" fill="#111318" opacity="0.35" />
    </svg>
  );
}
