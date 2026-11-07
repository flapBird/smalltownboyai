ALTER TABLE `video_tasks` ADD `template_id` text;--> statement-breakpoint
ALTER TABLE `video_tasks` ADD `template_version` integer;
--> statement-breakpoint
UPDATE credit_packages SET cents=490,credits=100 WHERE id='lite';
--> statement-breakpoint
UPDATE credit_packages SET cents=1290,credits=300 WHERE id='standard';
--> statement-breakpoint
UPDATE credit_packages SET cents=2490,credits=600 WHERE id='pro';
