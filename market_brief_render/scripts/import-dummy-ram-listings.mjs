import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { randomInt } from 'node:crypto';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const sourcePath = process.argv[2];
const replaceExisting = process.argv.includes('--replace');
const dryRun = process.argv.includes('--dry-run');
const pythonExecutable = process.env.PYTHON_EXECUTABLE;
function optionValue(name, fallback) {
  const position = process.argv.indexOf(name);
  return position === -1 ? fallback : process.argv[position + 1];
}
function countOption(name) {
  const value = Number(optionValue(name, '0'));
  if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer.`);
  return value;
}
const sellerLoginId = optionValue('--seller', 'seller');
const reservedCount = countOption('--reserved');
const soldCount = countOption('--sold');
const workbookReader = "import json, pandas as pd, sys; df = pd.read_excel(sys.argv[1], sheet_name=0).astype(object).where(lambda value: pd.notna(value), None); print(json.dumps(df.to_dict(orient='records'), ensure_ascii=False, allow_nan=False, default=str))";

if (!sourcePath) throw new Error('Usage: node scripts/import-dummy-ram-listings.mjs <source.xlsx> [--seller loginId] [--reserved count] [--sold count] [--replace] [--dry-run]');
if (!pythonExecutable) throw new Error('Set PYTHON_EXECUTABLE to a Python runtime that has pandas installed.');
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing Supabase credentials.');

const readWorkbook = spawnSync(pythonExecutable, ['-X', 'utf8', '-c', workbookReader, sourcePath], { encoding: 'utf8' });
if (readWorkbook.status !== 0) throw new Error(readWorkbook.stderr || 'Could not read the source workbook.');

const rows = JSON.parse(readWorkbook.stdout);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const conditions = ['like_new', 'good', 'new', 'good', 'like_new', 'fair'];
const priceMultipliers = { new: 0.88, like_new: 0.81, good: 0.74, fair: 0.67 };
const conditionText = {
  new: '미개봉 보관품입니다.',
  like_new: '테스트 후 보관해 상태가 깔끔합니다.',
  good: '정상 사용하던 제품이며 인식 확인했습니다.',
  fair: '사용감은 있지만 정상 작동 확인했습니다.'
};
const shippingText = [
  '직거래와 택배 거래 모두 가능합니다.',
  '안전결제 또는 택배 거래 가능합니다.',
  '거래 방식은 편하게 문의해 주세요.',
  '포장해서 택배 발송 가능합니다.'
];
const categoryOptions = {
  DDR5: { capacityGb: [8, 12, 16, 24, 32, 64, 128], clockMhz: [5600, 6000] },
  DDR4: { capacityGb: [4, 8, 16, 32, 64], clockMhz: [2666, 3200] }
};

function valueOf(row, ...headers) {
  for (const header of headers) {
    if (row[header] !== undefined && row[header] !== null && String(row[header]).trim()) return String(row[header]).trim();
  }
  throw new Error(`Missing workbook field: ${headers.join(' / ')}`);
}

function integerOf(value) {
  const matches = [...String(value).matchAll(/(\d[\d,]*)\s*원/g)].map((match) => Number(match[1].replaceAll(',', '')));
  if (!matches.length && /^\d[\d,]*$/.test(String(value).trim())) return Number(String(value).replaceAll(',', ''));
  if (!matches.length) throw new Error(`Could not find a won price in: ${value}`);
  return Math.min(...matches);
}

function closestValue(value, options) {
  return options.reduce((closest, candidate) => {
    const candidateDistance = Math.abs(candidate - value);
    const closestDistance = Math.abs(closest - value);
    return candidateDistance < closestDistance || (candidateDistance === closestDistance && candidate < closest) ? candidate : closest;
  });
}

function capacityDetails(value, standard, configuration = '') {
  const capacity = String(value).replaceAll(' ', '');
  const pairMatch = capacity.match(/^(\d+)GB\((\d+)G[xX]2\)$/i);
  const configurationPairMatch = String(configuration).match(/(\d+)\s*GB\s*[xX×]\s*2/i);
  const totalMatch = capacity.match(/^(\d+)(?:GB)?/i);
  if (!totalMatch) throw new Error(`Could not read capacity: ${value}`);
  const options = categoryOptions[standard]?.capacityGb;
  const sourceUnitGb = pairMatch ? Number(pairMatch[2]) : configurationPairMatch ? Number(configurationPairMatch[1]) : Number(totalMatch[1]);
  // The listing form has no 48GB option. The supplied 96GB(48GB×2) kits are
  // represented as the requested 24GB two-module example.
  const displayedGb = options
    ? (sourceUnitGb === 48 && pairMatch ? 24 : closestValue(sourceUnitGb, options))
    : sourceUnitGb;
  return {
    displayedGb,
    quantity: pairMatch || configurationPairMatch ? 2 : 1,
    configuration: pairMatch || configurationPairMatch ? `${displayedGb}GB 2개` : `${displayedGb}GB`
  };
}

function normalizedClock(value, standard) {
  const sourceClock = Number(String(value).match(/\d+/)?.[0]);
  if (!sourceClock) throw new Error(`Could not read clock: ${value}`);
  const options = categoryOptions[standard]?.clockMhz;
  return options ? closestValue(sourceClock, options) : sourceClock;
}

function withinTitleLimit(value) {
  return value.length <= 100 ? value : `${value.slice(0, 97).trim()}...`;
}

function makeListing(row, index) {
  const manufacturer = valueOf(row, '제조사');
  const standard = valueOf(row, '규격(DDR, DDR4)', '규격');
  const capacityInfo = capacityDetails(valueOf(row, '용량', '용량(GB)'), standard, row['구성']);
  const clock = normalizedClock(valueOf(row, '클럭', '클럭(MHz)'), standard);
  const sourceDevice = valueOf(row, '상품 종류(데스크탑, 노트북)', '사용장치');
  const productType = sourceDevice === '노트북' ? 'laptop' : 'desktop';
  const deviceLabel = productType === 'laptop' ? '노트북용' : '데스크탑용';
  const condition = conditions[index % conditions.length];
  const marketPrice = integerOf(valueOf(row, '가격', '최저가(원)'));
  const askingPrice = Math.max(10000, Math.round((marketPrice * priceMultipliers[condition]) / 1000) * 1000);
  const unitText = capacityInfo.quantity === 2 ? `${capacityInfo.displayedGb}GB 메모리 두장` : `${capacityInfo.displayedGb}GB 메모리`;
  const quantityText = capacityInfo.quantity === 2 ? ` ${capacityInfo.displayedGb}GB 제품 두 장을 함께 판매하며, 판매 가격은 두 장 일괄 기준입니다.` : '';
  const category = `${standard} · ${clock}MHz · ${capacityInfo.displayedGb}GB`;
  const title = capacityInfo.quantity === 2
    ? `${manufacturer} ${standard}-${clock}MHz ${capacityInfo.displayedGb}GB 두장 판매합니다`
    : `${manufacturer} ${standard}-${clock}MHz ${capacityInfo.displayedGb}GB ${deviceLabel} RAM 판매`;
  const description = `${manufacturer} ${unitText} 판매합니다. ${standard} ${clock}MHz, ${capacityInfo.configuration} 구성입니다.${quantityText} ${conditionText[condition]} ${shippingText[index % shippingText.length]}`;

  return {
    title: withinTitleLimit(title),
    description,
    category,
    product_type: productType,
    condition,
    asking_price: askingPrice,
    status: 'active',
    created_at: new Date(Date.now() - index * 4.5 * 60 * 60 * 1000).toISOString()
  };
}

async function deleteSellerListings(sellerId) {
  const { data: products, error: productsError } = await supabase.from('products').select('id').eq('seller_id', sellerId);
  if (productsError) throw productsError;
  const ids = (products ?? []).map((product) => product.id);
  if (!ids.length) return 0;

  const { error: messagesError } = await supabase.from('messages').delete().in('product_id', ids);
  if (messagesError) throw messagesError;
  const { error: deleteError } = await supabase.from('products').delete().in('id', ids);
  if (deleteError) throw deleteError;
  return ids.length;
}

async function insertInBatches(listings, sellerId) {
  for (let start = 0; start < listings.length; start += 50) {
    const { error } = await supabase.from('products').insert(listings.slice(start, start + 50).map((listing) => ({ ...listing, seller_id: sellerId })));
    if (error) throw error;
  }
}

function assignStatuses(listings) {
  if (reservedCount + soldCount > listings.length) {
    throw new Error(`Requested ${reservedCount + soldCount} non-active listings for only ${listings.length} source rows.`);
  }
  const shuffledIndices = Array.from({ length: listings.length }, (_, index) => index);
  for (let index = shuffledIndices.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [shuffledIndices[index], shuffledIndices[swapIndex]] = [shuffledIndices[swapIndex], shuffledIndices[index]];
  }
  const statuses = Array.from({ length: listings.length }, () => 'active');
  for (const index of shuffledIndices.slice(0, reservedCount)) statuses[index] = 'reserved';
  for (const index of shuffledIndices.slice(reservedCount, reservedCount + soldCount)) statuses[index] = 'sold';
  return listings.map((listing, index) => ({ ...listing, status: statuses[index] }));
}

const listings = assignStatuses(rows.map(makeListing));
const summary = {
  sourceRows: rows.length,
  serverConverted: rows.filter((row) => row['상품 종류(데스크탑, 노트북)'] === '서버용').length,
  ddr3Other: listings.filter((listing) => listing.category.startsWith('DDR3 · ')).length,
  twoModuleListings: listings.filter((listing) => /두장 판매합니다/.test(listing.title)).length,
  source96GbPairs: rows.filter((row) => /^96GB\(48G[xX]2\)$/i.test(String(row['용량'] ?? row['용량(GB)']).replaceAll(' ', ''))).length,
  twentyFourGbPairListings: listings.filter((listing) => /24GB 두장 판매합니다/.test(listing.title)).length,
  active: listings.filter((listing) => listing.status === 'active').length,
  reserved: listings.filter((listing) => listing.status === 'reserved').length,
  sold: listings.filter((listing) => listing.status === 'sold').length
};
if (dryRun) {
  console.log(JSON.stringify({ ...summary, preview: listings.filter((listing) => /24GB 두장 판매합니다/.test(listing.title)).slice(0, 2) }));
  process.exit(0);
}

const { data: seller, error: sellerError } = await supabase
  .from('users')
  .select('id,login_id')
  .eq('login_id', sellerLoginId)
  .maybeSingle();
if (sellerError) throw sellerError;
if (!seller) throw new Error(`The ${sellerLoginId} account does not exist.`);

const deleted = replaceExisting ? await deleteSellerListings(seller.id) : 0;
await insertInBatches(listings, seller.id);

console.log(JSON.stringify({ ...summary, seller: seller.login_id, deleted, inserted: listings.length }));
