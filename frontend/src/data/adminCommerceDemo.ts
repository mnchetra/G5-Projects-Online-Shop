export type CommerceNoticeKind = 'Order' | 'Payment' | 'Inventory' | 'Customer' | 'Review' | 'Security';

export const demoSalesTrend = [
  { day: 'Mon', sales: 680, orders: 18 },
  { day: 'Tue', sales: 920, orders: 24 },
  { day: 'Wed', sales: 740, orders: 19 },
  { day: 'Thu', sales: 1180, orders: 31 },
  { day: 'Fri', sales: 970, orders: 26 },
  { day: 'Sat', sales: 1460, orders: 39 },
  { day: 'Sun', sales: 1120, orders: 28 }
];

export const demoCategoryRevenue = [
  { name: 'Home & living', value: 34, amount: 14820, color: 'sage' },
  { name: 'Accessories', value: 27, amount: 11770, color: 'gold' },
  { name: 'Beauty & care', value: 22, amount: 9590, color: 'blue' },
  { name: 'Pantry', value: 17, amount: 7410, color: 'clay' }
];

export const demoTopProducts = [
  { sku: 'HOME-001', nameEn: 'Mekong rattan lamp', nameKm: 'ចង្កៀងផ្តៅមេគង្គ', units: 184, revenue: 8832, stock: 16, image: 'photo-1507473885765-e6ed057f782c' },
  { sku: 'ACC-001', nameEn: 'Krama weekender', nameKm: 'កាបូបដំណើរក្រមា', units: 142, revenue: 5112, stock: 24, image: 'photo-1553062407-98eeb64c6a62' },
  { sku: 'PAN-001', nameEn: 'Kampong Speu palm sugar', nameKm: 'ស្ករត្នោតកំពង់ស្ពឺ', units: 136, revenue: 1632, stock: 42, image: 'photo-1587049352846-4a222e784d38' },
  { sku: 'ACC-002', nameEn: 'Sunrise silk scarf', nameKm: 'កន្សែងសូត្រព្រះអាទិត្យរះ', units: 98, revenue: 5292, stock: 11, image: 'photo-1601924994987-69e26d50dc26' }
];

export const demoCustomerGrowth = [
  { month: 'May', customers: 312 }, { month: 'Jun', customers: 388 }, { month: 'Jul', customers: 425 },
  { month: 'Aug', customers: 512 }, { month: 'Sep', customers: 584 }, { month: 'Oct', customers: 641 }
];

export const demoPaymentMethods = [
  { name: 'Cash on delivery', value: 61, color: 'sage' },
  { name: 'Bakong KHQR · dynamic', value: 21, color: 'gold' },
  { name: 'Card', value: 12, color: 'blue' },
  { name: 'Online payment', value: 6, color: 'clay' }
];

export const demoInventoryMovements = [
  { id: 'MOV-7721', product: 'Mekong rattan lamp', sku: 'HOME-001', change: -2, reason: 'Order fulfilled', actor: 'System', time: 'Today, 10:42' },
  { id: 'MOV-7718', product: 'Krama weekender', sku: 'ACC-001', change: 24, reason: 'Restock received', actor: 'Sophea Chan', time: 'Today, 09:18' },
  { id: 'MOV-7702', product: 'Lotus hand cream', sku: 'BEA-001', change: -1, reason: 'Order fulfilled', actor: 'System', time: 'Yesterday, 16:32' },
  { id: 'MOV-7684', product: 'Sunrise silk scarf', sku: 'ACC-002', change: -3, reason: 'Stock correction', actor: 'Dara Sok', time: 'Yesterday, 11:06' }
];

export const demoCoupons = [
  { code: 'MEKONG10', discount: '10%', scope: 'Storewide', starts: 'Oct 01, 2026', ends: 'Oct 31, 2026', uses: '128 / 500', status: 'Active' },
  { code: 'WELCOME5', discount: '$5.00', scope: 'First order', starts: 'Sep 15, 2026', ends: 'Dec 31, 2026', uses: '74 / 300', status: 'Active' },
  { code: 'SILK15', discount: '15%', scope: 'Accessories', starts: 'Sep 01, 2026', ends: 'Sep 30, 2026', uses: '46 / 100', status: 'Expired' }
];

export const demoShipping = [
  { order: 'MM-2084', customer: 'Sophea Chan', provider: 'J&T Express', tracking: 'JT-KH-2409817', zone: 'Phnom Penh', eta: 'Oct 04', status: 'In transit' },
  { order: 'MM-2081', customer: 'Kosal Phan', provider: 'Virak Buntham', tracking: 'VB-90127456', zone: 'Battambang', eta: 'Oct 05', status: 'Preparing' },
  { order: 'MM-2079', customer: 'Malis Vann', provider: 'J&T Express', tracking: 'JT-KH-2409740', zone: 'Siem Reap', eta: 'Oct 03', status: 'Out for delivery' },
  { order: 'MM-2072', customer: 'Bopha Heng', provider: 'Self delivery', tracking: 'LOCAL-1832', zone: 'Phnom Penh', eta: 'Oct 02', status: 'Delivered' }
];

export const demoReviews = [
  { id: 'REV-1841', customer: 'Sokha Mey', product: 'Krama weekender', rating: 5, text: 'Beautiful weaving and enough room for a weekend away.', date: 'Oct 03, 2026', status: 'Pending' },
  { id: 'REV-1838', customer: 'Nita Chhay', product: 'Lotus hand cream', rating: 4, text: 'Light scent and absorbs quickly. Will order again.', date: 'Oct 02, 2026', status: 'Pending' },
  { id: 'REV-1829', customer: 'Vanna Keo', product: 'Mekong rattan lamp', rating: 5, text: 'Lovely warm light, just as pictured.', date: 'Oct 01, 2026', status: 'Approved' },
  { id: 'REV-1810', customer: 'Anonymous', product: 'Kampot pepper trio', rating: 2, text: 'Review flagged for moderator review.', date: 'Sep 28, 2026', status: 'Reported' }
];

export const demoCommerceNotifications: { id: string; kind: CommerceNoticeKind; title: string; description: string; time: string; read: boolean }[] = [
  { id: 'NTF-4401', kind: 'Order', title: 'New order received', description: 'Order MM-2084 · $84.00 · 3 items', time: '3 min ago', read: false },
  { id: 'NTF-4399', kind: 'Inventory', title: 'Low stock warning', description: 'Sunrise silk scarf has 11 units remaining.', time: '28 min ago', read: false },
  { id: 'NTF-4392', kind: 'Payment', title: 'Payment recorded', description: 'Cash on delivery · order MM-2079', time: '1 hour ago', read: false },
  { id: 'NTF-4388', kind: 'Review', title: 'Review needs moderation', description: 'A new 4-star review is awaiting approval.', time: '2 hours ago', read: true },
  { id: 'NTF-4370', kind: 'Customer', title: 'New customer account', description: 'A customer joined from Phnom Penh.', time: 'Yesterday', read: true },
  { id: 'NTF-4362', kind: 'Security', title: 'Security alert reviewed', description: 'A new-device sign-in alert was acknowledged.', time: 'Yesterday', read: true }
];

export const demoRevenueBreakdown = [
  { label: 'Gross revenue', amount: 43690, change: '+12.8%' },
  { label: 'Discounts', amount: -1840, change: '4.2% of gross' },
  { label: 'Refunds', amount: -620, change: '8 orders' },
  { label: 'Shipping fees', amount: 2180, change: 'Collected' },
  { label: 'Net revenue', amount: 43410, change: '+10.4%' }
];
