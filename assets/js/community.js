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
  var all = [], town = "", shown = 9, STEP = 9;
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]; }); }
  function parse(d) { var p = d.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function niceTime(t) {
    if (!t) return "";
    var h = +t.slice(0, 2), m = t.slice(3);
    return (h % 12 || 12) + (m === "00" ? "" : ":" + m) + (h < 12 ? " a.m." : " p.m.");
  }
  function today() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
  function render() {
    var t0 = today();
    var items = all.filter(function (e) { return parse(e.date) >= t0 && (!town || e.town === town); });
    if (!items.length) {
      list.innerHTML = '<p class="events-empty">No upcoming events to show just now. Check back soon, as the list refreshes every day.</p>';
      more.hidden = true;
      return;
    }
    list.innerHTML = items.slice(0, shown).map(function (e) {
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
    }).join("");
    more.hidden = items.length <= shown;
  }
  for (var i = 0; i < chips.length; i++) {
    chips[i].addEventListener("click", function () {
      for (var j = 0; j < chips.length; j++) chips[j].classList.toggle("is-on", chips[j] === this);
      town = this.getAttribute("data-town"); shown = STEP; render();
    });
  }
  more.addEventListener("click", function () { shown += STEP; render(); });
  fetch("assets/data/events.json", {cache: "no-cache"})
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) { all = d.events || []; render(); })
    .catch(function () { list.innerHTML = '<p class="events-empty">Local events are taking a breather. Please check back soon.</p>'; });
})();
