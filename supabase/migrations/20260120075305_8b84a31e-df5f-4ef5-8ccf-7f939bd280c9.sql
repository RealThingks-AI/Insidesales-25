-- Add last_ping column to keep_alive table for tracking keep-alive pings
ALTER TABLE public.keep_alive 
ADD COLUMN IF NOT EXISTS last_ping TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Insert initial record if it doesn't exist
INSERT INTO public.keep_alive (id, "Able to read DB", last_ping)
VALUES (1, 'Yes', now())
ON CONFLICT (id) DO UPDATE SET last_ping = now();