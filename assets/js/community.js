/* Community feedback form: opens an email to sales@fastrabbit.org; nothing is stored. */
(function () {
  var form = document.getElementById("community-form");
  if (!form) return;
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var f = form.elements;
    var body = "Name: " + f.name.value + "\nEmail: " + f.email.value + "\n\n" + f.message.value;
    window.location.href = "mailto:sales@fastrabbit.org?subject=" + encodeURIComponent("Community feedback or request") +
      "&body=" + encodeURIComponent(body);
  });
})();

/* Local events tracker: renders assets/data/events.json. */
(function () {
  var list = document.getElementById("events-list");
  if (!list) return;
  var more = document.getElementById("events-more");
  var chips = document.querySelectorAll(".events-filter .chip");
  // data-limit="5" shows only the next few events (home and Community pages) with a "See all events" link instead of "Show more".
  var LIMIT = +(list.getAttribute("data-limit") || 0);
  var WEEKS = list.getAttribute("data-group") === "week";
  var allBtn = document.getElementById("events-open-all");
  var all = [], town = "", STEP = LIMIT || 9, shown = STEP;
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]; }); }
  function parse(d) { var p = d.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function niceTime(t) {
    if (!t) return "";
    var h = +t.slice(0, 2), m = t.slice(3);
    return (h % 12 || 12) + (m === "00" ? "" : ":" + m) + (h < 12 ? " a.m." : " p.m.");
  }
  function today() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
  function card(e) {
      var d = parse(e.date);
      var mon = d.toLocaleDateString("en-CA", {month: "short"});
      var wd = d.toLocaleDateString("en-CA", {weekday: "long"});
      var also = (e.also || []).map(function (a) { return parse(a).toLocaleDateString("en-CA", {month: "short", day: "numeric"}); });
      return '<article class="event-card">' +
        '<div class="event-date" aria-hidden="true"><span class="event-mon">' + esc(mon) + '</span><span class="event-day">' + d.getDate() + '</span></div>' +
        '<div class="event-body">' +
        '<p class="event-type">' + esc(e.type) + '</p>' +
        '<h4>' + esc(e.title) + '</h4>' +
        '<p class="event-when">' + esc(wd) + (e.time ? " · " + esc(niceTime(e.time)) : "") + '</p>' +
        '<p class="event-place">' + esc(e.place) + '</p>' +
        '<p class="event-blurb">' + esc(e.blurb) + '</p>' +
        (also.length ? '<p class="event-also">Also on ' + esc(also.join(", ")) + '</p>' : "") +
        '</div></article>';
  }
  // Events page: group by week, Monday to Sunday. This week starts open; later weeks start closed.
  function monday(d) { var m = new Date(d); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return m; }
  function md(d) { return d.toLocaleDateString("en-CA", {month: "short", day: "numeric"}); }
  // Compact one-line rows inside each week, in our own words; the first few show, the rest sit behind a button.
  var WEEK_SHOW = 8;
  function row(e, hide) {
    var d = parse(e.date);
    var day = d.toLocaleDateString("en-CA", {weekday: "short"}) + " " + md(d);
    return '<li class="event-row"' + (hide ? " hidden" : "") + '>' +
      '<span class="event-row-when">' + esc(day) + (e.time ? " · " + esc(niceTime(e.time)) : "") + '</span>' +
      '<span class="event-row-what"><strong>' + esc(e.title) + '</strong> <span class="event-row-type">' + esc(e.type) + '</span></span>' +
      '<span class="event-row-where">' + esc(e.place) + (e.also && e.also.length ? " · also " + esc(e.also.map(function (a) { return md(parse(a)); }).join(", ")) : "") + '</span>' +
      '</li>';
  }
  function renderWeeks(items) {
    var weeks = [], byKey = {}, thisWeek = monday(today()).getTime();
    items.forEach(function (e) {
      var m = monday(parse(e.date)), k = m.getTime();
      if (!byKey[k]) { byKey[k] = {start: m, items: []}; weeks.push(byKey[k]); }
      byKey[k].items.push(e);
    });
    list.innerHTML = weeks.map(function (w, n) {
      var cur = w.start.getTime() === thisWeek;
      var end = new Date(w.start); end.setDate(end.getDate() + 6);
      var label = (cur ? "This week" : "Week of " + md(w.start));
      var open = cur || (n === 0 && !byKey[thisWeek]);
      return '<details class="events-week"' + (open ? " open" : "") + '>' +
        '<summary><span class="events-week-title">' + esc(label) + '</span>' +
        '<span class="events-week-meta">' + esc(md(w.start) + " to " + md(end)) + " · " + w.items.length + (w.items.length === 1 ? " event" : " events") + '</span></summary>' +
        '<ul class="events-week-list">' + w.items.map(function (e, i) { return row(e, i >= WEEK_SHOW); }).join("") + '</ul>' +
        (w.items.length > WEEK_SHOW ? '<button type="button" class="btn btn-ghost events-week-more">Show ' + (w.items.length - WEEK_SHOW) + ' more this week</button>' : "") +
        '</details>';
    }).join("");
    var mb = list.querySelectorAll(".events-week-more");
    for (var b = 0; b < mb.length; b++) mb[b].addEventListener("click", function () {
      var rows = this.parentNode.querySelectorAll("li.event-row[hidden]");
      for (var r = 0; r < rows.length; r++) rows[r].hidden = false;
      this.remove();
    });
    if (more) more.hidden = true;
    if (allBtn) { allBtn.hidden = weeks.length < 2; allBtn.setAttribute("aria-pressed", "false"); allBtn.textContent = "Open every week"; }
  }
  // Events page: one big event per month, chosen in scripts/build-events.py ("highlights" in events.json).
  function renderHighlights(d) {
    var box = document.getElementById("events-highlights");
    if (!box) return;
    var t0 = today(), byTitle = {};
    (d.events || []).forEach(function (e) { if (e.highlight) byTitle[e.date + "|" + e.title] = e; });
    var picks = (d.highlights || []).map(function (h) { return byTitle[h.date + "|" + h.title]; })
      .filter(function (e) { return e && parse(e.date) >= t0; });
    if (!picks.length) { box.hidden = true; return; }
    box.innerHTML = '<h2 class="events-highlights-h">Big events coming up</h2><div class="events-highlights-row">' +
      picks.map(function (e) {
        var mon = parse(e.date).toLocaleDateString("en-CA", {month: "long"});
        return '<div class="event-highlight"><p class="event-highlight-month">' + esc(mon) + ' highlight</p>' + card(e) + '</div>';
      }).join("") + '</div>';
    box.hidden = false;
  }
  function render() {
    var t0 = today();
    var items = all.filter(function (e) { return parse(e.date) >= t0 && (!town || e.town === town); });
    if (!items.length) {
      list.innerHTML = '<p class="events-empty">No upcoming events to show just now. Check back soon, as the list refreshes every day.</p>';
      if (more) more.hidden = true;
      return;
    }
    if (WEEKS) { renderWeeks(items); return; }
    list.innerHTML = items.slice(0, shown).map(card).join("");
    if (more) more.hidden = LIMIT ? true : items.length <= shown;
  }
  for (var i = 0; i < chips.length; i++) {
    chips[i].addEventListener("click", function () {
      for (var j = 0; j < chips.length; j++) chips[j].classList.toggle("is-on", chips[j] === this);
      town = this.getAttribute("data-town"); shown = STEP; render();
    });
  }
  if (more) more.addEventListener("click", function () { shown += STEP; render(); });
  if (allBtn) allBtn.addEventListener("click", function () {
    var on = this.getAttribute("aria-pressed") !== "true", w = list.querySelectorAll("details.events-week");
    for (var i = 0; i < w.length; i++) w[i].open = on;
    this.setAttribute("aria-pressed", on ? "true" : "false");
    this.textContent = on ? "Close every week" : "Open every week";
  });
  fetch("assets/data/events.json", {cache: "no-cache"})
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) { all = d.events || []; render(); renderHighlights(d); })
    .catch(function () { list.innerHTML = '<p class="events-empty">Local events are taking a breather. Please check back soon.</p>'; });
})();
