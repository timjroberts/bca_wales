"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  dismissMapApplicationMode,
  INITIAL_MAP_APPLICATION_STATE,
  mapApplicationExitPlan,
  updateMapApplicationState,
  type MapApplicationExit,
  type MapApplicationState
} from "./mapApplicationState";

const applicationCopy = {
  en: {
    returnToTop: "Return to top",
    footer: "Footer & legal",
    active: "Application map mode active. Press Escape to return to the page top."
  },
  cy: {
    returnToTop: "Dychwelyd i’r brig",
    footer: "Troedyn a chyfreithiol",
    active: "Mae modd map y rhaglen yn weithredol. Pwyswch Escape i ddychwelyd i frig y dudalen."
  }
} as const;

function sameState(left: MapApplicationState, right: MapApplicationState): boolean {
  return left.pinned === right.pinned && left.dismissed === right.dismissed;
}

export function MapApplicationMode({
  language,
  area,
  children
}: {
  language: "en" | "cy";
  area: string;
  children: ReactNode;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<MapApplicationState>(INITIAL_MAP_APPLICATION_STATE);
  const [applicationState, setApplicationState] = useState<MapApplicationState>(INITIAL_MAP_APPLICATION_STATE);
  const c = applicationCopy[language];

  const commitState = useCallback((next: MapApplicationState) => {
    if (sameState(stateRef.current, next)) return;
    stateRef.current = next;
    setApplicationState(next);
  }, []);

  const dismiss = useCallback(() => {
    commitState(dismissMapApplicationMode());
  }, [commitState]);

  const exit = useCallback((destination: MapApplicationExit) => {
    dismiss();
    const plan = mapApplicationExitPlan(
      destination,
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );

    window.requestAnimationFrame(() => {
      if (destination === "top") {
        window.scrollTo({ top: 0, behavior: plan.behavior });
      } else {
        document.getElementById(plan.focusId)?.scrollIntoView({ block: "start", behavior: plan.behavior });
      }
      window.requestAnimationFrame(() => {
        document.getElementById(plan.focusId)?.focus({ preventScroll: true });
      });
    });
  }, [dismiss]);

  useEffect(() => {
    const measure = () => {
      const sentinel = sentinelRef.current;
      if (!sentinel) return;
      const viewport = window.visualViewport;
      commitState(updateMapApplicationState(stateRef.current, {
        viewportWidth: viewport?.width ?? window.innerWidth,
        viewportHeight: viewport?.height ?? window.innerHeight,
        sentinelTop: sentinel.getBoundingClientRect().top
      }));
    };

    const frame = window.requestAnimationFrame(measure);
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, [commitState]);

  useEffect(() => {
    if (!applicationState.pinned) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const target = event.target as HTMLElement | null;
      if (document.getElementById("source-details") || target?.matches("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      exit("top");
    };
    const onAnchorNavigation = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (target?.closest<HTMLAnchorElement>("a[href^='#']")) dismiss();
    };
    const onHashChange = () => dismiss();

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("click", onAnchorNavigation, true);
    window.addEventListener("hashchange", onHashChange);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("click", onAnchorNavigation, true);
      window.removeEventListener("hashchange", onHashChange);
    };
  }, [applicationState.pinned, dismiss, exit]);

  return (
    <div className="map-application-region" data-pinned={applicationState.pinned || undefined}>
      <div ref={sentinelRef} className="map-application-sentinel" aria-hidden="true" />
      <div className="map-application-frame">
        <header className="map-application-header">
          <button type="button" onClick={() => exit("top")}>
            <span aria-hidden="true">↑ </span>{c.returnToTop}
          </button>
          <p><span aria-hidden="true">⌖</span> {area}</p>
          <button type="button" onClick={() => exit("footer")}>
            {c.footer}<span aria-hidden="true"> ↓</span>
          </button>
        </header>
        {applicationState.pinned ? <p className="sr-only" aria-live="polite">{c.active}</p> : null}
        {children}
      </div>
    </div>
  );
}
