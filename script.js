// ============================================================
//  منطق الموقع: عرض المنتجات، السلة، وإرسال الطلب على واتساب
// ============================================================

const $ = (id) => document.getElementById(id);
const money = (n) => `${n.toLocaleString("en-US")} ج`;

let activeCategory = "all";
let searchTerm = "";
let cart = loadCart();

/* ---------- تخزين السلة في المتصفح ---------- */
function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem("cart") || "[]");
    // نتأكد إن المنتجات لسه موجودة في القائمة وإن المقاس (لو مطلوب) لسه صحيح
    return saved.filter((i) => {
      const p = PRODUCTS.find((x) => x.id === i.id);
      return p && p.inStock && (!hasSizes(p) || p.sizes.includes(i.size));
    });
  } catch (e) {
    return [];
  }
}
// المنتج ليه مقاسات لو عنده sizes في products.js
function hasSizes(p) {
  return Array.isArray(p.sizes) && p.sizes.length > 0;
}
function saveCart() {
  try { localStorage.setItem("cart", JSON.stringify(cart)); } catch (e) {}
}

/* ---------- إعداد بيانات الستور في الصفحة ---------- */
function setupStore() {
  $("storeName").textContent = STORE.name;
  $("cityName").textContent = STORE.city;
  $("workingHours").textContent = STORE.workingHours;
  document.title = `${STORE.name} - ملابس وكشاكيل وعطور ومذكرات وشنط | ${STORE.city}`;

  const link = `https://wa.me/${STORE.whatsapp}`;
  $("floatWhats").href = link;
  $("footerWhats").href = link;

  $("custArea").innerHTML =
    `<option value="">اختار المنطقة</option>` +
    STORE.areas.map((a) => `<option value="${a}">${a}</option>`).join("");
}

/* ---------- التصنيفات ---------- */
function renderCategories() {
  $("categories").innerHTML = CATEGORIES.map(
    (c) =>
      `<button class="cat-btn ${c.id === activeCategory ? "active" : ""}" data-cat="${c.id}">${c.icon} ${c.name}</button>`
  ).join("");
}

/* ---------- المنتجات ---------- */
function productImage(p) {
  return p.image
    ? `<img src="${p.image}" alt="${p.name}" loading="lazy">`
    : p.emoji;
}

function renderProducts() {
  const term = searchTerm.trim().toLowerCase();
  const list = PRODUCTS.filter(
    (p) =>
      (activeCategory === "all" || p.category === activeCategory) &&
      (!term || p.name.toLowerCase().includes(term) || p.desc.toLowerCase().includes(term))
  );

  $("emptyMsg").hidden = list.length > 0;

  $("productsGrid").innerHTML = list
    .map(
      (p) => `
    <article class="card">
      ${p.badge ? `<span class="badge">${p.badge}</span>` : ""}
      <div class="p-img ${p.image ? "has-photo" : ""}" data-open="${p.id}">${productImage(p)}</div>
      <div class="p-body">
        <h3 class="p-name" data-open="${p.id}">${p.name}</h3>
        <p class="p-desc">${p.desc}</p>
        <button type="button" class="more-btn" data-open="${p.id}">عرض التفاصيل</button>
        <div class="price-row">
          <span class="price">${money(p.price)}</span>
          ${p.oldPrice ? `<span class="old-price">${money(p.oldPrice)}</span>` : ""}
        </div>
        <button class="add-btn" data-add="${p.id}" ${p.inStock ? "" : "disabled"}>
          ${!p.inStock ? "غير متوفر حالياً" : hasSizes(p) ? "اختار المقاس" : "أضف للسلة"}
        </button>
      </div>
    </article>`
    )
    .join("");
}

/* ---------- السلة ---------- */
// نفس المنتج بمقاسين مختلفين = سطرين منفصلين في السلة
function addToCart(id, qty = 1, size = "") {
  const item = cart.find((i) => i.id === id && (i.size || "") === size);
  if (item) item.qty += qty;
  else cart.push({ id, qty, size });
  saveCart();
  renderCart();
  openDrawer();
}

function changeQty(id, size, delta) {
  const item = cart.find((i) => i.id === id && (i.size || "") === size);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter((i) => i !== item);
  saveCart();
  renderCart();
}

function removeItem(id, size) {
  cart = cart.filter((i) => !(i.id === id && (i.size || "") === size));
  saveCart();
  renderCart();
}

