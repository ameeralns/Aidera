-- Policies for profiles table
create policy "Allow users to read basic profile information of users in their organization"
  on public.profiles
  for select
  using (
    exists (
      select 1 
      from public.profiles as viewer_profile
      where viewer_profile.id = auth.uid()
      and viewer_profile.organization_id = profiles.organization_id
    )
  );

-- Policy for users to update their own profile
create policy "Users can update their own profile"
  on public.profiles
  for update
  using (auth.uid() = id);

-- Policy for users to read their own complete profile
create policy "Users can read their own complete profile"
  on public.profiles
  for select
  using (auth.uid() = id); 