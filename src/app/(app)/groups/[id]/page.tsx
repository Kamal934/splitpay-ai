import GroupView from "@/components/GroupView";

export default async function GroupPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ share?: string }> }) {
  return <GroupView id={(await params).id} share={(await searchParams).share} />;
}
