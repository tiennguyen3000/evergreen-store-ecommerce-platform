import "dotenv/config";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db, pool } from "./index";
import * as s from "./schema";

// Deterministic PRNG so seeds are reproducible
let seedState = 42;
const rand = () => {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296;
  return seedState / 4294967296;
};
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const slugify = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const daysAgo = (d: number) => new Date(Date.now() - d * 86400000 - randInt(0, 86400000));
const money = (n: number) => n.toFixed(2);

async function chunkInsert<T>(table: any, rows: T[], size = 1000) {
  for (let i = 0; i < rows.length; i += size) {
    await db.insert(table).values(rows.slice(i, i + size) as any);
  }
}

export const PERMISSIONS = [
  "PRODUCT_VIEW", "PRODUCT_CREATE", "PRODUCT_UPDATE", "PRODUCT_DELETE",
  "ORDER_VIEW", "ORDER_UPDATE", "ORDER_REFUND",
  "INVENTORY_VIEW", "INVENTORY_UPDATE", "INVENTORY_TRANSFER",
  "CUSTOMER_VIEW", "CUSTOMER_UPDATE",
  "EMPLOYEE_VIEW", "EMPLOYEE_MANAGE",
  "REPORT_VIEW", "AUDIT_VIEW", "SETTINGS_MANAGE",
];

const ROLE_PERMS: Record<string, string[]> = {
  CUSTOMER: [],
  EMPLOYEE: ["PRODUCT_VIEW", "ORDER_VIEW", "ORDER_UPDATE", "INVENTORY_VIEW", "INVENTORY_UPDATE", "CUSTOMER_VIEW"],
  MANAGER: ["PRODUCT_VIEW", "PRODUCT_CREATE", "PRODUCT_UPDATE", "ORDER_VIEW", "ORDER_UPDATE", "ORDER_REFUND", "INVENTORY_VIEW", "INVENTORY_UPDATE", "INVENTORY_TRANSFER", "CUSTOMER_VIEW", "CUSTOMER_UPDATE", "EMPLOYEE_VIEW", "REPORT_VIEW"],
  ADMIN: PERMISSIONS,
  SUPER_ADMIN: PERMISSIONS,
};

const FIRST = ["Olivia", "Liam", "Emma", "Noah", "Ava", "Elijah", "Sophia", "Lucas", "Isabella", "Mason", "Mia", "Ethan", "Amelia", "James", "Harper", "Benjamin", "Evelyn", "Henry", "Abigail", "Sebastian", "Ella", "Jack", "Scarlett", "Owen", "Grace", "Leo", "Chloe", "Daniel", "Lily", "Julian", "Aria", "Levi", "Zoe", "Wyatt", "Nora", "Isaac", "Hazel", "Gabriel", "Violet", "Caleb"];
const LAST = ["Bennett", "Carter", "Diaz", "Ellis", "Foster", "Garcia", "Hayes", "Ingram", "Jensen", "Kim", "Lopez", "Morgan", "Nguyen", "Ortiz", "Patel", "Quinn", "Reyes", "Sullivan", "Turner", "Underwood", "Vance", "Walsh", "Young", "Zimmerman", "Brooks", "Cole", "Dawson", "Fleming", "Graham", "Holt"];
const CITIES = [["Portland", "OR", "97201"], ["Seattle", "WA", "98101"], ["Denver", "CO", "80202"], ["Austin", "TX", "78701"], ["Brooklyn", "NY", "11201"], ["San Francisco", "CA", "94103"], ["Chicago", "IL", "60601"], ["Boulder", "CO", "80302"], ["Asheville", "NC", "28801"], ["Burlington", "VT", "05401"]];

const COLORS: Record<string, [string, string][]> = {
  shoes: [["Natural White", "#EDE8DF"], ["Charcoal", "#3A3A3A"], ["Moss", "#6B7A5A"], ["Stone Grey", "#A8A39A"], ["Deep Navy", "#28324A"], ["Clay", "#B5715A"], ["Black", "#111111"]],
  apparel: [["Oatmeal", "#D9CFC0"], ["Sage", "#9AA88F"], ["Charcoal", "#3A3A3A"], ["Black", "#111111"], ["Rust", "#A4573A"], ["Dusty Blue", "#7B8FA3"], ["Natural White", "#EDE8DF"]],
  accessories: [["Sand", "#CFC2A8"], ["Charcoal", "#3A3A3A"], ["Moss", "#6B7A5A"], ["Natural White", "#EDE8DF"], ["Rust", "#A4573A"]],
};
const SIZES = { menShoes: ["40", "41", "42", "43", "44", "45", "46"], womenShoes: ["36", "37", "38", "39", "40", "41", "42"], apparel: ["XS", "S", "M", "L", "XL"], socks: ["S", "M", "L"], one: ["One Size"] };

