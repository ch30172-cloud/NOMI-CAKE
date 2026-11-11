"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/admin/action-result";

type Action = (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;

/**
 * Thin wrapper around useActionState: runs a server action from a plain <form>,
 * toasts the result and exposes field errors to children via a render prop.
 */
export function ActionForm({
  action,
  className,
  children,
  successMessage,
  resetOnSuccess,
}: {
  action: Action;
  className?: string;
  children: (state: ActionResult | null) => React.ReactNode;
  successMessage?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(state.message ?? successMessage ?? "✓");
    else toast.error(state.error);
  }, [state, successMessage]);
  return (
    <form
      action={formAction}
      className={className}
      key={resetOnSuccess && state?.ok ? String(Date.now()) : undefined}
    >
      {children(state)}
    </form>
  );
}
