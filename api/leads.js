const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 5;
const rateBuckets = new Map();

const allowed = {
  formType: ["express", "qualification"],
  bottleneck: ["brand", "leads", "contacts", "operation"],
  solution: ["site", "traffic", "store", "systems", "guidance"],
  goal: ["presence", "opportunities", "conversion", "operation", "guidance"],
  timeline: ["asap", "30-days", "60-90-days", "evaluating"]
};

const attributionKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid"];

const cleanText = (value, maxLength = 300) => typeof value === "string"
  ? value.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, maxLength)
  : "";

const contactIsValid = (value) => {
  const clean = cleanText(value, 160);
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean);
  const digits = clean.replace(/\D/g, "");
  return email || (digits.length >= 10 && digits.length <= 15);
};

const getIp = (request) => cleanText(
  String(request.headers["x-forwarded-for"] || request.socket?.remoteAddress || "unknown").split(",")[0],
  80
);

const rateLimited = (ip) => {
  const now = Date.now();
  const current = (rateBuckets.get(ip) || []).filter((timestamp) => now - timestamp < RATE_WINDOW_MS);
  if (current.length >= RATE_LIMIT) {
    rateBuckets.set(ip, current);
    return true;
  }
  current.push(now);
  rateBuckets.set(ip, current);
  if (rateBuckets.size > 1000) {
    for (const [key, timestamps] of rateBuckets) {
      if (!timestamps.some((timestamp) => now - timestamp < RATE_WINDOW_MS)) rateBuckets.delete(key);
    }
  }
  return false;
};

const respond = (response, status, payload) => {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  return response.status(status).json(payload);
};

module.exports = async function leadHandler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return respond(response, 405, { ok: false, code: "METHOD_NOT_ALLOWED" });
  }

  const contentType = String(request.headers["content-type"] || "");
  if (!contentType.includes("application/json")) {
    return respond(response, 415, { ok: false, code: "JSON_REQUIRED" });
  }

  const contentLength = Number(request.headers["content-length"] || 0);
  if (contentLength > 24_000) {
    return respond(response, 413, { ok: false, code: "PAYLOAD_TOO_LARGE" });
  }

  if (rateLimited(getIp(request))) {
    return respond(response, 429, { ok: false, code: "RATE_LIMITED" });
  }

  let body = request.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return respond(response, 400, { ok: false, code: "INVALID_JSON" });
    }
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return respond(response, 400, { ok: false, code: "INVALID_PAYLOAD" });
  }

  // Bots que preencherem o campo invisível recebem resposta neutra sem encaminhamento.
  if (cleanText(body.website_url, 100)) {
    return respond(response, 202, { ok: true });
  }

  const formType = allowed.formType.includes(body.formType) ? body.formType : "";
  const name = cleanText(body.name, 100);
  const company = cleanText(body.company, 140);
  const contact = cleanText(body.contact, 160);
  if (!formType || name.length < 2 || company.length < 2 || !contactIsValid(contact) || body.consent !== true) {
    return respond(response, 422, { ok: false, code: "VALIDATION_FAILED" });
  }

  const lead = {
    formType,
    name,
    company,
    contact,
    consent: true,
    entryPage: cleanText(body.entryPage, 240),
    submittedAt: new Date().toISOString(),
    attribution: Object.fromEntries(attributionKeys.map((key) => [key, cleanText(body.attribution?.[key], 180)]).filter(([, value]) => value))
  };

  if (formType === "express") {
    if (!allowed.bottleneck.includes(body.bottleneck) || !allowed.solution.includes(body.solution)) {
      return respond(response, 422, { ok: false, code: "VALIDATION_FAILED" });
    }
    lead.bottleneck = body.bottleneck;
    lead.solution = body.solution;
    lead.diagnosticResult = cleanText(body.diagnosticResult, 220);
  } else {
    if (!allowed.goal.includes(body.goal) || !allowed.timeline.includes(body.timeline)) {
      return respond(response, 422, { ok: false, code: "VALIDATION_FAILED" });
    }
    lead.goal = body.goal;
    lead.timeline = body.timeline;
    lead.site = cleanText(body.site, 240);
    lead.context = cleanText(body.context, 2000);
    if (lead.context.length < 10) {
      return respond(response, 422, { ok: false, code: "VALIDATION_FAILED" });
    }
  }

  const webhookUrl = cleanText(process.env.LEAD_WEBHOOK_URL, 500);
  if (!/^https:\/\//i.test(webhookUrl)) {
    return respond(response, 503, { ok: false, code: "LEAD_DESTINATION_NOT_CONFIGURED" });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const headers = { "Content-Type": "application/json", "User-Agent": "MontanaTechLab-Leads/1.0" };
    if (process.env.LEAD_WEBHOOK_SECRET) headers.Authorization = `Bearer ${process.env.LEAD_WEBHOOK_SECRET}`;
    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ source: "montana-landing-page", lead }),
      signal: controller.signal
    });
    if (!webhookResponse.ok) {
      return respond(response, 502, { ok: false, code: "LEAD_DESTINATION_FAILED" });
    }
    return respond(response, 200, { ok: true });
  } catch {
    return respond(response, 502, { ok: false, code: "LEAD_DESTINATION_FAILED" });
  } finally {
    clearTimeout(timeout);
  }
};
