<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  ShieldCheck, ArrowLeft, CheckCircle2, Clock, AlertTriangle, ExternalLink,
  Copy, Check, Lock, Unlock, FileCode2, Scale, RefreshCw, Send, Search
} from 'lucide-vue-next';
import { api, apiErrorMessage } from '../services/api';

type EscrowDetails = {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  orderStatus: string;
  total: number | string;
  paymentMethod: string;
  paymentStatus?: string;
  qrImage?: string;
  bakongRef?: string;
  escrow: {
    id: string;
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
  } | null;
  contract: {
    contractName: string;
    contractAddress: string;
    contractNetwork: string;
    chainId: number;
    arbiterAddress: string;
    explorerBaseUrl: string;
  };
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
const copiedField = ref('');

// Buyer action states
const actionLoading = ref(false);
const showDisputeModal = ref(false);
const disputeReason = ref('');
const showReleaseModal = ref(false);
const buyerPhoneConfirm = ref('');

const isKhmer = computed(() => locale.value === 'km');
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
      title: t('escrow.stepInitiated'),
      desc: 'Smart contract escrow agreement deployed on Bakong EVM',
      time: e?.createdAt,
      state: 'done'
    },
    {
      title: t('escrow.stepLocked'),
      desc: e?.bakongMd5 ? `Bakong KHQR verified (${e.bakongMd5.slice(0, 8)}...). Funds held in vault.` : 'Awaiting payment confirmation via Bakong KHQR',
      time: e?.lockedAt,
      state: status === 'INITIATED' ? 'active' : status ? 'done' : 'pending'
    },
    {
      title: t('escrow.stepDispatched'),
      desc: e?.autoReleaseAt ? `Shipped. 3-day buyer inspection active.` : 'Seller preparing goods for tracked delivery',
      time: e?.dispatchedAt,
      state: status === 'FUNDS_LOCKED' ? 'pending' : status === 'DISPATCHED' ? 'active' : (status === 'RELEASED' || status === 'DISPUTED' || status === 'REFUNDED') ? 'done' : 'pending'
    },
    {
      title: status === 'DISPUTED' ? t('escrow.stepDisputed') : status === 'REFUNDED' ? t('escrow.stepRefunded') : t('escrow.stepReleased'),
      desc: status === 'RELEASED' ? 'Buyer confirmed receipt; funds transferred to seller.' : status === 'DISPUTED' ? 'Dispute submitted. Arbiter reviewing evidence.' : status === 'REFUNDED' ? 'Refund approved and executed back to buyer.' : 'Awaiting buyer inspection & final release',
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
    const { data } = await api.post(`/escrow/${encodeURIComponent(escrowData.value.orderNumber)}/release`, {
      customerPhone: buyerPhoneConfirm.value || escrowData.value.customerPhone
    });
    successMessage.value = data.data.message || 'Funds released successfully!';
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
    const { data } = await api.post(`/escrow/${encodeURIComponent(escrowData.value.orderNumber)}/dispute`, {
      reason: disputeReason.value.trim(),
      customerPhone: buyerPhoneConfirm.value || escrowData.value.customerPhone
    });
    successMessage.value = data.data.message || 'Dispute submitted successfully';
    showDisputeModal.value = false;
    await loadEscrow(escrowData.value.orderNumber);
  } catch (err) {
    error.value = apiErrorMessage(err) || 'Failed to submit dispute';
  } finally {
    actionLoading.value = false;
  }
}

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text);
  copiedField.value = label;
  setTimeout(() => { copiedField.value = ''; }, 2000);
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
              <ShieldCheck :size="14" /> {{ t('escrow.badge') }}
            </span>
            <h1>{{ t('escrow.title') }}</h1>
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
              <strong>Funds Held in Smart Contract Vault</strong>
              <p>{{ t('escrow.inspectionNotice') }}</p>
            </div>
          </div>
          <div class="action-buttons">
            <button
              class="button button-success"
              type="button"
              @click="showReleaseModal = true"
            >
              <CheckCircle2 :size="16" /> {{ t('escrow.releaseBtn') }}
            </button>
            <button
              class="button button-outline danger-btn"
              type="button"
              @click="showDisputeModal = true"
            >
              <AlertTriangle :size="16" /> {{ t('escrow.disputeBtn') }}
            </button>
          </div>
        </div>

        <!-- Dispute In Progress Notice -->
        <div v-else-if="escrowData.escrow?.status === 'DISPUTED'" class="dispute-notice-card">
          <Scale :size="20" />
          <div>
            <strong>Dispute Under Neutral Arbitration</strong>
            <p>Reason: "{{ escrowData.escrow.disputeReason }}"</p>
            <small>{{ t('escrow.arbitrationNotice') }}</small>
          </div>
        </div>

        <!-- Completed / Released Notice -->
        <div v-else-if="escrowData.escrow?.status === 'RELEASED'" class="released-notice-card">
          <Unlock :size="20" />
          <div>
            <strong>Escrow Completed & Funds Released</strong>
            <p>Smart contract release has executed and payouts are finalized.</p>
          </div>
        </div>
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

        <!-- Smart Contract Details Section -->
        <section class="escrow-card contract-card">
          <div class="card-title-row">
            <h2>{{ t('escrow.contract') }}</h2>
            <span class="chain-badge">{{ escrowData.contract.contractNetwork }} (Chain ID: {{ escrowData.contract.chainId }})</span>
          </div>

          <div class="contract-fields">
            <div class="field-item">
              <span class="field-label">{{ t('escrow.contractAddress') }}</span>
              <div class="hash-box">
                <code>{{ escrowData.contract.contractAddress }}</code>
                <button
                  type="button"
                  class="copy-btn"
                  @click="copyToClipboard(escrowData.contract.contractAddress, 'contract')"
                >
                  <Check v-if="copiedField === 'contract'" :size="13" />
                  <Copy v-else :size="13" />
                </button>
              </div>
            </div>

            <div v-if="escrowData.escrow?.txHash" class="field-item">
              <span class="field-label">Creation Tx Hash</span>
              <div class="hash-box">
                <code>{{ escrowData.escrow.txHash }}</code>
                <button
                  type="button"
                  class="copy-btn"
                  @click="copyToClipboard(escrowData.escrow.txHash!, 'txHash')"
                >
                  <Check v-if="copiedField === 'txHash'" :size="13" />
                  <Copy v-else :size="13" />
                </button>
              </div>
            </div>

            <div v-if="escrowData.escrow?.releaseTxHash" class="field-item">
              <span class="field-label">Release Execution Tx Hash</span>
              <div class="hash-box">
                <code>{{ escrowData.escrow.releaseTxHash }}</code>
                <button
                  type="button"
                  class="copy-btn"
                  @click="copyToClipboard(escrowData.escrow.releaseTxHash!, 'releaseTx')"
                >
                  <Check v-if="copiedField === 'releaseTx'" :size="13" />
                  <Copy v-else :size="13" />
                </button>
              </div>
            </div>

            <div v-if="escrowData.escrow?.refundTxHash" class="field-item">
              <span class="field-label">Refund Execution Tx Hash</span>
              <div class="hash-box">
                <code>{{ escrowData.escrow.refundTxHash }}</code>
                <button
                  type="button"
                  class="copy-btn"
                  @click="copyToClipboard(escrowData.escrow.refundTxHash!, 'refundTx')"
                >
                  <Check v-if="copiedField === 'refundTx'" :size="13" />
                  <Copy v-else :size="13" />
                </button>
              </div>
            </div>

            <div class="field-grid-two">
              <div class="field-item">
                <span class="field-label">{{ t('escrow.buyer') }}</span>
                <div class="hash-box">
                  <code>{{ escrowData.escrow?.buyerAddress }}</code>
                </div>
              </div>
              <div class="field-item">
                <span class="field-label">{{ t('escrow.seller') }}</span>
                <div class="hash-box">
                  <code>{{ escrowData.escrow?.sellerAddress }}</code>
                </div>
              </div>
            </div>

            <div class="field-item">
              <span class="field-label">{{ t('escrow.arbiter') }}</span>
              <div class="hash-box">
                <code>{{ escrowData.contract.arbiterAddress }}</code>
              </div>
            </div>

            <div v-if="escrowData.escrow?.bakongMd5" class="field-item">
              <span class="field-label">{{ t('escrow.bakongRef') }} (MD5)</span>
              <div class="hash-box">
                <code>{{ escrowData.escrow.bakongMd5 }}</code>
                <button
                  type="button"
                  class="copy-btn"
                  @click="copyToClipboard(escrowData.escrow.bakongMd5!, 'bakongRef')"
                >
                  <Check v-if="copiedField === 'bakongRef'" :size="13" />
                  <Copy v-else :size="13" />
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- Order Items in this Escrow -->
        <section class="escrow-card items-card">
          <h2>Items Protected by Escrow</h2>
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
      <h2>Bakong Smart Contract Escrow Explorer</h2>
      <p>Enter any Mekong Market order number above to inspect on-chain escrow lock, tracking, and dispute state.</p>
    </div>

    <!-- Release Funds Confirmation Modal -->
    <div v-if="showReleaseModal" class="modal-backdrop" @click.self="showReleaseModal = false">
      <div class="modal-box">
        <div class="modal-header">
          <CheckCircle2 :size="24" class="icon-success" />
          <h3>Confirm Delivery & Release Funds</h3>
        </div>
        <p>{{ t('escrow.releaseConfirmPrompt') }}</p>
        <label class="form-field">
          <span>Confirm Customer Phone Number *</span>
          <input v-model.trim="buyerPhoneConfirm" type="tel" :placeholder="escrowData?.customerPhone" />
        </label>
        <div class="modal-actions">
          <button class="button button-outline" type="button" @click="showReleaseModal = false">Cancel</button>
          <button class="button button-success" type="button" :disabled="actionLoading" @click="executeRelease">
            {{ actionLoading ? 'Releasing on-chain...' : 'Confirm & Release Payout' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Dispute Submission Modal -->
    <div v-if="showDisputeModal" class="modal-backdrop" @click.self="showDisputeModal = false">
      <div class="modal-box">
        <div class="modal-header">
          <AlertTriangle :size="24" class="icon-danger" />
          <h3>Open Escrow Dispute</h3>
        </div>
        <p>{{ t('escrow.disputeReasonPrompt') }}</p>
        <label class="form-field">
          <span>Dispute Reason / Evidence *</span>
          <textarea v-model.trim="disputeReason" rows="3" placeholder="Goods not received, damaged during shipment, or item mismatch..."></textarea>
        </label>
        <label class="form-field">
          <span>Confirm Customer Phone Number *</span>
          <input v-model.trim="buyerPhoneConfirm" type="tel" :placeholder="escrowData?.customerPhone" />
        </label>
        <div class="modal-actions">
          <button class="button button-outline" type="button" @click="showDisputeModal = false">Cancel</button>
          <button class="button button-danger" type="button" :disabled="actionLoading || !disputeReason.trim()" @click="executeDispute">
            {{ actionLoading ? 'Submitting...' : 'Register Dispute' }}
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
