interface TemplateVars {
  name: string;
  [key: string]: string;
}

function baseTemplate(content: string, lang: 'ar' | 'en' = 'en'): string {
  const direction = lang === 'ar' ? 'rtl' : 'ltr';
  const align = lang === 'ar' ? 'right' : 'left';
  return `<!DOCTYPE html>
<html dir="${direction}">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2563eb; color: white; padding: 24px; text-align: center; border-radius: 12px 12px 0 0; }
    .content { background: #f8fafc; padding: 32px; border-radius: 0 0 12px 12px; }
    .footer { text-align: center; color: #94a3b8; font-size: 12px; margin-top: 24px; }
    .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📚 ${lang === 'ar' ? 'التعليم الإلكتروني' : 'Electronic Education'}</h1>
  </div>
  <div class="content" style="text-align: ${align};">
    ${content}
  </div>
  <div class="footer">
    <p>${lang === 'ar' ? '© 2026 منصة التعليم الإلكتروني' : '© 2026 Electronic Education Platform'}</p>
  </div>
</body>
</html>`;
}

export const templates = {
  welcome: (vars: TemplateVars, lang: 'ar' | 'en' = 'en') => {
    const content =
      lang === 'ar'
        ? `<h2>مرحباً ${vars.name}!</h2><p>تم إنشاء حسابك بنجاح. حسابك قيد انتظار موافقة المسؤول.</p>`
        : `<h2>Welcome, ${vars.name}!</h2><p>Your account has been created successfully. It is pending admin approval.</p>`;
    return baseTemplate(content, lang);
  },

  accountApproved: (vars: TemplateVars, lang: 'ar' | 'en' = 'en') => {
    const content =
      lang === 'ar'
        ? `<h2>تهانينا ${vars.name}!</h2><p>تمت الموافقة على حسابك من قبل المسؤول. يمكنك الآن تسجيل الدخول.</p><a href="${vars.loginUrl || '#'}" class="button">تسجيل الدخول</a>`
        : `<h2>Congratulations, ${vars.name}!</h2><p>Your account has been approved by the admin. You can now log in.</p><a href="${vars.loginUrl || '#'}" class="button">Log In</a>`;
    return baseTemplate(content, lang);
  },

  appointmentUpdate: (
    vars: TemplateVars & { date: string; time: string; status: string },
    lang: 'ar' | 'en' = 'en'
  ) => {
    const statusText =
      vars.status === 'ACCEPTED'
        ? lang === 'ar'
          ? 'مقبول'
          : 'accepted'
        : vars.status === 'REJECTED'
          ? lang === 'ar'
            ? 'مرفوض'
            : 'rejected'
          : lang === 'ar'
            ? 'محدث'
            : 'updated';
    const content =
      lang === 'ar'
        ? `<h2>تحديث الموعد</h2><p>مرحباً ${vars.name}،</p><p>تم <strong>${statusText}</strong> موعدك المقرر بتاريخ ${vars.date} الساعة ${vars.time}.</p>`
        : `<h2>Appointment Update</h2><p>Hi ${vars.name},</p><p>Your appointment scheduled for ${vars.date} at ${vars.time} has been <strong>${statusText}</strong>.</p>`;
    return baseTemplate(content, lang);
  },

  newGrade: (vars: TemplateVars & { subject: string; grade: string }, lang: 'ar' | 'en' = 'en') => {
    const content =
      lang === 'ar'
        ? `<h2>درجة جديدة</h2><p>مرحباً ${vars.name}،</p><p>تم إضافة درجة جديدة لمادة <strong>${vars.subject}</strong>: <strong>${vars.grade}</strong></p>`
        : `<h2>New Grade Posted</h2><p>Hi ${vars.name},</p><p>A new grade has been posted for <strong>${vars.subject}</strong>: <strong>${vars.grade}</strong></p>`;
    return baseTemplate(content, lang);
  },

  passwordChanged: (vars: TemplateVars, lang: 'ar' | 'en' = 'en') => {
    const content =
      lang === 'ar'
        ? `<h2>تم تغيير كلمة المرور</h2><p>مرحباً ${vars.name}،</p><p>تم تغيير كلمة المرور الخاصة بك بنجاح. إذا لم تقم بهذا التغيير، يرجى الاتصال بالدعم فوراً.</p>`
        : `<h2>Password Changed</h2><p>Hi ${vars.name},</p><p>Your password has been changed successfully. If you did not make this change, please contact support immediately.</p>`;
    return baseTemplate(content, lang);
  },
};
