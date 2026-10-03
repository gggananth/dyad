(() => {
  const start = () => {
    const every = Number(window.DYAD_NOTICE_EVERY_MS) || 60000;
    const banner = document.getElementById("proposal-banner");
    const link = document.getElementById("proposal-banner-link");
    if (!banner || !link) return;

    const onSessionPage = () => /\/study\/session\//.test(location.pathname);

    const tick = async () => {
      try {
        const response = await fetch("/api/notices", { cache: "no-store" });
        if (!response.ok) {
          banner.classList.add("hidden");
          return;
        }
        const data = await response.json();
        if (data.pendingSuggestion && data.sessionId && !onSessionPage()) {
          link.setAttribute("href", `/study/session/${data.sessionId}`);
          link.textContent =
            "A collaborator proposed an edit to your piece. Open it to review the suggestion.";
          banner.classList.remove("hidden");
        } else if (data.partnerJoined && data.sessionId && !onSessionPage()) {
          link.setAttribute("href", `/study/session/${data.sessionId}`);
          link.textContent = "A collaborator joined your piece. Open the session.";
          banner.classList.remove("hidden");
        } else {
          banner.classList.add("hidden");
        }
      } catch {
        /* stay quiet */
      }
    };

    tick();
    setInterval(tick, every);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
