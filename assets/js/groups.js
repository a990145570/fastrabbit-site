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