type Model = { name: string; type: "shoes" | "apparel" | "accessories"; cat: string; img: string; price: number; material: string; desc: string; genders: ("men" | "women" | "unisex")[]; sizes?: string[] };
const MODELS: Model[] = [
  { name: "Evergreen Runner", type: "shoes", cat: "sneakers", img: "runner", price: 118, material: "Eucalyptus tree fiber knit upper, sugarcane foam midsole", desc: "Our lightest everyday sneaker. A breathable tree-fiber knit keeps feet cool while the sugarcane foam midsole delivers all-day bounce.", genders: ["men", "women"] },
  { name: "Evergreen Trail", type: "shoes", cat: "running", img: "trail", price: 148, material: "Recycled ripstop upper, natural rubber lugged outsole", desc: "Built for dirt, gravel and rain. A grippy natural rubber outsole and water-repellent ripstop upper take you far past the pavement.", genders: ["men", "women"] },
  { name: "Evergreen Wool Sneaker", type: "shoes", cat: "sneakers", img: "wool-sneaker", price: 110, material: "ZQ-certified merino wool upper, castor bean insole", desc: "The original. Temperature-regulating merino wool that feels like a favorite sweater for your feet — machine washable, naturally odor-resistant.", genders: ["men", "women"] },
  { name: "Evergreen Slip-On", type: "shoes", cat: "slip-ons", img: "slipon", price: 98, material: "Organic cotton canvas, natural rubber sole", desc: "Step in and go. A cushioned collar and flexible sole make the Slip-On the easiest shoe you own.", genders: ["men", "women"] },
  { name: "Evergreen Court", type: "shoes", cat: "sneakers", img: "slipon", price: 125, material: "Plant-based leather, bio-TPU outsole", desc: "A clean court silhouette reimagined with plant-based leather and a durable outsole made from sugarcane.", genders: ["men", "women"] },
  { name: "Evergreen Weather Runner", type: "shoes", cat: "running", img: "trail", price: 138, material: "Water-repellent wool, fluorine-free DWR", desc: "Puddle-proof comfort. A weather-resistant wool upper with a fluorine-free coating shrugs off drizzle and slush.", genders: ["men", "women"] },
  { name: "Evergreen Dasher", type: "shoes", cat: "running", img: "runner", price: 135, material: "Eucalyptus knit, sugarcane foam, natural rubber", desc: "Our performance running shoe. A dual-density midsole and reinforced heel counter for tempo runs and easy miles alike.", genders: ["men", "women"] },
  { name: "Evergreen Lounger", type: "shoes", cat: "slip-ons", img: "wool-sneaker", price: 95, material: "Merino wool upper, cork-blend footbed", desc: "The at-home shoe you'll wear everywhere. Plush merino and a cushioned cork footbed.", genders: ["men", "women"] },
  { name: "Evergreen Wool Runner Mizzle", type: "shoes", cat: "sneakers", img: "wool-sneaker", price: 128, material: "Water-repellent merino wool, bio-based shield", desc: "The Wool Sneaker built for damp days — same warmth, added weather protection.", genders: ["men", "women"] },
  { name: "Evergreen Tree Flyer", type: "shoes", cat: "running", img: "runner", price: 160, material: "Eucalyptus fiber upper, Swift Foam midsole", desc: "Long distance, low impact. Our most cushioned runner with a rockered geometry for smooth transitions.", genders: ["men", "women"] },
  { name: "Evergreen Hiker", type: "shoes", cat: "boots", img: "trail", price: 175, material: "Recycled nylon, natural rubber lug sole", desc: "A lightweight hiker with ankle support, a rock plate and sticky rubber lugs for confident footing.", genders: ["men", "women"] },
  { name: "Evergreen Canvas Low", type: "shoes", cat: "sneakers", img: "slipon", price: 88, material: "Organic cotton canvas, natural rubber sole", desc: "A timeless low-top in breathable organic canvas with a vulcanized natural rubber sole.", genders: ["men", "women"] },
  { name: "Evergreen Everyday Tee", type: "apparel", cat: "tees", img: "tee", price: 38, material: "100% organic Pima cotton", desc: "The perfect tee. Buttery-soft organic cotton with a relaxed fit that holds its shape wash after wash.", genders: ["men", "women"] },
  { name: "Evergreen Cloud Hoodie", type: "apparel", cat: "sweatshirts", img: "hoodie", price: 98, material: "Organic cotton & recycled polyester fleece", desc: "Cloud-soft brushed fleece with a roomy hood and kangaroo pocket. Your new favorite layer.", genders: ["men", "women"] },
  { name: "Evergreen Merino Crew", type: "apparel", cat: "sweatshirts", img: "hoodie", price: 88, material: "Superfine merino wool", desc: "A lightweight merino crewneck that regulates temperature from chilly mornings to warm afternoons.", genders: ["men", "women"] },
  { name: "Evergreen Trail Short", type: "apparel", cat: "bottoms", img: "tee", price: 68, material: "Recycled nylon, eucalyptus liner", desc: "A quick-drying trail short with a soft eucalyptus fiber liner and hidden zip pocket.", genders: ["men", "women"] },
  { name: "Evergreen Lounge Pant", type: "apparel", cat: "bottoms", img: "hoodie", price: 78, material: "Organic cotton French terry", desc: "Tapered, soft and just structured enough to leave the house in.", genders: ["men", "women"] },
  { name: "Evergreen Puffer Vest", type: "apparel", cat: "outerwear", img: "hoodie", price: 148, material: "Recycled shell, plant-based insulation", desc: "Core warmth without bulk. Insulated with plant-based fibers and wrapped in a recycled shell.", genders: ["men", "women"] },
  { name: "Evergreen Rain Shell", type: "apparel", cat: "outerwear", img: "hoodie", price: 188, material: "Recycled polyester, fluorine-free DWR", desc: "A packable, fully seam-sealed rain shell for city commutes and mountain squalls.", genders: ["men", "women"] },
  { name: "Evergreen Long Sleeve Tee", type: "apparel", cat: "tees", img: "tee", price: 48, material: "Organic cotton & Tencel blend", desc: "A drapey long sleeve with a soft hand-feel and a slightly longer hem.", genders: ["men", "women"] },
  { name: "Evergreen Performance Tank", type: "apparel", cat: "tees", img: "tee", price: 42, material: "Eucalyptus fiber, merino blend", desc: "Naturally breathable and odor-resistant for runs, rides and rest days.", genders: ["men", "women"] },
  { name: "Evergreen Wool Cardigan", type: "apparel", cat: "sweatshirts", img: "hoodie", price: 128, material: "Merino wool", desc: "A relaxed button-front cardigan knit from responsibly sourced merino.", genders: ["men", "women"] },
  { name: "Evergreen Jogger", type: "apparel", cat: "bottoms", img: "hoodie", price: 84, material: "Organic cotton fleece", desc: "Our best-selling jogger with a clean tapered leg and brushed interior.", genders: ["men", "women"] },
  { name: "Evergreen Polo", type: "apparel", cat: "tees", img: "tee", price: 58, material: "Organic Pima cotton pique", desc: "A modern polo with a soft collar and a tailored, easy fit.", genders: ["men"] },
  { name: "Evergreen Wrap Dress", type: "apparel", cat: "tees", img: "tee", price: 98, material: "Tencel lyocell", desc: "A fluid, breathable wrap dress made from sustainably sourced wood pulp fibers.", genders: ["women"] },
  { name: "Evergreen Crew Sock", type: "accessories", cat: "socks", img: "socks", price: 16, material: "Merino wool, recycled nylon", desc: "Cushioned merino crew socks with arch support and a seamless toe.", genders: ["unisex"], sizes: SIZES.socks },
  { name: "Evergreen Ankle Sock", type: "accessories", cat: "socks", img: "socks", price: 14, material: "Merino wool, recycled nylon", desc: "A low-profile ankle sock with a heel tab that stays put.", genders: ["unisex"], sizes: SIZES.socks },
  { name: "Evergreen No-Show Sock", type: "accessories", cat: "socks", img: "socks", price: 12, material: "Eucalyptus fiber blend", desc: "Invisible in sneakers, breathable all day.", genders: ["unisex"], sizes: SIZES.socks },
  { name: "Evergreen Hiker Sock", type: "accessories", cat: "socks", img: "socks", price: 22, material: "Heavyweight merino wool", desc: "Thick, warm and blister-resistant for long days on trail.", genders: ["unisex"], sizes: SIZES.socks },
  { name: "Evergreen Crew Sock 3-Pack", type: "accessories", cat: "socks", img: "socks", price: 42, material: "Merino wool, recycled nylon", desc: "Three pairs of our best-selling crew sock.", genders: ["unisex"], sizes: SIZES.socks },
  { name: "Evergreen Beanie", type: "accessories", cat: "hats", img: "accessory", price: 34, material: "Ribbed merino wool", desc: "A classic ribbed beanie in soft, itch-free merino.", genders: ["unisex"], sizes: SIZES.one },
  { name: "Evergreen Field Cap", type: "accessories", cat: "hats", img: "accessory", price: 32, material: "Organic cotton twill", desc: "A six-panel cap with a curved brim and adjustable strap.", genders: ["unisex"], sizes: SIZES.one },
  { name: "Evergreen Canvas Tote", type: "accessories", cat: "bags", img: "accessory", price: 45, material: "Heavyweight organic canvas", desc: "A roomy tote with an interior pocket and reinforced handles.", genders: ["unisex"], sizes: SIZES.one },
  { name: "Evergreen Day Pack", type: "accessories", cat: "bags", img: "accessory", price: 88, material: "Recycled ripstop nylon", desc: "A 20L pack with a padded laptop sleeve for commutes and day hikes.", genders: ["unisex"], sizes: SIZES.one },
  { name: "Evergreen Merino Scarf", type: "accessories", cat: "hats", img: "accessory", price: 58, material: "Superfine merino wool", desc: "A generous, featherlight merino scarf.", genders: ["unisex"], sizes: SIZES.one },
  { name: "Evergreen Comfort Insole", type: "accessories", cat: "care", img: "socks", price: 20, material: "Castor bean foam, merino top", desc: "Replacement insoles with a merino top layer and castor bean foam base.", genders: ["unisex"], sizes: SIZES.menShoes.slice(0, 5) },
  { name: "Evergreen Replacement Laces", type: "accessories", cat: "care", img: "socks", price: 8, material: "Recycled polyester", desc: "Fresh laces for your favorite pair.", genders: ["unisex"], sizes: SIZES.one },
  { name: "Evergreen Shoe Care Kit", type: "accessories", cat: "care", img: "accessory", price: 24, material: "Plant-based cleaner, natural bristle brush", desc: "Everything you need to keep your Evergreens looking new.", genders: ["unisex"], sizes: SIZES.one },
  { name: "Evergreen Wool Gloves", type: "accessories", cat: "hats", img: "accessory", price: 38, material: "Merino wool, touchscreen tips", desc: "Warm merino gloves with touchscreen-compatible fingertips.", genders: ["unisex"], sizes: SIZES.socks },
  { name: "Evergreen Water Bottle", type: "accessories", cat: "bags", img: "accessory", price: 30, material: "Recycled stainless steel", desc: "A 750ml insulated bottle that keeps drinks cold for 24 hours.", genders: ["unisex"], sizes: SIZES.one },
];
const EDITIONS: Record<string, string[]> = { shoes: ["", "Lite", "Winter"], apparel: ["", "Heavyweight"], accessories: [""] };

