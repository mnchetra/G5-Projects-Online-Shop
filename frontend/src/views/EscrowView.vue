<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  ShieldCheck, ArrowLeft, CheckCircle2, Clock, AlertTriangle,
  Check, Lock, Unlock, Scale, RefreshCw, Search
} from 'lucide-vue-next';
import { api, apiErrorMessage } from '../services/api';
import EvidenceUploader from '../components/EvidenceUploader.vue';
import EscrowEvidenceGallery from '../components/EscrowEvidenceGallery.vue';

type EscrowEvidence = {
  id: string;
  stage: 'CUSTOMER' | 'ADMIN' | 'SUPER_ADMIN';
  originalName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  uploader: { name: string };
};

type EscrowDetails = {
  orderNumber: string;
  customerName: string;
  orderStatus: string;
  total: number | string;
  paymentMethod: string;
  paymentStatus?: string;
  qrImage?: string;
  bakongRef?: string;
  escrow: {
    id: string;
    disputeReason?: string | null;
    adminResponse?: string | null;
    adminRespondedBy?: { name: string; email: string } | null;
    resolutionNotes?: string | null;
    arbitratedAt?: string | null;
    arbitratedBy?: { name: string; email: string } | null;
    evidence: EscrowEvidence[];
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
  } | null;
  items: {
    id: string;
    productNameEn: string;
    productNameKm: string;
    sku: string;
    quantity: number;
    unitPrice: number | string;
    lineTotal: number | string;
  }[];
  createdAt: string;
};

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();

const loading = ref(false);
const error = ref('');
const successMessage = ref('');
const escrowData = ref<EscrowDetails | null>(null);
const searchInput = ref('');

// Buyer action states
const actionLoading = ref(false);
const showDisputeModal = ref(false);
const disputeReason = ref('');
const disputeEvidence = ref<File[]>([]);
const showReleaseModal = ref(false);

const isKhmer = computed(() => locale.value === 'km');
const isDemoWallet = computed(() => escrowData.value?.paymentMethod === 'DEMO_WALLET');
const money = (val: number | string) =>
  new Intl.NumberFormat(isKhmer.value ? 'km-KH' : 'en-US', { style: 'currency', currency: 'USD' }).format(Number(val));

const currentOrderNumber = computed(() => (route.params.orderNumber as string) || '');

const statusClass = computed(() => {
  const s = escrowData.value?.escrow?.status;
  if (!s) return 'status-default';
  return `escrow-${s.toLowerCase()}`;
});

const timelineSteps = computed(() => {
  const e = escrowData.value?.escrow;
  const status = e?.status;

  return [
    {
      title: t('demoWallet.initiated'),
      desc: isDemoWallet.value ? t('demoWallet.walletNotice') : t('demoWallet.trackerNotice'),
      time: e?.createdAt,
      state: 'done'
    },
    {
      title: t('demoWallet.locked'),
      desc: isDemoWallet.value
        ? t('demoWallet.locked')
        : e?.bakongMd5
          ? t('demoWallet.paymentHint')
          : 'Awaiting payment confirmation via Bakong KHQR.',
      time: e?.lockedAt,
      state: status === 'INITIATED' ? 'active' : status ? 'done' : 'pending'
    },
    {
      title: t('demoWallet.dispatched'),
      desc: e?.autoReleaseAt ? t('demoWallet.inspectionNotice') : 'Seller preparing goods for tracked delivery.',
      time: e?.dispatchedAt,
      state: status === 'FUNDS_LOCKED' ? 'pending' : status === 'DISPATCHED' ? 'active' : (status === 'RELEASED' || status === 'DISPUTED' || status === 'REFUNDED') ? 'done' : 'pending'
    },
    {
      title: status === 'DISPUTED' ? t('demoWallet.disputed') : status === 'REFUNDED' ? t('demoWallet.refunded') : t('demoWallet.released'),
      desc: status === 'RELEASED'
        ? t('demoWallet.released')
        : status === 'DISPUTED' ? t('demoWallet.disputed')
          : status === 'REFUNDED' ? t('demoWallet.refunded')
            : 'Awaiting buyer inspection and delivery confirmation.',
      time: e?.releasedAt || e?.refundedAt,
      state: status === 'RELEASED' || status === 'REFUNDED' ? 'done' : status === 'DISPUTED' ? 'warning' : 'pending'
    }
  ];
});

