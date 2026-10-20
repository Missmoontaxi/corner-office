// What leaves through MCP and hand-offs. The brief keeps its sections, but flagged items become counts by kind,
// so no reason string, evidence or source text can ride along. The receipt uses toMcpReceipt.
import { toMcpReceipt, type BriefV1, type Receipt } from "./contracts";

export function briefForMcp(brief: BriefV1, receipt: Receipt) {
  const { flagged, ...rest } = brief;
  return {
    ...rest,
    flagged: {
      suspicious_not_followed: flagged.filter((f) => f.kind === "suspicious").length,
      held_for_a_person_to_verify: flagged.filter((f) => f.kind === "verify").length,
    },
    receipt: toMcpReceipt(receipt),
  };
}
