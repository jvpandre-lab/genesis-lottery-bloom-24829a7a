#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://kvlgqjvvzewbxivqceza.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2bGdxanZ2emV3YnhpdnFjZXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2OTc4MzMsImV4cCI6MjA5MjI3MzgzM30.Mwn0juUFWearR2SVm55pnEZP3oxSNob_PH7FfJnnRWU",
);

const { data, error } = await supabase
  .from("arbiter_decisions")
  .select("*")
  .limit(1);

if (error) {
  console.error("Error:", error.message);
} else {
  console.log(JSON.stringify(data?.[0], null, 2));
}
