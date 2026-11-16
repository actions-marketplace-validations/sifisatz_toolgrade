import { redirect } from "next/navigation";

/** No auth in the PoC: the app opens the seeded demo workspace. */
export default function AppIndex() {
  redirect("/app/acme");
}
