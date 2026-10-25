<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChevronDown, ChevronUp, Printer, Undo2 } from 'lucide-vue-next';

type OrderItem = { id: string; productNameEn: string; productNameKm: string; sku: string; quantity: number; lineTotal: number };
type OrderRow = { id: string; orderNumber: string; customerName: string; customerPhone: string; customerEmail?: string | null; total: number; status: string; createdAt: string; paymentMethod?: string; payment?: { status: string; method: string; amount: number; providerRef?: string | null } | null; items?: OrderItem[] };
defineProps<{ orders: OrderRow[]; money: (value: number) => string; date: (value: string) => string; editable?: boolean }>();
const emit = defineEmits<{ status: [order: OrderRow, value: string] }>();
const { t } = useI18n();
const expandedOrderId = ref<string | null>(null);
const internalNotes = ref<Record<string, string>>({});

function toggleDetails(orderId: string) {
  expandedOrderId.value = expandedOrderId.value === orderId ? null : orderId;
}

function printInvoice() {
  window.print();
}
</script>

<template>
  <table class="orders-table">
    <thead><tr><th>{{ t('account.order') }}</th><th>{{ t('admin.customer') }}</th><th>{{ t('account.date') }}</th><th>{{ t('account.amount') }}</th><th>Payment</th><th>Shipping</th><th>{{ t('account.status') }}</th><th>Details</th></tr></thead>
    <tbody>
      <template v-for="order in orders" :key="order.id">
        <tr>
          <td class="order-number-cell">{{ order.orderNumber }}</td>
          <td><strong>{{ order.customerName }}</strong><small>{{ order.customerPhone }}</small></td>
          <td>{{ date(order.createdAt) }}</td>
          <td>{{ money(Number(order.total)) }}</td>
          <td><span class="order-payment-state" :class="`payment-${(order.payment?.status || 'PENDING').toLowerCase()}`">{{ order.payment?.status || 'PENDING' }}</span><small>{{ order.payment?.method || order.paymentMethod || 'CASH_ON_DELIVERY' }}</small></td>
          <td><span class="order-shipping-state">Not configured</span></td>
          <td><select v-if="editable" class="status-select" :value="order.status" @change="emit('status', order, ($event.target as HTMLSelectElement).value)"><option v-for="status in ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']" :key="status" :value="status">{{ t(`status.${status}`) }}</option></select><span v-else class="status-tag" :class="`status-${order.status.toLowerCase()}`">{{ t(`status.${order.status}`) }}</span></td>
          <td><button class="order-details-toggle" type="button" :aria-expanded="expandedOrderId === order.id" :aria-label="`${expandedOrderId === order.id ? 'Hide' : 'View'} details for ${order.orderNumber}`" @click="toggleDetails(order.id)">{{ expandedOrderId === order.id ? 'Hide' : 'View' }}<ChevronUp v-if="expandedOrderId === order.id" :size="13" /><ChevronDown v-else :size="13" /></button></td>
        </tr>
        <tr v-if="expandedOrderId === order.id" class="order-detail-row"><td colspan="8"><div class="order-detail-grid"><section class="order-detail-items"><h3>Order items <span>{{ order.items?.length || 0 }}</span></h3><div v-for="item in order.items || []" :key="item.id" class="order-detail-item"><div><strong>{{ item.productNameEn }}</strong><small>{{ item.sku }} · Qty {{ item.quantity }}</small></div><strong>{{ money(Number(item.lineTotal)) }}</strong></div><p v-if="!order.items?.length" class="order-detail-muted">Item details are not available for this record.</p></section><section class="order-detail-side"><div><h3>Payment details</h3><p><span>Method</span><strong>{{ order.payment?.method || order.paymentMethod || 'CASH_ON_DELIVERY' }}</strong></p><p><span>Status</span><strong>{{ order.payment?.status || 'PENDING' }}</strong></p><p v-if="order.payment?.providerRef"><span>Transaction</span><strong>{{ order.payment.providerRef }}</strong></p><p><span>Shipping</span><strong>Shipping API not configured</strong></p></div><label><span>Internal note <small>Local preview only, not saved</small></span><textarea v-model="internalNotes[order.id]" rows="2" placeholder="Add a private note..." /></label><div class="order-detail-actions"><button type="button" class="order-print-button" @click="printInvoice"><Printer :size="13" />Print invoice</button><button type="button" class="order-refund-button" disabled title="A refund provider/API is not configured"><Undo2 :size="13" />Refund unavailable</button></div></section></div></td></tr>
      </template>
    </tbody>
  </table>
</template>