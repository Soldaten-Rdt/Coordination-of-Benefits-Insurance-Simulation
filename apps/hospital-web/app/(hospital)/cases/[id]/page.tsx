import { notFound } from "next/navigation";
import { CaseDetailPage } from "@/components/case/case-detail-page";

export default async function CasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const caseId = Number(id);
  if (!Number.isSafeInteger(caseId) || caseId < 1) notFound();
  return <CaseDetailPage caseId={caseId} />;
}
