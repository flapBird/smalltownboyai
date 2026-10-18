export const LEGAL: Record<
  string,
  { title: string; intro: string; sections: [string, string][] }
> = {
  privacy: {
    title: "Privacy Policy",
    intro:
      "This preview explains how Smalltown Boy AI is designed to handle your information. Contact support@smalltownboyai.one with privacy questions or deletion requests.",
    sections: [
      [
        "Account information",
        "Google sign-in provides your name, email address and profile image. We store session information to keep you signed in. Local demo accounts are separate test identities and do not connect to Google.",
      ],
      [
        "Photos and videos",
        "Uploaded photos are stored in a private Cloudflare R2 bucket. Authorized requests and short-lived signed links provide access. WaveSpeed receives the images and a licensed reference clip when live generation is enabled. The current local preview does not send your photos to WaveSpeed.",
      ],
      [
        "Storage and deletion",
        "Unattached uploads are eligible for cleanup after 24 hours by the scheduled worker. Photos attached to tasks are retained with those tasks. You can delete completed videos; contact support to remove associated source photos or your account. Browser drafts are stored locally to restore uploads after sign-in; removing a photo clears its draft.",
      ],
      [
        "Payments and providers",
        "Waffo processes payments when enabled. We store order references, amounts, credit records and status, not card numbers. Cloudflare hosts the application and its storage. Google provides optional authentication. Provider processing and retention are subject to their own terms.",
      ],
      [
        "Cookies and your choices",
        "Session cookies support authentication. We do not currently install advertising or analytics trackers. You can sign out or clear browser site data to remove local session and draft information. Accounting and audit records may need retention when required by applicable law.",
      ],
      [
        "Preview status",
        "The operator’s legal identity, contact jurisdiction and applicable retention obligations must be finalized before commercial launch. No business entity or postal address is claimed by this preview.",
      ],
    ],
  },
  terms: {
    title: "Terms of Service",
    intro:
      "Smalltown Boy AI is currently a product preview. Live paid video generation is not yet available. These terms describe the intended service and current preview limitations.",
    sections: [
      [
        "The service",
        "The service focuses on AI animation of pets and fictional nonhuman characters. Results can vary in appearance, motion and consistency. No promise of virality, exact identity matching or a fixed turnaround time is made.",
      ],
      [
        "Your content",
        "You must own or have permission to upload all source content and grant permission to process it for your requested generation. Do not upload real people, confidential information or prohibited content. See the Acceptable Use Policy.",
      ],
      [
        "Credits",
        "Planned packs are one-time purchases. Credits do not expire and balances accumulate. Resolution access comes from your highest eligible purchase and can change after refunds or chargebacks. No free full video generation is offered. Local test credits have no monetary value.",
      ],
      [
        "AI and music",
        "Concept images are AI-generated. The planned base model is WaveSpeed’s Seedance 2.5 Video Edit, subject to validation. Music rights are not included. This independent project is not affiliated with the original song or its artists.",
      ],
      [
        "Availability and launch",
        "Model capabilities, merchant approval and licensed references remain prerequisites for commercial launch. Uncertain tasks may be held for reconciliation. Mandatory consumer rights are not excluded. Contact support@smalltownboyai.one for service issues.",
      ],
    ],
  },
  "refund-policy": {
    title: "Refund Policy",
    intro:
      "There are no real charges in the current local preview. The following process applies once paid checkout has been enabled and approved.",
    sections: [
      [
        "Request help",
        "Email support@smalltownboyai.one with your account email, order ID and issue. Do not send card numbers. We review unused-credit and service-error requests individually, subject to applicable consumer rights.",
      ],
      [
        "Failed generations",
        "Credits reserved for a confirmed failed task are released once. A task with an uncertain provider outcome is reviewed before settlement to avoid repeated paid calls or conflicting refunds.",
      ],
      [
        "Refund processing",
        "Approved payment refunds are processed through Waffo. A successful refund revokes the corresponding credit grant and recalculates resolution access. If credits were already spent, the balance can become negative and new generation remains blocked until resolved.",
      ],
      [
        "Exceptions requiring review",
        "Partial refunds and disputes require manual reconciliation before account changes. A refund request or a checkout redirect is not proof of a completed refund. Nothing here limits rights that cannot legally be waived.",
      ],
    ],
  },
  "acceptable-use": {
    title: "Acceptable Use Policy",
    intro:
      "Make something playful, with permission. This first version is exclusively for pets and fictional nonhuman characters.",
    sections: [
      [
        "Allowed content",
        "Use pet photographs and fictional characters you have rights to use. Keep content nonsexual, nonviolent and suitable for a general audience. Clearly identify shared output as AI-generated.",
      ],
      [
        "Prohibited content",
        "Do not submit real people, face swaps, public figures, impersonations, sexual content, exploitation, abuse, graphic violence, hateful material, fraud, illegal content or content that infringes someone else’s privacy or intellectual property.",
      ],
      [
        "Review and enforcement",
        "Live input images require approval before submission. Generated output is held for review before being released. We may reject requests and restrict access for violations. The local preview bypasses content review only for isolated test workflows, and must never be deployed as a public service.",
      ],
      [
        "Report content",
        "Report concerns to support@smalltownboyai.one with the task or page ID, a description of the issue and the rights involved. Avoid attaching sensitive or illegal material. We can investigate and restrict access while reviewing the report.",
      ],
    ],
  },
  contact: {
    title: "Let’s talk.",
    intro:
      "Questions, a video that missed a beat, or a content concern? Reach us at support@smalltownboyai.one.",
    sections: [
      [
        "Product support",
        "Include your task ID or order ID and a short description of what happened. Never include passwords, API keys or payment card details.",
      ],
      [
        "Content reports and rights",
        "For a content report or rights concern, provide the relevant task or page ID, your contact details and a description of the issue. Use the subject “Content report” so we can identify your request.",
      ],
      [
        "Current availability",
        "This site is in local preview. Live payments and AI generation are not enabled. The support address is configured throughout the product; mailbox delivery must be verified by the operator before launch.",
      ],
    ],
  },
};
