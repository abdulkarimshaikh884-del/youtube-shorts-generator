-- Authentication depends on one password hash per normalized email address.
-- The application lowercases email before insert, and this database index is
-- the final guard against two simultaneous signup requests creating two users.
create unique index if not exists users_email_lower_unique
  on public.users (lower(email));
