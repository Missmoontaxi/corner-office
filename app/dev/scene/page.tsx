import { notFound } from "next/navigation";
import SceneBench from "./SceneBench";

// Test bench for the viewport matrix. Local, CI and preview deploys only.
export default function ScenePage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return <SceneBench />;
}
