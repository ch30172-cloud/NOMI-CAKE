/**
 * Creates the FIRST admin (owner) account. Run once, locally, with the service role key:
 *
 *   npm run bootstrap:admin          (asks for email + password interactively)
 *   or: ADMIN_BOOTSTRAP_EMAIL=owner@example.com ADMIN_BOOTSTRAP_PASSWORD='strong-password' npm run bootstrap:admin
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from .env.local.
 * There is no public sign-up: additional admins are added by an owner via SQL or a future admin screen.
 */
import { readFileSync, existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (fill .env.local first)");
  // Email/password come from env vars, or are asked interactively.
  const rl = createInterface({ input: stdin, output: stdout });
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL || (await rl.question("אימייל של בעלת העסק / Owner email: ")).trim();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD || (await rl.question("סיסמה (לפחות 10 תווים) / Password: ")).trim();
  rl.close();
  if (!email || !password) throw new Error("Email and password are required");
  if (password.length < 10) throw new Error("Password must be at least 10 characters");

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { count } = await supabase.from("admin_users").select("user_id", { count: "exact", head: true });
  if ((count ?? 0) > 0) {
    console.log("An admin already exists. Refusing to create another one from the bootstrap script.");
    process.exit(1);
  }

  let userId: string | undefined;
  const created = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) {
    // User may already exist in auth (e.g. signed in with Google before): look it up.
    const { data } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    userId = data?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
    if (!userId) throw created.error;
    console.log("Auth user already existed; linking it as owner.");
  } else {
    userId = created.data.user.id;
  }

  const { error } = await supabase.from("admin_users").insert({ user_id: userId, email, role: "owner", is_active: true });
  if (error) throw error;
  console.log(`Owner admin created for ${email}. Sign in at /he/admin/login and enable two-factor authentication.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
