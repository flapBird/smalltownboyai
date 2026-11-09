ALTER TABLE video_tasks ADD COLUMN subject_mode text NOT NULL DEFAULT 'pet' CHECK (subject_mode IN ('human','pet'));
