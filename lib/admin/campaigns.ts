import { resolveRecipientsFromTarget, type CampaignTarget } from "@/lib/admin/segments";
import {
  addCampaignRecipients,
  createCampaign,
  enqueueMessage,
  getCampaignById,
  listCampaignRecipients,
  listCampaigns,
  markCampaignRecipientFailed,
  markCampaignRecipientQueued,
  markCampaignStatus,
  syncCampaignRecipientStatuses,
  updateCampaignMetrics,
} from "@/lib/db/wa-db";

export function createCampaignDraft(input: {
  name: string;
  messageBody: string;
  sendMode: string;
  target: CampaignTarget;
  scheduledAt?: string | null;
}) {
  const id = createCampaign({
    name: input.name.trim(),
    messageBody: input.messageBody.trim(),
    sendMode: input.sendMode,
    targetJson: JSON.stringify(input.target),
    scheduledAt: input.scheduledAt ?? null,
  });
  return getCampaignById(id);
}

export function previewCampaignRecipients(target: CampaignTarget) {
  const recipients = resolveRecipientsFromTarget(target);
  return {
    total: recipients.length,
    sample: recipients.slice(0, 25),
  };
}

export function listCampaignsWithSync(limit = 100) {
  const campaigns = listCampaigns(limit);
  for (const campaign of campaigns) {
    if (campaign.status === "running" || campaign.status === "scheduled") {
      syncCampaignRecipientStatuses(campaign.id);
    }
  }
  return listCampaigns(limit);
}

export function startCampaign(campaignId: number) {
  const campaign = getCampaignById(campaignId);
  if (!campaign) {
    throw new Error("Campaign not found");
  }
  if (campaign.status !== "draft" && campaign.status !== "scheduled") {
    throw new Error(`Campaign cannot be started from ${campaign.status}`);
  }

  const target = JSON.parse(campaign.target_json) as CampaignTarget;
  const recipients = resolveRecipientsFromTarget(target);
  addCampaignRecipients(campaignId, recipients);
  updateCampaignMetrics(campaignId);

  const allRecipients = listCampaignRecipients(campaignId, 100000);
  const scheduledAt = campaign.scheduled_at
    ? new Date(campaign.scheduled_at)
    : new Date();

  markCampaignStatus(campaignId, "running", {
    started_at: new Date().toISOString(),
    total_recipients: allRecipients.length,
  });

  for (const recipient of allRecipients) {
    if (recipient.status !== "pending") continue;
    const messageId = enqueueMessage({
      phone: recipient.phone,
      userId: recipient.user_id ?? undefined,
      messageType: "campaign_broadcast",
      scheduledAt,
      payload: {
        body: campaign.message_body,
        campaignId,
        campaignRecipientId: recipient.id,
      },
    });
    if (messageId == null) {
      markCampaignRecipientFailed(recipient.id, "Failed to enqueue campaign message");
      continue;
    }
    markCampaignRecipientQueued(recipient.id, messageId);
  }

  syncCampaignRecipientStatuses(campaignId);
  const refreshed = getCampaignById(campaignId);
  if (!refreshed) return;
  if (refreshed.queued_recipients > 0) {
    markCampaignStatus(campaignId, "scheduled");
  } else if (refreshed.failed_recipients > 0) {
    markCampaignStatus(campaignId, "failed", {
      completed_at: new Date().toISOString(),
    });
  } else {
    markCampaignStatus(campaignId, "completed", {
      completed_at: new Date().toISOString(),
    });
  }
}
