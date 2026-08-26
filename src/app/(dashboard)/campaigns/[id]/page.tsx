import { CampaignDetail } from "@/components/campaigns/campaign-detail";

// A server shell around the client view.
//
// Since Next 15 a page receives params as a promise. A client component would
// have to unwrap it with React's use(), which does not exist in React 18, so
// the await happens here and the id is handed down as a plain string. This
// also keeps the client bundle to the part that actually needs interactivity.

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CampaignDetail id={id} />;
}
