(() => {
  "use strict";
  const cfg = window.WEDDING_CONFIG || {};
  const $ = (s) => document.querySelector(s);
  const configured = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes("YOUR-") && window.supabase;
  const sb = configured ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;

  // ---------- Tiện ích ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = (u) => (typeof u === "string" && /^(https?:\/\/|\/|data:image\/)/i.test(u.trim()) ? u.trim() : "");
  const cssUrl = (u) => safeUrl(u).replace(/['"()\\\s]/g, (ch) => encodeURIComponent(ch));
  // Bỏ chữ "Ông"/"Bà" nếu admin đã gõ sẵn, tránh thành "Ông: Ông ..."
  const stripTitle = (name, t) => String(name || "").trim().replace(new RegExp("^" + t + "[\\s:.]+", "i"), "");
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  function merge(base, over) {
    if (!isObj(over)) return base;
    const out = { ...base };
    for (const k of Object.keys(over)) {
      const v = over[k];
      if (isObj(v) && isObj(base[k])) out[k] = merge(base[k], v);
      else if (v !== undefined && v !== null) out[k] = v;
    }
    return out;
  }
  // Ngày giờ nhập trong admin hiểu theo giờ Việt Nam
  const toDate = (s) => {
    if (!s) return null;
    const d = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(s) ? s : s + ":00+07:00");
    return isNaN(d) ? null : d;
  };
  const WEEKDAYS = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
  const vnParts = (d) => {
    const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false }).formatToParts(d);
    const o = Object.fromEntries(p.map((x) => [x.type, x.value]));
    const wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[o.weekday];
    return { ...o, wd };
  };
  const fmtDate = (d) => { const p = vnParts(d); return `${p.day}.${p.month}.${p.year}`; };
  const fmtFull = (d) => { const p = vnParts(d); return `${p.hour}:${p.minute} · ${WEEKDAYS[p.wd]}, ${p.day}/${p.month}/${p.year}`; };
  const gcalStamp = (d) => { const p = vnParts(d); return `${p.year}${p.month}${p.day}T${p.hour}${p.minute}00`; };

  const toast = (msg) => {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2200);
  };
  const setSticker = (el, url) => { const u = safeUrl(url); if (u) { el.src = u; el.hidden = false; } else el.hidden = true; };
  const hideSection = (id, hide) => { const el = document.getElementById(id); if (el) el.hidden = !!hide; };

  // ---------- Tải dữ liệu ----------
  async function load() {
    let data = {}, gallery = [], wishes = [];
    if (sb) {
      const [s, g, w] = await Promise.all([
        sb.from("site_settings").select("data").eq("id", 1).maybeSingle(),
        sb.from("gallery").select("url,caption,sort_order,created_at").order("sort_order").order("created_at"),
        sb.from("wishes").select("name,message,created_at").order("created_at", { ascending: false }).limit(200),
      ]);
      if (s.error) console.warn(s.error);
      data = s.data?.data || {};
      gallery = g.data || [];
      wishes = w.data || [];
    } else {
      const bar = document.createElement("div");
      bar.className = "demo-bar";
      bar.textContent = "Đang xem dữ liệu mẫu. Hãy điền Supabase vào config.js để lấy nội dung từ trang admin.";
      $("#page").prepend(bar);
      wishes = [{ name: "Bạn thân", message: "Chúc hai bạn trăm năm hạnh phúc!" }];
    }
    return { s: merge(window.WEDDING_DEFAULTS, data), gallery, wishes };
  }

  // ---------- Hiển thị ----------
  function render(state) {
    const { s, gallery, wishes } = state;
    const wDate = toDate(s.weddingDate);
    const names = `${s.couple.groomName} & ${s.couple.brideName}`;
    document.title = `${names} · Thiệp cưới`;

    // Bìa
    const guest = new URLSearchParams(location.search).get("to");
    const cv = s.cover || {};
    $("#coverTo").textContent = cv.line1 || "";
    $("#coverGuest").textContent = guest ? guest.slice(0, 60) : (cv.guestDefault || "Bạn");
    $("#coverLine2").textContent = cv.line2 || "";
    $("#coverTo").hidden = !cv.line1; $("#coverLine2").hidden = !cv.line2;
    $("#coverNames").innerHTML = `<span>${esc(s.couple.groomName)}</span><span class="amp">&amp;</span><span>${esc(s.couple.brideName)}</span>`;
    $("#coverDate").textContent = wDate ? fmtDate(wDate) : "";
    setSticker($("#coverSticker"), s.decor.coverSticker);

    // Hero
    const hero = safeUrl(s.hero.image);
    if (hero) $("#heroPhoto").style.backgroundImage = `url("${cssUrl(hero)}")`;
    $("#heroTitle").textContent = s.hero.title;
    $("#groomName").textContent = s.couple.groomName;
    $("#brideName").textContent = s.couple.brideName;
    $("#heroDate").textContent = wDate ? fmtDate(wDate) : "";
    setSticker($("#heroSticker"), s.decor.heroSticker);

    // Chữ chạy (nhân đôi để chạy liền mạch)
    const lines = String(s.marquee || "").split("\n").map((x) => x.trim()).filter(Boolean);
    const one = lines.map((l) => `<span>${esc(l)}</span>`).join("");
    $("#marquee").innerHTML = one + one + one + one;
    $(".ribbon").hidden = !lines.length;

    // Lời mời & cặp đôi
    $("#inviteText").textContent = s.invite;
    const person = (p, role, fam, sticker) => `
      <article class="person">
        <div class="person-photo" ${safeUrl(p.photo) ? `style="background-image:url('${cssUrl(p.photo)}')"` : ""} role="img" aria-label="${esc(p.fullName)}">
          ${safeUrl(sticker) ? `<img class="sticker person-sticker" src="${esc(safeUrl(sticker))}" alt="">` : ""}
        </div>
        <p class="person-role">${role}</p>
        <h3>${esc(p.fullName)}</h3>
        ${p.bio ? `<p class="person-bio">${esc(p.bio)}</p>` : ""}
        ${p.father || p.mother ? `<div class="person-family">
          ${p.father ? `<p><span>Ông:</span> ${esc(stripTitle(p.father, "ông"))}</p>` : ""}
          ${p.mother ? `<p><span>Bà:</span> ${esc(stripTitle(p.mother, "bà"))}</p>` : ""}
        </div>` : ""}
        ${p.address ? `<p class="muted">${esc(p.address)}</p>` : ""}
      </article>`;
    $("#couple").innerHTML = person(s.groom, "Chú rể", "Con ông bà", s.decor.groomSticker) + person(s.bride, "Cô dâu", "Con ông bà", s.decor.brideSticker);

    // Đếm ngược + lịch
    startCountdown(wDate);
    const mainEvent = (s.events || []).find((e) => /tiệc/i.test(e.title)) || (s.events || [])[0];
    if (wDate) {
      const end = new Date(wDate.getTime() + 3 * 3600e3);
      const q = new URLSearchParams({
        action: "TEMPLATE", text: `Đám cưới ${names}`, dates: `${gcalStamp(wDate)}/${gcalStamp(end)}`,
        ctz: "Asia/Ho_Chi_Minh", location: mainEvent ? `${mainEvent.place}, ${mainEvent.address}` : "", details: location.href.split("?")[0],
      });
      $("#calBtn").href = "https://calendar.google.com/calendar/render?" + q;
    } else $("#calBtn").hidden = true;

    // Sự kiện
    const events = s.events || [];
    hideSection("events-section", !events.length);
    $("#events").innerHTML = events.map((e) => {
      const d = toDate(e.time);
      const embed = mapEmbedSrc(e.mapEmbed);
      const dir = safeUrl(e.mapLink) || (e.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.address)}` : "");
      return `<article class="event">
        ${safeUrl(e.image) ? `<div class="event-img" style="background-image:url('${cssUrl(e.image)}')"></div>` : ""}
        <div class="event-body">
          <h3>${esc(e.title)}</h3>
          ${d ? `<p class="event-time">${esc(fmtFull(d))}</p>` : ""}
          ${e.lunar ? `<p class="event-lunar">${esc(e.lunar)}</p>` : ""}
          ${e.place ? `<p class="event-place">${esc(e.place)}</p>` : ""}
          ${e.address ? `<p class="event-address">${esc(e.address)}</p>` : ""}
          <div class="event-actions">${dir ? `<a class="btn btn-primary btn-small" href="${esc(dir)}" target="_blank" rel="noopener">Chỉ đường</a>` : ""}</div>
        </div>
        ${embed ? `<iframe class="event-map" src="${esc(embed)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Bản đồ ${esc(e.title)}"></iframe>` : ""}
      </article>`;
    }).join("");

    // RSVP chọn sự kiện
    const pick = $("#eventPick");
    pick.innerHTML = `<option value="all">Tất cả</option>` + events.map((e) => `<option>${esc(e.title)}</option>`).join("");
    $("#eventPickWrap").hidden = events.length < 2;

    // Lịch trình + dress code
    const sch = s.schedule || [];
    $("#schedule").innerHTML = sch.map((x) => `<li><time>${esc(x.time)}</time><span>${esc(x.title)}</span></li>`).join("");
    const colors = String(s.dressCode?.colors || "").split(",").map((c) => c.trim()).filter((c) => /^#[0-9a-f]{3,8}$/i.test(c));
    $("#dresscode").innerHTML = s.dressCode?.text || colors.length
      ? `<h3>Trang phục gợi ý</h3><p>${esc(s.dressCode.text)}</p><div class="swatches">${colors.map((c) => `<span class="swatch" style="background:${c}"></span>`).join("")}</div>` : "";
    hideSection("schedule-section", !sch.length && !colors.length && !s.dressCode?.text);
    setSticker($("#dividerSticker"), s.decor.dividerSticker);

    // Câu chuyện
    const story = s.story || [];
    hideSection("story-section", !story.length);
    $("#story").innerHTML = story.map((x) => `<li>
      <p class="story-date">${esc(x.date)}</p><h3>${esc(x.title)}</h3><p>${esc(x.content)}</p>
      ${safeUrl(x.image) ? `<img class="story-img" src="${esc(safeUrl(x.image))}" alt="${esc(x.title)}" loading="lazy">` : ""}
    </li>`).join("");

    // Album
    const photos = gallery.filter((g) => safeUrl(g.url));
    $("#album").innerHTML = photos.length
      ? photos.map((g, i) => `<button type="button" data-i="${i}" aria-label="Xem ảnh ${i + 1}"><img src="${esc(safeUrl(g.url))}" alt="${esc(g.caption || "")}" loading="lazy"></button>`).join("")
      : `<p class="empty">Ảnh cưới sẽ sớm được cập nhật.</p>`;
    setupLightbox(photos);

    // RSVP
    hideSection("rsvp-section", s.rsvp?.enabled === false);
    $("#rsvpDeadline").textContent = s.rsvp?.deadline || "";
    setSticker($("#rsvpSticker"), s.decor.rsvpSticker);
    renderWishes(wishes);

    // Mừng cưới
    const gifts = [s.gift.groom, s.gift.bride].filter((g) => g && (g.account || safeUrl(g.qr)));
    hideSection("gift-section", s.gift.enabled === false || !gifts.length);
    $("#giftNote").textContent = s.gift.note;
    // Hai hộp quà đóng: bấm hộp nào mới hiện tài khoản người đó
    const giftBox = (g, i) => `<button type="button" class="gift-box" data-gift="${i}" aria-expanded="false" aria-controls="giftPanel">
        <span class="gb" aria-hidden="true"><span class="gb-lid"></span><span class="gb-body"></span><span class="gb-bow"></span></span>
        <span class="gb-label">${esc(g.label)}</span>
        <span class="gb-hint">Bấm để mở</span>
      </button>`;
    const giftDetail = (g) => `
      <button type="button" class="gift-close" aria-label="Đóng">×</button>
      <h3>${esc(g.label)}</h3>
      ${safeUrl(g.qr) ? `<img class="gift-qr" src="${esc(safeUrl(g.qr))}" alt="Mã QR ${esc(g.label)}">` : ""}
      ${g.bank ? `<p>${esc(g.bank)}</p>` : ""}
      ${g.account ? `<p class="gift-acc">${esc(g.account)}</p>` : ""}
      ${g.owner ? `<p class="muted">${esc(g.owner)}</p>` : ""}
      ${g.account ? `<button class="btn btn-ghost btn-small" type="button" data-copy="${esc(g.account)}">Sao chép số tài khoản</button>` : ""}`;
    $("#gifts").innerHTML = `<div class="gift-boxes${gifts.length === 1 ? " single" : ""}">${gifts.map(giftBox).join("")}</div>
      <div class="gift-panel" id="giftPanel" role="region" aria-live="polite" hidden></div>`;
    const panel = $("#giftPanel");
    const closeGift = () => {
      panel.hidden = true; panel.innerHTML = "";
      document.querySelectorAll(".gift-box").forEach((b) => { b.setAttribute("aria-expanded", "false"); b.classList.remove("open"); b.querySelector(".gb-hint").textContent = "Bấm để mở"; });
    };
    $("#gifts").onclick = (e) => {
      if (e.target.closest(".gift-close")) { closeGift(); return; }
      const box = e.target.closest(".gift-box"); if (!box) return;
      const wasOpen = box.classList.contains("open");
      closeGift();
      if (wasOpen) return;
      box.classList.add("open"); box.setAttribute("aria-expanded", "true"); box.querySelector(".gb-hint").textContent = "Bấm để đóng";
      panel.innerHTML = giftDetail(gifts[+box.dataset.gift]); panel.hidden = false;
      panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };

    // Footer
    $("#thanks").textContent = s.thanks;
    $("#footerNames").textContent = names;
    setSticker($("#footerSticker"), s.decor.footerSticker);

    // Liên hệ dạng thiệp
    renderContacts(s);

    // Sticker gắn trên đầu từng mục
    const SECTION_STICKERS = {
      inviteSticker: "invite", eventsSticker: "events-section",
      scheduleSticker: "schedule-section", storySticker: "story-section", albumSticker: "album-section",
      wishesSticker: "wishes-section", giftSticker: "gift-section", contactSticker: "contact-section",
    };
    for (const [key, id] of Object.entries(SECTION_STICKERS)) {
      const sec = document.getElementById(id), u = safeUrl(s.decor[key]);
      if (!sec || !u) continue;
      const im = document.createElement("img");
      im.className = "sticker section-sticker"; im.src = u; im.alt = ""; im.loading = "lazy";
      const h2 = sec.querySelector(":scope > h2");
      h2 ? sec.insertBefore(im, h2) : sec.prepend(im);
    }
    setSticker($("#floatSticker"), s.decor.floatSticker);

    // Chữ Hỉ
    document.body.classList.toggle("no-hi", s.decor.showHi === false);

    // Nhạc
    // Danh sách nhạc (hỗ trợ cả kiểu cũ 1 bài)
    let tracks = (s.music?.tracks || []).filter((t) => t && safeUrl(t.url)).map((t) => ({ title: t.title || "", url: safeUrl(t.url) }));
    if (!tracks.length && safeUrl(s.music?.url)) tracks = [{ title: s.music.title || "", url: safeUrl(s.music.url) }];
    if (s.music?.shuffle) for (let i = tracks.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [tracks[i], tracks[j]] = [tracks[j], tracks[i]]; }
    state.tracks = tracks;
    if (tracks.length) {
      $("#bgm").src = tracks[0].url; $("#bgm").volume = 0.6; $("#bgm").loop = tracks.length === 1;
      $("#musicTitle").textContent = tracks[0].title;
      $("#musicCtrl").hidden = false; $("#musicNext").hidden = tracks.length < 2;
    }
  }

  function renderContacts(s) {
    const zaloUrl = (z) => {
      z = String(z || "").trim(); if (!z) return "";
      if (/^https?:\/\//i.test(z)) return safeUrl(z);
      const digits = z.replace(/[^\d]/g, ""); return digits ? `https://zalo.me/${digits}` : "";
    };
    const card = (p, role) => {
      const tel = String(p.phone || "").replace(/[^\d+]/g, "");
      const zalo = zaloUrl(p.zalo);
      const fb = safeUrl(p.facebook);
      const helpers = (p.helpers || []).filter((h) => h && (h.name || h.phone));
      if (!tel && !zalo && !fb && !helpers.length) return "";
      const helperHtml = helpers.length ? `<div class="helpers">
          <p class="helpers-title">Người hỗ trợ ${role === "Chú rể" ? "nhà trai" : "nhà gái"}</p>
          ${helpers.map((h) => {
            const ht = String(h.phone || "").replace(/[^\d+]/g, ""), hz = zaloUrl(h.zalo);
            return `<div class="helper">
              <div class="helper-info"><strong>${esc(h.name)}</strong>${h.role ? `<span>${esc(h.role)}</span>` : ""}${h.phone ? `<span class="helper-phone">${esc(h.phone)}</span>` : ""}</div>
              <div class="helper-btns">
                ${ht ? `<a class="cbtn-mini cbtn-phone" href="tel:${esc(ht)}" aria-label="Gọi ${esc(h.name)}">☎</a>` : ""}
                ${hz ? `<a class="cbtn-mini cbtn-zalo" href="${esc(hz)}" target="_blank" rel="noopener" aria-label="Zalo ${esc(h.name)}">Z</a>` : ""}
              </div>
            </div>`;
          }).join("")}
        </div>` : "";
      return `<article class="contact-card">
        <span class="hi hi-corner tl" aria-hidden="true">囍</span><span class="hi hi-corner br" aria-hidden="true">囍</span>
        <div class="contact-photo" ${safeUrl(p.photo) ? `style="background-image:url('${cssUrl(p.photo)}')"` : ""}></div>
        <p class="person-role">${role}</p>
        <h3>${esc(p.fullName)}</h3>
        ${p.phone ? `<p class="contact-phone">${esc(p.phone)}</p>` : ""}
        <div class="contact-btns">
          ${tel ? `<a class="cbtn cbtn-phone" href="tel:${esc(tel)}"><span class="cbtn-ic" aria-hidden="true">☎</span>Gọi điện</a>` : ""}
          ${zalo ? `<a class="cbtn cbtn-zalo" href="${esc(zalo)}" target="_blank" rel="noopener"><span class="cbtn-ic" aria-hidden="true">Z</span>Zalo</a>` : ""}
          ${fb ? `<a class="cbtn cbtn-fb" href="${esc(fb)}" target="_blank" rel="noopener"><span class="cbtn-ic" aria-hidden="true">f</span>Facebook</a>` : ""}
        </div>
        ${helperHtml}
      </article>`;
    };
    const html = card(s.groom, "Chú rể") + card(s.bride, "Cô dâu");
    $("#contacts").innerHTML = html;
    hideSection("contact-section", !html);
  }

  function mapEmbedSrc(raw) {
    if (!raw) return "";
    const m = String(raw).match(/src=["']([^"']+)["']/);
    const src = (m ? m[1] : String(raw)).trim();
    return /^https:\/\/(www\.)?google\.[a-z.]+\/maps\/embed/i.test(src) ? src : "";
  }

  function renderWishes(list) {
    const cards = list.map((w) => `<div class="wish"><strong>${esc(w.name)}</strong><p>${esc(w.message)}</p></div>`).join("");
    $("#wishes").innerHTML = list.length ? cards : `<p class="empty">Hãy là người đầu tiên gửi lời chúc nhé.</p>`;
    renderPanel(list);
  }

  // Cột lời chúc bên trái (máy tính): tự cuộn chậm lên trên khi nhiều lời chúc
  // Cột sổ lưu bút trên máy tính: chữ trôi liên tục lên trên, lặp vòng không giật
  const panelState = { off: 0, period: 0, list: [], raf: 0, hover: false, hold: 0, started: false };
  function renderPanel(list) {
    panelState.list = list;
    if (!panelState.resizeBound) {
      panelState.resizeBound = true;
      let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => renderPanel(panelState.list), 200); });
    }
    const track = $("#wpTrack"), feed = $("#wpFeed");
    if (!list.length) { track.innerHTML = `<p class="empty">Hãy là người đầu tiên gửi lời chúc nhé.</p>`; panelState.period = 0; panelState.off = 0; track.style.transform = ""; return; }
    // Màu xen kẽ theo thứ tự lời chúc (không theo vị trí) để chỗ nối vòng không bị lệch màu
    const one = list.map((w, i) => `<div class="wish${i % 2 ? " alt" : ""}"><strong>${esc(w.name)}</strong><p>${esc(w.message)}</p></div>`).join("");
    track.innerHTML = one;
    const h1 = track.scrollHeight, fh = feed.clientHeight;
    if (!h1 || !fh) { panelState.period = 0; return; } // cột đang ẩn (điện thoại)
    track.innerHTML = one.repeat(Math.max(2, Math.ceil(fh / h1) + 1));
    panelState.period = h1;
    wrapPanel(); paintPanel();
    startPanel();
  }
  function wrapPanel() {
    const p = panelState.period; if (!p) return;
    while (panelState.off <= -p) panelState.off += p;
    while (panelState.off > 0) panelState.off -= p;
  }
  function paintPanel() { $("#wpTrack").style.transform = `translate3d(0, ${panelState.off}px, 0)`; }
  function startPanel() {
    if (panelState.started) return;
    panelState.started = true;
    const feed = $("#wpFeed"), reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    feed.addEventListener("mouseenter", () => (panelState.hover = true));
    feed.addEventListener("mouseleave", () => { panelState.hover = false; panelState.hold = Date.now(); });
    feed.addEventListener("wheel", (e) => { e.preventDefault(); panelState.off -= e.deltaY; wrapPanel(); paintPanel(); panelState.hold = Date.now(); }, { passive: false });
    let dragY = null;
    feed.addEventListener("pointerdown", (e) => { dragY = e.clientY; feed.setPointerCapture(e.pointerId); });
    feed.addEventListener("pointermove", (e) => { if (dragY === null) return; panelState.off += e.clientY - dragY; dragY = e.clientY; wrapPanel(); paintPanel(); });
    const end = () => { dragY = null; panelState.hold = Date.now(); };
    feed.addEventListener("pointerup", end); feed.addEventListener("pointercancel", end);
    let last = 0;
    const step = (t) => {
      const dt = Math.min(64, t - (last || t)); last = t;
      if (panelState.period && !panelState.hover && dragY === null && !document.hidden && !reduce.matches && Date.now() - panelState.hold > 1500) {
        panelState.off -= dt * 0.03; // khoảng 30px mỗi giây
        wrapPanel(); paintPanel();
      }
      panelState.raf = requestAnimationFrame(step);
    };
    panelState.raf = requestAnimationFrame(step);
  }

  // Trang đầu điện thoại: lời chúc lần lượt nổi lên trên nền ảnh
  // Lời chúc trôi liên tục lên trên (điện thoại), lặp vòng không giật
  const feedState = { off: 0, period: 0, raf: 0, last: 0 };
  function buildFeed(state, fromBottom) {
    const feed = $("#mFeed"), track = $("#mTrack");
    const list = (state.wishes || []).slice(0, 40);
    if (!list.length) { track.innerHTML = `<div class="bubble"><span>💌 Hãy là người đầu tiên gửi lời chúc nhé!</span></div>`; feedState.period = 0; feedState.off = 0; track.style.transform = ""; return; }
    const one = list.map((w) => `<div class="bubble"><span><b class="bn">${esc(w.name)}</b> ${esc(w.message)}</span></div>`).join("");
    track.innerHTML = one;
    const h1 = track.scrollHeight || 1, fh = feed.clientHeight || 140;
    const copies = Math.max(2, Math.ceil(fh / h1) + 1);
    track.innerHTML = one.repeat(copies);
    feedState.period = h1;
    if (fromBottom) feedState.off = fh;
    track.style.transform = `translate3d(0, ${feedState.off}px, 0)`;
  }
  function bubbleShow() { /* lời chúc mới: dựng lại dòng chạy, lời mới nhất vào từ phía dưới */ buildFeed(window.__wstate, true); }
  function startBubbles(state) {
    window.__wstate = state;
    const mq = window.matchMedia("(max-width: 699px)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    buildFeed(state, true);
    mq.addEventListener("change", () => buildFeed(state, true));
    cancelAnimationFrame(feedState.raf);
    const step = (t) => {
      const dt = Math.min(64, t - (feedState.last || t)); feedState.last = t;
      if (mq.matches && !document.hidden && !reduce.matches && feedState.period &&
          !document.documentElement.classList.contains("feed-off")) {
        feedState.off -= dt * 0.022; // khoảng 22px mỗi giây
        if (feedState.off <= -feedState.period) feedState.off += feedState.period;
        $("#mTrack").style.transform = `translate3d(0, ${feedState.off}px, 0)`;
      }
      feedState.raf = requestAnimationFrame(step);
    };
    feedState.raf = requestAnimationFrame(step);
  }

  let cdTimer;
  // Đếm ngược hiện ở trang đầu: 4 ô dưới ngày cưới (máy tính) và dải nhỏ trên ảnh (điện thoại)
  function startCountdown(target) {
    const boxes = $("#heroCountdown"), chip = $("#heroCd");
    if (!target) { boxes.hidden = true; chip.hidden = true; return; }
    const dateTxt = fmtDate(target);
    const pad = (n) => String(n).padStart(2, "0");
    const tick = () => {
      let diff = Math.max(0, target - Date.now());
      if (diff === 0) {
        boxes.innerHTML = `<p class="cd-done">Hôm nay là ngày chung đôi!</p>`;
        chip.innerHTML = `<span class="hc-date">${dateTxt}</span><span class="hc-sep"></span><span>Hôm nay là ngày chung đôi!</span>`;
        clearInterval(cdTimer); return;
      }
      const d = Math.floor(diff / 864e5); diff -= d * 864e5;
      const h = Math.floor(diff / 36e5); diff -= h * 36e5;
      const m = Math.floor(diff / 6e4); const sec = Math.floor((diff - m * 6e4) / 1e3);
      boxes.innerHTML = [[d, "ngày"], [h, "giờ"], [m, "phút"], [sec, "giây"]]
        .map(([n, l]) => `<div class="cd-box"><span class="cd-num">${pad(n)}</span><span class="cd-label">${l}</span></div>`).join("");
      chip.innerHTML = `<span class="hc-date">${dateTxt}</span><span class="hc-sep"></span>`
        + `<span>Còn <b>${d}</b> ngày <b>${pad(h)}</b>:<b>${pad(m)}</b>:<b>${pad(sec)}</b></span>`;
    };
    tick(); clearInterval(cdTimer); cdTimer = setInterval(tick, 1000);
  }

  function setupLightbox(photos) {
    const dlg = $("#lightbox"); let idx = 0;
    const show = (i) => {
      idx = (i + photos.length) % photos.length;
      $("#lbImg").src = photos[idx].url; $("#lbImg").alt = photos[idx].caption || "";
      $("#lbCap").textContent = photos[idx].caption || "";
    };
    $("#album").onclick = (e) => {
      const b = e.target.closest("button[data-i]"); if (!b) return;
      show(+b.dataset.i); dlg.showModal();
    };
    dlg.querySelector(".lb-close").onclick = () => dlg.close();
    dlg.querySelector(".lb-prev").onclick = () => show(idx - 1);
    dlg.querySelector(".lb-next").onclick = () => show(idx + 1);
    dlg.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") show(idx - 1); if (e.key === "ArrowRight") show(idx + 1); });
    let x0 = null;
    dlg.addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
    dlg.addEventListener("touchend", (e) => {
      if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1)); x0 = null;
    });
  }

  // ---------- Tương tác ----------
  function bindEvents(state) {
    const audio = $("#bgm"), mBtn = $("#musicBtn"), mLabel = mBtn.querySelector(".music-label");
    const setUI = (on) => {
      mBtn.classList.toggle("playing", on); mBtn.setAttribute("aria-pressed", on);
      mLabel.textContent = on ? "Tắt nhạc" : "Bật nhạc";
    };
    let wantPlay = false;
    const play = () => { wantPlay = true; return audio.src && audio.play().then(() => setUI(true)).catch(() => setUI(false)); };
    audio.addEventListener("pause", () => setUI(false));
    // Chuyển bài: hết bài tự sang bài sau, lỗi bài nào thì bỏ qua bài đó
    const tracks = state.tracks || [];
    let idx = 0, fails = 0;
    const goTo = (i, autoPlay) => {
      if (!tracks.length) return;
      idx = (i + tracks.length) % tracks.length;
      audio.src = tracks[idx].url;
      $("#musicTitle").textContent = tracks[idx].title;
      if (autoPlay) play();
    };
    audio.addEventListener("ended", () => { if (tracks.length > 1) goTo(idx + 1, true); });
    audio.addEventListener("playing", () => { fails = 0; });
    audio.addEventListener("error", () => {
      if (tracks.length > 1 && fails < tracks.length) { fails++; goTo(idx + 1, wantPlay); }
    });
    $("#musicNext").onclick = () => {
      mBtn.classList.remove("nudge");
      goTo(idx + 1, true);
      if (tracks[idx].title) toast("♪ " + tracks[idx].title);
    };
    $("#openBtn").onclick = () => {
      document.body.classList.add("opened");
      $("#page").removeAttribute("aria-hidden");
      if (state.s.music?.autoplay) play();
      else if (audio.src) mBtn.classList.add("nudge");
    };
    mBtn.onclick = () => {
      mBtn.classList.remove("nudge");
      if (audio.paused) play(); else { wantPlay = false; audio.pause(); }
    };

    document.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-copy]"); if (!b) return;
      try { await navigator.clipboard.writeText(b.dataset.copy); toast("Đã sao chép số tài khoản"); }
      catch { toast(b.dataset.copy); }
    });

    $("#shareBtn").onclick = async () => {
      const url = location.href.split("?")[0];
      if (navigator.share) { try { await navigator.share({ title: document.title, url }); } catch {} }
      else { try { await navigator.clipboard.writeText(url); toast("Đã sao chép link thiệp"); } catch { toast(url); } }
    };

    const form = $("#rsvpForm"), msg = $("#rsvpMsg");
    const guest = new URLSearchParams(location.search).get("to");
    form.name.value = savedName() || (guest ? guest.slice(0, 100) : "");
    form.onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(form);
      const name = String(f.get("name") || "").trim();
      if (!name) { msg.textContent = "Bạn nhập tên giúp mình nhé."; form.name.focus(); return; }
      const attending = f.get("attending") === "yes";
      const row = {
        name, phone: String(f.get("phone") || "").trim() || null, attending,
        guests: attending ? +f.get("guests") : 0, side: f.get("side"), event: f.get("event") || "all",
        message: String(f.get("message") || "").trim() || null,
      };
      const btn = form.querySelector("button[type=submit]");
      btn.disabled = true; msg.textContent = "Đang gửi…";
      try {
        if (sb) {
          const r = await sb.from("rsvps").insert(row);
          if (r.error) throw r.error;
          if (row.message) {
            const w = await sb.from("wishes").insert({ name, message: row.message });
            if (w.error) throw w.error;
          }
        }
        if (row.message) state.wishes.unshift({ name, message: row.message });
        renderWishes(state.wishes);
        msg.textContent = attending ? "Cảm ơn bạn! Hẹn gặp bạn trong ngày vui nhé." : "Cảm ơn bạn đã gửi lời chúc!";
        form.reset(); if (guest) form.name.value = guest;
      } catch (err) {
        console.error(err);
        msg.textContent = "Gửi chưa được. Kiểm tra mạng rồi thử lại giúp mình nhé.";
      } finally { btn.disabled = false; }
    };
  }

  const NAME_KEY = "wedding_wish_name";
  const savedName = () => { try { return localStorage.getItem(NAME_KEY) || ""; } catch { return ""; } };
  const saveName = (n) => { try { localStorage.setItem(NAME_KEY, n); } catch {} };

  async function sendWish(state, name, message) {
    if (sb) { const r = await sb.from("wishes").insert({ name, message }); if (r.error) throw r.error; }
    saveName(name);
    state.wishes.unshift({ name, message }); renderWishes(state.wishes);
    tickerShow(0, state); bubbleShow({ name, message }); renderBook(state);
  }

  function bindWishForm(state) {
    const form = $("#wishForm"), msg = $("#wishMsg"), dlg = $("#wishDialog");
    setupMobileWish(state);
    document.querySelectorAll("[data-open-wish]").forEach((b) => b.addEventListener("click", () => {
      msg.textContent = ""; dlg.showModal(); (form.name.value ? form.message : form.name).focus();
    }));
    dlg.querySelector("[data-close-wish]").onclick = () => dlg.close();
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
    $("#wishTicker").onclick = () => document.getElementById("wishes-section").scrollIntoView({ behavior: "smooth" });
    startTicker(state); startBubbles(state);
    const guest = new URLSearchParams(location.search).get("to");
    if (guest) form.name.value = guest.slice(0, 100);
    form.onsubmit = async (e) => {
      e.preventDefault();
      const name = form.name.value.trim(), message = form.message.value.trim();
      if (!name) { msg.textContent = "Bạn nhập tên giúp mình nhé."; form.name.focus(); return; }
      if (!message) { msg.textContent = "Bạn viết vài lời chúc nhé."; form.message.focus(); return; }
      const btn = form.querySelector("button[type=submit]");
      btn.disabled = true; msg.textContent = "Đang gửi…";
      try {
        await sendWish(state, name, message);
        msg.textContent = "Cảm ơn bạn! Lời chúc đã được gửi.";
        form.message.value = ""; $("#mInput").value = "";
        setTimeout(() => { dlg.close(); toast("Đã gửi lời chúc 💌"); }, 900);
      } catch (err) {
        console.error(err); msg.textContent = "Gửi chưa được. Kiểm tra mạng rồi thử lại giúp mình nhé.";
      } finally { btn.disabled = false; }
    };
  }

  // ---------- Lời chúc chạy trên đầu màn hình ----------
  let tickIdx = 0, tickTimer;
  function tickerShow(i, state) {
    const t = $("#wishTicker"), list = state.wishes || [];
    if (!list.length) { t.innerHTML = `<span class="wt-text">💌 Hãy là người đầu tiên gửi lời chúc nhé!</span>`; return; }
    tickIdx = i % Math.min(list.length, 30);
    const w = list[tickIdx];
    t.innerHTML = `<span class="wt-text"><b>${esc(w.name)}:</b> ${esc(w.message)}</span>`;
  }
  function startTicker(state) {
    tickerShow(0, state); clearInterval(tickTimer);
    tickTimer = setInterval(() => tickerShow(tickIdx + 1, state), 4500);
  }

  // ---------- Chấm chuyển trang ----------
  // ---------- Điện thoại: Sổ lưu bút & Mừng cưới nằm trong ngăn kéo cố định ----------
  function setupDock() {
    const mq = window.matchMedia("(max-width: 699px)");
    const wishSec = document.getElementById("wishes-section"), giftSec = document.getElementById("gift-section");
    const homes = [
      { sec: giftSec, parent: giftSec.parentNode, next: giftSec.nextSibling, sheet: $("#giftSheet .sheet-body") },
    ];
    const place = () => {
      homes.forEach((h) => mq.matches ? h.sheet.append(h.sec) : h.parent.insertBefore(h.sec, h.next));
      if (!mq.matches) document.querySelectorAll("dialog.sheet[open]").forEach((d) => d.close());
      buildDots();
    };
    $("#mGift").hidden = giftSec.hidden;
    $("#mGift").onclick = () => $("#giftSheet").showModal();
    document.querySelectorAll("dialog.sheet").forEach((d) => {
      d.querySelector("[data-close-sheet]").onclick = () => d.close();
      d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
    });
    $("#wishTicker").onclick = () => wishSec.scrollIntoView({ behavior: "smooth" });
    mq.addEventListener("change", place);
    place();
  }

  // ---------- Điện thoại: ô gửi lời chúc, cột nút, sổ lưu bút ----------
  function setupMobileWish(state) {
    const input = $("#mInput"), dlg = $("#wishDialog"), form = $("#wishForm");
    $("#mBar").onsubmit = async (e) => {
      e.preventDefault();
      const message = input.value.trim();
      if (!message) { input.focus(); return; }
      const name = savedName();
      if (!name) {
        // Lần đầu: hỏi tên, lời chúc được điền sẵn
        form.message.value = message; $("#wishMsg").textContent = "";
        dlg.showModal(); form.name.focus(); return;
      }
      const btn = $("#mBar .m-send"); btn.disabled = true;
      try { await sendWish(state, name, message); input.value = ""; input.blur(); toast("Đã gửi lời chúc 💌"); }
      catch (err) { console.error(err); toast("Gửi chưa được, thử lại giúp mình nhé"); }
      finally { btn.disabled = false; }
    };

    // Ẩn / hiện lời chúc đang chạy
    const chat = $("#mChat");
    chat.onclick = () => {
      const on = chat.getAttribute("aria-pressed") !== "true";
      chat.setAttribute("aria-pressed", on);
      document.documentElement.classList.toggle("feed-off", !on);
    };
    $("#mTop").onclick = () => goTo(0);

    // Nhạc: nút tròn điều khiển cùng trình phát chính
    const audio = $("#bgm"), mMusic = $("#mMusic");
    mMusic.hidden = $("#musicCtrl").hidden;
    $("#mNext").hidden = $("#musicNext").hidden;
    mMusic.onclick = () => $("#musicBtn").click();
    $("#mNext").onclick = () => $("#musicNext").click();
    audio.addEventListener("play", () => mMusic.classList.add("playing"));
    audio.addEventListener("pause", () => mMusic.classList.remove("playing"));

    // Sổ lưu bút
    const book = $("#bookSheet");
    $("#mBook").onclick = () => { book.showModal(); startBookScroll(); };
    book.querySelector("[data-close-book]").onclick = () => book.close();
    book.addEventListener("click", (e) => { if (e.target === book) book.close(); });
    book.addEventListener("close", stopBookScroll);
    $("#bookPause").onclick = () => {
      bookPaused = !bookPaused;
      $("#bookPause").setAttribute("aria-pressed", bookPaused);
      $("#bookPause").textContent = bookPaused ? "▶" : "❚❚";
      $("#bookPause").setAttribute("aria-label", bookPaused ? "Tiếp tục tự cuộn" : "Tạm dừng tự cuộn");
    };
    // Kéo tay để đọc: tạm dừng chạy, thả tay 2 giây sau chạy tiếp
    const feed = $("#bookFeed");
    let dragY = null;
    feed.addEventListener("pointerdown", (e) => { dragY = e.clientY; book.drag = true; feed.setPointerCapture(e.pointerId); });
    feed.addEventListener("pointermove", (e) => {
      if (dragY === null) return;
      bookState.off += e.clientY - dragY; dragY = e.clientY; wrapBook(); paintBook();
    });
    const end = () => { if (dragY === null) return; dragY = null; book.drag = false; userHold = Date.now(); };
    feed.addEventListener("pointerup", end); feed.addEventListener("pointercancel", end);
    feed.addEventListener("wheel", (e) => { bookState.off -= e.deltaY; wrapBook(); paintBook(); userHold = Date.now(); }, { passive: true });
  }

  // Sổ lưu bút: chữ trôi liên tục lên trên, lặp vòng không giật
  const bookState = { off: 0, period: 0 };
  function renderBook(state) {
    const list = state.wishes || [], feed = $("#bookFeed"), track = $("#bookTrack");
    if (!list.length) { track.innerHTML = `<p class="book-empty">Chưa có lời chúc nào. Bạn gửi lời chúc đầu tiên nhé!</p>`; bookState.period = 0; bookState.off = 0; paintBook(); return; }
    const one = list.map((w) => `<div class="chip"><b class="bn">${esc(w.name)}</b> ${esc(w.message)}</div>`).join("");
    track.innerHTML = one;
    const h1 = track.scrollHeight, fh = feed.clientHeight;
    if (!fh || !h1) { bookState.period = 0; bookState.off = 0; paintBook(); return; }
    // Lặp đủ số lần để luôn kín khung, kể cả khi chỉ có vài lời chúc → trôi vòng liên tục
    track.innerHTML = one.repeat(Math.max(2, Math.ceil(fh / h1) + 1));
    bookState.period = h1;
    bookState.off = Math.min(0, bookState.off);
    wrapBook(); paintBook();
  }
  function wrapBook() {
    const p = bookState.period; if (!p) { bookState.off = 0; return; }
    while (bookState.off <= -p) bookState.off += p;
    while (bookState.off > 0) bookState.off -= p;
  }
  function paintBook() { $("#bookTrack").style.transform = `translate3d(0, ${bookState.off}px, 0)`; }

  let bookRAF, bookPaused = false, userHold = 0;
  function startBookScroll() {
    bookState.off = 0;
    renderBook(window.__wstate || { wishes: [] });
    let last = 0;
    cancelAnimationFrame(bookRAF);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const step = (t) => {
      const dt = Math.min(64, t - (last || t)); last = t;
      const book = $("#bookSheet");
      if (bookState.period && !bookPaused && !book.drag && Date.now() - userHold > 2000 && !reduce.matches) {
        bookState.off -= dt * 0.03; // khoảng 30px mỗi giây
        wrapBook(); paintBook();
      }
      bookRAF = requestAnimationFrame(step);
    };
    bookRAF = requestAnimationFrame(step);
  }
  function stopBookScroll() { cancelAnimationFrame(bookRAF); }

  // ---------- Điện thoại: mỗi mục là 1 trang ----------
  // Trang ngắn: vuốt là sang trang mới. Trang dài: cuộn hết nội dung, vuốt thêm lần nữa mới sang trang.
  const pager = { on: false, i: 0, slides: [], lock: false };
  const pageMQ = window.matchMedia("(max-width: 699px)");
  const atTop = (el) => el.scrollTop <= 1;
  const atBottom = (el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 2;

  function goTo(i, instant, fromBelow) {
    if (!pager.on || !pager.slides.length) return;
    i = Math.max(0, Math.min(pager.slides.length - 1, i));
    const s = pager.slides[i];
    s.scrollTop = fromBelow ? s.scrollHeight : 0;
    pager.i = i;
    pager.edge = { top: atTop(s), bottom: atBottom(s) };
    const page = $("#page");
    page.style.transition = instant ? "none" : "";
    page.style.transform = `translate3d(0, ${-s.offsetTop}px, 0)`;
    [...$("#slideDots").children].forEach((d, k) => d.classList.toggle("active", k === i));
    document.documentElement.classList.toggle("on-first", i === 0);
    $("#mTop").hidden = i === 0;
    if (!instant) { pager.lock = true; setTimeout(() => (pager.lock = false), 750); }
  }
  const next = () => goTo(pager.i + 1);
  const prev = () => goTo(pager.i - 1, false, true);

  function buildDots() {
    const page = $("#page");
    pager.on = pageMQ.matches;
    document.documentElement.classList.toggle("paged", pager.on);
    document.querySelectorAll(".slide").forEach((s) => s.classList.remove("slide"));
    if (!pager.on) { page.style.transform = ""; pager.slides = []; $("#slideDots").replaceChildren(); return; }
    pager.slides = [...document.querySelectorAll("#page > header, #page > .section, #rsvpWishes > .section, #page > footer")]
      .filter((el) => !el.hidden && getComputedStyle(el).display !== "none");
    pager.slides.forEach((s) => s.classList.add("slide"));
    $("#slideDots").replaceChildren(...pager.slides.map((_, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.setAttribute("aria-label", `Trang ${i + 1}`);
      b.onclick = () => goTo(i);
      return b;
    }));
    goTo(Math.min(pager.i, pager.slides.length - 1), true);
  }

  function setupPager() {
    const page = $("#page"), hero = $(".hero"), story = document.getElementById("story-section");
    // Những phần nằm giữa các trang được gắn vào trang gần nhất khi ở chế độ điện thoại
    const moves = [
      { node: $(".ribbon"), to: hero, where: "append" },
      { node: $(".demo-bar"), to: hero, where: "prepend" },
      { node: $("#dividerSticker"), to: story, where: "prepend" },
    ].filter((m) => m.node && m.to).map((m) => ({ ...m, home: m.node.parentNode, next: m.node.nextSibling }));
    const placeMoves = () => moves.forEach((m) => pageMQ.matches ? m.to[m.where](m.node) : m.home.insertBefore(m.node, m.next));
    pageMQ.addEventListener("change", placeMoves);
    placeMoves();

    // Vuốt trên điện thoại
    let y0 = 0, top0 = false, bottom0 = false;
    page.addEventListener("touchstart", (e) => {
      if (!pager.on) return;
      const s = pager.slides[pager.i]; if (!s) return;
      y0 = e.touches[0].clientY; top0 = atTop(s); bottom0 = atBottom(s);
    }, { passive: true });
    page.addEventListener("touchend", (e) => {
      if (!pager.on || pager.lock) return;
      const dy = y0 - e.changedTouches[0].clientY;
      if (dy > 50 && bottom0) next();
      else if (dy < -50 && top0) prev();
    }, { passive: true });

    // Lăn chuột / touchpad: trình duyệt cuộn trước khi báo sự kiện, nên dùng vị trí đã "dừng" của lần cuộn trước
    let settle;
    page.addEventListener("scroll", (e) => {
      if (!pager.on || e.target !== pager.slides[pager.i]) return;
      clearTimeout(settle);
      settle = setTimeout(() => { const s = pager.slides[pager.i]; pager.edge = { top: atTop(s), bottom: atBottom(s) }; }, 180);
    }, { capture: true, passive: true });
    let lastWheel = 0;
    window.addEventListener("wheel", (e) => {
      if (!pager.on) return;
      const now = Date.now(), fresh = now - lastWheel > 220; lastWheel = now;
      if (!fresh || pager.lock || document.querySelector("dialog[open]") || !pager.edge) return;
      if (e.deltaY > 0 && pager.edge.bottom) next();
      else if (e.deltaY < 0 && pager.edge.top) prev();
    }, { passive: true });

    window.addEventListener("keydown", (e) => {
      if (!pager.on || pager.lock || document.querySelector("dialog[open]")) return;
      const s = pager.slides[pager.i]; if (!s) return;
      if (["ArrowDown", "PageDown", " "].includes(e.key) && atBottom(s)) { e.preventDefault(); next(); }
      if (["ArrowUp", "PageUp"].includes(e.key) && atTop(s)) { e.preventDefault(); prev(); }
    });
    window.addEventListener("resize", () => goTo(pager.i, true));
  }

  // Nút lên đầu trang (máy tính & máy tính bảng)
  function setupToTop() {
    const btn = $("#toTop");
    const update = () => btn.classList.toggle("show", !pager.on && window.scrollY > 600);
    window.addEventListener("scroll", update, { passive: true });
    btn.onclick = () => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    update();
  }

  load()
    .then((state) => { render(state); bindEvents(state); bindWishForm(state); setupPager(); setupDock(); setupToTop(); })
    .catch((err) => {
      console.error(err);
      const state = { s: window.WEDDING_DEFAULTS, gallery: [], wishes: [] };
      render(state); bindEvents(state); bindWishForm(state); setupPager(); setupDock(); setupToTop();
    });
})();
