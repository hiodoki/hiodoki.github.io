/* =========================
   HIODOKI — переключение экранов без перезагрузки
   ========================= */
(() => {
  "use strict";

  const screens = [...document.querySelectorAll(".screen")];
  const navigation = document.getElementById("topNav");
  const navLinks = [...document.querySelectorAll(".nav-link")];
  const screenStatus = document.getElementById("screenStatus");
  const validScreens = new Set(screens.map((screen) => screen.id));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hoverSupported = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  let currentScreen = document.querySelector(".screen.is-active")?.id || "home";
  let isSwitching = false;
  const TRANSITION_MS = reduceMotion ? 0 : 400;

  // Подставляем текущий год в футер автоматически.
  document.getElementById("year").textContent = new Date().getFullYear();

  /*
   * UI-звуки.
   * Используются обычные MP3 hover.mp3 и click.mp3 рядом с index.html.
   * hover.mp3 и click.mp3 созданы из пользовательских исходников с нормализованной громкостью.
   * URL строится относительно папки самого script.js — работает и на GitHub Pages в подпапке.
   */
  const SCRIPT_BASE_URL = new URL("./", document.currentScript?.src || document.baseURI);
  const HOVER_SOUND_URL = new URL("hover.mp3?v=audio-fix-3", SCRIPT_BASE_URL).href;
  const CLICK_SOUND_URL = new URL("click.mp3?v=audio-fix-3", SCRIPT_BASE_URL).href;
  const INTERACTIVE_SELECTOR = "a, button, [role=\"button\"]";
  const HOVER_VOLUME = 0.24;
  const CLICK_VOLUME = 0.21;
  let audioUnlocked = false;
  const reportedAudioErrors = new Set();

  function attachAudioErrorReport(audio, label) {
    audio.addEventListener("error", () => {
      if (reportedAudioErrors.has(label)) return;
      reportedAudioErrors.add(label);
      console.error(
        `[hiodoki audio] Не удалось загрузить ${label}. Проверь, что файл лежит рядом с index.html:`,
        audio.currentSrc || audio.src,
        audio.error || "неизвестная ошибка"
      );
    });
  }

  const clickSound = new Audio(CLICK_SOUND_URL);
  clickSound.preload = "auto";
  clickSound.volume = CLICK_VOLUME;
  attachAudioErrorReport(clickSound, "click.mp3");
  clickSound.load();

  // Hover тоже заранее запрашивается, чтобы первый звук запускался без заметной задержки.
  const hoverPreloader = new Audio(HOVER_SOUND_URL);
  hoverPreloader.preload = "auto";
  attachAudioErrorReport(hoverPreloader, "hover.mp3");
  hoverPreloader.load();

  function playHoverSound() {
    // До первого осознанного действия браузер может запрещать звук по своей autoplay-политике.
    if (!audioUnlocked) return;

    // Отдельный экземпляр на каждое наведение: быстрые движения мыши не обрезают хвосты.
    const hoverSound = new Audio(HOVER_SOUND_URL);
    hoverSound.preload = "auto";
    hoverSound.volume = HOVER_VOLUME;
    attachAudioErrorReport(hoverSound, "hover.mp3");
    hoverSound.addEventListener("ended", () => {
      hoverSound.removeAttribute("src");
      hoverSound.load();
    }, { once: true });
    hoverSound.play().catch((error) => {
      console.warn("[hiodoki audio] Не удалось воспроизвести hover.mp3:", error);
    });
  }

  function playClickSound() {
    // Один экземпляр для клика: каждый новый клик начинает короткий эффект сначала.
    clickSound.pause();
    try {
      clickSound.currentTime = 0;
    } catch (_error) {
      // Если файл ещё загружается, play() дождётся доступности аудиоданных.
    }
    clickSound.play().catch((error) => {
      console.warn("[hiodoki audio] Не удалось воспроизвести click.mp3:", error);
    });
  }

  // Первый реальный жест пользователя снимает autoplay-блокировку браузера.
  // Звук клика запускается на pointerdown, чтобы не зависеть от дальнейшей SPA-навигации.
  if (hoverSupported) {
    document.addEventListener("pointerover", (event) => {
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      if (!(event.target instanceof Element)) return;
      const control = event.target.closest(INTERACTIVE_SELECTOR);
      if (!control) return;
      const previousTarget = event.relatedTarget;
      if (previousTarget instanceof Node && control.contains(previousTarget)) return;
      playHoverSound();
    }, { passive: true });
  }

  document.addEventListener("pointerdown", (event) => {
    if (event.isPrimary === false || event.button !== 0) return;
    audioUnlocked = true;
    if (!(event.target instanceof Element)) return;
    if (event.target.closest(INTERACTIVE_SELECTOR)) playClickSound();
  }, true);

  // Клавиатурная активация (Enter / Space) генерирует click без pointerdown.
  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    if (!event.target.closest(INTERACTIVE_SELECTOR)) return;
    if (event.detail === 0) {
      audioUnlocked = true;
      playClickSound();
    }
  }, true);

  // На главной панель навигации скрыта; на остальных экранах — доступна.
  function updateNavigation(screenId) {
    const showNavigation = screenId !== "home";
    navigation.classList.toggle("is-visible", showNavigation);
    navigation.setAttribute("aria-hidden", String(!showNavigation));

    navLinks.forEach((link) => {
      const isCurrent = link.dataset.screen === screenId;
      if (isCurrent) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
      // Скрытые ссылки не должны попадать в последовательность Tab.
      link.tabIndex = showNavigation ? 0 : -1;
    });
  }

  function activateScreen(screenId, options = {}) {
    if (!validScreens.has(screenId) || isSwitching || screenId === currentScreen) return;

    const previousScreen = document.getElementById(currentScreen);
    const nextScreen = document.getElementById(screenId);
    if (!previousScreen || !nextScreen) return;

    isSwitching = true;
    const { updateHash = true } = options;

    // Сначала плавно затухает предыдущий экран, затем показывается следующий.
    previousScreen.classList.add("is-leaving");

    window.setTimeout(() => {
      previousScreen.classList.remove("is-active", "is-leaving");
      previousScreen.hidden = true;
      previousScreen.setAttribute("aria-hidden", "true");

      nextScreen.hidden = false;
      nextScreen.setAttribute("aria-hidden", "false");
      nextScreen.classList.remove("is-leaving");
      // Перезапуск CSS-анимации при повторном открытии вкладки.
      void nextScreen.offsetWidth;
      nextScreen.classList.add("is-active");

      currentScreen = screenId;
      updateNavigation(screenId);
      screenStatus.textContent = `Открыт раздел: ${screenId}`;

      if (updateHash) {
        const newHash = screenId === "home" ? "" : `#${screenId}`;
        history.replaceState(null, "", `${location.pathname}${location.search}${newHash}`);
      }

      isSwitching = false;
    }, TRANSITION_MS);
  }

  // Большие карточки на стартовом экране и ссылки в верхней панели используют одну логику.
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-screen]");
    if (!trigger) return;

    const screenId = trigger.dataset.screen;
    if (!validScreens.has(screenId)) return;

    event.preventDefault();
    activateScreen(screenId);
  });

  // Позволяет открывать вкладку прямой ссылкой вроде index.html#bio.
  function activateFromHash() {
    const requested = location.hash.slice(1);
    if (validScreens.has(requested) && requested !== currentScreen) {
      activateScreen(requested, { updateHash: false });
    }
  }

  window.addEventListener("hashchange", activateFromHash);

  // Начальное состояние: только главный экран виден, меню скрыто.
  screens.forEach((screen) => {
    const active = screen.id === currentScreen;
    screen.hidden = !active;
    screen.setAttribute("aria-hidden", String(!active));
    screen.classList.toggle("is-active", active);
  });
  updateNavigation(currentScreen);
  activateFromHash();
})();
