-- 1. Add receipt_url column to transactions
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'receipt_url') THEN
        ALTER TABLE public.transactions ADD COLUMN receipt_url text;
    END IF;
END $$;

-- 2. Create 'receipts' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Policy: Allow authenticated users to upload to 'receipts' bucket
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'receipts' );

-- 4. Policy: Allow public to view receipts (since bucket is public)
-- (Supabase handles public bucket reading automatically, but if RLS is enforced on objects:)
CREATE POLICY "Allow public viewing"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'receipts' );
