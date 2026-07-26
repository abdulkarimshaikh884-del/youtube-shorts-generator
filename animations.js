/* ============================================================
   ShortsCraft — Premium Motion Layer
   Additive, self-contained scroll-reveal + micro-interaction
   engine for marketing pages (index, pricing, about, contact).
   Does NOT touch script.js or app/studio pages.
   ============================================================ */
(function () {
  "use strict";

  var prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ── 1. Scroll-reveal (IntersectionObserver) ────────────── */
  function initScrollReveal() {
    var selectors = [
      ".hero-copy > *",
      ".sec-head",
      ".strip-inner > div",
      ".bento-card",
      ".flow li",
      ".price-card",
      ".faq details",
      ".seo-card",
      ".seo-mini > div",
      ".info-card",
      ".form-card",
      ".final-cta .cta-card",
      ".legal-card",
      ".lp-hero-copy > *",
      ".lp-mock",
      ".lp-head",
      ".lp-stat",
      ".lp-card",
      ".lp-tile",
      ".lp-step",
      ".lp-plan",
      ".lp-quote",
      ".lp-faq details",
      ".lp-final-card",
    ];

    var nodes = document.querySelectorAll(selectors.join(","));
    if (!nodes.length) return;

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      nodes.forEach(function (el) {
        el.classList.add("is-visible");
      });
      return;
    }

    nodes.forEach(function (el, i) {
      el.classList.add("reveal");
      // Stagger within each parent group for a cascading feel
      var group = el.parentElement;
      var siblingIndex = group
        ? Array.prototype.indexOf.call(group.children, el)
        : i;
      el.style.transitionDelay = Math.min(siblingIndex * 70, 420) + "ms";
    });

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    );

    nodes.forEach(function (el) {
      observer.observe(el);
    });
  }

  /* ── 2. Card tilt / magnetic hover ──────────────────────── */
  function initCardTilt() {
    if (prefersReducedMotion) return;
    // Only enable on pointer-fine devices (desktop mouse), skip touch
    if (!window.matchMedia("(pointer: fine)").matches) return;

    var cards = document.querySelectorAll(
      ".bento-card, .price-card, .seo-card, .info-card"
    );

    cards.forEach(function (card) {
      var rect = null;
      var raf = null;

      function onMove(e) {
        if (raf) return;
        raf = requestAnimationFrame(function () {
          rect = card.getBoundingClientRect();
          var px = (e.clientX - rect.left) / rect.width;
          var py = (e.clientY - rect.top) / rect.height;
          var tiltX = (py - 0.5) * -6;
          var tiltY = (px - 0.5) * 6;

          card.style.setProperty("--mx", px * 100 + "%");
          card.style.setProperty("--my", py * 100 + "%");
          card.style.transform =
            "perspective(900px) rotateX(" +
            tiltX.toFixed(2) +
            "deg) rotateY(" +
            tiltY.toFixed(2) +
            "deg) translateY(-4px)";
          raf = null;
        });
      }

      function onLeave() {
        card.style.transform = "";
      }

      card.addEventListener("mousemove", onMove);
      card.addEventListener("mouseleave", onLeave);
    });
  }

  /* ── 3. Hero aurora parallax (mouse + scroll) ───────────── */
  function initHeroParallax() {
    if (prefersReducedMotion) return;
    var blobs = document.querySelectorAll(
      ".hero .aurora-blob, .hero ~ .aurora .aurora-blob, .aurora .aurora-blob"
    );
    if (!blobs.length) return;

    var isFine = window.matchMedia("(pointer: fine)").matches;

    if (isFine) {
      var raf = null;
      window.addEventListener("mousemove", function (e) {
        if (raf) return;
        raf = requestAnimationFrame(function () {
          var xPct = e.clientX / window.innerWidth - 0.5;
          var yPct = e.clientY / window.innerHeight - 0.5;
          blobs.forEach(function (blob, i) {
            var depth = (i + 1) * 10;
            blob.style.translate =
              xPct * depth + "px " + yPct * depth + "px";
          });
          raf = null;
        });
      });
    }

    // Subtle scroll parallax as well
    var scrollRaf = null;
    window.addEventListener("scroll", function () {
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(function () {
        var y = window.scrollY;
        blobs.forEach(function (blob, i) {
          var depth = (i + 1) * 0.04;
          blob.style.marginTop = -(y * depth) + "px";
        });
        scrollRaf = null;
      });
    });
  }

  /* ── 4. Button ripple / press feedback ──────────────────── */
  function initButtonPress() {
    var buttons = document.querySelectorAll(
      ".btn-primary, .btn-ghost, .btn-google"
    );
    buttons.forEach(function (btn) {
      btn.addEventListener("pointerdown", function () {
        btn.style.transform = "translateY(0) scale(0.97)";
      });
      ["pointerup", "pointerleave", "pointercancel"].forEach(function (evt) {
        btn.addEventListener(evt, function () {
          btn.style.transform = "";
        });
      });
    });
  }

  function init() {
    initScrollReveal();
    initCardTilt();
    initHeroParallax();
    initButtonPress();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
