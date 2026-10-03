document.addEventListener("alpine:init", () => {
  Alpine.data("sessionRoom", (boot) => ({
    sessionId: boot.sessionId,
    role: boot.role,
    meName: boot.meName,
    otherName: boot.otherName,
    otherInitials: boot.otherInitials,
    task: boot.task,
    timings: boot.timings,
    phase: boot.snapshot.phase,
    messages: boot.snapshot.messages ?? [],
    document: boot.snapshot.document ?? "",
    pendingSuggestion: boot.snapshot.pendingSuggestion ?? null,
    lockedSolo: boot.snapshot.lockedSolo ?? "",
    serverDocument: boot.snapshot.document ?? "",
    snapshot: boot.snapshot,
    draftMessage: "",
    suggestionDraft: "",
    source: null,
    pollTimer: null,

    wordCount(text) {
      const trimmed = (text || "").trim();
      return trimmed ? trimmed.split(/\s+/).length : 0;
    },

    senderLabel(sender) {
      if (sender === "system") return "Notice";
      if (sender === this.role) return "You";
      return this.otherName;
    },

    init() {
      if (this._booted) return;
      this._booted = true;
      this.connect();
      this.pollTimer = setInterval(() => this.poll(), 800);
      setInterval(() => this.heartbeat(), 8000);
      this.$watch("messages", () => {
        this.$nextTick(() => {
          const log = document.getElementById("chat-log");
          if (log) log.scrollTop = log.scrollHeight;
        });
      });
    },

    applyState(data) {
      if (!data) return;
      this.phase = data.phase;
      this.messages = data.messages ?? [];
      const incoming = data.document ?? "";
      if (this.role !== "participant" || incoming !== this.serverDocument) {
        this.document = incoming;
      }
      this.serverDocument = incoming;
      this.pendingSuggestion = data.pendingSuggestion ?? null;
      this.lockedSolo = data.lockedSolo ?? "";
      this.snapshot = data;
      if (data.partnerName && this.role === "participant") {
        this.otherName = data.partnerName;
      }
      if (this.phase === "compare" && this.role === "participant") {
        window.location.href = "/study/compare";
      }
      if (this.phase === "ended" && this.role === "participant") {
        window.location.href = "/study/done";
      }
      if ((this.phase === "compare" || this.phase === "ended") && this.role === "partner") {
        window.location.href = "/lab/thanks";
      }
    },

    connect() {
      try {
        this.source = new EventSource(`/api/session/${this.sessionId}/events`);
        this.source.addEventListener("session", (event) => {
          this.applyState(JSON.parse(event.data));
        });
      } catch {
        /* polling still runs */
      }
    },

    async poll() {
      try {
        const response = await fetch(`/api/session/${this.sessionId}/state`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        this.applyState(await response.json());
      } catch {
        /* ignore */
      }
    },

    async heartbeat() {
      try {
        await fetch(`/api/session/${this.sessionId}/heartbeat`, { method: "POST" });
      } catch {
        /* ignore */
      }
    },

    async post(path, body) {
      const response = await fetch(`/api/session/${this.sessionId}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      if (response.ok) await this.poll();
    },

    async sendMessage() {
      const text = this.draftMessage.trim();
      if (!text) return;
      this.draftMessage = "";
      await this.post("message", { text });
    },

    async saveDraft() {
      await this.post("draft", { text: this.document });
    },

    async applySuggestion() {
      await this.post("apply", {});
    },

    async dismissSuggestion() {
      await this.post("dismiss", {});
    },

    async sendSuggestion() {
      const text = this.suggestionDraft.trim();
      if (!text) return;
      this.suggestionDraft = "";
      await this.post("suggest", { text });
    },
  }));
});
