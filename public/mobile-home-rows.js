/* Move existing cards into independent phone carousels; never clone a card. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else if (root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', function () { factory(root.document, root); }, {once: true});
  } else factory(root.document, root);
}(typeof window === 'object' ? window : this, function initializeHomeRows(document, window) {
  'use strict';
  if (!document || !document.body.classList.contains('page-home') || !window.matchMedia) return null;
  var media = window.matchMedia('(max-width: 640px)');
  var sections = [
    ['gallery', '.sh-tile', 3, 'Animation templates'],
    ['homeDesignsGrid', '.ds-card', 2, 'Design templates'],
    ['homeTutList', '.sh-tut-card', 2, 'Creator tutorials']
  ].map(function (config) {
    var box = document.getElementById(config[0]);
    return box ? {box: box, selector: config[1], count: config[2], name: config[3], cards: [], rows: []} : null;
  }).filter(Boolean);
  if (!sections.length) return null;
  var observer;
  var stopped = false;

  function arrange(section) {
    var box = section.box;
    var present = Array.prototype.slice.call(box.querySelectorAll(section.selector));
    // Keep canonical order through hide/show; a complete renderer repaint replaces it.
    section.cards = section.cards.filter(function (card) { return present.indexOf(card) !== -1; });
    present.forEach(function (card) { if (section.cards.indexOf(card) === -1) section.cards.push(card); });
    if (!media.matches) {
      if (!section.rows.length) return;
      section.cards.forEach(function (card) { box.appendChild(card); });
      section.rows.forEach(function (row) { row.remove(); });
      section.rows = [];
      box.classList.remove('mc-independent-rows');
      return;
    }
    box.classList.add('mc-independent-rows');
    // A renderer may have replaced innerHTML while requests were in flight.
    section.rows = section.rows.filter(function (row) { return row.parentElement === box; });
    while (section.rows.length < section.count) {
      var row = document.createElement('div');
      row.className = 'mc-card-row';
      row.tabIndex = 0;
      row.setAttribute('role', 'region');
      row.setAttribute('aria-label', section.name + ', row ' + (section.rows.length + 1));
      section.rows.push(row);
      box.appendChild(row);
    }
    var visible = section.cards.filter(function (card) { return !card.hidden; });
    var offset = 0;
    section.rows.forEach(function (row, index) {
      var size = Math.floor(visible.length / section.count) + (index < visible.length % section.count ? 1 : 0);
      var group = visible.slice(offset, offset + size);
      offset += size;
      group.forEach(function (card, position) {
        if (row.children[position] !== card) row.insertBefore(card, row.children[position] || null);
      });
      row.hidden = !size;
    });
    section.cards.filter(function (card) { return card.hidden; }).forEach(function (card) {
      if (card.parentElement !== box) box.appendChild(card);
    });
  }

  function update() {
    if (stopped) return;
    if (observer) observer.disconnect();
    sections.forEach(arrange);
    if (observer) sections.forEach(function (section) {
      observer.observe(section.box, {childList: true, subtree: true, attributes: true, attributeFilter: ['hidden']});
    });
  }
  if (window.MutationObserver) observer = new window.MutationObserver(update);
  if (media.addEventListener) media.addEventListener('change', update);
  else media.addListener(update);
  update();
  return {
    refresh: update,
    destroy: function () {
      if (observer) observer.disconnect();
      if (media.removeEventListener) media.removeEventListener('change', update);
      else media.removeListener(update);
      // Restore actual nodes and their listeners in canonical desktop order.
      sections.forEach(function (section) {
        section.cards.forEach(function (card) { section.box.appendChild(card); });
        section.rows.forEach(function (row) { row.remove(); });
        section.box.classList.remove('mc-independent-rows');
      });
      stopped = true;
    }
  };
}));
