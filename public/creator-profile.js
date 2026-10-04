/* ============================================================
   ShortsCraft — Creator Profile Page Logic (creator-profile.js)
   - Loads creator banner, stats, bio and published templates
   ============================================================ */
(function () {
  "use strict";

  function $(sel, root) { return (root || document).querySelector(sel); }
  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var params = new URLSearchParams(window.location.search);
  var handle = (params.get("handle") || "shortscraft").replace(/^@/, "");
  var currentCreator = null;

  function mountStage(tile) {
    if (!tile || tile.dataset.mounted === "1" || !window.SC_TPL2) return;
    var stage = tile.querySelector(".sh-stage");
    if (!stage) return;

    var html = "";
    try {
      var opts = { aspect: "9:16" };
      if (tile.dataset.comm === "1") {
        try { opts.lines = JSON.parse(tile.dataset.lines || "[]"); } catch (e) { opts.lines = []; }
        opts.accent = tile.dataset.accent || "#ffffff";
        opts.font = tile.dataset.font || "inter";
        opts.dur = Number(tile.dataset.dur) || 4600;
      }
      html = window.SC_TPL2.build(tile.dataset.tpl, opts);
    } catch (e) {}
    if (!html) return;

    var frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("scrolling", "no");
    frame.setAttribute("tabindex", "-1");
    frame.srcdoc = html;

    var sk = stage.querySelector(".sh-skel");
    frame.addEventListener("load", function () {
      if (sk && sk.parentNode) sk.remove();
    });
    setTimeout(function () {
      if (sk && sk.parentNode) sk.remove();
    }, 400);

    stage.appendChild(frame);
    tile.dataset.mounted = "1";
  }

  function loadCreator() {
    var ctrl = ("AbortController" in window) ? new AbortController() : null;
    var bail = setTimeout(function () { if (ctrl) ctrl.abort(); }, 8_000);
    fetch("/api/creator?handle=" + encodeURIComponent(handle), ctrl ? { signal: ctrl.signal } : undefined)
      .then(function (r) {
        if (!r.ok) {
          var err = new Error(r.status === 404 ? "Creator not found" : "Creator profiles are temporarily unavailable");
          err.status = r.status;
          throw err;
        }
        return r.json();
      })
      .then(function (d) {
        var c = (d && d.creator) || {};
        var commTpls = (d && d.communityTemplates) || [];
        renderProfile(c, commTpls);
      })
      .catch(function (err) {
        renderUnavailable(err && err.status === 404);
      })
      .finally(function () { clearTimeout(bail); });
  }

  function renderUnavailable(notFound) {
    document.title = (notFound ? "Creator not found" : "Creator unavailable") + " — ShortsCraft";
    var nm = $("#creatorName");
    var hd = $("#creatorHandle");
    var bi = $("#creatorBio");
    var grid = $("#creatorGrid");
    if (nm) nm.textContent = notFound ? "Creator not found" : "Profiles temporarily unavailable";
    if (hd) hd.textContent = "@" + handle;
    if (bi) bi.textContent = notFound
      ? "This creator profile does not exist or has been renamed."
      : "Please try again in a moment.";
    if (grid) grid.innerHTML = '<div class="cr-cre-empty"><h3>'
      + (notFound ? "No profile at this address" : "Could not load this profile")
      + '</h3><p><a href="/community">Browse Community templates</a></p></div>';
  }

  function renderProfile(c, commTpls) {
    currentCreator = c;
    document.title = c.name + " (" + c.handle + ") — ShortsCraft Creator";

    var av = $("#creatorAvatar");
    if (av) {
      av.textContent = c.avatarUrl ? "" : (c.initials || "CR");
      av.style.backgroundImage = c.avatarUrl ? 'url("' + c.avatarUrl + '")' : "";
      av.style.backgroundSize = "cover";
      av.style.backgroundPosition = "center";
    }

    var nm = $("#creatorName");
    if (nm) nm.textContent = c.name;

    var hd = $("#creatorHandle");
    if (hd) hd.textContent = c.handle;

    var bi = $("#creatorBio");
    if (bi) bi.textContent = c.bio;
    var verified = $("#creatorVerified");
    if (verified) verified.hidden = c.verified !== true;
    if ($("#creatorFollowers")) $("#creatorFollowers").textContent = String(Number(c.followers) || 0);
    if ($("#creatorFollowing")) $("#creatorFollowing").textContent = String(Number(c.following) || 0);
    if ($("#creatorStars")) $("#creatorStars").textContent = String(Number(c.stars) || 0);
    setupCreatorActions(c);

    // Gather all templates associated with this creator
    var e = window.SC_TPL2;
    var allTpls = [];

    if (handle === "shortscraft" || !handle) {
      if (e) {
        allTpls = e.list().map(function (t) {
          return {
            tpl: t.id,
            name: t.name,
            desc: t.desc,
            cat: t.cat,
            likes: 0
          };
        });
      }
    }

    commTpls.forEach(function (ct) {
      allTpls.unshift({
        tpl: ct.tpl || "text-cascade",
        name: ct.title || "Community Template",
        desc: ct.description || "Custom creator design",
        cat: ct.category || "text",
        likes: Number(ct.likes || 0),
        isComm: true,
        commId: ct.id,
        lines: ct.lines || [],
        accent: ct.accent || "#ffffff",
        font: ct.font || "inter",
        dur: ct.dur || 4600
      });
    });

    var totalLikes = allTpls.reduce(function (sum, t) { return sum + (Number(t.likes) || 0); }, 0);
    var lk = $("#creatorLikes");
    if (lk) lk.textContent = String(totalLikes);

    var countEl = $("#creatorTplCount");
    if (countEl) countEl.textContent = String(allTpls.length);

    var grid = $("#creatorGrid");
    if (!grid) return;
    grid.innerHTML = "";
    if (!allTpls.length) {
      grid.innerHTML = '<div class="cr-cre-empty"><h3>No published templates yet</h3><p>This creator has not shared a community template.</p></div>';
      return;
    }

    var frag = document.createDocumentFragment();
    allTpls.forEach(function (t) {
      var detailUrl = "/template?id=" + encodeURIComponent(t.tpl);
      if (t.isComm) detailUrl += "&comm=1&commId=" + encodeURIComponent(t.commId);

      var tile = document.createElement("article");
      tile.className = "sh-tile";
      tile.dataset.tpl = t.tpl;
      if (t.isComm) {
        tile.dataset.comm = "1";
        tile.dataset.lines = JSON.stringify(t.lines || []);
        tile.dataset.accent = t.accent;
        tile.dataset.font = t.font;
        tile.dataset.dur = t.dur;
      }

      var editUrl = "/editor?tpl=" + encodeURIComponent(t.tpl);
      if (t.isComm) editUrl += "&accent=" + encodeURIComponent(t.accent) + "&font=" + encodeURIComponent(t.font)
        + "&dur=" + encodeURIComponent(t.dur) + "&lines=" + encodeURIComponent(JSON.stringify(t.lines || []))
        + "&commId=" + encodeURIComponent(t.commId || "");

      tile.innerHTML = [
        '<div class="sh-stage">',
        '  <a href="' + detailUrl + '" class="sh-stage-link" aria-label="View ' + escapeHtml(t.name) + '"></a>',
        '  <span class="sh-skel">Preview</span>',
        '</div>',
        /* Preview and title only, matching the gallery. This page used to add
           hover controls over the artwork, a clamped description and a
           like/comment/share row, so the same template looked like a
           different product depending on where you found it - and at phone
           width that extra row was 60px wider than the card holding it. */
        '<div class="sh-tmeta">',
        '  <div class="sh-ttitle-row"><a href="' + detailUrl + '" class="sh-ttitle">' + escapeHtml(t.name) + '</a></div>',
        '</div>'
      ].join("");

      // The card no longer carries a play button; the preview loops on its own.
      var playB = tile.querySelector(".sh-card-btn.play");
      if (playB) {
        playB.addEventListener("click", function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          mountStage(tile);
        });
      }

      frag.appendChild(tile);
    });

    grid.appendChild(frag);

    // Lazy mount
    var tiles = Array.prototype.slice.call(grid.children);
    tiles.slice(0, 8).forEach(mountStage);

    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) mountStage(en.target);
        });
      }, { rootMargin: "600px 0px" });
      tiles.forEach(function (t) { io.observe(t); });
    }
  }

  function setupCreatorActions(c) {
    var wrap = $("#creatorActions");
    var selfWrap = $("#creatorSelfActions");
    var follow = $("#creatorFollowBtn");
    var star = $("#creatorStarBtn");
    var followersBtn = $("#creatorFollowersBtn");
    var followingBtn = $("#creatorFollowingBtn");

    // Attach click handlers to stats buttons for followers / following modal
    if (followersBtn) {
      followersBtn.onclick = function () {
        openFollowsModal("followers", c);
      };
    }
    if (followingBtn) {
      followingBtn.onclick = function () {
        openFollowsModal("following", c);
      };
    }

    if (!c.id) {
      if (wrap) wrap.hidden = true;
      if (selfWrap) selfWrap.hidden = true;
      return;
    }

    // STRICT RULE: If the viewer is the creator themselves:
    // They CANNOT follow or send stars to themselves.
    // Show "Edit Profile", hide Follow and Send Stars.
    if (c.viewerIsSelf) {
      if (wrap) wrap.hidden = true;
      if (selfWrap) selfWrap.hidden = false;
      return;
    }

    // Otherwise, viewer is another user (or guest) looking at this creator:
    if (selfWrap) selfWrap.hidden = true;
    if (wrap) wrap.hidden = false;
    if (follow) follow.hidden = false;
    if (star) star.hidden = false;

    // Set initial follow button state
    follow.dataset.active = c.followedByMe ? "1" : "0";
    follow.textContent = c.followedByMe ? "Following" : "Follow";
    follow.classList.toggle("is-following", c.followedByMe === true);

    follow.onclick = function () {
      var active = follow.dataset.active === "1";
      var nextActive = !active;

      // Optimistic UI update
      follow.disabled = true;
      follow.dataset.active = nextActive ? "1" : "0";
      follow.textContent = nextActive ? "Following" : "Follow";
      follow.classList.toggle("is-following", nextActive);

      var followersEl = $("#creatorFollowers");
      var currentCount = Number(followersEl ? followersEl.textContent : 0) || 0;
      if (followersEl) {
        followersEl.textContent = String(Math.max(0, currentCount + (nextActive ? 1 : -1)));
      }

      fetch("/api/creators/" + encodeURIComponent(c.id) + "/follow", {
        method: active ? "DELETE" : "POST"
      })
        .then(function (r) {
          if (r.status === 401) {
            window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname + window.location.search);
            throw new Error("Please log in to follow creators.");
          }
          return r.json().then(function (j) {
            if (!r.ok || !j.success) throw new Error(j.error || "Could not update follow.");
            return j;
          });
        })
        .then(function (j) {
          follow.dataset.active = j.active ? "1" : "0";
          follow.textContent = j.active ? "Following" : "Follow";
          follow.classList.toggle("is-following", j.active === true);
          if (followersEl && j.followers != null) {
            followersEl.textContent = String(Number(j.followers) || 0);
          }
          if (window.SC_UI && SC_UI.toast) {
            SC_UI.toast(j.active ? "Following " + (c.handle || c.name) : "Unfollowed " + (c.handle || c.name));
          }
        })
        .catch(function (err) {
          // Revert optimistic update
          follow.dataset.active = active ? "1" : "0";
          follow.textContent = active ? "Following" : "Follow";
          follow.classList.toggle("is-following", active);
          if (followersEl) followersEl.textContent = String(currentCount);
          if (window.SC_UI && SC_UI.toast) SC_UI.toast(err.message, true);
        })
        .finally(function () {
          follow.disabled = false;
        });
    };

    star.onclick = function () {
      if (window.SC_UI) SC_UI.toast("Stars donations are Coming Soon.");
    };
    star.disabled = true;
    star.textContent = "Stars — Coming Soon";
  }

  function openFollowsModal(kind, c) {
    var modal = $("#followsModal");
    var title = $("#followsModalTitle");
    var list = $("#followsModalList");
    var closeBtn = $("#followsModalClose");
    if (!modal || !list) return;

    var isFollowing = kind === "following";
    if (title) title.textContent = isFollowing ? "Following" : "Followers";
    list.innerHTML = '<div class="sc-people-empty"><span class="sh-skel" style="display:inline-block;padding:8px 16px;border-radius:8px;">Loading...</span></div>';
    modal.hidden = false;

    function closeModal() {
      modal.hidden = true;
      document.removeEventListener("keydown", onKey);
    }
    function onKey(e) {
      if (e.key === "Escape") closeModal();
    }
    document.addEventListener("keydown", onKey);
    if (closeBtn) closeBtn.onclick = closeModal;
    modal.onclick = function (e) {
      if (e.target === modal) closeModal();
    };

    var targetHandle = c.handle ? c.handle.replace(/^@/, "") : c.id;
    fetch("/api/creators/" + encodeURIComponent(targetHandle) + "/" + kind)
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.success) throw new Error(j && j.error ? j.error : "Could not load list");
        var people = j.people || [];
        if (!people.length) {
          list.innerHTML = '<div class="sc-people-empty">' + (isFollowing
            ? "Not following anyone yet."
            : "No followers yet.") + "</div>";
          return;
        }
        list.innerHTML = "";
        people.forEach(function (p) {
          list.appendChild(createPersonRow(p));
        });
      })
      .catch(function (err) {
        list.innerHTML = '<div class="sc-people-empty">' + escapeHtml(err.message || "Could not load list.") + '</div>';
      });
  }

  function createPersonRow(p) {
    var row = document.createElement("article");
    row.className = "ig-person";

    var slug = encodeURIComponent(String(p.handle || "").replace(/^@/, ""));
    var av = document.createElement("a");
    av.className = "ig-person-av";
    av.href = "/creator?handle=" + slug;
    if (p.avatarUrl) {
      av.style.backgroundImage = 'url("' + p.avatarUrl + '")';
      av.style.backgroundSize = "cover";
      av.style.backgroundPosition = "center";
    } else {
      av.textContent = String(p.handle || "CR").replace(/^@/, "").slice(0, 2).toUpperCase();
    }

    var info = document.createElement("div");
    info.className = "ig-person-info";
    var nameLink = document.createElement("a");
    nameLink.className = "ig-person-name";
    nameLink.href = "/creator?handle=" + slug;
    nameLink.textContent = p.displayName || p.handle || "Creator";
    if (p.verified) {
      var tick = document.createElement("span");
      tick.className = "sh-verified";
      tick.title = "Verified creator";
      tick.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" aria-hidden="true"><path d="M12 2.25l2.08 1.49 2.55-.05.74 2.44 2.1 1.45-.84 2.41.84 2.41-2.1 1.45-.74 2.44-2.55-.05L12 17.75l-2.08-1.49-2.55.05-.74-2.44-2.1-1.45.84-2.41-.84-2.41 2.1-1.45.74-2.44 2.55.05L12 2.25z"/><path d="M8.3 10.15l2.35 2.35 5.05-5.05" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      nameLink.appendChild(tick);
    }
    var meta = document.createElement("span");
    meta.className = "ig-person-meta";
    meta.textContent = (p.handle || "@creator") + " · " + (Number(p.published) || 0) +
      (p.published === 1 ? " template" : " templates");
    info.appendChild(nameLink);
    info.appendChild(meta);

    row.appendChild(av);
    row.appendChild(info);

    // User cannot follow themselves
    if (!p.isViewer && p.id) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ig-btn ig-person-follow";
      var setLabel = function (on) {
        btn.textContent = on ? "Following" : "Follow";
        btn.dataset.active = on ? "1" : "0";
        btn.classList.toggle("is-following", on);
      };
      setLabel(p.followedByViewer === true);
      btn.onclick = function () {
        var on = btn.dataset.active === "1";
        btn.disabled = true;
        fetch("/api/creators/" + encodeURIComponent(p.id) + "/follow", {
          method: on ? "DELETE" : "POST"
        })
          .then(function (r) {
            if (r.status === 401) {
              window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname + window.location.search);
              throw new Error("Please log in first.");
            }
            return r.json();
          })
          .then(function (j) {
            if (!j || !j.success) throw new Error(j && j.error ? j.error : "Could not update follow.");
            setLabel(j.active === true);
          })
          .catch(function (err) {
            if (window.SC_UI && SC_UI.toast) SC_UI.toast(err.message, true);
          })
          .finally(function () {
            btn.disabled = false;
          });
      };
      row.appendChild(btn);
    }

    return row;
  }

  function openStarsModal(c) {
    var modal = $("#starsModal");
    var recipientName = $("#starsRecipientName");
    var userBalance = $("#starsUserBalance");
    var presets = modal.querySelectorAll(".sc-star-pill");
    var amountInput = $("#starsAmountInput");
    var noteInput = $("#starsNoteInput");
    var sendBtn = $("#starsModalSend");
    var cancelBtn = $("#starsModalCancel");
    var closeBtn = $("#starsModalClose");

    if (!modal) return;

    if (recipientName) recipientName.textContent = c.name + " (" + c.handle + ")";
    if (amountInput) amountInput.value = "1";
    if (noteInput) noteInput.value = "";
    if (userBalance) userBalance.textContent = "...";
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.textContent = "Send Stars";
    }

    // Set preset buttons
    presets.forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.amount === "1");
      btn.onclick = function () {
        presets.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        if (amountInput) amountInput.value = btn.dataset.amount;
      };
    });

    if (amountInput) {
      amountInput.oninput = function () {
        var v = amountInput.value;
        presets.forEach(function (b) {
          b.classList.toggle("active", b.dataset.amount === v);
        });
      };
    }

    modal.hidden = false;

    function closeModal() {
      modal.hidden = true;
      document.removeEventListener("keydown", onKey);
    }
    function onKey(e) {
      if (e.key === "Escape") closeModal();
    }
    document.addEventListener("keydown", onKey);
    if (closeBtn) closeBtn.onclick = closeModal;
    if (cancelBtn) cancelBtn.onclick = closeModal;
    modal.onclick = function (e) {
      if (e.target === modal) closeModal();
    };

    // Fetch user stars balance
    fetch("/api/stars")
      .then(function (r) {
        if (r.status === 401) {
          if (userBalance) userBalance.textContent = "Log in to check";
          return null;
        }
        return r.json();
      })
      .then(function (j) {
        if (j && j.success) {
          if (userBalance) userBalance.textContent = String(j.balance != null ? j.balance : 0);
        }
      })
      .catch(function () {
        if (userBalance) userBalance.textContent = "0";
      });

    if (sendBtn) {
      sendBtn.onclick = function () {
        var amount = parseInt(amountInput ? amountInput.value : 1, 10);
        if (isNaN(amount) || amount < 1 || amount > 20) {
          if (window.SC_UI && SC_UI.toast) SC_UI.toast("Please enter an amount between 1 and 20 Stars.", true);
          return;
        }

        var note = noteInput ? String(noteInput.value || "").trim().slice(0, 120) : "";
        sendBtn.disabled = true;
        sendBtn.textContent = "Sending...";

        fetch("/api/stars/donate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: c.id,
            amount: amount,
            note: note,
            idempotencyKey: "star:" + c.id + ":" + Date.now()
          })
        })
          .then(function (r) {
            if (r.status === 401) {
              window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname + window.location.search);
              throw new Error("Please log in to send Stars.");
            }
            return r.json().then(function (j) {
              if (!r.ok || !j.success) throw new Error(j.error || "Could not send Stars.");
              return j;
            });
          })
          .then(function () {
            closeModal();
            var starCountEl = $("#creatorStars");
            if (starCountEl) {
              var current = Number(starCountEl.textContent) || 0;
              starCountEl.textContent = String(current + amount);
            }
            if (window.SC_UI && SC_UI.toast) {
              SC_UI.toast("★ Sent " + amount + (amount === 1 ? " Star" : " Stars") + " to " + (c.handle || c.name) + "!");
            }
          })
          .catch(function (err) {
            sendBtn.disabled = false;
            sendBtn.textContent = "Send Stars";
            if (window.SC_UI && SC_UI.toast) SC_UI.toast(err.message, true);
          });
      };
    }
  }

  function init() {
    loadCreator();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
