/* ============================================================
   MOBILE PATCH v3 — 5 fixes in one file
   1. Auto-scroll to video preview after generation
   2. Mobile video player controls (prev/play/next/sound/fullscreen)
   3. Landing page starting point fix (hero banner show/hide)
   4. Header sign-in button single row fix
   5. initVideoFirst scroll override (removes auto-scroll to tool)
   ============================================================ */
(() => {
  "use strict";

  const qs = (s, r = document) => r.querySelector(s);
  const isMobile = () => window.innerWidth <= 768;

  /* ── FIX 1: Override initVideoFirst scroll (removes jump to tool) ── */
  /* The original script.js scrolls to #videoGenerator on load.
     On mobile we want the page to start at the hero banner instead.
     We patch this by resetting scroll position after the timeout. */
  window.addEventListener("DOMContentLoaded", () => {
    if (!location.pathname.includes("/generator")) return;
    if (!isMobile()) return;

    // Override: after original 250ms scroll fires, scroll back to top
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "instant" });
    }, 260); // runs just after the original 250ms timeout
  });

  /* ── FIX 2: Auto-scroll to preview after Generate Video ── */
  window.addEventListener("DOMContentLoaded", () => {
    const generateBtn = qs("#generateVideoBtn");
    if (!generateBtn) return;

    generateBtn.addEventListener("click", () => {
      // Wait for setPreview to inject HTML into iframe
      setTimeout(() => {
        const previewCard = qs(".video-preview-card") || qs("#videoFrameWrap");
        if (!previewCard) return;

        // Only scroll if video was actually generated (not empty state)
        const emptyState = qs("#videoEmptyState");
        const isGenerated = emptyState && emptyState.classList.contains("hidden");
        if (!isGenerated) {
          // Poll until generated (max 8s)
          let tries = 0;
          const poll = setInterval(() => {
            tries++;
            const empty = qs("#videoEmptyState");
            if ((empty && empty.classList.contains("hidden")) || tries > 16) {
              clearInterval(poll);
              if (empty && empty.classList.contains("hidden")) {
                scrollToPreview();
              }
            }
          }, 500);
        } else {
          scrollToPreview();
        }
      }, 300);
    });

    function scrollToPreview() {
      const target = qs(".video-preview-card") || qs("#videoFrameWrap");
      if (!target) return;
      setTimeout(() => {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        // Show success toast
        if (window.scToast) window.scToast("Video ready! Preview below ⬇️", "success");
      }, 200);
    }
  });

  /* ── FIX 3: Mobile Video Player Controls ── */
  window.addEventListener("DOMContentLoaded", () => {
    if (!qs("#videoGenerator")) return;

    // Create control bar HTML
    const controlBar = document.createElement("div");
    controlBar.id = "mobileVideoControls";
    controlBar.className = "mobile-video-controls hidden";
    controlBar.innerHTML = `
      <button id="mvcPrev" class="mvc-btn" title="Previous slide">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/>
        </svg>
      </button>
      <button id="mvcPlay" class="mvc-btn mvc-play" title="Play / Pause">
        <svg id="mvcPlayIcon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        <svg id="mvcPauseIcon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="display:none">
          <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
        </svg>
      </button>
      <button id="mvcNext" class="mvc-btn" title="Next slide">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/>
        </svg>
      </button>
      <button id="mvcSound" class="mvc-btn" title="Toggle sound">
        <svg id="mvcSoundOnIcon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
        </svg>
        <svg id="mvcSoundOffIcon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
        </svg>
      </button>
      <button id="mvcFullscreen" class="mvc-btn" title="Fullscreen">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
        </svg>
      </button>
    `;

    // Insert control bar after video frame wrap
    const videoPreviewCard = qs(".video-preview-card");
    const frameWrap = qs("#videoFrameWrap");
    if (videoPreviewCard && frameWrap) {
      frameWrap.insertAdjacentElement("afterend", controlBar);
    }

    // State
    let isPlaying = true;
    let isMuted = false;

    // Helper: send postMessage to iframe
    function sendToFrame(type, data = {}) {
      const frame = qs("#videoPreviewFrame");
      if (frame && frame.contentWindow) {
        try {
          frame.contentWindow.postMessage({ type, ...data }, "*");
        } catch (e) {}
      }
    }

    // Show controls when video is generated
    const observer = new MutationObserver(() => {
      const empty = qs("#videoEmptyState");
      const controls = qs("#mobileVideoControls");
      if (!controls) return;
      if (empty && empty.classList.contains("hidden")) {
        controls.classList.remove("hidden");
        isPlaying = true;
        updatePlayIcon();
      } else {
        controls.classList.add("hidden");
      }
    });
    const emptyEl = qs("#videoEmptyState");
    if (emptyEl) observer.observe(emptyEl, { attributes: true, attributeFilter: ["class"] });

    function updatePlayIcon() {
      const playIcon = qs("#mvcPlayIcon");
      const pauseIcon = qs("#mvcPauseIcon");
      if (playIcon) playIcon.style.display = isPlaying ? "none" : "block";
      if (pauseIcon) pauseIcon.style.display = isPlaying ? "block" : "none";
    }

    function updateSoundIcon() {
      const onIcon = qs("#mvcSoundOnIcon");
      const offIcon = qs("#mvcSoundOffIcon");
      if (onIcon) onIcon.style.display = isMuted ? "none" : "block";
      if (offIcon) offIcon.style.display = isMuted ? "block" : "none";
    }

    // Button handlers
    qs("#mvcPrev")?.addEventListener("click", () => {
      sendToFrame("PREV_SLIDE");
    });

    qs("#mvcPlay")?.addEventListener("click", () => {
      isPlaying = !isPlaying;
      sendToFrame(isPlaying ? "PLAY" : "PAUSE");
      updatePlayIcon();
    });

    qs("#mvcNext")?.addEventListener("click", () => {
      sendToFrame("NEXT_SLIDE");
    });

    qs("#mvcSound")?.addEventListener("click", () => {
      isMuted = !isMuted;
      sendToFrame("TOGGLE_SOUND", { muted: isMuted });
      updateSoundIcon();
      // Also mute/unmute iframe directly
      const frame = qs("#videoPreviewFrame");
      if (frame && frame.contentDocument) {
        try {
          const videos = frame.contentDocument.querySelectorAll("video, audio");
          videos.forEach(v => { v.muted = isMuted; });
        } catch (e) {}
      }
    });

    qs("#mvcFullscreen")?.addEventListener("click", () => {
      const frameWrap = qs("#videoFrameWrap");
      const frame = qs("#videoPreviewFrame");
      // Try fullscreen on the iframe first, then the wrap
      const target = frame || frameWrap;
      if (!target) return;
      const rfs = target.requestFullscreen || target.webkitRequestFullscreen || target.mozRequestFullScreen;
      if (rfs) {
        rfs.call(target).catch(() => {
          // Fallback: open in new tab
          if (window.scToast) window.scToast("Opening in full screen tab...", "info");
          const w = window.open("", "_blank");
          if (w && window.VIDEO_STATE?.html) {
            w.document.write(window.VIDEO_STATE.html);
            w.document.close();
          } else if (w) {
            w.close();
            if (window.scToast) window.scToast("Generate a video first.", "error");
          }
        });
      } else {
        // No fullscreen API — open in new tab
        const openBtn = qs("#openVideoPreviewBtn");
        if (openBtn) openBtn.click();
      }
    });

    // Listen for messages from iframe (slide changed, ended, etc.)
    window.addEventListener("message", (e) => {
      if (e.data?.type === "SC_SLIDE_CHANGE") {
        // Could update slide counter in future
      }
      if (e.data?.type === "shortscraft-video-ended") {
        isPlaying = false;
        updatePlayIcon();
      }
    });
  });

  /* ── FIX 4: Ensure page starts at top on mobile hero ── */
  /* The mobile hero banner should already be shown via CSS display:block
     on mobile. This JS ensures the page starts at top even if something
     tries to scroll it down */
  if (isMobile() && location.pathname.includes("/generator")) {
    // Prevent any early scrolls for first 500ms
    const preventScroll = (e) => e.preventDefault();
    window.addEventListener("scroll", preventScroll, { passive: false });
    setTimeout(() => {
      window.removeEventListener("scroll", preventScroll);
      window.scrollTo({ top: 0, behavior: "instant" });
    }, 500);
  }

})();
