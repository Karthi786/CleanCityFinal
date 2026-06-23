-- ============================================================
-- Chat Module Migration — MakkalKural
-- Run this ONCE in your Supabase SQL Editor before using chat.
-- Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================================

-- Step 1: Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  receiver_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  conversation_id TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Step 2: Indexes for fast conversation lookup
CREATE INDEX IF NOT EXISTS messages_conversation_id_idx
  ON public.messages(conversation_id, created_at);

CREATE INDEX IF NOT EXISTS messages_receiver_unread_idx
  ON public.messages(receiver_id, is_read)
  WHERE is_read = FALSE;

-- Step 3: Enable Row Level Security
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Step 4: RLS Policies — users can only access their own messages
CREATE POLICY "chat_select_own_messages" ON public.messages
  FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

CREATE POLICY "chat_insert_as_sender" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
  );

CREATE POLICY "chat_update_read_status" ON public.messages
  FOR UPDATE USING (
    auth.uid() = receiver_id
  );

-- ============================================================
-- Done! Chat tables are ready. MLA, Collector, and Departments
-- can now send and receive messages.
-- ============================================================
