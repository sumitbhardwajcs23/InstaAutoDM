// tests/customTemplatesMetaApi.test.js
const assert = require('assert');
const metaClient = require('../backend/src/services/metaClient');

console.log('==================================================');
console.log('🧪 Testing Custom DM Templates & Meta API Generic Cards');
console.log('==================================================\n');

async function runTests() {

  // Test 1: Verify Meta Generic Template Payload Builder
  console.log('Test 1: Testing buildMessagePayload with rich card data...');
  const cardData = {
    title: '🎁 Exclusive 20% Discount Code: VIP20',
    subtitle: 'Use code VIP20 at checkout for 20% off today only!',
    image_url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8',
    button_text: 'Shop 20% Off 🛍️',
    button_url: 'https://yourbrand.com/shop'
  };

  const payload = metaClient.buildMessagePayload({
    messageText: 'Hey @user123! Here is your 20% discount code: VIP20',
    quickReplies: null,
    card: cardData
  });

  assert.ok(payload.attachment, 'Payload must contain attachment property');
  assert.strictEqual(payload.attachment.type, 'template', 'Attachment type must be template');
  assert.strictEqual(payload.attachment.payload.template_type, 'generic', 'Template type must be generic');
  
  const element = payload.attachment.payload.elements[0];
  assert.strictEqual(element.title, cardData.title.slice(0, 80));
  assert.strictEqual(element.image_url, cardData.image_url);
  assert.strictEqual(element.buttons[0].type, 'web_url');
  assert.strictEqual(element.buttons[0].url, cardData.button_url);
  assert.strictEqual(element.buttons[0].title, cardData.button_text.slice(0, 20));

  console.log('  ✅ PASS: Meta Generic Template attachment payload structured correctly according to Meta API specs!\n');

  // Test 2: Fallback behavior when card is null
  console.log('Test 2: Testing buildMessagePayload plain text fallback...');
  const plainPayload = metaClient.buildMessagePayload({
    messageText: 'Check out our sale: https://yourbrand.com/shop',
    quickReplies: null,
    card: null
  });

  assert.strictEqual(plainPayload.attachment, undefined, 'Plain payload must not have attachment');
  assert.strictEqual(plainPayload.text, 'Check out our sale: https://yourbrand.com/shop');
  console.log('  ✅ PASS: Plain text fallback payload structured correctly!\n');

  console.log('==================================================');
  console.log('🎉 All Custom Template & Meta API Card Tests Passed!');
  console.log('==================================================');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
