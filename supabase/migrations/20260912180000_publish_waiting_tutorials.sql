-- Tutorials are not reviewed before publication any more; they go live when a
-- creator shares them. That left the rows submitted under the old rule stuck
-- in a queue nobody is going to work through: invisible to the public, and,
-- now that the community page no longer prints a status list, invisible to
-- their author too.
--
-- Only 'pending' moves. A 'rejected' row was rejected by a person who looked
-- at it, and that decision stands.
update public.creator_skills
   set status = 'published',
       updated_at = now()
 where status = 'pending';
