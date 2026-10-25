<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  ShieldCheck, Lock, Unlock, Scale, AlertTriangle, CheckCircle2,
  ExternalLink, Search, RefreshCw, Send, Check, Clock
} from 'lucide-vue-next';
import { api, apiErrorMessage } from '../services/api';

type AdminEscrowRecord = {
  id: string;
  orderId: string;
  contractAddress: string;
  contractNetwork: string;
  txHash?: string;
  releaseTxHash?: string;
  refundTxHash?: string;
  disputeReason?: string;
  buyerAddress: string;
  sellerAddress: string;
  arbiterAddress: string;
  amount: number | string;
  bakongMd5?: string;
  status: 'INITIATED' | 'FUNDS_LOCKED' | 'DISPATCHED' | 'RELEASED' | 'DISPUTED' | 'REFUNDED';
  inspectionDays: number;
  autoReleaseAt?: string;
  lockedAt?: string;
  dispatchedAt?: string;
  releasedAt?: string;
  refundedAt?: string;
  createdAt: string;
  order: {
    orderNumber: string;
    customerName: string;
    customerPhone: string;
    total: number | string;
    status: string;
    createdAt: string;
    items: { productNameEn: string; productNameKm: string; quantity: number }[];
  };
};

type EscrowStats = {
  total: number;
  initiated: number;
  fundsLocked: number;
  dispatched: number;
  released: number;
  disputed: number;
  refunded: number;
};

const props = defineProps<{ locale: string; lightMode: boolean }>();

const isKhmer = computed(() => props.locale === 'km');
const money = (val: number | string) =>
  new Intl.NumberFormat(isKhmer.value ? 'km-KH' : 'en-US', { style: 'currency', currency: 'USD' }).format(Number(val));

const loading = ref(false);
const error = ref('');
const successMessage = ref('');
const escrows = ref<AdminEscrowRecord[]>([]);
const stats = ref<EscrowStats>({ total: 0, initiated: 0, fundsLocked: 0, dispatched: 0, released: 0, disputed: 0, refunded: 0 });

const filterStatus = ref<string>('all');
const searchInput = ref<string>('');

// Modals
const actionLoading = ref(false);
const showDispatchModal = ref(false);
const showResolveModal = ref(false);
const selectedEscrow = ref<AdminEscrowRecord | null>(null);

const inspectionDaysInput = ref(3);
const disputeResolution = ref<'RELEASE_TO_SELLER' | 'REFUND_TO_BUYER'>('RELEASE_TO_SELLER');
const disputeNotes = ref('');

async function loadEscrows() {
  loading.value = true;
  error.value = '';
  try {
    const params: Record<string, string> = {};
    if (filterStatus.value !== 'all') params.status = filterStatus.value;
    if (searchInput.value.trim()) params.search = searchInput.value.trim();

    const { data } = await api.get('/admin/escrows', { params });
    escrows.value = data.data.escrows;
    stats.value = data.data.stats;
  } catch (err) {
    error.value = apiErrorMessage(err) || 'Failed to load escrows';
  } finally {
    loading.value = false;
  }
}

function openDispatchModal(escrow: AdminEscrowRecord) {
  selectedEscrow.value = escrow;
  inspectionDaysInput.value = escrow.inspectionDays || 3;
  showDispatchModal.value = true;
}

function openResolveModal(escrow: AdminEscrowRecord) {
  selectedEscrow.value = escrow;
  disputeResolution.value = 'RELEASE_TO_SELLER';
  disputeNotes.value = '';
  showResolveModal.value = true;
}

async function submitDispatch() {
  if (!selectedEscrow.value) return;
  actionLoading.value = true;
  error.value = '';
  successMessage.value = '';
  try {
    const { data } = await api.post(`/admin/escrows/${encodeURIComponent(selectedEscrow.value.order.orderNumber)}/dispatch`, {
      inspectionDays: inspectionDaysInput.value
    });
    successMessage.value = data.data.message || 'Order dispatched!';
    showDispatchModal.value = false;
    await loadEscrows();
  } catch (err) {
    error.value = apiErrorMessage(err) || 'Failed to dispatch';
  } finally {
    actionLoading.value = false;
  }
}

async function submitResolve() {
  if (!selectedEscrow.value) return;
  actionLoading.value = true;
  error.value = '';
  successMessage.value = '';
  try {
    const { data } = await api.post(`/admin/escrows/${encodeURIComponent(selectedEscrow.value.order.orderNumber)}/resolve`, {
      resolution: disputeResolution.value,
      notes: disputeNotes.value.trim() || 'Arbitrated by administrator'
    });
    successMessage.value = data.data.message || 'Dispute resolved!';
    showResolveModal.value = false;
    await loadEscrows();
  } catch (err) {
    error.value = apiErrorMessage(err) || 'Failed to resolve dispute';
  } finally {
    actionLoading.value = false;
  }
}

