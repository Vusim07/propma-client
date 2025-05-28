# Multi-Tenancy Implementation Roadmap

**Goal**: Add team support while retaining solo agent functionality.

---

## Database Schema Updates

### New Tables

[x] **Create `teams` table**

```sql
id UUID PRIMARY KEY,
name TEXT NOT NULL,
created_at TIMESTAMPTZ DEFAULT NOW(),
subscription_id UUID REFERENCES subscriptions(id),
plan_type TEXT CHECK (plan_type IN ('starter', 'growth', 'scale', 'enterprise')),
max_members INT
```

[x] **Create `team_members` table**

```sql
user_id UUID REFERENCES users(id) ON DELETE CASCADE,
team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
role TEXT CHECK (role IN ('admin', 'member')),
joined_at TIMESTAMPTZ DEFAULT NOW(),
PRIMARY KEY (user_id, team_id)
```

[x] **Create `team_invitations` table**

```sql
id UUID PRIMARY KEY,
team_id UUID REFERENCES teams(id),
email TEXT NOT NULL,
token TEXT UNIQUE,
expires_at TIMESTAMPTZ NOT NULL
```

### Modify Existing Tables

[x] **Add columns to `users`**

```sql
ALTER TABLE users
ADD COLUMN active_team_id UUID REFERENCES teams(id),
ADD COLUMN is_individual BOOLEAN DEFAULT false;
```

[x] **Add `team_id` to these tables**:

- `properties`
- `applications`
- `screening_reports`
- `email_workflows`
- `documents`

```sql
ALTER TABLE properties
ADD COLUMN team_id UUID REFERENCES teams(id);
```

[x] **Update `subscriptions` table**

```sql
ALTER TABLE subscriptions
ADD COLUMN team_id UUID REFERENCES teams(id),
ADD COLUMN plan_type TEXT CHECK (plan_type IN ('starter', 'growth', 'scale', 'enterprise')),
ADD COLUMN is_team BOOLEAN DEFAULT false;
```

---

## Row-Level Security (RLS) Policies

### For Team-Scoped Tables (e.g., `properties`)

[x] **Solo user access**

```sql
CREATE POLICY "Solo users access own data" ON properties
FOR SELECT USING (
  auth.uid() = user_id AND
  (SELECT is_individual FROM users WHERE id = auth.uid())
);
```

[x] **Team member access**

```sql
CREATE POLICY "Team members access shared data" ON properties
FOR ALL USING (
  team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
);
```

### For `teams` Table

[x] **Admin-only management**

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

[x] **Onboarding flow**

- Add UI toggle: "Join as an individual" vs "Create team"
- Auto-create `team` record for team signups

[x] **Invite system**

- Email notifications for team invites
- Accept/reject invite flow
- Handle expired invites cleanup

[x] **Team switching**

- Update `users.active_team_id` on switch
- Refresh JWT claims via `supabase.auth.refreshSession()`

---

## Subscription & Billing

[x] **Link team plans**

```sql
UPDATE teams
SET subscription_id = 'sub_123', plan_type = 'growth', max_members = 5
WHERE id = 'team-uuid';
```

[x] **Enforce team limits**

```typescript
// Block invites if team is full:
const { count } = await supabase
	.from('team_members')
	.select('*', { count: 'exact' })
	.eq('team_id', teamId);

if (count >= team.max_members) throw new Error('Team full');
```

[x] **Team plan selection**

- Prevent individual users from selecting team plans
- Handle team context in subscription creation
- Sync subscription status with team members

[x] **Proration logic**

- Calculate upgrade costs via Paystack
- Handle team plan migrations
- Manage credit distribution

---

## UI/API Changes

[x] **Team dashboard**

- Member list with role badges
- "Invite" button with email input
- Team usage stats (screenings/appointments)

[x] **Resource ownership UI**

```tsx
// Show team/personal toggle:
<Button onClick={() => setScope(scope === 'team' ? 'personal' : 'team')}>
	Viewing: {scope}
</Button>
```

[x] **Update all queries**

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

[x] **Data migration script**

```sql
-- Backfill team_id for early adopters:
UPDATE properties
SET team_id = users.active_team_id
FROM users
WHERE properties.user_id = users.id;
```

[x] **Edge case tests**

- Individual user tries to invite member → block
- Team admin downgrades plan → enforce member removal
- User in multiple teams → data isolation

[ ] **Documentation**

- Update API docs with `team_id` parameters
- Add "Team Guide" for admins

---

## Supabase Type Updates

[x] **database.types.ts adjustments:**

```typescript
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

# Team Invitation Process Task List

**Scope**: Tasks to implement the team invitation flow (not covered in the original roadmap).

---

### **Backend Tasks**

[x] **Create API endpoint/functions for sending invites**

- Accepts `email` and `team_id` (called by admins).
- Generates a token, saves to `team_invitations` table.

[x] **Create API endpoint/functions for accepting invites**

- Validates the token, checks expiration, and links user to the team.

[x] **Add RLS policies for `team_invitations` table**

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

[x] **Add email validation logic**

- Ensure the user's sign-up/login email matches the invited email.

[x] **Add team membership checks**

- Block adding users already in the team.

---

### **Frontend Tasks**

[x] **Build invite UI for team admins**

- Email input field + "Send Invite" button in the team dashboard.

[x] **Build invite acceptance page**

- Page at `/join-team?token=...` that handles token validation.
- Show loading/error states (e.g., "Invalid token").

[x] **Add notifications**

- Success: "You've joined Team XYZ!"
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

- Ensure non-admins can't read/write `team_invitations`.

---

### **Documentation**

[ ] **Update API docs** with `/invite` and `/join-team` endpoints.  
[ ] **Write user guide** for admins: "How to invite team members."
