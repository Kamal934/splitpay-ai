import ShareInbox from "@/components/ShareInbox";

export default async function SharePage({ searchParams }: { searchParams: Promise<{ t?: string; error?: string }> }) {
  const sp = await searchParams;
  return <ShareInbox token={sp.t} error={sp.error} />;
}
