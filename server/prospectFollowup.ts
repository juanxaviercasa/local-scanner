export type ProspectCommercialStatus = "new" | "qualified" | "rejected" | "exported" | "analysis_pending" | "analyzed" | "demo_pending" | "contact_pending" | "contacted" | "converted" | "lost";

export type FollowupCurrent = { status: ProspectCommercialStatus; nextActionLabel: string | null; nextActionAt: Date | null };
export type FollowupInput = { status?: ProspectCommercialStatus; commercialNote?: string; nextActionLabel?: string | null; nextActionAt?: Date | null };

export function buildProspectFollowup(current: FollowupCurrent, input: FollowupInput) {
  const nextStatus = input.status ?? current.status;
  const nextActionLabel = input.nextActionLabel === undefined ? current.nextActionLabel : input.nextActionLabel;
  const nextActionAt = input.nextActionAt === undefined ? current.nextActionAt : input.nextActionAt;
  const hasCommercialChange = Boolean(input.commercialNote || input.status !== undefined || input.nextActionLabel !== undefined || input.nextActionAt !== undefined);
  const action = input.status !== undefined && input.status !== current.status ? "status_changed" : input.nextActionLabel !== undefined || input.nextActionAt !== undefined ? "follow_up_scheduled" : "note_added";
  return {
    hasCommercialChange,
    nextStatus,
    nextActionLabel,
    nextActionAt,
    markContactedAt: nextStatus === "contacted" && current.status !== "contacted",
    activity: { action, note: input.commercialNote || null, previousStatus: current.status, nextStatus, nextActionLabel, nextActionAt },
  };
}
