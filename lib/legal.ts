export const LEGAL_UPDATED_AT = "2026-11-08";

export const LEGAL: Record<
  string,
  { title: string; intro: string; sections: [string, string][] }
> = {
  privacy: {
    title: "Privacy Policy",
    intro:
      "This policy explains how Smalltown Boy AI handles account information, uploaded content, generated videos and service records. Contact support@smalltownboyai.one with privacy questions or deletion requests.",
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
        "Safety checks",
        "For live generation, SeeAPI receives the generation prompt, both reference photos, the template video and the generated video for automated content checks. Video checks sample visual frames; they do not check audio or every frame and cannot guarantee safety. Results remain private until automated checks and our output review pass. SeeAPI states that stored files, task information and moderation results have no scheduled automatic expiry; request logs are retained for 60 days. Expiring our links does not delete provider copies. Contact support@smalltownboyai.one for a deletion request, including the relevant task ID. Local demo mode does not submit media to SeeAPI.",
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
        "Session cookies support authentication. On our production site at https://smalltownboyai.one, Google Analytics 4 measures site visits and interactions, and Microsoft Clarity provides interaction analytics and session recordings to help improve usability. These services may use cookies and process device, browser and usage information under their own privacy policies. Analytics do not load during local development, local production previews or visits on other domains. You can use browser tracking controls and clear browser site data to remove cookies, local session and draft information. Accounting and audit records may need retention when required by applicable law.",
      ],
      [
        "Safety investigations and account restrictions",
        "We use relevant account, task, payment and moderation records to investigate suspected misuse, protect users and rights holders, prevent fraud, and review appeals. Authorized reviewers may inspect reported or flagged content. Suspending or closing an account does not automatically erase these records. We limit retained information to what is needed for the investigation, security, payment reconciliation or applicable legal obligations, and review deletion requests individually. We do not publish investigation records or use them as public examples.",
      ],
      [
        "Requests and account closure",
        "You may ask to access or correct your account information, close your account, or delete associated content by emailing support@smalltownboyai.one. We may need to verify that the account belongs to you. We will explain any records that must be retained and coordinate applicable provider deletion requests; deleting an account or a source link does not automatically delete copies already retrieved by a provider. Credit and refund treatment on closure is described in the Terms of Service and Refund Policy.",
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
      "These terms govern your use of Smalltown Boy AI. By using the service, you agree to these terms and the Acceptable Use Policy. Paid checkout and live generation are available only when enabled on the site; local demo transactions are not real purchases.",
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
        "Credit packs are one-time purchases. Credits do not expire through the passage of time and balances accumulate. Access to credits can be restricted during a violation investigation; the account-termination rules below explain how remaining credits are handled. Resolution access comes from your highest eligible purchase and can change after refunds or chargebacks. No free full video generation is offered to new accounts. Local demo credits and complimentary administrator grants are not purchases and have no cash-refund value.",
      ],
      [
        "Your responsibilities and breaches",
        "You are responsible for the content you submit, having the necessary rights and permissions, and how you use or share generated results. Uploading unauthorized material, real people, prohibited or illegal content, or using the service for fraud, abuse or other prohibited activity breaches these terms. Attempts to evade safety checks, misuse payment or refund systems, or interfere with the service are also breaches. You must stop the offending activity and cooperate with reasonable requests to resolve it. You may be responsible for loss or third-party claims caused by your unlawful conduct or breach to the extent established under applicable law; this does not exclude our own responsibilities or your mandatory consumer rights.",
      ],
      [
        "Warnings, restrictions and termination",
        "Depending on the nature, severity and repetition of a breach, we may issue a warning, reject or cancel a request, withhold or remove access to content, delete violating content, temporarily restrict generation or credit use, suspend service access, or terminate an account. Serious or urgent concerns involving safety, exploitation, fraud or legal obligations may require immediate action without advance notice. Where reasonably possible and lawful, we will explain the reason, scope and next steps through your account email or a support response. Automated flags may lead to a hold for human review; a technical detection failure alone is not a finding that you violated these terms.",
      ],
      [
        "Credits and payments after suspension or termination",
        "A temporary restriction holds access to credits while the issue is reviewed; it does not by itself deduct or forfeit the balance. If the restriction is lifted, remaining eligible credits become usable again. When an account is closed or terminated, new generation stops and we review outstanding tasks, unused purchased credits and any eligible refund request under the Refund Policy. Confirmed failed or rejected tasks release their reserved credits once; tasks with an uncertain outcome remain pending reconciliation. Credits for already completed and delivered services remain consumed unless a refund is approved or required by law. We do not automatically confiscate all unused purchased credits as a penalty for termination. A completed payment refund reverses the corresponding credit grant, including credits already spent, and may leave a negative balance requiring resolution. Local demo credits have no cash or refund value. Any payment refund is handled through Waffo, subject to applicable consumer rights.",
      ],
      [
        "Appeals and voluntary closure",
        "To dispute a restriction or termination, or request account closure, email support@smalltownboyai.one with your account email, relevant task or order IDs and a brief explanation. Do not attach prohibited material or payment-card details. We will review the available records and explain the outcome and any credit or refund adjustment. If a decision is reversed, we will restore eligible access and remaining credits where possible; content already deleted may not be recoverable. Do not create replacement accounts to evade a restriction. Data handling after closure is described in the Privacy Policy.",
      ],
      [
        "AI and music",
        "Concept images are AI-generated. The model integration uses WaveSpeed’s MiniMax H3 Video Edit, subject to live validation. Results preserve cleared template audio; no separate music rights are granted. This independent project is not affiliated with the original song or its artists.",
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
        "Suspended or closed accounts",
        "Account suspension or termination does not automatically forfeit unused purchased credits or remove rights to request a refund. Contact support with your order ID so we can review unused credits and outstanding tasks. A temporary credit-use restriction is not a deduction. Confirmed failed or rejected tasks release reserved credits once; uncertain tasks require reconciliation. Local demo credits are not refundable, and completed services are reviewed separately from unused credits. Any applicable mandatory refund rights remain unaffected.",
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
        "Live input images require approval before submission. Generated output is held for review before being released. For violations, we may warn you, reject or cancel requests, withhold or delete violating content, temporarily restrict credit use, suspend service access, or terminate the account according to the Terms of Service. An investigation hold does not automatically deduct credits; remaining purchased credits and refund requests are handled under the Terms of Service and Refund Policy. You may appeal to support@smalltownboyai.one. Automated checks can be wrong, and unavailable checks do not by themselves establish a violation. The local preview bypasses content review only for isolated test workflows, and must never be deployed as a public service.",
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
        "Account sign-in is available. Payment and generation availability is shown in the product; local demo transactions are not real payments. Use this support address for account restrictions, appeals, credit questions, privacy requests and content reports.",
      ],
    ],
  },
};
