import { loadDesk } from "@/lib/desk/data";
import { Desk } from "./desk/Desk";

// The desk. Everything it shows is read at build time from the recorded brief and the seed, so a page load
// never calls a model.
export default function Home() {
  return <Desk data={loadDesk()} />;
}
