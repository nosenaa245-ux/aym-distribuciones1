import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const cfg = JSON.parse(fs.readFileSync(path.resolve('./firebase-applet-config.json'), 'utf-8'));
  const app = initializeApp(cfg);
  const db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
  }, cfg.firestoreDatabaseId);

  console.log('Connecting to Firestore...');
  const snap = await getDocs(collection(db, 'products'));
  console.log(`Fetched ${snap.size} products from Firestore.`);

  const products = snap.docs.map(docSnap => {
    const d = docSnap.data();
    return {
      id: docSnap.id,
      name: d.name || '',
      category: d.category || 'Varios',
      price: Number(d.price) || 0,
      originalPrice: d.originalPrice ? Number(d.originalPrice) : undefined,
      description: d.description || '',
      imageUrl: d.imageUrl || d.image || 'bilac',
      featured: Boolean(d.featured),
      rating: d.rating ? Number(d.rating) : 4.8,
      reviewsCount: d.reviewsCount ? Number(d.reviewsCount) : 10,
      stock: typeof d.stock === 'number' ? d.stock : 100,
      minPurchase: d.minPurchase ? Number(d.minPurchase) : 1,
      unit: d.unit || 'unidad',
      sku: d.sku || undefined,
      barcode: d.barcode || undefined,
      hasPromotion: Boolean(d.hasPromotion),
      promoBadge: d.promoBadge || undefined,
      brand: d.brand || undefined,
    };
  });

  // Sort by name or featured
  products.sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return a.name.localeCompare(b.name);
  });

  const outPath = path.resolve('./src/data/firebase_products.json');
  fs.writeFileSync(outPath, JSON.stringify(products, null, 2), 'utf-8');
  console.log(`Saved ${products.length} products to ${outPath}`);

  // Also check categories from Firestore
  try {
    const catSnap = await getDocs(collection(db, 'settings'));
    let categories: string[] = [];
    catSnap.forEach(cd => {
      if (cd.id === 'categories' && Array.isArray(cd.data()?.list)) {
        categories = cd.data().list;
      }
    });
    if (categories.length > 0) {
      console.log(`Found ${categories.length} categories in Firestore.`);
    }
  } catch (e) {}

  process.exit(0);
}

main().catch(err => {
  console.error('Error pulling products:', err);
  process.exit(1);
});
