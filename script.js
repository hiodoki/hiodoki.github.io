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
  let currentScreen = document.querySelector(".screen.is-active")?.id || "home";
  let isSwitching = false;
  const TRANSITION_MS = reduceMotion ? 0 : 400;

  // Подставляем текущий год в футер автоматически.
  document.getElementById("year").textContent = new Date().getFullYear();

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
