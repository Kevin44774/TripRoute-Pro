CREATE TABLE `drivers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`license_number` text NOT NULL,
	`current_cycle_hours` real DEFAULT 0,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `drivers_license_number_unique` ON `drivers` (`license_number`);--> statement-breakpoint
CREATE TABLE `eld_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`driver_id` text NOT NULL,
	`trip_id` text,
	`log_date` text NOT NULL,
	`total_miles` real DEFAULT 0,
	`driving_time` integer DEFAULT 0,
	`on_duty_time` integer DEFAULT 0,
	`off_duty_time` integer DEFAULT 0,
	`sleeper_berth_time` integer DEFAULT 0,
	`time_entries` text NOT NULL,
	`remarks` text,
	`is_compliant` integer DEFAULT true,
	`co_driver_name` text,
	`carrier_name` text DEFAULT '' NOT NULL,
	`dot_number` text,
	`time_zone` text DEFAULT 'America/New_York' NOT NULL,
	`truck_number` text,
	`trailer_numbers` text,
	`shipping_doc_numbers` text,
	`main_office_address` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hos_violations` (
	`id` text PRIMARY KEY NOT NULL,
	`driver_id` text NOT NULL,
	`trip_id` text,
	`violation_type` text NOT NULL,
	`description` text NOT NULL,
	`severity` text DEFAULT 'warning',
	`timestamp` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`resolved` integer DEFAULT false
);
--> statement-breakpoint
CREATE TABLE `trips` (
	`id` text PRIMARY KEY NOT NULL,
	`driver_id` text NOT NULL,
	`current_location` text NOT NULL,
	`pickup_location` text NOT NULL,
	`dropoff_location` text NOT NULL,
	`estimated_weight` integer DEFAULT 80000,
	`total_distance` real,
	`estimated_duration` integer,
	`route_data` text,
	`status` text DEFAULT 'planned',
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
