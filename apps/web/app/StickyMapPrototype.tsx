"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

export type StickyMapPrototypeVariant = "a" | "b" | "c";

const variants: readonly {
  id: StickyMapPrototypeVariant;
  name: string;
  summary: string;
}[] = [
  { id: "a", name: "Contained CSS sticky", summary: "Sticky for a bounded scroll region, then releases to the footer" },
  { id: "b", name: "Explicit application mode", summary: "Pins after the threshold until Return to top, Escape, or Footer is used" },
  { id: "c", name: "Hybrid floating shell", summary: "Sticky on roomy screens, natural document flow on narrow or short screens" }
];

function isVariant(value: string | null): value is StickyMapPrototypeVariant {
  return variants.some((variant) => variant.id === value);
}

export function prototypeVariantFromSearch(search: string): StickyMapPrototypeVariant {
  const value = new URLSearchParams(search).get("variant");
  return isVariant(value) ? value : "a";
}

export function StickyMapPrototype({
  variant,
  language,
  area,
  children,
  onVariantChange
}: {
  variant: StickyMapPrototypeVariant;
  language: "en" | "cy";
  area: string;
  children: ReactNode;
  onVariantChange: (variant: StickyMapPrototypeVariant) => void;
}) {
  // PROTOTYPE — three sticky-map behaviours on the existing route, switchable via ?variant=.
  const enabled = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_STICKY_MAP_PROTOTYPE === "1";
  const regionRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const applicationDismissedRef = useRef(false);
  const [thresholdReached, setThresholdReached] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pinCapable, setPinCapable] = useState(true);
  const applicationPinned = variant === "b" && pinCapable && pinned;

  useEffect(() => {
    if (!enabled) return;
    const update = () => {
      const sentinel = sentinelRef.current;
      const region = regionRef.current;
      const canPin = window.innerWidth > 760 && window.innerHeight >= 560;
      const sentinelTop = sentinel?.getBoundingClientRect().top ?? 1;
      const reached = Boolean(
        sentinel && region && sentinelTop <= 0 && region.getBoundingClientRect().bottom > 0
      );
      if (sentinelTop > 0) applicationDismissedRef.current = false;
      setPinCapable(canPin);
      setThresholdReached(reached);
      if (variant === "b" && canPin && reached && !applicationDismissedRef.current) setPinned(true);
    };
    const frame = window.requestAnimationFrame(update);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, [enabled, variant]);

  useEffect(() => {
    if (!applicationPinned) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      applicationDismissedRef.current = true;
      setPinned(false);
      window.requestAnimationFrame(() => {
        window.scrollTo({
          top: 0,
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
        });
        window.requestAnimationFrame(() => document.getElementById("page-top")?.focus({ preventScroll: true }));
      });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [applicationPinned]);

  function leavePinnedMode() {
    applicationDismissedRef.current = true;
    setPinned(false);
  }

  function focusAfterScroll(id: string) {
    window.requestAnimationFrame(() => {
      document.getElementById(id)?.focus({ preventScroll: true });
    });
  }

  function returnToTop() {
    leavePinnedMode();
    window.requestAnimationFrame(() => {
      window.scrollTo({
        top: 0,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
      });
      focusAfterScroll("page-top");
    });
  }

  function goToFooter() {
    leavePinnedMode();
    window.requestAnimationFrame(() => {
      document.getElementById("service-footer")?.scrollIntoView({ block: "start" });
      focusAfterScroll("service-footer");
    });
  }

  function cycle(direction: -1 | 1) {
    const currentIndex = variants.findIndex((item) => item.id === variant);
    const nextIndex = (currentIndex + direction + variants.length) % variants.length;
    applicationDismissedRef.current = false;
    setPinned(false);
    onVariantChange(variants[nextIndex]!.id);
  }

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      const direction = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
      if (!direction) return;
      const currentIndex = variants.findIndex((item) => item.id === variant);
      const nextIndex = (currentIndex + direction + variants.length) % variants.length;
      applicationDismissedRef.current = false;
      setPinned(false);
      onVariantChange(variants[nextIndex]!.id);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, onVariantChange, variant]);

  if (!enabled) return <>{children}</>;

  const current = variants.find((item) => item.id === variant)!;
  const mode = !pinCapable
    ? "mobile fallback · natural flow"
    : applicationPinned
      ? "pinned"
      : thresholdReached
        ? "sticky threshold reached"
        : "document flow";

  return (
    <>
      <div
        ref={regionRef}
        className={`prototype-map-region prototype-variant-${variant}${pinCapable ? "" : " prototype-compact-viewport"}`}
        data-pinned={applicationPinned || undefined}
      >
        <div ref={sentinelRef} className="prototype-sticky-sentinel" aria-hidden="true" />
        <div className="prototype-map-frame">
          <div className="prototype-stuck-header">
            <button type="button" onClick={returnToTop}>↑ {language === "en" ? "Return to top" : "Dychwelyd i’r brig"}</button>
            <p><span aria-hidden="true">⌖</span> {area}</p>
            <button type="button" onClick={goToFooter}>{language === "en" ? "Footer & legal" : "Troedyn a chyfreithiol"} ↓</button>
          </div>
          {children}
        </div>
      </div>

      <aside className="prototype-switcher" aria-label="Sticky map prototype variants">
        <button type="button" aria-label="Previous prototype variant" onClick={() => cycle(-1)}>←</button>
        <div aria-live="polite">
          <strong>{current.id.toUpperCase()} — {current.name}</strong>
          <span>{current.summary}</span>
          <small>State: {mode}</small>
        </div>
        <button type="button" aria-label="Next prototype variant" onClick={() => cycle(1)}>→</button>
      </aside>
    </>
  );
}
