/* Collapsible service and price groups: open the group that holds a linked #anchor, and an "open every group" toggle. */
(function () {
  var groups = document.querySelectorAll("details.svc-group, details.price-group");
  if (!groups.length) return;
  function openFor(hash) {
    if (!hash || hash.length < 2) return;
    var el = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (!el) return;
    var d = el.closest ? el.closest("details") : null;
    if (el.tagName === "DETAILS") d = el;
    if (d && !d.open) d.open = true;
    setTimeout(function () { el.scrollIntoView(); }, 0);
  }
  // Branch and leaves: number each item so its dots form in order, and replay the dots each time a group opens.
  for (var g = 0; g < groups.length; g++) {
    var items = groups[g].querySelectorAll(":scope > section, tbody tr");
    for (var n = 0; n < items.length; n++) {
      var cell = items[n].tagName === "TR" ? items[n].querySelector("td") : items[n];
      if (cell) cell.style.setProperty("--i", Math.min(n, 8));
    }
    groups[g].addEventListener("toggle", function () {
      this.classList.remove("branch-in");
      if (this.open) { setRoot(this); void this.offsetWidth; this.classList.add("branch-in"); }
    });
  }
  // The branch's root tick lines up with the middle of the group heading.
  function setRoot(d) {
    var s = d.querySelector("summary"), h = s && s.querySelector("h2");
    if (!h) return;
    var hr = h.getBoundingClientRect();
    s.style.setProperty("--root", Math.round(hr.top - s.getBoundingClientRect().top + hr.height / 2) + "px");
  }
  window.addEventListener("resize", function () {
    for (var r = 0; r < groups.length; r++) if (groups[r].open) setRoot(groups[r]);
  });
  openFor(location.hash);
  window.addEventListener("hashchange", function () { openFor(location.hash); });
  var links = document.querySelectorAll('a[href^="#"]');
  for (var i = 0; i < links.length; i++) {
    links[i].addEventListener("click", function () { openFor(this.getAttribute("href")); });
  }
  var btns = document.querySelectorAll("#svc-open-all, #price-open-all");
  for (var j = 0; j < btns.length; j++) {
    btns[j].addEventListener("click", function () {
      var on = this.getAttribute("aria-pressed") !== "true";
      for (var k = 0; k < groups.length; k++) groups[k].open = on;
      this.setAttribute("aria-pressed", on ? "true" : "false");
      this.textContent = on ? "Close every group" : "Open every group";
    });
  }
})();
