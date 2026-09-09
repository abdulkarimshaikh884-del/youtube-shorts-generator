/* ShortsCraft colour theme controller.
   Light is deliberately the product default. The preference is local to the
   device and is applied by the inline bootstrap in <head> before CSS paints. */
(function () {
  "use strict";

  var root = document.documentElement;
  var button = document.getElementById("themeToggle");
  var meta = document.querySelector('meta[name="theme-color"]');

  function current() {
    return root.dataset.theme === "dark" ? "dark" : "light";
  }

  function apply(theme, persist) {
    var next = theme === "dark" ? "dark" : "light";
    root.dataset.theme = next;
    root.style.colorScheme = next;
    if (meta) meta.setAttribute("content", next === "dark" ? "#11110f" : "#f7f7f5");
    if (button) {
      button.setAttribute("aria-pressed", String(next === "dark"));
      button.setAttribute("aria-label", next === "dark" ? "Switch to light theme" : "Switch to dark theme");
      button.title = next === "dark" ? "Use light theme" : "Use dark theme";
    }
    if (persist) {
      try { localStorage.setItem("sc_theme", next); } catch (err) {}
    }
    window.dispatchEvent(new CustomEvent("shortscraft:theme", { detail: { theme: next } }));
  }

  apply(current(), false);
  if (button) {
    button.addEventListener("click", function () {
      apply(current() === "dark" ? "light" : "dark", true);
    });
  }
})();
