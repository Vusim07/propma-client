````markdown
# Multi-Tenancy Implementation Roadmap

**Goal**: Add team support while retaining solo agent functionality.

---

## Database Schema Updates

### New Tables

[ ] **Create `teams` table**

```sql
id UUID PRIMARY KEY,
name TEXT NOT NULL,
created_at TIMESTAMPTZ DEFAULT NOW(),
subscription_id UUID REFERENCES subscriptions(id),
plan_type TEXT CHECK (plan_type IN ('starter', 'growth', 'scale', 'enterprise')),
max_members INT
```
````

[ ] **Create `team_members` table**

```sql
user_id UUID REFERENCES users(id) ON DELETE CASCADE,
team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
role TEXT CHECK (role IN ('admin', 'member')),
joined_at TIMESTAMPTZ DEFAULT NOW(),
PRIMARY KEY (user_id, team_id)
```

[ ] **Create `team_invitations` table**

```sql
id UUID PRIMARY KEY,
team_id UUID REFERENCES teams(id),
email TEXT NOT NULL,
token TEXT UNIQUE,
expires_at TIMESTAMPTZ NOT NULL
```

### Modify Existing Tables

[ ] **Add columns to `users`**

```sql
ALTER TABLE users
ADD COLUMN active_team_id UUID REFERENCES teams(id),
ADD COLUMN is_individual BOOLEAN DEFAULT false;
```

[ ] **Add `team_id` to these tables**:

- `properties`
- `applications`
- `screening_reports`
- `email_workflows`
- `documents`

```sql
ALTER TABLE properties
ADD COLUMN team_id UUID REFERENCES teams(id);
```

[ ] **Update `subscriptions` table**

```sql
ALTER TABLE subscriptions
ADD COLUMN team_id UUID REFERENCES teams(id),
ADD COLUMN plan_type TEXT CHECK (plan_type IN ('starter', 'growth', 'scale', 'enterprise')),
ADD COLUMN is_team BOOLEAN DEFAULT false;
```

---

## Row-Level Security (RLS) Policies

### For Team-Scoped Tables (e.g., `properties`)

[ ] **Solo user access**

```sql
CREATE POLICY "Solo users access own data" ON properties
FOR SELECT USING (
  auth.uid() = user_id AND
  (SELECT is_individual FROM users WHERE id = auth.uid())
);
```

[ ] **Team member access**

```sql
CREATE POLICY "Team members access shared data" ON properties
FOR ALL USING (
  team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
);
```

### For `teams` Table

[ ] **Admin-only management**

```sql
CREATE POLICY "Only admins manage teams" ON teams
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = teams.id
    AND user_id = auth.uid()
    AND role = 'admin'
  )
);
```

---

## Authentication & Team Workflows

[ ] **Onboarding flow**

```// src/pages/auth/
   // src/components/layout
   // src/stores

```

- Add UI toggle: "Join as an individual" vs "Create team"
- Auto-create `team` record for team signups

[ ] **Invite system**

```typescript
// Example edge function for invites:
const { data, error } = await supabase.from('team_invitations').insert({
	team_id: teamId,
	email: 'user@example.com',
	token: crypto.randomUUID(),
	expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
});
```

[ ] **Team switching**

- Update `users.active_team_id` on switch
- Refresh JWT claims via `supabase.auth.refreshSession()`

---

## Subscription & Billing

[ ] **Link team plans**

```sql
UPDATE teams
SET subscription_id = 'sub_123', plan_type = 'growth', max_members = 5
WHERE id = 'team-uuid';
```

[ ] **Enforce team limits**

```typescript
// Block invites if team is full:
const { count } = await supabase
	.from('team_members')
	.select('*', { count: 'exact' })
	.eq('team_id', teamId);

if (count >= team.max_members) throw new Error('Team full');
```

[ ] **Proration logic**

- Use Paystack API to calculate upgrade costs
- Migrate individual user data to team on plan change

---

## UI/API Changes

[ ] **Team dashboard**

- Member list with role badges
- "Invite" button with email input
- Team usage stats (screenings/appointments)

[ ] **Resource ownership UI**

```tsx
// Show team/personal toggle:
<Button onClick={() => setScope(scope === 'team' ? 'personal' : 'team')}>
	Viewing: {scope}
</Button>
```

[ ] **Update all queries**

```typescript
// Replace:
const { data } = await supabase
	.from('properties')
	.select()
	.eq('user_id', userId);

// With:
const { data } = await supabase
	.from('properties')
	.select()
	.or(`user_id.eq.${userId},team_id.eq.${activeTeamId}`);
```

---

## Testing & Deployment

[ ] **Data migration script**

```sql
-- Backfill team_id for early adopters:
UPDATE properties
SET team_id = users.active_team_id
FROM users
WHERE properties.user_id = users.id;
```

[ ] **Edge case tests**

- Individual user tries to invite member → block
- Team admin downgrades plan → enforce member removal
- User in multiple teams → data isolation

[ ] **Documentation**

- Update API docs with `team_id` parameters
- Add "Team Guide" for admins

---

## Supabase Type Updates

```typescript
// database.types.ts adjustments:
export interface Database {
	public: {
		Tables: {
			teams: {
				Row: {
					id: string;
					name: string;
					created_at: string;
					subscription_id: string | null;
					plan_type: string;
					max_members: number;
				};
			};
			users: {
				Row: {
					// ...
					active_team_id?: string;
					is_individual: boolean;
				};
			};
			properties: {
				Row: {
					// ...
					team_id?: string;
				};
			};
		};
	};
}
```

````markdown
# Team Invitation Process Task List

**Scope**: Tasks to implement the team invitation flow (not covered in the original roadmap).

---

### **Backend Tasks**

[ ] **Create API endpoint/functions for sending invites**

- Accepts `email` and `team_id` (called by admins).
- Generates a token, saves to `team_invitations` table.

[ ] **Create API endpoint/functions for accepting invites**

- Validates the token, checks expiration, and links user to the team.

[ ] **Add RLS policies for `team_invitations` table**

```sql
-- Only admins can create invites:
CREATE POLICY "Admins create invites" ON team_invitations
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = team_invitations.team_id
    AND user_id = auth.uid()
    AND role = 'admin'
  )
);
```
````

[ ] **Add email validation logic**

- Ensure the user’s sign-up/login email matches the invited email.

[ ] **Add team membership checks**

- Block adding users already in the team.

---

### **Frontend Tasks**

[ ] **Build invite UI for team admins**

- Email input field + "Send Invite" button in the team dashboard.

[ ] **Build invite acceptance page**

- Page at `/join-team?token=...` that handles token validation.
- Show loading/error states (e.g., "Invalid token").

[ ] **Add notifications**

- Success: "You’ve joined Team XYZ!"
- Errors: "Invite expired" or "Team is full."

---

### **Email Service Tasks**

[ ] **Design invitation email template**

- Includes dynamic link: `https://app.com/join-team?token={token}`.

[ ] **Integrate with email provider**

- Use Supabase Edge Functions + Resend to send emails.

[ ] **Add email security checks**

- Prevent token leakage in logs/URLs.

---

### **Security & Testing**

[ ] **Add token expiration cleanup job**

- Daily cron job to delete expired invitations.

[ ] **Test edge cases**:

- User tries to accept an expired token.
- User signs up with a different email than the invited one.
- Team is already at max members.

[ ] **Audit RLS policies**

- Ensure non-admins can’t read/write `team_invitations`.

---

### **Documentation**

[ ] **Update API docs** with `/invite` and `/join-team` endpoints.  
[ ] **Write user guide** for admins: "How to invite team members."

```

```
