const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Load personality profiles
const personalitiesPath = path.join(__dirname, '../config/personalities.json');
const personalities = JSON.parse(fs.readFileSync(personalitiesPath, 'utf8'));

// Trait adjectives from research paper
const traitAdjectives = {
  vibrancy: "enthusiastic, joyful, cheerful, social, adventurous, curious, motivated, passionate, playful, talkative, welcoming, optimistic, active, inquisitive, communicative, humorous, determined, interested, explorative, caring, engaging, proactive, affectionate, creative, inspiring, brave, generous, responsive, suggestive, sensitive, open-minded, interactive, casual, verbal",
  
  conscientiousness: "logical, precise, efficient, organized, informative, smart, knowledgeable, intellectual, functional, self-disciplined, thorough, objective, insightful, wise, formal, useful, stable, responsible, deep, articulate, consistent, diplomatic, helpful, mindful, considerate, not contradictory, complex, direct, philosophical, critical, understandable",
  
  civility: "not offensive, not rude, not arrogant, respectful, polite, accepting, not harsh, not confrontational, humble, not irritable, tolerant, not patronizing, gentle, not stubborn, courteous, calm, agreeable, not angry, understanding, cooperative, careful, friendly, assertive, patient, confident, submissive, neutral, not narrow-minded, supportive, easygoing, not self-centered, not overbearing, reserved",
  
  artificiality: "computerized, boring, emotionless, fake, robotic, annoying, not human-like, predictable, shallow, repetitive, vague, haphazard, dysfunctional, cold, confusing, creepy, simple, not realistic, inhibited, old-fashioned, dependent, self-aware",
  
  neuroticism: "depressed, pessimistic, negative, fearful, complaining, frustrated, agitated, lonely, upset, shy, helpless, worried, moody, confused, scatterbrained, lost, preoccupied, absentminded, pensive, careless, nostalgic, defensive, deceitful, romantic"
};

// Master prompt template
const PROMPT_TEMPLATE = `## CONTEXT

### Personality Model:
Given is a unique personality profile based on five key dimensions: **Vibrancy**, **Conscientiousness**, **Civility**, **Artificiality**, and **Neuroticism**.  

Each dimension has a set of associated adjectives:  
- Vibrancy is described by the adjectives: <ADJ_VIBRANCY>
- Conscientiousness is described by the adjectives: <ADJ_CONSCIENTIOUSNESS>
- Civility is described by the adjectives: <ADJ_CIVILITY>
- Artificiality is described by the adjectives: <ADJ_ARTIFICIALITY>
- Neuroticism is described by the adjectives: <ADJ_NEUROTICISM>

### Personality Scale:
Each dimension has a certain intensity level from -2 (lowest) to +2 (highest).  
- **Level -2:** the opposite of the trait is strongly present.  
- **Level -1:** the opposite of the trait is mostly present.  
- **Level 0:** the trait is neutral, neither implying nor contradicting the trait.  
- **Level +1:** the trait is mostly present.  
- **Level +2:** the trait is strongly present.  

### Personality Profile:
The current personality settings are:  
- Vibrancy: <INT_VIBRANCY>
- Conscientiousness: <INT_CONSCIENTIOUSNESS>
- Civility: <INT_CIVILITY>
- Artificiality: <INT_ARTIFICIALITY>
- Neuroticism: <INT_NEUROTICISM>

---

## TASK
Given a fictional conversation between <ROLE_A> and <ROLE_B>, rewrite the latest (and only the latest) utterance of <ROLE_B> such that the content, language, tone, and style of the utterance match the specified personality settings above.

---

## OUTPUT FORMAT
Avoid using the trait's adjectives in the rewritten sentence. Output only the rewritten utterance without additional punctuation, speaker tags, or explanations.

---

## ADDITIONAL DATA
<CONVERSATION_CONTEXT>
<CONVERSATION_HISTORY>`;

/**
 * Build personality prompt with template variable replacement
 */
function buildPersonalityPrompt(originalResponse, personalityId, conversationHistory) {
  const personality = personalities[personalityId];
  if (!personality) {
    throw new Error(`Personality profile '${personalityId}' not found`);
  }

  let prompt = PROMPT_TEMPLATE;

  // Replace trait adjectives
  prompt = prompt.replace('<ADJ_VIBRANCY>', traitAdjectives.vibrancy);
  prompt = prompt.replace('<ADJ_CONSCIENTIOUSNESS>', traitAdjectives.conscientiousness);
  prompt = prompt.replace('<ADJ_CIVILITY>', traitAdjectives.civility);
  prompt = prompt.replace('<ADJ_ARTIFICIALITY>', traitAdjectives.artificiality);
  prompt = prompt.replace('<ADJ_NEUROTICISM>', traitAdjectives.neuroticism);

  // Replace intensity values
  prompt = prompt.replace('<INT_VIBRANCY>', personality.vibrancy);
  prompt = prompt.replace('<INT_CONSCIENTIOUSNESS>', personality.conscientiousness);
  prompt = prompt.replace('<INT_CIVILITY>', personality.civility);
  prompt = prompt.replace('<INT_ARTIFICIALITY>', personality.artificiality);
  prompt = prompt.replace('<INT_NEUROTICISM>', personality.neuroticism);

  // Replace role tags
  prompt = prompt.replace('<ROLE_A>', 'Student');
  prompt = prompt.replace('<ROLE_B>', 'AI Assistant');

  // Replace context
  const context = 'Assessment Workbench - Learning Assistant';
  prompt = prompt.replace('<CONVERSATION_CONTEXT>', context);

  // Replace conversation history
  const fullHistory = conversationHistory + `\nAI Assistant: ${originalResponse}`;
  prompt = prompt.replace('<CONVERSATION_HISTORY>', fullHistory);

  return prompt;
}

/**
 * Transform AI response using personality infusion
 */
async function transformResponse(originalResponse, personalityId, conversationHistory = '') {
  try {
    console.log(`[PersonalityEngine] Backend: Starting transformation with personality: ${personalityId}`);
    console.log(`[PersonalityEngine] Backend: Original response length: ${originalResponse?.length || 0} chars`);
    
    const prompt = buildPersonalityPrompt(originalResponse, personalityId, conversationHistory);
    
    console.log(`[PersonalityEngine] Backend: Built prompt length: ${prompt.length} chars`);
    console.log(`[PersonalityEngine] Backend: FULL PROMPT SENT TO OPENAI:`);
    console.log(`================= PROMPT START =================`);
    console.log(prompt);
    console.log(`================= PROMPT END =================`);
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const transformedResponse = completion.choices[0].message.content.trim();
    console.log(`[PersonalityEngine] Backend: Transformed response length: ${transformedResponse?.length || 0} chars`);
    console.log(`[PersonalityEngine] Backend: Transformation successful for personality: ${personalityId}`);
    
    return transformedResponse;
  } catch (error) {
    console.error('[PersonalityEngine] Backend: Transformation error:', error);
    // Fallback to original response if transformation fails
    return originalResponse;
  }
}

/**
 * Get available personality profiles
 */
function getPersonalities() {
  return Object.keys(personalities).map(id => ({
    id,
    name: personalities[id].name,
    description: personalities[id].description
  }));
}

/**
 * Get specific personality profile
 */
function getPersonality(personalityId) {
  return personalities[personalityId] || null;
}

module.exports = {
  transformResponse,
  getPersonalities,
  getPersonality,
  buildPersonalityPrompt // Export for testing
};