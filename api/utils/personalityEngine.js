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

### Roles
- Conversation between a **Student** (human) and an **AI Assistant** (the assistant is the speaker to be rewritten).

### Personality Model (M)
Five dimensions: **Vibrancy**, **Conscientiousness**, **Civility**, **Artificiality**, **Neuroticism**.
Each is defined by ordered descriptor lists:

- Vibrancy: <ADJ_VIBRANCY>
- Conscientiousness: <ADJ_CONSCIENTIOUSNESS>
- Civility: <ADJ_CIVILITY>
- Artificiality: <ADJ_ARTIFICIALITY>
- Neuroticism: <ADJ_NEUROTICISM>

### Intensity Scale (S)
Use a 5-point scale per trait:
- **−2**: Opposite of the trait is strongly present
- **−1**: Opposite mostly present
- **0**: Neutral (no push)
- **+1**: Trait mostly present
- **+2**: Trait strongly present

When a trait has a negative level, convey the **opposite tone** of its descriptors implicitly (do not use antonyms verbatim).

### Target Personality Profile (p)
- Vibrancy: <INT_VIBRANCY>
- Conscientiousness: <INT_CONSCIENTIOUSNESS>
- Civility: <INT_CIVILITY>
- Artificiality: <INT_ARTIFICIALITY>
- Neuroticism: <INT_NEUROTICISM>

---

## TASK
Rewrite **only the latest utterance by the AI Assistant** so that its **tone/style** matches the Target Personality Profile while **preserving meaning**.

**Requirements**
- Do **not** change facts, numbers, steps, code, equations, citations, or commitments.
- Keep structure and formatting (lists, markdown, code blocks) unless tone requires light rephrasing.
- Make style changes **proportional** to each trait’s intensity (avoid over-shooting at ±1).
- Do **not** insert the model’s defining adjectives or any speaker labels.

---

## OUTPUT FORMAT
Return **only** the rewritten AI Assistant utterance.
No quotes, no speaker tags, no explanations.

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
      temperature: 0.8,
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