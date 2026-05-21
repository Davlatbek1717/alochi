-- Migration 0074: Replace Telegram video storage with local web upload
-- Rename telegram_file_id to video_path (now stores a local filesystem path
-- instead of a Telegram file_id). Drop video_kind (was Telegram-specific:
-- 'video_note' | 'video'). All existing rows are left intact; the video_path
-- field will simply be null for any row that was previously cleared by the
-- 2-day prune job, which is the same semantics as before.

ALTER TABLE video_checkins RENAME COLUMN telegram_file_id TO video_path;

ALTER TABLE video_checkins DROP COLUMN IF EXISTS video_kind;
