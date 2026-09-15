import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const sourcePath = process.argv[2];
const pythonExecutable = process.env.PYTHON_EXECUTABLE;
const sellerLoginId = 'seller';
const markerPrefix = '[시연 데이터: 국내 RAM 2026-09-15 #';
const workbookReader = "import json, pandas as pd, sys; df = pd.read_excel(sys.argv[1], sheet_name=0).astype(object).where(lambda value: pd.notna(value), None); print(json.dumps(df.to_dict(orient='records'), ensure_ascii=False, allow_nan=False, default=str))";

if (!sourcePath) throw new Error('Usage: node scripts/import-dummy-ram-listings.mjs <source.xlsx>');
if (!pythonExecutable) throw new Error('Set PYTHON_EXECUTABLE to a Python runtime that has pandas installed.');
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing Supabase credentials.');

const readWorkbook = spawnSync(
  pythonExecutable,
  ['-X', 'utf8', '-c', workbookReader, sourcePath],
  { encoding: 'utf8' }
);
if (readWorkbook.status !== 0) throw new Error(readWorkbook.stderr || 'Could not read the source workbook.');

const rows = JSON.parse(readWorkbook.stdout);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

function cleanProductName(name) {
  return String(name)
    .replace(/\s*\[[^\]]+\]\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function withinTitleLimit(value) {
  return value.length <= 100 ? value : `${value.slice(0, 97).trim()}...`;
}

function makeListing(row, index) {
  const standard = String(row['규격']);
  const device = String(row['사용장치']);
  const manufacturer = String(row['제조사']);
  const productName = cleanProductName(row['제품명']);
  const capacity = Number(row['용량(GB)']);
  const clock = Number(row['클럭(MHz)']);
  const configuration = String(row['구성']);
  const marketPrice = Number(row['최저가(원)']);
  const conditions = ['like_new', 'good', 'new', 'good', 'like_new', 'fair'];
  const condition = conditions[index % conditions.length];
  const priceMultipliers = { new: 0.88, like_new: 0.81, good: 0.74, fair: 0.67 };
  const askingPrice = Math.max(20000, Math.round((marketPrice * priceMultipliers[condition]) / 1000) * 1000);
  const conditionText = {
    new: '미개봉 보관품입니다.',
    like_new: '테스트 후 보관해 상태가 깔끔합니다.',
    good: '정상 사용하던 제품이며 인식 확인했습니다.',
    fair: '사용감은 있지만 정상 작동 확인했습니다.'
  }[condition];
  const shippingText = [
    '직거래와 택배 거래 모두 가능합니다.',
    '안전결제 또는 택배 거래 가능합니다.',
    '거래 방식은 편하게 문의해 주세요.',
    '포장해서 택배 발송 가능합니다.'
  ][index % 4];
  const titles = [
    `${productName} ${configuration} 팝니다`,
    `${manufacturer} ${standard}-${clock} ${capacity}GB 데스크탑 RAM 판매`,
    `${standard} ${clock}MHz ${configuration} 메모리 판매합니다`,
    `${manufacturer} ${capacity}GB RAM, 정상 인식 확인`,
    `데스크탑용 ${standard}-${clock} ${configuration} 판매`,
    `${productName} 메모리 정리합니다`
  ];
  const descriptions = [
    `${productName} ${configuration} 제품입니다. ${standard} ${clock}MHz, 총 ${capacity}GB 구성입니다. ${conditionText} ${shippingText}`,
    `컴퓨터 업그레이드 후 남은 ${manufacturer} 메모리입니다. ${standard}-${clock} 규격의 ${configuration} 구성이고 총 ${capacity}GB입니다. ${conditionText} ${shippingText}`,
    `${device}용 RAM 판매합니다. 모델은 ${productName}이며 ${standard} ${clock}MHz / ${configuration} 사양입니다. ${conditionText} ${shippingText}`,
    `${standard} ${capacity}GB 메모리입니다. ${productName} ${configuration} 구성으로 확인했고, 부팅 및 메모리 인식 테스트를 마쳤습니다. ${conditionText} ${shippingText}`,
    `사용하던 PC 부품 정리 중입니다. ${manufacturer} ${standard}-${clock}, ${configuration} 구성입니다. ${conditionText} ${shippingText}`,
    `${productName} 판매합니다. ${clock}MHz 클럭의 ${standard} 메모리이며 ${configuration}로 구성되어 있습니다. ${conditionText} ${shippingText}`
  ];
  const marker = `${markerPrefix}${String(index + 1).padStart(2, '0')}]`;
  return {
    title: withinTitleLimit(titles[index % titles.length]),
    description: `${descriptions[index % descriptions.length]}\n\n${marker}`,
    category: `${standard} · ${clock}MHz · ${capacity}GB`,
    product_type: device === '데스크탑' ? 'desktop' : 'laptop',
    condition,
    asking_price: askingPrice,
    status: 'active',
    created_at: new Date(Date.now() - index * 4.5 * 60 * 60 * 1000).toISOString()
  };
}

const { data: seller, error: sellerError } = await supabase
  .from('users')
  .select('id,login_id')
  .eq('login_id', sellerLoginId)
  .maybeSingle();
if (sellerError) throw sellerError;
if (!seller) throw new Error(`The ${sellerLoginId} account does not exist.`);

const { data: existing, error: existingError } = await supabase
  .from('products')
  .select('description')
  .eq('seller_id', seller.id)
  .ilike('description', `%${markerPrefix}%`);
if (existingError) throw existingError;
const existingMarkers = new Set((existing ?? []).map((product) => product.description.match(/#(\d{2})\]$/m)?.[1]).filter(Boolean));

const listings = rows
  .map(makeListing)
  .filter((listing) => !existingMarkers.has(listing.description.match(/#(\d{2})\]$/m)?.[1]));

if (listings.length) {
  const { error: insertError } = await supabase.from('products').insert(listings.map((listing) => ({ ...listing, seller_id: seller.id })));
  if (insertError) throw insertError;
}

console.log(JSON.stringify({ sourceRows: rows.length, seller: seller.login_id, inserted: listings.length, skippedExisting: rows.length - listings.length, imagesAttached: 0 }));
