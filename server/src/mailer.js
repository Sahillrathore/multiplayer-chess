const nodemailer = require("nodemailer");
const { SMTP } = require("./config");

const transporter = nodemailer.createTransport({
  host: SMTP.host,
  port: SMTP.port,
  secure: false,
  auth: { user: SMTP.user, pass: SMTP.pass },
});

async function sendOtpEmail(to, otp) {
  return transporter.sendMail({
    from: SMTP.from,
    to,
    subject: "Your OTP",
    text: `Your OTP is ${otp}. It expires in 5 minutes.`,
    html: `<p>Your OTP is <b>${otp}</b>. It expires in 5 minutes.</p>`,
  });
}

module.exports = { sendOtpEmail };
