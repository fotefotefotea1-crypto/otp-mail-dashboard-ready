export interface GraphMessage {
  id: string;
  subject?: string;
  bodyPreview?: string;
  body?: { content?: string };
  receivedDateTime?: string;
  from?: { emailAddress?: { name?: string; address?: string } };
}
export interface OtpMatch {
  id: string;
  code: string;
  sender: string;
  senderEmail: string;
  subject: string;
  receivedAt: string;
}
export function plainText(value: string): string;
export function detectOtp(subject: string, body: string): string | null;
export function extractOtps(messages: GraphMessage[]): OtpMatch[];
