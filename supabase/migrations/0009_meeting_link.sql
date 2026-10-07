-- Optional meeting link (Zoom/Google Meet/Teams/etc.) pasted by the user
-- when scheduling a meeting, so it can be opened directly from the app.
alter table public.meetings add column meeting_link text;
