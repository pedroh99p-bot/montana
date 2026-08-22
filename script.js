(() => {
  "use strict";

  document.documentElement.classList.add("js-ready");

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const schedulerUrl = $('meta[name="montana:scheduler-url"]')?.content.trim() || "";

  const trackEvent = (name, detail = {}) => {
    const safeDetail = { ...detail, path: window.location.pathname };
    window.dispatchEvent(new CustomEvent(`montana:${name}`, { detail: safeDetail }));
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: name, ...safeDetail });
  };

  const storedAttribution = (() => {
    const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid"];
    const current = Object.fromEntries(keys.map((key) => [key, new URLSearchParams(window.location.search).get(key)]).filter(([, value]) => value));
    try {
      if (Object.keys(current).length) sessionStorage.setItem("montana_attribution", JSON.stringify(current));
      return JSON.parse(sessionStorage.getItem("montana_attribution") || "{}") || {};
    } catch {
      return current;
    }
  })();

  // Progresso de leitura
  const progressBar = $(".scroll-progress span");
  let progressTicking = false;
  const updateProgress = () => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollable > 0 ? Math.min(100, (window.scrollY / scrollable) * 100) : 0;
    if (progressBar) progressBar.style.width = `${progress}%`;
    progressTicking = false;
  };
  window.addEventListener("scroll", () => {
    if (!progressTicking) {
      progressTicking = true;
      requestAnimationFrame(updateProgress);
    }
  }, { passive: true });
  updateProgress();

  // Revelação progressiva
  const revealItems = $$(".reveal");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  } else {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px" });
    revealItems.forEach((item) => revealObserver.observe(item));
  }

  // Menu mobile independente do header sticky
  const menu = $("#mobile-menu");
  const menuToggle = $(".menu-toggle");
  const menuClose = $(".menu-close");
  const backgroundNodes = [$(".site-header"), $("main"), $(".site-footer"), $(".mobile-sticky-cta")].filter(Boolean);
  let lockedScrollY = 0;
  let closeTimer = 0;

  const getFocusable = () => menu ? $$('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])', menu).filter((item) => !item.hidden) : [];

  const openMenu = () => {
    if (!menu || !menuToggle || menu.classList.contains("is-open")) return;
    clearTimeout(closeTimer);
    lockedScrollY = window.scrollY;
    menu.hidden = false;
    menu.setAttribute("aria-hidden", "false");
    menuToggle.setAttribute("aria-expanded", "true");
    menuToggle.setAttribute("aria-label", "Fechar menu");
    backgroundNodes.forEach((node) => node.setAttribute("inert", ""));
    document.body.classList.add("menu-open");
    Object.assign(document.body.style, {
      position: "fixed",
      top: `-${lockedScrollY}px`,
      left: "0",
      right: "0",
      width: "100%"
    });
    requestAnimationFrame(() => menu.classList.add("is-open"));
    window.setTimeout(() => menuClose?.focus(), 40);
    trackEvent("menu_open");
  };

  const closeMenu = ({ restoreFocus = true } = {}) => {
    if (!menu || !menuToggle || menu.hidden) return;
    menu.classList.remove("is-open");
    menu.setAttribute("aria-hidden", "true");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Abrir menu");
    backgroundNodes.forEach((node) => node.removeAttribute("inert"));
    document.body.classList.remove("menu-open");
    Object.assign(document.body.style, { position: "", top: "", left: "", right: "", width: "" });
    window.scrollTo(0, lockedScrollY);
    closeTimer = window.setTimeout(() => { menu.hidden = true; }, 230);
    if (restoreFocus) window.setTimeout(() => menuToggle.focus(), 30);
  };

  menuToggle?.addEventListener("click", openMenu);
  menuClose?.addEventListener("click", () => closeMenu());
  menu?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = getFocusable();
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
  });
  $$("a[href^='#']", menu || document.createElement("div")).forEach((link) => {
    link.addEventListener("click", (event) => {
      const target = $(link.getAttribute("href"));
      if (!target) return;
      event.preventDefault();
      closeMenu({ restoreFocus: false });
      window.setTimeout(() => target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }), 250);
    });
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 900 && menu && !menu.hidden) closeMenu({ restoreFocus: false });
  });

  // Deck visual: títulos ficam livres e a explicação permanece no status inferior
  const deckCopy = {
    instagram: { label: "01 / MARCA & CONTEÚDO", copy: "Clareza para transformar atenção em interesse real." },
    trafego: { label: "02 / TRÁFEGO & CAMPANHAS", copy: "Aquisição conectada a uma jornada preparada para converter." },
    sites: { label: "03 / SITES & LOJAS", copy: "Experiências digitais com uma próxima ação objetiva." },
    sistemas: { label: "04 / SISTEMAS & IA", copy: "Processos, dados e automações que sustentam a operação." }
  };
  const deckCards = $$("[data-deck-card]");
  const deckStatus = $("[data-deck-status]");
  const deckStatusLabel = $(".deck-status > span");
  const activateDeckCard = (card) => {
    deckCards.forEach((item) => {
      const active = item === card;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    const content = deckCopy[card.dataset.deckCard];
    if (content && deckStatus && deckStatusLabel) {
      deckStatusLabel.textContent = content.label;
      deckStatus.textContent = content.copy;
    }
  };
  deckCards.forEach((card) => card.addEventListener("click", () => activateDeckCard(card)));

  const tiltDeck = $("[data-tilt-deck]");
  if (tiltDeck && window.matchMedia("(pointer: fine)").matches && !reduceMotion) {
    const scene = tiltDeck.closest(".deck-scene");
    scene?.addEventListener("pointermove", (event) => {
      const rect = scene.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      tiltDeck.style.transform = `rotateX(${(-y * 5).toFixed(2)}deg) rotateY(${(x * 5).toFixed(2)}deg)`;
    });
    scene?.addEventListener("pointerleave", () => { tiltDeck.style.transform = "rotateX(0) rotateY(0)"; });
  }

  // Diagnóstico em duas perguntas
  const expressForm = $("#express-form");
  const diagnosticResults = {
    brand: {
      title: "Clareza de oferta antes de mais alcance",
      copy: "O primeiro ganho tende a vir de uma mensagem mais precisa e de uma experiência que mostre valor antes de pedir uma decisão.",
      connection: "Clareza de oferta + experiência de conversão"
    },
    leads: {
      title: "Aquisição com destino preparado",
      copy: "Gerar mais movimento só faz sentido quando campanha, criativo e página conduzem a mesma oferta e permitem acompanhar a resposta.",
      connection: "Aquisição + destino preparado para converter"
    },
    contacts: {
      title: "A próxima oportunidade está no acompanhamento",
      copy: "Antes de aumentar o volume, vale organizar como cada contato avança, quem assume a conversa e qual ação não pode ser esquecida.",
      connection: "Jornada comercial + acompanhamento"
    },
    operation: {
      title: "Processo visível antes de novas ferramentas",
      copy: "O avanço tende a vir de uma operação mais clara, com dados, responsáveis e automações aplicados ao que hoje consome tempo ou perde contexto.",
      connection: "Processo + visão operacional"
    }
  };
  const solutionLabels = {
    site: "Site ou landing page",
    traffic: "Tráfego e campanhas",
    store: "Loja ou canal de vendas",
    systems: "Sistema, automação ou IA",
    guidance: "Orientação estratégica"
  };
  let prefilledSolution = "";

  const setDiagnosticProgress = (index) => {
    $$(".form-progress span", expressForm || document).forEach((item, itemIndex) => item.classList.toggle("is-active", itemIndex <= index));
  };
  const showDiagnosticStep = (number) => {
    if (!expressForm) return;
    $$("[data-step]", expressForm).forEach((step) => {
      const active = Number(step.dataset.step) === number;
      step.hidden = !active;
      step.classList.toggle("is-visible", active);
    });
    $("[data-diagnostic-result]", expressForm).hidden = true;
    $("[data-diagnostic-capture]", expressForm).hidden = true;
    setDiagnosticProgress(number - 1);
    const legend = $(`[data-step="${number}"] legend`, expressForm);
    if (legend) legend.tabIndex = -1;
    window.setTimeout(() => legend?.focus(), 0);
  };
  const finishDiagnostic = () => {
    if (!expressForm) return;
    const bottleneck = $("input[name='bottleneck']:checked", expressForm)?.value;
    const solution = $("input[name='solution']:checked", expressForm)?.value;
    if (!bottleneck || !solution) return;
    const result = diagnosticResults[bottleneck];
    $$("[data-step]", expressForm).forEach((step) => { step.hidden = true; });
    const resultBox = $("[data-diagnostic-result]", expressForm);
    const captureBox = $("[data-diagnostic-capture]", expressForm);
    $("[data-result-title]", expressForm).textContent = result.title;
    $("[data-result-copy]", expressForm).textContent = `${result.copy} A solução indicada por você foi: ${solutionLabels[solution]}.`;
    $("[data-result-connection]", expressForm).textContent = result.connection;
    resultBox.hidden = false;
    captureBox.hidden = false;
    setDiagnosticProgress(2);
    resultBox.tabIndex = -1;
    resultBox.focus();
    trackEvent("diagnostic_complete", { bottleneck, solution });
  };

  if (expressForm) {
    $$('input[name="bottleneck"]', expressForm).forEach((input) => input.addEventListener("change", () => {
      trackEvent("diagnostic_step", { step: 1, bottleneck: input.value });
      window.setTimeout(() => {
        showDiagnosticStep(2);
        if (prefilledSolution) {
          const preferred = $(`input[name="solution"][value="${prefilledSolution}"]`, expressForm);
          if (preferred) {
            preferred.checked = true;
            prefilledSolution = "";
            window.setTimeout(finishDiagnostic, 180);
          }
        }
      }, reduceMotion ? 0 : 180);
    }));
    $$('input[name="solution"]', expressForm).forEach((input) => input.addEventListener("change", () => window.setTimeout(finishDiagnostic, reduceMotion ? 0 : 180)));
    $("[data-diagnostic-back]", expressForm)?.addEventListener("click", () => showDiagnosticStep(1));
    $("[data-diagnostic-restart]", expressForm)?.addEventListener("click", () => {
      expressForm.reset();
      prefilledSolution = "";
      $("[data-form-status]", expressForm).textContent = "";
      $("[data-form-fallback]", expressForm).hidden = true;
      $("[data-form-success]", expressForm).hidden = true;
      showDiagnosticStep(1);
      trackEvent("diagnostic_restart");
    });
  }

  $$('[data-diagnostic-prefill]').forEach((link) => link.addEventListener("click", () => {
    prefilledSolution = link.dataset.diagnosticPrefill || "";
    trackEvent("path_selected", { solution: prefilledSolution });
  }));

  // Formulários: envio real ou fallback explícito
  const contactIsValid = (value) => {
    const clean = value.trim();
    const looksEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean);
    const digits = clean.replace(/\D/g, "");
    return looksEmail || (digits.length >= 10 && digits.length <= 15);
  };

  const validateForm = (form) => {
    let valid = true;
    $$('[required]', form).forEach((field) => {
      const fieldValid = field.type === "checkbox" ? field.checked : field.value.trim().length > 1 && field.checkValidity();
      field.setAttribute("aria-invalid", String(!fieldValid));
      if (!fieldValid) valid = false;
    });
    const contact = $('[name="contact"]', form);
    if (contact && contact.value && !contactIsValid(contact.value)) {
      contact.setAttribute("aria-invalid", "true");
      valid = false;
    }
    const optionalUrl = $('input[type="url"]', form);
    if (optionalUrl?.value && !optionalUrl.checkValidity()) {
      optionalUrl.setAttribute("aria-invalid", "true");
      valid = false;
    }
    return valid;
  };

  const serializeForm = (form, formType) => {
    const raw = Object.fromEntries(new FormData(form).entries());
    delete raw.consent;
    return {
      formType,
      ...raw,
      consent: $('[name="consent"]', form)?.checked === true,
      attribution: storedAttribution,
      entryPage: window.location.pathname,
      diagnosticResult: formType === "express" ? $("[data-result-connection]", form)?.textContent || "" : ""
    };
  };

  const briefingText = (form, formType) => {
    const data = serializeForm(form, formType);
    if (formType === "express") {
      return [
        "Olá, Montana. Fiz o diagnóstico expresso da landing page.",
        `Nome: ${data.name || ""}`,
        `Empresa/projeto: ${data.company || ""}`,
        `Gargalo: ${data.bottleneck || ""}`,
        `Solução considerada: ${solutionLabels[data.solution] || data.solution || ""}`,
        `Leitura inicial: ${data.diagnosticResult || ""}`
      ].join("\n");
    }
    return [
      "Olá, Montana. Quero conversar sobre um projeto.",
      `Nome: ${data.name || ""}`,
      `Empresa/projeto: ${data.company || ""}`,
      `Site/perfil: ${data.site || "Não informado"}`,
      `Objetivo: ${data.goal || ""}`,
      `Prazo: ${data.timeline || ""}`,
      `Contexto: ${data.context || ""}`
    ].join("\n");
  };

  const copyBriefing = async (form, formType, button) => {
    try {
      await navigator.clipboard.writeText(briefingText(form, formType));
      const original = button.textContent;
      button.textContent = "Resumo copiado ✓";
      window.setTimeout(() => { button.textContent = original; }, 2200);
      trackEvent("briefing_copy", { form_type: formType });
    } catch {
      const status = $("[data-form-status]", form);
      status.textContent = "Não foi possível copiar automaticamente. Você pode continuar pelo Direct.";
      status.classList.add("is-error");
    }
  };

  const setSubmitting = (button, active) => {
    if (!button.dataset.originalLabel) button.dataset.originalLabel = button.innerHTML;
    button.disabled = active;
    button.innerHTML = active ? "Enviando…" : button.dataset.originalLabel;
  };

  const showFormFallback = (form, message) => {
    const status = $("[data-form-status]", form);
    status.textContent = message;
    status.classList.add("is-error");
    $("[data-form-fallback]", form).hidden = false;
    $("[data-form-success]", form).hidden = true;
  };

  const showFormSuccess = (form) => {
    const status = $("[data-form-status]", form);
    status.textContent = "";
    status.classList.remove("is-error");
    $("[data-form-fallback]", form).hidden = true;
    const success = $("[data-form-success]", form);
    success.hidden = false;
    const scheduler = $("[data-scheduler-link]", success);
    if (schedulerUrl && scheduler) {
      scheduler.href = schedulerUrl;
      scheduler.hidden = false;
    }
  };

  const submitLead = async (form, formType) => {
    const status = $("[data-form-status]", form);
    const submit = $('.form-submit', form);
    status.classList.remove("is-error");
    $("[data-form-fallback]", form).hidden = true;
    $("[data-form-success]", form).hidden = true;

    if (!validateForm(form)) {
      status.textContent = "Revise os campos obrigatórios e informe um WhatsApp ou e-mail válido.";
      status.classList.add("is-error");
      $('[aria-invalid="true"]', form)?.focus();
      trackEvent("lead_validation_error", { form_type: formType });
      return;
    }

    setSubmitting(submit, true);
    trackEvent("lead_submit_attempt", { form_type: formType });
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(serializeForm(form, formType)),
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`lead-endpoint-${response.status}`);
      showFormSuccess(form);
      trackEvent("lead_submit_success", { form_type: formType });
    } catch (error) {
      const unavailable = String(error.message).includes("404") || String(error.message).includes("503") || error.name === "AbortError";
      showFormFallback(form, unavailable
        ? "O canal automático ainda não está disponível. Seu resumo foi preservado: copie e continue pelo Direct."
        : "Não foi possível registrar o envio agora. Copie o resumo e continue pelo Direct.");
      trackEvent("lead_submit_fallback", { form_type: formType, reason: error.name === "AbortError" ? "timeout" : "endpoint" });
    } finally {
      window.clearTimeout(timeout);
      setSubmitting(submit, false);
    }
  };

  const qualificationForm = $("#qualification-form");
  [
    { form: expressForm, type: "express" },
    { form: qualificationForm, type: "qualification" }
  ].forEach(({ form, type }) => {
    if (!form) return;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submitLead(form, type);
    });
    $("[data-copy-briefing]", form)?.addEventListener("click", (event) => copyBriefing(form, type, event.currentTarget));
    $$('input, select, textarea', form).forEach((field) => field.addEventListener("input", () => field.removeAttribute("aria-invalid")));
  });

  // Prefill em memória, sem gravar dados pessoais no navegador
  if (expressForm && qualificationForm) {
    ["name", "company", "contact"].forEach((name) => {
      const source = $(`[name="${name}"]`, expressForm);
      const target = $(`[name="${name}"]`, qualificationForm);
      source?.addEventListener("input", () => {
        if (target && !target.value) target.value = source.value;
      });
    });
  }

  // FAQ com uma resposta por vez
  $$(".faq-list details").forEach((detail) => detail.addEventListener("toggle", () => {
    if (!detail.open) return;
    $$(".faq-list details").forEach((other) => { if (other !== detail) other.open = false; });
    trackEvent("faq_open", { question: detail.querySelector("summary")?.textContent.replace("+", "").trim().slice(0, 80) || "" });
  }));

  // CTA móvel somente fora das zonas principais de conversão
  const stickyCta = $(".mobile-sticky-cta");
  if (stickyCta && "IntersectionObserver" in window) {
    const states = new Map();
    const zones = [$(".hero"), $("#diagnostico-expresso"), $("#qualificacao"), $(".final-section")].filter(Boolean);
    const updateSticky = () => {
      const heroVisible = states.get(zones[0]) !== false;
      const conversionVisible = zones.slice(1).some((zone) => states.get(zone) === true);
      stickyCta.classList.toggle("is-visible", !heroVisible && !conversionVisible && !document.body.classList.contains("menu-open"));
    };
    const stickyObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => states.set(entry.target, entry.isIntersecting));
      updateSticky();
    }, { threshold: 0.05 });
    zones.forEach((zone) => stickyObserver.observe(zone));
  }

  $$('[data-track-cta]').forEach((cta) => cta.addEventListener("click", () => trackEvent("cta_click", { cta: cta.dataset.trackCta })));
  $$('[data-scheduler-link]').forEach((link) => link.addEventListener("click", () => trackEvent("scheduler_click")));
  $$('[data-current-year]').forEach((item) => { item.textContent = String(new Date().getFullYear()); });
})();
