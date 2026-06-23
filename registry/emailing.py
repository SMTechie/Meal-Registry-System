from io import BytesIO

import qrcode
from django.core.mail import EmailMultiAlternatives, get_connection
from django.template.loader import render_to_string

from .models import EmailConfiguration


def qr_png_bytes(value):
    image = qrcode.make(value)
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def email_connection(config):
    if config.auth_mode == EmailConfiguration.AuthMode.SMTP and config.smtp_host:
        return get_connection(
            host=config.smtp_host,
            port=config.smtp_port,
            username=config.smtp_username,
            password=config.smtp_password,
            use_tls=config.smtp_use_tls,
        )
    return get_connection()


def send_user_qr_email(user):
    config = EmailConfiguration.singleton()
    subject = "Your meal access QR code"
    code = str(user.qr_access_code)
    html = render_to_string("registry/email_qr.html", {"user": user, "code": code})
    text = (
        f"Hello {user.get_full_name() or user.username},\n\n"
        f"Your meal access QR code is attached. Access code: {code}\n\n"
        "Powered By Pop In Solutions - https://popinsolutions.co.za"
    )
    message = EmailMultiAlternatives(
        subject=subject,
        body=text,
        from_email=config.from_email,
        to=[user.email],
        connection=email_connection(config),
    )
    message.attach_alternative(html, "text/html")
    message.attach("meal-access-qr.png", qr_png_bytes(code), "image/png")
    message.send()
