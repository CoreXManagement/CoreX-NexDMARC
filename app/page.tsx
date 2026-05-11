import { redirect } from "next/navigation";
import { isSetupComplete } from "@/lib/db";

export default function Home() {
  if (!isSetupComplete()) redirect("/setup");
  redirect("/dashboard");
}
