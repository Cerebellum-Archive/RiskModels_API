// Phase 2 stub — email sending is not yet implemented in RiskModels_API.
// sendEmail calls from billing.ts will log a warning and no-op rather than fail.
// Wire up real email delivery (Resend + templates) in a dedicated phase.

export type EmailTemplate =
  | 'welcome'
  | 'trial-ending'
  | 'subscription-confirmed'
  | 'payment-failed'
  | 'usage-report'
  | 'market-insights'
  | 'low-balance'
  | 'auto-refill-success'
  | 'auto-refill-failed'
  | 'monthly-spend-reset';

type EmailData = {
  [K in EmailTemplate]: Record<string, unknown>;
};

export async function sendEmail<T extends EmailTemplate>({
  to,
  subject,
  template,
}: {
  to: string;
  subject: string;
  template: T;
  data: EmailData[T];
  userId?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  console.warn(
    `[email-service] stub: email not sent (template=${template}, to=${to}, subject="${subject}"). Implement email delivery in Phase 2+.`,
  );
  return { success: false, error: "email-service stub — not yet implemented" };
}
