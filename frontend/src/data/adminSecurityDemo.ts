export type DemoSeverity = 'critical' | 'high' | 'medium' | 'low';

export type DemoUser = {
  id: string;
  name: string;
  email: string;
  role: 'Super Admin' | 'Admin' | 'Moderator' | 'Viewer' | 'Customer';
  status: 'Active' | 'Suspended';
  mfa: boolean;
  lastSeen: string;
};

export type DemoAlert = {
  id: string;
  title: string;
  description: string;
  severity: DemoSeverity;
  time: string;
  status: 'Open' | 'Reviewed' | 'Resolved';
};

export type DemoAuditEvent = {
  id: string;
  actor: string;
  action: string;
  resource: string;
  timestamp: string;
  ip: string;
  device: string;
  previous: string;
  next: string;
  severity: DemoSeverity;
  outcome: 'Success' | 'Failure';
};

export type DemoSession = {
  id: string;
  user: string;
  email: string;
  device: string;
  browser: string;
  ip: string;
  location: string;
  lastActive: string;
  current: boolean;
};

export type DemoLoginRecord = {
  id: string;
  userId: string;
  time: string;
  result: 'Success' | 'Blocked';
  ip: string;
  device: string;
  location: string;
};

export type DemoApiKey = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  created: string;
  expires: string;
  lastUsed: string;
  status: 'Active' | 'Revoked';
};

export const demoSecurityMetrics = [
  { label: 'Total users', value: '12,480', detail: '+4.8% this month', status: 'secure' },
  { label: 'Active sessions', value: '284', detail: 'Across 19 countries', status: 'secure' },
  { label: 'Failed logins', value: '17', detail: 'Last 24 hours', status: 'warning' },
  { label: 'Open alerts', value: '2', detail: '2 need attention', status: 'critical' },
  { label: 'Admin accounts', value: '8', detail: '6 protected by MFA', status: 'warning' },
  { label: 'MFA adoption', value: '76%', detail: '9,485 protected users', status: 'warning' },
  { label: 'Suspicious activity', value: '2', detail: 'Last 7 days', status: 'critical' },
  { label: 'Last backup', value: 'Today', detail: '02:14 UTC · 1.8 GB', status: 'secure' }
] as const;

export const demoLoginActivity = [
  { day: 'Mon', successful: 68, failed: 10 },
  { day: 'Tue', successful: 78, failed: 7 },
  { day: 'Wed', successful: 57, failed: 14 },
  { day: 'Thu', successful: 88, failed: 8 },
  { day: 'Fri', successful: 73, failed: 11 },
  { day: 'Sat', successful: 49, failed: 5 },
  { day: 'Sun', successful: 62, failed: 9 }
];

export const demoUsers: DemoUser[] = [
  { id: 'USR-1024', name: 'Sophea Chan', email: 'sophea.chan@example.com', role: 'Admin', status: 'Active', mfa: true, lastSeen: '2 min ago' },
  { id: 'USR-1018', name: 'Dara Sok', email: 'dara.sok@example.com', role: 'Super Admin', status: 'Active', mfa: true, lastSeen: '18 min ago' },
  { id: 'USR-1006', name: 'Malis Vann', email: 'malis.vann@example.com', role: 'Moderator', status: 'Active', mfa: false, lastSeen: '1 hour ago' },
  { id: 'USR-0992', name: 'Vicheka Lim', email: 'vicheka.lim@example.com', role: 'Viewer', status: 'Suspended', mfa: false, lastSeen: 'Yesterday' },
  { id: 'USR-0974', name: 'Bopha Heng', email: 'bopha.heng@example.com', role: 'Customer', status: 'Active', mfa: true, lastSeen: 'Yesterday' },
  { id: 'USR-0951', name: 'Kosal Phan', email: 'kosal.phan@example.com', role: 'Customer', status: 'Active', mfa: false, lastSeen: '2 days ago' }
];

export const demoRoles = [
  { name: 'Super Admin', users: 1, permissions: ['View', 'Create', 'Edit', 'Delete', 'Export', 'Manage users', 'Manage roles', 'Manage settings'] },
  { name: 'Admin', users: 3, permissions: ['View', 'Create', 'Edit', 'Delete', 'Export', 'Manage users'] },
  { name: 'Moderator', users: 2, permissions: ['View', 'Edit'] },
  { name: 'Viewer', users: 2, permissions: ['View', 'Export'] }
] as const;

export const demoAuditEvents: DemoAuditEvent[] = [
  { id: 'AUD-8312', actor: 'Dara Sok', action: 'Role changed', resource: 'USR-1024 · Sophea Chan', timestamp: 'Oct 03, 09:42', ip: '103.21.44.18', device: 'Chrome · Windows', previous: 'Moderator', next: 'Admin', severity: 'high', outcome: 'Success' },
  { id: 'AUD-8311', actor: 'System', action: 'Login blocked', resource: 'auth.login', timestamp: 'Oct 03, 09:31', ip: '185.220.101.4', device: 'Unknown browser', previous: '5 failed attempts', next: 'IP throttled', severity: 'critical', outcome: 'Failure' },
  { id: 'AUD-8308', actor: 'Sophea Chan', action: 'Product updated', resource: 'PRD-024 · Palm sugar', timestamp: 'Oct 03, 08:56', ip: '103.21.44.22', device: 'Safari · macOS', previous: '$11.00', next: '$12.00', severity: 'low', outcome: 'Success' },
  { id: 'AUD-8294', actor: 'Dara Sok', action: 'Session revoked', resource: 'SES-3008 · Vicheka Lim', timestamp: 'Oct 02, 17:14', ip: '103.21.44.18', device: 'Chrome · Windows', previous: 'Active', next: 'Revoked', severity: 'medium', outcome: 'Success' },
  { id: 'AUD-8281', actor: 'System', action: 'Backup completed', resource: 'backup-2026-10-02', timestamp: 'Oct 02, 02:14', ip: '127.0.0.1', device: 'Backup worker', previous: 'Running', next: 'Complete · 1.8 GB', severity: 'low', outcome: 'Success' }
];

