"use client";

import { useEffect } from "react";

/**
 * Registers the service worker and sets up auto-update polling.
 * Checks for a new SW version every 60 seconds.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;
    let refreshing = false;

    // Reload the page when a new service worker takes over
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        registration = reg;
        console.log("[SW] Registered successfully");
      })
      .catch((err) => {
        console.error("[SW] Registration failed:", err);
      });

    // Auto-update: poll for new SW version every 60s
    const interval = setInterval(() => {
      registration?.update();
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

  return null;
}
