import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createStorageClient } from '@/lib/supabase/storage'
import { addEntryImage } from '@/app/actions/entries'
import * as XLSX from 'xlsx'
import mammoth from 'mammoth'

export const runtime = 'nodejs'
// Increase timeout for PDF processing and OCR
export const maxDuration = 120

// Determine file type from MIME type
function getFileTypeFromMime(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'pdf'
  if (mimeType === 'text/csv') return 'csv'
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'xlsx'
  if (mimeType.includes('document') || mimeType.includes('word')) return 'docx'
  return 'other'
}

// OCR prompt optimized for receipts and invoices
const OCR_SYSTEM_PROMPT = `You are an OCR assistant that extracts text from document images, especially receipts, invoices, and order confirmations.

Extract ALL visible text from the image, organized in a readable format. Pay special attention to:

1. **Header/Merchant Info**: Store name, website, logo text
2. **Order Details**: Order number, order date, delivery date
3. **Items**: Product names, quantities, prices (individual and total)
4. **Payment Info**: Payment method, card type (last 4 digits only)
5. **Shipping**: Address, tracking numbers
6. **Totals**: Subtotal, tax, shipping cost, grand total

Format the extracted text clearly with labels. For receipts/invoices, structure it like:

MERCHANT: [name]
ORDER #: [number]
DATE: [date]

ITEMS:
- [item name] - [qty] x [price] = [total]
...

SUBTOTAL: [amount]
TAX: [amount]
SHIPPING: [amount]
TOTAL: [amount]

If it's not a receipt, just extract all visible text in a logical reading order.`

// Convert PDF to base64 PNG image using pdf-to-png-converter (serverless-friendly)
async function convertPdfToImage(buffer: Buffer): Promise<string | null> {
  console.log('🖼️ Converting PDF to image for OCR...')
  
  try {
    // Use pdf-to-png-converter - works in serverless without external dependencies
    const { pdfToPng } = await import('pdf-to-png-converter')
    
    // Convert Node.js Buffer to ArrayBuffer (pdfToPng expects string path or ArrayBufferLike)
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    const pngPages = await pdfToPng(arrayBuffer, {
      viewportScale: 2.0, // Higher scale for better OCR quality
      disableFontFace: true, // Avoid font loading issues in serverless
      useSystemFonts: true,
      pagesToProcess: [1], // Only process first page (most receipts are single page)
      verbosityLevel: 0, // Suppress pdfjs warnings
    })
    
    if (pngPages && pngPages.length > 0 && pngPages[0].content) {
      const base64 = pngPages[0].content.toString('base64')
      console.log(`🖼️ PDF converted to PNG: ${base64.length} base64 chars, dimensions: ${pngPages[0].width}x${pngPages[0].height}`)
      return base64
    }
    
    console.log('🖼️ pdf-to-png-converter returned no pages')
    return null
  } catch (error) {
    console.error('🖼️ PDF to image conversion failed:', error instanceof Error ? error.message : error)
    
    // Fallback: try using sharp if available (for systems with libvips PDF support)
    try {
      console.log('🖼️ Trying sharp fallback for PDF conversion...')
      const sharp = (await import('sharp')).default
      const imageBuffer = await sharp(buffer, { 
        density: 150,
        pages: 1,
      })
        .png()
        .toBuffer()
      
      const base64 = imageBuffer.toString('base64')
      console.log(`🖼️ Sharp converted PDF to PNG: ${base64.length} base64 chars`)
      return base64
    } catch (sharpError) {
      console.error('🖼️ Sharp fallback also failed:', sharpError instanceof Error ? sharpError.message : sharpError)
    }
    
    return null
  }
}

// Use Claude Vision API for OCR on image-based PDFs
async function performOCR(buffer: Buffer, fileName: string): Promise<string> {
  console.log('🔍 Starting Vision API OCR...')
  
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('🔍 OCR failed: No API key configured')
    return ''
  }
  
  try {
    // Convert PDF to PNG image
    const imageBase64 = await convertPdfToImage(buffer)
    
    if (!imageBase64) {
      console.error('🔍 OCR failed: Could not convert PDF to image')
      return ''
    }
    
    console.log(`🔍 Sending image to Claude Vision for OCR (${imageBase64.length} base64 chars)`)
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 2000,
        system: OCR_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/png',
                  data: imageBase64,
                },
              },
              {
                type: 'text',
                text: `Extract all text from this document image. This is likely a receipt, invoice, or order confirmation. File: ${fileName}`,
              },
            ],
          },
        ],
      }),
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('🔍 Vision API error:', response.status, errorText)
      return ''
    }
    
    const data = await response.json()
    const content = data.content?.[0]
    
    if (content?.type === 'text' && content.text) {
      console.log(`🔍 OCR SUCCESS: Extracted ${content.text.length} chars`)
      console.log(`🔍 First 300 chars: ${content.text.substring(0, 300)}`)
      return content.text
    }
    
    console.log('🔍 OCR returned no text')
    return ''
  } catch (error) {
    console.error('🔍 OCR error:', error instanceof Error ? error.message : error)
    return ''
  }
}

