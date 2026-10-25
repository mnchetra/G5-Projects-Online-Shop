import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
	{ slug: 'electronics', nameEn: 'Electronics', nameKm: 'អេឡិចត្រូនិក', sortOrder: 1, imageUrl: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=800&q=85' },
	{ slug: 'fashion', nameEn: 'Fashion', nameKm: 'ម៉ូដ', sortOrder: 2, imageUrl: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=85' },
	{ slug: 'beauty-care', nameEn: 'Beauty', nameKm: 'សម្រស់', sortOrder: 3, imageUrl: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=800&q=85' },
	{ slug: 'home-living', nameEn: 'Home & living', nameKm: 'គេហដ្ឋាន និងការរស់នៅ', sortOrder: 4, imageUrl: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=85' },
	{ slug: 'sports', nameEn: 'Sports', nameKm: 'កីឡា', sortOrder: 5, imageUrl: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=800&q=85' },
	{ slug: 'accessories', nameEn: 'Accessories', nameKm: 'គ្រឿងបន្ថែម', sortOrder: 6, imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=85' },
	{ slug: 'shoes', nameEn: 'Shoes', nameKm: 'ស្បែកជើង', sortOrder: 7, imageUrl: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=800&q=85' },
	{ slug: 'computers', nameEn: 'Computers', nameKm: 'កុំព្យូទ័រ', sortOrder: 8, imageUrl: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=800&q=85' },
	{ slug: 'phones', nameEn: 'Phones', nameKm: 'ទូរស័ព្ទ', sortOrder: 9, imageUrl: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=85' },
	{ slug: 'pantry', nameEn: 'Pantry', nameKm: 'អាហារដ្ឋាន', sortOrder: 10, imageUrl: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=800&q=85' }
];

const products = [
	{ slug: 'mekong-rattan-lamp', sku: 'HOME-001', category: 'home-living', nameEn: 'Mekong rattan lamp', nameKm: 'ចង្កៀងផ្តៅមេគង្គ', descriptionEn: 'Handwoven rattan shade with a warm, quiet glow. Made by a family workshop near the Mekong.', descriptionKm: 'ចង្កៀងផ្តៅត្បាញដោយដៃ បញ្ចេញពន្លឺកក់ក្តៅ។ ផលិតដោយសិប្បកម្មគ្រួសារក្បែរទន្លេមេគង្គ។', price: 48, stock: 16, featured: true, image: 'photo-1507473885765-e6ed057f782c' },
	{ slug: 'krama-weekender', sku: 'ACC-001', category: 'accessories', nameEn: 'Krama weekender', nameKm: 'កាបូបដំណើរក្រមា', descriptionEn: 'A roomy everyday carryall woven with a traditional Cambodian krama pattern.', descriptionKm: 'កាបូបធំទូលាយសម្រាប់ប្រើប្រចាំថ្ងៃ ត្បាញជាមួយលំនាំក្រមាខ្មែរ។', price: 36, stock: 24, featured: true, image: 'photo-1553062407-98eeb64c6a62' },
	{ slug: 'palm-sugar-set', sku: 'PAN-001', category: 'pantry', nameEn: 'Kampong Speu palm sugar', nameKm: 'ស្ករត្នោតកំពង់ស្ពឺ', descriptionEn: 'Deep caramel notes from small-batch palm sugar, packed in a reusable glass jar.', descriptionKm: 'ស្ករត្នោតផលិតជាបាច់តូច មានរសជាតិការ៉ាមែល និងវេចខ្ចប់ក្នុងកែវប្រើឡើងវិញបាន។', price: 12, stock: 42, featured: true, image: 'photo-1587049352846-4a222e784d38' },
	{ slug: 'lotus-hand-cream', sku: 'BEA-001', category: 'beauty-care', nameEn: 'Lotus hand cream', nameKm: 'ក្រែមលាបដៃផ្កាឈូក', descriptionEn: 'A light, fast-absorbing botanical hand cream with lotus and lemongrass.', descriptionKm: 'ក្រែមលាបដៃរុក្ខជាតិស្រាល ស្រូបចូលស្បែករហ័ស មានផ្កាឈូក និងស្លឹកគ្រៃ។', price: 18, stock: 31, featured: false, image: 'photo-1608248543803-ba4f8c70ae0b' },
	{ slug: 'tonle-ceramic-cup', sku: 'HOME-002', category: 'home-living', nameEn: 'Tonle ceramic cup', nameKm: 'ពែងសេរ៉ាមិចទន្លេ', descriptionEn: 'A hand-finished stoneware cup, each one subtly different and made for slow mornings.', descriptionKm: 'ពែងសេរ៉ាមិចធ្វើដោយដៃ មួយៗមានលក្ខណៈខុសគ្នាបន្តិច សម្រាប់ពេលព្រឹកដ៏ស្ងប់ស្ងាត់។', price: 22, stock: 19, featured: false, image: 'photo-1514228742587-6b1558fcca3d' },
	{ slug: 'silk-scarf-sunrise', sku: 'ACC-002', category: 'accessories', nameEn: 'Sunrise silk scarf', nameKm: 'កន្សែងសូត្រព្រះអាទិត្យរះ', descriptionEn: 'Soft Cambodian silk in a hand-dyed sunrise palette, finished with delicate fringe.', descriptionKm: 'សូត្រខ្មែរទន់ល្អ ពណ៌ជ្រលក់ដោយដៃដូចពន្លឺថ្ងៃរះ និងមានរំយោលស្រស់ស្អាត។', price: 54, stock: 11, featured: true, image: 'photo-1601924994987-69e26d50dc26' },
	{ slug: 'peppercorn-trio', sku: 'PAN-002', category: 'pantry', nameEn: 'Kampot pepper trio', nameKm: 'ម្រេចកំពតបីប្រភេទ', descriptionEn: 'A tasting set of red, white and black Kampot pepper from a small family farm.', descriptionKm: 'ឈុតសាករសជាតិម្រេចកំពតក្រហម ស និងខ្មៅ ពីកសិដ្ឋានគ្រួសារតូចមួយ។', price: 26, stock: 28, featured: false, image: 'photo-1596040033229-a9821ebd058d' },
	{ slug: 'sugar-palm-basket', sku: 'HOME-003', category: 'home-living', nameEn: 'Palm leaf market basket', nameKm: 'កន្ត្រកស្លឹកត្នោត', descriptionEn: 'Lightweight woven palm basket for market days, picnics and everything in between.', descriptionKm: 'កន្ត្រកស្លឹកត្នោតទម្ងន់ស្រាល សម្រាប់ទៅផ្សារ ដើរលេង និងការប្រើប្រាស់ប្រចាំថ្ងៃ។', price: 29, stock: 14, featured: false, image: 'photo-1590874103328-eac38a683ce7' },
	{ slug: 'mekong-portable-speaker', sku: 'ELE-001', category: 'electronics', nameEn: 'Mekong portable speaker', nameKm: 'ឧបករណ៍បំពងសំឡេងចល័តមេគង្គ', descriptionEn: 'A compact Bluetooth speaker with clear sound and a long-lasting rechargeable battery.', descriptionKm: 'ឧបករណ៍បំពងសំឡេង Bluetooth តូចងាយយកតាមខ្លួន មានសំឡេងច្បាស់ និងថ្មសាកប្រើបានយូរ។', price: 42, stock: 18, featured: true, image: 'photo-1608043152269-423dbba4e7e1' },
	{ slug: 'compact-power-bank', sku: 'ELE-002', category: 'electronics', nameEn: 'Compact power bank', nameKm: 'ថ្មសាកចល័តទំហំតូច', descriptionEn: 'Pocket-sized backup power with USB-C charging for everyday trips.', descriptionKm: 'ថ្មសាកចល័តទំហំតូច សម្រាប់សាកតាម USB-C នៅពេលធ្វើដំណើរ។', price: 28, stock: 26, featured: false, image: 'photo-1609592806596-b43bada2f8b7' },
	{ slug: 'everyday-linen-shirt', sku: 'FAS-001', category: 'fashion', nameEn: 'Everyday linen shirt', nameKm: 'អាវក្រណាត់លីនប្រចាំថ្ងៃ', descriptionEn: 'A breathable relaxed-fit shirt made for warm days and easy layering.', descriptionKm: 'អាវពាក់ស្រួលធ្វើពីក្រណាត់លីន ខ្យល់ចេញចូលល្អ សមស្របសម្រាប់ថ្ងៃក្តៅ។', price: 32, stock: 21, featured: true, image: 'photo-1521572163474-6864f9cf17ab' },
	{ slug: 'cotton-market-dress', sku: 'FAS-002', category: 'fashion', nameEn: 'Cotton market dress', nameKm: 'រ៉ូបកប្បាសសម្រាប់ដើរផ្សារ', descriptionEn: 'A soft cotton day dress with a comfortable cut and practical pockets.', descriptionKm: 'រ៉ូបកប្បាសទន់ ពាក់ស្រួល មានហោប៉ៅប្រើប្រាស់បានពិត។', price: 39, stock: 14, featured: false, image: 'photo-1490481651871-ab68de25d43d' },
	{ slug: 'lemongrass-body-balm', sku: 'BEA-002', category: 'beauty-care', nameEn: 'Lemongrass body balm', nameKm: 'ប្រទាលកន្ទុយក្រពើស្លឹកគ្រៃ', descriptionEn: 'A nourishing botanical balm with a light lemongrass scent.', descriptionKm: 'ប្រទាលរុក្ខជាតិជួយបំប៉នស្បែក មានក្លិនស្លឹកគ្រៃស្រាល។', price: 16, stock: 32, featured: true, image: 'photo-1608248543803-ba4f8c70ae0b' },
	{ slug: 'lotus-face-oil', sku: 'BEA-003', category: 'beauty-care', nameEn: 'Lotus face oil', nameKm: 'ប្រេងថែរក្សាស្បែកមុខផ្កាឈូក', descriptionEn: 'A lightweight face oil blended for a calm evening skincare routine.', descriptionKm: 'ប្រេងថែរក្សាស្បែកមុខស្រាល សម្រាប់ប្រើក្នុងការថែរក្សាស្បែកពេលល្ងាច។', price: 24, stock: 19, featured: false, image: 'photo-1608571423902-eed4a5ad8108' },
	{ slug: 'stoneware-serving-jug', sku: 'HOME-004', category: 'home-living', nameEn: 'Stoneware serving jug', nameKm: 'ក្អមសេរ៉ាមិចសម្រាប់បម្រើភេសជ្ជៈ', descriptionEn: 'A hand-finished ceramic jug for water, juice and the family table.', descriptionKm: 'ក្អមសេរ៉ាមិចធ្វើដោយដៃ សម្រាប់ដាក់ទឹក និងភេសជ្ជៈលើតុអាហារគ្រួសារ។', price: 34, stock: 12, featured: false, image: 'photo-1578500494198-246f612d3b3d' },
	{ slug: 'reusable-sport-bottle', sku: 'SPO-001', category: 'sports', nameEn: 'Reusable sport bottle', nameKm: 'ដបទឹកកីឡាប្រើឡើងវិញ', descriptionEn: 'A durable insulated bottle that keeps water cool through an active day.', descriptionKm: 'ដបទឹករឹងមាំជួយរក្សាទឹកឱ្យត្រជាក់ សម្រាប់សកម្មភាពប្រចាំថ្ងៃ។', price: 19, stock: 38, featured: true, image: 'photo-1602143407151-7111542de6e8' },
	{ slug: 'travel-yoga-mat', sku: 'SPO-002', category: 'sports', nameEn: 'Travel yoga mat', nameKm: 'កម្រាលយូហ្គាសម្រាប់ធ្វើដំណើរ', descriptionEn: 'A lightweight textured mat that rolls up neatly for classes and travel.', descriptionKm: 'កម្រាលទម្ងន់ស្រាលមានផ្ទៃជាប់ល្អ អាចរមូរយកទៅរៀន ឬធ្វើដំណើរ។', price: 36, stock: 9, featured: false, image: 'photo-1592432678016-e910b452f9a2' },
	{ slug: 'woven-market-sandals', sku: 'SHO-001', category: 'shoes', nameEn: 'Woven market sandals', nameKm: 'ស្បែកជើងត្បាញសម្រាប់ដើរផ្សារ', descriptionEn: 'Light everyday sandals with a woven upper and a cushioned footbed.', descriptionKm: 'ស្បែកជើងពាក់ប្រចាំថ្ងៃទម្ងន់ស្រាល ផ្នែកខាងលើត្បាញ និងបាតទន់ស្រួល។', price: 27, stock: 17, featured: true, image: 'photo-1543163521-1bf539c55dd2' },
	{ slug: 'trail-running-shoes', sku: 'SHO-002', category: 'shoes', nameEn: 'Trail running shoes', nameKm: 'ស្បែកជើងរត់ផ្លូវលំ', descriptionEn: 'Supportive grip and a breathable upper for city runs and light trails.', descriptionKm: 'បាតមានជំហរកាន់ល្អ និងក្រណាត់ខ្យល់ចេញចូល សម្រាប់រត់ក្នុងក្រុង និងផ្លូវលំ។', price: 58, stock: 8, featured: false, image: 'photo-1542291026-7eec264c27ff' },
	{ slug: 'woven-laptop-sleeve', sku: 'COM-001', category: 'computers', nameEn: 'Woven laptop sleeve', nameKm: 'ស្រោមកុំព្យូទ័រយួរដៃត្បាញ', descriptionEn: 'A padded laptop sleeve with a simple woven exterior and secure closure.', descriptionKm: 'ស្រោមកុំព្យូទ័រមានស្រទាប់ការពារ ខាងក្រៅត្បាញសាមញ្ញ និងបិទជិតបានល្អ។', price: 31, stock: 16, featured: true, image: 'photo-1496181133206-80ce9b88a853' },
	{ slug: 'compact-wireless-keyboard', sku: 'COM-002', category: 'computers', nameEn: 'Compact wireless keyboard', nameKm: 'ក្តារចុចឥតខ្សែទំហំតូច', descriptionEn: 'A compact wireless keyboard for a tidy desk and everyday work.', descriptionKm: 'ក្តារចុចឥតខ្សែទំហំតូច សម្រាប់តុធ្វើការរៀបរយ និងការងារប្រចាំថ្ងៃ។', price: 45, stock: 11, featured: false, image: 'photo-1587829741301-dc798b83add3' },
	{ slug: 'usb-c-phone-charger', sku: 'PHO-001', category: 'phones', nameEn: 'USB-C phone charger', nameKm: 'ឆ្នាំងសាកទូរស័ព្ទ USB-C', descriptionEn: 'A compact fast charger with a durable cable for daily use.', descriptionKm: 'ឆ្នាំងសាកលឿនទំហំតូច ភ្ជាប់ខ្សែរឹងមាំសម្រាប់ប្រើរាល់ថ្ងៃ។', price: 22, stock: 29, featured: true, image: 'photo-1583863788434-e58a36330cf0' },
	{ slug: 'everyday-phone-case', sku: 'PHO-002', category: 'phones', nameEn: 'Everyday phone case', nameKm: 'ស្រោមទូរស័ព្ទប្រចាំថ្ងៃ', descriptionEn: 'A slim protective case with a soft-touch finish and raised camera edge.', descriptionKm: 'ស្រោមការពារស្តើង ផ្ទៃកាន់ស្រួល និងមានគែមការពារកាមេរ៉ា។', price: 14, stock: 33, featured: false, image: 'photo-1601784551446-20c9e07cdbdb' }
];

async function main() {
	for (const category of categories) await prisma.category.upsert({ where: { slug: category.slug }, update: category, create: category });
	for (const product of products) {
		const { category: slug, image, featured, ...data } = product;
		const productData = { ...data, isFeatured: featured };
		const category = await prisma.category.findUniqueOrThrow({ where: { slug } });
		const imageUrl = `https://images.unsplash.com/${image}?auto=format&fit=crop&w=1000&q=85`;
		const existing = await prisma.product.findUnique({ where: { slug: data.slug } });
		if (existing) {
			await prisma.product.update({ where: { id: existing.id }, data: { ...productData, categoryId: category.id, images: { deleteMany: {}, create: { url: imageUrl, altEn: data.nameEn, altKm: data.nameKm } } } });
		} else {
			await prisma.product.create({ data: { ...productData, categoryId: category.id, images: { create: { url: imageUrl, altEn: data.nameEn, altKm: data.nameKm } } } });
		}
	}
	const email = process.env.SEED_ADMIN_EMAIL;
	const password = process.env.SEED_ADMIN_PASSWORD;
	if (email && password) {
		await prisma.user.upsert({ where: { email }, update: {}, create: { name: 'Store administrator', email, role: 'ADMIN', passwordHash: await bcrypt.hash(password, 12) } });
	}
	console.info(`Seeded ${categories.length} categories and ${products.length} products.`);
}

main().finally(() => prisma.$disconnect());
