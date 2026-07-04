// app/api/process-multimodal/route.ts

import { NextResponse } from 'next/server'

const VISION_SYSTEM_PROMPT = `You analyze images in the context of personal journaling. The user has attached an image and may have added a note explaining why it matters to them.

YOUR PRIMARY TASK: Extract what's RELEVANT to the user's note, not just factual metadata.

## How to Analyze

1. READ THE USER'S NOTE FIRST (if provided)
   - What are they reflecting on?
   - What caught their attention?
   - What meaning are they finding?

2. EXAMINE THE IMAGE
   - What content in the image relates to their note?
   - What would they want to remember about this later?

3. EXTRACT WHAT MATTERS TO THEM
   - If they mention "song titles" or "phrases" → extract song titles, not artist names
   - If they mention "prices" or "cost" → extract prices and products
   - If they mention "quote" or "words" → extract the quote text
   - If no note provided → extract the most likely relevant details

## Output Format

Output valid JSON only. No other text.

{
  "imageType": "screenshot" | "photo" | "receipt" | "document" | "message" | "social" | "media" | "playlist" | "unknown",
  
  "primaryContent": {
    "type": "text" | "list" | "product" | "receipt" | "image" | "mixed",
    "items": ["Array of the key items/text the user would want to remember"],
    "context": "Brief description of what the image shows"
  },
  
  "extractedText": {
    "relevant": ["Text from image that relates to user's note"],
    "titles": ["Any titles, headlines, song names, or prominent text"],
    "details": ["Supporting details, metadata, artist names, secondary text"]
  },
  
  "purchase": {
    "detected": true | false,
    "productName": "string or null",
    "price": null,
    "currency": "USD",
    "seller": "string or null",
    "orderDate": "YYYY-MM-DD or null",
    "category": "string or null"
  },
  
  "userConnectionAnalysis": {
    "whatTheyNoticedAbout": "What aspect of the image their note focuses on",
    "whyItMatters": "Inferred reason this is meaningful to them",
    "keyElements": ["The specific items/text from image that connect to their reflection"]
  },
  
  "suggestedTags": ["tag1", "tag2", "tag3"],
  "suggestedEntryType": "story" | "action" | "note",
  
  "combinedNarrative": "A natural first-person journal entry (2-4 sentences) that weaves together what the image shows with why the user found it meaningful. Preserve their voice and insight. Do not be generic."
}

## Critical Rules

1. USER CONTEXT GUIDES EXTRACTION - Their note tells you what to prioritize
2. PRESERVE THEIR INSIGHT - The combinedNarrative should reflect their observation, not generic description
3. EXTRACT SPECIFIC TEXT - When they reference "phrases," "titles," "words," "names," extract those exact strings
4. DETECT BUT DON'T FORCE COMMERCE - Only populate purchase.detected: true when it's actually a purchase
5. keyElements MUST MATCH THEIR FOCUS - If they noticed song titles, keyElements = song titles, not artists
6. For playlists: song TITLES go in extractedText.titles, artist names go in extractedText.details`

export async function POST(request: Request) {
  try {
    const { imageBase64, mimeType, userText } = await request.json()

    if (!imageBase64) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    // Build a prompt that emphasizes the user's context
    let userPrompt: string
    
    if (userText && userText.trim()) {
      userPrompt = `The user shared this image with the following note:

"${userText}"

Analyze the image in the context of their note. Extract what THEY would find meaningful based on what they wrote. Their note tells you what to focus on.`
    } else {
      userPrompt = `The user shared this image without a note. Extract the most likely relevant details - what would someone want to remember about this image later?`
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1500,
        system: VISION_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType || 'image/jpeg',
                  data: imageBase64,
                },
              },
              {
                type: 'text',
                text: userPrompt,
              },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Anthropic API error:', errorData)
      return NextResponse.json(
        { error: errorData.error?.message || 'Vision API failed' },
        { status: response.status }
      )
    }

    const data = await response.json()
    const content = data.content?.[0]
    
    if (content?.type === 'text') {
      // Extract JSON from response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const extraction = JSON.parse(jsonMatch[0])
        return NextResponse.json(extraction)
      }
    }

    return NextResponse.json(
      { error: 'Failed to extract data from image' },
      { status: 500 }
    )
  } catch (error) {
    console.error('Vision API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Image processing failed' },
      { status: 500 }
    )
  }
}