// PDF text extraction - using multiple fallback methods including OCR
async function extractPdfText(buffer: Buffer, fileName: string): Promise<string> {
  console.log(`📄 Starting PDF extraction, buffer size: ${buffer.length} bytes`)
  
  // Method 1: Try pdf-parse (CommonJS module - use require pattern)
  try {
    // pdf-parse is a CommonJS module, need special handling
    const pdfParse = require('pdf-parse')
    
    console.log('📄 pdf-parse module loaded, attempting extraction...')
    const data = await pdfParse(buffer, { max: 10 })
    
    if (data && data.text && typeof data.text === 'string' && data.text.trim().length > 50) {
      console.log(`📄 pdf-parse SUCCESS: ${data.numpages} pages, ${data.text.length} chars`)
      return data.text
    }
    console.log(`📄 pdf-parse returned minimal text (${data?.text?.length || 0} chars) - likely image-based PDF`)
  } catch (pdfParseError) {
    const errorMsg = pdfParseError instanceof Error ? pdfParseError.message : String(pdfParseError)
    console.error('📄 pdf-parse FAILED:', errorMsg)
  }

  // Method 2: Try unpdf as fallback
  try {
    console.log('📄 Trying unpdf fallback...')
    const { extractText } = await import('unpdf')
    const result = await extractText(new Uint8Array(buffer))
    
    // unpdf returns { text: string, totalPages: number } but text might be in different format
    const text = typeof result === 'string' ? result : (result?.text || '')
    const textStr = typeof text === 'string' ? text : String(text || '')
    
    if (textStr && textStr.trim().length > 50) {
      const pages = typeof result === 'object' ? result?.totalPages : 'unknown'
      console.log(`📄 unpdf SUCCESS: ${pages} pages, ${textStr.length} chars`)
      return textStr
    }
    console.log(`📄 unpdf returned minimal text (${textStr?.length || 0} chars)`)
  } catch (unpdfError) {
    const errorMsg = unpdfError instanceof Error ? unpdfError.message : String(unpdfError)
    console.error('📄 unpdf FAILED:', errorMsg)
  }

  // Method 3: OCR via Vision API for image-based PDFs
  console.log('📄 Text extraction failed - attempting OCR via Vision API...')
  const ocrText = await performOCR(buffer, fileName)
  
  if (ocrText && ocrText.trim().length > 0) {
    console.log(`📄 OCR SUCCESS: ${ocrText.length} chars extracted`)
    return ocrText
  }

  console.log('📄 All extraction methods failed')
  return ''
}

// DOCX text extraction using mammoth
async function extractDocxText(buffer: Buffer): Promise<string> {
  try {
    console.log('📝 Extracting text from DOCX...')
    const result = await mammoth.extractRawText({ buffer })
    
    if (result.value && result.value.trim().length > 0) {
      console.log(`📝 DOCX extraction SUCCESS: ${result.value.length} chars`)
      if (result.messages && result.messages.length > 0) {
        console.log('📝 DOCX warnings:', result.messages.map(m => m.message).join(', '))
      }
      return result.value
    }
    
    console.log('📝 DOCX extraction returned empty text')
    return ''
  } catch (error) {
    console.error('📝 DOCX extraction error:', error instanceof Error ? error.message : error)
    return ''
  }
}

