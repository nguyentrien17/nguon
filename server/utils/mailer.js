// Chưa có SMTP/email provider nào được cấu hình cho dự án này (không có nodemailer,
// không có SMTP_* trong .env) — fallback tạm: log link reset ra console thay vì gửi mail
// thật, để luồng quên mật khẩu chạy được end-to-end trong dev. Khi có provider thật
// (SendGrid/SES/SMTP...), chỉ cần thay nội dung hàm này, phần gọi nó không đổi.
async function sendPasswordResetEmail(email, resetLink) {
    console.log(`[mailer] Password reset link for ${email}: ${resetLink}`);
}

module.exports = { sendPasswordResetEmail };
