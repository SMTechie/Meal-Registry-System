"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { type AssistantImportState, importAssistantsFormAction } from "@/app/actions";
import { FormPendingOverlay } from "@/components/form-pending-overlay";
import { SubmitButton } from "@/components/submit-button";
import { AppIcon } from "@/components/app-icon";
import { useToast } from "@/components/toast-provider";
import { buttonVariants } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";

const initialState: AssistantImportState = {
  status: "idle",
  message: ""
};

export function ImportAssistantsForm({
  returnTo = "/assistants",
  inputId,
  templateHref
}: {
  returnTo?: string;
  inputId: string;
  templateHref: string;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const lastMessageRef = useRef<string>("");
  const [state, formAction, pending] = useActionState(importAssistantsFormAction, initialState);

  useEffect(() => {
    if (state.status === "idle" || !state.message) return;
    const messageKey = `${state.status}:${state.message}`;
    if (lastMessageRef.current === messageKey) return;

    lastMessageRef.current = messageKey;
    pushToast(state.message, state.status === "error" ? "error" : "success");

    if (state.status === "success") {
      formRef.current?.reset();
      router.refresh();
    }
  }, [pushToast, router, state.message, state.status]);

  return (
    <form ref={formRef} action={formAction} className="relative space-y-5">
      <FormPendingOverlay label="Importing assistants..." />
      <input type="hidden" name="returnTo" value={returnTo} />

      <div className="space-y-2">
        <Label htmlFor={inputId}>Excel or CSV file</Label>
        <Input
          id={inputId}
          name="assistantsFile"
          type="file"
          accept=".xlsx,.xls,.csv"
          required
          disabled={pending}
          className="h-auto rounded-xl py-3 file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
        <p className="font-medium text-slate-900">Accepted formats</p>
        <p className="mt-1">`.xlsx`, `.xls`, and `.csv` files are supported. The first worksheet is used during import.</p>
        <a className={`${buttonVariants({ variant: "outline" })} mt-3`} href={templateHref} download="assistant-import-template.csv">
          <AppIcon icon="solar:download-minimalistic-bold-duotone" className="size-4" />
          Download template
        </a>
      </div>

      <SubmitButton icon="solar:upload-bold-duotone" pendingLabel="Importing assistants..." disabled={pending}>
        Import assistants
      </SubmitButton>
    </form>
  );
}
