const { sendEvent } = require('@librechat/api');
const { logger } = require('@librechat/data-schemas');
const { Constants } = require('librechat-data-provider');
const {
  handleAbortError,
  createAbortController,
  cleanupAbortController,
} = require('~/server/middleware');
const { disposeClient, clientRegistry, requestDataMap } = require('~/server/cleanup');
const { saveMessage } = require('~/models');
const { transformResponse } = require('~/utils/personalityEngine');

// Helper function to get user's selected personality from session or default
const getUserPersonality = (req) => {
  // For now, check if personality is passed in request body or headers
  // In production, this would come from user preferences in database
  const personality = req.body.personality || req.headers['x-personality'] || 'neutral';
  logger.info(`[PersonalityEngine] Backend: Extracted personality from request: ${personality}`);
  logger.info(`[PersonalityEngine] Backend: Request body personality: ${req.body.personality}`);
  logger.info(`[PersonalityEngine] Backend: Request header personality: ${req.headers['x-personality']}`);
  return personality;
};

const AgentController = async (req, res, next, initializeClient, addTitle) => {
  console.log('[PersonalityEngine] CONSOLE: Full request body:', req.body);
  console.log('[PersonalityEngine] CONSOLE: Keys:', Object.keys(req.body));
  console.log('[PersonalityEngine] CONSOLE: Personality:', req.body.personality);
  logger.info(`[PersonalityEngine] DEBUG: Has text: ${!!req.body.text}`);
  logger.info(`[PersonalityEngine] DEBUG: Has personality: ${!!req.body.personality}`);
  
  let {
    text,
    isRegenerate,
    endpointOption,
    conversationId,
    isContinued = false,
    editedContent = null,
    parentMessageId = null,
    overrideParentMessageId = null,
    responseMessageId: editedResponseMessageId = null,
  } = req.body;

  let sender;
  let abortKey;
  let userMessage;
  let promptTokens;
  let userMessageId;
  let responseMessageId;
  let userMessagePromise;
  let getAbortData;
  let client = null;
  // Initialize as an array
  let cleanupHandlers = [];

  const newConvo = !conversationId;
  const userId = req.user.id;

  // Create handler to avoid capturing the entire parent scope
  let getReqData = (data = {}) => {
    for (let key in data) {
      if (key === 'userMessage') {
        userMessage = data[key];
        userMessageId = data[key].messageId;
      } else if (key === 'userMessagePromise') {
        userMessagePromise = data[key];
      } else if (key === 'responseMessageId') {
        responseMessageId = data[key];
      } else if (key === 'promptTokens') {
        promptTokens = data[key];
      } else if (key === 'sender') {
        sender = data[key];
      } else if (key === 'abortKey') {
        abortKey = data[key];
      } else if (!conversationId && key === 'conversationId') {
        conversationId = data[key];
      }
    }
  };

  // Create a function to handle final cleanup
  const performCleanup = () => {
    logger.debug('[AgentController] Performing cleanup');
    // Make sure cleanupHandlers is an array before iterating
    if (Array.isArray(cleanupHandlers)) {
      // Execute all cleanup handlers
      for (const handler of cleanupHandlers) {
        try {
          if (typeof handler === 'function') {
            handler();
          }
        } catch (e) {
          logger.error('[AgentController] Error in cleanup handler', e);
        }
      }
    }

    // Clean up abort controller
    if (abortKey) {
      logger.debug('[AgentController] Cleaning up abort controller');
      cleanupAbortController(abortKey);
    }

    // Dispose client properly
    if (client) {
      disposeClient(client);
    }

    // Clear all references
    client = null;
    getReqData = null;
    userMessage = null;
    getAbortData = null;
    endpointOption.agent = null;
    endpointOption = null;
    cleanupHandlers = null;
    userMessagePromise = null;

    // Clear request data map
    if (requestDataMap.has(req)) {
      requestDataMap.delete(req);
    }
    logger.debug('[AgentController] Cleanup completed');
  };

  try {
    /** @type {{ client: TAgentClient }} */
    const result = await initializeClient({ req, res, endpointOption });
    client = result.client;

    // Register client with finalization registry if available
    if (clientRegistry) {
      clientRegistry.register(client, { userId }, client);
    }

    // Store request data in WeakMap keyed by req object
    requestDataMap.set(req, { client });

    // Use WeakRef to allow GC but still access content if it exists
    const contentRef = new WeakRef(client.contentParts || []);

    // Minimize closure scope - only capture small primitives and WeakRef
    getAbortData = () => {
      // Dereference WeakRef each time
      const content = contentRef.deref();

      return {
        sender,
        content: content || [],
        userMessage,
        promptTokens,
        conversationId,
        userMessagePromise,
        messageId: responseMessageId,
        parentMessageId: overrideParentMessageId ?? userMessageId,
      };
    };

    const { abortController, onStart } = createAbortController(req, res, getAbortData, getReqData);

    // Simple handler to avoid capturing scope
    const closeHandler = () => {
      logger.debug('[AgentController] Request closed');
      if (!abortController) {
        return;
      } else if (abortController.signal.aborted) {
        return;
      } else if (abortController.requestCompleted) {
        return;
      }

      abortController.abort();
      logger.debug('[AgentController] Request aborted on close');
    };

    res.on('close', closeHandler);
    cleanupHandlers.push(() => {
      try {
        res.removeListener('close', closeHandler);
      } catch (e) {
        logger.error('[AgentController] Error removing close listener', e);
      }
    });

    const messageOptions = {
      user: userId,
      onStart,
      getReqData,
      isContinued,
      isRegenerate,
      editedContent,
      conversationId,
      parentMessageId,
      abortController,
      overrideParentMessageId,
      isEdited: !!editedContent,
      responseMessageId: editedResponseMessageId,
      progressOptions: {
        res,
      },
    };

    let response = await client.sendMessage(text, messageOptions);

    // Extract what we need and immediately break reference
    const messageId = response.messageId;
    const endpoint = endpointOption.endpoint;
    response.endpoint = endpoint;

    // Store database promise locally
    const databasePromise = response.databasePromise;
    delete response.databasePromise;

    // Resolve database-related data
    const { conversation: convoData = {} } = await databasePromise;
    const conversation = { ...convoData };
    conversation.title =
      conversation && !conversation.title ? null : conversation?.title || 'New Chat';

    // Process files if needed
    if (req.body.files && client.options?.attachments) {
      userMessage.files = [];
      const messageFiles = new Set(req.body.files.map((file) => file.file_id));
      for (let attachment of client.options.attachments) {
        if (messageFiles.has(attachment.file_id)) {
          userMessage.files.push({ ...attachment });
        }
      }
      delete userMessage.image_urls;
    }

    // Only send if not aborted
    if (!abortController.signal.aborted) {
      // Create a new response object with minimal copies
      const finalResponse = { ...response };
      
      // Apply personality transformation to the response text
      try {
        const userPersonality = getUserPersonality(req);
        console.log(`[PersonalityEngine] TRANSFORM: About to transform with personality: ${userPersonality}`);
        console.log(`[PersonalityEngine] TRANSFORM: Response object keys:`, Object.keys(finalResponse));
        console.log(`[PersonalityEngine] TRANSFORM: Response object:`, JSON.stringify(finalResponse, null, 2));
        console.log(`[PersonalityEngine] TRANSFORM: Has response text:`, !!finalResponse.text);
        console.log(`[PersonalityEngine] TRANSFORM: Response text length:`, finalResponse.text?.length || 0);
        
        // Extract text from either text field or content array
        const responseText = finalResponse.text || 
          (finalResponse.content && finalResponse.content[0] && finalResponse.content[0].text);
        
        console.log(`[PersonalityEngine] TRANSFORM: Extracted response text:`, !!responseText);
        console.log(`[PersonalityEngine] TRANSFORM: Extracted text length:`, responseText?.length || 0);
        
        if (userPersonality !== 'neutral' && responseText) {
          logger.info(`[PersonalityEngine] Transforming response with personality: ${userPersonality}`);
          console.log(`[PersonalityEngine] TRANSFORM: Calling transformResponse...`);
          const transformedText = await transformResponse(responseText, userPersonality);
          console.log(`[PersonalityEngine] TRANSFORM: Got transformed text:`, !!transformedText);
          console.log(`[PersonalityEngine] TRANSFORM: Transformed length:`, transformedText?.length || 0);
          
          if (transformedText && transformedText !== responseText) {
            // Update both text field and content array with transformed text
            if (finalResponse.text) {
              finalResponse.text = transformedText;
            }
            if (finalResponse.content && finalResponse.content[0] && finalResponse.content[0].text) {
              finalResponse.content[0].text = transformedText;
            }
            logger.info(`[PersonalityEngine] Response transformed successfully`);
            console.log(`[PersonalityEngine] TRANSFORM: Applied transformation successfully`);
          } else {
            console.log(`[PersonalityEngine] TRANSFORM: No transformation applied - same text or empty result`);
          }
        } else {
          console.log(`[PersonalityEngine] TRANSFORM: Skipping - neutral personality or no text`);
        }
      } catch (error) {
        logger.error(`[PersonalityEngine] Transformation failed: ${error.message}`);
        console.log(`[PersonalityEngine] TRANSFORM: ERROR:`, error);
        // Continue with original response if transformation fails
      }

      sendEvent(res, {
        final: true,
        conversation,
        title: conversation.title,
        requestMessage: userMessage,
        responseMessage: finalResponse,
      });
      res.end();

      // Save the message if needed
      if (client.savedMessageIds && !client.savedMessageIds.has(messageId)) {
        await saveMessage(
          req,
          { ...finalResponse, user: userId },
          { context: 'api/server/controllers/agents/request.js - response end' },
        );
      }
    }

    // Save user message if needed
    if (!client.skipSaveUserMessage) {
      await saveMessage(req, userMessage, {
        context: "api/server/controllers/agents/request.js - don't skip saving user message",
      });
    }

    // Add title if needed - extract minimal data
    if (addTitle && parentMessageId === Constants.NO_PARENT && newConvo) {
      addTitle(req, {
        text,
        response: { ...response },
        client,
      })
        .then(() => {
          logger.debug('[AgentController] Title generation started');
        })
        .catch((err) => {
          logger.error('[AgentController] Error in title generation', err);
        })
        .finally(() => {
          logger.debug('[AgentController] Title generation completed');
          performCleanup();
        });
    } else {
      performCleanup();
    }
  } catch (error) {
    // Handle error without capturing much scope
    handleAbortError(res, req, error, {
      conversationId,
      sender,
      messageId: responseMessageId,
      parentMessageId: overrideParentMessageId ?? userMessageId ?? parentMessageId,
      userMessageId,
    })
      .catch((err) => {
        logger.error('[api/server/controllers/agents/request] Error in `handleAbortError`', err);
      })
      .finally(() => {
        performCleanup();
      });
  }
};

module.exports = AgentController;