async function loadEscrow(orderNum: string) {
  if (!orderNum) return;
  loading.value = true;
  error.value = '';
  try {
    const { data } = await api.get(`/escrow/${encodeURIComponent(orderNum)}`);
    escrowData.value = data.data;
  } catch (err) {
    error.value = apiErrorMessage(err) || 'Could not load escrow details';
    escrowData.value = null;
  } finally {
    loading.value = false;
  }
}

async function handleSearch() {
  if (!searchInput.value.trim()) return;
  router.push(`/escrow/${encodeURIComponent(searchInput.value.trim())}`);
}

async function executeRelease() {
  if (!escrowData.value) return;
  actionLoading.value = true;
  error.value = '';
  successMessage.value = '';
  try {
    const { data } = await api.post(`/escrow/${encodeURIComponent(escrowData.value.orderNumber)}/release`, {});
    successMessage.value = data.data.message || 'Delivery confirmation recorded.';
    showReleaseModal.value = false;
    await loadEscrow(escrowData.value.orderNumber);
  } catch (err) {
    error.value = apiErrorMessage(err) || 'Failed to release funds';
  } finally {
    actionLoading.value = false;
  }
}

async function executeDispute() {
  if (!escrowData.value || !disputeReason.value.trim()) return;
  actionLoading.value = true;
  error.value = '';
  successMessage.value = '';
  try {
    const form = new FormData();
    form.append('reason', disputeReason.value.trim());
    disputeEvidence.value.forEach((file) => form.append('evidence', file));
    const { data } = await api.post(
      `/escrow/${encodeURIComponent(escrowData.value.orderNumber)}/dispute`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    successMessage.value = data.data.message || 'Dispute submitted successfully';
    showDisputeModal.value = false;
    disputeReason.value = '';
    disputeEvidence.value = [];
    await loadEscrow(escrowData.value.orderNumber);
  } catch (err) {
    error.value = apiErrorMessage(err) || 'Failed to submit dispute';
  } finally {
    actionLoading.value = false;
  }
}

onMounted(() => {
  if (currentOrderNumber.value) {
    searchInput.value = currentOrderNumber.value;
    loadEscrow(currentOrderNumber.value);
  }
});

watch(currentOrderNumber, (newVal) => {
  if (newVal) {
    searchInput.value = newVal;
    loadEscrow(newVal);
  }
});
</script>

<template>
  <main class="escrow-view page-wrap">
    <div class="escrow-top-nav">
      <RouterLink to="/account" class="back-link">
        <ArrowLeft :size="16" /> {{ t('account.title') }}
      </RouterLink>
      <div class="escrow-search-bar">
        <input
          v-model.trim="searchInput"
          type="text"
          placeholder="Enter Order # (e.g. MM-K9X...)"
          @keyup.enter="handleSearch"
        />
        <button class="button button-dark" type="button" @click="handleSearch">
          <Search :size="14" /> Search
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <RefreshCw :size="32" class="spin-icon" />
      <p>{{ t('common.loading') }}</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-banner" role="alert">
      <AlertTriangle :size="20" />
      <div>
        <strong>Error</strong>
        <p>{{ error }}</p>
      </div>
    </div>

    <!-- Escrow Loaded Content -->
    <div v-else-if="escrowData" class="escrow-dashboard">
      <!-- Main Status Card -->
      <section class="escrow-hero-card">
        <div class="hero-header">
          <div>
            <span class="escrow-tag">
              <ShieldCheck :size="14" /> {{ t('demoWallet.badge') }}
            </span>
            <h1>{{ t('demoWallet.escrowTitle') }}</h1>
            <p class="order-ref-text">
              Order: <strong>{{ escrowData.orderNumber }}</strong> · {{ escrowData.customerName }}
            </p>
          </div>
          <div class="hero-amount-badge">
            <span class="amount-label">{{ t('escrow.amount') }}</span>
            <strong class="amount-value">{{ money(escrowData.escrow?.amount || escrowData.total) }}</strong>
            <span class="escrow-status-pill" :class="statusClass">
              <i></i> {{ t(`status.${escrowData.escrow?.status || 'INITIATED'}`) }}
            </span>
          </div>
        </div>

        <!-- Feedback Alerts -->
        <div v-if="successMessage" class="success-banner" role="status">
          <CheckCircle2 :size="18" /> {{ successMessage }}
        </div>

        <!-- Buyer Action Prompt if Funds Locked or Dispatched -->
        <div
          v-if="escrowData.escrow && (escrowData.escrow.status === 'FUNDS_LOCKED' || escrowData.escrow.status === 'DISPATCHED')"
          class="buyer-action-bar"
        >
          <div class="action-info">
            <Lock :size="18" class="icon-lock" />
            <div>
              <strong>{{ isDemoWallet ? t('demoWallet.walletNotice') : t('demoWallet.trackerNotice') }}</strong>
              <p>{{ t('demoWallet.inspectionNotice') }}</p>
            </div>
          </div>
          <div class="action-buttons">
            <button
              class="button button-success"
              type="button"
              @click="showReleaseModal = true"
            >
              <CheckCircle2 :size="16" /> {{ t('demoWallet.confirmDelivery') }}
            </button>
            <button
              class="button button-outline danger-btn"
              type="button"
              @click="showDisputeModal = true"
            >
              <AlertTriangle :size="16" /> {{ t('demoWallet.reportIssue') }}
            </button>
          </div>
        </div>

        <!-- Dispute In Progress Notice -->
        <div v-else-if="escrowData.escrow?.status === 'DISPUTED'" class="dispute-notice-card">
          <Scale :size="20" />
          <div>
            <strong>{{ isKhmer ? 'វិវាទកំពុងរង់ចាំការសម្រេចចុងក្រោយពី Super Admin' : 'Dispute awaiting final Super Admin decision' }}</strong>
            <p>{{ isKhmer ? 'មូលហេតុរបស់អតិថិជន៖' : 'Customer report:' }} "{{ escrowData.escrow.disputeReason }}"</p>
            <template v-if="escrowData.escrow.adminResponse">
              <p>{{ isKhmer ? 'ការឆ្លើយតបពី Admin' : 'Store response' }}<span v-if="escrowData.escrow.adminRespondedBy"> ({{ escrowData.escrow.adminRespondedBy.name }})</span>: "{{ escrowData.escrow.adminResponse }}"</p>
              <small>{{ isKhmer ? 'Super Admin នឹងពិនិត្យភស្តុតាងទាំងពីរ ហើយសម្រេចចុងក្រោយ។' : 'A Super Admin will review both statements and make the final decision.' }}</small>
            </template>
            <small v-else>{{ isKhmer ? 'កំពុងរង់ចាំការឆ្លើយតបពី Admin មុនពេល Super Admin ពិនិត្យ។' : 'Waiting for the admin response before Super Admin review.' }}</small>
          </div>
        </div>

        <!-- Completed / Released Notice -->
        <div v-else-if="escrowData.escrow?.status === 'RELEASED'" class="released-notice-card">
          <Unlock :size="20" />
          <div>
            <strong>{{ escrowData.escrow.arbitratedAt
              ? (isKhmer ? 'Super Admin បានសម្រេចបញ្ចេញការកត់ត្រាប្រាក់ទៅហាង' : 'Super Admin approved release to the store')
              : (isKhmer ? 'បានបញ្ជាក់ការទទួលទំនិញ; បានកត់ត្រាស្ថានភាពក្នុងប្រព័ន្ធ' : 'Delivery confirmed; database status marked released') }}</strong>
            <p v-if="escrowData.escrow.resolutionNotes">{{ escrowData.escrow.resolutionNotes }}</p>
            <small v-if="escrowData.escrow.arbitratedBy">{{ isKhmer ? 'សម្រេចដោយ' : 'Decision by' }} {{ escrowData.escrow.arbitratedBy.name }}</small>
            <small>{{ isKhmer ? 'នេះជាស្ថានភាពក្នុងប្រព័ន្ធប៉ុណ្ណោះ; មិនមានការផ្ទេរប្រាក់ពិតទេ។' : 'This is a recorded status only; no real payout was made.' }}</small>
          </div>
        </div>

        <div v-else-if="escrowData.escrow?.status === 'REFUNDED'" class="released-notice-card refund-notice-card">
          <Unlock :size="20" />
          <div>
            <strong>{{ isKhmer ? 'Super Admin បានសម្រេចអនុម័តការសងប្រាក់ជូនអតិថិជន' : 'Super Admin approved a customer refund' }}</strong>
            <p>{{ escrowData.escrow.resolutionNotes }}</p>
            <small v-if="escrowData.escrow.arbitratedBy">{{ isKhmer ? 'សម្រេចដោយ' : 'Decision by' }} {{ escrowData.escrow.arbitratedBy.name }}</small>
            <small v-if="isDemoWallet">{{ isKhmer ? 'សមតុល្យកាបូបក្នុងប្រព័ន្ធត្រូវបានបញ្ចូលត្រឡប់វិញ។' : 'The store-wallet balance was credited back.' }}</small>
            <small v-else>{{ isKhmer ? 'ស្ថានភាពសងប្រាក់ត្រូវបានកត់ត្រាប៉ុណ្ណោះ; ត្រូវដំណើរការសងប្រាក់តាមធនាគារដាច់ដោយឡែក។' : 'The refund decision is recorded only; a real bank refund must be processed separately.' }}</small>
          </div>
        </div>
        <EscrowEvidenceGallery
          v-if="escrowData.escrow?.evidence?.length"
          :order-number="escrowData.orderNumber"
          :evidence="escrowData.escrow.evidence"
          :locale="locale"
        />
      </section>

      <!-- Grid Layout for Details & Timeline -->
      <div class="escrow-grid">
        <!-- Timeline Section -->
        <section class="escrow-card timeline-card">
          <h2>{{ t('escrow.timeline') }}</h2>
          <div class="stepper">
            <div
              v-for="(step, idx) in timelineSteps"
              :key="idx"
              class="stepper-step"
              :class="step.state"
            >
              <div class="step-indicator">
                <Check v-if="step.state === 'done'" :size="14" />
                <Clock v-else-if="step.state === 'active'" :size="14" />
                <AlertTriangle v-else-if="step.state === 'warning'" :size="14" />
                <span v-else>{{ idx + 1 }}</span>
              </div>
              <div class="step-content">
                <strong>{{ step.title }}</strong>
                <p>{{ step.desc }}</p>
                <time v-if="step.time">{{ new Date(step.time).toLocaleString() }}</time>
              </div>
            </div>
          </div>
        </section>

        <!-- Demo escrow notice -->
        <section class="escrow-card contract-card">
          <h2>{{ t('demoWallet.escrowTitle') }}</h2>
          <p v-if="isDemoWallet">{{ t('demoWallet.walletNotice') }}</p>
          <p v-else>{{ t('demoWallet.trackerNotice') }}</p>
        </section>

        <!-- Order Items in this Escrow -->
        <section class="escrow-card items-card">
          <h2>Items in this order</h2>
          <div class="item-list">
            <div v-for="item in escrowData.items" :key="item.id" class="item-row">
              <div>
                <strong>{{ isKhmer ? item.productNameKm : item.productNameEn }}</strong>
                <span class="item-sku">SKU: {{ item.sku }} · Qty: {{ item.quantity }}</span>
              </div>
              <b>{{ money(item.lineTotal) }}</b>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- Empty Prompt if no order loaded -->
    <div v-else class="empty-escrow-search">
      <ShieldCheck :size="48" class="shield-big" />
      <h2>{{ t('demoWallet.escrowTitle') }}</h2>
      <p>{{ t('demoWallet.trackerNotice') }}</p>
    </div>

    <!-- Release Funds Confirmation Modal -->
    <div v-if="showReleaseModal" class="modal-backdrop" @click.self="showReleaseModal = false">
      <div class="modal-box">
        <div class="modal-header">
          <CheckCircle2 :size="24" class="icon-success" />
          <h3>{{ t('demoWallet.confirmDelivery') }}</h3>
        </div>
        <p>{{ t('demoWallet.releaseConfirm') }}</p>
        <div class="modal-actions">
          <button class="button button-outline" type="button" @click="showReleaseModal = false">Cancel</button>
          <button class="button button-success" type="button" :disabled="actionLoading" @click="executeRelease">
            {{ actionLoading ? t('common.loading') : t('demoWallet.confirmDelivery') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Dispute Submission Modal -->
    <div v-if="showDisputeModal" class="modal-backdrop" @click.self="showDisputeModal = false">
      <div class="modal-box">
        <div class="modal-header">
          <AlertTriangle :size="24" class="icon-danger" />
          <h3>{{ t('demoWallet.reportIssue') }}</h3>
        </div>
          <p>{{ t('demoWallet.disputePrompt') }}</p>
        <label class="form-field">
          <span>{{ isKhmer ? 'មូលហេតុស្នើបោះបង់ / ប្រគល់ទំនិញវិញ *' : 'Cancellation / return reason *' }}</span>
          <textarea v-model.trim="disputeReason" rows="3" :placeholder="isKhmer ? 'ពន្យល់អំពីទំនិញខូច ឬមូលហេតុផ្សេងទៀត...' : 'Explain damage or another reason for cancellation...'"></textarea>
        </label>
        <EvidenceUploader v-model="disputeEvidence" :locale="locale" />
        <div class="modal-actions">
          <button class="button button-outline" type="button" @click="showDisputeModal = false">Cancel</button>
          <button class="button button-danger" type="button" :disabled="actionLoading || !disputeReason.trim()" @click="executeDispute">
            {{ actionLoading ? t('common.loading') : (isKhmer ? 'ផ្ញើសំណើទៅ Super Admin' : 'Send request to Super Admin') }}
          </button>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.escrow-view {
  padding-top: 2rem;
  padding-bottom: 4rem;
}

.escrow-top-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.escrow-search-bar {
  display: flex;
  gap: 8px;
}
.escrow-search-bar input {
  padding: 8px 14px;
  border: 1px solid #c8d3cb;
  border-radius: 6px;
  font-size: 13px;
  min-width: 260px;
}

.escrow-hero-card {
  background: linear-gradient(135deg, #1b3425 0%, #112218 100%);
  color: #f1f6f3;
  padding: 2rem;
  border-radius: 16px;
  box-shadow: 0 12px 36px rgba(17, 34, 24, 0.16);
  margin-bottom: 2rem;
}

.hero-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 1.5rem;
}

.escrow-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(144, 206, 161, 0.15);
  color: #92e0ab;
  border: 1px solid rgba(144, 206, 161, 0.3);
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
}

.escrow-hero-card h1 {
  font-size: 2rem;
  font-weight: 800;
  margin: 0 0 6px;
  color: #fff;
}

.order-ref-text {
  font-size: 14px;
  color: #bdd5c5;
  margin: 0;
}

.hero-amount-badge {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}
.amount-label {
  font-size: 11px;
  text-transform: uppercase;
  color: #9ab4a2;
}
.amount-value {
  font-size: 2rem;
  font-weight: 800;
  color: #92e0ab;
}

.escrow-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}
.escrow-status-pill i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}
.escrow-status-pill.escrow-initiated { background: #423b18; color: #f7d660; }
.escrow-status-pill.escrow-funds_locked { background: #194a2b; color: #7ced9f; }
.escrow-status-pill.escrow-dispatched { background: #153c4d; color: #6dd4f7; }
.escrow-status-pill.escrow-released { background: #144933; color: #8ef7c2; }
.escrow-status-pill.escrow-disputed { background: #501d1d; color: #ffa6a6; }
.escrow-status-pill.escrow-refunded { background: #3b2a4a; color: #dcb3ff; }

.buyer-action-bar {
  margin-top: 1.5rem;
  padding: 1.25rem;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}
.action-info {
  display: flex;
  align-items: center;
  gap: 12px;
}
.action-info p {
  margin: 2px 0 0;
  font-size: 12px;
  color: #bdd5c5;
}
.action-buttons {
  display: flex;
  gap: 10px;
}

.button-success {
  background: #258348;
  color: #fff;
  border: none;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  border-radius: 6px;
  cursor: pointer;
}
.button-success:hover { background: #1e6d3c; }

.button-danger {
  background: #a93226;
  color: #fff;
  border: none;
  font-weight: 700;
  padding: 10px 18px;
  border-radius: 6px;
  cursor: pointer;
}
.button-outline.danger-btn {
  border-color: #ffa6a6;
  color: #ffa6a6;
}

.dispute-notice-card, .released-notice-card {
  margin-top: 1.5rem;
  padding: 1rem 1.25rem;
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.dispute-notice-card { background: rgba(185, 43, 39, 0.2); border: 1px solid rgba(255, 120, 120, 0.4); }
.released-notice-card { background: rgba(37, 131, 72, 0.2); border: 1px solid rgba(120, 255, 160, 0.4); }

.escrow-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}
@media (max-width: 900px) {
  .escrow-grid { grid-template-columns: 1fr; }
}

.escrow-card {
  background: #fff;
  border: 1px solid #e1e8e3;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 16px rgba(18, 24, 20, 0.04);
}
.escrow-card h2 {
  font-size: 1.15rem;
  margin: 0 0 1.25rem;
  color: #1a2e22;
}

/* Stepper */
.stepper {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  position: relative;
}
.stepper-step {
  display: flex;
  gap: 14px;
}
.step-indicator {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  background: #eef2ef;
  color: #6a7c70;
  flex-shrink: 0;
}
.stepper-step.done .step-indicator { background: #258348; color: #fff; }
.stepper-step.active .step-indicator { background: #1a6f8b; color: #fff; }
.stepper-step.warning .step-indicator { background: #a93226; color: #fff; }
.step-content strong { display: block; font-size: 14px; color: #172a1e; }
.step-content p { margin: 2px 0; font-size: 12px; color: #5a6e61; }
.step-content time { font-size: 11px; color: #88998e; }

/* Contract Fields */
.card-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
}
.chain-badge {
  background: #eaf1ed;
  color: #216742;
  font-size: 10px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 4px;
}
.contract-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.field-label {
  display: block;
  font-size: 11px;
  text-transform: uppercase;
  color: #6a7c70;
  margin-bottom: 3px;
  font-weight: 600;
}
.hash-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f7f9f8;
  border: 1px solid #dbe3dd;
  padding: 6px 10px;
  border-radius: 6px;
  overflow: hidden;
}
.hash-box code {
  font-family: monospace;
  font-size: 11px;
  color: #172a1e;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.copy-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: #4b6654;
  padding: 4px;
  display: flex;
  align-items: center;
}
.field-grid-two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

/* Item List */
.item-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f0f3f1;
}
.item-sku {
  display: block;
  font-size: 11px;
  color: #7b8e82;
}

/* Modal */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
  padding: 1rem;
}
.modal-box {
  background: #fff;
  border-radius: 14px;
  padding: 1.75rem;
  max-width: 480px;
  width: 100%;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.2);
}
.modal-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 1rem;
}
.modal-header h3 { margin: 0; font-size: 1.25rem; }
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 1.5rem;
}

.empty-escrow-search {
  text-align: center;
  padding: 5rem 1rem;
  max-width: 500px;
  margin: 0 auto;
}
.shield-big {
  color: #2e7d52;
  margin-bottom: 1rem;
}
</style>
