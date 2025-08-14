const express = require('express');
const { requireJwtAuth } = require('~/server/middleware');
const { transformResponse, getPersonalities } = require('~/utils/personalityEngine');
const { getMessages } = require('~/models');

const router = express.Router();
router.use(requireJwtAuth);

/**
 * @route GET /api/personality/profiles
 * @desc Get all available personality profiles
 * @access Private
 */
router.get('/profiles', (req, res) => {
  try {
    const personalities = getPersonalities();
    res.json({ personalities });
  } catch (error) {
    console.error('Error fetching personalities:', error);
    res.status(500).json({ error: 'Failed to fetch personality profiles' });
  }
});

/**
 * @route POST /api/personality/transform
 * @desc Transform AI response with personality
 * @access Private
 */
router.post('/transform', async (req, res) => {
  try {
    const { originalResponse, personalityId, conversationId } = req.body;
    
    if (!originalResponse || !personalityId) {
      return res.status(400).json({ 
        error: 'Missing required fields: originalResponse and personalityId' 
      });
    }

    // Get conversation history for context (last 5 messages)
    let conversationHistory = '';
    if (conversationId) {
      try {
        const messages = await getMessages({ 
          conversationId, 
          limit: 5,
          sort: { createdAt: -1 } 
        });
        
        conversationHistory = messages
          .reverse() // Show in chronological order
          .map(msg => `${msg.isCreatedByUser ? 'Student' : 'AI Assistant'}: ${msg.text}`)
          .join('\\n');
      } catch (historyError) {
        console.warn('Could not fetch conversation history:', historyError);
      }
    }

    // Transform the response
    const transformedResponse = await transformResponse(
      originalResponse,
      personalityId,
      conversationHistory,
      'Assessment Workbench - Learning Assistant'
    );

    res.json({ 
      originalResponse,
      transformedResponse,
      personalityId,
      success: true 
    });

  } catch (error) {
    console.error('Personality transformation error:', error);
    res.status(500).json({ 
      error: 'Failed to transform response',
      details: error.message 
    });
  }
});

/**
 * @route POST /api/personality/intercept
 * @desc Middleware endpoint to intercept and transform responses
 * @access Private  
 */
router.post('/intercept', async (req, res) => {
  try {
    const { 
      response, 
      personalityId = 'neutral', 
      conversationId,
      userMessage 
    } = req.body;

    // Skip transformation if personality is neutral or not specified
    if (!personalityId || personalityId === 'neutral') {
      return res.json({ response, transformed: false });
    }

    // Build conversation context
    let conversationHistory = '';
    if (userMessage) {
      conversationHistory = `Student: ${userMessage}`;
    }

    // Add recent conversation history
    if (conversationId) {
      try {
        const messages = await getMessages({ 
          conversationId, 
          limit: 4, // Get 4 previous messages + current user message = 5 total
          sort: { createdAt: -1 } 
        });
        
        const previousHistory = messages
          .reverse()
          .map(msg => `${msg.isCreatedByUser ? 'Student' : 'AI Assistant'}: ${msg.text}`)
          .join('\\n');
          
        conversationHistory = previousHistory + (conversationHistory ? `\\n${conversationHistory}` : '');
      } catch (historyError) {
        console.warn('Could not fetch conversation history:', historyError);
      }
    }

    // Transform the response
    const transformedResponse = await transformResponse(
      response,
      personalityId,
      conversationHistory,
      'Assessment Workbench - Learning Assistant'
    );

    res.json({ 
      response: transformedResponse,
      original: response,
      transformed: true,
      personalityId 
    });

  } catch (error) {
    console.error('Personality interception error:', error);
    // Fallback to original response on error
    res.json({ 
      response: req.body.response,
      transformed: false,
      error: error.message 
    });
  }
});

module.exports = router;