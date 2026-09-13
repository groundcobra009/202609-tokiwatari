import Timeline from "@/components/Timeline";

export const dynamic = "force-dynamic";

export default function Page() {
  return <Timeline initialNow={new Date().toISOString()} />;
}
