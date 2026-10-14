import { notFound } from "next/navigation";
import GrayboxScene from "./GrayboxScene";

// Test bench for the viewport matrix. Local, CI and preview deploys only.
export default function GrayboxPage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return <GrayboxScene />;
}
