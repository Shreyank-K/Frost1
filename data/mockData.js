import { normalizeFlip } from '../utils/flipModel';

const MOCK_ITEMS = [
  {
    id: '1',
    title: "Nike Air Force 1 '07 White",
    category: 'Sneakers',
    condition: 'New',
    buy: 65,
    sell: 120,
    fees: 8.6,
    confidence: 'HIGH',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: '2',
    title: 'Vintage Casio G-Shock DW-5600',
    category: 'Watches',
    condition: 'Used - Good',
    buy: 35,
    sell: 89,
    fees: 7.57,
    confidence: 'MEDIUM',
    image: 'https://images.unsplash.com/photo-1522312346375-d1a52e2b99b3?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: '3',
    title: 'Sony WH-1000XM4 Headphones',
    category: 'Electronics',
    condition: 'Refurbished',
    buy: 120,
    sell: 210,
    fees: 15.3,
    confidence: 'HIGH',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: '4',
    title: 'Vintage AirPods Case',
    category: 'Accessories',
    condition: 'Used - Good',
    buy: 18,
    sell: 60.5,
    fees: 3.5,
    confidence: 'HIGH',
    image: 'https://via.placeholder.com/800x600.png?text=AirPods'
  },
  {
    id: '5',
    title: 'Retro Sneaker Pair',
    category: 'Fashion',
    condition: 'New',
    buy: 40,
    sell: 64,
    fees: 2.0,
    confidence: 'MEDIUM',
    image: 'https://via.placeholder.com/800x600.png?text=Sneakers'
  },
  {
    id: '6',
    title: 'Collectible Watch (Quartz)',
    category: 'Accessories',
    condition: 'Used - Fair',
    buy: 120,
    sell: 130.25,
    fees: 5.0,
    confidence: 'LOW',
    image: 'https://via.placeholder.com/800x600.png?text=Watch'
  }
];

export default MOCK_ITEMS.map(item => normalizeFlip(item));
