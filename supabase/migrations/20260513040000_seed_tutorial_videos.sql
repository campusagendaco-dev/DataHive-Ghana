-- SEED TUTORIAL VIDEOS
-- Pre-configures high-quality tech/business explainer videos from Google's public media
-- so that the Welcome Guide Tutorial functions beautifully right out of the box.

UPDATE public.system_settings
SET 
  tutorial_buy_video_url = 'https://www.youtube.com/watch?v=325sYiZ80Uo', -- Material Design 3 / Interface Promo (Futuristic UI)
  tutorial_agent_video_url = 'https://www.youtube.com/watch?v=bE31y5HbukA', -- Google Workspace / Tech Business Productivity Promo
  tutorial_subagent_video_url = 'https://www.youtube.com/watch?v=ScMzIvxBSi4' -- Google Retail / Network Connectivity Promo
WHERE id = 1;
