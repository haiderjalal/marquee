# Venue photos

Each venue can have photos in the `venue_photo` table (migration `0003_venue_photos.sql`).
A photo reaches the public site only while its `status` is `approved`. Pending and withdrawn
photos are never returned by the API. The database allows at most one approved photo per venue.

The demonstration photos for Marquee A and Marquee B are seeded as `pending`, so they stay hidden
until someone approves them.

## Approving a photo (until staff screens exist)

1. In the Supabase dashboard, open **Table Editor** and select `venue_photo`.
2. Find the row for the venue and check its `url` and `alt` text.
3. If another photo is already approved for that venue, set that one to `pending` first. The
   database refuses two approved photos for the same venue.
4. Set `status` to `approved`.
5. Check `/api/v1/public/venues`. The venue's `photo` field should now hold the URL.

To hide a photo again, set its `status` to `pending` or `withdrawn`.

## Storage and rights

- The `marquee-photos` bucket is **public**. This is a recorded decision. Anyone who has a file's
  link can open it, including photos that are still pending. Use file names that cannot be guessed,
  and do not upload images you would not want to see published.
- Upload only photos you own or have a licence to use. Do not upload watermarked previews.
- The public page does not say whether a photo is illustrative. Put that in the `alt` text, for
  example "Illustrative hall photograph".

## Not built yet

- Staff upload and approval screens. An upload button needs the Supabase service-role key on the
  API, which needs your approval.
- Photos in the configurator steps. Those steps still show labelled placeholders.
