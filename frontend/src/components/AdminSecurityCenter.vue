<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Activity, AlertTriangle, Archive, ArrowDownToLine, ArrowRight, BadgeCheck, Bell, Check, CheckCheck, ChevronDown, CircleHelp, Clock3, CloudDownload, Copy, Download, Fingerprint, KeyRound, LockKeyhole, LogOut, Moon, Plus, RefreshCw, Search, Settings2, Shield, ShieldAlert, ShieldCheck, Sun, UsersRound, X } from 'lucide-vue-next';
import {
  demoAlerts, demoApiKeys, demoAuditEvents, demoBackups, demoLoginActivity, demoLoginHistory, demoRoles,
  demoSecurityMetrics, demoSessions, demoUsers, type DemoAlert, type DemoAuditEvent,
  type DemoSeverity, type DemoUser
} from '../data/adminSecurityDemo';

const sections = [
  { id: 'overview', label: 'Security overview', icon: ShieldCheck },
  { id: 'users', label: 'Users', icon: UsersRound },
  { id: 'roles', label: 'Roles & permissions', icon: LockKeyhole },
  { id: 'audit', label: 'Audit log', icon: Activity },
  { id: 'alerts', label: 'Security alerts', icon: Bell },
  { id: 'sessions', label: 'Sessions', icon: Fingerprint },
  { id: 'keys', label: 'API keys', icon: KeyRound },
  { id: 'backups', label: 'Backups & recovery', icon: Archive },
  { id: 'settings', label: 'Security settings', icon: Settings2 }
] as const;

export type AdminSecuritySection = typeof sections[number]['id'];
type SectionId = AdminSecuritySection;
const permissions = ['View', 'Create', 'Edit', 'Delete', 'Export', 'Manage users', 'Manage roles', 'Manage settings'] as const;
type DemoPermission = typeof permissions[number];
const props = withDefaults(defineProps<{ initialSection?: SectionId; lightMode?: boolean }>(), { initialSection: 'overview', lightMode: false });
const emit = defineEmits<{ toggleLight: [] }>();
const activeSection = ref<SectionId>(props.initialSection);
const showDemoNotice = ref(true);
const notice = ref('');
const search = ref('');
const severityFilter = ref('all');
const userRoleFilter = ref('all');
const userStatusFilter = ref('all');
const auditStart = ref('');
const auditEnd = ref('');
const page = ref(1);
const pageSize = 5;
const users = ref<DemoUser[]>(demoUsers.map((user) => ({ ...user })));
const alerts = ref<DemoAlert[]>(demoAlerts.map((alert) => ({ ...alert })));
const sessions = ref(demoSessions.map((session) => ({ ...session })));
const keys = ref(demoApiKeys.map((key) => ({ ...key, scopes: [...key.scopes] })));
const auditEvents = ref<DemoAuditEvent[]>(demoAuditEvents.map((event) => ({ ...event })));
const roles = ref(demoRoles.map((role) => ({ ...role, permissions: [...role.permissions] })));
const showKeyDialog = ref(false);
const selectedHistoryUser = ref<DemoUser | null>(null);
const oneTimeDemoKey = ref('');
const keyName = ref('');
const keyExpiration = ref('90');
const keyReadScope = ref(true);
const keyWriteScope = ref(false);
const settingsSaved = ref(false);
const sessionTimeout = ref(30);
const loginLimit = ref(5);
const requireMfa = ref(true);
const notifySecurity = ref(true);
const ipAllowlist = ref('');

const currentTitle = computed(() => sections.find((section) => section.id === activeSection.value)?.label ?? 'Security overview');
const filteredUsers = computed(() => users.value.filter((user) => {
  const matchesSearch = `${user.name} ${user.email} ${user.role} ${user.id}`.toLowerCase().includes(search.value.toLowerCase());
  const matchesRole = userRoleFilter.value === 'all' || user.role === userRoleFilter.value;
  const matchesStatus = userStatusFilter.value === 'all' || user.status === userStatusFilter.value;
  return matchesSearch && matchesRole && matchesStatus;
}));
const filteredAlerts = computed(() => alerts.value.filter((alert) => (severityFilter.value === 'all' || alert.severity === severityFilter.value) && `${alert.title} ${alert.description} ${alert.id}`.toLowerCase().includes(search.value.toLowerCase())));
const filteredAuditEvents = computed(() => auditEvents.value.filter((event) => {
  const matchesSearch = `${event.actor} ${event.action} ${event.resource} ${event.ip} ${event.device} ${event.previous} ${event.next}`.toLowerCase().includes(search.value.toLowerCase());
  const eventDate = new Date(`${event.timestamp.split(',')[0]}, 2026`);
  const startDate = auditStart.value ? new Date(`${auditStart.value}T00:00:00`) : null;
  const endDate = auditEnd.value ? new Date(`${auditEnd.value}T23:59:59`) : null;
  const matchesDate = (!startDate || eventDate >= startDate) && (!endDate || eventDate <= endDate);
  return matchesSearch && matchesDate && (severityFilter.value === 'all' || event.severity === severityFilter.value);
}));
const filteredLoginHistory = computed(() => selectedHistoryUser.value ? demoLoginHistory.filter((record) => record.userId === selectedHistoryUser.value?.id) : []);
const pagedAuditEvents = computed(() => filteredAuditEvents.value.slice((page.value - 1) * pageSize, page.value * pageSize));
const auditPageCount = computed(() => Math.max(1, Math.ceil(filteredAuditEvents.value.length / pageSize)));
const openAlerts = computed(() => alerts.value.filter((alert) => alert.status === 'Open').length);
const toast = (message: string) => {
  notice.value = message;
  window.setTimeout(() => { if (notice.value === message) notice.value = ''; }, 3200);
};

watch([search, severityFilter, auditStart, auditEnd], () => { page.value = 1; });

function selectSection(section: SectionId) {
  activeSection.value = section;
  search.value = '';
  severityFilter.value = 'all';
  page.value = 1;
}

function toggleUserStatus(user: DemoUser) {
  user.status = user.status === 'Active' ? 'Suspended' : 'Active';
  toast(`${user.name}: ${user.status.toLowerCase()} (sample only)`);
}

function updateUserRole(user: DemoUser, role: DemoUser['role']) {
  if (user.role === role || !window.confirm(`Change ${user.name}'s sample role to ${role}?`)) return;
  user.role = role;
  toast(`${user.name}'s role changed in the demo only`);
}

function resetSamplePassword(user: DemoUser) {
  if (window.confirm(`Simulate a password reset for ${user.name}? No real password will be changed.`)) {
    toast(`Sample reset workflow started for ${user.email}`);
  }
}

function showSampleLoginHistory(user: DemoUser) {
  selectedHistoryUser.value = user;
}

function toggleRolePermission(roleName: string, permission: DemoPermission) {
  const role = roles.value.find((item) => item.name === roleName);
  if (!role) return;
  const index = role.permissions.indexOf(permission);
  if (index >= 0) role.permissions.splice(index, 1);
  else role.permissions.push(permission);
  toast('Permission updated in the demo only');
}

function setAlertStatus(alert: DemoAlert, status: DemoAlert['status']) {
  alert.status = status;
  toast(`${alert.id} marked ${status.toLowerCase()} (sample only)`);
}

function revokeSession(session: typeof sessions.value[number]) {
  if (!window.confirm(`Revoke sample session ${session.id} for ${session.user}?`)) return;
  sessions.value = sessions.value.filter((item) => item.id !== session.id);
  toast(`${session.id} revoked in the demo only`);
}

function revokeAllSessions() {
  if (!window.confirm('End all other sample sessions? Your current session will stay active.')) return;
  sessions.value = sessions.value.filter((session) => session.current);
  toast('Other sessions ended in the demo only');
}

function createDemoKey() {
  const scopes = [keyReadScope.value && 'products:read', keyWriteScope.value && 'inventory:write'].filter(Boolean) as string[];
  if (!keyName.value.trim() || !scopes.length) return;
  const secret = `mk_demo_${crypto.randomUUID().replaceAll('-', '')}`;
  oneTimeDemoKey.value = secret;
  keys.value.unshift({
    id: `KEY-${Math.floor(100 + Math.random() * 899)}`,
    name: keyName.value.trim(),
    prefix: `mk_demo_••••••${secret.slice(-4)}`,
    scopes,
    created: new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(new Date()),
    expires: `${keyExpiration.value} days from now`,
    lastUsed: 'Never',
    status: 'Active'
  });
  keyName.value = '';
}

