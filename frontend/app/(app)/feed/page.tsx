import type { Metadata } from "next";
import { apiFetch } from "@/lib/api";
import FeedClient from "./FeedClient";

export const metadata: Metadata = {
  title: "Feed — CropRoute",
  description: "Merged stream of farmer price reports and agri news.",
};

export default async function FeedPage() {
  let items: any[] = [];
  let error: string | null = null;

  try {
    items = await apiFetch<any[]>("/api/feed", { params: { limit: 20 }, cache: "no-store" });
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load feed";
  }

  return <FeedClient initialItems={items} initialError={error} />;
}
