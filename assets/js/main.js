/* FastRabbit — minimal UI helpers. The enquiry form opens a mailto link; it does not post to a server. */
(function () {
  var toggle = document.querySelector(".nav-toggle");
  var links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  var form = document.getElementById("booking-form");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      function val(name) {
        var el = form.elements[name];
        return el ? String(el.value).trim() : "";
      }
      var lines = [
        "Name: " + val("name"),
        "Email: " + val("email"),
        "Phone: " + val("phone"),
        "Service: " + val("service"),
        "Property address or area: " + val("address"),
        "",
        val("message")
      ];
      window.location.href =
        "mailto:sales@fastrabbit.org?subject=" +
        encodeURIComponent("Booking enquiry") +
        "&body=" +
        encodeURIComponent(lines.join("\n"));
    });
  }
})();

/* Service groups on the home page: tiles act as tabs when JS is on; with JS off every group shows. */
(function () {
  var sec = document.getElementById("services-preview");
  if (!sec) return;
  var tiles = sec.querySelectorAll(".group-tile");
  var panels = sec.querySelectorAll(".group-panel");
  if (!tiles.length || !panels.length) return;
  function show(id) {
    for (var i = 0; i < panels.length; i++) panels[i].hidden = panels[i].id !== id;
    for (var j = 0; j < tiles.length; j++) {
      tiles[j].setAttribute("aria-selected", tiles[j].getAttribute("href") === "#" + id ? "true" : "false");
    }
  }
  for (var k = 0; k < tiles.length; k++) {
    tiles[k].addEventListener("click", function (e) {
      e.preventDefault();
      var id = this.getAttribute("href").slice(1);
      show(id);
      if (window.history && history.replaceState) history.replaceState(null, "", "#" + id);
    });
  }
  var start = panels[0].id;
  if (location.hash) {
    var target = document.getElementById(location.hash.slice(1));
    if (target && target.classList.contains("group-panel")) start = target.id;
  }
  show(start);
})();
