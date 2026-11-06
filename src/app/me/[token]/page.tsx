import type { Metadata } from "next";
import MemberPage from "@/components/MemberPage";

export const metadata: Metadata = { title: "Your share · SplitPay AI", robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  return <MemberPage token={(await params).token} />;
}