async function main() {
  const existing = await db.select({ c: sql<number>`count(*)` }).from(s.products);
  if (Number(existing[0].c) > 0) {
    console.log("Database already seeded — skipping.");
    return;
  }
  console.log("Seeding Evergreen Store…");
  const passwordHash = await bcrypt.hash("Password123!", 10);

  // ---- RBAC
  const roleRows = await db.insert(s.roles).values(Object.keys(ROLE_PERMS).map((name) => ({ name, description: `${name} role` }))).returning();
  const permRows = await db.insert(s.permissions).values(PERMISSIONS.map((name) => ({ name, description: name.replace("_", " ").toLowerCase() }))).returning();
  const roleId = Object.fromEntries(roleRows.map((r) => [r.name, r.id]));
  const permId = Object.fromEntries(permRows.map((p) => [p.name, p.id]));
  await db.insert(s.rolePermissions).values(Object.entries(ROLE_PERMS).flatMap(([r, ps]) => ps.map((p) => ({ roleId: roleId[r], permissionId: permId[p] }))));

  // ---- Users
  const staffSeed = [
    ["employee@example.com", "Evan", "Employee", "EMPLOYEE", "Fulfillment Associate"],
    ["manager@example.com", "Maya", "Manager", "MANAGER", "Store Manager"],
    ["admin@example.com", "Ada", "Admin", "ADMIN", "Head of Operations"],
    ["superadmin@example.com", "Sam", "Superadmin", "SUPER_ADMIN", "CTO"],
  ];
  const extraStaff = ["EMPLOYEE", "EMPLOYEE", "EMPLOYEE", "MANAGER", "EMPLOYEE", "ADMIN"];
  const userValues: (typeof s.users.$inferInsert & { role: string })[] = [
    { email: "customer@example.com", firstName: "Casey", lastName: "Customer", passwordHash, status: "ACTIVE", role: "CUSTOMER", emailVerifiedAt: new Date(), createdAt: daysAgo(200) },
    ...staffSeed.map(([email, firstName, lastName, role, jobTitle]) => ({ email, firstName, lastName, passwordHash, isStaff: true, jobTitle, role, status: "ACTIVE", emailVerifiedAt: new Date(), lastLoginAt: daysAgo(randInt(0, 5)), createdAt: daysAgo(400) })),
    ...extraStaff.map((role, i) => ({ email: `staff${i + 1}@evergreen.example`, firstName: FIRST[i + 5], lastName: LAST[i + 3], passwordHash, isStaff: true, jobTitle: role === "MANAGER" ? "Regional Manager" : role === "ADMIN" ? "Platform Admin" : "Warehouse Associate", role, status: i === 5 ? "DISABLED" : "ACTIVE", emailVerifiedAt: new Date(), lastLoginAt: daysAgo(randInt(0, 30)), createdAt: daysAgo(randInt(100, 400)) })),
  ];
  for (let i = 0; i < 99; i++) {
    const fn = FIRST[i % FIRST.length];
    const ln = LAST[(i * 7) % LAST.length];
    userValues.push({ email: `${fn}.${ln}${i}@example.com`.toLowerCase(), firstName: fn, lastName: ln, passwordHash, role: "CUSTOMER", status: rand() < 0.05 ? "DISABLED" : "ACTIVE", emailVerifiedAt: new Date(), marketingOptIn: rand() < 0.6, createdAt: daysAgo(randInt(1, 365)), lastLoginAt: daysAgo(randInt(0, 60)) });
  }
  const userRows = await db.insert(s.users).values(userValues.map(({ role: _r, ...u }) => u)).returning({ id: s.users.id, email: s.users.email });
  await db.insert(s.userRoles).values(userRows.map((u, i) => ({ userId: u.id, roleId: roleId[userValues[i].role] })));
  const customers = userRows.filter((_, i) => userValues[i].role === "CUSTOMER");
  const staff = userRows.filter((_, i) => userValues[i].isStaff);
  const adminUser = userRows.find((u) => u.email === "admin@example.com")!;

  // Addresses for customers
  const addrRows: (typeof s.addresses.$inferInsert)[] = [];
  customers.forEach((c, i) => {
    const [city, region, postalCode] = CITIES[i % CITIES.length];
    const u = userValues.find((x) => x.email === c.email)!;
    addrRows.push({ userId: c.id, label: "Home", firstName: u.firstName, lastName: u.lastName, line1: `${randInt(10, 9999)} ${pick(["Cedar", "Maple", "Alder", "Birch", "Willow", "Spruce"])} ${pick(["St", "Ave", "Ln", "Way"])}`, city, region, postalCode, country: "US", phone: `+1 555 ${randInt(100, 999)} ${randInt(1000, 9999)}`, isDefault: true });
  });
  await chunkInsert(s.addresses, addrRows);

  // ---- Catalog
  const [brand] = await db.insert(s.brands).values({ name: "Evergreen", slug: "evergreen" }).returning();
  const catDefs = [
    ["Shoes", "shoes", null], ["Apparel", "apparel", null], ["Accessories", "accessories", null],
    ["Sneakers", "sneakers", "shoes"], ["Running", "running", "shoes"], ["Slip-Ons", "slip-ons", "shoes"], ["Boots", "boots", "shoes"],
    ["Tees & Tops", "tees", "apparel"], ["Sweatshirts & Knits", "sweatshirts", "apparel"], ["Bottoms", "bottoms", "apparel"], ["Outerwear", "outerwear", "apparel"],
    ["Socks", "socks", "accessories"], ["Hats & Scarves", "hats", "accessories"], ["Bags", "bags", "accessories"], ["Shoe Care", "care", "accessories"],
  ] as const;
  const catRows = await db.insert(s.categories).values(catDefs.map(([name, slug], i) => ({ name, slug, sortOrder: i, description: `Explore Evergreen ${name.toLowerCase()} — made with natural, renewable materials.`, imageUrl: `/images/products/${slug === "apparel" ? "hoodie" : slug === "accessories" ? "accessory" : slug === "socks" ? "socks" : slug === "tees" ? "tee" : "runner"}.jpg` }))).returning();
  const catId = Object.fromEntries(catRows.map((c) => [c.slug, c.id]));
  for (const [, slug, parent] of catDefs) if (parent) await db.update(s.categories).set({ parentId: catId[parent] }).where(sql`${s.categories.id} = ${catId[slug]}`);

  const colDefs = [
    ["Men", "men", { gender: "men" }, true, "/images/products/runner.jpg"],
    ["Women", "women", { gender: "women" }, true, "/images/products/wool-sneaker.jpg"],
    ["New Arrivals", "new-arrivals", { newWithinDays: 45 }, true, "/images/products/trail.jpg"],
    ["Sale", "sale", { onSale: true }, true, "/images/products/slipon.jpg"],
    ["Best Sellers", "best-sellers", { bestSeller: true }, true, "/images/products/tee.jpg"],
    ["Trail Ready", "trail-ready", null, false, "/images/products/trail.jpg"],
    ["Wool Essentials", "wool-essentials", null, false, "/images/products/wool-sneaker.jpg"],
    ["Everyday Basics", "everyday-basics", null, false, "/images/products/hoodie.jpg"],
    ["Gifts Under $50", "gifts-under-50", null, false, "/images/products/accessory.jpg"],
  ] as const;
  const colRows = await db.insert(s.collections).values(colDefs.map(([name, slug, rules, isFeatured, imageUrl], i) => ({ name, slug, rules, isFeatured, imageUrl, sortOrder: i, description: `The ${name} collection.` }))).returning();
  const colId = Object.fromEntries(colRows.map((c) => [c.slug, c.id]));

  // Products
  type PV = typeof s.productVariants.$inferInsert;
  const productValues: (typeof s.products.$inferInsert)[] = [];
  const productMeta: { model: Model; gender: string; edition: string; colors: [string, string][]; sizes: string[]; onSale: boolean; price: number }[] = [];
  for (const model of MODELS) {
    for (const gender of model.genders) {
      for (const edition of EDITIONS[model.type]) {
        if (productValues.length >= 108) break;
        const name = edition ? `${model.name} ${edition}` : model.name;
        const genderLabel = gender === "unisex" ? "" : gender === "men" ? "Men's " : "Women's ";
        const fullName = `${genderLabel}${name}`;
        const slug = slugify(fullName);
        const createdAt = daysAgo(randInt(2, 400));
        const onSale = rand() < 0.22;
        const price = model.price + (edition === "Lite" ? -10 : edition ? 20 : 0);
        const palette = COLORS[model.type];
        const colorCount = model.type === "accessories" ? randInt(2, 4) : randInt(3, 5);
        const start = randInt(0, palette.length - 1);
        const colors = Array.from({ length: colorCount }, (_, i) => palette[(start + i) % palette.length]);
        const sizes = model.sizes ?? (model.type === "shoes" ? (gender === "women" ? SIZES.womenShoes : SIZES.menShoes) : SIZES.apparel);
        productValues.push({
          slug, name: fullName, shortDescription: model.desc.split(". ")[0] + ".", description: `${model.desc}\n\nDesigned in Portland and made with materials chosen for a lighter footprint, the ${name} is engineered for everyday comfort. Every pair ships carbon neutral in recycled packaging.`,
          status: rand() < 0.06 ? "DRAFT" : "ACTIVE", brandId: brand.id, primaryCategoryId: catId[model.cat], productType: model.type, gender,
          material: model.material, careInstructions: model.type === "shoes" ? "Remove insoles and laces, machine wash cold on gentle cycle, air dry." : "Machine wash cold with like colors. Tumble dry low or lay flat.",
          sustainabilityDescription: `Made with ${model.material.split(",")[0].toLowerCase()}. Our supply chain is audited annually and we offset 100% of our carbon footprint.`,
          specifications: { Weight: model.type === "shoes" ? `${randInt(210, 320)} g` : `${randInt(150, 600)} g`, Origin: pick(["Vietnam", "Portugal", "Peru", "South Korea"]), Fit: model.type === "shoes" ? "True to size" : "Relaxed" },
          seoTitle: `${fullName} | Evergreen`, seoDescription: model.desc.slice(0, 150), weightGrams: randInt(150, 800), isFeatured: rand() < 0.15, isBestSeller: rand() < 0.2,
          publishedAt: createdAt, createdAt, updatedAt: createdAt,
        });
        productMeta.push({ model, gender, edition, colors, sizes, onSale, price });
      }
    }
  }
  const productRows = await db.insert(s.products).values(productValues).returning({ id: s.products.id, slug: s.products.slug, createdAt: s.products.createdAt });
  console.log(`Products: ${productRows.length}`);

  const variantValues: PV[] = [];
  const imageValues: (typeof s.productImages.$inferInsert)[] = [];
  const pcValues: (typeof s.productCategories.$inferInsert)[] = [];
  const pcolValues: (typeof s.productCollections.$inferInsert)[] = [];
  const tagValues: (typeof s.productTags.$inferInsert)[] = [];
  const attrValues: (typeof s.productAttributes.$inferInsert)[] = [];
  const IMG_ALT: Record<string, string> = { runner: "trail", trail: "runner", "wool-sneaker": "slipon", slipon: "wool-sneaker", tee: "hoodie", hoodie: "tee", socks: "accessory", accessory: "socks" };
  productRows.forEach((p, idx) => {
    const m = productMeta[idx];
    const parentCat = m.model.type === "shoes" ? "shoes" : m.model.type === "apparel" ? "apparel" : "accessories";
    pcValues.push({ productId: p.id, categoryId: catId[parentCat] }, { productId: p.id, categoryId: catId[m.model.cat] });
    if (m.gender !== "unisex") pcolValues.push({ productId: p.id, collectionId: colId[m.gender] });
    else pcolValues.push({ productId: p.id, collectionId: colId.men }, { productId: p.id, collectionId: colId.women });
    if (m.onSale) pcolValues.push({ productId: p.id, collectionId: colId.sale });
    if (productValues[idx].isBestSeller) pcolValues.push({ productId: p.id, collectionId: colId["best-sellers"] });
    if (Date.now() - new Date(p.createdAt).getTime() < 45 * 86400000) pcolValues.push({ productId: p.id, collectionId: colId["new-arrivals"] });
    if (["Trail", "Hiker", "Weather"].some((k) => m.model.name.includes(k))) pcolValues.push({ productId: p.id, collectionId: colId["trail-ready"] });
    if (m.model.material.toLowerCase().includes("merino")) pcolValues.push({ productId: p.id, collectionId: colId["wool-essentials"] });
    if (["Tee", "Hoodie", "Jogger", "Sock"].some((k) => m.model.name.includes(k))) pcolValues.push({ productId: p.id, collectionId: colId["everyday-basics"] });
    if (m.price < 50) pcolValues.push({ productId: p.id, collectionId: colId["gifts-under-50"] });
    tagValues.push({ productId: p.id, tag: m.model.type }, { productId: p.id, tag: m.model.material.split(",")[0].toLowerCase() });
    attrValues.push({ productId: p.id, name: "Material", value: m.model.material }, { productId: p.id, name: "Gender", value: m.gender });
    m.colors.forEach(([color], ci) => {
      imageValues.push({ productId: p.id, url: `/images/products/${m.model.img}.jpg`, altText: `${productValues[idx].name} in ${color}`, color, sortOrder: ci * 2 });
      imageValues.push({ productId: p.id, url: `/images/products/${IMG_ALT[m.model.img]}.jpg`, altText: `${productValues[idx].name} in ${color} — detail`, color, sortOrder: ci * 2 + 1 });
    });
    m.colors.forEach(([color, hex], ci) => {
      m.sizes.forEach((size, si) => {
        const sku = `EG-${String(p.id).padStart(4, "0")}-${String(ci + 1).padStart(2, "0")}-${size.replace(/\s/g, "").toUpperCase()}`;
        variantValues.push({ productId: p.id, sku, barcode: `0${randInt(100000000000, 999999999999)}`, color, colorHex: hex, size, price: money(m.price), compareAtPrice: m.onSale ? money(m.price * 1.25) : null, costPrice: money(m.price * 0.42), weightGrams: productValues[idx].weightGrams, status: rand() < 0.02 ? "INACTIVE" : "ACTIVE", createdAt: p.createdAt });
        void si;
      });
    });
  });
  await chunkInsert(s.productCategories, pcValues);
  await chunkInsert(s.productCollections, pcolValues);
  await chunkInsert(s.productTags, tagValues);
  await chunkInsert(s.productAttributes, attrValues);
  await chunkInsert(s.productImages, imageValues);
  const variantRows: { id: number; productId: number; price: string; sku: string; color: string; size: string }[] = [];
  for (let i = 0; i < variantValues.length; i += 500) {
    const rows = await db.insert(s.productVariants).values(variantValues.slice(i, i + 500)).returning({ id: s.productVariants.id, productId: s.productVariants.productId, price: s.productVariants.price, sku: s.productVariants.sku, color: s.productVariants.color, size: s.productVariants.size });
    variantRows.push(...rows);
  }
  console.log(`Variants: ${variantRows.length}`);

  // ---- Warehouses
  const whRows = await db.insert(s.warehouses).values([
    { code: "PDX", name: "Portland Fulfillment Center", addressLine1: "4200 NW Yeon Ave", city: "Portland", region: "OR", postalCode: "97210", isDefault: true, priority: 1 },
    { code: "NJ1", name: "Newark East Coast Hub", addressLine1: "100 Port St", city: "Newark", region: "NJ", postalCode: "07114", priority: 2 },
    { code: "DFW", name: "Dallas Distribution", addressLine1: "2500 Logistics Pkwy", city: "Dallas", region: "TX", postalCode: "75261", priority: 3 },
    { code: "LAX", name: "Los Angeles Returns Center", addressLine1: "8800 Bellanca Ave", city: "Los Angeles", region: "CA", postalCode: "90045", priority: 4 },
    { code: "CHI", name: "Chicago Overflow", addressLine1: "1 Industrial Dr", city: "Chicago", region: "IL", postalCode: "60638", priority: 5, status: "INACTIVE" },
  ]).returning();
  const defaultWh = whRows[0];

  // inventory in-memory ledger
  const invMap = new Map<string, { variantId: number; warehouseId: number; onHand: number; reserved: number; reorderLevel: number }>();
  const key = (v: number, w: number) => `${v}:${w}`;
  const txValues: (typeof s.inventoryTransactions.$inferInsert)[] = [];
  for (const v of variantRows) {
    for (const w of whRows) {
      const r = rand();
      const qty = w.code === "CHI" ? randInt(0, 5) : r < 0.05 ? 0 : r < 0.15 ? randInt(1, 4) : randInt(8, 60);
      invMap.set(key(v.id, w.id), { variantId: v.id, warehouseId: w.id, onHand: qty, reserved: 0, reorderLevel: 5 });
      if (qty > 0) txValues.push({ variantId: v.id, warehouseId: w.id, type: "PURCHASE", quantity: qty, referenceType: "PO", referenceId: `PO-${randInt(1000, 9999)}`, reason: "Initial stock receipt", createdBy: adminUser.id, createdAt: daysAgo(randInt(200, 400)) });
    }
  }

  // ---- Coupons
  const couponRows = await db.insert(s.coupons).values([
    { code: "WELCOME10", description: "10% off your first order", type: "PERCENTAGE", value: "10", usageLimit: 100, expiresAt: daysAgo(-180), minimumOrderAmount: "50" },
    { code: "EVERGREEN20", description: "20% off orders over $150", type: "PERCENTAGE", value: "20", minimumOrderAmount: "150", usageLimit: 500, expiresAt: daysAgo(-90) },
    { code: "FREESHIP", description: "Free standard shipping", type: "FREE_SHIPPING", value: "0", expiresAt: daysAgo(-365) },
    { code: "SAVE15", description: "$15 off", type: "FIXED_AMOUNT", value: "15", minimumOrderAmount: "75", usageLimit: 200 },
    { code: "SOCKS5", description: "$5 off socks", type: "FIXED_AMOUNT", value: "5", appliesToCategoryId: catId.socks },
    { code: "SHOES25", description: "25% off shoes", type: "PERCENTAGE", value: "25", appliesToProductType: "shoes", usageLimit: 50, expiresAt: daysAgo(-30) },
    { code: "EXPIRED10", description: "Expired promo", type: "PERCENTAGE", value: "10", expiresAt: daysAgo(10) },
    { code: "MAXEDOUT", description: "Fully used promo", type: "PERCENTAGE", value: "30", usageLimit: 5, usageCount: 5 },
    { code: "INACTIVE5", description: "Disabled promo", type: "FIXED_AMOUNT", value: "5", isActive: false },
    ...Array.from({ length: 11 }, (_, i) => ({ code: `SPRING${i + 1}`, description: `Spring campaign ${i + 1}`, type: i % 2 ? "PERCENTAGE" : "FIXED_AMOUNT", value: String(i % 2 ? randInt(5, 20) : randInt(5, 25)), usageLimit: randInt(20, 300), expiresAt: daysAgo(-randInt(10, 120)), minimumOrderAmount: String(randInt(0, 100)) })),
  ]).returning();

  // ---- Orders
  const productInfo = Object.fromEntries(productRows.map((p, i) => [p.id, { name: productValues[i].name, slug: p.slug, img: `/images/products/${productMeta[i].model.img}.jpg` }]));
  const STATUS_DIST = ["DELIVERED", "DELIVERED", "DELIVERED", "DELIVERED", "DELIVERED", "SHIPPED", "SHIPPED", "PROCESSING", "PACKED", "CONFIRMED", "CANCELLED", "REFUNDED", "PENDING"];
  const orderValues: (typeof s.orders.$inferInsert)[] = [];
  const orderItemsByIdx: { variantId: number; productId: number; quantity: number; unitPrice: number }[][] = [];
  const activeVariants = variantRows;
  for (let i = 0; i < 500; i++) {
    const cust = pick(customers);
    const custUser = userValues.find((u) => u.email === cust.email)!;
    const created = daysAgo(randInt(0, 365));
    const status = pick(STATUS_DIST);
    const items: { variantId: number; productId: number; quantity: number; unitPrice: number }[] = [];
    const n = rand() < 0.25 ? 1 : rand() < 0.6 ? 2 : randInt(3, 5);
    const usedVariants = new Set<number>();
    for (let j = 0; j < n; j++) {
      const v = pick(activeVariants);
      if (usedVariants.has(v.id)) continue;
      usedVariants.add(v.id);
      const quantity = rand() < 0.8 ? 1 : 2;
      items.push({ variantId: v.id, productId: v.productId, quantity, unitPrice: Number(v.price) });
      const wh = whRows[Math.floor(rand() * 4)];
      const inv = invMap.get(key(v.id, wh.id))!;
      if (!["CANCELLED", "PENDING"].includes(status)) {
        inv.onHand = Math.max(0, inv.onHand - quantity);
        txValues.push({ variantId: v.id, warehouseId: wh.id, type: "SALE", quantity: -quantity, referenceType: "ORDER", referenceId: `EG-${100000 + i}`, reason: "Order fulfilled", createdAt: created });
        if (status === "REFUNDED") {
          inv.onHand += quantity;
          txValues.push({ variantId: v.id, warehouseId: whRows[3].id, type: "RETURN", quantity, referenceType: "ORDER", referenceId: `EG-${100000 + i}`, reason: "Customer return", createdAt: new Date(created.getTime() + 5 * 86400000) });
        }
      } else if (status === "PENDING") {
        inv.reserved += quantity;
        txValues.push({ variantId: v.id, warehouseId: wh.id, type: "RESERVATION", quantity, referenceType: "ORDER", referenceId: `EG-${100000 + i}`, reason: "Checkout reservation", createdAt: created });
      }
    }
    const subtotal = items.reduce((a, it) => a + it.unitPrice * it.quantity, 0);
    const coupon = rand() < 0.2 ? pick(couponRows.slice(0, 4)) : null;
    const discount = coupon ? (coupon.type === "PERCENTAGE" ? subtotal * Number(coupon.value) / 100 : coupon.type === "FIXED_AMOUNT" ? Math.min(Number(coupon.value), subtotal) : 0) : 0;
    const shippingMethod = rand() < 0.75 ? "standard" : "express";
    const shipping = coupon?.type === "FREE_SHIPPING" ? 0 : subtotal - discount >= 100 && shippingMethod === "standard" ? 0 : shippingMethod === "standard" ? 8 : 18;
    const tax = (subtotal - discount) * 0.08;
    const [city, region, postalCode] = pick(CITIES);
    orderValues.push({
      orderNumber: `EG-${100000 + i}`, userId: cust.id, email: cust.email, status, subtotal: money(subtotal), discountTotal: money(discount), shippingTotal: money(shipping), taxTotal: money(tax), grandTotal: money(subtotal - discount + shipping + tax),
      couponId: coupon?.id ?? null, couponCode: coupon?.code ?? null, shippingMethod, warehouseId: defaultWh.id,
      shippingAddress: { firstName: custUser.firstName, lastName: custUser.lastName, line1: `${randInt(10, 999)} Cedar St`, city, region, postalCode, country: "US" },
      placedAt: created, createdAt: created, updatedAt: created,
    });
    orderItemsByIdx.push(items);
  }
  const orderRows = await db.insert(s.orders).values(orderValues).returning({ id: s.orders.id, status: s.orders.status, grandTotal: s.orders.grandTotal, userId: s.orders.userId, createdAt: s.orders.createdAt, couponId: s.orders.couponId, discountTotal: s.orders.discountTotal });
  const oiValues: (typeof s.orderItems.$inferInsert)[] = [];
  const payValues: (typeof s.payments.$inferInsert)[] = [];
  const shipValues: (typeof s.shipments.$inferInsert)[] = [];
  const evValues: (typeof s.orderEvents.$inferInsert)[] = [];
  const cuValues: (typeof s.couponUsages.$inferInsert)[] = [];
  const variantById = Object.fromEntries(variantRows.map((v) => [v.id, v]));
  orderRows.forEach((o, i) => {
    for (const it of orderItemsByIdx[i]) {
      const v = variantById[it.variantId];
      const pi = productInfo[it.productId];
      oiValues.push({ orderId: o.id, variantId: v.id, productId: it.productId, productName: pi.name, productSlug: pi.slug, sku: v.sku, color: v.color, size: v.size, imageUrl: pi.img, unitPrice: money(it.unitPrice), quantity: it.quantity, lineTotal: money(it.unitPrice * it.quantity) });
    }
    const t0 = new Date(o.createdAt).getTime();
    const ev = (type: string, message: string, offsetH: number) => evValues.push({ orderId: o.id, type, message, createdAt: new Date(t0 + offsetH * 3600000) });
    ev("ORDER_CREATED", "Order placed", 0);
    const payStatus = o.status === "PENDING" ? "PENDING" : o.status === "CANCELLED" ? (rand() < 0.5 ? "FAILED" : "REFUNDED") : o.status === "REFUNDED" ? "REFUNDED" : "PAID";
    payValues.push({ orderId: o.id, provider: "mock", providerReference: `mock_${o.id}_${randInt(1000, 9999)}`, method: "card", status: payStatus, amount: o.grandTotal, cardLast4: String(randInt(1000, 9999)), refundedAmount: payStatus === "REFUNDED" ? o.grandTotal : "0", failureReason: payStatus === "FAILED" ? "Card declined by issuer" : null, createdAt: o.createdAt });
    if (payStatus === "PAID" || payStatus === "REFUNDED") ev("PAYMENT_CONFIRMED", "Payment captured", 0.1);
    if (payStatus === "FAILED") ev("PAYMENT_FAILED", "Card declined by issuer", 0.1);
    if (["PROCESSING", "PACKED", "SHIPPED", "DELIVERED", "REFUNDED"].includes(o.status)) ev("ORDER_PROCESSING", "Order is being prepared", 6);
    if (["PACKED", "SHIPPED", "DELIVERED", "REFUNDED"].includes(o.status)) ev("ORDER_PACKED", "Packed at Portland Fulfillment Center", 20);
    if (["SHIPPED", "DELIVERED", "REFUNDED"].includes(o.status)) {
      ev("ORDER_SHIPPED", "Shipped via EcoPost", 30);
      shipValues.push({ orderId: o.id, warehouseId: defaultWh.id, carrier: "EcoPost", trackingNumber: `EP${randInt(100000000, 999999999)}US`, status: o.status === "SHIPPED" ? "IN_TRANSIT" : "DELIVERED", shippedAt: new Date(t0 + 30 * 3600000), deliveredAt: o.status === "SHIPPED" ? null : new Date(t0 + 96 * 3600000), createdAt: o.createdAt });
    } else if (["PACKED", "PROCESSING"].includes(o.status)) {
      shipValues.push({ orderId: o.id, warehouseId: defaultWh.id, status: o.status === "PACKED" ? "PACKED" : "PENDING", createdAt: o.createdAt });
    }
    if (["DELIVERED", "REFUNDED"].includes(o.status)) ev("ORDER_DELIVERED", "Delivered", 96);
    if (o.status === "CANCELLED") ev("ORDER_CANCELLED", payStatus === "FAILED" ? "Cancelled: payment failed" : "Cancelled by customer", 1);
    if (o.status === "REFUNDED") ev("REFUND_CREATED", `Refund of $${o.grandTotal} issued`, 140);
    if (o.couponId) cuValues.push({ couponId: o.couponId, userId: o.userId, orderId: o.id, discountAmount: o.discountTotal, createdAt: o.createdAt });
  });
  const oiRows: { id: number; orderId: number; productId: number | null }[] = [];
  for (let i = 0; i < oiValues.length; i += 500) oiRows.push(...(await db.insert(s.orderItems).values(oiValues.slice(i, i + 500)).returning({ id: s.orderItems.id, orderId: s.orderItems.orderId, productId: s.orderItems.productId })));
  await chunkInsert(s.payments, payValues);
  await chunkInsert(s.shipments, shipValues);
  await chunkInsert(s.orderEvents, evValues);
  if (cuValues.length) await chunkInsert(s.couponUsages, cuValues);
  for (const c of couponRows) {
    const used = cuValues.filter((u) => u.couponId === c.id).length;
    if (used) await db.update(s.coupons).set({ usageCount: used }).where(sql`${s.coupons.id} = ${c.id}`);
  }
  console.log(`Orders: ${orderRows.length}, items: ${oiRows.length}`);

  // ---- Inventory rows + transactions
  await chunkInsert(s.warehouseInventory, [...invMap.values()].map((r) => ({ variantId: r.variantId, warehouseId: r.warehouseId, quantityOnHand: r.onHand, quantityReserved: r.reserved, reorderLevel: r.reorderLevel })));
  await chunkInsert(s.inventoryTransactions, txValues);
  console.log(`Inventory rows: ${invMap.size}, transactions: ${txValues.length}`);

  // ---- Reviews (from delivered order items, unique per order item)
  const deliveredOrderIds = new Set(orderRows.filter((o) => o.status === "DELIVERED").map((o) => o.id));
  const orderUser = Object.fromEntries(orderRows.map((o) => [o.id, o.userId]));
  const TITLES = ["Incredibly comfortable", "My new go-to", "Runs slightly large", "Worth every penny", "Great for travel", "Soft and breathable", "Perfect fit", "Love the color", "Solid quality", "Good, not great"];
  const COMMENTS = ["I've worn these almost every day since they arrived. Light, breathable, and they look great with everything.", "Comfort is excellent and the materials feel premium. Sizing was accurate for me.", "Ordered my usual size and they fit a little roomy — consider sizing down if you're between sizes.", "Shipping was fast and the packaging was fully recyclable, which I appreciated.", "Great everyday piece. Holds up well after several washes.", "Took a few days to break in but now they're the most comfortable pair I own."];
  const reviewValues: (typeof s.reviews.$inferInsert)[] = [];
  const reviewedItems = new Set<number>();
  for (const oi of oiRows) {
    if (reviewValues.length >= 260) break;
    if (!deliveredOrderIds.has(oi.orderId) || !oi.productId || reviewedItems.has(oi.id)) continue;
    if (rand() < 0.2) continue;
    reviewedItems.add(oi.id);
    const rating = pick([5, 5, 5, 4, 4, 4, 3, 5, 2, 4]);
    reviewValues.push({ productId: oi.productId, userId: orderUser[oi.orderId]!, orderItemId: oi.id, rating, title: pick(TITLES), comment: pick(COMMENTS), isVerifiedPurchase: true, status: rand() < 0.85 ? "APPROVED" : rand() < 0.5 ? "PENDING" : "REJECTED", createdAt: daysAgo(randInt(0, 200)) });
  }
  await chunkInsert(s.reviews, reviewValues);
  await db.execute(sql`update products p set rating_avg = r.avg, rating_count = r.cnt from (select product_id, round(avg(rating)::numeric, 2) as avg, count(*) as cnt from reviews where status = 'APPROVED' group by product_id) r where r.product_id = p.id`);
  console.log(`Reviews: ${reviewValues.length}`);

  // ---- Settings, notifications, audit
  await db.insert(s.storeSettings).values([
    { key: "store.name", value: "Evergreen Store", group: "store" },
    { key: "store.supportEmail", value: "support@evergreen.example", group: "store" },
    { key: "store.currency", value: "USD", group: "store" },
    { key: "store.announcement", value: "Free carbon-neutral shipping on orders over $100", group: "store" },
    { key: "shipping.methods", value: [{ code: "standard", name: "Standard (4–7 days)", price: 8 }, { code: "express", name: "Express (2–3 days)", price: 18 }], group: "shipping" },
    { key: "shipping.freeThreshold", value: 100, group: "shipping" },
    { key: "tax.rate", value: 0.08, group: "tax" },
    { key: "payment.provider", value: "mock", group: "payment" },
    { key: "payment.mockFailCardSuffix", value: "0000", group: "payment" },
    { key: "email.provider", value: "logging", group: "email" },
    { key: "email.fromAddress", value: "hello@evergreen.example", group: "email" },
    { key: "inventory.lowStockThreshold", value: 5, group: "inventory" },
    { key: "inventory.allowBackorders", value: false, group: "inventory" },
    { key: "security.accessTokenMinutes", value: 15, group: "security" },
    { key: "security.refreshTokenDays", value: 30, group: "security" },
    { key: "security.maxLoginAttempts", value: 10, group: "security" },
  ]);
  await db.insert(s.notifications).values([
    { userId: adminUser.id, type: "LOW_STOCK", channel: "IN_APP", title: "Low stock alert", body: "12 SKUs are below reorder level at PDX." },
    { userId: customers[0].id, type: "ORDER_DELIVERED", channel: "EMAIL", title: "Your order was delivered", body: "Thanks for shopping with Evergreen.", sentAt: new Date() },
    { userId: customers[0].id, type: "PROMOTION", channel: "IN_APP", title: "Welcome to Evergreen", body: "Use WELCOME10 for 10% off your first order." },
  ]);
  await db.insert(s.auditLogs).values([
    { actorId: adminUser.id, action: "EMPLOYEE_CREATED", entityType: "User", entityId: String(staff[0].id), newValue: { email: "employee@example.com", role: "EMPLOYEE" }, ipAddress: "127.0.0.1" },
    { actorId: adminUser.id, action: "INVENTORY_ADJUSTED", entityType: "WarehouseInventory", entityId: `${variantRows[0].id}:${defaultWh.id}`, oldValue: { quantityOnHand: 10 }, newValue: { quantityOnHand: 25 }, ipAddress: "127.0.0.1" },
    { actorId: adminUser.id, action: "PRODUCT_UPDATED", entityType: "Product", entityId: String(productRows[0].id), oldValue: { status: "DRAFT" }, newValue: { status: "ACTIVE" }, ipAddress: "127.0.0.1" },
  ]);
  console.log("Seed complete ✔");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => pool.end());
