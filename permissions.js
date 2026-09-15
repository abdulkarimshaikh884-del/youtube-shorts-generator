/* Who may do what in the admin console.

   There are two kinds of people with admin access:

   - The owner (role super_admin). Holds every permission, and is the only
     account that can appoint staff, change their permissions, or toggle
     feature flags. Those two powers are deliberately not in PERMISSIONS, so
     they cannot be handed out even by mistake.
   - Staff (role moderator). Holds exactly the permissions stored on their
     row in users.staff_permissions, and nothing else.

   Every admin check on the server goes through `can` or `isOwner`. A role
   string compared anywhere else is how one route ends up stricter or looser
   than its neighbour. */

const PERMISSIONS = [
  { key: "overview.view", label: "See the overview", hint: "Totals for users, templates, exports and open tickets." },
  { key: "templates.moderate", label: "Moderate templates", hint: "Publish, reject or archive creator templates." },
  { key: "tutorials.moderate", label: "Moderate tutorials", hint: "Take down or restore shared tutorial videos." },
  { key: "comments.moderate", label: "Remove comments", hint: "Remove other people's comments on templates." },
  { key: "support.reply", label: "Answer feedback and support", hint: "Read feedback and support messages, reply and close them." },
  { key: "users.view", label: "See the account list", hint: "Names, handles and plans. Email addresses stay hidden." }
];
const KEYS = new Set(PERMISSIONS.map((p) => p.key));

function isOwner(user) {
  return Boolean(user && user.role === "super_admin");
}

/* Permissions exactly as stored, filtered to known keys. Accepts either a
   database row (staff_permissions) or a public user (permissions). */
function storedPermissions(user) {
  const raw = user && (user.staff_permissions || user.staffPermissions);
  return Array.isArray(raw) ? raw.filter((k) => KEYS.has(k)) : [];
}

function permissionsOf(user) {
  if (!user) return [];
  if (isOwner(user)) return PERMISSIONS.map((p) => p.key);
  if (user.role !== "moderator" && user.role !== "admin") return [];
  return storedPermissions(user);
}

function can(user, permission) {
  if (!user || !KEYS.has(permission)) return false;
  return permissionsOf(user).includes(permission);
}

/* Anyone who should see the admin console at all. */
function isStaff(user) {
  return isOwner(user) || permissionsOf(user).length > 0;
}

/* Cleans a requested permission list: unknown keys dropped, duplicates
   removed, order fixed so the stored value is stable. */
function normalise(list) {
  const wanted = new Set(Array.isArray(list) ? list.map(String) : []);
  return PERMISSIONS.map((p) => p.key).filter((k) => wanted.has(k));
}

module.exports = { PERMISSIONS, can, isOwner, isStaff, permissionsOf, normalise };
