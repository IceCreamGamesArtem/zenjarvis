(() => {
  "use strict";

  const STANDARD_SESSION_MINUTES = 5;
  const SESSION_SECONDS = STANDARD_SESSION_MINUTES * 60;
  const MIN_CUSTOM_MINUTES = 1;
  const MAX_CUSTOM_MINUTES = 30;
  const RING_CIRCUMFERENCE = 289.0265;
  const STREAK_KEY = "zenjarvis.streak.v1";
  const MUTED_KEY = "zenjarvis.muted.v1";
  const WEATHER_FRESH_MS = 10 * 60 * 1000;
  const RANDOM_TRACK_STATUS = "Случайный трек из папки music/";

  const PLAY_ICON = `
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 5.7v12.6a1 1 0 0 0 1.52.85l10.1-6.3a1 1 0 0 0 0-1.7L9.52 4.85A1 1 0 0 0 8 5.7Z" fill="currentColor"/>
    </svg>`;
  const PAUSE_ICON = `
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="7.2" y="5.5" width="3.4" height="13" rx="1.7" fill="currentColor"/>
      <rect x="13.4" y="5.5" width="3.4" height="13" rx="1.7" fill="currentColor"/>
    </svg>`;
  const REPLAY_ICON = `
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6.2 8.2A7.1 7.1 0 1 1 5 14.1" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
      <path d="M6.2 4.3v4.2h4.2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

  const CLIENT_FALLBACKS = {
    early: [
      "Расслабьте плечи и мягко опустите их вниз. Сделайте спокойный вдох через нос.",
      "Почувствуйте опору под собой и позвольте телу стать чуть тяжелее.",
      "Позвольте лицу расслабиться: разгладьте лоб и мягко разожмите челюсть.",
    ],
    middle: [
      "Позвольте выдоху быть чуть длиннее вдоха, без усилия и напряжения.",
      "Заметьте, как живот мягко поднимается на вдохе и опускается на выдохе.",
      "Если мысли уводят вас, мягко верните внимание к следующему вдоху.",
      "Почувствуйте кисти рук и позвольте пальцам расслабиться.",
    ],
    late: [
      "Перенесите внимание в стопы и заметьте, как они касаются пола.",
      "Услышьте звуки вокруг себя, не оценивая их и не пытаясь назвать.",
      "Сделайте более глубокий вдох и позвольте телу наполниться спокойствием.",
      "Поблагодарите себя за эти минуты внимания и мягко возвращайтесь.",
    ],
  };

  const NSDR_CLIENT_FALLBACKS = {
    settle: [
      "Лягте удобно и почувствуйте, как тело принимает вес опоры.",
      "Сделайте спокойный вдох и мягкий выдох, сохраняя сознание ясным.",
      "Заметьте звуки вокруг и позвольте им остаться на фоне.",
    ],
    legs: [
      "Перенесите внимание к пальцам ног и заметьте их прохладу или тепло.",
      "Почувствуйте стопы и позвольте пяткам стать тяжелее.",
      "Пройдите вниманием через голени и отпустите напряжение в икрах.",
      "Заметьте колени и бёдра, расслабляя их без усилия.",
    ],
    torso: [
      "Перенесите внимание в живот и заметьте, как он двигается на вдохе.",
      "Почувствуйте спину и позвольте ей стать шире на опоре.",
      "Расслабьте плечи и отпустите их вниз, сохраняя ясность.",
      "Пройдите вниманием через кисти рук и позвольте пальцам расслабиться.",
      "Заметьте челюсть и мягко разожмите зубы.",
    ],
    head: [
      "Почувствуйте шею и позвольте ей удлиниться без напряжения.",
      "Перенесите внимание к лицу, разгладьте лоб и расслабьте глаза.",
      "Заметьте макушку, словно мягкий свет касается её.",
      "Пройдите вниманием от макушки к плечам, сохраняя тело расслабленным.",
    ],
    visual: [
      "Представьте спокойное светлое пространство, в котором легко дышится.",
      "Позвольте этому пространству наполнить тело мягким светом и ясностью.",
      "Заметьте, как дыхание становится ровным, а мысли — тише.",
      "Останьтесь здесь на несколько вдохов, сохраняя внимание живым.",
    ],
    wake: [
      "Сделайте вдох чуть глубже и почувствуйте, как возвращается тонус.",
      "Почувствуйте пальцы рук и ног, мягко верните движение в тело.",
      "Сделайте ещё один вдох и приготовьтесь открыть глаза.",
      "Откройте глаза, сядьте и позвольте ясности остаться с вами.",
    ],
  };

  const el = {
    timerStage: document.getElementById("timer-stage"),
    timer: document.getElementById("timer"),
    timerKicker: document.getElementById("timer-kicker"),
    timerCaption: document.getElementById("timer-caption"),
    progressRing: document.getElementById("progress-ring"),
    startButton: document.getElementById("start-button"),
    startIcon: document.getElementById("start-icon"),
    startLabel: document.getElementById("start-label"),
    stopButton: document.getElementById("stop-button"),
    nsdrButton: document.getElementById("nsdr-button"),
    customSession: document.getElementById("custom-session"),
    customDuration: document.getElementById("custom-duration"),
    customDurationValue: document.getElementById("custom-duration-value"),
    customTrack: document.getElementById("custom-track"),
    customStart: document.getElementById("custom-start"),
    sessionHint: document.getElementById("session-hint"),
    instructionText: document.getElementById("instruction-text"),
    instructionStatus: document.getElementById("instruction-status"),
    voiceState: document.getElementById("voice-state"),
    voiceLabel: document.getElementById("voice-label"),
    soundWave: document.getElementById("sound-wave"),
    weatherButton: document.getElementById("weather-button"),
    weatherText: document.getElementById("weather-text"),
    installButton: document.getElementById("install-button"),
    player: document.getElementById("player"),
    playerLabel: document.getElementById("player-label"),
    trackTitle: document.getElementById("track-title"),
    trackStatus: document.getElementById("track-status"),
    muteButton: document.getElementById("mute-button"),
    streakCount: document.getElementById("streak-count"),
    streakUnit: document.getElementById("streak-unit"),
    streakNote: document.getElementById("streak-note"),
    completion: document.getElementById("completion"),
    completionKicker: document.getElementById("completion-kicker"),
    completionTitle: document.getElementById("completion-title"),
    completionCopy: document.getElementById("completion-copy"),
    completionCount: document.getElementById("completion-streak-count"),
    completionLabel: document.getElementById("completion-streak-label"),
    nsdrChecklist: document.getElementById("nsdr-checklist"),
    completionClose: document.getElementById("completion-close"),
    todayLabel: document.getElementById("today-label"),
    toast: document.getElementById("toast"),
  };

  const state = {
    phase: "idle",
    sessionMode: "standard",
    durationSeconds: SESSION_SECONDS,
    endAt: 0,
    remainingMs: SESSION_SECONDS * 1000,
    tracksAvailable: false,
    tickHandle: null,
    instructionTimeout: null,
    instructionSwapTimeout: null,
    sessionId: 0,
    requestInFlight: null,
    weather: null,
    weatherFetchedAt: 0,
    weatherPromise: null,
    musicTrack: null,
    musicSource: null,
    sessionTrackName: null,
    currentTrack: null,
    audio: null,
    wakeAudio: null,
    wakeBellTimeout: null,
    wakeSpeechTimeout: null,
    audioFade: null,
    audioBlocked: false,
    audioFailedFor: "",
    missingTrackNotified: "",
    muted: readMutedPreference(),
    speaking: false,
    currentUtterance: null,
    voices: [],
    toastTimer: null,
    installPrompt: null,
    lastFocused: null,
    statusTimer: null,
    fallbackIndex: -1,
  };

  const speech = "speechSynthesis" in window ? window.speechSynthesis : null;

  const pluralRules = typeof Intl.PluralRules === "function"
    ? new Intl.PluralRules("ru-RU")
    : null;

  function pluralizeDays(count, withPodryad = false) {
    const form = pluralRules ? pluralRules.select(count) : (count === 1 ? "one" : "other");
    if (withPodryad) {
      if (form === "one") return "день подряд";
      if (form === "few") return "дня подряд";
      return "дней подряд";
    }
    if (form === "one") return "день";
    if (form === "few") return "дня";
    return "дней";
  }

  function minutesWord(count) {
    const form = pluralRules ? pluralRules.select(count) : (count === 1 ? "one" : "other");
    if (form === "one") return "минута";
    if (form === "few") return "минуты";
    return "минут";
  }

  function minutesLabel(count) {
    return `${count} ${minutesWord(count)}`;
  }

  function readMutedPreference() {
    try {
      return window.localStorage.getItem(MUTED_KEY) === "1";
    } catch {
      return false;
    }
  }

  function writeMutedPreference(value) {
    try {
      window.localStorage.setItem(MUTED_KEY, value ? "1" : "0");
    } catch {
      // Приватный режим может запрещать localStorage — интерфейс продолжит работать.
    }
  }

  function dateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseDateKey(key) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key || "")) return null;
    const [year, month, day] = key.split("-").map(Number);
    const stamp = Date.UTC(year, month - 1, day);
    return Number.isFinite(stamp) ? stamp : null;
  }

  function daysBetween(fromKey, toKey) {
    const from = parseDateKey(fromKey);
    const to = parseDateKey(toKey);
    if (from === null || to === null) return null;
    return Math.round((to - from) / 86_400_000);
  }

  function loadStreak() {
    try {
      const raw = window.localStorage.getItem(STREAK_KEY);
      if (!raw) return { count: 0, lastDate: null };
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed.count === "number" &&
        parsed.count >= 0 &&
        (parsed.lastDate === null || typeof parsed.lastDate === "string")
      ) {
        return { count: Math.floor(parsed.count), lastDate: parsed.lastDate };
      }
    } catch {
      // Повреждённое значение не должно ломать приложение.
    }
    return { count: 0, lastDate: null };
  }

  function saveStreak(streak) {
    try {
      window.localStorage.setItem(STREAK_KEY, JSON.stringify(streak));
    } catch {
      // Без localStorage серия живёт только до перезагрузки.
    }
  }

  function recordCompletedStreak() {
    const saved = loadStreak();
    const today = dateKey();

    if (saved.lastDate === today && saved.count > 0) {
      return { count: saved.count, alreadyToday: true, startedNew: false };
    }

    const gap = saved.lastDate ? daysBetween(saved.lastDate, today) : null;
    const nextCount = gap === 1 ? Math.max(1, saved.count) + 1 : 1;
    saveStreak({ count: nextCount, lastDate: today });
    return {
      count: nextCount,
      alreadyToday: false,
      startedNew: nextCount === 1,
    };
  }

  function renderStreak() {
    const saved = loadStreak();
    const today = dateKey();
    const gap = saved.lastDate ? daysBetween(saved.lastDate, today) : null;
    let visibleCount = saved.count;

    if (!saved.lastDate || gap === null || gap < 0 || gap > 1) {
      visibleCount = 0;
    }

    el.streakCount.textContent = String(visibleCount);
    el.streakUnit.textContent = pluralizeDays(visibleCount);

    if (!saved.lastDate) {
      el.streakNote.textContent = "Начните сегодня";
    } else if (gap === 0) {
      el.streakNote.textContent = "Сегодня уже отмечено";
    } else if (gap === 1) {
      el.streakNote.textContent = "Продолжите серию сегодня";
    } else if (gap !== null && gap > 1) {
      el.streakNote.textContent = "Серия прервалась — начните заново";
    } else {
      el.streakNote.textContent = "Начните сегодня";
    }
  }

  function renderToday() {
    try {
      const text = new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "long",
      }).format(new Date()).replace(/\s*г\.$/, "");
      el.todayLabel.textContent = text;
    } catch {
      el.todayLabel.textContent = "";
    }
  }

  function formatTime(milliseconds) {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return { text: `${minutes}:${seconds}`, totalSeconds };
  }

  function renderTimer(milliseconds) {
    const { text, totalSeconds } = formatTime(milliseconds);
    if (el.timer.textContent !== text) el.timer.textContent = text;
    el.timer.dateTime = `PT${totalSeconds}S`;
    el.timer.setAttribute(
      "aria-label",
      `Осталось ${minutesLabel(Math.max(0, Math.ceil(totalSeconds / 60)))}`,
    );

    const totalMs = Math.max(1, state.durationSeconds * 1000);
    const progress = Math.max(0, Math.min(1, milliseconds / totalMs));
    el.progressRing.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - progress));
  }

  function remainingMilliseconds() {
    if (state.phase === "running") {
      return Math.max(0, state.endAt - Date.now());
    }
    return Math.max(0, state.remainingMs);
  }

  function elapsedSeconds() {
    const remaining = remainingMilliseconds();
    return Math.max(
      0,
      Math.min(
        state.durationSeconds,
        state.durationSeconds - Math.round(remaining / 1000),
      ),
    );
  }

  function clearTick() {
    if (state.tickHandle) {
      window.clearInterval(state.tickHandle);
      state.tickHandle = null;
    }
  }

  function clearInstructionTimer() {
    if (state.instructionTimeout) {
      window.clearTimeout(state.instructionTimeout);
      state.instructionTimeout = null;
    }
  }

  function startTick() {
    clearTick();
    state.tickHandle = window.setInterval(tick, 250);
  }

  function tick() {
    if (state.phase !== "running") return;
    const remaining = state.endAt - Date.now();
    if (remaining <= 0) {
      renderTimer(0);
      finishSession();
      return;
    }
    state.remainingMs = remaining;
    renderTimer(remaining);
  }

  function updateSessionUi() {
    el.timerStage.dataset.state = state.phase;

    if (state.phase === "running") {
      el.startIcon.innerHTML = PAUSE_ICON;
      el.startLabel.textContent = "Пауза";
      el.stopButton.hidden = false;
      if (state.sessionMode === "nsdr") {
        el.timerKicker.textContent = "NSDR · ясность";
        el.timerCaption.textContent = "отдых без засыпания";
        el.sessionHint.textContent = "Тело расслабляется, сознание остаётся ясным.";
      } else {
        el.timerKicker.textContent = "вдох и выдох";
        el.timerCaption.textContent = "оставайтесь с дыханием";
        el.sessionHint.textContent = "Слушайте голос и позвольте телу дышать свободно.";
      }
    } else if (state.phase === "paused") {
      el.startIcon.innerHTML = PLAY_ICON;
      el.startLabel.textContent = "Продолжить";
      el.stopButton.hidden = false;
      el.timerKicker.textContent = "пауза";
      el.timerCaption.textContent = "продолжите, когда будете готовы";
      el.sessionHint.textContent = "Пауза. В любой момент можно вернуться к практике.";
    } else if (state.phase === "complete") {
      el.startIcon.innerHTML = REPLAY_ICON;
      el.startLabel.textContent = "Начать снова";
      el.stopButton.hidden = true;
      el.timerKicker.textContent = "завершено";
      el.timerCaption.textContent = "побудьте в тишине";
      el.sessionHint.textContent = "Побудьте в тишине ещё несколько мгновений.";
    } else {
      el.startIcon.innerHTML = PLAY_ICON;
      el.startLabel.textContent = "Стандартная медитация (5 минут)";
      el.stopButton.hidden = true;
      el.timerKicker.textContent = "пять минут";
      el.timerCaption.textContent = "пространство для себя";
      el.sessionHint.textContent = "Закройте глаза и позвольте дыханию найти свой ритм.";
    }

    const active = state.phase === "running" || state.phase === "paused";
    el.customSession.classList.toggle("is-locked", active);
    el.customStart.disabled = active;
    el.customDuration.disabled = active;
    el.customTrack.disabled = active || !state.tracksAvailable;
    el.nsdrButton.disabled = active;

    document.title = state.phase === "running"
      ? (state.sessionMode === "nsdr" ? "ZenJarvis — NSDR идёт" : "ZenJarvis — медитация идёт")
      : "ZenJarvis — медитация";

    updatePlayerLabel();
    updateVoiceLabel();
  }

  function setInstruction(text) {
    window.clearTimeout(state.instructionSwapTimeout);
    el.instructionText.classList.add("is-changing");
    state.instructionSwapTimeout = window.setTimeout(() => {
      el.instructionText.textContent = text;
      el.instructionText.classList.remove("is-changing");
    }, 170);
  }

  function defaultInstructionStatus() {
    if (state.phase === "running") return "следующая подсказка через 30–40 секунд";
    if (state.phase === "paused") return "пауза";
    if (state.phase === "complete") return "практика завершена";
    return "подсказки появятся во время практики";
  }

  function setInstructionStatus(text, temporary = false) {
    window.clearTimeout(state.statusTimer);
    el.instructionStatus.textContent = text;
    if (temporary) {
      state.statusTimer = window.setTimeout(() => {
        el.instructionStatus.textContent = defaultInstructionStatus();
      }, 4200);
    }
  }

  function chooseRussianVoice() {
    if (!state.voices.length && speech) {
      try {
        state.voices = speech.getVoices() || [];
      } catch {
        state.voices = [];
      }
    }

    const russian = state.voices.filter((voice) => /^ru([-_]|$)/i.test(voice.lang || ""));
    if (!russian.length) return null;

    const preferred = [/milena/i, /irina/i, /alena/i, /google/i, /yandex/i, /microsoft/i];
    for (const pattern of preferred) {
      const match = russian.find((voice) => pattern.test(voice.name || ""));
      if (match) return match;
    }
    return russian.find((voice) => voice.localService) || russian[0];
  }

  function updateVoiceLabel() {
    if (!speech) {
      el.voiceLabel.textContent = "без голоса";
      el.voiceState.classList.remove("is-speaking");
      return;
    }
    if (state.muted) {
      el.voiceLabel.textContent = "без звука";
    } else if (state.speaking) {
      el.voiceLabel.textContent = "говорит";
    } else {
      el.voiceLabel.textContent = "голос";
    }
  }

  function setSpeaking(value) {
    state.speaking = value;
    el.voiceState.classList.toggle("is-speaking", value);
    el.soundWave.classList.toggle("is-speaking", value);
    updateVoiceLabel();
  }

  function cancelSpeech() {
    state.currentUtterance = null;
    setSpeaking(false);
    if (speech) {
      try {
        speech.cancel();
      } catch {
        // Некоторые браузеры бросают исключение, если очередь уже пуста.
      }
    }
  }

  function speakText(text) {
    if (!speech || state.muted || !text) return;

    try {
      speech.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ru-RU";
      utterance.rate = 0.84;
      utterance.pitch = 0.96;
      utterance.volume = 1;

      const voice = chooseRussianVoice();
      if (voice) utterance.voice = voice;

      state.currentUtterance = utterance;
      utterance.onstart = () => {
        if (state.currentUtterance === utterance) setSpeaking(true);
      };
      utterance.onend = () => {
        if (state.currentUtterance === utterance) {
          state.currentUtterance = null;
          setSpeaking(false);
        }
      };
      utterance.onerror = (event) => {
        if (state.currentUtterance === utterance) {
          state.currentUtterance = null;
          setSpeaking(false);
        }
        if (event && event.error === "not-allowed") {
          showToast("Браузер не разрешил озвучку. Нажмите «Начать медитацию» ещё раз.");
        }
      };

      speech.speak(utterance);
    } catch {
      setSpeaking(false);
    }
  }

  function refreshVoices() {
    if (!speech) return;
    try {
      state.voices = speech.getVoices() || [];
    } catch {
      state.voices = [];
    }
  }

  function randomInstructionDelay() {
    return 30_000 + Math.round(Math.random() * 10_000);
  }

  function scheduleInstruction(delay, token) {
    clearInstructionTimer();
    if (state.phase !== "running" || token !== state.sessionId) return;
    state.instructionTimeout = window.setTimeout(() => {
      state.instructionTimeout = null;
      void requestMeditation(token);
    }, delay);
  }

  async function requestMeditation(token) {
    if (
      state.phase !== "running" ||
      token !== state.sessionId ||
      state.requestInFlight === token
    ) {
      return;
    }

    state.requestInFlight = token;
    const elapsed = elapsedSeconds();
    const endpoint = state.sessionMode === "nsdr" ? "/api/nsdr" : "/api/meditation";

    try {
      const data = await fetchJson(
        endpoint,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ elapsed, duration: state.durationSeconds }),
        },
        12_000,
      );

      if (state.phase !== "running" || token !== state.sessionId) return;

      const text = typeof data.text === "string" ? data.text.trim() : "";
      if (!text) throw new Error("Пустой ответ медитации");

      setInstruction(text);
      setInstructionStatus(
        data.source === "fallback" ? "локальная подсказка · сейчас" : "подсказка обновлена · сейчас",
        true,
      );
      speakText(text);
    } catch {
      if (state.phase !== "running" || token !== state.sessionId) return;
      const fallback = pickClientFallback(elapsed);
      setInstruction(fallback);
      setInstructionStatus("нет сети · мягкая подсказка из памяти", true);
      speakText(fallback);
    } finally {
      if (state.requestInFlight === token) state.requestInFlight = null;
      if (state.phase === "running" && token === state.sessionId) {
        scheduleInstruction(randomInstructionDelay(), token);
      }
    }
  }

  function pickClientFallback(elapsed) {
    const progress = elapsed / Math.max(1, state.durationSeconds);
    let pool;
    if (state.sessionMode === "nsdr") {
      if (progress < 0.08) pool = NSDR_CLIENT_FALLBACKS.settle;
      else if (progress < 0.3) pool = NSDR_CLIENT_FALLBACKS.legs;
      else if (progress < 0.52) pool = NSDR_CLIENT_FALLBACKS.torso;
      else if (progress < 0.72) pool = NSDR_CLIENT_FALLBACKS.head;
      else if (progress < 0.9) pool = NSDR_CLIENT_FALLBACKS.visual;
      else pool = NSDR_CLIENT_FALLBACKS.wake;
    } else if (progress < 0.15) {
      pool = CLIENT_FALLBACKS.early;
    } else if (progress < 0.83) {
      pool = CLIENT_FALLBACKS.middle;
    } else {
      pool = CLIENT_FALLBACKS.late;
    }

    let index = Math.floor(Math.random() * pool.length);
    if (pool.length > 1 && index === state.fallbackIndex) {
      index = (index + 1) % pool.length;
    }
    state.fallbackIndex = index;
    return pool[index];
  }

  async function fetchJson(url, options = {}, timeoutMs = 10_000) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(options.headers || {}),
        },
      });
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }
      return await response.json();
    } finally {
      window.clearTimeout(timeout);
    }
  }

  // -------------------------------------------------------------------------
  // Сессия
  // -------------------------------------------------------------------------

  function startSession(durationInMinutes, trackName = null, mode = "standard") {
    if (state.phase === "running" || state.phase === "paused") return;

    const minutes = Math.max(
      MIN_CUSTOM_MINUTES,
      Math.min(MAX_CUSTOM_MINUTES, Math.round(Number(durationInMinutes) || STANDARD_SESSION_MINUTES)),
    );
    state.sessionMode = mode === "nsdr" ? "nsdr" : mode === "custom" ? "custom" : "standard";
    state.durationSeconds = minutes * 60;
    state.remainingMs = state.durationSeconds * 1000;

    clearTick();
    clearInstructionTimer();
    clearWakeTimers();
    state.sessionId += 1;
    const token = state.sessionId;

    state.phase = "running";
    state.endAt = Date.now() + state.remainingMs;
    state.requestInFlight = null;
    state.audioBlocked = false;

    renderToday();
    renderTimer(state.remainingMs);
    updateSessionUi();
    const intro = state.sessionMode === "nsdr"
      ? "Лягте удобно. Сейчас начнётся восстановление. Глаза можно закрыть."
      : "Устройтесь удобно. Сделайте мягкий вдох.";
    setInstruction(intro);
    setInstructionStatus("первая подсказка через несколько секунд", true);
    speakText(intro);
    startTick();

    if (state.sessionMode === "nsdr") {
      primeWakeAudio();
    }

    const selectedTrack = typeof trackName === "string" ? trackName.trim() : "";
    state.sessionTrackName = selectedTrack || null;
    if (selectedTrack) {
      el.trackTitle.textContent = selectedTrack.replace(/\.[^.]+$/, "").replace(/_+/g, " ");
      el.trackStatus.textContent = "Выбранный трек";
      void loadTrack(selectedTrack, { autoPlay: true, notifyEmpty: true });
    } else if (state.musicTrack?.file && state.musicSource === "random") {
      playTrack(state.musicTrack, RANDOM_TRACK_STATUS);
    } else {
      el.trackTitle.textContent = "Тишина";
      el.trackStatus.textContent = "Ищем музыку в папке music/…";
      void loadRandomTrack({ autoPlay: true, notifyEmpty: true });
    }

    if (!state.weather || Date.now() - state.weatherFetchedAt > WEATHER_FRESH_MS) {
      void refreshWeather({ silent: true });
    }

    scheduleInstruction(4_200, token);
  }

  function pauseSession() {
    if (state.phase !== "running") return;
    state.remainingMs = Math.max(0, state.endAt - Date.now());
    if (state.remainingMs <= 1) {
      finishSession();
      return;
    }

    state.phase = "paused";
    state.sessionId += 1;
    state.requestInFlight = null;
    clearTick();
    clearInstructionTimer();
    cancelSpeech();
    fadeOutMusic();
    renderTimer(state.remainingMs);
    updateSessionUi();
    setInstructionStatus("пауза");
  }

  function resumeSession() {
    if (state.phase !== "paused") return;
    state.sessionId += 1;
    const token = state.sessionId;

    state.phase = "running";
    state.endAt = Date.now() + state.remainingMs;
    state.requestInFlight = null;
    updateSessionUi();
    setInstructionStatus("продолжаем");
    speakText("Продолжаем. Сделайте спокойный вдох.");
    startTick();

    const track = state.currentTrack || state.musicTrack;
    if (track?.file) {
      playTrack(track, state.sessionTrackName ? "Выбранный трек" : RANDOM_TRACK_STATUS);
    } else if (state.sessionTrackName) {
      void loadTrack(state.sessionTrackName, { autoPlay: true, notifyEmpty: true });
    } else {
      void loadRandomTrack({ autoPlay: true, notifyEmpty: true });
    }
    scheduleInstruction(2_600, token);
  }

  function finishSession() {
    if (state.phase !== "running" && state.phase !== "paused") return;

    const isNsdr = state.sessionMode === "nsdr";
    state.phase = "complete";
    state.remainingMs = 0;
    state.sessionId += 1;
    const finishedSessionId = state.sessionId;
    state.requestInFlight = null;
    renderToday();
    clearTick();
    clearInstructionTimer();
    clearWakeTimers();
    cancelSpeech();
    fadeOutMusic(true);
    renderTimer(0);
    updateSessionUi();
    if (isNsdr) {
      setInstruction("Восстановление завершено. Откройте глаза и возвращайтесь с ясной головой.");
      setInstructionStatus("NSDR завершён");
      state.wakeBellTimeout = window.setTimeout(() => {
        state.wakeBellTimeout = null;
        if (state.phase === "complete" && state.sessionId === finishedSessionId) {
          playWakeBell();
        }
      }, 420);
      state.wakeSpeechTimeout = window.setTimeout(() => {
        state.wakeSpeechTimeout = null;
        if (state.phase === "complete" && state.sessionId === finishedSessionId) {
          speakText("Открой глаза. Сделай глубокий вдох. Ты полон энергии.");
        }
      }, 1150);
    } else {
      setInstruction("Практика завершена. Побудьте ещё несколько мгновений в тишине.");
      setInstructionStatus("практика завершена");
    }

    const result = recordCompletedStreak();
    renderStreak();
    showCompletion(result);
  }

  function stopSession() {
    if (state.phase !== "running" && state.phase !== "paused") return;

    state.phase = "idle";
    state.sessionMode = "standard";
    state.durationSeconds = SESSION_SECONDS;
    state.remainingMs = SESSION_SECONDS * 1000;
    state.sessionId += 1;
    state.requestInFlight = null;
    clearTick();
    clearInstructionTimer();
    clearWakeTimers();
    cancelSpeech();
    fadeOutMusic(true);
    renderTimer(state.remainingMs);
    updateSessionUi();
    setInstruction("Практика остановлена. Когда будете готовы, начните снова.");
    setInstructionStatus("серия не изменилась");
    renderStreak();
  }

  function handlePrimaryAction() {
    if (state.phase === "running") {
      pauseSession();
    } else if (state.phase === "paused") {
      resumeSession();
    } else {
      startSession(STANDARD_SESSION_MINUTES, null);
    }
  }

  function handleCustomStart() {
    const minutes = Number(el.customDuration.value) || 15;
    const trackName = el.customTrack.value || null;
    startSession(minutes, trackName, "custom");
  }

  function handleNsdrStart() {
    startSession(15, null, "nsdr");
  }

  // -------------------------------------------------------------------------
  // Музыка
  // -------------------------------------------------------------------------

  function ensureWakeAudio() {
    if (state.wakeAudio) return state.wakeAudio;
    const audio = new Audio("/sounds/wake-bell.wav");
    audio.preload = "auto";
    audio.volume = 0.55;
    audio.muted = state.muted;
    state.wakeAudio = audio;
    return audio;
  }

  function primeWakeAudio() {
    const audio = ensureWakeAudio();
    audio.muted = true;
    audio.volume = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.then === "function") {
      playPromise
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.muted = state.muted;
          audio.volume = 0.55;
        })
        .catch(() => {
          audio.muted = state.muted;
          audio.volume = 0.55;
        });
    }
  }

  function playWakeBell() {
    if (state.muted) return;
    const audio = ensureWakeAudio();
    audio.muted = false;
    audio.volume = 0.55;
    try {
      audio.currentTime = 0;
    } catch {
      // Позиция может быть недоступна до загрузки метаданных.
    }
    audio.play().catch(() => {
      // Если браузер заблокировал звук, завершение всё равно показывается.
    });
  }

  function clearWakeTimers() {
    if (state.wakeBellTimeout) {
      window.clearTimeout(state.wakeBellTimeout);
      state.wakeBellTimeout = null;
    }
    if (state.wakeSpeechTimeout) {
      window.clearTimeout(state.wakeSpeechTimeout);
      state.wakeSpeechTimeout = null;
    }
    if (state.wakeAudio) {
      state.wakeAudio.pause();
      try {
        state.wakeAudio.currentTime = 0;
      } catch {
        // Ничего страшного, если браузер ещё не загрузил метаданные.
      }
    }
  }

  function showNoMusic(notify = false, message = "Нет музыки в папке music/") {
    state.musicTrack = null;
    state.musicSource = null;
    state.currentTrack = null;
    state.audioFailedFor = "no-music";
    if (state.audio && !state.audio.paused) {
      state.audio.pause();
    }
    el.trackTitle.textContent = "Тишина";
    el.trackStatus.textContent = message;
    updatePlayerLabel();
    if (notify) {
      showToast(
        message === "Выбранный трек не найден"
          ? "Выбранный трек не найден. Обновите страницу или выберите другой."
          : "В папке music/ нет аудиофайлов. Добавьте mp3, m4a, aac, ogg, wav или flac.",
        6500,
      );
    }
  }

  async function loadTrack(
    trackName = null,
    { autoPlay = false, notifyEmpty = false } = {},
  ) {
    const selected = typeof trackName === "string" ? trackName.trim() : "";
    const query = selected ? `?track=${encodeURIComponent(selected)}` : "";
    const statusText = selected ? "Выбранный трек" : RANDOM_TRACK_STATUS;

    try {
      const data = await fetchJson(`/api/music${query}`, {}, 6_000);
      if (!data?.file) {
        showNoMusic(notifyEmpty, selected ? "Выбранный трек не найден" : undefined);
        return;
      }

      state.musicTrack = data;
      state.musicSource = selected ? "selected" : "random";
      state.audioFailedFor = "";
      if (state.phase === "running" && autoPlay) {
        playTrack(data, statusText);
      } else if (state.phase !== "running") {
        state.currentTrack = data;
        el.trackTitle.textContent = data.title || data.filename || "Тишина";
        el.trackStatus.textContent = statusText;
        updatePlayerLabel();
      }
    } catch (error) {
      if (error && error.status === 404) {
        showNoMusic(notifyEmpty, selected ? "Выбранный трек не найден" : undefined);
        return;
      }
      el.trackTitle.textContent = "Тишина";
      el.trackStatus.textContent = "Не удалось загрузить музыку";
      if (notifyEmpty) {
        showToast("Не удалось загрузить музыку. Проверьте соединение.");
      }
      updatePlayerLabel();
    }
  }

  function loadRandomTrack(options = {}) {
    return loadTrack(null, options);
  }

  function updateCustomDurationLabel() {
    const value = Number(el.customDuration.value) || 15;
    el.customDurationValue.textContent = minutesLabel(value);
  }

  async function loadTracks() {
    const select = el.customTrack;
    const previous = select.value;

    try {
      const data = await fetchJson("/api/tracks", {}, 6_000);
      const tracks = Array.isArray(data)
        ? data
        : Array.isArray(data?.tracks)
          ? data.tracks
          : [];
      const names = tracks.filter((name) => typeof name === "string" && name.trim());

      select.replaceChildren();
      state.tracksAvailable = names.length > 0;

      if (!state.tracksAvailable) {
        const empty = document.createElement("option");
        empty.value = "";
        empty.textContent = "Нет музыки в папке music/";
        select.append(empty);
      } else {
        const randomOption = document.createElement("option");
        randomOption.value = "";
        randomOption.textContent = "Случайный трек";
        select.append(randomOption);

        for (const name of names) {
          const option = document.createElement("option");
          option.value = name;
          option.textContent = name;
          select.append(option);
        }

        if (Array.from(select.options).some((option) => option.value === previous)) {
          select.value = previous;
        }
      }
    } catch {
      state.tracksAvailable = false;
      select.replaceChildren();
      const failed = document.createElement("option");
      failed.value = "";
      failed.textContent = "Не удалось загрузить список";
      select.append(failed);
    }

    updateSessionUi();
  }

  function ensureAudio() {
    if (state.audio) return state.audio;

    const audio = new Audio();
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0;
    audio.muted = state.muted;
    audio.addEventListener("playing", () => {
      if (!state.muted) el.player.classList.add("is-playing");
      updatePlayerLabel();
    });
    audio.addEventListener("pause", () => {
      el.player.classList.remove("is-playing");
      updatePlayerLabel();
    });
    audio.addEventListener("error", handleAudioError);
    state.audio = audio;
    return audio;
  }

  function handleAudioError() {
    el.player.classList.remove("is-playing");
    const file = state.currentTrack?.file || "";
    if (file && state.audioFailedFor !== file) {
      state.audioFailedFor = file;
      showToast(
        "Не удалось воспроизвести трек. Положите mp3 или m4a в папку music/ — имя может быть любым.",
        6500,
      );
    }
    let filename = file.split("/").pop() || "";
    try {
      filename = decodeURIComponent(filename);
    } catch {
      // Оставляем имя как есть, если в нём оказался некорректный escape.
    }
    el.trackStatus.textContent = filename
      ? `Не удалось воспроизвести ${filename}`
      : "Музыкальный файл недоступен";
    updatePlayerLabel();
  }

  function fadeAudioTo(target, duration, done) {
    const audio = ensureAudio();
    if (state.audioFade) {
      window.clearInterval(state.audioFade);
      state.audioFade = null;
    }

    const start = audio.volume;
    const startedAt = performance.now();
    const safeTarget = Math.max(0, Math.min(1, target));

    state.audioFade = window.setInterval(() => {
      const progress = Math.min(1, (performance.now() - startedAt) / duration);
      audio.volume = start + (safeTarget - start) * progress;
      if (progress >= 1) {
        window.clearInterval(state.audioFade);
        state.audioFade = null;
        if (typeof done === "function") done();
      }
    }, 40);
  }

  function playTrack(track, statusText) {
    if (!track) return;

    if (!track.file) {
      state.currentTrack = track;
      state.audioFailedFor = track.id || "missing";
      state.audioBlocked = false;
      if (state.audioFade) {
        window.clearInterval(state.audioFade);
        state.audioFade = null;
      }
      el.trackTitle.textContent = "Тишина";
      el.trackStatus.textContent = "Нет музыки в папке music/";
      if (state.audio && !state.audio.paused) {
        state.audio.pause();
      }
      if (state.missingTrackNotified !== "no-music") {
        state.missingTrackNotified = "no-music";
        showToast(
          "В папке music/ нет аудиофайлов. Добавьте mp3, m4a, aac, ogg, wav или flac.",
          6500,
        );
      }
      updatePlayerLabel();
      return;
    }

    state.missingTrackNotified = "";
    const audio = ensureAudio();

    if (state.audioFade) {
      window.clearInterval(state.audioFade);
      state.audioFade = null;
    }

    const sameSource = audio.src && audio.src.endsWith(track.file);
    state.currentTrack = track;
    state.audioFailedFor = "";
    el.trackTitle.textContent = track.title;
    if (statusText) el.trackStatus.textContent = statusText;

    if (sameSource && !audio.paused) {
      audio.muted = state.muted;
      fadeAudioTo(state.muted ? 0 : 0.32, 500);
      if (!state.muted) el.player.classList.add("is-playing");
      updatePlayerLabel();
      return;
    }

    if (!sameSource) {
      audio.pause();
      audio.src = track.file;
      audio.load();
    }

    audio.muted = state.muted;
    audio.volume = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.then === "function") {
      playPromise
        .then(() => {
          if (state.phase !== "running") {
            audio.pause();
            return;
          }
          state.audioBlocked = false;
          fadeAudioTo(state.muted ? 0 : 0.32, 900);
          if (!state.muted) el.player.classList.add("is-playing");
          updatePlayerLabel();
        })
        .catch(() => {
          state.audioBlocked = true;
          el.player.classList.remove("is-playing");
          el.trackStatus.textContent = "Нажмите на значок звука, чтобы включить музыку";
          updatePlayerLabel();
        });
    }
  }

  function fadeOutMusic(resetPosition = false) {
    const audio = state.audio;
    if (!audio) return;
    const finish = () => {
      if (!audio) return;
      audio.pause();
      if (resetPosition) {
        try {
          audio.currentTime = 0;
        } catch {
          // Некоторые браузеры не дают менять позицию до загрузки метаданных.
        }
      }
      el.player.classList.remove("is-playing");
      updatePlayerLabel();
    };

    if (audio.paused) {
      finish();
      return;
    }
    fadeAudioTo(0, 650, finish);
  }

  function retryAudio() {
    if (!state.audio || !state.currentTrack?.file) return;
    const audio = state.audio;
    if (state.audioFade) {
      window.clearInterval(state.audioFade);
      state.audioFade = null;
    }
    state.audioBlocked = false;
    audio.muted = state.muted;
    audio.volume = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.then === "function") {
      playPromise
        .then(() => {
          state.audioBlocked = false;
          if (state.phase === "running") {
            fadeAudioTo(state.muted ? 0 : 0.32, 700);
          }
          if (!state.muted) el.player.classList.add("is-playing");
          el.trackStatus.textContent = RANDOM_TRACK_STATUS;
          updatePlayerLabel();
        })
        .catch(() => {
          state.audioBlocked = true;
          el.player.classList.remove("is-playing");
          el.trackStatus.textContent = "Нажмите на значок звука, чтобы включить музыку";
          updatePlayerLabel();
        });
    }
  }

  function updatePlayerLabel() {
    const playing = Boolean(state.audio && !state.audio.paused && !state.muted);
    el.player.classList.toggle("is-playing", playing);

    if (state.phase === "running") {
      if (playing) {
        el.playerLabel.textContent = "сейчас играет";
      } else if (state.audioFailedFor) {
        el.playerLabel.textContent = "без музыки";
      } else {
        el.playerLabel.textContent = "звук сессии";
      }
    } else if (state.phase === "paused") {
      el.playerLabel.textContent = "на паузе";
    } else if (state.currentTrack && state.phase === "idle") {
      el.playerLabel.textContent = "случайный трек";
    } else if (state.audioFailedFor) {
      el.playerLabel.textContent = "нет музыки";
    } else {
      el.playerLabel.textContent = "звук сессии";
    }
  }

  function setMuted(muted) {
    state.muted = muted;
    writeMutedPreference(muted);

    if (state.audio) {
      state.audio.muted = muted;
      if (muted) state.audio.volume = 0;
    }
    if (state.wakeAudio) {
      state.wakeAudio.muted = muted;
    }
    if (muted) cancelSpeech();

    el.muteButton.setAttribute("aria-pressed", muted ? "true" : "false");
    el.muteButton.setAttribute("aria-label", muted ? "Включить звук" : "Выключить звук");
    el.muteButton.title = muted ? "Включить звук" : "Выключить звук";
    updatePlayerLabel();
    updateVoiceLabel();

    if (!muted && state.phase === "running") {
      if (state.audioBlocked) {
        retryAudio();
      } else if (state.audio && state.audio.paused && state.currentTrack?.file) {
        playTrack(state.currentTrack, RANDOM_TRACK_STATUS);
      } else if (state.audio) {
        fadeAudioTo(0.32, 600);
      }
    }
  }

  function handleSoundButton() {
    if (state.audioBlocked && !state.muted) {
      if (state.phase === "running") {
        retryAudio();
      } else {
        state.audioBlocked = false;
        setMuted(false);
      }
      return;
    }
    setMuted(!state.muted);
  }

  // -------------------------------------------------------------------------
  // Погода
  // -------------------------------------------------------------------------

  async function getGrantedPosition(askLocation = false) {
    if (!navigator.geolocation) return null;

    if (!askLocation && navigator.permissions) {
      try {
        const permission = await navigator.permissions.query({ name: "geolocation" });
        if (permission.state !== "granted") return null;
      } catch {
        return null;
      }
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        }),
        () => resolve(null),
        {
          maximumAge: 15 * 60 * 1000,
          timeout: askLocation ? 4_500 : 3_000,
          enableHighAccuracy: false,
        },
      );
    });
  }

  async function refreshWeather({ silent = false, askLocation = false } = {}) {
    if (state.weatherPromise) {
      try {
        await state.weatherPromise;
      } catch {
        // Ошибка уже обработана владельцем запроса.
      }
      if (!silent) {
        announceWeatherResult();
      }
      return;
    }

    const hadWeather = Boolean(state.weather);
    if (!hadWeather) el.weatherButton.dataset.weather = "loading";

    state.weatherPromise = (async () => {
      const position = await getGrantedPosition(askLocation);
      const params = new URLSearchParams();
      if (position) {
        params.set("lat", position.lat.toFixed(4));
        params.set("lon", position.lon.toFixed(4));
      }
      const query = params.toString();
      const data = await fetchJson(`/api/weather${query ? `?${query}` : ""}`, {}, 10_000);
      if (!data || !data.weather) {
        throw new Error("Некорректный ответ погоды");
      }

      state.weather = data;
      state.weatherFetchedAt = Date.now();
      updateWeatherUi(data);
      return data;
    })();

    try {
      await state.weatherPromise;
      if (!silent) announceWeatherResult();
    } catch {
      el.weatherButton.dataset.weather = state.weather?.weather?.condition || "unknown";
      if (!state.weather) {
        el.weatherText.textContent = "Погода";
        el.weatherButton.title = "Не удалось получить погоду";
        el.weatherButton.setAttribute(
          "aria-label",
          "Погода недоступна. Нажмите, чтобы попробовать снова.",
        );
      }
      if (!silent) {
        showToast("Не удалось получить погоду. Проверьте соединение и попробуйте ещё раз.");
      }
    } finally {
      state.weatherPromise = null;
      if (!hadWeather) {
        el.weatherButton.dataset.weather = state.weather?.weather?.condition || "unknown";
      }
    }
  }

  function hasTemperature(value) {
    return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
  }

  function updateWeatherUi(data) {
    const weather = data.weather;
    const temperature = hasTemperature(weather.temperature)
      ? `${Math.round(Number(weather.temperature))}°`
      : "";
    const label = [weather.description, temperature].filter(Boolean).join(" · ");

    el.weatherText.textContent = weather.available ? (label || "Погода") : "Погода";
    el.weatherButton.dataset.weather = weather.available ? weather.condition : "unknown";
    el.weatherButton.title = weather.available
      ? `${weather.city}: ${weather.description}${temperature ? `, ${temperature}` : ""}. Нажмите, чтобы обновить.`
      : "Погода недоступна. Нажмите, чтобы попробовать снова.";
    el.weatherButton.setAttribute(
      "aria-label",
      weather.available
        ? `Погода: ${weather.description}${temperature ? `, ${temperature}` : ""}. Нажмите, чтобы обновить.`
        : "Погода недоступна. Нажмите, чтобы попробовать снова.",
    );
  }

  function announceWeatherResult() {
    if (state.weather?.weather?.available) {
      const weather = state.weather.weather;
      const temp = hasTemperature(weather.temperature)
        ? `, ${Math.round(Number(weather.temperature))}°`
        : "";
      showToast(`${weather.city}: ${weather.description}${temp}`);
    } else {
      showToast("Погода недоступна. Музыка выбирается независимо.");
    }
  }

  function handleWeatherRefresh() {
    void refreshWeather({ silent: false, askLocation: true });
  }

  // -------------------------------------------------------------------------
  // Завершение и уведомления
  // -------------------------------------------------------------------------

  function showCompletion(result) {
    window.clearTimeout(state.toastTimer);
    el.toast.hidden = true;
    const isNsdr = state.sessionMode === "nsdr";
    const minutes = Math.max(1, Math.round(state.durationSeconds / 60));

    el.completionKicker.textContent = isNsdr ? "NSDR завершён" : "практика завершена";
    el.completionTitle.textContent = isNsdr
      ? "Восстановление завершено"
      : `${minutesLabel(minutes)} тишины`;
    el.completionCount.textContent = String(result.count);
    el.completionLabel.textContent = pluralizeDays(result.count, true);
    el.nsdrChecklist.hidden = !isNsdr;
    if (isNsdr) {
      el.nsdrChecklist.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
        checkbox.checked = false;
      });
      el.completionCopy.textContent = "Тело отдохнуло, сознание ясное. Выполните шаги ниже, чтобы вернуться в день с энергией.";
    } else if (result.alreadyToday) {
      el.completionCopy.textContent = "Сегодня уже отмечено. Ещё одна практика — тоже забота о себе.";
    } else if (result.count > 1) {
      el.completionCopy.textContent = "Серия продолжается. Вы подарили себе немного внимания — сохраните это ощущение.";
    } else {
      el.completionCopy.textContent = "Первый день новой серии. Вы подарили себе немного внимания — возвращайтесь завтра.";
    }

    state.lastFocused = document.activeElement;
    window.setTimeout(() => {
      if (state.phase !== "complete") return;
      el.completion.hidden = false;
      document.body.classList.add("modal-open");
      el.completionClose.focus();
    }, 380);
  }

  function closeCompletion() {
    if (el.completion.hidden) return;
    el.completion.hidden = true;
    document.body.classList.remove("modal-open");
    const target = state.lastFocused instanceof HTMLElement ? state.lastFocused : el.startButton;
    if (target && typeof target.focus === "function") target.focus();
  }

  function showToast(message, duration = 4200) {
    window.clearTimeout(state.toastTimer);
    el.toast.textContent = message;
    el.toast.hidden = false;
    state.toastTimer = window.setTimeout(() => {
      el.toast.hidden = true;
    }, duration);
  }

  function handleModalKeydown(event) {
    if (el.completion.hidden) return;

    if (event.key === "Escape") {
      event.preventDefault();
      closeCompletion();
      return;
    }

    if (event.key !== "Tab") return;
    const focusable = el.completion.querySelectorAll(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  // -------------------------------------------------------------------------
  // PWA
  // -------------------------------------------------------------------------

  function setupInstallPrompt() {
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      state.installPrompt = event;
      el.installButton.hidden = false;
    });

    el.installButton.addEventListener("click", async () => {
      if (!state.installPrompt) return;
      const prompt = state.installPrompt;
      state.installPrompt = null;
      el.installButton.hidden = true;
      try {
        prompt.prompt();
        await prompt.userChoice;
      } catch {
        showToast("Установку можно выполнить через меню браузера.");
      }
    });

    window.addEventListener("appinstalled", () => {
      state.installPrompt = null;
      el.installButton.hidden = true;
      showToast("ZenJarvis установлен. Теперь он всегда под рукой.");
    });
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // На HTTP по локальному IP service worker недоступен — это ожидаемо.
      });
    });
  }

  // -------------------------------------------------------------------------
  // События и запуск
  // -------------------------------------------------------------------------

  el.startButton.addEventListener("click", handlePrimaryAction);
  el.nsdrButton.addEventListener("click", handleNsdrStart);
  el.customStart.addEventListener("click", handleCustomStart);
  el.customDuration.addEventListener("input", updateCustomDurationLabel);
  el.stopButton.addEventListener("click", stopSession);
  el.muteButton.addEventListener("click", handleSoundButton);
  el.weatherButton.addEventListener("click", handleWeatherRefresh);
  el.completionClose.addEventListener("click", closeCompletion);
  el.completion.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.hasAttribute("data-close-completion")) {
      closeCompletion();
    }
  });

  document.addEventListener("keydown", handleModalKeydown);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      renderToday();
      if (state.phase === "running") tick();
    }
  });

  window.addEventListener("online", () => {
    showToast("Соединение вернулось — подсказки снова будут живыми.");
    if (!state.weather) void refreshWeather({ silent: true });
  });

  window.addEventListener("offline", () => {
    showToast("Нет сети. Медитация продолжится с локальными подсказками.");
  });

  if (speech) {
    refreshVoices();
    if (typeof speech.addEventListener === "function") {
      speech.addEventListener("voiceschanged", refreshVoices);
    } else {
      speech.onvoiceschanged = refreshVoices;
    }
  }

  setupInstallPrompt();
  registerServiceWorker();
  renderToday();
  renderStreak();
  updateCustomDurationLabel();
  renderTimer(state.remainingMs);
  updateSessionUi();
  setMuted(state.muted);
  void loadTracks();
  void loadRandomTrack();
  void refreshWeather({ silent: true });
})();
