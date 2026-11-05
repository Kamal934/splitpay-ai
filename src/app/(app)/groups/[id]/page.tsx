import GroupView from "@/components/GroupView";

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  return <GroupView id={(await params).id} />;
}
