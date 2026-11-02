import { loadDesk } from "@/lib/desk/data";
import { readSnapshot } from "@/lib/engine/snapshot";
import { Desk } from "./desk/Desk";

// The desk. Everything it shows comes from the morning's snapshot (or the recorded brief) and the seed, so a page
// load never calls a model. The page is rebuilt when the cron revalidates the "snapshot" tag.
export default async function Home() {
  return <Desk data={loadDesk(await readSnapshot())} />;
}
