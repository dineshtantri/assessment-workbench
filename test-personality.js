const path = require('path');

// Set up the environment to match the API server
process.env.NODE_ENV = 'development';
require('dotenv').config();

// Import the personality engine
const { transformResponse, getPersonalities } = require('./api/utils/personalityEngine');

async function testPersonalityEngine() {
  console.log('🧪 Testing Personality Engine\n');
  
  // Test 1: Get available personalities
  console.log('1️⃣ Available Personalities:');
  try {
    const personalities = getPersonalities();
    personalities.forEach(p => {
      console.log(`   ${p.id}: ${p.name} - ${p.description}`);
    });
    console.log('');
  } catch (error) {
    console.error('❌ Error getting personalities:', error.message);
    return;
  }

  // Test 2: Transform responses with different personalities
  const originalResponse = "I understand that everyone wants to make the most of their budget. What specifically are you hoping to negotiate to get a better deal?";
  
  console.log('2️⃣ Original Response:');
  console.log(`   "${originalResponse}"\n`);

  const testPersonalities = ['encouraging_mentor', 'technical_expert', 'socratic_teacher', 'direct_coach'];
  
  for (const personalityId of testPersonalities) {
    console.log(`3️⃣ Testing ${personalityId.replace('_', ' ').toUpperCase()}:`);
    try {
      const transformedResponse = await transformResponse(
        originalResponse,
        personalityId,
        'Student: I want to learn about budgeting for my sustainability app project.',
        'Assessment Workbench - Research Phase'
      );
      
      console.log(`   ✅ Transformed: "${transformedResponse}"\n`);
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`   ❌ Error with ${personalityId}:`, error.message);
      console.log('');
    }
  }

  console.log('🎉 Personality engine test completed!');
}

// Run the test
testPersonalityEngine().catch(console.error);