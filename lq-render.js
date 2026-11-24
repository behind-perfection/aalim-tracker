/* ============================================================================
   LIFEQUEST · lq-render.js
   One <svg>, one requestAnimationFrame loop, and it only runs while the
   LIFEQUEST page is actually visible. Character motion is CSS-driven, so the
   loop's real jobs are: the day/night clock, live elapsed time, and easing the
   camera between spots. Nothing here touches tracker data.
   ========================================================================== */
(function () {
  "use strict";

  var W = window, doc = W.document;
  var stage = null, layers = {}, fig = null, propsG = null, hud = null;
  var mounted = false;
  var state = {
    room: "", spotKey: "", subjectKey: "", anim: "", minute: -1,
    mapped: null, cam: { x: 0, y: 0, w: 960 }, camTarget: null,
    running: false, visible: true, active: false, reduced: false, ambient: true
  };
  var raf = 0, lastMinute = -1, lastTick = 0;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function prefs() { try { return (W.LQStore && W.LQStore.get().prefs) || {}; } catch (e) { return {}; } }
  function reduced() {
    var p = prefs();
    if (p.reducedMotion) return true;
    try { return W.matchMedia && W.matchMedia("(prefers-reduced-motion:reduce)").matches; } catch (e) { return false; }
  }

  /* ------------------------------------------------------------------ mount */
  function mount(host) {
    if (!host) return null;
    host.innerHTML =
      '<div class="lq-stagewrap">' +
        '<svg class="lq-stage" viewBox="0 0 960 540" preserveAspectRatio="xMidYMid slice" role="img" aria-label="LifeQuest world">' +
          '<g class="lq-layer-back"></g>' +
          '<g class="lq-layer-props"></g>' +
          '<g class="lq-layer-char"></g>' +
          '<g class="lq-layer-front"></g>' +
          '<g class="lq-layer-ambient"></g>' +
        '</svg>' +
        '<div class="lq-hud" aria-live="polite"></div>' +
        '<div class="lq-scenenote" hidden></div>' +
      '</div>';
    stage = host.querySelector(".lq-stage");
    layers = {
      back: host.querySelector(".lq-layer-back"),
      props: host.querySelector(".lq-layer-props"),
      char: host.querySelector(".lq-layer-char"),
      front: host.querySelector(".lq-layer-front"),
      ambient: host.querySelector(".lq-layer-ambient")
    };
    hud = host.querySelector(".lq-hud");
    propsG = layers.props;
    /* the rig is created once; afterwards only attributes change */
    layers.char.innerHTML = (W.LQCharacter ? W.LQCharacter.rig() : "");
    fig = layers.char.querySelector(".lq-fig");
    mounted = true;
    state.reduced = reduced();
    stage.classList.toggle("lq-reduced", state.reduced);
    return stage;
  }

  /* ------------------------------------------------------------------ scene */
  function setActivity(mapped, opt) {
    if (!mounted) return;
    opt = opt || {};
    var m = mapped || {};
    var Wo = W.LQWorld; if (!Wo) return;
    var room = m.room || "study";
    var spotKey = room + "|" + (m.spot || "desk");
    var subj = String(m.subjectKey || "generic");
    var minute = opt.minute === undefined ? Wo.currentMinute() : opt.minute;

    var sc = Wo.scene(m, { minute: minute, ambient: state.ambient && prefs().ambient !== false, lamp: opt.lamp });

    /* rebuild the room only when the room actually changed */
    if (state.room !== room || opt.force) {
      layers.back.innerHTML = sc.back;
      layers.front.innerHTML = sc.front;
      state.room = room;
    }
    layers.ambient.innerHTML = sc.ambient;

    /* desk materials change with the subject — the desk itself never does */
    if (state.subjectKey !== subj || state.spotKey !== spotKey || opt.force) {
      var place = sc.place;
      var P = Wo.P || 4;
      var deskTopY = Wo.FLOOR - 40;                    /* desk top, scene units */
      propsG.innerHTML = room === "study" || !sc.built
        ? '<g transform="translate(' + (place.x - 60) + ',' + (deskTopY - 10 * P) + ') scale(' + P + ')">' +
            (W.LQCharacter ? W.LQCharacter.deskProps(subj, { w: 24, h: 10 }) : "") + '</g>'
        : "";
      state.subjectKey = subj;
      state.spotKey = spotKey;
    }

    /* character: attributes only */
    if (W.LQCharacter && fig) W.LQCharacter.apply(fig, m, { noProp: room !== "study" && sc.built === false ? false : false });
    var place2 = sc.place;
    if (fig) {
      fig.setAttribute("transform", "translate(" + place2.x + "," + place2.y + ") scale(" + place2.scale + ")");
      layers.char.setAttribute("opacity", "1");
    }

    /* camera */
    state.camTarget = place2.cam || { x: 0, y: 0, w: 960 };
    if (state.reduced || opt.snap) applyCam(state.camTarget);

    /* honest note when a room is not built yet */
    var noteEl = stage && stage.parentNode ? stage.parentNode.querySelector(".lq-scenenote") : null;
    if (noteEl) {
      if (sc.note) { noteEl.hidden = false; noteEl.textContent = sc.note; }
      else { noteEl.hidden = true; noteEl.textContent = ""; }
    }
    state.mapped = m;
    state.minute = minute;
    paintHud(m, sc, opt);
  }

  function applyCam(c) {
    if (!stage) return;
    state.cam = { x: c.x, y: c.y, w: c.w };
    var h = c.w * (540 / 960);
    stage.setAttribute("viewBox", [c.x.toFixed(1), c.y.toFixed(1), c.w.toFixed(1), h.toFixed(1)].join(" "));
  }
  function easeCam(dt) {
    var t = state.camTarget; if (!t || !stage) return;
    var k = state.reduced ? 1 : Math.min(1, dt / 420);
    var c = state.cam;
    var nx = c.x + (t.x - c.x) * k, ny = c.y + (t.y - c.y) * k, nw = c.w + (t.w - c.w) * k;
    if (Math.abs(t.x - nx) < 0.4 && Math.abs(t.w - nw) < 0.4) { applyCam(t); return; }
    applyCam({ x: nx, y: ny, w: nw });
  }

  /* -------------------------------------------------------------------- HUD
     Minimal: what he is doing, since when, and the subject. No XP, no badges. */
  function paintHud(m, sc, opt) {
    if (!hud) return;
    var A = W.LQAdapter;
    var live = opt && opt.live;
    var when = "";
    if (live && live.startedAt) {
      var mins = Math.round((Date.now() - live.startedAt) / 60000);
      when = A ? A.hm(mins) : mins + "m";
    } else if (m && m.at) when = m.at;
    var bits = [];
    bits.push('<span class="lq-hud-anim">' + esc(animLabel(m && m.anim)) + "</span>");
    if (m && m.subject) bits.push('<span class="lq-hud-subj">' + esc(m.subject) + "</span>");
    if (m && m.label && m.label !== m.subject) bits.push('<span class="lq-hud-label">' + esc(m.label) + "</span>");
    bits.push('<span class="lq-hud-room">' + esc(sc.def.name || "") + "</span>");
    if (when) bits.push('<span class="lq-hud-time">' + esc(when) + "</span>");
    bits.push('<span class="lq-hud-clock">' + esc(clockOf(sc.sky.min)) + "</span>");
    hud.innerHTML = bits.join("");
  }
  function clockOf(min) {
    min = ((Math.round(min) % 1440) + 1440) % 1440;
    var h = Math.floor(min / 60), m = min % 60;
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  }
  function animLabel(a) {
    var C = W.LQCharacter;
    return (C && C.ANIMS[a] && C.ANIMS[a].label) || "Idle";
  }

  /* ------------------------------------------------------------------- loop */
  function tick(ts) {
    raf = 0;
    if (!state.running) return;
    var dt = lastTick ? Math.min(240, ts - lastTick) : 16; lastTick = ts;
    easeCam(dt);
    /* the sky follows the real clock; refresh at most once a minute */
    var Wo = W.LQWorld;
    if (Wo) {
      var mn = Wo.currentMinute();
      if (mn !== lastMinute) {
        lastMinute = mn;
        if (state.mapped) setActivity(state.mapped, { minute: mn, live: state.live, force: true });
      }
    }
    /* live elapsed time in the HUD */
    if (state.live && state.mapped) paintHud(state.mapped, { def: { name: (state.roomName || "") }, sky: { min: state.minute } }, { live: state.live });
    raf = W.requestAnimationFrame(tick);
  }
  function start() {
    if (state.running) return;
    state.running = true; lastTick = 0;
    raf = W.requestAnimationFrame(tick);
  }
  function stop() {
    state.running = false;
    if (raf) { W.cancelAnimationFrame(raf); raf = 0; }
  }
  /* Called by lifequest.js: run only while the tab is open AND the page visible. */
  function setActive(on) {
    state.active = !!on;
    sync();
  }
  function setVisible(on) { state.visible = !!on; sync(); }
  function sync() {
    if (state.active && state.visible && !prefs().livePaused) start(); else stop();
  }
  function setLive(live) { state.live = live || null; }
  function setRoomName(n) { state.roomName = n || ""; }
  function setAmbient(on) {
    state.ambient = !!on;
    if (stage) stage.classList.toggle("lq-noambient", !on);
  }
  function setReduced(on) {
    state.reduced = on === undefined ? reduced() : !!on;
    if (stage) stage.classList.toggle("lq-reduced", state.reduced);
    if (state.reduced && state.camTarget) applyCam(state.camTarget);
  }
  /* Zoom snaps to whole pixel multiples (960/480/320/240) so a pixel on the
     grid is always a square block of screen pixels — never a fraction. */
  function zoom(f) {
    var t = state.camTarget || { x: 0, y: 0, w: 960 };
    var want = Math.max(240, Math.min(960, t.w * (1 / (Number(f) || 1))));
    var n = Math.max(1, Math.min(4, Math.round(960 / want)));
    var w = 960 / n;
    var x = Math.max(0, Math.min(960 - w, Math.round((t.x + (t.w - w) / 2) / 4) * 4));
    var y = Math.max(0, Math.min(540 - w * (540 / 960), Math.round((t.y + (t.w - w) * (540 / 960) / 2) / 4) * 4));
    state.camTarget = { x: x, y: y, w: w };
    if (state.reduced) applyCam(state.camTarget);
  }

  window.LQRender = {
    mount: mount, setActivity: setActivity, setActive: setActive, setVisible: setVisible,
    setLive: setLive, setRoomName: setRoomName, setAmbient: setAmbient, setReduced: setReduced,
    zoom: zoom, start: start, stop: stop, clockOf: clockOf, animLabel: animLabel,
    isMounted: function () { return mounted; },
    state: function () { return { room: state.room, running: state.running, active: state.active, visible: state.visible, reduced: state.reduced }; },
    stage: function () { return stage; }, fig: function () { return fig; }
  };
})();
