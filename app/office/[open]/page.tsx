// Deep links. Each name in DEEP_LINK_NAMES is built ahead of time as its own static page that opens the desk on that
// view. Any other name is a 404, so the address can never put arbitrary text on the page.
import type { Metadata } from "next";
import { loadDesk } from "@/lib/desk/data";
import { DEEP_LINK_NAMES } from "@/lib/desk/shared";
import { Desk } from "../../desk/Desk";

export const dynamicParams = false;

export function generateStaticParams() {
  return DEEP_LINK_NAMES.map((open) => ({ open }));
}

export const metadata: Metadata = { title: "Corner Office" };

export default async function DeskView({ params }: { params: Promise<{ open: string }> }) {
  const { open } = await params;
  return <Desk data={loadDesk()} initial={open} />;
}
