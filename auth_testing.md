# Auth Testing Playbook (from integration_playbook_expert_v2)

Owner/admin google account: **weddlyindonesia@gmail.com**

## Create Test User & Session
```bash
mongosh --eval "
use('test_database');
var userId = 'user_' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  picture: 'https://via.placeholder.com/150',
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

## Test endpoints
- GET /api/auth/me with cookie session_token or Authorization: Bearer <token>
- Weddly endpoints require active membership

## Browser
Add cookie `session_token` (httpOnly, secure, sameSite=None) and navigate to /dashboard.
