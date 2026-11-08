CREATE INDEX `moderation_created` ON `moderation_checks` (`created_at`);--> statement-breakpoint
CREATE INDEX `moderation_owner_created` ON `moderation_checks` (`owner`,`created_at`);--> statement-breakpoint
CREATE INDEX `moderation_due` ON `moderation_checks` (`state`,`next_at`);--> statement-breakpoint
CREATE INDEX `moderation_asset` ON `moderation_checks` (`asset_key`,`policy`);