export const demoAlerts: DemoAlert[] = [
  { id: 'ALT-2041', title: 'Repeated failed sign-ins', description: '12 attempts against 3 accounts from a single network in 8 minutes.', severity: 'critical', time: '4 min ago', status: 'Open' },
  { id: 'ALT-2038', title: 'New administrator account', description: 'An administrator role was assigned to Sophea Chan.', severity: 'high', time: '31 min ago', status: 'Open' },
  { id: 'ALT-2032', title: 'Login from a new device', description: 'A new browser fingerprint was detected for an admin account.', severity: 'medium', time: '2 hours ago', status: 'Reviewed' },
  { id: 'ALT-2027', title: 'Backup completed', description: 'The scheduled database backup completed successfully.', severity: 'low', time: 'Today, 02:14', status: 'Resolved' }
];

export const demoSessions: DemoSession[] = [
  { id: 'SES-3014', user: 'Dara Sok', email: 'dara.sok@example.com', device: 'Windows 11', browser: 'Chrome 129', ip: '103.21.44.18', location: 'Phnom Penh, KH', lastActive: 'Now', current: true },
  { id: 'SES-3011', user: 'Sophea Chan', email: 'sophea.chan@example.com', device: 'iPhone 15', browser: 'Safari 18', ip: '103.21.44.22', location: 'Phnom Penh, KH', lastActive: '12 min ago', current: false },
  { id: 'SES-3008', user: 'Malis Vann', email: 'malis.vann@example.com', device: 'MacBook Pro', browser: 'Chrome 128', ip: '45.125.245.8', location: 'Siem Reap, KH', lastActive: '47 min ago', current: false },
  { id: 'SES-3002', user: 'Vicheka Lim', email: 'vicheka.lim@example.com', device: 'Unknown device', browser: 'Unknown', ip: '185.220.101.4', location: 'Unverified', lastActive: '2 hours ago', current: false }
];

export const demoLoginHistory: DemoLoginRecord[] = [
  { id: 'LHI-7012', userId: 'USR-1024', time: 'Oct 03, 09:40', result: 'Success', ip: '103.21.44.22', device: 'Safari 18 · iPhone 15', location: 'Phnom Penh, KH' },
  { id: 'LHI-6986', userId: 'USR-1024', time: 'Oct 02, 16:18', result: 'Success', ip: '103.21.44.22', device: 'Safari 18 · iPhone 15', location: 'Phnom Penh, KH' },
  { id: 'LHI-7010', userId: 'USR-1018', time: 'Oct 03, 09:22', result: 'Success', ip: '103.21.44.18', device: 'Chrome 129 · Windows 11', location: 'Phnom Penh, KH' },
  { id: 'LHI-7004', userId: 'USR-1006', time: 'Oct 03, 08:31', result: 'Blocked', ip: '45.125.245.8', device: 'Unknown browser', location: 'Unverified' },
  { id: 'LHI-6991', userId: 'USR-1006', time: 'Oct 02, 13:57', result: 'Success', ip: '45.125.245.8', device: 'Chrome 128 · MacBook Pro', location: 'Siem Reap, KH' },
  { id: 'LHI-6972', userId: 'USR-0992', time: 'Oct 02, 11:06', result: 'Blocked', ip: '185.220.101.4', device: 'Unknown browser', location: 'Unverified' },
  { id: 'LHI-6955', userId: 'USR-0974', time: 'Oct 01, 18:04', result: 'Success', ip: '103.21.44.31', device: 'Chrome 129 · Android', location: 'Phnom Penh, KH' },
  { id: 'LHI-6934', userId: 'USR-0951', time: 'Sep 30, 15:21', result: 'Success', ip: '103.21.44.67', device: 'Firefox 130 · Windows 11', location: 'Battambang, KH' }
];

export const demoApiKeys: DemoApiKey[] = [
  { id: 'KEY-041', name: 'Inventory sync', prefix: 'mk_live_••••••9f2a', scopes: ['products:read', 'inventory:write'], created: 'Sep 12, 2026', expires: 'Mar 12, 2027', lastUsed: '3 min ago', status: 'Active' },
  { id: 'KEY-038', name: 'Analytics export', prefix: 'mk_live_••••••61c0', scopes: ['orders:read', 'reports:export'], created: 'Aug 02, 2026', expires: 'Feb 02, 2027', lastUsed: 'Yesterday', status: 'Active' }
];

export const demoBackups = [
  { id: 'BKP-0912', date: 'Oct 03, 2026 · 02:14 UTC', status: 'Complete', size: '1.8 GB', destination: 'Encrypted off-site storage', duration: '4m 18s' },
  { id: 'BKP-0911', date: 'Oct 02, 2026 · 02:14 UTC', status: 'Complete', size: '1.8 GB', destination: 'Encrypted off-site storage', duration: '4m 21s' },
  { id: 'BKP-0910', date: 'Oct 01, 2026 · 02:14 UTC', status: 'Complete', size: '1.7 GB', destination: 'Encrypted off-site storage', duration: '4m 02s' },
  { id: 'BKP-0909', date: 'Sep 30, 2026 · 02:14 UTC', status: 'Failed', size: '—', destination: 'Encrypted off-site storage', duration: 'Timeout' }
];