onMounted(loadEscrows);
</script>

<template>
  <div class="admin-escrow-desk">
    <div class="desk-header">
      <div>
        <span class="eyebrow"><ShieldCheck :size="14" /> SMART CONTRACT PROTOCOL</span>
        <h2>{{ isKhmer ? 'តុគ្រប់គ្រងកិច្ចសន្យាធានាប្រាក់ Bakong Escrow' : 'Bakong Smart Contract Escrow Desk' }}</h2>
        <p>{{ isKhmer ? 'តាមដាន និងគ្រប់គ្រងការចាក់សោប្រាក់ ការផ្ញើទំនិញ និងការដោះស្រាយវិវាទលើ Smart Contract' : 'Monitor on-chain escrow locks, dispatch inspection windows, and arbitrate buyer-seller disputes.' }}</p>
      </div>
      <button class="button button-outline refresh-btn" type="button" :disabled="loading" @click="loadEscrows">
        <RefreshCw :size="14" :class="{ 'spin-icon': loading }" /> Refresh
      </button>
    </div>

    <!-- Feedback Banner -->
    <div v-if="successMessage" class="feedback-banner success" role="status">
      <CheckCircle2 :size="18" /> {{ successMessage }}
    </div>
    <div v-if="error" class="feedback-banner error" role="alert">
      <AlertTriangle :size="18" /> {{ error }}
    </div>

    <!-- Stat Tiles -->
    <div class="stat-tiles">
      <div class="stat-card">
        <span class="stat-title">Total Escrow Volume</span>
        <strong class="stat-num">{{ stats.total }}</strong>
        <span class="stat-sub">All time agreements</span>
      </div>
      <div class="stat-card highlight-locked">
        <span class="stat-title"><Lock :size="14" /> Funds Locked</span>
        <strong class="stat-num">{{ stats.fundsLocked }}</strong>
        <span class="stat-sub">Held in smart contract</span>
      </div>
      <div class="stat-card highlight-dispatched">
        <span class="stat-title"><Clock :size="14" /> In Inspection</span>
        <strong class="stat-num">{{ stats.dispatched }}</strong>
        <span class="stat-sub">Awaiting buyer release</span>
      </div>
      <div class="stat-card highlight-disputed">
        <span class="stat-title"><Scale :size="14" /> In Dispute</span>
        <strong class="stat-num">{{ stats.disputed }}</strong>
        <span class="stat-sub">Action required</span>
      </div>
      <div class="stat-card highlight-released">
        <span class="stat-title"><Unlock :size="14" /> Released / Payout</span>
        <strong class="stat-num">{{ stats.released }}</strong>
        <span class="stat-sub">Settled to sellers</span>
      </div>
    </div>

    <!-- Controls / Filters -->
    <div class="table-controls">
      <div class="filter-pills">
        <button
          v-for="st in ['all', 'INITIATED', 'FUNDS_LOCKED', 'DISPATCHED', 'RELEASED', 'DISPUTED', 'REFUNDED']"
          :key="st"
          class="pill-btn"
          :class="{ active: filterStatus === st }"
          @click="filterStatus = st; loadEscrows()"
        >
          {{ st === 'all' ? 'All Escrows' : st }}
        </button>
      </div>

      <div class="search-box">
        <input
          v-model.trim="searchInput"
          type="text"
          placeholder="Filter by Order #, phone, hash..."
          @keyup.enter="loadEscrows"
        />
        <button class="button button-dark" type="button" @click="loadEscrows">
          <Search :size="14" /> Search
        </button>
      </div>
    </div>

    <!-- Table -->
    <div class="table-wrap">
      <table class="admin-escrow-table">
        <thead>
          <tr>
            <th>Order Number</th>
            <th>Customer</th>
            <th>Amount</th>
            <th>Escrow Status</th>
            <th>Bakong MD5</th>
            <th>On-Chain Tx Hash</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in escrows" :key="e.id">
            <td>
              <strong>{{ e.order.orderNumber }}</strong>
              <div class="sku-preview">{{ e.order.items.length }} items</div>
            </td>
            <td>
              <div>{{ e.order.customerName }}</div>
              <small class="phone-muted">{{ e.order.customerPhone }}</small>
            </td>
            <td>
              <strong class="amount-bold">{{ money(e.amount) }}</strong>
            </td>
            <td>
              <span class="escrow-status-pill" :class="`status-${e.status.toLowerCase()}`">
                <i></i> {{ e.status }}
              </span>
            </td>
            <td>
              <code v-if="e.bakongMd5" class="code-sm">{{ e.bakongMd5.slice(0, 10) }}...</code>
              <span v-else class="text-muted">—</span>
            </td>
            <td>
              <code v-if="e.txHash" class="code-sm">{{ e.txHash.slice(0, 10) }}...</code>
              <span v-else class="text-muted">—</span>
            </td>
            <td>
              <span class="date-sm">{{ new Date(e.createdAt).toLocaleDateString() }}</span>
            </td>
            <td>
              <div class="action-cell">
                <button
                  v-if="e.status === 'FUNDS_LOCKED'"
                  class="btn-action btn-dispatch"
                  title="Mark order dispatched and activate inspection countdown"
                  @click="openDispatchModal(e)"
                >
                  <Send :size="12" /> Dispatch
                </button>
                <button
                  v-if="e.status === 'DISPUTED'"
                  class="btn-action btn-arbitrate"
                  title="Arbitrate dispute between buyer and seller"
                  @click="openResolveModal(e)"
                >
                  <Scale :size="12" /> Arbitrate
                </button>
                <RouterLink
                  :to="'/escrow/' + e.order.orderNumber"
                  target="_blank"
                  class="btn-action btn-view"
                  title="Open live on-chain escrow tracker"
                >
                  <ExternalLink :size="12" /> Vault
                </RouterLink>
              </div>
            </td>
          </tr>
          <tr v-if="!escrows.length">
            <td colspan="8" class="empty-cell">No escrow records found matching criteria.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Dispatch Modal -->
    <div v-if="showDispatchModal && selectedEscrow" class="modal-backdrop" @click.self="showDispatchModal = false">
      <div class="modal-box">
        <h3>Dispatch Order & Start Inspection Window</h3>
        <p>Order: <strong>{{ selectedEscrow.order.orderNumber }}</strong> ({{ money(selectedEscrow.amount) }})</p>
        <label class="form-field">
          <span>Inspection Period (Days)</span>
          <input v-model.number="inspectionDaysInput" type="number" min="1" max="14" />
          <small>Buyer will have this many days to inspect goods before funds auto-release.</small>
        </label>
        <div class="modal-actions">
          <button class="button button-outline" type="button" @click="showDispatchModal = false">Cancel</button>
          <button class="button button-dark" type="button" :disabled="actionLoading" @click="submitDispatch">
            {{ actionLoading ? 'Processing...' : 'Confirm Dispatch' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Resolve Dispute Modal -->
    <div v-if="showResolveModal && selectedEscrow" class="modal-backdrop" @click.self="showResolveModal = false">
      <div class="modal-box">
        <h3>Arbitrate Escrow Dispute</h3>
        <div class="dispute-quote">
          <strong>Buyer Reason:</strong>
          <p>"{{ selectedEscrow.disputeReason || 'No details provided' }}"</p>
        </div>
        <fieldset class="resolution-choice">
          <legend>Arbitration Ruling</legend>
          <label>
            <input v-model="disputeResolution" type="radio" value="RELEASE_TO_SELLER" />
            <span><strong>Release to Seller</strong> (Goods delivered satisfactorily)</span>
          </label>
          <label>
            <input v-model="disputeResolution" type="radio" value="REFUND_TO_BUYER" />
            <span><strong>Refund to Buyer</strong> (Goods damaged / not delivered)</span>
          </label>
        </fieldset>
        <label class="form-field">
          <span>Arbitration Notes / Ruling *</span>
          <textarea v-model.trim="disputeNotes" rows="2" placeholder="Explain the ruling for audit records..."></textarea>
        </label>
        <div class="modal-actions">
          <button class="button button-outline" type="button" @click="showResolveModal = false">Cancel</button>
          <button class="button button-dark" type="button" :disabled="actionLoading" @click="submitResolve">
            {{ actionLoading ? 'Submitting Ruling...' : 'Execute Arbitration Ruling' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-escrow-desk {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.desk-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 1rem;
}
.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: rgba(33, 103, 66, 0.12);
  color: #216742;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 4px;
  margin-bottom: 6px;
}
.desk-header h2 {
  font-size: 1.5rem;
  margin: 0 0 4px;
}
.desk-header p {
  color: #6a7c70;
  margin: 0;
  font-size: 13px;
}

.refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
}

.feedback-banner {
  padding: 10px 14px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.feedback-banner.success { background: #e8f5ed; color: #216742; border: 1px solid #b7e0c8; }
.feedback-banner.error { background: #fdf0f0; color: #b92b27; border: 1px solid #f8c9c7; }

/* Stat Tiles */
.stat-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.stat-card {
  background: var(--admin-card-bg, #fff);
  border: 1px solid var(--admin-border, #e3eae5);
  border-radius: 10px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stat-title {
  font-size: 11px;
  text-transform: uppercase;
  color: #7b8e82;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 5px;
}
.stat-num {
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--admin-text, #172a1e);
}
.stat-sub { font-size: 11px; color: #9aa8a0; }

.highlight-locked .stat-num { color: #258348; }
.highlight-dispatched .stat-num { color: #1a6f8b; }
.highlight-disputed .stat-num { color: #a93226; }
.highlight-released .stat-num { color: #5a3ba1; }

/* Controls */
.table-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}
.filter-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.pill-btn {
  background: #eef3f0;
  border: 1px solid #d5ded8;
  color: #3b5244;
  font-size: 11px;
  font-weight: 600;
  padding: 5px 10px;
  border-radius: 999px;
  cursor: pointer;
}
.pill-btn.active {
  background: #172a1e;
  border-color: #172a1e;
  color: #fff;
}
.search-box {
  display: flex;
  gap: 6px;
}
.search-box input {
  padding: 6px 12px;
  border: 1px solid #d5ded8;
  border-radius: 6px;
  font-size: 12px;
  min-width: 220px;
}

/* Table */
.table-wrap {
  overflow-x: auto;
  background: var(--admin-card-bg, #fff);
  border: 1px solid var(--admin-border, #e3eae5);
  border-radius: 10px;
}
.admin-escrow-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  text-align: left;
}
.admin-escrow-table th {
  background: #f7faf8;
  padding: 10px 14px;
  color: #556b5d;
  font-weight: 700;
  text-transform: uppercase;
  font-size: 10px;
  letter-spacing: 0.04em;
  border-bottom: 1px solid #e3eae5;
}
.admin-escrow-table td {
  padding: 12px 14px;
  border-bottom: 1px solid #eef2ef;
  color: var(--admin-text, #172a1e);
}
.sku-preview { font-size: 11px; color: #88998e; }
.phone-muted { color: #88998e; }
.amount-bold { font-size: 13px; font-weight: 700; color: #216742; }

.escrow-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
}
.escrow-status-pill i { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
.escrow-status-pill.status-initiated { background: #fdf6d8; color: #856404; }
.escrow-status-pill.status-funds_locked { background: #e2f5e8; color: #1e7e34; }
.escrow-status-pill.status-dispatched { background: #e0f2f9; color: #117a8b; }
.escrow-status-pill.status-released { background: #e7e3f8; color: #5a3ba1; }
.escrow-status-pill.status-disputed { background: #fbe6e6; color: #b92b27; }
.escrow-status-pill.status-refunded { background: #eedef5; color: #6f42c1; }

.code-sm {
  font-family: monospace;
  font-size: 11px;
  background: #f0f4f2;
  padding: 2px 5px;
  border-radius: 3px;
}
.date-sm { font-size: 11px; color: #6a7c70; }

.action-cell {
  display: flex;
  gap: 6px;
}
.btn-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  border: 1px solid transparent;
}
.btn-dispatch { background: #e0f2f9; color: #117a8b; border-color: #b8e2f2; }
.btn-dispatch:hover { background: #117a8b; color: #fff; }
.btn-arbitrate { background: #fbe6e6; color: #b92b27; border-color: #f7c3c2; }
.btn-arbitrate:hover { background: #b92b27; color: #fff; }
.btn-view { background: #f0f4f2; color: #3b5244; border-color: #d2ddd6; }
.btn-view:hover { background: #3b5244; color: #fff; }

.empty-cell {
  text-align: center;
  padding: 2rem;
  color: #7b8e82;
}

/* Modals */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}
.modal-box {
  background: #fff;
  border-radius: 12px;
  padding: 1.5rem;
  max-width: 480px;
  width: 100%;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.25);
}
.modal-box h3 { margin: 0 0 10px; font-size: 1.15rem; }
.dispute-quote {
  background: #fff5f5;
  border-left: 3px solid #b92b27;
  padding: 8px 12px;
  border-radius: 4px;
  margin-bottom: 12px;
  font-size: 12px;
}
.dispute-quote p { margin: 4px 0 0; color: #721c24; }
.resolution-choice {
  border: 1px solid #e1e8e3;
  padding: 10px;
  border-radius: 8px;
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 12px;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 1.25rem;
}
</style>
