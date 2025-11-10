// mailer.js
const nodemailer = require("nodemailer");

const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM = process.env.MAIL_FROM || SMTP_USER;

if (!SMTP_USER || !SMTP_PASS) {
  console.error("❌ Missing Gmail credentials in .env");
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: true, // Gmail requires SSL on port 465
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

async function verifyTransporter() {
  try {
    await transporter.verify();
    console.log("✅ Gmail SMTP connection verified");
  } catch (err) {
    console.error("❌ Gmail SMTP verification failed:", err.message);
  }
}
verifyTransporter();

async function sendOtpEmail(to, otp) {
  try {
    const info = await transporter.sendMail({
      from: FROM,
      to,
      subject: "Your OTP Code",
      text: `Your OTP is ${otp}. It expires in 5 minutes.`,
      html: `<p>Your OTP is <b>${otp}</b>. It expires in 5 minutes.</p>`,
    });

    console.log("✅ OTP email sent:", info.messageId);
    return info;
  } catch (err) {
    console.error("❌ sendOtpEmail failed:", err);
    throw err;
  }
}

module.exports = { sendOtpEmail };