function revokeKey(keyId: string) {
  if (!window.confirm(`Revoke sample key ${keyId}?`)) return;
  const key = keys.value.find((item) => item.id === keyId);
  if (key) key.status = 'Revoked';
  toast(`${keyId} revoked in the demo only`);
}

async function copyDemoKey() {
  try {
    await navigator.clipboard.writeText(oneTimeDemoKey.value);
    toast('Demo key copied. It does not authenticate to the API.');
  } catch {
    toast('Clipboard unavailable. Select and copy the demo key manually.');
  }
}

function runDemoBackup() {
  if (!window.confirm('Create a sample backup entry? This will not run a real backup.')) return;
  toast('Sample backup queued. No production backup was started.');
}

function saveSettings() {
  settingsSaved.value = true;
  toast('Settings saved in this demo only');
  window.setTimeout(() => { settingsSaved.value = false; }, 2500);
}

function severityLabel(severity: DemoSeverity) {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}
</script>

<template>
  <section class="security-center" :class="{ 'is-light': lightMode }">
    <aside class="security-nav" aria-label="Security center navigation">
      <div class="security-nav-heading"><span>CONTROL ROOM</span><strong>Security center</strong></div>
      <nav>
        <button v-for="section in sections" :key="section.id" type="button" :class="{ active: activeSection === section.id }" @click="selectSection(section.id)">
          <component :is="section.icon" :size="16" /><span>{{ section.label }}</span>
          <i v-if="section.id === 'alerts' && openAlerts" class="nav-count">{{ openAlerts }}</i>
        </button>
      </nav>
      <div class="security-nav-foot"><ShieldCheck :size="15" /><span>Admin API access verified</span></div>
    </aside>

    <div class="security-content">
      <header class="security-toolbar">
        <div class="security-crumb"><span>Admin</span><ArrowRight :size="13" /><strong>{{ currentTitle }}</strong></div>
        <div class="security-toolbar-actions">
          <span class="demo-label"><span></span>Sample security data</span>
          <button class="theme-toggle" type="button" :aria-label="lightMode ? 'Switch to dark mode' : 'Switch to light mode'" :title="lightMode ? 'Switch to dark mode' : 'Switch to light mode'" @click="emit('toggleLight')"> <Sun v-if="!lightMode" :size="16" /><Moon v-else :size="16" /></button>
          <span class="admin-avatar" title="Signed in administrator">DS</span>
        </div>
      </header>

      <div v-if="showDemoNotice" class="demo-notice" role="note"><CircleHelp :size="15" /><span>Security console preview. Sample records and controls below are local demo data, not connected to production APIs.</span><button type="button" aria-label="Dismiss notice" @click="showDemoNotice = false"><X :size="14" /></button></div>
      <Transition name="toast"><div v-if="notice" class="security-toast" role="status"><Check :size="15" />{{ notice }}</div></Transition>

      <main class="security-main">
        <template v-if="activeSection === 'overview'">
          <div class="security-page-heading"><div><span class="eyebrow-line">SECURITY POSTURE</span><h2>Good morning, Dara</h2><p>Here is the latest security activity across your workspace.</p></div><button class="quiet-button" type="button" @click="toast('Sample security data refreshed')"><RefreshCw :size="14" />Refresh</button></div>
          <section class="posture-banner"><div class="posture-icon"><ShieldCheck :size="21" /></div><div><strong>Core protections are active</strong><span>Admin routes require a signed-in administrator. Advanced security metrics shown here are samples.</span></div><span class="posture-status"><i></i>MONITORING</span></section>
          <div class="security-metrics">
            <article v-for="metric in demoSecurityMetrics" :key="metric.label" class="security-metric" :class="`metric-${metric.status}`"><div><span>{{ metric.label }}</span><component :is="metric.status === 'secure' ? ShieldCheck : metric.status === 'warning' ? AlertTriangle : ShieldAlert" :size="16" /></div><strong>{{ metric.value }}</strong><small>{{ metric.detail }}</small></article>
          </div>
          <div class="security-overview-grid">
            <section class="panel login-panel"><header class="panel-heading"><div><h3>Authentication activity</h3><p>Successful and failed sign-ins · last 7 days</p></div><span class="range-tag">7 days <ChevronDown :size="12" /></span></header><div class="chart-legend"><span><i class="legend-success"></i>Successful</span><span><i class="legend-failed"></i>Failed</span></div><div class="login-chart" role="img" aria-label="Sample chart of successful and failed logins during the last 7 days"><div v-for="item in demoLoginActivity" :key="item.day" class="chart-day"><div class="bar-stack"><span class="bar-success" :style="{ height: `${item.successful}%` }"></span><span class="bar-failed" :style="{ height: `${item.failed * 2}%` }"></span></div><small>{{ item.day }}</small></div></div></section>
            <section class="panel alert-summary"><header class="panel-heading"><div><h3>Needs attention</h3><p>{{ openAlerts }} open sample alerts</p></div><button class="inline-link" type="button" @click="selectSection('alerts')">View alerts <ArrowRight :size="13" /></button></header><button v-for="alert in alerts.filter((item) => item.status === 'Open').slice(0, 3)" :key="alert.id" type="button" class="alert-summary-row" @click="selectSection('alerts')"><span class="severity-dot" :class="`severity-${alert.severity}`"></span><span><strong>{{ alert.title }}</strong><small>{{ alert.time }} · {{ alert.id }}</small></span><ArrowRight :size="14" /></button><div v-if="!openAlerts" class="empty-inline"><BadgeCheck :size="18" />All sample alerts reviewed</div></section>
          </div>
          <section class="panel overview-audit"><header class="panel-heading"><div><h3>Recent audit activity</h3><p>Latest tracked changes · sample records</p></div><button class="inline-link" type="button" @click="selectSection('audit')">Full audit log <ArrowRight :size="13" /></button></header><div class="activity-list"><div v-for="event in auditEvents.slice(0, 4)" :key="event.id" class="activity-row"><span class="activity-mark" :class="`severity-${event.severity}`"><Activity :size="14" /></span><div><strong>{{ event.actor }} <span>{{ event.action.toLowerCase() }}</span></strong><small>{{ event.resource }}</small></div><time>{{ event.timestamp }}</time></div></div></section>
        </template>

        <template v-else-if="activeSection === 'users'">
          <div class="security-page-heading"><div><span class="eyebrow-line">IDENTITY & ACCESS</span><h2>User management</h2><p>Review account access and MFA enrollment. Changes here are simulated.</p></div><button class="quiet-button" type="button" @click="toast('User export is not connected to a server')"><Download :size="14" />Export</button></div>
          <div class="user-summary-strip"><span><UsersRound :size="15" /><strong>12,480</strong> total users</span><span><i class="summary-dot green"></i>12,466 active</span><span><i class="summary-dot red"></i>14 suspended</span><span><Fingerprint :size="15" />76% MFA enrolled</span></div>
          <section class="panel data-panel"><div class="table-tools"><label class="table-search"><Search :size="15" /><input v-model="search" placeholder="Search name, email, role..." aria-label="Search users" /></label><select v-model="userRoleFilter" class="filter-button" aria-label="Filter users by role"><option value="all">All roles</option><option>Super Admin</option><option>Admin</option><option>Moderator</option><option>Viewer</option><option>Customer</option></select><select v-model="userStatusFilter" class="filter-button" aria-label="Filter users by status"><option value="all">All statuses</option><option>Active</option><option>Suspended</option></select><button class="filter-button" type="button" @click="toast('User data export is simulated only')"><ArrowDownToLine :size="14" />Export</button></div><div class="table-scroll"><table class="security-table"><thead><tr><th>User</th><th>Role</th><th>Status</th><th>MFA</th><th>Last active</th><th>Actions</th></tr></thead><tbody><tr v-for="user in filteredUsers" :key="user.id"><td><div class="user-cell"><span class="user-initials">{{ user.name.split(' ').map((part) => part[0]).join('') }}</span><span><strong>{{ user.name }}</strong><small>{{ user.email }}</small></span></div></td><td><select class="user-role-select" :value="user.role" :aria-label="`Change sample role for ${user.name}`" @change="updateUserRole(user, ($event.target as HTMLSelectElement).value as DemoUser['role'])"><option>Super Admin</option><option>Admin</option><option>Moderator</option><option>Viewer</option><option>Customer</option></select></td><td><span class="state-pill" :class="user.status.toLowerCase()"><i></i>{{ user.status }}</span></td><td><span class="mfa-state" :class="{ enabled: user.mfa }"><Check v-if="user.mfa" :size="13" /><X v-else :size="13" />{{ user.mfa ? 'Enabled' : 'Off' }}</span></td><td>{{ user.lastSeen }}</td><td><div class="user-row-actions"><button class="row-action" type="button" @click="toggleUserStatus(user)">{{ user.status === 'Active' ? 'Suspend' : 'Activate' }}</button><button class="row-action" type="button" @click="resetSamplePassword(user)">Reset password</button><button class="row-action" type="button" @click="showSampleLoginHistory(user)">Login history</button></div></td></tr><tr v-if="!filteredUsers.length"><td colspan="6" class="table-empty">No matching sample users.</td></tr></tbody></table></div><footer class="table-footer"><span>Showing {{ filteredUsers.length }} sample accounts</span><div><button type="button" disabled>Previous</button><span>1</span><button type="button" disabled>Next</button></div></footer></section>
        </template>

        <template v-else-if="activeSection === 'roles'">
          <div class="security-page-heading"><div><span class="eyebrow-line">LEAST PRIVILEGE</span><h2>Roles & permissions</h2><p>Example role matrix. Server-side role enforcement is not configured for these sample roles.</p></div><button class="primary-action" type="button" @click="toast('Role creation requires a connected RBAC API')"><Plus :size="15" />Create role</button></div>
          <div class="role-warning"><ShieldAlert :size="17" /><span><strong>Sample configuration only.</strong> The live API currently supports customer and administrator roles; this matrix does not grant backend permissions.</span></div>
          <section class="panel data-panel"><div class="table-scroll"><table class="security-table permission-table"><thead><tr><th>Role</th><th>Members</th><th v-for="permission in permissions" :key="permission">{{ permission }}</th></tr></thead><tbody><tr v-for="role in roles" :key="role.name"><td><strong>{{ role.name }}</strong><small>{{ role.name === 'Super Admin' ? 'Full control' : role.name === 'Viewer' ? 'Read only' : 'Custom access' }}</small></td><td>{{ role.users }}</td><td v-for="permission in permissions" :key="permission"><input type="checkbox" :checked="role.permissions.includes(permission)" :disabled="role.name === 'Super Admin'" :aria-label="`${role.name}: ${permission}`" @change="toggleRolePermission(role.name, permission)" /></td></tr></tbody></table></div><div class="panel-footnote"><LockKeyhole :size="13" />Super Admin permissions are locked in this sample.</div></section>
        </template>

        <template v-else-if="activeSection === 'audit'">
          <div class="security-page-heading"><div><span class="eyebrow-line">IMMUTABLE RECORD</span><h2>Audit log</h2><p>Security and administrative events. This sample log is read-only.</p></div><button class="quiet-button" type="button" @click="toast('Audit export is not connected to a server')"><Download :size="14" />Export CSV</button></div>
          <div class="audit-filters"><label class="table-search"><Search :size="15" /><input v-model="search" placeholder="Search actor, action, resource, IP..." aria-label="Search audit logs" /></label><select v-model="severityFilter" aria-label="Filter by severity"><option value="all">All severities</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select><input v-model="auditStart" aria-label="Start date" type="date" /><input v-model="auditEnd" aria-label="End date" type="date" /><span class="read-only-tag"><LockKeyhole :size="12" />Read only</span></div>
          <section class="panel data-panel"><div class="table-scroll"><table class="security-table audit-table"><thead><tr><th>Event</th><th>Actor</th><th>Action / resource</th><th>Time</th><th>IP / device</th><th>Severity</th><th>Result</th></tr></thead><tbody><tr v-for="event in pagedAuditEvents" :key="event.id"><td class="mono-id">{{ event.id }}</td><td>{{ event.actor }}</td><td><strong>{{ event.action }}</strong><small>{{ event.resource }}</small><small class="change-detail">{{ event.previous }} <ArrowRight :size="11" /> {{ event.next }}</small></td><td>{{ event.timestamp }}</td><td><strong>{{ event.ip }}</strong><small>{{ event.device }}</small></td><td><span class="severity-pill" :class="`severity-${event.severity}`">{{ severityLabel(event.severity) }}</span></td><td><span class="state-pill" :class="event.outcome.toLowerCase()"><i></i>{{ event.outcome }}</span></td></tr><tr v-if="!pagedAuditEvents.length"><td colspan="7" class="table-empty">No matching sample events.</td></tr></tbody></table></div><footer class="table-footer"><span>{{ filteredAuditEvents.length }} immutable sample events</span><div><button type="button" :disabled="page <= 1" @click="page--">Previous</button><span>{{ page }} / {{ auditPageCount }}</span><button type="button" :disabled="page >= auditPageCount" @click="page++">Next</button></div></footer></section>
        </template>

        <template v-else-if="activeSection === 'alerts'">
          <div class="security-page-heading"><div><span class="eyebrow-line">THREAT MONITORING</span><h2>Security alerts <span class="heading-count">{{ openAlerts }} open</span></h2><p>Review suspicious activity and simulated system notifications.</p></div><button class="quiet-button" type="button" @click="toast('Sample alert feed refreshed')"><RefreshCw :size="14" />Refresh feed</button></div>
          <div class="alert-filter-row"><label class="table-search"><Search :size="15" /><input v-model="search" placeholder="Search alerts..." aria-label="Search alerts" /></label><select v-model="severityFilter" aria-label="Filter alerts by severity"><option value="all">All severities</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select><span class="feed-indicator"><i></i>DEMO FEED</span></div>
          <div class="alert-list"><article v-for="alert in filteredAlerts" :key="alert.id" class="panel alert-card" :class="`alert-${alert.severity}`"><span class="alert-icon"><ShieldAlert v-if="alert.severity === 'critical' || alert.severity === 'high'" :size="18" /><AlertTriangle v-else :size="18" /></span><div class="alert-copy"><div class="alert-title-row"><h3>{{ alert.title }}</h3><span class="severity-pill" :class="`severity-${alert.severity}`">{{ severityLabel(alert.severity) }}</span></div><p>{{ alert.description }}</p><small>{{ alert.id }} · {{ alert.time }} · {{ alert.status }}</small></div><div class="alert-actions"><button v-if="alert.status === 'Open'" class="row-action" type="button" @click="setAlertStatus(alert, 'Reviewed')">Mark reviewed</button><button v-if="alert.status !== 'Resolved'" class="resolve-action" type="button" @click="setAlertStatus(alert, 'Resolved')"><CheckCheck :size="14" />Resolve</button><BadgeCheck v-else class="resolved-icon" :size="19" /></div></article><div v-if="!filteredAlerts.length" class="panel empty-panel">No alerts match these filters.</div></div>
        </template>

        <template v-else-if="activeSection === 'sessions'">
          <div class="security-page-heading"><div><span class="eyebrow-line">ACTIVE ACCESS</span><h2>Sessions</h2><p>Review devices and revoke suspicious sample sessions.</p></div><button class="danger-outline" type="button" @click="revokeAllSessions"><LogOut :size="14" />End other sessions</button></div>
          <div class="session-summary"><span><strong>{{ sessions.length }}</strong> active sample sessions</span><span><i class="summary-dot green"></i>Last scan 1 minute ago</span><span>Idle timeout <strong>30 minutes</strong></span></div>
          <section class="session-list"><article v-for="session in sessions" :key="session.id" class="panel session-card"><span class="device-icon"><Fingerprint :size="19" /></span><div class="session-info"><div><strong>{{ session.user }}</strong><span v-if="session.current" class="current-session">THIS DEVICE</span></div><small>{{ session.email }}</small><p>{{ session.device }} · {{ session.browser }}</p><small>{{ session.ip }} · {{ session.location }}</small></div><div class="session-last"><span>{{ session.current ? 'Current session' : 'Last active' }}</span><strong>{{ session.lastActive }}</strong><button v-if="!session.current" class="row-action danger-text" type="button" @click="revokeSession(session)">Revoke</button></div></article><div v-if="!sessions.length" class="panel empty-panel">No active sample sessions.</div></section>
        </template>

        <template v-else-if="activeSection === 'keys'">
          <div class="security-page-heading"><div><span class="eyebrow-line">INTEGRATION ACCESS</span><h2>API keys</h2><p>Credentials are masked; key creation and revocation are simulated only.</p></div><button class="primary-action" type="button" @click="showKeyDialog = true"><Plus :size="15" />Create API key</button></div>
          <div class="key-security-note"><KeyRound :size="17" /><span>Never share a secret. Production keys must be created and stored by a server-side key service.</span></div>
          <section class="panel data-panel"><div class="table-scroll"><table class="security-table"><thead><tr><th>Key name</th><th>Secret</th><th>Scopes</th><th>Expires</th><th>Last used</th><th>Status</th><th></th></tr></thead><tbody><tr v-for="key in keys" :key="key.id"><td><strong>{{ key.name }}</strong><small>{{ key.id }} · created {{ key.created }}</small></td><td class="key-mask">{{ key.prefix }}</td><td><div class="scope-list"><span v-for="scope in key.scopes" :key="scope">{{ scope }}</span></div></td><td>{{ key.expires }}</td><td>{{ key.lastUsed }}</td><td><span class="state-pill" :class="key.status.toLowerCase()"><i></i>{{ key.status }}</span></td><td><button v-if="key.status === 'Active'" class="row-action danger-text" type="button" @click="revokeKey(key.id)">Revoke</button></td></tr><tr v-if="!keys.length"><td colspan="7" class="table-empty">No sample keys.</td></tr></tbody></table></div></section>
        </template>

        <template v-else-if="activeSection === 'backups'">
          <div class="security-page-heading"><div><span class="eyebrow-line">BUSINESS CONTINUITY</span><h2>Backups & recovery</h2><p>Monitor sample backup runs and restore history.</p></div><button class="primary-action" type="button" @click="runDemoBackup"><CloudDownload :size="15" />Run sample backup</button></div>
          <div class="backup-status"><div class="backup-status-icon"><Check :size="19" /></div><div><span>Last successful backup</span><strong>Today at 02:14 UTC</strong><small>Encrypted off-site · 1.8 GB · Completed in 4m 18s</small></div><span class="state-pill active"><i></i>Healthy</span></div>
          <div class="backup-config-grid"><article class="panel backup-config"><span>Schedule</span><strong>Daily · 02:00 UTC</strong><small>Next run in 16 hours</small></article><article class="panel backup-config"><span>Retention</span><strong>30 daily · 12 monthly</strong><small>Encrypted at rest</small></article><article class="panel backup-config"><span>Failed backups</span><strong class="warning-number">1 in 30 days</strong><small>Last failure Sep 30</small></article></div>
          <section class="panel data-panel"><header class="panel-heading"><div><h3>Backup history</h3><p>Sample backup records · restore disabled until secure API is configured</p></div></header><div class="table-scroll"><table class="security-table"><thead><tr><th>Backup</th><th>Date</th><th>Status</th><th>Size</th><th>Destination</th><th>Duration</th><th>Recovery</th></tr></thead><tbody><tr v-for="backup in demoBackups" :key="backup.id"><td class="mono-id">{{ backup.id }}</td><td>{{ backup.date }}</td><td><span class="state-pill" :class="backup.status.toLowerCase()"><i></i>{{ backup.status }}</span></td><td>{{ backup.size }}</td><td>{{ backup.destination }}</td><td>{{ backup.duration }}</td><td><button class="row-action" type="button" disabled :title="'Connect a re-authenticated restore API first'">Restore unavailable</button></td></tr></tbody></table></div></section>
          <div class="role-warning restore-warning"><LockKeyhole :size="17" /><span><strong>Restore is intentionally disabled.</strong> A production restore needs server-side authorization, recent password/MFA re-authentication, and a verified backup API.</span></div>
        </template>

        <template v-else>
          <div class="security-page-heading"><div><span class="eyebrow-line">POLICY & PROTECTION</span><h2>Security settings</h2><p>Local preview controls only. They do not change backend security policy.</p></div><button class="primary-action" type="button" @click="saveSettings"><Check :size="15" />{{ settingsSaved ? 'Saved' : 'Save changes' }}</button></div>
          <div class="settings-layout"><div class="settings-groups"><section class="panel settings-panel"><header class="settings-heading"><span class="settings-icon"><Fingerprint :size="17" /></span><div><h3>Authentication</h3><p>Stronger sign-in requirements</p></div></header><label class="setting-row"><span><strong>Require MFA for administrators</strong><small>Ask admin accounts for a second factor</small></span><input v-model="requireMfa" class="switch-input" type="checkbox" /></label><label class="setting-row"><span><strong>Minimum password length</strong><small>Recommended minimum is 12 characters</small></span><select aria-label="Minimum password length"><option>12 characters</option><option>14 characters</option><option>16 characters</option></select></label><label class="setting-row"><span><strong>Require breached-password check</strong><small>Reject known compromised passwords</small></span><input class="switch-input" type="checkbox" checked /></label></section>
          <section class="panel settings-panel"><header class="settings-heading"><span class="settings-icon"><Clock3 :size="17" /></span><div><h3>Sessions & lockout</h3><p>Limit session exposure and repeated guesses</p></div></header><label class="setting-row"><span><strong>Idle session timeout</strong><small>Automatically expire inactive sessions</small></span><select v-model.number="sessionTimeout"><option :value="15">15 minutes</option><option :value="30">30 minutes</option><option :value="60">60 minutes</option></select></label><label class="setting-row"><span><strong>Failed attempts before throttle</strong><small>Current production API has IP rate limiting</small></span><select v-model.number="loginLimit"><option :value="5">5 attempts</option><option :value="8">8 attempts</option><option :value="10">10 attempts</option></select></label></section>
          <section class="panel settings-panel"><header class="settings-heading"><span class="settings-icon"><Shield :size="17" /></span><div><h3>Network & notifications</h3><p>Restrict access and receive security notices</p></div></header><label class="setting-row"><span><strong>Admin IP allowlist</strong><small>One IPv4/IPv6 address per line</small></span><textarea v-model="ipAllowlist" rows="2" placeholder="203.0.113.10" /></label><label class="setting-row"><span><strong>Security email notifications</strong><small>Send alerts for admin and session changes</small></span><input v-model="notifySecurity" class="switch-input" type="checkbox" /></label></section></div>
          <aside class="settings-side"><div class="panel settings-checklist"><h3>Current protections</h3><p><Check :size="14" />Hashed passwords (bcrypt)</p><p><Check :size="14" />HttpOnly session cookie</p><p><Check :size="14" />SameSite=Lax cookie</p><p><Check :size="14" />Server-side ADMIN route guard</p><p><Check :size="14" />Login IP rate limit</p><p class="not-live"><AlertTriangle :size="14" />MFA and audit API not configured</p><p class="not-live"><AlertTriangle :size="14" />HTTPS is required in production</p></div><div class="settings-demo-callout"><CircleHelp :size="15" /><span>Saving these controls only updates this page. Production policy changes need authenticated backend endpoints.</span></div></aside></div>
        </template>
      </main>
    </div>

    <div v-if="showKeyDialog" class="dialog-shade" @click.self="showKeyDialog = false; oneTimeDemoKey = ''">
      <form class="key-dialog" @submit.prevent="createDemoKey">
        <header><div><span class="eyebrow-line">DEMO ONLY</span><h3>{{ oneTimeDemoKey ? 'Demo key created' : 'Create API key' }}</h3></div><button class="theme-toggle" type="button" aria-label="Close dialog" @click="showKeyDialog = false; oneTimeDemoKey = ''"><X :size="16" /></button></header>
        <template v-if="oneTimeDemoKey"><p>This is a fake demo value. It cannot access any API and will not be saved after closing.</p><div class="one-time-secret"><code>{{ oneTimeDemoKey }}</code><button type="button" aria-label="Copy demo key" @click="copyDemoKey"><Copy :size="15" /></button></div><button class="primary-action dialog-submit" type="button" @click="showKeyDialog = false; oneTimeDemoKey = ''">Done</button></template>
        <template v-else><label>Key name<input v-model.trim="keyName" required maxlength="48" placeholder="e.g. Inventory sync" /></label><label>Expiration<select v-model="keyExpiration"><option value="30">30 days</option><option value="90">90 days</option><option value="180">180 days</option></select></label><fieldset><legend>Permissions / scopes</legend><label class="scope-choice"><input v-model="keyReadScope" type="checkbox" />products:read</label><label class="scope-choice"><input v-model="keyWriteScope" type="checkbox" />inventory:write</label></fieldset><p class="dialog-warning"><AlertTriangle :size="14" />Demo only. No API credential will be issued.</p><button class="primary-action dialog-submit" type="submit" :disabled="!keyName.trim() || (!keyReadScope && !keyWriteScope)"><Plus :size="15" />Create sample key</button></template>
      </form>
    </div>

    <div v-if="selectedHistoryUser" class="dialog-shade" @click.self="selectedHistoryUser = null">
      <section class="key-dialog history-dialog" role="dialog" aria-modal="true" aria-labelledby="login-history-title">
        <header><div><span class="eyebrow-line">SAMPLE SIGN-IN EVENTS</span><h3 id="login-history-title">{{ selectedHistoryUser.name }}</h3><p>{{ selectedHistoryUser.email }}</p></div><button class="theme-toggle" type="button" aria-label="Close login history" @click="selectedHistoryUser = null"><X :size="16" /></button></header>
        <div class="history-records"><article v-for="record in filteredLoginHistory" :key="record.id"><div><span>{{ record.result === 'Success' ? 'Successful sign-in' : 'Blocked sign-in' }}</span><span class="state-pill" :class="record.result === 'Success' ? 'success' : 'failure'"><i></i>{{ record.result }}</span></div><small>{{ record.time }} · {{ record.location }}</small><small>{{ record.ip }} · {{ record.device }}</small></article><p v-if="!filteredLoginHistory.length" class="empty-history">No sample sign-in events for this account.</p></div>
        <p class="history-disclaimer">Sample records only. Live login history is not available from the backend.</p>
      </section>
    </div>
  </section>
