ALTER TABLE `devices` ADD `actual` text;
--> statement-breakpoint
UPDATE `devices` SET `actual` = json_object('status', `status`, 'configuration', json(`configuration`));
--> statement-breakpoint
ALTER TABLE `devices` DROP COLUMN `status`;
--> statement-breakpoint
ALTER TABLE `devices` DROP COLUMN `configuration`;
