// Keep external script URLs inside this guard: even a production build must
// never preload or send analytics from local previews or staging domains.
export const ANALYTICS_SCRIPT = `
(function () {
  if (window.location.origin !== "https://smalltownboyai.one") return;
  if (document.getElementById("ga4-script")) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", "G-BC37LL57GH");

  var google = document.createElement("script");
  google.id = "ga4-script";
  google.async = true;
  google.src = "https://www.googletagmanager.com/gtag/js?id=G-BC37LL57GH";
  document.head.appendChild(google);

  window.clarity = window.clarity || function () {
    (window.clarity.q = window.clarity.q || []).push(arguments);
  };
  var clarity = document.createElement("script");
  clarity.id = "clarity-script";
  clarity.async = true;
  clarity.src = "https://www.clarity.ms/tag/yzjg1z6gia";
  document.head.appendChild(clarity);
})();
`;
