-- Enable RLS on the subscriptions table
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Allow users to view their own subscriptions
CREATE POLICY "Allow user to view own subscriptions"
ON public.subscriptions
FOR SELECT
USING (user_id = auth.uid());

-- Policy: Allow users to update their own subscriptions
CREATE POLICY "Allow user to update own subscriptions"
ON public.subscriptions
FOR UPDATE
USING (user_id = auth.uid());

-- Policy: Allow users to delete their own subscriptions (if needed)
CREATE POLICY "Allow user to delete own subscriptions"
ON public.subscriptions
FOR DELETE
USING (user_id = auth.uid());
