import nodemailer from 'nodemailer';

export function createMailer(config, logger = console) {
  const transporter = config.smtpUrl ? nodemailer.createTransport(config.smtpUrl) : null;

  return {
    async sendPasswordReset(email, token) {
      const resetUrl = `${config.passwordResetBaseUrl.replace(/\/$/, '')}/?resetToken=${encodeURIComponent(token)}`;
      if (!transporter) {
        if (config.authLogResetLinks) {
          logger.warn({ email, resetUrl }, 'Password reset link generated without SMTP');
        }
        return { sent: false, resetUrl: config.authLogResetLinks ? resetUrl : undefined };
      }

      await transporter.sendMail({
        from: config.mailFrom,
        to: email,
        subject: 'Reset your Cyber Command Center password',
        text: `Use this link to reset your Cyber Command Center password:\n\n${resetUrl}\n\nThe link expires soon. If you did not request it, ignore this email.`,
      });
      return { sent: true };
    },
  };
}
