async function sendVerificationEmail(email: string, code: string, subject: string, reason: string): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || "Simple E-Commerce API";
  if (!apiKey || !senderEmail) throw new Error("Brevo email configuration is incomplete");

  const result = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "accept": "application/json", "api-key": apiKey, "content-type": "application/json" },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email }],
      subject,
      textContent: `Your verification code is ${code}. It expires in 10 minutes. ${reason}`,
    }),
  });

  if (!result.ok) {
    const details = await result.text();
    console.error("Brevo email request failed:", result.status, details);
    throw new Error("Unable to send verification email");
  }
}

export async function sendWelcomeEmail(email: string, name: string): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || "Simple E-Commerce API";
  if (!apiKey || !senderEmail) throw new Error("Brevo email configuration is incomplete");

  const result = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "accept": "application/json", "api-key": apiKey, "content-type": "application/json" },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email }],
      subject: "Welcome to Simple E-Commerce API",
      textContent: `Hello ${name},\n\nWelcome! Your account has been created successfully. You can now log in to get started.\n\nThanks,\n${senderName}`,
    }),
  });

  if (!result.ok) {
    const details = await result.text();
    console.error("Brevo welcome email request failed:", result.status, details);
    throw new Error("Unable to send welcome email");
  }
}

export function sendLoginVerificationEmail(email: string, code: string): Promise<void> {
  return sendVerificationEmail(email, code, "Your login verification code", "If you did not try to log in, you can ignore this email.");
}

export function sendAccountDeletionEmail(email: string, code: string): Promise<void> {
  return sendVerificationEmail(email, code, "Confirm your account deletion", "If you did not request account deletion, ignore this email and keep your account.");
}
