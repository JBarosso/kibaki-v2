// scripts/link-storage-to-db.js
import dotenv from "dotenv";
dotenv.config();
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY; // use service role for writes
const BUCKET = process.env.BUCKET_NAME || "characters";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function run() {
  // list all files in bucket (paginated)
  let page = 0;
  const perPage = 100;
  while (true) {
    const from = page * perPage;
    const to = from + perPage - 1;
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list("", { limit: perPage, offset: from });
    if (error) {
      console.error("Storage list error:", error);
      process.exit(1);
    }
    if (!data || data.length === 0) break;

    for (const file of data) {
      // file.name is like 'neo-ronin.png' — extract slug (without extension)
      const name = file.name;
      const slug = name.replace(/\.[^/.]+$/, ""); // remove extension
      // build public url (public bucket)
      const publicUrl = `${SUPABASE_URL.replace(
        /\/$/,
        ""
      )}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(name)}`;

      // update characters table where slug matches
      const { error: upErr } = await supabase
        .from("characters")
        .update({ image_url: publicUrl })
        .eq("slug", slug);

      if (upErr) {
        console.error("Update error for", slug, upErr);
        // optionally log to file
      } else {
        console.log("Updated", slug, "->", publicUrl);
      }
    }

    if (data.length < perPage) break;
    page++;
  }

  console.log("Done.");
}

run().catch((e) => console.error(e));
