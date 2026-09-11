/* ShortsCraft colour theme controller.
   Light is deliberately the product default. The preference is local to the
   device and is applied by the inline bootstrap in <head> before CSS paints.

   This binds every control marked data-theme-toggle rather than one element by
   id. The rail holds the desktop switch, but the rail is hidden on a phone, so
   a single-id binding meant the theme became unreachable on mobile — the one
   place where a person is most likely to be somewhere dark. Any number of
   switches can exist now; they all read and write the same preference and all
   restate their own label when it changes. */
(function () {
  "use strict";

  var root = document.documentElement;
  var meta = document.querySelector('meta[name="theme-color"]');

  function toggles() {
    return document.querySelectorAll("[data-theme-toggle], #themeToggle");
  }

  function current() {
    return root.dataset.theme === "dark" ? "dark" : "light";
  }

  function apply(theme, persist) {
    var next = theme === "dark" ? "dark" : "light";
    root.dataset.theme = next;
    root.style.colorScheme = next;
    if (meta) meta.setAttribute("content", next === "dark" ? "#11110f" : "#f7f7f5");

    Array.prototype.forEach.call(toggles(), function (button) {
      button.setAttribute("aria-pressed", String(next === "dark"));
      button.setAttribute("aria-label", next === "dark" ? "Switch to light theme" : "Switch to dark theme");
      button.title = next === "dark" ? "Use light theme" : "Use dark theme";
      // A switch that carries its own wording says which theme it will move
      // to, not which one is on — the icon already shows the current state.
      var label = button.querySelector("[data-theme-label]");
      if (label) label.textContent = next === "dark" ? "Light theme" : "Dark theme";
    });

    if (persist) {
      try { localStorage.setItem("sc_theme", next); } catch (err) {}
    }
    window.dispatchEvent(new CustomEvent("shortscraft:theme", { detail: { theme: next } }));
  }

  apply(current(), false);

  // Delegated, so a switch rendered after this script still works.
  document.addEventListener("click", function (ev) {
    var button = ev.target && ev.target.closest
      ? ev.target.closest("[data-theme-toggle], #themeToggle")
      : null;
    if (!button) return;
    ev.preventDefault();
    apply(current() === "dark" ? "light" : "dark", true);
  });
})();
