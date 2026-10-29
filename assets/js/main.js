/* Fast Rabbit — minimal UI helpers. Form does not submit anywhere real. */
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
      var status = document.getElementById("form-status");
      if (status) {
        status.hidden = false;
        status.textContent =
          "This form is a prototype only — it does not send anywhere yet. (TODO: wire to real enquiry handling before launch.)";
      }
    });
  }
})();
