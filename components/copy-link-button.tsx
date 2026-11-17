"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";

/** Copies the current room URL so it can be pasted into WhatsApp/Discord. */
export function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (insecure context); the URL bar still works.
    }
  }

  return (
    <button type="button" onClick={copy} className="btn-soft">
      {copied ? (
        <Check className="h-4 w-4 text-sage-ink" aria-hidden="true" />
      ) : (
        <Link2 className="h-4 w-4" aria-hidden="true" />
      )}
      {copied ? "Link copied" : "Copy invite link"}
    </button>
  );
}