</template>

<style scoped>
.security-center { --sc-bg: #111815; --sc-panel: #1a241e; --sc-raised: #202b24; --sc-border: #35443b; --sc-text: #f2f5ef; --sc-soft: #c3cec5; --sc-muted: #93a198; --sc-accent: #e5c76a; --sc-green: #8bc89c; --sc-yellow: #e3bf69; --sc-red: #f09283; display: flex; min-height: 680px; flex-direction: column; overflow: hidden; border: 1px solid #304037; background: var(--sc-bg); color: var(--sc-text); font-size: 12px; }
.security-nav { display: flex; min-width: 0; align-items: center; gap: 16px; border-bottom: 1px solid var(--sc-border); padding: 8px 12px; background: #151e19; }
.security-nav-heading { display: none; flex-direction: column; gap: 6px; padding: 2px 12px 22px; }
.security-nav-heading > span, .eyebrow-line { color: var(--sc-muted); font-size: 9px; font-weight: 700; letter-spacing: 1.2px; }
.security-nav-heading > strong { font-size: 14px; }
.security-nav nav { display: flex; min-width: 0; flex: 1; align-items: center; gap: 3px; overflow-x: auto; scrollbar-width: thin; }
.security-nav nav button { display: flex; min-height: 34px; flex: 0 0 auto; align-items: center; gap: 7px; border: 0; border-radius: 4px; padding: 0 9px; color: var(--sc-soft); background: transparent; cursor: pointer; text-align: left; font-size: 9px; }
.security-nav nav button:hover { background: #202b24; color: var(--sc-text); }
.security-nav nav button.active { color: var(--sc-text); background: #2a3930; }
.security-nav nav button.active svg { color: var(--sc-accent); }
.security-nav nav button > span { min-width: 0; flex: 1; }
.nav-count { display: grid; min-width: 17px; height: 17px; place-items: center; border-radius: 50%; color: #211b10; background: var(--sc-yellow); font-size: 9px; font-style: normal; font-weight: 700; }
.security-nav-foot { display: none; align-items: center; gap: 8px; margin-top: auto; padding: 13px 9px 2px; border-top: 1px solid var(--sc-border); color: var(--sc-muted); font-size: 9px; }
.security-nav-foot svg { color: var(--sc-green); }
.security-content { min-width: 0; background: var(--sc-bg); }
.security-toolbar { display: flex; min-height: 52px; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--sc-border); padding: 0 24px; }
.security-crumb, .security-toolbar-actions { display: flex; align-items: center; gap: 10px; }
.security-crumb { color: var(--sc-muted); font-size: 10px; }
.security-crumb strong { color: var(--sc-text); font-weight: 600; }
.security-toolbar-actions { gap: 14px; }
.demo-label { display: inline-flex; align-items: center; gap: 6px; color: #d9c482; font-size: 9px; font-weight: 700; }
.demo-label > span, .feed-indicator i, .summary-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--sc-yellow); }
.theme-toggle { display: inline-grid; width: 31px; height: 31px; place-items: center; border: 1px solid var(--sc-border); border-radius: 4px; color: var(--sc-soft); background: transparent; cursor: pointer; }
.theme-toggle:hover { background: var(--sc-raised); color: var(--sc-text); }
.admin-avatar { display: grid; width: 28px; height: 28px; place-items: center; border: 1px solid #64826d; border-radius: 50%; color: #c4ddc7; background: #2c4032; font-size: 9px; font-weight: 700; }
.demo-notice { display: flex; align-items: center; gap: 9px; margin: 14px 24px 0; border: 1px solid #71623b; padding: 9px 11px; color: #e6d49e; background: #302b1f; font-size: 10px; }
.demo-notice > svg { flex: 0 0 auto; }
.demo-notice span { flex: 1; }
.demo-notice button { display: grid; width: 25px; height: 25px; place-items: center; border: 0; color: inherit; background: transparent; cursor: pointer; }
.security-main { padding: 22px 24px 35px; }
.security-page-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin: 0 0 17px; }
.security-page-heading h2 { display: flex; align-items: center; gap: 10px; margin: 5px 0 4px; font-size: 22px; font-weight: 600; letter-spacing: 0; line-height: 1.25; }
.security-page-heading p { margin: 0; color: var(--sc-muted); font-size: 10px; line-height: 1.6; }
.heading-count { border: 1px solid #69463e; border-radius: 20px; padding: 4px 8px; color: #f3a394; background: #402b27; font-size: 9px; font-weight: 600; }
.quiet-button, .primary-action, .danger-outline, .filter-button { display: inline-flex; min-height: 34px; align-items: center; justify-content: center; gap: 7px; border: 1px solid var(--sc-border); border-radius: 4px; padding: 0 11px; color: var(--sc-soft); background: var(--sc-panel); cursor: pointer; white-space: nowrap; font-size: 10px; font-weight: 600; }
.quiet-button:hover, .filter-button:hover { color: var(--sc-text); background: var(--sc-raised); }
.primary-action { border-color: #d7bd67; color: #1c2119; background: var(--sc-accent); }
.primary-action:hover { background: #f0d985; }
.primary-action:disabled { opacity: .45; cursor: not-allowed; }
.danger-outline { border-color: #765047; color: #f0a294; background: #2a201e; }
.danger-outline:hover { background: #3a2926; }
.posture-banner { display: flex; align-items: center; gap: 12px; margin-bottom: 13px; border: 1px solid #355a42; padding: 12px 14px; background: #1a2a20; }
.posture-icon { display: grid; width: 34px; height: 34px; flex: 0 0 auto; place-items: center; border-radius: 50%; color: var(--sc-green); background: #284533; }
.posture-banner > div:nth-child(2) { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 3px; }
.posture-banner strong { font-size: 11px; }
.posture-banner span { color: #a7b7aa; font-size: 9px; line-height: 1.45; }
.posture-status { display: inline-flex; align-items: center; gap: 6px; color: var(--sc-green); font-size: 8px; font-weight: 800; letter-spacing: .7px; white-space: nowrap; }
.posture-status i, .state-pill i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.security-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 9px; }
.security-metric { min-width: 0; border: 1px solid var(--sc-border); padding: 12px; background: var(--sc-panel); }
.security-metric > div { display: flex; align-items: center; justify-content: space-between; gap: 6px; color: var(--sc-muted); font-size: 9px; }
.security-metric strong { display: block; margin-top: 12px; font-size: 22px; font-weight: 600; }
.security-metric small { display: block; margin-top: 4px; color: var(--sc-muted); font-size: 9px; }
.metric-secure > div svg { color: var(--sc-green); }.metric-warning > div svg { color: var(--sc-yellow); }.metric-critical > div svg { color: var(--sc-red); }
.metric-critical { border-color: #583a35; }
.security-overview-grid { display: grid; grid-template-columns: 1.2fr .8fr; gap: 12px; margin-top: 13px; }
.panel { min-width: 0; border: 1px solid var(--sc-border); background: var(--sc-panel); }
.login-panel, .alert-summary, .overview-audit { padding: 15px; }
.panel-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.panel-heading h3, .settings-heading h3 { margin: 0; font-size: 12px; font-weight: 600; }
.panel-heading p, .settings-heading p { margin: 4px 0 0; color: var(--sc-muted); font-size: 9px; line-height: 1.5; }
.range-tag { display: inline-flex; align-items: center; gap: 4px; border: 1px solid var(--sc-border); padding: 5px 7px; color: var(--sc-soft); font-size: 9px; }
.chart-legend { display: flex; justify-content: flex-end; gap: 13px; margin: 9px 0 3px; color: var(--sc-muted); font-size: 8px; }
.chart-legend span { display: inline-flex; align-items: center; gap: 5px; }.chart-legend i { width: 7px; height: 7px; border-radius: 2px; }.legend-success { background: #73b988; }.legend-failed { background: #d77969; }
.login-chart { display: flex; height: 126px; align-items: stretch; justify-content: space-around; gap: 12px; border-bottom: 1px solid var(--sc-border); padding: 8px 5px 0; }
.chart-day { display: flex; min-width: 18px; flex: 1; flex-direction: column; align-items: center; justify-content: flex-end; gap: 6px; }
.bar-stack { display: flex; width: min(24px, 70%); height: 100%; align-items: flex-end; justify-content: center; gap: 3px; border-bottom: 1px solid #3a4940; }
.bar-stack span { width: 8px; min-height: 3px; border-radius: 2px 2px 0 0; }.bar-success { background: #73b988; }.bar-failed { background: #d77969; }
.chart-day small { color: var(--sc-muted); font-size: 8px; }
.inline-link { display: inline-flex; align-items: center; gap: 5px; border: 0; padding: 3px 0; color: var(--sc-accent); background: transparent; cursor: pointer; font-size: 9px; font-weight: 600; white-space: nowrap; }
.alert-summary-row { display: flex; width: 100%; align-items: center; gap: 9px; border: 0; border-bottom: 1px solid var(--sc-border); padding: 11px 0; color: var(--sc-soft); background: transparent; cursor: pointer; text-align: left; }
.alert-summary-row:last-child { border-bottom: 0; padding-bottom: 2px; }.alert-summary-row > span:nth-child(2) { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 4px; }.alert-summary-row strong { overflow: hidden; color: var(--sc-text); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }.alert-summary-row small { color: var(--sc-muted); font-size: 8px; }
.severity-dot { width: 7px; height: 7px; flex: 0 0 auto; border-radius: 50%; }.severity-critical.severity-dot { background: var(--sc-red); }.severity-high.severity-dot { background: #eea07c; }.severity-medium.severity-dot { background: var(--sc-yellow); }.severity-low.severity-dot { background: var(--sc-green); }
.empty-inline { display: flex; align-items: center; gap: 8px; padding: 17px 0 4px; color: var(--sc-green); font-size: 10px; }
.overview-audit { margin-top: 12px; }.activity-list { margin-top: 8px; }.activity-row { display: flex; align-items: center; gap: 9px; border-bottom: 1px solid var(--sc-border); padding: 9px 0; }.activity-row:last-child { border-bottom: 0; padding-bottom: 0; }.activity-mark { display: grid; width: 27px; height: 27px; flex: 0 0 auto; place-items: center; border: 1px solid var(--sc-border); border-radius: 50%; color: var(--sc-yellow); background: var(--sc-raised); }.activity-row > div { min-width: 0; flex: 1; }.activity-row strong, .activity-row small { display: block; }.activity-row strong { font-size: 9px; }.activity-row strong span { color: var(--sc-soft); font-weight: 400; }.activity-row small { margin-top: 3px; color: var(--sc-muted); font-size: 8px; }.activity-row time { color: var(--sc-muted); font-size: 8px; white-space: nowrap; }
.user-summary-strip, .session-summary { display: flex; flex-wrap: wrap; align-items: center; gap: 14px 24px; margin-bottom: 12px; color: var(--sc-muted); font-size: 9px; }.user-summary-strip > span, .session-summary > span { display: inline-flex; align-items: center; gap: 6px; }.user-summary-strip strong, .session-summary strong { color: var(--sc-text); }
.summary-dot.green { background: var(--sc-green); }.summary-dot.red { background: var(--sc-red); }
.data-panel { padding: 0 13px; }.table-tools { display: flex; align-items: center; gap: 8px; padding: 12px 0; }
.table-search { display: flex; min-width: 150px; height: 34px; flex: 1; align-items: center; gap: 7px; border: 1px solid var(--sc-border); padding: 0 9px; color: var(--sc-muted); background: var(--sc-bg); }.table-search input { width: 100%; min-width: 0; border: 0; outline: 0; color: var(--sc-text); background: transparent; font-size: 9px; }.table-search input::placeholder { color: var(--sc-muted); }
.filter-button { min-height: 34px; font-size: 9px; }.table-scroll { width: 100%; overflow-x: auto; }.security-table { width: 100%; border-collapse: collapse; text-align: left; white-space: nowrap; }.security-table th { border-top: 1px solid var(--sc-border); border-bottom: 1px solid var(--sc-border); padding: 10px 9px; color: var(--sc-muted); font-size: 8px; font-weight: 600; }.security-table td { border-bottom: 1px solid var(--sc-border); padding: 10px 9px; color: var(--sc-soft); font-size: 9px; }.security-table tbody tr:last-child td { border-bottom: 0; }.security-table td > strong, .security-table td > small { display: block; }.security-table td > strong { color: var(--sc-text); font-size: 9px; font-weight: 600; }.security-table td > small { margin-top: 4px; color: var(--sc-muted); font-size: 8px; }
.user-cell { display: flex; align-items: center; gap: 8px; }.user-cell > span:last-child { display: block; }.user-cell strong, .user-cell small { display: block; }.user-cell strong { color: var(--sc-text); font-size: 9px; }.user-cell small { margin-top: 3px; color: var(--sc-muted); font-size: 8px; }.user-initials { display: grid; width: 27px; height: 27px; flex: 0 0 auto; place-items: center; border-radius: 50%; color: #cfdecf; background: #314437; font-size: 8px; font-weight: 700; }
.role-pill, .severity-pill, .read-only-tag { display: inline-flex; align-items: center; gap: 5px; border: 1px solid var(--sc-border); border-radius: 3px; padding: 4px 6px; color: var(--sc-soft); font-size: 8px; }.state-pill { display: inline-flex; align-items: center; gap: 5px; color: var(--sc-muted); font-size: 8px; }.state-pill.active, .state-pill.success { color: var(--sc-green); }.state-pill.suspended, .state-pill.failure, .state-pill.revoked, .state-pill.failed { color: var(--sc-red); }.state-pill.open { color: var(--sc-yellow); }.state-pill.reviewed { color: #a8b5eb; }
.mfa-state { display: inline-flex; align-items: center; gap: 4px; color: var(--sc-muted); font-size: 8px; }.mfa-state.enabled { color: var(--sc-green); }.row-action { border: 0; padding: 4px 0; color: var(--sc-accent); background: transparent; cursor: pointer; font-size: 8px; font-weight: 600; }.row-action:hover { text-decoration: underline; }.row-action:disabled { color: var(--sc-muted); cursor: not-allowed; text-decoration: none; }.danger-text { color: var(--sc-red); }
.user-role-select { max-width: 112px; border: 1px solid var(--sc-border); border-radius: 3px; padding: 5px 17px 5px 6px; color: var(--sc-soft); background: var(--sc-bg); font-size: 8px; }.user-row-actions { display: flex; align-items: center; gap: 8px; }
.table-footer { display: flex; min-height: 41px; align-items: center; justify-content: space-between; gap: 10px; border-top: 1px solid var(--sc-border); color: var(--sc-muted); font-size: 8px; }.table-footer > div { display: flex; align-items: center; gap: 11px; }.table-footer button { border: 0; color: var(--sc-soft); background: transparent; cursor: pointer; font-size: 8px; }.table-footer button:disabled { color: #647169; cursor: default; }.table-empty { padding: 26px !important; color: var(--sc-muted) !important; text-align: center; }
.role-warning, .key-security-note { display: flex; align-items: flex-start; gap: 9px; margin-bottom: 12px; border: 1px solid #6a5c38; padding: 10px 12px; color: #e2d29f; background: #302b1f; font-size: 9px; line-height: 1.55; }.role-warning svg, .key-security-note svg { flex: 0 0 auto; margin-top: 1px; }.role-warning strong { color: #f0dfa5; }.permission-table { min-width: 900px; }.permission-table th, .permission-table td { text-align: center; }.permission-table th:first-child, .permission-table td:first-child { min-width: 130px; text-align: left; }.permission-table td:first-child strong { color: var(--sc-text); }.permission-table input { width: 14px; height: 14px; accent-color: var(--sc-accent); }.permission-table input:disabled { opacity: .5; }.panel-footnote { display: flex; align-items: center; gap: 6px; border-top: 1px solid var(--sc-border); padding: 10px 0; color: var(--sc-muted); font-size: 8px; }
.audit-filters, .alert-filter-row { display: flex; align-items: center; gap: 8px; margin-bottom: 11px; }.audit-filters select, .audit-filters input, .alert-filter-row select { height: 34px; min-width: 118px; border: 1px solid var(--sc-border); border-radius: 3px; padding: 0 8px; color: var(--sc-soft); background: var(--sc-panel); font-size: 9px; }.audit-filters input[type='date'] { min-width: 120px; color-scheme: dark; }.audit-filters .table-search, .alert-filter-row .table-search { max-width: 300px; }.read-only-tag { flex: 0 0 auto; color: var(--sc-muted); }.mono-id, .key-mask { font-family: 'DM Mono', Consolas, monospace; font-size: 8px !important; }.change-detail { display: flex !important; align-items: center; gap: 5px; color: var(--sc-soft) !important; }.change-detail svg { flex: 0 0 auto; }.severity-pill { border-color: transparent; }.severity-critical { color: var(--sc-red); background: #482e2a; }.severity-high { color: #f0aa83; background: #49332a; }.severity-medium { color: var(--sc-yellow); background: #403a25; }.severity-low { color: var(--sc-green); background: #273a2d; }
.feed-indicator { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; color: var(--sc-muted); font-size: 8px; font-weight: 700; letter-spacing: .6px; }.feed-indicator i { background: var(--sc-yellow); }.alert-list { display: grid; gap: 8px; }.alert-card { display: flex; align-items: flex-start; gap: 12px; padding: 13px; }.alert-critical { border-left: 2px solid var(--sc-red); }.alert-high { border-left: 2px solid #eea07c; }.alert-medium { border-left: 2px solid var(--sc-yellow); }.alert-low { border-left: 2px solid var(--sc-green); }.alert-icon { display: grid; width: 30px; height: 30px; flex: 0 0 auto; place-items: center; color: var(--sc-yellow); background: var(--sc-raised); }.alert-critical .alert-icon { color: var(--sc-red); }.alert-copy { min-width: 0; flex: 1; }.alert-title-row { display: flex; align-items: center; gap: 8px; }.alert-title-row h3 { margin: 0; color: var(--sc-text); font-size: 11px; }.alert-copy p { margin: 5px 0; color: var(--sc-soft); font-size: 9px; line-height: 1.5; }.alert-copy > small { color: var(--sc-muted); font-size: 8px; }.alert-actions { display: flex; align-items: center; gap: 11px; padding-top: 2px; }.resolve-action { display: inline-flex; align-items: center; gap: 4px; border: 0; color: var(--sc-green); background: transparent; cursor: pointer; font-size: 8px; }.resolved-icon { color: var(--sc-green); }.empty-panel { padding: 22px; color: var(--sc-muted); text-align: center; }
.session-summary { border: 1px solid var(--sc-border); padding: 10px 12px; background: var(--sc-panel); }.session-list { display: grid; gap: 8px; }.session-card { display: flex; align-items: flex-start; gap: 11px; padding: 13px; }.device-icon { display: grid; width: 33px; height: 33px; flex: 0 0 auto; place-items: center; border: 1px solid var(--sc-border); color: var(--sc-accent); background: var(--sc-raised); }.session-info { min-width: 0; flex: 1; }.session-info > div { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }.session-info strong { color: var(--sc-text); font-size: 10px; }.session-info small, .session-info p { display: block; margin: 4px 0 0; color: var(--sc-muted); font-size: 8px; }.session-info p { color: var(--sc-soft); font-size: 9px; }.current-session { border: 1px solid #3a684a; border-radius: 2px; padding: 3px 5px; color: var(--sc-green); font-size: 7px; font-weight: 700; letter-spacing: .4px; }.session-last { display: flex; align-items: flex-end; flex-direction: column; gap: 6px; color: var(--sc-muted); font-size: 8px; }.session-last strong { color: var(--sc-soft); font-size: 9px; }.scope-list { display: flex; flex-wrap: wrap; gap: 3px; }.scope-list span { border: 1px solid var(--sc-border); border-radius: 2px; padding: 3px 4px; color: var(--sc-soft); font-size: 7px; }.key-mask { color: #d1c188 !important; letter-spacing: .3px; }
.backup-status { display: flex; align-items: center; gap: 11px; margin-bottom: 10px; border: 1px solid #355a42; padding: 13px; background: #1a2a20; }.backup-status-icon { display: grid; width: 33px; height: 33px; flex: 0 0 auto; place-items: center; border-radius: 50%; color: var(--sc-green); background: #284533; }.backup-status > div:nth-child(2) { display: flex; flex: 1; flex-direction: column; gap: 3px; }.backup-status > div:nth-child(2) > span, .backup-status small { color: #a7b7aa; font-size: 8px; }.backup-status strong { font-size: 11px; }.backup-config-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 9px; margin-bottom: 12px; }.backup-config { display: flex; flex-direction: column; gap: 6px; padding: 12px; }.backup-config > span, .backup-config small { color: var(--sc-muted); font-size: 8px; }.backup-config strong { font-size: 10px; }.backup-config .warning-number { color: var(--sc-yellow); }.data-panel > .panel-heading { padding: 13px 0 0 9px; }.restore-warning { margin-top: 12px; }
.settings-layout { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(210px, .6fr); align-items: start; gap: 12px; }.settings-groups { display: grid; gap: 10px; }.settings-panel { padding: 13px; }.settings-heading { display: flex; align-items: center; gap: 9px; padding-bottom: 10px; }.settings-icon { display: grid; width: 30px; height: 30px; flex: 0 0 auto; place-items: center; color: var(--sc-accent); background: var(--sc-raised); }.setting-row { display: flex; min-height: 48px; align-items: center; justify-content: space-between; gap: 12px; border-top: 1px solid var(--sc-border); padding: 8px 0; }.setting-row > span { display: flex; min-width: 0; flex-direction: column; gap: 3px; }.setting-row strong { color: var(--sc-text); font-size: 9px; font-weight: 600; }.setting-row small { color: var(--sc-muted); font-size: 8px; line-height: 1.4; }.setting-row select, .setting-row textarea { max-width: 180px; border: 1px solid var(--sc-border); border-radius: 3px; padding: 7px; color: var(--sc-soft); background: var(--sc-bg); font-size: 8px; }.setting-row textarea { width: 145px; resize: vertical; }.setting-row textarea::placeholder { color: var(--sc-muted); }.switch-input { width: 29px; height: 16px; flex: 0 0 auto; accent-color: #7ec48f; }.settings-side { display: grid; gap: 9px; }.settings-checklist { padding: 13px; }.settings-checklist h3 { margin: 0 0 10px; font-size: 11px; }.settings-checklist p { display: flex; align-items: center; gap: 7px; margin: 9px 0; color: var(--sc-soft); font-size: 8px; }.settings-checklist p svg { flex: 0 0 auto; color: var(--sc-green); }.settings-checklist p.not-live { color: #e1c675; }.settings-checklist p.not-live svg { color: var(--sc-yellow); }.settings-demo-callout { display: flex; align-items: flex-start; gap: 7px; border: 1px solid #6a5c38; padding: 10px; color: #e2d29f; background: #302b1f; font-size: 8px; line-height: 1.5; }.settings-demo-callout svg { flex: 0 0 auto; }
.dialog-shade { position: fixed; z-index: 100; inset: 0; display: grid; place-items: center; overflow-y: auto; padding: 16px; background: #090d0bd9; }.key-dialog { width: min(410px, 100%); border: 1px solid var(--sc-border); padding: 20px; color: var(--sc-text); background: #18221c; box-shadow: 0 18px 65px #0008; }.key-dialog > header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 15px; }.key-dialog h3 { margin: 6px 0 0; font-size: 17px; }.key-dialog > p { color: var(--sc-soft); font-size: 10px; line-height: 1.6; }.key-dialog > label { display: flex; flex-direction: column; gap: 6px; margin: 11px 0; color: var(--sc-soft); font-size: 9px; }.key-dialog > label input, .key-dialog > label select { min-height: 37px; border: 1px solid var(--sc-border); border-radius: 3px; padding: 0 9px; color: var(--sc-text); background: var(--sc-bg); font-size: 10px; }.key-dialog fieldset { display: flex; gap: 13px; border: 1px solid var(--sc-border); margin: 14px 0; padding: 9px; }.key-dialog legend { padding: 0 4px; color: var(--sc-muted); font-size: 8px; }.scope-choice { display: flex; align-items: center; gap: 5px; color: var(--sc-soft); font-size: 8px; }.scope-choice input { accent-color: var(--sc-accent); }.dialog-warning { display: flex; align-items: center; gap: 7px; color: #e3c77d !important; }.dialog-submit { width: 100%; margin-top: 8px; }.one-time-secret { display: flex; align-items: center; gap: 8px; border: 1px solid var(--sc-border); padding: 9px; background: var(--sc-bg); }.one-time-secret code { min-width: 0; flex: 1; overflow-wrap: anywhere; color: var(--sc-accent); font-size: 9px; }.one-time-secret button { display: grid; width: 30px; height: 30px; flex: 0 0 auto; place-items: center; border: 1px solid var(--sc-border); color: var(--sc-soft); background: var(--sc-panel); cursor: pointer; }
.history-dialog > header p { margin: 5px 0 0; color: var(--sc-muted); font-size: 9px; }.history-records { display: grid; max-height: 55vh; gap: 8px; overflow-y: auto; }.history-records article { display: grid; gap: 5px; border: 1px solid var(--sc-border); padding: 10px; }.history-records article > div { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--sc-text); font-size: 9px; font-weight: 600; }.history-records article > small { color: var(--sc-muted); font-size: 8px; }.history-disclaimer, .empty-history { color: var(--sc-muted); font-size: 9px; line-height: 1.5; }.is-light .history-records article { background: #f6f8f6; }
.security-toast { position: fixed; z-index: 120; right: 22px; bottom: 22px; display: flex; align-items: center; gap: 8px; max-width: min(380px, calc(100vw - 32px)); border: 1px solid #4b684e; padding: 11px 14px; color: #c8e2c8; background: #1c3022; box-shadow: 0 9px 25px #0005; font-size: 10px; }.security-toast svg { flex: 0 0 auto; }.toast-enter-active, .toast-leave-active { transition: opacity .18s ease, transform .18s ease; }.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(7px); }
.security-center.is-light { --sc-bg: #f2f4f1; --sc-panel: #fff; --sc-raised: #e9eeea; --sc-border: #d8e0da; --sc-text: #24332a; --sc-soft: #536258; --sc-muted: #75837a; --sc-accent: #b58c22; --sc-green: #287b43; --sc-yellow: #946c0a; --sc-red: #b63e32; border-color: var(--sc-border); }.is-light .security-nav { background: #e8ede9; }.is-light .security-nav nav button:hover { background: #dde5de; }.is-light .security-nav nav button.active { background: #dce8df; }.is-light .admin-avatar { color: #285639; background: #d7e8da; }.is-light .demo-notice, .is-light .role-warning, .is-light .key-security-note, .is-light .settings-demo-callout { border-color: #ddcf9c; color: #6a5520; background: #fbf7e9; }.is-light .posture-banner, .is-light .backup-status { border-color: #b8d6be; background: #eef7ef; }.is-light .posture-banner span, .is-light .backup-status > div:nth-child(2) > span, .is-light .backup-status small { color: #607766; }.is-light .alert-summary-row:hover { background: #f3f6f3; }.is-light .alert-critical .alert-icon { background: #faecea; }.is-light .alert-medium .alert-icon, .is-light .alert-high .alert-icon { background: #faf4e6; }.is-light .user-initials { color: #285639; background: #dceade; }.is-light .severity-critical { background: #f9e5e2; }.is-light .severity-high { background: #f8ece5; }.is-light .severity-medium { background: #f7f0dc; }.is-light .severity-low { background: #e7f3e9; }.is-light .audit-filters input[type='date'] { color-scheme: light; }.is-light .dialog-shade { background: #17221ccc; }.is-light .key-dialog { background: #fff; }.is-light .key-dialog > label input, .is-light .key-dialog > label select { color: var(--sc-text); background: var(--sc-bg); }.is-light .role-warning strong { color: #574513; }
@media (max-width: 1050px) { .security-center { grid-template-columns: 190px minmax(0, 1fr); }.security-main { padding-right: 17px; padding-left: 17px; }.security-toolbar { padding-right: 17px; padding-left: 17px; }.demo-notice { margin-right: 17px; margin-left: 17px; }.security-metrics { grid-template-columns: repeat(4, minmax(0, 1fr)); }.security-overview-grid { grid-template-columns: 1fr; } }
@media (max-width: 760px) { .security-center { display: flex; min-height: 0; flex-direction: column; }.security-nav { position: sticky; z-index: 5; top: 40px; padding: 8px 8px 0; border-right: 0; border-bottom: 1px solid var(--sc-border); }.security-nav-heading, .security-nav-foot { display: none; }.security-nav nav { display: flex; overflow-x: auto; gap: 3px; scrollbar-width: thin; }.security-nav nav button { min-width: max-content; min-height: 38px; flex-direction: column; justify-content: center; gap: 2px; padding: 3px 9px; font-size: 8px; }.security-nav nav button svg { width: 14px; height: 14px; }.nav-count { position: absolute; top: 0; right: 2px; min-width: 13px; height: 13px; font-size: 7px; }.security-toolbar { min-height: 45px; }.security-toolbar-actions { gap: 8px; }.demo-label { font-size: 0; }.demo-label > span { width: 8px; height: 8px; }.demo-notice { align-items: flex-start; font-size: 9px; }.demo-notice button { flex: 0 0 auto; }.security-main { padding: 17px 12px 25px; }.security-page-heading { align-items: flex-start; }.security-page-heading h2 { font-size: 19px; }.security-page-heading p { max-width: 420px; }.security-page-heading > button { min-height: 32px; padding: 0 8px; font-size: 8px; }.security-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }.security-metric { padding: 10px; }.security-metric strong { font-size: 20px; }.security-overview-grid { gap: 9px; }.overview-audit { margin-top: 9px; }.user-summary-strip, .session-summary { gap: 8px 13px; }.table-tools { flex-wrap: wrap; }.table-search { flex-basis: 100%; }.filter-button { flex: 1; }.audit-filters, .alert-filter-row { flex-wrap: wrap; }.audit-filters .table-search, .alert-filter-row .table-search { max-width: none; flex-basis: 100%; }.audit-filters select, .audit-filters input, .alert-filter-row select { min-width: calc(50% - 5px); flex: 1; }.read-only-tag { margin-left: auto; }.security-table { min-width: 750px; }.permission-table { min-width: 900px; }.alert-card { flex-wrap: wrap; }.alert-copy { flex-basis: calc(100% - 45px); }.alert-actions { margin-left: 40px; }.session-card { flex-wrap: wrap; }.session-info { flex-basis: calc(100% - 48px); }.session-last { width: 100%; flex-direction: row; align-items: center; justify-content: flex-end; }.backup-config-grid { grid-template-columns: 1fr; }.backup-config { display: grid; grid-template-columns: 1fr 1fr; }.backup-config small { grid-column: span 2; }.settings-layout { grid-template-columns: 1fr; }.settings-side { grid-template-columns: 1fr; }.table-footer { font-size: 8px; }.security-toast { right: 12px; bottom: 12px; } }
@media (max-width: 420px) { .security-toolbar { padding-right: 10px; padding-left: 10px; }.security-crumb { gap: 6px; font-size: 9px; }.security-toolbar-actions { gap: 6px; }.admin-avatar { width: 25px; height: 25px; }.demo-notice { margin-right: 10px; margin-left: 10px; }.security-main { padding-right: 9px; padding-left: 9px; }.security-page-heading { gap: 8px; }.security-page-heading > button { font-size: 0; }.security-page-heading > button svg { width: 16px; height: 16px; }.posture-banner { align-items: flex-start; flex-wrap: wrap; }.posture-status { margin-left: 46px; }.security-overview-grid .panel { padding: 11px; }.alert-title-row { flex-wrap: wrap; }.setting-row { align-items: flex-start; }.setting-row > span { flex: 1; }.setting-row select { max-width: 130px; }.setting-row textarea { width: 120px; } }
</style>