/* ---------- كود الخصم ---------- */
// الأكواد نفسها في آخر ملف products.js (COUPONS)
const COUPON_LIST = typeof COUPONS !== "undefined" ? COUPONS : [];
let appliedCoupon = loadCoupon();

// بنوحّد شكل الكود: نشيل المسافات، نحوّل الأرقام العربي، ونكبّر الحروف
function normalizeCode(s) {
  return String(s || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .toUpperCase();
}

function checkCoupon(input) {
  const code = normalizeCode(input);
  if (!code) return { error: "اكتب كود الخصم الأول" };
  const c = COUPON_LIST.find((x) => x.active !== false && normalizeCode(x.code) === code);
  if (!c) return { error: "الكود ده مش صحيح" };
  if (c.expires && new Date() > new Date(c.expires + "T23:59:59")) return { error: "الكود ده انتهت صلاحيته" };
  return { coupon: c };
}

function couponDiscount(subtotal) {
  const c = appliedCoupon;
  if (!c || subtotal < (c.minOrder || 0)) return 0;
  const d = c.type === "percent" ? Math.round((subtotal * c.value) / 100) : c.value;
  return Math.min(d, subtotal);   // الخصم عمره ما يزيد عن إجمالي المنتجات
}

function saveCoupon() {
  try {
    if (appliedCoupon) localStorage.setItem("coupon", appliedCoupon.code);
    else localStorage.removeItem("coupon");
  } catch (e) {}
}
function loadCoupon() {
  try {
    const saved = localStorage.getItem("coupon");
    return saved ? checkCoupon(saved).coupon || null : null;
  } catch (e) {
    return null;
  }
}

function showCouponMsg(text, kind) {
  const el = $("couponMsg");
  el.hidden = !text;
  el.textContent = text || "";
  el.className = "coupon-msg " + (kind || "");
}

function toggleCoupon() {
  if (appliedCoupon) {                      // زرار "إلغاء"
    appliedCoupon = null;
    saveCoupon();
    $("couponInput").value = "";
    showCouponMsg("");
    renderCart();
    return;
  }
  const r = checkCoupon($("couponInput").value);
  if (r.error) { showCouponMsg(r.error, "err"); return; }
  appliedCoupon = r.coupon;
  saveCoupon();
  renderCart();
}

function renderCoupon(t) {
  const input = $("couponInput");
  const btn = $("applyCoupon");
  const applied = !!appliedCoupon;
  input.disabled = applied;
  btn.textContent = applied ? "إلغاء" : "تطبيق";
  btn.classList.toggle("remove", applied);
  if (!applied) return;

  input.value = appliedCoupon.code;
  const min = appliedCoupon.minOrder || 0;
  if (t.subtotal < min) showCouponMsg(`الكود هيشتغل لما المنتجات توصل ${money(min)} (ناقص ${money(min - t.subtotal)})`, "warn");
  else showCouponMsg(`تم تطبيق الكود، وفّرت ${money(t.discount)} 🎉`, "ok");
}

function getTotals() {
  const subtotal = cart.reduce((sum, i) => {
    const p = PRODUCTS.find((x) => x.id === i.id);
    return sum + p.price * i.qty;
  }, 0);
  const discount = couponDiscount(subtotal);
  // التوصيل المجاني بيتحسب على إجمالي المنتجات قبل الخصم
  const free = STORE.freeDeliveryFrom > 0 && subtotal >= STORE.freeDeliveryFrom;
  const delivery = cart.length === 0 || free ? 0 : STORE.deliveryFee;
  return { subtotal, discount, delivery, total: subtotal - discount + delivery, free };
}

function renderCart() {
  const count = cart.reduce((s, i) => s + i.qty, 0);
  $("cartCount").textContent = count;

  const hasItems = cart.length > 0;
  $("cartEmpty").hidden = hasItems;
  $("checkout").hidden = !hasItems;

  $("cartItems").innerHTML = cart
    .map((i) => {
      const p = PRODUCTS.find((x) => x.id === i.id);
      return `
      <div class="cart-item">
        <div class="ci-img">${productImage(p)}</div>
        <div>
          <div class="ci-name">${p.name}</div>
          ${i.size ? `<div class="ci-size">المقاس: <b>${i.size}</b></div>` : ""}
          <div class="ci-price">${money(p.price)} × ${i.qty} = <b>${money(p.price * i.qty)}</b></div>
          <div class="qty">
            <button data-dec="${p.id}" data-size="${i.size || ""}" aria-label="تقليل">−</button>
            <span>${i.qty}</span>
            <button data-inc="${p.id}" data-size="${i.size || ""}" aria-label="زيادة">+</button>
          </div>
        </div>
        <button class="ci-remove" data-remove="${p.id}" data-size="${i.size || ""}">حذف</button>
      </div>`;
    })
    .join("");

  const t = getTotals();
  $("sumSubtotal").textContent = money(t.subtotal);
  $("sumDelivery").textContent = t.free ? "مجاني" : money(t.delivery);
  $("discountRow").hidden = !(t.discount > 0);
  $("discountCode").textContent = appliedCoupon ? appliedCoupon.code : "";
  $("sumDiscount").textContent = money(t.discount);
  $("sumTotal").textContent = money(t.total);
  renderCoupon(t);

  if (STORE.freeDeliveryFrom > 0 && !t.free && hasItems) {
    $("freeNote").textContent = `ضيف ${money(STORE.freeDeliveryFrom - t.subtotal)} كمان والتوصيل يبقى مجاني`;
  } else if (t.free) {
    $("freeNote").textContent = "التوصيل مجاني على طلبك 🎉";
  } else {
    $("freeNote").textContent = "";
  }
}

/* ---------- فتح وقفل السلة ---------- */
function openDrawer() {
  $("drawer").classList.add("open");
  $("drawer").setAttribute("aria-hidden", "false");
  $("overlay").hidden = false;
  document.body.style.overflow = "hidden";
}
function closeDrawer() {
  $("drawer").classList.remove("open");
  $("drawer").setAttribute("aria-hidden", "true");
  $("overlay").hidden = true;
  document.body.style.overflow = "";
}

/* ---------- نافذة تفاصيل المنتج ---------- */
let modalProduct = null;
let modalQty = 1;
let modalImg = 0;
let modalSize = "";

// شرائح اختيار المقاس (بتظهر بس لو المنتج عنده sizes)
function renderSizes() {
  const p = modalProduct;
  $("pmSizesWrap").hidden = !hasSizes(p);
  $("pmSizeError").hidden = true;
  $("pmSizes").innerHTML = hasSizes(p)
    ? p.sizes
        .map((s) => `<button type="button" class="size-chip ${s === modalSize ? "active" : ""}" data-pick-size="${s}">${s}</button>`)
        .join("")
    : "";
}

function pickSize(s) {
  modalSize = s;
  renderSizes();
}

// صور المعرض: images لو موجودة، وإلا image، وإلا يظهر الإيموجي
function productGallery(p) {
  if (p.images && p.images.length) return p.images;
  return p.image ? [p.image] : [];
}

function renderGallery() {
  const p = modalProduct;
  const imgs = productGallery(p);

  $("pmMain").classList.toggle("has-photo", imgs.length > 0);
  $("pmMain").innerHTML = imgs.length ? `<img src="${imgs[modalImg]}" alt="${p.name}">` : p.emoji;

  if (imgs.length > 1) {
    $("pmMain").insertAdjacentHTML(
      "beforeend",
      `<button type="button" class="nav-btn nav-prev" data-nav="-1" aria-label="الصورة السابقة">›</button>
       <button type="button" class="nav-btn nav-next" data-nav="1" aria-label="الصورة التالية">‹</button>`
    );
  }

  $("pmThumbs").innerHTML =
    imgs.length > 1
      ? imgs
          .map(
            (src, i) =>
              `<button type="button" class="thumb ${i === modalImg ? "active" : ""}" data-thumb="${i}" aria-label="صورة ${i + 1}"><img src="${src}" alt=""></button>`
          )
          .join("")
      : "";
}

function openProduct(id) {
  const p = PRODUCTS.find((x) => x.id === id);
  if (!p) return;
  modalProduct = p;
  modalQty = 1;
  modalImg = 0;
  modalSize = "";

  const cat = CATEGORIES.find((c) => c.id === p.category);
  const catText = cat ? `${cat.icon} ${cat.name}` : "";
  $("pmCat").textContent = p.vendor ? `${catText} · من ${p.vendor}` : catText;
  $("pmName").textContent = p.name;
  $("pmPrice").textContent = money(p.price);
  $("pmOldPrice").textContent = p.oldPrice ? money(p.oldPrice) : "";

  const stock = $("pmStock");
  stock.textContent = p.inStock ? "✔ متوفر" : "✖ غير متوفر حالياً";
  stock.className = "pm-stock " + (p.inStock ? "ok" : "out");

  renderSizes();

  $("pmDetails").textContent = p.details || p.desc;
  $("pmFeatures").innerHTML = (p.features || []).map((f) => `<li>${f}</li>`).join("");
  $("pmSpecs").innerHTML = (p.specs || []).map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("");
  $("pmSpecs").hidden = !(p.specs && p.specs.length);

  $("pmQty").textContent = modalQty;
  $("pmAdd").disabled = !p.inStock;
  $("pmAdd").textContent = p.inStock ? "أضف للسلة" : "غير متوفر حالياً";

  renderGallery();
  $("productModal").hidden = false;
  $("productModal").querySelector(".modal-box").scrollTop = 0;
  document.body.style.overflow = "hidden";
}

function closeProduct() {
  $("productModal").hidden = true;
  modalProduct = null;
  document.body.style.overflow = "";
}

function changeModalQty(delta) {
  modalQty = Math.min(99, Math.max(1, modalQty + delta));
  $("pmQty").textContent = modalQty;
}

function shiftModalImage(step) {
  const n = productGallery(modalProduct).length;
  if (n < 2) return;
  modalImg = (modalImg + step + n) % n;
  renderGallery();
}

function addFromModal() {
  if (!modalProduct || !modalProduct.inStock) return;

  // لو المنتج ليه مقاسات لازم العميل يختار واحد
  if (hasSizes(modalProduct) && !modalSize) {
    $("pmSizeError").hidden = false;
    $("pmSizesWrap").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const id = modalProduct.id;
  const qty = modalQty;
  const size = modalSize;
  closeProduct();        // نقفل النافذة الأول عشان السلة تفتح بعدها
  addToCart(id, qty, size);
}

/* ---------- الدفع ---------- */
function selectedPay() {
  return document.querySelector('input[name="pay"]:checked').value;
}

function renderPayInfo() {
  const box = $("payInfo");
  const pay = selectedPay();
  if (pay === "cash") {
    box.hidden = true;
    return;
  }
  const info = pay === "wallet" ? STORE.wallet : STORE.instapay;
  const value = pay === "wallet" ? info.number : info.handle;
  box.hidden = false;
  box.innerHTML = `حوّل الإجمالي على: <b>${value}</b><br>وابعت صورة التحويل على واتساب بعد إرسال الطلب.`;
}

const PAY_LABELS = {
  cash: "كاش عند الاستلام",
  wallet: "محفظة إلكترونية",
  instapay: "InstaPay"
};

/* ---------- إرسال الطلب ---------- */
function validate() {
  const fields = ["custName", "custPhone", "custArea", "custAddress"];
  fields.forEach((id) => $(id).classList.remove("invalid"));

  const errors = [];
  const name = $("custName").value.trim();
  const phone = $("custPhone").value.trim().replace(/[\s-]/g, "");
  const area = $("custArea").value;
  const address = $("custAddress").value.trim();

  if (name.length < 2) { errors.push("اكتب اسمك"); $("custName").classList.add("invalid"); }
  // أرقام مصرية: 01 + 9 أرقام (بنقبل الأرقام العربي كمان)
  const normalized = phone.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
  if (!/^01[0125]\d{8}$/.test(normalized)) { errors.push("رقم التليفون مش صحيح"); $("custPhone").classList.add("invalid"); }
  if (!area) { errors.push("اختار المنطقة"); $("custArea").classList.add("invalid"); }
  if (address.length < 6) { errors.push("اكتب العنوان بالتفصيل"); $("custAddress").classList.add("invalid"); }

  return { errors, data: { name, phone: normalized, area, address, notes: $("custNotes").value.trim() } };
}

function buildMessage(d) {
  const t = getTotals();
  const lines = cart.map((i) => {
    const p = PRODUCTS.find((x) => x.id === i.id);
    const size = i.size ? ` (المقاس: ${i.size})` : "";
    const vendor = p.vendor ? ` — المورّد: ${p.vendor}` : "";
    return `• ${p.name}${size} × ${i.qty} = ${money(p.price * i.qty)}${vendor}`;
  });

  return [
    `طلب جديد من الموقع 🛒`,
    ``,
    `*المنتجات:*`,
    ...lines,
    ``,
    `المجموع: ${money(t.subtotal)}`,
    t.discount > 0 ? `الخصم (كود ${appliedCoupon.code}): ${money(t.discount)}` : null,
    `التوصيل: ${t.free ? "مجاني" : money(t.delivery)}`,
    `*الإجمالي: ${money(t.total)}*`,
    ``,
    `*بيانات العميل:*`,
    `الاسم: ${d.name}`,
    `التليفون: ${d.phone}`,
    `المنطقة: ${d.area}`,
    `العنوان: ${d.address}`,
    d.notes ? `ملاحظات: ${d.notes}` : null,
    ``,
    `طريقة الدفع: ${PAY_LABELS[selectedPay()]}`,
    selectedPay() !== "cash" ? `(هبعت صورة التحويل)` : null
  ]
    .filter((l) => l !== null)
    .join("\n");
}

function submitOrder(e) {
  e.preventDefault();
  const err = $("formError");
  const { errors, data } = validate();

  if (errors.length) {
    err.textContent = errors.join(" • ");
    err.hidden = false;
    return;
  }
  err.hidden = true;

  const url = `https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(buildMessage(data))}`;
  window.open(url, "_blank", "noopener");

  // بعد الإرسال نفضّي السلة وكود الخصم
  cart = [];
  saveCart();
  appliedCoupon = null;
  saveCoupon();
  $("couponInput").value = "";
  showCouponMsg("");
  renderCart();
  $("orderForm").reset();
  renderPayInfo();
  closeDrawer();
}

/* ---------- الأحداث ---------- */
document.addEventListener("click", (e) => {
  // فتح نافذة تفاصيل المنتج (من الصورة أو الاسم أو زرار "عرض التفاصيل")
  const opener = e.target.closest("[data-open]");
  if (opener) {
    openProduct(Number(opener.dataset.open));
    return;
  }

  const t = e.target.closest("button");
  if (!t) return;

  if (t.dataset.nav) shiftModalImage(Number(t.dataset.nav));
  else if (t.dataset.thumb) {
    modalImg = Number(t.dataset.thumb);
    renderGallery();
  } else if (t.dataset.cat) {
    activeCategory = t.dataset.cat;
    renderCategories();
    renderProducts();
  } else if (t.dataset.add) {
    const id = Number(t.dataset.add);
    const p = PRODUCTS.find((x) => x.id === id);
    // المنتجات اللي ليها مقاسات بتفتح النافذة عشان العميل يختار المقاس
    if (p && hasSizes(p)) openProduct(id);
    else addToCart(id);
  } else if (t.dataset.pickSize) pickSize(t.dataset.pickSize);
  else if (t.dataset.inc) changeQty(Number(t.dataset.inc), t.dataset.size || "", 1);
  else if (t.dataset.dec) changeQty(Number(t.dataset.dec), t.dataset.size || "", -1);
  else if (t.dataset.remove) removeItem(Number(t.dataset.remove), t.dataset.size || "");
});

$("openCart").addEventListener("click", openDrawer);
$("closeCart").addEventListener("click", closeDrawer);
$("overlay").addEventListener("click", closeDrawer);
$("closeProduct").addEventListener("click", closeProduct);
$("productModal").addEventListener("click", (e) => { if (e.target === $("productModal")) closeProduct(); });
$("pmInc").addEventListener("click", () => changeModalQty(1));
$("pmDec").addEventListener("click", () => changeModalQty(-1));
$("pmAdd").addEventListener("click", addFromModal);
$("applyCoupon").addEventListener("click", toggleCoupon);
$("couponInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); toggleCoupon(); }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (modalProduct) closeProduct();
    else closeDrawer();
  } else if (modalProduct && e.key === "ArrowLeft") shiftModalImage(1);   // RTL: الشمال = التالي
  else if (modalProduct && e.key === "ArrowRight") shiftModalImage(-1);
});

$("searchInput").addEventListener("input", (e) => {
  searchTerm = e.target.value;
  renderProducts();
});

document.querySelectorAll('input[name="pay"]').forEach((r) => r.addEventListener("change", renderPayInfo));
$("orderForm").addEventListener("submit", submitOrder);

/* ---------- تشغيل ---------- */
setupStore();
renderCategories();
renderProducts();
renderCart();
renderPayInfo();