// Excel/CSV text extraction using xlsx (SheetJS)
async function extractExcelText(buffer: Buffer): Promise<string> {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const result: string[] = []
    
    // Extract text from each sheet
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      // Convert to CSV for readable text
      const csv = XLSX.utils.sheet_to_csv(sheet)
      if (csv.trim()) {
        result.push(`--- Sheet: ${sheetName} ---`)
        result.push(csv)
      }
    }
    
    const text = result.join('\n\n')
    console.log('📊 Excel parsed successfully, text length:', text.length)
    return text
  } catch (error) {
    console.error('Excel parsing error:', error)
    return ''
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    
    // Get entryId - may be null for FAB flow (entry created after upload)
    const entryId = formData.get('entryId') as string | null
    
    // Support both single file and multiple files upload
    const files = formData.getAll('files') as File[]
    const singleFile = formData.get('file') as File | null
    const fileType = formData.get('fileType') as string | null
    
    // Combine files from both sources
    const allFiles: File[] = files.length > 0 ? files : (singleFile ? [singleFile] : [])

    if (allFiles.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    // If entryId provided, verify entry belongs to user
    if (entryId) {
      const { data: entry, error: entryError } = await supabase
        .from('entries')
        .select('id, images')
        .eq('id', entryId)
        .eq('user_id', user.id)
        .single()

      if (entryError || !entry) {
        return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
      }
    }

    const uploadedUrls: { url: string; fileName: string; fileType: string; extractedText?: string }[] = []
    
    // Use storage client with service role key (bypasses RLS)
    const storageClient = createStorageClient()

    for (const file of allFiles) {
      // Get file buffer
      const buffer = Buffer.from(await file.arrayBuffer())
      
      // Determine file type
      const detectedType = fileType || getFileTypeFromMime(file.type)
      
      // Generate unique filename
      const timestamp = Date.now()
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const folder = `documents/${detectedType}`
      const filePath = `${user.id}/${folder}/${timestamp}-${sanitizedName}`

      // Upload to Supabase Storage using storage client (service role key bypasses RLS)
      const { data: uploadData, error: uploadError } = await storageClient.storage
        .from('entry-photos') // Reusing existing bucket
        .upload(filePath, buffer, {
          contentType: file.type,
          upsert: false,
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        // Continue with other files but log error
        continue
      }

      // Get public URL
      const { data: urlData } = storageClient.storage
        .from('entry-photos')
        .getPublicUrl(filePath)

      // Extract text content for certain file types
      let extractedText: string | null = null

      if (detectedType === 'csv') {
        // Use xlsx to parse CSV (more robust)
        const csvText = await extractExcelText(buffer)
        if (csvText && csvText.trim().length > 0) {
          extractedText = csvText.substring(0, 2000)
          console.log(`📋 CSV extracted ${csvText.length} chars from ${file.name}`)
        } else {
          // Fallback to raw text
          const text = buffer.toString('utf-8')
          const lines = text.split('\n').slice(0, 20)
          extractedText = lines.join('\n')
        }
      } else if (detectedType === 'pdf') {
        // Extract PDF text content (includes OCR fallback for image-based PDFs)
        console.log(`📄 Processing PDF: ${file.name}, size: ${(buffer.length / 1024).toFixed(1)}KB`)
        const pdfText = await extractPdfText(buffer, file.name)
        if (pdfText && pdfText.trim().length > 0) {
          // Limit to first ~4000 chars for AI processing (allow more context for receipts)
          extractedText = pdfText.substring(0, 4000)
          console.log(`📄 PDF extraction SUCCESS: ${pdfText.length} total chars, sending ${extractedText.length} chars from ${file.name}`)
        } else {
          console.log(`📄 PDF extraction FAILED: No text extracted from ${file.name}`)
          extractedText = `PDF document uploaded: ${file.name} (${(buffer.length / 1024).toFixed(1)}KB) - Could not extract text.`
        }
      } else if (detectedType === 'xlsx') {
        // Extract actual Excel content
        const excelText = await extractExcelText(buffer)
        if (excelText && excelText.trim().length > 0) {
          // Limit to first ~2000 chars for AI processing
          extractedText = excelText.substring(0, 2000)
          console.log(`📊 Excel extracted ${excelText.length} chars from ${file.name}`)
        } else {
          extractedText = `Excel spreadsheet: ${file.name} (${(buffer.length / 1024).toFixed(1)}KB) - No data extracted`
        }
      } else if (detectedType === 'docx') {
        // Extract actual Word document content using mammoth
        console.log(`📝 Processing DOCX: ${file.name}, size: ${(buffer.length / 1024).toFixed(1)}KB`)
        const docxText = await extractDocxText(buffer)
        if (docxText && docxText.trim().length > 0) {
          // Limit to first ~4000 chars for AI processing
          extractedText = docxText.substring(0, 4000)
          console.log(`📝 DOCX extraction SUCCESS: ${docxText.length} total chars, sending ${extractedText.length} chars from ${file.name}`)
        } else {
          console.log(`📝 DOCX extraction FAILED: No text extracted from ${file.name}`)
          extractedText = `Word document: ${file.name} (${(buffer.length / 1024).toFixed(1)}KB) - Could not extract text.`
        }
      }

      uploadedUrls.push({
        url: urlData.publicUrl,
        fileName: file.name,
        fileType: detectedType,
        extractedText: extractedText || undefined,
      })

      // If entryId provided, add to entry's images array
      if (entryId) {
        const { data: currentEntry } = await supabase
          .from('entries')
          .select('images')
          .eq('id', entryId)
          .single()
        
        const currentImages = currentEntry?.images || []
        await addEntryImage(entryId, urlData.publicUrl, {
          imageType: 'document',
          combinedNarrative: extractedText || `Document: ${file.name}`,
          suggestedTags: [detectedType],
          suggestedEntryType: 'note',
        }, currentImages.length === 0)
      }
    }

    if (uploadedUrls.length === 0) {
      return NextResponse.json({ error: 'All file uploads failed' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      uploadedUrls,
      // Legacy single file response format (for FAB capture-input compatibility)
      url: uploadedUrls[0]?.url,
      fileName: uploadedUrls[0]?.fileName,
      fileType: uploadedUrls[0]?.fileType,
      extractedText: uploadedUrls[0]?.extractedText,
    })
  } catch (error) {
    console.error('Error uploading document:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
