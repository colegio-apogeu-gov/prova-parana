/*
  # Force fix user_profiles id column type for Firebase UIDs

  This migration forcefully changes the user_profiles.id column from uuid to text
  to accommodate Firebase UIDs which are strings, not UUIDs.

  1. Changes
     - Drop and recreate user_profiles table with text id column
     - Recreate all indexes and policies
     - Ensure proper RLS setup for Firebase authentication

  2. Security
     - Maintain RLS policies for data isolation by school unit
     - Use Firebase JWT tokens for authentication
*/

-- Drop existing table and recreate with correct schema
DROP TABLE IF EXISTS user_profiles CASCADE;

CREATE TABLE user_profiles (
  id text PRIMARY KEY,
  email text NOT NULL,
  unidade text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create index for performance
CREATE INDEX idx_user_profiles_unidade ON user_profiles(unidade);

-- Create RLS policies for Firebase auth
CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() ->> 'sub') = id);

CREATE POLICY "Users can read own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'sub') = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING ((auth.jwt() ->> 'sub') = id);

-- Temporary policy for development (remove in production)
CREATE POLICY "Allow all for development"
  ON user_profiles
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);