"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { AppIcon } from "@/components/app-icon";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

type AssistantQrTagProps = {
  displayName: string;
  persalNumber: string;
  qrAccessCode: string;
  isActive: boolean;
  downloadFilename: string;
  orgName?: string;
};

function printTagHtml({
  displayName,
  persalNumber,
  qrDataUrl,
  isActive,
  orgName
}: {
  displayName: string;
  persalNumber: string;
  qrDataUrl: string;
  isActive: boolean;
  orgName?: string;
}) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Assistant Tag</title>
    <style>
      body {
        font-family: Inter, Arial, sans-serif;
        margin: 0;
        padding: 24px;
        background: #ffffff;
        color: #0f172a;
      }
      .tag {
        max-width: 420px;
        margin: 0 auto;
        border: 1px solid #cbd5e1;
        border-radius: 24px;
        padding: 28px;
        text-align: center;
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
      }
      .heading {
        margin-bottom: 20px;
        padding: 16px;
        border-radius: 14px;
        background: #020617;
        color: #ffffff;
      }
      .heading p {
        margin: 0;
        font-size: 12px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        opacity: 0.7;
      }
      .heading h1 {
        margin: 6px 0 0;
        font-size: 28px;
      }
      img {
        width: 280px;
        height: 280px;
        padding: 12px;
        border: 1px solid #cbd5e1;
        border-radius: 16px;
        background: #ffffff;
      }
      h2 {
        margin: 20px 0 8px;
        font-size: 34px;
      }
      .meta {
        margin: 0;
        color: #475569;
      }
      .status {
        display: inline-block;
        margin-top: 16px;
        padding: 8px 14px;
        border-radius: 12px;
        border: 1px solid ${isActive ? "#a7f3d0" : "#fecaca"};
        background: ${isActive ? "#ecfdf5" : "#fef2f2"};
        color: ${isActive ? "#047857" : "#b91c1c"};
        font-size: 14px;
        font-weight: 600;
      }
    </style>
  </head>
  <body>
    <div class="tag">
      <div class="heading">
        <p>${orgName || "Meal Registry System"}</p>
        <h1>Marking Assistant</h1>
      </div>
      <img src="${qrDataUrl}" alt="QR code for ${displayName}" />
      <h2>${displayName}</h2>
      <p class="meta">Persal ${persalNumber}</p>
      <div class="status">${isActive ? "Active meal access" : "Disabled"}</div>
    </div>
    <script>
      window.onload = () => {
        window.print();
        window.setTimeout(() => window.close(), 200);
      };
    </script>
  </body>
</html>`;
}

export function AssistantQrTag({ displayName, persalNumber, qrAccessCode, isActive, downloadFilename, orgName }: AssistantQrTagProps) {
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    let cancelled = false;

    QRCode.toDataURL(qrAccessCode, {
      width: 560,
      margin: 2,
      color: { dark: "#111827", light: "#ffffff" }
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl("");
      });

    return () => {
      cancelled = true;
    };
  }, [qrAccessCode]);

  function handlePrint() {
    if (!qrDataUrl) return;
    const popup = window.open("", "_blank", "width=900,height=900");
    if (!popup) return;
    popup.document.open();
    popup.document.write(
      printTagHtml({
        displayName,
        persalNumber,
        qrDataUrl,
        isActive,
        orgName
      })
    );
    popup.document.close();
  }

  const downloadHref = qrDataUrl || "#";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 print:hidden">
        <a className={buttonVariants({ variant: "outline" })} href={downloadHref} download={downloadFilename} aria-disabled={!qrDataUrl}>
          <AppIcon icon="solar:download-minimalistic-bold" className="size-4" />
          Download QR
        </a>
        <button className={buttonVariants({ variant: "default" })} type="button" onClick={handlePrint} disabled={!qrDataUrl}>
          <AppIcon icon="solar:printer-bold-duotone" className="size-4" />
          Print tag
        </button>
      </div>
      <div className="mx-auto max-w-md rounded-2xl border border-slate-300 bg-white p-7 text-center shadow-sm print:border-0 print:shadow-none">
        {orgName ? (
          <div className="mb-5 rounded-lg bg-slate-950 px-5 py-4 text-white">
            <p className="text-xs uppercase tracking-wide text-white/65">{orgName}</p>
            <h2 className="mt-1 text-2xl font-semibold">Marking Assistant</h2>
          </div>
        ) : null}
        <div className="mx-auto grid size-[280px] place-items-center rounded-lg border bg-white p-3">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt={`QR code for ${displayName}`} width={280} height={280} className="size-[248px] object-contain" />
          ) : (
            <div className="text-sm text-muted-foreground">Generating QR code...</div>
          )}
        </div>
        <h3 className="mt-5 text-2xl font-semibold">{displayName}</h3>
        <p className="text-sm text-muted-foreground">Persal {persalNumber}</p>
        <Badge tone={isActive ? "good" : "danger"} className="mt-4">
          {isActive ? "Active meal access" : "Disabled"}
        </Badge>
      </div>
    </div>
  );
}
