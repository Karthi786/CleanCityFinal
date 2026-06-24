-- Migration to add independent approval tracking for Commissioner and Collector

ALTER TABLE public.campaigns 
ADD COLUMN IF NOT EXISTS collector_approved BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS commissioner_approved BOOLEAN DEFAULT false;

-- Keep existing verification_status but it will now mean:
-- 'pending' -> waiting for one or both
-- 'approved' -> both collector and commissioner approved
-- 'rejected' -> either one rejected

-- Update existing campaigns that are already 'approved' to have both flags set
UPDATE public.campaigns 
SET collector_approved = true, commissioner_approved = true
WHERE verification_status = 'approved';

-- Update existing campaigns that are 'pending_mla' to have collector_approved = true
UPDATE public.campaigns 
SET collector_approved = true, verification_status = 'pending'
WHERE verification_status = 'pending_mla';

-- Update existing campaigns that are 'pending_collector' to 'pending'
UPDATE public.campaigns 
SET verification_status = 'pending'
WHERE verification_status = 'pending_collector';
